import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

// Si una pantalla falla al dibujarse, React desmonta TODA la app y el
// usuario se queda mirando una pantalla en blanco, sin saber qué ha pasado
// ni poder salir. Esto lo intercepta y muestra el error con una salida.
// (Tiene que ser un componente de clase: es la única forma que ofrece React
// de capturar errores de render.)
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Fallo al dibujar la pantalla:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="h-full flex flex-col items-center justify-center bg-cream px-8 text-center animate-fade-in">
        <AlertTriangle className="text-amber-500 mb-3" size={40} />
        <p className="font-bold text-gray-700 mb-1">Algo ha fallado en esta pantalla.</p>
        <p className="text-sm text-gray-500 mb-5">
          Puedes volver a la despensa y seguir usando la app.
        </p>
        <p className="text-xs text-gray-400 font-mono break-all mb-6 max-w-full">
          {this.state.error?.message}
        </p>
        <button
          onClick={() => {
            this.setState({ error: null })
            window.location.assign('/despensa')
          }}
          className="bg-brand-500 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 active:scale-95 transition"
        >
          <RotateCcw size={18} /> Volver a la despensa
        </button>
      </div>
    )
  }
}
