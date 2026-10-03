/* ==========================================================
   Dashboard Transporte de Materiales — Volquetes
   ========================================================== */

const SUPABASE_URL = "https://qhqrnnkuhsaszonippnj.supabase.co";
const SUPABASE_KEY = "sb_publishable_aGjT0aecqNHf96Tm7QLMtw_qjCKs5n3";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const C = {
  cyan: "#FFC93C", blue: "#F5A524", orange: "#E8590C", green: "#37B24D", purple: "#A06BFF",
  other: "#3A4766", text: "#F5F6F8", dim: "#9CA3AF", faint: "#6B7280",
  grid: "rgba(156, 163, 175, 0.10)", panel: "#101217",
};
const PALETTE = [C.cyan, C.orange, C.green, C.purple, C.blue];

Chart.register(ChartDataLabels);
Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = C.dim;
Chart.defaults.animation.duration = 450;
Chart.defaults.plugins.datalabels.display = false;
Chart.defaults.plugins.legend.display = false;

const state = { transporte: [] };
const cols = {};
const charts = {};
let ultimo = [];
let listenersReady = false;

const fmt = (v, d = 0) => Number(v).toLocaleString("es-PE", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const round = (v, d = 2) => Number(Number(v).toFixed(d));
const clamp = (v, a = 0, b = 100) => Math.min(b, Math.max(a, v));
const truncar = (s, n = 30) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const $ = (id) => document.getElementById(id);

function col(data, clave) {
  if (!data || data.length === 0) return null;
  const keys = Object.keys(data[0]);
  return keys.find((k) => k.trim().toLowerCase() === clave.trim().toLowerCase());
}
function norm(v) { return v !== undefined && v !== null ? v.toString().trim() : ""; }
function num(v) {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const s = v.toString().replace(",", ".").replace(/[^0-9.-]/g, "");
  return parseFloat(s) || 0;
}
function sumBy(data, keyFn, valFn) {
  const out = {};
  data.forEach((f) => {
    const k = keyFn(f);
    if (k === null) return;
    out[k] = (out[k] || 0) + valFn(f);
  });
  return out;
}
function hexRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
function topN(obj, n, agrupar = true) {
  const arr = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const top = arr.slice(0, n);
  if (agrupar && arr.length > n) {
    const resto = arr.slice(n).reduce((a, e) => a + e[1], 0);
    if (resto > 0) top.push(["Otros", resto]);
  }
  return top;
}
const argmax = (arr) => arr.reduce((bi, v, i) => (v > arr[bi] ? i : bi), 0);
const argmin = (arr) => arr.reduce((bi, v, i) => (v < arr[bi] ? i : bi), 0);

/* Turno: la fecha tiene hora. Turno Día = 06:00–17:59, Turno Noche = 18:00–05:59 */
function getTurno(fechaStr) {
  const s = norm(fechaStr);
  if (!s) return "Sin turno";
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return "Sin turno";
  const h = parseInt(m[1]);
  return (h >= 6 && h < 18) ? "DIA" : "NOCHE";
}
/* Día: extrae YYYY-MM-DD */
function getDia(fechaStr) {
  const s = norm(fechaStr);
  if (!s) return "Sin fecha";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s.split(" ")[0];
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
  return todos.map((r) => r.data);
}

/* ---------- Plugins ---------- */
const centerText = {
  id: "centerText",
  afterDraw(chart, _args, opts) {
    if (!opts || !opts.title) return;
    const { ctx, chartArea: a } = chart;
    const x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = C.text; ctx.font = "700 26px Sora, sans-serif";
    ctx.fillText(opts.title, x, y - 8);
    ctx.fillStyle = C.dim; ctx.font = "500 11px 'IBM Plex Sans', sans-serif";
    ctx.fillText(opts.sub || "", x, y + 16);
    ctx.restore();
  },
};
const avgLine = {
  id: "avgLine",
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || opts.value === undefined || opts.value === null) return;
    const y = chart.scales.y.getPixelForValue(opts.value);
    const { left, right, top, bottom } = chart.chartArea;
    if (y < top || y > bottom) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = C.orange; ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "600 10.5px 'IBM Plex Sans', sans-serif";
    const w = ctx.measureText(opts.label).width + 16, h = 20;
    const x = right - w, ty = Math.max(top, y - h - 5);
    ctx.fillStyle = "rgba(16, 18, 23, 0.95)"; ctx.strokeStyle = C.orange; ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, ty, w, h, 6); else ctx.rect(x, ty, w, h);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.orange; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(opts.label, x + w / 2, ty + h / 2 + 0.5);
    ctx.restore();
  },
};

