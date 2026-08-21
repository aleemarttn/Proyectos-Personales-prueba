// Edge Function: analiza con Gemini (tier gratuito) una foto de ticket, de
// producto suelto, de la TABLA DE INFORMACIÓN NUTRICIONAL de un producto, o
// una CARTA DE RESTAURANTE, y devuelve la info detectada en JSON.
// La clave GEMINI_API_KEY se lee como secreto de Supabase, nunca del frontend.
//
// El modo 'carta' admite tres formas de entrada porque una carta real casi
// nunca cabe en una sola foto:
//   - `paginas`: hasta 6 fotos (carta de varias hojas) o un PDF subido.
//   - `url`: el enlace del QR de la mesa. Lo descarga ESTA función, no el
//     navegador — ver descargarCarta() para las protecciones anti-SSRF.
//   - `imagenBase64`: una sola imagen. Se mantiene por compatibilidad: el
//     service worker de la PWA cachea el bundle, así que hay clientes con el
//     frontend viejo llamando a esta función.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

const MIME_TYPES_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']
const MIME_PDF = 'application/pdf'

// Base64 tiene ~4/3 del tamaño del binario original. 7,000,000 caracteres
// son ~5,25 MB binarios: de sobra para las fotos ya comprimidas por
// comprimirImagen() en el cliente, y suficiente para frenar un payload
// desproporcionado antes de gastar tiempo/cuota de Gemini en él. Ahora el
// tope se aplica a la SUMA de todas las páginas, no a cada una.
const MAX_BASE64_CHARS = 7_000_000
const MAX_PAGINAS = 6

// Límites de la descarga del enlace del QR.
const MAX_BYTES_DESCARGA = 8 * 1024 * 1024
const MS_TIMEOUT_DESCARGA = 8_000
const MAX_REDIRECCIONES = 3
const MAX_CHARS_TEXTO_WEB = 40_000
// Por debajo de esto la web no trae carta legible: casi siempre es una SPA
// que la pinta con JavaScript, y un fetch plano solo ve el HTML vacío.
const MIN_CHARS_TEXTO_WEB = 200

// Cuántos platos devolvemos como mucho. La pregunta del usuario es "¿qué
// pido?", no "transcríbeme la carta": de una carta de 80 platos interesan
// los que encajan, y una lista corta se lee de un vistazo en el móvil.
const MAX_PLATOS = 10

const CATEGORIAS_VALIDAS = [
  'Proteínas',
  'Hidratos',
  'Grasas',
  'Verduras',
  'Fruta',
  'Lácteos',
  'Otros',
]

// Lista blanca de orígenes desde variable de entorno (separados por comas),
// más el dominio de producción conocido y localhost para desarrollo, como
// red de seguridad si se despliega esto sin fijar el secreto ALLOWED_ORIGINS
// primero. Un origen no listado simplemente no recibe cabecera
// Access-Control-Allow-Origin, así que el navegador bloquea la lectura de la
// respuesta (la petición de un usuario autenticado desde un origen ajeno no
// consigue leer el resultado).
// IMPORTANTE al desplegar: fija el secreto real con
//   supabase secrets set ALLOWED_ORIGINS=https://tu-dominio.com,https://otro-dominio.com
// El valor de abajo es solo un fallback para no romper producción si se
// despliega antes de fijarlo.
const ORIGENES_PERMITIDOS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://nutri-gasto-app-1ppr.vercel.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)
  .concat(['http://localhost:5173', 'http://127.0.0.1:5173'])

function corsHeaders(req: Request) {
  const origen = req.headers.get('Origin') || ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }
  if (ORIGENES_PERMITIDOS.includes(origen)) {
    headers['Access-Control-Allow-Origin'] = origen
  }
  return headers
}

// Error cuyo mensaje está redactado para enseñárselo al usuario tal cual, a
// diferencia de los errores internos, que se registran y se sustituyen por
// uno genérico para no filtrar detalles del servidor.
class ErrorCarta extends Error {}

