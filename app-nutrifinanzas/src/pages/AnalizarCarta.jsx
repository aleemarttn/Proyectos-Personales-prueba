import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Camera,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  UtensilsCrossed,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { analizarCarta } from '../lib/ocr.js'
import { comprimirImagen } from '../utils/imagen.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useDiario } from '../context/DiarioContext.jsx'
import { esCompleto } from '../lib/modos.js'
import { objetivoRestanteHoy } from '../lib/macros.js'

// Modo Restaurante (PLAN-modo-restaurante.md): foto de la carta -> Gemini
// identifica los platos y recomienda uno. Mismo patrón de captura que
// Escanear.jsx (cámara nativa, no getUserMedia, para que el enfoque lea
// bien texto pequeño), pero sin selector de modo: aquí solo hay una cosa
// que fotografiar.
//
// En modo completo se manda además el margen de macros que le queda hoy al
// usuario (DiarioContext.resumen), para que la recomendación no sea "lo más
// sano en abstracto" sino "lo que mejor encaja en lo que le queda hoy".
export default function AnalizarCarta() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { resumen } = useDiario()

  const [imagen, setImagen] = useState(null)
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [analizando, setAnalizando] = useState(false)
  const [error, setError] = useState('')

  const camaraRef = useRef(null)
  const galeriaRef = useRef(null)

  async function elegirArchivo(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
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
      const objetivoRestante = esCompleto(perfil?.tipo) ? objetivoRestanteHoy(resumen) : null

      const resultado = await analizarCarta(imagen, mimeType, objetivoRestante)
      if (!resultado.platos || resultado.platos.length === 0) {
        throw new Error('No se detectó ningún plato en la carta.')
      }
      navigate('/confirmar-carta', {
        state: {
          platos: resultado.platos,
          recomendadoIndice: resultado.recomendadoIndice,
          motivo: resultado.motivo,
          conObjetivo: !!objetivoRestante,
        },
      })
    } catch (e) {
      console.error('Error analizando la carta:', e)
      setError(e.message || 'No hemos podido analizar la carta. Prueba con una foto más nítida.')
      setAnalizando(false)
    }
  }

  return (
    <div className="relative h-full bg-gray-900 text-white overflow-hidden animate-fade-in">
      <button
        onClick={() => navigate('/despensa')}
        className="absolute top-[calc(env(safe-area-inset-top)+1.25rem)] right-5 z-20 w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center active:scale-95 transition"
      >
        <X size={22} />
      </button>

      {!imagen && (
        <div className="h-full flex flex-col items-center justify-center px-8 text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/20 flex items-center justify-center mb-5">
            <UtensilsCrossed size={30} className="text-brand-400" />
          </div>
          <p className="font-bold text-lg mb-1.5">Foto del restaurante</p>
          <p className="text-white/60 text-sm mb-8 max-w-[260px]">
            Haz una foto nítida de la carta, con los platos y sus nombres visibles.
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
            <img src={imagen} alt="Foto de la carta" className="w-full h-full object-contain" />
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] bg-gradient-to-t from-black/80 to-transparent space-y-3">
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
                  <Loader2 size={20} className="animate-spin" /> Analizando la carta…
                </>
              ) : (
                <>
                  <Sparkles size={20} /> Analizar carta
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
