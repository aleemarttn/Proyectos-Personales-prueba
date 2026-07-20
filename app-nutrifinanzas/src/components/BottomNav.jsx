import { NavLink } from 'react-router-dom'
import { Package, PieChart, ChefHat, User } from 'lucide-react'

// Barra de navegación inferior, estilo app de móvil.
const items = [
  { to: '/despensa', icon: Package, label: 'Despensa' },
  { to: '/gastos', icon: PieChart, label: 'Gastos' },
  { to: '/recetas', icon: ChefHat, label: 'Recetas' },
  { to: '/perfil', icon: User, label: 'Perfil' },
]

export default function BottomNav() {
  return (
    <nav className="shrink-0 bg-white border-t border-gray-100 px-2 pt-2 pb-3 flex justify-around">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors ${
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
