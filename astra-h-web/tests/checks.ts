import { parse } from 'node-html-parser';

/**
 * Comprobaciones de SEO técnico sobre el HTML CRUDO (tal cual lo recibe un
 * crawler, sin ejecutar JavaScript). Cada función es pura: recibe el HTML (y,
 * cuando hace falta, contexto de la petición) y devuelve un Resultado.
 *
 * Se prueban de forma aislada en checks.test.ts y se aplican a rutas reales en
 * seo-html-crudo.test.ts.
 */

export interface Resultado {
  ok: boolean;
  mensaje: string;
}

/** Debe haber exactamente un <title> no vacío. */
export function checkTitle(html: string): Resultado {
  const root = parse(html);
  const titles = root.querySelectorAll('title');
  if (titles.length === 0) return { ok: false, mensaje: 'Falta <title>' };
  if (titles.length > 1) return { ok: false, mensaje: `Hay ${titles.length} <title> (debe haber exactamente 1)` };
  const texto = titles[0].text.trim();
  if (!texto) return { ok: false, mensaje: '<title> vacío' };
  return { ok: true, mensaje: `title: "${texto}"` };
}

/** Debe haber exactamente una <meta name="description"> no vacía. Devuelve su contenido para el chequeo de unicidad entre rutas. */
export function checkMetaDescription(html: string): Resultado & { contenido?: string } {
  const root = parse(html);
  const metas = root.querySelectorAll('meta[name="description"]');
  if (metas.length === 0) return { ok: false, mensaje: 'Falta <meta name="description">' };
  if (metas.length > 1) return { ok: false, mensaje: `Hay ${metas.length} meta description (debe haber exactamente 1)` };
  const contenido = (metas[0].getAttribute('content') ?? '').trim();
  if (!contenido) return { ok: false, mensaje: 'meta description vacía' };
  return { ok: true, mensaje: `description: "${contenido}"`, contenido };
}

/**
 * Debe haber un <link rel="canonical"> absoluto (http/https), del origen
 * esperado y apuntando a la ruta pedida.
 */
export function checkCanonical(html: string, origenEsperado: string, rutaEsperada: string): Resultado {
  const root = parse(html);
  const links = root.querySelectorAll('link[rel="canonical"]');
  if (links.length === 0) return { ok: false, mensaje: 'Falta <link rel="canonical">' };
  if (links.length > 1) return { ok: false, mensaje: `Hay ${links.length} canonical (debe haber exactamente 1)` };
  const href = (links[0].getAttribute('href') ?? '').trim();
  if (!href) return { ok: false, mensaje: 'canonical vacío' };
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { ok: false, mensaje: `canonical no es una URL absoluta: "${href}"` };
  }
  if (url.origin !== origenEsperado) {
    return { ok: false, mensaje: `canonical con origen inesperado: "${url.origin}" (esperado "${origenEsperado}")` };
  }
  const norm = (p: string) => (p.endsWith('/') ? p : p + '/');
  if (norm(url.pathname) !== norm(rutaEsperada)) {
    return { ok: false, mensaje: `canonical apunta a "${url.pathname}" (esperado "${rutaEsperada}")` };
  }
  return { ok: true, mensaje: `canonical: "${href}"` };
}

/** No debe haber noindex, ni en <meta name="robots"> ni en la cabecera X-Robots-Tag. */
export function checkNoindex(html: string, headers?: Headers): Resultado {
  const root = parse(html);
  const metas = root.querySelectorAll('meta[name="robots"], meta[name="googlebot"]');
  for (const m of metas) {
    const content = (m.getAttribute('content') ?? '').toLowerCase();
    if (content.includes('noindex')) {
      return { ok: false, mensaje: `noindex encontrado en <meta name="${m.getAttribute('name')}">` };
    }
  }
  const xRobots = headers?.get('x-robots-tag')?.toLowerCase();
  if (xRobots && xRobots.includes('noindex')) {
    return { ok: false, mensaje: `noindex encontrado en cabecera X-Robots-Tag: "${xRobots}"` };
  }
  return { ok: true, mensaje: 'sin noindex' };
}

/** El <body> debe tener texto real suficiente (sin contar scripts ni estilos). */
export function checkTextoSuficiente(html: string, minimoCaracteres: number): Resultado {
  const root = parse(html);
  root.querySelectorAll('script, style').forEach((n) => n.remove());
  const body = root.querySelector('body');
  const texto = (body?.text ?? root.text).replace(/\s+/g, ' ').trim();
  if (texto.length < minimoCaracteres) {
    return { ok: false, mensaje: `texto insuficiente: ${texto.length} caracteres (mínimo ${minimoCaracteres})` };
  }
  return { ok: true, mensaje: `texto: ${texto.length} caracteres` };
}

/** Extrae los @type declarados en un nodo JSON-LD (soporta @graph y arrays). */
function tiposDeNodo(data: unknown): string[] {
  const tipos: string[] = [];
  const visitar = (n: unknown) => {
    if (Array.isArray(n)) {
      n.forEach(visitar);
    } else if (n && typeof n === 'object') {
      const obj = n as Record<string, unknown>;
      if (obj['@type']) {
        if (Array.isArray(obj['@type'])) tipos.push(...(obj['@type'] as string[]));
        else tipos.push(String(obj['@type']));
      }
      if (obj['@graph']) visitar(obj['@graph']);
    }
  };
  visitar(data);
  return tipos;
}

/**
 * Todo bloque <script type="application/ld+json"> debe ser JSON parseable, y
 * deben estar presentes todos los @type requeridos por la ruta.
 */
export function checkJsonLd(html: string, tiposRequeridos: string[]): Resultado {
  const root = parse(html);
  const scripts = root.querySelectorAll('script[type="application/ld+json"]');
  const tiposPresentes: string[] = [];
  for (let i = 0; i < scripts.length; i++) {
    const raw = scripts[i].text.trim();
    try {
      tiposPresentes.push(...tiposDeNodo(JSON.parse(raw)));
    } catch {
      return { ok: false, mensaje: `JSON-LD #${i + 1} no es parseable` };
    }
  }
  const faltan = tiposRequeridos.filter((t) => !tiposPresentes.includes(t));
  if (faltan.length > 0) {
    return { ok: false, mensaje: `Faltan tipos JSON-LD: ${faltan.join(', ')} (presentes: ${tiposPresentes.join(', ') || 'ninguno'})` };
  }
  return { ok: true, mensaje: `JSON-LD ok (tipos: ${tiposPresentes.join(', ') || 'ninguno'})` };
}
