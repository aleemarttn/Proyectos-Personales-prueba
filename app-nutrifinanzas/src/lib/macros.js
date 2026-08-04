// Construye el "objetivoRestante" que se manda a Gemini (analizar-imagen
// modo carta, generar-recetas) para que la recomendación tenga en cuenta lo
// que le queda hoy al usuario en vez de ser "sana" en abstracto. Solo tiene
// sentido en modo completo, con `resumen` ya cargado (DiarioContext).
//
// Los macros consumidos pueden superar el objetivo (te has pasado de
// proteína, por ejemplo): sin el suelo en 0, "restante" sale negativo y se
// le manda a la IA tal cual ("te quedan -30g de proteína"), una instrucción
// sin sentido que puede desviar la recomendación.
export function objetivoRestanteHoy(resumen) {
  if (!resumen) return null
  return {
    kcal_restante: Math.max(0, Math.round(resumen.kcalRestanteHoy)),
    proteinas_restante: Math.max(0, Math.round(resumen.proteinasGObjetivo - resumen.proteinasConsumidoHoy)),
    hidratos_restante: Math.max(0, Math.round(resumen.hidratosGObjetivo - resumen.hidratosConsumidoHoy)),
    grasas_restante: Math.max(0, Math.round(resumen.grasasGObjetivo - resumen.grasasConsumidoHoy)),
  }
}
