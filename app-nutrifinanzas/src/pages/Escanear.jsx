import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Camera,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  Receipt,
  Package,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { analizarImagen } from '../lib/ocr.js'

// Escáner real: selector de modo (ticket o producto suelto), captura con
// cámara o galería, previsualización, y análisis con IA (Gemini, vía Edge
// Function). Si el análisis falla, cae al formulario manual (Bloque 4).
export default function Escanear() {
  const navigate = useNavigate()
  const [modo, setModo] = useState(null) // null | 'ticket' | 'producto'
  const [imagen, setImagen] = useState(null) // dataURL de la foto capturada/subida
  const [analizando, setAnalizando] = useState(false)
  const [errorAnalisis, setErrorAnalisis] = useState('')

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  const pararCamara = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const iniciarCamara = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (e) {
      console.error('No se pudo acceder a la cámara:', e)
    }
  }, [])

  useEffect(() => {
    if (modo && !imagen) iniciarCamara()
    return () => pararCamara()
  }, [modo, imagen, iniciarCamara, pararCamara])

  function capturarFoto() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    setImagen(canvas.toDataURL('image/jpeg', 0.9))
    pararCamara()
  }

  function subirDesdeGaleria(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    const lector = new FileReader()
    lector.onload = () => setImagen(lector.result)
    lector.readAsDataURL(archivo)
    pararCamara()
  }

  function repetirFoto() {
    setImagen(null)
    setErrorAnalisis('')
  }

  function cerrar() {
    pararCamara()
    navigate('/despensa')
  }

  async function analizar() {
    setAnalizando(true)
    setErrorAnalisis('')
    try {
      const resultado = await analizarImagen(imagen, modo)
      if (!resultado.items || resultado.items.length === 0) {
        throw new Error('No se detectó ningún producto en la imagen.')
      }
      navigate('/confirmar-escaneo', {
        state: { items: resultado.items, supermercado: resultado.supermercado },
      })
    } catch (e) {
      console.error('Error analizando la imagen:', e)
      setErrorAnalisis(
        'No hemos podido analizar la imagen. Puedes añadir el alimento a mano.'
      )
      setAnalizando(false)
    }
  }

  return (
    <div className="relative h-full bg-gray-900 text-white overflow-hidden animate-fade-in">
      <button
        onClick={cerrar}
        className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center active:scale-95 transition"
      >
        <X size={22} />
      </button>

      {!modo && <SelectorModo onElegir={setModo} />}

      {modo && !imagen && (
        <VisorCamara
          videoRef={videoRef}
          modo={modo}
          onCapturar={capturarFoto}
          onSubir={() => fileInputRef.current?.click()}
        />
      )}

      {modo && imagen && (
        <Previsualizacion
          imagen={imagen}
          modo={modo}
          analizando={analizando}
          error={errorAnalisis}
          onRepetir={repetirFoto}
          onAnalizar={analizar}
          onAnadirManual={() => navigate('/anadir')}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={subirDesdeGaleria}
      />
    </div>
  )
}

function SelectorModo({ onElegir }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 animate-slide-up">
      <p className="text-white/70 font-semibold mb-6 text-center">
        ¿Qué vas a escanear?
      </p>
      <div className="w-full space-y-3">
        <BotonModo
          icono={<Receipt size={24} />}
          titulo="Un ticket de compra"
          subtitulo="Detecta cada producto y su precio"
          onClick={() => onElegir('ticket')}
        />
        <BotonModo
          icono={<Package size={24} />}
          titulo="Un producto suelto"
          subtitulo="Detecta nombre y marca; el precio lo pones tú"
          onClick={() => onElegir('producto')}
        />
      </div>
    </div>
  )
}

function BotonModo({ icono, titulo, subtitulo, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white/10 hover:bg-white/15 rounded-2xl px-5 py-4 flex items-center gap-4 text-left active:scale-[0.98] transition"
    >
      <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center shrink-0">
        {icono}
      </div>
      <div>
        <p className="font-bold">{titulo}</p>
        <p className="text-white/50 text-sm">{subtitulo}</p>
      </div>
    </button>
  )
}

function VisorCamara({ videoRef, modo, onCapturar, onSubir }) {
  return (
    <>
      <div className="absolute inset-0 bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-64 h-64">
          <Esquina clases="top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl" />
          <Esquina clases="top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl" />
          <Esquina clases="bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl" />
          <Esquina clases="bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
        <p className="text-white/80 font-semibold mb-4 text-center">
          {modo === 'ticket' ? 'Apunta al ticket de la compra' : 'Apunta al producto'}
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onSubir}
            className="w-14 h-14 rounded-full bg-white/15 backdrop-blur flex items-center justify-center active:scale-95 transition"
          >
            <ImageIcon size={22} />
          </button>
          <button
            onClick={onCapturar}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center active:scale-95 transition ring-4 ring-white/30"
          >
            <Camera size={26} className="text-gray-800" />
          </button>
          <div className="w-14 h-14" />
        </div>
      </div>
    </>
  )
}

function Previsualizacion({
  imagen,
  modo,
  analizando,
  error,
  onRepetir,
  onAnalizar,
  onAnadirManual,
}) {
  return (
    <>
      <div className="absolute inset-0 bg-black">
        <img src={imagen} alt="Foto capturada" className="w-full h-full object-contain" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent space-y-3">
        {error && (
          <div className="bg-amber-500/15 text-amber-300 text-sm font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {error ? (
          <button
            onClick={onAnadirManual}
            className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft"
          >
            Añadir a mano
          </button>
        ) : (
          <button
            onClick={onAnalizar}
            disabled={analizando}
            className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft disabled:opacity-60"
          >
            {analizando ? (
              <>
                <Loader2 size={20} className="animate-spin" /> Analizando…
              </>
            ) : (
              <>
                <Sparkles size={20} /> Analizar {modo === 'ticket' ? 'ticket' : 'producto'}
              </>
            )}
          </button>
        )}

        {!analizando && (
          <button
            onClick={onRepetir}
            className="w-full bg-white/10 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <RotateCcw size={18} /> Repetir foto
          </button>
        )}
      </div>
    </>
  )
}

function Esquina({ clases }) {
  return <div className={`absolute w-8 h-8 border-brand-400 ${clases}`} />
}
