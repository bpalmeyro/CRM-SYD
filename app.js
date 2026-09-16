// CRM "Soñar y Donar" — lógica del registro de instituciones.
// Habla con el Apps Script (CONFIG.API_URL) definido en config.js.

let RECORDS = [];
let CONTACTOS = [];          // historial: varias entradas por institución
let abiertas = {};           // qué instituciones tienen el historial desplegado
let editando = null;         // ID de la entrada de historial en modo edición
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

// Un solo intento: lo usamos para altas, donde un reintento podría duplicar
// el registro si el primer pedido llegó y solo se perdió la respuesta.
async function pedirUnaVez(opts) {
  const res = await fetch(CONFIG.API_URL, opts);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "El servidor no devolvió un motivo");
  return json;
}

function contarHasta(el, destino) {
  const desde = Number(el.getAttribute("data-desde")) || 0;
  el.setAttribute("data-desde", destino);

  const sinMovimiento = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (sinMovimiento || desde === destino) { el.textContent = destino; return; }

  const duracion = 520;
  const inicio = performance.now();
  (function paso(ahora) {
    const avance = Math.min((ahora - inicio) / duracion, 1);
    const suave = 1 - Math.pow(1 - avance, 3);
    el.textContent = Math.round(desde + (destino - desde) * suave);
    if (avance < 1) requestAnimationFrame(paso);
  })(inicio);
}

async function cargarDatos() {
  els.tableBody.innerHTML =
    '<tr><td colspan="7" class="state-msg">' +
    '<div class="loading-line"><span class="pulse"></span> Trayendo el registro</div></td></tr>';
  try {
    const json = await pedir({ method: "GET" });
    RECORDS = json.data;
    // Si el backend todavía no tiene la hoja "Contactos", viaja vacío y el
    // historial muestra su propio estado explicándolo.
    CONTACTOS = json.contactos || [];
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
  contarHasta(els.statTotal, total);

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

  els.tableBody.innerHTML = filtrados.map(function (r, i) {
    // El retardo se acota: con 125 filas, escalonar de a 12ms sin techo
    // tardaría un segundo y medio en terminar de entrar.
    return filaHtml(r, Math.min(i * 14, 240));
  }).join("");

  els.tableBody.querySelectorAll(".row-action button").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      abrirEdicion(btn.getAttribute("data-id"));
    });
  });

  els.tableBody.querySelectorAll(".record-name").forEach(function (btn) {
    btn.addEventListener("click", function () { alternarHistorial(btn.getAttribute("data-id")); });
  });

  // Las que ya estaban desplegadas siguen desplegadas tras redibujar.
  Object.keys(abiertas).forEach(function (id) {
    if (abiertas[id]) pintarHistorial(id, true);
  });
}

// ---------------- Historial de contacto ----------------

function contactosDe(idInstitucion) {
  return CONTACTOS
    .filter(function (c) { return String(c["ID Institución"]) === String(idInstitucion); })
    .sort(function (a, b) {
      const fa = parseFecha(a["Fecha"]);
      const fb = parseFecha(b["Fecha"]);
      if (!fa && !fb) return 0;
      if (!fa) return 1;
      if (!fb) return -1;
      return fb - fa; // el contacto más reciente primero
    });
}

function alternarHistorial(id) {
  const fila = els.tableBody.querySelector(".detail-row[data-detail='" + cssEscape(id) + "']");
  if (!fila) return;

  const abierta = fila.classList.contains("open");
  abiertas[id] = !abierta;
  pintarHistorial(id, !abierta);
}

function pintarHistorial(id, abrir) {
  const fila = els.tableBody.querySelector(".detail-row[data-detail='" + cssEscape(id) + "']");
  const principal = els.tableBody.querySelector("tr.rec[data-row='" + cssEscape(id) + "']");
  if (!fila) return;

  if (abrir) {
    const cuerpo = fila.querySelector(".detail-pad");
    if (cuerpo && !cuerpo.dataset.listo) {
      cuerpo.innerHTML = historialHtml(id);
      cuerpo.dataset.listo = "1";
      enlazarHistorial(cuerpo, id);
    }
    fila.classList.add("open");
    if (principal) principal.classList.add("is-open");
  } else {
    fila.classList.remove("open");
    if (principal) principal.classList.remove("is-open");
  }
}

function refrescarHistorial(id) {
  const fila = els.tableBody.querySelector(".detail-row[data-detail='" + cssEscape(id) + "']");
  if (!fila) return;
  const cuerpo = fila.querySelector(".detail-pad");
  if (!cuerpo) return;
  cuerpo.innerHTML = historialHtml(id);
  cuerpo.dataset.listo = "1";
  enlazarHistorial(cuerpo, id);
}

