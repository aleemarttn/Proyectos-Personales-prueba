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
