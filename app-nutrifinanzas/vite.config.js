import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuración de Vite (la herramienta que arranca y construye la app)
export default defineConfig({
  plugins: [react()],
  server: {
    open: true, // abre el navegador automáticamente al ejecutar "npm run dev"
  },
})
