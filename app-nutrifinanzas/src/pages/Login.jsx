import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Leaf, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth, traducirErrorAuth } from '../context/AuthContext.jsx'
import { CampoAuth } from './Registro.jsx'

// Pantalla de inicio de sesión (email + contraseña).
export default function Login() {
  const navigate = useNavigate()
  const { iniciarSesion } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const perfil = await iniciarSesion(email.trim(), password)
      // Si el onboarding no está completo (tipo vacío), lo mandamos allí
      navigate(perfil?.tipo ? '/despensa' : '/onboarding')
    } catch (err) {
      setError(traducirErrorAuth(err))
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar bg-cream animate-fade-in px-7 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
      <div className="flex-1 flex flex-col justify-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-500 text-white flex items-center justify-center mb-6 animate-pop">
          <Leaf size={32} strokeWidth={2.2} />
        </div>

        <h1 className="text-3xl font-black text-gray-800 mb-1">
          Bienvenido de nuevo
        </h1>
        <p className="text-gray-500 mb-7">Entra para ver tu despensa.</p>

        <form onSubmit={enviar} className="space-y-4">
          <CampoAuth
            icon={Mail}
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <CampoAuth
            icon={Lock}
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          {error && (
            <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-soft disabled:opacity-70"
          >
            {cargando ? (
              <>
                <Loader2 size={20} className="animate-spin" /> Entrando...
              </>
            ) : (
              <>
                Iniciar sesión <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-gray-500 font-semibold">
        ¿No tienes cuenta?{' '}
        <Link to="/registro" className="text-brand-600 font-extrabold">
          Regístrate
        </Link>
      </p>
    </div>
  )
}
