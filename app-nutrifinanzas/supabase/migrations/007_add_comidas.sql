-- ============================================================
-- NutriGasto — Fase 6: comidas del día (control total de kcal)
-- Hasta ahora `registros_diarios` era una lista plana ordenada por hora:
-- se podía saber cuántas kcal llevabas hoy, pero no CUÁNDO ni repartidas
-- en qué comidas. Esta migración añade las comidas del día, editables por
-- el usuario (nombre y orden), con un máximo de 7 y 3 por defecto.
--
-- Decisión de diseño: NO hay objetivo de kcal por comida. El objetivo
-- sigue siendo diario y global (vista `resumen_diario`, migración 005);
-- las comidas solo agrupan y suman. Así no hay que cuadrar porcentajes.
--
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

-- ------------------------------------------------------------
-- Tabla: comidas_usuario
-- Las comidas del día de UN usuario. El nombre es editable (por eso es
-- una tabla y no un enum fijo): quien entrena puede querer "Pre-entreno"
-- donde otro quiere "Media mañana".
-- `orden` fija cómo se pintan en el diario (0 = la primera del día).
-- ------------------------------------------------------------
create table if not exists public.comidas_usuario (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  nombre     text not null check (length(trim(nombre)) between 1 and 30),
  orden      smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_comidas_usuario_orden
  on public.comidas_usuario (usuario_id, orden);

-- ------------------------------------------------------------
-- Tope de 7 comidas por usuario, aplicado en la base de datos y no solo
-- en la interfaz: así el límite se cumple aunque se llame a la API por
-- otra vía.
-- ------------------------------------------------------------
create or replace function public.comprobar_limite_comidas()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.comidas_usuario where usuario_id = new.usuario_id) >= 7 then
    raise exception 'No puedes tener más de 7 comidas al día.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limite_comidas on public.comidas_usuario;
create trigger trg_limite_comidas
  before insert on public.comidas_usuario
  for each row execute function public.comprobar_limite_comidas();

-- ------------------------------------------------------------
-- Row Level Security: cada usuario solo ve y toca SUS comidas.
-- ------------------------------------------------------------
alter table public.comidas_usuario enable row level security;

drop policy if exists "comidas_usuario_select_propio" on public.comidas_usuario;
create policy "comidas_usuario_select_propio" on public.comidas_usuario
  for select using (auth.uid() = usuario_id);

drop policy if exists "comidas_usuario_insert_propio" on public.comidas_usuario;
create policy "comidas_usuario_insert_propio" on public.comidas_usuario
  for insert with check (auth.uid() = usuario_id);

drop policy if exists "comidas_usuario_update_propio" on public.comidas_usuario;
create policy "comidas_usuario_update_propio" on public.comidas_usuario
  for update using (auth.uid() = usuario_id);

drop policy if exists "comidas_usuario_delete_propio" on public.comidas_usuario;
create policy "comidas_usuario_delete_propio" on public.comidas_usuario
  for delete using (auth.uid() = usuario_id);

-- ------------------------------------------------------------
-- registros_diarios: a qué comida pertenece cada registro.
-- Es NULLABLE y `on delete set null` a propósito: si borras una comida,
-- sus registros históricos no se pierden, pasan a "Sin asignar".
-- Tampoco guardamos el nombre en el registro (a diferencia de `nombre`
-- del alimento): si renombras "Comida" a "Almuerzo" es la MISMA franja
-- del día, y el histórico debe seguir el cambio.
-- ------------------------------------------------------------
alter table public.registros_diarios
  add column if not exists comida_id uuid references public.comidas_usuario (id) on delete set null;

create index if not exists idx_registros_diarios_comida
  on public.registros_diarios (comida_id);

-- ------------------------------------------------------------
-- Comidas por defecto (3) para los perfiles que YA existen y todavía no
-- tienen ninguna. Nombres neutros; el usuario los renombra desde Perfil.
-- ------------------------------------------------------------
insert into public.comidas_usuario (usuario_id, nombre, orden)
select p.id, c.nombre, c.orden
from public.perfiles p
cross join (values ('Desayuno', 0), ('Comida', 1), ('Cena', 2)) as c(nombre, orden)
where not exists (
  select 1 from public.comidas_usuario cu where cu.usuario_id = p.id
);

-- ------------------------------------------------------------
-- Y las mismas 3 para cada usuario nuevo. Se amplía el trigger de alta
-- que ya creaba la fila de `perfiles` (schema.sql), para que un usuario
-- recién registrado entre al diario con sus comidas listas.
-- ------------------------------------------------------------
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.comidas_usuario (usuario_id, nombre, orden)
  select new.id, c.nombre, c.orden
  from (values ('Desayuno', 0), ('Comida', 1), ('Cena', 2)) as c(nombre, orden)
  where not exists (
    select 1 from public.comidas_usuario cu where cu.usuario_id = new.id
  );

  return new;
end;
$$;
