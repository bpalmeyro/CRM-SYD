// CRM "Soñar y Donar" — lógica del dashboard.
// Habla con el Apps Script (CONFIG.API_URL) definido en config.js.

let RECORDS = [];
let filtroRecordatorio = ""; // "", "overdue", "today", "week"

const OPERATOR_STORAGE_KEY = "crmOperatorEmail";

const els = {
  gate: document.getElementById("gate"),
  app: document.getElementById("app"),
  accessInput: document.getElementById("access-code-input"),
  accessBtn: document.getElementById("access-code-btn"),
  accessError: document.getElementById("access-error"),

  operatorEmail: document.getElementById("operator-email"),

  search: document.getElementById("search"),
  filterArea: document.getElementById("filter-area"),
  filterEstado: document.getElementById("filter-estado"),
  btnRefresh: document.getElementById("btn-refresh"),
  btnNew: document.getElementById("btn-new"),
  resultCount: document.getElementById("result-count"),

  tableBody: document.getElementById("table-body"),

  statTotal: document.getElementById("stat-total"),
  pipelineBar: document.getElementById("pipeline-bar"),
  pipelineLegend: document.getElementById("pipeline-legend"),

  todayPanel: document.getElementById("today-panel"),
  remOverdue: document.getElementById("rem-overdue"),
  remToday: document.getElementById("rem-today"),
  remWeek: document.getElementById("rem-week"),

  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modal-title"),
  modalClose: document.getElementById("modal-close"),
  btnCancel: document.getElementById("btn-cancel"),
  form: document.getElementById("form-record"),
  formError: document.getElementById("form-error"),
  btnSave: document.getElementById("btn-save"),

  recordatorioFecha: document.getElementById("f-recordatorioFecha"),
  recordatorioInstrucciones: document.getElementById("f-recordatorioInstrucciones"),
  recordatorioEmailPreview: document.getElementById("f-recordatorioEmailPreview"),
  reminderStatus: document.getElementById("reminder-status"),

  toastContainer: document.getElementById("toast-container")
};

// ---------------- Operador (email persistente en localStorage) ----------------

(function initOperatorEmail() {
  const saved = localStorage.getItem(OPERATOR_STORAGE_KEY) || "";
  els.operatorEmail.value = saved;
  els.operatorEmail.classList.toggle("saved", saved !== "");
  syncReminderPreview();
})();

els.operatorEmail.addEventListener("input", function () {
  localStorage.setItem(OPERATOR_STORAGE_KEY, els.operatorEmail.value.trim());
  els.operatorEmail.classList.toggle("saved", els.operatorEmail.value.trim() !== "");
  syncReminderPreview();
});

function syncReminderPreview() {
  const email = els.operatorEmail.value.trim();
  els.recordatorioEmailPreview.value = email || "";
  els.recordatorioEmailPreview.placeholder = email ? "" : "Completá tu email arriba";
}

// ---------------- Acceso ----------------

els.accessBtn.addEventListener("click", tryUnlock);
els.accessInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") tryUnlock();
});

function tryUnlock() {
  if (els.accessInput.value.trim() === CONFIG.ACCESS_CODE) {
    els.gate.classList.add("hidden");
    els.app.classList.remove("hidden");
    cargarDatos();
  } else {
    els.accessError.classList.remove("hidden");
  }
}

// ---------------- Carga de datos ----------------

// El Web App de Apps Script a veces tarda mucho (o responde error) en el
// primer pedido después de un rato sin actividad ("cold start" — es
// infraestructura de Google, no algo que podamos evitar desde acá). Como el
// siguiente intento casi siempre anda bien, reintentamos antes de mostrar un
// error real.
async function fetchConReintento(opts, intentos) {
  const maxIntentos = intentos || 2;
  let ultimoError;
  for (let i = 0; i < maxIntentos; i++) {
    try {
      const res = await fetch(CONFIG.API_URL, opts);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Error desconocido");
      return json;
    } catch (err) {
      ultimoError = err;
      if (i < maxIntentos - 1) {
        await new Promise(function (r) { setTimeout(r, 1500); });
      }
    }
  }
  throw ultimoError;
}

async function cargarDatos() {
  els.tableBody.innerHTML =
    '<tr><td colspan="7" class="loading"><span class="spinner"></span> Cargando datos...</td></tr>';
  try {
    const json = await fetchConReintento({ method: "GET" });
    RECORDS = json.data;
    poblarFiltros();
    renderTodo();
  } catch (err) {
    els.tableBody.innerHTML =
      '<tr><td colspan="7" class="empty"><span class="empty-title">No se pudo cargar la información</span>' +
      escapeHtml(err.message) +
      "</td></tr>";
  }
}

