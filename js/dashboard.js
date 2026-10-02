const SUPABASE_URL = "https://qhqrnnkuhsaszonippnj.supabase.co";
const SUPABASE_KEY = "sb_publishable_aGjT0aecqNHf96Tm7QLMtw_qjCKs5n3";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

Chart.register(ChartDataLabels);
Chart.defaults.plugins.datalabels = {
  color: "#B85F00",
  font: { family: "Inter", size: 10, weight: "600" },
  anchor: "end", align: "end", offset: 2, clamp: true,
};

let data_mant = [];
let charts = {};

const COLORS = {
  primary: "#E8830C", primaryDark: "#B85F00", primaryLight: "#F7D3A1",
  accent: "#F2B233", earth: "#5A5F6A", dark: "#2C3038", orange: "#D9620C",
  textDim: "#6B7280",
};
const PALETTE = [COLORS.primary, COLORS.accent, COLORS.primaryDark, COLORS.earth, COLORS.orange, COLORS.primaryLight];

["fechaActual1","fechaActual2","fechaActual3","fechaActual4","fechaActual5"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.textContent = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
});

// HELPERS
function col(data, clave) {
  if (!data || data.length === 0) return null;
  const keys = Object.keys(data[0]);
  return keys.find(k => k.trim().toLowerCase() === clave.trim().toLowerCase());
}
function norm(v) { return v !== undefined && v !== null ? v.toString().trim() : ""; }
function num(v) {
  if (typeof v === "number") return v;
  if (!v) return 0;
  return parseFloat(v.toString().replace(/[^0-9.-]/g, "")) || 0;
}
function tooltipStyle() {
  return { backgroundColor: "#B85F00", titleColor: "#FFFFFF", bodyColor: "#FFFFFF", borderColor: "#E8830C", borderWidth: 1, padding: 12, cornerRadius: 8 };
}
function horasEntre(inicio, fin) {
  const hi = norm(inicio), hf = norm(fin);
  if (!hi || !hf) return 0;
  const toMin = (s) => {
    const p = s.split(":");
    if (p.length < 2) return null;
    return parseInt(p[0]) * 60 + parseInt(p[1]);
  };
  let a = toMin(hi), b = toMin(hf);
  if (a === null || b === null) return 0;
  if (b < a) b += 24 * 60; // cruza medianoche
  return (b - a) / 60;
}

async function cargarHoja(nombre) {
  const TAMANO = 1000;
  let todos = [], desde = 0, seguir = true;
  while (seguir) {
    const { data, error } = await supabaseClient
      .from("dashboard_data").select("row_index, data")
      .eq("sheet_name", nombre).order("row_index", { ascending: true })
      .range(desde, desde + TAMANO - 1);
    if (error) throw error;
    if (data.length === 0) seguir = false;
    else { todos = todos.concat(data); desde += TAMANO; if (data.length < TAMANO) seguir = false; }
  }
  return todos.map(r => r.data);
}

