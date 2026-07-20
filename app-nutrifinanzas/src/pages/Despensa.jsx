import { useNavigate } from 'react-router-dom'
import { Plus, ScanLine, Trash2, Flame } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { colorCategoria } from '../data/categorias.js'
import { euros } from '../utils/formato.js'

// Pantalla principal: la despensa con todos los alimentos.
export default function Despensa() {
  const navigate = useNavigate()
  const { alimentos, eliminarAlimento } = useApp()
  const { perfil } = useAuth()

  const esControlTotal = perfil?.tipo === 'total'

  return (
    <div className="bg-cream min-h-full animate-fade-in">
      {/* Cabecera */}
      <div className="px-5 pt-7 pb-4">
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

      {/* Lista de alimentos */}
      <div className="px-5 pb-6 space-y-3">
        {alimentos.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <p className="font-semibold">Tu despensa está vacía.</p>
            <p className="text-sm">Añade o escanea tu primer alimento.</p>
          </div>
        )}

        {alimentos.map((a) => (
          <div
            key={a.id}
            className="bg-white rounded-2xl p-4 shadow-card flex items-center gap-3 animate-slide-up"
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
              <h3 className="font-bold text-gray-800 truncate">{a.nombre}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold mt-0.5">
                <span>{a.cantidad}</span>
                <span>·</span>
                <span>{a.supermercado}</span>
                {esControlTotal && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Flame size={12} /> {a.kcal} kcal
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="font-extrabold text-gray-800">
                {euros(a.precio)}
              </div>
              <button
                onClick={() => eliminarAlimento(a.id)}
                className="text-gray-300 hover:text-red-500 active:scale-90 transition mt-1"
                aria-label="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
