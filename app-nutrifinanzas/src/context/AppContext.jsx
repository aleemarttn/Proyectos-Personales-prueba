import { createContext, useContext, useEffect, useState } from 'react'
import { ALIMENTOS_INICIALES } from '../data/alimentos.js'

// Este contexto guarda los ALIMENTOS de la despensa y los sincroniza con
// localStorage. (El perfil y la sesión viven ahora en AuthContext.)
// NOTA: en el Bloque 3 los alimentos migrarán a Supabase; de momento siguen
// en localStorage para no romper la despensa.

const AppContext = createContext(null)

const KEY_ALIMENTOS = 'nutrigasto_alimentos'

// Lee un valor de localStorage de forma segura
function leer(clave, porDefecto) {
  try {
    const raw = localStorage.getItem(clave)
    return raw ? JSON.parse(raw) : porDefecto
  } catch {
    return porDefecto
  }
}

export function AppProvider({ children }) {
  // Alimentos: si es la primera vez, cargamos los de ejemplo
  const [alimentos, setAlimentos] = useState(() =>
    leer(KEY_ALIMENTOS, ALIMENTOS_INICIALES)
  )

  // Cada vez que cambian, los guardamos en localStorage
  useEffect(() => {
    localStorage.setItem(KEY_ALIMENTOS, JSON.stringify(alimentos))
  }, [alimentos])

  // --- Acciones sobre los alimentos ---
  function agregarAlimento(alimento) {
    const nuevo = {
      ...alimento,
      id: 'a' + Date.now(),
      fecha: new Date().toISOString().slice(0, 10),
    }
    setAlimentos((prev) => [nuevo, ...prev])
  }

  function eliminarAlimento(id) {
    setAlimentos((prev) => prev.filter((a) => a.id !== id))
  }

  const value = {
    alimentos,
    agregarAlimento,
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
