-- ============================================================
-- NutriGasto — Fase 5: peso por unidad + supermercados comunitarios
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

-- ------------------------------------------------------------
-- Peso por unidad de un alimento (p.ej. una rebanada de pan de molde: el
-- envase trae 450 g pero cada rebanada pesa 16 g). Guardarlo permite que,
-- al registrar una comida, el usuario elija "N unidades" en vez de pesar
-- cada vez. Se guarda tanto en la despensa de cada usuario (`alimentos`)
-- como en el catálogo compartido (`productos`), para que lo aproveche
-- también quien lo escanee después.
-- ------------------------------------------------------------
alter table public.alimentos
  add column if not exists peso_unidad_g numeric(7, 2),  -- g por unidad (ej. 16.00)
  add column if not exists unidad_nombre text;           -- ej. "rebanada", "huevo", "loncha"

alter table public.productos
  add column if not exists peso_unidad_g numeric(7, 2),
  add column if not exists unidad_nombre text;

-- ------------------------------------------------------------
-- Tabla: supermercados
-- Lista comunitaria (estilo wiki, igual que `productos`) en vez de una
-- lista fija en el código: cualquier usuario puede añadir uno que falte.
-- ------------------------------------------------------------
create table if not exists public.supermercados (
  nombre     text primary key,
  created_at timestamptz not null default now()
);

alter table public.supermercados enable row level security;

drop policy if exists "supermercados_select_compartido" on public.supermercados;
create policy "supermercados_select_compartido" on public.supermercados
  for select to authenticated using (true);

drop policy if exists "supermercados_insert_compartido" on public.supermercados;
create policy "supermercados_insert_compartido" on public.supermercados
  for insert to authenticated with check (true);

insert into public.supermercados (nombre) values
  ('Mercadona'), ('Carrefour'), ('Lidl'), ('Dia'), ('Alcampo'),
  ('Consum'), ('Eroski'), ('Hiperdino'), ('Unide')
on conflict (nombre) do nothing;
