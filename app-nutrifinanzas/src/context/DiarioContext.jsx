import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from './AuthContext.jsx'
import { hoyISO, semanaDe, sumarDias } from '../lib/fechas.js'
import { nutrientesAFila, nutrientesDeFila } from '../lib/nutrientes.js'

// Este contexto guarda el DIARIO de consumo (tabla `registros_diarios`,
// lo que te has comido), las COMIDAS del día del usuario (tabla
// `comidas_usuario`: editables, máximo 7) y los objetivos de macros
// (vista `resumen_diario`). Cada usuario solo ve lo suyo (RLS).
//
// El diario se mueve por días: `fecha` es el día que se está mirando. Se
// descarga la SEMANA entera de una vez (una sola consulta) porque la tira
// de días del dashboard necesita el total de cada día, no solo el del que
// está seleccionado.

const DiarioContext = createContext(null)

// Convierte una fila de `registros_diarios` al formato de las pantallas.
function filaARegistro(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    cantidadG: Number(fila.cantidad_g),
    // 'g' o 'ml': se copia del alimento al registrarlo (migración 008)
    unidadMedida: fila.unidad_medida || 'g',
    kcal: Number(fila.kcal),
    proteinas: fila.proteinas === null ? null : Number(fila.proteinas),
    hidratos: fila.hidratos === null ? null : Number(fila.hidratos),
    grasas: fila.grasas === null ? null : Number(fila.grasas),
    origen: fila.origen,
    alimentoId: fila.alimento_id,
    codigoBarras: fila.codigo_barras,
    comidaId: fila.comida_id,
    fecha: fila.fecha,
    creadoEn: fila.created_at,
    // Saturadas, azúcares, sal y fibra CONSUMIDOS (migración 014)
    ...nutrientesDeFila(fila),
  }
}

function filaAComida(fila) {
  return { id: fila.id, nombre: fila.nombre, orden: fila.orden }
}

// Convierte la fila de la vista `resumen_diario` (no existe en modo simple:
// la vista filtra por tipo_perfil = 'total', ver migración 005).
//
// La vista calcula lo consumido de HOY (su SQL fija `fecha = current_date`),
// así que sus campos `...ConsumidoHoy` son siempre los de hoy, mires el día
// que mires. Lo que usa el dashboard para el día seleccionado es
// `resumenDia`, más abajo; de aquí solo se aprovechan los objetivos.
function filaAResumen(fila) {
  if (!fila) return null
  return {
    kcalObjetivo: Number(fila.kcal_objetivo),
    proteinasGObjetivo: Number(fila.proteinas_g_objetivo),
    hidratosGObjetivo: Number(fila.hidratos_g_objetivo),
    grasasGObjetivo: Number(fila.grasas_g_objetivo),
    kcalConsumidoHoy: Number(fila.kcal_consumido_hoy),
    proteinasConsumidoHoy: Number(fila.proteinas_consumido_hoy),
    hidratosConsumidoHoy: Number(fila.hidratos_consumido_hoy),
    grasasConsumidoHoy: Number(fila.grasas_consumido_hoy),
    kcalRestanteHoy: Number(fila.kcal_restante_hoy),
  }
}

function sumar(registros, campo) {
  return registros.reduce((total, r) => total + (r[campo] || 0), 0)
}

