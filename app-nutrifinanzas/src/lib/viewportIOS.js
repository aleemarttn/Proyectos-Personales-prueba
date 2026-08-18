import { esIOS, appInstalada } from './dispositivo.js'

// Bug conocido de WebKit en apps instaladas en iOS (standalone, "Añadir a
// pantalla de inicio"): la PRIMERA vez que se abre el teclado en la sesión,
// `visualViewport.height` / `window.innerHeight` (y por tanto `100dvh`, que
// PhoneFrame.jsx usa para la altura total) se encogen y YA NO SE RECUPERAN
// al cerrar el teclado — se quedan cortos el resto de la sesión, aunque el
// teclado ya no esté en pantalla.
//
// El síntoma que reportó el usuario ("una vez se instala como acceso
// directo, la parte de abajo no está bien encuadrada") es justo eso: la
// franja gris que aparece bajo la barra de navegación es el fondo de
// html/body (#e8eae6, ver index.css) asomando por el hueco que deja
// PhoneFrame al quedarse corto de alto.
//
// No hay arreglo de CSS puro (ni position:fixed;inset:0 lo evita: eso
// también se ancla al viewport ya encogido). El único arreglo conocido es
// forzar a WebKit a remedir el viewport ocultando y volviendo a mostrar la
// raíz de la app (un reflow síncrono) justo después de cerrar el teclado.
// Fuente: https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d
//
// Solo se activa en iOS instalado: en el resto de plataformas (Android,
// escritorio, o iOS dentro de Safari) el bug no existe y esto no hace nada.
export function iniciarArregloViewportIOS() {
  if (typeof window === 'undefined' || !esIOS() || !appInstalada()) return

  let maxAlto = 0

  function altoActual() {
    return window.visualViewport ? window.visualViewport.height : window.innerHeight
  }

  function medir() {
    const alto = altoActual()
    if (alto > maxAlto) maxAlto = alto
  }

  function curar() {
    medir()
    // Margen de 4px: no cada teclado deja el viewport exactamente igual
    // (redondeos), así que un margen pequeño evita reflows de sobra.
    if (maxAlto - altoActual() <= 4) return

    const raiz = document.getElementById('root')
    if (!raiz) return
    raiz.style.display = 'none'
    void raiz.offsetHeight // fuerza el reflow síncrono antes de reaparecer
    raiz.style.display = ''
  }

  medir()
  window.addEventListener('resize', medir)
  window.visualViewport?.addEventListener('resize', medir)

  // El encogido se "cura" al CERRAR el teclado, no al abrirlo: hay que
  // esperar a que la animación del teclado termine de bajar antes de medir,
  // si no se remide a mitad de la transición. `focusout` (a diferencia de
  // `blur`) burbujea, así que un único listener en el documento cubre
  // cualquier campo de cualquier pantalla, sin tocarlas una a una.
  document.addEventListener(
    'focusout',
    () => setTimeout(curar, 150),
    true
  )
}
