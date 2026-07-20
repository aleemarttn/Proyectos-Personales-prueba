// Utilidades de formato para mostrar números bonitos en español.

// 5.8 -> "5,80 €"
export function euros(n) {
  return (n || 0).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
  })
}

// "2026-06-08" -> "8 jun"
export function fechaCorta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
