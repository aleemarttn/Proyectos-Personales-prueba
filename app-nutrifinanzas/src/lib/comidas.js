// Comidas del día del usuario (tabla `comidas_usuario`, migración 007).
// El nombre es editable, así que la lista de abajo son solo SUGERENCIAS
// para el editor de Perfil, no valores fijos guardados en la base.

export const MAX_COMIDAS = 7

// Las 3 que crea la base de datos para todo usuario nuevo.
export const COMIDAS_POR_DEFECTO = ['Desayuno', 'Comida', 'Cena']

// Sugerencias al añadir una comida (enfoque deportivo). Son solo atajos:
// el usuario puede escribir el nombre que quiera.
export const SUGERENCIAS = [
  'Media mañana',
  'Pre-entreno',
  'Post-entreno',
  'Merienda',
  'Recena',
]

// Franja horaria orientativa de cada comida por NOMBRE, para preseleccionar
// la comida más probable al abrir "Registrar comida" sin venir del diario.
// Si el usuario ha renombrado sus comidas y no coincide ninguna, se cae a
// la heurística por posición (ver comidaSugeridaPorHora).
const HORARIOS = [
  { claves: ['desayuno'], desde: 5, hasta: 11 },
  { claves: ['media mañana', 'almuerzo'], desde: 10, hasta: 12 },
  { claves: ['pre-entreno', 'preentreno'], desde: 16, hasta: 19 },
  { claves: ['comida', 'almuerzo'], desde: 13, hasta: 16 },
  { claves: ['post-entreno', 'postentreno'], desde: 18, hasta: 21 },
  { claves: ['merienda'], desde: 17, hasta: 20 },
  { claves: ['cena'], desde: 20, hasta: 23 },
  { claves: ['recena'], desde: 23, hasta: 24 },
]

function normalizar(texto) {
  return (texto || '').trim().toLowerCase()
}

// Devuelve la comida más probable para la hora actual. Primero intenta
// casar por nombre; si el usuario usa nombres propios, reparte el día
// entre sus comidas por orden (la primera por la mañana, la última por
// la noche).
export function comidaSugeridaPorHora(comidas, ahora = new Date()) {
  if (!comidas || comidas.length === 0) return null
  const hora = ahora.getHours()

  const porNombre = comidas.find((c) => {
    const nombre = normalizar(c.nombre)
    return HORARIOS.some(
      (h) => h.claves.some((k) => nombre.includes(k)) && hora >= h.desde && hora < h.hasta
    )
  })
  if (porNombre) return porNombre

  // Reparto proporcional entre las 6:00 y las 23:00.
  const inicio = 6
  const fin = 23
  const proporcion = Math.min(1, Math.max(0, (hora - inicio) / (fin - inicio)))
  const indice = Math.min(comidas.length - 1, Math.floor(proporcion * comidas.length))
  return comidas[indice]
}

// Traduce el error del trigger de la base de datos (tope de 7) a un
// mensaje que se pueda enseñar tal cual.
export function traducirErrorComida(error) {
  const msg = (error?.message || '').toLowerCase()
  if (msg.includes('más de 7') || msg.includes('mas de 7'))
    return `No puedes tener más de ${MAX_COMIDAS} comidas al día.`
  if (msg.includes('length') || msg.includes('check'))
    return 'El nombre debe tener entre 1 y 30 caracteres.'
  return 'No se pudo guardar el cambio. Inténtalo de nuevo.'
}