export function DiarioProvider({ children }) {
  const { sesion } = useAuth()

  // Día que se está mirando en el diario ('YYYY-MM-DD', hora local)
  const [fecha, setFecha] = useState(hoyISO())
  // Registros de la semana COMPLETA a la que pertenece `fecha`
  const [registros, setRegistros] = useState([])
  const [comidas, setComidas] = useState([])
  const [resumen, setResumen] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const semana = useMemo(() => semanaDe(fecha), [fecha])
  // Solo se vuelve a descargar al cambiar de semana, no al cambiar de día
  const claveSemana = semana[0]

  async function cargarResumen() {
    const { data, error: err } = await supabase
      .from('resumen_diario')
      .select('*')
      .maybeSingle()

    if (err) {
      console.error('Error cargando el resumen diario:', err)
      return
    }
    setResumen(filaAResumen(data))
  }

  // Objetivos + comidas del día: no dependen de la fecha, se cargan una vez
  // por sesión.
  useEffect(() => {
    if (!sesion) {
      setComidas([])
      setResumen(null)
      return
    }

    let activo = true

    Promise.all([
      supabase.from('resumen_diario').select('*').maybeSingle(),
      supabase.from('comidas_usuario').select('*').order('orden', { ascending: true }),
    ]).then(([resumenFila, comidasFilas]) => {
      if (!activo) return
      if (resumenFila.error) {
        console.error('Error cargando el resumen diario:', resumenFila.error)
      } else {
        setResumen(filaAResumen(resumenFila.data))
      }
      if (comidasFilas.error) {
        console.error('Error cargando las comidas:', comidasFilas.error)
      } else {
        setComidas(comidasFilas.data.map(filaAComida))
      }
    })

    return () => {
      activo = false
    }
  }, [sesion])

  // Registros de la semana visible
  useEffect(() => {
    if (!sesion) {
      setRegistros([])
      setFecha(hoyISO())
      return
    }

    let activo = true
    setCargando(true)
    setError('')

    supabase
      .from('registros_diarios')
      .select('*')
      .gte('fecha', claveSemana)
      .lte('fecha', sumarDias(claveSemana, 6))
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (!activo) return
        if (err) {
          console.error('Error cargando el diario:', err)
          setError('No se pudo cargar tu diario.')
        } else {
          setRegistros(data.map(filaARegistro))
        }
        setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [sesion, claveSemana])

  // Lo registrado el día seleccionado
  const registrosDia = useMemo(
    () => registros.filter((r) => r.fecha === fecha),
    [registros, fecha]
  )

  // kcal por día de la semana visible, para la tira de días del dashboard
  const kcalPorDia = useMemo(() => {
    const totales = {}
    for (const dia of semana) totales[dia] = 0
    for (const r of registros) {
      if (r.fecha in totales) totales[r.fecha] += r.kcal
    }
    return totales
  }, [registros, semana])

  // Objetivo (de la vista) vs. consumido el día seleccionado (calculado aquí).
  // La vista solo sabe de hoy, así que el "cuánto llevas" de cualquier otro
  // día se suma en el cliente, con los registros que ya están descargados.
  const resumenDia = useMemo(() => {
    if (!resumen) return null
    const kcalConsumido = sumar(registrosDia, 'kcal')
    return {
      kcalObjetivo: resumen.kcalObjetivo,
      proteinasGObjetivo: resumen.proteinasGObjetivo,
      hidratosGObjetivo: resumen.hidratosGObjetivo,
      grasasGObjetivo: resumen.grasasGObjetivo,
      kcalConsumido,
      proteinasConsumido: sumar(registrosDia, 'proteinas'),
      hidratosConsumido: sumar(registrosDia, 'hidratos'),
      grasasConsumido: sumar(registrosDia, 'grasas'),
      kcalRestante: resumen.kcalObjetivo - kcalConsumido,
    }
  }, [resumen, registrosDia])

  // --- Acciones sobre el diario ---

  // origen: 'despensa' | 'catalogo' | 'manual' | 'restaurante' | 'receta'
  function registroAFila(registro, origen) {
    return {
      usuario_id: sesion.user.id,
      alimento_id: registro.alimentoId || null,
      codigo_barras: registro.codigoBarras || null,
      comida_id: registro.comidaId || null,
      nombre: registro.nombre,
      cantidad_g: registro.cantidadG,
      unidad_medida: registro.unidadMedida === 'ml' ? 'ml' : 'g',
      kcal: registro.kcal,
      proteinas: registro.proteinas ?? null,
      hidratos: registro.hidratos ?? null,
      grasas: registro.grasas ?? null,
      // Explícita y en hora local: si se deja al `default current_date` de la
      // tabla, el servidor pone SU fecha (UTC) y de madrugada cae en el día
      // anterior. Además es lo que permite registrar en un día pasado.
      fecha: registro.fecha || fecha,
      origen,
      ...nutrientesAFila(registro),
    }
  }

  // Uno o varios alimentos de una sentada (una comida como "arroz con pechuga y
  // huevo" son tres registros). Un solo INSERT y un solo recálculo del
  // resumen, en vez de uno por alimento. Cada registro trae su `origen`.
  async function agregarRegistros(nuevosRegistros) {
    if (nuevosRegistros.length === 0) return []

    const filas = nuevosRegistros.map((r) => registroAFila(r, r.origen || 'manual'))
    const { data, error: err } = await supabase
      .from('registros_diarios')
      .insert(filas)
      .select()

    if (err) throw err

    const nuevos = data.map(filaARegistro)
    setRegistros((prev) => [...prev, ...nuevos])
    await cargarResumen()
    return nuevos
  }

  async function eliminarRegistro(id) {
    const { error: err } = await supabase.from('registros_diarios').delete().eq('id', id)
    if (err) throw err
    setRegistros((prev) => prev.filter((r) => r.id !== id))
    await cargarResumen()
  }

  // Mueve un registro ya guardado a otra comida (o a "sin asignar").
  async function moverRegistro(id, comidaId) {
    const { error: err } = await supabase
      .from('registros_diarios')
      .update({ comida_id: comidaId })
      .eq('id', id)
    if (err) throw err
    setRegistros((prev) => prev.map((r) => (r.id === id ? { ...r, comidaId } : r)))
  }

  // --- Acciones sobre las comidas del día ---

  // La base de datos rechaza la octava comida (trigger trg_limite_comidas);
  // aquí cortamos antes para no gastar una ida y vuelta.
  async function anadirComida(nombre) {
    const limpio = (nombre || '').trim()
    if (!limpio) throw new Error('El nombre no puede estar vacío.')
    if (comidas.length >= 7) throw new Error('No puedes tener más de 7 comidas al día.')

    const orden = comidas.length ? Math.max(...comidas.map((c) => c.orden)) + 1 : 0
    const { data, error: err } = await supabase
      .from('comidas_usuario')
      .insert({ usuario_id: sesion.user.id, nombre: limpio, orden })
      .select()
      .single()

    if (err) throw err
    const nueva = filaAComida(data)
    setComidas((prev) => [...prev, nueva].sort((a, b) => a.orden - b.orden))
    return nueva
  }

  async function renombrarComida(id, nombre) {
    const limpio = (nombre || '').trim()
    if (!limpio) throw new Error('El nombre no puede estar vacío.')

    const { error: err } = await supabase
      .from('comidas_usuario')
      .update({ nombre: limpio })
      .eq('id', id)

    if (err) throw err
    setComidas((prev) => prev.map((c) => (c.id === id ? { ...c, nombre: limpio } : c)))
  }

  // Los registros de esa comida NO se borran: la FK es `on delete set null`,
  // así que pasan a "Sin asignar" y siguen contando en el total del día.
  async function eliminarComida(id) {
    const { error: err } = await supabase.from('comidas_usuario').delete().eq('id', id)
    if (err) throw err
    setComidas((prev) => prev.filter((c) => c.id !== id))
    setRegistros((prev) =>
      prev.map((r) => (r.comidaId === id ? { ...r, comidaId: null } : r))
    )
  }

  // Sube o baja una comida en el orden del día (delta: -1 o +1).
  async function moverComida(id, delta) {
    const ordenadas = [...comidas].sort((a, b) => a.orden - b.orden)
    const i = ordenadas.findIndex((c) => c.id === id)
    const j = i + delta
    if (i === -1 || j < 0 || j >= ordenadas.length) return

    // Intercambiamos las posiciones y reescribimos `orden` como 0..n-1,
    // para que no se acumulen huecos tras varios movimientos.
    const [movida] = ordenadas.splice(i, 1)
    ordenadas.splice(j, 0, movida)
    const conOrden = ordenadas.map((c, idx) => ({ ...c, orden: idx }))

    setComidas(conOrden)

    // UPDATE fila a fila y no `upsert`: en Postgres un INSERT .. ON CONFLICT
    // dispara los triggers BEFORE INSERT ANTES de detectar el conflicto, así
    // que con 7 comidas el upsert saltaría con "no puedes tener más de 7"
    // aunque en realidad solo estuviéramos reordenando.
    const resultados = await Promise.all(
      conOrden.map((c) =>
        supabase.from('comidas_usuario').update({ orden: c.orden }).eq('id', c.id)
      )
    )

    const fallo = resultados.find((r) => r.error)
    if (fallo) {
      console.error('Error reordenando las comidas:', fallo.error)
      setComidas(comidas) // deshacemos el cambio optimista
      throw fallo.error
    }
  }

  const value = {
    fecha,
    setFecha,
    semana,
    registrosDia,
    kcalPorDia,
    comidas,
    // `resumen` sigue siendo el de HOY: lo usan "¿Qué pido?" y las recetas
    // para saber cuántas kcal te quedan ahora mismo, no el día que estés
    // mirando en el diario.
    resumen,
    resumenDia,
    cargando,
    error,
    agregarRegistros,
    eliminarRegistro,
    moverRegistro,
    anadirComida,
    renombrarComida,
    eliminarComida,
    moverComida,
  }

  return <DiarioContext.Provider value={value}>{children}</DiarioContext.Provider>
}

// Atajo para usar el estado desde cualquier pantalla
export function useDiario() {
  const ctx = useContext(DiarioContext)
  if (!ctx) throw new Error('useDiario debe usarse dentro de DiarioProvider')
  return ctx
}
