import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import * as hogares from '../lib/hogar.js'

// Este contexto gestiona la AUTENTICACIÓN (sesión de Supabase) y el PERFIL
// del usuario (tabla `perfiles`). Sustituye al perfil que antes vivía en
// localStorage dentro de AppContext.

const AuthContext = createContext(null)

// Convierte una fila de la tabla `perfiles` (columnas planas en snake_case)
// al formato que usan las pantallas (camelCase, con `macros` anidado).
function filaAPerfil(fila) {
  if (!fila) return null
  return {
    id: fila.id,
    email: fila.email,
    nombre: fila.nombre,
    edad: fila.edad,
    genero: fila.genero,
    comunidadAutonoma: fila.comunidad_autonoma,
    provincia: fila.provincia,
    tourBienvenidaVisto: !!fila.tour_bienvenida_visto,
    tourPerfilVisto: !!fila.tour_perfil_visto,
    // tipo_perfil es null hasta que se completa el onboarding
    tipo: fila.tipo_perfil,
    // Ayuno intermitente (migración 013). Si todavía no se ha aplicado, las
    // columnas no llegan y queda desactivado, que es lo que toca: la app no
    // enseña la tarjeta y no rompe nada.
    ayuno: {
      activo: !!fila.ayuno_activo,
      horasObjetivo: Number(fila.ayuno_horas_objetivo ?? 16),
      horaInicio: fila.ayuno_hora_inicio || '21:00:00',
    },
    macros:
      fila.tipo_perfil === 'total'
        ? {
            kcal: fila.macros_kcal,
            hidratos: fila.macros_hidratos,
            proteinas: fila.macros_proteinas,
            grasas: fila.macros_grasas,
          }
        : null,
  }
}

