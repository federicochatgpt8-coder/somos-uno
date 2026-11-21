/**
 * Somos Uno – conexión con Apps Script + ingreso con Google.
 *
 * - `servidor()` reemplaza a `google.script.run` con la misma forma de uso:
 *     servidor().withSuccessHandler(fn).withFailureHandler(fn).nombreFuncion(args)
 * - El ingreso usa "Continuar con Google" (Google Identity Services).
 *   El token se guarda en este dispositivo y se renueva solo cuando vence.
 */

const CONFIG_APP = {
  API_URL: "https://script.google.com/macros/s/AKfycbwzl7-lCikdPZ1AvCg0jPl77GqaAQ5H24i95dkjvb3rxd4Fcjf8aBK5LT1yUg8uQLnS/exec",
  GOOGLE_CLIENT_ID: "322063270623-s06b2bn6t4l20n5nra1iqqn1pj0mnutl.apps.googleusercontent.com"
};

const CLAVE_TOKEN = "somosUnoGoogleToken";
let tokenActual = null;
let esperandoToken = null; // promesa mientras Google entrega un token nuevo

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
      return (...args) => { llamarApi(nombre, args).then(r => alExito(r), e => alFallar(e)); };
    }
  });

  return llamada;
}

async function llamarApi(fn, args, reintento) {
  const token = await obtenerToken();

  let respuesta;
  try {
    const r = await fetch(CONFIG_APP.API_URL, {
      method: "POST",
      // text/plain evita el "preflight" CORS que Apps Script no soporta
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ fn: fn, args: args || [], idToken: token })
    });
    respuesta = await r.json();
  } catch (e) {
    throw new Error("No se pudo conectar. Revisá tu conexión a internet.");
  }

  if (!respuesta.ok) {
    const error = String(respuesta.error || "Error desconocido");

    if ((error === "SESION_VENCIDA" || error === "SESION_REQUERIDA") && !reintento) {
      borrarToken();
      return llamarApi(fn, args, true);
    }
    throw new Error(error);
  }

  return respuesta.data;
}

/* ------------------------------------------------------------------ */
/*  Token de Google                                                    */
/* ------------------------------------------------------------------ */

function leerExpiracion(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { exp: payload.exp * 1000, email: payload.email, nombre: payload.name, foto: payload.picture };
  } catch (e) {
    return null;
  }
}

function tokenVigente(token) {
  const info = token && leerExpiracion(token);
  return !!(info && info.exp - Date.now() > 60 * 1000); // al menos 1 minuto de margen
}

function guardarToken(token) {
  tokenActual = token;
  try { localStorage.setItem(CLAVE_TOKEN, token); } catch (e) {}
}

function borrarToken() {
  tokenActual = null;
  try { localStorage.removeItem(CLAVE_TOKEN); } catch (e) {}
}

function tokenGuardado() {
  try { return localStorage.getItem(CLAVE_TOKEN); } catch (e) { return null; }
}

/** Devuelve un token válido; si venció, pide uno nuevo a Google sin molestar (si se puede). */
function obtenerToken() {
  if (tokenVigente(tokenActual)) return Promise.resolve(tokenActual);

  if (!esperandoToken) {
    esperandoToken = new Promise((resolve, reject) => {
      resolverToken = resolve;
      rechazarToken = reject;
      try {
        google.accounts.id.prompt(notif => {
          if (notif.isNotDisplayed() || notif.isSkippedMoment()) {
            // Google no pudo renovar solo: mostramos la pantalla de ingreso.
            rechazarToken(new Error("Tu sesión venció. Ingresá de nuevo con Google."));
          }
        });
      } catch (e) {
        rechazarToken(new Error("Tu sesión venció. Ingresá de nuevo con Google."));
      }
    }).finally(() => { esperandoToken = null; });

    esperandoToken.catch(() => {
      usuarioActual = null;
      detenerActualizacionAutomatica && detenerActualizacionAutomatica();
      mostrarLogin();
      mostrarMensajeLogin("Tu sesión venció. Tocá “Continuar con Google” para seguir.");
    });
  }

  return esperandoToken;
}

let resolverToken = null;
let rechazarToken = null;

/* ------------------------------------------------------------------ */
/*  Ingreso                                                            */
/* ------------------------------------------------------------------ */

function alRecibirCredencialGoogle(resp) {
  guardarToken(resp.credential);

  if (resolverToken) {
    // Era una renovación silenciosa en medio del uso.
    const r = resolverToken;
    resolverToken = null;
    r(resp.credential);
    if (usuarioActual) return;
  }

  entrarAlSistema();
}

function entrarAlSistema() {
  mostrarMensajeLogin("Verificando tu cuenta…");

  llamarApi("quienSoy", [])
    .then(usuario => {
      usuarioActual = usuario;
      mostrarMensajeLogin("");
      iniciarSistema();
    })
    .catch(err => {
      borrarToken();
      mostrarLogin();
      mostrarMensajeLogin(err.message, true);
    });
}

function cerrarSesionGoogle() {
  borrarToken();
  try { google.accounts.id.disableAutoSelect(); } catch (e) {}
  mostrarMensajeLogin("Cerraste sesión.");
}

function mostrarMensajeLogin(texto, esError) {
  const el = document.getElementById("loginError");
  if (!el) return;
  el.textContent = texto || "";
  el.classList.toggle("login-error", !!esError);
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

  const guardado = tokenGuardado();
  if (tokenVigente(guardado)) {
    tokenActual = guardado;
    entrarAlSistema();
  } else {
    borrarToken();
    mostrarLogin();
    google.accounts.id.prompt();
  }
}

/* Espera a que cargue la librería de Google y arranca. */
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
