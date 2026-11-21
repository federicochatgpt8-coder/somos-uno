/**
 * Somos Uno – mejoras de la app nueva:
 *  - Estados con nombre legible y color por etapa
 *  - Menú de administrador (activos / finalizados / métricas) + buscador
 *  - Botones de contacto (llamar, WhatsApp, mapa) en el detalle
 *  - Historial del pedido en el detalle
 *  - Vista "Hoy" para transportistas
 */

/* =====================================================================
 *  ESTADOS
 * ===================================================================== */

const ESTADOS_INFO = {
  PENDIENTE_CONFIRMAR:                  ["Pendiente de confirmar", "inicio"],
  PENDIENTE_COORDINAR_RETIRO:           ["Coordinar retiro", "inicio"],
  RETIRO_PROGRAMADO:                    ["Retiro programado", "retiro"],
  EN_RETIRO:                            ["En retiro", "retiro"],
  RETIRADO:                             ["Retirado", "retiro"],
  EN_BASE:                              ["En base", "retiro"],
  PENDIENTE_ENVIO_CREMATORIO:           ["Pendiente envío a crematorio", "crematorio"],
  EN_TRASLADO_A_CREMATORIO:             ["En traslado a crematorio", "crematorio"],
  EN_CREMATORIO:                        ["En crematorio", "crematorio"],
  CREMADO:                              ["Cremado", "crematorio"],
  PENDIENTE_RETIRAR_CENIZAS_CREMATORIO: ["Retirar cenizas del crematorio", "crematorio"],
  PENDIENTE_ARMAR_CAJA_HOMENAJE:        ["Armar caja homenaje", "entrega"],
  PENDIENTE_COORDINAR_ENTREGA:          ["Coordinar entrega", "entrega"],
  ENTREGA_PROGRAMADA_CAJA_HOMENAJE:     ["Entrega programada", "entrega"],
  EN_ENTREGA_CAJA_HOMENAJE:             ["En entrega", "entrega"],
  ENTREGADO_CAJA_HOMENAJE:              ["Entregado", "entrega"],
  ENVIAR_CERTIFICADO:                   ["Enviar certificado digital", "cierre"],
  PENDIENTE_LLAMADA_POSTVENTA:          ["Llamada postventa", "cierre"],
  INCIDENCIA_A_RESPONDER:               ["Incidencia a responder", "alerta"],
  CANCELADO:                            ["Cancelado", "alerta"],
  CERRADO:                              ["Cerrado", "cierre"]
};

function estadoDe(p) {
  return String((p && p.ESTADO_LOGISTICO) || "").trim().toUpperCase();
}

