-- El tour es para las cuentas nuevas, no para cada inicio de sesión.
-- Las cuentas existentes se marcan como vistas para no sorprender a quienes
-- ya estaban usando la app; las creadas después reciben el default `false`.

alter table public.perfiles
  add column if not exists tour_bienvenida_visto boolean;

update public.perfiles
   set tour_bienvenida_visto = true
 where tour_bienvenida_visto is null;

alter table public.perfiles
  alter column tour_bienvenida_visto set default false,
  alter column tour_bienvenida_visto set not null;
