// Edge Function: sugiere recetas a partir de los alimentos de la despensa
// del usuario, usando Gemini (mismo patrón que analizar-imagen, pero sin
// imagen: la entrada es la lista de alimentos, no una foto).
//
// La gracia de pedírselo a un modelo en vez de tener una tabla de recetas
// hecha a mano es que Gemini ya "sabe" qué combinaciones son platos
// habituales (arroz con pollo, papas con bistec...) sin que tengamos que
// mantener nosotros esa base de datos culinaria.
// La clave GEMINI_API_KEY se lee como secreto de Supabase, nunca del frontend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CONFIANZAS_VALIDAS = ['alta', 'media', 'baja']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Solo usuarios autenticados de la app pueden usar el generador
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

    // Límite en base de datos (no solo en el frontend): 5/minuto y
    // 30/día por usuario. Cuesta varios segundos y gasta cuota de Gemini
    // compartida por todo el proyecto, así que hay que frenar aquí antes
    // de gastar nada, no después.
    const { data: permitido, error: limiteErr } = await supabase.rpc('registrar_peticion_ia', {
      p_funcion: 'generar-recetas',
      p_limite_minuto: 5,
      p_limite_dia: 30,
    })
    if (limiteErr) {
      console.error('Error comprobando el límite de peticiones:', limiteErr)
      return jsonError('No se pudieron generar recetas.', 500)
    }
    if (!permitido) {
      return jsonError('Has hecho demasiadas peticiones seguidas. Espera un momento e inténtalo de nuevo.', 429)
    }

    if (!GEMINI_API_KEY) {
      return jsonError('El servidor no tiene configurada la clave de Gemini.', 500)
    }

    const { alimentos, objetivoRestante } = await req.json()
    if (!Array.isArray(alimentos) || alimentos.length < 2) {
      return jsonError('Hacen falta al menos 2 alimentos en la despensa para sugerir recetas.', 400)
    }

    const prompt = construirPrompt(alimentos, objetivoRestante)
    const resultado = await llamarGemini(prompt)

    return new Response(JSON.stringify(resultado), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Error en generar-recetas:', e)
    if (e instanceof Error && e.message === 'CUOTA_EXCEDIDA') {
      return jsonError(
        'Se ha alcanzado el límite de peticiones a la IA por ahora. Espera unos minutos e inténtalo de nuevo.',
        429
      )
    }
    return jsonError('No se pudieron generar recetas.', 500)
  }
})

function jsonError(mensaje: string, status: number) {
  return new Response(JSON.stringify({ error: mensaje }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function construirPrompt(alimentos: any[], objetivoRestante: unknown) {
  const lista = alimentos
    .map((a) => `- ${a?.nombre || 'desconocido'} (${a?.categoria || 'Otros'})`)
    .join('\n')

  const instruccionObjetivo =
    objetivoRestante && typeof objetivoRestante === 'object'
      ? `Al usuario le queda hoy este margen: ${JSON.stringify(objetivoRestante)} (kcal y gramos de
proteína/hidratos/grasa). Ordena las recetas de más a menos ajustada a ese margen y señala la
mejor con "recomendado_indice" y un "motivo" corto explicando por qué encaja hoy.`
      : `No hay objetivo de macros que cumplir; ordena las recetas simplemente de la más a la
menos recomendable en términos generales de salud, y deja "recomendado_indice": 0 y
"motivo": "".`

  return `Eres un asistente de cocina. Esta es la despensa de un usuario (nombre y categoría):

${lista}

Sugiere entre 2 y 3 platos o recetas CONOCIDOS Y HABITUALES que se puedan preparar combinando
ALGUNOS de esos alimentos. Sé breve: esto se consulta desde el móvil y tiene que generarse rápido.

Reglas importantes:
- Cada receta debe combinar al menos 2 alimentos de la lista de arriba (no vale una receta con
  un solo ingrediente de la despensa).
- No hace falta usar todos los alimentos de la lista, ni todos en la misma receta: es mejor
  proponer varios platos sencillos y realistas (ej. "arroz con pollo", "papas con bistec") que
  uno solo forzando todos los ingredientes juntos.
- NO inventes combinaciones raras o poco habituales (nadie cocina "legumbres con fruta" o
  "yogur con bistec"). Prioriza SIEMPRE el plato que cualquier persona reconocería con esos
  ingredientes.
- No repitas la misma pareja de ingredientes principales en dos recetas distintas.
- Puedes asumir que el usuario tiene básicos de cocina (sal, aceite, ajo, cebolla, especias)
  aunque no estén en la lista, pero nunca como ingrediente PRINCIPAL de la receta.
- Si de verdad no hay ninguna combinación razonable con esta despensa, devuelve "recetas": [].

${instruccionObjetivo}

Devuelve SOLO un JSON (sin markdown, sin texto adicional) con esta forma exacta:

{
  "recetas": [
    {
      "nombre": "...",
      "ingredientes_usados": ["nombre tal cual aparece en la lista", "..."],
      "pasos": "1-2 frases MUY breves explicando cómo se prepara, en español",
      "kcal_estimado": numero_o_null,
      "proteinas_estimado": numero_o_null,
      "hidratos_estimado": numero_o_null,
      "grasas_estimado": numero_o_null,
      "confianza": "alta" | "media" | "baja"
    }
  ],
  "recomendado_indice": indice_de_la_mejor_receta,
  "motivo": "frase corta o cadena vacía"
}

Los macros son SIEMPRE una estimación por ración normal: no inventes precisión que no tienes,
usa "confianza": "baja" si la ración o la preparación son muy variables.
Responde ÚNICAMENTE con el JSON, nada más.`
}

async function llamarGemini(prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      // NO fijar maxOutputTokens aquí (igual que en analizar-imagen). Se
      // probó con 900 y con 2048: gemini-flash-latest tiene "thinking"
      // activado por defecto y ese razonamiento interno se descuenta del
      // MISMO presupuesto que el JSON final, con gasto variable de una
      // llamada a otra (confirmado con logs: finishReason=MAX_TOKENS y el
      // JSON cortado a medias, incluso con una despensa pequeña). Intentar
      // desactivarlo con thinkingConfig.thinkingBudget da 400 Invalid
      // Argument en este alias del modelo, así que mejor no capar el
      // límite en vez de perseguir un número que falla de forma intermitente.
    },
  })

  // Mismo criterio que analizar-imagen: 503 es "modelo saturado" (se
  // reintenta), 429 es cuota agotada (reintentar no sirve de nada).
  // Solo 2 intentos (no 3, como en analizar-imagen): en este endpoint cada
  // intento puede tardar 30-40s con el tier gratuito bajo carga, así que un
  // 3er intento arriesga superar el tiempo de espera razonable del usuario
  // sin mejorar mucho la fiabilidad. Mejor fallar antes y dejar que el
  // usuario pulse "reintentar" si quiere, que tenerle 90s+ mirando un spinner.
  const intentosMax = 2
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
      throw new Error(`Gemini respondió ${respuesta.status}: ${texto}`)
    }
    await new Promise((r) => setTimeout(r, 700 * intento))
  }

  const texto = datos.candidates?.[0]?.content?.parts?.[0]?.text
  const finishReason = datos.candidates?.[0]?.finishReason

  // El cliente solo ve un mensaje genérico (ver catch en el handler), pero
  // esto queda en los logs del servidor: cuando el JSON llega cortado a
  // medias, finishReason suele ser MAX_TOKENS, y sin este dato no hay forma
  // de distinguir "el prompt confundió al modelo" de "se quedó sin tokens".
  if (!texto) throw new Error(`Gemini no devolvió contenido analizable. finishReason=${finishReason}`)

  try {
    return normalizarRecetas(extraerJson(texto))
  } catch {
    throw new Error(`JSON de Gemini ilegible. finishReason=${finishReason} len=${texto.length}`)
  }
}

