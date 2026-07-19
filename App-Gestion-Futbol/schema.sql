-- =====================================================================
--  APP GESTIÓN FÚTBOL — schema.sql
-- =====================================================================
--  Esquema completo para una instalación nueva desde cero.
--  Se ejecuta UNA VEZ, entero, en el SQL Editor de Supabase
--  (proyecto nuevo y vacío). Después ejecuta seed.sql.
--
--  Diseño multi-equipo desde el día 1:
--    · Toda tabla de dominio lleva team_id.
--    · team_members asocia usuarios de auth.users con equipos.
--    · Todas las policies de RLS se apoyan en es_miembro(team_id).
--  En la v1 solo habrá un equipo y un usuario, pero el aislamiento
--  de datos ya funciona para el día que haya más.
--
--  Seguridad: NO hay acceso anónimo. Toda la app está detrás de
--  login (Supabase Auth). El rol `anon` no tiene ningún permiso.
--  IMPORTANTE: los proyectos de Supabase recientes exigen grants
--  de Postgres explícitos para que PostgREST funcione; van todos
--  al final de este script, junto con las policies.
-- =====================================================================


-- =====================================================================
--  1. CATÁLOGOS
--     Tablas, no enums: así se pueden añadir filas sin migración.
--     Solo lectura para los usuarios; se rellenan en seed.sql.
-- =====================================================================

-- Posiciones del campo ('POR', 'LD', 'DFC', ...)
create table public.positions (
  code       text primary key,
  label      text not null,
  line       text not null check (line in ('portero','defensa','medio','ataque')),
  sort_order smallint not null
);

-- Formaciones disponibles ('4-3-3', '4-4-2', ...)
create table public.formations (
  id     uuid primary key default gen_random_uuid(),
  name   text not null unique,
  active boolean not null default true
);

-- Ranuras de cada formación, con su coordenada para dibujar la
-- camiseta en el campo SVG. Campo VERTICAL:
--   x: 0 = banda izquierda, 100 = banda derecha
--   y: 0 = portería rival (arriba), 100 = portería propia (abajo)
create table public.formation_slots (
  id            uuid primary key default gen_random_uuid(),
  formation_id  uuid not null references public.formations(id) on delete cascade,
  slot_code     text not null,                                   -- p. ej. 'DFC-D'
  position_code text not null references public.positions(code), -- posición que representa
  x             numeric not null check (x between 0 and 100),
  y             numeric not null check (y between 0 and 100),
  unique (formation_id, slot_code)
);

-- Estados de asistencia a entrenamientos
create table public.attendance_statuses (
  code              text primary key,
  label             text not null,
  counts_as_present boolean not null default false
);

-- Motivos de ausencia en una CONVOCATORIA de partido
-- (decisión técnica, lesión, sanción, trabajo...)
create table public.match_absence_reasons (
  code  text primary key,
  label text not null
);


-- =====================================================================
--  2. ESTRUCTURA: EQUIPOS, MIEMBROS Y JUGADORES
-- =====================================================================

-- Un equipo = club + temporada. Al empezar una temporada nueva se
-- crea una fila nueva (las estadísticas quedan acotadas por temporada).
create table public.teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text,                                  -- p. ej. 'Primera Regional'
  season       text,                                  -- p. ej. '2026/27'
  color        text not null default '#e2231a',       -- color de camiseta en la pizarra
  yellow_cycle smallint not null default 5,           -- amarillas que forman ciclo de sanción
  created_at   timestamptz not null default now()
);

-- Qué usuarios de auth.users pertenecen a qué equipo.
-- En la v1 se rellena a mano desde el SQL Editor (ver README).
create table public.team_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  role    text not null default 'entrenador' check (role in ('entrenador','staff','lectura')),
  primary key (user_id, team_id)
);

create table public.players (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams(id) on delete cascade,
  name             text not null,
  shirt_number     smallint check (shirt_number between 1 and 99),
  primary_position text references public.positions(code),
  birth_date       date,
  dominant_foot    text check (dominant_foot in ('derecho','izquierdo','ambidiestro')),
  active           boolean not null default true,     -- baja lógica, nunca se borra
  created_at       timestamptz not null default now()
);

