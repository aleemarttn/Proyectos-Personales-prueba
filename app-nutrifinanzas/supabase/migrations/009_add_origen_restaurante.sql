-- ============================================================
-- NutriGasto — Fase 8: Modo Restaurante
-- `registros_diarios.origen` solo aceptaba 'despensa' | 'catalogo' | 'manual'
-- (migración 005). Para poder medir por separado cuántas comidas vienen del
-- analizador de cartas de restaurante (ver PLAN-modo-restaurante.md), se
-- añade un cuarto valor: 'restaurante'.
--
-- El check constraint de la migración 005 no tenía nombre explícito, así
-- que Postgres le puso el suyo por defecto (<tabla>_<columna>_check).
--
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

alter table public.registros_diarios
  drop constraint if exists registros_diarios_origen_check;

alter table public.registros_diarios
  add constraint registros_diarios_origen_check
    check (origen in ('despensa', 'catalogo', 'manual', 'restaurante'));
