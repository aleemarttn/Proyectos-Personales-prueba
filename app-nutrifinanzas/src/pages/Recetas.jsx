import { ChefHat, Clock } from 'lucide-react'

// Pantalla "Próximamente" (no construida a propósito en esta fase).
export default function Recetas() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-cream px-8 text-center animate-fade-in">
      <div className="w-24 h-24 rounded-3xl bg-brand-100 text-brand-600 flex items-center justify-center mb-6 animate-pop">
        <ChefHat size={48} />
      </div>
      <h1 className="text-2xl font-black text-gray-800 mb-2">Recetas</h1>
      <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 font-bold text-sm px-4 py-1.5 rounded-full mb-4">
        <Clock size={15} /> Próximamente
      </div>
      <p className="text-gray-500 leading-relaxed max-w-xs">
        Pronto podrás generar recetas con los alimentos que ya tienes en tu
        despensa, ajustadas a tus objetivos. ¡Estamos cocinando esta parte! 🧑‍🍳
      </p>
    </div>
  )
}