function historialHtml(id) {
  const lista = contactosDe(id);
  const registro = RECORDS.find(function (r) { return String(r["ID"]) === String(id); });
  const nombre = registro ? registro["Institución"] : "esta institución";

  const cabecera =
    "<div class='log-head'><h4>Historial de contacto</h4>" +
    "<span class='log-count'>" + lista.length + (lista.length === 1 ? " registro" : " registros") +
    "</span></div>";

  let cuerpo;
  if (lista.length === 0) {
    cuerpo = "<p class='log-empty'>Todavía no registramos ningún contacto con " +
      escapeHtml(nombre) + ". Cargá el primero acá abajo.</p>";
  } else {
    cuerpo = "<ul class='log'>" + lista.map(function (c, i) {
      return editando === String(c["ID"])
        ? entradaEditableHtml(c, i)
        : entradaHtml(c, i);
    }).join("") + "</ul>";
  }

  const ahora = new Date();
  const porDefecto = ahora.getFullYear() + "-" + pad(ahora.getMonth() + 1) + "-" + pad(ahora.getDate()) +
    "T" + pad(ahora.getHours()) + ":" + pad(ahora.getMinutes());

  const alta =
    "<div class='log-form'>" +
      "<label><span>Cuándo</span><input type='datetime-local' data-campo='fecha' value='" + porDefecto + "' /></label>" +
      "<label><span>Canal</span><select data-campo='canal'>" +
        "<option>Llamada</option><option>Email</option><option>Reunión</option>" +
        "<option>WhatsApp</option><option>Sin especificar</option>" +
      "</select></label>" +
      "<label><span>Qué pasó</span><input type='text' data-campo='resumen' " +
        "placeholder='Hablamos con Loli, quedó en revisar la propuesta' /></label>" +
      "<button type='button' class='btn btn-primary' data-guardar='" + escapeAttr(id) + "'>Registrar</button>" +
    "</div>";

  return cabecera + cuerpo + alta;
}

function entradaHtml(c, i) {
  const f = parseFecha(c["Fecha"]);
  const cuando = f
    ? pad(f.getDate()) + "/" + pad(f.getMonth() + 1) + "/" + f.getFullYear() +
      "<br>" + pad(f.getHours()) + ":" + pad(f.getMinutes())
    : "Sin fecha";
  const quien = (c["Quién"] || "").toString().trim();

  return "<li class='log-entry' style='animation-delay:" + (i * 40) + "ms'>" +
    "<span class='log-when'>" + cuando + "</span>" +
    "<span class='log-what'>" +
      "<span class='log-channel'>" + escapeHtml(c["Canal"] || "Sin especificar") + "</span>" +
      "<span class='log-summary'>" + escapeHtml(c["Resumen"] || "Sin detalle cargado.") + "</span>" +
    "</span>" +
    "<span class='log-who'>" + (quien ? escapeHtml(quien) : "") +
      "<span class='log-tools'>" +
        "<button class='log-tool' data-edit='" + escapeAttr(c["ID"]) + "'>Editar</button>" +
        "<button class='log-tool danger' data-drop='" + escapeAttr(c["ID"]) + "'>Borrar</button>" +
      "</span>" +
    "</span></li>";
}

function entradaEditableHtml(c) {
  const canales = ["Llamada", "Email", "Reunión", "WhatsApp", "Sin especificar"];
  const canalActual = (c["Canal"] || "Sin especificar").toString();
  const opciones = canales.map(function (op) {
    return "<option" + (op === canalActual ? " selected" : "") + ">" + op + "</option>";
  }).join("");

  return "<li class='log-entry editing'>" +
    "<div class='log-edit'>" +
      "<label><span>Cuándo</span>" +
        "<input type='datetime-local' data-ed='fecha' value='" +
        escapeAttr(isoADatetimeLocal(c["Fecha"])) + "' /></label>" +
      "<label><span>Canal</span><select data-ed='canal'>" + opciones + "</select></label>" +
      "<label><span>Quién</span><input type='text' data-ed='quien' value='" +
        escapeAttr(c["Quién"] || "") + "' /></label>" +
      "<label class='log-edit-wide'><span>Qué pasó</span><input type='text' data-ed='resumen' value='" +
        escapeAttr(c["Resumen"] || "") + "' /></label>" +
      "<div class='log-edit-actions'>" +
        "<button type='button' class='btn btn-quiet' data-cancel='1'>Cancelar</button>" +
        "<button type='button' class='btn btn-primary' data-save='" + escapeAttr(c["ID"]) + "'>Guardar</button>" +
      "</div>" +
    "</div></li>";
}

