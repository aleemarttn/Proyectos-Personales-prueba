import { supabase } from './supabase.js'
import { hoyISO, sumarDias } from './fechas.js'

// Alimentos que ya has registrado antes, para no tener que volver a
// buscarlos: quien se cuida repite bastante lo que come, así que lo más
// rápido casi siempre es "lo de siempre".
//
// No hace falta tabla nueva: esto sale de `registros_diarios`, que ya
// guarda el nombre y los macros de cada cosa registrada. Se agrupa por
// nombre en el cliente porque PostgREST no hace GROUP BY.

const DIAS_ATRAS = 60
// Tope de filas a traer. Con 3 comidas al día y varios alimentos por
// comida, 400 cubren de sobra los 60 días de un usuario normal.
const MAX_FILAS = 400
const MAX_RESULTADOS = 30

// Dos registros son "el mismo alimento" si comparten nombre (sin importar
// mayúsculas ni espacios sobrantes).
function clave(nombre) {
  return (nombre || '').trim().toLowerCase()
}

// Los registros guardan los macros de LO CONSUMIDO (270 g de pizza = 769
// kcal), pero las pantallas trabajan con valores por 100 g/ml. Se deshace
// la multiplicación para poder reutilizarlo con cualquier cantidad.
function por100(valor, cantidadG) {
  if (valor === null || valor === undefined) return null
  return (Number(valor) * 100) / cantidadG
}

// Devuelve los alimentos registrados más veces en los últimos 60 días,
// con la forma que esperan las pantallas (macros por 100 g/ml), más la
// última cantidad usada para poder proponerla.
export async function cargarRecientes() {
  const { data, error } = await supabase
    .from('registros_diarios')
    .select(
      'nombre, cantidad_g, unidad_medida, kcal, proteinas, hidratos, grasas, alimento_id, codigo_barras, fecha, created_at'
    )
    .gte('fecha', sumarDias(hoyISO(), -DIAS_ATRAS))
    .order('created_at', { ascending: false })
    .limit(MAX_FILAS)

  if (error) throw error

  const porNombre = new Map()

  for (const fila of data) {
    const k = clave(fila.nombre)
    if (!k) continue

    const existente = porNombre.get(k)
    if (existente) {
      existente.veces += 1
      continue
    }

    // La primera vez que aparece un nombre es su registro MÁS RECIENTE
    // (vienen ordenados descendente), y es el que se usa de plantilla:
    // así se propone la última cantidad, no una de hace dos meses.
    const cantidadG = Number(fila.cantidad_g) || 0
    const conBase = cantidadG > 0 && fila.kcal !== null

    porNombre.set(k, {
      clave: k,
      nombre: fila.nombre,
      veces: 1,
      ultimaFecha: fila.fecha,
      ultimaCantidadG: cantidadG || null,
      unidadMedida: fila.unidad_medida || 'g',
      alimentoId: fila.alimento_id,
      codigoBarras: fila.codigo_barras,
      // Con cantidad conocida se puede recalcular a cualquier gramaje...
      kcal: conBase ? por100(fila.kcal, cantidadG) : null,
      proteinas: conBase ? por100(fila.proteinas, cantidadG) : null,
      hidratos: conBase ? por100(fila.hidratos, cantidadG) : null,
      grasas: conBase ? por100(fila.grasas, cantidadG) : null,
      // ...y sin ella (un "bocadillo de tortilla" apuntado a mano, sin
      // gramos) solo se puede repetir tal cual.
      sinBase: !conBase,
      kcalFijo: Number(fila.kcal) || 0,
      proteinasFijo: fila.proteinas === null ? null : Number(fila.proteinas),
      hidratosFijo: fila.hidratos === null ? null : Number(fila.hidratos),
      grasasFijo: fila.grasas === null ? null : Number(fila.grasas),
    })
  }

  // Primero lo que más repites; a igualdad de veces, lo más reciente.
  return [...porNombre.values()]
    .sort((a, b) => b.veces - a.veces || b.ultimaFecha.localeCompare(a.ultimaFecha))
    .slice(0, MAX_RESULTADOS)
}