-- Dorsal único por equipo, pero solo entre jugadores ACTIVOS:
-- si un jugador causa baja, su dorsal queda libre para el siguiente.
create unique index players_dorsal_unico
  on public.players (team_id, shirt_number)
  where shirt_number is not null and active;


-- =====================================================================
--  3. PARTIDOS
-- =====================================================================

create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  match_date    date not null,          -- la envía el cliente en hora LOCAL (YYYY-MM-DD)
  kickoff_time  time,
  opponent      text not null,
  venue         text not null check (venue in ('casa','fuera')),
  competition   text,
  status        text not null default 'programado'
                check (status in ('programado','jugado','aplazado')),
  goals_for     smallint check (goals_for >= 0),
  goals_against smallint check (goals_against >= 0),
  notes         text,
  created_at    timestamptz not null default now()
);

-- El once inicial de un partido (uno como máximo por partido)
create table public.lineups (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null unique references public.matches(id) on delete cascade,
  formation_id      uuid not null references public.formations(id),
  captain_player_id uuid references public.players(id),   -- capitán del once (o null)
  created_at        timestamptz not null default now()
);

-- Qué jugador ocupa cada ranura del once.
-- Un jugador no puede estar en dos ranuras ni una ranura tener dos jugadores.
-- x / y: posición PERSONALIZADA de la ficha en el campo (0-100). Si son null
-- se usa la coordenada de la formation_slot; si están rellenas, el entrenador
-- movió la ficha a mano (formación libre fuera de los esquemas predefinidos).
-- position_code: posición con la que el técnico decide registrar esta ficha.
-- Puede diferir de la de la formation_slot (un MC colocado como MCO al
-- arrastrar la ficha). Si es null se usa la posición de la formation_slot.
-- Es la que alimenta los minutos por posición en el cierre del partido.
create table public.lineup_slots (
  id                uuid primary key default gen_random_uuid(),
  lineup_id         uuid not null references public.lineups(id) on delete cascade,
  formation_slot_id uuid not null references public.formation_slots(id),
  player_id         uuid not null references public.players(id),
  position_code     text references public.positions(code),
  x                 numeric check (x between 0 and 100),
  y                 numeric check (y between 0 and 100),
  unique (lineup_id, formation_slot_id),
  unique (lineup_id, player_id)
);

-- Participación de cada jugador en cada partido (convocatoria + minutos).
-- Si role = 'no_convocado' el motivo es OBLIGATORIO (decisión técnica,
-- lesión, sanción...); en cualquier otro rol no se admite motivo.
create table public.appearances (
  id                  uuid primary key default gen_random_uuid(),
  match_id            uuid not null references public.matches(id) on delete cascade,
  player_id           uuid not null references public.players(id),
  role                text not null
                      check (role in ('titular','suplente_jugo','suplente_no_jugo','no_convocado')),
  absence_reason_code text references public.match_absence_reasons(code),
  minutes_played      smallint not null default 0 check (minutes_played between 0 and 130),
  entered_minute      smallint check (entered_minute between 0 and 130),
  exited_minute       smallint check (exited_minute between 0 and 130),
  unique (match_id, player_id),
  check ((role = 'no_convocado') = (absence_reason_code is not null))
);

-- Minutos por posición dentro de un partido: un mediocentro pudo jugar
-- 60' de MC y 30' de DFC (dos filas). La suma debe cuadrar con
-- appearances.minutes_played; se valida en el front, no con triggers.
create table public.appearance_positions (
  id            uuid primary key default gen_random_uuid(),
  appearance_id uuid not null references public.appearances(id) on delete cascade,
  position_code text not null references public.positions(code),
  minutes       smallint not null check (minutes > 0),
  unique (appearance_id, position_code)
);

