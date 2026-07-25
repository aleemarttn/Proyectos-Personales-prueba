import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Loader2,
  CheckCircle2,
  Search,
  Flame,
  AlertTriangle,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useDiario } from '../context/DiarioContext.jsx'
import { buscarProductosPorNombre } from '../lib/productos.js'

const TABS = [
  { id: 'despensa', label: 'Despensa' },
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'manual', label: 'Manual' },
]

// Convierte '' -> null y texto -> número (para las columnas numéricas)
function aNumero(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Formulario para registrar una comida consumida, desde tres orígenes
// posibles: un alimento de la despensa, un producto del catálogo
// compartido (por nombre), o macros escritos a mano.
export default function RegistrarComida() {
  const navigate = useNavigate()
  const { alimentos } = useApp()
  const { agregarRegistro } = useDiario()

  const [tab, setTab] = useState('despensa')

  // Selección de despensa/catálogo + cantidad consumida
  const [seleccionado, setSeleccionado] = useState(null)
  const [cantidadG, setCantidadG] = useState('')

  // Búsqueda en el catálogo compartido
  const [busqueda, setBusqueda] = useState('')
  const [resultadosCatalogo, setResultadosCatalogo] = useState([])
  const [buscandoCatalogo, setBuscandoCatalogo] = useState(false)

  // Formulario manual
  const [manual, setManual] = useState({
    nombre: '',
    cantidadG: '',
    kcal: '',
    proteinas: '',
    hidratos: '',
    grasas: '',
  })

  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [error, setError] = useState('')

  function cambiarTab(nuevo) {
    setTab(nuevo)
    setSeleccionado(null)
    setCantidadG('')
    setError('')
  }

  async function buscarEnCatalogo() {
    if (!busqueda.trim()) return
    setBuscandoCatalogo(true)
    try {
      const resultados = await buscarProductosPorNombre(busqueda.trim())
      setResultadosCatalogo(resultados)
    } catch (e) {
      console.error('Error buscando en el catálogo:', e)
      setError('No se pudo buscar en el catálogo.')
    } finally {
      setBuscandoCatalogo(false)
    }
  }

  const cantidadNum = aNumero(cantidadG)
  const cantidadValida = cantidadNum != null && cantidadNum > 0
  const sinKcal = seleccionado && (seleccionado.kcal === null || seleccionado.kcal === undefined)

  const preview =
    seleccionado && cantidadValida && !sinKcal
      ? {
          kcal: (seleccionado.kcal * cantidadNum) / 100,
          proteinas: seleccionado.proteinas != null ? (seleccionado.proteinas * cantidadNum) / 100 : null,
          hidratos: seleccionado.hidratos != null ? (seleccionado.hidratos * cantidadNum) / 100 : null,
          grasas: seleccionado.grasas != null ? (seleccionado.grasas * cantidadNum) / 100 : null,
        }
      : null

  const validoOrigen = tab !== 'manual' && !!seleccionado && cantidadValida && !sinKcal
  const validoManual = tab === 'manual' && manual.nombre.trim() && manual.kcal !== ''
  const valido = validoOrigen || validoManual

  async function guardar() {
    if (!valido || guardando) return
    setGuardando(true)
    setError('')
    try {
      if (tab === 'manual') {
        await agregarRegistro(
          {
            nombre: manual.nombre.trim(),
            cantidadG: aNumero(manual.cantidadG) || 0,
            kcal: Number(manual.kcal) || 0,
            proteinas: aNumero(manual.proteinas),
            hidratos: aNumero(manual.hidratos),
            grasas: aNumero(manual.grasas),
          },
          'manual'
        )
      } else {
        await agregarRegistro(
          {
            nombre: seleccionado.nombre,
            cantidadG: cantidadNum,
            kcal: preview.kcal,
            proteinas: preview.proteinas,
            hidratos: preview.hidratos,
            grasas: preview.grasas,
            alimentoId: tab === 'despensa' ? seleccionado.id : null,
            codigoBarras: tab === 'catalogo' ? seleccionado.codigoBarras : null,
          },
          tab
        )
      }
      setHecho(true)
      setTimeout(() => navigate('/diario'), 1000)
    } catch (e) {
      console.error('Error guardando el registro:', e)
      setError('No se pudo guardar. Inténtalo de nuevo.')
      setGuardando(false)
    }
  }

  if (hecho) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-cream animate-fade-in px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mb-5 animate-pop">
          <CheckCircle2 size={44} />
        </div>
        <h2 className="text-2xl font-black text-gray-800">¡Registrado!</h2>
        <p className="text-gray-500 mt-1">Ya está en tu diario de hoy.</p>
      </div>
    )
  }

  return (
    <div className="bg-cream min-h-full animate-fade-in">
      {/* Cabecera */}
      <div className="px-5 pt-6 pb-2 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center text-gray-600 active:scale-95 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-black text-gray-800">Registrar comida</h1>
      </div>

      {/* Pestañas de origen */}
      <div className="px-5 mt-3 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => cambiarTab(t.id)}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition ${
              tab === t.id ? 'bg-brand-500 text-white shadow-soft' : 'bg-white text-gray-500 shadow-card'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-4 space-y-3">
        {tab === 'despensa' && (
          <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
            {alimentos.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-6">Tu despensa está vacía.</p>
            )}
            {alimentos.map((a) => (
              <OpcionAlimento
                key={a.id}
                item={a}
                seleccionado={seleccionado?.id === a.id}
                onClick={() => setSeleccionado(a)}
              />
            ))}
          </div>
        )}

        {tab === 'catalogo' && (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarEnCatalogo()}
                placeholder="Buscar producto por nombre..."
                className="flex-1 bg-white rounded-2xl px-4 py-3.5 text-gray-800 font-semibold shadow-card outline-none focus:ring-2 ring-brand-300 placeholder:text-gray-300 placeholder:font-normal"
              />
              <button
                onClick={buscarEnCatalogo}
                className="bg-brand-500 text-white px-4 rounded-2xl flex items-center justify-center active:scale-95 transition shrink-0"
              >
                {buscandoCatalogo ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              </button>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
              {resultadosCatalogo.map((p) => (
                <OpcionAlimento
                  key={p.codigoBarras}
                  item={p}
                  seleccionado={seleccionado?.codigoBarras === p.codigoBarras}
                  onClick={() => setSeleccionado(p)}
                />
              ))}
            </div>
          </>
        )}

        {(tab === 'despensa' || tab === 'catalogo') && seleccionado && (
          <div className="bg-white rounded-2xl p-4 shadow-card space-y-3">
            {sinKcal ? (
              <p className="bg-amber-50 text-amber-700 text-sm font-semibold rounded-xl px-4 py-3 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                Este alimento no tiene kcal registradas. Complétalas antes de registrar el consumo.
              </p>
            ) : (
              <>
                <Campo
                  label="Cantidad consumida (g)"
                  tipo="number"
                  valor={cantidadG}
                  onChange={setCantidadG}
                  placeholder="Ej. 150"
                />
                {preview && (
                  <div className="flex items-center gap-2 bg-brand-50 text-brand-700 font-bold rounded-xl px-4 py-2.5 text-sm">
                    <Flame size={16} /> {Math.round(preview.kcal)} kcal
                    {preview.proteinas != null && ` · P ${Math.round(preview.proteinas)}g`}
                    {preview.hidratos != null && ` · H ${Math.round(preview.hidratos)}g`}
                    {preview.grasas != null && ` · G ${Math.round(preview.grasas)}g`}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'manual' && (
          <div className="bg-white rounded-2xl p-4 shadow-card space-y-1">
            <Campo
              label="Nombre"
              valor={manual.nombre}
              onChange={(v) => setManual((m) => ({ ...m, nombre: v }))}
              placeholder="Ej. Bocadillo de tortilla"
            />
            <Campo
              label="Cantidad aproximada (g, opcional)"
              tipo="number"
              valor={manual.cantidadG}
              onChange={(v) => setManual((m) => ({ ...m, cantidadG: v }))}
              placeholder="Ej. 200"
            />
            <div className="grid grid-cols-2 gap-3 mt-1">
              <Campo
                label="kcal"
                tipo="number"
                valor={manual.kcal}
                onChange={(v) => setManual((m) => ({ ...m, kcal: v }))}
                placeholder="450"
              />
              <Campo
                label="Proteínas (g)"
                tipo="number"
                valor={manual.proteinas}
                onChange={(v) => setManual((m) => ({ ...m, proteinas: v }))}
                placeholder="20"
              />
              <Campo
                label="Hidratos (g)"
                tipo="number"
                valor={manual.hidratos}
                onChange={(v) => setManual((m) => ({ ...m, hidratos: v }))}
                placeholder="45"
              />
              <Campo
                label="Grasas (g)"
                tipo="number"
                valor={manual.grasas}
                onChange={(v) => setManual((m) => ({ ...m, grasas: v }))}
                placeholder="15"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          onClick={guardar}
          disabled={!valido || guardando}
          className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-soft mt-5 disabled:opacity-40"
        >
          {guardando ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Guardando...
            </>
          ) : (
            <>
              <Check size={20} /> Registrar en el diario
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function OpcionAlimento({ item, seleccionado, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl p-3.5 shadow-card flex items-center justify-between gap-3 transition ${
        seleccionado ? 'ring-2 ring-brand-400' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="font-bold text-gray-800 truncate">{item.nombre}</p>
        <p className="text-xs text-gray-400 font-semibold">
          {item.kcal != null ? `${item.kcal} kcal /100g` : 'Sin kcal registradas'}
        </p>
      </div>
      {seleccionado && <Check size={18} className="text-brand-500 shrink-0" />}
    </button>
  )
}

function Campo({ label, valor, onChange, placeholder, tipo = 'text' }) {
  return (
    <div className="mb-2">
      <label className="block text-sm font-bold text-gray-600 mb-1.5 mt-2">{label}</label>
      <input
        type={tipo}
        inputMode={tipo === 'number' ? 'decimal' : 'text'}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white rounded-2xl px-4 py-3.5 text-gray-800 font-semibold shadow-card outline-none focus:ring-2 ring-brand-300 placeholder:text-gray-300 placeholder:font-normal"
      />
    </div>
  )
}
