// Utilidades de fecha para el diario. Todo va en HORA LOCAL del móvil y en
// formato 'YYYY-MM-DD', que es como guarda `registros_diarios.fecha`.
//
// Ojo con dos trampas de JavaScript que aquí están evitadas a propósito:
//
//   1. `new Date().toISOString()` devuelve la fecha en UTC, no la del móvil.
//      En España (UTC+1/+2) eso convierte "hoy a la 01:00" en "ayer", y la
//      cena de after se registraría en el día equivocado. Por eso la cadena
//      se construye a mano con getFullYear/getMonth/getDate.
//   2. `new Date('2026-08-08')` (sin hora) se interpreta como UTC, así que
//      en España da las 02:00... del día anterior en algunos husos. Por eso
//      `desdeISO` pasa año/mes/día por separado, que sí es local.

// La semana empieza en lunes, como en España. La X es de miércoles.
export const INICIALES_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// Date -> 'YYYY-MM-DD' con la fecha que ve el usuario en su móvil
export function aISO(fecha) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export function hoyISO() {
  return aISO(new Date())
}

// 'YYYY-MM-DD' -> Date a las 00:00 locales
export function desdeISO(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

export function sumarDias(iso, dias) {
  const fecha = desdeISO(iso)
  fecha.setDate(fecha.getDate() + dias)
  return aISO(fecha)
}

// Lunes de la semana a la que pertenece `iso`. getDay() da 0 para domingo,
// así que se rota para que el domingo cuente como el último día (6) y no
// como el primero.
export function lunesDe(iso) {
  const desplazamiento = (desdeISO(iso).getDay() + 6) % 7
  return sumarDias(iso, -desplazamiento)
}

// Los 7 días (lunes -> domingo) de la semana de `iso`
export function semanaDe(iso) {
  const lunes = lunesDe(iso)
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

// En formato 'YYYY-MM-DD' el orden alfabético y el cronológico coinciden,
// así que comparar cadenas basta y no hace falta crear objetos Date.
export function esHoy(iso) {
  return iso === hoyISO()
}

export function esFuturo(iso) {
  return iso > hoyISO()
}

export function diaDelMes(iso) {
  return desdeISO(iso).getDate()
}

// 'Hoy' / 'Ayer' / 'Mañana', y para el resto el día de la semana: "sábado"
export function etiquetaDia(iso) {
  const hoy = hoyISO()
  if (iso === hoy) return 'Hoy'
  if (iso === sumarDias(hoy, -1)) return 'Ayer'
  if (iso === sumarDias(hoy, 1)) return 'Mañana'
  const nombre = desdeISO(iso).toLocaleDateString('es-ES', { weekday: 'long' })
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

// "8 de agosto" (sin año si es el actual, con año si no)
export function fechaLarga(iso) {
  const fecha = desdeISO(iso)
  const mismoAnio = fecha.getFullYear() === new Date().getFullYear()
  return fecha.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    ...(mismoAnio ? {} : { year: 'numeric' }),
  })
}

// --- Meses (para Gastos: navegación e historial por mes) ---
//
// Un "mes" se representa como el primer día de ese mes en 'YYYY-MM-DD'
// (ej. '2026-08-01'), igual que `fecha` representa un día: así el orden
// alfabético sigue coincidiendo con el cronológico y se puede seguir
// comparando con `<`/`>` sin crear objetos Date.

export function mesDe(iso) {
  return iso.slice(0, 8) + '01'
}

export function mesActualISO() {
  return mesDe(hoyISO())
}

export function sumarMeses(mesISO, n) {
  const [anio, mes] = mesISO.split('-').map(Number)
  return aISO(new Date(anio, mes - 1 + n, 1))
}

export function esMesActual(mesISO) {
  return mesISO === mesActualISO()
}

export function esMesFuturo(mesISO) {
  return mesISO > mesActualISO()
}

// "agosto 2026" (sin año si es el actual, con año si no — igual que fechaLarga)
export function nombreMes(mesISO) {
  const fecha = desdeISO(mesISO)
  const mismoAnio = fecha.getFullYear() === new Date().getFullYear()
  const nombre = fecha.toLocaleDateString('es-ES', {
    month: 'long',
    ...(mismoAnio ? {} : { year: 'numeric' }),
  })
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

// "ago" — para las etiquetas del gráfico de tendencia, donde no cabe el nombre entero.
export function nombreMesCorto(mesISO) {
  const nombre = desdeISO(mesISO).toLocaleDateString('es-ES', { month: 'short' })
  return nombre.charAt(0).toUpperCase() + nombre.slice(1).replace('.', '')
}
