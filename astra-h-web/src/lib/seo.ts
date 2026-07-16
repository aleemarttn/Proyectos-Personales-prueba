/**
 * Generadores de JSON-LD (schema.org) servidos en el HTML inicial del build.
 * Todas las URLs deben ser absolutas: construir con `new URL(ruta, Astro.site)`.
 */

export interface MigaDePan {
  nombre: string;
  url: string;
}

/** BreadcrumbList que refleja la jerarquía del silo. */
export function breadcrumbList(migas: MigaDePan[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: migas.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: m.nombre,
      item: m.url,
    })),
  };
}

export interface DatosArticulo {
  titulo: string;
  descripcion: string;
  url: string;
  fechaPublicacion: string;
  fechaModificacion?: string;
}

/** Article para las entradas del silo. */
export function articulo(d: DatosArticulo) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: d.titulo,
    description: d.descripcion,
    mainEntityOfPage: d.url,
    datePublished: d.fechaPublicacion,
    dateModified: d.fechaModificacion ?? d.fechaPublicacion,
  };
}

/** FAQPage a partir de la lista de preguntas frecuentes de la entrada. */
export function faqPage(faq: { pregunta: string; respuesta: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.pregunta,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.respuesta,
      },
    })),
  };
}
