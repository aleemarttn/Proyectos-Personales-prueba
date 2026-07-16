export interface Pilar {
  slug: string;
  /** Nombre corto para menú y migas de pan. */
  nombre: string;
  /** Descripción breve para las tarjetas de la home. */
  descripcion: string;
  /** Meta description única de la página índice del pilar. */
  descripcionSeo: string;
  /** Párrafos de introducción de la página índice del pilar. */
  intro: string[];
}

/** Orden de aparición en el menú y en la home. */
export const ordenPilares = [
  'averias',
  'motorizaciones',
  'carrocerias',
  'mantenimiento',
  'recursos',
] as const;

export const pilares: Record<string, Pilar> = {
  averias: {
    slug: 'averias-y-diagnostico',
    nombre: 'Averías y diagnóstico',
    descripcion: 'Fallos frecuentes por sistema, con kilometraje habitual y coste de reparación.',
    descripcionSeo:
      'Fallos frecuentes del Opel Astra H por sistema: síntomas, kilometraje habitual de aparición y coste estimado de reparación, con guías de diagnóstico.',
    intro: [
      'El Opel Astra H (2004–2010) arrastra un grupo de averías recurrentes que se repiten de un propietario a otro. En esta sección las reunimos organizadas por sistema del vehículo, para que puedas localizar rápido qué le ocurre al tuyo.',
      'En cada avería encontrarás los síntomas característicos, el kilometraje en el que suele aparecer y una estimación del coste de reparación, de forma que llegues al taller sabiendo de qué hablas.',
    ],
  },
  motorizaciones: {
    slug: 'motorizaciones',
    nombre: 'Motorizaciones',
    descripcion: 'Análisis por motor: fiabilidad, consumo y mantenimiento específico.',
    descripcionSeo:
      'Análisis de las motorizaciones del Opel Astra H (1.6, 1.7 CDTI, 1.8, 1.9 CDTI): fiabilidad, consumo real y mantenimiento específico de cada motor.',
    intro: [
      'El Astra H se ofreció con varias motorizaciones de gasolina y diésel, cada una con su carácter, su consumo y sus puntos débiles. Aquí analizamos motor por motor para ayudarte a elegir o a entender el que ya tienes.',
      'Cubrimos fiabilidad, consumo real y mantenimiento específico de las mecánicas más habituales: 1.6, 1.7 CDTI, 1.8 y 1.9 CDTI.',
    ],
  },
  carrocerias: {
    slug: 'variantes-de-carroceria',
    nombre: 'Variantes de carrocería',
    descripcion: 'Foco en las versiones OPC y GTC: qué las diferencia y qué revisar.',
    descripcionSeo:
      'Variantes de carrocería del Opel Astra H, con foco en las versiones OPC y GTC: qué las diferencia, qué revisar al comprar y su mantenimiento.',
    intro: [
      'Más allá del berlina y el familiar, el Astra H tiene variantes con personalidad propia. En esta sección nos centramos en las carrocerías más buscadas y en lo que las diferencia del resto de la gama.',
      'Prestamos especial atención a las versiones OPC y GTC: qué las hace especiales, qué revisar antes de comprar una y qué mantenimiento requieren.',
    ],
  },
  mantenimiento: {
    slug: 'mantenimiento-preventivo',
    nombre: 'Mantenimiento preventivo',
    descripcion: 'Calendarios por kilometraje y guías paso a paso.',
    descripcionSeo:
      'Mantenimiento preventivo del Opel Astra H: calendarios por kilometraje y guías paso a paso para adelantarte a las averías más comunes.',
    intro: [
      'Un Astra H bien mantenido puede dar muchos kilómetros sin sustos. En esta sección recopilamos el mantenimiento preventivo: qué revisar y cuándo, para adelantarte a las averías en lugar de perseguirlas.',
      'Encontrarás calendarios de mantenimiento organizados por kilometraje y guías paso a paso para las tareas que puedes afrontar en casa.',
    ],
  },
  recursos: {
    slug: 'recursos-tecnicos',
    nombre: 'Recursos técnicos',
    descripcion: 'Esquemas eléctricos, mapas de fusibles y documentación de referencia.',
    descripcionSeo:
      'Recursos técnicos del Opel Astra H: esquemas eléctricos, mapas de fusibles y documentación de referencia para reparar y diagnosticar.',
    intro: [
      'A la hora de reparar o diagnosticar, tener la documentación correcta a mano ahorra mucho tiempo. En esta sección reunimos recursos técnicos de referencia del Astra H.',
      'Esquemas eléctricos, mapas de fusiblera y documentación de consulta, organizados para encontrarlos rápido cuando los necesitas.',
    ],
  },
};
