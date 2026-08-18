import { useEffect, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
} from 'recharts'
import {
  Wallet,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { cargarComprasDelMes, cargarTotalesPorMes } from '../lib/gastos.js'
import { colorCategoria } from '../data/categorias.js'
import { euros, fechaCorta } from '../utils/formato.js'
import {
  mesActualISO,
  sumarMeses,
  esMesActual,
  nombreMes,
  nombreMesCorto,
} from '../lib/fechas.js'

// Panel de gastos: total, donut por categoría, barras por supermercado e
// historial de compras, TODO por mes (navegable con ‹ ›), más un gráfico de
// tendencia de los últimos 6 meses.
//
// Las compras de un mes se piden aparte (lib/gastos.js), sin pasar por
// AppContext: la despensa en vivo (useApp().alimentos) solo enseña lo que
// sigue sin consumir, mientras que aquí interesa TODO lo que se compró ese
// mes, se haya comido/tirado ya o no (ver migración 024).
export default function Gastos() {
  const { hogar, sesion } = useAuth()

  const [mes, setMes] = useState(mesActualISO())
  const [compras, setCompras] = useState([])
  const [totalesPorMes, setTotalesPorMes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const hogarId = hogar?.id ?? null

  // Compras del mes seleccionado: se piden de nuevo cada vez que se cambia
  // de mes (o de hogar, porque lo que se puede ver cambia).
  useEffect(() => {
    if (!sesion) return
    let activo = true
    setCargando(true)
    setError('')

    cargarComprasDelMes(mes)
      .then((lista) => {
        if (activo) setCompras(lista)
      })
      .catch((e) => {
        console.error('Error cargando las compras del mes:', e)
        if (activo) setError('No se pudieron cargar los gastos de este mes.')
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [sesion, mes, hogarId])

  // Tendencia de los últimos 6 meses: se ancla siempre a HOY (no al mes que
  // se esté mirando), para que la ventana no se desplace al navegar hacia
  // atrás — solo se pide una vez por sesión/hogar, no en cada cambio de mes.
  useEffect(() => {
    if (!sesion) return
    let activo = true

    cargarTotalesPorMes(mesActualISO(), 6)
      .then((lista) => {
        if (activo) setTotalesPorMes(lista)
      })
      .catch((e) => console.error('Error cargando la tendencia mensual:', e))

    return () => {
      activo = false
    }
  }, [sesion, hogarId])

  const total = compras.reduce((s, a) => s + a.precio, 0)

  // Con despensa compartida el total es el de la casa, así que lo primero
  // que uno quiere saber es quién ha puesto cuánto.
  const porPersona = hogar ? gastoPorPersona(compras, hogar, sesion?.user?.id) : []

  // Agrupamos gasto por categoría (para el donut)
  const porCategoria = agrupar(compras, 'categoria')
  // Agrupamos gasto por supermercado (para las barras)
  const porSuper = agrupar(compras, 'supermercado')

  const hayTendencia = totalesPorMes.some((m) => m.total > 0)

  return (
    <div className="bg-cream min-h-full animate-fade-in pb-6">
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+1.75rem)] pb-2">
        <h1 className="text-2xl font-black text-gray-800">
          {hogar ? 'Vuestros gastos' : 'Tus gastos'}
        </h1>
        <p className="text-gray-400 font-semibold">
          {hogar ? `Resumen de la compra de ${hogar.nombre}` : 'Resumen de tu compra'}
        </p>
      </div>

      <SelectorMes mes={mes} onCambiar={setMes} />

      {/* Tendencia: los últimos 6 meses, con el que se está mirando
          resaltado. Tocar una barra navega a ese mes — mismo gesto que la
          tira de días del Diario. */}
      <Seccion titulo="Gasto por mes">
        {!hayTendencia ? (
          <Vacio />
        ) : (
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={totalesPorMes}
                margin={{ top: 10, bottom: 0 }}
                onClick={(e) => {
                  if (e?.activeLabel) setMes(e.activeLabel)
                }}
              >
                <XAxis
                  dataKey="mes"
                  tickFormatter={nombreMesCorto}
                  interval={0}
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(v) => euros(v)} labelFormatter={nombreMes} cursor={{ fill: '#16a34a11' }} />
                <Bar dataKey="total" radius={[8, 8, 0, 0]} className="cursor-pointer">
                  {totalesPorMes.map((m) => (
                    <Cell key={m.mes} fill={m.mes === mes ? '#16a34a' : '#86efac'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Seccion>

      {/* Tarjeta de gasto total del mes seleccionado */}
      <div className="px-5 mb-5">
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-3xl p-5 text-white shadow-soft">
          <div className="flex items-center gap-2 text-brand-50/80 font-semibold text-sm">
            <Wallet size={16} /> Gasto total
          </div>
          <div className="text-4xl font-black mt-1">{euros(total)}</div>
          <div className="flex items-center gap-1.5 text-brand-50/80 text-sm font-semibold mt-2">
            <TrendingUp size={14} />
            {compras.length} {compras.length === 1 ? 'producto comprado' : 'productos comprados'}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-5 mb-4">
          <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" /> {error}
          </p>
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-brand-400" size={28} />
        </div>
      ) : (
        <>
          {/* Quién ha puesto qué. Solo con hogar: a solas siempre sería el 100 %. */}
          {porPersona.length > 0 && (
            <Seccion titulo="Quién ha puesto qué">
              <div className="space-y-3">
                {porPersona.map((p) => (
                  <div key={p.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-semibold text-gray-600 truncate">
                        {p.nombre}
                        {p.esMio && (
                          <span className="text-gray-400 font-semibold"> · tú</span>
                        )}
                      </span>
                      <span className="font-extrabold text-gray-800 shrink-0 ml-2">
                        {euros(p.valor)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${p.porcentaje}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Seccion>
          )}

          {/* Donut: gasto por categoría */}
          <Seccion titulo="Gasto por categoría">
            {porCategoria.length === 0 ? (
              <Vacio />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-36 h-36 shrink-0 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={porCategoria}
                        dataKey="valor"
                        nameKey="nombre"
                        innerRadius={42}
                        outerRadius={66}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {porCategoria.map((d) => (
                          <Cell key={d.nombre} fill={colorCategoria(d.nombre)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => euros(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-gray-400 font-bold">TOTAL</span>
                    <span className="text-sm font-black text-gray-700">
                      {euros(total)}
                    </span>
                  </div>
                </div>

                {/* Leyenda */}
                <div className="flex-1 space-y-1.5">
                  {porCategoria.map((d) => (
                    <div
                      key={d.nombre}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2 font-semibold text-gray-600">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: colorCategoria(d.nombre) }}
                        />
                        {d.nombre}
                      </span>
                      <span className="font-bold text-gray-700">
                        {euros(d.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Seccion>

          {/* Barras: gasto por supermercado. Con más de 5-6 supermercados,
              Recharts oculta en silencio las etiquetas que no le caben en el
              ancho disponible (interval="auto" por defecto) — así se perdían
              nombres como "Mercadona" o "Carrefour" sin avisar. Se fuerza a
              mostrarlas TODAS (interval={0}) y, para que quepan sin
              solaparse, el gráfico se ensancha según cuántos haya y se hace
              desplazable en horizontal en vez de recortar texto — mismo
              gesto de "desliza para ver más" que ya usan la tira de días y
              las pestañas. */}
          <Seccion titulo="Gasto por supermercado">
            {porSuper.length === 0 ? (
              <Vacio />
            ) : (
              <div className="h-44 -mx-1 overflow-x-auto no-scrollbar">
                <div
                  className="h-full px-1"
                  style={{ minWidth: porSuper.length > 5 ? `${porSuper.length * 72}px` : '100%' }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porSuper} margin={{ top: 10, bottom: 0 }}>
                      <XAxis
                        dataKey="nombre"
                        interval={0}
                        tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v) => euros(v)}
                        cursor={{ fill: '#16a34a11' }}
                      />
                      <Bar dataKey="valor" radius={[8, 8, 0, 0]} fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </Seccion>

          {/* Historial de compras del mes seleccionado */}
          <Seccion titulo={`Compras de ${nombreMes(mes).toLowerCase()}`}>
            <div className="space-y-3">
              {compras.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: colorCategoria(a.categoria) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-700 text-sm truncate">
                      {a.nombre}
                    </div>
                    <div className="text-xs text-gray-400 font-semibold">
                      {a.supermercado} · {fechaCorta(a.fecha)}
                    </div>
                  </div>
                  <span className="font-extrabold text-gray-800 text-sm">
                    {euros(a.precio)}
                  </span>
                </div>
              ))}
              {compras.length === 0 && <Vacio />}
            </div>
          </Seccion>
        </>
      )}
    </div>
  )
}

// Cabecera "‹ Agosto 2026 ›" para moverse mes a mes, con un atajo para
// volver al actual — calcado del patrón de TiraSemana/botón "Hoy" en
// Diario.jsx.
function SelectorMes({ mes, onCambiar }) {
  return (
    <div className="px-5 pb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <FlechaMes onClick={() => onCambiar(sumarMeses(mes, -1))} aria-label="Mes anterior">
          <ChevronLeft size={18} />
        </FlechaMes>
        <span className="font-extrabold text-gray-700 text-[15px] w-32 text-center">
          {nombreMes(mes)}
        </span>
        <FlechaMes
          onClick={() => onCambiar(sumarMeses(mes, 1))}
          disabled={esMesActual(mes)}
          aria-label="Mes siguiente"
        >
          <ChevronRight size={18} />
        </FlechaMes>
      </div>

      {!esMesActual(mes) && (
        <button
          onClick={() => onCambiar(mesActualISO())}
          className="shrink-0 flex items-center gap-1.5 bg-white text-brand-700 font-bold text-sm px-3.5 py-2 rounded-xl shadow-card active:scale-95 transition"
        >
          <CalendarDays size={16} /> Este mes
        </button>
      )}
    </div>
  )
}

function FlechaMes({ onClick, disabled, children, ...props }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 active:scale-90 transition disabled:opacity-25 disabled:pointer-events-none"
      {...props}
    >
      {children}
    </button>
  )
}

// Cuánto ha puesto cada miembro del hogar. `usuario_id` no cambió de
// significado al compartir la despensa: sigue siendo quien compró el
// alimento, así que sirve tal cual para repartir el gasto.
function gastoPorPersona(lista, hogar, miId) {
  const suma = {}
  for (const item of lista) {
    suma[item.usuarioId] = (suma[item.usuarioId] || 0) + item.precio
  }

  const total = Object.values(suma).reduce((s, v) => s + v, 0)

  return hogar.miembros
    .map((m) => {
      const valor = suma[m.usuarioId] || 0
      return {
        id: m.usuarioId,
        nombre: m.nombre || m.email,
        esMio: m.usuarioId === miId,
        valor: Number(valor.toFixed(2)),
        porcentaje: total > 0 ? (valor / total) * 100 : 0,
      }
    })
    .sort((a, b) => b.valor - a.valor)
}

// Agrupa una lista sumando los precios por un campo dado
function agrupar(lista, campo) {
  const mapa = {}
  for (const item of lista) {
    const clave = item[campo] || 'Otros'
    mapa[clave] = (mapa[clave] || 0) + item.precio
  }
  return Object.entries(mapa)
    .map(([nombre, valor]) => ({ nombre, valor: Number(valor.toFixed(2)) }))
    .sort((a, b) => b.valor - a.valor)
}

function Seccion({ titulo, children }) {
  return (
    <div className="px-5 mb-4">
      <h2 className="font-extrabold text-gray-700 mb-3">{titulo}</h2>
      <div className="bg-white rounded-3xl p-4 shadow-card">{children}</div>
    </div>
  )
}

function Vacio() {
  return (
    <p className="text-center text-gray-300 font-semibold py-6 text-sm">
      Aún no hay datos suficientes.
    </p>
  )
}
