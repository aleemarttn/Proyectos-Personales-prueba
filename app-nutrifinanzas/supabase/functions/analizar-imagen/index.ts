// Edge Function: analiza una foto de ticket, de producto suelto o de la
// TABLA DE INFORMACIÓN NUTRICIONAL de un producto con Gemini (tier gratuito)
// y devuelve la info detectada en JSON.
// La clave GEMINI_API_KEY se lee como secreto de Supabase, nunca del frontend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

const CATEGORIAS_VALIDAS = [
  'Proteínas',
  'Hidratos',
  'Grasas',
  'Verduras',
  'Fruta',
  'Lácteos',
  'Otros',
]

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Solo usuarios autenticados de la app pueden usar el analizador
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError('No autorizado', 401)
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return jsonError('No autorizado', 401)
    }

    if (!GEMINI_API_KEY) {
      return jsonError('El servidor no tiene configurada la clave de Gemini.', 500)
    }

    const { modo, imagenBase64, mimeType } = await req.json()
    if (!modo || !imagenBase64) {
      return jsonError('Faltan datos: modo o imagenBase64.', 400)
    }
    if (modo !== 'ticket' && modo !== 'producto' && modo !== 'nutricion') {
      return jsonError('modo debe ser "ticket", "producto" o "nutricion".', 400)
    }

    const prompt = construirPrompt(modo)
    const resultado = await llamarGemini(prompt, imagenBase64, mimeType || 'image/jpeg', modo)

    return new Response(JSON.stringify(resultado), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Error en analizar-imagen:', e)
    return jsonError('No se pudo analizar la imagen.', 500)
  }
})

function jsonError(mensaje: string, status: number) {
  return new Response(JSON.stringify({ error: mensaje }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

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

async function llamarGemini(
  prompt: string,
  imagenBase64: string,
  mimeType: string,
  modo: 'ticket' | 'producto' | 'nutricion',
) {
  const base64Limpio = imagenBase64.includes(',')
    ? imagenBase64.split(',')[1]
    : imagenBase64

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Limpio } },
        ],
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
    const esTransitorio = respuesta.status === 503
    if (!esTransitorio || intento === intentosMax) {
      throw new Error(`Gemini respondió ${respuesta.status}: ${texto}`)
    }
    await new Promise((r) => setTimeout(r, 700 * intento))
  }

  const texto = datos.candidates?.[0]?.content?.parts?.[0]?.text
  if (!texto) throw new Error('Gemini no devolvió contenido analizable.')

  const json = extraerJson(texto)
  return modo === 'nutricion'
    ? normalizarNutricion(json)
    : normalizarResultado(json)
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

// Normaliza la lectura de una etiqueta nutricional a valores por 100 g/ml.
function normalizarNutricion(json: any) {
  const num = (v: any) => {
    if (v === null || v === undefined || v === '') return null
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : null
  }
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
