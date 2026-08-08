import { useEffect, useState } from 'react'
import { Timer, Play, Square, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  cargarAyunoAbierto,
  empezarAyuno,
  terminarAyuno,
  duracionLegible,
  horaSinSegundos,
  ultimaVezQueDieron,
} from '../lib/ayuno.js'

// Tarjeta del ayuno intermitente en el diario. Solo aparece si lo has
// activado en tu perfil (el interruptor de EditorAyuno): quien no ayuna no
// tiene por qué ver un cronómetro, y en cuanto lo desactivas la tarjeta
// desaparece sola porque deja de cumplirse `ajustes?.activo`.
//
// Va en una fila compacta a propósito: comparte sitio con las tarjetas de
// calorías y macros, y el ayuno es secundario frente a esas dos.
//
// El tiempo transcurrido NO se acumula aquí, se calcula como "ahora menos
// la hora de inicio guardada". Por eso sigue contando bien aunque cierres
// la app, se apague el móvil o lo mires desde otro sitio.
export default function TarjetaAyuno() {
  const { sesion, perfil } = useAuth()
  const ajustes = perfil?.ayuno

  const [ayuno, setAyuno] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    if (!ajustes?.activo) {
      setCargando(false)
      return
    }

    let activo = true
    cargarAyunoAbierto()
      .then((abierto) => {
        if (activo) setAyuno(abierto)
      })
      .catch((e) => {
        console.error('Error cargando el ayuno en curso:', e)
        if (activo) setError('No se pudo cargar tu ayuno.')
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [ajustes?.activo])

  // El reloj solo corre mientras hay un ayuno abierto: sin esto estaríamos
  // repintando cada segundo para nada el resto del tiempo.
  useEffect(() => {
    if (!ayuno) return
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ayuno])

  if (!ajustes?.activo) return null

  async function empezar(inicio) {
    if (guardando) return
    setGuardando(true)
    setError('')
    try {
      const nuevo = await empezarAyuno(sesion.user.id, ajustes.horasObjetivo, inicio)
      setAhora(Date.now())
      setAyuno(nuevo)
    } catch (e) {
      console.error('Error empezando el ayuno:', e)
      // El índice único parcial de la migración 013 impide dos ayunos
      // abiertos a la vez (p. ej. doble toque, o el otro móvil).
      setError(
        e?.code === '23505'
          ? 'Ya tienes un ayuno en curso.'
          : 'No se pudo empezar el ayuno.'
      )
    } finally {
      setGuardando(false)
    }
  }

  async function terminar() {
    if (guardando) return
    setGuardando(true)
    setError('')
    try {
      await terminarAyuno(ayuno.id)
      setAyuno(null)
    } catch (e) {
      console.error('Error terminando el ayuno:', e)
      setError('No se pudo terminar el ayuno.')
    } finally {
      setGuardando(false)
    }
  }

  const objetivoMs = (ayuno?.horasObjetivo ?? ajustes.horasObjetivo) * 3600 * 1000
  const transcurrido = ayuno ? ahora - ayuno.inicio.getTime() : 0
  const cumplido = ayuno && transcurrido >= objetivoMs
  const pct = ayuno ? Math.min(100, (transcurrido / objetivoMs) * 100) : 0

  // Tu ventana habitual: casi nunca le das al botón justo al terminar de
  // cenar, así que este atajo evita tener que corregir la cuenta a mano.
  const inicioHabitual = ultimaVezQueDieron(ajustes.horaInicio)

  return (
    <div className="bg-white rounded-3xl p-3 shadow-card animate-slide-up">
      {cargando ? (
        <div className="flex items-center gap-3">
          <IconoAyuno cumplido={false} />
          <Loader2 className="animate-spin text-brand-400" size={18} />
        </div>
      ) : ayuno ? (
        <>
          <div className="flex items-center gap-3">
            <IconoAyuno cumplido={cumplido} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-gray-400">Ayuno</p>
                <p
                  className={`text-xs font-bold shrink-0 ${
                    cumplido ? 'text-brand-600' : 'text-gray-400'
                  }`}
                >
                  {cumplido
                    ? 'Objetivo cumplido'
                    : `Quedan ${duracionLegible(objetivoMs - transcurrido)}`}
                </p>
              </div>
              <p className="font-black text-gray-800 text-lg leading-none mt-0.5">
                {duracionLegible(transcurrido)}
              </p>
            </div>
            <button
              onClick={terminar}
              disabled={guardando}
              className="shrink-0 bg-gray-100 text-gray-600 font-bold text-xs px-3 py-2.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition disabled:opacity-40"
            >
              {guardando ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Square size={12} />
              )}
              Fin
            </button>
          </div>

          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2.5">
            <div
              className={`h-full rounded-full transition-all ${
                cumplido ? 'bg-brand-600' : 'bg-brand-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <IconoAyuno cumplido={false} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-400">Ayuno</p>
              <p className="font-black text-gray-800 text-lg leading-none mt-0.5">
                {ajustes.horasObjetivo} h objetivo
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => empezar(null)}
              disabled={guardando}
              className="flex-1 bg-brand-500 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-soft active:scale-[0.98] transition disabled:opacity-40"
            >
              {guardando ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={13} />
              )}
              Empezar
            </button>
            <button
              onClick={() => empezar(inicioHabitual)}
              disabled={guardando}
              className="flex-1 bg-gray-50 text-brand-700 font-bold text-xs py-2.5 rounded-xl active:scale-[0.98] transition disabled:opacity-40"
            >
              Desde {horaSinSegundos(ajustes.horaInicio)}
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="bg-red-50 text-red-600 text-xs font-semibold rounded-xl px-3 py-2 mt-2.5">
          {error}
        </p>
      )}
    </div>
  )
}

function IconoAyuno({ cumplido }) {
  return (
    <div
      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
        cumplido ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-600'
      }`}
    >
      <Timer size={18} />
    </div>
  )
}
