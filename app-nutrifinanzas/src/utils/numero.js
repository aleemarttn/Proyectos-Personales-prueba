// Convierte '' -> null y texto con coma decimal española -> número (para
// columnas numéricas rellenadas a mano en un formulario).
export function aNumero(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
