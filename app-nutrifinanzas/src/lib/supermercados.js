import { supabase } from './supabase.js'

// Lista de supermercados, comunitaria: cualquiera puede añadir uno nuevo
// (estilo wiki, igual que el catálogo de productos) en vez de depender de
// una lista fija en el código.

export async function listarSupermercados() {
  const { data, error } = await supabase.from('supermercados').select('nombre').order('nombre')
  if (error) throw error
  return data.map((d) => d.nombre)
}

export async function anadirSupermercado(nombre) {
  const { error } = await supabase
    .from('supermercados')
    .upsert({ nombre }, { onConflict: 'nombre', ignoreDuplicates: true })
  if (error) throw error
}
