<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>CRM Soñar y Donar</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="style.css" />
</head>
<body>

  <!-- Acceso -->
  <div id="gate" class="gate">
    <div class="gate-card">
      <h1>Soñar y Donar</h1>
      <p class="slogan">Soñemos por un mundo mejor.</p>
      <p>Registro de fundaciones e instituciones para el pipeline comercial.</p>
      <label for="access-code-input">Código de acceso</label>
      <input type="password" id="access-code-input" autocomplete="off" />
      <button id="access-code-btn" class="btn btn-primary">Entrar</button>
      <p id="access-error" class="gate-error hidden">El código no es correcto. Revisalo y probá de nuevo.</p>
    </div>
  </div>

  <!-- Aplicación -->
  <div id="app" class="app hidden">

    <header class="topbar">
      <div class="wordmark">
        Soñar y Donar
        <em>Registro de instituciones</em>
      </div>
      <div class="topbar-right">
        <div class="operator">
          <input type="email" id="operator-email" placeholder="Tu email" autocomplete="email"
                 title="Recibís acá las invitaciones de Calendar de los recordatorios que cargues" />
        </div>
        <button id="btn-theme" class="icon-btn" title="Cambiar a tema claro" aria-label="Cambiar tema"></button>
        <button id="btn-refresh" class="icon-btn" title="Recargar datos" aria-label="Recargar datos">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 8a6 6 0 1 1-1.8-4.3" /><path d="M14 2v3.5h-3.5" />
          </svg>
        </button>
        <button id="btn-new" class="btn btn-primary">Nueva institución</button>
      </div>
    </header>

    <!-- Banda de trabajo -->
    <section class="worklane">
      <div class="worklane-total">
        <div class="figure-row">
          <span class="figure" id="stat-total">0</span>
          <span class="figure-label">instituciones registradas</span>
        </div>
        <div class="estado-bar" id="estado-bar"></div>
        <div class="estado-legend" id="estado-legend"></div>
      </div>
      <div class="worklane-queue" id="queue">
        <button class="queue-item is-overdue" data-rem="overdue" aria-pressed="false">
          <span class="queue-figure" id="rem-overdue">0</span>
          <span class="queue-label">vencidos</span>
        </button>
        <button class="queue-item is-today" data-rem="today" aria-pressed="false">
          <span class="queue-figure" id="rem-today">0</span>
          <span class="queue-label">para hoy</span>
        </button>
        <button class="queue-item" data-rem="week" aria-pressed="false">
          <span class="queue-figure" id="rem-week">0</span>
          <span class="queue-label">próximos 7 días</span>
        </button>
      </div>
    </section>

    <!-- Filtros -->
    <section class="filters">
      <input type="search" id="search" placeholder="Buscar institución, director, referente o email" />
      <select id="filter-area"><option value="">Todas las áreas</option></select>
      <select id="filter-estado"><option value="">Todos los estados</option></select>
      <span class="count" id="result-count"></span>
    </section>

    <!-- Registro -->
    <section class="plane">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Institución</th>
              <th>Director o autoridad</th>
              <th>Referente</th>
              <th>Contacto</th>
              <th>Estado</th>
              <th>Recordatorio</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="table-body">
            <tr><td colspan="7" class="state-msg">
              <div class="loading-line"><span class="pulse"></span> Trayendo el registro</div>
            </td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <footer class="app-foot">
      <span>Soñemos por un mundo mejor.</span>
      <span class="foot-org">Argenprom</span>
    </footer>
  </div>

  <!-- Panel de edición -->
  <div id="drawer-scrim" class="drawer-scrim hidden"></div>
  <aside id="drawer" class="drawer hidden" aria-label="Editar institución">
    <div class="drawer-head">
      <div>
        <h2 id="drawer-title">Nueva institución</h2>
        <span class="sub" id="drawer-sub">Completá los datos y guardá</span>
      </div>
      <button id="drawer-close" class="icon-btn" aria-label="Cerrar">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>

    <div class="tabs" role="tablist">
      <button type="button" class="tab" data-tab="perfil" role="tab" aria-selected="true">
        Perfil de la organización
      </button>
      <button type="button" class="tab" data-tab="estado" role="tab" aria-selected="false">
        Estado del lead
      </button>
      <span class="tab-indicator" id="tab-indicator"></span>
    </div>

    <form id="form-record">
      <div class="drawer-body">

        <!-- Perfil: quién es la organización (columnas B a L de la hoja) -->
        <div class="tab-panel" data-panel="perfil">
          <div class="group">
            <h3 class="group-name">Identidad</h3>
            <label class="field"><span>Nombre</span>
              <input type="text" id="f-institucion" required />
            </label>
            <div class="pair">
              <label class="field"><span>Área o rubro</span><input type="text" id="f-area" /></label>
              <label class="field"><span>Ciudad</span><input type="text" id="f-ciudad" /></label>
            </div>
            <label class="field"><span>Descripción</span>
              <textarea id="f-descripcion" rows="2"></textarea>
            </label>
            <div class="pair">
              <label class="field"><span>Alcance</span>
                <input type="text" id="f-alcance" placeholder="Nacional, regional o local" />
              </label>
              <label class="field"><span>Tipos de eventos</span><input type="text" id="f-tiposEventos" /></label>
            </div>
          </div>

          <div class="group">
            <h3 class="group-name">Personas</h3>
            <p class="group-note">El director es la máxima autoridad de la institución. El referente es la
              persona con la que hablamos nosotros. Pueden no ser la misma.</p>
            <div class="pair">
              <label class="field"><span>Director o autoridad</span><input type="text" id="f-director" /></label>
              <label class="field"><span>Referente</span><input type="text" id="f-referente" /></label>
            </div>
            <div class="pair">
              <label class="field"><span>Email</span><input type="email" id="f-email" /></label>
              <label class="field"><span>Teléfono</span><input type="text" id="f-telefono" /></label>
            </div>
            <label class="field"><span>Sitio web</span><input type="text" id="f-web" /></label>
          </div>
        </div>

        <!-- Estado del lead: cómo va nuestra gestión (columna M en adelante) -->
        <div class="tab-panel hidden" data-panel="estado">
          <div class="group">
            <h3 class="group-name">Situación</h3>
            <div class="pair">
              <label class="field"><span>Estado</span>
                <select id="f-estado">
                  <option value="Pendiente">Pendiente</option>
                  <option value="En proceso">En proceso</option>
                  <option value="Contacto verificado">Contacto verificado</option>
                  <option value="A completar">A completar</option>
                  <option value="Descartado">Descartado</option>
                </select>
              </label>
              <label class="field"><span>Contactado</span>
                <select id="f-contactado">
                  <option value="No">No</option>
                  <option value="Sí">Sí</option>
                </select>
              </label>
            </div>
            <div class="pair">
              <label class="field"><span>Primer contacto</span>
                <input type="text" id="f-fechaContacto" placeholder="dd/mm/aaaa" />
              </label>
              <label class="field"><span>Quién contactó</span><input type="text" id="f-quienContacto" /></label>
            </div>
            <label class="field"><span>Notas generales</span>
              <textarea id="f-notas" rows="3"></textarea>
            </label>
            <p class="group-note">El detalle de cada llamada o reunión va en el historial, que se abre
              haciendo clic sobre la institución en el registro.</p>
          </div>

          <div class="group">
            <h3 class="group-name">Recordatorio</h3>
            <p class="group-note">Al guardar se crea una invitación en Google Calendar con esta fecha.
              Si la cambiás, se reprograma.</p>
            <div class="pair">
              <label class="field"><span>Recordarme el</span>
                <input type="datetime-local" id="f-recordatorioFecha" />
              </label>
              <label class="field"><span>Invitación para</span>
                <input type="email" id="f-recordatorioEmailPreview" disabled />
              </label>
            </div>
            <label class="field"><span>Qué tengo que hacer</span>
              <textarea id="f-recordatorioInstrucciones" rows="2"
                        placeholder="Llamar a Juan para confirmar la reunión"></textarea>
            </label>
            <p class="rem-note hidden" id="reminder-status"></p>
          </div>
        </div>

        <input type="hidden" id="f-id" />
      </div>

      <div class="drawer-foot">
        <span id="form-error" class="form-error hidden"></span>
        <button type="button" class="btn btn-quiet" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="btn-save">Guardar</button>
      </div>
    </form>
  </aside>

  <div id="notices" class="notices" aria-live="polite"></div>

  <script src="config.js"></script>
  <script src="app.js"></script>
</body>
</html>
