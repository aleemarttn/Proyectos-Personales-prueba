import { BrowserMultiFormatReader } from '@zxing/browser'

// Decodifica un código de barras (EAN/UPC/etc.) a partir de una foto ya
// capturada (dataURL). Se ejecuta 100% en el cliente, sin llamar a la IA:
// es instantáneo y gratis. Devuelve el texto del código o null si no se
// ha podido leer ninguno en la imagen.
export async function decodificarCodigoBarras(imagenDataUrl) {
  const lector = new BrowserMultiFormatReader()
  try {
    const resultado = await lector.decodeFromImageUrl(imagenDataUrl)
    return resultado.getText()
  } catch {
    // NotFoundException u otro fallo de lectura: no hay código legible.
    return null
  }
}
