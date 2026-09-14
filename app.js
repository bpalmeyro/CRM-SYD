// CRM "Soñar y Donar" — lógica del registro de instituciones.
// Habla con el Apps Script (CONFIG.API_URL) definido en config.js.

let RECORDS = [];
let filtroRecordatorio = ""; // "", "overdue", "today", "week"

const OPERATOR_KEY = "crmOperatorEmail";
const THEME_KEY = "crmTheme";

const els = {
  gate: document.getElementById("gate"),
  app: document.getElementById("app"),
  accessInput: document.getElementById("access-code-input"),
  accessBtn: document.getElementById("access-code-btn"),
  accessError: document.getElementById("access-error"),

  operatorEmail: document.getElementById("operator-email"),
  btnTheme: document.getElementById("btn-theme"),
  btnRefresh: document.getElementById("btn-refresh"),
  btnNew: document.getElementById("btn-new"),

  search: document.getElementById("search"),
  filterArea: document.getElementById("filter-area"),
  filterEstado: document.getElementById("filter-estado"),
  resultCount: document.getElementById("result-count"),

  tableBody: document.getElementById("table-body"),
  statTotal: document.getElementById("stat-total"),
  estadoBar: document.getElementById("estado-bar"),
  estadoLegend: document.getElementById("estado-legend"),

  queue: document.getElementById("queue"),
  remOverdue: document.getElementById("rem-overdue"),
  remToday: document.getElementById("rem-today"),
  remWeek: document.getElementById("rem-week"),

  drawer: document.getElementById("drawer"),
  drawerScrim: document.getElementById("drawer-scrim"),
  drawerTitle: document.getElementById("drawer-title"),
  drawerSub: document.getElementById("drawer-sub"),
  drawerClose: document.getElementById("drawer-close"),
  btnCancel: document.getElementById("btn-cancel"),
  form: document.getElementById("form-record"),
  formError: document.getElementById("form-error"),

  recordatorioFecha: document.getElementById("f-recordatorioFecha"),
  recordatorioInstrucciones: document.getElementById("f-recordatorioInstrucciones"),
  recordatorioEmailPreview: document.getElementById("f-recordatorioEmailPreview"),
  reminderStatus: document.getElementById("reminder-status"),

  notices: document.getElementById("notices")
};

// ---------------- Tema (oscuro por defecto) ----------------

const ICONO_SOL =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' +
  '<circle cx="8" cy="8" r="3.1" /><path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1' +
  'M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2L3.1 3.1" /></svg>';

const ICONO_LUNA =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" ' +
  'stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 9.6A5.9 5.9 0 0 1 6.4 2.5 5.9 5.9 0 1 0 13.5 9.6Z" /></svg>';

function aplicarTema(tema) {
  const claro = tema === "light";
  document.documentElement.setAttribute("data-theme", claro ? "light" : "dark");
  // El botón muestra el tema al que vas a cambiar.
  els.btnTheme.innerHTML = claro ? ICONO_LUNA : ICONO_SOL;
  els.btnTheme.title = claro ? "Cambiar a tema oscuro" : "Cambiar a tema claro";
  try { localStorage.setItem(THEME_KEY, claro ? "light" : "dark"); } catch (e) {}
}

(function initTema() {
  let guardado = null;
  try { guardado = localStorage.getItem(THEME_KEY); } catch (e) {}
  aplicarTema(guardado === "light" ? "light" : "dark"); // el oscuro es el principal
})();

els.btnTheme.addEventListener("click", function () {
  const esClaro = document.documentElement.getAttribute("data-theme") === "light";
  aplicarTema(esClaro ? "dark" : "light");
});

// ---------------- Operador ----------------

(function initOperador() {
  let guardado = "";
  try { guardado = localStorage.getItem(OPERATOR_KEY) || ""; } catch (e) {}
  els.operatorEmail.value = guardado;
  els.operatorEmail.classList.toggle("saved", guardado !== "");
  syncInvitacion();
})();

