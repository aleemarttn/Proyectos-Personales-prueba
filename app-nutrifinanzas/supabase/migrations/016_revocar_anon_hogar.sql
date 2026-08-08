-- ============================================================
-- NutriGasto — Quitarle a `anon` las funciones del hogar
--
-- Arregla un fallo de la 015. Allí escribí `revoke all on function ...
-- from public` dando por hecho que con eso el cliente sin sesión no podría
-- llamarlas. En Supabase no vale: hay unos DEFAULT PRIVILEGES que conceden
-- EXECUTE a `anon` y a `authenticated` sobre cada función nueva del esquema
-- `public`, y esa concesión es DIRECTA a esos roles. Revocarle a `public`
-- no la toca, así que las seis funciones quedaron abiertas a cualquiera con
-- la clave anónima.
--
-- Qué se pudo hacer con eso, siendo exactos: poca cosa. `crear_hogar`,
-- `unirse_a_hogar` y `salir_del_hogar` empiezan comprobando la sesión y
-- responden SIN_SESION; `mi_hogar` devuelve NULL y `miembros_de_mi_hogar`
-- devuelve cero filas. La que sí quedó expuesta de verdad es
-- `generar_codigo_hogar`, que no comprueba nada porque yo contaba con que
-- solo la llamase `crear_hogar` por dentro. No filtra datos —devuelve un
-- código LIBRE, no uno existente— pero es un endpoint sin autenticar que no
-- pinta nada ahí.
--
-- Se puede ejecutar tantas veces como haga falta.
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

-- Estas cinco las usa la app, pero siempre con sesión iniciada
revoke all on function public.mi_hogar() from anon;
revoke all on function public.crear_hogar(text) from anon;
revoke all on function public.unirse_a_hogar(text) from anon;
revoke all on function public.salir_del_hogar() from anon;
revoke all on function public.miembros_de_mi_hogar() from anon;

-- Esta no la llama el cliente nunca, ni con sesión ni sin ella
revoke all on function public.generar_codigo_hogar() from anon, authenticated;

-- `crear_hogar` la sigue llamando por dentro sin problema: al ser SECURITY
-- DEFINER se ejecuta con los permisos de su dueño, no con los de quien la
-- invoca.