type Parte = { text: string } | { inline_data: { mime_type: string; data: string } }

Deno.serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Solo usuarios autenticados de la app pueden usar el analizador
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError('No autorizado', 401, CORS_HEADERS)
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return jsonError('No autorizado', 401, CORS_HEADERS)
    }

    // El modo se valida ANTES del rate limit por dos motivos: una petición
    // mal formada no debe gastarle cuota al usuario, y el límite que toca
    // aplicar depende justo del modo (ver abajo).
    const cuerpo = await req.json()
    const { modo, imagenBase64, mimeType, objetivoRestante, paginas, url } = cuerpo ?? {}

    if (!modo) {
      return jsonError('Falta el modo.', 400, CORS_HEADERS)
    }
    if (modo !== 'ticket' && modo !== 'producto' && modo !== 'nutricion' && modo !== 'carta') {
      return jsonError('modo debe ser "ticket", "producto", "nutricion" o "carta".', 400, CORS_HEADERS)
    }

    // Una llamada de carta puede ser 6 fotos, un PDF de veinte páginas y
    // además una descarga saliente: pesa bastante más que escanear un
    // producto, así que lleva su propio contador. registrar_peticion_ia
    // recibe el nombre como parámetro (migración 011), o sea que separar el
    // límite no necesita ninguna migración nueva.
    const esCarta = modo === 'carta'
    const { data: permitido, error: limiteErr } = await supabase.rpc('registrar_peticion_ia', {
      p_funcion: esCarta ? 'analizar-carta' : 'analizar-imagen',
      p_limite_minuto: esCarta ? 6 : 15,
      p_limite_dia: esCarta ? 40 : 100,
    })
    if (limiteErr) {
      console.error('Error comprobando el límite de peticiones:', limiteErr)
      return jsonError('No se pudo analizar la imagen.', 500, CORS_HEADERS)
    }
    if (!permitido) {
      return jsonError('Has hecho demasiadas peticiones seguidas. Espera un momento e inténtalo de nuevo.', 429, CORS_HEADERS)
    }

    if (!GEMINI_API_KEY) {
      return jsonError('El servidor no tiene configurada la clave de Gemini.', 500, CORS_HEADERS)
    }

    let prompt: string
    let partes: Parte[]

    if (esCarta) {
      partes = await construirPartesCarta({ paginas, url, imagenBase64, mimeType })
      prompt = construirPromptCarta(objetivoRestante)
    } else {
      if (!imagenBase64) {
        return jsonError('Faltan datos: imagenBase64.', 400, CORS_HEADERS)
      }
      if (!MIME_TYPES_IMAGEN.includes(mimeType)) {
        return jsonError('Formato de imagen no soportado. Usa JPEG, PNG o WebP.', 400, CORS_HEADERS)
      }
      if (imagenBase64.length > MAX_BASE64_CHARS) {
        return jsonError('La imagen es demasiado grande.', 413, CORS_HEADERS)
      }
      partes = [parteImagen(imagenBase64, mimeType)]
      prompt = construirPrompt(modo)
    }

    const resultado = await llamarGemini(prompt, partes, modo)

    return new Response(JSON.stringify(resultado), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    if (e instanceof ErrorCarta) {
      return jsonError(e.message, 400, CORS_HEADERS)
    }
    console.error('Error en analizar-imagen:', e)
    if (e instanceof Error && e.message === 'MODELO_SATURADO') {
      return jsonError(
        'La IA está saturada ahora mismo. Espera unos segundos y vuelve a intentarlo.',
        503,
        CORS_HEADERS
      )
    }
    if (e instanceof Error && e.message === 'CUOTA_EXCEDIDA') {
      return jsonError(
        'Se ha alcanzado el límite de peticiones a la IA por ahora. Espera unos minutos e inténtalo de nuevo.',
        429,
        CORS_HEADERS
      )
    }
    return jsonError('No se pudo analizar la imagen.', 500, CORS_HEADERS)
  }
})

