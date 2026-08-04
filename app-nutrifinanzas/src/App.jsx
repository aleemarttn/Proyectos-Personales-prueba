import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './context/AuthContext.jsx'
import { funcionesDe } from './lib/modos.js'
import PhoneFrame from './components/PhoneFrame.jsx'
import BottomNav from './components/BottomNav.jsx'
import InstalarApp from './components/InstalarApp.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import TourGuiado from './components/TourGuiado.jsx'

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
const AnalizarCarta = lazy(() => import('./pages/AnalizarCarta.jsx'))
const ConfirmarCarta = lazy(() => import('./pages/ConfirmarCarta.jsx'))
const Gastos = lazy(() => import('./pages/Gastos.jsx'))
const Recetas = lazy(() => import('./pages/Recetas.jsx'))
const Perfil = lazy(() => import('./pages/Perfil.jsx'))

export default function App() {
  const { sesion, perfil, cargando } = useAuth()
  const location = useLocation()

  // Perfil "completo" = onboarding finalizado (tiene tipo_perfil)
  const perfilCompleto = !!perfil?.tipo

  // Rutas que NO llevan barra de navegación inferior
  const sinBarra = [
    '/',
    '/login',
    '/registro',
    '/onboarding',
    '/escanear',
    '/confirmar-escaneo',
    '/analizar-carta',
    '/confirmar-carta',
  ]
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
        <ErrorBoundary key={location.pathname}>
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

          {/* El diario solo existe en modo completo */}
          <Route path="/diario" element={<SoloDiario><Diario /></SoloDiario>} />
          <Route
            path="/diario/registrar"
            element={<SoloDiario><RegistrarComida /></SoloDiario>}
          />
          <Route path="/anadir" element={<Protegida><AnadirAlimento /></Protegida>} />
          <Route path="/escanear" element={<Protegida><Escanear /></Protegida>} />
          <Route
            path="/confirmar-escaneo"
            element={<Protegida><ConfirmarEscaneo /></Protegida>}
          />
          <Route path="/analizar-carta" element={<Protegida><AnalizarCarta /></Protegida>} />
          <Route
            path="/confirmar-carta"
            element={<Protegida><ConfirmarCarta /></Protegida>}
          />
          <Route path="/gastos" element={<Protegida><Gastos /></Protegida>} />
          <Route path="/recetas" element={<Protegida><Recetas /></Protegida>} />
          <Route path="/perfil" element={<Protegida><Perfil /></Protegida>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </div>

      <InstalarApp conBarra={mostrarBarra} />
      {mostrarBarra && <BottomNav />}
      <TourGuiado activo={mostrarBarra && location.pathname === '/despensa'} />
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

// Como `Protegida`, pero además exige un modo con diario. El modo simple no
// lo tiene, así que si llega por URL escrita a mano o por un enlace viejo lo
// devolvemos a su pantalla de inicio en vez de enseñarle una pantalla vacía.
function SoloDiario({ children }) {
  const { sesion, perfil } = useAuth()
  if (!sesion) return <Navigate to="/" replace />
  if (!perfil?.tipo) return <Navigate to="/onboarding" replace />
  if (!funcionesDe(perfil.tipo).diario) return <Navigate to="/despensa" replace />
  return children
}
