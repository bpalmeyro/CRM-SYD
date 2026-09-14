// CRM "Soñar y Donar" — lógica del dashboard.
// Habla con el Apps Script (CONFIG.API_URL) definido en config.js.

let RECORDS = [];
let unlocked = false;

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

  tableBody: document.getElementById("table-body"),

  statTotal: document.getElementById("stat-total"),
  statContactadas: document.getElementById("stat-contactadas"),
  statPendientes: document.getElementById("stat-pendientes"),
  statVerificado: document.getElementById("stat-verificado"),

  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modal-title"),
  modalClose: document.getElementById("modal-close"),
  form: document.getElementById("form-record"),
  formError: document.getElementById("form-error"),
  btnSave: document.getElementById("btn-save"),

  recordatorioFecha: document.getElementById("f-recordatorioFecha"),
  recordatorioInstrucciones: document.getElementById("f-recordatorioInstrucciones"),
  recordatorioEmailPreview: document.getElementById("f-recordatorioEmailPreview"),
  reminderStatus: document.getElementById("reminder-status")
};

// ---------------- Operador (email persistente en localStorage) ----------------

(function initOperatorEmail() {
  const saved = localStorage.getItem(OPERATOR_STORAGE_KEY) || "";
  els.operatorEmail.value = saved;
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
  els.recordatorioEmailPreview.placeholder = email
    ? ""
    : 'Completá "Tu email" arriba';
}

// ---------------- Acceso ----------------

els.accessBtn.addEventListener("click", tryUnlock);
els.accessInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") tryUnlock();
});

function tryUnlock() {
  const val = els.accessInput.value.trim();
  if (val === CONFIG.ACCESS_CODE) {
    unlocked = true;
    els.gate.classList.add("hidden");
    els.app.classList.remove("hidden");
    cargarDatos();
  } else {
    els.accessError.classList.remove("hidden");
  }
}

// ---------------- Carga de datos ----------------

// El Web App de Apps Script a veces tarda mucho (o incluso responde error) en
// el primer pedido después de un rato sin actividad ("cold start" — no es
// algo que podamos evitar desde acá, es infraestructura de Google). Como el
// siguiente intento casi siempre anda bien enseguida, reintentamos antes de
// mostrar un error real.
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
  els.tableBody.innerHTML = '<tr><td colspan="8" class="loading"><span class="spinner"></span> Cargando datos...</td></tr>';
  try {
    const json = await fetchConReintento({ method: "GET" });
    RECORDS = json.data;
    poblarFiltros();
    renderStats();
    renderTabla();
  } catch (err) {
    els.tableBody.innerHTML =
      '<tr><td colspan="8" class="empty">No se pudo cargar la información. Revisá que la URL en config.js sea correcta. (' +
      err.message +
      ")</td></tr>";
  }
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

  Array.from(valuesSet)
    .sort()
    .forEach(function (v) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });

  select.value = current;
}

// ---------------- Stats (con count-up) ----------------

function renderStats() {
  const total = RECORDS.length;
  const contactadas = RECORDS.filter(function (r) { return r["Contactado"] === "Sí"; }).length;
  const pendientes = RECORDS.filter(function (r) { return r["Estado"] === "Pendiente"; }).length;
  const verificado = RECORDS.filter(function (r) { return r["Estado"] === "Contacto verificado"; }).length;

  animarNumero(els.statTotal, total);
  animarNumero(els.statContactadas, contactadas);
  animarNumero(els.statPendientes, pendientes);
  animarNumero(els.statVerificado, verificado);
}

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
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = Math.round(start + (target - start) * eased);
    el.textContent = value;
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
    if (q) {
      const haystack = [
        r["Institución"],
        r["Referente"],
        r["Director / Autoridad"],
        r["Email"],
        r["Ciudad"]
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    els.tableBody.innerHTML = '<tr><td colspan="8" class="empty">No hay resultados con estos filtros.</td></tr>';
    return;
  }

  els.tableBody.innerHTML = filtered
    .map(function (r) {
      return (
        "<tr>" +
        "<td><strong>" + escapeHtml(r["Institución"]) + "</strong></td>" +
        "<td>" + escapeHtml(r["Área / Rubro"]) + "</td>" +
        "<td>" + escapeHtml(r["Director / Autoridad"] || "—") + "</td>" +
        "<td class='contact-cell'>" +
        "<strong>" + escapeHtml(r["Referente"] || "—") + "</strong>" +
        "<span>" + escapeHtml(r["Email"] || r["Teléfono"] || "") + "</span>" +
        "</td>" +
        "<td>" + badge(r["Estado"]) + "</td>" +
        "<td>" + escapeHtml(r["Contactado"]) + "</td>" +
        "<td>" + reminderCell(r) + "</td>" +
        "<td class='row-actions'><button data-id='" + r["ID"] + "'>Editar</button></td>" +
        "</tr>"
      );
    })
    .join("");

  document.querySelectorAll(".row-actions button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      abrirModalEdicion(btn.getAttribute("data-id"));
    });
  });
}

function reminderCell(r) {
  const fecha = r["Recordatorio Fecha"];
  if (!fecha) return "<span class='reminder-cell'>—</span>";
  const enviado = (r["Recordatorio Enviado"] || "").toString().toLowerCase();
  const sent = enviado === "sí" || enviado === "si";
  const label = formatearFechaCorta(fecha);
  return sent
    ? "<span class='reminder-cell sent'>✓ enviado " + label + "</span>"
    : "<span class='reminder-cell pending'>🔔 " + label + "</span>";
}

