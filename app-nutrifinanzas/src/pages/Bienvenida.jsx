import { useNavigate } from 'react-router-dom'
import { Leaf, ArrowRight, ScanLine, PieChart, Carrot } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { rutaInicio } from '../lib/modos.js'

// Pantalla de bienvenida (primera que se ve al abrir la app).
export default function Bienvenida() {
  const navigate = useNavigate()
  const { sesion, perfil } = useAuth()
  const perfilCompleto = !!perfil?.tipo

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-brand-500 to-brand-700 text-white px-7 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-[calc(env(safe-area-inset-bottom)+2.5rem)] animate-fade-in">
      <div className="flex-1 flex flex-col justify-center">
        <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center mb-7 animate-pop">
          <Leaf size={42} strokeWidth={2.2} />
        </div>

        <h1 className="text-4xl font-black leading-tight mb-3">
          NutriGasto
        </h1>
        <p className="text-brand-50/90 text-lg leading-relaxed mb-8">
          Tu despensa y tus gastos del súper, en un solo sitio. Come mejor y
          controla lo que gastas.
        </p>

        {/* Nada de prometer macros aquí: eso depende del modo que elija
            después, y el modo simple no los lleva. */}
        <div className="space-y-3 mb-2">
          <Ventaja icon={ScanLine} texto="Escanea tickets en segundos" />
          <Ventaja icon={PieChart} texto="Visualiza en qué gastas" />
          <Ventaja icon={Carrot} texto="Cocina con lo que ya tienes" />
        </div>
      </div>

      <div className="space-y-3">
        {sesion && perfilCompleto ? (
          <button
            onClick={() => navigate(rutaInicio(perfil.tipo))}
            className="w-full bg-white text-brand-700 font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-soft"
          >
            Continuar como {perfil.nombre}
            <ArrowRight size={20} />
          </button>
        ) : (
          <>
            <button
              onClick={() => navigate('/registro')}
              className="w-full bg-white text-brand-700 font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-soft"
            >
              Empezar
              <ArrowRight size={20} />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full text-white/90 font-bold py-3 rounded-2xl active:scale-[0.98] transition-transform"
            >
              Ya tengo cuenta
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Ventaja({ icon: Icon, texto }) {
  return (
    <div className="flex items-center gap-3 animate-slide-up">
      <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
        <Icon size={18} />
      </div>
      <span className="font-semibold text-brand-50">{texto}</span>
    </div>
  )
}