function jsonError(mensaje: string, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ error: mensaje }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// El cliente manda dataURL ("data:image/jpeg;base64,...."); Gemini quiere
// solo la carga útil.
function parteImagen(base64: string, mimeType: string): Parte {
  const limpio = base64.includes(',') ? base64.split(',')[1] : base64
  return { inline_data: { mime_type: mimeType, data: limpio } }
}

// ============================================================
// Entrada del modo carta
// ============================================================

async function construirPartesCarta(entrada: {
  paginas: unknown
  url: unknown
  imagenBase64: unknown
  mimeType: unknown
}): Promise<Parte[]> {
  const { paginas, url, imagenBase64, mimeType } = entrada

  if (Array.isArray(paginas) && paginas.length > 0) {
    if (url) throw new ErrorCarta('Manda fotos o un enlace, no las dos cosas.')
    if (paginas.length > MAX_PAGINAS) {
      throw new ErrorCarta(`Como mucho ${MAX_PAGINAS} páginas por carta.`)
    }
    let total = 0
    const partes: Parte[] = []
    for (const pagina of paginas) {
      const base64 = typeof pagina?.base64 === 'string' ? pagina.base64 : ''
      const tipo = typeof pagina?.mimeType === 'string' ? pagina.mimeType : ''
      if (!base64) throw new ErrorCarta('Una de las páginas ha llegado vacía.')
      if (!MIME_TYPES_IMAGEN.includes(tipo) && tipo !== MIME_PDF) {
        throw new ErrorCarta('Formato no soportado. Usa fotos JPEG/PNG/WebP o un PDF.')
      }
      total += base64.length
      if (total > MAX_BASE64_CHARS) {
        throw new ErrorCarta('Las páginas pesan demasiado juntas. Prueba con menos fotos.')
      }
      partes.push(parteImagen(base64, tipo))
    }
    return partes
  }

  if (typeof url === 'string' && url.trim()) {
    return [await descargarCarta(url.trim())]
  }

  // Compatibilidad con el frontend anterior (una sola imagen).
  if (typeof imagenBase64 === 'string' && imagenBase64) {
    if (!MIME_TYPES_IMAGEN.includes(mimeType as string)) {
      throw new ErrorCarta('Formato de imagen no soportado. Usa JPEG, PNG o WebP.')
    }
    if (imagenBase64.length > MAX_BASE64_CHARS) {
      throw new ErrorCarta('La imagen es demasiado grande.')
    }
    return [parteImagen(imagenBase64, mimeType as string)]
  }

  throw new ErrorCarta('Faltan datos: manda las fotos de la carta o el enlace del QR.')
}

// ============================================================
// Descarga del enlace del QR (SSRF)
// ============================================================
//
// Aquí el servidor pide una URL que ha elegido el usuario, así que hay que
// tratarla como hostil: sin filtro valdría para sondear la red interna de la
// infraestructura o los endpoints de metadatos del proveedor.
//
// Defensas, en este orden: esquema http/https, hostname no reservado, TODAS
// las IPs que resuelve el DNS fuera de rangos privados, redirecciones
// seguidas a mano revalidando cada salto, timeout y tope de tamaño. Además,
// el cuerpo descargado NUNCA se devuelve al cliente: solo sale el JSON de
// platos que produce Gemini, lo que limita mucho lo que se podría exfiltrar.
//
// Límite conocido: entre resolver el DNS y hacer el fetch hay una ventana
// teórica de DNS rebinding. Cerrarla exigiría conectar por IP poniendo el
// Host a mano, lo que rompe SNI/TLS. Con los rangos privados bloqueados y el
// cuerpo sin devolver, el riesgo residual es asumible para esta app.

const HOSTS_PROHIBIDOS = ['localhost', 'metadata', 'metadata.google.internal']

