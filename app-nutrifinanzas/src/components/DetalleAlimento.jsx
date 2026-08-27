import { useState } from 'react'
import { X, ScanLine, Check, Loader2, Pencil } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { colorCategoria } from '../data/categorias.js'
import { euros } from '../utils/formato.js'
import { unidadDe } from '../utils/unidades.js'
import EscanerNutricional from './EscanerNutricional.jsx'
import CapaModal from './CapaModal.jsx'
import SelectorUnidad from './SelectorUnidad.jsx'
import { guardarProductoEnCatalogo } from '../lib/productos.js'
import { aNumero } from '../utils/numero.js'
import {
  NUTRIENTES,
  nutrientesAFila,
  nutrientesDe,
  sodioDeSal,
} from '../lib/nutrientes.js'
import { avisosDe } from '../lib/avisos.js'

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
    grasasSaturadas: alimento.grasasSaturadas ?? '',
    azucares: alimento.azucares ?? '',
    sal: alimento.sal ?? '',
    fibra: alimento.fibra ?? '',
  })

  // Basta con UN dato nutricional para enseñar la tabla. Un producto puede
  // traer del código de barras la sal y los azúcares pero no las kcal, y en
  // ese caso enseñar "aún no tiene macros" sería mentira.
  const tieneMacros =
    alimento.proteinas != null ||
    alimento.hidratos != null ||
    alimento.grasas != null ||
    !!alimento.kcal ||
    NUTRIENTES.some(({ campo }) => alimento[campo] != null)

  // Los avisos ("muy alto en azúcares", "fuente de fibra") salen de estos
  // cuatro. Aquí es donde tienen sentido: es la pantalla donde se ve el
  // detalle del producto, no solo al registrar una comida.
  const avisos = avisosDe(alimento)
  const sodio = sodioDeSal(alimento.sal)

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function macrosDetectados(nutricion) {
    setForm((f) => {
      // Lo que la etiqueta no diga se queda como estaba: la IA devuelve null
      // para lo que no ha podido leer, y eso no debe borrar un dato bueno.
      const leidos = {}
      for (const { campo } of NUTRIENTES) {
        leidos[campo] = nutricion[campo] ?? f[campo]
      }
      return {
        ...f,
        kcal: nutricion.kcal ?? f.kcal,
        proteinas: nutricion.proteinas ?? f.proteinas,
        hidratos: nutricion.hidratos ?? f.hidratos,
        grasas: nutricion.grasas ?? f.grasas,
        ...leidos,
      }
    })
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
          // Sin esto el upsert del catálogo los machacaría a null: aquí solo
          // se está tocando cantidad/precio, no la tabla nutricional.
          ...nutrientesDe(alimento),
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
      // Saturadas, azúcares, sal y fibra (nutrientesAFila ya los pasa a
      // número o null, y usa los nombres de columna que espera la BD).
      const extra = nutrientesAFila(form)

      await actualizarAlimento(alimento.id, {
        kcal,
        proteinas,
        hidratos,
        grasas,
        ...extra,
      })

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
          ...nutrientesDe(form),
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
    <CapaModal onCerrar={onCerrar} className="z-40 flex items-end animate-fade-in">
      {/* Fondo oscuro: tocar fuera de la ficha la cierra */}
      <button
        onClick={onCerrar}
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar"
      />

      {/* La ficha se limita al 88% del alto del móvil (deja fondo que tocar
          arriba) y reparte ese hueco entre cabecera fija y contenido
          desplazable, para que la información nutricional del final se
          alcance siempre en vez de quedarse cortada. */}
      <div className="relative w-full max-h-[88%] flex flex-col bg-cream rounded-t-3xl animate-slide-up">
        {/* Cabecera */}
        <div className="shrink-0 bg-cream rounded-t-3xl px-5 pt-4 pb-3 flex items-start justify-between">
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

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] space-y-4">
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
                      unidadMedida: unidadDe(alimento),
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

                {/* El desglose. Va aparte y con su propio título porque en la
                    etiqueta del envase también es un segundo bloque: "de las
                    cuales saturadas", "de los cuales azúcares"… */}
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-4 mb-2">
                  Desglose (opcional)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {NUTRIENTES.map(({ campo, etiqueta, unidad }) => (
                    <CampoMacro
                      key={campo}
                      label={`${etiqueta} (${unidad})`}
                      valor={form[campo]}
                      onChange={(v) => set(campo, v)}
                      placeholder="—"
                    />
                  ))}
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
              <>
                <div className="grid grid-cols-4 gap-2">
                  <MacroBox label="kcal" valor={alimento.kcal} color="#fb923c" />
                  <MacroBox label="Prot." valor={alimento.proteinas} unidad="g" color="#ef4444" />
                  <MacroBox label="Hidr." valor={alimento.hidratos} unidad="g" color="#f59e0b" />
                  <MacroBox label="Grasas" valor={alimento.grasas} unidad="g" color="#eab308" />
                </div>

                {/* Desglose. Se listan SIEMPRE los cuatro, también con un
                    guion: así se ve de un vistazo qué falta por completar en
                    vez de parecer que el producto no lo lleva. */}
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  {NUTRIENTES.map(({ campo, etiqueta, unidad, color }) => (
                    <FilaNutriente
                      key={campo}
                      etiqueta={etiqueta}
                      valor={alimento[campo]}
                      unidad={unidad}
                      color={color}
                      // El sodio no es un dato aparte: es la misma sal en la
                      // otra unidad, la que usan las etiquetas americanas.
                      nota={
                        campo === 'sal' && sodio != null
                          ? `${decimales(sodio)} g de sodio`
                          : undefined
                      }
                    />
                  ))}
                </div>

                {avisos.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {avisos.map((aviso) => (
                      <p
                        key={aviso.id}
                        className={`text-xs font-bold rounded-xl px-3 py-2 ${
                          aviso.tipo === 'alerta'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-brand-50 text-brand-700'
                        }`}
                      >
                        {aviso.texto}
                      </p>
                    ))}
                  </div>
                )}
              </>
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
    </CapaModal>
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

// "1,25" sin ceros de relleno: 0.5 -> "0,5", 1.25 -> "1,25", 3 -> "3"
function decimales(n) {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 2 })
}

// Una línea del desglose (saturadas, azúcares, sal, fibra). Un guion cuando
// el dato no está: es información —"esto falta por completar"—, no un hueco.
function FilaNutriente({ etiqueta, valor, unidad, color, nota }) {
  const hay = valor !== null && valor !== undefined
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-sm font-semibold text-gray-500">{etiqueta}</span>
      {hay && nota && (
        <span className="text-[11px] font-semibold text-gray-300 truncate">({nota})</span>
      )}
      <span className="flex-1 border-b border-dotted border-gray-200" />
      <span className={`text-sm font-bold ${hay ? 'text-gray-800' : 'text-gray-300'}`}>
        {hay ? `${decimales(Number(valor))} ${unidad}` : '—'}
      </span>
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
