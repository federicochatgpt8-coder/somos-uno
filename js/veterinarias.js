/**
 * Somos Uno – unificación de nombres de veterinarias (solo para métricas).
 *
 * Reglas (nunca adivina):
 *  1. Se comparan los nombres sin mayúsculas, tildes, signos ni palabras genéricas
 *     ("veterinaria", "clínica", "sanatorio", "SA"...). Si quedan IDÉNTICOS, son la misma.
 *  2. Si una persona confirmó una equivalencia (pestaña veterinarias_alias), se usa esa.
 *  3. Todo lo demás queda "por revisar" con sugerencias, hasta que alguien decida.
 */

const PALABRAS_GENERICAS_VET = new Set([
  "veterinaria", "veterinarias", "veterinario", "veterinarios", "vet",
  "clinica", "sanatorio", "centro", "instituto", "medico", "hospital", "consultorio",
  "sa", "srl", "de", "del", "la", "el", "los", "las", "y"
]);

let datosVets = null; // { oficiales, alias, ok }

function claveVet(texto) {
  const base = String(texto || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
  if (!base) return "";
  const sinGenericas = base.split(" ").filter(w => w && !PALABRAS_GENERICAS_VET.has(w)).join(" ");
  return sinGenericas || base;
}

async function cargarVets(forzar) {
  if (datosVets && !forzar) return datosVets;
  try {
    const r = await llamarApi("obtenerVeterinariasYAlias", []);
    datosVets = { oficiales: r.oficiales || [], alias: r.alias || [], ok: true };
  } catch (e) {
    datosVets = { oficiales: [], alias: [], ok: false, error: e.message };
  }
  datosVets.porClaveOficial = {};
  datosVets.oficiales.forEach(o => {
    const k = claveVet(o.nombre);
    if (k && !datosVets.porClaveOficial[k]) datosVets.porClaveOficial[k] = o;
  });
  datosVets.porClaveAlias = {};
  datosVets.alias.forEach(a => { datosVets.porClaveAlias[a.clave] = a; });
  datosVets.porId = {};
  datosVets.oficiales.forEach(o => { datosVets.porId[o.id] = o; });
  return datosVets;
}

/** Devuelve { grupo, nombre, estado } para un texto escrito por el cliente. */
function resolverVet(texto) {
  const k = claveVet(texto);
  if (!k) return null;
  const d = datosVets || { porClaveOficial: {}, porClaveAlias: {}, porId: {} };

  const alias = d.porClaveAlias[k];
  if (alias) {
    const of = alias.id && d.porId[alias.id];
    if (of) return { grupo: "id:" + of.id, nombre: of.nombre, estado: "confirmada", clave: k };
    // Se había marcado como "distinta", pero después se sumó como aliada con el mismo nombre
    // (mismas letras): se cuenta automáticamente con la aliada.
    const ahoraAliada = d.porClaveOficial[claveVet(alias.nombre)] || d.porClaveOficial[k];
    if (ahoraAliada) return { grupo: "id:" + ahoraAliada.id, nombre: ahoraAliada.nombre, estado: "confirmada", clave: k };
    return { grupo: "n:" + claveVet(alias.nombre), nombre: alias.nombre, estado: "confirmada", clave: k };
  }

  const of = d.porClaveOficial[k];
  if (of) return { grupo: "id:" + of.id, nombre: of.nombre, estado: "oficial", clave: k };

  return { grupo: "k:" + k, nombre: String(texto).replace(/\s+/g, " ").trim(), estado: "pendiente", clave: k };
}

/* ---------------- Similitud (solo para sugerir, nunca para unir solo) ---------------- */

function distanciaLev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function parecido(a, b) {
  if (!a || !b) return 0;
  const lev = 1 - distanciaLev(a, b) / Math.max(a.length, b.length);
  const ta = new Set(a.split(" ")), tb = new Set(b.split(" "));
  const comunes = [...ta].filter(t => t.length > 2 && tb.has(t)).length;
  const tokens = comunes ? comunes / Math.min(ta.size, tb.size) : 0;
  return Math.max(lev, tokens * 0.9);
}

function sugerenciasVet(clave) {
  const d = datosVets;
  const candidatos = [];
  d.oficiales.forEach(o => candidatos.push({ id: o.id, nombre: o.nombre, k: claveVet(o.nombre) }));
  // nombres propios ya confirmados (veterinarias que no están en la lista oficial)
  const vistos = new Set();
  d.alias.filter(a => !a.id && a.nombre).forEach(a => {
    const k = claveVet(a.nombre);
    if (vistos.has(k)) return;
    vistos.add(k);
    candidatos.push({ id: "", nombre: a.nombre, k });
  });
  return candidatos
    .map(c => Object.assign(c, { score: parecido(clave, c.k) }))
    .filter(c => c.score >= 0.6 && c.k !== clave)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

/* ---------------- Pendientes de revisión ---------------- */

function pendientesVet(pedidos) {
  const grupos = new Map();
  pedidos.forEach(p => {
    [p.VETERINARIA, p.DETALLE_VETERINARIA_RECOMENDO].forEach(txt => {
      const r = resolverVet(txt);
      if (!r || r.estado !== "pendiente") return;
      const g = grupos.get(r.clave) || { clave: r.clave, ejemplos: new Map(), n: 0 };
      g.n++;
      const t = String(txt).replace(/\s+/g, " ").trim();
      g.ejemplos.set(t, (g.ejemplos.get(t) || 0) + 1);
      grupos.set(r.clave, g);
    });
  });
  return [...grupos.values()]
    .map(g => Object.assign(g, {
      ejemplo: [...g.ejemplos.entries()].sort((a, b) => b[1] - a[1])[0][0],
      textos: [...g.ejemplos.keys()]
    }))
    .sort((a, b) => b.n - a.n);
}

function htmlRevisionVets(pedidos) {
  const d = datosVets;
  if (!d) return "";
  if (!d.ok) {
    return `<div class="m-card m-revision"><div class="m-card-titulo">Veterinarias por revisar</div>
      <p class="vacio">Para usar esta función hay que actualizar el Api.gs del servidor (${ui.esc(d.error || "")}).</p></div>`;
  }

  // Primero los que tienen una sugerencia probable (ej. "Jahuel" → Jaguel)
  const pend = pendientesVet(pedidos)
    .map(g => Object.assign(g, { sug: sugerenciasVet(g.clave) }))
    .sort((a, b) => (b.sug.length > 0) - (a.sug.length > 0) || b.n - a.n);
  const opciones = d.oficiales
    .filter(o => o.activa !== false && !/testing|prueba/i.test(o.nombre))
    .slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(o => `<option value="${ui.esc(o.id)}">${ui.esc(o.nombre)}</option>`).join("");

  const filaHtml = g => {
    const sug = g.sug;
    const k = ui.esc(g.clave);
    return `<div class="rev-fila" data-clave="${k}" data-ejemplo="${ui.esc(g.ejemplo)}">
      <div class="rev-texto">
        <strong>${ui.esc(g.ejemplo)}</strong>
        <small>${g.n} pedido${g.n > 1 ? "s" : ""}${g.textos.length > 1 ? " · también escrito: " + g.textos.filter(t => t !== g.ejemplo).map(ui.esc).join(", ") : ""}</small>
      </div>
      <div class="rev-acciones">
        ${sug.map(s => `<button class="rev-sug" data-id="${ui.esc(s.id)}" data-nombre="${ui.esc(s.nombre)}" onclick="confirmarVet(this)">Es ${ui.esc(s.nombre)} ✓</button>`).join("")}
        <select onchange="if(this.value) confirmarVet(this)">
          <option value="">Elegir de la lista…</option>${opciones}
        </select>
        <button class="rev-otra" data-id="" data-nombre="" onclick="confirmarVet(this)">Es una veterinaria distinta</button>
      </div>
    </div>`;
  };
  const VISIBLES = 6;
  const filas = pend.slice(0, VISIBLES).map(filaHtml).join("") +
    (pend.length > VISIBLES ? `<details class="rev-mas"><summary>Ver ${pend.length - VISIBLES} más</summary>${pend.slice(VISIBLES).map(filaHtml).join("")}</details>` : "");

  const confirmadas = d.alias.slice().sort((a, b) => a.clave.localeCompare(b.clave));

  // Marcadas como "distintas" que hoy se parecen a una aliada → sugerir vincular
  const paraVincular = d.alias
    .filter(a => !a.id)
    .filter(a => { const r = resolverVet(a.ejemplo || a.clave); return r && !r.grupo.startsWith("id:"); })
    .map(a => ({ a, sug: sugerenciasVet(claveVet(a.nombre || a.clave)).filter(x => x.id) }))
    .filter(x => x.sug.length);

  const htmlVincular = !paraVincular.length ? "" : `
    <div class="rev-vincular">
      <div class="rev-vincular-tit">¿Alguna de estas ahora es aliada?</div>
      ${paraVincular.map(({ a, sug }) => `
        <div class="rev-fila" data-clave="${ui.esc(a.clave)}" data-ejemplo="${ui.esc(a.ejemplo || a.clave)}">
          <div class="rev-texto"><strong>${ui.esc(a.nombre)}</strong><small>marcada como no aliada</small></div>
          <div class="rev-acciones">
            ${sug.map(x => `<button class="rev-sug" data-id="${ui.esc(x.id)}" data-nombre="${ui.esc(x.nombre)}" onclick="confirmarVet(this)">Es ${ui.esc(x.nombre)} ✓</button>`).join("")}
          </div>
        </div>`).join("")}
    </div>`;

  return `<div class="m-card m-revision">
    <div class="m-card-titulo">Veterinarias por revisar ${pend.length ? `<span class="rev-badge">${pend.length}</span>` : ""}</div>
    <p class="rev-ayuda">Nombres escritos por los clientes que no coinciden exactamente con la lista oficial. No se unen solos: elegí a cuál corresponde y queda guardado para siempre en la pestaña <em>veterinarias_alias</em>.</p>
    ${htmlVincular}
    ${pend.length ? filas : `<p class="vacio">✓ No hay nombres pendientes de revisar.</p>`}
    ${confirmadas.length ? `
      <details class="rev-confirmadas">
        <summary>Equivalencias confirmadas (${confirmadas.length})</summary>
        ${confirmadas.map(a => {
          const r = resolverVet(a.ejemplo || a.clave);
          const destino = r ? r.nombre : (a.nombre || "—");
          const esAliada = r && r.grupo.startsWith("id:");
          return `<div class="rev-conf rev-fila" data-clave="${ui.esc(a.clave)}" data-ejemplo="${ui.esc(a.ejemplo || a.clave)}">
            <span>“${ui.esc(a.ejemplo || a.clave)}” → <strong>${ui.esc(destino)}</strong>${esAliada ? "" : ` <small class="rev-noaliada">no aliada</small>`}${a.confirmadoPor ? ` <small>(${ui.esc(a.confirmadoPor)})</small>` : ""}</span>
            <span class="rev-conf-acc">
              ${esAliada ? "" : `<select onchange="if(this.value) confirmarVet(this)"><option value="">Vincular a aliada…</option>${opciones}</select>`}
              <button onclick="quitarVet('${ui.esc(a.clave)}')">Quitar</button>
            </span>
          </div>`;
        }).join("")}
      </details>` : ""}
  </div>`;
}

async function confirmarVet(el) {
  const esLista = el.tagName === "SELECT";
  const id = esLista ? el.value : (el.dataset.id || "");
  const nombre = esLista ? el.options[el.selectedIndex].text : (el.dataset.nombre || "");
  const fila = el.closest(".rev-fila");
  const clave = fila.dataset.clave;
  const ejemplo = fila.dataset.ejemplo;

  let nombreFinal = nombre;
  if (!id && !nombre) {
    nombreFinal = await ui.pedirTexto("Nombre de la veterinaria", {
      valor: ejemplo,
      etiqueta: "Cómo querés que figure en las métricas",
      obligatorio: true,
      textoOk: "Guardar"
    });
    if (!nombreFinal) return;
  } else {
    const ok = await ui.confirmar(`“${ejemplo}” pasa a contarse como “${nombre}”. ¿Confirmás?`, { textoOk: "Sí, unir" });
    if (!ok) { if (el.tagName === "SELECT") el.value = ""; return; }
  }

  fila.classList.add("rev-guardando");
  try {
    await llamarApi("guardarAliasVeterinaria", [clave, ejemplo, id || "", id ? "" : nombreFinal]);
    alert("Guardado: “" + ejemplo + "” → " + (nombreFinal || nombre));
    await cargarVets(true);
    pintarAdmin(pedidosGlobal, true);
  } catch (e) {
    fila.classList.remove("rev-guardando");
    if (e.message !== "SESION_VENCIDA") alert("Error: " + e.message);
  }
}

async function quitarVet(clave) {
  if (!await ui.confirmar("¿Quitar esta equivalencia? El nombre vuelve a la lista de revisión.", { textoOk: "Quitar" })) return;
  try {
    await llamarApi("quitarAliasVeterinaria", [clave]);
    await cargarVets(true);
    pintarAdmin(pedidosGlobal, true);
  } catch (e) {
    if (e.message !== "SESION_VENCIDA") alert("Error: " + e.message);
  }
}
