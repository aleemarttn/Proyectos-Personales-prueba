// Motor de lectura de códigos en vivo con la cámara: códigos de BARRAS de
// producto (EAN/UPC) y códigos QR (el de la carta en la mesa del
// restaurante, ver AnalizarCarta.jsx).
//
// Los dos casos comparten todo lo caro de resolver — pedir la cámara
// trasera, enfoque continuo, esperar a que el vídeo tenga dimensiones
// reales en iOS, la linterna, el bucle de intentos — y se diferencian solo
// en cuatro cosas, que viven en PERFILES: qué lector usar, qué formatos
// pedirle al detector nativo, qué trozo del fotograma recortar y cuántas
// lecturas iguales exigimos antes de dar el código por bueno.
//
// Antes esto era una llamada a `decodeFromConstraints` de @zxing/browser con
// los ajustes por defecto, y era LENTO por cuatro motivos que aquí se
// corrigen uno a uno:
//
//   1. @zxing/browser espera `delayBetweenScanAttempts: 500 ms` por defecto
//      (ver node_modules/@zxing/browser/esm/readers/BrowserCodeReader.js),
//      o sea 2 intentos por segundo. Aquí llevamos el bucle nosotros, a
//      ~16 intentos por segundo.
//   2. Sin restricción de resolución el navegador da 640x480, donde las
//      barras de un EAN-13 apenas se resuelven. Pedimos 1920x1080.
//   3. Se decodificaba el fotograma ENTERO. Recortamos la banda central
//      (la que marca el recuadro guía), que es lo único que importa.
//   4. `BrowserMultiFormatReader` prueba también formatos 2D (QR, Aztec,
//      PDF417, DataMatrix). Usamos el lector 1D, que es lo que hay en un
//      producto de supermercado.
//
// Además, si el navegador trae la API nativa `BarcodeDetector` (Chrome en
// Android usa el motor del propio sistema) se usa esa, que es bastante más
// rápida que decodificar en JavaScript. Safari/iOS no la tiene todavía, así
// que ahí corre la ruta ZXing afinada.

import { BrowserMultiFormatOneDReader, BrowserQRCodeReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

// Cada cuánto intentamos decodificar un fotograma. 60 ms ≈ 16 intentos/s:
// suficiente para que se sienta instantáneo sin freír la CPU del móvil.
const MS_ENTRE_INTENTOS = 60

export const PERFILES = {
  barras: {
    formatosZxing: [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ],
    // Los mismos formatos, con los nombres de la API nativa BarcodeDetector.
    formatosNativos: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
    // Banda central del ÁREA VISIBLE en pantalla que se decodifica (ver
    // rectangulizarRecorte), en proporción. Un código de barras es ancho y
    // bajo, así que cogemos casi todo el ancho y poca altura. Coincide con
    // el recuadro guía que ve el usuario en Escanear.jsx.
    recorte: { ancho: 0.92, alto: 0.42 },
    // Un EAN-13 mal leído es raro (lleva dígito de control), pero un EAN-8 o
    // un UPC-E sí se cuelan de vez en cuando. Exigimos leer el mismo código
    // dos veces seguidas antes de darlo por bueno: al ritmo de arriba cuesta
    // ~60 ms y elimina prácticamente los falsos positivos.
    lecturasParaConfirmar: 2,
    crearLector: (hints) =>
      new BrowserMultiFormatOneDReader(hints, {
        delayBetweenScanAttempts: MS_ENTRE_INTENTOS,
        delayBetweenScanSuccess: MS_ENTRE_INTENTOS,
      }),
  },
  qr: {
    formatosZxing: [BarcodeFormat.QR_CODE],
    formatosNativos: ['qr_code'],
    // Un QR es cuadrado y el usuario lo encuadra entero, así que aquí el
    // recorte es un cuadrado de verdad (cuadrado: true, ver
    // rectangulizarRecorte), con el mismo lado (75% del ANCHO del
    // contenedor) que el recuadro guía cuadrado de AnalizarCarta.jsx
    // (`w-[75%] aspect-square`): lo que el usuario ve dentro del recuadro
    // es exactamente lo que se decodifica.
    recorte: { cuadrado: true, lado: 0.75 },
    // El QR lleva corrección de errores Reed-Solomon: si decodifica, es
    // correcto. Confirmar dos veces solo añadiría latencia.
    lecturasParaConfirmar: 1,
    crearLector: (hints) =>
      new BrowserQRCodeReader(hints, {
        delayBetweenScanAttempts: MS_ENTRE_INTENTOS,
        delayBetweenScanSuccess: MS_ENTRE_INTENTOS,
      }),
  },
}

async function hayDetectorNativo(formatosNativos) {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return false
  try {
    const soportados = await window.BarcodeDetector.getSupportedFormats()
    return formatosNativos.some((f) => soportados.includes(f))
  } catch {
    return false
  }
}

// Pide la cámara trasera a la mayor resolución razonable. `ideal` en vez de
// `exact` a propósito: si el móvil no puede dar 1920x1080 preferimos que
// entregue lo que pueda antes que fallar con OverconstrainedError.
async function abrirCamara() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  })

  // Enfoque continuo: sin esto la cámara enfoca una vez al abrirse y ya.
  // Es una constraint no estándar; Safari la ignora, Chrome/Android la
  // aplica. Va en su propio try porque algunos navegadores lanzan en vez
  // de ignorarla.
  const track = stream.getVideoTracks()[0]
  try {
    const caps = track.getCapabilities?.() || {}
    const advanced = []
    if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' })
    if (advanced.length) await track.applyConstraints({ advanced })
  } catch (e) {
    console.debug('El enfoque continuo no está disponible en este navegador:', e)
  }

  return { stream, track }
}

