// Categorías de alimentos con su color (para gráficos y etiquetas)
export const CATEGORIAS = [
  { id: 'Proteínas', color: '#ef4444' },
  { id: 'Hidratos', color: '#f59e0b' },
  { id: 'Grasas', color: '#eab308' },
  { id: 'Verduras', color: '#22c55e' },
  { id: 'Fruta', color: '#ec4899' },
  { id: 'Lácteos', color: '#3b82f6' },
  { id: 'Otros', color: '#8b5cf6' },
]

// Devuelve el color de una categoría (o un gris si no existe)
export function colorCategoria(id) {
  const c = CATEGORIAS.find((x) => x.id === id)
  return c ? c.color : '#94a3b8'
}

// Lista de supermercados habituales en España (respaldo mientras carga la
// lista comunitaria real desde Supabase; ver lib/supermercados.js).
export const SUPERMERCADOS = [
  'Mercadona',
  'Carrefour',
  'Lidl',
  'Dia',
  'Alcampo',
  'Consum',
  'Eroski',
  'Hiperdino',
  'Unide',
]
