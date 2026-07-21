import { supabase } from './supabase.js'

// Llama a la Edge Function 'analizar-imagen' (Gemini) con la foto capturada.
// Lanza un error si falla; quien la use debe manejar el fallback (Bloque 4).
export async function analizarImagen(imagenBase64, modo, mimeType = 'image/jpeg') {
  const { data, error } = await supabase.functions.invoke('analizar-imagen', {
    body: { imagenBase64, modo, mimeType },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data // { supermercado, items: [{ nombre, marca, precio, categoria_sugerida }] }
}