// El <video> se pinta con `object-cover` (llena el contenedor recortando lo
// que sobre), así que sus píxeles NATIVOS (video.videoWidth/Height, la
// resolución que pidió la cámara) casi nunca coinciden con lo que el
// usuario ve en pantalla: object-cover escala el vídeo hasta cubrir el
// contenedor y recorta el eje que sobra. Decodificar un % del fotograma
// NATIVO (como se hacía antes) recorta una zona que no es la que se ve, y
// el recuadro guía en CSS (un % del contenedor) tampoco coincide con ella.
// Con el código de barras (banda ancha y baja) el desajuste casi no se
// notaba; con el QR (recuadro cuadrado y más ajustado) sí falla: el código
// puede quedar fuera de la zona real que se decodifica aunque el usuario lo
// vea centrado en el recuadro guía.
//
// Este cálculo deshace el `object-cover` a mano: primero halla qué parte
// del fotograma nativo es la que realmente se ve (recortando lo que
// object-cover recorta), y aplica `recorte` sobre ESA zona visible, no
// sobre el fotograma entero. Así lo que se decodifica es lo que el
// recuadro guía (ver AnalizarCarta.jsx y Escanear.jsx) le muestra al usuario.
//
// `recorte` admite dos formas:
//   - { ancho, alto }: rectángulo, cada fracción sobre su eje. Vale para el
//     código de barras (recuadro CSS ancho fijo en % + alto fijo en px: ya
//     era una aproximación antes de este cambio, y lo sigue siendo, pero en
//     la dirección segura — decodifica algo más de lo que se ve, nunca menos).
//   - { cuadrado: true, lado }: un cuadrado de verdad. OJO, esto NO es lo
//     mismo que { ancho: lado, alto: lado }: el contenedor en pantalla casi
//     nunca es cuadrado (390×700, por ejemplo), así que aplicar la misma
//     fracción a visibleW y a visibleH por separado da un RECTÁNGULO, no un
//     cuadrado — 0.75 de 601 de ancho visible y 0.75 de 1080 de alto visible
//     no son el mismo lado. El QR necesita un cuadrado real, así que el
//     lado se calcula una sola vez a partir del ANCHO del contenedor (el
//     mismo criterio que usa `w-[75%] aspect-square` en CSS) y se aplica
//     igual a ambos ejes tras deshacer la escala de object-cover.
function rectangulizarRecorte(video, recorte) {
  const videoW = video.videoWidth
  const videoH = video.videoHeight
  const contenedorW = video.clientWidth
  const contenedorH = video.clientHeight
  if (!videoW || !videoH || !contenedorW || !contenedorH) return null

  const escala = Math.max(contenedorW / videoW, contenedorH / videoH)
  const visibleW = contenedorW / escala
  const visibleH = contenedorH / escala
  const offsetX = (videoW - visibleW) / 2
  const offsetY = (videoH - visibleH) / 2

  let ancho, alto
  if (recorte.cuadrado) {
    // Acotado a lo que quepa en el eje visible más corto: con el móvil en
    // horizontal (contenedor más ancho que alto) el 75% del ancho puede
    // superar la altura visible, y un cuadrado no puede ser más alto que
    // lo que hay para recortar.
    const lado = Math.min(
      Math.round((contenedorW * recorte.lado) / escala),
      Math.floor(visibleW),
      Math.floor(visibleH)
    )
    ancho = lado
    alto = lado
  } else {
    ancho = Math.round(visibleW * recorte.ancho)
    alto = Math.round(visibleH * recorte.alto)
  }

  const x = Math.round(offsetX + (visibleW - ancho) / 2)
  const y = Math.round(offsetY + (visibleH - alto) / 2)
  return { x, y, ancho, alto }
}

// Espera a que el vídeo tenga dimensiones reales. En iOS el elemento puede
// estar "reproduciendo" con videoWidth 0 durante unos fotogramas, y dibujar
// eso en el canvas da una imagen vacía.
function esperarVideoListo(video) {
  return new Promise((resolve, reject) => {
    let rendido = false
    const limite = setTimeout(() => {
      rendido = true // corta el bucle de requestAnimationFrame
      reject(new Error('La cámara ha tardado demasiado en arrancar.'))
    }, 8000)

    const comprobar = () => {
      if (rendido) return
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        clearTimeout(limite)
        resolve()
      } else {
        requestAnimationFrame(comprobar)
      }
    }
    comprobar()
  })
}

