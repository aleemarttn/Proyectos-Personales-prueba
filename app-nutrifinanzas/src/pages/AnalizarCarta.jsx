import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Camera,
  Image as ImageIcon,
  Sparkles,
  UtensilsCrossed,
  Loader2,
  AlertTriangle,
  QrCode,
  Link2,
  Plus,
  Trash2,
  ArrowLeft,
  Flashlight,
  FileText,
} from 'lucide-react'
import { analizarCarta } from '../lib/ocr.js'
import { comprimirImagen, leerArchivoBase64 } from '../utils/imagen.js'
import { iniciarEscaner, traducirErrorCamara } from '../lib/escanerBarras.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useDiario } from '../context/DiarioContext.jsx'
import { esCompleto } from '../lib/modos.js'
import { objetivoRestanteHoy } from '../lib/macros.js'

const MAX_PAGINAS = 6

// Modo Restaurante (PLAN-modo-restaurante.md): la carta rara vez cabe en una
// sola foto (varias hojas) o directamente no es una foto (QR de la mesa que
// lleva a un PDF o a una web). Tres entradas, todas resueltas por el mismo
// modo 'carta' de la Edge Function:
//   - Fotos: una o varias páginas (o un PDF elegido de la galería).
//   - Escanear QR: cámara en vivo, mismo motor que el código de barras de
//     Escanear.jsx (lib/escanerBarras.js), con el perfil 'qr'.
//   - Pegar enlace: para quien ya tiene la carta abierta en el navegador.
//
// En modo completo se manda además el margen de macros que le queda hoy al
// usuario (DiarioContext.resumen), para que la recomendación no sea "lo más
// sano en abstracto" sino "lo que mejor encaja en lo que le queda hoy".
export default function AnalizarCarta() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { resumen } = useDiario()

  const [vista, setVista] = useState('inicio') // 'inicio' | 'fotos' | 'qr' | 'pegar'
  const [paginas, setPaginas] = useState([]) // [{ dataUrl, mimeType, esPdf }]
  const [enlace, setEnlace] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [error, setError] = useState('')

  const camaraRef = useRef(null)
  const galeriaRef = useRef(null)

  function volverInicio() {
    setVista('inicio')
    setPaginas([])
    setEnlace('')
    setError('')
  }

  async function elegirArchivos(e) {
    const archivos = Array.from(e.target.files || [])
    e.target.value = ''
    if (archivos.length === 0) return
    setError('')

    if (paginas.length + archivos.length > MAX_PAGINAS) {
      setError(`Como mucho ${MAX_PAGINAS} páginas por carta.`)
      return
    }

    try {
      const nuevas = []
      for (const archivo of archivos) {
        if (archivo.type === 'application/pdf') {
          const { dataUrl, mimeType } = await leerArchivoBase64(archivo)
          nuevas.push({ dataUrl, mimeType, esPdf: true })
        } else {
          const { dataUrl, mimeType } = await comprimirImagen(archivo)
          nuevas.push({ dataUrl, mimeType, esPdf: false })
        }
      }
      setPaginas((prev) => [...prev, ...nuevas])
      setVista('fotos')
    } catch (err) {
      console.error('Error procesando la carta:', err)
      setError('No hemos podido procesar ese archivo. Prueba con otro.')
    }
  }

  function quitarPagina(indice) {
    setPaginas((prev) => prev.filter((_, i) => i !== indice))
  }

  async function analizarPaginas() {
    if (paginas.length === 0 || analizando) return
    await analizar({ paginas })
  }

  async function analizarEnlace() {
    const limpio = enlace.trim()
    if (!limpio || analizando) return
    try {
      const url = new URL(limpio)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocolo')
    } catch {
      setError('Ese enlace no parece válido. Cópialo entero, con https:// incluido.')
      return
    }
    await analizar({ url: limpio })
  }

  async function analizar(entrada) {
    setAnalizando(true)
    setError('')
    try {
      const objetivoRestante = esCompleto(perfil?.tipo) ? objetivoRestanteHoy(resumen) : null

      const resultado = await analizarCarta({ ...entrada, objetivoRestante })
      if (!resultado.platos || resultado.platos.length === 0) {
        throw new Error('No se detectó ningún plato en la carta.')
      }
      navigate('/confirmar-carta', {
        state: {
          platos: resultado.platos,
          recomendadoIndice: resultado.recomendadoIndice,
          motivo: resultado.motivo,
          conObjetivo: !!objetivoRestante,
          procedencia: entrada.paginas
            ? `${entrada.paginas.length} ${entrada.paginas.length === 1 ? 'página analizada' : 'páginas analizadas'}`
            : 'Carta del enlace',
        },
      })
    } catch (e) {
      console.error('Error analizando la carta:', e)
      setError(e.message || 'No hemos podido analizar la carta. Prueba con fotos más nítidas.')
      setAnalizando(false)
    }
  }

  function onQrDetectado(valor) {
    let url
    try {
      url = new URL(valor)
    } catch {
      setError('Ese QR no lleva a un enlace de carta.')
      setVista('inicio')
      return
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      setError('Ese QR no lleva a un enlace de carta.')
      setVista('inicio')
      return
    }
    analizar({ url: url.toString() })
  }

  return (
    <div className="relative h-full bg-gray-900 text-white overflow-hidden animate-fade-in">
      <button
        onClick={() => (vista === 'inicio' ? navigate('/despensa') : volverInicio())}
        className="absolute top-[calc(env(safe-area-inset-top)+1.25rem)] right-5 z-20 w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center active:scale-95 transition"
        disabled={analizando}
      >
        {vista === 'inicio' ? <X size={22} /> : <ArrowLeft size={22} />}
      </button>

      {vista === 'inicio' && (
        <div className="h-full flex flex-col items-center justify-center px-8 text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/20 flex items-center justify-center mb-5">
            <UtensilsCrossed size={30} className="text-brand-400" />
          </div>
          <p className="font-bold text-lg mb-1.5">¿Qué pido?</p>
          <p className="text-white/60 text-sm mb-8 max-w-[260px]">
            Fotografía la carta (aunque sean varias páginas), escanea el QR de la mesa o pega
            el enlace de la carta.
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
              <ImageIcon size={18} /> Elegir fotos o un PDF
            </button>
            <button
              onClick={() => {
                setError('')
                setVista('qr')
              }}
              className="w-full bg-white/10 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <QrCode size={18} /> Escanear QR de la mesa
            </button>
            <button
              onClick={() => {
                setError('')
                setVista('pegar')
              }}
              className="w-full bg-white/10 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <Link2 size={18} /> Pegar enlace de la carta
            </button>
          </div>
        </div>
      )}

      {vista === 'fotos' && (
        <div className="h-full flex flex-col animate-fade-in">
          <div className="flex-1 overflow-y-auto px-5 pt-[calc(env(safe-area-inset-top)+4.5rem)] pb-4">
            <p className="font-bold text-lg mb-1">Páginas de la carta</p>
            <p className="text-white/50 text-sm mb-4">
              Añade una foto por cada página. Si has elegido un PDF, ya está listo para
              analizar.
            </p>

            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {paginas.map((p, i) => (
                <div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black">
                  {p.esPdf ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-white/10">
                      <FileText size={26} className="text-white/70" />
                      <span className="text-[11px] font-bold text-white/60">PDF</span>
                    </div>
                  ) : (
                    <img src={p.dataUrl} alt={`Página ${i + 1}`} className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => quitarPagina(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center active:scale-90 transition"
                    aria-label="Quitar página"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {paginas.length < MAX_PAGINAS && (
                <button
                  onClick={() => camaraRef.current?.click()}
                  className="aspect-[3/4] rounded-xl border-2 border-dashed border-white/25 flex flex-col items-center justify-center gap-1 text-white/50 active:scale-95 transition"
                >
                  <Plus size={22} />
                  <span className="text-[11px] font-bold">Añadir</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3 bg-gradient-to-t from-black/80 to-transparent space-y-3">
            {error && (
              <div className="bg-amber-500/15 text-amber-300 text-sm font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <button
              onClick={analizarPaginas}
              disabled={analizando || paginas.length === 0}
              className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft disabled:opacity-50"
            >
              {analizando ? (
                <>
                  <Loader2 size={20} className="animate-spin" /> Analizando la carta…
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Analizar carta {paginas.length > 0 && `(${paginas.length})`}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {vista === 'qr' && (
        <VisorQr
          onDetectado={onQrDetectado}
          onErrorCamara={(e) => {
            setError(traducirErrorCamara(e))
            setVista('inicio')
          }}
          analizando={analizando}
        />
      )}

      {vista === 'pegar' && (
        <div className="h-full flex flex-col justify-center px-6 pt-[calc(env(safe-area-inset-top)+2rem)] animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/20 flex items-center justify-center mb-4 mx-auto">
            <Link2 size={26} className="text-brand-400" />
          </div>
          <p className="font-bold text-lg text-center mb-1.5">Pegar enlace de la carta</p>
          <p className="text-white/60 text-sm text-center mb-6">
            Si ya has abierto la carta en el navegador (o te la han pasado por WhatsApp),
            pega aquí el enlace.
          </p>

          <input
            type="url"
            inputMode="url"
            autoFocus
            placeholder="https://..."
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            className="w-full bg-white/10 text-white placeholder-white/40 rounded-2xl px-4 py-3.5 font-semibold outline-none focus:ring-2 focus:ring-brand-400 mb-4"
          />

          {error && (
            <div className="bg-amber-500/15 text-amber-300 text-sm font-semibold rounded-xl px-4 py-3 flex items-start gap-2 mb-4">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={analizarEnlace}
            disabled={analizando || !enlace.trim()}
            className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft disabled:opacity-50"
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
        </div>
      )}

      <input
        ref={camaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={elegirArchivos}
      />
      <input
        ref={galeriaRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={elegirArchivos}
      />
    </div>
  )
}

// Visor en vivo del QR de la mesa: mismo motor de cámara que el código de
// barras de Escanear.jsx (lib/escanerBarras.js), con el perfil 'qr' (recorte
// cuadrado, una sola lectura para confirmar).
function VisorQr({ onDetectado, onErrorCamara, analizando }) {
  const videoRef = useRef(null)
  const controlesRef = useRef(null)
  const [linterna, setLinterna] = useState(false)
  const [tieneLinterna, setTieneLinterna] = useState(false)

  useEffect(() => {
    let desmontado = false

    iniciarEscaner(videoRef.current, onDetectado, onErrorCamara, 'qr').then((controles) => {
      controlesRef.current = controles
      if (desmontado) {
        controles.detener()
        return
      }
      setTieneLinterna(controles.tieneLinterna)
    })

    return () => {
      desmontado = true
      controlesRef.current?.detener()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function alternarLinterna() {
    const nueva = !linterna
    setLinterna(nueva)
    controlesRef.current?.alternarLinterna(nueva)
  }

  return (
    <div className="h-full animate-fade-in">
      <div className="absolute inset-0 bg-black">
        <video ref={videoRef} muted playsInline autoPlay className="w-full h-full object-cover" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-64 h-64">
          <EsquinaQr clases="top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl" />
          <EsquinaQr clases="top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl" />
          <EsquinaQr clases="bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl" />
          <EsquinaQr clases="bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl" />
        </div>
      </div>

      {tieneLinterna && (
        <button
          onClick={alternarLinterna}
          className={`absolute top-[calc(env(safe-area-inset-top)+1.25rem)] left-5 z-20 w-11 h-11 rounded-full backdrop-blur flex items-center justify-center active:scale-95 transition ${
            linterna ? 'bg-white text-gray-900' : 'bg-white/15 text-white'
          }`}
          aria-label="Linterna"
        >
          <Flashlight size={20} />
        </button>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] bg-gradient-to-t from-black/70 to-transparent">
        <p className="text-white/80 font-semibold text-center flex items-center justify-center gap-2">
          {analizando ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Analizando la carta…
            </>
          ) : (
            <>
              <QrCode size={18} /> Apunta al QR de la mesa
            </>
          )}
        </p>
      </div>
    </div>
  )
}

function EsquinaQr({ clases }) {
  return <div className={`absolute w-9 h-9 border-brand-400 ${clases}`} />
}
