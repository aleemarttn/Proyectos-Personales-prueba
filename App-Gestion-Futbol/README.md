# App Gestión Fútbol — UD Icodense

App web para el cuerpo técnico: plantilla, partidos, alineaciones, minutos
por jugador y por posición, entrenamientos y asistencia. Hermana de la app
de sRPE: mismo stack (HTML/CSS/JS puro + Supabase) y misma identidad visual.

Todo funciona en planes gratuitos: Supabase Free + Netlify Free. Sin tarjeta.

---

## 1. Crear el proyecto de Supabase

> ⚠️ El plan gratuito de Supabase permite **2 proyectos por cuenta** y la
> cuenta actual ya los tiene ocupados (la app de RPE). Crea este proyecto
> en una **cuenta nueva** (otro email o cuenta de GitHub).

1. Entra en [supabase.com](https://supabase.com) con la cuenta nueva y pulsa **New project**.
2. Nombre: `gestion-futbol` (o el que quieras). Región: la más cercana (eu-west).
3. Guarda la contraseña de la base de datos donde no la pierdas (no la necesita la app, solo tú).

## 2. Ejecutar los scripts SQL

En el panel del proyecto → **SQL Editor**:

1. Pega el contenido completo de `schema.sql` → **Run**. Debe terminar sin errores.
2. **Antes de ejecutar `seed.sql`**, edita la sección 5 (equipo y plantilla de
   ejemplo) con el nombre real del equipo y los jugadores reales. Si no,
   ejecútalo tal cual y edita los jugadores después desde la propia app.
3. Pega `seed.sql` → **Run**.

## 3. Desactivar los registros públicos (OBLIGATORIO)

**Authentication → Sign In / Providers → Email → "Allow new users to sign up" en OFF.**

La clave `anon` va incluida en el sitio publicado (es pública por diseño);
si los sign-ups quedan abiertos, cualquiera podría crearse una cuenta.
Con ellos cerrados y las policies del esquema, nadie sin usuario creado
por ti puede leer ni escribir nada.

## 4. Crear el usuario del entrenador

1. **Authentication → Users → Add user → Create new user.**
   Email + contraseña (con "Auto Confirm User" activado).
2. Copia el **UUID** del usuario recién creado (columna UID).
3. Vuelve al **SQL Editor**, abre la sección 6 de `seed.sql`, descomenta el
   bloque, pega el UUID donde pone `PEGA-AQUI-EL-UUID-DEL-USUARIO` y ejecútalo.

Sin ese INSERT en `team_members` el usuario puede iniciar sesión pero no
verá ningún dato: todas las policies comprueban la pertenencia al equipo.

## 5. Configurar el front (fase b en adelante)

1. Copia `config.example.js` a `config.js`.
2. En Supabase → **Settings → API**, copia:
   - **Project URL** → `SUPABASE_URL`
   - **anon / publishable key** → `SUPABASE_ANON_KEY`

> La anon key es **pública por diseño**: está pensada para vivir en el
> navegador y en el repositorio. La seguridad la ponen RLS y las policies,
> no el secreto de la clave. La **secret/service_role key no se copia
> NUNCA** a ningún archivo del proyecto.

## 6. Desplegar en Netlify

1. Sube esta carpeta a un repositorio de GitHub.
2. En [netlify.com](https://netlify.com) → **Add new site → Import an existing project** → elige el repo.
3. Build command: vacío. Publish directory: la raíz (o `App-Gestion-Futbol` si el repo contiene más carpetas).
4. Nombre del sitio: `gestion-futbol-icodense`.

Cada `git push` despliega solo. No hay build: lo que hay en la carpeta es lo que se sirve.

## 7. Exportar datos

Cada pestaña de la app tiene un botón **Exportar CSV** que descarga lo que
hay en pantalla, con separador `;` y BOM UTF-8: se abre directamente en
Excel en español sin pasos intermedios. Las vistas `v_export_partidos` y
`v_export_entrenamientos` también se pueden consultar desde el SQL Editor.

## 8. La pausa de los 7 días

Los proyectos gratuitos de Supabase **se pausan tras 7 días sin actividad**.
Cualquier uso de la app cuenta como actividad; en temporada no pasará.
Si se pausa (parón navideño, verano...), entra al panel de Supabase y pulsa
**Restore**: los datos no se pierden, solo se detiene el servicio.

---

## Archivos

| Archivo | Qué es |
|---|---|
| `schema.sql` | Tablas, catálogos, vistas, función `es_miembro`, RLS, policies y grants. Un solo script. |
| `seed.sql` | Posiciones, 5 formaciones con coordenadas, motivos de ausencia y plantilla de ejemplo. |
| `migracion-01-alineacion-libre.sql` | Migración: añade posición personalizada de ficha (fichas movibles). Ejecutar solo si tu BD se creó antes de esta función. |
| `migracion-02-posicion-ficha-y-convocatoria.sql` | Migración: añade `lineup_slots.position_code` (posición con la que se guarda cada ficha). Ejecutar solo si tu BD se creó antes de esta función. |
| `migracion-03-capitan.sql` | Migración: añade `lineups.captain_player_id` (capitán del once). Ejecutar solo si tu BD se creó antes de esta función. |
| `login.html` | Acceso con email + contraseña. *(fase b)* |
| `equipo.html` | Plantilla, estadísticas, ficha de jugador, lesiones. *(fase b)* |
| `partidos.html` | Partidos: convocatoria (paso 1) y alineación + minutos/posiciones/eventos post-partido inline (paso 2). *(fases c y d)* |
| `entrenamientos.html` | Sesiones, pasar lista, histórico. *(fase e)* |
| `index.html` | Dashboard. *(fase f)* |
| `app.js` / `styles.css` / `config.js` | Lógica compartida, identidad visual y configuración. *(fase b)* |