els.operatorEmail.addEventListener("input", function () {
  const v = els.operatorEmail.value.trim();
  try { localStorage.setItem(OPERATOR_KEY, v); } catch (e) {}
  els.operatorEmail.classList.toggle("saved", v !== "");
  syncInvitacion();
});

function syncInvitacion() {
  const email = els.operatorEmail.value.trim();
  els.recordatorioEmailPreview.value = email;
  els.recordatorioEmailPreview.placeholder = email ? "" : "Cargá tu email arriba";
}

// ---------------- Acceso ----------------

els.accessBtn.addEventListener("click", entrar);
els.accessInput.addEventListener("keydown", function (e) { if (e.key === "Enter") entrar(); });

function entrar() {
  if (els.accessInput.value.trim() === CONFIG.ACCESS_CODE) {
    els.gate.classList.add("hidden");
    els.app.classList.remove("hidden");
    cargarDatos();
  } else {
    els.accessError.classList.remove("hidden");
    els.accessInput.focus();
    els.accessInput.select();
  }
}

// ---------------- Datos ----------------

// El Web App de Apps Script tarda mucho, y a veces falla, en el primer pedido
// tras un rato inactivo ("cold start": es infraestructura de Google). El
// segundo intento casi siempre responde bien, así que reintentamos antes de
// dar un error al operador.
async function pedir(opts, intentos) {
  const max = intentos || 2;
  let ultimoError;
  for (let i = 0; i < max; i++) {
    try {
      const res = await fetch(CONFIG.API_URL, opts);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "El servidor no devolvió un motivo");
      return json;
    } catch (err) {
      ultimoError = err;
      if (i < max - 1) await new Promise(function (r) { setTimeout(r, 1500); });
    }
  }
  throw ultimoError;
}

async function cargarDatos() {
  els.tableBody.innerHTML =
    '<tr><td colspan="7" class="state-msg">' +
    '<div class="loading-line"><span class="pulse"></span> Trayendo el registro</div></td></tr>';
  try {
    const json = await pedir({ method: "GET" });
    RECORDS = json.data;
    poblarFiltros();
    dibujar();
  } catch (err) {
    els.tableBody.innerHTML =
      '<tr><td colspan="7" class="state-msg">' +
      "<p>No pudimos traer el registro</p>" +
      "<span>El servidor tardó demasiado o rechazó el pedido. Suele pasar cuando estuvo " +
      "un rato sin uso. Motivo: " + escapeHtml(err.message) + "</span>" +
      '<button class="btn btn-quiet" id="btn-reintentar">Reintentar</button></td></tr>';
    const btn = document.getElementById("btn-reintentar");
    if (btn) btn.addEventListener("click", cargarDatos);
  }
}

function dibujar() {
  dibujarCola();
  dibujarEstados();
  dibujarTabla();
}

els.btnRefresh.addEventListener("click", cargarDatos);
els.search.addEventListener("input", dibujarTabla);
els.filterArea.addEventListener("change", dibujarTabla);
els.filterEstado.addEventListener("change", function () { dibujarEstados(); dibujarTabla(); });

function poblarFiltros() {
  const areas = new Set();
  const estados = new Set();
  RECORDS.forEach(function (r) {
    if (r["Área / Rubro"]) areas.add(r["Área / Rubro"]);
    if (r["Estado"]) estados.add(r["Estado"]);
  });
  llenarSelect(els.filterArea, areas, "Todas las áreas");
  llenarSelect(els.filterEstado, estados, "Todos los estados");
}

