-- =====================================================================
--  APP GESTIÓN FÚTBOL — seed.sql
-- =====================================================================
--  Se ejecuta UNA VEZ, después de schema.sql.
--  Contiene:
--    1. Catálogo de posiciones
--    2. 5 formaciones con sus ranuras y coordenadas x/y ya calculadas
--    3. Catálogo de estados de asistencia a entrenamientos
--    4. Catálogo de motivos de ausencia en convocatorias
--    5. Equipo y plantilla de EJEMPLO  <-- EDITA ESTA PARTE
--    6. Plantilla del INSERT de team_members (comentado; ver README)
-- =====================================================================


-- =====================================================================
--  1. POSICIONES
-- =====================================================================

insert into public.positions (code, label, line, sort_order) values
  ('POR', 'Portero',               'portero', 1),
  ('LD',  'Lateral derecho',       'defensa', 2),
  ('DFC', 'Defensa central',       'defensa', 3),
  ('LI',  'Lateral izquierdo',     'defensa', 4),
  ('MCD', 'Mediocentro defensivo', 'medio',   5),
  ('MC',  'Mediocentro',           'medio',   6),
  ('MCO', 'Mediocentro ofensivo',  'medio',   7),
  ('ED',  'Extremo derecho',       'ataque',  8),
  ('EI',  'Extremo izquierdo',     'ataque',  9),
  ('SD',  'Segundo delantero',     'ataque', 10),
  ('DC',  'Delantero centro',      'ataque', 11);


-- =====================================================================
--  2. FORMACIONES Y RANURAS
--     Coordenadas sobre campo VERTICAL:
--       x: 0 = banda izquierda, 100 = banda derecha
--       y: 0 = portería rival (arriba), 100 = portería propia (abajo)
-- =====================================================================

insert into public.formations (name) values
  ('4-3-3'), ('4-4-2'), ('4-2-3-1'), ('3-5-2'), ('5-3-2');

-- ---- 4-3-3 ----
insert into public.formation_slots (formation_id, slot_code, position_code, x, y)
select f.id, s.slot_code, s.position_code, s.x, s.y
from public.formations f
cross join (values
  ('POR',   'POR', 50, 90),
  ('LD',    'LD',  84, 72),
  ('DFC-D', 'DFC', 62, 76),
  ('DFC-I', 'DFC', 38, 76),
  ('LI',    'LI',  16, 72),
  ('MCD',   'MCD', 50, 56),
  ('MC-D',  'MC',  70, 46),
  ('MC-I',  'MC',  30, 46),
  ('ED',    'ED',  82, 24),
  ('DC',    'DC',  50, 16),
  ('EI',    'EI',  18, 24)
) as s(slot_code, position_code, x, y)
where f.name = '4-3-3';

-- ---- 4-4-2 ----
insert into public.formation_slots (formation_id, slot_code, position_code, x, y)
select f.id, s.slot_code, s.position_code, s.x, s.y
from public.formations f
cross join (values
  ('POR',   'POR', 50, 90),
  ('LD',    'LD',  84, 72),
  ('DFC-D', 'DFC', 62, 76),
  ('DFC-I', 'DFC', 38, 76),
  ('LI',    'LI',  16, 72),
  ('MD',    'ED',  84, 46),
  ('MC-D',  'MC',  62, 50),
  ('MC-I',  'MC',  38, 50),
  ('MI',    'EI',  16, 46),
  ('DC-D',  'DC',  60, 18),
  ('DC-I',  'DC',  40, 18)
) as s(slot_code, position_code, x, y)
where f.name = '4-4-2';

-- ---- 4-2-3-1 ----
insert into public.formation_slots (formation_id, slot_code, position_code, x, y)
select f.id, s.slot_code, s.position_code, s.x, s.y
from public.formations f
cross join (values
  ('POR',   'POR', 50, 90),
  ('LD',    'LD',  84, 72),
  ('DFC-D', 'DFC', 62, 76),
  ('DFC-I', 'DFC', 38, 76),
  ('LI',    'LI',  16, 72),
  ('MCD-D', 'MCD', 62, 54),
  ('MCD-I', 'MCD', 38, 54),
  ('ED',    'ED',  82, 32),
  ('MCO',   'MCO', 50, 36),
  ('EI',    'EI',  18, 32),
  ('DC',    'DC',  50, 14)
) as s(slot_code, position_code, x, y)
where f.name = '4-2-3-1';

-- ---- 3-5-2 (carrileros como LD/LI) ----
insert into public.formation_slots (formation_id, slot_code, position_code, x, y)
select f.id, s.slot_code, s.position_code, s.x, s.y
from public.formations f
cross join (values
  ('POR',   'POR', 50, 90),
  ('DFC-D', 'DFC', 72, 75),
  ('DFC',   'DFC', 50, 78),
  ('DFC-I', 'DFC', 28, 75),
  ('CAR-D', 'LD',  88, 48),
  ('MC-D',  'MC',  68, 46),
  ('MCD',   'MCD', 50, 56),
  ('MC-I',  'MC',  32, 46),
  ('CAR-I', 'LI',  12, 48),
  ('DC-D',  'DC',  60, 18),
  ('DC-I',  'DC',  40, 18)
) as s(slot_code, position_code, x, y)
where f.name = '3-5-2';