// RENDER
function renderBar(id, labels, data, color) {
  const ctx = document.getElementById(id); if (!ctx) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: color || COLORS.primary, borderRadius: 6, borderSkipped: false, maxBarThickness: 80, categoryPercentage: 0.7, barPercentage: 0.9 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle(),
        datalabels: { anchor: "end", align: "top", formatter: v => Number(v).toLocaleString("es-PE", { maximumFractionDigits: 1 }) } },
      scales: {
        x: { ticks: { color: COLORS.textDim, font: { family: "Inter", size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: COLORS.textDim }, grid: { color: "rgba(220, 224, 230, 0.7)" }, suggestedMax: Math.max(...data) * 1.15 }
      }
    }
  });
}
function renderHBar(id, labels, data, color) {
  const ctx = document.getElementById(id); if (!ctx) return;
  if (charts[id]) charts[id].destroy();
  const wrap = ctx.parentElement;
  if (labels.length > 12) { wrap.style.maxHeight = "500px"; wrap.style.overflowY = "auto"; ctx.style.height = labels.length * 34 + "px"; ctx.style.maxHeight = "none"; }
  charts[id] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: color || COLORS.primary, borderRadius: 6, borderSkipped: false }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle(),
        datalabels: { anchor: "end", align: "right", formatter: v => Number(v).toLocaleString("es-PE", { maximumFractionDigits: 1 }) } },
      scales: {
        x: { beginAtZero: true, ticks: { color: COLORS.textDim }, grid: { color: "rgba(220, 224, 230, 0.7)" } },
        y: { ticks: { color: COLORS.primaryDark, font: { family: "Inter", size: 10 } }, grid: { display: false } }
      }
    }
  });
}
function renderDoughnut(id, labels, data) {
  const ctx = document.getElementById(id); if (!ctx) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: PALETTE.slice(0, labels.length), borderColor: "#FFFFFF", borderWidth: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "65%",
      animation: { duration: 1000, easing: "easeOutQuart" },
      plugins: {
        legend: { position: "bottom", labels: { color: COLORS.textDim, font: { family: "Inter", size: 11 }, padding: 12, usePointStyle: true, boxWidth: 8 } },
        tooltip: tooltipStyle(),
        datalabels: { color: "#FFFFFF", anchor: "center", align: "center",
          formatter: (v, ctx) => { const t = ctx.dataset.data.reduce((a, b) => a + Number(b), 0); const p = t > 0 ? (Number(v) / t) * 100 : 0; return p >= 4 ? v : ""; } }
      }
    }
  });
}
function renderLine(id, labels, datasets) {
  const ctx = document.getElementById(id); if (!ctx) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: COLORS.textDim, font: { family: "Inter", size: 11 }, usePointStyle: true, boxWidth: 8 } },
        tooltip: tooltipStyle(),
        datalabels: { display: true, align: "top", anchor: "end", offset: 4, color: "#B85F00", font: { family: "Inter", size: 10, weight: "600" }, formatter: v => Number(v).toLocaleString("es-PE", { maximumFractionDigits: 0 }) } },
      scales: {
        x: { ticks: { color: COLORS.textDim, font: { family: "Inter", size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: COLORS.textDim }, grid: { color: "rgba(220, 224, 230, 0.7)" } }
      }
    }
  });
}
function agruparYRender(data, id, columna, tipo, color) {
  if (!columna) return;
  const conteo = {};
  data.forEach(f => { const v = norm(f[columna]) || "Sin dato"; conteo[v] = (conteo[v] || 0) + 1; });
  const entries = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(e => e[0]);
  const valores = entries.map(e => e[1]);
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (charts[id]) {
    charts[id].data.labels = labels;
    charts[id].data.datasets[0].data = valores;
    charts[id].update();
    return;
  }
  if (tipo === "bar") renderBar(id, labels, valores, color);
  else if (tipo === "hbar") renderHBar(id, labels, valores, color);
  else renderDoughnut(id, labels, valores);
}
function llenarSelect(id, data, columna) {
  const select = document.getElementById(id);
  if (!select || !columna) return;
  const labelInicial = select.dataset.label || select.options[0]?.text || "Opción";
  select.dataset.label = labelInicial;
  const valorActual = select.value;
  const valores = [...new Set(data.map(f => norm(f[columna])).filter(v => v !== ""))];
  select.innerHTML = `<option value="">${labelInicial}</option>`;
  valores.sort().forEach(v => {
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = v;
    select.appendChild(opt);
  });
  if (valorActual && valores.includes(valorActual)) select.value = valorActual;
}
function marcarSegmentadorActivo(select) {
  if (!select) return;
  if (select.value) select.classList.add("activo");
  else select.classList.remove("activo");
}
function crearKPI(icono, clase, titulo, valor, sub) {
  return `<div class="kpi-card"><div class="kpi-icon-circle ${clase}"><i class="fas ${icono}"></i></div>
    <div class="kpi-content"><span class="kpi-title">${titulo}</span><span class="kpi-main">${valor}</span><span class="kpi-trend">${sub}</span></div></div>`;
}
function crearChart(id, icono, titulo, full = false) {
  return `<div class="chart-exec-card ${full ? "chart-full" : ""}"><div class="chart-exec-header"><i class="fas ${icono} chart-icon"></i><h3>${titulo}</h3></div><canvas id="${id}"></canvas></div>`;
}
function crearChartDonut(id, icono, titulo) {
  return `<div class="chart-exec-card"><div class="chart-exec-header"><i class="fas ${icono} chart-icon"></i><h3>${titulo}</h3></div><div class="chart-doughnut-wrapper"><canvas id="${id}"></canvas></div></div>`;
}

