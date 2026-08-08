-- ============================================================
-- NutriGasto — Despensa compartida (hogares)
--
-- Una pareja o una familia comparten la nevera, así que no tiene sentido
-- que cada uno lleve su despensa por su lado. Con esto los dos ven los
-- mismos alimentos y los dos pueden añadir y quitar.
--
-- Lo que SÍ se comparte: la despensa y, por tanto, los gastos. No son dos
-- decisiones distintas: en esta app el gasto no vive en una tabla aparte,
-- es el `precio` del propio alimento. Compartir la despensa es compartir
-- la cesta de la compra.
--
-- Lo que NUNCA se comparte: el diario. `registros_diarios` no se toca en
-- esta migración, ni una sola política. Lo que come cada uno es suyo.
-- Tampoco se comparten el perfil, los objetivos ni el ayuno.
--
-- Cada usuario puede estar en UN hogar como mucho. No hay selector de
-- hogares ni casos raros que probar: `hogar_miembros` tiene el usuario
-- como clave primaria, así que la base de datos ya no deja otra cosa.
--
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tablas
-- ------------------------------------------------------------

create table if not exists public.hogares (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 40),
  -- Código corto para invitar. Se enseña en el perfil y se lo pasas a la
  -- otra persona por WhatsApp; es más fácil de dictar que un uuid.
  codigo text not null unique,
  creado_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.hogar_miembros (
  -- El usuario es la clave primaria: un hogar por persona, y punto.
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  hogar_id uuid not null references public.hogares(id) on delete cascade,
  rol text not null default 'miembro' check (rol in ('propietario', 'miembro')),
  created_at timestamptz not null default now()
);

create index if not exists idx_hogar_miembros_hogar on public.hogar_miembros (hogar_id);

-- ------------------------------------------------------------
-- 2) El alimento pasa a poder pertenecer a un hogar
-- ------------------------------------------------------------

-- NULL = alimento privado, que es como se queda todo lo que ya existe.
-- `usuario_id` NO cambia de significado: sigue siendo quien lo compró, y
-- por eso los gastos siguen sabiendo quién puso el dinero.
alter table public.alimentos
  add column if not exists hogar_id uuid references public.hogares(id) on delete set null;

create index if not exists idx_alimentos_hogar on public.alimentos (hogar_id)
  where hogar_id is not null;

-- ------------------------------------------------------------
-- 3) Funciones auxiliares
--
-- Van en SECURITY DEFINER a propósito: una política de `hogar_miembros`
-- que consultase `hogar_miembros` se llamaría a sí misma sin parar
-- (infinite recursion detected in policy). Al saltarse RLS por dentro, la
-- función corta el bucle. Por eso mismo llevan el `search_path` fijado y
-- se les quita el permiso a `public`: una función DEFINER con el
-- search_path suelto es un agujero de manual.
-- ------------------------------------------------------------

-- El hogar del usuario que hace la petición, o NULL si no está en ninguno.
-- STABLE para que Postgres la evalúe una vez por consulta y no una vez por
-- fila de la despensa.
create or replace function public.mi_hogar()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select hogar_id from public.hogar_miembros where usuario_id = auth.uid();
$$;

revoke all on function public.mi_hogar() from public;
grant execute on function public.mi_hogar() to authenticated;

-- Código de invitación de 6 caracteres. El alfabeto no lleva O, I, L, 0 ni 1
-- porque estos códigos se dictan en voz alta y se copian a mano.
create or replace function public.generar_codigo_hogar()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  -- El prefijo `v_` no es decorativo: una variable llamada `codigo` choca
  -- con la columna `codigo` de la tabla y Postgres se niega a adivinar
  -- ("column reference is ambiguous").
  v_codigo text;
  i int;
begin
  loop
    v_codigo := '';
    for i in 1..6 loop
      v_codigo := v_codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.hogares h where h.codigo = v_codigo);
  end loop;
  return v_codigo;
end;
$$;

revoke all on function public.generar_codigo_hogar() from public;

