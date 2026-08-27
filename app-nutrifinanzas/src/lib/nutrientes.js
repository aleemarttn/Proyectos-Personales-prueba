// Los cuatro nutrientes que se añadieron en la migración 014 (saturadas,
// azúcares, sal y fibra) viajan juntos por media app: del escáner al alta,
// del alta a la despensa, de la despensa al catálogo compartido y de ahí al
// diario. Repetir los cuatro nombres en cada sitio es la forma segura de
// que se olvide uno por el camino, así que se agrupan aquí.
//
// Son SIEMPRE opcionales: un alimento antiguo (o dado de alta a mano) no
// los tiene, y eso está bien — simplemente no generará avisos.

// Cómo se pintan los cuatro. Vive aquí y no en cada pantalla para que la
// ficha de la despensa y el alta manual los enseñen con el mismo nombre, la
// misma unidad y en el mismo orden (el de la etiqueta de un envase real:
// primero el desglose de la grasa, luego el del hidrato, y al final sal y
// fibra).
export const NUTRIENTES = [
  { campo: 'grasasSaturadas', etiqueta: 'Saturadas', unidad: 'g', color: '#eab308' },
  { campo: 'azucares', etiqueta: 'Azúcares', unidad: 'g', color: '#f59e0b' },
  { campo: 'sal', etiqueta: 'Sal', unidad: 'g', color: '#64748b' },
  { campo: 'fibra', etiqueta: 'Fibra', unidad: 'g', color: '#84cc16' },
]

export const CAMPOS_NUTRIENTES = NUTRIENTES.map((n) => n.campo)

const A_COLUMNA = {
  grasasSaturadas: 'grasas_saturadas',
  azucares: 'azucares',
  sal: 'sal',
  fibra: 'fibra',
}

// Las columnas de la base de datos, para las listas de campos permitidos
export const COLUMNAS_NUTRIENTES = Object.values(A_COLUMNA)

function aNumeroONull(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

// Fila de la BD -> objeto de pantallas (numeric llega como texto o null)
export function nutrientesDeFila(fila) {
  const salida = {}
  for (const campo of CAMPOS_NUTRIENTES) {
    salida[campo] = aNumeroONull(fila?.[A_COLUMNA[campo]])
  }
  return salida
}

// Objeto de pantallas -> columnas de la BD
export function nutrientesAFila(objeto) {
  const salida = {}
  for (const campo of CAMPOS_NUTRIENTES) {
    salida[A_COLUMNA[campo]] = aNumeroONull(objeto?.[campo])
  }
  return salida
}

// Copia solo estos cuatro campos de un objeto a otro (para arrastrarlos por
// los formularios sin enumerarlos una y otra vez).
export function nutrientesDe(objeto) {
  const salida = {}
  for (const campo of CAMPOS_NUTRIENTES) {
    salida[campo] = objeto?.[campo] ?? null
  }
  return salida
}

// El sodio NO se guarda: en la UE las etiquetas declaran SAL, y la relación
// es exacta (sal = sodio × 2,5, por el peso molecular del cloruro sódico).
// Así que se calcula al vuelo en vez de añadir una columna que sería siempre
// redundante. Devuelve null si no hay sal registrada.
export function sodioDeSal(sal) {
  const n = aNumeroONull(sal)
  return n === null ? null : n / 2.5
}

// Escala los cuatro a la cantidad consumida (vienen por 100 g/ml), igual
// que se hace con kcal y macros al registrar una comida.
export function nutrientesPorCantidad(objeto, cantidad) {
  const salida = {}
  for (const campo of CAMPOS_NUTRIENTES) {
    const valor = aNumeroONull(objeto?.[campo])
    salida[campo] = valor === null ? null : (valor * cantidad) / 100
  }
  return salida
}