function renderTodo() {
  renderRecordatoriosPanel();
  renderPipeline();
  renderTabla();
}

els.btnRefresh.addEventListener("click", cargarDatos);
els.search.addEventListener("input", renderTabla);
els.filterArea.addEventListener("change", renderTabla);
els.filterEstado.addEventListener("change", renderTabla);

function poblarFiltros() {
  const areas = new Set();
  const estados = new Set();
  RECORDS.forEach(function (r) {
    if (r["Área / Rubro"]) areas.add(r["Área / Rubro"]);
    if (r["Estado"]) estados.add(r["Estado"]);
  });
  fillSelect(els.filterArea, areas, "Todas las áreas");
  fillSelect(els.filterEstado, estados, "Todos los estados");
}

function fillSelect(select, valuesSet, placeholder) {
  const current = select.value;
  select.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder;
  select.appendChild(opt0);

  Array.from(valuesSet).sort().forEach(function (v) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });

  select.value = current;
}

// ---------------- Recordatorios: clasificación ----------------

function parseRecordatorio(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}

// Diferencia en días de calendario (no en horas): hoy = 0, mañana = 1.
function diasDeDiferencia(fecha, ahora) {
  const a = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const b = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((a - b) / 86400000);
}

function clasificarRecordatorio(r) {
  const fecha = parseRecordatorio(r["Recordatorio Fecha"]);
  if (!fecha) return null;

  const ahora = new Date();
  const dias = diasDeDiferencia(fecha, ahora);

  let tipo;
  if (fecha < ahora && dias < 0) tipo = "overdue";
  else if (dias === 0) tipo = fecha < ahora ? "overdue" : "today";
  else if (dias <= 7) tipo = "week";
  else tipo = "far";

  return { fecha: fecha, dias: dias, tipo: tipo };
}

function etiquetaRecordatorio(info) {
  const hora = pad(info.fecha.getHours()) + ":" + pad(info.fecha.getMinutes());
  if (info.dias < 0) {
    const d = Math.abs(info.dias);
    return "Venció hace " + d + (d === 1 ? " día" : " días");
  }
  if (info.dias === 0) return (info.fecha < new Date() ? "Venció hoy " : "Hoy ") + hora;
  if (info.dias === 1) return "Mañana " + hora;
  if (info.dias <= 7) return "En " + info.dias + " días";
  return pad(info.fecha.getDate()) + "/" + pad(info.fecha.getMonth() + 1);
}

function pad(n) { return String(n).padStart(2, "0"); }

function renderRecordatoriosPanel() {
  let overdue = 0, hoy = 0, semana = 0;

  RECORDS.forEach(function (r) {
    const info = clasificarRecordatorio(r);
    if (!info) return;
    if (info.tipo === "overdue") overdue++;
    else if (info.tipo === "today") hoy++;
    else if (info.tipo === "week") semana++;
  });

  els.remOverdue.textContent = overdue;
  els.remToday.textContent = hoy;
  els.remWeek.textContent = semana;

  els.todayPanel.querySelectorAll(".today-card").forEach(function (card) {
    const tipo = card.getAttribute("data-rem");
    const valor = tipo === "overdue" ? overdue : tipo === "today" ? hoy : semana;
    card.classList.toggle("muted", valor === 0);
    card.classList.toggle("active", filtroRecordatorio === tipo);
  });
}

els.todayPanel.addEventListener("click", function (e) {
  const card = e.target.closest(".today-card");
  if (!card) return;
  const tipo = card.getAttribute("data-rem");
  filtroRecordatorio = filtroRecordatorio === tipo ? "" : tipo;
  renderRecordatoriosPanel();
  renderTabla();
});

// ---------------- Pipeline por estado ----------------

const ESTADO_CLASES = {
  "Pendiente": { badge: "badge-pendiente", color: "var(--amber)" },
  "En proceso": { badge: "badge-proceso", color: "var(--accent)" },
  "Contacto verificado": { badge: "badge-verificado", color: "var(--green)" },
  "Descartado": { badge: "badge-descartado", color: "var(--red)" },
  "A completar": { badge: "badge-otro", color: "var(--violet)" }
};

function estiloEstado(estado) {
  return ESTADO_CLASES[estado] || { badge: "badge-otro", color: "var(--text-3)" };
}