// Por si el modelo envuelve el JSON en ```json ... ``` a pesar de pedirlo limpio
function extraerJson(texto: string) {
  const limpio = texto.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
  return JSON.parse(limpio)
}

// Convierte a número no negativo o null; nunca inventa un valor a partir de texto inválido.
function num(v: any) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function normalizarRecetas(json: any) {
  const recetasBrutas = Array.isArray(json?.recetas) ? json.recetas : []

  // Igual que en normalizarCarta: "recomendado_indice" indexa el array
  // ORIGINAL de Gemini. Si una receta anterior se descarta (menos de 2
  // ingredientes reales), filtrar después de mapear desplazaría los índices
  // y la receta marcada como "Recomendada" no sería la que Gemini quiso
  // recomendar. Se guarda el índice original y se remapea al final.
  const validas: { indiceOriginal: number; receta: any }[] = []
  recetasBrutas.forEach((r: any, indiceOriginal: number) => {
    const nombre = String(r?.nombre || '').trim()
    const ingredientesUsados = Array.isArray(r?.ingredientes_usados)
      ? r.ingredientes_usados.map((i: any) => String(i || '').trim()).filter(Boolean)
      : []
    // Una "receta" con menos de 2 ingredientes reales de la despensa no
    // cumple la regla que le pedimos al modelo; mejor descartarla que
    // enseñar algo que no tiene sentido.
    if (!nombre || ingredientesUsados.length < 2) return
    validas.push({
      indiceOriginal,
      receta: {
        nombre,
        ingredientesUsados,
        pasos: typeof r?.pasos === 'string' ? r.pasos.trim() : '',
        kcalEstimado: num(r?.kcal_estimado),
        proteinasEstimado: num(r?.proteinas_estimado),
        hidratosEstimado: num(r?.hidratos_estimado),
        grasasEstimado: num(r?.grasas_estimado),
        confianza: CONFIANZAS_VALIDAS.includes(r?.confianza) ? r.confianza : 'baja',
      },
    })
  })

  const recetas = validas.map((v) => v.receta)
  const indiceBruto = Number.isInteger(json?.recomendado_indice) ? json.recomendado_indice : 0
  const recomendadoIndice = validas.findIndex((v) => v.indiceOriginal === indiceBruto)

  return {
    recetas,
    recomendadoIndice: recomendadoIndice >= 0 ? recomendadoIndice : 0,
    motivo: typeof json?.motivo === 'string' ? json.motivo.trim() : '',
  }
}
