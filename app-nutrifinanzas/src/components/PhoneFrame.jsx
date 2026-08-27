// "Carcasa" que dibuja un móvil alrededor de la app cuando se ve en un
// ordenador (pantalla ancha). En el móvil real ocupa toda la pantalla,
// incluida la zona del notch y la barra de gestos.
//
// El id "marco-app" lo usa CapaModal para montar dentro de esta caja las
// pantallas que se superponen (ficha de alimento, escáner), y que así no se
// salgan del móvil cuando la app se ve en un ordenador.
export default function PhoneFrame({ children }) {
  return (
    <div className="h-[100dvh] w-full flex items-center justify-center sm:py-6 overflow-hidden">
      <div
        id="marco-app"
        className="relative bg-cream flex flex-col overflow-hidden
                   w-full h-full
                   sm:w-[400px] sm:h-[min(calc(100dvh-3rem),844px)]
                   sm:rounded-[2.5rem] sm:shadow-2xl sm:border-[10px] sm:border-gray-900"
      >
        {children}
      </div>
    </div>
  )
}
