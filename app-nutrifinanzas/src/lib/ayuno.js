import { supabase } from './supabase.js'

// Ayuno intermitente (tabla `ayunos`, migración 013). Un ayuno con `fin` a
// null es el que está en curso: el contador de la pantalla se calcula
// siempre como "ahora menos inicio", nunca acumulando en el cliente, así
// que sigue subiendo aunque cierres la app, te quedes sin batería o mires
// desde otro móvil.

function filaAAyuno(fila) {
  if (!fila) return null
  return {
    id: fila.id,
    inicio: new Date(fila.inicio),
    fin: fila.fin ? new Date(fila.fin) : null,
    horasObjetivo: Number(fila.horas_objetivo),
  }
}

// El ayuno en curso, o null si no hay ninguno abierto.
export async function cargarAyunoAbierto() {
  const { data, error } = await supabase
    .from('ayunos')
    .select('*')
    .is('fin', null)
    .order('inicio', { ascending: false })
    .maybeSingle()

  if (error) throw error
  return filaAAyuno(data)
}

// Arranca un ayuno. `inicio` puede ser pasado (empezaste a cenar a las
// 21:00 pero le das al botón a las 23:30); si no se pasa, empieza ahora.
export async function empezarAyuno(usuarioId, horasObjetivo, inicio = null) {
  const fila = {
    usuario_id: usuarioId,
    horas_objetivo: horasObjetivo,
  }
  if (inicio) fila.inicio = inicio.toISOString()

  const { data, error } = await supabase.from('ayunos').insert(fila).select().single()
  if (error) throw error
  return filaAAyuno(data)
}

export async function terminarAyuno(id) {
  const { error } = await supabase
    .from('ayunos')
    .update({ fin: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// --- Cálculos de la ventana ---

// "21:00:00" (columna time de Postgres) -> la última vez que dieron esas
// horas, hoy si ya han pasado o ayer si aún no. Sirve para el atajo
// "empecé a mi hora de siempre" sin tener que escribir la fecha.
export function ultimaVezQueDieron(horaTexto) {
  const [horas, minutos] = String(horaTexto || '21:00').split(':').map(Number)
  const fecha = new Date()
  fecha.setHours(horas, minutos || 0, 0, 0)
  if (fecha > new Date()) fecha.setDate(fecha.getDate() - 1)
  return fecha
}

// "21:00:00" -> "21:00" (para enseñarlo sin los segundos)
export function horaSinSegundos(horaTexto) {
  return String(horaTexto || '').slice(0, 5)
}

// Hora a la que se cumple el objetivo
export function horaObjetivo(inicio, horasObjetivo) {
  return new Date(inicio.getTime() + horasObjetivo * 3600 * 1000)
}

// Diferencia en milisegundos -> "16 h 05 min" / "45 min"
export function duracionLegible(ms) {
  const totalMinutos = Math.max(0, Math.floor(ms / 60000))
  const horas = Math.floor(totalMinutos / 60)
  const minutos = totalMinutos % 60
  if (horas === 0) return `${minutos} min`
  return `${horas} h ${String(minutos).padStart(2, '0')} min`
}
