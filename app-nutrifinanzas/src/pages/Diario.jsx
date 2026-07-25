import { Plus, Trash2, Flame, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDiario } from '../context/DiarioContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { horaCorta } from '../utils/formato.js'

// Pantalla principal del diario: objetivo vs. consumido hoy + lista de
// comidas registradas. La conversión a gramos y el consumido/restante
// vienen ya calculados de la vista `resumen_diario` (DiarioContext).
export default function Diario() {
  const navigate = useNavigate()
  const { registrosHoy, resumen, cargando, error, eliminarRegistro } = useDiario()
  const { perfil } = useAuth()

  const esControlTotal = perfil?.tipo === 'total'
  const kcalHoy = registrosHoy.reduce((s, r) => s + r.kcal, 0)

  async function eliminar(id) {
    try {
      await eliminarRegistro(id)
    } catch (e) {
      console.error('Error eliminando el registro:', e)
    }
  }

  return (
    <div className="bg-cream min-h-full animate-fade-in">
      {/* Cabecera */}
      <div className="px-5 pt-7 pb-4">
        <p className="text-gray-400 font-semibold">Hoy</p>
        <h1 className="text-2xl font-black text-gray-800">Tu diario</h1>
      </div>

      <div className="px-5 mb-5">
        <button
          onClick={() => navigate('/diario/registrar')}
          className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-soft active:scale-[0.98] transition"
        >
          <Plus size={20} /> Registrar comida
        </button>
      </div>

      {/* Objetivo vs. consumido */}
      <div className="px-5 mb-5">
        {esControlTotal && resumen ? (
          <div className="bg-white rounded-3xl p-4 shadow-card">
            <div className="flex items-center justify-center gap-2 bg-brand-50 text-brand-700 font-extrabold rounded-2xl py-3 mb-4">
              <Flame size={20} />
              {Math.max(0, Math.round(resumen.kcalRestanteHoy))} kcal restantes hoy
            </div>
            <p className="text-center text-sm text-gray-400 font-semibold -mt-2 mb-4">
              {Math.round(resumen.kcalConsumidoHoy)} de {resumen.kcalObjetivo} kcal
            </p>
            <div className="space-y-3">
              <Barra
                label="Proteínas"
                consumido={resumen.proteinasConsumidoHoy}
                objetivo={resumen.proteinasGObjetivo}
                color="#ef4444"
              />
              <Barra
                label="Hidratos"
                consumido={resumen.hidratosConsumidoHoy}
                objetivo={resumen.hidratosGObjetivo}
                color="#f59e0b"
              />
              <Barra
                label="Grasas"
                consumido={resumen.grasasConsumidoHoy}
                objetivo={resumen.grasasGObjetivo}
                color="#eab308"
              />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-4 shadow-card">
            <div className="flex items-center justify-center gap-2 bg-brand-50 text-brand-700 font-extrabold rounded-2xl py-3">
              <Flame size={20} /> {Math.round(kcalHoy)} kcal registradas hoy
            </div>
            {!esControlTotal && (
              <p className="text-center text-xs text-amber-600 font-semibold mt-3">
                Estás en modo sencillo, sin objetivos de macros que comparar.
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="px-5 mb-3">
          <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3">
            {error}
          </p>
        </div>
      )}

      {/* Lista de comidas registradas hoy */}
      <div className="px-5 pb-6 space-y-3">
        {cargando && (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-brand-400" size={28} />
          </div>
        )}

        {!cargando && registrosHoy.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <p className="font-semibold">Aún no has registrado nada hoy.</p>
            <p className="text-sm">Registra tu primera comida del día.</p>
          </div>
        )}

        {registrosHoy.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded-2xl p-4 shadow-card flex items-center gap-3 animate-slide-up"
          >
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-800 truncate">{r.nombre}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold mt-0.5">
                <span>{r.cantidadG} g</span>
                <span>·</span>
                <span>{horaCorta(r.creadoEn)}</span>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <Flame size={12} /> {Math.round(r.kcal)} kcal
                </span>
              </div>
            </div>

            <button
              onClick={() => eliminar(r.id)}
              className="text-gray-300 hover:text-red-500 active:scale-90 transition"
              aria-label="Eliminar"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Barra de progreso consumido/objetivo para un macro (en gramos).
function Barra({ label, consumido, objetivo, color }) {
  const pct = objetivo > 0 ? Math.min(100, Math.round((consumido / objetivo) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-semibold text-gray-600">{label}</span>
        <span className="font-bold text-gray-800">
          {Math.round(consumido)} / {Math.round(objetivo)} g
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
