import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from './AuthContext.jsx'

// Este contexto guarda los ALIMENTOS de la despensa, ahora contra la tabla
// `alimentos` de Supabase (antes vivían en localStorage). Cada usuario solo
// ve los suyos (protegido por RLS con auth.uid() = usuario_id).

const AppContext = createContext(null)

// Convierte una fila de la tabla `alimentos` al formato que usan las
// pantallas (camelCase, precio numérico -> Supabase devuelve numeric como string).
function filaAAlimento(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    marca: fila.marca,
    cantidad: fila.cantidad,
    kcal: fila.kcal,
    // Macros por 100 g/ml (numeric -> Supabase los devuelve como string o null)
    proteinas: fila.proteinas === null ? null : Number(fila.proteinas),
    hidratos: fila.hidratos === null ? null : Number(fila.hidratos),
    grasas: fila.grasas === null ? null : Number(fila.grasas),
    precio: Number(fila.precio),
    supermercado: fila.supermercado,
    categoria: fila.categoria,
    fecha: fila.fecha,
    origen: fila.origen,
    codigoBarras: fila.codigo_barras,
  }
}

export function AppProvider({ children }) {
  const { sesion } = useAuth()
  const [alimentos, setAlimentos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  // Carga los alimentos del usuario cuando hay sesión; los vacía al cerrarla.
  useEffect(() => {
    if (!sesion) {
      setAlimentos([])
      return
    }

    let activo = true
    setCargando(true)
    setError('')

    supabase
      .from('alimentos')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!activo) return
        if (err) {
          console.error('Error cargando alimentos:', err)
          setError('No se pudo cargar tu despensa.')
        } else {
          setAlimentos(data.map(filaAAlimento))
        }
        setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [sesion])

  // --- Acciones sobre los alimentos ---

  // origen: 'manual' | 'escaner'
  async function agregarAlimento(alimento, origen = 'manual') {
    const fila = {
      usuario_id: sesion.user.id,
      nombre: alimento.nombre,
      marca: alimento.marca || null,
      cantidad: alimento.cantidad,
      kcal: alimento.kcal,
      proteinas: alimento.proteinas ?? null,
      hidratos: alimento.hidratos ?? null,
      grasas: alimento.grasas ?? null,
      precio: alimento.precio,
      supermercado: alimento.supermercado,
      categoria: alimento.categoria,
      origen,
      codigo_barras: alimento.codigoBarras || null,
    }

    const { data, error: err } = await supabase
      .from('alimentos')
      .insert(fila)
      .select()
      .single()

    if (err) throw err

    const nuevo = filaAAlimento(data)
    setAlimentos((prev) => [nuevo, ...prev])
    return nuevo
  }

  // Actualiza campos de un alimento existente (p.ej. los macros).
  // `cambios` usa las claves de las pantallas (kcal, proteinas, hidratos, grasas…).
  async function actualizarAlimento(id, cambios) {
    // Solo mandamos a la BD las columnas que de verdad vienen en `cambios`
    const columnas = ['kcal', 'proteinas', 'hidratos', 'grasas', 'nombre', 'marca', 'cantidad', 'precio', 'supermercado', 'categoria']
    const fila = {}
    for (const c of columnas) {
      if (c in cambios) fila[c] = cambios[c]
    }

    const { data, error: err } = await supabase
      .from('alimentos')
      .update(fila)
      .eq('id', id)
      .select()
      .single()

    if (err) throw err

    const actualizado = filaAAlimento(data)
    setAlimentos((prev) => prev.map((a) => (a.id === id ? actualizado : a)))
    return actualizado
  }

  async function eliminarAlimento(id) {
    const { error: err } = await supabase.from('alimentos').delete().eq('id', id)
    if (err) throw err
    setAlimentos((prev) => prev.filter((a) => a.id !== id))
  }

  const value = {
    alimentos,
    cargando,
    error,
    agregarAlimento,
    actualizarAlimento,
    eliminarAlimento,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// Atajo para usar el estado desde cualquier pantalla
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider')
  return ctx
}
