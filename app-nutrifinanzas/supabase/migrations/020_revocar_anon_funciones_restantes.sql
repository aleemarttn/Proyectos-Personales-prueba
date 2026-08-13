-- ============================================================
-- NutriGasto — Mismo arreglo de la 016, para las funciones que se
-- quedaron fuera
--
-- El advisor de seguridad de Supabase (tras la 019) señaló que
-- `crear_perfil_nuevo_usuario` y `registrar_peticion_ia` siguen siendo
-- ejecutables por `anon` vía RPC, exactamente el mismo fallo que describe
-- la 016: revocar a `public` no quita el DEFAULT PRIVILEGE que Supabase
-- concede DIRECTO a `anon`/`authenticated` sobre cada función nueva del
-- esquema `public`. La 011 y schema.sql revocaban solo `from public`, sin
-- nombrar `anon`, así que la concesión directa sobrevivió.
--
-- En la práctica ninguna de las dos es explotable hoy: `registrar_peticion_ia`
-- comprueba `auth.uid() is null` y responde con una excepción antes de tocar
-- nada, y `crear_perfil_nuevo_usuario` es una función de TRIGGER (`returns
-- trigger`) que revienta si se llama fuera de un trigger porque `NEW` no
-- existe en ese contexto. Aun así, ninguna de las dos debería ser un
-- endpoint público: se revoca para que quede igual de blindada que las de
-- la 016, y `crear_perfil_nuevo_usuario` se revoca también a `authenticated`
-- porque nadie debe llamarla a mano, solo el trigger `on_auth_user_created`.
--
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

revoke all on function public.crear_perfil_nuevo_usuario() from anon, authenticated;
revoke all on function public.registrar_peticion_ia(text, int, int) from anon;

-- De paso, search_path explícito en el trigger de comidas_usuario (007):
-- no es SECURITY DEFINER (corre con los permisos de quien dispara el
-- trigger, no hay escalada de privilegios posible), pero el advisor lo
-- señala como "mutable" y fijarlo no cuesta nada ni cambia su comportamiento.
create or replace function public.comprobar_limite_comidas()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.comidas_usuario where usuario_id = new.usuario_id) >= 7 then
    raise exception 'No puedes tener más de 7 comidas al día.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