// ============ RESUMEN ============
function renderResumen() {
  const data = data_mant;
  const cTurno = col(data, "TURNO");
  const cTipo = col(data, "TIPO");
  const cSistema = col(data, "SISTEMA");
  const cFecha = col(data, "FECHA");
  const cEstado = col(data, "ESTADO DEL EQUIPO AL FINALIZAR");
  const cEquipo = col(data, "EQUIPO INTERVENIDO");

  ["rTurno","rTipo","rSistema","rFecha"].forEach(id => {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  });

  const total = data.length;
  const dia = data.filter(f => norm(f[cTurno]).toLowerCase() === "día" || norm(f[cTurno]).toLowerCase() === "dia").length;
  const noche = data.filter(f => norm(f[cTurno]).toLowerCase() === "noche").length;
  const operativos = data.filter(f => norm(f[cEstado]).toLowerCase().startsWith("operativo")).length;
  const inoperativos = data.filter(f => norm(f[cEstado]).toLowerCase().startsWith("inoperativo")).length;
  const equiposUnicos = new Set(data.map(f => norm(f[cEquipo])).filter(v => v)).size;

  document.getElementById("kpiResumen").innerHTML = `
    ${crearKPI("fa-tools", "", "Total Intervenciones", total, "Registros")}
    ${crearKPI("fa-sun", "icon-gold", "Turno Día", dia, `${((dia/total)*100 || 0).toFixed(1)}%`)}
    ${crearKPI("fa-moon", "icon-orange", "Turno Noche", noche, `${((noche/total)*100 || 0).toFixed(1)}%`)}
    ${crearKPI("fa-check-circle", "", "Operativos", operativos, "Al finalizar")}
    ${crearKPI("fa-exclamation-triangle", "icon-orange", "Inoperativos", inoperativos, "Al finalizar")}
    ${crearKPI("fa-truck", "icon-gold", "Equipos Únicos", equiposUnicos, "Intervenidos")}
  `;

  document.getElementById("chartsResumen").innerHTML = `
    ${crearChartDonut("rTurno", "fa-clock", "Intervenciones por Turno")}
    ${crearChartDonut("rTipo", "fa-layer-group", "Intervenciones por Tipo")}
    ${crearChart("rSistema", "fa-cog", "Intervenciones por Sistema", true)}
    <div class="chart-exec-card chart-full">
      <div class="chart-exec-header"><i class="fas fa-calendar chart-icon"></i><h3>Intervenciones por Fecha</h3></div>
      <canvas id="rFecha"></canvas>
    </div>
  `;

  requestAnimationFrame(() => {
    agruparYRender(data, "rTurno", cTurno, "doughnut");
    agruparYRender(data, "rTipo", cTipo, "doughnut");
    agruparYRender(data, "rSistema", cSistema, "hbar", COLORS.primary);
  });

  if (cFecha) {
    const porFecha = {};
    data.forEach(f => {
      const raw = norm(f[cFecha]);
      if (!raw) return;
      const fecha = raw.split(" ")[0];
      porFecha[fecha] = (porFecha[fecha] || 0) + 1;
    });
    const keys = Object.keys(porFecha).sort();
    renderLine("rFecha", keys, [{
      label: "Intervenciones", data: keys.map(k => porFecha[k]),
      borderColor: COLORS.primary, backgroundColor: "rgba(232, 131, 12, 0.15)",
      borderWidth: 3, tension: 0.4, pointRadius: 5, fill: true
    }]);
  }

  llenarSelect("filterTurnoR", data, cTurno);
  llenarSelect("filterTipoR", data, cTipo);
  llenarSelect("filterSistemaR", data, cSistema);

  ["filterTurnoR","filterTipoR","filterSistemaR"].forEach(id => {
    const sel = document.getElementById(id);
    if (sel && !sel.dataset.listener) {
      sel.addEventListener("change", () => { marcarSegmentadorActivo(sel); aplicarFiltrosResumen(); });
      sel.dataset.listener = "1";
    }
    marcarSegmentadorActivo(sel);
  });
}

function aplicarFiltrosResumen() {
  const t = document.getElementById("filterTurnoR").value;
  const tp = document.getElementById("filterTipoR").value;
  const s = document.getElementById("filterSistemaR").value;
  const cTurno = col(data_mant, "TURNO");
  const cTipo = col(data_mant, "TIPO");
  const cSistema = col(data_mant, "SISTEMA");
  const filtrado = data_mant.filter(f => {
    if (t && norm(f[cTurno]) !== t) return false;
    if (tp && norm(f[cTipo]) !== tp) return false;
    if (s && norm(f[cSistema]) !== s) return false;
    return true;
  });
  const backup = data_mant; data_mant = filtrado; renderResumen(); data_mant = backup;
}

