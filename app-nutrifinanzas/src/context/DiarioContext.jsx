import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from './AuthContext.jsx'

// Este contexto guarda el DIARIO de consumo (tabla `registros_diarios`,
// lo que te has comido hoy), las COMIDAS del día del usuario (tabla
// `comidas_usuario`: editables, máximo 7) y el resumen objetivo/consumido/
// restante (vista `resumen_diario`). Cada usuario solo ve lo suyo (RLS).

const DiarioContext = createContext(null)

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

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
  }
}

function filaAComida(fila) {
  return { id: fila.id, nombre: fila.nombre, orden: fila.orden }
}

// Convierte la fila de la vista `resumen_diario` (no existe en modo simple:
// la vista filtra por tipo_perfil = 'total', ver migración 005).
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

export function DiarioProvider({ children }) {
  const { sesion } = useAuth()
  const [registrosHoy, setRegistrosHoy] = useState([])
  const [comidas, setComidas] = useState([])
  const [resumen, setResumen] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

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

  useEffect(() => {
    if (!sesion) {
      setRegistrosHoy([])
      setComidas([])
      setResumen(null)
      return
    }

    let activo = true
    setCargando(true)
    setError('')

    Promise.all([
      supabase
        .from('registros_diarios')
        .select('*')
        .eq('fecha', hoyISO())
        .order('created_at', { ascending: true }),
      supabase.from('resumen_diario').select('*').maybeSingle(),
      supabase
        .from('comidas_usuario')
        .select('*')
        .order('orden', { ascending: true }),
    ]).then(([registros, resumenFila, comidasFilas]) => {
      if (!activo) return
      if (registros.error) {
        console.error('Error cargando el diario de hoy:', registros.error)
        setError('No se pudo cargar tu diario de hoy.')
      } else {
        setRegistrosHoy(registros.data.map(filaARegistro))
      }
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
      setCargando(false)
    })

    return () => {
      activo = false
    }
  }, [sesion])

  // --- Acciones sobre el diario ---

  // origen: 'despensa' | 'catalogo' | 'manual'
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
      origen,
    }
  }

  // Uno o varios alimentos de una sentada (una comida como "arroz con pechuga y
  // huevo" son tres registros). Un solo INSERT y un solo recálculo del
  // resumen, en vez de uno por alimento. Cada registro trae su `origen`.
  async function agregarRegistros(registros) {
    if (registros.length === 0) return []

    const filas = registros.map((r) => registroAFila(r, r.origen || 'manual'))
    const { data, error: err } = await supabase
      .from('registros_diarios')
      .insert(filas)
      .select()

    if (err) throw err

    const nuevos = data.map(filaARegistro)
    setRegistrosHoy((prev) => [...prev, ...nuevos])
    await cargarResumen()
    return nuevos
  }

  async function eliminarRegistro(id) {
    const { error: err } = await supabase.from('registros_diarios').delete().eq('id', id)
    if (err) throw err
    setRegistrosHoy((prev) => prev.filter((r) => r.id !== id))
    await cargarResumen()
  }

  // Mueve un registro ya guardado a otra comida (o a "sin asignar").
  async function moverRegistro(id, comidaId) {
    const { error: err } = await supabase
      .from('registros_diarios')
      .update({ comida_id: comidaId })
      .eq('id', id)
    if (err) throw err
    setRegistrosHoy((prev) => prev.map((r) => (r.id === id ? { ...r, comidaId } : r)))
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
    setRegistrosHoy((prev) =>
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
    registrosHoy,
    comidas,
    resumen,
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
