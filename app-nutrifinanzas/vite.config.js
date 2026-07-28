import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Configuración de Vite (la herramienta que arranca y construye la app)
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // El service worker se actualiza solo cuando publicas una versión nueva
      registerType: 'autoUpdate',
      includeAssets: ['leaf.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'NutriGasto',
        short_name: 'NutriGasto',
        description: 'Controla tu despensa, tu dieta y lo que gastas en comida.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf8f3',
        theme_color: '#16a34a',
        categories: ['food', 'health', 'finance'],
        icons: [
          { src: '/icon-96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Escanear producto', short_name: 'Escanear', url: '/escanear' },
          { name: 'Registrar comida', short_name: 'Comida', url: '/diario/registrar' },
        ],
      },
      workbox: {
        // Ficheros de la app que se guardan para poder abrirla sin conexión
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // La API de Supabase nunca se sirve desde caché de navegación
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Tipografías de Google: se guardan a largo plazo
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fichas de producto de Open Food Facts: red primero, caché de reserva
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'openfoodfacts',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Imágenes de productos (Supabase Storage / OFF)
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'imagenes',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Permite probar la PWA con "npm run dev"
        enabled: false,
        type: 'module',
      },
    }),
  ],
  server: {
    open: true, // abre el navegador automáticamente al ejecutar "npm run dev"
    host: true, // accesible desde el móvil en la misma red wifi
  },
})