function etiquetaEstado(estado) {
  const e = String(estado || "").trim().toUpperCase();
  if (ESTADOS_INFO[e]) return ESTADOS_INFO[e][0];
  if (!e) return "Sin estado";
  const t = e.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function grupoEstado(estado) {
  const e = String(estado || "").trim().toUpperCase();
  return ESTADOS_INFO[e] ? ESTADOS_INFO[e][1] : "inicio";
}

function chipEstado(estado) {
  return `<span class="chip-estado grupo-${grupoEstado(estado)}">${ui.esc(etiquetaEstado(estado))}</span>`;
}

/* =====================================================================
 *  ADMINISTRADOR: menú, buscador y vistas
 * ===================================================================== */

let firmaMetricas = "";

function esFinalizado(p) {
  return ["CERRADO", "CANCELADO"].includes(estadoDe(p));
}

function pintarAdmin(pedidos, forzar) {
  asegurarBuscador();

  const seccion = document.querySelector(".section-title");
  const barra = document.getElementById("barraBusqueda");

  if (vistaAdministradorActual === "METRICAS") {
    if (seccion) seccion.classList.add("oculto");
    if (barra) barra.classList.add("oculto");
    const firma = pedidos.length + "|" + pedidos.map(p => p.ID_PEDIDO + estadoDe(p)).join(",");
    if (forzar || firma !== firmaMetricas) {
      firmaMetricas = firma;
      renderMetricas(pedidos);
    }
    ponerMenuAdmin();
    return;
  }

  firmaMetricas = "";
  if (seccion) seccion.classList.remove("oculto");
  if (barra) barra.classList.remove("oculto");

  renderDashboard(pedidos);

  const texto = textoBusqueda();
  if (texto) {
    renderResultadosBusqueda(pedidos, texto);
  } else {
    renderKanban(
      vistaAdministradorActual === "FINALIZADOS"
        ? pedidos.filter(esFinalizado)
        : pedidos.filter(p => !esFinalizado(p))
    );
  }

  ponerMenuAdmin();
}

function ponerMenuAdmin() {
  const dash = document.getElementById("dashboard");
  const viejo = dash.querySelector(".menu-admin");
  if (viejo) viejo.remove();

  const b = (vista, texto) =>
    `<button class="${vistaAdministradorActual === vista ? "activo" : ""}" onclick="cambiarVistaAdministrador('${vista}')">${texto}</button>`;

  dash.insertAdjacentHTML("afterbegin", `
    <div class="acciones menu-admin menu-pestanas">
      ${b("ACTIVOS", "Pedidos activos")}
      ${b("FINALIZADOS", "Finalizados")}
      ${b("METRICAS", "📊 Métricas")}
    </div>`);
}

/* ---------- Buscador ---------- */

function asegurarBuscador() {
  if (document.getElementById("barraBusqueda")) return;
  const seccion = document.querySelector(".section-title");
  if (!seccion) return;

  seccion.insertAdjacentHTML("afterend", `
    <div id="barraBusqueda" class="barra-busqueda">
      <span class="lupa">🔍</span>
      <input id="buscador" type="search" autocomplete="off"
        placeholder="Buscar por mascota, tutor, teléfono, DNI, ID o veterinaria">
      <button type="button" id="limpiarBusqueda" class="oculto" aria-label="Limpiar">✕</button>
    </div>`);

  let timer = null;
  const input = document.getElementById("buscador");
  const limpiar = document.getElementById("limpiarBusqueda");

  input.addEventListener("input", () => {
    limpiar.classList.toggle("oculto", !input.value);
    clearTimeout(timer);
    timer = setTimeout(() => pintarAdmin(pedidosGlobal, true), 180);
  });

  limpiar.addEventListener("click", () => {
    input.value = "";
    limpiar.classList.add("oculto");
    pintarAdmin(pedidosGlobal, true);
    input.focus();
  });
}

function normalizarTexto(v) {
  return String(v == null ? "" : v)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function textoBusqueda() {
  const el = document.getElementById("buscador");
  return el ? normalizarTexto(el.value).trim() : "";
}

function renderResultadosBusqueda(pedidos, texto) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const soloDigitos = texto.replace(/\D/g, "");

  const campos = [
    "ID_PEDIDO", "NOMBRE_MASCOTA", "DUENO_NOMBRE_APELLIDO", "TELEFONO", "MAIL", "DNI",
    "VETERINARIA", "VETERINARIA_DE_RETIRO", "ENTREGA_VETERINARIA", "RETIRO_CALLE_NUMERO",
    "ENTREGA_DIRECCION", "RETIRO_CIUDAD", "RETIRO_BARRIO", "PLAN", "RAZA"
  ];

  const encontrados = pedidos.filter(p => {
    const texto = normalizarTexto(campos.map(c => p[c]).join(" "));
    const coincideTexto = palabras.every(w => texto.includes(w));
    const coincideTelefono = soloDigitos.length >= 4 &&
      (String(p.TELEFONO || "").replace(/\D/g, "").includes(soloDigitos) ||
       String(p.DNI || "").replace(/\D/g, "").includes(soloDigitos));
    return coincideTexto || coincideTelefono;
  });

  // Activos primero
  encontrados.sort((a, b) => Number(esFinalizado(a)) - Number(esFinalizado(b)));

  document.getElementById("kanban").innerHTML = `
    <div class="resultados">
      <div class="resultados-titulo">${encontrados.length} resultado${encontrados.length === 1 ? "" : "s"}</div>
      ${encontrados.length ? `
        <div class="grid-resultados">
          ${encontrados.slice(0, 60).map(p => `
            <div class="resultado">
              ${chipEstado(p.ESTADO_LOGISTICO)}
              ${renderPedido(p)}
            </div>`).join("")}
        </div>` : `<p class="vacio">No encontramos pedidos con “${ui.esc(texto)}”.</p>`}
    </div>`;
}

/* ---------- Cambio de vista ---------- */

cambiarVistaAdministrador = function (vista) {
  vistaAdministradorActual = vista;
  if (pedidosGlobal && pedidosGlobal.length && usuarioActual && usuarioActual.tipo !== "TRANSPORTISTA") {
    pintarAdmin(pedidosGlobal, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  cargarPedidos();
};

/* =====================================================================
 *  DETALLE DEL PEDIDO: contacto + historial
 * ===================================================================== */

function telefonoWhatsapp(tel) {
  let d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);
  return "549" + d;
}

function urlMapa(partes) {
  const q = partes.map(v => String(v || "").trim()).filter(Boolean);
  if (!q.length) return "";
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q.concat("Argentina").join(", "));
}

function direccionRetiro(p) {
  return [p.RETIRO_CALLE_NUMERO, p.RETIRO_BARRIO, p.RETIRO_CIUDAD, p.RETIRO_PROVINCIA];
}

function direccionEntrega(p) {
  return [p.ENTREGA_DIRECCION, p.ENTREGA_BARRIO, p.ENTREGA_CIUDAD, "Córdoba"];
}

function botonesContacto(p) {
  const tel = String(p.TELEFONO || "").trim();
  const wa = telefonoWhatsapp(tel);
  const mapaRetiro = String(p.RETIRO_CALLE_NUMERO || "").trim() ? urlMapa(direccionRetiro(p)) : "";
  const mapaEntrega = String(p.ENTREGA_DIRECCION || "").trim() ? urlMapa(direccionEntrega(p)) : "";
  const mismo = mapaRetiro && mapaRetiro === mapaEntrega;
  const mensaje = encodeURIComponent("Hola, te escribimos de Somos Uno por " + (p.NOMBRE_MASCOTA || "tu compañero") + ". ");

  const btns = [];
  if (tel) btns.push(`<a class="btn-contacto" href="tel:${ui.esc(tel.replace(/[^\d+]/g, ""))}">📞 Llamar</a>`);
  if (wa) btns.push(`<a class="btn-contacto wa" href="https://wa.me/${wa}?text=${mensaje}" target="_blank" rel="noopener">💬 WhatsApp</a>`);
  if (mapaRetiro) btns.push(`<a class="btn-contacto" href="${mapaRetiro}" target="_blank" rel="noopener">📍 ${mismo ? "Domicilio" : "Retiro"}</a>`);
  if (mapaEntrega && !mismo) btns.push(`<a class="btn-contacto" href="${mapaEntrega}" target="_blank" rel="noopener">📍 Entrega</a>`);

  if (!btns.length) return "";
  return `<div class="contacto">
    ${p.DUENO_NOMBRE_APELLIDO ? `<div class="contacto-nombre">${ui.esc(p.DUENO_NOMBRE_APELLIDO)}${tel ? " · " + ui.esc(tel) : ""}</div>` : ""}
    <div class="contacto-botones">${btns.join("")}</div>
  </div>`;
}

const cacheHistorial = {};

function firmaPedido(p) {
  return JSON.stringify(p);
}

async function cargarHistorial(idPedido, pedido) {
  const cont = document.getElementById("historialPedido");
  if (!cont) return;

  const firma = firmaPedido(pedido);
  const enCache = cacheHistorial[idPedido];
  let items;

  if (enCache && enCache.firma === firma && Date.now() - enCache.t < 120000) {
    items = enCache.items;
  } else {
    try {
      items = await llamarApi("obtenerLogPedido", [idPedido]);
      cacheHistorial[idPedido] = { firma, items, t: Date.now() };
    } catch (e) {
      cont.innerHTML = `<p class="vacio">No se pudo cargar el historial.</p>`;
      return;
    }
  }

  const actual = document.getElementById("historialPedido");
  if (!actual) return;

  if (!items || !items.length) {
    actual.innerHTML = `<p class="vacio">Todavía no hay movimientos registrados.</p>`;
    return;
  }

  actual.innerHTML = `<div class="historial">
    ${items.map(it => `
      <div class="hist-item">
        <div class="hist-punto"></div>
        <div class="hist-cuerpo">
          <div class="hist-cab">
            <strong>${ui.esc(textoAccion(it.accion))}</strong>
            <span>${ui.esc(formatearFechaLog(it.fecha))}</span>
          </div>
          <div class="hist-detalle">${ui.esc(embellecerEstados(it.detalle))}</div>
          ${it.usuario && it.usuario !== "Sistema" ? `<div class="hist-usuario">👤 ${ui.esc(it.usuario)}</div>` : ""}
        </div>
      </div>`).join("")}
  </div>`;
}

function textoAccion(a) {
  const mapa = {
    AUTORIZACION_PEDIDO: "Autorización",
    VERIFICACION_PAGO: "Pago",
    EDICION_DATO: "Dato editado",
    ASIGNACION_TRANSPORTISTA: "Transportista asignado",
    REASIGNACION_TRANSPORTISTA: "Transportista reasignado",
    SIGUIENTE_ESTADO_LOGISTICO: "Avance de estado",
    VOLVER_ESTADO_ANTERIOR: "Vuelta de estado",
    MIGRACION_ESTADO: "Ajuste de estado"
  };
  const k = String(a || "").trim().toUpperCase();
  if (mapa[k]) return mapa[k];
  const t = k.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function embellecerEstados(texto) {
  return String(texto || "").replace(/\b[A-Z][A-Z_]{4,}\b/g, m => ESTADOS_INFO[m] ? ESTADOS_INFO[m][0] : m);
}

function formatearFechaLog(v) {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d)) {
      return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
  }
  return s;
}

