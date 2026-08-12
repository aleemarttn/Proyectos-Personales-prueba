import { useState, useEffect } from 'react'
import {
  ChefHat,
  Sparkles,
  Loader2,
  Flame,
  AlertTriangle,
  Check,
  CheckCircle2,
  RotateCcw,
  Plus,
  Minus,
  Users,
  Target,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useDiario } from '../context/DiarioContext.jsx'
import { esCompleto } from '../lib/modos.js'
import { comidaSugeridaPorHora } from '../lib/comidas.js'
import { generarRecetas } from '../lib/recetas.js'
import { objetivoRestanteHoy } from '../lib/macros.js'

// Recetas a partir de lo que ya tienes en la despensa. No es una tabla de
// recetas hecha a mano ni todas las combinaciones posibles: se le manda a
// Gemini la lista de alimentos (nombre + categoría) y se le pide que elija
// las combinaciones más HABITUALES y reconocibles (arroz con pollo, papas
// con bistec...), no una mezcla forzada de todo lo que hay en la despensa.
// En modo completo, además, se le manda cuánto le queda hoy al usuario para
// que la recomendación tenga en cuenta sus objetivos.
export default function Recetas() {
  const { alimentos } = useApp()
  const { perfil } = useAuth()
  const { resumen, comidas, agregarRegistros } = useDiario()

  const modoCompleto = esCompleto(perfil?.tipo)

  const [generando, setGenerando] = useState(false)
  const [generado, setGenerado] = useState(false)
  const [recetas, setRecetas] = useState([])
  const [recomendadoIndice, setRecomendadoIndice] = useState(0)
  const [motivo, setMotivo] = useState('')
  const [conObjetivo, setConObjetivo] = useState(false)
  const [error, setError] = useState('')

  const [elegidoIndice, setElegidoIndice] = useState(0)
  const [comidaId, setComidaId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')

  // Cuántas raciones cocinar (escala las cantidades de ingredientes de la
  // lista, no los macros por ración que ya vienen calculados por Gemini).
  const [raciones, setRaciones] = useState(1)
  // Solo modo completo: en vez de una ración "normal", encoge o agranda tu
  // propia ración para que encaje justo en lo que te queda hoy de kcal.
  const [ajustarObjetivo, setAjustarObjetivo] = useState(false)

  // Lo que le quedaba hoy al usuario CUANDO SE GENERARON las recetas (mismo
  // cálculo que se le manda a Gemini). A propósito NO se recalcula en cada
  // render: si se recalculara contra `resumen` en vivo, registrar una
  // receta cambia lo que queda hoy y las cantidades de las demás tarjetas
  // se pondrían a 0 delante del usuario, aunque él siga mirando esa misma
  // lista. Solo se vuelve a calcular al pulsar "Sugerir recetas".
  const [objetivoRestante, setObjetivoRestante] = useState(null)

  // Cuánto hay que multiplicar la ración "normal" de una receta para que
  // encaje en lo que le queda hoy al usuario. 1 si el ajuste está apagado,
  // no hay objetivo cargado, o la receta no tiene kcal estimadas.
  function factorObjetivo(r) {
    if (!ajustarObjetivo || !objetivoRestante || !r?.kcalEstimado) return 1
    return objetivoRestante.kcal_restante / r.kcalEstimado
  }

  useEffect(() => {
    if (comidaId || comidas.length === 0) return
    setComidaId(comidaSugeridaPorHora(comidas)?.id ?? null)
  }, [comidas, comidaId])

  const suficientesAlimentos = alimentos.length >= 2

  async function generar() {
    setGenerando(true)
    setError('')
    setHecho(false)
    try {
      const objetivoDeHoy = modoCompleto ? objetivoRestanteHoy(resumen) : null

      const resultado = await generarRecetas(alimentos, objetivoDeHoy)
      setRecetas(resultado.recetas || [])
      setRecomendadoIndice(resultado.recomendadoIndice || 0)
      setElegidoIndice(resultado.recomendadoIndice || 0)
      setMotivo(resultado.motivo || '')
      setConObjetivo(!!objetivoDeHoy)
      setObjetivoRestante(objetivoDeHoy)
      setGenerado(true)
    } catch (e) {
      console.error('Error generando recetas:', e)
      setError(
        e.message === 'TIMEOUT'
          ? 'Está tardando más de lo normal. Inténtalo de nuevo en un momento.'
          : e.message || 'No hemos podido generar recetas ahora mismo. Inténtalo de nuevo.'
      )
    } finally {
      setGenerando(false)
    }
  }

  const receta = recetas[elegidoIndice]
  const sinKcal = receta?.kcalEstimado === null || receta?.kcalEstimado === undefined
  const comidaElegida = comidas.find((c) => c.id === comidaId) || null

  async function registrar() {
    if (!receta || sinKcal || guardando) return
    setGuardando(true)
    setErrorGuardar('')
    try {
      // Lo que se registra es TU ración (con el ajuste al objetivo si está
      // activo), no la cantidad de toda la mesa: "raciones" solo escala la
      // lista de ingredientes para cocinar, no lo que tú te comes.
      const factor = factorObjetivo(receta)
      await agregarRegistros([
        {
          nombre: receta.nombre,
          cantidadG: 0,
          unidadMedida: 'g',
          kcal: receta.kcalEstimado * factor,
          proteinas: receta.proteinasEstimado != null ? receta.proteinasEstimado * factor : null,
          hidratos: receta.hidratosEstimado != null ? receta.hidratosEstimado * factor : null,
          grasas: receta.grasasEstimado != null ? receta.grasasEstimado * factor : null,
          origen: 'receta',
          comidaId,
        },
      ])
      setHecho(true)
    } catch (e) {
      console.error('Error registrando la receta:', e)
      setErrorGuardar('No se pudo guardar. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="bg-cream min-h-full animate-fade-in">
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+1.75rem)] pb-4">
        <p className="text-gray-400 font-semibold">Con lo que ya tienes</p>
        <h1 className="text-2xl font-black text-gray-800">Recetas</h1>
      </div>

      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        {!suficientesAlimentos && (
          <EstadoVacio
            icono={<ChefHat size={40} />}
            titulo="Necesitas al menos 2 alimentos"
            texto="Añade algún alimento más a tu despensa para que podamos combinarlos en una receta."
          />
        )}

        {suficientesAlimentos && !generado && !generando && (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <div className="w-20 h-20 rounded-3xl bg-brand-100 text-brand-600 flex items-center justify-center mb-5">
              <ChefHat size={40} />
            </div>
            <p className="text-gray-500 leading-relaxed max-w-xs mb-6">
              Miramos tu despensa ({alimentos.length}{' '}
              {alimentos.length === 1 ? 'alimento' : 'alimentos'}) y te proponemos combinaciones
              habituales, no una mezcla de todo lo que tienes.
            </p>
            {error && (
              <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 mb-4 max-w-xs">
                {error}
              </p>
            )}
            <button
              onClick={generar}
              className="bg-brand-500 text-white font-extrabold text-lg py-4 px-6 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft"
            >
              <Sparkles size={20} /> Sugerir recetas
            </button>
          </div>
        )}

        {generando && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 font-semibold gap-3">
            <Loader2 className="animate-spin text-brand-400" size={32} />
            Pensando qué se puede cocinar…
          </div>
        )}

        {generado && !generando && recetas.length === 0 && (
          <EstadoVacio
            icono={<AlertTriangle size={40} className="text-amber-500" />}
            titulo="No hay una combinación clara"
            texto="Con lo que tienes ahora en la despensa no encontramos ningún plato habitual. Añade algún ingrediente más y prueba otra vez."
          >
            <button
              onClick={generar}
              className="mt-5 bg-brand-500 text-white font-bold py-3 px-6 rounded-2xl active:scale-95 transition"
            >
              Reintentar
            </button>
          </EstadoVacio>
        )}

        {generado && !generando && recetas.length > 0 && (
          <>
            {motivo && (
              <div className="bg-brand-50 rounded-2xl p-4 mb-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0">
                  <Sparkles size={17} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-brand-700 uppercase tracking-wide mb-0.5">
                    {conObjetivo ? 'Mejor para lo que te queda hoy' : 'La más recomendable'}
                  </p>
                  <p className="text-sm text-gray-700 font-semibold">{motivo}</p>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 font-semibold mb-4 flex items-start gap-1.5">
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-gray-300" />
              Las kcal y macros son una estimación de la IA por ración: no sabe la cantidad
              exacta que usas de cada ingrediente ni cómo lo cocinas. Úsalas como orientación,
              no como un dato exacto.
            </p>

            {/* Para cuántas personas cocinas: escala la lista de
                ingredientes de cada receta (no los macros por ración). Se
                desactiva mientras "Ajustar mi ración a hoy" está activo: no
                tiene sentido multiplicar una ración ya ajustada a tus kcal
                de hoy por el resto de comensales. */}
            <div
              className={`bg-white rounded-2xl p-4 shadow-card mb-2.5 flex items-center justify-between gap-3 transition ${
                ajustarObjetivo ? 'opacity-40' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <Users size={17} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-800 text-sm">¿Para cuántas personas?</p>
                  <p className="text-xs text-gray-400 font-semibold">
                    {ajustarObjetivo
                      ? 'Desactivado: estás ajustando solo tu ración'
                      : 'Ajusta las cantidades de cada ingrediente'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setRaciones((n) => Math.max(1, n - 1))}
                  disabled={raciones <= 1 || ajustarObjetivo}
                  className="w-8 h-8 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center active:scale-90 transition disabled:opacity-30"
                  aria-label="Menos personas"
                >
                  <Minus size={14} />
                </button>
                <span className="font-extrabold text-gray-800 w-4 text-center">{raciones}</span>
                <button
                  type="button"
                  onClick={() => setRaciones((n) => Math.min(8, n + 1))}
                  disabled={raciones >= 8 || ajustarObjetivo}
                  className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center active:scale-90 transition disabled:opacity-30"
                  aria-label="Más personas"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Modo completo: ajustar tu propia ración a lo que te queda
                hoy, en vez de a una ración "normal". */}
            {modoCompleto && objetivoRestante && (
              <button
                type="button"
                onClick={() => setAjustarObjetivo((v) => !v)}
                className={`w-full text-left rounded-2xl p-4 shadow-card mb-2.5 flex items-center justify-between gap-3 transition ${
                  ajustarObjetivo ? 'bg-brand-500' : 'bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      ajustarObjetivo ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-600'
                    }`}
                  >
                    <Target size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold text-sm ${ajustarObjetivo ? 'text-white' : 'text-gray-800'}`}>
                      Ajustar mi ración a hoy
                    </p>
                    <p className={`text-xs font-semibold ${ajustarObjetivo ? 'text-white/80' : 'text-gray-400'}`}>
                      Te quedan ~{objetivoRestante.kcal_restante} kcal hoy
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 w-11 h-6 rounded-full relative transition ${
                    ajustarObjetivo ? 'bg-white/30' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      ajustarObjetivo ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </span>
              </button>
            )}

            <div className="space-y-2.5 mb-2">
              {recetas.map((r, i) => {
                const ajustando = ajustarObjetivo && !!objetivoRestante
                return (
                <RecetaCard
                  key={i}
                  receta={r}
                  recomendada={i === recomendadoIndice}
                  seleccionada={modoCompleto && i === elegidoIndice}
                  seleccionable={modoCompleto}
                  // "Ajustar mi ración a hoy" y "para cuántas personas" no se
                  // combinan: el ajuste es SOLO tu ración, no una ración
                  // ajustada multiplicada por toda la mesa (cantidades
                  // absurdas). Mientras está activo, manda el ajuste.
                  multiplicador={ajustando ? factorObjetivo(r) : raciones}
                  factorRacion={factorObjetivo(r)}
                  ajustandoObjetivo={ajustando}
                  onClick={() => {
                    if (!modoCompleto) return
                    setElegidoIndice(i)
                    setHecho(false)
                  }}
                />
                )
              })}
            </div>

            <button
              onClick={generar}
              className="w-full flex items-center justify-center gap-2 text-gray-400 font-bold text-sm py-3 active:scale-[0.98] transition"
            >
              <RotateCcw size={15} /> Sugerir otras recetas
            </button>

            {modoCompleto && (
              <>
                {hecho ? (
                  <div className="flex flex-col items-center text-center bg-white rounded-2xl p-5 shadow-card mt-2 animate-pop">
                    <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mb-3">
                      <CheckCircle2 size={30} />
                    </div>
                    <p className="font-bold text-gray-800">
                      {receta.nombre}
                      {comidaElegida ? ` añadido a "${comidaElegida.nombre}".` : ' añadido a tu diario de hoy.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {comidas.length > 0 && (
                      <div className="mt-4">
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

                    {errorGuardar && (
                      <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 mt-4">
                        {errorGuardar}
                      </p>
                    )}

                    {sinKcal && (
                      <p className="bg-amber-50 text-amber-700 text-sm font-semibold rounded-xl px-4 py-3 mt-4 flex items-center gap-2">
                        <AlertTriangle size={16} className="shrink-0" />
                        Esta receta no tiene macros estimados con suficiente confianza.
                      </p>
                    )}

                    <button
                      onClick={registrar}
                      disabled={sinKcal || guardando}
                      className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-soft mt-4 disabled:opacity-40"
                    >
                      {guardando ? (
                        <>
                          <Loader2 size={20} className="animate-spin" /> Guardando...
                        </>
                      ) : (
                        <>
                          <Check size={20} /> Cocinar y registrar esta
                        </>
                      )}
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Cuánto pesa/mide un ingrediente ya escalado, en texto legible. Sin
// cantidad (sal, especias...) se muestra solo la unidad ("al gusto").
function formatearCantidad(ingrediente, multiplicador) {
  if (ingrediente.cantidad == null) return ingrediente.unidad || 'al gusto'
  const valor = ingrediente.cantidad * multiplicador
  const decimales = valor < 10 ? 1 : 0
  const redondeado = Math.round(valor * 10 ** decimales) / 10 ** decimales
  return `${redondeado.toString().replace('.', ',')} ${ingrediente.unidad}`
}

function RecetaCard({
  receta,
  recomendada,
  seleccionada,
  seleccionable,
  multiplicador,
  factorRacion = 1,
  ajustandoObjetivo,
  onClick,
}) {
  const tieneCantidades = receta.ingredientes?.length > 0
  // Los macros son "por ración": solo se ven afectados por el ajuste al
  // objetivo de hoy, no por cuánta gente hay en la mesa.
  const kcalRacion = receta.kcalEstimado != null ? receta.kcalEstimado * factorRacion : null
  const proteinasRacion =
    receta.proteinasEstimado != null ? receta.proteinasEstimado * factorRacion : null
  const hidratosRacion =
    receta.hidratosEstimado != null ? receta.hidratosEstimado * factorRacion : null
  const grasasRacion = receta.grasasEstimado != null ? receta.grasasEstimado * factorRacion : null

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!seleccionable}
      className={`w-full text-left bg-white rounded-2xl p-4 shadow-card transition ${
        seleccionada ? 'ring-2 ring-brand-400' : ''
      } ${seleccionable ? 'active:scale-[0.98]' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-bold text-gray-800">{receta.nombre}</p>
        {recomendada && (
          <span className="shrink-0 text-[11px] font-extrabold text-brand-600 bg-brand-50 px-2 py-1 rounded-lg">
            Recomendada
          </span>
        )}
      </div>

      {/* Con cantidades (lo normal): lista de la compra/cocina para las
          personas y el ajuste elegidos arriba. Sin ellas (receta antigua o
          la IA no las devolvió): los chips de antes, sin cantidad. */}
      {tieneCantidades ? (
        <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-2 space-y-1">
          {receta.ingredientes.map((ing, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-gray-600 font-semibold truncate">{ing.nombre}</span>
              <span className="text-gray-800 font-bold shrink-0">
                {formatearCantidad(ing, multiplicador)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        receta.ingredientesUsados.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {receta.ingredientesUsados.map((ing, i) => (
              <span
                key={i}
                className="text-[11px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg flex items-center gap-1"
              >
                <Plus size={10} /> {ing}
              </span>
            ))}
          </div>
        )
      )}

      {receta.pasos && <p className="text-sm text-gray-500 mb-2">{receta.pasos}</p>}

      {kcalRacion != null ? (
        <p className="text-sm text-gray-500 font-semibold flex items-center gap-1.5">
          <Flame size={14} className="text-brand-400" /> ~{Math.round(kcalRacion)} kcal
          {proteinasRacion != null && ` · P ~${Math.round(proteinasRacion)}g`}
          {hidratosRacion != null && ` · H ~${Math.round(hidratosRacion)}g`}
          {grasasRacion != null && ` · G ~${Math.round(grasasRacion)}g`}
          {receta.confianza === 'baja' && (
            <span className="text-gray-300 font-bold"> (poco fiable)</span>
          )}
          {ajustandoObjetivo && ' · tu ración de hoy'}
        </p>
      ) : (
        <p className="text-sm text-gray-400 font-semibold">Sin macros estimados</p>
      )}
    </button>
  )
}

function EstadoVacio({ icono, titulo, texto, children }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14">
      <div className="w-20 h-20 rounded-3xl bg-brand-100 text-brand-600 flex items-center justify-center mb-5">
        {icono}
      </div>
      <p className="font-bold text-gray-800 mb-1.5">{titulo}</p>
      <p className="text-gray-500 leading-relaxed max-w-xs">{texto}</p>
      {children}
    </div>
  )
}
