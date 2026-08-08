import { useState } from 'react'
import { Timer, Loader2, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { horaObjetivo, horaSinSegundos, ultimaVezQueDieron } from '../lib/ayuno.js'
import { horaCorta } from '../utils/formato.js'

// Duraciones habituales de ayuno. El rango que acepta la base de datos es
// 8-36 h (migración 013), pero con estas seis se cubre prácticamente todo
// el mundo y no hay forma de escribir un número imposible.
const HORAS = [12, 14, 16, 18, 20, 24]

// Ajustes de ayuno intermitente dentro del Perfil: activarlo, cuántas
// horas y a qué hora sueles empezar. El cronómetro en sí vive en el
// diario (ver TarjetaAyuno).
export default function EditorAyuno() {
  const { perfil, guardarAyuno } = useAuth()
  const ajustes = perfil?.ayuno

  const [horas, setHoras] = useState(ajustes?.horasObjetivo ?? 16)
  const [horaInicio, setHoraInicio] = useState(horaSinSegundos(ajustes?.horaInicio) || '21:00')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  if (!perfil) return null

  const activo = !!ajustes?.activo
  // Solo se enseña el botón de guardar si de verdad hay algo que guardar
  const hayCambios =
    horas !== ajustes?.horasObjetivo || horaInicio !== horaSinSegundos(ajustes?.horaInicio)

  async function guardar(cambios) {
    if (guardando) return
    setGuardando(true)
    setError('')
    try {
      await guardarAyuno({
        activo,
        horasObjetivo: horas,
        horaInicio,
        ...cambios,
      })
    } catch (e) {
      console.error('Error guardando los ajustes de ayuno:', e)
      setError(
        // Si la migración 013 no está aplicada, las columnas no existen
        /column|schema cache/i.test(e?.message || '')
          ? 'Falta aplicar la migración del ayuno en la base de datos.'
          : 'No se pudieron guardar los ajustes.'
      )
    } finally {
      setGuardando(false)
    }
  }

  // Hora a la que te tocaría romper el ayuno con los ajustes de ahora
  const finVentana = horaCorta(
    horaObjetivo(ultimaVezQueDieron(horaInicio), horas).toISOString()
  )

  return (
    <div className="px-5 mb-4">
      <h2 className="font-extrabold text-gray-700 mb-3">Ayuno intermitente</h2>

      <div className="bg-white rounded-3xl p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Timer size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800">Llevar la cuenta</p>
            <p className="text-xs font-semibold text-gray-400">
              Añade un contador de horas a tu diario
            </p>
          </div>
          <Interruptor
            activo={activo}
            deshabilitado={guardando}
            onChange={(valor) => guardar({ activo: valor })}
          />
        </div>

        {activo && (
          <div className="mt-4 pt-4 border-t border-gray-50 space-y-4">
            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">¿Cuántas horas?</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {HORAS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHoras(h)}
                    className={`px-4 py-2.5 rounded-xl font-bold text-sm shrink-0 transition ${
                      horas === h
                        ? 'bg-brand-500 text-white shadow-soft'
                        : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    {h} h
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">
                ¿A qué hora sueles empezar?
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-800 font-bold outline-none focus:ring-2 ring-brand-300"
                />
                <p className="text-sm font-semibold text-gray-400">
                  Romperías el ayuno a las{' '}
                  <span className="font-bold text-gray-600">{finVentana}</span>
                </p>
              </div>
            </div>

            {hayCambios && (
              <button
                onClick={() => guardar()}
                disabled={guardando}
                className="w-full bg-brand-500 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-soft active:scale-[0.98] transition disabled:opacity-40"
              >
                {guardando ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Check size={18} />
                )}
                Guardar
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-2.5 mt-3">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

// Interruptor de toda la vida. Es un <button> con role de checkbox para que
// los lectores de pantalla lo anuncien como lo que es.
function Interruptor({ activo, deshabilitado, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={activo}
      aria-label="Llevar la cuenta del ayuno"
      disabled={deshabilitado}
      onClick={() => onChange(!activo)}
      className={`w-12 h-7 rounded-full p-1 shrink-0 transition-colors disabled:opacity-40 ${
        activo ? 'bg-brand-500' : 'bg-gray-200'
      }`}
    >
      <span
        className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
          activo ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
