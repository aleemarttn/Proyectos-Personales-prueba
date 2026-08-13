-- ============================================================
-- NutriGasto — Límite de intentos al unirse a un hogar por código
--
-- Los códigos de hogar son de 6 caracteres (A-Z0-9), y `unirse_a_hogar`
-- no tenía ningún límite de intentos: un usuario autenticado y sin hogar
-- podía llamar a la RPC en bucle probando códigos. El espacio de búsqueda
-- (36^6) hace que adivinar UN hogar concreto no sea práctico, pero el
-- riesgo real es el otro: para caer en *alguno* de los hogares que existen
-- hacen falta ~36^6/N intentos, así que la protección se debilita a medida
-- que la app crece. Es un fallo que envejece mal, no uno que duela hoy.
--
-- Se reutiliza `registrar_peticion_ia` (011/019), que ya implementa el
-- contador por usuario y ventana con su propia tabla: 5 intentos por minuto
-- y 20 al día. Entrar en un hogar es algo que se hace una vez, así que el
-- margen sobra para el uso legítimo (incluido equivocarse tecleando) y
-- convierte la fuerza bruta en inviable.
--
-- El límite se comprueba DESPUÉS de SIN_SESION y YA_EN_HOGAR: quien ya está
-- en un hogar no puede unirse a otro de todas formas, así que no tiene
-- sentido gastarle cuota (ni dejar que su error consuma el contador).
--
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

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

  -- Antes de mirar si el código existe: si no, el propio mensaje de error
  -- convierte la función en un oráculo que se puede consultar sin coste.
  if not public.registrar_peticion_ia('unirse_a_hogar', 5, 20) then
    raise exception 'DEMASIADOS_INTENTOS';
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

revoke all on function public.unirse_a_hogar(text) from public, anon;
grant execute on function public.unirse_a_hogar(text) to authenticated;
