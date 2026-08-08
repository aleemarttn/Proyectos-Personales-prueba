import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Target,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { SIMPLE, COMPLETO, funcionesDe } from '../lib/modos.js'
import RegionSelector from '../components/RegionSelector.jsx'

// Lo PRIMERO que se decide al crear la cuenta es para qué se quiere la app.
// De esa respuesta cuelga todo lo demás, incluido cuántos datos se piden:
//   Paso 1: elegir modo (simple / completo)
//   Paso 2: datos — en simple solo nombre y comunidad/provincia
//   Paso 3: objetivos de macros (solo completo)
export default function Onboarding() {
  const navigate = useNavigate()
  const { guardarPerfil } = useAuth()

  const [paso, setPaso] = useState(1)
  const [tipo, setTipo] = useState(null) // SIMPLE | COMPLETO
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const funciones = funcionesDe(tipo)

  // Datos básicos comunes
  const [datos, setDatos] = useState({
    nombre: '',
    edad: '',
    genero: 'Mujer',
    comunidadAutonoma: '',
    provincia: '',
  })

  // Objetivos de macros (solo control total)
  const [macros, setMacros] = useState({
    kcal: 2000,
    hidratos: 50,
    proteinas: 30,
    grasas: 20,
  })

  const sumaMacros = macros.hidratos + macros.proteinas + macros.grasas

  function elegir(t) {
    setTipo(t)
    setPaso(2)
  }

  async function finalizar() {
    setGuardando(true)
    setError('')
    try {
      await guardarPerfil({
        tipo,
        nombre: datos.nombre.trim() || 'Invitado',
        // En modo simple no se piden ni se guardan: no hacen falta para nada.
        edad: funciones.datosPersonales ? datos.edad : '',
        genero: funciones.datosPersonales ? datos.genero : null,
        comunidadAutonoma: datos.comunidadAutonoma,
        provincia: datos.provincia,
        macros: funciones.macros ? macros : null,
      })
      navigate('/despensa')
    } catch (e) {
      console.error('Error guardando el perfil:', e)
      setError('No se pudo guardar tu perfil. Inténtalo de nuevo.')
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-cream animate-fade-in">
      {/* Cabecera con botón atrás y progreso */}
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-2 flex items-center gap-3">
        <button
          onClick={() => (paso === 1 ? navigate('/') : setPaso(paso - 1))}
          className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center text-gray-600 active:scale-95 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 flex gap-1.5">
          {[1, 2, funciones.macros ? 3 : null].filter(Boolean).map((p) => (
            <div
              key={p}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                paso >= p ? 'bg-brand-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        {/* ---------- PASO 1: elegir vía ---------- */}
        {paso === 1 && (
          <div className="animate-slide-up">
            <h2 className="text-2xl font-black text-gray-800 mt-4 mb-1">
              ¿Para qué quieres la app?
            </h2>
            <p className="text-gray-500 mb-6">
              Puedes cambiar de modo cuando quieras desde tu perfil.
            </p>

            <TarjetaModo
              icon={Sparkles}
              color="amber"
              titulo="Modo simple"
              resumen="Controlar la compra y cocinar con lo que ya tienes."
              incluye={[
                'Tu despensa y lo que vale',
                'En qué te gastas el dinero del súper',
                'Recetas con lo que tienes en casa',
              ]}
              nota="Solo te pedimos el nombre y tu comunidad autónoma."
              onClick={() => elegir(SIMPLE)}
            />

            <TarjetaModo
              icon={Target}
              color="brand"
              titulo="Modo completo"
              resumen="Todo lo anterior y además el control de lo que comes."
              incluye={[
                'Todo el modo simple',
                'Diario de comidas con calorías y macros',
                'Objetivos diarios y recetas que encajan en ellos',
              ]}
              nota="Te pedimos algún dato más para calcular tus objetivos."
              onClick={() => elegir(COMPLETO)}
            />
          </div>
        )}

        {/* ---------- PASO 2: datos básicos ---------- */}
        {paso === 2 && (
          <div className="animate-slide-up">
            <h2 className="text-2xl font-black text-gray-800 mt-4 mb-1">
              Cuéntanos sobre ti
            </h2>
            <p className="text-gray-500 mb-6">
              {funciones.datosPersonales
                ? 'La edad y el género nos sirven para afinar tus objetivos.'
                : 'Con esto basta. La comunidad y provincia son para los precios de tu zona.'}
            </p>

            <Campo
              label="Nombre"
              valor={datos.nombre}
              onChange={(v) => setDatos({ ...datos, nombre: v })}
              placeholder="Ej. Laura"
            />

            {/* Edad y género solo se piden si van a usarse (modo completo) */}
            {funciones.datosPersonales && (
              <>
                <Campo
                  label="Edad"
                  tipo="number"
                  valor={datos.edad}
                  onChange={(v) => setDatos({ ...datos, edad: v })}
                  placeholder="Ej. 32"
                />

                <label className="block text-sm font-bold text-gray-600 mb-2 mt-4">
                  Género
                </label>
                <div className="flex gap-2 mb-1">
                  {['Mujer', 'Hombre', 'Otro'].map((g) => (
                    <button
                      key={g}
                      onClick={() => setDatos({ ...datos, genero: g })}
                      className={`flex-1 py-3 rounded-2xl font-bold text-sm transition ${
                        datos.genero === g
                          ? 'bg-brand-500 text-white shadow-soft'
                          : 'bg-white text-gray-500 shadow-card'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </>
            )}

            <RegionSelector
              comunidad={datos.comunidadAutonoma}
              provincia={datos.provincia}
              onChange={({ comunidad, provincia }) =>
                setDatos({ ...datos, comunidadAutonoma: comunidad, provincia })
              }
            />

            {error && !funciones.macros && (
              <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 mt-4">
                {error}
              </p>
            )}

            <BotonContinuar
              onClick={() => (funciones.macros ? setPaso(3) : finalizar())}
              cargando={guardando}
              texto={funciones.macros ? 'Continuar' : 'Empezar'}
            />
          </div>
        )}

        {/* ---------- PASO 3: macros (solo control total) ---------- */}
        {paso === 3 && (
          <div className="animate-slide-up">
            <h2 className="text-2xl font-black text-gray-800 mt-4 mb-1">
              Tus objetivos diarios
            </h2>
            <p className="text-gray-500 mb-6">
              Define tus calorías y el reparto de macros.
            </p>

            <label className="block text-sm font-bold text-gray-600 mb-2">
              Calorías diarias (kcal)
            </label>
            <input
              type="number"
              value={macros.kcal}
              onChange={(e) =>
                setMacros({ ...macros, kcal: Number(e.target.value) })
              }
              className="w-full bg-white rounded-2xl px-4 py-3.5 text-lg font-bold text-gray-800 shadow-card outline-none focus:ring-2 ring-brand-300 mb-5"
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
              className={`text-center text-sm font-bold mt-3 mb-1 ${
                sumaMacros === 100 ? 'text-brand-600' : 'text-amber-600'
              }`}
            >
              {sumaMacros === 100
                ? '✓ Reparto correcto (100%)'
                : `Suma actual: ${sumaMacros}% (ideal 100%)`}
            </div>

            {error && (
              <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 mt-4">
                {error}
              </p>
            )}

            <BotonContinuar
              onClick={finalizar}
              cargando={guardando}
              texto="Crear perfil"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// --- Componentes auxiliares ---

// Tarjeta de elección de modo. Enseña lo que CADA modo trae, no lo que le
// falta: el modo simple no es una versión recortada, es otra forma de usarla.
function TarjetaModo({ icon: Icon, color, titulo, resumen, incluye, nota, onClick }) {
  const tonos = {
    amber: 'bg-amber-100 text-amber-600',
    brand: 'bg-brand-100 text-brand-600',
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-3xl p-5 shadow-card mb-4 border-2 border-transparent active:border-brand-300 active:scale-[0.99] transition"
    >
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${tonos[color]}`}
      >
        <Icon size={24} />
      </div>
      <h3 className="font-extrabold text-lg text-gray-800">{titulo}</h3>
      <p className="text-gray-500 text-sm mt-1 mb-3">{resumen}</p>

      <ul className="space-y-1.5">
        {incluye.map((linea) => (
          <li key={linea} className="flex items-start gap-2 text-sm text-gray-600">
            <Check size={16} className="text-brand-500 shrink-0 mt-0.5" />
            <span className="font-semibold">{linea}</span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-gray-400 font-semibold mt-3">{nota}</p>
    </button>
  )
}

function Campo({ label, valor, onChange, placeholder, tipo = 'text' }) {
  return (
    <div className="mb-1">
      <label className="block text-sm font-bold text-gray-600 mb-2 mt-4">
        {label}
      </label>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white rounded-2xl px-4 py-3.5 text-gray-800 font-semibold shadow-card outline-none focus:ring-2 ring-brand-300 placeholder:text-gray-300 placeholder:font-normal"
      />
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

function BotonContinuar({ onClick, texto, cargando }) {
  return (
    <button
      onClick={onClick}
      disabled={cargando}
      className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-soft mt-6 disabled:opacity-70"
    >
      {cargando ? (
        <>
          <Loader2 size={20} className="animate-spin" /> Creando...
        </>
      ) : (
        <>
          {texto} <ArrowRight size={20} />
        </>
      )}
    </button>
  )
}