-- Eventos del partido. Convención de tarjetas:
--   'amarilla'       = primera amarilla
--   'doble_amarilla' = segunda amarilla (implica expulsión)
--   'roja'           = roja directa
-- Así ni las amarillas ni las rojas se cuentan dos veces.
create table public.match_events (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id),
  type      text not null check (type in
            ('gol','asistencia','amarilla','doble_amarilla','roja','gol_en_propia','penalti_parado')),
  minute    smallint check (minute between 0 and 130),
  notes     text
);


-- =====================================================================
--  4. ENTRENAMIENTOS
-- =====================================================================

create table public.trainings (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  session_date date not null,           -- hora LOCAL del dispositivo, YYYY-MM-DD
  duration_min smallint check (duration_min > 0),
  focus        text check (focus in ('fisico','tactico','tecnico','recuperacion','partido')),
  notes        text,
  unique (team_id, session_date)        -- una sesión por día y equipo
);

create table public.training_attendance (
  id          uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  player_id   uuid not null references public.players(id),
  status_code text not null default 'presente' references public.attendance_statuses(code),
  reason      text,                     -- nota libre si es ausencia
  unique (training_id, player_id)
);


-- =====================================================================
--  5. LESIONES Y SANCIONES
-- =====================================================================

-- Un jugador está lesionado mientras tenga una lesión con end_date null.
create table public.injuries (
  id                   uuid primary key default gen_random_uuid(),
  team_id              uuid not null references public.teams(id) on delete cascade,
  player_id            uuid not null references public.players(id),
  start_date           date not null,
  expected_return_date date,
  end_date             date,
  injury_type          text,
  body_zone            text,
  severity             text check (severity in ('leve','moderada','grave')),
  notes                text,
  created_at           timestamptz not null default now()
);

-- Sanciones. Necesaria para que la alerta del ciclo de amarillas sea
-- fiable: al cumplir una sanción por ciclo, el contador se reinicia
-- (amarillas del ciclo = amarillas totales - las consumidas por
-- sanciones de tipo 'ciclo_amarillas' completadas).
create table public.suspensions (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  player_id  uuid not null references public.players(id),
  reason     text not null check (reason in ('ciclo_amarillas','roja','comite')),
  matches    smallint not null default 1 check (matches > 0),
  start_date date,
  completed  boolean not null default false,
  notes      text,
  created_at timestamptz not null default now()
);


-- =====================================================================
--  6. ÍNDICES DE APOYO (las FK no crean índice solas en Postgres)
-- =====================================================================

create index idx_players_team              on public.players (team_id);
create index idx_matches_team_fecha        on public.matches (team_id, match_date);
create index idx_lineup_slots_lineup       on public.lineup_slots (lineup_id);
create index idx_appearances_match         on public.appearances (match_id);
create index idx_appearances_player        on public.appearances (player_id);
create index idx_app_positions_appearance  on public.appearance_positions (appearance_id);
create index idx_match_events_match        on public.match_events (match_id);
create index idx_match_events_player       on public.match_events (player_id);
create index idx_trainings_team_fecha      on public.trainings (team_id, session_date);
create index idx_train_att_training        on public.training_attendance (training_id);
create index idx_train_att_player          on public.training_attendance (player_id);
create index idx_injuries_team             on public.injuries (team_id);
create index idx_injuries_player           on public.injuries (player_id);
create index idx_suspensions_team          on public.suspensions (team_id);
create index idx_suspensions_player        on public.suspensions (player_id);


-- =====================================================================
--  7. FUNCIÓN HELPER DE PERTENENCIA
--     security definer: consulta team_members "por dentro" sin que
--     las policies de team_members interfieran. search_path fijado
--     para que nadie pueda suplantar la tabla.
-- =====================================================================

create or replace function public.es_miembro(t uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members m
    where m.team_id = t
      and m.user_id = auth.uid()
  );
$$;

revoke execute on function public.es_miembro(uuid) from public, anon;
grant execute on function public.es_miembro(uuid) to authenticated;


-- =====================================================================
--  8. VISTAS DE CONSULTA Y EXPORTACIÓN
--     Todas con security_invoker = on: se ejecutan con los permisos
--     del usuario logueado, así las policies de las tablas base
--     siguen aplicando y nadie ve datos de otro equipo.
-- =====================================================================

