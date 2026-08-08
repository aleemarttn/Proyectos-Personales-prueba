-- ============================================================
-- NutriGasto — Nutrientes que faltaban para poder avisar de algo
-- Hasta ahora solo se guardan kcal, proteínas, hidratos y grasas. Con eso
-- es IMPOSIBLE distinguir la grasa de un aguacate de la de unas patatas
-- fritas: para el sistema las dos son "grasas". Estas cuatro columnas son
-- justo las que faltan para poder decir algo cierto sobre un alimento.
--
-- Open Food Facts ya devuelve las cuatro (saturated-fat_100g, sugars_100g,
-- salt_100g, fiber_100g) y las estábamos tirando a la basura; el escáner de
-- etiquetas con IA ya leía azúcares y sal.
--
-- Todas son NULLABLE a propósito: los alimentos que ya están en la despensa
-- se quedan sin ellas hasta que se vuelvan a escanear, y un alimento sin
-- estos datos simplemente no genera avisos.
--
-- Va una sentencia por columna a propósito, en vez de un `alter table` con
-- las cuatro separadas por comas: agrupadas daban un error de sintaxis en
-- el editor SQL. Así además, si algo falla, el número de línea señala la
-- columna exacta. Se puede ejecutar tantas veces como haga falta.
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

-- Valores por 100 g / 100 ml, igual que los macros que ya había.
alter table public.alimentos add column if not exists grasas_saturadas numeric(6, 2);
alter table public.alimentos add column if not exists azucares numeric(6, 2);
alter table public.alimentos add column if not exists sal numeric(6, 2);
alter table public.alimentos add column if not exists fibra numeric(6, 2);

alter table public.productos add column if not exists grasas_saturadas numeric(6, 2);
alter table public.productos add column if not exists azucares numeric(6, 2);
alter table public.productos add column if not exists sal numeric(6, 2);
alter table public.productos add column if not exists fibra numeric(6, 2);

-- En `registros_diarios` van las cantidades CONSUMIDAS (igual que kcal y el
-- resto de macros de esa tabla), no los valores por 100 g. Sirven para que
-- la pestaña "Recientes" pueda reconstruirlos y, más adelante, para poder
-- sumar el azúcar o la sal del día.
alter table public.registros_diarios add column if not exists grasas_saturadas numeric(8, 2);
alter table public.registros_diarios add column if not exists azucares numeric(8, 2);
alter table public.registros_diarios add column if not exists sal numeric(8, 2);
alter table public.registros_diarios add column if not exists fibra numeric(8, 2);
