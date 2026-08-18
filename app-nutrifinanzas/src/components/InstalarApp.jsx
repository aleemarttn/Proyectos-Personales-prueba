import { useEffect, useState } from 'react'
import { Download, X, Share, WifiOff } from 'lucide-react'
import { esIOS, appInstalada } from '../lib/dispositivo.js'

const CLAVE_DESCARTADO = 'nutrigasto_instalar_descartado'

// Banner para instalar la app en el móvil + aviso de falta de conexión.
// Si debajo no hay barra de navegación, el aviso respeta la zona de gestos.
export default function InstalarApp({ conBarra = false }) {
  const [evento, setEvento] = useState(null) // Chrome/Android: beforeinstallprompt
  const [visible, setVisible] = useState(false)
  const [sinConexion, setSinConexion] = useState(!navigator.onLine)

  useEffect(() => {
    const descartado = localStorage.getItem(CLAVE_DESCARTADO) === '1'
    if (descartado || appInstalada()) return

    // Android / Chrome de escritorio: el navegador nos cede el momento de pedirlo
    function alPoderInstalar(e) {
      e.preventDefault()
      setEvento(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', alPoderInstalar)

    // iOS no dispara ese evento: mostramos las instrucciones manuales
    if (esIOS()) setVisible(true)

    return () => window.removeEventListener('beforeinstallprompt', alPoderInstalar)
  }, [])

  useEffect(() => {
    const online = () => setSinConexion(false)
    const offline = () => setSinConexion(true)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  function descartar() {
    localStorage.setItem(CLAVE_DESCARTADO, '1')
    setVisible(false)
  }

  async function instalar() {
    if (!evento) return
    evento.prompt()
    await evento.userChoice
    setEvento(null)
    setVisible(false)
  }

  // Hueco extra para la barra de gestos cuando el aviso es lo último en pantalla
  const estiloSeguro = conBarra
    ? undefined
    : { paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }

  if (sinConexion) {
    return (
      <div
        className="shrink-0 bg-gray-800 text-white text-sm font-bold px-4 py-2 flex items-center justify-center gap-2"
        style={estiloSeguro}
      >
        <WifiOff size={16} /> Sin conexión: verás tus últimos datos guardados
      </div>
    )
  }

  if (!visible) return null

  return (
    <div
      className="shrink-0 bg-brand-600 text-white px-4 py-3 flex items-center gap-3 animate-slide-up"
      style={estiloSeguro}
    >
      {evento ? (
        <>
          <Download size={20} className="shrink-0" />
          <p className="flex-1 text-sm font-bold leading-tight">
            Instala NutriGasto en tu móvil
          </p>
          <button
            onClick={instalar}
            className="bg-white text-brand-700 text-sm font-extrabold px-3 py-1.5 rounded-xl active:scale-95 transition"
          >
            Instalar
          </button>
        </>
      ) : (
        <>
          <Share size={20} className="shrink-0" />
          <p className="flex-1 text-sm font-bold leading-tight">
            Para instalarla: <span className="font-normal">Compartir → Añadir a
            pantalla de inicio</span>
          </p>
        </>
      )}
      <button
        onClick={descartar}
        className="text-white/70 active:scale-90 transition"
        aria-label="Cerrar aviso"
      >
        <X size={18} />
      </button>
    </div>
  )
}