function esIpv4Reservada(ip: string) {
  const partes = ip.split('.').map(Number)
  if (partes.length !== 4 || partes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true // si no sabemos interpretarla, no la abrimos
  }
  const [a, b] = partes
  if (a === 0 || a === 10 || a === 127) return true      // "este host", privada, loopback
  if (a === 169 && b === 254) return true                // link-local (metadatos de la nube)
  if (a === 172 && b >= 16 && b <= 31) return true       // privada
  if (a === 192 && b === 168) return true                // privada
  if (a === 192 && b === 0) return true                  // 192.0.0.0/24, reservada IETF
  if (a === 100 && b >= 64 && b <= 127) return true      // CGNAT
  if (a >= 224) return true                              // multicast y reservadas
  return false
}

function esIpv6Reservada(ip: string) {
  const x = ip.toLowerCase().split('%')[0]
  if (x === '::1' || x === '::') return true                      // loopback / no especificada
  if (x.startsWith('::ffff:')) return esIpv4Reservada(x.slice(7)) // IPv4 mapeada
  if (/^f[cd]/.test(x)) return true                               // unique local fc00::/7
  if (/^fe[89ab]/.test(x)) return true                            // link-local fe80::/10
  return false
}

async function validarUrl(bruta: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(bruta)
  } catch {
    throw new ErrorCarta('Ese enlace no es válido.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ErrorCarta('Solo podemos abrir enlaces que empiecen por http o https.')
  }

  const host = url.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  if (HOSTS_PROHIBIDOS.includes(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new ErrorCarta('Ese enlace apunta a una dirección interna y no podemos abrirlo.')
  }

  const esLiteralV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  const esLiteralV6 = host.includes(':')
  if (esLiteralV4 || esLiteralV6) {
    const reservada = esLiteralV6 ? esIpv6Reservada(host) : esIpv4Reservada(host)
    if (reservada) {
      throw new ErrorCarta('Ese enlace apunta a una dirección interna y no podemos abrirlo.')
    }
    return url
  }

  const ips: string[] = []
  for (const tipo of ['A', 'AAAA'] as const) {
    try {
      ips.push(...(await Deno.resolveDns(host, tipo)))
    } catch {
      // Es normal no tener registros de uno de los dos tipos.
    }
  }
  if (ips.length === 0) {
    throw new ErrorCarta('No hemos podido encontrar esa web. Comprueba el enlace.')
  }
  for (const ip of ips) {
    const reservada = ip.includes(':') ? esIpv6Reservada(ip) : esIpv4Reservada(ip)
    if (reservada) {
      throw new ErrorCarta('Ese enlace apunta a una dirección interna y no podemos abrirlo.')
    }
  }
  return url
}

async function leerConTope(res: Response): Promise<Uint8Array> {
  const lector = res.body?.getReader()
  if (!lector) return new Uint8Array()
  const trozos: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await lector.read()
    if (done) break
    total += value.length
    if (total > MAX_BYTES_DESCARGA) {
      await lector.cancel()
      throw new ErrorCarta('La carta de ese enlace pesa demasiado para analizarla.')
    }
    trozos.push(value)
  }
  const salida = new Uint8Array(total)
  let pos = 0
  for (const t of trozos) {
    salida.set(t, pos)
    pos += t.length
  }
  return salida
}

// btoa() necesita una cadena binaria, y String.fromCharCode(...bytes) revienta
// la pila con arrays de megabytes: se convierte por trozos.
function aBase64(bytes: Uint8Array) {
  const TROZO = 0x8000
  let binario = ''
  for (let i = 0; i < bytes.length; i += TROZO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TROZO))
  }
  return btoa(binario)
}