-- ---- Estadísticas por jugador (solo partidos con status 'jugado') ----
create or replace view public.v_estadisticas_jugador
with (security_invoker = on) as
with app as (
  select
    a.player_id,
    count(*) filter (where a.role in ('titular','suplente_jugo','suplente_no_jugo')) as partidos_convocado,
    count(*) filter (where a.role = 'titular')                                       as partidos_titular,
    count(*) filter (where a.role = 'suplente_jugo')                                 as partidos_suplente,
    count(*) filter (where a.role in ('titular','suplente_jugo'))                    as partidos_jugados,
    coalesce(sum(a.minutes_played), 0)                                               as minutos_totales
  from public.appearances a
  join public.matches m on m.id = a.match_id
  where m.status = 'jugado'
  group by a.player_id
),
ev as (
  select
    e.player_id,
    count(*) filter (where e.type = 'gol')                            as goles,
    count(*) filter (where e.type = 'asistencia')                     as asistencias,
    count(*) filter (where e.type in ('amarilla','doble_amarilla'))   as amarillas,
    count(*) filter (where e.type in ('roja','doble_amarilla'))       as rojas
  from public.match_events e
  join public.matches m on m.id = e.match_id
  where m.status = 'jugado'
  group by e.player_id
)
select
  p.team_id,
  p.id                                   as player_id,
  p.name                                 as jugador,
  p.shirt_number                         as dorsal,
  p.primary_position                     as posicion,
  p.active                               as activo,
  coalesce(app.partidos_convocado, 0)    as partidos_convocado,
  coalesce(app.partidos_titular, 0)      as partidos_titular,
  coalesce(app.partidos_suplente, 0)     as partidos_suplente,
  coalesce(app.minutos_totales, 0)       as minutos_totales,
  coalesce(ev.goles, 0)                  as goles,
  coalesce(ev.asistencias, 0)            as asistencias,
  coalesce(ev.amarillas, 0)              as amarillas,
  coalesce(ev.rojas, 0)                  as rojas,
  round(coalesce(app.minutos_totales, 0)::numeric
        / nullif(coalesce(app.partidos_jugados, 0), 0), 1) as minutos_por_partido
from public.players p
left join app on app.player_id = p.id
left join ev  on ev.player_id  = p.id;

-- ---- Minutos por posición de cada jugador ----
create or replace view public.v_minutos_por_posicion
with (security_invoker = on) as
select
  p.team_id,
  p.id                 as player_id,
  p.name               as jugador,
  ap.position_code     as posicion,
  pos.label            as posicion_nombre,
  sum(ap.minutes)      as minutos,
  round(100.0 * sum(ap.minutes)
        / nullif(sum(sum(ap.minutes)) over (partition by p.id), 0), 1)
                       as porcentaje_sobre_sus_minutos
from public.appearance_positions ap
join public.appearances a   on a.id = ap.appearance_id
join public.matches m       on m.id = a.match_id and m.status = 'jugado'
join public.players p       on p.id = a.player_id
join public.positions pos   on pos.code = ap.position_code
group by p.team_id, p.id, p.name, ap.position_code, pos.label;

-- ---- Asistencia a entrenamientos: resumen por jugador ----
-- El porcentaje se calcula sobre las sesiones en las que se pasó lista
-- al jugador (sesiones_registradas), no sobre el total del equipo:
-- si un jugador llegó a mitad de temporada, no se le penaliza.
create or replace view public.v_asistencia_entrenamientos
with (security_invoker = on) as
with tot as (
  select team_id, count(*) as sesiones_totales
  from public.trainings
  group by team_id
),
asis as (
  select
    ta.player_id,
    count(*)                                            as sesiones_registradas,
    count(*) filter (where s.counts_as_present)         as presentes,
    count(*) filter (where not s.counts_as_present)     as ausencias
  from public.training_attendance ta
  join public.attendance_statuses s on s.code = ta.status_code
  group by ta.player_id
)
select
  p.team_id,
  p.id                                  as player_id,
  p.name                                as jugador,
  p.shirt_number                        as dorsal,
  p.active                              as activo,
  coalesce(t.sesiones_totales, 0)       as sesiones_totales,
  coalesce(a.sesiones_registradas, 0)   as sesiones_registradas,
  coalesce(a.presentes, 0)              as presentes,
  coalesce(a.ausencias, 0)              as ausencias,
  round(100.0 * coalesce(a.presentes, 0)
        / nullif(coalesce(a.sesiones_registradas, 0), 0), 1) as porcentaje_asistencia
