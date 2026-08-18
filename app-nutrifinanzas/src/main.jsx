import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { DiarioProvider } from './context/DiarioContext.jsx'
import { iniciarArregloViewportIOS } from './lib/viewportIOS.js'
import './index.css'

// Solo hace algo en iOS instalado (ver el porqué en viewportIOS.js); en
// cualquier otra plataforma es una comprobación y ya.
iniciarArregloViewportIOS()

// Cada pantalla (Despensa, Diario, Escanear...) se descarga como un trozo de
// JS aparte, con un nombre que lleva un hash. Justo después de publicar una
// versión nueva, quien tenga la app abierta (o recién cacheada) puede pedir
// un trozo con el hash de la versión anterior, que ya no existe en el
// servidor: Vite dispara este evento en vez de dejar la pantalla en blanco.
// Recargar una vez trae el HTML nuevo, con los hashes correctos.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('nutrigasto-recarga-tras-fallo-carga')) return
  sessionStorage.setItem('nutrigasto-recarga-tras-fallo-carga', '1')
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <DiarioProvider>
            <App />
          </DiarioProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
