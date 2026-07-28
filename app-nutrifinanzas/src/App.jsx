import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './context/AuthContext.jsx'
import PhoneFrame from './components/PhoneFrame.jsx'
import BottomNav from './components/BottomNav.jsx'
import InstalarApp from './components/InstalarApp.jsx'

// Pantallas de entrada: van en el paquete inicial porque son lo primero que se ve
import Bienvenida from './pages/Bienvenida.jsx'
import Login from './pages/Login.jsx'
import Registro from './pages/Registro.jsx'

// El resto se descarga solo al entrar en cada pantalla, para que la app
// abra rápido con datos móviles (el escáner y las gráficas pesan bastante).
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'))
const Despensa = lazy(() => import('./pages/Despensa.jsx'))
const Diario = lazy(() => import('./pages/Diario.jsx'))
const RegistrarComida = lazy(() => import('./pages/RegistrarComida.jsx'))
const AnadirAlimento = lazy(() => import('./pages/AnadirAlimento.jsx'))
const Escanear = lazy(() => import('./pages/Escanear.jsx'))
const ConfirmarEscaneo = lazy(() => import('./pages/ConfirmarEscaneo.jsx'))
const Gastos = lazy(() => import('./pages/Gastos.jsx'))
const Recetas = lazy(() => import('./pages/Recetas.jsx'))
const Perfil = lazy(() => import('./pages/Perfil.jsx'))

export default function App() {
  const { sesion, perfil, cargando } = useAuth()
  const location = useLocation()

  // Perfil "completo" = onboarding finalizado (tiene tipo_perfil)
  const perfilCompleto = !!perfil?.tipo

  // Rutas que NO llevan barra de navegación inferior
  const sinBarra = ['/', '/login', '/registro', '/onboarding', '/escanear', '/confirmar-escaneo']
  const mostrarBarra =
    sesion && perfilCompleto && !sinBarra.includes(location.pathname)

  // Mientras comprobamos la sesión inicial evitamos parpadeos de redirección
  if (cargando) {
    return (
      <PhoneFrame>
        <Cargando />
      </PhoneFrame>
    )
  }

  return (
    <PhoneFrame>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <Suspense fallback={<Cargando />}>
        <Routes>
          {/* Públicas */}
          <Route path="/" element={<Bienvenida />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />

          {/* Requiere sesión, pero permite perfil incompleto */}
          <Route
            path="/onboarding"
            element={
              <SoloSesion>
                {perfilCompleto ? (
                  <Navigate to="/despensa" replace />
                ) : (
                  <Onboarding />
                )}
              </SoloSesion>
            }
          />

          {/* Requieren sesión + perfil completo */}
          <Route path="/despensa" element={<Protegida><Despensa /></Protegida>} />
          <Route path="/diario" element={<Protegida><Diario /></Protegida>} />
          <Route path="/diario/registrar" element={<Protegida><RegistrarComida /></Protegida>} />
          <Route path="/anadir" element={<Protegida><AnadirAlimento /></Protegida>} />
          <Route path="/escanear" element={<Protegida><Escanear /></Protegida>} />
          <Route
            path="/confirmar-escaneo"
            element={<Protegida><ConfirmarEscaneo /></Protegida>}
          />
          <Route path="/gastos" element={<Protegida><Gastos /></Protegida>} />
          <Route path="/recetas" element={<Protegida><Recetas /></Protegida>} />
          <Route path="/perfil" element={<Protegida><Perfil /></Protegida>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </div>

      <InstalarApp conBarra={mostrarBarra} />
      {mostrarBarra && <BottomNav />}
    </PhoneFrame>
  )
}

// Pantalla de espera mientras se carga la sesión o el trozo de código de la ruta.
function Cargando() {
  return (
    <div className="flex-1 h-full flex items-center justify-center bg-cream">
      <Loader2 className="animate-spin text-brand-500" size={32} />
    </div>
  )
}

// Requiere solo que haya sesión iniciada (usada por el onboarding).
function SoloSesion({ children }) {
  const { sesion } = useAuth()
  if (!sesion) return <Navigate to="/" replace />
  return children
}

// Requiere sesión Y perfil completo. Si falta el perfil, manda al onboarding.
function Protegida({ children }) {
  const { sesion, perfil } = useAuth()
  if (!sesion) return <Navigate to="/" replace />
  if (!perfil?.tipo) return <Navigate to="/onboarding" replace />
  return children
}