from public.players p
left join asis a on a.player_id = p.id
left join tot t  on t.team_id   = p.team_id;

-- ---- Desglose de asistencia por motivo ----
create or replace view public.v_asistencia_por_motivo
with (security_invoker = on) as
select
  p.team_id,
  p.id                  as player_id,
  p.name                as jugador,
  s.code                as estado,
  s.label               as motivo,
  s.counts_as_present   as cuenta_como_presente,
  count(*)              as sesiones
from public.training_attendance ta
join public.players p             on p.id = ta.player_id
join public.attendance_statuses s on s.code = ta.status_code
group by p.team_id, p.id, p.name, s.code, s.label, s.counts_as_present;

-- ---- Exportación de partidos: formato largo, una fila por
--      jugador y partido, lista para CSV ----
create or replace view public.v_export_partidos
with (security_invoker = on) as
select
  m.team_id,
  m.match_date        as fecha,
  m.opponent          as rival,
  m.venue             as sede,
  m.competition       as competicion,
  m.status            as estado,
  m.goals_for         as goles_favor,
  m.goals_against     as goles_contra,
  p.name              as jugador,
  p.shirt_number      as dorsal,
  a.role              as rol,
  mar.label           as motivo_ausencia,
  a.minutes_played    as minutos,
  a.entered_minute    as minuto_entrada,
  a.exited_minute     as minuto_salida,
  pos.posiciones      as posiciones,
  coalesce(ev.goles, 0)       as goles,
  coalesce(ev.asistencias, 0) as asistencias,
  coalesce(ev.amarillas, 0)   as amarillas,
  coalesce(ev.rojas, 0)       as rojas
from public.appearances a
join public.matches m on m.id = a.match_id
join public.players p on p.id = a.player_id
left join public.match_absence_reasons mar on mar.code = a.absence_reason_code
left join lateral (
  select string_agg(ap.position_code || ':' || ap.minutes, ', ' order by ap.minutes desc) as posiciones
  from public.appearance_positions ap
  where ap.appearance_id = a.id
) pos on true
left join lateral (
  select
    count(*) filter (where e.type = 'gol')                          as goles,
    count(*) filter (where e.type = 'asistencia')                   as asistencias,
    count(*) filter (where e.type in ('amarilla','doble_amarilla')) as amarillas,
    count(*) filter (where e.type in ('roja','doble_amarilla'))     as rojas
  from public.match_events e
  where e.match_id = a.match_id and e.player_id = a.player_id
) ev on true;

-- ---- Exportación de entrenamientos: una fila por jugador y sesión ----
create or replace view public.v_export_entrenamientos
with (security_invoker = on) as
select
  t.team_id,
  t.session_date      as fecha,
  t.focus             as foco,
  t.duration_min      as duracion_min,
  p.name              as jugador,
  p.shirt_number      as dorsal,
  s.label             as estado,
  case when s.counts_as_present then 'sí' else 'no' end as cuenta_como_presente,
  ta.reason           as motivo
from public.training_attendance ta
join public.trainings t           on t.id = ta.training_id
join public.players p             on p.id = ta.player_id
join public.attendance_statuses s on s.code = ta.status_code;


-- =====================================================================
--  9. ROW LEVEL SECURITY
-- =====================================================================

