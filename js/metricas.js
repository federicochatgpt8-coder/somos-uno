/**
 * Somos Uno – sección de Métricas (solo administradores).
 * Semana, mes, año e histórico, calculados con los pedidos ya cargados.
 *
 * Criterios:
 *  - "Ingresados": pedidos con FECHA_CARGA dentro del período.
 *  - Planes, pagos, veterinarias, facturación y tiempos: sobre los ingresados no cancelados.
 *  - "Viajes": por fecha real de cada tramo (retiro, traslado, cenizas, entrega) dentro del período.
 *  - Comparación: contra el mismo tramo del período anterior (ej.: lunes a hoy de la semana pasada).
 */

let transportistasNombres = null;

async function nombresTransportistas() {
  if (transportistasNombres) return transportistasNombres;
  try {
    const lista = await llamarApi("obtenerTransportistas", []);
    transportistasNombres = {};
    lista.forEach(t => { transportistasNombres[String(t.mail).trim().toLowerCase()] = t.nombre; });
  } catch (e) {
    transportistasNombres = {};
  }
  return transportistasNombres;
}

/* ---------------- Cálculo ---------------- */

function numeroMonto(v) {
  const s = String(v == null ? "" : v).replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  // 236.700 / 236.700,50 → formato argentino
  const n = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/[.,](?=\d{3}(\D|$))/g, "");
  const r = Number(n);
  return isNaN(r) ? 0 : r;
}

