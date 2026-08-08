-- ============================================================
-- NutriGasto — Ayuno intermitente
-- Quien hace ayuno necesita dos cosas: decir cuál es su ventana habitual
-- (empiezo a las 21:00, aguanto 16 h) y ver cuánto lleva del ayuno de hoy.
-- Lo primero son ajustes del perfil; lo segundo necesita tabla propia,
-- porque un ayuno cruza la medianoche y no cabe en "un día" del diario.
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

-- ------------------------------------------------------------
-- Ajustes en `perfiles`
-- La ventana se guarda como hora de inicio + duración, no como dos horas:
-- la de fin siempre es una resta, y guardarla aparte permitiría que se
-- contradigan entre ellas.
-- ------------------------------------------------------------
alter table public.perfiles
  add column if not exists ayuno_activo boolean not null default false,
  add column if not exists ayuno_horas_objetivo smallint not null default 16,
  add column if not exists ayuno_hora_inicio time not null default '21:00';

-- Fuera de 8-36 h ya no es una ventana de ayuno razonable; el tope evita
-- además que un dedazo (160 en vez de 16) deje la barra parada semanas.
alter table public.perfiles
  drop constraint if exists perfiles_ayuno_horas_check;
alter table public.perfiles
  add constraint perfiles_ayuno_horas_check
    check (ayuno_horas_objetivo between 8 and 36);

-- ------------------------------------------------------------
-- Tabla: ayunos
-- Una fila por ayuno. `fin` a null = ayuno en curso; el contador de la
-- pantalla se calcula siempre como now() - inicio, así que sigue subiendo
-- aunque cierres la app o cambies de móvil.
-- `horas_objetivo` se copia aquí a propósito: si mañana cambias tu
-- objetivo de 16 a 18 h, los ayunos ya hechos deben seguir contando
-- contra el objetivo que tenían entonces.
-- ------------------------------------------------------------
create table if not exists public.ayunos (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.perfiles (id) on delete cascade,
  inicio         timestamptz not null default now(),
  fin            timestamptz,
  horas_objetivo smallint not null,
  created_at     timestamptz not null default now(),
  constraint ayunos_fin_posterior check (fin is null or fin >= inicio)
);

create index if not exists idx_ayunos_usuario_inicio
  on public.ayunos (usuario_id, inicio desc);

-- No se puede estar en dos ayunos a la vez. Un índice único PARCIAL (solo
-- sobre las filas con fin null) lo impide de raíz, así que ni un doble
-- toque en "Empezar" ni dos móviles a la vez pueden abrir dos.
create unique index if not exists idx_ayunos_uno_abierto
  on public.ayunos (usuario_id)
  where fin is null;

-- ------------------------------------------------------------
-- Row Level Security: cada usuario solo ve y toca SUS ayunos.
-- (Mismo patrón que public.registros_diarios.)
-- ------------------------------------------------------------
alter table public.ayunos enable row level security;

drop policy if exists "ayunos_select_propio" on public.ayunos;
create policy "ayunos_select_propio" on public.ayunos
  for select using (auth.uid() = usuario_id);

drop policy if exists "ayunos_insert_propio" on public.ayunos;
create policy "ayunos_insert_propio" on public.ayunos
  for insert with check (auth.uid() = usuario_id);

drop policy if exists "ayunos_update_propio" on public.ayunos;
create policy "ayunos_update_propio" on public.ayunos
  for update using (auth.uid() = usuario_id);

drop policy if exists "ayunos_delete_propio" on public.ayunos;
create policy "ayunos_delete_propio" on public.ayunos
  for delete using (auth.uid() = usuario_id);
