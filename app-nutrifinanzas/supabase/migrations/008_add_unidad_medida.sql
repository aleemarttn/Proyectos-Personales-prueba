-- ============================================================
-- NutriGasto — Fase 7: alimentos líquidos (gramos o mililitros)
-- Hasta ahora todo se medía en gramos: la columna se llama `cantidad_g` y
-- las pantallas escribían "g" a mano. Pero se bebe tanto como se come, y
-- un batido de 330 ml mostrado como "330 g" está mal etiquetado.
--
-- No se convierte nada: las etiquetas dan los macros "por 100 g" o "por
-- 100 ml" según el producto, y el cálculo es el mismo en ambos casos
-- (cantidad × valor ÷ 100). Lo único que faltaba era GUARDAR en qué unidad
-- está expresado cada alimento, para poder enseñarlo bien.
--
-- Por eso `cantidad_g` no se renombra: sigue siendo la cantidad numérica,
-- y `unidad_medida` dice si son gramos o mililitros. Renombrarla obligaría
-- a tocar la vista `resumen_diario` y no aporta nada.
--
-- Ejecutar en Supabase: panel -> SQL Editor -> New query -> pegar y RUN.
-- ============================================================

-- ------------------------------------------------------------
-- La unidad es una propiedad del ALIMENTO (el aceite se mide en ml, el
-- arroz en g), así que vive en la despensa del usuario y en el catálogo
-- compartido, para que quien escanee ese código después lo herede.
-- ------------------------------------------------------------
alter table public.alimentos
  add column if not exists unidad_medida text not null default 'g'
    check (unidad_medida in ('g', 'ml'));

alter table public.productos
  add column if not exists unidad_medida text not null default 'g'
    check (unidad_medida in ('g', 'ml'));

-- ------------------------------------------------------------
-- En el diario se guarda copiada, igual que el nombre y las kcal: si
-- mañana cambias el alimento, lo ya registrado debe seguir contando la
-- historia de cómo se registró.
-- ------------------------------------------------------------
alter table public.registros_diarios
  add column if not exists unidad_medida text not null default 'g'
    check (unidad_medida in ('g', 'ml'));
