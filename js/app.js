
let usuarioActual = null;
let pedidosGlobal = [];
let vistaTransportistaActual = "ACTIVAS";
let vistaAdministradorActual = "ACTIVOS";
let adjuntoPendiente = null;
let pedidoEditandoActual = null;
let intervaloActualizacion = null;
let actualizacionEnCurso = false;

const ACTUALIZACION_CADA_MS = 10000;



const LOGIN_MAX_HORAS = 6;

const ESTADOS_KANBAN = [
  "PENDIENTE_CONFIRMAR",
  "PENDIENTE_COORDINAR_RETIRO",
  "RETIRO_PROGRAMADO",
  "EN_RETIRO",
  "RETIRADO",
  "EN_BASE",

  "PENDIENTE_ENVIO_CREMATORIO",
  "EN_TRASLADO_A_CREMATORIO",
  "EN_CREMATORIO",
  "CREMADO",

  "PENDIENTE_RETIRAR_CENIZAS_CREMATORIO",
  "CENIZAS_RECIBIDAS",

  "PENDIENTE_ARMAR_CAJA_HOMENAJE",
  "PENDIENTE_COORDINAR_ENTREGA",
  "ENTREGA_PROGRAMADA_CAJA_HOMENAJE",
  "EN_ENTREGA_CAJA_HOMENAJE",
  "ENTREGADO_CAJA_HOMENAJE",

  "ENVIAR_CERTIFICADO",

  "PENDIENTE_LLAMADA_POSTVENTA",

  "INCIDENCIA_A_RESPONDER",
  "CANCELADO",
  "CERRADO"
];

function cargarApp() {
  // Recarga la vista actual (botón "Actualizar").
  if (!usuarioActual) { mostrarLogin(); return; }
  iniciarSistema();
}

function iniciarActualizacionAutomatica() {

  if (intervaloActualizacion) {
    clearInterval(intervaloActualizacion);
  }

  intervaloActualizacion = setInterval(function () {

    if (!usuarioActual) return;

    const tipo =
      String(usuarioActual.tipo || "")
        .trim()
        .toUpperCase();

    if (tipo === "TRANSPORTISTA") {

      servidor()
        .withSuccessHandler(function(tareas){

          pedidosGlobal = tareas;
          renderVistaTransportista(tareas);

          if (
            pedidoEditandoActual &&
            !document.getElementById("detallePedido").classList.contains("oculto")
          ) {
            verPedido(pedidoEditandoActual);
          }

        })
        .obtenerTareasTransportista(usuarioActual.mail);

    } else {

      servidor()
        .withSuccessHandler(function(pedidos){

          pedidosGlobal = pedidos;

          const pedidosFiltrados =
            vistaAdministradorActual === "FINALIZADOS"
              ? pedidos.filter(p =>
                  ["CERRADO","CANCELADO"].includes(
                    String(p.ESTADO_LOGISTICO || "")
                      .trim()
                      .toUpperCase()
                  )
                )
              : pedidos.filter(p =>
                  !["CERRADO","CANCELADO"].includes(
                    String(p.ESTADO_LOGISTICO || "")
                      .trim()
                      .toUpperCase()
                  )
                );

          renderDashboard(pedidos);
          renderKanban(pedidosFiltrados);

          document.getElementById("dashboard").insertAdjacentHTML(
            "afterbegin",
            `
            <div class="acciones menu-admin">
            <button onclick="cambiarVistaAdministrador('ACTIVOS')">
              Pedidos activos
            </button>

            <button onclick="cambiarVistaAdministrador('FINALIZADOS')">
              Pedidos finalizados
            </button>
          </div>
          `
        );

          if (
            pedidoEditandoActual &&
            !document.getElementById("detallePedido").classList.contains("oculto")
          ) {
            verPedido(pedidoEditandoActual);
          }

        })
        .obtenerPedidos();

    }

  }, ACTUALIZACION_CADA_MS);

}

function detenerActualizacionAutomatica() {

  if (intervaloActualizacion) {
    clearInterval(intervaloActualizacion);
    intervaloActualizacion = null;
  }

}

function usuarioEstaInteractuando() {

  const elementoActivo = document.activeElement;

  if (!elementoActivo) return false;

  const etiqueta =
    String(elementoActivo.tagName || "")
      .trim()
      .toUpperCase();

  return [
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "BUTTON"
  ].includes(etiqueta);
}

function refrescarSegunRol(idPedido) {

  const tipoUsuario =
    String(usuarioActual.tipo || "")
      .trim()
      .toUpperCase();

  if (tipoUsuario === "TRANSPORTISTA") {
    cargarVistaTransportista();
    cerrarPedido();
    return;
  }

  cargarPedidosSinCerrar(idPedido);
}

function mostrarLogin() {
  document.getElementById("loginBox").classList.remove("oculto");
  document.getElementById("appPrincipal").classList.add("oculto");
}

function mostrarApp() {
  document.getElementById("loginBox").classList.add("oculto");
  document.getElementById("appPrincipal").classList.remove("oculto");
}

function cerrarSesion() {
  detenerActualizacionAutomatica();
  usuarioActual = null;
  cerrarSesionGoogle();
  mostrarLogin();
}

function iniciarSistema() {

  mostrarApp();

  document.getElementById("dashboard").innerHTML = "Cargando...";
  document.getElementById("kanban").innerHTML = "";

  document.getElementById("usuario").innerHTML =
    usuarioActual.nombre + " - " + usuarioActual.tipo;

  const tipoUsuario =
    String(usuarioActual.tipo || "")
      .trim()
      .toUpperCase();

  const esTransportista =
    tipoUsuario === "TRANSPORTISTA";

  document.getElementById("menuTransportista").style.display =
    esTransportista ? "flex" : "none";

  if (esTransportista) {
    cargarVistaTransportista();
  } else {
    cargarPedidos();
  }

  iniciarActualizacionAutomatica();
}

function cargarPedidos() {

  servidor()
    .withSuccessHandler(function(pedidos) {

      pedidosGlobal = pedidos;

      const pedidosFiltrados =
        vistaAdministradorActual === "FINALIZADOS"
          ? pedidos.filter(p =>
              ["CERRADO", "CANCELADO"].includes(
                String(p.ESTADO_LOGISTICO || "")
                  .trim()
                  .toUpperCase()
              )
            )
          : pedidos.filter(p =>
              !["CERRADO", "CANCELADO"].includes(
                String(p.ESTADO_LOGISTICO || "")
                  .trim()
                  .toUpperCase()
              )
            );

      renderDashboard(pedidos);
      renderKanban(pedidosFiltrados);

      document.getElementById("dashboard").insertAdjacentHTML(
        "afterbegin",
        `
        <div class="acciones menu-admin">
          <button onclick="cambiarVistaAdministrador('ACTIVOS')">
            Pedidos activos
          </button>

          <button onclick="cambiarVistaAdministrador('FINALIZADOS')">
            Pedidos finalizados
          </button>
        </div>
        `
      );

    })
    .obtenerPedidos();
}

function cambiarVistaAdministrador(vista) {
  vistaAdministradorActual = vista;
  cargarPedidos();
}

function cargarAdjuntoPedido(idPedido, tipoAdjunto) {
  adjuntoPendiente = {
    idPedido: idPedido,
    tipoAdjunto: tipoAdjunto
  };

  document.getElementById("inputAdjuntoPedido").value = "";
  document.getElementById("inputAdjuntoPedido").click();
}
function procesarArchivoAdjunto(input) {
  const archivo = input.files && input.files[0];

  if (!archivo || !adjuntoPendiente) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    const base64 = String(e.target.result).split(",")[1];

    const idPedido = adjuntoPendiente.idPedido;
    const tipoAdjunto = adjuntoPendiente.tipoAdjunto;

    servidor()
      .withSuccessHandler(function() {
        alert("Adjunto cargado correctamente.");

        adjuntoPendiente = null;

        refrescarSegunRol(idPedido);
      })
      .withFailureHandler(function(error) {
        alert("Error: " + error.message);
        adjuntoPendiente = null;
      })
      .subirAdjuntoPedido(
        idPedido,
        tipoAdjunto,
        archivo.name,
        archivo.type,
        base64
      );
  };

  reader.readAsDataURL(archivo);
}

