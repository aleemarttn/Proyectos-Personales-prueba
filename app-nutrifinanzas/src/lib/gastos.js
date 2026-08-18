import { supabase } from './supabase.js'
import { filaAAlimento } from '../context/AppContext.jsx'
import { mesDe, sumarMeses } from './fechas.js'

// Historial de gasto por mes (pantalla Gastos.jsx). A diferencia de
// AppContext.leerAlimentos() (la despensa EN VIVO, que filtra
// `eliminado_en is null`), aquí interesa justo lo contrario: todo lo que se
// compró ese mes, siga o no en la nevera — si no, en cuanto algo se come o
// se tira, su coste desaparecería del historial (ver migración 024).

// Todas las compras (activas o ya consumidas) con `fecha` dentro del mes
// dado. `mesISO` es el primer día del mes ('YYYY-MM-01', ver lib/fechas.js).
export async function cargarComprasDelMes(mesISO) {
  const inicio = mesDe(mesISO)
  const fin = sumarMeses(inicio, 1) // límite exclusivo: primer día del mes siguiente

  const { data, error } = await supabase
    .from('alimentos')
    .select('*')
    .gte('fecha', inicio)
    .lt('fecha', fin)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data.map(filaAAlimento)
}

// Total gastado en cada uno de los últimos `nMeses` meses (incluido el
// actual), para el gráfico de tendencia. Se trae fecha+precio en bruto y se
// suma en el cliente por mes — mismo estilo que ya usa Gastos.jsx para
// agrupar por categoría/supermercado (en todo el esquema solo hay una
// vista, resumen_diario; el resto de agregados se calculan aquí).
export async function cargarTotalesPorMes(mesActualISO, nMeses = 6) {
  const desde = sumarMeses(mesActualISO, -(nMeses - 1))

  const { data, error } = await supabase
    .from('alimentos')
    .select('fecha, precio')
    .gte('fecha', desde)

  if (error) throw error

  const totales = {}
  for (let i = 0; i < nMeses; i++) {
    totales[sumarMeses(desde, i)] = 0
  }
  for (const fila of data) {
    const mes = mesDe(fila.fecha)
    if (mes in totales) totales[mes] += Number(fila.precio) || 0
  }

  return Object.entries(totales).map(([mes, total]) => ({
    mes,
    total: Number(total.toFixed(2)),
  }))
}