function llenarSelect(select, valores, placeholder) {
  const actual = select.value;
  select.innerHTML = "";
  const base = document.createElement("option");
  base.value = "";
  base.textContent = placeholder;
  select.appendChild(base);
  Array.from(valores).sort().forEach(function (v) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
  select.value = actual;
}

// ---------------- Recordatorios ----------------

function parseFecha(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}

// Diferencia en días de calendario, no en horas: hoy = 0, mañana = 1.
function diasHasta(fecha, ahora) {
  const a = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const b = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((a - b) / 86400000);
}

function clasificar(r) {
  const fecha = parseFecha(r["Recordatorio Fecha"]);
  if (!fecha) return null;

  const ahora = new Date();
  const dias = diasHasta(fecha, ahora);

  let tipo;
  if (dias < 0) tipo = "overdue";
  else if (dias === 0) tipo = fecha < ahora ? "overdue" : "today";
  else if (dias <= 7) tipo = "week";
  else tipo = "far";

  return { fecha: fecha, dias: dias, tipo: tipo };
}

function pad(n) { return String(n).padStart(2, "0"); }

function textoRecordatorio(info) {
  const hora = pad(info.fecha.getHours()) + ":" + pad(info.fecha.getMinutes());
  if (info.dias < 0) {
    const d = Math.abs(info.dias);
    return { texto: "Venció hace " + d + (d === 1 ? " día" : " días"), hora: "" };
  }
  if (info.dias === 0) {
    return { texto: info.fecha < new Date() ? "Venció hoy" : "Hoy", hora: hora };
  }
  if (info.dias === 1) return { texto: "Mañana", hora: hora };
  if (info.dias <= 7) return { texto: "En " + info.dias + " días", hora: hora };
  return { texto: "", hora: pad(info.fecha.getDate()) + "/" + pad(info.fecha.getMonth() + 1) };
}

function dibujarCola() {
  let vencidos = 0, hoy = 0, semana = 0;
  RECORDS.forEach(function (r) {
    const info = clasificar(r);
    if (!info) return;
    if (info.tipo === "overdue") vencidos++;
    else if (info.tipo === "today") hoy++;
    else if (info.tipo === "week") semana++;
  });

  els.remOverdue.textContent = vencidos;
  els.remToday.textContent = hoy;
  els.remWeek.textContent = semana;

  els.queue.querySelectorAll(".queue-item").forEach(function (item) {
    const tipo = item.getAttribute("data-rem");
    const valor = tipo === "overdue" ? vencidos : tipo === "today" ? hoy : semana;
    item.classList.toggle("is-zero", valor === 0);
    item.setAttribute("aria-pressed", String(filtroRecordatorio === tipo));
  });
}

els.queue.addEventListener("click", function (e) {
  const item = e.target.closest(".queue-item");
  if (!item) return;
  const tipo = item.getAttribute("data-rem");
  filtroRecordatorio = filtroRecordatorio === tipo ? "" : tipo;
  dibujarCola();
  dibujarTabla();
});

// ---------------- Estados ----------------

const COLOR_ESTADO = {
  "Pendiente": "var(--today)",
  "En proceso": "var(--accent)",
  "Contacto verificado": "var(--verified)",
  "Descartado": "var(--overdue)",
  "A completar": "var(--ink-3)"
};

function colorEstado(estado) {
  return COLOR_ESTADO[estado] || "var(--ink-2)";
}

function dibujarEstados() {
  const total = RECORDS.length;
  els.statTotal.textContent = total;

  const conteos = {};
  RECORDS.forEach(function (r) {
    const estado = r["Estado"] || "Sin estado";
    conteos[estado] = (conteos[estado] || 0) + 1;
  });

  const filas = Object.keys(conteos)
    .map(function (e) { return { estado: e, n: conteos[e] }; })
    .sort(function (a, b) { return b.n - a.n; });

  els.estadoBar.innerHTML = filas.map(function (f) {
    const pct = total ? (f.n / total) * 100 : 0;
    return "<div class='estado-seg' style='width:" + pct.toFixed(2) + "%;background:" +
      colorEstado(f.estado) + "'></div>";
  }).join("");

  els.estadoLegend.innerHTML = filas.map(function (f) {
    const activo = els.filterEstado.value === f.estado;
    return "<button class='legend-item' data-estado='" + escapeAttr(f.estado) +
      "' aria-pressed='" + activo + "'>" +
      "<span class='legend-mark' style='background:" + colorEstado(f.estado) + "'></span>" +
      escapeHtml(f.estado) + " <b>" + f.n + "</b></button>";
  }).join("");
}

els.estadoLegend.addEventListener("click", function (e) {
  const item = e.target.closest(".legend-item");
  if (!item) return;
  const estado = item.getAttribute("data-estado");
  els.filterEstado.value = els.filterEstado.value === estado ? "" : estado;
  dibujarEstados();
  dibujarTabla();
});

// ---------------- Registro ----------------

function dibujarTabla() {
  const q = els.search.value.trim().toLowerCase();
  const area = els.filterArea.value;
  const estado = els.filterEstado.value;

  const filtrados = RECORDS.filter(function (r) {
    if (area && r["Área / Rubro"] !== area) return false;
    if (estado && r["Estado"] !== estado) return false;
    if (filtroRecordatorio) {
      const info = clasificar(r);
      if (!info || info.tipo !== filtroRecordatorio) return false;
    }
    if (q) {
      const texto = [
        r["Institución"], r["Referente"], r["Director / Autoridad"],
        r["Email"], r["Ciudad"], r["Área / Rubro"], r["Notas"]
      ].join(" ").toLowerCase();
      if (!texto.includes(q)) return false;
    }
    return true;
  });

  els.resultCount.textContent = filtrados.length === RECORDS.length
    ? RECORDS.length + " registros"
    : filtrados.length + " de " + RECORDS.length;

  if (filtrados.length === 0) {
    els.tableBody.innerHTML = vacioHtml(q);
    const btn = document.getElementById("btn-limpiar");
    if (btn) btn.addEventListener("click", limpiarFiltros);
    return;
  }

  els.tableBody.innerHTML = filtrados.map(filaHtml).join("");
  els.tableBody.querySelectorAll(".row-action button").forEach(function (btn) {
    btn.addEventListener("click", function () { abrirEdicion(btn.getAttribute("data-id")); });
  });
}

function vacioHtml(q) {
  if (RECORDS.length === 0) {
    return '<tr><td colspan="7" class="state-msg">' +
      "<p>El registro está vacío</p>" +
      "<span>Todavía no hay ninguna institución cargada.</span>" +
      '<button class="btn btn-quiet" id="btn-limpiar" hidden></button></td></tr>';
  }
  const detalle = q
    ? "Ningún registro coincide con “" + escapeHtml(q) + "”."
    : "Ningún registro coincide con los filtros activos.";
  return '<tr><td colspan="7" class="state-msg">' +
    "<p>Sin coincidencias</p><span>" + detalle + "</span>" +
    '<button class="btn btn-quiet" id="btn-limpiar">Borrar filtros</button></td></tr>';
}

function limpiarFiltros() {
  els.search.value = "";
  els.filterArea.value = "";
  els.filterEstado.value = "";
  filtroRecordatorio = "";
  dibujar();
}

function filaHtml(r) {
  const info = clasificar(r);
  let clase = "";
  if (info && info.tipo === "overdue") clase = " class='flag-overdue'";
  else if (info && info.tipo === "today") clase = " class='flag-today'";

  const estado = r["Estado"] || "Pendiente";
  const contactado = (r["Contactado"] || "").toString().toLowerCase();
  const fueContactado = contactado === "sí" || contactado === "si";

  return "<tr" + clase + ">" +
    "<td class='cell-record'>" +
      "<span class='record-name'>" + escapeHtml(r["Institución"]) + "</span>" +
      (r["Área / Rubro"] ? "<span class='record-area'>" + escapeHtml(r["Área / Rubro"]) + "</span>" : "") +
    "</td>" +
    celda(persona(r["Director / Autoridad"]), "Director", "person") +
    celda(persona(r["Referente"]), "Referente", "person") +
    celda(contactos(r), "Contacto", "") +
    "<td data-label='Estado'>" +
      "<span class='state'><span class='state-mark' style='background:" + colorEstado(estado) + "'></span>" +
      escapeHtml(estado) + "</span>" +
      (fueContactado ? "<span class='state-contacted'>Ya contactada</span>" : "") +
    "</td>" +
    celda(recordatorio(info), "Recordatorio", "") +
    "<td class='row-action'><button data-id='" + escapeAttr(r["ID"]) + "'>Editar</button></td>" +
    "</tr>";
}

// Una celda vacía en una tabla reglada ya se lee como "sin dato": repetir el
// texto 125 veces por columna solo agrega ruido. En pantallas angostas, donde
// la fila se vuelve ficha, la celda vacía se esconde entera.
function celda(contenido, etiqueta, clase) {
  const vacia = contenido === "";
  const clases = [clase, vacia ? "is-empty" : ""].filter(Boolean).join(" ");
  return "<td" + (clases ? " class='" + clases + "'" : "") +
    " data-label='" + etiqueta + "'>" + contenido + "</td>";
}

function persona(valor) {
  const v = (valor || "").toString().trim();
  return v ? escapeHtml(v) : "";
}

function contactos(r) {
  const email = (r["Email"] || "").toString().trim();
  const tel = (r["Teléfono"] || "").toString().trim();
  const web = (r["Web"] || "").toString().trim();
  const links = [];

  if (email) {
    links.push("<a href='mailto:" + escapeAttr(email) + "' title='" + escapeAttr(email) + "'>Email</a>");
  }
  if (tel) {
    links.push("<a href='tel:" + escapeAttr(tel.replace(/[^\d+]/g, "")) +
      "' title='" + escapeAttr(tel) + "'>Teléfono</a>");
  }
  if (web) {
    const url = /^https?:\/\//i.test(web) ? web : "https://" + web;
    links.push("<a href='" + escapeAttr(url) + "' target='_blank' rel='noopener' title='" +
      escapeAttr(web) + "'>Web</a>");
  }

  return links.length ? "<span class='links'>" + links.join("") + "</span>" : "";
}

function recordatorio(info) {
  if (!info) return "";
  const t = textoRecordatorio(info);
  return "<span class='rem " + info.tipo + "'>" +
    escapeHtml(t.texto) +
    (t.hora ? (t.texto ? " " : "") + "<span class='rem-time'>" + t.hora + "</span>" : "") +
    "</span>";
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function isoADatetimeLocal(iso) {
  const d = parseFecha(iso);
  if (!d) return "";
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

// ---------------- Panel de edición ----------------

els.btnNew.addEventListener("click", abrirAlta);
els.drawerClose.addEventListener("click", cerrarPanel);
els.btnCancel.addEventListener("click", cerrarPanel);
els.drawerScrim.addEventListener("click", cerrarPanel);
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !els.drawer.classList.contains("hidden")) cerrarPanel();
});

