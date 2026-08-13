-- ============================================================
-- NutriGasto — Límite de longitud en los nombres del catálogo compartido
--
-- `productos` y `supermercados` son tablas "estilo wiki": cualquier usuario
-- autenticado puede insertar (y en productos, también actualizar) filas que
-- ven TODOS los usuarios de la app — un `<select>` de supermercados, o los
-- macros de un código de barras. Ninguna de las dos tenía tope de longitud
-- en `nombre`, así que una cuenta cualquiera podía insertar una cadena
-- arbitrariamente larga en un recurso compartido por todo el mundo.
--
-- Mismo patrón que ya usa `comidas_usuario.nombre` (migración 007):
-- `check (length(trim(nombre)) between 1 y N)`. No evita que alguien
-- escriba basura corta, ni modera el contenido: solo pone un límite
-- razonable de tamaño.
--
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

alter table public.productos drop constraint if exists productos_nombre_longitud;
alter table public.productos
  add constraint productos_nombre_longitud check (length(trim(nombre)) between 1 and 200);

alter table public.supermercados drop constraint if exists supermercados_nombre_longitud;
alter table public.supermercados
  add constraint supermercados_nombre_longitud check (length(trim(nombre)) between 1 and 60);
