// Comunidades autónomas y ciudades autónomas de España, con sus provincias.
// Las comunidades uniprovinciales repiten el mismo nombre en ambos campos
// (ej. Asturias), para no obligar a un selector de provincia vacío o inútil.
export const REGIONES_ESPANA = [
  { comunidad: 'Andalucía', provincias: ['Almería', 'Cádiz', 'Córdoba', 'Granada', 'Huelva', 'Jaén', 'Málaga', 'Sevilla'] },
  { comunidad: 'Aragón', provincias: ['Huesca', 'Teruel', 'Zaragoza'] },
  { comunidad: 'Principado de Asturias', provincias: ['Asturias'] },
  { comunidad: 'Illes Balears', provincias: ['Illes Balears'] },
  { comunidad: 'Canarias', provincias: ['Las Palmas', 'Santa Cruz de Tenerife'] },
  { comunidad: 'Cantabria', provincias: ['Cantabria'] },
  { comunidad: 'Castilla-La Mancha', provincias: ['Albacete', 'Ciudad Real', 'Cuenca', 'Guadalajara', 'Toledo'] },
  { comunidad: 'Castilla y León', provincias: ['Ávila', 'Burgos', 'León', 'Palencia', 'Salamanca', 'Segovia', 'Soria', 'Valladolid', 'Zamora'] },
  { comunidad: 'Cataluña', provincias: ['Barcelona', 'Girona', 'Lleida', 'Tarragona'] },
  { comunidad: 'Comunitat Valenciana', provincias: ['Alicante', 'Castellón', 'Valencia'] },
  { comunidad: 'Extremadura', provincias: ['Badajoz', 'Cáceres'] },
  { comunidad: 'Galicia', provincias: ['A Coruña', 'Lugo', 'Ourense', 'Pontevedra'] },
  { comunidad: 'Comunidad de Madrid', provincias: ['Madrid'] },
  { comunidad: 'Región de Murcia', provincias: ['Murcia'] },
  { comunidad: 'Comunidad Foral de Navarra', provincias: ['Navarra'] },
  { comunidad: 'País Vasco', provincias: ['Álava', 'Gipuzkoa', 'Vizcaya'] },
  { comunidad: 'La Rioja', provincias: ['La Rioja'] },
  { comunidad: 'Ceuta', provincias: ['Ceuta'] },
  { comunidad: 'Melilla', provincias: ['Melilla'] },
]

// Provincias de una comunidad autónoma dada (vacío si no se reconoce).
export function provinciasDe(comunidad) {
  return REGIONES_ESPANA.find((r) => r.comunidad === comunidad)?.provincias ?? []
}