// Traduce los errores de Supabase Auth a mensajes claros en español.
export function traducirErrorAuth(error) {
  const msg = (error?.message || '').toLowerCase()
  if (msg.includes('invalid login credentials'))
    return 'Email o contraseña incorrectos.'
  if (msg.includes('user already registered'))
    return 'Ese email ya está registrado. Inicia sesión.'
  if (msg.includes('password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres.'
  if (msg.includes('invalid email') || msg.includes('unable to validate email'))
    return 'El email no es válido.'
  if (msg.includes('email not confirmed'))
    return 'Debes confirmar tu email antes de entrar.'
  return 'Ha ocurrido un error. Inténtalo de nuevo.'
}

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  // Hogar (despensa compartida) o null si el usuario no está en ninguno
  const [hogar, setHogar] = useState(null)
  // `cargando` cubre la comprobación inicial de sesión (evita parpadeos de redirección)
  const [cargando, setCargando] = useState(true)

  // Lee el perfil del usuario desde Supabase, actualiza el estado y lo devuelve.
  async function cargarPerfil(userId) {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error cargando el perfil:', error)
      setPerfil(null)
      return null
    }
    const p = filaAPerfil(data)
    setPerfil(p)
    return p
  }

  useEffect(() => {
    let activo = true

    // 1) Sesión inicial (al abrir/recargar la app)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!activo) return
      setSesion(session)
      if (session) await cargarPerfil(session.user.id)
      setCargando(false)
    })

    // 2) Cambios de sesión posteriores (login, logout, refresh de token)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_evento, session) => {
      if (!activo) return
      setSesion(session)
      if (session) await cargarPerfil(session.user.id)
      else setPerfil(null)
    })

    return () => {
      activo = false
      subscription.unsubscribe()
    }
  }, [])

  // Hogar del usuario. Va en su propio efecto y no dentro de `cargarPerfil`
  // porque no vive en la tabla `perfiles`, y sobre todo porque si la
  // migración 015 no está aplicada esto falla: que no se lleve por delante
  // la carga del perfil, que sí funciona.
  useEffect(() => {
    if (!sesion) {
      setHogar(null)
      return
    }

    let activo = true
    hogares
      .cargarHogar()
      .then((h) => {
        if (activo) setHogar(h)
      })
      .catch((e) => {
        console.error('Error cargando el hogar:', e)
        if (activo) setHogar(null)
      })

    return () => {
      activo = false
    }
  }, [sesion])

  // --- Acciones de autenticación ---

  // Registro. Con "Confirm email" desactivado, deja la sesión activa al momento.
  async function registrar(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (data.session) {
      setSesion(data.session)
      await cargarPerfil(data.user.id)
    }
    return data.session // null si hubiera confirmación de email activada
  }

  // Login. Devuelve el perfil ya cargado para poder decidir a dónde navegar.
  async function iniciarSesion(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    setSesion(data.session)
    return await cargarPerfil(data.user.id)
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    setSesion(null)
    setPerfil(null)
    setHogar(null)
  }

  // --- Hogar (despensa compartida) ---
  //
  // Las tres acciones devuelven el hogar resultante ya en el estado. Detrás
  // hay una función de Postgres que hace el trabajo en una sola transacción,
  // así que aquí no hay pasos a medias que deshacer.

  async function crearHogar(nombre) {
    const h = await hogares.crearHogar(nombre)
    // La función devuelve el hogar recién creado sin sus miembros; se
    // recargan para tener el nombre y el email de quien lo ha creado.
    setHogar(await hogares.cargarHogar())
    return h
  }

  async function unirseAHogar(codigo) {
    const h = await hogares.unirseAHogar(codigo)
    setHogar(await hogares.cargarHogar())
    return h
  }

  async function salirDelHogar() {
    await hogares.salirDelHogar()
    setHogar(null)
  }

  // Para cuando la otra persona se une o se va y quieres verlo reflejado
  async function refrescarHogar() {
    setHogar(await hogares.cargarHogar())
  }

  // --- Perfil ---

  // Guarda el perfil del onboarding con un UPDATE sobre la fila que ya creó
  // el trigger al registrarse. Recibe el formato de las pantallas (camelCase).
  async function guardarPerfil(datos) {
    if (!sesion) throw new Error('No hay sesión activa')

    const fila = {
      nombre: datos.nombre,
      edad: datos.edad ? Number(datos.edad) : null,
      genero: datos.genero,
      comunidad_autonoma: datos.comunidadAutonoma,
      provincia: datos.provincia,
      tipo_perfil: datos.tipo,
      macros_kcal: datos.macros?.kcal ?? null,
      macros_hidratos: datos.macros?.hidratos ?? null,
      macros_proteinas: datos.macros?.proteinas ?? null,
      macros_grasas: datos.macros?.grasas ?? null,
    }

    const { data, error } = await supabase
      .from('perfiles')
      .update(fila)
      .eq('id', sesion.user.id)
      .select()
      .single()

    if (error) throw error
    setPerfil(filaAPerfil(data))
  }

  // Se llama al abrir el tour, no al terminarlo: si se interrumpe la sesión,
  // no se vuelve a mostrar en cada acceso posterior.
  async function marcarTourBienvenidaVisto() {
    if (!sesion || perfil?.tourBienvenidaVisto) return

    const { data, error } = await supabase
      .from('perfiles')
      .update({ tour_bienvenida_visto: true })
      .eq('id', sesion.user.id)
      .select()
      .single()

    if (error) throw error
    setPerfil(filaAPerfil(data))
  }

  async function marcarTourPerfilVisto() {
    if (!sesion || perfil?.tourPerfilVisto) return

    const { data, error } = await supabase
      .from('perfiles')
      .update({ tour_perfil_visto: true })
      .eq('id', sesion.user.id)
      .select()
      .single()

    if (error) throw error
    setPerfil(filaAPerfil(data))
  }

  // Cambia de modo sin tocar nada más. Al pasar a simple NO se borra nada:
  // los macros se quedan en su columna y el diario en su tabla, solo dejan de
  // mostrarse. Volver a completo lo recupera todo tal y como estaba.
  // Al subir a completo hay que pasar `macros`, porque sin objetivos el diario
  // no tendría contra qué comparar.
  async function cambiarModo(tipo, macros = null) {
    if (!sesion) throw new Error('No hay sesión activa')

    const fila = { tipo_perfil: tipo }
    if (macros) {
      fila.macros_kcal = macros.kcal
      fila.macros_hidratos = macros.hidratos
      fila.macros_proteinas = macros.proteinas
      fila.macros_grasas = macros.grasas
    }

    const { data, error } = await supabase
      .from('perfiles')
      .update(fila)
      .eq('id', sesion.user.id)
      .select()
      .single()

    if (error) throw error
    setPerfil(filaAPerfil(data))
  }

  // Ajustes de ayuno intermitente (activarlo, horas objetivo y hora
  // habitual de inicio). Van aparte de `guardarPerfil` porque se tocan
  // desde Perfil y no en el onboarding.
  async function guardarAyuno({ activo, horasObjetivo, horaInicio }) {
    if (!sesion) throw new Error('No hay sesión activa')

    const { data, error } = await supabase
      .from('perfiles')
      .update({
        ayuno_activo: activo,
        ayuno_horas_objetivo: horasObjetivo,
        ayuno_hora_inicio: horaInicio,
      })
      .eq('id', sesion.user.id)
      .select()
      .single()

    if (error) throw error
    setPerfil(filaAPerfil(data))
  }

  const value = {
    sesion,
    perfil,
    hogar,
    cargando,
    registrar,
    iniciarSesion,
    cerrarSesion,
    guardarPerfil,
    marcarTourBienvenidaVisto,
    marcarTourPerfilVisto,
    cambiarModo,
    guardarAyuno,
    crearHogar,
    unirseAHogar,
    salirDelHogar,
    refrescarHogar,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
