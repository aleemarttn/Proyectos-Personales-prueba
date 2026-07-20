// "Carcasa" que dibuja un móvil alrededor de la app cuando se ve en un
// ordenador (pantalla ancha). En el móvil real ocupa toda la pantalla.
export default function PhoneFrame({ children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center sm:py-6">
      <div
        className="relative bg-cream w-full sm:w-[400px] sm:rounded-[2.5rem] sm:shadow-2xl sm:border-[10px] sm:border-gray-900 overflow-hidden flex flex-col"
        style={{ height: '100dvh', maxHeight: '844px' }}
      >
        {children}
      </div>
    </div>
  )
}
