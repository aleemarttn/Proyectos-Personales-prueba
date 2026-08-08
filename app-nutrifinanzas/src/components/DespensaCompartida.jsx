import { useState } from 'react'
import {
  Users,
  Copy,
  Check,
  Share2,
  DoorOpen,
  Loader2,
  Home,
  KeyRound,
  Crown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/AppContext.jsx'
import { mensajeDeError, limpiarCodigo } from '../lib/hogar.js'

// Despensa compartida: una pareja o una familia comparten la nevera, así que
// comparten los alimentos y lo que cuestan. El diario no: lo que come cada
// uno sigue siendo suyo y no lo ve nadie.
export default function DespensaCompartida() {
  const { sesion, hogar, crearHogar, unirseAHogar, salirDelHogar } = useAuth()

  return (
    <div className="px-5 mb-4">
      <h2 className="font-extrabold text-gray-700 mb-3">Despensa compartida</h2>
      <div className="bg-white rounded-3xl p-4 shadow-card">
        {hogar ? (
          <HogarActivo
            hogar={hogar}
            miId={sesion?.user?.id}
            onSalir={salirDelHogar}
          />
        ) : (
          <SinHogar onCrear={crearHogar} onUnirse={unirseAHogar} />
        )}
      </div>
    </div>
  )
}

// --- Cuando todavía no estás en ningún hogar ---

function SinHogar({ onCrear, onUnirse }) {
  // null = solo los dos botones; 'crear' | 'unirse' = formulario abierto
  const [modo, setModo] = useState(null)
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function enviar() {
    if (enviando) return
    setEnviando(true)
    setError('')
    try {
      if (modo === 'crear') await onCrear(nombre)
      else await onUnirse(codigo)
    } catch (e) {
      console.error('Error con el hogar:', e)
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  const listo = modo === 'crear' ? nombre.trim().length > 0 : codigo.length === 6

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <Users size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800">Compartir la despensa</p>
          <p className="text-xs font-semibold text-gray-400">
            Los dos veis los mismos alimentos y los mismos gastos. Vuestros
            diarios siguen siendo privados.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => {
            setModo(modo === 'crear' ? null : 'crear')
            setError('')
          }}
          className={`flex-1 font-bold text-sm py-3 rounded-2xl flex items-center justify-center gap-1.5 transition ${
            modo === 'crear'
              ? 'bg-brand-500 text-white shadow-soft'
              : 'bg-gray-50 text-gray-600'
          }`}
        >
          <Home size={16} /> Crear
        </button>
        <button
          onClick={() => {
            setModo(modo === 'unirse' ? null : 'unirse')
            setError('')
          }}
          className={`flex-1 font-bold text-sm py-3 rounded-2xl flex items-center justify-center gap-1.5 transition ${
            modo === 'unirse'
              ? 'bg-brand-500 text-white shadow-soft'
              : 'bg-gray-50 text-gray-600'
          }`}
        >
          <KeyRound size={16} /> Tengo un código
        </button>
      </div>

      {modo && (
        <div className="mt-3 space-y-3 animate-slide-up">
          {modo === 'crear' ? (
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value.slice(0, 40))}
              placeholder="Nombre del hogar (p. ej. Casa)"
              maxLength={40}
              className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-gray-800 font-semibold outline-none focus:ring-2 ring-brand-300"
            />
          ) : (
            <input
              value={codigo}
              onChange={(e) => setCodigo(limpiarCodigo(e.target.value))}
              placeholder="ABC234"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-gray-800 font-black text-center text-xl tracking-[0.3em] outline-none focus:ring-2 ring-brand-300"
            />
          )}

          <button
            onClick={enviar}
            disabled={!listo || enviando}
            className="w-full bg-brand-500 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-soft active:scale-[0.98] transition disabled:opacity-40"
          >
            {enviando ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Check size={18} />
            )}
            {modo === 'crear' ? 'Crear el hogar' : 'Unirme'}
          </button>
        </div>
      )}

      {error && <MensajeError texto={error} />}
    </>
  )
}

// --- Cuando ya estás dentro ---

