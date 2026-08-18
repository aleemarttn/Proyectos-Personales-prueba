// Comprobaciones de plataforma compartidas entre InstalarApp.jsx (banner de
// instalación) y viewportIOS.js (parche del bug de altura). Antes vivían
// duplicadas dentro de InstalarApp.jsx.

export function esIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

// ¿La app ya se está usando instalada (no dentro del navegador)?
export function appInstalada() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}