// ============ EQUIPOS ============
function renderEquipos() {
  const data = data_mant;
  const cEquipo = col(data, "EQUIPO INTERVENIDO");
  const cEstado = col(data, "ESTADO DEL EQUIPO AL FINALIZAR");
  const cHorometro = col(data, "HORÓMETRO O KILOMETRAJE INICIAL");
  const cTurno = col(data, "TURNO");
  const cTipo = col(data, "TIPO");
  const cSistema = col(data, "SISTEMA");

  ["eTopEquipo","eEstado","eHorometro","eTipoEquipo"].forEach(id => {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  });

  const porEquipo = {};
  data.forEach(f => {
    const eq = norm(f[cEquipo]) || "Sin equipo";
    porEquipo[eq] = (porEquipo[eq] || 0) + 1;
  });
  const arrEq = Object.entries(porEquipo).sort((a, b) => b[1] - a[1]);
  const eqTop = arrEq[0] ? arrEq[0][0] : "-";

  const operativos = data.filter(f => norm(f[cEstado]).toLowerCase().startsWith("operativo")).length;
  const inoperativos = data.filter(f => norm(f[cEstado]).toLowerCase().startsWith("inoperativo")).length;

  document.getElementById("kpiEquipos").innerHTML = `
    ${crearKPI("fa-truck", "", "Equipos Únicos", arrEq.length, "En registros")}
    ${crearKPI("fa-fire", "icon-orange", "Equipo + Intervenido", eqTop, `${arrEq[0] ? arrEq[0][1] : 0} veces`)}
    ${crearKPI("fa-check-circle", "icon-gold", "Operativos", operativos, "Al finalizar")}
    ${crearKPI("fa-exclamation-triangle", "icon-orange", "Inoperativos", inoperativos, "Al finalizar")}
  `;

  document.getElementById("chartsEquipos").innerHTML = `
    ${crearChart("eTopEquipo", "fa-truck", "Equipos con más Intervenciones", true)}
    ${crearChartDonut("eEstado", "fa-clipboard-check", "Estado del Equipo al Finalizar")}
    ${crearChart("eHorometro", "fa-tachometer-alt", "Horómetro Promedio por Equipo")}
    ${crearChart("eTipoEquipo", "fa-layer-group", "Intervenciones por Tipo de Equipo")}
  `;

  renderHBar("eTopEquipo", arrEq.slice(0, 12).map(e => e[0]), arrEq.slice(0, 12).map(e => e[1]), COLORS.primary);

  const porEstado = {};
  data.forEach(f => {
    let est = norm(f[cEstado]) || "Sin estado";
    est = est.substring(0, 30);
    porEstado[est] = (porEstado[est] || 0) + 1;
  });
  const arrEst = Object.entries(porEstado).sort((a, b) => b[1] - a[1]);
  requestAnimationFrame(() => {
    renderDoughnut("eEstado", arrEst.map(e => e[0]), arrEst.map(e => e[1]));
  });

  // Horómetro promedio por equipo (top 10 más intervenidos)
  const horometros = {};
  data.forEach(f => {
    const eq = norm(f[cEquipo]) || "Sin equipo";
    const h = num(f[cHorometro]);
    if (!horometros[eq]) horometros[eq] = { suma: 0, n: 0 };
    if (h > 0) { horometros[eq].suma += h; horometros[eq].n++; }
  });
  const arrHor = arrEq.slice(0, 10).map(([eq]) => {
    const h = horometros[eq];
    return [eq, h && h.n > 0 ? h.suma / h.n : 0];
  });
  renderBar("eHorometro", arrHor.map(h => h[0].substring(0, 15)), arrHor.map(h => +h[1].toFixed(0)), COLORS.earth);

  const porTipo = {};
  data.forEach(f => { const t = norm(f[cTipo]) || "Sin tipo"; porTipo[t] = (porTipo[t] || 0) + 1; });
  const arrTipo = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
  renderBar("eTipoEquipo", arrTipo.map(t => t[0]), arrTipo.map(t => t[1]), COLORS.accent);

  llenarSelect("filterTurnoE", data, cTurno);
  llenarSelect("filterTipoE", data, cTipo);
  llenarSelect("filterEquipoE", data, cEquipo);

  ["filterTurnoE","filterTipoE","filterEquipoE"].forEach(id => {
    const sel = document.getElementById(id);
    if (sel && !sel.dataset.listener) {
      sel.addEventListener("change", () => { marcarSegmentadorActivo(sel); aplicarFiltrosEquipos(); });
      sel.dataset.listener = "1";
    }
    marcarSegmentadorActivo(sel);
  });
}