let fechaRecordatorioOriginal = ""; // para saber si el operador cambió la fecha

function abrirPanel() {
  els.drawerScrim.classList.remove("hidden");
  els.drawer.classList.remove("hidden");
}

function cerrarPanel() {
  els.drawerScrim.classList.add("hidden");
  els.drawer.classList.add("hidden");
}

function abrirAlta() {
  els.form.reset();
  document.getElementById("f-id").value = "";
  fechaRecordatorioOriginal = "";
  els.reminderStatus.classList.add("hidden");
  els.drawerTitle.textContent = "Nueva institución";
  els.drawerSub.textContent = "Completá los datos y guardá";
  els.formError.classList.add("hidden");
  syncInvitacion();
  abrirPanel();
  document.getElementById("f-institucion").focus();
}

function abrirEdicion(id) {
  const r = RECORDS.find(function (rec) { return String(rec["ID"]) === String(id); });
  if (!r) return;

  document.getElementById("f-id").value = r["ID"];
  document.getElementById("f-institucion").value = r["Institución"] || "";
  document.getElementById("f-area").value = r["Área / Rubro"] || "";
  document.getElementById("f-ciudad").value = r["Ciudad"] || "";
  document.getElementById("f-descripcion").value = r["Descripción"] || "";
  document.getElementById("f-referente").value = r["Referente"] || "";
  document.getElementById("f-director").value = r["Director / Autoridad"] || "";
  document.getElementById("f-email").value = r["Email"] || "";
  document.getElementById("f-telefono").value = r["Teléfono"] || "";
  document.getElementById("f-web").value = r["Web"] || "";
  document.getElementById("f-alcance").value = r["Alcance"] || "";
  document.getElementById("f-tiposEventos").value = r["Tipos de Eventos"] || "";
  document.getElementById("f-contactado").value = r["Contactado"] || "No";
  document.getElementById("f-fechaContacto").value = r["Fecha de contacto"] || "";
  document.getElementById("f-quienContacto").value = r["Quién contactó"] || "";
  document.getElementById("f-notas").value = r["Notas"] || "";

  // La hoja tiene estados cargados a mano que pueden no estar en la lista
  // fija; los sumamos al vuelo para no pisarlos sin querer al guardar.
  const selEstado = document.getElementById("f-estado");
  const estadoActual = r["Estado"] || "Pendiente";
  if (!Array.from(selEstado.options).some(function (o) { return o.value === estadoActual; })) {
    const opt = document.createElement("option");
    opt.value = estadoActual;
    opt.textContent = estadoActual;
    selEstado.appendChild(opt);
  }
  selEstado.value = estadoActual;

  const fechaLocal = isoADatetimeLocal(r["Recordatorio Fecha"]);
  els.recordatorioFecha.value = fechaLocal;
  fechaRecordatorioOriginal = fechaLocal;
  els.recordatorioInstrucciones.value = r["Recordatorio Instrucciones"] || "";
  syncInvitacion();

  if (fechaLocal) {
    const info = clasificar(r);
    const vencido = info && info.tipo === "overdue";
    els.reminderStatus.textContent = vencido
      ? "Este recordatorio ya venció. Poné una fecha nueva para reprogramarlo."
      : "Hay una invitación de Calendar activa para esta fecha.";
    els.reminderStatus.className = "rem-note" + (vencido ? " warn" : "");
  } else {
    els.reminderStatus.classList.add("hidden");
  }

  els.drawerTitle.textContent = r["Institución"] || "Institución";
  els.drawerSub.textContent = r["Área / Rubro"] || "Editar registro";
  els.formError.classList.add("hidden");
  abrirPanel();
}

