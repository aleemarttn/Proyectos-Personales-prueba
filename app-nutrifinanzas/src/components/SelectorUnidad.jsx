import { UNIDADES } from '../utils/unidades.js'

// Interruptor gramos / mililitros. Un alimento sólido se mide en g y una
// bebida en ml; los macros de la etiqueta vienen "por 100" de esa unidad.
export default function SelectorUnidad({ valor, onChange, size = 'normal' }) {
  const compacto = size === 'compacto'
  return (
    <div className="flex gap-1 bg-gray-100 rounded-xl p-1 shrink-0">
      {UNIDADES.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={`rounded-lg font-bold transition ${
            compacto ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
          } ${
            (valor === 'ml' ? 'ml' : 'g') === u
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-gray-400'
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  )
}