/**
 * Arranca el escáner sobre un <video> ya montado.
 *
 * @param {HTMLVideoElement} video
 * @param {(codigo: string) => void} onDetectado  se llama UNA vez y el escáner se detiene solo
 * @param {(error: Error) => void} onError
 * @param {'barras' | 'qr'} tipo  qué se está buscando (ver PERFILES)
 * @returns {Promise<{detener: () => void, tieneLinterna: boolean, alternarLinterna: (on: boolean) => Promise<void>}>}
 */
export async function iniciarEscaner(video, onDetectado, onError, tipo = 'barras') {
  const perfil = PERFILES[tipo] || PERFILES.barras
  let activo = true
  let temporizador = null
  let stream = null
  let track = null

  const detener = () => {
    activo = false
    clearTimeout(temporizador)
    stream?.getTracks().forEach((t) => t.stop())
    if (video) video.srcObject = null
  }

  try {
    ;({ stream, track } = await abrirCamara())
    if (!activo) {
      // Se desmontó el componente mientras pedíamos permiso de cámara.
      stream.getTracks().forEach((t) => t.stop())
      return { detener, tieneLinterna: false, alternarLinterna: async () => {} }
    }

    video.srcObject = stream
    video.setAttribute('playsinline', 'true') // iOS: sin esto abre a pantalla completa
    video.muted = true
    await video.play()
    await esperarVideoListo(video)

    const usarNativo = await hayDetectorNativo(perfil.formatosNativos)
    const detector = usarNativo
      ? new window.BarcodeDetector({ formats: perfil.formatosNativos })
      : null

    let lector = null
    if (!usarNativo) {
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, perfil.formatosZxing)
      // TRY_HARDER hace que el lector pruebe más líneas/orientaciones del
      // fotograma. Cuesta unos milisegundos más por intento pero acierta
      // bastante antes cuando el código está algo torcido.
      hints.set(DecodeHintType.TRY_HARDER, true)
      lector = perfil.crearLector(hints)
    }

    // Canvas fuera de pantalla donde recortamos la banda central.
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    let ultimoCodigo = null
    let repeticiones = 0

    const confirmar = (codigo) => {
      if (!codigo) return false
      if (codigo === ultimoCodigo) {
        repeticiones += 1
      } else {
        ultimoCodigo = codigo
        repeticiones = 1
      }
      return repeticiones >= perfil.lecturasParaConfirmar
    }

    const intentar = async () => {
      if (!activo) return

      const rect = rectangulizarRecorte(video, perfil.recorte)
      if (rect && rect.ancho > 0 && rect.alto > 0) {
        if (canvas.width !== rect.ancho || canvas.height !== rect.alto) {
          canvas.width = rect.ancho
          canvas.height = rect.alto
        }
        ctx.drawImage(
          video,
          rect.x,
          rect.y,
          rect.ancho,
          rect.alto,
          0,
          0,
          rect.ancho,
          rect.alto
        )

        let codigo = null
        if (usarNativo) {
          try {
            const encontrados = await detector.detect(canvas)
            codigo = encontrados?.[0]?.rawValue || null
          } catch {
            // detect() falla si el canvas aún no tiene contenido válido.
          }
        } else {
          try {
            codigo = lector.decodeFromCanvas(canvas).getText()
          } catch {
            // NotFoundException en cada fotograma sin código: es lo normal.
          }
        }

        if (codigo && confirmar(codigo)) {
          detener()
          onDetectado(codigo)
          return
        }
      }

      if (activo) temporizador = setTimeout(intentar, MS_ENTRE_INTENTOS)
    }

    intentar()

    // La linterna ayuda mucho con envases brillantes y poca luz. Chrome en
    // Android la expone; Safari/iOS todavía no, y ahí el botón no se pinta.
    const capacidades = track.getCapabilities?.() || {}
    const tieneLinterna = !!capacidades.torch

    return {
      detener,
      tieneLinterna,
      alternarLinterna: async (encendida) => {
        if (!tieneLinterna) return
        try {
          await track.applyConstraints({ advanced: [{ torch: encendida }] })
        } catch (e) {
          console.debug('No se pudo cambiar la linterna:', e)
        }
      },
    }
  } catch (e) {
    detener()
    onError?.(e)
    return { detener, tieneLinterna: false, alternarLinterna: async () => {} }
  }
}

// Mensaje claro según por qué ha fallado el acceso a la cámara.
export function traducirErrorCamara(error) {
  const nombre = error?.name || ''
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError')
    return 'No has dado permiso de cámara. Actívalo en los ajustes del navegador para escanear.'
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError')
    return 'No hemos encontrado una cámara trasera utilizable en este dispositivo.'
  if (nombre === 'NotReadableError')
    return 'Otra aplicación está usando la cámara. Ciérrala e inténtalo de nuevo.'
  return 'No se pudo abrir la cámara. Inténtalo de nuevo o añade el alimento a mano.'
}