-- ------------------------------------------------------------
-- 4) Operaciones sobre el hogar
--
-- Crear, unirse y salir van por función y no por INSERT/DELETE directo.
-- Razones concretas, no manía:
--   - Para unirte necesitas BUSCAR el hogar por su código, y la política de
--     lectura solo te deja ver el tuyo. Con un INSERT normal no habría
--     forma de encontrarlo sin abrir la tabla entera a cualquiera.
--   - Al salir hay que devolver tus alimentos a privado Y borrar la
--     membresía. En dos pasos desde el cliente, si falla el segundo tu
--     comida se queda a la vista de gente que ya no es de tu casa.
-- ------------------------------------------------------------

create or replace function public.crear_hogar(p_nombre text)
returns public.hogares
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_hogar public.hogares;
begin
  if v_usuario is null then
    raise exception 'SIN_SESION';
  end if;
  if v_nombre is null then
    raise exception 'NOMBRE_VACIO';
  end if;
  if exists (select 1 from public.hogar_miembros where usuario_id = v_usuario) then
    raise exception 'YA_EN_HOGAR';
  end if;

  insert into public.hogares (nombre, codigo, creado_por)
  values (left(v_nombre, 40), public.generar_codigo_hogar(), v_usuario)
  returning * into v_hogar;

  insert into public.hogar_miembros (usuario_id, hogar_id, rol)
  values (v_usuario, v_hogar.id, 'propietario');

  return v_hogar;
end;
$$;

revoke all on function public.crear_hogar(text) from public;
grant execute on function public.crear_hogar(text) to authenticated;

create or replace function public.unirse_a_hogar(p_codigo text)
returns public.hogares
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
  v_hogar public.hogares;
begin
  if v_usuario is null then
    raise exception 'SIN_SESION';
  end if;
  if exists (select 1 from public.hogar_miembros where usuario_id = v_usuario) then
    raise exception 'YA_EN_HOGAR';
  end if;

  select * into v_hogar from public.hogares where codigo = v_codigo;
  if not found then
    raise exception 'CODIGO_INVALIDO';
  end if;

  -- Tope de 8. Un hogar son las personas que comparten nevera; si el
  -- código se filtra por ahí, esto evita que acabe siendo una despensa
  -- pública.
  if (select count(*) from public.hogar_miembros where hogar_id = v_hogar.id) >= 8 then
    raise exception 'HOGAR_LLENO';
  end if;

  insert into public.hogar_miembros (usuario_id, hogar_id, rol)
  values (v_usuario, v_hogar.id, 'miembro');

  return v_hogar;
end;
$$;

revoke all on function public.unirse_a_hogar(text) from public;
grant execute on function public.unirse_a_hogar(text) to authenticated;

create or replace function public.salir_del_hogar()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_hogar uuid;
  v_era_propietario boolean;
begin
  if v_usuario is null then
    raise exception 'SIN_SESION';
  end if;

  select hogar_id, rol = 'propietario'
    into v_hogar, v_era_propietario
    from public.hogar_miembros
   where usuario_id = v_usuario;

  -- Salir sin estar en ninguno no es un error, simplemente no hace nada
  if v_hogar is null then
    return;
  end if;

  -- Tus alimentos vuelven a ser tuyos y solo tuyos. No se borra nada: lo
  -- que compraste sigue en tu despensa y en tus gastos.
  update public.alimentos
     set hogar_id = null
   where usuario_id = v_usuario and hogar_id = v_hogar;

  delete from public.hogar_miembros where usuario_id = v_usuario;

  if not exists (select 1 from public.hogar_miembros where hogar_id = v_hogar) then
    -- Se ha ido el último: el hogar deja de existir
    update public.alimentos set hogar_id = null where hogar_id = v_hogar;
    delete from public.hogares where id = v_hogar;
  elsif v_era_propietario then
    -- Que no se quede un hogar sin dueño: hereda el miembro más antiguo
    update public.hogar_miembros
       set rol = 'propietario'
     where usuario_id = (
       select usuario_id from public.hogar_miembros
        where hogar_id = v_hogar
        order by created_at, usuario_id
        limit 1
     );
  end if;
