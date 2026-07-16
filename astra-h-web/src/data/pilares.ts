export interface Pilar {
  slug: string;
  nombre: string;
  descripcion: string;
}

export const pilares: Record<string, Pilar> = {
  averias: {
    slug: 'averias-y-diagnostico',
    nombre: 'Averías y diagnóstico',
    descripcion:
      'Fallos frecuentes del Opel Astra H por sistema, con kilometraje habitual de aparición y coste estimado de reparación.',
  },
  motorizaciones: {
    slug: 'motorizaciones',
    nombre: 'Motorizaciones',
    descripcion:
      'Análisis por motor (1.6, 1.7 CDTI, 1.8, 1.9 CDTI): fiabilidad, consumo y mantenimiento específico.',
  },
  carrocerias: {
    slug: 'variantes-de-carroceria',
    nombre: 'Variantes de carrocería',
    descripcion: 'Análisis centrado en las variantes OPC y GTC del Astra H.',
  },
  mantenimiento: {
    slug: 'mantenimiento-preventivo',
    nombre: 'Mantenimiento preventivo',
    descripcion: 'Calendarios de mantenimiento por kilometraje y guías paso a paso.',
  },
  recursos: {
    slug: 'recursos-tecnicos',
    nombre: 'Recursos técnicos',
    descripcion: 'Esquemas eléctricos, manuales de fusibles y documentación de referencia.',
  },
};
