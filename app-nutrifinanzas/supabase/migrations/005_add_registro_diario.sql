-- ============================================================
-- NutriGasto — Fase 4: registro diario de consumo (diario nutricional)
-- Hasta ahora `alimentos` es la despensa (lo que tienes), no un diario de
-- comidas. Esta migración añade la pieza que faltaba para poder responder
-- "cuántas kcal llevo hoy / cuántas me quedan": una tabla de registro de
-- consumo, más dos vistas que hacen la conversión de objetivos (% -> gramos)
-- y el cálculo de consumido/restante del día.
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

-- ------------------------------------------------------------
-- Tabla: registros_diarios
-- Cada fila es UNA comida/alimento registrado como consumido, con sus
-- kcal y macros ya calculados en el momento (cantidad_g x valor-por-100g).
-- No son un JOIN en vivo con alimentos/productos: así, si el usuario edita
-- o borra el alimento/producto de origen más tarde, el histórico del
-- diario no cambia retroactivamente.
-- 'alimento_id' y 'codigo_barras' son nullable y solo sirven de trazabilidad
-- (saber de dónde vino el registro); 'nombre' siempre guarda el snapshot.
-- ------------------------------------------------------------
create table if not exists public.registros_diarios (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.perfiles (id) on delete cascade,
  alimento_id   uuid references public.alimentos (id) on delete set null,
  codigo_barras text references public.productos (codigo_barras) on delete set null,
  nombre        text not null,
  cantidad_g    numeric(8, 2) not null,
  kcal          numeric(8, 2) not null,
  proteinas     numeric(6, 2),
  hidratos      numeric(6, 2),
  grasas        numeric(6, 2),
  origen        text not null default 'manual' check (origen in ('despensa', 'catalogo', 'manual')),
  fecha         date not null default current_date,
  created_at    timestamptz not null default now()
);

-- Índice para listar/agregar rápido los registros de un usuario por día
create index if not exists idx_registros_diarios_usuario_fecha
  on public.registros_diarios (usuario_id, fecha desc);

-- ------------------------------------------------------------
-- Row Level Security: cada usuario solo ve y toca SUS registros.
-- (Mismo patrón que public.alimentos.)
-- ------------------------------------------------------------
alter table public.registros_diarios enable row level security;

drop policy if exists "registros_diarios_select_propio" on public.registros_diarios;
create policy "registros_diarios_select_propio" on public.registros_diarios
  for select using (auth.uid() = usuario_id);

drop policy if exists "registros_diarios_insert_propio" on public.registros_diarios;
create policy "registros_diarios_insert_propio" on public.registros_diarios
  for insert with check (auth.uid() = usuario_id);

drop policy if exists "registros_diarios_update_propio" on public.registros_diarios;
create policy "registros_diarios_update_propio" on public.registros_diarios
  for update using (auth.uid() = usuario_id);

drop policy if exists "registros_diarios_delete_propio" on public.registros_diarios;
create policy "registros_diarios_delete_propio" on public.registros_diarios
  for delete using (auth.uid() = usuario_id);

-- ------------------------------------------------------------
-- Vista: objetivos_gramos
-- perfiles guarda los objetivos como % (macros_hidratos/proteinas/grasas,
-- 0-100) + un total de macros_kcal, nunca convertidos a gramos. Esta vista
-- hace esa conversión: kcal_objetivo x % / 100 / 4 (o /9 para grasas).
-- 'security_invoker' (Postgres 15+) hace que la vista respete el RLS de
-- perfiles con el usuario que consulta, sin necesidad de filtrar a mano.
-- Solo hay fila para perfiles "Control total" (los que tienen objetivos).
-- ------------------------------------------------------------
create or replace view public.objetivos_gramos
with (security_invoker = true) as
select
  id as usuario_id,
  macros_kcal as kcal_objetivo,
  round(macros_kcal * macros_proteinas / 100.0 / 4) as proteinas_g_objetivo,
  round(macros_kcal * macros_hidratos  / 100.0 / 4) as hidratos_g_objetivo,
  round(macros_kcal * macros_grasas    / 100.0 / 9) as grasas_g_objetivo
from public.perfiles
where tipo_perfil = 'total';

-- ------------------------------------------------------------
-- Vista: resumen_diario
-- objetivo_kcal - SUM(kcal de registros_diarios de HOY). Esta es la pieza
-- que permite responder "cuántas kcal llevo / cuántas me quedan hoy", y la
-- que en el futuro llamará directamente la tool get_macros_pendientes()
-- del asistente conversacional.
-- ------------------------------------------------------------
create or replace view public.resumen_diario
with (security_invoker = true) as
select
  o.usuario_id,
  o.kcal_objetivo,
  o.proteinas_g_objetivo,
  o.hidratos_g_objetivo,
  o.grasas_g_objetivo,
  coalesce(sum(r.kcal), 0)      as kcal_consumido_hoy,
  coalesce(sum(r.proteinas), 0) as proteinas_consumido_hoy,
  coalesce(sum(r.hidratos), 0)  as hidratos_consumido_hoy,
  coalesce(sum(r.grasas), 0)    as grasas_consumido_hoy,
  o.kcal_objetivo - coalesce(sum(r.kcal), 0) as kcal_restante_hoy
from public.objetivos_gramos o
left join public.registros_diarios r
  on r.usuario_id = o.usuario_id and r.fecha = current_date
group by o.usuario_id, o.kcal_objetivo, o.proteinas_g_objetivo, o.hidratos_g_objetivo, o.grasas_g_objetivo;