alter table public.positions             enable row level security;
alter table public.formations            enable row level security;
alter table public.formation_slots       enable row level security;
alter table public.attendance_statuses   enable row level security;
alter table public.match_absence_reasons enable row level security;
alter table public.teams                 enable row level security;
alter table public.team_members          enable row level security;
alter table public.players               enable row level security;
alter table public.matches               enable row level security;
alter table public.lineups               enable row level security;
alter table public.lineup_slots          enable row level security;
alter table public.appearances           enable row level security;
alter table public.appearance_positions  enable row level security;
alter table public.match_events          enable row level security;
alter table public.trainings             enable row level security;
alter table public.training_attendance   enable row level security;
alter table public.injuries              enable row level security;
alter table public.suspensions           enable row level security;

-- ---- Catálogos: solo lectura para cualquier usuario logueado ----
create policy "catalogo lectura" on public.positions
  for select to authenticated using (true);
create policy "catalogo lectura" on public.formations
  for select to authenticated using (true);
create policy "catalogo lectura" on public.formation_slots
  for select to authenticated using (true);
create policy "catalogo lectura" on public.attendance_statuses
  for select to authenticated using (true);
create policy "catalogo lectura" on public.match_absence_reasons
  for select to authenticated using (true);

-- ---- teams: leer y editar el propio equipo. Crear y borrar equipos
--      se hace desde el SQL Editor en la v1 (no hay policy, denegado). ----
create policy "miembros leen su equipo" on public.teams
  for select to authenticated using (es_miembro(id));
create policy "miembros editan su equipo" on public.teams
  for update to authenticated
  using (es_miembro(id)) with check (es_miembro(id));

-- ---- team_members: cada usuario ve solo sus propias membresías.
--      Altas y bajas de miembros, desde el SQL Editor en la v1. ----
create policy "ver mis membresias" on public.team_members
  for select to authenticated using (user_id = auth.uid());

-- ---- Tablas con team_id directo: CRUD completo para miembros ----
create policy "miembros gestionan jugadores" on public.players
  for all to authenticated
  using (es_miembro(team_id)) with check (es_miembro(team_id));

create policy "miembros gestionan partidos" on public.matches
  for all to authenticated
  using (es_miembro(team_id)) with check (es_miembro(team_id));

create policy "miembros gestionan entrenamientos" on public.trainings
  for all to authenticated
  using (es_miembro(team_id)) with check (es_miembro(team_id));

create policy "miembros gestionan lesiones" on public.injuries
  for all to authenticated
  using (es_miembro(team_id)) with check (es_miembro(team_id));

create policy "miembros gestionan sanciones" on public.suspensions
  for all to authenticated
  using (es_miembro(team_id)) with check (es_miembro(team_id));

-- ---- Tablas hijas sin team_id: la pertenencia se comprueba
--      subiendo por la FK hasta el team_id del padre ----

-- lineups -> matches
create policy "miembros gestionan alineaciones" on public.lineups
  for all to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = lineups.match_id and es_miembro(m.team_id)
  ))
  with check (exists (
    select 1 from public.matches m
    where m.id = lineups.match_id and es_miembro(m.team_id)
  ));

-- lineup_slots -> lineups -> matches
create policy "miembros gestionan ranuras" on public.lineup_slots
  for all to authenticated
  using (exists (
    select 1
    from public.lineups l
    join public.matches m on m.id = l.match_id
    where l.id = lineup_slots.lineup_id and es_miembro(m.team_id)
  ))
  with check (exists (
    select 1
    from public.lineups l
    join public.matches m on m.id = l.match_id
    where l.id = lineup_slots.lineup_id and es_miembro(m.team_id)
  ));

-- appearances -> matches
create policy "miembros gestionan convocatorias" on public.appearances
  for all to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = appearances.match_id and es_miembro(m.team_id)
  ))
  with check (exists (
    select 1 from public.matches m
    where m.id = appearances.match_id and es_miembro(m.team_id)
  ));

-- appearance_positions -> appearances -> matches
create policy "miembros gestionan minutos por posicion" on public.appearance_positions
  for all to authenticated
  using (exists (
    select 1
    from public.appearances a
    join public.matches m on m.id = a.match_id
    where a.id = appearance_positions.appearance_id and es_miembro(m.team_id)
  ))
  with check (exists (
    select 1
    from public.appearances a
    join public.matches m on m.id = a.match_id
    where a.id = appearance_positions.appearance_id and es_miembro(m.team_id)
  ));

