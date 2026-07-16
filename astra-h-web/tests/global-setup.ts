import { preview } from 'astro';

/**
 * Arranca el servidor de preview de Astro (sirve dist/ como en producción)
 * antes de la suite y lo apaga al terminar. Usa el puerto 0 para que el SO
 * asigne uno libre y evitar conflictos con otros servidores locales.
 *
 * IMPORTANTE: preview() sirve el HTML CRUDO ya compilado, sin dev server ni
 * inyección de HMR. Es lo que ve un crawler. El build debe haberse ejecutado
 * antes (ver script "test:seo").
 */
export default async function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  const server = await preview({
    root: process.cwd(),
    logLevel: 'silent',
    server: { port: 0 },
  });

  const host = server.host ?? 'localhost';
  const baseUrl = `http://${host}:${server.port}`;
  provide('baseUrl', baseUrl);

  return async () => {
    await server.stop();
  };
}

declare module 'vitest' {
  interface ProvidedContext {
    baseUrl: string;
  }
}