function contar(lista, fn) {
  const m = new Map();
  lista.forEach(x => {
    const k = fn(x);
    if (k === null || k === undefined) return;
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function dias(a, b) {
  return (b - a) / 86400000;
}

function promedio(nums) {
  const v = nums.filter(n => isFinite(n) && n >= 0);
  return v.length ? v.reduce((s, n) => s + n, 0) / v.length : null;
}

function enRango(d, desde, hasta) {
  return d && (!desde || d >= desde) && d < hasta;
}

function calcularMetricas(pedidos, desde, hasta) {
  const ingresados = pedidos.filter(p => enRango(convertirFechaPedido(p.FECHA_CARGA), desde, hasta));
  const cancelados = ingresados.filter(p => estadoDe(p) === "CANCELADO");
  const validos = ingresados.filter(p => estadoDe(p) !== "CANCELADO");
  const cerrados = validos.filter(p => estadoDe(p) === "CERRADO");
  const facturacion = validos.reduce((s, p) => s + numeroMonto(p.MONTO), 0);

  // Veterinarias (misma regla que COMISIONES: si hay veterinaria de retiro, cuenta como retiro;
  // si no, como recomendación). Los nombres se unifican con veterinarias.js.
  const agrupar = textos => {
    const m = new Map();
    textos.forEach(t => {
      const r = resolverVet(t);
      if (!r) return;
      const g = m.get(r.grupo) || { nombre: r.nombre, n: 0, pendiente: r.estado === "pendiente" };
      g.n++;
      m.set(r.grupo, g);
    });
    return [...m.values()].sort((a, b) => b.n - a.n).map(g => [g.nombre + (g.pendiente ? " ⚠️" : ""), g.n]);
  };
  const conVetRetiro = validos.filter(p => String(p.VETERINARIA || "").trim());
  const conRecomendacion = validos.filter(p => !String(p.VETERINARIA || "").trim() && String(p.DETALLE_VETERINARIA_RECOMENDO || "").trim());

  const t = campo => p => convertirFechaPedido(p[campo]);
  const tiempo = (desdeFn, hastaFn) => promedio(validos.map(p => {
    const a = desdeFn(p), b = hastaFn(p);
    return a && b ? dias(a, b) : NaN;
  }));

  // Viajes por fecha real del tramo
  const tramos = [
    ["RETIRO_FECHA_REAL", "RETIRO_TRANSPORTISTA", "Retiros"],
    ["FECHA_ENVIO_CREMATORIO_REAL", "TRASLADO_CREMATORIO_TRANSPORTISTA", "Traslados"],
    ["FECHA_RETIRO_CENIZAS_CREMATORIO_REAL", "DEVOLUCION_CENIZA_TRANSPORTISTA", "Cenizas"],
    ["ENTREGA_FECHA_REAL", "ENTREGA_TRANSPORTISTA", "Entregas"]
  ];
  const viajes = {};
  let totalViajes = 0;
  pedidos.forEach(p => {
    tramos.forEach(([fecha, transp, tipo]) => {
      if (!enRango(convertirFechaPedido(p[fecha]), desde, hasta)) return;
      const mail = String(p[transp] || "").trim().toLowerCase() || "(sin asignar)";
      viajes[mail] = viajes[mail] || { Retiros: 0, Traslados: 0, Cenizas: 0, Entregas: 0, total: 0 };
      viajes[mail][tipo]++;
      viajes[mail].total++;
      totalViajes++;
    });
  });

  return {
    ingresados: ingresados.length,
    cancelados: cancelados.length,
    validos: validos.length,
    cerrados: cerrados.length,
    enCurso: validos.length - cerrados.length,
    facturacion,
    ticket: validos.length ? facturacion / validos.length : 0,
    planes: contar(validos, p => String(p.PLAN || "").trim() || "Sin plan"),
    pagos: contar(validos, p => String(p.FORMA_PAGO || "").trim() || "Sin dato"),
    retiro: contar(validos, p => String(p.RETIRO_PUNTO || "").trim() || "Sin dato"),
    vetsRetiro: agrupar(conVetRetiro.map(p => p.VETERINARIA)),
    vetsRecomienda: agrupar(conRecomendacion.map(p => p.DETALLE_VETERINARIA_RECOMENDO)),
    particulares: validos.length - conVetRetiro.length - conRecomendacion.length,
    tiempos: {
      retiro: tiempo(t("FECHA_CARGA"), t("RETIRO_FECHA_REAL")),
      cremacion: tiempo(t("RETIRO_FECHA_REAL"), t("FECHA_CREMACION_REAL")),
      entrega: tiempo(t("FECHA_CREMACION_REAL"), t("ENTREGA_FECHA_REAL")),
      total: tiempo(t("FECHA_CARGA"), t("ENTREGA_FECHA_REAL"))
    },
    viajes: Object.entries(viajes).sort((a, b) => b[1].total - a[1].total),
    totalViajes
  };
}

function periodos(ahora) {
  const hoy0 = new Date(ahora); hoy0.setHours(0, 0, 0, 0);
  const lunes = new Date(hoy0); lunes.setDate(hoy0.getDate() - ((hoy0.getDay() + 6) % 7));
  const mes = new Date(hoy0.getFullYear(), hoy0.getMonth(), 1);
  const anio = new Date(hoy0.getFullYear(), 0, 1);
  const fin = new Date(ahora.getTime() + 1);

  const anterior = (desde, restar) => {
    const d = restar(new Date(desde));
    const h = restar(new Date(fin));
    return [d, h];
  };

  const fmt = d => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

  return [
    { id: "semana", titulo: "Semana", sub: fmt(lunes) + " al " + fmt(hoy0), desde: lunes, hasta: fin,
      prev: anterior(lunes, d => { d.setDate(d.getDate() - 7); return d; }), prevTxt: "misma altura de la semana pasada" },
    { id: "mes", titulo: "Mes", sub: mayuscula(hoy0.toLocaleDateString("es-AR", { month: "long", year: "numeric" })), desde: mes, hasta: fin,
      prev: anterior(mes, d => { d.setMonth(d.getMonth() - 1); return d; }), prevTxt: "misma altura del mes pasado" },
    { id: "anio", titulo: "Año", sub: String(hoy0.getFullYear()), desde: anio, hasta: fin,
      prev: anterior(anio, d => { d.setFullYear(d.getFullYear() - 1); return d; }), prevTxt: "misma altura del año pasado" },
    { id: "historico", titulo: "Histórico", sub: "Desde el primer pedido", desde: null, hasta: fin, prev: null }
  ];
}

/* ---------------- Presentación ---------------- */

const mayuscula = t => String(t).charAt(0).toUpperCase() + String(t).slice(1);

const fmtPesos = n => "$ " + Math.round(n).toLocaleString("es-AR");
const fmtNum = n => Math.round(n).toLocaleString("es-AR");
const fmtDias = n => n === null ? "—" : (n < 1 ? "< 1 día" : n.toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " días");

function variacion(actual, anterior) {
  if (anterior === null || anterior === undefined) return "";
  if (!anterior && !actual) return `<span class="var neutra">= sin cambios</span>`;
  if (!anterior) return `<span class="var neutra">sin datos del período anterior</span>`;
  const pct = Math.round((actual - anterior) / anterior * 100);
  if (pct === 0) return `<span class="var neutra">= igual</span>`;
  return `<span class="var ${pct > 0 ? "sube" : "baja"}">${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%</span>`;
}

function tile(titulo, valor, extra, ayuda) {
  return `<div class="m-tile" ${ayuda ? `title="${ui.esc(ayuda)}"` : ""}>
    <div class="m-tile-titulo">${titulo}</div>
    <div class="m-tile-valor">${valor}</div>
    ${extra ? `<div class="m-tile-extra">${extra}</div>` : ""}
  </div>`;
}

function barras(titulo, pares, opciones = {}) {
  const total = pares.reduce((s, [, n]) => s + n, 0);
  const max = Math.max(1, ...pares.map(([, n]) => n));
  const lim = opciones.limite || 6;
  let filas = pares.slice(0, lim);
  if (pares.length > lim) {
    const resto = pares.slice(lim).reduce((s, [, n]) => s + n, 0);
    filas = filas.concat([["Otras (" + (pares.length - lim) + ")", resto]]);
  }
  return `<div class="m-card">
    <div class="m-card-titulo">${titulo}</div>
    ${!total ? `<p class="vacio">Sin datos en este período.</p>` : filas.map(([nombre, n]) => {
      const pct = total ? Math.round(n / total * 100) : 0;
      return `<div class="m-barra" title="${ui.esc(nombre)}: ${n} (${pct}%)">
        <div class="m-barra-cab"><span>${ui.esc(nombre)}</span><strong>${n} <small>${pct}%</small></strong></div>
        <div class="m-barra-pista"><div class="m-barra-valor" style="width:${Math.max(2, n / max * 100)}%"></div></div>
      </div>`;
    }).join("")}
    ${opciones.pie ? `<div class="m-pie">${ui.esc(opciones.pie)}</div>` : ""}
  </div>`;
}

function tablaViajes(m, nombres) {
  if (!m.viajes.length) {
    return `<div class="m-card"><div class="m-card-titulo">Viajes por transportista</div><p class="vacio">Sin viajes en este período.</p></div>`;
  }
  return `<div class="m-card m-card-ancha">
    <div class="m-card-titulo">Viajes por transportista <small>${m.totalViajes} en total</small></div>
    <div class="m-tabla-scroll">
      <table class="m-tabla">
        <thead><tr><th>Transportista</th><th>Retiros</th><th>Traslados</th><th>Cenizas</th><th>Entregas</th><th>Total</th></tr></thead>
        <tbody>
          ${m.viajes.map(([mail, v]) => `<tr>
            <td>${ui.esc(nombres[mail] || mail)}</td>
            <td>${v.Retiros}</td><td>${v.Traslados}</td><td>${v.Cenizas}</td><td>${v.Entregas}</td>
            <td><strong>${v.total}</strong></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}

function seccionPeriodo(per, pedidos, nombres) {
  const m = calcularMetricas(pedidos, per.desde, per.hasta);
  const a = per.prev ? calcularMetricas(pedidos, per.prev[0], per.prev[1]) : null;
  const vs = (k) => {
    if (!a) return "";
    if (!a[k]) return variacion(m[k], a[k]);
    return variacion(m[k], a[k]) + `<span class="var-txt">vs ${per.prevTxt} (${k === "facturacion" ? fmtPesos(a[k]) : fmtNum(a[k])})</span>`;
  };

  return `<section class="m-seccion" id="m-${per.id}">
    <div class="m-seccion-cab">
      <h2>${per.titulo}</h2>
      <span>${ui.esc(per.sub)}</span>
    </div>

    <div class="m-tiles">
      ${tile("Pedidos ingresados", fmtNum(m.validos), vs("validos"), "Pedidos cargados en el período, sin contar cancelados")}
      ${tile("En curso", fmtNum(m.enCurso), "de los ingresados en el período")}
      ${tile("Finalizados", fmtNum(m.cerrados), "de los ingresados en el período")}
      ${tile("Cancelados", fmtNum(m.cancelados))}
      ${tile("Facturación", fmtPesos(m.facturacion), vs("facturacion"), "Suma de MONTO de los ingresados no cancelados")}
      ${tile("Ticket promedio", m.validos ? fmtPesos(m.ticket) : "—")}
    </div>

    <div class="m-grid">
      ${barras("Planes", m.planes)}
      ${barras("Retiros en veterinaria", m.vetsRetiro, { limite: 6, pie: m.particulares + " pedidos sin veterinaria (particulares)" })}
      ${barras("Recomendaciones de veterinarias", m.vetsRecomienda, { limite: 6 })}
      ${barras("Forma de pago", m.pagos)}
      ${barras("Lugar de retiro", m.retiro)}
    </div>

    <div class="m-fila2">
      <div class="m-card">
        <div class="m-card-titulo">Tiempos promedio</div>
        <div class="m-tiempos">
          <div><span>Ingreso → retiro</span><strong>${fmtDias(m.tiempos.retiro)}</strong></div>
          <div><span>Retiro → cremación</span><strong>${fmtDias(m.tiempos.cremacion)}</strong></div>
          <div><span>Cremación → entrega</span><strong>${fmtDias(m.tiempos.entrega)}</strong></div>
          <div class="total"><span>Total ingreso → entrega</span><strong>${fmtDias(m.tiempos.total)}</strong></div>
        </div>
      </div>
      ${tablaViajes(m, nombres)}
    </div>
  </section>`;
}

function seccionAhora(pedidos) {
  const activos = pedidos.filter(p => !esFinalizado(p));
  const porGrupo = g => activos.filter(p => grupoEstado(estadoDe(p)) === g).length;
  const pagosPend = activos.filter(p => String(p.VERIFICACION_PAGO || "").toUpperCase().startsWith("PENDIENTE")).length;
  const incid = activos.filter(p => estadoDe(p) === "INCIDENCIA_A_RESPONDER").length;

  return `<section class="m-seccion m-ahora">
    <div class="m-seccion-cab"><h2>Ahora</h2><span>Situación actual de los pedidos activos</span></div>
    <div class="m-tiles">
      ${tile("Pedidos activos", fmtNum(activos.length))}
      ${tile("Por retirar", fmtNum(porGrupo("inicio") + porGrupo("retiro")), "coordinar, programados, en retiro, en base")}
      ${tile("En crematorio", fmtNum(porGrupo("crematorio")))}
      ${tile("Por entregar", fmtNum(porGrupo("entrega")))}
      ${tile("Cierre / postventa", fmtNum(porGrupo("cierre")))}
      ${tile("Pagos pendientes", fmtNum(pagosPend), incid ? `<span class="var baja">${incid} incidencia${incid > 1 ? "s" : ""} abierta${incid > 1 ? "s" : ""}</span>` : "")}
    </div>
  </section>`;
}

async function renderMetricas(pedidos) {
  const dash = document.getElementById("dashboard");
  const kanban = document.getElementById("kanban");
  const pers = periodos(new Date());
  const nombres = await nombresTransportistas();
  await cargarVets();

  if (vistaAdministradorActual !== "METRICAS") return;

  kanban.innerHTML = "";
  dash.innerHTML = `
    <div class="metricas">
      <nav class="m-nav">
        <a href="#m-ahora" onclick="irAMetrica(event,'m-ahora')">Ahora</a>
        ${pers.map(p => `<a href="#m-${p.id}" onclick="irAMetrica(event,'m-${p.id}')">${p.titulo}</a>`).join("")}
      </nav>
      <div id="m-ahora">${seccionAhora(pedidos)}</div>
      ${htmlRevisionVets(pedidos)}
      ${pers.map(p => seccionPeriodo(p, pedidos, nombres)).join("")}
      <p class="m-nota">Ingresados = pedidos cargados en el período (sin cancelados). Viajes = tramos con fecha real dentro del período. Las comparaciones son contra el mismo tramo del período anterior.</p>
    </div>`;
  ponerMenuAdmin();
}

function irAMetrica(ev, id) {
  ev.preventDefault();
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
}
