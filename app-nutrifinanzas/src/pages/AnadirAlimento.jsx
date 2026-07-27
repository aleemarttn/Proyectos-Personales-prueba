import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, CheckCircle2, ScanLine } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { CATEGORIAS } from '../data/categorias.js'
import EscanerNutricional from '../components/EscanerNutricional.jsx'
import SupermercadoSelector from '../components/SupermercadoSelector.jsx'

// Formulario para añadir un alimento. Si venimos del escáner, llega
// con datos ya rellenados (location.state.prefill).
export default function AnadirAlimento() {
  const navigate = useNavigate()
  const location = useLocation()
  const { agregarAlimento } = useApp()

  const prefill = location.state?.prefill || {}

  const [form, setForm] = useState({
    nombre: prefill.nombre || '',
    marca: prefill.marca || '',
    cantidad: prefill.cantidad || '',
    kcal: prefill.kcal || '',
    proteinas: prefill.proteinas ?? '',
    hidratos: prefill.hidratos ?? '',
    grasas: prefill.grasas ?? '',
    precio: prefill.precio || '',
    supermercado: prefill.supermercado || 'Mercadona',
    categoria: prefill.categoria || 'Otros',
    pesoUnidadG: prefill.pesoUnidadG ?? '',
    unidadNombre: prefill.unidadNombre || '',
  })

  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [error, setError] = useState('')
  const [mostrarEscaner, setMostrarEscaner] = useState(false)
  const [avisoMacros, setAvisoMacros] = useState('')

  const valido = form.nombre.trim() && form.precio !== ''
  // Si venimos del escáner (hay prefill con nombre), el origen es "escaner"
  const origen = prefill.nombre ? 'escaner' : 'manual'

  function set(campo, valor) {
    setForm({ ...form, [campo]: valor })
  }

  // Convierte '' -> null y texto -> número (para las columnas numéricas)
  function aNumero(v) {
    if (v === '' || v === null || v === undefined) return null
    const n = Number(String(v).replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  // Recibe los macros leídos de la etiqueta y rellena el formulario.
  function macrosDetectados(nutricion) {
    setForm((f) => ({
      ...f,
      kcal: nutricion.kcal ?? f.kcal,
      proteinas: nutricion.proteinas ?? f.proteinas,
      hidratos: nutricion.hidratos ?? f.hidratos,
      grasas: nutricion.grasas ?? f.grasas,
    }))
    setMostrarEscaner(false)
    setAvisoMacros('Macros rellenados desde la etiqueta. Revísalos antes de guardar.')
  }

  async function guardar() {
    if (!valido) return
    setGuardando(true)
    setError('')
    try {
      await agregarAlimento(
        {
          nombre: form.nombre.trim(),
          marca: form.marca.trim() || null,
          cantidad: form.cantidad || '1 ud',
          kcal: Number(form.kcal) || 0,
          proteinas: aNumero(form.proteinas),
          hidratos: aNumero(form.hidratos),
          grasas: aNumero(form.grasas),
          precio: Number(form.precio) || 0,
          supermercado: form.supermercado,
          categoria: form.categoria,
          pesoUnidadG: aNumero(form.pesoUnidadG),
          unidadNombre: form.unidadNombre.trim() || null,
        },
        origen
      )
      setHecho(true)
      // Mostramos la confirmación un momento y volvemos a la despensa
      setTimeout(() => navigate('/despensa'), 1000)
    } catch (e) {
      console.error('Error guardando el alimento:', e)
      setError('No se pudo guardar. Inténtalo de nuevo.')
      setGuardando(false)
    }
  }

  // Pantalla de confirmación tras guardar
  if (hecho) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-cream animate-fade-in px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mb-5 animate-pop">
          <CheckCircle2 size={44} />
        </div>
        <h2 className="text-2xl font-black text-gray-800">¡Añadido!</h2>
        <p className="text-gray-500 mt-1">
          {form.nombre} ya está en tu despensa.
        </p>
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
        <h1 className="text-xl font-black text-gray-800">Añadir alimento</h1>
      </div>

      {prefill.nombre && (
        <div className="mx-5 mt-3 bg-brand-50 text-brand-700 text-sm font-bold rounded-xl px-4 py-2.5 flex items-center gap-2">
          <Check size={16} /> Datos rellenados desde el escáner
        </div>
      )}

      <div className="px-5 py-4 space-y-1">
        <Campo
          label="Nombre del alimento"
          valor={form.nombre}
          onChange={(v) => set('nombre', v)}
          placeholder="Ej. Pechuga de pollo"
        />
        <Campo
          label="Marca (opcional)"
          valor={form.marca}
          onChange={(v) => set('marca', v)}
          placeholder="Ej. Danone, Pascual"
        />
        <Campo
          label="Cantidad del envase"
          valor={form.cantidad}
          onChange={(v) => set('cantidad', v)}
          placeholder="Ej. 1 kg, 450 g, 12 ud"
          ayuda="Tal como viene en el paquete al comprarlo, no lo que te vayas a comer."
        />

        <div className="bg-white rounded-2xl p-4 shadow-card mt-3">
          <p className="font-bold text-gray-800">Peso por unidad (opcional)</p>
          <p className="text-xs text-gray-400 font-semibold mb-2">
            Si se divide en piezas (rebanadas, huevos, lonchas...), guarda cuánto pesa cada una y
            luego podrás registrar comidas por unidades en vez de pesar.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo
              label="Peso por unidad (g)"
              tipo="number"
              valor={form.pesoUnidadG}
              onChange={(v) => set('pesoUnidadG', v)}
              placeholder="Ej. 16"
            />
            <Campo
              label="Nombre de la unidad"
              valor={form.unidadNombre}
              onChange={(v) => set('unidadNombre', v)}
              placeholder="Ej. rebanada"
            />
          </div>
        </div>

        <Campo
          label="Precio (€)"
          tipo="number"
          valor={form.precio}
          onChange={(v) => set('precio', v)}
          placeholder="5,80"
        />

        <div className="bg-white rounded-2xl p-4 shadow-card mt-3">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="font-bold text-gray-800">Información nutricional</p>
                <p className="text-xs text-gray-400 font-semibold">Valores por 100 g / 100 ml</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAvisoMacros('')
                  setMostrarEscaner(true)
                }}
                className="bg-brand-500 text-white text-sm font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition shrink-0"
              >
                <ScanLine size={16} /> Escanear etiqueta
              </button>
            </div>

            {avisoMacros && (
              <p className="bg-brand-50 text-brand-700 text-xs font-bold rounded-lg px-3 py-2 my-2 flex items-center gap-1.5">
                <Check size={14} /> {avisoMacros}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 mt-1">
              <Campo
                label="kcal"
                tipo="number"
                valor={form.kcal}
                onChange={(v) => set('kcal', v)}
                placeholder="110"
              />
              <Campo
                label="Proteínas (g)"
                tipo="number"
                valor={form.proteinas}
                onChange={(v) => set('proteinas', v)}
                placeholder="20"
              />
              <Campo
                label="Hidratos (g)"
                tipo="number"
                valor={form.hidratos}
                onChange={(v) => set('hidratos', v)}
                placeholder="0"
              />
              <Campo
                label="Grasas (g)"
                tipo="number"
                valor={form.grasas}
                onChange={(v) => set('grasas', v)}
                placeholder="1,5"
              />
            </div>
        </div>

        <SupermercadoSelector
          valor={form.supermercado}
          onChange={(v) => set('supermercado', v)}
        />
        <Selector
          label="Categoría"
          valor={form.categoria}
          opciones={CATEGORIAS.map((c) => c.id)}
          onChange={(v) => set('categoria', v)}
        />

        {error && (
          <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 mt-3">
            {error}
          </p>
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
              <Check size={20} /> Guardar en la despensa
            </>
          )}
        </button>
      </div>

      {mostrarEscaner && (
        <EscanerNutricional
          onCerrar={() => setMostrarEscaner(false)}
          onDetectado={macrosDetectados}
        />
      )}
    </div>
  )
}

function Campo({ label, valor, onChange, placeholder, tipo = 'text', ayuda }) {
  return (
    <div className="mb-2">
      <label className="block text-sm font-bold text-gray-600 mb-1.5 mt-2">
        {label}
      </label>
      <input
        type={tipo}
        inputMode={tipo === 'number' ? 'decimal' : 'text'}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white rounded-2xl px-4 py-3.5 text-gray-800 font-semibold shadow-card outline-none focus:ring-2 ring-brand-300 placeholder:text-gray-300 placeholder:font-normal"
      />
      {ayuda && <p className="text-xs text-gray-400 font-semibold mt-1 px-1">{ayuda}</p>}
    </div>
  )
}

function Selector({ label, valor, opciones, onChange }) {
  return (
    <div className="mb-2">
      <label className="block text-sm font-bold text-gray-600 mb-1.5 mt-2">
        {label}
      </label>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white rounded-2xl px-4 py-3.5 text-gray-800 font-semibold shadow-card outline-none focus:ring-2 ring-brand-300 appearance-none"
      >
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}
