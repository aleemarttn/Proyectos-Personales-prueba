// Motor de lectura de códigos de barras en vivo.
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

import { BrowserMultiFormatOneDReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

const FORMATOS_ZXING = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
]

// Los mismos formatos, con los nombres que usa la API nativa BarcodeDetector.
const FORMATOS_NATIVOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

// Cada cuánto intentamos decodificar un fotograma. 60 ms ≈ 16 intentos/s:
// suficiente para que se sienta instantáneo sin freír la CPU del móvil.
const MS_ENTRE_INTENTOS = 60

// Banda central del fotograma que se decodifica, en proporción sobre el
// total. Un código de barras es ancho y bajo, así que cogemos casi todo el
// ancho y poca altura. Coincide con el recuadro guía que ve el usuario.
const RECORTE = { ancho: 0.92, alto: 0.42 }

// Un EAN-13 mal leído es raro (lleva dígito de control), pero un EAN-8 o un
// UPC-E sí se cuelan de vez en cuando. Exigimos leer el mismo código dos
// veces seguidas antes de darlo por bueno: al ritmo de arriba cuesta ~60 ms
// y elimina prácticamente los falsos positivos.
const LECTURAS_PARA_CONFIRMAR = 2

async function hayDetectorNativo() {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return false
  try {
    const soportados = await window.BarcodeDetector.getSupportedFormats()
    return FORMATOS_NATIVOS.some((f) => soportados.includes(f))
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
 * @returns {Promise<{detener: () => void, tieneLinterna: boolean, alternarLinterna: (on: boolean) => Promise<void>}>}
 */
export async function iniciarEscaner(video, onDetectado, onError) {
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

    const usarNativo = await hayDetectorNativo()
    const detector = usarNativo
      ? new window.BarcodeDetector({ formats: FORMATOS_NATIVOS })
      : null

    let lector = null
    if (!usarNativo) {
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATOS_ZXING)
      // TRY_HARDER hace que el lector 1D pruebe más líneas del fotograma.
      // Cuesta unos milisegundos más por intento pero acierta bastante
      // antes cuando el código está algo torcido.
      hints.set(DecodeHintType.TRY_HARDER, true)
      lector = new BrowserMultiFormatOneDReader(hints, {
        delayBetweenScanAttempts: MS_ENTRE_INTENTOS,
        delayBetweenScanSuccess: MS_ENTRE_INTENTOS,
      })
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
      return repeticiones >= LECTURAS_PARA_CONFIRMAR
    }

    const intentar = async () => {
      if (!activo) return

      const anchoRecorte = Math.round(video.videoWidth * RECORTE.ancho)
      const altoRecorte = Math.round(video.videoHeight * RECORTE.alto)
      if (anchoRecorte > 0 && altoRecorte > 0) {
        if (canvas.width !== anchoRecorte || canvas.height !== altoRecorte) {
          canvas.width = anchoRecorte
          canvas.height = altoRecorte
        }
        ctx.drawImage(
          video,
          Math.round((video.videoWidth - anchoRecorte) / 2),
          Math.round((video.videoHeight - altoRecorte) / 2),
          anchoRecorte,
          altoRecorte,
          0,
          0,
          anchoRecorte,
          altoRecorte
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
