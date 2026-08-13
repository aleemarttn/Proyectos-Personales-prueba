import { useEffect, useState } from 'react'
import { comidaSugeridaPorHora } from '../lib/comidas.js'

// A qué comida del día va algo. `inicial` deja fijar una ya elegida de
// antemano (p.ej. por la URL, si se viene del botón "+ Añadir" de una
// comida concreta del diario); si no hay ninguna y las comidas ya han
// cargado (llegan de forma asíncrona), se propone la de la hora actual.
// Repetido antes en ConfirmarCarta, Recetas y RegistrarComida: se extrae
// aquí para que las tres pantallas no puedan desincronizarse.
export function useComidaSugerida(comidas, inicial = null) {
  const [comidaId, setComidaId] = useState(inicial)

  useEffect(() => {
    if (comidaId || comidas.length === 0) return
    setComidaId(comidaSugeridaPorHora(comidas)?.id ?? null)
  }, [comidas, comidaId])

  return [comidaId, setComidaId]
}
