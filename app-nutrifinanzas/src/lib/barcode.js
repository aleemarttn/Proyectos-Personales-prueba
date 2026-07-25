// Consulta Open Food Facts (la misma base de datos que usan apps como Yuka)
// a partir de un código de barras EAN/UPC leído por la cámara. Es una API
// pública y gratuita, sin clave: se llama directamente desde el navegador.
// Se usa solo como respaldo cuando el código no está en nuestro catálogo
// compartido de Supabase (ver lib/productos.js), que siempre se consulta
// primero porque es instantáneo y ya trae los macros tal como los guardó
// la comunidad.

const CAMPOS = 'product_name,generic_name,brands,nutriments,categories_tags,quantity,status'

const REGLAS_CATEGORIA = [
  { categoria: 'Lácteos', claves: ['dairy', 'milk', 'yogurt', 'cheese'] },
  {
    categoria: 'Proteínas',
    claves: ['meat', 'poultry', 'fish', 'seafood', 'egg', 'legume', 'tofu'],
  },
  { categoria: 'Fruta', claves: ['fruit'] },
  { categoria: 'Verduras', claves: ['vegetable'] },
  { categoria: 'Grasas', claves: ['oil', 'butter', 'nut', 'spread'] },
  { categoria: 'Hidratos', claves: ['bread', 'pasta', 'rice', 'cereal', 'potato'] },
]

function adivinarCategoria(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return 'Otros'
  const texto = tags
    .map((t) => t.replace(/^[a-z]{2}:/, ''))
    .join(' ')
    .toLowerCase()
  const regla = REGLAS_CATEGORIA.find((r) => r.claves.some((clave) => texto.includes(clave)))
  return regla?.categoria || 'Otros'
}

function primeraMarca(brands) {
  if (!brands) return null
  return brands.split(',')[0].trim() || null
}

function numeroValido(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

// Devuelve { encontrado: true, nombre, marca, cantidad, kcal, proteinas,
// hidratos, grasas, categoria } si el producto existe en Open Food Facts Y
// tiene kcal/100g. Si no existe o no tiene información nutricional,
// { encontrado: false, nombre, marca } (nombre/marca pueden venir rellenos
// igualmente, para prefill del alta manual).
export async function consultarOpenFoodFacts(codigo) {
  let datos
  try {
    const resp = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=${CAMPOS}`
    )
    if (!resp.ok) throw new Error(`Open Food Facts respondió ${resp.status}`)
    datos = await resp.json()
  } catch (e) {
    throw new Error('No se pudo consultar la base de datos de productos.')
  }

  if (datos.status !== 1 || !datos.product) {
    return { encontrado: false, nombre: null, marca: null }
  }

  const producto = datos.product
  const nutrientes = producto.nutriments || {}
  const nombre = (producto.product_name || producto.generic_name || '').trim()
  const marca = primeraMarca(producto.brands)
  const kcal =
    numeroValido(nutrientes['energy-kcal_100g']) ?? numeroValido(nutrientes['energy-kcal_serving'])

  if (!nombre || kcal == null) {
    return { encontrado: false, nombre: nombre || null, marca }
  }

  return {
    encontrado: true,
    nombre,
    marca,
    cantidad: producto.quantity?.trim() || '',
    kcal: Math.round(kcal),
    proteinas: numeroValido(nutrientes.proteins_100g),
    hidratos: numeroValido(nutrientes.carbohydrates_100g),
    grasas: numeroValido(nutrientes.fat_100g),
    categoria: adivinarCategoria(producto.categories_tags),
  }
}