// ---------------- Avisos ----------------

function avisar(mensaje, tipo) {
  const el = document.createElement("div");
  el.className = "notice" + (tipo ? " " + tipo : "");
  el.textContent = mensaje;
  els.notices.appendChild(el);
  requestAnimationFrame(function () { el.classList.add("show"); });
  setTimeout(function () {
    el.classList.remove("show");
    setTimeout(function () { el.remove(); }, 250);
  }, 4500);
}

// ---------------- Guardado ----------------

let contadorTemporal = 0;

els.form.addEventListener("submit", function (e) {
  e.preventDefault();
  els.formError.classList.add("hidden");

  const id = document.getElementById("f-id").value;
  const fechaRecordatorio = els.recordatorioFecha.value.trim();
  const instrucciones = els.recordatorioInstrucciones.value.trim();
  const emailOperador = els.operatorEmail.value.trim();

  if (fechaRecordatorio && !emailOperador) {
    els.formError.textContent = "Cargá tu email arriba para poder mandarte la invitación de Calendar.";
    els.formError.classList.remove("hidden");
    return;
  }

  const record = {
    "Institución": document.getElementById("f-institucion").value.trim(),
    "Área / Rubro": document.getElementById("f-area").value.trim(),
    "Ciudad": document.getElementById("f-ciudad").value.trim(),
    "Descripción": document.getElementById("f-descripcion").value.trim(),
    "Referente": document.getElementById("f-referente").value.trim(),
    "Director / Autoridad": document.getElementById("f-director").value.trim(),
    "Email": document.getElementById("f-email").value.trim(),
    "Teléfono": document.getElementById("f-telefono").value.trim(),
    "Web": document.getElementById("f-web").value.trim(),
    "Alcance": document.getElementById("f-alcance").value.trim(),
    "Tipos de Eventos": document.getElementById("f-tiposEventos").value.trim(),
    "Contactado": document.getElementById("f-contactado").value,
    "Estado": document.getElementById("f-estado").value,
    "Fecha de contacto": document.getElementById("f-fechaContacto").value.trim(),
    "Quién contactó": document.getElementById("f-quienContacto").value.trim(),
    "Notas": document.getElementById("f-notas").value.trim()
  };

  // Solo mandamos los campos del recordatorio si hay algo cargado, y solo
  // reseteamos el flag "enviado" cuando la fecha efectivamente cambió.
  if (fechaRecordatorio) {
    record["Email Operador"] = emailOperador;
    record["Recordatorio Fecha"] = fechaRecordatorio;
    record["Recordatorio Instrucciones"] = instrucciones;
    if (fechaRecordatorio !== fechaRecordatorioOriginal) record["Recordatorio Enviado"] = "No";
  } else if (fechaRecordatorioOriginal) {
    record["Email Operador"] = "";
    record["Recordatorio Fecha"] = "";
    record["Recordatorio Instrucciones"] = "";
    record["Recordatorio Enviado"] = "";
  }

  const payload = id
    ? { action: "update", id: id, record: record }
    : { action: "create", record: record };
  const nombre = record["Institución"] || "el registro";

  // Guardado optimista: actualizamos la vista y cerramos el panel enseguida
  // para poder seguir trabajando. El pedido real sigue en segundo plano; si
  // tarda o falla, avisamos, en vez de dejar la pantalla trabada.
  const rollback = { id: id, anterior: null, temporal: null };

  if (id) {
    const idx = RECORDS.findIndex(function (r) { return String(r["ID"]) === String(id); });
    if (idx !== -1) {
      rollback.anterior = Object.assign({}, RECORDS[idx]);
      RECORDS[idx] = Object.assign({}, RECORDS[idx], record);
    }
  } else {
    rollback.temporal = "tmp-" + (++contadorTemporal);
    RECORDS.push(Object.assign({ "ID": rollback.temporal }, record));
  }
  dibujar();
  cerrarPanel();
  guardarEnSegundoPlano(payload, nombre, rollback);
});