function tooltipStyle() {
  return {
    backgroundColor: "#070B16", titleColor: C.text, bodyColor: C.text,
    borderColor: "#27345A", borderWidth: 1, padding: 10, cornerRadius: 8, boxPadding: 4,
    callbacks: {
      label: (c) => {
        const v = typeof c.parsed === "number" ? c.parsed : c.chart.options.indexAxis === "y" ? c.parsed.x : c.parsed.y;
        return ` ${c.dataset.label ? c.dataset.label + ": " : c.label ? c.label + ": " : ""}${fmt(v, 2)}`;
      },
    },
  };
}
function mount(id, config) {
  const canvas = $(id);
  if (!canvas) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  const vacio = !config.data.labels || config.data.labels.length === 0;
  canvas.parentElement.classList.toggle("is-empty", vacio);
  if (vacio) return;
  charts[id] = new Chart(canvas, config);
}
function gradV(c1, c2) {
  return (ctx) => {
    const a = ctx.chart.chartArea;
    if (!a) return c1;
    const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    return g;
  };
}
function gradH(c1, c2) {
  return (ctx) => {
    const a = ctx.chart.chartArea;
    if (!a) return c1;
    const g = ctx.chart.ctx.createLinearGradient(a.left, 0, a.right, 0);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    return g;
  };
}
const scaleX = () => ({
  grid: { display: false }, border: { color: "#1B2745" },
  ticks: { color: C.dim, maxRotation: 0, autoSkipPadding: 14 },
});
const scaleY = (max) => ({
  beginAtZero: true, suggestedMax: max, grid: { color: C.grid }, border: { display: false },
  ticks: { color: C.faint, callback: (v) => fmt(v), maxTicksLimit: 6 },
});
const labelBase = {
  color: C.text, font: { family: "'IBM Plex Sans', sans-serif", weight: "600", size: 10.5 },
};

/* ---------- Gráficos ---------- */
function renderColumns(id, labels, data, { decimals = 0, avg = null, avgLabel = "" } = {}) {
  const max = Math.max(...data, 0);
  mount(id, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data, borderRadius: { topLeft: 7, topRight: 7 }, borderSkipped: false, maxBarThickness: 54,
        backgroundColor: gradV("#FFD98A", "#C67C0E"),
        hoverBackgroundColor: gradV("#FFE7B0", "#E8A224"),
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, layout: { padding: { top: 14 } },
      plugins: {
        tooltip: tooltipStyle(),
        datalabels: { ...labelBase, display: labels.length <= 14, anchor: "end", align: "end", offset: 3, formatter: (v) => fmt(v, decimals) },
        avgLine: avg === null ? {} : { value: avg, label: avgLabel },
      },
      scales: { x: scaleX(), y: scaleY(max * 1.22) },
    },
    plugins: [avgLine],
  });
}

