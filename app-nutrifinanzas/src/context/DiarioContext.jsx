import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from './AuthContext.jsx'

// Este contexto guarda el DIARIO de consumo (tabla `registros_diarios`,
// lo que te has comido hoy) y el resumen objetivo/consumido/restante
// (vista `resumen_diario`). Cada usuario solo ve lo suyo (RLS).

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
    kcal: Number(fila.kcal),
    proteinas: fila.proteinas === null ? null : Number(fila.proteinas),
    hidratos: fila.hidratos === null ? null : Number(fila.hidratos),
    grasas: fila.grasas === null ? null : Number(fila.grasas),
    origen: fila.origen,
    alimentoId: fila.alimento_id,
    codigoBarras: fila.codigo_barras,
    fecha: fila.fecha,
    creadoEn: fila.created_at,
  }
}

// Convierte la fila de la vista `resumen_diario` (puede no existir si el
// perfil es "modo sencillo", sin objetivos de macros).
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
        .order('created_at', { ascending: false }),
      supabase.from('resumen_diario').select('*').maybeSingle(),
    ]).then(([registros, resumenFila]) => {
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
      setCargando(false)
    })

    return () => {
      activo = false
    }
  }, [sesion])

  // --- Acciones sobre el diario ---

  // origen: 'despensa' | 'catalogo' | 'manual'
  async function agregarRegistro(registro, origen = 'manual') {
    const fila = {
      usuario_id: sesion.user.id,
      alimento_id: registro.alimentoId || null,
      codigo_barras: registro.codigoBarras || null,
      nombre: registro.nombre,
      cantidad_g: registro.cantidadG,
      kcal: registro.kcal,
      proteinas: registro.proteinas ?? null,
      hidratos: registro.hidratos ?? null,
      grasas: registro.grasas ?? null,
      origen,
    }

    const { data, error: err } = await supabase
      .from('registros_diarios')
      .insert(fila)
      .select()
      .single()

    if (err) throw err

    const nuevo = filaARegistro(data)
    setRegistrosHoy((prev) => [nuevo, ...prev])
    await cargarResumen()
    return nuevo
  }

  async function eliminarRegistro(id) {
    const { error: err } = await supabase.from('registros_diarios').delete().eq('id', id)
    if (err) throw err
    setRegistrosHoy((prev) => prev.filter((r) => r.id !== id))
    await cargarResumen()
  }

  const value = {
    registrosHoy,
    resumen,
    cargando,
    error,
    agregarRegistro,
    eliminarRegistro,
  }

  return <DiarioContext.Provider value={value}>{children}</DiarioContext.Provider>
}

// Atajo para usar el estado desde cualquier pantalla
export function useDiario() {
  const ctx = useContext(DiarioContext)
  if (!ctx) throw new Error('useDiario debe usarse dentro de DiarioProvider')
  return ctx
}
