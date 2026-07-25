import { useState, useRef } from 'react'
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
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { analizarImagen } from '../lib/ocr.js'
import { comprimirImagen } from '../utils/imagen.js'
import { decodificarCodigoBarras } from '../lib/barcode.js'
import { buscarProductoPorCodigoBarras } from '../lib/productos.js'

// Escáner real: selector de modo (ticket o producto suelto), captura con
// la CÁMARA NATIVA del sistema o galería, previsualización, y análisis con
// IA (Gemini, vía Edge Function). Si el análisis falla, cae al formulario
// manual (Bloque 4).
//
// La foto se toma con la cámara nativa (input file capture="environment"),
// no con una vista de cámara en vivo (getUserMedia): Safari/iOS no da
// autoenfoque fiable en getUserMedia, y para leer texto pequeño (ticket,
// etiqueta) hace falta el enfoque de la app de cámara nativa.
export default function Escanear() {
  const navigate = useNavigate()
  const [modo, setModo] = useState(null) // null | 'ticket' | 'producto' | 'codigo_barras'
  const [imagen, setImagen] = useState(null) // dataURL de la foto capturada/subida
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [analizando, setAnalizando] = useState(false)
  const [errorAnalisis, setErrorAnalisis] = useState('')
  // Código de barras leído que no estaba en el catálogo compartido: se
  // adjunta al producto una vez identificado por foto, para poder guardarlo
  // en el catálogo al confirmar (Bloque "Fase 3").
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

  // Cambia al modo 'producto' de toda la vida (foto + IA) sin perder el
  // código de barras ya leído, para poder identificar un producto que no
  // estaba en el catálogo compartido.
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

  // Lee el código de barras de la foto (100% local, sin IA) y busca el
  // producto en el catálogo compartido. Si ya lo conoce la comunidad, va
  // directo a confirmar sin más fotos; si no, pide identificarlo con una
  // foto normal del envase.
  async function leerCodigoBarras() {
    setAnalizando(true)
    setErrorAnalisis('')
    try {
      const codigo = await decodificarCodigoBarras(imagen)
      if (!codigo) {
        setErrorAnalisis(
          'No hemos podido leer el código de barras. Acércate más y que se vea nítido, o prueba con "Producto suelto".'
        )
        setAnalizando(false)
        return
      }

      const producto = await buscarProductoPorCodigoBarras(codigo)
      if (producto) {
        navigate('/confirmar-escaneo', {
          state: {
            items: [
              {
                nombre: producto.nombre,
                marca: producto.marca,
                precio: null,
                categoria_sugerida: producto.categoria,
                kcal: producto.kcal,
                proteinas: producto.proteinas,
                hidratos: producto.hidratos,
                grasas: producto.grasas,
                codigoBarras: producto.codigoBarras,
                encontradoEnCatalogo: true,
              },
            ],
            supermercado: null,
          },
        })
        return
      }

      // Código leído pero producto no está aún en el catálogo compartido.
      setCodigoBarrasPendiente(codigo)
      identificarProductoNuevo()
    } catch (e) {
      console.error('Error leyendo el código de barras:', e)
      setErrorAnalisis('No hemos podido leer el código de barras. Inténtalo de nuevo.')
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
        <SelectorFoto
          modo={modo}
          error={errorAnalisis}
          aviso={
            modo === 'producto' && avisoCodigoNuevo
              ? 'No lo teníamos en el catálogo compartido. Identifícalo con una foto y la próxima vez será instantáneo para todos.'
              : ''
          }
          onCamara={() => camaraRef.current?.click()}
          onGaleria={() => galeriaRef.current?.click()}
        />
      )}

      {modo && imagen && (
        <Previsualizacion
          imagen={imagen}
          modo={modo}
          analizando={analizando}
          error={errorAnalisis}
          onRepetir={repetirFoto}
          onAnalizar={modo === 'codigo_barras' ? leerCodigoBarras : analizar}
          onAnadirManual={() => navigate('/anadir')}
          onEscanearSinCodigo={
            modo === 'codigo_barras'
              ? () => {
                  setCodigoBarrasPendiente(null)
                  setModo('producto')
                  setImagen(null)
                  setErrorAnalisis('')
                }
              : null
          }
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
          subtitulo="Al instante si ya lo escaneó otro usuario"
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
    ) : modo === 'codigo_barras' ? (
      <ScanBarcode size={30} className="text-brand-400" />
    ) : (
      <Package size={30} className="text-brand-400" />
    )
  const titulo =
    modo === 'ticket' ? 'Ticket de compra' : modo === 'codigo_barras' ? 'Código de barras' : 'Producto suelto'
  const descripcion =
    modo === 'ticket'
      ? 'Haz una foto nítida y completa del ticket, con todos los productos visibles.'
      : modo === 'codigo_barras'
        ? 'Encuadra bien el código de barras, cerca y sin reflejos.'
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

function Previsualizacion({
  imagen,
  modo,
  analizando,
  error,
  onRepetir,
  onAnalizar,
  onAnadirManual,
  onEscanearSinCodigo,
}) {
  const textoBoton =
    modo === 'codigo_barras'
      ? 'Leer código de barras'
      : `Analizar ${modo === 'ticket' ? 'ticket' : 'producto'}`

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
          <>
            {onEscanearSinCodigo && (
              <button
                onClick={onEscanearSinCodigo}
                className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft"
              >
                <Package size={20} /> Escanear producto suelto
              </button>
            )}
            <button
              onClick={onAnadirManual}
              className="w-full bg-white/10 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              Añadir a mano
            </button>
          </>
        ) : (
          <button
            onClick={onAnalizar}
            disabled={analizando}
            className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft disabled:opacity-60"
          >
            {analizando ? (
              <>
                <Loader2 size={20} className="animate-spin" />{' '}
                {modo === 'codigo_barras' ? 'Leyendo…' : 'Analizando…'}
              </>
            ) : (
              <>
                {modo === 'codigo_barras' ? <ScanBarcode size={20} /> : <Sparkles size={20} />}{' '}
                {textoBoton}
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
