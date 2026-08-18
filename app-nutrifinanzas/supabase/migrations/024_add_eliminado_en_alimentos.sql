-- ============================================================
-- NutriGasto — Gastos mensuales (Fase: historial por mes)
-- Hasta ahora, quitar un alimento de la despensa (Despensa.jsx -> AppContext
-- eliminarAlimento) hacía un DELETE real: en cuanto te comías o tirabas
-- algo, su coste desaparecía de "Gastos" para siempre. Eso ya hacía que el
-- total de gasto actual estuviera incompleto, y hace imposible un
-- historial por mes de verdad (julio aparecería casi vacío en cuanto se
-- hubiera consumido la mitad de lo comprado ese mes).
--
-- Se pasa a borrado lógico: `eliminado_en` nula = sigue en la despensa;
-- con fecha = se quitó, pero el registro (y su precio) se queda para el
-- historial de gasto. La despensa en vivo sigue viendo solo lo activo
-- (AppContext.leerAlimentos añade `.is('eliminado_en', null)`); Gastos lee
-- TODO lo que tenga `fecha` dentro del mes, sin ese filtro.
--
-- No hace falta tocar RLS: las políticas de alimentos (select/update
-- propio-o-hogar) ya permiten este UPDATE tal cual, y no tocan hogar_id.
--
-- Aviso: esto no recupera lo que ya se había borrado con DELETE antes de
-- esta migración — esas filas ya no existen. El historial completo por mes
-- empieza a funcionar desde que se despliega.
--
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

alter table public.alimentos
  add column if not exists eliminado_en timestamptz;

-- La despensa en vivo (lo único que Despensa.jsx/Diario necesitan ver) solo
-- consulta `eliminado_en is null`: un índice parcial la mantiene rápida
-- según se acumule historial de cosas ya consumidas/tiradas.
create index if not exists idx_alimentos_usuario_despensa
  on public.alimentos (usuario_id, fecha desc)
  where eliminado_en is null;

-- Consultas por mes de Gastos: filtran por fecha sin distinguir eliminado_en.
create index if not exists idx_alimentos_fecha
  on public.alimentos (fecha desc);