/* ---------- Plantillas ---------- */
function heroCard({ title, value, unit, badge, note }) {
  return `
    <article class="card hero span-4">
      <span class="eyebrow">Indicador principal</span>
      <h3>${title}</h3>
      <div class="hero-val">${value}<small>${unit}</small></div>
      <p class="hero-note">${note}</p>
      <span class="pill pill-orange">${badge}</span>
    </article>`;
}
function kpiCard({ icon, tone, title, value, unit, pct, barLabel, foot }) {
  return `
    <article class="card kpi tone-${tone} span-4">
      <div class="kpi-head"><span class="kpi-ico"><i class="fas ${icon}"></i></span><h3>${title}</h3></div>
      <div class="kpi-val">${value}<small>${unit}</small></div>
      <div class="bar"><i style="width:${clamp(pct)}%"></i></div>
      <div class="kpi-foot"><span>${barLabel}</span><b>${fmt(pct, 1)}%</b></div>
      <p class="kpi-note">${foot}</p>
    </article>`;
}
function plotCard(id, titulo, sub, span, size = "") {
  return `
    <article class="card span-${span}">
      <div class="card-head"><h3>${titulo}</h3><p>${sub}</p></div>
      <div class="plot ${size}"><canvas id="${id}"></canvas>
        <div class="plot-empty"><i class="fas fa-chart-simple"></i><span>Sin datos para mostrar</span></div></div>
    </article>`;
}
function slotCard(id, titulo, sub, span, inner = "") {
  return `
    <article class="card span-${span}">
      <div class="card-head"><h3>${titulo}</h3><p>${sub}</p></div>
      <div id="${id}" class="${inner}"></div>
    </article>`;
}
function footCard(key, texto) {
  return `
    <footer class="card foot span-12">
      <div><h4>Metodología y fuentes</h4><p id="${key}Nota">${texto}</p></div>
      <div class="foot-side">
        <span class="foot-ref">Origen: <b id="${key}Origen">Supabase</b></span>
        <button type="button" class="btn-export js-export"><i class="fas fa-file-arrow-down"></i> Exportar CSV</button>
      </div>
    </footer>`;
}
function tabla(encabezados, filas) {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${encabezados
    .map((h) => `<th class="${h.num ? "num" : ""}">${h.t}</th>`).join("")}</tr></thead><tbody>${
    filas.map((f) => `<tr>${f.map((c, i) => `<td class="${encabezados[i].num ? "num" : ""} ${i === 0 ? "name" : ""}">${c}</td>`).join("")}</tr>`).join("")
  }</tbody></table></div>`;
}

function llenarSelect(id, data, columna, etiquetaTodos) {
  const select = $(id);
  if (!select) return;
  const actual = select.value;
  select.innerHTML = `<option value="">${etiquetaTodos}</option>`;
  if (!columna) return;
  const valores = [...new Set(data.map((f) => norm(f[columna])).filter((v) => v !== ""))];
  valores.sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  valores.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = v;
    select.appendChild(opt);
  });
  if (actual && valores.includes(actual)) select.value = actual;
}

/* ---------- Esqueleto ---------- */
function construirLayout() {
  $("gridViajes").innerHTML = [
    `<div class="contents" id="kpiViajes"></div>`,
    plotCard("gViajesDia", "Nro de Viajes — Turno Día", "Distribución de viajes por equipo (06:00–17:59)", 6, "tall"),
    plotCard("gViajesNoche", "Nro de Viajes — Turno Noche", "Distribución de viajes por equipo (18:00–05:59)", 6, "tall"),
    slotCard("tablaDia", "Faltas Turno Día", "Equipo · Descripción (motivo)", 6),
    slotCard("tablaNoche", "Faltas Turno Noche", "Equipo · Descripción (motivo)", 6),
    footCard("viajes", ""),
  ].join("");
}

function resolverColumnas() {
  const d = state.transporte;
  cols.fecha = col(d, "Fecha");
  cols.equipo = col(d, "Equipo");
  cols.viajes = col(d, "viajes");
  cols.tmh = col(d, "TMH");
  cols.obs = col(d, "Observaciones");
  cols.ruta = col(d, "RUTA");
  cols.tipoMat = col(d, "TipoMaterial");
}

/* ---------- Render ---------- */
function renderViajes(data) {
  // Enriquecer cada fila con Turno y Día calculados
  data = data.map((f) => ({
    ...f,
    _turno: getTurno(f[cols.fecha]),
    _dia: getDia(f[cols.fecha]),
  }));

  // KPIs
  let viajes = 0, tmh = 0;
  const equipos = new Set();
  data.forEach((f) => {
    viajes += num(f[cols.viajes]);
    tmh += num(f[cols.tmh]);
    const eq = norm(f[cols.equipo]);
    if (eq) equipos.add(eq);
  });

  const turnoDia = data.filter((f) => f._turno === "DIA");
  const turnoNoche = data.filter((f) => f._turno === "NOCHE");
  const viajesDia = turnoDia.reduce((a, f) => a + num(f[cols.viajes]), 0);
  const viajesNoche = turnoNoche.reduce((a, f) => a + num(f[cols.viajes]), 0);

  $("kpiViajes").innerHTML = [
    heroCard({
      title: "Tonelaje total (TMH)", value: fmt(tmh, 1), unit: "t",
      note: `${fmt(data.length)} registros · ${fmt(equipos.size)} volquetes en operación`,
      badge: `Día ${fmt(viajesDia)} · Noche ${fmt(viajesNoche)} viajes`,
    }),
    kpiCard({
      icon: "fa-route", tone: "blue", title: "N° de Viajes", value: fmt(viajes), unit: "",
      pct: 100, barLabel: "Total del periodo",
      foot: `${fmt(data.length ? viajes / data.length : 0, 2)} viajes por registro`,
    }),
    kpiCard({
      icon: "fa-truck", tone: "green", title: "Volquetes en Uso", value: fmt(equipos.size), unit: "",
      pct: 100, barLabel: "Equipos distintos",
      foot: `${fmt(viajes / (equipos.size || 1), 1)} viajes por volquete`,
    }),
  ].join("");

  // Gráfico Día
  const porEquipoDia = sumBy(turnoDia, (f) => norm(f[cols.equipo]) || "Sin equipo", (f) => num(f[cols.viajes]));
  const arrDia = Object.entries(porEquipoDia).sort((a, b) => b[1] - a[1]);
  renderColumns("gViajesDia", arrDia.map((e) => e[0]), arrDia.map((e) => e[1]), { decimals: 0 });

  // Gráfico Noche
  const porEquipoNoche = sumBy(turnoNoche, (f) => norm(f[cols.equipo]) || "Sin equipo", (f) => num(f[cols.viajes]));
  const arrNoche = Object.entries(porEquipoNoche).sort((a, b) => b[1] - a[1]);
  renderColumns("gViajesNoche", arrNoche.map((e) => e[0]), arrNoche.map((e) => e[1]), { decimals: 0 });

  // Tablas "Faltas": equipos con 0 viajes u observaciones registradas
  const faltasDia = detectarFaltas(turnoDia, equipos);
  const faltasNoche = detectarFaltas(turnoNoche, equipos);

  $("tablaDia").innerHTML = faltasDia.length
    ? tabla([{ t: "Equipo" }, { t: "Descripción" }], faltasDia.map((f) => [f.equipo, f.motivo]))
    : `<div class="plot-empty" style="display:flex;position:static;min-height:120px"><i class="fas fa-check-circle"></i><span>Sin faltas registradas</span></div>`;

  $("tablaNoche").innerHTML = faltasNoche.length
    ? tabla([{ t: "Equipo" }, { t: "Descripción" }], faltasNoche.map((f) => [f.equipo, f.motivo]))
    : `<div class="plot-empty" style="display:flex;position:static;min-height:120px"><i class="fas fa-check-circle"></i><span>Sin faltas registradas</span></div>`;

  $("viajesNota").textContent =
    `Datos de la hoja TRANSPORTE (${fmt(data.length)} registros en el filtro actual). ` +
    `El turno se calcula a partir de la hora de la columna "Fecha": Día = 06:00–17:59, Noche = 18:00–05:59. ` +
    `La tabla "Faltas" lista equipos que no registraron viajes en el turno correspondiente dentro del día filtrado.`;
}

function detectarFaltas(dataTurno, todosEquipos) {
  const equiposConViajes = new Set(dataTurno.map((f) => norm(f[cols.equipo])).filter((v) => v));
  const faltas = [];

  // Equipos del universo que no aparecen en este turno
  todosEquipos.forEach((eq) => {
    if (!equiposConViajes.has(eq)) {
      faltas.push({ equipo: eq, motivo: "Sin viajes registrados en este turno" });
    }
  });

  // Filas con observaciones que no sean "OK"
  dataTurno.forEach((f) => {
    const obs = norm(f[cols.obs]).toUpperCase();
    if (obs && obs !== "OK") {
      faltas.push({ equipo: norm(f[cols.equipo]) || "-", motivo: truncar(obs, 60) });
    }
  });

  return faltas;
}

/* ---------- Filtros ---------- */
function prepararFiltros() {
  const d = state.transporte;
  // Rellenar select de Día (único)
  const selectDia = $("filterDiaV");
  if (selectDia) {
    const dias = [...new Set(d.map((f) => getDia(f[cols.fecha])).filter((v) => v && v !== "Sin fecha"))];
    dias.sort();
    selectDia.innerHTML = `<option value="">Todos</option>`;
    dias.forEach((v) => {
      const opt = document.createElement("option"); opt.value = v; opt.textContent = v; selectDia.appendChild(opt);
    });
  }
  // Select Turno
  const selectTurno = $("filterTurnoV");
  if (selectTurno) {
    selectTurno.innerHTML = `<option value="">Todos</option><option value="DIA">Día</option><option value="NOCHE">Noche</option>`;
  }
  // Select Equipo
  llenarSelect("filterEquipoV", d, cols.equipo, "Todos");
}

function aplicar() {
  const fDia = $("filterDiaV").value;
  const fTurno = $("filterTurnoV").value;
  const fEquipo = $("filterEquipoV").value;

  ["filterDiaV","filterTurnoV","filterEquipoV"].forEach((id) => $(id).classList.toggle("is-active", !!$(id).value));

  const filtrado = state.transporte.filter((f) => {
    const dia = getDia(f[cols.fecha]);
    const turno = getTurno(f[cols.fecha]);
    if (fDia && dia !== fDia) return false;
    if (fTurno && turno !== fTurno) return false;
    if (fEquipo && norm(f[cols.equipo]) !== fEquipo) return false;
    return true;
  });

  ultimo = filtrado;
  renderViajes(filtrado);

  const activos = [fDia, fTurno, fEquipo].filter(Boolean).length;
  const badge = $("badgeViajes");
  badge.textContent = activos;
  badge.hidden = activos === 0;

  // Chips
  let viajes = 0, tmh = 0;
  filtrado.forEach((f) => { viajes += num(f[cols.viajes]); tmh += num(f[cols.tmh]); });
  $("chipAlcance").textContent = `${fmt(filtrado.length)} registros`;
  $("chipTonelaje").textContent = `${fmt(tmh, 1)} t`;
}

/* ---------- Exportar CSV ---------- */
function exportarCSV() {
  if (!ultimo.length) return;
  const cab = Object.keys(ultimo[0]).filter((k) => !k.startsWith("_"));
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cab.map(esc).join(","), ...ultimo.map((r) => cab.map((k) => esc(r[k])).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `transporte_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Eventos ---------- */
function engancharEventos() {
  if (listenersReady) return;
  listenersReady = true;

  ["filterDiaV","filterTurnoV","filterEquipoV"].forEach((id) =>
    $(id).addEventListener("change", aplicar)
  );
  $("clearViajes").addEventListener("click", () => {
    ["filterDiaV","filterTurnoV","filterEquipoV"].forEach((id) => ($(id).value = ""));
    aplicar();
  });
  document.querySelectorAll(".js-export").forEach((b) => b.addEventListener("click", exportarCSV));
  document.querySelectorAll(".js-refresh").forEach((b) =>
    b.addEventListener("click", async () => {
      document.querySelectorAll(".js-refresh").forEach((x) => { x.disabled = true; x.classList.add("is-loading"); });
      try { await cargarTodo(); } catch (err) { console.error(err); }
      document.querySelectorAll(".js-refresh").forEach((x) => { x.disabled = false; x.classList.remove("is-loading"); });
    })
  );
}

/* ---------- Carga ---------- */
async function cargarTodo() {
  const t = await cargarHoja("TRANSPORTE");
  state.transporte = t;
  resolverColumnas();
  prepararFiltros();
  aplicar();
  $("stRegistros").textContent = fmt(t.length);
  $("stSync").textContent = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

/* ---------- Inicio ---------- */
(async function init() {
  construirLayout();
  try {
    await cargarTodo();
    $("loading").hidden = true;
    $("topbar").hidden = false;
    $("shell").hidden = false;
    $("viajes").hidden = false;
    engancharEventos();
  } catch (err) {
    console.error(err);
    $("loading").innerHTML = `
      <div class="error-box">
        <i class="fas fa-triangle-exclamation"></i>
        <h3>No se pudieron cargar los datos</h3>
        <p>${err.message || err}</p>
      </div>`;
  }
})();