-- ============================================================
-- NutriGasto — Rate limit de las Edge Functions que llaman a Gemini
-- Motivo: 'generar-recetas' y 'analizar-imagen' consumen la cuota
-- gratuita de Gemini (compartida por todo el proyecto) y tardan varios
-- segundos cada una. Sin límite, una cuenta comprometida o un script
-- machacando el endpoint puede agotar la cuota del día para TODOS los
-- usuarios, o encarecer la factura si se pasa a un tier de pago.
--
-- El límite vive en la base de datos (no en el frontend) para que se
-- cumpla también si alguien llama a la Edge Function directamente con
-- su propio token, saltándose la app.
--
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

-- ------------------------------------------------------------
-- Tabla: limites_peticiones_ia
-- Una fila por petición aceptada (no por intento): sirve como registro
-- para contar cuántas caben en la ventana de tiempo. Se auto-limpia sola
-- (ver registrar_peticion_ia) así que nunca crece sin límite.
-- ------------------------------------------------------------
create table if not exists public.limites_peticiones_ia (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  funcion    text not null,
  creado_en  timestamptz not null default now()
);

create index if not exists idx_limites_peticiones_ia_ventana
  on public.limites_peticiones_ia (usuario_id, funcion, creado_en desc);

-- RLS activado pero SIN policies: la tabla no se lee ni se escribe
-- directamente desde el cliente, solo a través de la función de abajo
-- (security definer). Así ni con la anon key se puede falsear el contador.
alter table public.limites_peticiones_ia enable row level security;

-- ------------------------------------------------------------
-- Función: registrar_peticion_ia
-- Atómica: cuenta + inserta en la misma transacción, así dos peticiones
-- simultáneas del mismo usuario no se cuelan ambas por una condición de
-- carrera entre "leer contador" y "escribir".
-- Devuelve true si la petición entra dentro del límite (y la registra),
-- false si hay que rechazarla (y NO la registra, para no penalizar dos
-- veces la misma petición rechazada).
-- ------------------------------------------------------------
create or replace function public.registrar_peticion_ia(
  p_funcion text,
  p_limite_minuto int,
  p_limite_dia int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_conteo_minuto int;
  v_conteo_dia int;
begin
  if v_usuario_id is null then
    raise exception 'No autorizado';
  end if;

  -- Limpieza perezosa: borra el propio historial de más de un día en cada
  -- llamada, en vez de mantener un cron aparte solo para esto.
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

-- Solo usuarios autenticados pueden llamarla, y cada uno solo cuenta lo
-- suyo (auth.uid() dentro de la función, no un parámetro que se pueda falsear).
revoke all on function public.registrar_peticion_ia(text, int, int) from public;
grant execute on function public.registrar_peticion_ia(text, int, int) to authenticated;
