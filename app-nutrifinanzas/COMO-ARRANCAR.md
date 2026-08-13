# 🥗 NutriGasto — Cómo arrancar la demo

Esta es una **app navegable** de nutrición + finanzas personales.
Ya tiene **cuentas de usuario reales** (registro e inicio de sesión) con la
base de datos en la nube (**Supabase**). El escáner de tickets y las recetas
usan IA real (Gemini) desde una Edge Function de Supabase.

Esta guía está escrita para personas **sin conocimientos de programación**.
Sigue los pasos en orden y no te saltes ninguno. 🙂

---

## 1) Qué necesitas instalar (solo la primera vez)

La app necesita un programa gratuito llamado **Node.js**. Es el "motor" que
hace funcionar el proyecto en tu ordenador.

1. Entra en 👉 https://nodejs.org
2. Descarga el botón grande que diga **LTS** (es la versión estable).
3. Abre el archivo descargado y pulsa "Siguiente, Siguiente, Siguiente…"
   hasta terminar (deja todas las opciones como vienen).

> Si ya tenías Node.js instalado, puedes saltarte este paso.

---

## 2) Abrir la "terminal" en la carpeta del proyecto

La **terminal** es una ventana donde se escriben comandos. No da miedo:
solo vamos a copiar y pegar.

**En Windows (lo más fácil):**

1. Abre la carpeta `app-nutrifinanzas` en el Explorador de archivos.
2. Haz clic en la barra de direcciones de arriba (donde pone la ruta de la
   carpeta), escribe `powershell` y pulsa **Enter**.
3. Se abrirá una ventana azul o negra. ¡Esa es la terminal, ya está en la
   carpeta correcta!

---

## 3) Instalar las piezas de la app (solo la primera vez)

En la terminal que acabas de abrir, **copia y pega** esta línea y pulsa **Enter**:

```
npm install
```

Esto descargará las piezas que la app necesita. Tarda **1-2 minutos** la
primera vez. Verás texto moviéndose: es normal. Cuando vuelva a aparecer la
línea para escribir, ya ha terminado.

> Si ves algún aviso amarillo de "vulnerabilities" o "deprecated", **ignóralo**:
> no afecta a la app.

---

## 3.5) Configurar las claves de la base de datos (solo la primera vez)

La app se conecta a **Supabase** (la base de datos en la nube), y para eso
necesita un pequeño archivo con dos claves. **Sin este paso la app no arranca.**

1. En la carpeta `app-nutrifinanzas` verás un archivo llamado **`.env.example`**.
2. Haz una **copia** de ese archivo y renómbrala a **`.env`** (solo `.env`, sin
   `.example`).
3. Ábrela con el Bloc de notas y pega dentro tu **Project URL** y tu **anon key**
   de Supabase (las encuentras en tu panel de Supabase → *Settings → API*).
4. Guarda y cierra.

> Estas claves son de cliente (públicas) y las protege la seguridad de la base
> de datos. El archivo `.env` **no se sube al repositorio** (está en `.gitignore`).

---

## 4) Arrancar la app 🚀

En la misma terminal, copia y pega esto y pulsa **Enter**:

```
npm run dev
```

A los pocos segundos verás algo como:

```
  ➜  Local:   http://localhost:5173/
```

El navegador debería **abrirse solo**. Si no se abre, abre tú Chrome o Edge y
escribe en la barra de direcciones:

```
http://localhost:5173
```

¡Ya está! Verás la app funcionando. 🎉

> **Consejo:** para que se vea como un móvil de verdad, en el navegador pulsa
> **F12**, luego el iconito de móvil/tablet (arriba a la izquierda del panel
> que se abre) y elige un modelo de móvil. También puedes simplemente
> estrechar la ventana del navegador.

---

## 5) Para cerrar / volver a abrir