function enlazarHistorial(cuerpo, id) {
  cuerpo.querySelectorAll("[data-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      editando = btn.getAttribute("data-edit");
      refrescarHistorial(id);
      const campo = cuerpo.querySelector("[data-ed='resumen']");
      if (campo) campo.focus();
    });
  });

  const cancelar = cuerpo.querySelector("[data-cancel]");
  if (cancelar) {
    cancelar.addEventListener("click", function () { editando = null; refrescarHistorial(id); });
  }

  const guardar = cuerpo.querySelector("[data-save]");
  if (guardar) {
    guardar.addEventListener("click", function () {
      guardarEdicionContacto(cuerpo, guardar.getAttribute("data-save"), id);
    });
    cuerpo.querySelectorAll("[data-ed]").forEach(function (campo) {
      campo.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          guardarEdicionContacto(cuerpo, guardar.getAttribute("data-save"), id);
        }
        if (e.key === "Escape") { editando = null; refrescarHistorial(id); }
      });
    });
  }

  enlazarAltaHistorial(cuerpo, id);
}

function guardarEdicionContacto(cuerpo, idContacto, idInstitucion) {
  const leer = function (campo) {
    const el = cuerpo.querySelector("[data-ed='" + campo + "']");
    return el ? el.value.trim() : "";
  };

  const resumen = leer("resumen");
  if (!resumen) {
    avisar("El contacto necesita una línea que diga qué pasó.", "bad");
    return;
  }

  const cambios = {
    "Fecha": leer("fecha"),
    "Canal": leer("canal"),
    "Quién": leer("quien"),
    "Resumen": resumen
  };

  const idx = CONTACTOS.findIndex(function (c) { return String(c["ID"]) === String(idContacto); });
  if (idx === -1) return;
  const anterior = Object.assign({}, CONTACTOS[idx]);

  CONTACTOS[idx] = Object.assign({}, anterior, cambios);
  editando = null;
  refrescarHistorial(idInstitucion);

  (async function () {
    try {
      // Editar es idempotente: reintentar no duplica nada, así que absorbemos
      // el arranque en frío del servidor sin molestar al operador.
      await pedir({
        method: "POST",
        body: JSON.stringify({ action: "updateContacto", id: idContacto, contacto: cambios })
      });
      avisar("Actualizamos el contacto", "ok");
    } catch (err) {
      CONTACTOS[idx] = anterior;
      refrescarHistorial(idInstitucion);
      avisar("No pudimos actualizar el contacto. " + err.message, "bad");
    }
  })();
}

function enlazarAltaHistorial(cuerpo, id) {
  const guardar = cuerpo.querySelector("[data-guardar]");
  if (guardar) {
    guardar.addEventListener("click", function () { registrarContacto(cuerpo, id); });
  }
  cuerpo.querySelectorAll("[data-drop]").forEach(function (btn) {
    btn.addEventListener("click", function () { borrarContacto(btn.getAttribute("data-drop"), id); });
  });
  const resumen = cuerpo.querySelector("[data-campo='resumen']");
  if (resumen) {
    resumen.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); registrarContacto(cuerpo, id); }
    });
  }
}

function registrarContacto(cuerpo, id) {
  const fecha = cuerpo.querySelector("[data-campo='fecha']").value.trim();
  const canal = cuerpo.querySelector("[data-campo='canal']").value;
  const resumen = cuerpo.querySelector("[data-campo='resumen']").value.trim();

  if (!resumen) {
    avisar("Contá en una línea qué pasó en ese contacto.", "bad");
    cuerpo.querySelector("[data-campo='resumen']").focus();
    return;
  }

  const contacto = {
    "ID Institución": id,
    "Fecha": fecha,
    "Canal": canal,
    "Quién": els.operatorEmail.value.trim(),
    "Resumen": resumen
  };

  // Lo mostramos enseguida con un ID temporal y lo mandamos en segundo plano,
  // igual que el resto del guardado.
  const temporal = Object.assign({ "ID": "tmp-c" + (++contadorTemporal) }, contacto);
  CONTACTOS.push(temporal);
  refrescarHistorial(id);

  (async function () {
    try {
      const json = await pedirUnaVez({
        method: "POST",
        body: JSON.stringify({ action: "addContacto", contacto: contacto })
      });
      const idx = CONTACTOS.indexOf(temporal);
      if (idx !== -1) CONTACTOS[idx] = Object.assign({}, temporal, { "ID": json.id });
      refrescarHistorial(id);
      avisar("Registramos el contacto", "ok");
    } catch (err) {
      CONTACTOS = CONTACTOS.filter(function (c) { return c !== temporal; });
      refrescarHistorial(id);
      avisar("No pudimos registrar el contacto. " + err.message, "bad");
    }
  })();
}

