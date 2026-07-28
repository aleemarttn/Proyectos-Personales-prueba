import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Loader2,
  CheckCircle2,
  Search,
  Flame,
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useDiario } from '../context/DiarioContext.jsx'
import { buscarProductosPorNombre } from '../lib/productos.js'
import { comidaSugeridaPorHora } from '../lib/comidas.js'

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
//
// Una comida real casi nunca es un solo alimento ("arroz con pechuga y
// huevo" son tres), y cada uno tiene sus propias kcal. Por eso se pueden ir
// acumulando alimentos en una lista con "Añadir otro" y guardarlos todos
// juntos en la misma comida del día. Con uno solo el flujo no cambia: se
// rellena y se pulsa "Registrar".
export default function RegistrarComida() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { alimentos } = useApp()
  const { agregarRegistros, comidas } = useDiario()

  const [tab, setTab] = useState('despensa')

  // A qué comida del día se registra. Si venimos del botón "+ Añadir" de
  // una comida concreta del diario llega en la URL; si no, se propone la
  // más probable según la hora.
  const [comidaId, setComidaId] = useState(params.get('comida') || null)

  // Las comidas llegan de forma asíncrona: en cuanto están, si no había
  // ninguna elegida (ni por URL) proponemos la de la hora actual.
  useEffect(() => {
    if (comidaId || comidas.length === 0) return
    setComidaId(comidaSugeridaPorHora(comidas)?.id ?? null)
  }, [comidas, comidaId])

  // Selección de despensa/catálogo + cantidad consumida
  const [seleccionado, setSeleccionado] = useState(null)
  const [cantidadG, setCantidadG] = useState('')
  // Si el alimento tiene peso por unidad guardado, se puede registrar por
  // unidades (ej. "3 rebanadas") en vez de pesar cada vez.
  const [modoCantidad, setModoCantidad] = useState('gramos') // 'gramos' | 'unidades'
  const [unidades, setUnidades] = useState('')

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

  // Alimentos ya añadidos a esta comida, todavía sin guardar.
  const [pendientes, setPendientes] = useState([])

  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [guardados, setGuardados] = useState(0)
  const [error, setError] = useState('')

  function cambiarTab(nuevo) {
    setTab(nuevo)
    elegir(null)
    setError('')
  }

  // Selecciona un alimento/producto y resetea la cantidad: por defecto en
  // unidades si tiene peso por unidad guardado (es lo más rápido), si no en
  // gramos.
  function elegir(item) {
    setSeleccionado(item)
    setCantidadG('')
    setUnidades('')
    setModoCantidad(item?.pesoUnidadG ? 'unidades' : 'gramos')
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

  const unidadesNum = aNumero(unidades)
  const cantidadNum =
    modoCantidad === 'unidades' && seleccionado?.pesoUnidadG
      ? unidadesNum != null
        ? unidadesNum * seleccionado.pesoUnidadG
        : null
      : aNumero(cantidadG)
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

  const comidaElegida = comidas.find((c) => c.id === comidaId) || null

  const validoOrigen = tab !== 'manual' && !!seleccionado && cantidadValida && !sinKcal
  const validoManual = tab === 'manual' && manual.nombre.trim() && manual.kcal !== ''
  const valido = validoOrigen || validoManual

  // Lo que hay ahora mismo en el formulario, como registro listo para guardar.
  function registroDelFormulario() {
    if (tab === 'manual') {
      return {
        clave: `${Date.now()}-${Math.random()}`,
        nombre: manual.nombre.trim(),
        cantidadG: aNumero(manual.cantidadG) || 0,
        kcal: Number(manual.kcal) || 0,
        proteinas: aNumero(manual.proteinas),
        hidratos: aNumero(manual.hidratos),
        grasas: aNumero(manual.grasas),
        origen: 'manual',
      }
    }
    return {
      clave: `${Date.now()}-${Math.random()}`,
      nombre: seleccionado.nombre,
      cantidadG: cantidadNum,
      kcal: preview.kcal,
      proteinas: preview.proteinas,
      hidratos: preview.hidratos,
      grasas: preview.grasas,
      alimentoId: tab === 'despensa' ? seleccionado.id : null,
      codigoBarras: tab === 'catalogo' ? seleccionado.codigoBarras : null,
      origen: tab,
    }
  }

  function vaciarFormulario() {
    elegir(null)
    setManual({ nombre: '', cantidadG: '', kcal: '', proteinas: '', hidratos: '', grasas: '' })
    setError('')
  }

  // Guarda el alimento actual en la lista y deja el formulario listo para
  // el siguiente, sin tocar la base de datos todavía.
  function anadirOtro() {
    if (!valido) return
    setPendientes((prev) => [...prev, registroDelFormulario()])
    vaciarFormulario()
  }

  function quitarPendiente(clave) {
    setPendientes((prev) => prev.filter((p) => p.clave !== clave))
  }

  async function guardar() {
    // Lo que esté a medias en el formulario cuenta como uno más: así, con un
    // solo alimento, no hace falta pasar por "Añadir otro".
    const aGuardar = valido ? [...pendientes, registroDelFormulario()] : pendientes
    if (aGuardar.length === 0 || guardando) return

    setGuardando(true)
    setError('')
    try {
      await agregarRegistros(aGuardar.map((r) => ({ ...r, comidaId })))
      setGuardados(aGuardar.length)
      setHecho(true)
      setTimeout(() => navigate('/diario'), 1000)
    } catch (e) {
      console.error('Error guardando el registro:', e)
      setError('No se pudo guardar. Inténtalo de nuevo.')
      setGuardando(false)
    }
  }

  const totalPendientes = pendientes.reduce((s, p) => s + (p.kcal || 0), 0)
  // Cuántos alimentos se guardarían al pulsar "Registrar": los de la lista
  // más el que esté completo en el formulario.
  const totalAGuardar = pendientes.length + (valido ? 1 : 0)

  if (hecho) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-cream animate-fade-in px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mb-5 animate-pop">
          <CheckCircle2 size={44} />
        </div>
        <h2 className="text-2xl font-black text-gray-800">¡Registrado!</h2>
        <p className="text-gray-500 mt-1">
          {guardados > 1 ? `${guardados} alimentos añadidos` : 'Añadido'}
          {comidaElegida ? ` a "${comidaElegida.nombre}".` : ' a tu diario de hoy.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-cream min-h-full animate-fade-in">
      {/* Cabecera */}
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-2 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center text-gray-600 active:scale-95 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-black text-gray-800">Registrar comida</h1>
      </div>

      {/* A qué comida del día va */}
      {comidas.length > 0 && (
        <div className="px-5 mt-4">
          <p className="text-sm font-bold text-gray-600 mb-2">¿En qué comida?</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {comidas.map((c) => (
              <button
                key={c.id}
                onClick={() => setComidaId(c.id)}
                className={`px-4 py-2.5 rounded-xl font-bold text-sm shrink-0 transition ${
                  comidaId === c.id
                    ? 'bg-brand-500 text-white shadow-soft'
                    : 'bg-white text-gray-500 shadow-card'
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pestañas de origen */}
      <div className="px-5 mt-4 flex gap-2">
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
                onClick={() => elegir(a)}
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
                  onClick={() => elegir(p)}
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
                {seleccionado.pesoUnidadG ? (
                  <>
                    <div className="flex gap-2 mb-1">
                      <TabModo
                        activo={modoCantidad === 'unidades'}
                        onClick={() => setModoCantidad('unidades')}
                      >
                        {seleccionado.unidadNombre ? `${seleccionado.unidadNombre}s` : 'Unidades'}
                      </TabModo>
                      <TabModo activo={modoCantidad === 'gramos'} onClick={() => setModoCantidad('gramos')}>
                        Gramos
                      </TabModo>
                    </div>
                    {modoCantidad === 'unidades' ? (
                      <Campo
                        label={`Cuántas unidades de "${seleccionado.unidadNombre || 'ud'}" (${seleccionado.pesoUnidadG} g cada una)`}
                        tipo="number"
                        valor={unidades}
                        onChange={setUnidades}
                        placeholder="Ej. 3"
                      />
                    ) : (
                      <Campo
                        label="Cantidad consumida (g)"
                        tipo="number"
                        valor={cantidadG}
                        onChange={setCantidadG}
                        placeholder="Ej. 150"
                      />
                    )}
                  </>
                ) : (
                  <Campo
                    label="Cantidad consumida (g)"
                    tipo="number"
                    valor={cantidadG}
                    onChange={setCantidadG}
                    placeholder="Ej. 150"
                  />
                )}
                {preview && (
                  <div className="flex items-center gap-2 bg-brand-50 text-brand-700 font-bold rounded-xl px-4 py-2.5 text-sm">
                    <Flame size={16} /> {Math.round(preview.kcal)} kcal
                    {preview.proteinas != null && ` · P ${Math.round(preview.proteinas)}g`}
                    {preview.hidratos != null && ` · H ${Math.round(preview.hidratos)}g`}
                    {preview.grasas != null && ` · G ${Math.round(preview.grasas)}g`}
                    {modoCantidad === 'unidades' && ` · ${Math.round(cantidadNum)} g en total`}
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

        {/* Alimentos ya añadidos a esta comida (aún sin guardar) */}
        {pendientes.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-600">
                En esta comida ({pendientes.length})
              </p>
              <span className="text-sm font-extrabold text-brand-600 flex items-center gap-1">
                <Flame size={14} /> {Math.round(totalPendientes)} kcal
              </span>
            </div>
            <div className="space-y-2">
              {pendientes.map((p) => (
                <div key={p.clave} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-800 text-sm truncate">{p.nombre}</p>
                    <p className="text-xs text-gray-400 font-semibold">
                      {p.cantidadG ? `${Math.round(p.cantidadG)} g · ` : ''}
                      {Math.round(p.kcal)} kcal
                    </p>
                  </div>
                  <button
                    onClick={() => quitarPendiente(p.clave)}
                    className="text-gray-300 hover:text-red-500 active:scale-90 transition shrink-0"
                    aria-label={`Quitar ${p.nombre}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          onClick={anadirOtro}
          disabled={!valido || guardando}
          className="w-full bg-white text-brand-700 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-card active:scale-[0.98] transition mt-4 disabled:opacity-40"
        >
          <Plus size={18} /> Añadir otro alimento
        </button>

        <button
          onClick={guardar}
          disabled={totalAGuardar === 0 || guardando}
          className="w-full bg-brand-500 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-soft disabled:opacity-40"
        >
          {guardando ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Guardando...
            </>
          ) : (
            <>
              <Check size={20} />
              {totalAGuardar > 1
                ? `Registrar ${totalAGuardar} alimentos`
                : 'Registrar en el diario'}
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

function TabModo({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 rounded-xl font-bold text-xs transition ${
        activo ? 'bg-brand-500 text-white shadow-soft' : 'bg-white text-gray-500 shadow-card'
      }`}
    >
      {children}
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
