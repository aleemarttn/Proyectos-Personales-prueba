import { useNavigate } from 'react-router-dom'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import {
  User,
  MapPin,
  Cake,
  Target,
  Sparkles,
  Flame,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import EditorComidas from '../components/EditorComidas.jsx'

// Pantalla de Perfil: muestra los datos del onboarding y, si el perfil es
// "Control total", también los objetivos de macros.
export default function Perfil() {
  const navigate = useNavigate()
  const { perfil, cerrarSesion } = useAuth()

  if (!perfil) return null
  const esControlTotal = perfil.tipo === 'total'

  async function salir() {
    const ok = window.confirm('¿Seguro que quieres cerrar sesión?')
    if (ok) {
      await cerrarSesion()
      navigate('/')
    }
  }

  // Datos para el donut de macros
  const datosMacros = esControlTotal
    ? [
        { nombre: 'Hidratos', valor: perfil.macros.hidratos, color: '#f59e0b' },
        { nombre: 'Proteínas', valor: perfil.macros.proteinas, color: '#ef4444' },
        { nombre: 'Grasas', valor: perfil.macros.grasas, color: '#eab308' },
      ]
    : []

  return (
    <div className="bg-cream min-h-full animate-fade-in pb-6">
      {/* Cabecera con avatar */}
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+2rem)] pb-5 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-brand-500 text-white flex items-center justify-center text-3xl font-black shadow-soft mb-3">
          {perfil.nombre.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-2xl font-black text-gray-800">{perfil.nombre}</h1>
        <div
          className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full mt-2 ${
            esControlTotal
              ? 'bg-brand-100 text-brand-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {esControlTotal ? <Target size={14} /> : <Sparkles size={14} />}
          {esControlTotal ? 'Control total' : 'Modo sencillo'}
        </div>
      </div>

      {/* Datos básicos */}
      <div className="px-5 mb-4">
        <div className="bg-white rounded-3xl p-4 shadow-card space-y-1">
          <Dato icon={Cake} label="Edad" valor={perfil.edad ? `${perfil.edad} años` : '—'} />
          <Dato icon={User} label="Género" valor={perfil.genero} />
          <Dato
            icon={MapPin}
            label="Código postal"
            valor={perfil.codigoPostal || '—'}
          />
        </div>
      </div>

      {/* Comidas del día (editables, máximo 7) */}
      <EditorComidas />

      {/* Macros (solo control total) */}
      {esControlTotal && (
        <div className="px-5 mb-4">
          <h2 className="font-extrabold text-gray-700 mb-3">
            Tus objetivos diarios
          </h2>
          <div className="bg-white rounded-3xl p-4 shadow-card">
            <div className="flex items-center justify-center gap-2 bg-brand-50 text-brand-700 font-extrabold rounded-2xl py-3 mb-4">
              <Flame size={20} /> {perfil.macros.kcal} kcal / día
            </div>

            <div className="flex items-center gap-3">
              <div className="w-28 h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datosMacros}
                      dataKey="valor"
                      nameKey="nombre"
                      innerRadius={32}
                      outerRadius={52}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {datosMacros.map((d) => (
                        <Cell key={d.nombre} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {datosMacros.map((d) => (
                  <div
                    key={d.nombre}
                    className="flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2 font-semibold text-gray-600 text-sm">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.nombre}
                    </span>
                    <span className="font-extrabold text-gray-800">
                      {d.valor}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!esControlTotal && (
        <div className="px-5 mb-4">
          <div className="bg-amber-50 text-amber-700 rounded-3xl p-4 text-sm font-semibold text-center">
            Estás en modo sencillo, sin objetivos de macros. Puedes reiniciar la
            demo y elegir “Control total” para activarlos.
          </div>
        </div>
      )}

      {/* Cerrar sesión */}
      <div className="px-5">
        <button
          onClick={salir}
          className="w-full bg-white text-red-500 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-card active:scale-[0.98] transition"
        >
          <LogOut size={18} /> Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function Dato({ icon: Icon, label, valor }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-9 h-9 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
        <Icon size={18} />
      </div>
      <span className="font-semibold text-gray-500 flex-1">{label}</span>
      <span className="font-bold text-gray-800">{valor}</span>
    </div>
  )
}
