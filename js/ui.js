/**
 * Somos Uno – componentes de interfaz:
 *   ui.confirmar()  → ventana Sí/No
 *   ui.pedirTexto() → ventana para escribir
 *   ui.formulario() → ventana con fecha, hora, listas, etc.
 *   ui.toast()      → aviso suave abajo
 * Además reemplaza alert() por avisos suaves.
 */
const ui = (function () {

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  /* ---------------- Avisos ---------------- */

  function contenedorToasts() {
    let c = document.getElementById("toasts");
    if (!c) {
      c = document.createElement("div");
      c.id = "toasts";
      document.body.appendChild(c);
    }
    return c;
  }

  function toast(mensaje, tipo) {
    const texto = String(mensaje == null ? "" : mensaje);
    const t = tipo || (/^error|no se pudo|inválid|no hay |no se encontr|debe |falta/i.test(texto) ? "error" : "ok");
    const el = document.createElement("div");
    el.className = "toast toast-" + t;
    el.innerHTML = `<span class="toast-icono">${t === "error" ? "!" : "✓"}</span><span>${esc(texto).replace(/\n/g, "<br>")}</span>`;
    el.onclick = () => cerrar();
    contenedorToasts().appendChild(el);
    requestAnimationFrame(() => el.classList.add("visible"));
    const dur = t === "error" ? Math.min(9000, 4000 + texto.length * 40) : 2600;
    const timer = setTimeout(cerrar, dur);
    function cerrar() {
      clearTimeout(timer);
      el.classList.remove("visible");
      setTimeout(() => el.remove(), 250);
    }
  }

  /* ---------------- Ventana base ---------------- */

  function modal({ titulo, cuerpo, textoOk = "Aceptar", textoCancelar = "Cancelar", peligro = false, alAbrir, leer }) {
    return new Promise(resolve => {
      const fondo = document.createElement("div");
      fondo.className = "modal-fondo";
      fondo.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-titulo">${esc(titulo)}</div>
          <div class="modal-cuerpo">${cuerpo || ""}</div>
          <div class="modal-error"></div>
          <div class="modal-botones">
            ${textoCancelar ? `<button type="button" class="btn-sec" data-accion="cancelar">${esc(textoCancelar)}</button>` : ""}
            <button type="button" class="${peligro ? "btn-peligro" : "btn-prim"}" data-accion="ok">${esc(textoOk)}</button>
          </div>
        </div>`;
      document.body.appendChild(fondo);
      document.body.classList.add("modal-abierto");
      requestAnimationFrame(() => fondo.classList.add("visible"));

      const caja = fondo.querySelector(".modal");
      const error = fondo.querySelector(".modal-error");

      function terminar(valor) {
        fondo.classList.remove("visible");
        document.body.classList.remove("modal-abierto");
        document.removeEventListener("keydown", teclas);
        setTimeout(() => fondo.remove(), 200);
        resolve(valor);
      }

      function aceptar() {
        try {
          const valor = leer ? leer(caja) : true;
          terminar(valor);
        } catch (e) {
          error.textContent = e.message;
        }
      }

      function teclas(ev) {
        if (ev.key === "Escape") terminar(leer ? null : false);
        if (ev.key === "Enter" && !(ev.target && ev.target.tagName === "TEXTAREA")) {
          ev.preventDefault();
          aceptar();
        }
      }

      fondo.addEventListener("click", ev => {
        if (ev.target === fondo) terminar(leer ? null : false);
        const b = ev.target.closest("[data-accion]");
        if (!b) return;
        if (b.dataset.accion === "ok") aceptar();
        else terminar(leer ? null : false);
      });
      document.addEventListener("keydown", teclas);

      if (alAbrir) alAbrir(caja);
      const primero = caja.querySelector("input, select, textarea");
      setTimeout(() => (primero || caja.querySelector('[data-accion="ok"]')).focus(), 50);
    });
  }

  function confirmar(texto, opciones = {}) {
    return modal({
      titulo: opciones.titulo || "Confirmar",
      cuerpo: `<p class="modal-texto">${esc(texto).replace(/\n/g, "<br>")}</p>`,
      textoOk: opciones.textoOk || "Sí, confirmar",
      textoCancelar: "Cancelar",
      peligro: !!opciones.peligro
    });
  }

  function pedirTexto(titulo, opciones = {}) {
    return formulario(titulo, [{
      nombre: "valor",
      etiqueta: opciones.etiqueta || "",
      tipo: opciones.multilinea ? "textarea" : "text",
      valor: opciones.valor || "",
      placeholder: opciones.placeholder || "",
      obligatorio: !!opciones.obligatorio
    }], { textoOk: opciones.textoOk || "Guardar" }).then(r => (r ? r.valor : null));
  }

  /**
   * campos: [{ nombre, etiqueta, tipo: text|textarea|date|time|select, valor,
   *            opciones:[{valor,texto}], obligatorio, ayuda }]
   */
  function formulario(titulo, campos, opciones = {}) {
    const cuerpo = (opciones.intro ? `<p class="modal-texto">${esc(opciones.intro)}</p>` : "") +
      campos.map(c => {
        const id = "f_" + c.nombre;
        let control = "";
        if (c.tipo === "textarea") {
          control = `<textarea id="${id}" rows="4" placeholder="${esc(c.placeholder || "")}">${esc(c.valor || "")}</textarea>`;
        } else if (c.tipo === "select") {
          control = `<select id="${id}">
            ${c.placeholder ? `<option value="">${esc(c.placeholder)}</option>` : ""}
            ${(c.opciones || []).map(o => `<option value="${esc(o.valor)}" ${String(o.valor) === String(c.valor) ? "selected" : ""}>${esc(o.texto)}</option>`).join("")}
          </select>`;
        } else {
          control = `<input id="${id}" type="${c.tipo || "text"}" value="${esc(c.valor || "")}" placeholder="${esc(c.placeholder || "")}">`;
        }
        return `<label class="modal-campo">
          ${c.etiqueta ? `<span>${esc(c.etiqueta)}${c.obligatorio ? " *" : ""}</span>` : ""}
          ${control}
          ${c.ayuda ? `<small>${esc(c.ayuda)}</small>` : ""}
        </label>`;
      }).join("");

    return modal({
      titulo,
      cuerpo,
      textoOk: opciones.textoOk || "Guardar",
      leer: caja => {
        const r = {};
        campos.forEach(c => {
          const v = caja.querySelector("#f_" + c.nombre).value.trim();
          if (c.obligatorio && !v) throw new Error("Completá: " + (c.etiqueta || "el campo"));
          r[c.nombre] = v;
        });
        return r;
      }
    });
  }

  return { toast, confirmar, pedirTexto, formulario, esc };
})();

/* Todas las alertas pasan a ser avisos suaves. */
window.alert = function (mensaje) { ui.toast(mensaje); };