function aplicarFiltrosEquipos() {
  const t = document.getElementById("filterTurnoE").value;
  const tp = document.getElementById("filterTipoE").value;
  const eq = document.getElementById("filterEquipoE").value;
  const cTurno = col(data_mant, "TURNO");
  const cTipo = col(data_mant, "TIPO");
  const cEquipo = col(data_mant, "EQUIPO INTERVENIDO");
  const filtrado = data_mant.filter(f => {
    if (t && norm(f[cTurno]) !== t) return false;
    if (tp && norm(f[cTipo]) !== tp) return false;
    if (eq && norm(f[cEquipo]) !== eq) return false;
    return true;
  });
  const backup = data_mant; data_mant = filtrado; renderEquipos(); data_mant = backup;
}

// ============ SISTEMAS ============
function renderSistemas() {
  const data = data_mant;
  const cSistema = col(data, "SISTEMA");
  const cFalla = col(data, "FALLA O EVENTO REPORTADO");
  const cRepuestos = col(data, "REPUESTOS, COMPONENTES E INSUMOS UTILIZADOS");
  const cHoraIni = col(data, "HORA INICIAL DE INTERVENCIÓN");
  const cHoraFin = col(data, "HORA FINAL DE INTERVENCIÓN");
  const cTurno = col(data, "TURNO");

  ["sSistema","sTiempoProm","sFalla","sRepuestos"].forEach(id => {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  });

  // Tiempo de intervención por sistema
  const tiempoSistema = {};
  data.forEach(f => {
    const s = norm(f[cSistema]) || "Sin sistema";
    const h = horasEntre(f[cHoraIni], f[cHoraFin]);
    if (!tiempoSistema[s]) tiempoSistema[s] = { suma: 0, n: 0 };
    if (h > 0) { tiempoSistema[s].suma += h; tiempoSistema[s].n++; }
  });
  const arrTiempo = Object.entries(tiempoSistema).map(([s, v]) => [s, v.n > 0 ? v.suma / v.n : 0]).sort((a, b) => b[1] - a[1]);

  // Falla más frecuente
  const porFalla = {};
  data.forEach(f => {
    let fal = norm(f[cFalla]) || "Sin falla";
    fal = fal.split("\n")[0].substring(0, 40);
    porFalla[fal] = (porFalla[fal] || 0) + 1;
  });
  const arrFalla = Object.entries(porFalla).sort((a, b) => b[1] - a[1]);

  // Repuestos más usados
  const porRep = {};
  data.forEach(f => {
    const rep = norm(f[cRepuestos]);
    if (!rep || rep.toLowerCase() === "ninguno" || rep.toLowerCase() === "n/a") return;
    rep.split(/[\n,]/).forEach(r => {
      const limpio = r.trim().substring(0, 30);
      if (limpio) porRep[limpio] = (porRep[limpio] || 0) + 1;
    });
  });
  const arrRep = Object.entries(porRep).sort((a, b) => b[1] - a[1]);

  const sistUnicos = Object.keys(tiempoSistema).length;
  const tiempoProm = arrTiempo.length > 0 ? arrTiempo.reduce((a, b) => a + b[1], 0) / arrTiempo.length : 0;

  document.getElementById("kpiSistemas").innerHTML = `
    ${crearKPI("fa-cog", "", "Sistemas Únicos", sistUnicos, "Intervenidos")}
    ${crearKPI("fa-hourglass-half", "icon-gold", "Tiempo Prom. Intervención", tiempoProm.toFixed(2) + " h", "Global")}
    ${crearKPI("fa-bolt", "icon-orange", "Falla + Frecuente", arrFalla[0] ? arrFalla[0][0].substring(0, 22) : "-", arrFalla[0] ? `${arrFalla[0][1]} veces` : "")}
    ${crearKPI("fa-boxes-packing", "icon-gold", "Repuestos Distintos", arrRep.length, "Usados")}
  `;

  document.getElementById("chartsSistemas").innerHTML = `
    ${crearChart("sSistema", "fa-cog", "Intervenciones por Sistema")}
    ${crearChart("sTiempoProm", "fa-hourglass-half", "Tiempo Promedio por Sistema (horas)")}
    ${crearChart("sFalla", "fa-bolt", "Top 10 Fallas / Eventos")}
    ${crearChart("sRepuestos", "fa-boxes-packing", "Top 10 Repuestos más Usados")}
  `;

  const porSistema = {};
  data.forEach(f => { const s = norm(f[cSistema]) || "Sin sistema"; porSistema[s] = (porSistema[s] || 0) + 1; });
  const arrSis = Object.entries(porSistema).sort((a, b) => b[1] - a[1]);
  renderBar("sSistema", arrSis.map(s => s[0]), arrSis.map(s => s[1]), COLORS.primary);

  renderHBar("sTiempoProm", arrTiempo.map(t => t[0]), arrTiempo.map(t => +t[1].toFixed(2)), COLORS.accent);
  renderHBar("sFalla", arrFalla.slice(0, 10).map(f => f[0]), arrFalla.slice(0, 10).map(f => f[1]), COLORS.orange);
  renderHBar("sRepuestos", arrRep.slice(0, 10).map(r => r[0]), arrRep.slice(0, 10).map(r => r[1]), COLORS.primaryDark);

  llenarSelect("filterTurnoS", data, cTurno);
  llenarSelect("filterSistemaS", data, cSistema);

  ["filterTurnoS","filterSistemaS"].forEach(id => {
    const sel = document.getElementById(id);
    if (sel && !sel.dataset.listener) {
      sel.addEventListener("change", () => { marcarSegmentadorActivo(sel); aplicarFiltrosSistemas(); });
      sel.dataset.listener = "1";
    }
    marcarSegmentadorActivo(sel);
  });
}

