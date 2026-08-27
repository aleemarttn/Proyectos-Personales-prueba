import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// Capa a pantalla completa (fichas, escáner) montada DENTRO del marco del
// móvil en vez de sobre el <body>.
//
// Antes usaban `position: fixed`, que se mide siempre contra la ventana del
// navegador y no contra el marco. En un ordenador eso hacía que el panel
// ocupara todo el ancho de la ventana, se anclara a su borde inferior y se
// saliera del móvil: la parte de abajo (la información nutricional) quedaba
// fuera de la vista y casi no quedaba fondo oscuro que tocar para cerrar.
// Aquí se monta dentro de #marco-app, que es `relative` y del tamaño exacto
// del móvil, así que `absolute inset-0` lo encaja justo encima de la app.
//
// Además cierra con la tecla Escape, que en escritorio es lo que se espera.
export default function CapaModal({ children, onCerrar, className = '' }) {
  useEffect(() => {
    if (!onCerrar) return
    function alPulsarTecla(e) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alPulsarTecla)
    return () => window.removeEventListener('keydown', alPulsarTecla)
  }, [onCerrar])

  const marco = document.getElementById('marco-app') || document.body

  return createPortal(
    <div className={`absolute inset-0 ${className}`}>{children}</div>,
    marco,
  )
}
