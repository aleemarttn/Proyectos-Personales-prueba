import { describe, it, expect } from 'vitest';
import {
  checkTitle,
  checkMetaDescription,
  checkCanonical,
  checkNoindex,
  checkTextoSuficiente,
  checkJsonLd,
} from './checks';

/**
 * Pruebas de las comprobaciones en aislamiento: cada una debe ACEPTAR un HTML
 * correcto y RECHAZAR uno defectuoso. Así garantizamos que el guardrail
 * realmente detecta los fallos que dice detectar.
 */

describe('checkTitle', () => {
  it('acepta un único title no vacío', () => {
    expect(checkTitle('<title>Hola</title>').ok).toBe(true);
  });
  it('rechaza si falta', () => {
    expect(checkTitle('<head></head>').ok).toBe(false);
  });
  it('rechaza si está vacío', () => {
    expect(checkTitle('<title>   </title>').ok).toBe(false);
  });
  it('rechaza si hay más de uno', () => {
    expect(checkTitle('<title>A</title><title>B</title>').ok).toBe(false);
  });
});

describe('checkMetaDescription', () => {
  it('acepta una única description y devuelve su contenido', () => {
    const r = checkMetaDescription('<meta name="description" content="Texto de prueba">');
    expect(r.ok).toBe(true);
    expect(r.contenido).toBe('Texto de prueba');
  });
  it('rechaza si falta', () => {
    expect(checkMetaDescription('<head></head>').ok).toBe(false);
  });
  it('rechaza si está vacía', () => {
    expect(checkMetaDescription('<meta name="description" content="">').ok).toBe(false);
  });
  it('rechaza si hay duplicadas', () => {
    expect(
      checkMetaDescription('<meta name="description" content="A"><meta name="description" content="B">').ok,
    ).toBe(false);
  });
});

describe('checkCanonical', () => {
  const origen = 'https://mundoastrah.com';
  it('acepta canonical absoluto, origen y ruta correctos', () => {
    const html = '<link rel="canonical" href="https://mundoastrah.com/averias-y-diagnostico/">';
    expect(checkCanonical(html, origen, '/averias-y-diagnostico/').ok).toBe(true);
  });
  it('rechaza canonical relativo', () => {
    expect(checkCanonical('<link rel="canonical" href="/ruta/">', origen, '/ruta/').ok).toBe(false);
  });
  it('rechaza origen equivocado', () => {
    expect(checkCanonical('<link rel="canonical" href="https://otro.com/ruta/">', origen, '/ruta/').ok).toBe(false);
  });
  it('rechaza ruta equivocada', () => {
    expect(checkCanonical('<link rel="canonical" href="https://mundoastrah.com/otra/">', origen, '/ruta/').ok).toBe(false);
  });
  it('rechaza si falta', () => {
    expect(checkCanonical('<head></head>', origen, '/ruta/').ok).toBe(false);
  });
});

describe('checkNoindex', () => {
  it('acepta HTML sin noindex', () => {
    expect(checkNoindex('<head></head>').ok).toBe(true);
  });
  it('rechaza noindex en meta robots', () => {
    expect(checkNoindex('<meta name="robots" content="noindex, follow">').ok).toBe(false);
  });
  it('rechaza noindex en cabecera X-Robots-Tag', () => {
    const headers = new Headers({ 'X-Robots-Tag': 'noindex' });
    expect(checkNoindex('<head></head>', headers).ok).toBe(false);
  });
});

describe('checkTextoSuficiente', () => {
  it('acepta si supera el mínimo', () => {
    expect(checkTextoSuficiente('<body>' + 'a'.repeat(200) + '</body>', 100).ok).toBe(true);
  });
  it('rechaza si no llega al mínimo', () => {
    expect(checkTextoSuficiente('<body>corto</body>', 100).ok).toBe(false);
  });
  it('no cuenta el contenido de <script>', () => {
    const html = '<body><script>' + 'x'.repeat(500) + '</script>hola</body>';
    expect(checkTextoSuficiente(html, 100).ok).toBe(false);
  });
});

describe('checkJsonLd', () => {
  it('acepta JSON-LD parseable con los tipos requeridos', () => {
    const html = '<script type="application/ld+json">{"@type":"Article"}</script>';
    expect(checkJsonLd(html, ['Article']).ok).toBe(true);
  });
  it('detecta tipos dentro de @graph', () => {
    const html =
      '<script type="application/ld+json">{"@graph":[{"@type":"Article"},{"@type":"BreadcrumbList"}]}</script>';
    expect(checkJsonLd(html, ['Article', 'BreadcrumbList']).ok).toBe(true);
  });
  it('rechaza JSON-LD no parseable', () => {
    expect(checkJsonLd('<script type="application/ld+json">{roto</script>', []).ok).toBe(false);
  });
  it('rechaza si falta un tipo requerido', () => {
    const html = '<script type="application/ld+json">{"@type":"Article"}</script>';
    expect(checkJsonLd(html, ['Article', 'FAQPage']).ok).toBe(false);
  });
});
