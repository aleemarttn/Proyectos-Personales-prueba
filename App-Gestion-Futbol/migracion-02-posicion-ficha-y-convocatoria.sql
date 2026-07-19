-- =====================================================================
--  MIGRACIÓN 02 — Posición elegida por ficha en la alineación
-- =====================================================================
--  Ejecutar UNA VEZ en el SQL Editor de Supabase si tu base de datos se
--  creó con una versión de schema.sql ANTERIOR a esta funcionalidad.
--  (En instalaciones nuevas ya no hace falta: schema.sql ya la incluye.)
--
--  Contexto: al arrastrar las fichas en la pizarra, un jugador puede
--  acabar en una posición distinta a la de su ranura de formación (un MC
--  colocado como MCO, un DFC que sube a LD, etc.). Antes, los minutos por
--  posición se atribuían SIEMPRE a la posición de la ranura de formación,
--  no a donde el técnico realmente lo puso.
--
--  Esta columna guarda la posición con la que el técnico decide registrar
--  cada ficha. Si queda en null se usa la posición de la formation_slot
--  (comportamiento anterior, retrocompatible).
--
--  No requiere cambios de RLS ni de grants: la columna hereda las policies
--  y permisos de la tabla lineup_slots.
-- =====================================================================

alter table public.lineup_slots
  add column if not exists position_code text references public.positions(code);
