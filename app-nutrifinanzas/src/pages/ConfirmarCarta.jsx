import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Loader2,
  CheckCircle2,
  Sparkles,
  Flame,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useDiario } from '../context/DiarioContext.jsx'
import { esCompleto } from '../lib/modos.js'
import { comidaSugeridaPorHora } from '../lib/comidas.js'

// Resultado del análisis de la carta (AnalizarCarta.jsx): muestra los platos
// detectados con el recomendado destacado y por qué. En modo simple ahí
// termina el flujo (no hay objetivos de macros, así que no tendría sentido
// registrar); en modo completo se puede elegir cualquier plato detectado y
// registrarlo en el Diario de hoy, reutilizando `agregarRegistros`.
export default function ConfirmarCarta() {
  const navigate = useNavigate()
  const location = useLocation()
  const { perfil } = useAuth()
  const { comidas, agregarRegistros } = useDiario()

  const platos = location.state?.platos || []
  const recomendadoIndice = location.state?.recomendadoIndice ?? 0
  const motivo = location.state?.motivo || ''
  const conObjetivo = !!location.state?.conObjetivo

  const modoCompleto = esCompleto(perfil?.tipo)

  const [elegidoIndice, setElegidoIndice] = useState(recomendadoIndice)
  const [comidaId, setComidaId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (comidaId || comidas.length === 0) return
    setComidaId(comidaSugeridaPorHora(comidas)?.id ?? null)
  }, [comidas, comidaId])

  if (platos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-cream px-8 text-center animate-fade-in">
        <AlertTriangle className="text-amber-500 mb-3" size={40} />
        <p className="font-bold text-gray-700">No hay nada que confirmar.</p>
        <button
          onClick={() => navigate('/analizar-carta')}
          className="mt-5 bg-brand-500 text-white font-bold py-3 px-6 rounded-2xl active:scale-95 transition"
        >
          Volver a fotografiar
        </button>
      </div>
    )
  }

  const plato = platos[elegidoIndice]
  const sinKcal = plato?.kcalEstimado === null || plato?.kcalEstimado === undefined
  const comidaElegida = comidas.find((c) => c.id === comidaId) || null

  async function registrar() {
    if (!plato || sinKcal || guardando) return
    setGuardando(true)
    setError('')
    try {
      await agregarRegistros([
        {
          nombre: plato.nombre,
          cantidadG: 0,
          unidadMedida: 'g',
          kcal: plato.kcalEstimado,
          proteinas: plato.proteinasEstimado,
          hidratos: plato.hidratosEstimado,
          grasas: plato.grasasEstimado,
          origen: 'restaurante',
          comidaId,
        },
      ])
      setHecho(true)
      setTimeout(() => navigate('/diario'), 1000)
    } catch (e) {
      console.error('Error registrando el plato:', e)
      setError('No se pudo guardar. Inténtalo de nuevo.')
      setGuardando(false)
    }
  }

  if (hecho) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-cream animate-fade-in px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mb-5 animate-pop">
          <CheckCircle2 size={44} />
        </div>
        <h2 className="text-2xl font-black text-gray-800">¡Registrado!</h2>
        <p className="text-gray-500 mt-1">
          {plato.nombre}
          {comidaElegida ? ` añadido a "${comidaElegida.nombre}".` : ' añadido a tu diario de hoy.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-cream min-h-full animate-fade-in">
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-2 flex items-center gap-3">
        <button
          onClick={() => navigate('/analizar-carta')}
          className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center text-gray-600 active:scale-95 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-black text-gray-800">Carta analizada</h1>
      </div>

      <div className="px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {motivo && (
          <div className="bg-brand-50 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0">
              <Sparkles size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-brand-700 uppercase tracking-wide mb-0.5">
                {conObjetivo ? 'Mejor para lo que te queda hoy' : 'La opción más sana'}
              </p>
              <p className="text-sm text-gray-700 font-semibold">{motivo}</p>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 font-semibold mb-4 flex items-start gap-1.5">
          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-gray-300" />
          Las kcal y macros son una estimación de la IA a partir del nombre del plato: no sabe
          la ración exacta, el aceite usado ni cómo se ha cocinado. Úsalas como orientación, no
          como un dato exacto.
        </p>

        <p className="text-sm font-bold text-gray-600 mb-2">
          {platos.length === 1 ? 'Plato detectado' : `Platos detectados (${platos.length})`}
        </p>

        <div className="space-y-2.5">
          {platos.map((p, i) => (
            <PlatoCard
              key={i}
              plato={p}
              recomendado={i === recomendadoIndice}
              seleccionado={modoCompleto && i === elegidoIndice}
              seleccionable={modoCompleto}
              onClick={() => modoCompleto && setElegidoIndice(i)}
            />
          ))}
        </div>

        {modoCompleto && (
          <>
            {comidas.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-bold text-gray-600 mb-2">¿En qué comida?</p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {comidas.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setComidaId(c.id)}
                      className={`px-4 py-2.5 rounded-xl font-bold text-sm shrink-0 transition ${
                        comidaId === c.id
                          ? 'bg-brand-500 text-white shadow-soft'
                          : 'bg-white text-gray-500 shadow-card'
                      }`}
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 mt-4">
                {error}
              </p>
            )}

            {sinKcal && (
              <p className="bg-amber-50 text-amber-700 text-sm font-semibold rounded-xl px-4 py-3 mt-4 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                Este plato no tiene macros estimados con suficiente confianza.
              </p>
            )}

            <button
              onClick={registrar}
              disabled={sinKcal || guardando}
              className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-soft mt-5 disabled:opacity-40"
            >
              {guardando ? (
                <>
                  <Loader2 size={20} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Check size={20} /> Registrar este plato
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PlatoCard({ plato, recomendado, seleccionado, seleccionable, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!seleccionable}
      className={`w-full text-left bg-white rounded-2xl p-4 shadow-card transition ${
        seleccionado ? 'ring-2 ring-brand-400' : ''
      } ${seleccionable ? 'active:scale-[0.98]' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-bold text-gray-800">{plato.nombre}</p>
        {recomendado && (
          <span className="shrink-0 text-[11px] font-extrabold text-brand-600 bg-brand-50 px-2 py-1 rounded-lg">
            Recomendado
          </span>
        )}
      </div>
      {plato.kcalEstimado != null ? (
        <p className="text-sm text-gray-500 font-semibold flex items-center gap-1.5">
          <Flame size={14} className="text-brand-400" /> ~{Math.round(plato.kcalEstimado)} kcal
          {plato.proteinasEstimado != null && ` · P ~${Math.round(plato.proteinasEstimado)}g`}
          {plato.hidratosEstimado != null && ` · H ~${Math.round(plato.hidratosEstimado)}g`}
          {plato.grasasEstimado != null && ` · G ~${Math.round(plato.grasasEstimado)}g`}
          {plato.confianza === 'baja' && (
            <span className="text-gray-300 font-bold"> (poco fiable)</span>
          )}
        </p>
      ) : (
        <p className="text-sm text-gray-400 font-semibold">Sin macros estimados</p>
      )}
    </button>
  )
}
