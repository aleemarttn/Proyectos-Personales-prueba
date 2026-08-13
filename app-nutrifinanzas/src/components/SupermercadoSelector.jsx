import { useEffect, useState } from 'react'
import { Plus, Check, Loader2 } from 'lucide-react'
import { listarSupermercados, anadirSupermercado } from '../lib/supermercados.js'
import { SUPERMERCADOS as SUPERMERCADOS_BASE } from '../data/categorias.js'

// Selector de supermercado respaldado por la tabla comunitaria
// `supermercados`: además de elegir uno, deja añadir uno nuevo (que se
// guarda para todos los usuarios) si no está en la lista.
export default function SupermercadoSelector({ label = 'Supermercado', valor, onChange, className = '' }) {
  const [opciones, setOpciones] = useState(SUPERMERCADOS_BASE)
  const [anadiendo, setAnadiendo] = useState(false)
  const [nuevo, setNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let activo = true
    listarSupermercados()
      .then((lista) => {
        if (activo && lista.length > 0) setOpciones(lista)
      })
      .catch((e) => console.error('Error cargando supermercados:', e))
    return () => {
      activo = false
    }
  }, [])

  async function guardarNuevo() {
    const nombre = nuevo.trim()
    if (!nombre) return
    setGuardando(true)
    try {
      await anadirSupermercado(nombre)
      setOpciones((prev) => (prev.includes(nombre) ? prev : [...prev, nombre].sort()))
      onChange(nombre)
      setAnadiendo(false)
      setNuevo('')
    } catch (e) {
      console.error('Error añadiendo el supermercado:', e)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={`mb-2 ${className}`}>
      {label && <label className="block text-sm font-bold text-gray-600 mb-1.5 mt-2">{label}</label>}

      {!anadiendo ? (
        <div className="flex items-center gap-2">
          <select
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-white rounded-2xl px-4 py-3.5 text-gray-800 font-semibold shadow-card outline-none focus:ring-2 ring-brand-300 appearance-none"
          >
            {!opciones.includes(valor) && valor && <option value={valor}>{valor}</option>}
            {opciones.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAnadiendo(true)}
            className="w-11 h-11 rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0 active:scale-95 transition"
            aria-label="Añadir supermercado"
          >
            <Plus size={18} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guardarNuevo()}
            placeholder="Ej. Hiperdino"
            maxLength={60}
            className="flex-1 bg-white rounded-2xl px-4 py-3.5 text-gray-800 font-semibold shadow-card outline-none focus:ring-2 ring-brand-300 placeholder:text-gray-300 placeholder:font-normal"
          />
          <button
            type="button"
            onClick={guardarNuevo}
            disabled={!nuevo.trim() || guardando}
            className="w-11 h-11 rounded-2xl bg-brand-500 text-white flex items-center justify-center shrink-0 active:scale-95 transition disabled:opacity-50"
          >
            {guardando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          </button>
        </div>
      )}
    </div>
  )
}
