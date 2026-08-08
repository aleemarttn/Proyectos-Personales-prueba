import { unidadDe } from '../utils/unidades.js'

// Avisos sobre un alimento, calculados con REGLAS, no con IA: son
// instantáneos, gratis, no gastan cuota y —sobre todo— no se inventan nada.
// Los umbrales no me los he sacado de la manga, son los que ya se usan en
// las etiquetas:
//
//   - "alto/bajo en" (grasas saturadas, azúcares, sal): semáforo nutricional
//     de la FSA británica, el de los colores rojo/ámbar/verde.
//   - "fuente de" / "alto contenido en" (fibra, proteínas): Reglamento
//     europeo 1924/2006, que es lo que legalmente puede poner un envase.
//
// Los umbrales de bebidas son distintos (y más bajos) que los de sólidos,
// por eso se mira si el alimento va en g o en ml.

const UMBRALES = {
  g: {
    saturadas: 5,
    azucares: 22.5,
    sal: 1.5,
    // "Alto en grasa" no genera alerta (ver más abajo), pero sí sirve para
    // callarse los elogios: presumir de la fibra de unas patatas fritas es
    // justo lo que no debe hacer esto.
    grasas: 17.5,
    // Umbrales "bajo en" de la misma tabla de la FSA
    salBaja: 0.3,
    azucaresBajos: 5,
  },
  ml: {
    saturadas: 2.5,
    azucares: 11.25,
    sal: 0.75,
    grasas: 8.75,
    salBaja: 0.3,
    azucaresBajos: 2.5,
  },
}

// Fibra (Reg. 1924/2006, por 100 g): 3 g = "fuente de", 6 g = "alto en"
const FIBRA_FUENTE = 3
const FIBRA_ALTA = 6

// Proteínas: se mide en % de la energía total, no en gramos.
// 12 % = "fuente de", 20 % = "alto contenido en".
const PROTEINA_FUENTE = 0.12
const PROTEINA_ALTA = 0.2

// A partir de aquí un alimento es claramente graso; por debajo no merece la
// pena comentar nada sobre el tipo de grasa.
const GRASA_RELEVANTE = 10
// Si como mucho un tercio de la grasa es saturada, el resto es insaturada
// (la "buena"): es el caso del aguacate, los frutos secos o el aceite de
// oliva, y es justo lo contrario de un aviso.
const PROPORCION_INSATURADA = 1 / 3

