# NutriGasto

App móvil (PWA) que junta dos cosas que normalmente van en aplicaciones separadas:
**lo que comes** y **lo que te cuesta comerlo**. Registras la compra una sola vez y
esa misma información alimenta el control nutricional y el control de gasto.

Producción: https://nutri-gasto-app-1ppr.vercel.app

---

## 1. Arrancar en local

**Requisitos:** Node.js 18 o superior (probado con 22).

```bash
npm install
cp .env.example .env    # y rellenar las dos claves (ver abajo)
npm run dev             # http://localhost:5173
```

La app **no arranca sin `.env`**: `src/lib/supabase.js` lanza un error explícito
en vez de fallar de forma críptica más adelante. Las dos claves salen del panel
de Supabase (*Settings → API*):

| Variable | De dónde sale |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project API keys → `anon` `public` |

La `anon key` es **pública por diseño**: no da acceso a nada por sí sola porque
todas las tablas están protegidas con Row Level Security (§6). Aun así `.env`
está en `.gitignore` y nunca se sube.

### Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Compila a `dist/` (lo que despliega Vercel) |
| `npm run preview` | Sirve `dist/` en local, para probar el build real |
| `npm run lint` | ESLint 9 (flat config) |
| `npm run test:rls` | Tests de aislamiento entre usuarios contra la BD real (§6) |

---

## 2. Los dos modos

Al registrarse el usuario elige un modo, y eso decide qué pantallas existen.
La decisión está centralizada en `src/lib/modos.js` — ninguna pantalla compara
`perfil.tipo` a mano:

| | Modo sencillo | Modo completo |
|---|---|---|
| Despensa, Gastos, Recetas, ¿Qué pido? | Sí | Sí |
| Diario de comidas | — | Sí |
| Objetivos de kcal y macros | — | Sí |
| Ayuno intermitente | — | Sí |
| Pantalla de inicio | Despensa | Diario |

El modo se cambia en cualquier momento desde Perfil y **no borra nada**: al pasar
a sencillo los macros siguen en su columna y el diario en su tabla, solo dejan de
mostrarse. Volver a completo lo recupera tal cual estaba.

En base de datos la columna `perfiles.tipo_perfil` guarda `'sencilla'` / `'total'`.

---

## 3. Pantallas

| Ruta | Pantalla | Qué hace |
|---|---|---|
| `/` `/login` `/registro` | Bienvenida, acceso | Alta y sesión con email + contraseña |
| `/onboarding` | Alta de perfil | Modo, datos y objetivos de macros |
| `/despensa` | Despensa | Lo que tienes ahora, con avisos nutricionales |
| `/anadir` | Añadir alimento | Alta manual |
| `/escanear` → `/confirmar-escaneo` | Escáner | Ticket, código de barras, producto o tabla nutricional |
| `/diario` → `/diario/registrar` | Diario | Qué has comido hoy vs. tu objetivo |
| `/gastos` | Gastos | Gasto por mes, categoría y supermercado |
| `/recetas` | Recetas | Sugerencias con lo que ya tienes |
| `/analizar-carta` → `/confirmar-carta` | ¿Qué pido? | Recomienda plato de la carta de un restaurante |
| `/perfil` | Perfil | Datos, macros, ayuno, comidas del día, despensa compartida |

Todas las rutas privadas pasan por `Protegida` en `App.jsx`: sin sesión mandan a
la bienvenida, y con sesión pero sin perfil completo, al onboarding. El diario
además exige un modo que lo tenga (`SoloDiario`), para que una URL escrita a mano
no enseñe una pantalla vacía.

---

## 4. Cómo entra la comida en la app

Hay cuatro caminos, y todos acaban en la misma tabla `alimentos`:

1. **A mano** — formulario normal.
2. **Código de barras** (cámara en vivo) — primero se busca en el catálogo
   compartido `productos` de la propia app, que es instantáneo; si no está, se
   consulta **Open Food Facts**; y solo si ninguno lo tiene, se cae a foto + IA.
   Lo que se confirma se guarda en el catálogo compartido, así que un producto
   solo hace falta escanearlo una vez entre todos los usuarios.
