import { useState } from 'react'
import { Plus, Trash2, Check, X, Pencil, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { useDiario } from '../context/DiarioContext.jsx'
import { MAX_COMIDAS, SUGERENCIAS, traducirErrorComida } from '../lib/comidas.js'

// Editor de las comidas del día (máximo 7). Vive en Perfil.
// Todas las comidas son renombrables: la app arranca con Desayuno/Comida/
// Cena, pero quien entrena puede dejarlas en Pre-entreno, Post-entreno, etc.
export default function EditorComidas() {
  const { comidas, anadirComida, renombrarComida, eliminarComida, moverComida } = useDiario()

  const [editando, setEditando] = useState(null) // id de la comida en edición
  const [borrador, setBorrador] = useState('')
  const [anadiendo, setAnadiendo] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  const lleno = comidas.length >= MAX_COMIDAS
  // Sugerencias que el usuario todavía no tiene, para no ofrecer duplicados.
  const sugerenciasLibres = SUGERENCIAS.filter(
    (s) => !comidas.some((c) => c.nombre.toLowerCase() === s.toLowerCase())
  )

  function empezarEdicion(comida) {
    setEditando(comida.id)
    setBorrador(comida.nombre)
    setError('')
  }

  async function ejecutar(accion) {
    setOcupado(true)
    setError('')
    try {
      await accion()
      return true
    } catch (e) {
      console.error('Error editando las comidas:', e)
      setError(traducirErrorComida(e))
      return false
    } finally {
      setOcupado(false)
    }
  }

  async function guardarNombre(id) {
    if (!borrador.trim()) return
    const ok = await ejecutar(() => renombrarComida(id, borrador))
    if (ok) setEditando(null)
  }

  async function crear(nombre) {
    const ok = await ejecutar(() => anadirComida(nombre))
    if (ok) {
      setNombreNuevo('')
      setAnadiendo(false)
    }
  }

  async function borrar(comida) {
    const ok = window.confirm(
      `¿Eliminar "${comida.nombre}"? Lo que ya hayas registrado ahí seguirá contando en el total del día, pero pasará a "Sin asignar".`
    )
    if (ok) await ejecutar(() => eliminarComida(comida.id))
  }

  return (
    <div className="px-5 mb-4">
      <h2 className="font-extrabold text-gray-700 mb-1">Mis comidas del día</h2>
      <p className="text-sm text-gray-400 font-semibold mb-3">
        Hasta {MAX_COMIDAS}. Puedes renombrarlas y ordenarlas como quieras.
      </p>

      <div className="bg-white rounded-3xl p-3 shadow-card">
        {comidas.map((comida, i) => (
          <div
            key={comida.id}
            className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0"
          >
            {/* Orden */}
            <div className="flex flex-col shrink-0">
              <button
                onClick={() => moverComida(comida.id, -1)}
                disabled={i === 0 || ocupado}
                className="text-gray-300 disabled:opacity-25 active:scale-90 transition"
                aria-label={`Subir ${comida.nombre}`}
              >
                <ChevronUp size={16} />
              </button>
              <button
                onClick={() => moverComida(comida.id, 1)}
                disabled={i === comidas.length - 1 || ocupado}
                className="text-gray-300 disabled:opacity-25 active:scale-90 transition"
                aria-label={`Bajar ${comida.nombre}`}
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {editando === comida.id ? (
              <>
                <input
                  autoFocus
                  value={borrador}
                  maxLength={30}
                  onChange={(e) => setBorrador(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') guardarNombre(comida.id)
                    if (e.key === 'Escape') setEditando(null)
                  }}
                  className="flex-1 min-w-0 bg-gray-50 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none focus:ring-2 ring-brand-300"
                />
                <button
                  onClick={() => guardarNombre(comida.id)}
                  disabled={ocupado}
                  className="text-brand-500 active:scale-90 transition shrink-0"
                  aria-label="Guardar nombre"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => setEditando(null)}
                  className="text-gray-300 active:scale-90 transition shrink-0"
                  aria-label="Cancelar"
                >
                  <X size={18} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 min-w-0 font-bold text-gray-800 truncate">
                  {comida.nombre}
                </span>
                <button
                  onClick={() => empezarEdicion(comida)}
                  className="text-gray-300 hover:text-brand-500 active:scale-90 transition shrink-0"
                  aria-label={`Renombrar ${comida.nombre}`}
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => borrar(comida)}
                  disabled={ocupado || comidas.length === 1}
                  className="text-gray-300 hover:text-red-500 disabled:opacity-25 active:scale-90 transition shrink-0"
                  aria-label={`Eliminar ${comida.nombre}`}
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        ))}

        {/* Alta de comida nueva */}
        {anadiendo && !lleno && (
          <div className="pt-3 mt-1 border-t border-gray-50">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nombreNuevo}
                maxLength={30}
                placeholder="Nombre de la comida"
                onChange={(e) => setNombreNuevo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nombreNuevo.trim()) crear(nombreNuevo)
                  if (e.key === 'Escape') setAnadiendo(false)
                }}
                className="flex-1 min-w-0 bg-gray-50 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none focus:ring-2 ring-brand-300 placeholder:text-gray-300 placeholder:font-normal"
              />
              <button
                onClick={() => crear(nombreNuevo)}
                disabled={!nombreNuevo.trim() || ocupado}
                className="text-brand-500 disabled:opacity-25 active:scale-90 transition shrink-0"
                aria-label="Añadir comida"
              >
                {ocupado ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              </button>
              <button
                onClick={() => setAnadiendo(false)}
                className="text-gray-300 active:scale-90 transition shrink-0"
                aria-label="Cancelar"
              >
                <X size={18} />
              </button>
            </div>

            {sugerenciasLibres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {sugerenciasLibres.map((s) => (
                  <button
                    key={s}
                    onClick={() => crear(s)}
                    disabled={ocupado}
                    className="bg-gray-50 text-gray-500 text-xs font-bold px-2.5 py-1.5 rounded-lg active:scale-95 transition disabled:opacity-40"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!anadiendo && (
          <button
            onClick={() => {
              setAnadiendo(true)
              setError('')
            }}
            disabled={lleno}
            className="w-full mt-2 flex items-center justify-center gap-1.5 text-brand-600 font-bold text-sm py-2.5 rounded-xl bg-brand-50 active:scale-[0.98] transition disabled:opacity-40 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <Plus size={16} />
            {lleno ? `Máximo de ${MAX_COMIDAS} comidas` : 'Añadir comida'}
          </button>
        )}

        {error && (
          <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 mt-2">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
