// Redimensiona y comprime una foto antes de mandarla a la Edge Function.
// Las fotos de la cámara nativa del móvil pueden pesar varios MB (varias
// veces el límite de tamaño de petición de Supabase Edge Functions); esto
// las reduce a un tamaño razonable para OCR sin perder legibilidad del texto.
export function comprimirImagen(archivo, maxDim = 1600, calidad = 0.82) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    lector.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('No se pudo procesar la imagen.'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', calidad),
          mimeType: 'image/jpeg',
        })
      }
      img.src = lector.result
    }
    lector.readAsDataURL(archivo)
  })
}

// Lee un archivo tal cual, en base64, sin pasarlo por canvas. Para la carta
// de restaurante en PDF (AnalizarCarta.jsx): comprimirImagen() destruiría un
// PDF (un canvas solo sabe pintar imágenes), así que un PDF va directo.
export function leerArchivoBase64(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    lector.onload = () => resolve({ dataUrl: lector.result, mimeType: archivo.type })
    lector.readAsDataURL(archivo)
  })
}