-- ---- 5-3-2 ----
insert into public.formation_slots (formation_id, slot_code, position_code, x, y)
select f.id, s.slot_code, s.position_code, s.x, s.y
from public.formations f
cross join (values
  ('POR',   'POR', 50, 90),
  ('LD',    'LD',  88, 68),
  ('DFC-D', 'DFC', 68, 76),
  ('DFC',   'DFC', 50, 79),
  ('DFC-I', 'DFC', 32, 76),
  ('LI',    'LI',  12, 68),
  ('MC-D',  'MC',  68, 48),
  ('MC',    'MC',  50, 53),
  ('MC-I',  'MC',  32, 48),
  ('DC-D',  'DC',  60, 18),
  ('DC-I',  'DC',  40, 18)
) as s(slot_code, position_code, x, y)
where f.name = '5-3-2';


-- =====================================================================
--  3. ESTADOS DE ASISTENCIA A ENTRENAMIENTOS
-- =====================================================================

insert into public.attendance_statuses (code, label, counts_as_present) values
  ('presente',              'Presente',               true),
  ('tarde',                 'Llegó tarde',            true),
  ('ausente_justificado',   'Ausencia justificada',   false),
  ('ausente_injustificado', 'Ausencia injustificada', false),
  ('lesionado',             'Lesionado',              false),
  ('enfermo',               'Enfermo',                false),
  ('trabajo',               'Trabajo',                false),
  ('estudios',              'Estudios',               false),
  ('permiso',               'Permiso',                false),
  ('seleccion',             'Con la selección',       false);


-- =====================================================================
--  4. MOTIVOS DE AUSENCIA EN CONVOCATORIA
-- =====================================================================

insert into public.match_absence_reasons (code, label) values
  ('decision_tecnica', 'Decisión técnica'),
  ('lesion',           'Lesión'),
  ('sancion',          'Sanción'),
  ('enfermedad',       'Enfermedad'),
  ('trabajo',          'Trabajo'),
  ('estudios',         'Estudios'),
  ('viaje',            'Viaje'),
  ('personal',         'Motivos personales'),
  ('otros',            'Otros');


-- =====================================================================
--  5. EQUIPO Y PLANTILLA DE EJEMPLO  <-- EDITA ESTO
--     Cambia nombre, categoría, temporada y la lista de jugadores
--     por los reales ANTES de ejecutar, o edítalos luego desde la app.
-- =====================================================================

insert into public.teams (name, category, season)
values ('UD Icodense', 'Primera Regional', '2026/27');

insert into public.players (team_id, name, shirt_number, primary_position, dominant_foot)
select t.id, j.nombre, j.dorsal, j.posicion, j.pie
from public.teams t
cross join (values
  ('Jugador Uno',        1::smallint, 'POR', 'derecho'),
  ('Jugador Dos',        2::smallint, 'LD',  'derecho'),
  ('Jugador Tres',       3::smallint, 'LI',  'izquierdo'),
  ('Jugador Cuatro',     4::smallint, 'DFC', 'derecho'),
  ('Jugador Cinco',      5::smallint, 'DFC', 'izquierdo'),
  ('Jugador Seis',       6::smallint, 'MCD', 'derecho'),
  ('Jugador Siete',      7::smallint, 'ED',  'derecho'),
  ('Jugador Ocho',       8::smallint, 'MC',  'derecho'),
  ('Jugador Nueve',      9::smallint, 'DC',  'derecho'),
  ('Jugador Diez',      10::smallint, 'MCO', 'izquierdo'),
  ('Jugador Once',      11::smallint, 'EI',  'izquierdo'),
  ('Jugador Doce',      12::smallint, 'DFC', 'derecho'),
  ('Jugador Trece',     13::smallint, 'POR', 'derecho'),
  ('Jugador Catorce',   14::smallint, 'MC',  'derecho'),
  ('Jugador Quince',    15::smallint, 'LD',  'derecho'),
  ('Jugador Dieciseis', 16::smallint, 'MC',  'izquierdo'),
  ('Jugador Diecisiete',17::smallint, 'SD',  'derecho'),
  ('Jugador Dieciocho', 18::smallint, 'DC',  'derecho')
) as j(nombre, dorsal, posicion, pie)
where t.name = 'UD Icodense';


-- =====================================================================
--  6. VINCULAR AL ENTRENADOR CON EL EQUIPO  (hacer DESPUÉS de crear
--     el usuario en Authentication -> Users; ver README)
--
--     1) Copia el UUID del usuario desde el panel de Supabase.
--     2) Descomenta este bloque, pega el UUID y ejecútalo.
-- =====================================================================

-- insert into public.team_members (user_id, team_id, role)
-- select 'PEGA-AQUI-EL-UUID-DEL-USUARIO', t.id, 'entrenador'
-- from public.teams t
-- where t.name = 'UD Icodense';