const verPedidoOriginal = verPedido;

verPedido = function (idPedido) {
  verPedidoOriginal(idPedido);

  try {
    const panel = document.getElementById("detallePedido");
    const pedido = (pedidosGlobal || []).find(p => p.ID_PEDIDO == idPedido);
    if (!panel || !pedido || panel.classList.contains("oculto")) return;

    const h2 = panel.querySelector("h2");
    if (h2 && !panel.querySelector(".contacto")) {
      h2.insertAdjacentHTML("afterend", botonesContacto(pedido));
    }

    const esAdmin = usuarioActual && String(usuarioActual.tipo).toUpperCase() === "ADMINISTRADOR";
    if (esAdmin && !document.getElementById("historialPedido")) {
      panel.insertAdjacentHTML("beforeend", `
        <div class="bloque bloque-historial">
          <h3>Historial</h3>
          <div id="historialPedido"><p class="vacio">Cargando historial…</p></div>
        </div>`);
      cargarHistorial(idPedido, pedido);
    }
  } catch (e) {
    console.error(e);
  }
};

/* =====================================================================
 *  TRANSPORTISTA: vista "Hoy"
 * ===================================================================== */

vistaTransportistaActual = "HOY";

const renderVistaTransportistaOriginal = renderVistaTransportista;

