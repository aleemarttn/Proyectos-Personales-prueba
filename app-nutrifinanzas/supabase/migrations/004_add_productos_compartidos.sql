-- ============================================================
-- NutriGasto — Fase 3: catálogo compartido de productos (por código de barras)
-- Objetivo: que la info nutricional de un producto solo se tenga que
-- escanear UNA vez entre todos los usuarios. `productos` es una tabla
-- compartida (no tiene usuario_id): cualquier usuario autenticado puede
-- leerla y contribuir a ella.
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

-- ------------------------------------------------------------
-- Tabla: productos
-- Catálogo compartido, indexado por código de barras (EAN/UPC).
-- ------------------------------------------------------------
create table if not exists public.productos (
  codigo_barras     text primary key,
  nombre            text not null,
  marca             text,
  kcal              integer,              -- kcal por 100 g/ml
  proteinas         numeric(6, 2),        -- g por 100 g/ml
  hidratos          numeric(6, 2),        -- g por 100 g/ml
  grasas            numeric(6, 2),        -- g por 100 g/ml
  categoria         text,
  veces_confirmado  integer not null default 1,
  creado_por        uuid references public.perfiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Row Level Security: catálogo de lectura compartida entre todos los
-- usuarios autenticados; cualquiera puede añadir o completar/corregir
-- un producto (estilo wiki, como Open Food Facts).
-- ------------------------------------------------------------
alter table public.productos enable row level security;

drop policy if exists "productos_select_compartido" on public.productos;
create policy "productos_select_compartido" on public.productos
  for select to authenticated using (true);

drop policy if exists "productos_insert_compartido" on public.productos;
create policy "productos_insert_compartido" on public.productos
  for insert to authenticated with check (true);

drop policy if exists "productos_update_compartido" on public.productos;
create policy "productos_update_compartido" on public.productos
  for update to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- Enlaza cada alimento de la despensa con su producto del catálogo
-- (nullable: los alimentos manuales o sin código de barras no lo tienen).
-- ------------------------------------------------------------
alter table public.alimentos
  add column if not exists codigo_barras text references public.productos (codigo_barras) on delete set null;

create index if not exists idx_alimentos_codigo_barras on public.alimentos (codigo_barras);
