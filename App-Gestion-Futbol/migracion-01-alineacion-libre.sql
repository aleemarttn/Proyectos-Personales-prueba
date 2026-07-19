-- =====================================================================
--  MIGRACIÓN 01 — Alineación libre (fichas movibles)
-- =====================================================================
--  Ejecutar UNA VEZ en el SQL Editor de Supabase si tu base de datos se
--  creó con una versión de schema.sql ANTERIOR a esta funcionalidad.
--  (En instalaciones nuevas ya no hace falta: schema.sql ya incluye estas
--  columnas.)
--
--  Añade a lineup_slots la posición personalizada de cada ficha en el
--  campo. Si x/y quedan en null se usa la coordenada de la formación;
--  si el entrenador arrastra la ficha, se guarda su posición exacta.
--
--  No requiere cambios de RLS ni de grants: las columnas heredan las
--  policies y permisos de la tabla lineup_slots.
-- =====================================================================

alter table public.lineup_slots
  add column if not exists x numeric,
  add column if not exists y numeric;

-- Rango válido 0-100 (igual que las coordenadas de formation_slots)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lineup_slots_x_check'
  ) then
    alter table public.lineup_slots
      add constraint lineup_slots_x_check check (x between 0 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'lineup_slots_y_check'
  ) then
    alter table public.lineup_slots
      add constraint lineup_slots_y_check check (y between 0 and 100);
  end if;
end $$;
