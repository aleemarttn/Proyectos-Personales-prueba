import { useState } from 'react'
import {
  Plus,
  Trash2,
  Flame,
  Loader2,
  ChevronDown,
  ChevronRight,
  Settings2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDiario } from '../context/DiarioContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { horaCorta } from '../utils/formato.js'

// Pantalla principal del diario: objetivo diario vs. consumido hoy, y las
// comidas del día (editables en Perfil, máximo 7) con lo registrado en
// cada una. El objetivo es GLOBAL del día, no por comida: cada sección
// solo suma lo suyo.
export default function Diario() {
  const navigate = useNavigate()
  const { registrosHoy, comidas, resumen, cargando, error, eliminarRegistro } = useDiario()
  const { perfil } = useAuth()

  // Comidas plegadas (por id). Por defecto todas abiertas.
  const [plegadas, setPlegadas] = useState({})

  const esControlTotal = perfil?.tipo === 'total'
  const kcalHoy = registrosHoy.reduce((s, r) => s + r.kcal, 0)

  function alternar(id) {
    setPlegadas((p) => ({ ...p, [id]: !p[id] }))
  }

  async function eliminar(id) {
    try {
      await eliminarRegistro(id)
    } catch (e) {
      console.error('Error eliminando el registro:', e)
    }
  }

  // Registros cuya comida se borró después de registrarlos: siguen contando
  // en el total del día, así que hay que poder verlos y recolocarlos.
  const sinAsignar = registrosHoy.filter(
    (r) => !r.comidaId || !comidas.some((c) => c.id === r.comidaId)
  )

  return (
    <div className="bg-cream min-h-full animate-fade-in">
      {/* Cabecera */}
      <div className="px-5 pt-7 pb-4">
        <p className="text-gray-400 font-semibold">Hoy</p>
        <h1 className="text-2xl font-black text-gray-800">Tu diario</h1>
      </div>

      {/* Objetivo del día */}
      <div className="px-5 mb-5">
        {esControlTotal && resumen ? (
          <ResumenDia resumen={resumen} />
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

      {cargando && (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-brand-400" size={28} />
        </div>
      )}

      {/* Comidas del día */}
      {!cargando && (
        <div className="px-5 pb-6 space-y-3">
          {/* Sin comidas configuradas no habría ningún sitio donde registrar,
              así que dejamos siempre una vía directa. */}
          {comidas.length === 0 && (
            <>
              <p className="bg-amber-50 text-amber-700 text-sm font-semibold rounded-xl px-4 py-3">
                Todavía no tienes comidas configuradas. Créalas desde tu perfil
                para repartir el día.
              </p>
              <button
                onClick={() => navigate('/diario/registrar')}
                className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-soft active:scale-[0.98] transition"
              >
                <Plus size={20} /> Registrar comida
              </button>
            </>
          )}

          {comidas.map((comida) => (
            <SeccionComida
              key={comida.id}
              comida={comida}
              registros={registrosHoy.filter((r) => r.comidaId === comida.id)}
              plegada={!!plegadas[comida.id]}
              onAlternar={() => alternar(comida.id)}
              onAnadir={() => navigate(`/diario/registrar?comida=${comida.id}`)}
              onEliminar={eliminar}
            />
          ))}

          {sinAsignar.length > 0 && (
            <SeccionComida
              comida={{ id: 'sin-asignar', nombre: 'Sin asignar' }}
              registros={sinAsignar}
              plegada={!!plegadas['sin-asignar']}
              onAlternar={() => alternar('sin-asignar')}
              onEliminar={eliminar}
            />
          )}

          <button
            onClick={() => navigate('/perfil')}
            className="w-full flex items-center justify-center gap-2 text-gray-400 font-bold text-sm py-3 active:scale-[0.98] transition"
          >
            <Settings2 size={16} /> Editar mis comidas
          </button>
        </div>
      )}
    </div>
  )
}

// Cabecera con el objetivo diario global: consumido/objetivo, barra de
// progreso y macros.
function ResumenDia({ resumen }) {
  const restante = Math.round(resumen.kcalRestanteHoy)
  const pasado = restante < 0
  const pct =
    resumen.kcalObjetivo > 0
      ? Math.min(100, Math.round((resumen.kcalConsumidoHoy / resumen.kcalObjetivo) * 100))
      : 0

  return (
    <div className="bg-white rounded-3xl p-4 shadow-card">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-extrabold text-gray-800 text-lg">
          {Math.round(resumen.kcalConsumidoHoy)}
          <span className="text-gray-300 font-bold"> / {resumen.kcalObjetivo} kcal</span>
        </span>
        <span className="text-sm font-bold text-gray-400">{pct}%</span>
      </div>

      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${pasado ? 'bg-red-400' : 'bg-brand-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div
        className={`flex items-center justify-center gap-2 font-extrabold rounded-2xl py-3 mb-4 ${
          pasado ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'
        }`}
      >
        <Flame size={20} />
        {pasado
          ? `Te has pasado ${Math.abs(restante)} kcal`
          : `Te quedan ${restante} kcal hoy`}
      </div>

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
  )
}

// Una comida del día: cabecera plegable con su suma de kcal, sus registros
// y el botón para añadir directamente a esa comida.
function SeccionComida({ comida, registros, plegada, onAlternar, onAnadir, onEliminar }) {
  const kcal = registros.reduce((s, r) => s + r.kcal, 0)

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden animate-slide-up">
      <button
        onClick={onAlternar}
        className="w-full px-4 py-3.5 flex items-center gap-2 text-left active:bg-gray-50 transition"
      >
        {plegada ? (
          <ChevronRight size={18} className="text-gray-300 shrink-0" />
        ) : (
          <ChevronDown size={18} className="text-gray-300 shrink-0" />
        )}
        <span className="font-black text-gray-800 uppercase text-sm tracking-wide flex-1 truncate">
          {comida.nombre}
        </span>
        <span className="font-bold text-gray-400 text-sm shrink-0">
          {Math.round(kcal)} kcal
        </span>
      </button>

      {!plegada && (
        <div className="px-4 pb-3">
          {registros.length === 0 && (
            <p className="text-gray-300 text-sm font-semibold py-2">Nada registrado aún.</p>
          )}

          {registros.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 py-2.5 border-t border-gray-50 first:border-t-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 truncate text-[15px]">{r.nombre}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold mt-0.5">
                  {r.cantidadG > 0 && (
                    <>
                      <span>{Math.round(r.cantidadG)} g</span>
                      <span>·</span>
                    </>
                  )}
                  <span>{horaCorta(r.creadoEn)}</span>
                </div>
              </div>

              <span className="font-bold text-gray-600 text-sm shrink-0">
                {Math.round(r.kcal)} kcal
              </span>

              <button
                onClick={() => onEliminar(r.id)}
                className="text-gray-300 hover:text-red-500 active:scale-90 transition shrink-0"
                aria-label={`Eliminar ${r.nombre}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {onAnadir && (
            <button
              onClick={onAnadir}
              className="w-full mt-2 flex items-center justify-center gap-1.5 text-brand-600 font-bold text-sm py-2.5 rounded-xl bg-brand-50 active:scale-[0.98] transition"
            >
              <Plus size={16} /> Añadir
            </button>
          )}
        </div>
      )}
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
