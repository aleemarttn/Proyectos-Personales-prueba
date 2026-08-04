import { useState } from 'react'
import { Target, Sparkles, Loader2, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { SIMPLE, COMPLETO, esCompleto } from '../lib/modos.js'

// Tarjeta del Perfil para saltar de un modo a otro sin perder nada.
//
// Subir a completo pide objetivos, porque el diario los necesita para tener
// algo contra lo que comparar. Bajar a simple es inmediato: la despensa, los
// gastos y el diario siguen intactos en la base de datos, solo se ocultan.
export default function CambiarModo() {
  const { perfil, cambiarModo } = useAuth()
  const completo = esCompleto(perfil?.tipo)

  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Si ya tuvo objetivos alguna vez, los reutilizamos como punto de partida.
  const [macros, setMacros] = useState({
    kcal: perfil?.macros?.kcal ?? 2000,
    hidratos: perfil?.macros?.hidratos ?? 50,
    proteinas: perfil?.macros?.proteinas ?? 30,
    grasas: perfil?.macros?.grasas ?? 20,
  })

  const suma = macros.hidratos + macros.proteinas + macros.grasas

  async function aplicar(tipo, conMacros) {
    setGuardando(true)
    setError('')
    try {
      await cambiarModo(tipo, conMacros)
      setAbierto(false)
    } catch (e) {
      console.error('Error cambiando de modo:', e)
      setError('No se pudo cambiar de modo. Inténtalo de nuevo.')
    }
    setGuardando(false)
  }

  async function bajarASimple() {
    const ok = window.confirm(
      'Pasarás al modo simple: se ocultan el diario y los objetivos. No se borra nada, puedes volver cuando quieras.'
    )
    if (ok) await aplicar(SIMPLE, null)
  }

  // --- Ya está en completo: solo ofrecemos volver, y sin insistir ---
  if (completo) {
    return (
      <div className="px-5 mb-4">
        <button
          onClick={bajarASimple}
          disabled={guardando}
          className="w-full bg-white text-gray-500 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-card active:scale-[0.98] transition disabled:opacity-70"
        >
          {guardando ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} />
          )}
          Cambiar a modo simple
        </button>
        {error && (
          <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 mt-3">
            {error}
          </p>
        )}
      </div>
    )
  }

  // --- Está en simple: invitación a subir, con los objetivos en el sitio ---
  return (
    <div className="px-5 mb-4">
      <div className="bg-white rounded-3xl p-5 shadow-card">
        <div className="w-11 h-11 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center mb-3">
          <Target size={22} />
        </div>
        <h3 className="font-extrabold text-gray-800">
          ¿Quieres llevar también lo que comes?
        </h3>
        <p className="text-gray-500 text-sm mt-1">
          El modo completo añade el diario de comidas y los objetivos diarios.
          Tu despensa y tus gastos se quedan como están.
        </p>

        {!abierto ? (
          <button
            onClick={() => setAbierto(true)}
            className="w-full bg-brand-500 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-soft active:scale-[0.98] transition mt-4"
          >
            Pasar a modo completo <ArrowRight size={18} />
          </button>
        ) : (
          <div className="mt-5 animate-slide-up">
            <label className="block text-sm font-bold text-gray-600 mb-2">
              Calorías diarias (kcal)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={macros.kcal}
              onChange={(e) =>
                setMacros({ ...macros, kcal: Number(e.target.value) })
              }
              className="w-full bg-cream rounded-2xl px-4 py-3.5 text-lg font-bold text-gray-800 outline-none focus:ring-2 ring-brand-300 mb-5"
            />

            <Slider
              label="Hidratos"
              color="#f59e0b"
              valor={macros.hidratos}
              onChange={(v) => setMacros({ ...macros, hidratos: v })}
            />
            <Slider
              label="Proteínas"
              color="#ef4444"
              valor={macros.proteinas}
              onChange={(v) => setMacros({ ...macros, proteinas: v })}
            />
            <Slider
              label="Grasas"
              color="#eab308"
              valor={macros.grasas}
              onChange={(v) => setMacros({ ...macros, grasas: v })}
            />

            <div
              className={`text-center text-sm font-bold mt-3 ${
                suma === 100 ? 'text-brand-600' : 'text-amber-600'
              }`}
            >
              {suma === 100
                ? '✓ Reparto correcto (100%)'
                : `Suma actual: ${suma}% (ideal 100%)`}
            </div>

            {error && (
              <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 mt-4">
                {error}
              </p>
            )}

            <button
              onClick={() => aplicar(COMPLETO, macros)}
              disabled={guardando}
              className="w-full bg-brand-500 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-soft active:scale-[0.98] transition mt-4 disabled:opacity-70"
            >
              {guardando ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Activando...
                </>
              ) : (
                'Activar modo completo'
              )}
            </button>
            <button
              onClick={() => setAbierto(false)}
              className="w-full text-gray-400 font-bold py-2.5 mt-1"
            >
              Ahora no
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Slider({ label, valor, onChange, color }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="font-bold text-gray-700 flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          {label}
        </span>
        <span className="font-extrabold text-gray-800">{valor}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-500"
      />
    </div>
  )
}