end;
$$;

revoke all on function public.salir_del_hogar() from public;
grant execute on function public.salir_del_hogar() to authenticated;

-- Quién más está en tu hogar. Va por función para NO tener que abrir la
-- tabla `perfiles` a nadie: así solo salen el nombre y el email de la gente
-- de tu casa, y no su edad, sus objetivos ni sus ajustes de ayuno.
create or replace function public.miembros_de_mi_hogar()
returns table (usuario_id uuid, nombre text, email text, rol text, desde timestamptz)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select m.usuario_id, p.nombre, p.email, m.rol, m.created_at
    from public.hogar_miembros m
    join public.perfiles p on p.id = m.usuario_id
   where m.hogar_id = (
     select hogar_id from public.hogar_miembros where usuario_id = auth.uid()
   )
   order by m.created_at, m.usuario_id;
$$;

revoke all on function public.miembros_de_mi_hogar() from public;
grant execute on function public.miembros_de_mi_hogar() to authenticated;

-- ------------------------------------------------------------
-- 5) RLS de las tablas nuevas
--
-- Solo lectura, y solo de lo tuyo. Crear, unirse y salir pasan por las
-- funciones de arriba, que al ser DEFINER no necesitan política.
-- ------------------------------------------------------------

alter table public.hogares enable row level security;
alter table public.hogar_miembros enable row level security;

drop policy if exists hogares_select_propio on public.hogares;
create policy hogares_select_propio on public.hogares
  for select using (id = public.mi_hogar());

drop policy if exists hogar_miembros_select_propio on public.hogar_miembros;
create policy hogar_miembros_select_propio on public.hogar_miembros
  for select using (hogar_id = public.mi_hogar());

-- ------------------------------------------------------------
-- 6) RLS de `alimentos`: lo tuyo, más lo de tu hogar
--
-- El `and (hogar_id is null or hogar_id = mi_hogar())` del WITH CHECK no
-- sobra: sin él, cualquiera podría poner uno de sus alimentos en el
-- hogar de otro escribiendo su id a mano, y aparecería en una despensa
-- ajena.
-- ------------------------------------------------------------

drop policy if exists alimentos_select_propio on public.alimentos;
drop policy if exists alimentos_insert_propio on public.alimentos;
drop policy if exists alimentos_update_propio on public.alimentos;
drop policy if exists alimentos_delete_propio on public.alimentos;

drop policy if exists alimentos_select_propio_o_hogar on public.alimentos;
create policy alimentos_select_propio_o_hogar on public.alimentos
  for select using (
    usuario_id = auth.uid()
    or (hogar_id is not null and hogar_id = public.mi_hogar())
  );

drop policy if exists alimentos_insert_propio_o_hogar on public.alimentos;
create policy alimentos_insert_propio_o_hogar on public.alimentos
  for insert with check (
    usuario_id = auth.uid()
    and (hogar_id is null or hogar_id = public.mi_hogar())
  );

-- Los dos pueden editar y borrar lo que hay en la despensa común, que era
-- justo lo que se pedía: "que ambos puedan añadir y quitar alimentos".
drop policy if exists alimentos_update_propio_o_hogar on public.alimentos;
create policy alimentos_update_propio_o_hogar on public.alimentos
  for update using (
    usuario_id = auth.uid()
    or (hogar_id is not null and hogar_id = public.mi_hogar())
  ) with check (
    (usuario_id = auth.uid()
      or (hogar_id is not null and hogar_id = public.mi_hogar()))
    and (hogar_id is null or hogar_id = public.mi_hogar())
  );

drop policy if exists alimentos_delete_propio_o_hogar on public.alimentos;
create policy alimentos_delete_propio_o_hogar on public.alimentos
  for delete using (
    usuario_id = auth.uid()
    or (hogar_id is not null and hogar_id = public.mi_hogar())
  );