async function descargarCarta(urlBruta: string): Promise<Parte> {
  let actual = urlBruta

  for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
    const url = await validarUrl(actual)

    let res: Response
    try {
      res = await fetch(url, {
        redirect: 'manual', // cada salto se revalida a mano; si no, el filtro se esquiva
        signal: AbortSignal.timeout(MS_TIMEOUT_DESCARGA),
        headers: {
          'User-Agent': 'NutriGasto/1.0 (lector de cartas de restaurante)',
          Accept: 'text/html,application/pdf,image/*;q=0.9,*/*;q=0.5',
        },
      })
    } catch (e) {
      console.error('Error descargando la carta:', e)
      throw new ErrorCarta('No hemos podido abrir ese enlace. Puede que la web tarde demasiado o esté caída.')
    }

    if (res.status >= 300 && res.status < 400) {
      const destino = res.headers.get('Location')
      await res.body?.cancel()
      if (!destino) throw new ErrorCarta('Ese enlace redirige a un sitio que no podemos abrir.')
      actual = new URL(destino, url).toString()
      continue
    }

    if (!res.ok) {
      await res.body?.cancel()
      throw new ErrorCarta(`La web de la carta no responde correctamente (error ${res.status}).`)
    }

    const tipo = (res.headers.get('Content-Type') || '').toLowerCase()
    const bytes = await leerConTope(res)

    if (tipo.includes('application/pdf')) {
      return { inline_data: { mime_type: MIME_PDF, data: aBase64(bytes) } }
    }
    if (tipo.startsWith('image/')) {
      const limpio = tipo.split(';')[0].trim()
      if (!MIME_TYPES_IMAGEN.includes(limpio)) {
        throw new ErrorCarta('Ese enlace es una imagen en un formato que no sabemos leer.')
      }
      return { inline_data: { mime_type: limpio, data: aBase64(bytes) } }
    }
    if (!tipo || tipo.includes('html') || tipo.includes('text/') || tipo.includes('xml')) {
      const texto = htmlATexto(new TextDecoder('utf-8').decode(bytes))
      if (texto.length < MIN_CHARS_TEXTO_WEB) {
        throw new ErrorCarta(
          'Esa web carga la carta con JavaScript y no podemos leerla. Haz capturas de pantalla de la carta y súbelas como fotos.'
        )
      }
      return {
        text: `TEXTO DE LA CARTA (extraído de ${url.hostname}):\n\n${texto.slice(0, MAX_CHARS_TEXTO_WEB)}`,
      }
    }

    throw new ErrorCarta('Ese enlace no lleva a una carta que podamos leer (ni web, ni PDF, ni imagen).')
  }

  throw new ErrorCarta('Ese enlace da demasiadas redirecciones.')
}

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  euro: '€',
}

