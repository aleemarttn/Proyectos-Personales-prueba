import { useState, useRef } from 'react'
import {
  X,
  Camera,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  Loader2,
  AlertTriangle,
  ScanLine,
} from 'lucide-react'
import { analizarNutricion } from '../lib/ocr.js'
import { comprimirImagen } from '../utils/imagen.js'

// Modal a pantalla completa para fotografiar la TABLA DE INFORMACIÓN
// NUTRICIONAL de un producto. Al detectar los macros (por 100 g/ml) llama
// a onDetectado(nutricion) y se cierra. Reutilizable desde cualquier
// formulario (Añadir alimento, Confirmar escaneo…).
//
// La foto se toma con la CÁMARA NATIVA del sistema (input file con
// capture="environment"), no con una vista de cámara en vivo (getUserMedia):
// Safari/iOS no da autoenfoque de macro fiable en getUserMedia, y para leer
// una etiqueta pequeña de cerca hace falta el enfoque de la app de cámara
// nativa. La galería usa el mismo input sin "capture".
export default function EscanerNutricional({ onCerrar, onDetectado }) {
  const [imagen, setImagen] = useState(null)
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [analizando, setAnalizando] = useState(false)
  const [error, setError] = useState('')

  const camaraRef = useRef(null)
  const galeriaRef = useRef(null)

  async function elegirArchivo(e) {
    const archivo = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo si se repite
    if (!archivo) return
    setError('')
    try {
      const { dataUrl, mimeType: tipo } = await comprimirImagen(archivo)
      setImagen(dataUrl)
      setMimeType(tipo)
    } catch (err) {
      console.error('Error procesando la foto:', err)
      setError('No hemos podido procesar la foto. Prueba con otra.')
    }
  }

  function repetirFoto() {
    setImagen(null)
    setError('')
  }

  async function analizar() {
    setAnalizando(true)
    setError('')
    try {
      const nutricion = await analizarNutricion(imagen, mimeType)
      const algo =
        nutricion &&
        [nutricion.kcal, nutricion.proteinas, nutricion.hidratos, nutricion.grasas]
          .some((v) => v !== null && v !== undefined)
      if (!algo) {
        throw new Error('No se detectó información nutricional.')
      }
      onDetectado(nutricion)
    } catch (e) {
      console.error('Error analizando la etiqueta nutricional:', e)
      setError('No hemos podido leer la etiqueta. Repite la foto o escribe los macros a mano.')
      setAnalizando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 text-white overflow-hidden animate-fade-in">
      <button
        onClick={onCerrar}
        className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center active:scale-95 transition"
      >
        <X size={22} />
      </button>

      {!imagen && (
        <div className="h-full flex flex-col items-center justify-center px-8 text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/20 flex items-center justify-center mb-5">
            <ScanLine size={30} className="text-brand-400" />
          </div>
          <p className="font-bold text-lg mb-1.5">Información nutricional</p>
          <p className="text-white/60 text-sm mb-8 max-w-[260px]">
            Haz una foto nítida de la tabla de información nutricional, normalmente
            en la parte de atrás o el lateral del envase.
          </p>

          {error && (
            <div className="bg-amber-500/15 text-amber-300 text-sm font-semibold rounded-xl px-4 py-3 flex items-start gap-2 mb-4 max-w-xs">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="w-full max-w-xs space-y-3">
            <button
              onClick={() => camaraRef.current?.click()}
              className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft"
            >
              <Camera size={20} /> Hacer foto
            </button>
            <button
              onClick={() => galeriaRef.current?.click()}
              className="w-full bg-white/10 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <ImageIcon size={18} /> Elegir de la galería
            </button>
          </div>
        </div>
      )}

      {imagen && (
        <>
          <div className="absolute inset-0 bg-black">
            <img src={imagen} alt="Etiqueta capturada" className="w-full h-full object-contain" />
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent space-y-3">
            {error && (
              <div className="bg-amber-500/15 text-amber-300 text-sm font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={analizar}
              disabled={analizando}
              className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft disabled:opacity-60"
            >
              {analizando ? (
                <>
                  <Loader2 size={20} className="animate-spin" /> Leyendo etiqueta…
                </>
              ) : (
                <>
                  <Sparkles size={20} /> Leer macros
                </>
              )}
            </button>

            {!analizando && (
              <button
                onClick={repetirFoto}
                className="w-full bg-white/10 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                <RotateCcw size={18} /> Repetir foto
              </button>
            )}
          </div>
        </>
      )}

      {/* capture="environment" abre la cámara nativa del sistema (con
          autoenfoque real) en vez de una vista de cámara propia */}
      <input
        ref={camaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={elegirArchivo}
      />
      <input
        ref={galeriaRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={elegirArchivo}
      />
    </div>
  )
}