- **Para parar la app:** vuelve a la terminal y pulsa las teclas `Ctrl` + `C`.
- **Para volver a abrirla otro día:** repite solo el **paso 2** y el
  **paso 4** (el `npm install` ya no hace falta repetirlo).

---

## 📱 Qué puedes probar en la demo

1. **Bienvenida** → pulsa "Empezar" (o "Ya tengo cuenta" si ya te registraste).
2. **Registro:** crea una cuenta con tu email y una contraseña (mínimo 6
   caracteres). Después podrás entrar con "Iniciar sesión".
3. **Onboarding (alta):** elige entre dos perfiles:
   - **Control total:** datos + objetivos de calorías y macros (ej. 2000 kcal,
     50% hidratos / 30% proteínas / 20% grasas).
   - **Sencilla:** solo nombre, edad, género y comunidad autónoma/provincia (sin macros).
4. **Despensa:** empieza vacía (cada cuenta tiene la suya). Puedes:
   - **Añadir** un alimento a mano.
   - **Escanear** un ticket o un código de barras: la foto se analiza con IA
     (Gemini) y rellena los productos detectados.
   - **Eliminar** alimentos con la papelera.
5. **Gastos:** gasto total, gráfico de tarta por categoría, barras por
   supermercado y lista de últimas compras.
6. **Recetas:** pantalla "Próximamente" (aún no construida, es a propósito).
7. **Perfil:** muestra tus datos y, si elegiste "Control total", tus macros.
   Abajo hay un botón **"Cerrar sesión"**.

> **Tu cuenta, tu perfil y tu despensa se guardan en la nube** (Supabase):
> puedes cerrar sesión y volver a entrar desde cualquier sitio y todo seguirá
> ahí.

---

## ❓ Si algo va mal

- **"npm no se reconoce como comando"** → no se instaló bien Node.js. Repite el
  paso 1 y reinicia el ordenador.
- **El navegador no abre nada** → comprueba que en la terminal sigue corriendo
  `npm run dev` (no la cierres) y entra a mano en `http://localhost:5173`.
- **La app muestra un error sobre "variables de entorno de Supabase"** → te
  falta el paso **3.5**: crea el archivo `.env` con tus claves.
- **Quiero salir de mi cuenta** → entra en la app, ve a **Perfil** y pulsa
  **"Cerrar sesión"**.

---

## 🔧 Detalles técnicos (por si alguien técnico lo mira)

- **Vite + React + Tailwind CSS**
- **react-router-dom** para la navegación entre pantallas
- **recharts** para los gráficos (tarta y barras)
- **lucide-react** para los iconos
- **Supabase** (`@supabase/supabase-js`) para autenticación y base de datos.
  Cliente en `src/lib/supabase.js`; sesión y perfil en `src/context/AuthContext.jsx`;
  alimentos (despensa) en `src/context/AppContext.jsx`.
  Esquema SQL en `supabase/schema.sql`. Claves en `.env` (ver `.env.example`).
- El escáner de tickets (OCR) y las recetas usan IA real (Gemini), vía las
  Edge Functions `analizar-imagen` y `generar-recetas`.

Estructura de carpetas:

```
app-nutrifinanzas/
├── index.html
├── src/
│   ├── main.jsx            (arranque de la app)
│   ├── App.jsx             (rutas/navegación + protección de rutas)
│   ├── index.css           (estilos y animaciones)
│   ├── lib/                (cliente de Supabase)
│   ├── context/            (AuthContext = sesión+perfil; AppContext = alimentos)
│   ├── components/         (carcasa de móvil y barra inferior)
│   ├── data/               (categorías, supermercados y regiones)
│   ├── utils/              (formato de euros y fechas)
│   └── pages/              (las pantallas: Bienvenida, Login, Registro,
│                            Onboarding, Despensa, AñadirAlimento, Escanear,
│                            Gastos, Recetas, Perfil)
└── supabase/
    └── schema.sql          (esquema de la base de datos)
```
