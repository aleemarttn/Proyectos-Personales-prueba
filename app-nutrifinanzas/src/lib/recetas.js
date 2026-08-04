import { supabase } from './supabase.js'
import { mensajeErrorFuncion } from './edgeError.js'

// Gemini (tier gratuito) puede tardar mucho bajo carga en esta llamada de
// texto (llegamos a ver 100s+ en pruebas antes de fallar). Sin límite, la
// pantalla se queda con el spinner puesto casi un minuto y medio antes de
// poder reintentar. Con esto, a los 40s se abandona la espera en el
// cliente y se deja reintentar a mano, aunque la función siga corriendo en
// el servidor de fondo.
const TIMEOUT_MS = 40000

// Pide a la Edge Function 'generar-recetas' sugerencias a partir de la
// despensa. `objetivoRestante` solo se manda en modo completo (igual que en
// analizarCarta): con eso las recetas se ordenan por lo bien que encajan en
// lo que le queda hoy al usuario, no solo por ser "sanas" en abstracto.
export async function generarRecetas(alimentos, objetivoRestante = null) {
  const invocacion = supabase.functions.invoke('generar-recetas', {
    body: {
      alimentos: alimentos.map((a) => ({ nombre: a.nombre, categoria: a.categoria })),
      objetivoRestante,
    },
  })

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
  )

  const { data, error } = await Promise.race([invocacion, timeout])

  if (error) throw new Error(await mensajeErrorFuncion(error, 'No se pudieron generar recetas.'))
  if (data?.error) throw new Error(data.error)

  return data // { recetas, recomendadoIndice, motivo }
}
