// Qué puede hacer cada modo de la app. Es el único sitio donde se decide:
// el resto de pantallas pregunta aquí en vez de comparar `perfil.tipo` a mano.
//
//   Modo simple   -> despensa, gastos y recetas. Entrar cuesta 15 segundos.
//   Modo completo -> lo anterior + diario de comidas y objetivos de macros.
//
// En la base de datos la columna `perfiles.tipo_perfil` sigue guardando los
// valores 'sencilla' y 'total' (así lo fija el check de schema.sql), así que
// aquí los traducimos en vez de migrar la tabla y todas sus filas.

export const SIMPLE = 'sencilla'
export const COMPLETO = 'total'

const FUNCIONES = {
  [SIMPLE]: {
    diario: false, // registrar lo que comes y verlo por comidas
    macros: false, // objetivos de kcal/hidratos/proteínas/grasas
    datosPersonales: false, // edad y género (solo hacen falta para los objetivos)
  },
  [COMPLETO]: {
    diario: true,
    macros: true,
    datosPersonales: true,
  },
}

// Ante un tipo desconocido o vacío devolvemos las funciones del modo simple:
// es el subconjunto seguro, nunca enseña una pantalla que el perfil no soporta.
export function funcionesDe(tipo) {
  return FUNCIONES[tipo] || FUNCIONES[SIMPLE]
}

// Pantalla de inicio de cada modo. En modo completo es el diario, que hace
// de panel del día (cuánto llevas comido, cuánto te queda); el modo simple
// no tiene diario, así que entra por la despensa.
export function rutaInicio(tipo) {
  return funcionesDe(tipo).diario ? '/diario' : '/despensa'
}

export function esCompleto(tipo) {
  return tipo === COMPLETO
}

export function nombreModo(tipo) {
  return esCompleto(tipo) ? 'Modo completo' : 'Modo simple'
}