function renderPipeline() {
  const total = RECORDS.length;
  animarNumero(els.statTotal, total);

  const conteos = {};
  RECORDS.forEach(function (r) {
    const estado = r["Estado"] || "Sin estado";
    conteos[estado] = (conteos[estado] || 0) + 1;
  });

  const entradas = Object.keys(conteos)
    .map(function (estado) { return { estado: estado, n: conteos[estado] }; })
    .sort(function (a, b) { return b.n - a.n; });

  els.pipelineBar.innerHTML = entradas
    .map(function (e) {
      const pct = total ? (e.n / total) * 100 : 0;
      return (
        "<div class='pipeline-seg' style='width:" + pct.toFixed(2) + "%;background:" +
        estiloEstado(e.estado).color + "' title='" + escapeHtml(e.estado) + ": " + e.n + "'></div>"
      );
    })
    .join("");

  els.pipelineLegend.innerHTML = entradas
    .map(function (e) {
      const activo = els.filterEstado.value === e.estado ? " active" : "";
      return (
        "<button class='legend-item" + activo + "' data-estado='" + escapeHtml(e.estado) + "'>" +
        "<span class='legend-dot' style='background:" + estiloEstado(e.estado).color + "'></span>" +
        escapeHtml(e.estado) + " <strong>" + e.n + "</strong></button>"
      );
    })
    .join("");
}

els.pipelineLegend.addEventListener("click", function (e) {
  const item = e.target.closest(".legend-item");
  if (!item) return;
  const estado = item.getAttribute("data-estado");
  els.filterEstado.value = els.filterEstado.value === estado ? "" : estado;
  renderPipeline();
  renderTabla();
});

function animarNumero(el, target) {
  const start = Number(el.getAttribute("data-target")) || 0;
  el.setAttribute("data-target", target);

  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced || start === target) {
    el.textContent = target;
    return;
  }

  const duration = 450;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------------- Tabla ----------------

function renderTabla() {
  const q = els.search.value.trim().toLowerCase();
  const area = els.filterArea.value;
  const estado = els.filterEstado.value;

  const filtered = RECORDS.filter(function (r) {
    if (area && r["Área / Rubro"] !== area) return false;
    if (estado && r["Estado"] !== estado) return false;

    if (filtroRecordatorio) {
      const info = clasificarRecordatorio(r);
      if (!info || info.tipo !== filtroRecordatorio) return false;
    }

    if (q) {
      const haystack = [
        r["Institución"], r["Referente"], r["Director / Autoridad"],
        r["Email"], r["Ciudad"], r["Área / Rubro"], r["Notas"]
      ].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  els.resultCount.textContent =
    filtered.length === RECORDS.length
      ? RECORDS.length + " instituciones"
      : filtered.length + " de " + RECORDS.length;

  if (filtered.length === 0) {
    els.tableBody.innerHTML =
      '<tr><td colspan="7" class="empty"><span class="empty-title">Sin resultados</span>' +
      "Probá cambiando los filtros o el texto de búsqueda.</td></tr>";
    return;
  }

  els.tableBody.innerHTML = filtered.map(filaHtml).join("");

  els.tableBody.querySelectorAll(".row-actions button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      abrirModalEdicion(btn.getAttribute("data-id"));
    });
  });
}

function filaHtml(r) {
  const info = clasificarRecordatorio(r);
  let rowClass = "";
  if (info && info.tipo === "overdue") rowClass = " class='has-overdue'";
  else if (info && info.tipo === "today") rowClass = " class='has-today'";

  const estado = r["Estado"] || "Pendiente";
  const contactado = (r["Contactado"] || "").toString().toLowerCase();
  const fueContactado = contactado === "sí" || contactado === "si";

  return (
    "<tr" + rowClass + ">" +
    "<td class='cell-inst'>" +
      "<strong>" + escapeHtml(r["Institución"]) + "</strong>" +
      (r["Área / Rubro"] ? "<span>" + escapeHtml(r["Área / Rubro"]) + "</span>" : "") +
    "</td>" +
    "<td class='cell-person' data-label='Director'>" + personaHtml(r["Director / Autoridad"]) + "</td>" +
    "<td class='cell-person' data-label='Referente'>" + personaHtml(r["Referente"]) + "</td>" +
    "<td data-label='Contacto'>" + contactoHtml(r) + "</td>" +
    "<td data-label='Estado'>" +
      "<span class='badge " + estiloEstado(estado).badge + "'>" + escapeHtml(estado) + "</span>" +
      (fueContactado ? "<span class='contactado-flag'>✓ contactado</span>" : "") +
    "</td>" +
    "<td data-label='Recordatorio'>" + recordatorioHtml(info) + "</td>" +
    "<td class='row-actions'><button data-id='" + escapeHtml(r["ID"]) + "'>Editar</button></td>" +
    "</tr>"
  );
}

