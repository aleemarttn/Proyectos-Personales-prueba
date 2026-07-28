// "Carcasa" que dibuja un móvil alrededor de la app cuando se ve en un
// ordenador (pantalla ancha). En el móvil real ocupa toda la pantalla,
// incluida la zona del notch y la barra de gestos.
export default function PhoneFrame({ children }) {
  return (
    <div className="h-[100dvh] w-full flex items-center justify-center sm:py-6 overflow-hidden">
      <div
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
