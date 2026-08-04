// Cuando una Edge Function responde con un status distinto de 2xx,
// supabase-js NO expone el cuerpo JSON en `data` (queda `null`): solo lanza
// un `FunctionsHttpError` genérico ("Edge Function returned a non-2xx
// status code"). El cuerpo real que devolvimos con jsonError() sigue sin
// leer en `error.context` (el Response original, sin consumir), así que
// hay que leerlo a mano para poder enseñar el mensaje de verdad
// ("No autorizado", "límite de peticiones a la IA"...) en vez del genérico.
export async function mensajeErrorFuncion(error, fallback) {
  try {
    const cuerpo = await error?.context?.json?.()
    if (cuerpo?.error) return cuerpo.error
  } catch {
    // El cuerpo no era JSON legible (o ya se había consumido): nos
    // quedamos con el mensaje de fallback en vez de reventar aquí.
  }
  return fallback
}
