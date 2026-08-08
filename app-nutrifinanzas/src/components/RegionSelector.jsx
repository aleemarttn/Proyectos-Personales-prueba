import { REGIONES_ESPANA, provinciasDe } from '../data/regionesEspana.js'

// Dos selects en cascada: comunidad autónoma y, dentro de ella, provincia.
// Cambiar de comunidad resetea la provincia (no tiene sentido arrastrar una
// provincia de otra comunidad).
export default function RegionSelector({ comunidad, provincia, onChange }) {
  const provincias = provinciasDe(comunidad)

  function cambiarComunidad(nuevaComunidad) {
    const nuevasProvincias = provinciasDe(nuevaComunidad)
    onChange({
      comunidad: nuevaComunidad,
      provincia: nuevasProvincias.length === 1 ? nuevasProvincias[0] : '',
    })
  }

  return (
    <div className="mb-1">
      <label className="block text-sm font-bold text-gray-600 mb-2 mt-4">
        Comunidad autónoma
      </label>
      <select
        value={comunidad}
        onChange={(e) => cambiarComunidad(e.target.value)}
        className="w-full bg-white rounded-2xl px-4 py-3.5 text-gray-800 font-semibold shadow-card outline-none focus:ring-2 ring-brand-300 appearance-none"
      >
        <option value="" disabled>
          Elige una comunidad
        </option>
        {REGIONES_ESPANA.map((r) => (
          <option key={r.comunidad} value={r.comunidad}>
            {r.comunidad}
          </option>
        ))}
      </select>

      {provincias.length > 1 && (
        <>
          <label className="block text-sm font-bold text-gray-600 mb-2 mt-4">
            Provincia
          </label>
          <select
            value={provincia}
            onChange={(e) => onChange({ comunidad, provincia: e.target.value })}
            className="w-full bg-white rounded-2xl px-4 py-3.5 text-gray-800 font-semibold shadow-card outline-none focus:ring-2 ring-brand-300 appearance-none"
          >
            <option value="" disabled>
              Elige una provincia
            </option>
            {provincias.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  )
}