function aplicarFiltrosSistemas() {
  const t = document.getElementById("filterTurnoS").value;
  const s = document.getElementById("filterSistemaS").value;
  const cTurno = col(data_mant, "TURNO");
  const cSistema = col(data_mant, "SISTEMA");
  const filtrado = data_mant.filter(f => {
    if (t && norm(f[cTurno]) !== t) return false;
    if (s && norm(f[cSistema]) !== s) return false;
    return true;
  });
  const backup = data_mant; data_mant = filtrado; renderSistemas(); data_mant = backup;
}

// ============ TÉCNICOS ============
function renderTecnicos() {
  const data = data_mant;
  const cTecnico = col(data, "TÉCNICOS RESPONSABLES");
  const cTurno = col(data, "TURNO");
  const cTipo = col(data, "TIPO");
  const cHoraIni = col(data, "HORA INICIAL DE INTERVENCIÓN");
  const cHoraFin = col(data, "HORA FINAL DE INTERVENCIÓN");

  ["tTecnico","tHoras"].forEach(id => {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  });

  const porTecnico = {};
  data.forEach(f => {
    const t = norm(f[cTecnico]) || "Sin técnico";
    porTecnico[t] = (porTecnico[t] || 0) + 1;
  });
  const arrTec = Object.entries(porTecnico).sort((a, b) => b[1] - a[1]);

  const horasTec = {};
  data.forEach(f => {
    const t = norm(f[cTecnico]) || "Sin técnico";
    const h = horasEntre(f[cHoraIni], f[cHoraFin]);
    if (!horasTec[t]) horasTec[t] = 0;
    horasTec[t] += h;
  });
  const arrHorasTec = arrTec.slice(0, 10).map(([t]) => [t, horasTec[t] || 0]);

  document.getElementById("kpiTecnicos").innerHTML = `
    ${crearKPI("fa-user-cog", "", "Técnicos Activos", arrTec.length, "En registros")}
    ${crearKPI("fa-trophy", "icon-gold", "Top Técnico", arrTec[0] ? arrTec[0][0] : "-", arrTec[0] ? `${arrTec[0][1]} intervenciones` : "")}
    ${crearKPI("fa-clock", "icon-orange", "Técnico + Horas", arrHorasTec[0] ? arrHorasTec[0][0] : "-", arrHorasTec[0] ? `${arrHorasTec[0][1].toFixed(1)} h` : "")}
  `;

  document.getElementById("chartsTecnicos").innerHTML = `
    ${crearChart("tTecnico", "fa-user-cog", "Intervenciones por Técnico", true)}
    ${crearChart("tHoras", "fa-clock", "Horas Totales por Técnico (Top 10)")}
    <div class="chart-exec-card chart-full">
      <div class="chart-exec-header"><i class="fas fa-list chart-icon"></i><h3>Ranking Detallado</h3></div>
      <div id="tablaRanking" class="mini-table"></div>
    </div>
  `;

  renderHBar("tTecnico", arrTec.map(t => t[0]), arrTec.map(t => t[1]), COLORS.primary);
  renderBar("tHoras", arrHorasTec.map(t => t[0].substring(0, 15)), arrHorasTec.map(t => +t[1].toFixed(2)), COLORS.accent);

  // Tabla ranking
  let html = "<table><thead><tr><th>Técnico</th><th>Intervenciones</th><th>Horas Totales</th></tr></thead><tbody>";
  arrTec.forEach(([t, n]) => {
    html += `<tr><td><strong>${t}</strong></td><td>${n}</td><td>${(horasTec[t] || 0).toFixed(2)}</td></tr>`;
  });
  html += "</tbody></table>";
  document.getElementById("tablaRanking").innerHTML = html;

  llenarSelect("filterTurnoT", data, cTurno);
  llenarSelect("filterTipoT", data, cTipo);

  ["filterTurnoT","filterTipoT"].forEach(id => {
    const sel = document.getElementById(id);
    if (sel && !sel.dataset.listener) {
      sel.addEventListener("change", () => { marcarSegmentadorActivo(sel); aplicarFiltrosTecnicos(); });
      sel.dataset.listener = "1";
    }
    marcarSegmentadorActivo(sel);
  });
}

