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
  ScanBarcode,
  Barcode,
  Loader2,
  AlertTriangle,
  Flashlight,
} from 'lucide-react'
import { analizarImagen } from '../lib/ocr.js'
import { comprimirImagen } from '../utils/imagen.js'
import { consultarOpenFoodFacts } from '../lib/barcode.js'
import { buscarProductoPorCodigoBarras } from '../lib/productos.js'
import { iniciarEscaner, traducirErrorCamara } from '../lib/escanerBarras.js'

// Escáner real: selector de modo (ticket, producto suelto o código de
// barras), captura con la CÁMARA NATIVA del sistema o galería para ticket/
// producto, y análisis con IA (Gemini, vía Edge Function). Si el análisis
// falla, cae al formulario manual (Bloque 4).
//
// Para ticket/producto la foto se toma con la cámara nativa (input file
// capture="environment"), no con una vista de cámara en vivo (getUserMedia):
// Safari/iOS no da autoenfoque fiable en getUserMedia, y para leer texto
// pequeño (ticket, etiqueta) hace falta el enfoque de la app de cámara
// nativa. El código de barras es distinto: ahí sí usamos getUserMedia en
// vivo (sin botón de disparo) porque decodificar un patrón de barras no
// necesita ese enfoque fino y así el escaneo es instantáneo. El motor de
// lectura vive en lib/escanerBarras.js.
export default function Escanear() {
  const navigate = useNavigate()
  const [modo, setModo] = useState(null) // null | 'ticket' | 'producto' | 'codigo_barras'
  const [imagen, setImagen] = useState(null) // dataURL de la foto capturada/subida
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [analizando, setAnalizando] = useState(false)
  const [errorAnalisis, setErrorAnalisis] = useState('')
  // Estado del visor en vivo de código de barras.
  const [estadoBarra, setEstadoBarra] = useState('escaneando') // 'escaneando' | 'buscando' | 'error_camara'
  // Código de barras leído que no estaba ni en el catálogo compartido ni en
  // Open Food Facts: se adjunta al producto una vez identificado por foto,
  // para poder guardarlo en el catálogo al confirmar.
  const [codigoBarrasPendiente, setCodigoBarrasPendiente] = useState(null)
  const [avisoCodigoNuevo, setAvisoCodigoNuevo] = useState(false)

  const camaraRef = useRef(null)
  const galeriaRef = useRef(null)

  async function elegirArchivo(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setErrorAnalisis('')
    try {
      const { dataUrl, mimeType: tipo } = await comprimirImagen(archivo)
      setImagen(dataUrl)
      setMimeType(tipo)
    } catch (err) {
      console.error('Error procesando la foto:', err)
      setErrorAnalisis('No hemos podido procesar la foto. Prueba con otra.')
    }
  }

  function repetirFoto() {
    setImagen(null)
    setErrorAnalisis('')
  }

  function cerrar() {
    navigate('/despensa')
  }

  function elegirModo(m) {
    setModo(m)
    setEstadoBarra('escaneando')
  }

  // Cambia al modo 'producto' de toda la vida (foto + IA) sin perder el
  // código de barras ya leído, para poder identificar un producto que no
  // estaba ni en el catálogo compartido ni en Open Food Facts.
  function identificarProductoNuevo() {
    setModo('producto')
    setImagen(null)
    setErrorAnalisis('')
    setAvisoCodigoNuevo(true)
  }

  async function analizar() {
    setAnalizando(true)
    setErrorAnalisis('')
    try {
      const resultado = await analizarImagen(imagen, modo, mimeType)
      if (!resultado.items || resultado.items.length === 0) {
        throw new Error('No se detectó ningún producto en la imagen.')
      }
      // Si veníamos de leer un código de barras nuevo, lo adjuntamos al
      // primer producto detectado para poder sumarlo al catálogo al guardar.
      const items = codigoBarrasPendiente
        ? resultado.items.map((it, i) =>
            i === 0 ? { ...it, codigoBarras: codigoBarrasPendiente } : it
          )
        : resultado.items
      navigate('/confirmar-escaneo', {
        state: { items, supermercado: resultado.supermercado },
      })
    } catch (e) {
      console.error('Error analizando la imagen:', e)
      setErrorAnalisis(
        'No hemos podido analizar la imagen. Puedes añadir el alimento a mano.'
      )
      setAnalizando(false)
    }
  }

  // La cámara no ha podido abrirse (permiso denegado, en uso por otra app…).
  const manejarErrorCamara = useCallback((e) => {
    console.error('No se pudo acceder a la cámara:', e)
    setErrorAnalisis(traducirErrorCamara(e))
    setEstadoBarra('error_camara')
  }, [])

  // Un código de barras se acaba de leer con la cámara en vivo. Primero
  // miramos el catálogo compartido en Supabase (instantáneo); si no está,
  // consultamos Open Food Facts para autocompletar sin pedir foto ni IA;
  // si tampoco tiene información, caemos al flujo de foto + IA de siempre.
  const manejarCodigoDetectado = useCallback(
    async (codigo) => {
      setEstadoBarra('buscando')
      try {
        const delCatalogo = await buscarProductoPorCodigoBarras(codigo)
        if (delCatalogo) {
          navigate('/confirmar-escaneo', {
            state: {
              items: [
                {
                  nombre: delCatalogo.nombre,
                  marca: delCatalogo.marca,
                  precio: null,
                  categoria_sugerida: delCatalogo.categoria,
                  kcal: delCatalogo.kcal,
                  proteinas: delCatalogo.proteinas,
                  hidratos: delCatalogo.hidratos,
                  grasas: delCatalogo.grasas,
                  codigoBarras: delCatalogo.codigoBarras,
                  // Lo que ya aportó la comunidad: sin esto se perdía y
                  // había que volver a escribirlo en cada escaneo.
                  pesoUnidadG: delCatalogo.pesoUnidadG,
                  unidadNombre: delCatalogo.unidadNombre,
                  unidadMedida: delCatalogo.unidadMedida,
                  encontradoEnCatalogo: true,
                },
              ],
              supermercado: null,
            },
          })
          return
        }

        const deOpenFoodFacts = await consultarOpenFoodFacts(codigo)
        if (deOpenFoodFacts.encontrado) {
          navigate('/confirmar-escaneo', {
            state: {
              items: [
                {
                  nombre: deOpenFoodFacts.nombre,
                  marca: deOpenFoodFacts.marca,
                  precio: null,
                  // Cantidad del envase tal como la publica Open Food
                  // Facts ("330 ml", "1 kg"): de ahí sale también la unidad.
                  cantidad: deOpenFoodFacts.cantidad,
                  categoria_sugerida: deOpenFoodFacts.categoria,
                  kcal: deOpenFoodFacts.kcal,
                  proteinas: deOpenFoodFacts.proteinas,
                  hidratos: deOpenFoodFacts.hidratos,
                  grasas: deOpenFoodFacts.grasas,
                  codigoBarras: codigo,
                  unidadMedida: deOpenFoodFacts.unidadMedida,
                  encontradoEnCatalogo: false,
                },
              ],
              supermercado: null,
            },
          })
          return
        }

        // Ni en el catálogo compartido ni en Open Food Facts: identificarlo
        // con una foto normal del envase.
        setCodigoBarrasPendiente(codigo)
        identificarProductoNuevo()
      } catch (e) {
        console.error('Error buscando el producto por código de barras:', e)
        setEstadoBarra('error_camara')
        setErrorAnalisis('No se pudo consultar la información del producto. Comprueba tu conexión.')
      }
    },
    [navigate]
  )

  return (
    <div className="relative h-full bg-gray-900 text-white overflow-hidden animate-fade-in">
      <button
        onClick={cerrar}
        className="absolute top-[calc(env(safe-area-inset-top)+1.25rem)] right-5 z-20 w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center active:scale-95 transition"
      >
        <X size={22} />
      </button>

      {!modo && <SelectorModo onElegir={elegirModo} />}

      {modo === 'codigo_barras' && estadoBarra === 'escaneando' && (
        <VisorCodigoBarras
          onDetectado={manejarCodigoDetectado}
          onErrorCamara={manejarErrorCamara}
          onSinCodigo={() => {
            setCodigoBarrasPendiente(null)
            setModo('producto')
          }}
        />
      )}

      {modo === 'codigo_barras' && estadoBarra === 'buscando' && (
        <PantallaEstado icono={<Loader2 size={36} className="animate-spin" />}>
          Buscando información del producto…
        </PantallaEstado>
      )}

      {modo === 'codigo_barras' && estadoBarra === 'error_camara' && (
        <SinInformacion
          error={errorAnalisis}
          onReintentar={() => {
            setErrorAnalisis('')
            setEstadoBarra('escaneando')
          }}
          onAnadirManual={() => navigate('/anadir')}
        />
      )}

      {(modo === 'ticket' || modo === 'producto') && !imagen && (
        <SelectorFoto
          modo={modo}
          error={errorAnalisis}
          aviso={
            modo === 'producto' && avisoCodigoNuevo
              ? 'No lo teníamos ni en el catálogo compartido ni en Open Food Facts. Identifícalo con una foto y la próxima vez será instantáneo para todos.'
              : ''
          }
          onCamara={() => camaraRef.current?.click()}
          onGaleria={() => galeriaRef.current?.click()}
        />
      )}

      {(modo === 'ticket' || modo === 'producto') && imagen && (
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
        <BotonModo
          icono={<ScanBarcode size={24} />}
          titulo="Código de barras"
          subtitulo="Al instante si ya lo conoce la comunidad o Open Food Facts"
          onClick={() => onElegir('codigo_barras')}
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

function SelectorFoto({ modo, error, aviso, onCamara, onGaleria }) {
  const icono =
    modo === 'ticket' ? (
      <Receipt size={30} className="text-brand-400" />
    ) : (
      <Package size={30} className="text-brand-400" />
    )
  const titulo = modo === 'ticket' ? 'Ticket de compra' : 'Producto suelto'
  const descripcion =
    modo === 'ticket'
      ? 'Haz una foto nítida y completa del ticket, con todos los productos visibles.'
      : 'Haz una foto del envase donde se vea bien el nombre y la marca.'

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center animate-slide-up">
      <div className="w-16 h-16 rounded-2xl bg-brand-500/20 flex items-center justify-center mb-5">
        {icono}
      </div>
      <p className="font-bold text-lg mb-1.5">{titulo}</p>
      <p className="text-white/60 text-sm mb-8 max-w-[260px]">{descripcion}</p>

      {aviso && (
        <div className="bg-brand-500/15 text-brand-300 text-sm font-semibold rounded-xl px-4 py-3 mb-4 max-w-xs">
          {aviso}
        </div>
      )}

      {error && (
        <div className="bg-amber-500/15 text-amber-300 text-sm font-semibold rounded-xl px-4 py-3 flex items-start gap-2 mb-4 max-w-xs">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={onCamara}
          className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft"
        >
          <Camera size={20} /> Hacer foto
        </button>
        <button
          onClick={onGaleria}
          className="w-full bg-white/10 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition"
        >
          <ImageIcon size={18} /> Elegir de la galería
        </button>
      </div>
    </div>
  )
}

// Visor en vivo del código de barras: cámara siempre encendida (sin botón
// de disparo), decodificando la banda central de cada fotograma hasta
// encontrar un EAN/UPC. Toda la lógica de cámara y decodificación está en
// lib/escanerBarras.js.
function VisorCodigoBarras({ onDetectado, onSinCodigo, onErrorCamara }) {
  const videoRef = useRef(null)
  const controlesRef = useRef(null)
  const [linterna, setLinterna] = useState(false)
  const [tieneLinterna, setTieneLinterna] = useState(false)

  useEffect(() => {
    let desmontado = false

    iniciarEscaner(videoRef.current, onDetectado, onErrorCamara).then((controles) => {
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
  }, [onDetectado, onErrorCamara])

  function alternarLinterna() {
    const nueva = !linterna
    setLinterna(nueva)
    controlesRef.current?.alternarLinterna(nueva)
  }

  return (
    <>
      <div className="absolute inset-0 bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="w-full h-full object-cover"
        />
      </div>

      {/* El recuadro guía marca la banda que realmente se decodifica
          (RECORTE en lib/escanerBarras.js): lo que ves es lo que se lee. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-[92%] h-32">
          <Esquina clases="top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl" />
          <Esquina clases="top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl" />
          <Esquina clases="bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl" />
          <Esquina clases="bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl" />
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
        <p className="text-white/80 font-semibold mb-4 text-center flex items-center justify-center gap-2">
          <Barcode size={18} /> Apunta al código de barras del producto
        </p>
        <button
          onClick={onSinCodigo}
          className="w-full bg-white/10 text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition"
        >
          No tiene código de barras / hacer foto
        </button>
      </div>
    </>
  )
}

function Esquina({ clases }) {
  return <div className={`absolute w-8 h-8 border-brand-400 ${clases}`} />
}

function PantallaEstado({ icono, children }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center animate-fade-in">
      <div className="mb-4 text-white/80">{icono}</div>
      <p className="text-white/80 font-semibold">{children}</p>
    </div>
  )
}

function SinInformacion({ error, onReintentar, onAnadirManual }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center animate-fade-in">
      <AlertTriangle className="text-amber-400 mb-3" size={40} />
      <p className="font-bold text-white/90 mb-1">
        No se pudo consultar la información del producto.
      </p>
      <p className="text-white/50 text-sm mb-6">
        {error || 'Comprueba tu conexión e inténtalo de nuevo, o añade el alimento a mano.'}
      </p>
      <div className="w-full space-y-3">
        <button
          onClick={onReintentar}
          className="w-full bg-brand-500 text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft"
        >
          <RotateCcw size={20} /> Volver a intentar
        </button>
        <button
          onClick={onAnadirManual}
          className="w-full bg-white/10 text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition"
        >
          Añadir a mano
        </button>
      </div>
    </div>
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

      <div className="absolute bottom-0 left-0 right-0 p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] bg-gradient-to-t from-black/80 to-transparent space-y-3">
        {error && (
          <div className="bg-amber-500/15 text-amber-300 text-sm font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {error ? (
          <button
            onClick={onAnadirManual}
            className="w-full bg-white/10 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition"
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
