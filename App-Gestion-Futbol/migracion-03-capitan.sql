-- =====================================================================
--  MIGRACIÓN 03 — Capitán de la alineación
-- =====================================================================
--  Ejecutar UNA VEZ en el SQL Editor de Supabase si tu base de datos se
--  creó con una versión de schema.sql ANTERIOR a esta funcionalidad.
--  (En instalaciones nuevas ya no hace falta: schema.sql ya la incluye.)
--
--  Guarda qué jugador es el capitán en la alineación de cada partido.
--  Uno por alineación (o ninguno). Se marca con una casilla en la pizarra.
--
--  No requiere cambios de RLS ni de grants: la columna hereda las policies
--  y permisos de la tabla lineups.
-- =====================================================================

alter table public.lineups
  add column if not exists captain_player_id uuid references public.players(id);
