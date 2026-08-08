// Los cuatro nutrientes que se añadieron en la migración 014 (saturadas,
// azúcares, sal y fibra) viajan juntos por media app: del escáner al alta,
// del alta a la despensa, de la despensa al catálogo compartido y de ahí al
// diario. Repetir los cuatro nombres en cada sitio es la forma segura de
// que se olvide uno por el camino, así que se agrupan aquí.
//
// Son SIEMPRE opcionales: un alimento antiguo (o dado de alta a mano) no
// los tiene, y eso está bien — simplemente no generará avisos.

export const CAMPOS_NUTRIENTES = ['grasasSaturadas', 'azucares', 'sal', 'fibra']

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