// Extracción de texto suficiente para una carta: no pretende ser un parser de
// HTML, solo dejar legibles los nombres de los platos y sus descripciones.
function htmlATexto(html: string) {
  let t = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|td)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  t = t
    .replace(/&#(\d+);/g, (_, n) => codigoATexto(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => codigoATexto(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (coincidencia, e) => ENTIDADES[e.toLowerCase()] ?? coincidencia)

  return t
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function codigoATexto(codigo: number) {
  if (!Number.isFinite(codigo) || codigo < 0 || codigo > 0x10ffff) return ' '
  try {
    return String.fromCodePoint(codigo)
  } catch {
    return ' '
  }
}

// ============================================================
// Prompts
// ============================================================

function construirPrompt(modo: 'ticket' | 'producto' | 'nutricion') {
  const listaCategorias = CATEGORIAS_VALIDAS.join(', ')

  if (modo === 'nutricion') {
    return `Eres un asistente que lee la TABLA DE INFORMACIÓN NUTRICIONAL de un envase de alimentación.
Analiza la imagen y devuelve SOLO un JSON (sin markdown, sin texto adicional) con esta forma exacta:

{
  "por": "100 g o 100 ml, según la unidad de la columna 'por 100'",
  "kcal": numero_entero_o_null,
  "proteinas": numero_decimal_o_null,
  "hidratos": numero_decimal_o_null,
  "grasas": numero_decimal_o_null,
  "azucares": numero_decimal_o_null,
  "sal": numero_decimal_o_null
}

Reglas IMPORTANTES:
- Devuelve SIEMPRE los valores correspondientes a 100 g (o 100 ml). Si la tabla solo da
  valores "por ración/porción", conviértelos a 100 g usando el tamaño de ración que aparezca.
- "kcal": usa las kilocalorías (kcal). Si solo aparecen kJ, conviértelas (1 kcal ≈ 4,184 kJ).
- "hidratos": son los "hidratos de carbono" totales (no solo los azúcares).
- "grasas": son las grasas totales (no solo las saturadas).
- Usa punto decimal, no coma. Si un valor no aparece o no puedes leerlo, pon null (no lo inventes).
Responde ÚNICAMENTE con el JSON, nada más.`
  }

  if (modo === 'ticket') {
    return `Eres un asistente que analiza fotos de tickets de compra de supermercados españoles.
Analiza la imagen y devuelve SOLO un JSON (sin markdown, sin texto adicional) con esta forma exacta:

{
  "supermercado": "nombre del supermercado o null si no se ve",
  "items": [
    {
      "nombre": "nombre del producto, normalizado y legible (ej. 'Leche semidesnatada' en vez de 'LCH SEMI 1L')",
      "marca": "marca si se puede inferir del texto del ticket, o null si no aparece",
      "precio": numero_decimal_o_null,
      "categoria_sugerida": "una de estas categorías EXACTAS: ${listaCategorias}"
    }
  ]
}

Ignora líneas que no sean productos (totales, IVA, descuentos, cambio, forma de pago).
Si no puedes leer bien un precio, pon null en vez de inventarlo.
Responde ÚNICAMENTE con el JSON, nada más.`
  }

  return `Eres un asistente que analiza fotos de productos de alimentación sueltos (envases, packaging).
Analiza la imagen y devuelve SOLO un JSON (sin markdown, sin texto adicional) con esta forma exacta:

{
  "supermercado": null,
  "items": [
    {
      "nombre": "nombre del producto tal y como aparece en el envase",
      "marca": "marca del producto tal y como aparece en el envase, o null si no se distingue",
      "precio": null,
      "categoria_sugerida": "una de estas categorías EXACTAS: ${listaCategorias}"
    }
  ]
}

El precio siempre debe ser null: esta foto no incluye ticket ni precio, el usuario lo rellenará a mano.
Si en la imagen hay varios productos distintos, incluye uno por cada uno.
Responde ÚNICAMENTE con el JSON, nada más.`
}

function construirPromptCarta(objetivoRestante: unknown) {
  const base = `Eres un asistente que ayuda a alguien a decidir QUÉ PEDIR en un restaurante.
Recibes su carta COMPLETA, que puede venir como varias fotos de páginas distintas, como un
PDF de varias páginas o como el texto de la web del restaurante.

Léela entera y estima los macros aproximados de cada plato a partir del nombre/descripción y
del conocimiento general de cocina española e internacional.

Devuelve SOLO un JSON (sin markdown, sin texto adicional) con esta forma exacta:

{
  "platos": [
    {
      "nombre": "...",
      "seccion": "sección de la carta donde está (Entrantes, Ensaladas, Carnes, Postres...), o null",
      "kcal_estimado": numero_o_null,
      "proteinas_estimado": numero_o_null,
      "hidratos_estimado": numero_o_null,
      "grasas_estimado": numero_o_null,
      "confianza": "alta" | "media" | "baja"
    }
  ],
  "recomendado_indice": indice_del_plato_recomendado,
  "motivo": "frase corta explicando la recomendación"
}`

  const instrucciones =
    objetivoRestante && typeof objetivoRestante === 'object'
      ? `Al usuario le queda hoy este margen: ${JSON.stringify(objetivoRestante)} (kcal y gramos de
proteína/hidratos/grasa). Ordena los platos del que MEJOR encaja en ese margen al que peor
(sin pasarse de kcal, priorizando proteína si sobra margen), y recomienda el primero.`
      : `Ordena los platos del objetivamente MÁS saludable al menos (más proteína/verdura, menos
frito/procesado, ración razonable) y recomienda el primero.`

  return `${base}

${instrucciones}

Reglas IMPORTANTES:
- NO transcribas la carta entera. Devuelve como mucho ${MAX_PLATOS} platos: solo los mejores
  candidatos, ya ordenados de mejor a peor. El resto de la carta ignóralo.
- Incluye únicamente platos que se puedan pedir de comer. Nada de bebidas, vinos, cafés,
  guarniciones sueltas ni menús sin desglosar.
- Las páginas pueden solaparse o repetirse: si un plato aparece dos veces, inclúyelo UNA sola vez.
- Deja "confianza": "baja" en platos con descripción muy ambigua — no inventes datos.
- "recomendado_indice" es la posición (empezando en 0) del plato recomendado dentro de "platos".
Responde ÚNICAMENTE con el JSON, nada más.`
}

// ============================================================
// Llamada a Gemini
// ============================================================

async function llamarGemini(
  prompt: string,
  partes: Parte[],
  modo: 'ticket' | 'producto' | 'nutricion' | 'carta',
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

  const body = JSON.stringify({
    contents: [
      {
        parts: [{ text: prompt }, ...partes],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  })

  // Gemini (sobre todo el tier gratuito) devuelve a veces 503 "modelo con
  // mucha demanda", un error TRANSITORIO que el propio Google recomienda
  // reintentar. OJO: un 429 es distinto — normalmente es cuota agotada
  // (diaria o por minuto), no algo transitorio; reintentarlo solo gasta más
  // cuota y alarga la espera del usuario sin ninguna posibilidad de éxito,
  // así que NO se reintenta.
  const intentosMax = 3
  let datos: any
  for (let intento = 1; intento <= intentosMax; intento++) {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    if (respuesta.ok) {
      datos = await respuesta.json()
      break
    }

    const texto = await respuesta.text()
    if (respuesta.status === 429) {
      // Cuota agotada (por minuto o por día): reintentarlo no sirve de nada
      // y solo alarga la espera, así que se distingue de un error genérico
      // para poder avisar al usuario con un mensaje que tiene sentido.
      console.error(`Gemini 429 (cuota): ${texto}`)
      throw new Error('CUOTA_EXCEDIDA')
    }
    const esTransitorio = respuesta.status === 503
    if (!esTransitorio || intento === intentosMax) {
      console.error(`Gemini respondió ${respuesta.status}: ${texto}`)
      // Un 503 que agota los reintentos NO es un fallo de la app: el modelo
      // está saturado (pasa a menudo en el tier gratuito en horas punta). Se
      // distingue del resto de errores para poder decírselo al usuario con
      // esas palabras, en vez de un "no se pudo analizar la imagen" a secas
      // que parece que la app está rota y no invita a reintentar.
      throw new Error(esTransitorio ? 'MODELO_SATURADO' : `Gemini respondió ${respuesta.status}`)
    }
    await new Promise((r) => setTimeout(r, 700 * intento))
  }

  const texto = datos.candidates?.[0]?.content?.parts?.[0]?.text
  if (!texto) throw new Error('Gemini no devolvió contenido analizable.')

  const json = extraerJson(texto)
  if (modo === 'nutricion') return normalizarNutricion(json)
  if (modo === 'carta') return normalizarCarta(json)
  return normalizarResultado(json)
}

// Por si el modelo envuelve el JSON en ```json ... ``` a pesar de pedirlo limpio
function extraerJson(texto: string) {
  const limpio = texto.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
  return JSON.parse(limpio)
}

function normalizarResultado(json: any) {
  const items = Array.isArray(json?.items) ? json.items : []
  return {
    supermercado: json?.supermercado ?? null,
    items: items.map((it: any) => ({
      nombre: String(it?.nombre || '').trim(),
      marca: it?.marca ? String(it.marca).trim() : null,
      precio: typeof it?.precio === 'number' ? it.precio : null,
      categoria_sugerida: CATEGORIAS_VALIDAS.includes(it?.categoria_sugerida)
        ? it.categoria_sugerida
        : 'Otros',
    })).filter((it: any) => it.nombre),
  }
}

// Convierte a número no negativo o null; nunca inventa un valor a partir de texto inválido.
function num(v: any) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

// Normaliza la lectura de una etiqueta nutricional a valores por 100 g/ml.
function normalizarNutricion(json: any) {
  return {
    nutricion: {
      por: typeof json?.por === 'string' ? json.por : '100 g',
      kcal: num(json?.kcal),
      proteinas: num(json?.proteinas),
      hidratos: num(json?.hidratos),
      grasas: num(json?.grasas),
      azucares: num(json?.azucares),
      sal: num(json?.sal),
    },
  }
}

const CONFIANZAS_VALIDAS = ['alta', 'media', 'baja']

// Normaliza la lectura de una carta de restaurante: lista de platos con
// macros estimados (nunca inventados si la descripción es ambigua) más el
// índice recomendado y el motivo, en formato ya utilizable por la app.
function normalizarCarta(json: any) {
  const platosBrutos = Array.isArray(json?.platos) ? json.platos : []

  // Se filtran los platos sin nombre, pero "recomendado_indice" que devuelve
  // Gemini indexa el array ORIGINAL (platosBrutos). Si se filtrara después de
  // mapear sin más, un plato descartado antes del recomendado desplazaría los
  // índices y el badge "Recomendado" acabaría en el plato equivocado. Por eso
  // se guarda el índice original de cada plato válido y se remapea al final.
  const validos: { indiceOriginal: number; plato: any }[] = []
  platosBrutos.forEach((p: any, indiceOriginal: number) => {
    const nombre = String(p?.nombre || '').trim()
    if (!nombre) return
    const seccion = String(p?.seccion || '').trim()
    validos.push({
      indiceOriginal,
      plato: {
        nombre,
        seccion: seccion || null,
        kcalEstimado: num(p?.kcal_estimado),
        proteinasEstimado: num(p?.proteinas_estimado),
        hidratosEstimado: num(p?.hidratos_estimado),
        grasasEstimado: num(p?.grasas_estimado),
        confianza: CONFIANZAS_VALIDAS.includes(p?.confianza) ? p.confianza : 'baja',
      },
    })
  })

  const indiceBruto = Number.isInteger(json?.recomendado_indice) ? json.recomendado_indice : 0
  let recomendadoIndice = validos.findIndex((v) => v.indiceOriginal === indiceBruto)
  if (recomendadoIndice < 0) recomendadoIndice = 0

  // El tope de platos también se aplica aquí: el prompt lo pide, pero el
  // modelo no siempre obedece y la pantalla del móvil no aguanta una carta
  // entera. Si el recomendado se saliera del recorte se trae al principio,
  // en vez de perderlo.
  let recortados = validos
  if (validos.length > MAX_PLATOS) {
    if (recomendadoIndice >= MAX_PLATOS) {
      const recomendado = validos[recomendadoIndice]
      recortados = [recomendado, ...validos.filter((_, i) => i !== recomendadoIndice)].slice(0, MAX_PLATOS)
      recomendadoIndice = 0
    } else {
      recortados = validos.slice(0, MAX_PLATOS)
    }
  }

  return {
    platos: recortados.map((v) => v.plato),
    recomendadoIndice,
    motivo: typeof json?.motivo === 'string' ? json.motivo.trim() : '',
  }
}