renderVistaTransportista = function (tareas) {
  if (vistaTransportistaActual === "HOY") {
    renderHoyTransportista(tareas || []);
  } else {
    renderVistaTransportistaOriginal(tareas);
  }
  ponerMenuTransportista();
};

function ponerMenuTransportista() {
  const b = (vista, texto) =>
    `<button class="${vistaTransportistaActual === vista ? "activo" : ""}" onclick="cambiarVistaTransportista('${vista}')">${texto}</button>`;
  document.getElementById("dashboard").innerHTML = `
    <div class="acciones menu-pestanas">
      ${b("HOY", "📅 Hoy")}
      ${b("ACTIVAS", "Mis tareas")}
      ${b("FINALIZADAS", "Finalizadas")}
    </div>`;
}

function tareasDelTransportista(p, mail) {
  const e = estadoDe(p);
  const es = campo => String(p[campo] || "").trim().toLowerCase() === mail;
  const lista = [];

  if (es("RETIRO_TRANSPORTISTA") && ["PENDIENTE_CONFIRMAR", "PENDIENTE_COORDINAR_RETIRO", "RETIRO_PROGRAMADO", "EN_RETIRO"].includes(e)) {
    lista.push({ etapa: "Retiro", fecha: p.RETIRO_FECHA_PROGRAMADA, dir: direccionRetiro(p), asignacion: p.RETIRO_ESTADO_ASIGNACION });
  }
  if (es("TRASLADO_CREMATORIO_TRANSPORTISTA") && ["EN_BASE", "PENDIENTE_ENVIO_CREMATORIO", "EN_TRASLADO_A_CREMATORIO"].includes(e)) {
    lista.push({ etapa: "Traslado a crematorio", fecha: p.FECHA_ENVIO_CREMATORIO_PROGRAMADA, dir: null, asignacion: p.TRASLADO_ESTADO_ASIGNACION });
  }
  if (es("DEVOLUCION_CENIZA_TRANSPORTISTA") && ["CREMADO", "PENDIENTE_RETIRAR_CENIZAS_CREMATORIO"].includes(e)) {
    lista.push({ etapa: "Retiro de cenizas", fecha: "", dir: null, asignacion: p.DEVOLUCION_ESTADO_ASIGNACION });
  }
  if (es("ENTREGA_TRANSPORTISTA") && ["PENDIENTE_COORDINAR_ENTREGA", "ENTREGA_PROGRAMADA_CAJA_HOMENAJE", "EN_ENTREGA_CAJA_HOMENAJE"].includes(e)) {
    lista.push({ etapa: "Entrega", fecha: p.ENTREGA_FECHA_PROGRAMADA, dir: direccionEntrega(p), asignacion: p.ENTREGA_ESTADO_ASIGNACION });
  }

  return lista
    .filter(t => String(t.asignacion || "").toUpperCase() !== "RECHAZADA")
    .map(t => Object.assign(t, { p, d: convertirFechaPedido(t.fecha), conHora: /\d{1,2}:\d{2}/.test(String(t.fecha || "")) }));
}

