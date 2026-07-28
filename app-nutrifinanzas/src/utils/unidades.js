// Un alimento se mide en gramos o en mililitros: se bebe tanto como se come.
// Los macros de la etiqueta vienen "por 100 g" o "por 100 ml" según el
// producto, y la cuenta es idéntica en ambos casos (cantidad × valor ÷ 100);
// lo único que cambia es cómo se escribe.

export const UNIDADES = ['g', 'ml']

// Unidad de un alimento/producto/registro, con 'g' como valor por defecto
// (es lo que había antes de la migración 008).
export function unidadDe(item) {
  return item?.unidadMedida === 'ml' ? 'ml' : 'g'
}

// "250 g" / "330 ml"
export function conUnidad(cantidad, unidad = 'g') {
  return `${Math.round(cantidad)} ${unidad === 'ml' ? 'ml' : 'g'}`
}

// Adivina la unidad a partir del texto de cantidad del envase ("330 ml",
// "1,5 L", "500 g"). Ante la duda, gramos.
export function adivinarUnidad(textoCantidad) {
  if (!textoCantidad) return 'g'
  return /\d\s*(ml|cl|l|litros?)\b/i.test(String(textoCantidad)) ? 'ml' : 'g'
}
