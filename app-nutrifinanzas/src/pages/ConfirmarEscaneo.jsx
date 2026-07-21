import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { CATEGORIAS, SUPERMERCADOS } from '../data/categorias.js'

// Bloque 3: muestra los alimentos que detectó la IA a partir del ticket o
// producto escaneado, y deja editarlos antes de guardarlos todos en la
// despensa. Si se llega aquí sin datos (recarga directa, etc.) volvemos
// al escáner.
export default function ConfirmarEscaneo() {
  const navigate = useNavigate()
  const location = useLocation()
  const { agregarAlimento } = useApp()

  const detectados = location.state?.items || []
  const supermercadoInicial = location.state?.supermercado || 'Mercadona'

  const [supermercado, setSupermercado] = useState(
    SUPERMERCADOS.includes(supermercadoInicial) ? supermercadoInicial : 'Mercadona'
  )
  const [items, setItems] = useState(
    detectados.map((it, i) => ({
      idTmp: i,
      nombre: it.nombre || '',
      marca: it.marca || '',
      precio: it.precio ?? '',
      cantidad: '1 ud',
      categoria: CATEGORIAS.some((c) => c.id === it.categoria_sugerida)
        ? it.categoria_sugerida
        : 'Otros',
    }))
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  if (detectados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-cream px-8 text-center animate-fade-in">
        <AlertTriangle className="text-amber-500 mb-3" size={40} />
        <p className="font-bold text-gray-700">No hay nada que confirmar.</p>
        <button
          onClick={() => navigate('/escanear')}
          className="mt-5 bg-brand-500 text-white font-bold py-3 px-6 rounded-2xl active:scale-95 transition"
        >
          Volver a escanear
        </button>
      </div>
    )
  }

  function set(idTmp, campo, valor) {
    setItems((prev) =>
      prev.map((it) => (it.idTmp === idTmp ? { ...it, [campo]: valor } : it))
    )
  }

  function quitar(idTmp) {
    setItems((prev) => prev.filter((it) => it.idTmp !== idTmp))
  }

  async function guardarTodo() {
    if (items.length === 0) return
    setGuardando(true)
    setError('')
    try {
      for (const it of items) {
        if (!it.nombre.trim()) continue
        await agregarAlimento(
          {
            nombre: it.nombre.trim(),
            marca: it.marca.trim() || null,
            cantidad: it.cantidad || '1 ud',
            kcal: 0,
            precio: it.precio === '' ? 0 : Number(it.precio),
            supermercado,
            categoria: it.categoria,
          },
          'escaner'
        )
      }
      navigate('/despensa')
    } catch (e) {
      console.error('Error guardando los alimentos escaneados:', e)
      setError('No se pudo guardar. Inténtalo de nuevo.')
      setGuardando(false)
    }
  }

  return (
    <div className="bg-cream min-h-full animate-fade-in">
      <div className="px-5 pt-6 pb-2 flex items-center gap-3">
        <button
          onClick={() => navigate('/escanear')}
          className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center text-gray-600 active:scale-95 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-black text-gray-800">Confirma lo detectado</h1>
      </div>

      <p className="px-5 text-sm text-gray-500 mt-1">
        Revisa y corrige antes de guardar en tu despensa.
      </p>

      <div className="px-5 py-4">
        <label className="block text-sm font-bold text-gray-600 mb-1.5">
          Supermercado
        </label>
        <select
          value={supermercado}
          onChange={(e) => setSupermercado(e.target.value)}
          className="w-full bg-white rounded-2xl px-4 py-3.5 text-gray-800 font-semibold shadow-card outline-none focus:ring-2 ring-brand-300 appearance-none mb-4"
        >
          {SUPERMERCADOS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.idTmp} className="bg-white rounded-2xl p-4 shadow-card">
              <div className="flex items-start gap-2 mb-2">
                <input
                  value={it.nombre}
                  onChange={(e) => set(it.idTmp, 'nombre', e.target.value)}
                  placeholder="Nombre del alimento"
                  className="flex-1 font-bold text-gray-800 outline-none bg-transparent"
                />
                <button
                  onClick={() => quitar(it.idTmp)}
                  className="text-gray-300 hover:text-red-500 active:scale-90 transition shrink-0"
                  aria-label="Quitar"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  value={it.marca}
                  onChange={(e) => set(it.idTmp, 'marca', e.target.value)}
                  placeholder="Marca (opcional)"
                  className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 ring-brand-300"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={it.precio}
                  onChange={(e) => set(it.idTmp, 'precio', e.target.value)}
                  placeholder="Precio €"
                  className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 ring-brand-300"
                />
              </div>

              <select
                value={it.categoria}
                onChange={(e) => set(it.idTmp, 'categoria', e.target.value)}
                className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 ring-brand-300 appearance-none"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            Has quitado todos los productos.
          </p>
        )}

        {error && (
          <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 mt-3">
            {error}
          </p>
        )}

        <button
          onClick={guardarTodo}
          disabled={items.length === 0 || guardando}
          className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-soft mt-5 disabled:opacity-40"
        >
          {guardando ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Guardando...
            </>
          ) : (
            <>
              <Check size={20} /> Guardar {items.length}{' '}
              {items.length === 1 ? 'alimento' : 'alimentos'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
