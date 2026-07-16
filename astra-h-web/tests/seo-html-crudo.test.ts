import { describe, it, expect, beforeAll, inject } from 'vitest';
import {
  checkTitle,
  checkMetaDescription,
  checkCanonical,
  checkNoindex,
  checkTextoSuficiente,
  checkJsonLd,
} from './checks';

/**
 * Test de HTML CRUDO (guardrail de CI, sección 5 del CLAUDE.md).
 *
 * Pide cada ruta crítica por HTTP con un User-Agent de crawler de IA y valida,
 * sobre el HTML tal cual (sin ejecutar JavaScript), los requisitos de la
 * sección 4. Si alguna falla, el test falla y bloquea el deploy.
 *
 * Se ejecuta contra el build de producción servido por `astro preview`
 * (ver global-setup.ts y el script "test:seo"), nunca contra `astro dev`.
 */

const ORIGEN_ESPERADO = 'https://mundoastrah.com';

interface RutaCritica {
  path: string;
  /** @type JSON-LD obligatorios en esta ruta. */
  jsonLdRequerido: string[];
  /** Mínimo de caracteres de texto real en el body. */
  textoMinimo: number;
}

/**
 * Rutas que el guardrail vigila. Se irán añadiendo a medida que se creen
 * páginas del silo. La página piloto (Bloque 5) entrará aquí con sus tipos
 * JSON-LD y su mínimo de texto estrictos.
 */
const RUTAS_CRITICAS: RutaCritica[] = [
  // Home: aún sin contenido editorial definitivo; se endurecerá cuando lo tenga.
  { path: '/', jsonLdRequerido: [], textoMinimo: 0 },
  // Página índice del pilar Averías y diagnóstico.
  {
    path: '/averias-y-diagnostico/',
    jsonLdRequerido: ['BreadcrumbList'],
    textoMinimo: 300,
  },
  // Artículo piloto: fallo de bobinas de encendido.
  {
    path: '/averias-y-diagnostico/bobinas-de-encendido/',
    jsonLdRequerido: ['Article', 'BreadcrumbList', 'FAQPage'],
    textoMinimo: 600,
  },
];

interface Respuesta {
  status: number;
  html: string;
  headers: Headers;
}

const respuestas = new Map<string, Respuesta>();

beforeAll(async () => {
  const baseUrl = inject('baseUrl');
  for (const ruta of RUTAS_CRITICAS) {
    const res = await fetch(new URL(ruta.path, baseUrl), {
      headers: { 'User-Agent': 'GPTBot' },
    });
    respuestas.set(ruta.path, {
      status: res.status,
      html: await res.text(),
      headers: res.headers,
    });
  }
});

describe.each(RUTAS_CRITICAS)('Ruta crítica $path', (ruta) => {
  it('responde 200', () => {
    expect(respuestas.get(ruta.path)?.status).toBe(200);
  });

  it('tiene un <title> único no vacío', () => {
    const r = checkTitle(respuestas.get(ruta.path)!.html);
    expect(r.ok, r.mensaje).toBe(true);
  });

  it('tiene una meta description única no vacía', () => {
    const r = checkMetaDescription(respuestas.get(ruta.path)!.html);
    expect(r.ok, r.mensaje).toBe(true);
  });

  it('tiene canonical absoluto correcto', () => {
    const r = checkCanonical(respuestas.get(ruta.path)!.html, ORIGEN_ESPERADO, ruta.path);
    expect(r.ok, r.mensaje).toBe(true);
  });

  it('no tiene noindex', () => {
    const resp = respuestas.get(ruta.path)!;
    const r = checkNoindex(resp.html, resp.headers);
    expect(r.ok, r.mensaje).toBe(true);
  });

  it('tiene texto suficiente', () => {
    const r = checkTextoSuficiente(respuestas.get(ruta.path)!.html, ruta.textoMinimo);
    expect(r.ok, r.mensaje).toBe(true);
  });

  it('tiene el JSON-LD requerido y parseable', () => {
    const r = checkJsonLd(respuestas.get(ruta.path)!.html, ruta.jsonLdRequerido);
    expect(r.ok, r.mensaje).toBe(true);
  });
});

it('las meta description son únicas entre rutas', () => {
  const vistas = new Map<string, string>();
  for (const ruta of RUTAS_CRITICAS) {
    const html = respuestas.get(ruta.path)?.html;
    if (!html) continue;
    const contenido = checkMetaDescription(html).contenido;
    if (!contenido) continue;
    const previa = vistas.get(contenido);
    expect(previa, `meta description duplicada entre ${previa} y ${ruta.path}`).toBeUndefined();
    vistas.set(contenido, ruta.path);
  }
});
