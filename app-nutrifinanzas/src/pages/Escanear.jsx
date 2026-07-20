import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ScanLine, Loader2, Check } from 'lucide-react'
import { ESCANEOS_SIMULADOS } from '../data/escaneos.js'

// Escáner SIMULADO. No usa cámara ni OCR real:
//   1) Muestra una "cámara" con marco de escaneo.
//   2) Al pulsar, spinner ~1,5s ("analizando ticket").
//   3) Elige uno de los tickets preparados y va al formulario ya relleno.
export default function Escanear() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState('listo') // listo | escaneando | detectado
  const [resultado, setResultado] = useState(null)

  function escanear() {
    setEstado('escaneando')
    // Elegimos un ticket al azar de los preparados
    const elegido =
      ESCANEOS_SIMULADOS[Math.floor(Math.random() * ESCANEOS_SIMULADOS.length)]

    setTimeout(() => {
      setResultado(elegido)
      setEstado('detectado')
    }, 1600)
  }

  // Cuando se detecta, esperamos un momento y saltamos al formulario relleno
  useEffect(() => {
    if (estado === 'detectado' && resultado) {
      const t = setTimeout(() => {
        navigate('/anadir', {
          state: {
            prefill: {
              ...resultado.alimento,
              supermercado: resultado.supermercado,
            },
          },
        })
      }, 1100)
      return () => clearTimeout(t)
    }
  }, [estado, resultado, navigate])

  return (
    <div className="relative h-full bg-gray-900 text-white overflow-hidden animate-fade-in">
      {/* Botón cerrar */}
      <button
        onClick={() => navigate('/despensa')}
        className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center active:scale-95 transition"
      >
        <X size={22} />
      </button>

      {/* "Visor" de cámara simulado */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center">
        {/* Ticket falso dibujado dentro del visor */}
        <div className="w-56 bg-white rounded-lg p-4 text-gray-700 shadow-2xl rotate-[-2deg] opacity-95">
          <div className="text-center font-black text-sm mb-2 tracking-wide">
            {resultado?.supermercado || 'SUPERMERCADO'}
          </div>
          <div className="space-y-1.5">
            {[70, 55, 80, 45, 65].map((w, i) => (
              <div
                key={i}
                className="h-2 bg-gray-200 rounded"
                style={{ width: w + '%' }}
              />
            ))}
          </div>
          <div className="border-t border-dashed border-gray-300 mt-3 pt-2 flex justify-between text-xs font-bold">
            <span>TOTAL</span>
            <span>{resultado ? resultado.alimento.precio + ' €' : '—'}</span>
          </div>
        </div>
      </div>

      {/* Marco de escaneo con línea animada */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-64 h-64">
          <Esquina clases="top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl" />
          <Esquina clases="top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl" />
          <Esquina clases="bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl" />
          <Esquina clases="bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl" />

          {estado === 'escaneando' && (
            <div className="absolute left-2 right-2 h-1 bg-brand-400 rounded-full shadow-[0_0_12px_2px_rgba(74,222,128,0.8)] animate-scan" />
          )}
        </div>
      </div>

      {/* Panel inferior con el estado y el botón */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
        {estado === 'listo' && (
          <div className="text-center animate-slide-up">
            <p className="text-white/80 font-semibold mb-4">
              Apunta al ticket de la compra
            </p>
            <button
              onClick={escanear}
              className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft"
            >
              <ScanLine size={22} /> Escanear ticket
            </button>
            <p className="text-white/40 text-xs mt-3">
              Demo: rellena un ticket de ejemplo automáticamente
            </p>
          </div>
        )}

        {estado === 'escaneando' && (
          <div className="text-center animate-fade-in py-2">
            <Loader2 size={36} className="animate-spin mx-auto text-brand-400" />
            <p className="text-white font-bold mt-3">Analizando ticket…</p>
            <p className="text-white/50 text-sm">Leyendo productos y precios</p>
          </div>
        )}

        {estado === 'detectado' && (
          <div className="text-center animate-pop py-2">
            <div className="w-14 h-14 rounded-full bg-brand-500 flex items-center justify-center mx-auto">
              <Check size={32} />
            </div>
            <p className="text-white font-bold mt-3">
              ¡Detectado: {resultado.alimento.nombre}!
            </p>
            <p className="text-white/50 text-sm">Abriendo formulario…</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Esquina({ clases }) {
  return (
    <div className={`absolute w-8 h-8 border-brand-400 ${clases}`} />
  )
}
