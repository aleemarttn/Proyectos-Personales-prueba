import { createClient } from '@supabase/supabase-js'

// Cliente único de Supabase para toda la app.
// Las credenciales se leen de variables de entorno (ver .env.example).
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Aviso temprano y claro si falta configuración, en lugar de fallos crípticos luego.
if (!url || !anonKey) {
  throw new Error(
    'Faltan las variables de entorno de Supabase. ' +
      'Copia .env.example a .env y rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(url, anonKey)

// Un JWT que caduca justo cuando el móvil vuelve de segundo plano hace que
// la PRIMERA petición tras reabrir la app falle con 401 (PostgREST:
// PGRST301) aunque el resto vaya bien un segundo después. Es habitual en
// la PWA en iOS: el sistema pausa los timers en segundo plano, así que el
// refresco automático de supabase-js no siempre llega a tiempo antes de
// que la pantalla, al volver a primer plano, dispare su primera consulta.
//
// En vez de enseñar un error que se cura solo, `consulta` (una función que
// construye la petición, para poder repetirla: un PostgrestBuilder es de
// un solo uso) se reintenta UNA vez tras refrescar la sesión a mano.
export async function conReintentoDeSesion(consulta) {
  const primero = await consulta()
  if (!primero.error || primero.error.code !== 'PGRST301') return primero
  const { error: errorRefresco } = await supabase.auth.refreshSession()
  if (errorRefresco) return primero
  return consulta()
}
