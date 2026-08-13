-- ============================================================
-- NutriGasto — Consistencia de search_path en funciones SECURITY DEFINER
--
-- Auditoría de seguridad (2026-08-12): la migración 015 fija
-- `search_path = public, pg_temp` en sus 6 funciones DEFINER a propósito
-- (comentario en 015: "una función DEFINER con el search_path suelto es
-- un agujero de manual"), pero dos funciones anteriores se quedaron con
-- `search_path = public` a secas: `crear_perfil_nuevo_usuario` (definida
-- en schema.sql, redefinida en 007) y `registrar_peticion_ia` (011).
--
-- No es una vulnerabilidad activa hoy (pg_temp no se busca implícitamente
-- para funciones/operadores salvo que se liste, así que omitirlo no abre
-- una vía de secuestro), pero es una inconsistencia con el estándar que el
-- propio proyecto se marcó. Esta migración solo repite el `create or
-- replace function` con el search_path unificado; no cambia el cuerpo.
--
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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

create or replace function public.registrar_peticion_ia(
  p_funcion text,
  p_limite_minuto int,
  p_limite_dia int
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_conteo_minuto int;
  v_conteo_dia int;
begin
  if v_usuario_id is null then
    raise exception 'No autorizado';
  end if;

  delete from public.limites_peticiones_ia
  where usuario_id = v_usuario_id
    and funcion = p_funcion
    and creado_en < now() - interval '1 day';

  select count(*) into v_conteo_minuto
  from public.limites_peticiones_ia
  where usuario_id = v_usuario_id
    and funcion = p_funcion
    and creado_en > now() - interval '1 minute';

  if v_conteo_minuto >= p_limite_minuto then
    return false;
  end if;

  select count(*) into v_conteo_dia
  from public.limites_peticiones_ia
  where usuario_id = v_usuario_id
    and funcion = p_funcion
    and creado_en > now() - interval '1 day';

  if v_conteo_dia >= p_limite_dia then
    return false;
  end if;

  insert into public.limites_peticiones_ia (usuario_id, funcion)
  values (v_usuario_id, p_funcion);

  return true;
end;
$$;

-- create or replace no toca los privilegios ya concedidos (revoke/grant de
-- 011 y 016 siguen vigentes), pero se repiten aquí por si esta migración se
-- ejecuta sola en un proyecto nuevo sin haber pasado por 011/016 antes.
revoke all on function public.registrar_peticion_ia(text, int, int) from public;
grant execute on function public.registrar_peticion_ia(text, int, int) to authenticated;