3. **Foto** (ticket de la compra, producto suelto o tabla nutricional) — se
   analiza con Gemini y rellena los campos detectados.
4. **Desde una receta o un restaurante** — lo recomendado se registra directo
   en el diario.

### Avisos nutricionales

Los avisos de la despensa (`src/lib/avisos.js`) se calculan **con reglas, no con
IA**: son instantáneos, gratis y no se inventan nada. Los umbrales no son
arbitrarios — "alto en" grasas saturadas, azúcares y sal usa el semáforo
nutricional de la FSA británica, y "fuente de" / "alto contenido en" fibra y
proteínas usa el Reglamento europeo 1924/2006, que es lo que legalmente puede
poner un envase. Los umbrales de bebidas son distintos de los de sólidos.

Dos decisiones deliberadas: no se avisa nunca de la grasa **total** (saltarían el
aguacate, las almendras y el aceite de oliva), y si hay algo que advertir no se
mezcla con elogios, que es justo lo que hacen los envases.

---

## 5. Arquitectura

**Vite + React 18 + Tailwind CSS**, desplegado en Vercel. Backend enteramente en
**Supabase** (Postgres + Auth + Edge Functions). No hay servidor propio.

```
src/
├── main.jsx              arranque
├── App.jsx               rutas y protección de rutas
├── context/
│   ├── AuthContext.jsx   sesión de Supabase + perfil + hogar
│   ├── AppContext.jsx    alimentos de la despensa
│   └── DiarioContext.jsx registros del diario, comidas y objetivos
├── pages/                una por pantalla de la tabla de arriba
├── components/           carcasa de móvil, barra inferior, tour, editores
├── lib/                  acceso a datos y lógica de dominio
├── data/                 categorías, supermercados y regiones de España
└── utils/                formato de euros, números y unidades

supabase/
├── schema.sql            esquema completo
├── migrations/           historial incremental (002 → 024)
└── functions/            analizar-imagen, generar-recetas
```

El estado vive en tres contextos, sin librería externa. Cada pantalla se descarga
solo al entrar en ella (`React.lazy`), porque el escáner y las gráficas pesan
bastante y si no la app tardaría en abrir con datos móviles.

### Dos trampas resueltas que conviene conocer

**Fechas.** Todo el diario va en hora local del móvil, nunca UTC.
`new Date().toISOString()` devuelve la fecha en UTC, así que en España convierte
"hoy a la 01:00" en "ayer" y la cena se registraría en el día equivocado. Por eso
`src/lib/fechas.js` construye la cadena `YYYY-MM-DD` a mano y el INSERT manda la
fecha explícita en vez de dejar el `default current_date` del servidor.

**Sesión caducada al volver de segundo plano.** iOS pausa los temporizadores
cuando la PWA está en segundo plano, así que el refresco automático del token no
siempre llega a tiempo y la primera consulta al volver falla con un 401 que se
cura solo un segundo después. `conReintentoDeSesion()` en `src/lib/supabase.js`
reintenta una vez tras refrescar la sesión, en vez de enseñar un error falso.

---

## 6. Base de datos y seguridad

Diez tablas, **todas con Row Level Security activo**:

| Tabla | Contenido | Quién la ve |
|---|---|---|
| `perfiles` | Datos, modo, macros, ayuno | Solo su dueño |
| `alimentos` | La despensa y el historial de compra | Su dueño, o todo el hogar |
| `registros_diarios` | Lo que has comido | Solo su dueño, **nunca se comparte** |
| `comidas_usuario` | Tus comidas del día (máx. 7) | Solo su dueño |
| `ayunos` | Ayunos intermitentes | Solo su dueño |
| `productos` | Catálogo compartido por código de barras | Todos (lectura y aporte) |
| `supermercados` | Lista comunitaria | Todos (lectura y aporte) |
| `hogares`, `hogar_miembros` | Despensa compartida | Solo tu hogar |
| `limites_peticiones_ia` | Contador de uso de IA | Nadie directamente |

