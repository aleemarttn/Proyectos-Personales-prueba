import { useEffect, useState } from 'react'
import { Timer, Play, Square, Loader2, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  cargarAyunoAbierto,
  empezarAyuno,
  terminarAyuno,
  duracionLegible,
  horaObjetivo,
  horaSinSegundos,
  ultimaVezQueDieron,
} from '../lib/ayuno.js'
import { horaCorta } from '../utils/formato.js'

// Tarjeta del ayuno intermitente en el diario. Solo aparece si lo has
// activado en tu perfil: quien no ayuna no tiene por qué ver un cronómetro.
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

  // Tu ventana habitual, para saber a qué hora te toca romperlo
  const inicioHabitual = ultimaVezQueDieron(ajustes.horaInicio)
  const finHabitual = horaCorta(
    horaObjetivo(inicioHabitual, ajustes.horasObjetivo).toISOString()
  )

  return (
    <div className="bg-white rounded-3xl p-4 shadow-card animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Timer size={18} className="text-brand-600" />
          <span className="font-black text-gray-800">Ayuno</span>
        </div>
        <span className="text-xs font-bold text-gray-400">
          {horaSinSegundos(ajustes.horaInicio)} → {finHabitual} · {ajustes.horasObjetivo} h
        </span>
      </div>

      {cargando ? (
        <div className="flex justify-center py-3">
          <Loader2 className="animate-spin text-brand-400" size={20} />
        </div>
      ) : ayuno ? (
        <>
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-2xl font-black text-gray-800 leading-none">
                {duracionLegible(transcurrido)}
              </p>
              <p className="text-sm font-bold text-gray-400 mt-1">
                {cumplido
                  ? `Objetivo cumplido hace ${duracionLegible(transcurrido - objetivoMs)}`
                  : `Te quedan ${duracionLegible(objetivoMs - transcurrido)}`}
              </p>
            </div>
            {cumplido && (
              <span className="flex items-center gap-1 bg-brand-50 text-brand-700 font-extrabold text-xs px-2.5 py-1.5 rounded-full">
                <Check size={14} /> Hecho
              </span>
            )}
          </div>

          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all ${
                cumplido ? 'bg-brand-600' : 'bg-brand-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-xs font-semibold text-gray-400 mb-3">
            Empezaste a las {horaCorta(ayuno.inicio.toISOString())} · objetivo a las{' '}
            {horaCorta(horaObjetivo(ayuno.inicio, ayuno.horasObjetivo).toISOString())}
          </p>

          <button
            onClick={terminar}
            disabled={guardando}
            className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-40"
          >
            {guardando ? <Loader2 size={18} className="animate-spin" /> : <Square size={16} />}
            Terminar ayuno
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-gray-400 mb-3">
            No estás ayunando ahora mismo.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => empezar(null)}
              disabled={guardando}
              className="flex-1 bg-brand-500 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-soft active:scale-[0.98] transition disabled:opacity-40"
            >
              {guardando ? <Loader2 size={18} className="animate-spin" /> : <Play size={16} />}
              Empezar ahora
            </button>
            {/* Casi nunca le das al botón justo al terminar de cenar, así
                que el atajo de "empecé a mi hora de siempre" evita tener
                que corregir la cuenta a mano. */}
            <button
              onClick={() => empezar(inicioHabitual)}
              disabled={guardando}
              className="flex-1 bg-white text-brand-700 font-bold py-3 rounded-2xl flex items-center justify-center shadow-card active:scale-[0.98] transition disabled:opacity-40 text-sm"
            >
              Desde las {horaSinSegundos(ajustes.horaInicio)}
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-2.5 mt-3">
          {error}
        </p>
      )}
    </div>
  )
}
