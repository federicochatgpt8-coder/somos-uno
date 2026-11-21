/**
 * Somos Uno – conexión con Apps Script + ingreso con Google.
 *
 * - `servidor()` reemplaza a `google.script.run` con la misma forma de uso:
 *     servidor().withSuccessHandler(fn).withFailureHandler(fn).nombreFuncion(args)
 * - Ingreso: "Continuar con Google" una vez → el servidor entrega una sesión
 *   de 30 días que queda guardada en este dispositivo.
 */

const CONFIG_APP = {
  API_URL: "https://script.google.com/macros/s/AKfycbwzl7-lCikdPZ1AvCg0jPl77GqaAQ5H24i95dkjvb3rxd4Fcjf8aBK5LT1yUg8uQLnS/exec",
  GOOGLE_CLIENT_ID: "322063270623-s06b2bn6t4l20n5nra1iqqn1pj0mnutl.apps.googleusercontent.com"
};

const CLAVE_SESION = "somosUnoSesion30d";
const CLAVE_TOKEN = "somosUnoGoogleToken"; // solo si el servidor aún no tiene sesiones

let sesionActual = leerLocal(CLAVE_SESION);
let tokenActual = null;
let avisoSesionMostrado = false;

/* ------------------------------------------------------------------ */
/*  Utilidades                                                         */
/* ------------------------------------------------------------------ */

function leerLocal(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function guardarLocal(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function borrarLocal(k) { try { localStorage.removeItem(k); } catch (e) {} }

function tokenVigente(token) {
  try {
    const p = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return p.exp * 1000 - Date.now() > 60 * 1000;
  } catch (e) {
    return false;
  }
}

async function postApi(cuerpo) {
  let r;
  try {
    r = await fetch(CONFIG_APP.API_URL, {
      method: "POST",
      // text/plain evita el "preflight" CORS que Apps Script no soporta
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(cuerpo)
    });
  } catch (e) {
    throw new Error("No se pudo conectar. Revisá tu conexión a internet.");
  }
  return r.json();
}

/* ------------------------------------------------------------------ */
/*  Llamadas al servidor                                               */
/* ------------------------------------------------------------------ */

function servidor() {
  let alExito = function () {};
  let alFallar = function (e) { alert("Error: " + e.message); };

  const llamada = new Proxy({}, {
    get(_, nombre) {
      if (nombre === "withSuccessHandler") return f => { alExito = f; return llamada; };
      if (nombre === "withFailureHandler") return f => { alFallar = f; return llamada; };
      if (nombre === "withUserObject") return () => llamada;
      return (...args) => {
        llamarApi(nombre, args).then(
          r => alExito(r),
          e => { if (e.message !== "SESION_VENCIDA") alFallar(e); }
        );
      };
    }
  });

  return llamada;
}

async function llamarApi(fn, args) {
  const cuerpo = { fn: fn, args: args || [] };

  if (sesionActual) {
    cuerpo.sesion = sesionActual;
  } else if (tokenActual && tokenVigente(tokenActual)) {
    cuerpo.idToken = tokenActual;
  } else {
    sesionTerminada();
    throw new Error("SESION_VENCIDA");
  }

  const resp = await postApi(cuerpo);

  if (!resp.ok) {
    const error = String(resp.error || "Error desconocido");
    if (error === "SESION_VENCIDA" || error === "SESION_REQUERIDA") {
      sesionTerminada();
      throw new Error("SESION_VENCIDA");
    }
    throw new Error(error);
  }

  return resp.data;
}

function sesionTerminada() {
  sesionActual = null;
  tokenActual = null;
  borrarLocal(CLAVE_SESION);
  borrarLocal(CLAVE_TOKEN);
  usuarioActual = null;
  try { detenerActualizacionAutomatica(); } catch (e) {}
  try { cerrarPedido(); } catch (e) {}
  mostrarLogin();
  if (!avisoSesionMostrado) {
    avisoSesionMostrado = true;
    mostrarMensajeLogin("Tu sesión terminó. Tocá “Continuar con Google” para seguir.");
  }
}

/* ------------------------------------------------------------------ */
/*  Ingreso                                                            */
/* ------------------------------------------------------------------ */

async function alRecibirCredencialGoogle(resp) {
  mostrarMensajeLogin("Verificando tu cuenta…");
  avisoSesionMostrado = false;

  try {
    const r = await postApi({ fn: "iniciarSesion", idToken: resp.credential });

    if (r.ok) {
      sesionActual = r.data.sesion;
      guardarLocal(CLAVE_SESION, sesionActual);
      entrar(r.data.usuario);
      return;
    }

    // Servidor sin sesiones todavía: se usa el token de Google (dura 1 hora).
    if (String(r.error || "").indexOf("iniciarSesion") !== -1) {
      tokenActual = resp.credential;
      guardarLocal(CLAVE_TOKEN, tokenActual);
      const u = await llamarApi("quienSoy", []);
      entrar(u);
      return;
    }

    throw new Error(r.error || "No se pudo ingresar.");

  } catch (err) {
    mostrarLogin();
    mostrarMensajeLogin(err.message === "SESION_VENCIDA" ? "No se pudo ingresar. Probá de nuevo." : err.message, true);
  }
}

function entrar(usuario) {
  usuarioActual = usuario;
  mostrarMensajeLogin("");
  iniciarSistema();
}

function cerrarSesionGoogle() {
  if (sesionActual) postApi({ fn: "cerrarSesion", sesion: sesionActual }).catch(() => {});
  sesionActual = null;
  tokenActual = null;
  borrarLocal(CLAVE_SESION);
  borrarLocal(CLAVE_TOKEN);
  try { google.accounts.id.disableAutoSelect(); } catch (e) {}
  mostrarMensajeLogin("Cerraste sesión.");
}

function mostrarMensajeLogin(texto, esError) {
  const el = document.getElementById("loginError");
  if (!el) return;
  el.textContent = texto || "";
  el.classList.toggle("login-error", !!esError);
}

function arrancar() {
  // Si ya hay una sesión guardada, se entra directo sin pasar por Google.
  if (sesionActual) {
    mostrarMensajeLogin("Ingresando…");
    llamarApi("quienSoy", [])
      .then(entrar)
      .catch(err => {
        if (err.message !== "SESION_VENCIDA") {
          mostrarLogin();
          mostrarMensajeLogin(err.message, true);
        }
      });
    return;
  }

  const token = leerLocal(CLAVE_TOKEN);
  if (token && tokenVigente(token)) {
    tokenActual = token;
    llamarApi("quienSoy", []).then(entrar).catch(() => {});
    return;
  }

  mostrarLogin();
  mostrarMensajeLogin("");
}

function iniciarGoogle() {
  google.accounts.id.initialize({
    client_id: CONFIG_APP.GOOGLE_CLIENT_ID,
    callback: alRecibirCredencialGoogle,
    auto_select: true,
    cancel_on_tap_outside: false,
    use_fedcm_for_prompt: true,
    itp_support: true
  });

  google.accounts.id.renderButton(document.getElementById("botonGoogle"), {
    theme: "filled_blue",
    size: "large",
    shape: "pill",
    text: "continue_with",
    locale: "es",
    width: 280
  });

  if (!sesionActual) google.accounts.id.prompt();
}

/* Arranque */
arrancar();

(function esperarGoogle() {
  if (window.google && google.accounts && google.accounts.id) {
    iniciarGoogle();
  } else {
    setTimeout(esperarGoogle, 100);
  }
})();

/* App instalable (PWA) */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