function personaHtml(valor) {
  const v = (valor || "").toString().trim();
  return v ? escapeHtml(v) : "<span class='muted'>—</span>";
}

function contactoHtml(r) {
  const email = (r["Email"] || "").toString().trim();
  const tel = (r["Teléfono"] || "").toString().trim();
  const web = (r["Web"] || "").toString().trim();

  const botones = [];
  if (email) {
    botones.push(
      "<a class='contact-btn' href='mailto:" + escapeAttr(email) + "' title='" + escapeAttr(email) + "'>✉</a>"
    );
  }
  if (tel) {
    botones.push(
      "<a class='contact-btn' href='tel:" + escapeAttr(tel.replace(/[^\d+]/g, "")) +
      "' title='" + escapeAttr(tel) + "'>✆</a>"
    );
  }
  if (web) {
    const url = /^https?:\/\//i.test(web) ? web : "https://" + web;
    botones.push(
      "<a class='contact-btn' href='" + escapeAttr(url) +
      "' target='_blank' rel='noopener' title='" + escapeAttr(web) + "'>↗</a>"
    );
  }

  return botones.length
    ? "<div class='contact-actions'>" + botones.join("") + "</div>"
    : "<span class='contact-empty'>—</span>";
}

function recordatorioHtml(info) {
  if (!info) return "<span class='rem-none'>—</span>";
  return "<span class='rem-pill " + info.tipo + "'>🔔 " + escapeHtml(etiquetaRecordatorio(info)) + "</span>";
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function isoToDatetimeLocal(iso) {
  const d = parseRecordatorio(iso);
  if (!d) return "";
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

// ---------------- Modal alta/edición ----------------

els.btnNew.addEventListener("click", abrirModalNuevo);
els.modalClose.addEventListener("click", cerrarModal);
els.btnCancel.addEventListener("click", cerrarModal);
els.modal.addEventListener("click", function (e) {
  if (e.target === els.modal) cerrarModal();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !els.modal.classList.contains("hidden")) cerrarModal();
});

let recordatorioFechaOriginal = ""; // para detectar si el operador cambió la fecha al editar

function abrirModalNuevo() {
  els.form.reset();
  document.getElementById("f-id").value = "";
  recordatorioFechaOriginal = "";
  els.reminderStatus.classList.add("hidden");
  els.modalTitle.textContent = "Nueva institución";
  els.formError.classList.add("hidden");
  syncReminderPreview();
  els.modal.classList.remove("hidden");
  document.getElementById("f-institucion").focus();
}

function abrirModalEdicion(id) {
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

  // El estado puede venir con un valor que no está en la lista fija del
  // select (la hoja tiene estados cargados a mano); lo agregamos al vuelo
  // para no pisarlo sin querer al guardar.
  const selEstado = document.getElementById("f-estado");
  const estadoActual = r["Estado"] || "Pendiente";
  if (!Array.from(selEstado.options).some(function (o) { return o.value === estadoActual; })) {
    const opt = document.createElement("option");
    opt.value = estadoActual;
    opt.textContent = estadoActual;
    selEstado.appendChild(opt);
  }
  selEstado.value = estadoActual;

  const fechaLocal = isoToDatetimeLocal(r["Recordatorio Fecha"]);
  els.recordatorioFecha.value = fechaLocal;
  recordatorioFechaOriginal = fechaLocal;
  els.recordatorioInstrucciones.value = r["Recordatorio Instrucciones"] || "";
  syncReminderPreview();

  if (fechaLocal) {
    const info = clasificarRecordatorio(r);
    els.reminderStatus.textContent = info && info.tipo === "overdue"
      ? "Recordatorio vencido. Cambiá la fecha para reprogramar la invitación de Calendar."
      : "Recordatorio programado. Si cambiás la fecha, se reprograma el evento de Calendar.";
    els.reminderStatus.className = "reminder-status " + (info && info.tipo === "overdue" ? "sent" : "pending");
    els.reminderStatus.classList.remove("hidden");
  } else {
    els.reminderStatus.classList.add("hidden");
  }

  els.modalTitle.textContent = "Editar institución";
  els.formError.classList.add("hidden");
  els.modal.classList.remove("hidden");
}

function cerrarModal() {
  els.modal.classList.add("hidden");
}

// ---------------- Toasts (avisos de guardado en segundo plano) ----------------

function showToast(message, type) {
  if (!els.toastContainer) return;
  const toast = document.createElement("div");
  toast.className = "toast" + (type ? " toast-" + type : "");
  toast.textContent = message;
  els.toastContainer.appendChild(toast);

  requestAnimationFrame(function () { toast.classList.add("show"); });

  setTimeout(function () {
    toast.classList.remove("show");
    setTimeout(function () { toast.remove(); }, 250);
  }, 4500);
}

// ---------------- Guardado ----------------

let tempIdCounter = 0;

els.form.addEventListener("submit", function (e) {
  e.preventDefault();
  els.formError.classList.add("hidden");

  const id = document.getElementById("f-id").value;
  const recordatorioFecha = els.recordatorioFecha.value.trim();
  const recordatorioInstrucciones = els.recordatorioInstrucciones.value.trim();
  const operatorEmail = els.operatorEmail.value.trim();

  if (recordatorioFecha && !operatorEmail) {
    els.formError.textContent = "Para programar un recordatorio, completá tu email arriba primero.";
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

  // Campos de recordatorio: solo los mandamos si hay algo cargado, y solo
  // reseteamos el flag "enviado" cuando la fecha efectivamente cambió.
  if (recordatorioFecha) {
    record["Email Operador"] = operatorEmail;
    record["Recordatorio Fecha"] = recordatorioFecha;
    record["Recordatorio Instrucciones"] = recordatorioInstrucciones;
    if (recordatorioFecha !== recordatorioFechaOriginal) {
      record["Recordatorio Enviado"] = "No";
    }
  } else if (recordatorioFechaOriginal) {
    // Tenía un recordatorio y lo borraron: limpiamos todo.
    record["Email Operador"] = "";
    record["Recordatorio Fecha"] = "";
    record["Recordatorio Instrucciones"] = "";
    record["Recordatorio Enviado"] = "";
  }

  const payload = id
    ? { action: "update", id: id, record: record }
    : { action: "create", record: record };

  const nombreInstitucion = record["Institución"] || "el registro";

  // Guardado optimista: actualizamos la vista YA (sin esperar al backend) y
  // cerramos el modal para poder seguir editando de una. El pedido real sigue
  // en segundo plano — si tarda o falla, se avisa con un toast en vez de
  // dejar la pantalla trabada en "Guardando...".
  const rollback = { id: id, previousRecord: null, tempId: null };

  if (id) {
    const idx = RECORDS.findIndex(function (r) { return String(r["ID"]) === String(id); });
    if (idx !== -1) {
      rollback.previousRecord = Object.assign({}, RECORDS[idx]);
      RECORDS[idx] = Object.assign({}, RECORDS[idx], record);
    }
  } else {
    rollback.tempId = "tmp-" + (++tempIdCounter);
    RECORDS.push(Object.assign({ "ID": rollback.tempId }, record));
  }
  renderTodo();

  cerrarModal();
  guardarEnSegundoPlano(payload, nombreInstitucion, rollback);
});

async function guardarEnSegundoPlano(payload, nombreInstitucion, rollback) {
  try {
    // OJO: no seteamos "Content-Type: application/json" a propósito. Si lo
    // hacemos, el navegador dispara un preflight OPTIONS que Apps Script no
    // responde, y el request se cae por CORS. Con el content-type por default
    // (text/plain) evitamos el preflight; Apps Script igual puede leer el body.
    //
    // Reintentamos automáticamente SOLO si es "update": es idempotente. En
    // "create" un reintento podría duplicar la institución si la primera
    // petición sí llegó al servidor y solo se perdió la respuesta.
    const postOpts = { method: "POST", body: JSON.stringify(payload) };

    if (payload.action === "update") {
      await fetchConReintento(postOpts);
    } else {
      const res = await fetch(CONFIG.API_URL, postOpts);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Error desconocido");
    }

    showToast((payload.action === "create" ? "Creado: " : "Guardado: ") + nombreInstitucion, "success");
    await cargarDatos();
  } catch (err) {
    // Se cayó de verdad: revertimos el cambio optimista para no mentirle a la
    // vista, y avisamos con un toast (el modal ya está cerrado).
    if (rollback.id && rollback.previousRecord) {
      const idx = RECORDS.findIndex(function (r) { return String(r["ID"]) === String(rollback.id); });
      if (idx !== -1) RECORDS[idx] = rollback.previousRecord;
    } else if (rollback.tempId) {
      RECORDS = RECORDS.filter(function (r) { return r["ID"] !== rollback.tempId; });
    }
    renderTodo();
    showToast('No se pudo guardar "' + nombreInstitucion + '": ' + err.message, "error");
  }
}
