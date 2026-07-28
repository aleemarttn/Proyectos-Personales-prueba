import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ScanLine, Trash2, Flame, Loader2, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { colorCategoria } from '../data/categorias.js'
import { euros } from '../utils/formato.js'
import DetalleAlimento from '../components/DetalleAlimento.jsx'

// Pantalla principal: la despensa con todos los alimentos.
export default function Despensa() {
  const navigate = useNavigate()
  const { alimentos, cargando, error, eliminarAlimento } = useApp()
  const { perfil } = useAuth()

  // id del alimento cuya ficha está abierta (o null)
  const [detalleId, setDetalleId] = useState(null)
  const alimentoDetalle = alimentos.find((a) => a.id === detalleId) || null

  async function eliminar(id) {
    try {
      await eliminarAlimento(id)
    } catch (e) {
      console.error('Error eliminando el alimento:', e)
    }
  }

  return (
    <div className="bg-cream min-h-full animate-fade-in">
      {/* Cabecera */}
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+1.75rem)] pb-4">
        <p className="text-gray-400 font-semibold">Hola, {perfil?.nombre} 👋</p>
        <h1 className="text-2xl font-black text-gray-800">Tu despensa</h1>
      </div>

      {/* Botones de acción */}
      <div className="px-5 flex gap-3 mb-5">
        <button
          onClick={() => navigate('/anadir')}
          className="flex-1 bg-white text-brand-700 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-card active:scale-[0.98] transition"
        >
          <Plus size={20} /> Añadir
        </button>
        <button
          onClick={() => navigate('/escanear')}
          className="flex-1 bg-brand-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-soft active:scale-[0.98] transition"
        >
          <ScanLine size={20} /> Escanear
        </button>
      </div>

      {/* Resumen rápido */}
      <div className="px-5 mb-3 flex items-center justify-between">
        <span className="font-bold text-gray-700">
          {alimentos.length} {alimentos.length === 1 ? 'producto' : 'productos'}
        </span>
        <span className="text-sm font-semibold text-gray-400">
          Total: {euros(alimentos.reduce((s, a) => s + a.precio, 0))}
        </span>
      </div>

      {error && (
        <div className="px-5 mb-3">
          <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3">
            {error}
          </p>
        </div>
      )}

      {/* Lista de alimentos */}
      <div className="px-5 pb-6 space-y-3">
        {cargando && (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-brand-400" size={28} />
          </div>
        )}

        {!cargando && alimentos.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <p className="font-semibold">Tu despensa está vacía.</p>
            <p className="text-sm">Añade o escanea tu primer alimento.</p>
          </div>
        )}

        {alimentos.map((a) => (
          <div
            key={a.id}
            onClick={() => setDetalleId(a.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setDetalleId(a.id)}
            className="bg-white rounded-2xl p-4 shadow-card flex items-center gap-3 animate-slide-up cursor-pointer active:scale-[0.99] transition"
          >
            {/* Punto de color de la categoría */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: colorCategoria(a.categoria) + '22' }}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colorCategoria(a.categoria) }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-800 truncate">
                {a.nombre}
                {a.marca && <span className="text-gray-400 font-semibold"> · {a.marca}</span>}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold mt-0.5">
                <span>{a.cantidad}</span>
                <span>·</span>
                <span>{a.supermercado}</span>
                {!!a.kcal && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Flame size={12} /> {a.kcal} kcal
                    </span>
                  </>
                )}
              </div>
              {tieneMacros(a) && (
                <div className="flex items-center gap-1.5 mt-1">
                  {a.proteinas != null && <Macro label="P" valor={a.proteinas} color="#ef4444" />}
                  {a.hidratos != null && <Macro label="H" valor={a.hidratos} color="#f59e0b" />}
                  {a.grasas != null && <Macro label="G" valor={a.grasas} color="#eab308" />}
                  <span className="text-[10px] text-gray-300 font-semibold">/100g</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <div className="font-extrabold text-gray-800">
                  {euros(a.precio)}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    eliminar(a.id)
                  }}
                  className="text-gray-300 hover:text-red-500 active:scale-90 transition mt-1"
                  aria-label="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </div>
          </div>
        ))}
      </div>

      {alimentoDetalle && (
        <DetalleAlimento
          alimento={alimentoDetalle}
          onCerrar={() => setDetalleId(null)}
        />
      )}
    </div>
  )
}

// ¿El alimento tiene algún macro (proteínas/hidratos/grasas) registrado?
function tieneMacros(a) {
  return a.proteinas != null || a.hidratos != null || a.grasas != null
}

// Etiqueta compacta de un macro: P/H/G + gramos, con color de la categoría macro.
function Macro({ label, valor, color }) {
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
      style={{ backgroundColor: color + '1f', color }}
    >
      {label} {valor}g
    </span>
  )
}
