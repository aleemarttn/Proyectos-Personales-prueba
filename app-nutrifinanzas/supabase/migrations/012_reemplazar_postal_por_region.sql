-- ============================================================
-- NutriGasto — Región del usuario: comunidad autónoma + provincia
-- en vez de código postal.
-- El código postal era demasiado granular para lo que se usa (estimar
-- precios de la zona) y es un dato más sensible de lo necesario. Comunidad
-- autónoma + provincia da resolución de sobra para eso y es información
-- que el usuario elige de una lista cerrada, no que teclea.
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

alter table public.perfiles
  add column if not exists comunidad_autonoma text,
  add column if not exists provincia text;

alter table public.perfiles
  drop column if exists codigo_postal;
