-- ============================================================
-- NutriGasto — Esquema de base de datos (Fase 1)
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- Es idempotente en lo posible; pensado para ejecutarse una vez en un proyecto nuevo.
-- ============================================================

-- ------------------------------------------------------------
-- Tabla: perfiles
-- Un perfil por usuario. El id ES el id de auth.users (relación 1:1).
-- ------------------------------------------------------------
create table if not exists public.perfiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text,
  nombre          text,
  edad            integer,
  genero          text,
  comunidad_autonoma text,
  provincia       text,
  tipo_perfil     text check (tipo_perfil in ('total', 'sencilla')),
  macros_kcal     integer,
  macros_hidratos integer,
  macros_proteinas integer,
  macros_grasas   integer,
  -- El tour de bienvenida solo se enseña a una cuenta recién creada. Se
  -- persiste en el perfil para que no vuelva a aparecer al iniciar sesión
  -- desde otro dispositivo o tras borrar los datos del navegador.
  tour_bienvenida_visto boolean not null default false,
  -- Tutorial específico de las herramientas que viven en Perfil.
  tour_perfil_visto boolean not null default false,
  -- Ayuno intermitente (migración 013). La ventana se guarda como hora de
  -- inicio + duración; la hora de fin siempre es una resta.
  ayuno_activo    boolean not null default false,
  ayuno_horas_objetivo smallint not null default 16
    check (ayuno_horas_objetivo between 8 and 36),
  ayuno_hora_inicio time not null default '21:00',
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabla: alimentos
-- Cada alimento pertenece a un usuario (usuario_id).
-- 'origen' distingue manual vs escáner (OCR, Fase 2).
-- 'compra_id' queda NULLABLE ya preparado para enlazar con la
--  tabla 'compras' cuando llegue el OCR, sin migración que rompa datos.
-- ------------------------------------------------------------
create table if not exists public.alimentos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.perfiles (id) on delete cascade,
  nombre        text not null,
  cantidad      text,                 -- texto libre: "1 kg", "12 ud", "500 g"
  kcal          integer,              -- kcal por 100 g
  precio        numeric(10, 2),
  supermercado  text,
  categoria     text,
  fecha         date not null default current_date,
  origen        text not null default 'manual' check (origen in ('manual', 'escaner')),
  compra_id     uuid,                 -- FK futura a public.compras (Fase 2)
  created_at    timestamptz not null default now()
);

-- Índice para listar rápido los alimentos de un usuario por fecha (lo más común)
create index if not exists idx_alimentos_usuario_fecha
  on public.alimentos (usuario_id, fecha desc);

-- ------------------------------------------------------------
-- Row Level Security: cada usuario solo ve y toca SUS datos.
-- ------------------------------------------------------------
alter table public.perfiles  enable row level security;
alter table public.alimentos enable row level security;

-- Perfiles: el usuario solo accede a su propia fila (id = auth.uid())
drop policy if exists "perfiles_select_propio" on public.perfiles;
create policy "perfiles_select_propio" on public.perfiles
  for select using (auth.uid() = id);

drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio" on public.perfiles
  for update using (auth.uid() = id);

-- (No damos INSERT/DELETE directos sobre perfiles: la fila la crea el
--  trigger de abajo al registrarse, y se borra en cascada con el usuario.)

-- Alimentos: el usuario solo accede a los alimentos cuyo usuario_id es el suyo
drop policy if exists "alimentos_select_propio" on public.alimentos;
create policy "alimentos_select_propio" on public.alimentos
  for select using (auth.uid() = usuario_id);

drop policy if exists "alimentos_insert_propio" on public.alimentos;
create policy "alimentos_insert_propio" on public.alimentos
  for insert with check (auth.uid() = usuario_id);

drop policy if exists "alimentos_update_propio" on public.alimentos;
create policy "alimentos_update_propio" on public.alimentos
  for update using (auth.uid() = usuario_id);

drop policy if exists "alimentos_delete_propio" on public.alimentos;
create policy "alimentos_delete_propio" on public.alimentos
  for delete using (auth.uid() = usuario_id);

-- ------------------------------------------------------------
-- Trigger: al registrarse un usuario en auth.users, creamos
-- automáticamente su fila en public.perfiles (con email).
-- El resto de datos los rellena el onboarding vía UPDATE.
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- ============================================================
-- FUTURO (Fase 2 — OCR de tickets). NO se crea todavía, se deja
-- documentado aquí para tenerlo a la vista:
--
-- public.compras: id, usuario_id, fecha, supermercado, total,
--                 imagen_ticket_url, created_at
-- Y entonces: alter table public.alimentos
--   add constraint fk_compra foreign key (compra_id)
--   references public.compras (id) on delete set null;
-- ============================================================