Puntos de seguridad relevantes:

- **La separación entre usuarios no depende del frontend.** La imponen las
  policies de Postgres. `tests/rls-idor.test.js` lo comprueba de verdad, con dos
  cuentas reales, verificando que un usuario no puede leer el perfil de otro,
  ni ver su despensa, ni colar un alimento en un hogar ajeno escribiendo el
  `hogar_id` a mano, ni editar un alimento privado de otro.
- **Las escrituras del hogar van por funciones de Postgres**, no por INSERT
  directos: unirse exige el código, y las policies de lectura solo dejan ver el
  tuyo. Intentar códigos a lo bruto está limitado (5/min).
- **La clave de Gemini nunca toca el navegador.** Vive como secreto de Supabase y
  solo la usan las Edge Functions.
- **Límite de peticiones de IA en base de datos**, no solo en la interfaz, y se
  comprueba antes de gastar cuota.
- **Cabeceras de seguridad** (`vercel.json`): CSP sin `unsafe-eval` ni scripts
  externos, HSTS, `frame-ancestors 'none'`, `nosniff` y `Permissions-Policy` que
  solo concede la cámara.
- **Borrado lógico en `alimentos`** (`eliminado_en`): la despensa deja de verlo,
  pero el gasto de ese mes no se encoge con el tiempo.

### Migraciones

`supabase/migrations/` es el historial incremental (002 → 024) y `schema.sql` es
la foto completa del esquema actual. Para un proyecto nuevo basta `schema.sql`.

---

## 7. La IA

Dos Edge Functions en Deno, ambas con `verify_jwt: true` (solo usuarios con
sesión), lista blanca de orígenes y límite de peticiones por usuario:

**`analizar-imagen`** — cuatro modos: `ticket`, `producto`, `nutricion` y `carta`.
El modo carta acepta hasta 6 fotos, un PDF, o el **enlace del QR de la mesa**,
porque casi ninguna carta real cabe en una sola foto.

Ese último caso hace que el servidor descargue una URL elegida por el usuario, así
que se trata como hostil: solo `http`/`https`, se rechazan hosts internos, se
resuelven **todas** las IPs del dominio y se rechaza si alguna cae en rango
privado, loopback, link-local o CGNAT, las redirecciones se siguen a mano
revalidando **cada salto** (máximo 3), y hay timeout y tope de tamaño. El
contenido descargado no vuelve nunca al cliente: solo sale el JSON de platos.

**`generar-recetas`** — propone combinaciones reales con lo que hay en la
despensa. En modo completo recibe lo que te queda hoy de macros y ordena las
recetas por lo bien que encajan, no por ser "sanas" en abstracto.

> **Sobre la fiabilidad:** el modelo corre en el nivel gratuito de Gemini, que
> devuelve 503 "high demand" a rachas en horas punta y se recupera solo a los
> pocos minutos. No es un fallo de la app; cuando pasa, las dos funciones lo
> detectan y muestran *"La IA está saturada ahora mismo, espera unos segundos"*
> en vez de un error genérico.

Los macros que estima la IA son **siempre orientativos** y la app lo dice en
pantalla: no sabe la cantidad exacta de cada ingrediente ni cómo cocinas.

---

## 8. Despliegue

Vercel compila desde el repositorio con `npm run build` y publica `dist/`.
`vercel.json` aporta el rewrite de SPA (para que `/gastos` funcione al recargar)
y las cabeceras de seguridad.

Las Edge Functions se despliegan aparte, con la CLI de Supabase:

```bash
npx supabase@latest functions deploy generar-recetas \
  --project-ref <ref-del-proyecto> --use-api
```

Al desplegar por primera vez hay que fijar los secretos `GEMINI_API_KEY` y
`ALLOWED_ORIGINS` (el dominio de producción; los *preview deployments* de Vercel
tienen otra URL y ahí la IA no funcionará hasta añadirla).

La PWA es instalable en Android e iOS: manifest, iconos, service worker y
precarga de todo el bundle para poder abrirla sin conexión.