function HogarActivo({ hogar, miId, onSalir }) {
  const { alimentos, compartirMiDespensa } = useApp()
  const [copiado, setCopiado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  // Lo que ya tenías antes de entrar en el hogar sigue siendo privado hasta
  // que decidas compartirlo
  const mios = alimentos.filter((a) => a.usuarioId === miId && !a.hogarId)

  async function invitar() {
    const texto = `Únete a mi despensa en NutriGasto con el código ${hogar.codigo}`
    try {
      if (navigator.share) {
        await navigator.share({ text: texto })
        return
      }
      await navigator.clipboard.writeText(hogar.codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Cancelar el menú de compartir no es un error que haya que enseñar
    }
  }

  async function compartir() {
    if (ocupado) return
    setOcupado(true)
    setError('')
    try {
      const n = await compartirMiDespensa()
      setAviso(
        n === 1
          ? '1 alimento compartido.'
          : `${n} alimentos compartidos.`
      )
    } catch (e) {
      console.error('Error compartiendo la despensa:', e)
      setError(mensajeDeError(e))
    } finally {
      setOcupado(false)
    }
  }

  async function salir() {
    const ok = window.confirm(
      `¿Salir de "${hogar.nombre}"?\n\nLo que hayas comprado tú vuelve a tu despensa privada. No se borra nada.`
    )
    if (!ok || ocupado) return
    setOcupado(true)
    setError('')
    try {
      await onSalir()
    } catch (e) {
      console.error('Error saliendo del hogar:', e)
      setError(mensajeDeError(e))
      setOcupado(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <Users size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 truncate">{hogar.nombre}</p>
          <p className="text-xs font-semibold text-gray-400">
            {hogar.miembros.length}{' '}
            {hogar.miembros.length === 1 ? 'persona' : 'personas'}
          </p>
        </div>
      </div>

      {/* Código de invitación */}
      <div className="mt-4 bg-gray-50 rounded-2xl p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-400 mb-0.5">
            Código para invitar
          </p>
          <p className="font-black text-xl text-gray-800 tracking-[0.2em]">
            {hogar.codigo}
          </p>
        </div>
        <button
          onClick={invitar}
          className="bg-white text-brand-700 font-bold text-sm px-4 py-2.5 rounded-xl shadow-card flex items-center gap-1.5 active:scale-95 transition"
        >
          {copiado ? <Check size={16} /> : navigator.share ? <Share2 size={16} /> : <Copy size={16} />}
          {copiado ? 'Copiado' : 'Invitar'}
        </button>
      </div>

      {/* Quién está dentro */}
      <ul className="mt-3 space-y-1">
        {hogar.miembros.map((m) => (
          <li
            key={m.usuarioId}
            className="flex items-center gap-2.5 py-1.5"
          >
            <span className="w-7 h-7 rounded-full bg-brand-500 text-white text-xs font-black flex items-center justify-center shrink-0">
              {(m.nombre || m.email || '?').charAt(0).toUpperCase()}
            </span>
            <span className="font-semibold text-gray-700 text-sm truncate flex-1">
              {m.nombre || m.email}
              {m.usuarioId === miId && (
                <span className="text-gray-400 font-semibold"> · tú</span>
              )}
            </span>
            {m.esPropietario && (
              <Crown size={14} className="text-amber-400 shrink-0" />
            )}
          </li>
        ))}
      </ul>

      {/* Traerse la despensa de antes */}
      {mios.length > 0 && (
        <button
          onClick={compartir}
          disabled={ocupado}
          className="w-full mt-3 bg-brand-50 text-brand-700 font-bold text-sm py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-40"
        >
          {ocupado ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Share2 size={16} />
          )}
          Compartir mis {mios.length}{' '}
          {mios.length === 1 ? 'alimento privado' : 'alimentos privados'}
        </button>
      )}

      {aviso && (
        <p className="bg-brand-50 text-brand-700 text-sm font-semibold rounded-xl px-4 py-2.5 mt-3">
          {aviso}
        </p>
      )}
      {error && <MensajeError texto={error} />}

      <button
        onClick={salir}
        disabled={ocupado}
        className="w-full mt-3 text-red-500 font-bold text-sm py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-40"
      >
        <DoorOpen size={16} /> Salir del hogar
      </button>
    </>
  )
}

// Se llama MensajeError y no Error para no tapar el `Error` de JavaScript
// dentro de este archivo
function MensajeError({ texto }) {
  return (
    <p className="bg-red-50 text-red-600 text-sm font-semibold rounded-xl px-4 py-2.5 mt-3">
      {texto}
    </p>
  )
}