// Ojo: `Number(null)` es 0, no NaN. Sin este corte, un alimento antiguo sin
// datos (todo a null) se leería como "0 g de saturadas, 0 de azúcar, 0 de
// sal" y la app se pondría a repartir elogios que no puede demostrar.
function numero(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

// Devuelve los avisos de un alimento con sus valores POR 100 g/ml
// (`grasasSaturadas`, `azucares`, `sal`, `fibra`, `grasas`, `proteinas`,
// `kcal`). Como mucho `maximo` avisos, las alertas siempre por delante:
// más de dos y esto se convierte en un sermón que la gente aprende a
// ignorar.
export function avisosDe(alimento, maximo = 2) {
  if (!alimento) return []

  const unidad = unidadDe(alimento)
  const limites = UMBRALES[unidad] || UMBRALES.g
  const esBebida = unidad === 'ml'
  const por = esBebida ? '100 ml' : '100 g'

  const saturadas = numero(alimento.grasasSaturadas)
  const azucares = numero(alimento.azucares)
  const sal = numero(alimento.sal)
  const fibra = numero(alimento.fibra)
  const grasas = numero(alimento.grasas)
  const proteinas = numero(alimento.proteinas)
  const kcal = numero(alimento.kcal)

  const alertas = []
  const buenas = []

  // ¿Es un alimento graso pero cuya grasa es sobre todo insaturada, y además
  // limpio de sal y azúcar? Ese es el aguacate, las almendras y el aceite de
  // oliva. Se calcula antes que nada porque cambia dos cosas: añade un
  // elogio y CALLA la alerta de saturadas (el aceite de oliva tiene 13,8 g
  // de saturadas, pero son el 14 % de su grasa; avisar ahí sería absurdo).
  // Lo de la sal y el azúcar no es un capricho: es lo que separa un fruto
  // seco de unas patatas fritas, que también son grasa mayormente insaturada.
  const grasaMayormenteInsaturada =
    grasas !== null &&
    saturadas !== null &&
    grasas >= GRASA_RELEVANTE &&
    saturadas <= grasas * PROPORCION_INSATURADA &&
    (sal === null || sal <= limites.salBaja) &&
    (azucares === null || azucares <= limites.azucaresBajos)

  // --- Alertas ---
  // Ojo: NO se avisa de la grasa TOTAL a propósito. Con ese umbral saltarían
  // el aguacate, las almendras y el aceite de oliva, que es exactamente lo
  // que no queremos decirle a nadie.

  if (saturadas !== null && saturadas > limites.saturadas && !grasaMayormenteInsaturada) {
    alertas.push({
      id: 'saturadas',
      tipo: 'alerta',
      // Cuánto se pasa del umbral: ordena mejor que el valor absoluto
      peso: saturadas / limites.saturadas,
      texto: `Muy alto en grasas saturadas (${formatear(saturadas)} g por ${por})`,
    })
  }

  if (azucares !== null && azucares > limites.azucares) {
    alertas.push({
      id: 'azucares',
      tipo: 'alerta',
      peso: azucares / limites.azucares,
      texto: `Muy alto en azúcares (${formatear(azucares)} g por ${por})`,
    })
  }

  if (sal !== null && sal > limites.sal) {
    alertas.push({
      id: 'sal',
      tipo: 'alerta',
      peso: sal / limites.sal,
      texto: `Muy alto en sal (${formatear(sal)} g por ${por})`,
    })
  }

  // --- Cosas buenas ---

  // Presumir de fibra o de proteínas solo si el alimento no es muy graso:
  // unas patatas fritas llevan fibra de verdad, pero destacarla sería
  // engañoso. Los frutos secos, que sí son grasos, ya tienen su elogio en
  // la grasa insaturada.
  const puedePresumir = grasas === null || grasas <= limites.grasas

  if (grasaMayormenteInsaturada) {
    buenas.push({
      id: 'insaturadas',
      tipo: 'bien',
      peso: 2,
      texto: 'Graso, pero casi toda su grasa es insaturada (de la buena)',
    })
  }

  if (puedePresumir && fibra !== null && fibra >= FIBRA_FUENTE) {
    buenas.push({
      id: 'fibra',
      tipo: 'bien',
      peso: fibra >= FIBRA_ALTA ? 1.5 : 1,
      texto:
        fibra >= FIBRA_ALTA
          ? `Alto en fibra (${formatear(fibra)} g por ${por})`
          : `Buena fuente de fibra (${formatear(fibra)} g por ${por})`,
    })
  }

  // Proteína como porcentaje de la energía: 20 g en algo de 100 kcal no es
  // lo mismo que 20 g en algo de 500 kcal.
  if (puedePresumir && proteinas !== null && kcal !== null && kcal > 0) {
    const porcentaje = (proteinas * 4) / kcal
    if (porcentaje >= PROTEINA_FUENTE) {
      buenas.push({
        id: 'proteinas',
        tipo: 'bien',
        peso: porcentaje >= PROTEINA_ALTA ? 1.6 : 1.1,
        texto:
          porcentaje >= PROTEINA_ALTA
            ? `Alto en proteínas (${formatear(proteinas)} g por ${por})`
            : `Buena fuente de proteínas (${formatear(proteinas)} g por ${por})`,
      })
    }
  }

  const ordenar = (lista) => lista.sort((a, b) => b.peso - a.peso)

  // Si hay algo que avisar, se avisa y punto: no se mezcla con elogios. Un
  // batido con 12 g de azúcar por 100 ml no necesita que además le digamos
  // que es "buena fuente de proteínas"; eso es lo que hacen los envases.
  if (alertas.length > 0) return ordenar(alertas).slice(0, maximo)
  return ordenar(buenas).slice(0, maximo)
}

// 12 -> "12"; 12.5 -> "12,5" (y nada de 12.299999999)
function formatear(valor) {
  return Number(valor.toFixed(1)).toLocaleString('es-ES')
}
