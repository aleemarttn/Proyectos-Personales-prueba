// ============================================================================
//  config.example.js — PLANTILLA de configuración
//
//  1) Copia este archivo a "config.js" (mismo directorio).
//  2) Rellena los dos valores con los de TU proyecto de Supabase:
//        Supabase → Settings → API → "Project URL" y "anon / publishable key".
//
//  IMPORTANTE: la "anon key" es PÚBLICA por diseño. Es seguro dejarla en un
//  sitio estático y subirla al repositorio: la seguridad real la dan las
//  policies de RLS del schema.sql, no el secreto de esta clave.
//  NUNCA pongas aquí la "service_role" / secret key.
// ============================================================================

const SUPABASE_URL = "";       // p. ej. "https://xxxxxxxxxxxx.supabase.co"
const SUPABASE_ANON_KEY = "";  // la clave anon / publishable (pública)