function aplicarFiltrosTecnicos() {
  const t = document.getElementById("filterTurnoT").value;
  const tp = document.getElementById("filterTipoT").value;
  const cTurno = col(data_mant, "TURNO");
  const cTipo = col(data_mant, "TIPO");
  const filtrado = data_mant.filter(f => {
    if (t && norm(f[cTurno]) !== t) return false;
    if (tp && norm(f[cTipo]) !== tp) return false;
    return true;
  });
  const backup = data_mant; data_mant = filtrado; renderTecnicos(); data_mant = backup;
}

// ============ DETALLE ============
function renderDetalle() {
  const data = data_mant;
  const cFecha = col(data, "FECHA");
  const cTurno = col(data, "TURNO");
  const cTipo = col(data, "TIPO");
  const cEquipo = col(data, "EQUIPO INTERVENIDO");
  const cSistema = col(data, "SISTEMA");
  const cHorometro = col(data, "HORÓMETRO O KILOMETRAJE INICIAL");
  const cHoraIni = col(data, "HORA INICIAL DE INTERVENCIÓN");
  const cHoraFin = col(data, "HORA FINAL DE INTERVENCIÓN");
  const cFalla = col(data, "FALLA O EVENTO REPORTADO");
  const cTrabajos = col(data, "TRABAJOS REALIZADOS");
  const cRepuestos = col(data, "REPUESTOS, COMPONENTES E INSUMOS UTILIZADOS");
  const cObs = col(data, "OBSERVACIONES O PENDIENTES");
  const cEstado = col(data, "ESTADO DEL EQUIPO AL FINALIZAR");
  const cTecnico = col(data, "TÉCNICOS RESPONSABLES");

  let html = `<table><thead><tr>
    <th>Fecha</th><th>Turno</th><th>Tipo</th><th>Equipo</th><th>Sistema</th>
    <th>Horóm.</th><th>Hora Ini.</th><th>Hora Fin.</th><th>Dur.(h)</th>
    <th>Falla</th><th>Trabajos</th><th>Repuestos</th><th>Obs.</th><th>Estado</th><th>Técnico</th>
  </tr></thead><tbody>`;
  data.forEach(f => {
    let fecha = norm(f[cFecha]); if (fecha.includes(" ")) fecha = fecha.split(" ")[0];
    const dur = horasEntre(f[cHoraIni], f[cHoraFin]);
    html += `<tr>
      <td>${fecha || "-"}</td>
      <td>${norm(f[cTurno]) || "-"}</td>
      <td>${norm(f[cTipo]) || "-"}</td>
      <td><strong>${norm(f[cEquipo]) || "-"}</strong></td>
      <td>${norm(f[cSistema]) || "-"}</td>
      <td>${norm(f[cHorometro]) || "-"}</td>
      <td>${norm(f[cHoraIni]) || "-"}</td>
      <td>${norm(f[cHoraFin]) || "-"}</td>
      <td>${dur.toFixed(2)}</td>
      <td>${norm(f[cFalla]).substring(0, 40) || "-"}</td>
      <td>${norm(f[cTrabajos]).substring(0, 50) || "-"}</td>
      <td>${norm(f[cRepuestos]).substring(0, 40) || "-"}</td>
      <td>${norm(f[cObs]).substring(0, 30) || "-"}</td>
      <td>${norm(f[cEstado]) || "-"}</td>
      <td>${norm(f[cTecnico]) || "-"}</td>
    </tr>`;
  });
  html += "</tbody></table>";
  document.getElementById("tablaDetalle").innerHTML = html;

  llenarSelect("filterTurnoD", data, cTurno);
  llenarSelect("filterTipoD", data, cTipo);
  llenarSelect("filterSistemaD", data, cSistema);
  llenarSelect("filterTecnicoD", data, cTecnico);

  ["filterTurnoD","filterTipoD","filterSistemaD","filterTecnicoD"].forEach(id => {
    const sel = document.getElementById(id);
    if (sel && !sel.dataset.listener) {
      sel.addEventListener("change", () => { marcarSegmentadorActivo(sel); aplicarFiltrosDetalle(); });
      sel.dataset.listener = "1";
    }
    marcarSegmentadorActivo(sel);
  });
}