function renderDashboard(pedidos) {
  const estadoDe = p =>
    String(p.ESTADO_LOGISTICO || "").trim().toUpperCase();

  const grupos = [
    ["Por retirar", [
      "PENDIENTE_CONFIRMAR",
      "PENDIENTE_COORDINAR_RETIRO",
      "RETIRO_PROGRAMADO",
      "EN_RETIRO",
      "RETIRADO"
    ]],

    ["En base", [
      "EN_BASE",
      "PENDIENTE_ENVIO_CREMATORIO"
    ]],

    ["En crematorio", [
      "EN_TRASLADO_A_CREMATORIO",
      "EN_CREMATORIO",
      "CREMADO",
      "PENDIENTE_RETIRAR_CENIZAS_CREMATORIO"
    ]],

    ["Devolver kits", [
      "CENIZAS_RECIBIDAS",
      "PENDIENTE_ARMAR_CAJA_HOMENAJE",
      "PENDIENTE_COORDINAR_ENTREGA",
      "ENTREGA_PROGRAMADA_CAJA_HOMENAJE",
      "EN_ENTREGA_CAJA_HOMENAJE",
      "ENTREGADO_CAJA_HOMENAJE"
    ]],

    ["Pendiente enviar certificado digital", [
      "ENVIAR_CERTIFICADO"
    ]],

    ["Post venta", [
      "PENDIENTE_LLAMADA_POSTVENTA"
    ]]
  ];

  const tarjetasEstados = grupos.map(([titulo, estados]) => {
    const cantidad = pedidos.filter(
      p => estados.includes(estadoDe(p))
    ).length;

    return `
      <div class="card">
        <div class="label">${titulo}</div>
        <div class="number">${cantidad}</div>
      </div>
    `;
  }).join("");

  // Días calendario de Buenos Aires, expresados como números.
  // Reutiliza convertirFechaPedido(), que ya existe en tu código.
  function diaCalendario(valor) {
    const fecha = convertirFechaPedido(valor);
    if (!fecha) return null;

    return Date.UTC(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate()
    ) / 86400000;
  }

  const partesHoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const parte = tipo =>
    Number(partesHoy.find(p => p.type === tipo).value);

  const hoy = Date.UTC(
    parte("year"),
    parte("month") - 1,
    parte("day")
  ) / 86400000;

  const fechasIngresos = pedidos
    .filter(p => estadoDe(p) !== "CANCELADO")
    .map(p => diaCalendario(p.FECHA_CARGA))
    .filter(dia => dia !== null);

  const numero = valor =>
    valor.toLocaleString("es-AR");

  const conSigno = valor =>
    `${valor > 0 ? "+" : ""}${numero(valor)}`;

  const tarjetasComparacion = [7, 30, 100].map(dias => {
    // Incluye hoy y los días anteriores hasta completar el período.
    const inicioActual = hoy - dias + 1;
    const inicioAnterior = inicioActual - dias;

    const actual = fechasIngresos.filter(
      dia => dia >= inicioActual && dia <= hoy
    ).length;

    const anterior = fechasIngresos.filter(
      dia => dia >= inicioAnterior && dia < inicioActual
    ).length;

    const diferencia = actual - anterior;

    const porcentaje = anterior > 0
      ? `${conSigno(Number(
          ((diferencia / anterior) * 100).toFixed(1)
        ))}%`
      : actual === 0
        ? "0%"
        : "sin base";

    const color = diferencia > 0
      ? "#15803d"
      : diferencia < 0
        ? "#b91c1c"
        : "#64748b";

    return `
      <div class="card">
        <div class="label">VS ${dias} días</div>

        <div class="kpi-comparacion">
          <span class="number">${numero(actual)}</span>

          <span class="kpi-variacion" style="color:${color}">
            ${conSigno(diferencia)} (${porcentaje})
          </span>
        </div>

        <div class="kpi-periodo">
          Últimos ${dias} días: ${numero(actual)}
        </div>

        <div class="kpi-periodo">
          ${dias} días anteriores: ${numero(anterior)}
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("dashboard").innerHTML =
    tarjetasEstados + tarjetasComparacion;
}

function renderKanban(pedidos) {

  const estadosAMostrar =
    vistaAdministradorActual === "FINALIZADOS"
      ? ["CERRADO", "CANCELADO"]
      : ESTADOS_KANBAN.filter(e =>
          !["CERRADO", "CANCELADO"].includes(e)
        );

  const html = estadosAMostrar.map(estado => {
    const items = pedidos.filter(p => {
      const e = String(p.ESTADO_LOGISTICO || "").trim().toUpperCase();
      return e === estado;
    });

    return `
      <div class="column">
        <h3>${estado} (${items.length})</h3>
        ${items.map(renderPedido).join("")}
      </div>
    `;
  }).join("");

  document.getElementById("kanban").innerHTML = html;
}

function obtenerFechaProgramadaParaTarjeta(p) {

  const estado =
    String(p.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  if ([
    "PENDIENTE_CONFIRMAR",
    "PENDIENTE_COORDINAR_RETIRO",
    "RETIRO_PROGRAMADO",
    "EN_RETIRO"
  ].includes(estado)) {
    return {
      titulo: "Fecha programada",
      valor: p.RETIRO_FECHA_PROGRAMADA || ""
    };
  }

  if ([
    "PENDIENTE_ENVIO_CREMATORIO",
    "EN_TRASLADO_A_CREMATORIO"
  ].includes(estado)) {
    return {
      titulo: "Fecha envío crematorio programada",
      valor: p.FECHA_ENVIO_CREMATORIO_PROGRAMADA || ""
    };
  }

  if ([
    "PENDIENTE_COORDINAR_ENTREGA",
    "ENTREGA_PROGRAMADA_CAJA_HOMENAJE",
    "EN_ENTREGA_CAJA_HOMENAJE"
  ].includes(estado)) {
    return {
      titulo: "Entrega fecha programada",
      valor: p.ENTREGA_FECHA_PROGRAMADA || ""
    };
  }

  return null;
}

function clasePagoTarjeta(pago) {

  const valor =
    String(pago || "")
      .trim()
      .toUpperCase();

  if (
    valor === "PENDIENTE" ||
    valor === "PENDIENTE EFECTIVO" ||
    valor === "PENDIENTE POSNET"
  ) {
    return "badge-pago-pendiente";
  }

  return "";
}

function fotoImpresaConfirmada(valor) {
  const normalizado =
    String(valor || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  return normalizado === "SI";
}

function valorFotoImpresa(valor) {
  return fotoImpresaConfirmada(valor) ? "SI" : "NO";
}

/**
 * Convierte distintos formatos de fecha a un objeto Date.
 * Admite:
 * - 2026-07-13
 * - 2026-07-13 15:30
 * - 13/07/2026
 * - 13/07/2026 15:30
 * - Objetos Date
 */
function convertirFechaPedido(valor) {

  if (!valor) return null;

  if (valor instanceof Date) {
    const fecha = new Date(valor);

    return isNaN(fecha.getTime())
      ? null
      : fecha;
  }

  const texto = String(valor).trim();

  if (!texto) return null;

  // Formato DD/MM/AAAA o DD-MM-AAAA
  const formatoArgentino = texto.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/
  );

  if (formatoArgentino) {
    const dia = Number(formatoArgentino[1]);
    const mes = Number(formatoArgentino[2]) - 1;
    const anio = Number(formatoArgentino[3]);
    const hora = Number(formatoArgentino[4] || 0);
    const minutos = Number(formatoArgentino[5] || 0);

    const fecha = new Date(
      anio,
      mes,
      dia,
      hora,
      minutos,
      0,
      0
    );

    return isNaN(fecha.getTime())
      ? null
      : fecha;
  }

  // Formato AAAA-MM-DD
  const formatoInternacional = texto.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?/
  );

  if (formatoInternacional) {
    const anio = Number(formatoInternacional[1]);
    const mes = Number(formatoInternacional[2]) - 1;
    const dia = Number(formatoInternacional[3]);
    const hora = Number(formatoInternacional[4] || 0);
    const minutos = Number(formatoInternacional[5] || 0);

    const fecha = new Date(
      anio,
      mes,
      dia,
      hora,
      minutos,
      0,
      0
    );

    return isNaN(fecha.getTime())
      ? null
      : fecha;
  }

  // Último intento para otros formatos válidos
  const fechaGenerica = new Date(texto);

  return isNaN(fechaGenerica.getTime())
    ? null
    : fechaGenerica;
}


/**
 * Cuenta días hábiles transcurridos entre dos fechas.
 * No cuenta sábados ni domingos.
 * La fecha inicial no se cuenta como un día transcurrido.
 */
function calcularDiasHabilesTranscurridos(fechaInicial, fechaFinal) {

  const inicio = convertirFechaPedido(fechaInicial);
  const fin = convertirFechaPedido(fechaFinal);

  if (!inicio || !fin) return null;

  inicio.setHours(0, 0, 0, 0);
  fin.setHours(0, 0, 0, 0);

  if (fin <= inicio) return 0;

  let diasHabiles = 0;
  const fechaRecorrida = new Date(inicio);

  fechaRecorrida.setDate(fechaRecorrida.getDate() + 1);

  while (fechaRecorrida <= fin) {

    const diaSemana = fechaRecorrida.getDay();

    // Domingo = 0
    // Sábado = 6
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasHabiles++;
    }

    fechaRecorrida.setDate(fechaRecorrida.getDate() + 1);
  }

  return diasHabiles;
}


/**
 * Devuelve la clase de color correspondiente a la tarjeta.
 * Esta función solamente aplica alertas al administrador.
 */
function claseAlertaTiempoPedido(pedido) {

  const tipoUsuario =
    String(usuarioActual?.tipo || "")
      .trim()
      .toUpperCase();

  if (tipoUsuario !== "ADMINISTRADOR") {
    return "";
  }

  const estado =
    String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  const fechaRetiroReal = pedido.RETIRO_FECHA_REAL;

  if (!fechaRetiroReal) {
    return "";
  }

  const diasHabiles =
    calcularDiasHabilesTranscurridos(
      fechaRetiroReal,
      new Date()
    );

  if (diasHabiles === null) {
    return "";
  }

  const estadosPrimeraEtapa = [
    "RETIRADO",
    "EN_BASE",
    "PENDIENTE_ENVIO_CREMATORIO",
    "EN_TRASLADO_A_CREMATORIO"
  ];

  const estadosSegundaEtapa = [
    "EN_CREMATORIO",
    "CREMADO",
    "PENDIENTE_RETIRAR_CENIZAS_CREMATORIO",
    "CENIZAS_RECIBIDAS",
    "PENDIENTE_ARMAR_CAJA_HOMENAJE",
    "PENDIENTE_COORDINAR_ENTREGA",
    "ENTREGA_PROGRAMADA_CAJA_HOMENAJE",
    "EN_ENTREGA_CAJA_HOMENAJE"
  ];

  // Primera etapa:
  // 4 y 5 días hábiles = amarillo
  // 6 o más días hábiles = rojo
  if (estadosPrimeraEtapa.includes(estado)) {

    if (diasHabiles >= 6) {
      return "pedido-alerta-roja";
    }

    if (diasHabiles >= 4) {
      return "pedido-alerta-amarilla";
    }

    return "";
  }

  // Segunda etapa:
  // 7 y 8  días hábiles = amarillo
  // 9 o más días hábiles = rojo
  if (estadosSegundaEtapa.includes(estado)) {

    // 7 y 8 días hábiles = amarillo
    if (diasHabiles >= 7 && diasHabiles <= 8) {
      return "pedido-alerta-amarilla";
    }

    // 9 o más días hábiles = rojo
    if (diasHabiles >= 9) {
      return "pedido-alerta-roja";
    }
  }

  return "";
}

function renderPedido(p) {
  const id = String(p.ID_PEDIDO || "").replace(/'/g, "\\'");

  const estado =
    String(p.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  const estadosMostrarConfirmacionTransportista = [
    "PENDIENTE_CONFIRMAR",
    "PENDIENTE_ENVIO_CREMATORIO",
    "PENDIENTE_RETIRAR_CENIZAS_CREMATORIO",
    "ENTREGA_PROGRAMADA_CAJA_HOMENAJE"
  ];

  let confirmacionTransportista = "";

  if (estado === "PENDIENTE_ENVIO_CREMATORIO") {
    confirmacionTransportista = p.TRASLADO_ESTADO_ASIGNACION || "PENDIENTE";
  }

  else if (estado === "PENDIENTE_RETIRAR_CENIZAS_CREMATORIO") {
    confirmacionTransportista = p.DEVOLUCION_ESTADO_ASIGNACION || "PENDIENTE";
  }

  else if (estado === "ENTREGA_PROGRAMADA_CAJA_HOMENAJE") {
    confirmacionTransportista = p.ENTREGA_ESTADO_ASIGNACION || "PENDIENTE";
  }

  else if (estado === "PENDIENTE_CONFIRMAR") {
    confirmacionTransportista = p.RETIRO_TRANSPORTISTA ? "SI" : "PENDIENTE";
  }

  const claseConfirmacion =
    String(confirmacionTransportista || "").trim().toUpperCase() === "SI" ||
    String(confirmacionTransportista || "").trim().toUpperCase() === "ACEPTADA"
      ? "confirmacion-si"
      : "confirmacion-pendiente";



  const esEtapaEntregaTarjeta = [
    "PENDIENTE_COORDINAR_ENTREGA",
    "ENTREGA_PROGRAMADA_CAJA_HOMENAJE",
    "EN_ENTREGA_CAJA_HOMENAJE",
    "ENTREGADO_CAJA_HOMENAJE"
  ].includes(estado);

  const mostrarDomicilioRetiro = [
    "PENDIENTE_CONFIRMAR",
    "PENDIENTE_COORDINAR_RETIRO",
    "RETIRO_PROGRAMADO",
    "EN_RETIRO",
    "RETIRADO",
    "PENDIENTE_COORDINAR_ENTREGA",
    "ENTREGA_PROGRAMADA_CAJA_HOMENAJE",
    "EN_ENTREGA_CAJA_HOMENAJE",
    "ENTREGADO_CAJA_HOMENAJE"
  ].includes(estado);

  const domicilioRetiro = (
    esEtapaEntregaTarjeta
      ? [
          p.ENTREGA_CIUDAD,
          p.ENTREGA_BARRIO,
          p.ENTREGA_DIRECCION
        ]
      : [
          p.RETIRO_CIUDAD,
          p.RETIRO_BARRIO,
          p.RETIRO_CALLE_NUMERO
        ]
  )
    .filter(v => String(v || "").trim())
    .join(" - ");

    const fechaTarjeta = obtenerFechaProgramadaParaTarjeta(p);  

    const claseAlertaTiempo = claseAlertaTiempoPedido(p);

    return `
      <div
        class="pedido ${claseAlertaTiempo}"
        onclick="verPedido('${id}')"
      >
      <div class="id">${p.ID_PEDIDO}</div>
      <div class="mascota">${p.NOMBRE_MASCOTA || "Sin nombre"}</div>
      <div class="detalle">${p.PLAN || ""}</div>
      <div class="detalle">
        <strong>Ciudad:</strong>
        ${safeHtml(String(
          (esEtapaEntregaTarjeta ? p.ENTREGA_CIUDAD : p.RETIRO_CIUDAD)
          || "Sin informar"
        ))}
      </div>

      <div class="detalle">
        <strong>Peso:</strong>
        ${safeHtml(String(p.PESO ?? "").trim() || "Sin informar")}
      </div>
      <div class="detalle">${p.DUENO_NOMBRE_APELLIDO || ""}</div>
      <div class="detalle">${p.RETIRO_PUNTO || ""}</div>

      ${mostrarDomicilioRetiro && domicilioRetiro ? `
        <div class="detalle">
          <strong>${esEtapaEntregaTarjeta ? "Domicilio de entrega" : "Domicilio de retiro"}:</strong>
        </div>
      ` : ""}

      ${p.OBSERVACIONES_CLIENTE ? `
        <div class="detalle" style="
          margin-top:6px;
          padding:8px;
          background:#f8f5ef;
          border-left:4px solid #073559;
          border-radius:6px;
          font-size:12px;
        ">
          <strong>Observaciones:</strong><br>
          ${safeHtml(p.OBSERVACIONES_CLIENTE)}
        </div>
      ` : ""}

      ${fechaTarjeta && fechaTarjeta.valor ? `
        <div class="detalle">
          <strong>${fechaTarjeta.titulo}:</strong> ${fechaTarjeta.valor}
        </div>
      ` : ""}
      

      ${estadosMostrarConfirmacionTransportista.includes(estado) ? `
        <div class="detalle ${claseConfirmacion}">
          <strong>Confirmación del transportista:</strong> ${confirmacionTransportista}
        </div>
      ` : ""}

      <div class="detalle">
        <span title="DNI">${tieneAdjuntoValido(p.ADJUNTO_DNI) ? "🟢🪪" : "🔴🪪"}</span>
        <span title="Formulario">${tieneAdjuntoValido(p.ADJUNTO_FORMULARIO) ? "🟢📄" : "🔴📄"}</span>
        <span title="Foto retrato">${tieneAdjuntoValido(p.ADJUNTO_FOTO_RETRATO) ? "🟢📷" : "🔴📷"}</span>
        <span title="Foto impresa: ${valorFotoImpresa(p.FOTO_IMPRESA)}">${fotoImpresaConfirmada(p.FOTO_IMPRESA) ? "🟢🖨️" : "🔴🖨️"}</span>
      </div>

      <span class="badge ${clasePagoTarjeta(p.VERIFICACION_PAGO)}">
        ${p.VERIFICACION_PAGO || "SIN PAGO"}
      </span>
    </div>
  `;
  
}
// (el arranque ahora lo hace js/api.js después del ingreso con Google)

function esVistaTrasladoCrematorioTransportista(pedido) {

  const esTransportista =
    String(usuarioActual.tipo || "")
      .trim()
      .toUpperCase() === "TRANSPORTISTA";

  const estado =
    String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  return (
    esTransportista &&
    [
      "PENDIENTE_ENVIO_CREMATORIO",
      "EN_TRASLADO_A_CREMATORIO"
    ].includes(estado)
  );
}

function camposTransportistaSegunEstado(pedido) {

  const estado =
    String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  if ([
    "PENDIENTE_COORDINAR_RETIRO",
    "RETIRO_PROGRAMADO",
    "EN_RETIRO",
    "RETIRADO"
  ].includes(estado)) {
    return [
      ["Retiro transportista", pedido.RETIRO_TRANSPORTISTA],
      ["Retiro estado asignación", pedido.RETIRO_ESTADO_ASIGNACION]
    ];
  }

  if ([
    "PENDIENTE_ENVIO_CREMATORIO",
    "EN_TRASLADO_A_CREMATORIO"
  ].includes(estado)) {
    return [
      ["Traslado crematorio transportista", pedido.TRASLADO_CREMATORIO_TRANSPORTISTA],
      ["Traslado estado asignación", pedido.TRASLADO_ESTADO_ASIGNACION]
    ];
  }

  if (estado === "PENDIENTE_RETIRAR_CENIZAS_CREMATORIO") {
    return [
      ["Devolución ceniza transportista", pedido.DEVOLUCION_CENIZA_TRANSPORTISTA],
      ["Devolución estado asignación", pedido.DEVOLUCION_ESTADO_ASIGNACION]
    ];
  }

  if ([
    "ENTREGA_PROGRAMADA_CAJA_HOMENAJE",
    "EN_ENTREGA_CAJA_HOMENAJE"
  ].includes(estado)) {
    return [
      ["Entrega transportista", pedido.ENTREGA_TRANSPORTISTA],
      ["Entrega estado asignación", pedido.ENTREGA_ESTADO_ASIGNACION]
    ];
  }

  return [
    ["Retiro transportista", pedido.RETIRO_TRANSPORTISTA],
    ["Retiro estado asignación", pedido.RETIRO_ESTADO_ASIGNACION]
  ];
}

function esVistaRetiroTransportista(pedido) {

  const esTransportista =
    String(usuarioActual.tipo || "")
      .trim()
      .toUpperCase() === "TRANSPORTISTA";

  const estado =
    String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  return (
    esTransportista &&
    [
      "PENDIENTE_COORDINAR_RETIRO",
      "RETIRO_PROGRAMADO",
      "EN_RETIRO",
      "RETIRADO"
    ].includes(estado)
  );
}

function ocultarAdjuntosEHistorialTransportista(pedido) {

  const esTransportista =
    String(usuarioActual.tipo || "")
      .trim()
      .toUpperCase() === "TRANSPORTISTA";

  const estado =
    String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  return (
    esTransportista &&
    [
      "PENDIENTE_ENVIO_CREMATORIO",
      "EN_TRASLADO_A_CREMATORIO",
      "PENDIENTE_RETIRAR_CENIZAS_CREMATORIO",
      "ENTREGA_PROGRAMADA_CAJA_HOMENAJE",
      "EN_ENTREGA_CAJA_HOMENAJE"
    ].includes(estado)
  );
}

function esVistaDevolucionTransportista(pedido) {

  const esTransportista =
    String(usuarioActual.tipo || "")
      .trim()
      .toUpperCase() === "TRANSPORTISTA";

  const estado =
    String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  return (
    esTransportista &&
    estado === "PENDIENTE_RETIRAR_CENIZAS_CREMATORIO"
  );
}

function esVistaEntregaTransportista(pedido) {

  const esTransportista =
    String(usuarioActual.tipo || "")
      .trim()
      .toUpperCase() === "TRANSPORTISTA";

  const estado =
    String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  return (
    esTransportista &&
    [
      "ENTREGA_PROGRAMADA_CAJA_HOMENAJE",
      "EN_ENTREGA_CAJA_HOMENAJE"
    ].includes(estado)
  );
}

function esTareaFinalizadaTransportista(pedido) {

  const esTransportista =
    String(usuarioActual.tipo || "")
      .trim()
      .toUpperCase() === "TRANSPORTISTA";

  const estado =
    String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  return (
    esTransportista &&
    [
      "EN_BASE",
      "EN_CREMATORIO",
      "CENIZAS_RECIBIDAS",
      "ENTREGADO_CAJA_HOMENAJE"
    ].includes(estado)
  );
}

function verPedido(idPedido){

  console.log("ABRIENDO PEDIDO:", idPedido);


  const pedido = pedidosGlobal.find(p => p.ID_PEDIDO == idPedido);
  if(!pedido) return;

  pedidoEditandoActual = pedido.ID_PEDIDO;
  const vistaTrasladoTransportista =
    esVistaTrasladoCrematorioTransportista(pedido);
  const vistaRetiroTransportista =
    esVistaRetiroTransportista(pedido);
  const vistaDevolucionTransportista =
    esVistaDevolucionTransportista(pedido);  
  const ocultarAdjuntosHistorial =
    ocultarAdjuntosEHistorialTransportista(pedido);  
  const vistaEntregaTransportista =
    esVistaEntregaTransportista(pedido);
  const vistaFinalizadaTransportista =
    esTareaFinalizadaTransportista(pedido);    
  const esAdmin = String(usuarioActual.tipo || "").trim().toUpperCase() === "ADMINISTRADOR";
  const esTransportista = String(usuarioActual.tipo || "").trim().toUpperCase() === "TRANSPORTISTA";

    const estadoAdmin =
      String(pedido.ESTADO_LOGISTICO || "")
        .trim()
        .toUpperCase();
    const adminEnEtapaRetiro =
      esAdmin &&
      [
        "PENDIENTE_CONFIRMAR",
        "PENDIENTE_COORDINAR_RETIRO",
        "RETIRO_PROGRAMADO",
        "EN_RETIRO",
        "RETIRADO"
      ].includes(estadoAdmin);

     const pagoYaPagado =
      String(pedido.VERIFICACION_PAGO || "")
        .trim()
        .toUpperCase() === "PAGADO";  



  const panel = document.getElementById("detallePedido");

  panel.classList.remove("oculto");;

  console.log("PANEL", panel);

  console.log("PEDIDO", pedido);
  console.log("ES ADMIN", esAdmin);
  console.log("ES TRANSPORTISTA", esTransportista);

  if (vistaFinalizadaTransportista) {

    panel.innerHTML = `
      <span class="cerrar-panel" onclick="cerrarPedido()">×</span>

      <h2>${safeHtml(pedido.NOMBRE_MASCOTA || "Pedido")}</h2>

      <div class="tags">
        <span class="badge">${safeHtml(pedido.PLAN || "SIN PLAN")}</span>
      </div>

      <div class="estado-actual">
        Estado actual: ${safeHtml(pedido.ESTADO_LOGISTICO || "SIN ESTADO")}
      </div>

      ${bloque("Datos del servicio", [
        ["ID Pedido", pedido.ID_PEDIDO],
        ["Plan", pedido.PLAN],
        ["Tipo mascota", pedido.TIPO_MASCOTA],
        ["Peso", pedido.PESO],
        ["Observaciones cliente", pedido.OBSERVACIONES_CLIENTE]
      ])}

      ${bloque("Mascota", [
        ["Nombre", pedido.NOMBRE_MASCOTA, "NOMBRE_MASCOTA"],
        ["Edad", pedido.EDAD, "EDAD"],
        ["Color", pedido.COLOR, "COLOR"],
        ["Raza", pedido.RAZA, "RAZA"],
        ["Fecha fallecimiento", pedido.FECHA_FALLECIMIENTO, "FECHA_FALLECIMIENTO"]
      
      ])}
      ${bloque("Tutor", [
        ["Nombre y apellido", pedido.DUENO_NOMBRE_APELLIDO, "DUENO_NOMBRE_APELLIDO"],
        ["Teléfono", pedido.TELEFONO, "TELEFONO"],
        ["Mail", pedido.MAIL, "MAIL"],
        ["DNI", pedido.DNI, "DNI"],
        ["Provincia", pedido.TITULAR_PROVINCIA, "TITULAR_PROVINCIA"],
        ["Ciudad", pedido.TITULAR_CIUDAD, "TITULAR_CIUDAD"],
        ["Dirección", pedido.TITULAR_CALLE_NUMERO, "TITULAR_CALLE_NUMERO"]
      ])}
    `;

    return;
  }

  panel.innerHTML = `
    <span class="cerrar-panel" onclick="cerrarPedido()">×</span>

    <h2>${safeHtml(pedido.NOMBRE_MASCOTA || "Pedido")}</h2>

    <div class="tags">
      <span class="badge">${safeHtml(pedido.PLAN || "SIN PLAN")}</span>

      ${esAdmin || debeMostrarPagoTransportista(pedido) ? `
        <span class="badge">${safeHtml(pedido.VERIFICACION_PAGO || "SIN PAGO")}</span>
      ` : ""}
    </div>

    <div class="estado-actual">
      Estado actual: ${safeHtml(pedido.ESTADO_LOGISTICO || "SIN ESTADO")}
    </div>

    ${bloque("Autorización del pedido", [
      ["Pedido autorizado", pedido.PEDIDO_AUTORIZADO]
    ])}




    ${esAdmin ? bloque("Pago", [
      ["Forma de pago", pedido.FORMA_PAGO],
      ["Verificación pago", pedido.VERIFICACION_PAGO],
      ["Fecha verificación", pedido.FECHA_VERIFICACION_PAGO],
      ["Verificado por", pedido.VERIFICADO_POR],
      ["Observación pago", pedido.OBSERVACION_PAGO]
    ]) : ""}

    ${esTransportista ? renderAccionesTransportista(pedido) : ""}
    ${esTransportista ? renderPagoTransportista(pedido) : ""}

    ${esAdmin && [
      "PENDIENTE_CONFIRMAR",
      "PENDIENTE_COORDINAR_RETIRO",
      "RETIRO_PROGRAMADO",
      "EN_RETIRO"
    ].includes(estadoAdmin) ? `
      <div class="bloque" style="${pagoYaPagado ? "order:999;" : ""}">
        <h3>Acciones de pago</h3>
        <div class="acciones">
          <button
            ${pagoYaPagado ? "disabled" : ""}
            style="${pagoYaPagado ? "background:#ddd;color:#888;cursor:not-allowed;" : ""}"
            onclick="${pagoYaPagado ? "" : `marcarPago('${pedido.ID_PEDIDO}', 'PAGADO')`}"
          >
            Marcar pagado
          </button>

          <button onclick="marcarPago('${pedido.ID_PEDIDO}', 'PENDIENTE')">Pago pendiente</button>
          <button onclick="marcarPago('${pedido.ID_PEDIDO}', 'RECHAZADO')">Pago rechazado</button>
          <button onclick="marcarPago('${pedido.ID_PEDIDO}', 'PENDIENTE EFECTIVO')">Pendiente efectivo</button>
          <button onclick="marcarPago('${pedido.ID_PEDIDO}', 'PENDIENTE POSNET')">Pendiente POSNET</button>
        </div>
      </div>
    ` : ""}

    ${esAdmin ? renderAccionesAdministrador(pedido) : ""}
    ${esAdmin ? renderBloqueFechas(pedido) : ""}

    ${vistaTrasladoTransportista ? `

      ${bloque("Datos del servicio", [
        ["ID Pedido", pedido.ID_PEDIDO],
        ["Plan", pedido.PLAN],
        ["Tipo mascota", pedido.TIPO_MASCOTA],
        ["Peso", pedido.PESO],
        ["Observaciones cliente", pedido.OBSERVACIONES_CLIENTE]
      ])}

      ${bloque("Mascota", [
        ["Nombre", pedido.NOMBRE_MASCOTA],
        ["Edad", pedido.EDAD],
        ["Color", pedido.COLOR],
        ["Raza", pedido.RAZA],
        ["Fecha fallecimiento", pedido.FECHA_FALLECIMIENTO]
      ])}

      ${bloque("Logística", [
        ["Estado logístico", pedido.ESTADO_LOGISTICO],
        ["Traslado estado asignación", pedido.TRASLADO_ESTADO_ASIGNACION],
        ["Fecha envío crematorio programada", pedido.FECHA_ENVIO_CREMATORIO_PROGRAMADA],
        ["Fecha envío crematorio real", pedido.FECHA_ENVIO_CREMATORIO_REAL]
      ])}

    ` : `

      ${bloque("Datos del servicio", [
        ["ID Pedido", pedido.ID_PEDIDO],
        ["Fecha carga", pedido.FECHA_CARGA],
        ["Origen", pedido.ORIGEN],
        ["Modo", pedido.MODO],
        ["Plan", pedido.PLAN, "PLAN"],
        ["Tipo mascota", pedido.TIPO_MASCOTA, "TIPO_MASCOTA"],
        ["Peso", pedido.PESO, "PESO"],

        ...(esAdmin || debeMostrarPagoTransportista(pedido)
          ? [
              ["Monto", pedido.MONTO, "MONTO"],
              ["Estado", pedido.ESTADO]
            ]
          : []
        ),

        ["Observaciones cliente", pedido.OBSERVACIONES_CLIENTE, "OBSERVACIONES_CLIENTE"]
      ])}

      ${bloque("Mascota", [
        ["Nombre", pedido.NOMBRE_MASCOTA, "NOMBRE_MASCOTA"],
        ["Edad", pedido.EDAD, "EDAD"],
        ["Color", pedido.COLOR, "COLOR"],
        ["Raza", pedido.RAZA, "RAZA"],
        ["Fecha fallecimiento", pedido.FECHA_FALLECIMIENTO, "FECHA_FALLECIMIENTO"]
      ])}

      ${bloque("Tutor", [
        ["Nombre y apellido", pedido.DUENO_NOMBRE_APELLIDO, "DUENO_NOMBRE_APELLIDO"],
        ["Teléfono", pedido.TELEFONO, "TELEFONO"],
        ["Mail", pedido.MAIL, "MAIL"],
        ["DNI", pedido.DNI, "DNI"],
        ["Provincia", pedido.TITULAR_PROVINCIA, "TITULAR_PROVINCIA"],
        ["Ciudad", pedido.TITULAR_CIUDAD, "TITULAR_CIUDAD"],
        ["Dirección", pedido.TITULAR_CALLE_NUMERO, "TITULAR_CALLE_NUMERO"]
      ])}

      ${vistaDevolucionTransportista ? "" : (
        ["PENDIENTE_COORDINAR_ENTREGA", "ENTREGA_PROGRAMADA_CAJA_HOMENAJE", "EN_ENTREGA_CAJA_HOMENAJE", "ENTREGADO_CAJA_HOMENAJE"].includes(estadoAdmin) || vistaEntregaTransportista
          ? bloque("Entrega de caja homenaje", [
              ["Punto de entrega", pedido.ENTREGA_PUNTO, "ENTREGA_PUNTO"],
              ["Ciudad", pedido.ENTREGA_CIUDAD, "ENTREGA_CIUDAD"],
              ["Barrio", pedido.ENTREGA_BARRIO, "ENTREGA_BARRIO"],
              ["Dirección", pedido.ENTREGA_DIRECCION, "ENTREGA_DIRECCION"],
              ...(pedido.ENTREGA_PUNTO === "Veterinaria"
                ? [["Veterinaria de entrega", pedido.ENTREGA_VETERINARIA, "ENTREGA_VETERINARIA"]]
                : []),
              ["Fecha programada", pedido.ENTREGA_FECHA_PROGRAMADA, "ENTREGA_FECHA_PROGRAMADA"],
              ["Fecha real", pedido.ENTREGA_FECHA_REAL, "ENTREGA_FECHA_REAL"]
            ])
          : bloque("Retiro", [
              ["Punto de retiro", pedido.RETIRO_PUNTO, "RETIRO_PUNTO"],
              ["Mismo domicilio", pedido.RETIRO_MISMO_DOMICILIO, "RETIRO_MISMO_DOMICILIO"],
              ["Provincia", pedido.RETIRO_PROVINCIA, "RETIRO_PROVINCIA"],
              ["Ciudad", pedido.RETIRO_CIUDAD, "RETIRO_CIUDAD"],
              ["Barrio", pedido.RETIRO_BARRIO, "RETIRO_BARRIO"],
              ["Dirección", pedido.RETIRO_CALLE_NUMERO, "RETIRO_CALLE_NUMERO"],
              ...(pedido.RETIRO_PUNTO === "Veterinaria"
                ? [["Veterinaria de retiro", pedido.VETERINARIA, "VETERINARIA"]]
                : []),
              ["Fecha programada", pedido.RETIRO_FECHA_PROGRAMADA, "RETIRO_FECHA_PROGRAMADA"],
              ["Fecha real", pedido.RETIRO_FECHA_REAL, "RETIRO_FECHA_REAL"]
            ])
      )}
    `}

    ${pedido.ESTADO_LOGISTICO === "INCIDENCIA_A_RESPONDER" ? `
      <button onclick="resolverIncidencia('${pedido.ID_PEDIDO}')">
        Resolver incidencia
      </button>
    ` : ""}

    ${esAdmin ? bloque("Veterinaria / reconocimiento", [
      ["Veterinaria", pedido.VETERINARIA, "VETERINARIA"],
      ["Veterinaria recomendó", pedido.VETERINARIA_RECOMENDO, "VETERINARIA_RECOMENDO"],
      ["Detalle veterinaria recomendó", pedido.DETALLE_VETERINARIA_RECOMENDO, "DETALLE_VETERINARIA_RECOMENDO"],
      ["Reconocimiento %", pedido["RECONOCIMIENTO_%"], "RECONOCIMIENTO_%"],
      ["Reconocimiento $", pedido["RECONOCIMIENTO_$"], "RECONOCIMIENTO_$"],
      ["Importe neto reconocimiento", pedido.IMPORTE_NETO_RECONOCIMIENTO, "IMPORTE_NETO_RECONOCIMIENTO"]
    ]) : ""}
    ${esAdmin ? bloque("Pago Mercado Pago", [
      ["MP Preference ID", pedido.MP_PREFERENCE_ID],
      ["MP Payment ID", pedido.MP_PAYMENT_ID],
      ["MP External Reference", pedido.MP_EXTERNAL_REFERENCE],
      ["MP Status", pedido.MP_STATUS],
      ["Fecha pago", pedido.FECHA_PAGO],
      ["MP última actualización", pedido.MP_ULTIMA_ACTUALIZACION]
    ]) : ""}




    ${(!vistaTrasladoTransportista && !vistaDevolucionTransportista) ? bloque("Logística", [  
      ["Estado logístico", pedido.ESTADO_LOGISTICO],
      ["Entrega fecha programada", pedido.ENTREGA_FECHA_PROGRAMADA],

      ...(vistaRetiroTransportista
        ? []
        : [["Fecha cierre pedido", pedido.FECHA_CIERRE_PEDIDO]]
      ),

      ["Incidencia logística", pedido.INCIDENCIA_LOGISTICA]
  ]) : ""}

    ${bloque("Transportistas", camposTransportistaSegunEstado(pedido))}

    ${(vistaRetiroTransportista || vistaDevolucionTransportista || vistaEntregaTransportista || adminEnEtapaRetiro) ? "" : bloque("Crematorio / cenizas", [
      ["Fecha envío crematorio programada", pedido.FECHA_ENVIO_CREMATORIO_PROGRAMADA],
      ["Fecha envío crematorio real", pedido.FECHA_ENVIO_CREMATORIO_REAL, "FECHA_ENVIO_CREMATORIO_REAL"],
      ["Fecha cremación real", pedido.FECHA_CREMACION_REAL, "FECHA_CREMACION_REAL"],
      ["Fecha retiro cenizas crematorio real", pedido.FECHA_RETIRO_CENIZAS_CREMATORIO_REAL, "FECHA_RETIRO_CENIZAS_CREMATORIO_REAL"],
      ["Fecha entrega real", pedido.ENTREGA_FECHA_REAL, "ENTREGA_FECHA_REAL"]
    ])}

    ${ocultarAdjuntosHistorial ? "" : bloque("Adjuntos", [
      ["DNI", pedido.ADJUNTO_DNI],
      ["Formulario", pedido.ADJUNTO_FORMULARIO],
      ["Foto retrato", pedido.ADJUNTO_FOTO_RETRATO], 
      ["Otros", pedido.ADJUNTO_OTROS]
    ])}

    ${ocultarAdjuntosHistorial ? "" : (esAdmin || esTransportista ? `
      <div class="bloque">
        <h3>Cargar adjuntos</h3>

        <div class="acciones">
          <button onclick="abrirCarpetaPedido('${pedido.ID_PEDIDO}')">
            Abrir carpeta del pedido
          </button>

          <button
            onclick="descargarDocumentacionPedido('${pedido.ID_PEDIDO}', this)"
            style="
              background:#7c3aed;
              color:white;
              border:none;
            "
          >
            📄 Descargar PDF
          </button>

          <button onclick="cargarAdjuntoPedido('${pedido.ID_PEDIDO}', 'DNI')">
            Cargar DNI
          </button>

          <button onclick="cargarAdjuntoPedido('${pedido.ID_PEDIDO}', 'FORMULARIO')">
            Cargar formulario
          </button>

          <button
            class="btn-foto-retrato"
            onclick="cargarAdjuntoPedido('${pedido.ID_PEDIDO}', 'FOTO_RETRATO')"
          >
            📷 FOTO RETRATO
          </button>

          <button onclick="cargarAdjuntoPedido('${pedido.ID_PEDIDO}', 'OTROS')">
            Cargar otros
          </button>
        </div>
      </div>    
    ` : "")}



    ${esAdmin ? `
      <div class="bloque">
        <h3>Foto impresa</h3>
        <div class="grid-campos">
          <div class="campo">
            <strong>¿La foto ya fue impresa?</strong>
            <select
              id="fotoImpresaSelect"
              onchange="guardarFotoImpresa('${pedido.ID_PEDIDO}', this.value, this)"
              style="
                width:100%;
                margin-top:8px;
                padding:10px;
                border:1px solid #d7dce2;
                border-radius:8px;
                background:${fotoImpresaConfirmada(pedido.FOTO_IMPRESA) ? "#eaf7ee" : "#fdecec"};
                color:${fotoImpresaConfirmada(pedido.FOTO_IMPRESA) ? "#1f7a3f" : "#b42318"};
                font-weight:700;
              "
            >
              <option value="NO" ${!fotoImpresaConfirmada(pedido.FOTO_IMPRESA) ? "selected" : ""}>🔴 NO</option>
              <option value="SI" ${fotoImpresaConfirmada(pedido.FOTO_IMPRESA) ? "selected" : ""}>🟢 SÍ</option>
            </select>
            <small id="estadoFotoImpresa" style="display:block;margin-top:6px;"></small>
          </div>
        </div>
      </div>
    ` : ""}    

  `;
}

function resolverIncidencia(idPedido) {

  if (!confirm("¿Resolver incidencia y volver al estado anterior?")) {
    return;
  }

  servidor()
    .withSuccessHandler(function() {
      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      alert(error.message);
    })
    .resolverIncidenciaLogistica(idPedido);
}

function renderAccionesTransportista(pedido) {

  const mail = String(usuarioActual.mail || "").trim().toLowerCase();

  const tareas = [
    {
      etapa: "RETIRO",
      titulo: "Retiro",
      campoTransportista: "RETIRO_TRANSPORTISTA",
      campoAsignacion: "RETIRO_ESTADO_ASIGNACION",
      estadoFinal: "EN_BASE",
      textoConfirmar: "Confirmar retiro",
      funcionConfirmar: "confirmarRetiroPedido"
    },
    {
      etapa: "TRASLADO",
      titulo: "Traslado al crematorio",
      campoTransportista: "TRASLADO_CREMATORIO_TRANSPORTISTA",
      campoAsignacion: "TRASLADO_ESTADO_ASIGNACION",
      estadoFinal: "EN_CREMATORIO",
      textoConfirmar: "Confirmar traslado",
      funcionConfirmar: "confirmarTrasladoCrematorioPedido"
    },
    {
      etapa: "DEVOLUCION",
      titulo: "Devolución de cenizas",
      campoTransportista: "DEVOLUCION_CENIZA_TRANSPORTISTA",
      campoAsignacion: "DEVOLUCION_ESTADO_ASIGNACION",
      estadoFinal: "CENIZAS_RECIBIDAS",
      textoConfirmar: "Confirmar devolución",
      funcionConfirmar: "confirmarDevolucionCenizasPedido"
    },
    {
      etapa: "ENTREGA",
      titulo: "Entrega de cenizas",
      campoTransportista: "ENTREGA_TRANSPORTISTA",
      campoAsignacion: "ENTREGA_ESTADO_ASIGNACION",
      estadoFinal: "ENTREGADO_CAJA_HOMENAJE",
      textoConfirmar: "Confirmar entrega",
      funcionConfirmar: "confirmarEntregaCenizasPedido"
    }
  ];

  const tarea = tareas.find(t => {
    const asignado =
      String(pedido[t.campoTransportista] || "")
        .trim()
        .toLowerCase() === mail;

    if (!asignado) return false;

    const estado = String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

    if (t.etapa === "RETIRO") {
      return ["RETIRO_PROGRAMADO", "EN_RETIRO", "RETIRADO"].includes(estado);
    }

    if (t.etapa === "TRASLADO") {
      return ["PENDIENTE_ENVIO_CREMATORIO", "EN_TRASLADO_A_CREMATORIO"].includes(estado);
    }

    if (t.etapa === "DEVOLUCION") {
      return ["PENDIENTE_RETIRAR_CENIZAS_CREMATORIO"].includes(estado);
    }

    if (t.etapa === "ENTREGA") {
      return ["ENTREGA_PROGRAMADA_CAJA_HOMENAJE", "EN_ENTREGA_CAJA_HOMENAJE"].includes(estado);
    }

    return false;
  });

  if (!tarea) return "";

  const estadoAsignacion =
    String(pedido[tarea.campoAsignacion] || "").trim().toUpperCase();

  const estadoLogistico =
    String(pedido.ESTADO_LOGISTICO || "").trim().toUpperCase();

  const finalizada = estadoLogistico === tarea.estadoFinal;

  if (finalizada) {
    return `
      <div class="bloque">
        <h3>Acciones del transportista - ${tarea.titulo}</h3>
        <div class="acciones">
          <button class="btn-disabled" disabled>
            Tarea finalizada
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="bloque">
      <h3>Acciones del transportista - ${tarea.titulo}</h3>

      <div class="acciones">

        ${estadoAsignacion !== "ACEPTADA" ? `
          <button onclick="responderTarea('${pedido.ID_PEDIDO}', '${tarea.etapa}', 'ACEPTADA')">
            Aceptar tarea
          </button>
        ` : `
          <button class="btn-disabled" disabled>
            Tarea aceptada
          </button>
        `}

        <button class="btn-rechazar" onclick="responderTarea('${pedido.ID_PEDIDO}', '${tarea.etapa}', 'RECHAZADA')">
          Rechazar tarea
        </button>

        ${estadoAsignacion === "ACEPTADA" ? `
          <button onclick="${estadoLogistico === "RETIRADO" && tarea.etapa === "RETIRO"
            ? "confirmarIngresoBasePedido"
            : tarea.funcionConfirmar}('${pedido.ID_PEDIDO}')">
            ${estadoLogistico === "RETIRADO" && tarea.etapa === "RETIRO"
              ? "Confirmar ingreso a base"
              : tarea.textoConfirmar}
          </button>

          ${estadoLogistico === "RETIRADO" && tarea.etapa === "RETIRO" ? `
            <button onclick="volverEstadoAnteriorTransportista('${pedido.ID_PEDIDO}')">
              Volver atrás
            </button>
          ` : ""}
        ` : ""}

      </div>
    </div>
  `;
}

function debeMostrarPagoTransportista(pedido) {

  const pago =
    String(pedido.VERIFICACION_PAGO || "")
      .trim()
      .toUpperCase();

  const puntoRetiro =
    String(pedido.RETIRO_PUNTO || "")
      .trim()
      .toUpperCase();

  return (
    puntoRetiro === "DOMICILIO" &&
    ["PENDIENTE EFECTIVO", "PENDIENTE POSNET"].includes(pago)
  );
}

function clasePago(pago) {
  const valor =
    String(pago || "")
      .trim()
      .toUpperCase();

  return [
    "PENDIENTE",
    "PENDIENTE EFECTIVO",
    "PENDIENTE POSNET"
  ].includes(valor)
    ? "pago-pendiente"
    : "";
}

function renderPagoTransportista(pedido) {

  const estado =
    String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  if (!debeMostrarPagoTransportista(pedido)) {
    return "";
  }

  if (![
    "RETIRO_PROGRAMADO",
    "EN_RETIRO"
  ].includes(estado)) {
    return "";
  }

  return `
    <div class="bloque">

      <h3>Acciones de pago</h3>

      <div class="monto-cobrar">
        RECIBIR: $${pedido.MONTO || 0}
      </div>

      <div class="acciones">
        <button onclick="marcarPagoTransportista('${pedido.ID_PEDIDO}')">
          Marcar pagado
        </button>
      </div>

    </div>
  `;
}

function renderAccionesAdministrador(pedido) {
  const estado = String(pedido.ESTADO_LOGISTICO || "").trim().toUpperCase();

  const btnIncidencia = `
    <button onclick="abrirCrearIncidencia('${pedido.ID_PEDIDO}')">
      Crear incidencia
    </button>
  `;

  const btnVolver = `
    <button onclick="volverEstadoAnterior('${pedido.ID_PEDIDO}')">
      Volver atrás
    </button>
  `;

  const btnSiguiente = `
    <button onclick="pasarSiguienteEstado('${pedido.ID_PEDIDO}')">
      Siguiente estado
    </button>
  `;

  const btnAsignarYAvanzar = `
    <button onclick="abrirAsignarTransportistaYAvanzar('${pedido.ID_PEDIDO}')">
      Asignar transportista y avanzar
    </button>
  `;

  const btnResolverIncidencia = `
    <button onclick="resolverIncidencia('${pedido.ID_PEDIDO}')">
      Resolver incidencia
    </button>
  `;

  const btnAgregarObservacion = `
    <button onclick="agregarObservacionCliente('${pedido.ID_PEDIDO}')">
      Agregar observación
    </button>
  `;

  let botones = "";

  if (estado === "PENDIENTE_CONFIRMAR") {
    botones = `
      <button onclick="autorizarPedido('${pedido.ID_PEDIDO}', 'SI')">
        Autorizar
      </button>


      ${btnIncidencia}

      <button class="btn-rechazar btn-rechazar-chico" onclick="autorizarPedido('${pedido.ID_PEDIDO}', 'NO')">
        Rechazar
      </button>
    `;
  }

  else if (estado === "PENDIENTE_COORDINAR_RETIRO") {
    botones = `
      ${btnAsignarYAvanzar}
      ${btnIncidencia}

      <button class="btn-rechazar btn-rechazar-chico" onclick="autorizarPedido('${pedido.ID_PEDIDO}', 'NO')">
        Rechazar
      </button>
    `;
  }

  else if (estado === "RETIRO_PROGRAMADO" || estado === "EN_RETIRO") {
    botones = `
      <button onclick="abrirAsignarTransportista('${pedido.ID_PEDIDO}')">
        Reasignar retiro
      </button>

      <button onclick="confirmarRetiroPedidoAdmin('${pedido.ID_PEDIDO}')">
        Confirmar retiro desde administración
      </button>

      ${btnIncidencia}
    `;
  }

  else if (estado === "RETIRADO") {
    botones = `
      <button onclick="confirmarIngresoBasePedidoAdmin('${pedido.ID_PEDIDO}')">
        Confirmar ingreso a base
      </button>

      ${btnIncidencia}
    `;
  }

  else if (estado === "EN_BASE") {
    botones = `
      ${btnAsignarYAvanzar}
      ${btnIncidencia}
    `;
  }

  else if (estado === "PENDIENTE_ENVIO_CREMATORIO" || estado === "EN_TRASLADO_A_CREMATORIO") {
    botones = `
      <button onclick="abrirAsignarTransportista('${pedido.ID_PEDIDO}')">
        Reasignar traslado
      </button>

      <button onclick="confirmarTrasladoCrematorioPedidoAdmin('${pedido.ID_PEDIDO}')">
        Confirmar traslado desde administración
      </button>

      ${btnIncidencia}
    `;
  }

  else if (estado === "EN_CREMATORIO") {
    botones = `
      ${btnSiguiente}
      ${btnIncidencia}
      ${btnVolver}
    `;
  }

  else if (estado === "CREMADO") {

    const plan =
      String(pedido.PLAN || "")
        .trim()
        .toUpperCase();

    if (plan.includes("DESCANSO")) {
      botones = `
        ${btnSiguiente}
        ${btnIncidencia}
      `;
    } else {
      botones = `
        ${btnAsignarYAvanzar}
        ${btnIncidencia}
      `;
    }
  }

  else if (estado === "PENDIENTE_RETIRAR_CENIZAS_CREMATORIO") {
    botones = `
      <button onclick="abrirAsignarTransportista('${pedido.ID_PEDIDO}')">
        Reasignar retiro de cenizas
      </button>

      <button onclick="confirmarDevolucionCenizasPedidoAdmin('${pedido.ID_PEDIDO}')">
        Confirmar cenizas recibidas desde administración
      </button>

      ${btnIncidencia}
    `;
  }

  else if (estado === "CENIZAS_RECIBIDAS") {
    botones = `
      ${btnSiguiente}
      ${btnIncidencia}
    `;
  }

  else if (estado === "PENDIENTE_ARMAR_CAJA_HOMENAJE") {
    botones = `
      ${btnSiguiente}
      ${btnVolver}
      ${btnIncidencia}
    `;
  }

  else if (estado === "PENDIENTE_COORDINAR_ENTREGA") {
    botones = `
      ${btnAsignarYAvanzar}
      ${btnVolver}
      ${btnIncidencia}
    `;
  }

  else if (estado === "ENTREGA_PROGRAMADA_CAJA_HOMENAJE" || estado === "EN_ENTREGA_CAJA_HOMENAJE") {
    botones = `
      <button onclick="abrirAsignarTransportista('${pedido.ID_PEDIDO}')">
        Reasignar entrega
      </button>

      <button onclick="confirmarEntregaCenizasPedidoAdmin('${pedido.ID_PEDIDO}')">
        Confirmar entrega desde administración
      </button>

      ${btnIncidencia}
    `;
  }

  else if (estado === "ENTREGADO_CAJA_HOMENAJE") {
    botones = `
      ${btnSiguiente}
      ${btnVolver}
      ${btnIncidencia}
    `;
  }

  else if (estado === "PENDIENTE_LLAMADA_POSTVENTA") {
    botones = `
      ${btnSiguiente}
      ${btnIncidencia}
    `;
  }

  else if (estado === "ENVIAR_CERTIFICADO") {
    botones = `
      ${btnSiguiente}
      ${btnIncidencia}
    `;
  }

  else if (estado === "INCIDENCIA_A_RESPONDER") {
    botones = `
      ${btnResolverIncidencia}

      <button
        type="button"
        onclick="cancelarPedidoIncidencia('${pedido.ID_PEDIDO}')"
        style="background:#b91c1c;color:white;"
      >
        Cancelar pedido
      </button>
    `;
  }

  else {
    botones = `
      ${btnIncidencia}
    `;
  }

  botones += btnAgregarObservacion;

  return `
    <div class="bloque">
      <h3>Acciones operativas</h3>
      <div class="acciones">
        ${botones}
      </div>
    </div>
  `;
}

function renderBloqueFechas(pedido) {

  const estado =
    String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  let columna = "";
  let titulo = "";

  if (estado === "PENDIENTE_COORDINAR_RETIRO") {
    columna = "RETIRO_FECHA_PROGRAMADA";
    titulo = "Fecha programada de retiro";
  }

  else if (estado === "EN_BASE") {
    columna = "FECHA_ENVIO_CREMATORIO_PROGRAMADA";
    titulo = "Fecha programada de envío al crematorio";
  }

  else if (estado === "EN_CREMATORIO") {
    columna = "FECHA_CREMACION_REAL";
    titulo = "Fecha real de cremación";
  }

  else if (estado === "PENDIENTE_COORDINAR_ENTREGA") {
    columna = "ENTREGA_FECHA_PROGRAMADA";
    titulo = "Fecha programada de entrega";
  }

  if (!columna) return "";

  return `
    <div class="bloque">

      <h3>${titulo}</h3>

      <input
        type="date"
        id="fechaEstado"
        onchange="guardarFechaEstadoAuto('${pedido.ID_PEDIDO}', '${columna}')"
      >

      <select
        id="horaEstado"
        onchange="guardarFechaEstadoAuto('${pedido.ID_PEDIDO}', '${columna}')"
      >
        <option value="">Sin horario</option>
        <option value="08:00">08:00</option>
        <option value="08:30">08:30</option>
        <option value="09:00">09:00</option>
        <option value="09:30">09:30</option>
        <option value="10:00">10:00</option>
        <option value="10:30">10:30</option>
        <option value="11:00">11:00</option>
        <option value="11:30">11:30</option>
        <option value="12:00">12:00</option>
        <option value="12:30">12:30</option>
        <option value="13:00">13:00</option>
        <option value="13:30">13:30</option>
        <option value="14:00">14:00</option>
        <option value="14:30">14:30</option>
        <option value="15:00">15:00</option>
        <option value="15:30">15:30</option>
        <option value="16:00">16:00</option>
        <option value="16:30">16:30</option>
        <option value="17:00">17:00</option>
        <option value="17:30">17:30</option>
        <option value="18:00">18:00</option>
        <option value="18:30">18:30</option>
        <option value="19:00">19:00</option>
      </select>

      <div id="estadoGuardadoFecha" style="margin-top:10px;color:#666;font-weight:700;">
        Seleccioná fecha y horario.
      </div>

    </div>
  `;
}

function confirmarRetiroPedidoAdmin(idPedido) {
  if (!confirm("¿Confirmás el retiro desde administración?")) return;

  servidor()
    .withSuccessHandler(function() {
      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .confirmarRetiro(idPedido);
}

function confirmarIngresoBasePedidoAdmin(idPedido) {
  if (!confirm("¿Confirmás que la mascota ingresó a base?")) return;

  servidor()
    .withSuccessHandler(function() {
      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .pasarSiguienteEstadoLogistico(idPedido);
}

function confirmarIngresoBasePedido(idPedido) {
  if (!confirm("¿Confirmás que la mascota ingresó a base?")) return;

  servidor()
    .withSuccessHandler(function() {
      actualizarVistaTransportistaSuave(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .pasarSiguienteEstadoLogistico(idPedido);
}

function volverEstadoAnteriorTransportista(idPedido) {

  if (!confirm("¿Volver a EN_RETIRO?")) return;

  servidor()
    .withSuccessHandler(function() {
      actualizarVistaTransportistaSuave(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .volverEstadoAnteriorLogistico(idPedido);
}

function confirmarTrasladoCrematorioPedidoAdmin(idPedido) {
  if (!confirm("¿Confirmás el traslado al crematorio desde administración?")) return;

  servidor()
    .withSuccessHandler(function() {
      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .confirmarTrasladoCrematorio(idPedido);
}

function confirmarDevolucionCenizasPedidoAdmin(idPedido) {
  if (!confirm("¿Confirmás que las cenizas fueron recibidas en sede desde administración?")) return;

  servidor()
    .withSuccessHandler(function() {
      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .confirmarDevolucionCenizas(idPedido);
}

function confirmarEntregaCenizasPedidoAdmin(idPedido) {
  if (!confirm("¿Confirmás la entrega al tutor desde administración?")) return;

  servidor()
    .withSuccessHandler(function() {
      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .confirmarEntregaCenizas(idPedido);
}

function cerrarPedido(){
  const panel = document.getElementById("detallePedido");
  panel.classList.add("oculto");
}

function bloque(titulo, campos){
  return `
    <div class="bloque">
      <h3>${titulo}</h3>
      <div class="grid-campos">
        ${campos.map(c => campo(c[0], c[1], c[2])).join("")}
      </div>
    </div>
  `;
}

function campo(nombre, valor, columna){
  const esAdmin =
    String(usuarioActual?.tipo || "")
      .trim()
      .toUpperCase() === "ADMINISTRADOR";

  const puedeEditar =
    esAdmin &&
    columna &&
    !String(columna).toUpperCase().includes("ESTADO") &&
    ![
      "VERIFICACION_PAGO",
      "PEDIDO_AUTORIZADO",
      "MP_STATUS"
    ].includes(String(columna).toUpperCase());

  return `
    <div class="campo">
      <strong>${safeHtml(nombre)}</strong>

      <span class="${nombre === "Verificación pago" ? clasePago(valor) : ""}">
        ${safeHtml(valor)}

        ${puedeEditar ? `
          <button
            class="btn-lapiz"
            title="Editar"
            onclick="editarDatoPedido('${columna}', '${safeHtml(nombre)}', '${safeHtml(valor)}')"
          >
            ✏️
          </button>
        ` : ""}
      </span>
    </div>
  `;
}

function abrirCarpetaPedido(idPedido) {
  servidor()
    .withSuccessHandler(function(carpeta) {
      window.open(carpeta.url, "_blank");
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .obtenerOCrearCarpetaPedido(idPedido);
}


function descargarDocumentacionPedido(idPedido, boton) {

  const textoOriginal = boton.innerHTML;

  boton.disabled = true;
  boton.innerHTML = "Preparando PDF...";

  servidor()
    .withSuccessHandler(function(resultado) {

      boton.disabled = false;
      boton.innerHTML = textoOriginal;

      if (!resultado || !resultado.base64) {
        alert("No se pudo generar el PDF.");
        return;
      }

      const enlace = document.createElement("a");

      enlace.href =
        "data:application/pdf;base64," +
        resultado.base64;

      enlace.download =
        resultado.nombre ||
        ("DOCUMENTACION_" + idPedido + ".pdf");

      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

    })
    .withFailureHandler(function(error) {

      boton.disabled = false;
      boton.innerHTML = textoOriginal;

      alert(
        "No se pudo generar el PDF:\n" +
        (error.message || error)
      );

    })
    .generarPdfDocumentacionPedido(idPedido);
}

function editarDatoPedido(columna, nombreCampo, valorActual) {

  const nuevoValor = prompt(
    "Editar " + nombreCampo + ":",
    valorActual || ""
  );

  if (nuevoValor === null) return;

  servidor()
    .withSuccessHandler(function() {
      alert("Dato actualizado correctamente.");
      cargarPedidosSinCerrar(pedidoEditandoActual);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .actualizarDatoPedidoAdmin(
      pedidoEditandoActual,
      columna,
      nuevoValor
    );
}

function guardarFotoImpresa(idPedido, valor, select) {
  const valorNormalizado = valorFotoImpresa(valor);
  const estado = document.getElementById("estadoFotoImpresa");

  select.disabled = true;

  if (estado) {
    estado.textContent = "Guardando...";
  }

  servidor()
    .withSuccessHandler(function() {
      const pedido = pedidosGlobal.find(p => p.ID_PEDIDO == idPedido);

      if (pedido) {
        pedido.FOTO_IMPRESA = valorNormalizado;
      }

      select.disabled = false;
      select.style.background = valorNormalizado === "SI" ? "#eaf7ee" : "#fdecec";
      select.style.color = valorNormalizado === "SI" ? "#1f7a3f" : "#b42318";

      if (estado) {
        estado.textContent = "✓ Guardado";
      }

      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      select.disabled = false;

      if (estado) {
        estado.textContent = "⚠ Error al guardar: " + error.message;
      }
    })
    .actualizarDatoPedidoAdmin(
      idPedido,
      "FOTO_IMPRESA",
      valorNormalizado
    );
}

function actualizarVistaTransportistaSuave(idPedido) {
  servidor()
    .withSuccessHandler(function(tareas) {
      pedidosGlobal = tareas;
      renderVistaTransportista(tareas);

      if (idPedido) {
        verPedido(idPedido);
      }
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .obtenerTareasTransportista(usuarioActual.mail);
}

function safeHtml(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}

function autorizarPedido(idPedido, valor) {

  if (valor === "NO") {
    const confirmar = confirm(
      "¿Estás seguro que querés rechazar este pedido?\n\nEsta acción cambiará el pedido a rechazado."
    );

    if (!confirmar) return;
  }

  servidor()
    .withSuccessHandler(function() {
      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .actualizarAutorizacionPedido(idPedido, valor);
}

function agregarObservacionCliente(idPedido) {
  const observacion = prompt("Nueva observación del cliente:", "");

  if (!observacion) return;

  servidor()
    .withSuccessHandler(function() {
      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .agregarObservacionCliente(idPedido, observacion);
}

function marcarPago(idPedido, valor) {
  const observacion = prompt("Observación de pago (opcional):", "");

  servidor()
    .withSuccessHandler(function() {
      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .actualizarVerificacionPago(idPedido, valor, observacion || "");
}

function marcarPagoTransportista(idPedido) {

  if (!confirm("¿Confirmás que el pago fue recibido?")) return;

  servidor()
    .withSuccessHandler(function() {
      actualizarVistaTransportistaSuave(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .actualizarVerificacionPago(
      idPedido,
      "PAGADO",
      "Pago confirmado por transportista"
    );
}

function guardarFechaEstadoAuto(idPedido, columna) {

  const fechaInput = document.getElementById("fechaEstado");
  const horaInput = document.getElementById("horaEstado");
  const estado = document.getElementById("estadoGuardadoFecha");

  const fecha = fechaInput.value;
  const hora = horaInput.value;

  if (!fecha) {
    estado.innerHTML = "Seleccioná una fecha para guardar.";
    return;
  }

  const valorFinal = hora
    ? fecha + " " + hora
    : fecha;

  estado.innerHTML = "Guardando...";

  servidor()
    .withSuccessHandler(function() {

      estado.innerHTML = "✓ Guardado automáticamente";

      fechaInput.value = fecha;
      horaInput.value = hora;

      setTimeout(function(){
        estado.innerHTML = "";
      }, 2500);

      const pedido = pedidosGlobal.find(p => p.ID_PEDIDO == idPedido);

      if (pedido) {
        pedido[columna] = valorFinal;
      }

    })
    .withFailureHandler(function(error) {
      estado.innerHTML = "⚠ Error al guardar: " + error.message;
      console.error(error);
    })
    .actualizarFechaPedido(
      idPedido,
      columna,
      valorFinal
    );
}

function cargarPedidosSinCerrar(idPedido) {
  servidor()
    .withSuccessHandler(function(pedidos) {
      pedidosGlobal = pedidos;
      renderDashboard(pedidos);
      renderKanban(pedidos);
      verPedido(idPedido);
    })
    .obtenerPedidos();
}
function abrirAsignarTransportista(idPedido) {

  const pedido = pedidosGlobal.find(p => p.ID_PEDIDO == idPedido);

  if (!pedido) {
    alert("No se encontró el pedido.");
    return;
  }

  const estado =
    String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  let etapa = "";
  let fechaActual = "";

  if (estado === "RETIRO_PROGRAMADO" || estado === "EN_RETIRO") {
    etapa = "RETIRO";
    fechaActual = pedido.RETIRO_FECHA_PROGRAMADA || "";
  }

  else if (
    estado === "PENDIENTE_ENVIO_CREMATORIO" ||
    estado === "EN_TRASLADO_A_CREMATORIO"
  ) {
    etapa = "TRASLADO";
    fechaActual = pedido.FECHA_ENVIO_CREMATORIO_PROGRAMADA || "";
  }

  else if (estado === "PENDIENTE_RETIRAR_CENIZAS_CREMATORIO") {
    etapa = "DEVOLUCION";
    fechaActual = "";
  }

  else if (
    estado === "ENTREGA_PROGRAMADA_CAJA_HOMENAJE" ||
    estado === "EN_ENTREGA_CAJA_HOMENAJE"
  ) {
    etapa = "ENTREGA";
    fechaActual = pedido.ENTREGA_FECHA_PROGRAMADA || "";
  }

  else {
    alert("Este estado no permite reasignar transportista.");
    return;
  }

  const nuevaFecha = prompt(
    "Etapa detectada automáticamente: " + etapa +
    "\n\nFecha programada actual/modificada:",
    fechaActual
  );

  if (nuevaFecha === null) return;

  const nuevaHora = prompt(
    "Hora programada opcional.\n\nEjemplo: 12:30\n\nDejar vacío si no tiene horario:",
    ""
  );

  if (nuevaHora === null) return;

  const fechaProgramadaFinal = nuevaHora
    ? nuevaFecha + " " + nuevaHora
    : nuevaFecha;

  servidor()
    .withSuccessHandler(function(transportistas) {

      if (!transportistas.length) {
        alert("No hay transportistas cargados en la hoja usuarios.");
        return;
      }

      const opciones = transportistas
        .map((t, i) => `${i + 1}. ${t.nombre} - ${t.mail}`)
        .join("\n");

      const elegido = prompt(
        "Elegí transportista:\n\n" + opciones,
        "1"
      );

      if (!elegido) return;

      const index = Number(elegido) - 1;

      if (!transportistas[index]) {
        alert("Opción inválida");
        return;
      }

      servidor()
        .withSuccessHandler(function() {
          cargarPedidosSinCerrar(idPedido);
        })
        .withFailureHandler(function(error) {
          alert("Error: " + error.message);
        })
        .reasignarTransportistaConFecha(
          idPedido,
          etapa,
          transportistas[index].mail,
          fechaProgramadaFinal
        );

    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .obtenerTransportistas();
}

function abrirAsignarTransportistaYAvanzar(idPedido) {

  const pedido = pedidosGlobal.find(p => p.ID_PEDIDO == idPedido);

  if (!pedido) {
    alert("No se encontró el pedido.");
    return;
  }

  const estado =
    String(pedido.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  let etapa = "";

  if (estado === "PENDIENTE_COORDINAR_RETIRO") {
    etapa = "RETIRO";
  }

  else if (estado === "EN_BASE") {
    etapa = "TRASLADO";
  }

  else if (estado === "CREMADO") {
    etapa = "DEVOLUCION";
  }

  else if (estado === "PENDIENTE_COORDINAR_ENTREGA") {
    etapa = "ENTREGA";
  }

  else {
    alert("Este estado no permite asignar transportista y avanzar.");
    return;
  }

  servidor()
    .withSuccessHandler(function(transportistas) {

      if (!transportistas.length) {
        alert("No hay transportistas cargados en la hoja usuarios.");
        return;
      }

      const opciones = transportistas
        .map((t, i) => `${i + 1}. ${t.nombre} - ${t.mail}`)
        .join("\n");

      const elegido = prompt(
        "Etapa detectada automáticamente: " + etapa +
        "\n\nElegí transportista:\n\n" + opciones,
        "1"
      );

      if (!elegido) return;

      const index = Number(elegido) - 1;

      if (!transportistas[index]) {
        alert("Opción inválida");
        return;
      }

      servidor()
        .withSuccessHandler(function() {
          cargarPedidosSinCerrar(idPedido);
        })
        .withFailureHandler(function(error) {
          alert("Error: " + error.message);
        })
        .asignarTransportistaYAvanzar(
          idPedido,
          etapa,
          transportistas[index].mail
        );

    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .obtenerTransportistas();
}



function cargarVistaTransportista() {
  document.getElementById("dashboard").innerHTML = "";
  document.getElementById("kanban").innerHTML = "Cargando mis tareas...";

  servidor()
    .withSuccessHandler(function(tareas) {
      pedidosGlobal = tareas;
      renderVistaTransportista(tareas);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .obtenerTareasTransportista(usuarioActual.mail);
}


function renderVistaTransportista(tareas) {
  document.querySelector(".section-title h2").innerHTML =
    vistaTransportistaActual === "ACTIVAS" ? "Mis tareas" : "Tareas finalizadas";
  document.getElementById("dashboard").innerHTML = `
    <div class="acciones">
        <button onclick="cambiarVistaTransportista('ACTIVAS')">
            Mis tareas
        </button>

        <button onclick="cambiarVistaTransportista('FINALIZADAS')">
            Tareas finalizadas
        </button>
    </div>
  `;  

  const columnas = [
    {
      titulo: "Retiro",
      campoTransportista: "RETIRO_TRANSPORTISTA",
      campoAsignacion: "RETIRO_ESTADO_ASIGNACION",
      estadoFinal: "EN_BASE"
    },
    {
      titulo: "Traslado al crematorio",
      campoTransportista: "TRASLADO_CREMATORIO_TRANSPORTISTA",
      campoAsignacion: "TRASLADO_ESTADO_ASIGNACION",
      estadoFinal: "EN_CREMATORIO"
    },
    {
      titulo: "Devolución de cenizas a sede",
      campoTransportista: "DEVOLUCION_CENIZA_TRANSPORTISTA",
      campoAsignacion: "DEVOLUCION_ESTADO_ASIGNACION",
      estadoFinal: "CENIZAS_RECIBIDAS"
    },
    {
      titulo: "Entrega de cenizas",
      campoTransportista: "ENTREGA_TRANSPORTISTA",
      campoAsignacion: "ENTREGA_ESTADO_ASIGNACION",
      estadoFinal: "ENTREGADO_CAJA_HOMENAJE"
    }
  ];

  const mail = String(usuarioActual.mail || "").trim().toLowerCase();

  const html = columnas.map(col => {
    const items = tareas.filter(p => {
      const asignadoAMi =
        String(p[col.campoTransportista] || "").trim().toLowerCase() === mail;

      const estadoAsignacion =
        String(p[col.campoAsignacion] || "").trim().toUpperCase();

      const estadoLogistico =
        String(p.ESTADO_LOGISTICO || "").trim().toUpperCase();

      if (!asignadoAMi) return false;

      if (vistaTransportistaActual === "ACTIVAS") {

        if (estadoAsignacion === "RECHAZADA") return false;
        if (estadoLogistico === col.estadoFinal) return false;

        if (col.titulo === "Retiro") {
          return ["RETIRO_PROGRAMADO", "EN_RETIRO", "RETIRADO"].includes(estadoLogistico);
        }

        if (col.titulo === "Traslado al crematorio") {
          return ["PENDIENTE_ENVIO_CREMATORIO", "EN_TRASLADO_A_CREMATORIO"].includes(estadoLogistico);
        }

        if (col.titulo === "Devolución de cenizas a sede") {
          return ["PENDIENTE_RETIRAR_CENIZAS_CREMATORIO"].includes(estadoLogistico);
        }

        if (col.titulo === "Entrega de cenizas") {
          return ["ENTREGA_PROGRAMADA_CAJA_HOMENAJE", "EN_ENTREGA_CAJA_HOMENAJE"].includes(estadoLogistico);
        }

        return false;
      }

      if (vistaTransportistaActual === "FINALIZADAS") {
        return estadoLogistico === col.estadoFinal;
      }

      return false;
    });

    return `
      <div class="column">
        <h3>${col.titulo} (${items.length})</h3>
        ${items.map(p => tarjetaTransportista(p, col)).join("")}
      </div>
    `;
  }).join("");

  document.getElementById("kanban").innerHTML = html;
}

function progresoRetiroTransportista(p) {

  const estado =
    String(p.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  const asignacion =
    String(p.RETIRO_ESTADO_ASIGNACION || "")
      .trim()
      .toUpperCase();

  const pago =
    String(p.VERIFICACION_PAGO || "")
      .trim()
      .toUpperCase();

  const puntoRetiro =
    String(p.RETIRO_PUNTO || "")
      .trim()
      .toUpperCase();

  const requiereCobro =
    puntoRetiro === "DOMICILIO" &&
    ["PENDIENTE EFECTIVO", "PENDIENTE POSNET"].includes(pago);

  const pagoCumplido =
    !requiereCobro || pago === "PAGADO";

  const formularioCumplido =
    String(p.ADJUNTO_FORMULARIO || "").trim() !== "";

  const pasos = [
    {
      texto: "Aceptar tarea",
      ok: asignacion === "ACEPTADA"
    },
    {
      texto: requiereCobro ? "Cobrar" : "Cobro no requerido",
      ok: pagoCumplido
    },
    {
      texto: "Subir formulario",
      ok: formularioCumplido
    },
    {
      texto: "Confirmar retiro",
      ok: ["RETIRADO", "EN_BASE"].includes(estado)
    },
    {
      texto: "Ingresado a base",
      ok: estado === "EN_BASE"
    }
  ];

  return `
    <div class="timeline-tarea">
      ${pasos.map(paso => `
        <div class="timeline-item ${paso.ok ? "ok" : ""}">
          <div class="timeline-punto"></div>
          <div class="timeline-texto">${paso.texto}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function tarjetaTransportista(p, col) {

  const estado =
    String(p.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase();

  const pago =
    String(p.VERIFICACION_PAGO || "SIN PAGO")
      .trim()
      .toUpperCase();

  const clasePago =
    pago === "PENDIENTE EFECTIVO" || pago === "PENDIENTE POSNET"
      ? "pago-alerta"
      : "";

  const domicilioRetiro = [
    p.RETIRO_CIUDAD,
    p.RETIRO_BARRIO,
    p.RETIRO_CALLE_NUMERO
  ]
    .filter(v => String(v || "").trim())
    .join(" - ");

  const fechaTarjeta = obtenerFechaProgramadaParaTarjeta(p);  

  return `
    <div class="pedido" onclick="verPedido('${p.ID_PEDIDO}')">
      <div class="id">${p.ID_PEDIDO}</div>
      <div class="mascota">${p.NOMBRE_MASCOTA || "Sin nombre"}</div>
      <div class="detalle">${p.PLAN || ""}</div>
      <div class="detalle">
        <strong>Ciudad:</strong>
        ${safeHtml(String(
          (esEtapaEntregaTarjeta ? p.ENTREGA_CIUDAD : p.RETIRO_CIUDAD)
          || "Sin informar"
        ))}
      </div>

      <div class="detalle">
        <strong>Peso:</strong>
        ${safeHtml(String(p.PESO ?? "").trim() || "Sin informar")}
      </div>
      <div class="detalle">${p.DUENO_NOMBRE_APELLIDO || ""}</div>
      <div class="detalle">${p.RETIRO_PUNTO || ""}</div>

      ${domicilioRetiro &&
        col.titulo !== "Traslado al crematorio" &&
        col.titulo !== "Devolución de cenizas a sede"
          ? `<div class="detalle">
              <strong>Domicilio:</strong> ${domicilioRetiro}
            </div>`
          : ""
      }

      ${fechaTarjeta && fechaTarjeta.valor ? `
        <div class="detalle">
          <strong>${fechaTarjeta.titulo}:</strong> ${fechaTarjeta.valor}
        </div>
      ` : ""}

      <div class="detalle">
        <strong>Estado:</strong> ${estado}
      </div>

      <div class="detalle ${clasePago}">
        <strong>Pago:</strong> ${pago}
      </div>

      ${
        col.titulo === "Retiro"
          ? progresoRetiroTransportista(p)
          : col.titulo === "Traslado al crematorio"
            ? progresoTrasladoTransportista(p)
            : col.titulo === "Devolución de cenizas a sede"
              ? progresoDevolucionTransportista(p)
              : col.titulo === "Entrega de cenizas"
                ? progresoEntregaTransportista(p)
                : ""
      }

      <div class="detalle">
        <span title="DNI">${tieneAdjuntoValido(p.ADJUNTO_DNI) ? "🟢🪪" : "🔴🪪"}</span>
        <span title="Formulario">${tieneAdjuntoValido(p.ADJUNTO_FORMULARIO) ? "🟢📄" : "🔴📄"}</span>

      </div>

    </div>
  `;
}

function tieneAdjuntoValido(valor) {
  const v = String(valor || "").trim();
  return v.includes("https://drive.google.com/");
}


function progresoTrasladoTransportista(p) {

  const aceptada =
    String(p.TRASLADO_ESTADO_ASIGNACION || "")
      .trim()
      .toUpperCase() === "ACEPTADA";

  const completada =
    String(p.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase() === "EN_CREMATORIO";

  return `
    <div class="timeline-tarea">

      <div class="timeline-item ${aceptada ? "ok" : ""}">
        <div class="timeline-punto"></div>
        <div class="timeline-texto">Aceptar tarea</div>
      </div>

      <div class="timeline-item ${completada ? "ok" : ""}">
        <div class="timeline-punto"></div>
        <div class="timeline-texto">Confirmar traslado</div>
      </div>

    </div>
  `;
}

function progresoDevolucionTransportista(p) {

  const aceptada =
    String(p.DEVOLUCION_ESTADO_ASIGNACION || "")
      .trim()
      .toUpperCase() === "ACEPTADA";

  const completada =
    String(p.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase() === "CENIZAS_RECIBIDAS";

  return `
    <div class="timeline-tarea">

      <div class="timeline-item ${aceptada ? "ok" : ""}">
        <div class="timeline-punto"></div>
        <div class="timeline-texto">Aceptar tarea</div>
      </div>

      <div class="timeline-item ${completada ? "ok" : ""}">
        <div class="timeline-punto"></div>
        <div class="timeline-texto">Confirmar devolución</div>
      </div>

    </div>
  `;
}

function progresoEntregaTransportista(p) {

  const aceptada =
    String(p.ENTREGA_ESTADO_ASIGNACION || "")
      .trim()
      .toUpperCase() === "ACEPTADA";

  const completada =
    String(p.ESTADO_LOGISTICO || "")
      .trim()
      .toUpperCase() === "ENTREGADO_CAJA_HOMENAJE";

  return `
    <div class="timeline-tarea">

      <div class="timeline-item ${aceptada ? "ok" : ""}">
        <div class="timeline-punto"></div>
        <div class="timeline-texto">Aceptar tarea</div>
      </div>

      <div class="timeline-item ${completada ? "ok" : ""}">
        <div class="timeline-punto"></div>
        <div class="timeline-texto">Confirmar entrega</div>
      </div>

    </div>
  `;
}

function responderTarea(idPedido, etapa, respuesta) {
  servidor()
    .withSuccessHandler(function() {
      actualizarVistaTransportistaSuave(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .responderTareaTransportista(idPedido, etapa, respuesta);
}
function confirmarRetiroPedido(idPedido) {
  if (!confirm("¿Confirmás que el retiro fue realizado?")) return;

  servidor()
    .withSuccessHandler(function() {
      actualizarVistaTransportistaSuave(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .confirmarRetiro(idPedido);
}

function confirmarTrasladoCrematorioPedido(idPedido) {
  if (!confirm("¿Confirmás que el traslado al crematorio fue realizado?")) return;

  servidor()
    .withSuccessHandler(function() {
      actualizarVistaTransportistaSuave(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .confirmarTrasladoCrematorio(idPedido);
}

function confirmarDevolucionCenizasPedido(idPedido) {
  if (!confirm("¿Confirmás que las cenizas fueron devueltas a sede?")) return;

  servidor()
    .withSuccessHandler(function() {
      actualizarVistaTransportistaSuave(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .confirmarDevolucionCenizas(idPedido);
}

function confirmarEntregaCenizasPedido(idPedido) {
  if (!confirm("¿Confirmás que las cenizas fueron entregadas al tutor?")) return;

  servidor()
    .withSuccessHandler(function() {
      actualizarVistaTransportistaSuave(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .confirmarEntregaCenizas(idPedido);
}
function cambiarVistaTransportista(vista) {
  vistaTransportistaActual = vista;
  cargarVistaTransportista();
}
function abrirCrearIncidencia(idPedido) {
  const incidencia = prompt("Describí la incidencia logística:", "");

  if (!incidencia) return;

  servidor()
    .withSuccessHandler(function() {
      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .crearIncidenciaLogistica(idPedido, incidencia);
}

function volverEstadoAnterior(idPedido) {
  if (!confirm("¿Querés volver el pedido al estado anterior?")) return;

  servidor()
    .withSuccessHandler(function() {
      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .volverEstadoAnteriorLogistico(idPedido);
}
function pasarSiguienteEstado(idPedido) {
  if (!confirm("¿Querés pasar este pedido al siguiente estado?")) return;

  servidor()
    .withSuccessHandler(function() {
      cargarPedidosSinCerrar(idPedido);
    })
    .withFailureHandler(function(error) {
      alert("Error: " + error.message);
    })
    .pasarSiguienteEstadoLogistico(idPedido);
}


function cancelarPedidoIncidencia(idPedido) {
  if (!confirm(
    "¿Confirmás que querés cancelar este pedido? " +
    "Pasará a Pedidos finalizados."
  )) {
    return;
  }

  servidor()
    .withSuccessHandler(function() {
      cerrarPedido();
      pedidoEditandoActual = null;

      // Mostrar el pedido en la vista de finalizados.
      cambiarVistaAdministrador("FINALIZADOS");
    })
    .withFailureHandler(function(error) {
      alert("No se pudo cancelar: " + error.message);
    })
    .cancelarPedidoDesdeIncidencia(idPedido);
}

