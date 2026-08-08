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
import { Wallet, TrendingUp } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { colorCategoria } from '../data/categorias.js'
import { euros, fechaCorta } from '../utils/formato.js'

// Panel de gastos: total, donut por categoría, barras por supermercado y
// lista de últimas compras. Todo se calcula a partir de los alimentos.
export default function Gastos() {
  const { alimentos } = useApp()
  const { hogar, sesion } = useAuth()

  const total = alimentos.reduce((s, a) => s + a.precio, 0)

  // Con despensa compartida el total es el de la casa, así que lo primero
  // que uno quiere saber es quién ha puesto cuánto.
  const porPersona = hogar ? gastoPorPersona(alimentos, hogar, sesion?.user?.id) : []

  // Agrupamos gasto por categoría (para el donut)
  const porCategoria = agrupar(alimentos, 'categoria')
  // Agrupamos gasto por supermercado (para las barras)
  const porSuper = agrupar(alimentos, 'supermercado')

  // Últimas compras ordenadas por fecha (más reciente primero)
  const ultimas = [...alimentos].sort((a, b) =>
    (b.fecha || '').localeCompare(a.fecha || '')
  )

  return (
    <div className="bg-cream min-h-full animate-fade-in pb-6">
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+1.75rem)] pb-4">
        <h1 className="text-2xl font-black text-gray-800">
          {hogar ? 'Vuestros gastos' : 'Tus gastos'}
        </h1>
        <p className="text-gray-400 font-semibold">
          {hogar ? `Resumen de la compra de ${hogar.nombre}` : 'Resumen de tu compra'}
        </p>
      </div>

      {/* Tarjeta de gasto total */}
      <div className="px-5 mb-5">
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-3xl p-5 text-white shadow-soft">
          <div className="flex items-center gap-2 text-brand-50/80 font-semibold text-sm">
            <Wallet size={16} /> Gasto total
          </div>
          <div className="text-4xl font-black mt-1">{euros(total)}</div>
          <div className="flex items-center gap-1.5 text-brand-50/80 text-sm font-semibold mt-2">
            <TrendingUp size={14} />
            {alimentos.length} productos en tu despensa
          </div>
        </div>
      </div>

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

      {/* Barras: gasto por supermercado */}
      <Seccion titulo="Gasto por supermercado">
        {porSuper.length === 0 ? (
          <Vacio />
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porSuper} margin={{ top: 10, bottom: 0 }}>
                <XAxis
                  dataKey="nombre"
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
        )}
      </Seccion>

      {/* Lista de últimas compras */}
      <Seccion titulo="Últimas compras">
        <div className="space-y-3">
          {ultimas.slice(0, 8).map((a) => (
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
          {ultimas.length === 0 && <Vacio />}
        </div>
      </Seccion>
    </div>
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
