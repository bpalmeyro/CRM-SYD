// CRM "Soñar y Donar" — lógica del dashboard.
// Habla con el Apps Script (CONFIG.API_URL) definido en config.js.

let RECORDS = [];
let unlocked = false;

const els = {
  gate: document.getElementById("gate"),
  app: document.getElementById("app"),
  accessInput: document.getElementById("access-code-input"),
  accessBtn: document.getElementById("access-code-btn"),
  accessError: document.getElementById("access-error"),

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
  btnSave: document.getElementById("btn-save")
};

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

async function cargarDatos() {
  els.tableBody.innerHTML = '<tr><td colspan="7" class="loading">Cargando datos...</td></tr>';
  try {
    const res = await fetch(CONFIG.API_URL, { method: "GET" });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Error desconocido");
    RECORDS = json.data;
    poblarFiltros();
    renderStats();
    renderTabla();
  } catch (err) {
    els.tableBody.innerHTML =
      '<tr><td colspan="7" class="empty">No se pudo cargar la información. Revisá que la URL en config.js sea correcta. (' +
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

function renderStats() {
  const total = RECORDS.length;
  const contactadas = RECORDS.filter(function (r) { return r["Contactado"] === "Sí"; }).length;
  const pendientes = RECORDS.filter(function (r) { return r["Estado"] === "Pendiente"; }).length;
  const verificado = RECORDS.filter(function (r) { return r["Estado"] === "Contacto verificado"; }).length;

  els.statTotal.textContent = total;
  els.statContactadas.textContent = contactadas;
  els.statPendientes.textContent = pendientes;
  els.statVerificado.textContent = verificado;
}

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
    els.tableBody.innerHTML = '<tr><td colspan="7" class="empty">No hay resultados con estos filtros.</td></tr>';
    return;
  }

  els.tableBody.innerHTML = filtered
    .map(function (r) {
      return (
        "<tr>" +
        "<td><strong>" + escapeHtml(r["Institución"]) + "</strong></td>" +
        "<td>" + escapeHtml(r["Área / Rubro"]) + "</td>" +
        "<td>" + escapeHtml(r["Ciudad"]) + "</td>" +
        "<td class='contact-cell'>" +
        "<strong>" + escapeHtml(r["Referente"] || r["Director / Autoridad"] || "—") + "</strong>" +
        "<span>" + escapeHtml(r["Email"] || r["Teléfono"] || "") + "</span>" +
        "</td>" +
        "<td>" + badge(r["Estado"]) + "</td>" +
        "<td>" + escapeHtml(r["Contactado"]) + "</td>" +
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

function abrirModalNuevo() {
  els.form.reset();
  document.getElementById("f-id").value = "";
  els.modalTitle.textContent = "Nueva institución";
  els.formError.classList.add("hidden");
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

  els.modalTitle.textContent = "Editar institución";
  els.formError.classList.add("hidden");
  els.modal.classList.remove("hidden");
}

function cerrarModal() {
  els.modal.classList.add("hidden");
}

els.form.addEventListener("submit", async function (e) {
  e.preventDefault();
  els.formError.classList.add("hidden");
  els.btnSave.disabled = true;
  els.btnSave.textContent = "Guardando...";

  const id = document.getElementById("f-id").value;
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

  const payload = id
    ? { action: "update", id: id, record: record }
    : { action: "create", record: record };

  try {
    // OJO: no seteamos "Content-Type: application/json" a propósito.
    // Si lo hacemos, el navegador dispara un preflight OPTIONS que Apps
    // Script no responde, y el request se cae por CORS. Con el content-type
    // por default (text/plain) evitamos el preflight; Apps Script igual
    // puede leer el body y hacer JSON.parse sin problema.
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Error desconocido");

    cerrarModal();
    await cargarDatos();
  } catch (err) {
    els.formError.textContent = "No se pudo guardar: " + err.message;
    els.formError.classList.remove("hidden");
  } finally {
    els.btnSave.disabled = false;
    els.btnSave.textContent = "Guardar";
  }
});
