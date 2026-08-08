-- Tutorial de las herramientas de Perfil: se muestra una vez por cuenta nueva.
-- Las cuentas existentes se marcan como vistas para que no reciban un tour
-- al volver a iniciar sesión tras esta actualización.

alter table public.perfiles
  add column if not exists tour_perfil_visto boolean;

update public.perfiles
   set tour_perfil_visto = true
 where tour_perfil_visto is null;

alter table public.perfiles
  alter column tour_perfil_visto set default false,
  alter column tour_perfil_visto set not null;
