import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Sparkles,
  Plus,
  UtensilsCrossed,
  Package,
  PieChart,
  ChefHat,
  User,
  Users,
  Timer,
  ListTodo,
  Settings2,
  X,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { funcionesDe } from '../lib/modos.js'

// Tutorial guiado para usuarios nuevos: una tarjeta con icono + texto breve
// que va señalando (con un "foco" recortado sobre fondo oscuro) las
// secciones clave de la app. Se apoya en atributos `data-tour="..."` que
// marcan los elementos reales en pantalla, así que si cambian de sitio o de
// estilo el tour los sigue encontrando sin tocar este archivo.
const PASOS_DESPENSA = [
  {
    id: 'intro',
    selector: null,
    icon: Sparkles,
    color: 'amber',
    titulo: '¡Bienvenido/a a NutriFinanzas! 👋',
    texto: 'Un tour rápido de 30 segundos para que sepas dónde está cada cosa.',
  },
  {
    id: 'acciones',
    selector: '[data-tour="despensa-acciones"]',
    icon: Plus,
    color: 'brand',
    titulo: 'Añade lo que compras',
    texto: 'A mano con "Añadir", o más rápido escaneando el código de barras del producto.',
  },
  {
    id: 'restaurante',
    selector: '[data-tour="foto-restaurante"]',
    icon: UtensilsCrossed,
    color: 'amber',
    titulo: '¿Qué pido?',
    texto: '¿Comes fuera? Haz una foto a la carta y te recomendamos qué pedir.',
  },
  {
    id: 'lista',
    selector: '[data-tour="despensa-lista"]',
    icon: Package,
    color: 'brand',
    titulo: 'Tu despensa',
    texto: 'Aquí ves todo lo que tienes en casa y lo que te ha costado cada cosa.',
  },
  {
    id: 'nav-diario',
    selector: '[data-tour="nav-diario"]',
    icon: UtensilsCrossed,
    color: 'brand',
    titulo: 'Diario',
    texto: 'Registra tus comidas y sigue tus calorías y macros del día.',
    requiere: 'diario',
  },
  {
    id: 'nav-gastos',
    selector: '[data-tour="nav-gastos"]',
    icon: PieChart,
    color: 'brand',
    titulo: 'Gastos',
    texto: 'Descubre en qué se te va el dinero del súper cada mes.',
  },
  {
    id: 'nav-recetas',
    selector: '[data-tour="nav-recetas"]',
    icon: ChefHat,
    color: 'brand',
    titulo: 'Recetas',
    texto: 'Recetas hechas con lo que ya tienes en tu despensa.',
  },
  {
    id: 'nav-perfil',
    selector: '[data-tour="nav-perfil"]',
    icon: User,
    color: 'brand',
    titulo: 'Perfil',
    texto: 'Cambia de modo y ajusta tus datos cuando quieras desde aquí.',
  },
]

const PASOS_PERFIL = [
  {
    id: 'intro-perfil',
    selector: null,
    icon: User,
    color: 'amber',
    titulo: 'Ajusta la app a tu vida',
    texto: 'Aquí tienes las opciones para personalizar cómo usas NutriFinanzas.',
  },
  {
    id: 'compartida',
    selector: '[data-tour="perfil-despensa-compartida"]',
    icon: Users,
    color: 'brand',
    titulo: 'Despensa compartida',
    texto: 'Crea un hogar o usa un código para compartir alimentos y gastos. El diario sigue siendo privado.',
  },
  {
    id: 'comidas',
    selector: '[data-tour="perfil-comidas"]',
    icon: ListTodo,
    color: 'brand',
    titulo: 'Tus comidas',
    texto: 'Puedes renombrar, ordenar o añadir comidas para que el diario se adapte a tu rutina.',
    requiere: 'diario',
  },
  {
    id: 'ayuno',
    selector: '[data-tour="perfil-ayuno"]',
    icon: Timer,
    color: 'amber',
    titulo: 'Ayuno intermitente',
    texto: 'Actívalo si lo practicas, elige tu horario y encontrarás el contador en el Diario.',
    requiere: 'diario',
  },
  {
    id: 'modo',
    selector: '[data-tour="perfil-modo"]',
    icon: Settings2,
    color: 'brand',
    titulo: 'Cambia de modo cuando quieras',
    texto: 'Puedes pasar entre modo sencillo y completo sin perder tu despensa ni tus gastos.',
  },
]