-- match_events -> matches
create policy "miembros gestionan eventos" on public.match_events
  for all to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = match_events.match_id and es_miembro(m.team_id)
  ))
  with check (exists (
    select 1 from public.matches m
    where m.id = match_events.match_id and es_miembro(m.team_id)
  ));

-- training_attendance -> trainings
create policy "miembros gestionan asistencia" on public.training_attendance
  for all to authenticated
  using (exists (
    select 1 from public.trainings t
    where t.id = training_attendance.training_id and es_miembro(t.team_id)
  ))
  with check (exists (
    select 1 from public.trainings t
    where t.id = training_attendance.training_id and es_miembro(t.team_id)
  ));


-- =====================================================================
--  10. GRANTS DE POSTGRES
--      Imprescindibles: sin ellos PostgREST devuelve errores de
--      permisos aunque las policies estén bien.
-- =====================================================================

grant usage on schema public to authenticated;

-- ---- anon: nada de nada, explícito tabla a tabla ----
revoke all on public.positions              from anon;
revoke all on public.formations             from anon;
revoke all on public.formation_slots        from anon;
revoke all on public.attendance_statuses    from anon;
revoke all on public.match_absence_reasons  from anon;
revoke all on public.teams                  from anon;
revoke all on public.team_members           from anon;
revoke all on public.players                from anon;
revoke all on public.matches                from anon;
revoke all on public.lineups                from anon;
revoke all on public.lineup_slots           from anon;
revoke all on public.appearances            from anon;
revoke all on public.appearance_positions   from anon;
revoke all on public.match_events           from anon;
revoke all on public.trainings              from anon;
revoke all on public.training_attendance    from anon;
revoke all on public.injuries               from anon;
revoke all on public.suspensions            from anon;
revoke all on public.v_estadisticas_jugador     from anon;
revoke all on public.v_minutos_por_posicion     from anon;
revoke all on public.v_asistencia_entrenamientos from anon;
revoke all on public.v_asistencia_por_motivo    from anon;
revoke all on public.v_export_partidos          from anon;
revoke all on public.v_export_entrenamientos    from anon;

-- ---- authenticated: catálogos solo lectura ----
grant select on public.positions             to authenticated;
grant select on public.formations            to authenticated;
grant select on public.formation_slots       to authenticated;
grant select on public.attendance_statuses   to authenticated;
grant select on public.match_absence_reasons to authenticated;

-- ---- authenticated: estructura ----
grant select, update on public.teams        to authenticated;
grant select         on public.team_members to authenticated;

-- ---- authenticated: tablas de dominio, CRUD completo
--      (las policies de arriba acotan al propio equipo) ----
grant select, insert, update, delete on public.players              to authenticated;
grant select, insert, update, delete on public.matches              to authenticated;
grant select, insert, update, delete on public.lineups              to authenticated;
grant select, insert, update, delete on public.lineup_slots         to authenticated;
grant select, insert, update, delete on public.appearances          to authenticated;
grant select, insert, update, delete on public.appearance_positions to authenticated;
grant select, insert, update, delete on public.match_events         to authenticated;
grant select, insert, update, delete on public.trainings            to authenticated;
grant select, insert, update, delete on public.training_attendance  to authenticated;
grant select, insert, update, delete on public.injuries             to authenticated;
grant select, insert, update, delete on public.suspensions          to authenticated;

-- ---- authenticated: vistas ----
grant select on public.v_estadisticas_jugador      to authenticated;
grant select on public.v_minutos_por_posicion      to authenticated;
grant select on public.v_asistencia_entrenamientos to authenticated;
grant select on public.v_asistencia_por_motivo     to authenticated;
grant select on public.v_export_partidos           to authenticated;
grant select on public.v_export_entrenamientos     to authenticated;

-- =====================================================================
--  FIN. Ahora ejecuta seed.sql y sigue con el README:
--  desactivar sign-ups públicos y crear el usuario del entrenador.
-- =====================================================================
