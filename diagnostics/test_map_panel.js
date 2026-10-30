/* Node test: exercise renderMapPanel / renderMapLegend / selectMapCountry logic
   from the REAL app.js with stubbed DOM + Chart, using real all-years data. */
'use strict';
const fs = require('fs');
const path = require('path');

// ── DOM stubs ──
const elements = {};
function elStub(id) {
  if (!elements[id]) {
    elements[id] = {
      id, textContent: '', innerHTML: '', style: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      querySelector: () => null, appendChild: () => {}, closest: () => null,
    };
  }
  return elements[id];
}
global.document = {
  addEventListener: () => {},
  getElementById: (id) => elStub(id),
  querySelectorAll: () => [],
  createElement: () => elStub('_dyn' + Math.random()),
  body: { appendChild: () => {}, removeChild: () => {} },
};
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
global.FileReader = class { readAsArrayBuffer() {} readAsText() {} };
global.XLSX = { utils: { sheet_to_json: (ws) => ws, json_to_sheet: () => ({}), book_new: () => ({}), book_append_sheet: () => {} } };

// Chart stub capturing the last config
const chartCalls = [];
global.Chart = class {
  constructor(canvas, config) { chartCalls.push(config); }
  destroy() {}
  resize() {}
};
global.Chart.defaults = {
  color: '', borderColor: '', font: {}, animation: {},
  plugins: { tooltip: {}, legend: { labels: {} } },
};
global.showToast = () => {};
global.L = {}; // not used by panel

// ── Load real app.js ──
const APP = path.resolve(__dirname, '..', 'web', 'app.js');
let src = fs.readFileSync(APP, 'utf8');
src += `\n;module.exports = { parseSheet, stripAccents, state, renderMapPanel, renderMapLegend, selectMapCountry, resetMapView, periodTotals, isCashewRow, COUNTRY_ISO };`;
const m = { exports: {} };
new Function('module', 'exports', src)(m, m.exports);
const app = m.exports;

// ── Load real data and populate state (same grouping as loadExcelFile) ──
const rows = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'dof_xlsx_rows.json'), 'utf8'));
const countryRows = app.parseSheet(rows['XK_Theo_Nuoc_All'], 'country');
const summaryRows = app.parseSheet(rows['Tong_XK_All'], 'summary');
const filePeriods = new Set(countryRows.map(r => r.period).filter(Boolean));
filePeriods.forEach(p => {
  app.state.periods[p] = {
    summaryRows: summaryRows.filter(r => r.period === p),
    countryRows: countryRows.filter(r => r.period === p),
    fileName: 'all_years_cashew.xlsx',
  };
});
const allPeriods = Object.keys(app.state.periods).sort();
app.state.activePeriod = allPeriods.at(-1);
app.state.allCountryRows = app.state.periods[app.state.activePeriod].countryRows;

console.log('== Interactive map panel logic (period ' + app.state.activePeriod + ') ==');

// Replicate renderMap's agg building (same code path)
const pd = app.state.periods[app.state.activePeriod];
const cashewRows = (pd.countryRows || []).filter(app.isCashewRow);
const agg = {};
cashewRows.forEach(r => {
  const nameAscii = app.stripAccents((r.country || '').toUpperCase().trim());
  const iso = app.COUNTRY_ISO[nameAscii] || null;
  if (!iso) return;
  const a = agg[iso] = agg[iso] || { name: r.country, value: 0, qty: 0, valY: 0 };
  a.value += r.value_month_usd || 0;
  a.qty += r.quantity_month || 0;
  a.valY += r.value_ytd_usd || 0;
});
app.state.mapAgg = agg;
app.state.mapTotalVal = Object.values(agg).reduce((s, a) => s + a.value, 0) || 1;

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  PASS', label, detail || ''); }
  else { fail++; console.log('  FAIL', label, detail || ''); }
}

const isoCount = Object.keys(agg).length;
check('ISO-mapped markets in latest period > 20', isoCount > 20, `got ${isoCount}`);

// Select USA (top market historically)
app.selectMapCountry('USA', null);
const name = elements['mp-name'];
const val = elements['mp-val'];
const rank = elements['mp-rank'];
const share = elements['mp-share'];

check('panel detail visible', elements['map-panel-detail'].style.display === '' , `display=${elements['map-panel-detail'].style.display}`);
check('panel hint hidden', elements['map-panel-hint'].style.display === 'none');
check('panel shows a name', !!name.textContent && name.textContent !== '—', name.textContent);
check('panel value populated', /^\$[\d.,]+[KMB]?$/.test(val.textContent), val.textContent);
check('panel rank format #N', /^#\d+$/.test(rank.textContent), rank.textContent);
check('panel share format %', /^\d+(\.\d+)?%$/.test(share.textContent), share.textContent);

// Trend chart built across all periods
check('trend chart created', chartCalls.length === 1, `calls=${chartCalls.length}`);
if (chartCalls.length) {
  const cfg = chartCalls[0];
  check('trend labels = all periods', cfg.data.labels.length === allPeriods.length, `${cfg.data.labels.length} vs ${allPeriods.length}`);
  const usa = agg['USA'];
  const lastTrend = cfg.data.datasets[0].data.at(-1);
  check('trend last point == USA value in active period', lastTrend === usa.value, `${lastTrend} vs ${usa.value}`);
  check('some historical value differs (real trend)', cfg.data.datasets[0].data.some(v => v !== usa.value));
}

// Legend with quantile breaks
const vals = Object.values(agg).map(a => a.value).filter(v => v > 0).sort((x, y) => x - y);
const q = p => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
const breaks = [q(.2), q(.4), q(.6), q(.8)];
app.renderMapLegend(breaks);
const legendHtml = elements['map-legend-rows'].innerHTML;
const swatches = (legendHtml.match(/ml-swatch/g) || []).length;
check('legend has 6 rows (5 steps + no-data)', swatches === 6, `got ${swatches}`);
check('legend breaks strictly increasing', breaks[0] < breaks[1] && breaks[1] < breaks[2] && breaks[2] < breaks[3], breaks.join(' < '));

// Quantile spread vs old linear scale: verify breaks actually differentiate
check('quantile breaks not all equal', new Set(breaks).size === 4);

// Reset flow
app.resetMapView();
check('reset clears selection', app.state.mapSelectedIso === null);
check('reset shows hint again', elements['map-panel-hint'].style.display === '');
check('reset hides detail', elements['map-panel-detail'].style.display === 'none');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
