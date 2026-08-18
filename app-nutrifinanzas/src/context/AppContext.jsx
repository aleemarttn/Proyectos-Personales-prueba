import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from './AuthContext.jsx'
import {
  COLUMNAS_NUTRIENTES,
  nutrientesAFila,
  nutrientesDeFila,
} from '../lib/nutrientes.js'

// Este contexto guarda los ALIMENTOS de la despensa, ahora contra la tabla
// `alimentos` de Supabase (antes vivían en localStorage).
//
// Qué se ve: los alimentos propios, más los del hogar si el usuario está en
// uno (migración 015). No hace falta filtrar aquí, lo hace RLS en la base de
// datos; este contexto solo se ocupa de recargar cuando el hogar cambia y de
// marcar los alimentos nuevos como del hogar.

const AppContext = createContext(null)

// Convierte una fila de la tabla `alimentos` al formato que usan las
// pantallas (camelCase, precio numérico -> Supabase devuelve numeric como string).
// Exportada para que lib/gastos.js reuse el mismo mapeo en vez de duplicarlo.
export function filaAAlimento(fila) {
  return {
    id: fila.id,
    // Quién lo compró. Con despensa compartida ya no es siempre "yo", y es
    // lo que permite decir de quién es cada gasto.
    usuarioId: fila.usuario_id,
    // Hogar al que pertenece, o null si es privado (migración 015)
    hogarId: fila.hogar_id ?? null,
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
    pesoUnidadG: fila.peso_unidad_g === null ? null : Number(fila.peso_unidad_g),
    unidadNombre: fila.unidad_nombre,
    // 'g' o 'ml' (migración 008); los alimentos anteriores son gramos
    unidadMedida: fila.unidad_medida || 'g',
    // Saturadas, azúcares, sal y fibra (migración 014). A null en todo lo
    // que se dio de alta antes: sin ellos no hay avisos, pero nada rompe.
    ...nutrientesDeFila(fila),
  }
}

// Lectura de la despensa. Está fuera del componente para poder usarla tanto
// en la carga inicial como al recargar, sin liarse con las dependencias del
// efecto.
async function leerAlimentos() {
  const { data, error } = await supabase
    .from('alimentos')
    .select('*')
    // Solo lo que sigue activo: lo que ya se consumió/tiró (eliminado_en no
    // nulo) no debe aparecer en la despensa, aunque el registro se conserve
    // para el historial de gasto (ver lib/gastos.js y migración 024).
    .is('eliminado_en', null)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data.map(filaAAlimento)
}

export function AppProvider({ children }) {
  const { sesion, hogar } = useAuth()
  const [alimentos, setAlimentos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const hogarId = hogar?.id ?? null

  // Carga los alimentos cuando hay sesión; los vacía al cerrarla. Se repite
  // al entrar o salir de un hogar, porque lo que se puede ver cambia.
  useEffect(() => {
    if (!sesion) {
      setAlimentos([])
      return
    }

    let activo = true
    setCargando(true)
    setError('')

    leerAlimentos()
      .then((lista) => {
        if (!activo) return
        setAlimentos(lista)
      })
      .catch((err) => {
        if (!activo) return
        console.error('Error cargando alimentos:', err)
        setError('No se pudo cargar tu despensa.')
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [sesion, hogarId])

  // Volver a leer la despensa. En una despensa compartida hace falta: si tu
  // pareja añade algo desde su móvil, aquí no se entera nadie hasta que se
  // pregunta otra vez.
  //
  // Va en useCallback para que la referencia no cambie en cada render: las
  // pantallas la usan como dependencia de un efecto, y sin esto recargarían
  // en bucle.
  const recargar = useCallback(async () => {
    if (!sesion) return
    try {
      setAlimentos(await leerAlimentos())
      setError('')
    } catch (e) {
      console.error('Error recargando alimentos:', e)
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
      peso_unidad_g: alimento.pesoUnidadG ?? null,
      unidad_nombre: alimento.unidadNombre || null,
      unidad_medida: alimento.unidadMedida === 'ml' ? 'ml' : 'g',
      ...nutrientesAFila(alimento),
      // Si estás en un hogar, lo que compres va a la despensa común. Si no,
      // la clave ni se manda: así la app sigue funcionando aunque la
      // migración 015 no esté aplicada y la columna no exista.
      ...(hogarId ? { hogar_id: hogarId } : {}),
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
    const columnas = ['kcal', 'proteinas', 'hidratos', 'grasas', 'nombre', 'marca', 'cantidad', 'precio', 'supermercado', 'categoria', 'peso_unidad_g', 'unidad_nombre', 'unidad_medida', ...COLUMNAS_NUTRIENTES]
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

  // Pasa a la despensa común los alimentos que ya tenías antes de entrar en
  // el hogar. Al unirte no se comparte nada por sorpresa: esto es un botón
  // que hay que pulsar. Devuelve cuántos se han compartido.
  async function compartirMiDespensa() {
    if (!hogarId) throw new Error('No estás en ningún hogar')

    const { data, error: err } = await supabase
      .from('alimentos')
      .update({ hogar_id: hogarId })
      .eq('usuario_id', sesion.user.id)
      .is('hogar_id', null)
      .is('eliminado_en', null)
      .select()

    if (err) throw err

    const actualizados = (data || []).map(filaAAlimento)
    const porId = new Map(actualizados.map((a) => [a.id, a]))
    setAlimentos((prev) => prev.map((a) => porId.get(a.id) || a))
    return actualizados.length
  }

  // Borrado lógico, no DELETE: el precio de lo que se come o se tira debe
  // seguir contando en el historial de gasto por mes (lib/gastos.js). La
  // despensa en vivo no lo vuelve a ver porque leerAlimentos() ya filtra
  // eliminado_en is null; desde la UI se sigue viendo como un borrado normal.
  async function eliminarAlimento(id) {
    const { error: err } = await supabase
      .from('alimentos')
      .update({ eliminado_en: new Date().toISOString() })
      .eq('id', id)
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
    compartirMiDespensa,
    recargar,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// Atajo para usar el estado desde cualquier pantalla
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider')
  return ctx
}