const TONOS = {
  amber: 'bg-amber-100 text-amber-600',
  brand: 'bg-brand-100 text-brand-600',
}

const CONFIG_TOUR = {
  despensa: {
    pasos: PASOS_DESPENSA,
    campoPerfil: 'tourBienvenidaVisto',
    claveLocal: 'nutrifinanzas_tour_despensa_iniciado',
    marcar: 'marcarTourBienvenidaVisto',
  },
  perfil: {
    pasos: PASOS_PERFIL,
    campoPerfil: 'tourPerfilVisto',
    claveLocal: 'nutrifinanzas_tour_perfil_iniciado',
    marcar: 'marcarTourPerfilVisto',
  },
}

function claveInicio(prefijo, userId) {
  return `${prefijo}_${userId}`
}

export default function TourGuiado({ activo, tipo = 'despensa' }) {
  const auth = useAuth()
  const { sesion, perfil } = auth
  const config = CONFIG_TOUR[tipo]
  const [pasoActual, setPasoActual] = useState(0)
  const [enCurso, setEnCurso] = useState(false)
  const [medida, setMedida] = useState(null)
  const wrapperRef = useRef(null)

  const pasos = config.pasos.filter(
    (p) => !p.requiere || funcionesDe(perfil?.tipo)[p.requiere]
  )
  const paso = pasos[pasoActual]

  // Decide si hay que arrancar el tour: solo una vez para una cuenta nueva.
  // El dato real vive en Supabase; localStorage evita un duplicado durante
  // el instante en que llega la actualización del perfil.
  useEffect(() => {
    if (!activo || !sesion || !perfil?.tipo) return
    if (
      perfil[config.campoPerfil] ||
      localStorage.getItem(claveInicio(config.claveLocal, sesion.user.id))
    ) return

    localStorage.setItem(claveInicio(config.claveLocal, sesion.user.id), '1')
    setPasoActual(0)
    setEnCurso(true)
    auth[config.marcar]().catch((error) => {
      // La copia local mantiene la experiencia correcta si falta aplicar la
      // migración o hay una interrupción puntual de red.
      console.error('No se pudo marcar el tour como visto:', error)
    })
  }, [activo, sesion, perfil?.tipo, perfil?.[config.campoPerfil], config, auth])

  // Las tarjetas de Perfil están una debajo de otra. Al cambiar de paso,
  // llevamos el objetivo a la vista para que el foco no señale contenido
  // fuera de pantalla.
  useEffect(() => {
    if (!enCurso || !paso?.selector) return
    const el = document.querySelector(paso.selector)
    if (!el) return
    const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'center', behavior: reducirMovimiento ? 'auto' : 'smooth' })
  }, [enCurso, paso])

  // Mientras el tour está en curso, recalcula en cada frame la posición del
  // elemento señalado: cubre resize, scroll y el hecho de que la pantalla
  // (Despensa) se carga de forma diferida y puede tardar en montar.
  useLayoutEffect(() => {
    if (!enCurso) return
    let frame
    function medir() {
      const wrapperRect = wrapperRef.current?.getBoundingClientRect()
      if (!wrapperRect) {
        frame = requestAnimationFrame(medir)
        return
      }
      let target = null
      if (paso?.selector) {
        const el = document.querySelector(paso.selector)
        if (el) {
          const r = el.getBoundingClientRect()
          target = {
            top: r.top - wrapperRect.top,
            left: r.left - wrapperRect.left,
            width: r.width,
            height: r.height,
          }
        }
      }
      setMedida({ wrapperW: wrapperRect.width, wrapperH: wrapperRect.height, target })
      frame = requestAnimationFrame(medir)
    }
    medir()
    return () => cancelAnimationFrame(frame)
  }, [enCurso, paso])

  function terminar() {
    setEnCurso(false)
  }

  function siguiente() {
    if (pasoActual === pasos.length - 1) terminar()
    else setPasoActual((p) => p + 1)
  }

  function anterior() {
    setPasoActual((p) => Math.max(0, p - 1))
  }

  if (!enCurso) return null

  const Icon = paso.icon
  const pad = 8
  const cardW = medida ? Math.min(320, medida.wrapperW - 32) : 0

  let cardLeft = 0
  let cardTop = 0
  let arriba = false
  let arrowLeft = null

  if (medida?.target) {
    const centerX = medida.target.left + medida.target.width / 2
    cardLeft = Math.min(Math.max(centerX - cardW / 2, 16), medida.wrapperW - cardW - 16)
    arriba = medida.target.top > medida.wrapperH / 2
    cardTop = arriba ? medida.target.top - 12 : medida.target.top + medida.target.height + 12
    arrowLeft = Math.min(Math.max(centerX - cardLeft, 24), cardW - 24)
  } else if (medida) {
    cardLeft = (medida.wrapperW - cardW) / 2
    cardTop = medida.wrapperH / 2
  }

  return (
    <div ref={wrapperRef} className="absolute inset-0 z-[60]">
      {medida && (
        <>
          {medida.target ? (
            <div
              className="absolute rounded-2xl transition-all duration-300 ease-out pointer-events-none"
              style={{
                top: medida.target.top - pad,
                left: medida.target.left - pad,
                width: medida.target.width + pad * 2,
                height: medida.target.height + pad * 2,
                boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)',
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-slate-900/70 transition-opacity duration-300" />
          )}

          {/* Envoltorio solo de posición: separado del contenido animado
              porque `animate-pop` anima su propio `transform` (scale) y
              pisaría el translateY que coloca la tarjeta encima del objetivo. */}
          <div
            className="absolute"
            style={{
              width: cardW,
              left: cardLeft,
              top: cardTop,
              transform: medida.target
                ? arriba
                  ? 'translateY(-100%)'
                  : 'none'
                : 'translateY(-50%)',
            }}
          >
            <div className="relative bg-white rounded-3xl shadow-2xl p-5 animate-pop">
              {medida.target && (
                <div
                  className="absolute w-4 h-4 bg-white rotate-45"
                  style={{ left: arrowLeft - 8, [arriba ? 'bottom' : 'top']: -8 }}
                />
              )}

              <div className="relative flex items-start justify-between mb-3">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${TONOS[paso.color]}`}
              >
                <Icon size={28} />
              </div>
              <button
                onClick={terminar}
                className="text-gray-300 active:text-gray-500 -mt-1 -mr-1 p-1"
                aria-label="Saltar el tutorial"
              >
                <X size={20} />
              </button>
            </div>

            <h3 className="relative font-extrabold text-lg text-gray-800 mb-1">
              {paso.titulo}
            </h3>
            <p className="relative text-gray-500 text-sm mb-4">{paso.texto}</p>

            <div className="relative flex items-center justify-between">
              <div className="flex gap-1.5">
                {pasos.map((p, i) => (
                  <div
                    key={p.id}
                    className={`h-1.5 rounded-full transition-all ${
                      i === pasoActual ? 'w-4 bg-brand-500' : 'w-1.5 bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {pasoActual > 0 && (
                  <button
                    onClick={anterior}
                    className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center active:scale-95 transition"
                    aria-label="Paso anterior"
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}
                <button
                  onClick={siguiente}
                  className="h-9 px-4 rounded-full bg-brand-500 text-white font-bold text-sm flex items-center gap-1 active:scale-95 transition"
                >
                  {pasoActual === pasos.length - 1 ? 'Entendido' : 'Siguiente'}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
