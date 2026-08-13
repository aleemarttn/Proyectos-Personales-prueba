import { useState } from 'react'
import { X, ScanLine, Check, Loader2, Pencil } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { colorCategoria } from '../data/categorias.js'
import { euros } from '../utils/formato.js'
import { unidadDe } from '../utils/unidades.js'
import EscanerNutricional from './EscanerNutricional.jsx'
import SelectorUnidad from './SelectorUnidad.jsx'
import { guardarProductoEnCatalogo } from '../lib/productos.js'
import { aNumero } from '../utils/numero.js'

// Ficha de un alimento (bottom sheet). Muestra sus datos y la información
// nutricional por 100 g/ml. Como no hay pantalla de edición aparte, deja
// también añadir/corregir los macros aquí mismo (a mano o escaneando la
// etiqueta) y los guarda en Supabase.
export default function DetalleAlimento({ alimento, onCerrar }) {
  const { actualizarAlimento } = useApp()

  const [editando, setEditando] = useState(false)
  const [mostrarEscaner, setMostrarEscaner] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [editandoDatos, setEditandoDatos] = useState(false)
  const [guardandoDatos, setGuardandoDatos] = useState(false)
  const [errorDatos, setErrorDatos] = useState('')
  const [formDatos, setFormDatos] = useState({
    cantidad: alimento.cantidad || '',
    precio: alimento.precio ?? '',
    pesoUnidadG: alimento.pesoUnidadG ?? '',
    unidadNombre: alimento.unidadNombre || '',
    unidadMedida: unidadDe(alimento),
  })

  const [form, setForm] = useState({
    kcal: alimento.kcal ?? '',
    proteinas: alimento.proteinas ?? '',
    hidratos: alimento.hidratos ?? '',
    grasas: alimento.grasas ?? '',
  })

  const tieneMacros =
    alimento.proteinas != null ||
    alimento.hidratos != null ||
    alimento.grasas != null ||
    !!alimento.kcal

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function macrosDetectados(nutricion) {
    setForm((f) => ({
      ...f,
      kcal: nutricion.kcal ?? f.kcal,
      proteinas: nutricion.proteinas ?? f.proteinas,
      hidratos: nutricion.hidratos ?? f.hidratos,
      grasas: nutricion.grasas ?? f.grasas,
    }))
    setMostrarEscaner(false)
    setEditando(true)
  }

  async function guardarDatos() {
    setGuardandoDatos(true)
    setErrorDatos('')
    try {
      const pesoUnidadG = aNumero(formDatos.pesoUnidadG)
      const unidadNombre = formDatos.unidadNombre.trim() || null
      await actualizarAlimento(alimento.id, {
        cantidad: formDatos.cantidad.trim() || '1 ud',
        precio: aNumero(formDatos.precio) ?? 0,
        peso_unidad_g: pesoUnidadG,
        unidad_nombre: unidadNombre,
        unidad_medida: formDatos.unidadMedida,
      })

      // Si este alimento viene de un código de barras, completamos también
      // el catálogo compartido con el peso por unidad recién guardado.
      if (alimento.codigoBarras && pesoUnidadG != null) {
        await guardarProductoEnCatalogo({
          codigoBarras: alimento.codigoBarras,
          nombre: alimento.nombre,
          marca: alimento.marca,
          kcal: alimento.kcal,
          proteinas: alimento.proteinas,
          hidratos: alimento.hidratos,
          grasas: alimento.grasas,
          categoria: alimento.categoria,
          pesoUnidadG,
          unidadNombre,
          unidadMedida: formDatos.unidadMedida,
        })
      }

      setEditandoDatos(false)
    } catch (e) {
      console.error('Error guardando la cantidad/precio:', e)
      setErrorDatos('No se pudo guardar. Inténtalo de nuevo.')
    } finally {
      setGuardandoDatos(false)
    }
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      const kcal = Number(aNumero(form.kcal)) || 0
      const proteinas = aNumero(form.proteinas)
      const hidratos = aNumero(form.hidratos)
      const grasas = aNumero(form.grasas)

      await actualizarAlimento(alimento.id, { kcal, proteinas, hidratos, grasas })

      // Si este alimento viene de un código de barras, aprovechamos para
      // completar el catálogo compartido con los macros recién guardados.
      if (alimento.codigoBarras) {
        await guardarProductoEnCatalogo({
          codigoBarras: alimento.codigoBarras,
          nombre: alimento.nombre,
          marca: alimento.marca,
          kcal,
          proteinas,
          hidratos,
          grasas,
          categoria: alimento.categoria,
        })
      }

      setEditando(false)
    } catch (e) {
      console.error('Error guardando los macros:', e)
      setError('No se pudo guardar. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end animate-fade-in">
      {/* Fondo oscuro para cerrar */}
      <button
        onClick={onCerrar}
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar"
      />

      <div className="relative w-full bg-cream rounded-t-3xl max-h-[88%] overflow-y-auto no-scrollbar animate-slide-up pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {/* Cabecera */}
        <div className="sticky top-0 bg-cream px-5 pt-4 pb-3 flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: colorCategoria(alimento.categoria) + '22' }}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colorCategoria(alimento.categoria) }}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-gray-800 truncate">
                {alimento.nombre}
              </h2>
              {alimento.marca && (
                <p className="text-sm text-gray-400 font-semibold truncate">
                  {alimento.marca}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center text-gray-500 active:scale-95 transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 space-y-4">
          {/* Datos básicos */}
          <div>
            {!editandoDatos && (
              <div className="flex justify-end mb-1.5">
                <button
                  onClick={() => {
                    setFormDatos({
                      cantidad: alimento.cantidad || '',
                      precio: alimento.precio ?? '',
                      pesoUnidadG: alimento.pesoUnidadG ?? '',
                      unidadNombre: alimento.unidadNombre || '',
                    })
                    setEditandoDatos(true)
                  }}
                  className="text-brand-600 text-sm font-bold flex items-center gap-1 active:scale-95 transition"
                >
                  <Pencil size={14} /> Editar cantidad/precio
                </button>
              </div>
            )}

            {editandoDatos ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <CampoMacro
                    label="Cantidad del envase"
                    valor={formDatos.cantidad}
                    onChange={(v) => setFormDatos((f) => ({ ...f, cantidad: v }))}
                    placeholder="Ej. 4 ud, 450 g"
                    tipo="text"
                  />
                  <CampoMacro
                    label="Precio (€)"
                    valor={formDatos.precio}
                    onChange={(v) => setFormDatos((f) => ({ ...f, precio: v }))}
                    placeholder="5,80"
                  />
                  <CampoMacro
                    label={`Peso/unidad (${formDatos.unidadMedida})`}
                    valor={formDatos.pesoUnidadG}
                    onChange={(v) => setFormDatos((f) => ({ ...f, pesoUnidadG: v }))}
                    placeholder="Ej. 16"
                  />
                  <CampoMacro
                    label="Nombre unidad"
                    valor={formDatos.unidadNombre}
                    onChange={(v) => setFormDatos((f) => ({ ...f, unidadNombre: v }))}
                    placeholder="Ej. rebanada"
                    tipo="text"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2 mt-2">
                  <span className="text-xs text-gray-500 font-bold">Se mide en</span>
                  <SelectorUnidad
                    valor={formDatos.unidadMedida}
                    onChange={(u) => setFormDatos((f) => ({ ...f, unidadMedida: u }))}
                    size="compacto"
                  />
                </div>

                {errorDatos && (
                  <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 mt-3">
                    {errorDatos}
                  </p>
                )}

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setEditandoDatos(false)}
                    className="flex-1 bg-gray-50 text-gray-600 font-bold py-2.5 rounded-xl active:scale-[0.98] transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarDatos}
                    disabled={guardandoDatos}
                    className="flex-1 bg-brand-500 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
                  >
                    {guardandoDatos ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Guardar
                  </button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Dato etiqueta="Cantidad del envase" valor={alimento.cantidad || '—'} />
                <Dato etiqueta="Precio" valor={euros(alimento.precio)} />
                <Dato etiqueta="Supermercado" valor={alimento.supermercado || '—'} />
                <Dato etiqueta="Categoría" valor={alimento.categoria || '—'} />
                {alimento.pesoUnidadG != null && (
                  <Dato
                    etiqueta="Peso por unidad"
                    valor={`${alimento.pesoUnidadG} ${unidadDe(alimento)}${alimento.unidadNombre ? ` / ${alimento.unidadNombre}` : ''}`}
                  />
                )}
              </div>
            )}
          </div>

          {/* Información nutricional */}
          <div className="bg-white rounded-2xl p-4 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-gray-800">Información nutricional</p>
                <p className="text-xs text-gray-400 font-semibold">
                  Por 100 {unidadDe(alimento)}
                </p>
              </div>
              {!editando && (
                <button
                  onClick={() => setEditando(true)}
                  className="text-brand-600 text-sm font-bold flex items-center gap-1 active:scale-95 transition"
                >
                  <Pencil size={14} /> Editar
                </button>
              )}
            </div>

            {editando ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <CampoMacro label="kcal" valor={form.kcal} onChange={(v) => set('kcal', v)} placeholder="110" />
                  <CampoMacro label="Proteínas (g)" valor={form.proteinas} onChange={(v) => set('proteinas', v)} placeholder="20" />
                  <CampoMacro label="Hidratos (g)" valor={form.hidratos} onChange={(v) => set('hidratos', v)} placeholder="0" />
                  <CampoMacro label="Grasas (g)" valor={form.grasas} onChange={(v) => set('grasas', v)} placeholder="1,5" />
                </div>

                <button
                  onClick={() => setMostrarEscaner(true)}
                  className="mt-3 w-full bg-gray-50 text-gray-600 text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
                >
                  <ScanLine size={15} /> Escanear etiqueta
                </button>

                {error && (
                  <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 mt-3">
                    {error}
                  </p>
                )}

                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="mt-3 w-full bg-brand-500 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft disabled:opacity-50"
                >
                  {guardando ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Guardando…
                    </>
                  ) : (
                    <>
                      <Check size={18} /> Guardar macros
                    </>
                  )}
                </button>
              </>
            ) : tieneMacros ? (
              <div className="grid grid-cols-4 gap-2">
                <MacroBox label="kcal" valor={alimento.kcal} color="#fb923c" />
                <MacroBox label="Prot." valor={alimento.proteinas} unidad="g" color="#ef4444" />
                <MacroBox label="Hidr." valor={alimento.hidratos} unidad="g" color="#f59e0b" />
                <MacroBox label="Grasas" valor={alimento.grasas} unidad="g" color="#eab308" />
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-gray-400 text-sm font-semibold mb-3">
                  Este alimento aún no tiene macros.
                </p>
                <button
                  onClick={() => setMostrarEscaner(true)}
                  className="bg-brand-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 active:scale-95 transition"
                >
                  <ScanLine size={15} /> Escanear etiqueta
                </button>
              </div>
            )}
          </div>
        </div>
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

function Dato({ etiqueta, valor }) {
  return (
    <div className="bg-white rounded-xl px-3 py-2.5 shadow-card">
      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wide">{etiqueta}</p>
      <p className="text-gray-800 font-bold truncate">{valor}</p>
    </div>
  )
}

function MacroBox({ label, valor, unidad = '', color }) {
  return (
    <div className="rounded-xl px-2 py-2.5 text-center" style={{ backgroundColor: color + '1a' }}>
      <p className="font-black text-base" style={{ color }}>
        {valor != null ? valor : '—'}
        {valor != null && unidad ? unidad : ''}
      </p>
      <p className="text-[11px] font-bold text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function CampoMacro({ label, valor, onChange, placeholder, tipo = 'number' }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1">{label}</label>
      <input
        type={tipo}
        inputMode={tipo === 'number' ? 'decimal' : 'text'}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-gray-800 font-semibold outline-none focus:ring-2 ring-brand-300"
      />
    </div>
  )
}
