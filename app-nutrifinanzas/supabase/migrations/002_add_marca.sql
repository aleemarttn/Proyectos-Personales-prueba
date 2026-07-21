-- ============================================================
-- NutriGasto — Migración Fase 2 (Bloque 1): añadir columna 'marca'
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

alter table public.alimentos
  add column if not exists marca text;