function aplicarFiltrosDetalle() {
  const t = document.getElementById("filterTurnoD").value;
  const tp = document.getElementById("filterTipoD").value;
  const s = document.getElementById("filterSistemaD").value;
  const tec = document.getElementById("filterTecnicoD").value;
  const cTurno = col(data_mant, "TURNO");
  const cTipo = col(data_mant, "TIPO");
  const cSistema = col(data_mant, "SISTEMA");
  const cTecnico = col(data_mant, "TÉCNICOS RESPONSABLES");
  const filtrado = data_mant.filter(f => {
    if (t && norm(f[cTurno]) !== t) return false;
    if (tp && norm(f[cTipo]) !== tp) return false;
    if (s && norm(f[cSistema]) !== s) return false;
    if (tec && norm(f[cTecnico]) !== tec) return false;
    return true;
  });
  const backup = data_mant; data_mant = filtrado; renderDetalle(); data_mant = backup;
}

// ============ NAVEGACIÓN ============
function cambiarSeccion(seccion) {
  document.querySelectorAll("#dashTabs .tab").forEach(t => t.classList.toggle("active", t.dataset.seccion === seccion));
  ["resumen","equipos","sistemas","tecnicos","detalle"].forEach(s => {
    document.getElementById(s).style.display = s === seccion ? "block" : "none";
  });
}

// ============ INIT ============
(async function init() {
  try {
    data_mant = await cargarHoja("MANTENIMIENTO");
    document.getElementById("loading").style.display = "none";
    document.getElementById("dashTabs").style.display = "flex";
    document.getElementById("resumen").style.display = "block";

    if (data_mant.length > 0) {
      renderResumen();
      renderEquipos();
      renderSistemas();
      renderTecnicos();
      renderDetalle();
    }

    document.getElementById("clearResumen").addEventListener("click", () => {
      document.querySelectorAll("#resumen .filter-select").forEach(s => s.value = "");
      document.querySelectorAll("#resumen .filter-select").forEach(marcarSegmentadorActivo);
      renderResumen();
    });
    document.getElementById("clearEquipos").addEventListener("click", () => {
      document.querySelectorAll("#equipos .filter-select").forEach(s => s.value = "");
      document.querySelectorAll("#equipos .filter-select").forEach(marcarSegmentadorActivo);
      renderEquipos();
    });
    document.getElementById("clearSistemas").addEventListener("click", () => {
      document.querySelectorAll("#sistemas .filter-select").forEach(s => s.value = "");
      document.querySelectorAll("#sistemas .filter-select").forEach(marcarSegmentadorActivo);
      renderSistemas();
    });
    document.getElementById("clearTecnicos").addEventListener("click", () => {
      document.querySelectorAll("#tecnicos .filter-select").forEach(s => s.value = "");
      document.querySelectorAll("#tecnicos .filter-select").forEach(marcarSegmentadorActivo);
      renderTecnicos();
    });
    document.getElementById("clearDetalle").addEventListener("click", () => {
      document.querySelectorAll("#detalle .filter-select").forEach(s => s.value = "");
      document.querySelectorAll("#detalle .filter-select").forEach(marcarSegmentadorActivo);
      renderDetalle();
    });

    document.querySelectorAll("#dashTabs .tab").forEach(tab => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        cambiarSeccion(tab.dataset.seccion);
      });
    });
  } catch (err) {
    console.error(err);
    document.getElementById("loading").innerHTML = `<p style="color:#D9620C;">Error al cargar: ${err.message}</p>`;
  }
})();