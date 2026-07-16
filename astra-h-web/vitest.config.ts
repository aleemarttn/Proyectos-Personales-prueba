import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.ts'],
    // El arranque del servidor de preview puede tardar; damos margen.
    hookTimeout: 30000,
  },
});
