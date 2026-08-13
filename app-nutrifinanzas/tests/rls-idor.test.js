// Tests negativos de aislamiento multi-tenant (IDOR) contra el Supabase real
// del proyecto (svfmibqcpydwxlsvlcrp), usando solo la anon key — exactamente
// las mismas credenciales y el mismo camino que usa la app en el navegador.
// No hay Supabase local en este entorno (supabase start requiere Docker),
// así que probar contra el proyecto real con cuentas desechables es la forma
// de verificar el aislamiento con las policies/funciones RESUELTAS de verdad,
// no una reconstrucción en memoria de lo que dice el SQL.
//
// Cuentas y filas de prueba: se generan con prefijo `qa-rls-` y un sufijo
// aleatorio, y se limpian al final en `afterAll`. Los usuarios de
// auth.users NO se pueden borrar con la anon key (hace falta service_role,
// que esta app nunca usa desde código cliente) — quedan huérfanos en
// auth.users tras cada ejecución; bórralos a mano en el dashboard si te
// molestan, o pide que se listen/borren con el MCP de Supabase.
//
// Ejecutar: npm run test:rls

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

process.loadEnvFile?.(new URL('../.env', import.meta.url))

const URL_SUPABASE = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!URL_SUPABASE || !ANON_KEY) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (revisa .env).')
}

const sufijo = Math.random().toString(36).slice(2, 10)
const emailA = `qa-rls-a-${sufijo}@example.com`
const emailB = `qa-rls-b-${sufijo}@example.com`
const password = `Qa-${sufijo}-Rls-2026!`

function nuevoCliente() {
  // Un cliente por usuario, cada uno con su propia sesión en memoria (nunca
  // localStorage: si compartieran storage, la sesión de B pisaría la de A).
  return createClient(URL_SUPABASE, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function altaYSesion(cliente, email) {
  const alta = await cliente.auth.signUp({ email, password })
  if (alta.error) throw alta.error
  if (alta.data.session) return alta.data.user.id

  // Si el proyecto exige confirmar el email, signUp no devuelve sesión.
  const entrada = await cliente.auth.signInWithPassword({ email, password })
  if (entrada.error) {
    throw new Error(
      `El proyecto exige confirmación de email antes de poder iniciar sesión, así que estos ` +
        `tests no pueden crear una sesión real por su cuenta. Desactiva "Confirm email" en ` +
        `Authentication > Providers > Email para este proyecto de pruebas, o adapta el test ` +
        `para inyectar una sesión ya confirmada. Error original: ${entrada.error.message}`
    )
  }
  return entrada.data.user.id
}

describe('Aislamiento multi-tenant (hogar_id) — usuario B no puede ver ni tocar lo de A', () => {
  let clienteA, clienteB, idA, idB
  let hogarId

  beforeAll(async () => {
    clienteA = nuevoCliente()
    clienteB = nuevoCliente()
    idA = await altaYSesion(clienteA, emailA)
    idB = await altaYSesion(clienteB, emailB)
  }, 30_000)

  afterAll(async () => {
    // Autolimpieza de las filas: A sale del hogar (como es el único
    // miembro, salir_del_hogar borra el hogar entero) y A borra sus
    // alimentos de prueba (por si el insert de la última tanda quedó vivo).
    if (clienteA) {
      await clienteA.rpc('salir_del_hogar')
      await clienteA.from('alimentos').delete().ilike('nombre', 'QA RLS %')
    }
    await clienteA?.auth.signOut()
    await clienteB?.auth.signOut()
  })

  it('A puede crear un hogar', async () => {
    const { data, error } = await clienteA.rpc('crear_hogar', { p_nombre: 'QA RLS Hogar' })
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    hogarId = data.id
  })

  it('B (que no está en el hogar) NO puede leer el hogar de A', async () => {
    const { data, error } = await clienteB.from('hogares').select('*').eq('id', hogarId)
    expect(error).toBeNull() // RLS no da error, simplemente filtra
    expect(data).toEqual([])
  })

  it('A puede meter un alimento en la despensa del hogar', async () => {
    const { data, error } = await clienteA
      .from('alimentos')
      .insert({ usuario_id: idA, nombre: 'QA RLS Alimento Hogar', hogar_id: hogarId })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data?.hogar_id).toBe(hogarId)
  })

  it('B (fuera del hogar) NO ve los alimentos del hogar de A', async () => {
    const { data, error } = await clienteB.from('alimentos').select('*').eq('hogar_id', hogarId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('B NO puede colar uno de sus alimentos en el hogar de A escribiendo el hogar_id a mano', async () => {
    const { data, error } = await clienteB
      .from('alimentos')
      .insert({ usuario_id: idB, nombre: 'QA RLS Intento Colarse', hogar_id: hogarId })
      .select()

    // El WITH CHECK de alimentos_insert_propio_o_hogar debe rechazarlo:
    // hogar_id no es null y no es igual a mi_hogar() de B (que es null).
    expect(error).not.toBeNull()
    expect(error.code).toBe('42501') // row-level security policy violation
    expect(data).toBeFalsy()
  })

  it('B NO puede editar un alimento PRIVADO de A (usuario_id=A, sin hogar)', async () => {
    const { data: propio, error: errCrea } = await clienteA
      .from('alimentos')
      .insert({ usuario_id: idA, nombre: 'QA RLS Privado de A' })
      .select()
      .single()
    expect(errCrea).toBeNull()

    const { data: actualizado, error: errUpdate } = await clienteB
      .from('alimentos')
      .update({ nombre: 'Hackeado por B' })
      .eq('id', propio.id)
      .select()

    // No es un 403: la fila simplemente no matchea el USING de B, así que
    // el UPDATE afecta 0 filas en vez de dar error.
    expect(errUpdate).toBeNull()
    expect(actualizado).toEqual([])

    const { data: sigueIgual } = await clienteA.from('alimentos').select('nombre').eq('id', propio.id).single()
    expect(sigueIgual.nombre).toBe('QA RLS Privado de A')

    await clienteA.from('alimentos').delete().eq('id', propio.id)
  })

  it('B NO puede leer el perfil de A directamente', async () => {
    const { data, error } = await clienteB.from('perfiles').select('*').eq('id', idA)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})

describe('RPC del hogar sin sesión (anon puro, sin login)', () => {
  it('crear_hogar sin sesión falla (función revocada a anon / auth.uid() nulo)', async () => {
    const anon = nuevoCliente()
    const { data, error } = await anon.rpc('crear_hogar', { p_nombre: 'No debería crearse' })
    expect(error).not.toBeNull()
    expect(data).toBeFalsy()
  })

  it('unirse_a_hogar sin sesión falla', async () => {
    const anon = nuevoCliente()
    const { data, error } = await anon.rpc('unirse_a_hogar', { p_codigo: 'ABCDEF' })
    expect(error).not.toBeNull()
    expect(data).toBeFalsy()
  })

  it('registrar_peticion_ia sin sesión falla (protege el rate limit de las Edge Functions)', async () => {
    const anon = nuevoCliente()
    const { data, error } = await anon.rpc('registrar_peticion_ia', {
      p_funcion: 'analizar-imagen',
      p_limite_minuto: 15,
      p_limite_dia: 100,
    })
    expect(error).not.toBeNull()
    expect(data).toBeFalsy()
  })
})
