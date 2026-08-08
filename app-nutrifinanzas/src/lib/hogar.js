import { supabase } from './supabase.js'

// Despensa compartida. Crear un hogar, unirse por código, salir y ver quién
// más está dentro. Todo pasa por funciones de la base de datos (migración
// 015) en vez de por INSERT/DELETE directos: para unirte hay que buscar el
// hogar por su código, y las políticas de lectura solo te dejan ver el tuyo.

// Los errores que lanzan a posta las funciones de Postgres llegan aquí como
// texto en `error.message`. Se traducen a algo que se pueda leer.
const MENSAJES = {
  SIN_SESION: 'Tienes que iniciar sesión.',
  NOMBRE_VACIO: 'Ponle un nombre a tu hogar.',
  YA_EN_HOGAR: 'Ya estás en un hogar. Sal de él antes de entrar en otro.',
  CODIGO_INVALIDO: 'Ese código no existe. Revísalo.',
  HOGAR_LLENO: 'Ese hogar ya tiene 8 personas.',
}

export function mensajeDeError(e) {
  const msg = e?.message || ''
  for (const [clave, texto] of Object.entries(MENSAJES)) {
    if (msg.includes(clave)) return texto
  }
  // Si la migración 015 no está aplicada, ni las tablas ni las funciones
  // existen. Merece un mensaje propio: no es culpa de quien lo usa.
  if (/schema cache|does not exist|relation .*hogar/i.test(msg)) {
    return 'Falta aplicar la migración de la despensa compartida en la base de datos.'
  }
  return 'No se ha podido completar la operación. Inténtalo de nuevo.'
}

function filaAHogar(fila, miembros = []) {
  if (!fila) return null
  return {
    id: fila.id,
    nombre: fila.nombre,
    codigo: fila.codigo,
    creadoPor: fila.creado_por,
    miembros: miembros.map((m) => ({
      usuarioId: m.usuario_id,
      nombre: m.nombre,
      email: m.email,
      esPropietario: m.rol === 'propietario',
      desde: m.desde,
    })),
  }
}

// Devuelve el hogar del usuario con sus miembros, o null si no está en
// ninguno. La política de lectura ya filtra: como mucho hay una fila.
export async function cargarHogar() {
  const { data, error } = await supabase.from('hogares').select('*').limit(1)
  if (error) throw error
  if (!data || data.length === 0) return null

  const { data: miembros, error: errMiembros } = await supabase.rpc(
    'miembros_de_mi_hogar'
  )
  if (errMiembros) throw errMiembros

  return filaAHogar(data[0], miembros || [])
}

export async function crearHogar(nombre) {
  const { data, error } = await supabase.rpc('crear_hogar', { p_nombre: nombre })
  if (error) throw error
  return filaAHogar(data)
}

export async function unirseAHogar(codigo) {
  const { data, error } = await supabase.rpc('unirse_a_hogar', {
    p_codigo: codigo,
  })
  if (error) throw error
  return filaAHogar(data)
}

// Salir no borra comida: tus alimentos vuelven a ser privados y siguen en tu
// despensa y en tus gastos. Si eras el último, el hogar desaparece.
export async function salirDelHogar() {
  const { error } = await supabase.rpc('salir_del_hogar')
  if (error) throw error
}

// Sirve tanto para escribirlo como para pegarlo: quita espacios, pasa a
// mayúsculas y deja solo los caracteres del alfabeto de los códigos.
export function limpiarCodigo(texto) {
  return (texto || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
}
