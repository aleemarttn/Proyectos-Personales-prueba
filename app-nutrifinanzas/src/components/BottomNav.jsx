import { NavLink } from 'react-router-dom'
import { Package, UtensilsCrossed, PieChart, ChefHat, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { funcionesDe } from '../lib/modos.js'

// Barra de navegación inferior, estilo app de móvil.
// `requiere` marca las pestañas que solo existen en algunos modos: en modo
// simple la barra se queda en cuatro (sin Diario) y la primera pasa a ser
// la despensa, que es su pantalla de inicio (ver `rutaInicio` en modos.js).
const items = [
  { to: '/diario', icon: UtensilsCrossed, label: 'Diario', requiere: 'diario' },
  { to: '/despensa', icon: Package, label: 'Despensa' },
  { to: '/gastos', icon: PieChart, label: 'Gastos' },
  { to: '/recetas', icon: ChefHat, label: 'Recetas' },
  { to: '/perfil', icon: User, label: 'Perfil' },
]

export default function BottomNav() {
  const { perfil } = useAuth()
  const funciones = funcionesDe(perfil?.tipo)
  const visibles = items.filter((i) => !i.requiere || funciones[i.requiere])

  return (
    <nav
      className="shrink-0 bg-white border-t border-gray-100 px-2 pt-2 flex justify-around"
      // Deja hueco para la barra de gestos del móvil (mínimo 0.75rem)
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {visibles.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          data-tour={`nav-${to.slice(1)}`}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px] py-1 rounded-xl transition-colors ${
              isActive ? 'text-brand-600' : 'text-gray-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive ? 'bg-brand-50 scale-105' : ''
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[11px] font-bold">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