function formatearFechaCorta(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const pad = function (n) { return String(n).padStart(2, "0"); };
  return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function isoToDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = function (n) { return String(n).padStart(2, "0"); };
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function badge(estado) {
  const map = {
    "Pendiente": "badge-pendiente",
    "En proceso": "badge-proceso",
    "Contacto verificado": "badge-verificado",
    "Descartado": "badge-descartado"
  };
  const cls = map[estado] || "badge-pendiente";
  return "<span class='badge " + cls + "'>" + escapeHtml(estado || "Pendiente") + "</span>";
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------- Modal alta/edición ----------------

els.btnNew.addEventListener("click", function () { abrirModalNuevo(); });
els.modalClose.addEventListener("click", cerrarModal);
els.modal.addEventListener("click", function (e) {
  if (e.target === els.modal) cerrarModal();
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
  document.getElementById("f-estado").value = r["Estado"] || "Pendiente";
  document.getElementById("f-fechaContacto").value = r["Fecha de contacto"] || "";
  document.getElementById("f-quienContacto").value = r["Quién contactó"] || "";
  document.getElementById("f-notas").value = r["Notas"] || "";

  const fechaLocal = isoToDatetimeLocal(r["Recordatorio Fecha"]);
  els.recordatorioFecha.value = fechaLocal;
  recordatorioFechaOriginal = fechaLocal;
  els.recordatorioInstrucciones.value = r["Recordatorio Instrucciones"] || "";
  syncReminderPreview();

  const enviado = (r["Recordatorio Enviado"] || "").toString().toLowerCase();
  if (fechaLocal && (enviado === "sí" || enviado === "si")) {
    els.reminderStatus.textContent = "Este recordatorio ya se envió. Si cambiás la fecha, se vuelve a programar.";
    els.reminderStatus.className = "reminder-status sent";
    els.reminderStatus.classList.remove("hidden");
  } else if (fechaLocal) {
    els.reminderStatus.textContent = "Recordatorio programado, todavía no se envió.";
    els.reminderStatus.className = "reminder-status pending";
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

const toastContainer = document.getElementById("toast-container");

function showToast(message, type) {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = "toast" + (type ? " toast-" + type : "");
  toast.textContent = message;
  toastContainer.appendChild(toast);

  requestAnimationFrame(function () { toast.classList.add("show"); });

  setTimeout(function () {
    toast.classList.remove("show");
    setTimeout(function () { toast.remove(); }, 250);
  }, 4500);
}

let tempIdCounter = 0;

els.form.addEventListener("submit", function (e) {
  e.preventDefault();
  els.formError.classList.add("hidden");

  const id = document.getElementById("f-id").value;
  const recordatorioFecha = els.recordatorioFecha.value.trim();
  const recordatorioInstrucciones = els.recordatorioInstrucciones.value.trim();
  const operatorEmail = els.operatorEmail.value.trim();

  if (recordatorioFecha && !operatorEmail) {
    els.formError.textContent = 'Para programar un recordatorio, completá "Tu email" arriba a la derecha primero.';
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
  // reseteamos el flag "enviado" cuando la fecha efectivamente cambió — así
  // no revivimos recordatorios ya enviados con cada edición de la fila.
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

  // Guardado optimista: actualizamos la tabla YA (sin esperar al backend) y
  // cerramos el modal para poder seguir editando de una. El pedido real
  // sigue en segundo plano — si tarda o falla, se avisa con un toast en vez
  // de dejar la pantalla trabada en "Guardando...".
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
  renderStats();
  renderTabla();

  cerrarModal();
  guardarEnSegundoPlano(payload, nombreInstitucion, rollback);
});

async function guardarEnSegundoPlano(payload, nombreInstitucion, rollback) {
  try {
    // OJO: no seteamos "Content-Type: application/json" a propósito.
    // Si lo hacemos, el navegador dispara un preflight OPTIONS que Apps
    // Script no responde, y el request se cae por CORS. Con el content-type
    // por default (text/plain) evitamos el preflight; Apps Script igual
    // puede leer el body y hacer JSON.parse sin problema.
    //
    // Reintentamos automáticamente SOLO si es "update": es idempotente (volver
    // a mandar los mismos datos no rompe nada), así absorbemos el cold-start
    // típico de Apps Script sin mostrar un error al pedo. "create" NO se
    // reintenta solo: si la primera petición en realidad sí llegó a crear la
    // fila del lado del servidor y nosotros no nos enteramos por un cold
    // start, reintentar crearía una institución duplicada — mejor mostrar el
    // error real y que el usuario decida si reintenta a mano.
    const postOpts = { method: "POST", body: JSON.stringify(payload) };
    const json = payload.action === "update"
      ? await fetchConReintento(postOpts)
      : await (async function () {
          const res = await fetch(CONFIG.API_URL, postOpts);
          const j = await res.json();
          if (!j.ok) throw new Error(j.error || "Error desconocido");
          return j;
        })();

    showToast((payload.action === "create" ? "Creado: " : "Guardado: ") + nombreInstitucion, "success");
    await cargarDatos();
  } catch (err) {
    // Se cayó de verdad: revertimos el cambio optimista para no mentirle a
    // la tabla, y avisamos con un toast (el modal ya está cerrado).
    if (rollback.id && rollback.previousRecord) {
      const idx = RECORDS.findIndex(function (r) { return String(r["ID"]) === String(rollback.id); });
      if (idx !== -1) RECORDS[idx] = rollback.previousRecord;
    } else if (rollback.tempId) {
      RECORDS = RECORDS.filter(function (r) { return r["ID"] !== rollback.tempId; });
    }
    renderStats();
    renderTabla();
    showToast('No se pudo guardar "' + nombreInstitucion + '": ' + err.message, "error");
  }
}