function borrarContacto(idContacto, idInstitucion) {
  const anterior = CONTACTOS.find(function (c) { return String(c["ID"]) === String(idContacto); });
  if (!anterior) return;

  CONTACTOS = CONTACTOS.filter(function (c) { return c !== anterior; });
  refrescarHistorial(idInstitucion);

  (async function () {
    try {
      await pedirUnaVez({
        method: "POST",
        body: JSON.stringify({ action: "deleteContacto", id: idContacto })
      });
      avisar("Borramos el contacto", "ok");
    } catch (err) {
      CONTACTOS.push(anterior);
      refrescarHistorial(idInstitucion);
      avisar("No pudimos borrar el contacto. " + err.message, "bad");
    }
  })();
}

// Los identificadores son numéricos, pero por las dudas de que aparezca uno
// temporal con guión, escapamos antes de meterlo en un selector.
function cssEscape(valor) {
  return String(valor).replace(/['"\\]/g, "\\$&");
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

function filaHtml(r, retardo) {
  const info = clasificar(r);
  const clases = ["rec"];
  if (info && info.tipo === "overdue") clases.push("flag-overdue");
  else if (info && info.tipo === "today") clases.push("flag-today");
  if (abiertas[r["ID"]]) clases.push("is-open");

  const estado = r["Estado"] || "Pendiente";
  const contactado = (r["Contactado"] || "").toString().toLowerCase();
  const fueContactado = contactado === "sí" || contactado === "si";
  const cuantos = contactosDe(r["ID"]).length;

  const flecha = "<svg class='chev' viewBox='0 0 10 10' fill='none' stroke='currentColor' " +
    "stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M3.5 1.5L7 5l-3.5 3.5'/></svg>";

  return "<tr class='" + clases.join(" ") + "' data-row='" + escapeAttr(r["ID"]) + "'" +
    " style='animation-delay:" + retardo + "ms'>" +
    "<td class='cell-record'>" +
      "<button type='button' class='record-name' data-id='" + escapeAttr(r["ID"]) + "'" +
      " title='Ver el historial de contacto'>" + flecha +
      "<span>" + escapeHtml(r["Institución"]) + "</span></button>" +
      (r["Área / Rubro"] || cuantos
        ? "<span class='record-area'>" + escapeHtml(r["Área / Rubro"] || "") +
          (cuantos ? (r["Área / Rubro"] ? ", " : "") + cuantos +
            (cuantos === 1 ? " contacto" : " contactos") : "") + "</span>"
        : "") +
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
    "</tr>" +
    "<tr class='detail-row" + (abiertas[r["ID"]] ? " open" : "") +
      "' data-detail='" + escapeAttr(r["ID"]) + "'>" +
      "<td colspan='7'><div class='detail-wrap'><div class='detail-inner'>" +
      "<div class='detail-pad'></div></div></div></td></tr>";
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

// Pestañas: perfil de la organización contra estado del lead.
const tabs = Array.from(document.querySelectorAll(".tab"));
const indicador = document.getElementById("tab-indicator");

function mostrarTab(nombre) {
  tabs.forEach(function (t) {
    t.setAttribute("aria-selected", String(t.getAttribute("data-tab") === nombre));
  });
  document.querySelectorAll(".tab-panel").forEach(function (p) {
    const activo = p.getAttribute("data-panel") === nombre;
    p.classList.toggle("hidden", !activo);
    if (activo) {
      // Reiniciamos la animación para que el panel entre cada vez.
      p.style.animation = "none";
      void p.offsetWidth;
      p.style.animation = "";
    }
  });
  moverIndicador();
}

function moverIndicador() {
  const activo = tabs.find(function (t) { return t.getAttribute("aria-selected") === "true"; });
  if (!activo || !indicador) return;
  indicador.style.width = activo.offsetWidth + "px";
  indicador.style.transform = "translateX(" + activo.offsetLeft + "px)";
}

tabs.forEach(function (t) {
  t.addEventListener("click", function () { mostrarTab(t.getAttribute("data-tab")); });
});
window.addEventListener("resize", moverIndicador);

let fechaRecordatorioOriginal = ""; // para saber si el operador cambió la fecha

function abrirPanel() {
  els.drawerScrim.classList.remove("hidden");
  els.drawer.classList.remove("hidden");
  // El indicador se mide recién con el panel visible: con el panel oculto
  // todos los anchos dan cero.
  mostrarTab("perfil");
  requestAnimationFrame(moverIndicador);
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
