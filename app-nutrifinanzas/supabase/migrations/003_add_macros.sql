-- ============================================================
-- NutriGasto — Migración Fase 2 (Bloque 4): macros por alimento
-- Añade proteínas, hidratos y grasas (gramos por 100 g/ml) a cada
-- alimento, para poder calcular los macros de la dieta.
-- kcal por 100 g ya existía desde la Fase 1.
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

alter table public.alimentos
  add column if not exists proteinas numeric(6, 2),  -- g por 100 g/ml
  add column if not exists hidratos  numeric(6, 2),  -- g por 100 g/ml
  add column if not exists grasas    numeric(6, 2);  -- g por 100 g/ml
