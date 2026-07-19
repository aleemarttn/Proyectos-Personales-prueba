/* =====================================================================
   APP GESTIÓN FÚTBOL — app.js
   Lógica compartida por todas las páginas privadas. NO se duplica nada
   entre los .html: cliente de Supabase, guardia de sesión, contexto de
   equipo (team_id), cabecera + pestañas, y helpers de fecha, CSV,
   números, toast y modal.

   Uso desde cada página privada:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="config.js"></script>
     <script src="app.js"></script>
     <script>
       App.iniciar({ tab: "equipo" }).then((ctx) => {
         // ctx = { user, team } ya disponible; pintar la página
       });
     </script>

   Requiere que config.js (SUPABASE_URL / SUPABASE_ANON_KEY) y la librería
   supabase-js estén cargados ANTES que este archivo.
   ===================================================================== */

const App = (() => {
  "use strict";

  // ---- Cliente de Supabase (único para toda la app) ----
  const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ---- Contexto de sesión, se rellena en iniciar() ----
  const ctx = { user: null, team: null };

  // Definición de las pestañas de navegación
  const TABS = [
    { id: "inicio",          label: "Inicio",          href: "index.html" },
    { id: "equipo",          label: "Equipo",          href: "equipo.html" },
    { id: "partidos",        label: "Partidos",        href: "partidos.html" },
    { id: "entrenamientos",  label: "Entrenamientos",  href: "entrenamientos.html" },
  ];

  // ===================================================================
  //  ARRANQUE / GUARDIA DE SESIÓN
  //  Comprueba la sesión ANTES de pintar. Si no hay, redirige a login.
  //  Carga el team_id del usuario y lo deja en ctx.team.
  // ===================================================================
  async function iniciar({ tab } = {}) {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      window.location.replace("login.html");
      return new Promise(() => {}); // no continúa: la página se va a login
    }
    ctx.user = session.user;

    // Cargar el equipo del usuario (primera membresía). El team_id NUNCA
    // se hardcodea en el HTML: sale de team_members del usuario logueado.
    const { data: membresias, error } = await db
      .from("team_members")
      .select("team_id, role, teams(id, name, category, season, color, yellow_cycle)")
      .limit(1);

    if (error) {
      console.error(error);
      document.body.innerHTML =
        '<div class="wrap"><div class="card"><h2>Error de conexión</h2>' +
        '<p class="muted">No se pudieron cargar los datos del equipo. ' +
        'Revisa la configuración de Supabase o vuelve a intentarlo.</p></div></div>';
      return new Promise(() => {});
    }

    if (!membresias || membresias.length === 0) {
      document.body.innerHTML =
        '<div class="wrap"><div class="card"><h2>Usuario sin equipo</h2>' +
        '<p class="muted">Tu usuario no está asociado a ningún equipo todavía. ' +
        'Hace falta insertar tu fila en <code>team_members</code> (ver README).</p>' +
        '<button class="btn mt-3" onclick="App.salir()">Cerrar sesión</button></div></div>';
      return new Promise(() => {});
    }

    const m = membresias[0];
    ctx.team = { ...m.teams, role: m.role };

    montarCabecera(tab);
    return ctx;
  }

  // ===================================================================
  //  CABECERA + PESTAÑAS
  //  Se inyectan en los contenedores #cabecera y #tabs si existen.
  // ===================================================================
  function montarCabecera(tabActiva) {
    const cab = document.getElementById("cabecera");
    if (cab) {
      cab.innerHTML = `
        <div class="marca">
          <div class="escudo"><img src="escudo-icodense.png" alt="Escudo del club" /></div>
          <div style="min-width:0">
            <h1>${esc(ctx.team.name || "Equipo")}</h1>
            <p class="subtitulo-club">${esc([ctx.team.category, ctx.team.season].filter(Boolean).join(" · "))}</p>
          </div>
        </div>
        <button class="btn salir" onclick="App.salir()">Salir</button>`;
    }
    const tabs = document.getElementById("tabs");
    if (tabs) {
      tabs.innerHTML = TABS.map(t =>
        `<a href="${t.href}" class="${t.id === tabActiva ? "activa" : ""}">${t.label}</a>`
      ).join("");
    }
  }

  async function salir() {
    await db.auth.signOut();
    window.location.replace("login.html");
  }

  // ===================================================================
  //  FECHAS  (siempre en hora LOCAL del dispositivo, formato ISO)
  //  current_date en Supabase es UTC; por eso las fechas las calcula y
  //  envía el cliente. Nunca se usa new Date().toISOString() para la
  //  fecha "de hoy" porque eso da UTC.
  // ===================================================================

  // "YYYY-MM-DD" de hoy en hora local
  function hoyISO() {
    return fechaISO(new Date());
  }

  // Date -> "YYYY-MM-DD" en hora local
  function fechaISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dia}`;
  }

  // "YYYY-MM-DD" -> "DD/MM/AAAA" para mostrar
  function fechaBonita(iso) {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
  }

  // "YYYY-MM-DD" -> "vie 12 sep" (día corto para listas)
  const DIAS = ["dom","lun","mar","mié","jue","vie","sáb"];
  const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  function fechaCorta(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return `${DIAS[dt.getDay()]} ${d} ${MESES[m - 1]}`;
  }

  // Días entre hoy y una fecha ISO (positivo = futuro)
  function diasHasta(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    const objetivo = new Date(y, m - 1, d);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((objetivo - hoy) / 86400000);
  }

  // Edad a partir de fecha de nacimiento ISO
  function edad(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    const hoy = new Date();
    let e = hoy.getFullYear() - y;
    if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) e--;
    return e;
  }

  // ===================================================================
  //  NÚMEROS
  // ===================================================================
  function num(n, dec = 0) {
    if (n === null || n === undefined || n === "") return "—";
    return Number(n).toLocaleString("es-ES", {
      minimumFractionDigits: dec, maximumFractionDigits: dec
    });
  }

  // ===================================================================
  //  EXPORTACIÓN CSV
  //  Separador ";" y BOM UTF-8 para que Excel en español lo abra bien.
  //  filas = array de objetos; las claves del primero son las columnas.
  // ===================================================================
  function exportarCSV(filas, nombreArchivo) {
    if (!filas || filas.length === 0) {
      toast("No hay datos para exportar.", "warn");
      return;
    }
    const cols = Object.keys(filas[0]);
    const escaparCampo = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      // Si contiene separador, comillas o salto de línea, se entrecomilla
      if (/[";\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lineas = [
      cols.join(";"),
      ...filas.map(f => cols.map(c => escaparCampo(f[c])).join(";"))
    ];
    const contenido = "﻿" + lineas.join("\r\n"); // BOM + CRLF
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo.endsWith(".csv") ? nombreArchivo : nombreArchivo + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ===================================================================
  //  TOAST (aviso flotante no bloqueante)
  // ===================================================================
  function toast(mensaje, tipo = "ok", ms = 3200) {
    let cont = document.getElementById("toast-cont");
    if (!cont) {
      cont = document.createElement("div");
      cont.id = "toast-cont";
      document.body.appendChild(cont);
    }
    const t = document.createElement("div");
    t.className = "toast " + tipo;
    t.textContent = mensaje;
    cont.appendChild(t);
    setTimeout(() => {
      t.style.transition = "opacity .3s";
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 300);
    }, ms);
  }

  // ===================================================================
  //  MODAL genérico
  //  App.modal({ titulo, contenido (HTML string o Node), onMontar })
  //  Devuelve un objeto con .cerrar()
  // ===================================================================
  function modal({ titulo = "", contenido = "", onMontar } = {}) {
    const fondo = document.createElement("div");
    fondo.className = "modal-fondo";
    fondo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <div class="modal-header">
          <h2>${esc(titulo)}</h2>
          <button class="modal-cerrar" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-body"></div>
      </div>`;
    const cuerpo = fondo.querySelector(".modal-body");
    if (typeof contenido === "string") cuerpo.innerHTML = contenido;
    else if (contenido instanceof Node) cuerpo.appendChild(contenido);

    function cerrar() {
      fondo.remove();
      document.removeEventListener("keydown", onEsc);
    }
    function onEsc(e) { if (e.key === "Escape") cerrar(); }

    fondo.querySelector(".modal-cerrar").addEventListener("click", cerrar);
    fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrar(); });
    document.addEventListener("keydown", onEsc);

    document.body.appendChild(fondo);
    if (onMontar) onMontar(cuerpo, cerrar);
    return { cerrar, cuerpo };
  }

  // Confirmación simple (promesa). Sustituye a confirm() nativo.
  function confirmar({ titulo = "¿Seguro?", mensaje = "", textoOk = "Confirmar", peligro = false } = {}) {
    return new Promise((resolve) => {
      const m = modal({
        titulo,
        contenido: `
          <p class="muted">${esc(mensaje)}</p>
          <div class="acciones mt-3">
            <button class="btn" data-no>Cancelar</button>
            <button class="btn ${peligro ? "peligro" : "primario"}" data-si>${esc(textoOk)}</button>
          </div>`,
        onMontar(cuerpo, cerrar) {
          cuerpo.querySelector("[data-no]").addEventListener("click", () => { cerrar(); resolve(false); });
          cuerpo.querySelector("[data-si]").addEventListener("click", () => { cerrar(); resolve(true); });
        }
      });
    });
  }

  // ===================================================================
  //  UTILIDADES VARIAS
  // ===================================================================

  // Escapar HTML para evitar inyección al pintar datos de usuario
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  // Pinta un estado vacío estándar dentro de un contenedor
  function vacio(contenedor, { emoji = "📋", titulo = "Sin datos", texto = "", accionHTML = "" }) {
    contenedor.innerHTML = `
      <div class="vacio">
        <span class="emoji">${emoji}</span>
        <h3>${esc(titulo)}</h3>
        <p>${esc(texto)}</p>
        ${accionHTML}
      </div>`;
  }

  // Devuelve el team_id actual (atajo cómodo)
  const teamId = () => ctx.team && ctx.team.id;

  // ---- API pública ----
  return {
    db, ctx, iniciar, salir,
    hoyISO, fechaISO, fechaBonita, fechaCorta, diasHasta, edad,
    num, exportarCSV, toast, modal, confirmar, esc, vacio, teamId,
  };
})();