async function guardarEnSegundoPlano(payload, nombre, rollback) {
  try {
    // No seteamos "Content-Type: application/json" a propósito: dispara un
    // preflight OPTIONS que Apps Script no responde y el pedido se cae por
    // CORS. Con el content-type por default Apps Script igual lee el body.
    //
    // Reintentamos solo en "update", que es idempotente. En "create" un
    // reintento podría duplicar la institución si el primer pedido llegó al
    // servidor y solo se perdió la respuesta.
    const opts = { method: "POST", body: JSON.stringify(payload) };

    if (payload.action === "update") {
      await pedir(opts);
    } else {
      const res = await fetch(CONFIG.API_URL, opts);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "El servidor no devolvió un motivo");
    }

    avisar((payload.action === "create" ? "Creamos " : "Guardamos ") + nombre, "ok");
    await cargarDatos();
  } catch (err) {
    if (rollback.id && rollback.anterior) {
      const idx = RECORDS.findIndex(function (r) { return String(r["ID"]) === String(rollback.id); });
      if (idx !== -1) RECORDS[idx] = rollback.anterior;
    } else if (rollback.temporal) {
      RECORDS = RECORDS.filter(function (r) { return r["ID"] !== rollback.temporal; });
    }
    dibujar();
    avisar("No pudimos guardar " + nombre + ". " + err.message, "bad");
  }
}
