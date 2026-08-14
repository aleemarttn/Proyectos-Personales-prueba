import { supabase } from './supabase.js'
import { nutrientesAFila, nutrientesDeFila } from './nutrientes.js'

// Catálogo compartido de productos (tabla `productos`, indexada por
// código de barras). Cualquier usuario puede leerlo y contribuir a él:
// así la info nutricional de un producto solo hace falta escanearla una
// vez entre toda la comunidad de la app.

// Busca un producto ya conocido por su código de barras.
// Devuelve el producto (camelCase) o null si no está en el catálogo.
export async function buscarProductoPorCodigoBarras(codigoBarras) {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('codigo_barras', codigoBarras)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    codigoBarras: data.codigo_barras,
    nombre: data.nombre,
    marca: data.marca,
    kcal: data.kcal,
    proteinas: data.proteinas === null ? null : Number(data.proteinas),
    hidratos: data.hidratos === null ? null : Number(data.hidratos),
    grasas: data.grasas === null ? null : Number(data.grasas),
    categoria: data.categoria,
    pesoUnidadG: data.peso_unidad_g === null ? null : Number(data.peso_unidad_g),
    unidadNombre: data.unidad_nombre,
    unidadMedida: data.unidad_medida || 'g',
    ...nutrientesDeFila(data),
  }
}

// Busca productos del catálogo compartido por nombre (para registrar una
// comida sin necesidad de escanear el código de barras). Devuelve como
// mucho 10 resultados, camelCase igual que buscarProductoPorCodigoBarras.
export async function buscarProductosPorNombre(texto) {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .ilike('nombre', `%${texto}%`)
    .limit(10)

  if (error) throw error

  return data.map((d) => ({
    codigoBarras: d.codigo_barras,
    nombre: d.nombre,
    marca: d.marca,
    kcal: d.kcal,
    proteinas: d.proteinas === null ? null : Number(d.proteinas),
    hidratos: d.hidratos === null ? null : Number(d.hidratos),
    grasas: d.grasas === null ? null : Number(d.grasas),
    categoria: d.categoria,
    pesoUnidadG: d.peso_unidad_g === null ? null : Number(d.peso_unidad_g),
    unidadNombre: d.unidad_nombre,
    unidadMedida: d.unidad_medida || 'g',
    ...nutrientesDeFila(d),
  }))
}

// Añade o completa un producto en el catálogo compartido tras confirmarlo
// en la app (nuevo producto, o macros añadidos/corregidos a uno existente
// que se detectó por código de barras). No lanza si falla: contribuir al
// catálogo compartido nunca debe bloquear el guardado en la despensa del
// usuario. Devuelve true/false para que quien vaya a referenciar ese código
// de barras en otra tabla (p.ej. `alimentos`, que lo tiene como foreign key)
// sepa si de verdad quedó creado.
export async function guardarProductoEnCatalogo(producto) {
  try {
    const { error } = await supabase.from('productos').upsert(
      {
        codigo_barras: producto.codigoBarras,
        nombre: producto.nombre,
        marca: producto.marca || null,
        kcal: producto.kcal ?? null,
        proteinas: producto.proteinas ?? null,
        hidratos: producto.hidratos ?? null,
        grasas: producto.grasas ?? null,
        categoria: producto.categoria || null,
        peso_unidad_g: producto.pesoUnidadG ?? null,
        unidad_nombre: producto.unidadNombre || null,
        unidad_medida: producto.unidadMedida === 'ml' ? 'ml' : 'g',
        ...nutrientesAFila(producto),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'codigo_barras' }
    )
    if (error) throw error
    return true
  } catch (e) {
    console.error('No se pudo guardar el producto en el catálogo compartido:', e)
    return false
  }
}
