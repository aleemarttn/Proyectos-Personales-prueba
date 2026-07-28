import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Trash2, AlertTriangle, ScanLine } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { CATEGORIAS } from '../data/categorias.js'
import EscanerNutricional from '../components/EscanerNutricional.jsx'
import SupermercadoSelector from '../components/SupermercadoSelector.jsx'
import { guardarProductoEnCatalogo } from '../lib/productos.js'

// Convierte '' -> null y texto -> número (para peso por unidad)
function aNumero(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

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
      // Macros por 100 g/ml (ya vienen rellenos si el producto se encontró
      // en el catálogo compartido por código de barras; si no, null hasta
      // que se escanee la etiqueta)
      kcal: it.kcal ?? null,
      proteinas: it.proteinas ?? null,
      hidratos: it.hidratos ?? null,
      grasas: it.grasas ?? null,
      codigoBarras: it.codigoBarras || null,
      encontradoEnCatalogo: !!it.encontradoEnCatalogo,
      pesoUnidadG: it.pesoUnidadG ?? null,
      unidadNombre: it.unidadNombre || '',
    }))
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  // idTmp del producto cuya etiqueta se está escaneando (o null)
  const [escanerItem, setEscanerItem] = useState(null)

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

  // Aplica los macros leídos de una etiqueta al producto que se estaba escaneando.
  function macrosDetectados(nutricion) {
    setItems((prev) =>
      prev.map((it) =>
        it.idTmp === escanerItem
          ? {
              ...it,
              kcal: nutricion.kcal ?? it.kcal,
              proteinas: nutricion.proteinas ?? it.proteinas,
              hidratos: nutricion.hidratos ?? it.hidratos,
              grasas: nutricion.grasas ?? it.grasas,
            }
          : it
      )
    )
    setEscanerItem(null)
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
            kcal: it.kcal ?? 0,
            proteinas: it.proteinas,
            hidratos: it.hidratos,
            grasas: it.grasas,
            precio: it.precio === '' ? 0 : Number(it.precio),
            supermercado,
            categoria: it.categoria,
            codigoBarras: it.codigoBarras,
            pesoUnidadG: it.pesoUnidadG,
            unidadNombre: it.unidadNombre.trim() || null,
          },
          'escaner'
        )

        // Si es un producto nuevo identificado por código de barras (no
        // estaba ya en el catálogo compartido) y tiene macros, lo sumamos
        // al catálogo para que la próxima persona no tenga que escanearlo.
        if (it.codigoBarras && !it.encontradoEnCatalogo && it.kcal != null) {
          await guardarProductoEnCatalogo({
            codigoBarras: it.codigoBarras,
            nombre: it.nombre.trim(),
            marca: it.marca.trim() || null,
            kcal: it.kcal,
            proteinas: it.proteinas,
            hidratos: it.hidratos,
            grasas: it.grasas,
            categoria: it.categoria,
            pesoUnidadG: it.pesoUnidadG,
            unidadNombre: it.unidadNombre.trim() || null,
          })
        }
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
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-2 flex items-center gap-3">
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

      <div className="px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <SupermercadoSelector valor={supermercado} onChange={setSupermercado} />

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

              {it.encontradoEnCatalogo && (
                <p className="text-xs font-bold text-brand-600 flex items-center gap-1 mb-2">
                  <Check size={13} /> Producto reconocido del catálogo compartido
                </p>
              )}

              <input
                value={it.marca}
                onChange={(e) => set(it.idTmp, 'marca', e.target.value)}
                placeholder="Marca (opcional)"
                className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 ring-brand-300 mb-2"
              />

              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  value={it.cantidad}
                  onChange={(e) => set(it.idTmp, 'cantidad', e.target.value)}
                  placeholder="Cantidad del envase: 1 ud, 450 g..."
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

              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={it.pesoUnidadG ?? ''}
                  onChange={(e) => set(it.idTmp, 'pesoUnidadG', aNumero(e.target.value))}
                  placeholder="Peso/unidad (g), opcional"
                  className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 ring-brand-300"
                />
                <input
                  value={it.unidadNombre}
                  onChange={(e) => set(it.idTmp, 'unidadNombre', e.target.value)}
                  placeholder="Ej. rebanada, huevo..."
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

              {tieneMacros(it) ? (
                <div className="mt-2 flex items-center justify-between bg-brand-50 rounded-xl px-3 py-2">
                  <span className="text-xs font-bold text-brand-700 flex items-center gap-1.5">
                    <Check size={14} /> {resumenMacros(it)}
                  </span>
                  <button
                    onClick={() => setEscanerItem(it.idTmp)}
                    className="text-xs font-bold text-brand-600 underline active:scale-95 transition"
                  >
                    Repetir
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEscanerItem(it.idTmp)}
                  className="mt-2 w-full bg-gray-50 text-gray-600 text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
                >
                  <ScanLine size={15} /> Escanear info nutricional
                </button>
              )}
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

      {escanerItem !== null && (
        <EscanerNutricional
          onCerrar={() => setEscanerItem(null)}
          onDetectado={macrosDetectados}
        />
      )}
    </div>
  )
}

// ¿El producto tiene algún macro cargado?
function tieneMacros(it) {
  return [it.kcal, it.proteinas, it.hidratos, it.grasas].some(
    (v) => v !== null && v !== undefined
  )
}

// Resumen corto de los macros para mostrar en la tarjeta.
function resumenMacros(it) {
  const partes = []
  if (it.kcal != null) partes.push(`${it.kcal} kcal`)
  if (it.proteinas != null) partes.push(`P ${it.proteinas}`)
  if (it.hidratos != null) partes.push(`H ${it.hidratos}`)
  if (it.grasas != null) partes.push(`G ${it.grasas}`)
  return partes.join(' · ') + ' /100g'
}