function renderHoyTransportista(tareas) {
  const mail = String(usuarioActual.mail || "").trim().toLowerCase();
  const todas = [];
  tareas.forEach(p => todas.push(...tareasDelTransportista(p, mail)));

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);

  const atrasadas = todas.filter(t => t.d && t.d < hoy);
  const deHoy = todas.filter(t => t.d && t.d >= hoy && t.d < manana);
  const sinFecha = todas.filter(t => !t.d);
  const proximas = todas.filter(t => t.d && t.d >= manana);

  const porHora = (a, b) => (a.d || 0) - (b.d || 0);
  [atrasadas, deHoy, proximas].forEach(l => l.sort(porHora));

  const fechaHoy = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  document.querySelector(".section-title h2").innerHTML = "Hoy · " + fechaHoy;

  const seccion = (titulo, lista, clase) => !lista.length ? "" : `
    <div class="hoy-seccion ${clase || ""}">
      <div class="hoy-titulo">${titulo} <span>${lista.length}</span></div>
      ${lista.map(tarjetaHoy).join("")}
    </div>`;

  const html =
    seccion("⚠️ Atrasadas", atrasadas, "atrasadas") +
    seccion("Para hoy", deHoy) +
    seccion("Sin fecha asignada", sinFecha) +
    seccion("Próximos días", proximas, "proximas");

  document.getElementById("kanban").innerHTML = `<div class="hoy">${html || `
    <div class="hoy-vacio">
      <div class="hoy-vacio-icono">🤍</div>
      <p>No tenés tareas pendientes por ahora.</p>
    </div>`}</div>`;
}

function tarjetaHoy(t) {
  const p = t.p;
  const id = String(p.ID_PEDIDO || "").replace(/'/g, "\\'");
  const hora = t.d && t.conHora ? t.d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  const dia = t.d ? t.d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" }) : "";
  const mapa = t.dir ? urlMapa(t.dir) : "";
  const direccion = t.dir ? t.dir.filter(v => String(v || "").trim()).slice(0, 3).join(", ") : "";
  const tel = String(p.TELEFONO || "").trim();
  const aceptada = String(t.asignacion || "").toUpperCase() === "ACEPTADA";

  return `
    <div class="tarea-hoy">
      <div class="tarea-hora">
        <div class="tarea-hora-num">${hora || (t.d ? "—" : "")}</div>
        <div class="tarea-hora-dia">${dia}</div>
      </div>
      <div class="tarea-cuerpo">
        <div class="tarea-etapa">${ui.esc(t.etapa)} ${aceptada ? "" : `<span class="tarea-pend">Falta aceptar</span>`}</div>
        <div class="tarea-mascota">${ui.esc(p.NOMBRE_MASCOTA || "Sin nombre")} <small>${ui.esc(p.ID_PEDIDO || "")}</small></div>
        ${direccion ? `<div class="tarea-dir">📍 ${ui.esc(direccion)}</div>` : ""}
        <div class="tarea-botones">
          <button onclick="verPedido('${id}')">Ver detalle</button>
          ${mapa ? `<a class="btn-contacto" href="${mapa}" target="_blank" rel="noopener">Cómo llegar</a>` : ""}
          ${tel && t.dir ? `<a class="btn-contacto" href="tel:${ui.esc(tel.replace(/[^\d+]/g, ""))}">📞</a>` : ""}
        </div>
      </div>
    </div>`;
}
