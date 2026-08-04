-- ============================================================
-- NutriGasto — Fase 9: Recetas sugeridas desde la despensa
-- Igual que hizo la migración 009 con 'restaurante', se añade 'receta' a
-- `registros_diarios.origen` para poder distinguir (y medir aparte, TFG)
-- cuántas comidas vienen de la sugerencia de recetas vs. el resto.
--
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

alter table public.registros_diarios
  drop constraint if exists registros_diarios_origen_check;

alter table public.registros_diarios
  add constraint registros_diarios_origen_check
    check (origen in ('despensa', 'catalogo', 'manual', 'restaurante', 'receta'));
