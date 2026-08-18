import { supabase } from './supabase.js'
import { mensajeErrorFuncion } from './edgeError.js'

// Llama a la Edge Function 'analizar-imagen' (Gemini) con la foto capturada.
// Lanza un error si falla; quien la use debe manejar el fallback (Bloque 4).
export async function analizarImagen(imagenBase64, modo, mimeType = 'image/jpeg') {
  const { data, error } = await supabase.functions.invoke('analizar-imagen', {
    body: { imagenBase64, modo, mimeType },
  })

  if (error) throw new Error(await mensajeErrorFuncion(error, 'No se pudo analizar la imagen.'))
  if (data?.error) throw new Error(data.error)

  return data // { supermercado, items: [{ nombre, marca, precio, categoria_sugerida }] }
}

// Lee la tabla de información nutricional de un producto y devuelve los
// macros por 100 g/ml. Lanza un error si falla; quien la use maneja el fallback.
export async function analizarNutricion(imagenBase64, mimeType = 'image/jpeg') {
  const { data, error } = await supabase.functions.invoke('analizar-imagen', {
    body: { imagenBase64, modo: 'nutricion', mimeType },
  })

  if (error) throw new Error(await mensajeErrorFuncion(error, 'No se pudo analizar la imagen.'))
  if (data?.error) throw new Error(data.error)

  // { nutricion: { por, kcal, proteinas, hidratos, grasas, azucares, sal } }
  return data?.nutricion || null
}

// Analiza una carta de restaurante y devuelve los platos detectados más la
// recomendación. La carta puede venir de tres formas (mutuamente
// excluyentes, ver AnalizarCarta.jsx):
//   - `paginas`: [{ dataUrl, mimeType }] — una o varias fotos, o un PDF.
//   - `url`: el enlace del QR de la mesa (escaneado o pegado a mano).
// `objetivoRestante` solo se manda en modo completo (kcal/proteínas/
// hidratos/grasas que le quedan hoy al usuario); en modo simple se omite y
// Gemini recomienda el plato objetivamente más sano.
export async function analizarCarta({ paginas, url, objetivoRestante = null }) {
  const body = { modo: 'carta', objetivoRestante }
  if (paginas?.length) {
    body.paginas = paginas.map((p) => ({
      base64: p.dataUrl,
      mimeType: p.mimeType,
    }))
  } else if (url) {
    body.url = url
  }

  const { data, error } = await supabase.functions.invoke('analizar-imagen', { body })

  if (error) throw new Error(await mensajeErrorFuncion(error, 'No se pudo analizar la carta.'))
  if (data?.error) throw new Error(data.error)

  return data // { platos, recomendadoIndice, motivo }
}
