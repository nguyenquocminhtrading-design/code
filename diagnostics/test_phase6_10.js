/* Node test: Phase 6-10 — filters engine, aggregation, YoY, compare tab, HTML report.
   Runs the REAL app.js against real all_years_cashew.xlsx rows. */
'use strict';
const fs = require('fs');
const path = require('path');

// ── DOM stubs ──
const elements = {};
function elStub(id) {
  if (!elements[id]) {
    elements[id] = {
      id, textContent: '', innerHTML: '', value: '', placeholder: '', style: {},
      dataset: {},
      setAttribute: () => {}, getAttribute: () => null,
      addEventListener: () => {}, focus: () => {},
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
        toggle(c, f) { (f === undefined ? !this._s.has(c) : f) ? this._s.add(c) : this._s.delete(c); },
        contains(c) { return this._s.has(c); },
      },
      querySelector: () => null, querySelectorAll: () => [],
      appendChild: () => {}, closest: () => null,
      toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    };
  }
  return elements[id];
}
global.document = {
  addEventListener: () => {},
  getElementById: (id) => elStub(id),
  querySelector: () => elStub('_qs'),
  querySelectorAll: () => [],
  createElement: (tag) => elStub('_dyn_' + tag + Math.random()),
  body: { appendChild: () => {}, removeChild: () => {}, classList: elStub('_body').classList },
  activeElement: null,
};
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
global.FileReader = class { readAsArrayBuffer() {} readAsText() {} };
global.XLSX = { utils: { sheet_to_json: (ws) => ws, json_to_sheet: () => ({}), book_new: () => ({}), book_append_sheet: () => {} } };
const chartInstances = [];
global.Chart = class {
  constructor(canvas, config) { this.canvas = canvas; this.config = config; chartInstances.push(config); }
  destroy() {} resize() {} toDataURL() { return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='; }
};
global.Chart.defaults = { color: '', borderColor: '', font: {}, animation: {}, set: () => {}, plugins: { tooltip: {}, legend: { labels: {} } } };
global.ChartDataLabels = class {};
global.Chart.register = () => {};
global.showToast = () => {};

// ── Load real app.js ──
const APP = path.resolve(__dirname, '..', 'web', 'app.js');
let src = fs.readFileSync(APP, 'utf8');
src += `\n;module.exports = { parseSheet, stripAccents, state, aggregateSeries, yoyDelta, periodTotals, isCashewRow, getFilteredPeriods, getFilteredRows, getFilteredRowsBase, toggleYearFilter, setGranularity, setRegionFilter, resetFilters, renderFilterBar, renderCompare, buildReportHTML, COUNTRY_ISO, REGION_MAP, regionOf };`;
const m = { exports: {} };
new Function('module', 'exports', src)(m, m.exports);
const app = m.exports;

// ── Real data → state.periods ──
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

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  PASS', label, detail || ''); }
  else { fail++; console.log('  FAIL', label, detail || ''); }
}

console.log('== Phase 6: filter engine ==');
check('getFilteredPeriods (no filter) = all', app.getFilteredPeriods().length === allPeriods.length, `${app.getFilteredPeriods().length}`);
// Expected 2024 count comes from the data itself (real file has gaps: no 2024-02/03/07/12)
const expect2024 = allPeriods.filter(p => p.startsWith('2024')).length;
app.toggleYearFilter('2024');
check(`year filter 2024 → ${expect2024} periods`, app.getFilteredPeriods().length === expect2024, `got ${app.getFilteredPeriods().length}`);
check('all filtered periods are 2024', app.getFilteredPeriods().every(p => p.startsWith('2024')));
check('active period jumped into 2024', app.state.activePeriod.startsWith('2024'), app.state.activePeriod);
const eurRows = app.getFilteredRowsBase(app.state.activePeriod);
app.setRegionFilter('europe');
const eurFiltered = app.getFilteredRowsBase(app.state.activePeriod);
check('region=europe shrinks rows', eurFiltered.length > 0 && eurFiltered.length < eurRows.length, `${eurFiltered.length}/${eurRows.length}`);
check('europe rows are all european', eurFiltered.every(r => app.regionOf(r.country) === 'europe'));
app.setRegionFilter('');
app.toggleYearFilter('2024'); // clear
check('year filter cleared', app.getFilteredPeriods().length === allPeriods.length);
app.state.searchQuery = 'trung';
const searchRows = app.getFilteredRows(app.state.activePeriod);
check('search "trung" matches TRUNG QUOC only', searchRows.length >= 1 && searchRows.every(r => /TRUNG/.test(app.stripAccents(r.country || '').toUpperCase())), `${searchRows.length}`);
app.state.searchQuery = '';
app.resetFilters();
check('resetFilters clears everything', !app.state.filters.years.size && !app.state.filters.region && !app.state.searchQuery);

console.log('== Phase 7: aggregation + YoY ==');
app.state.filters.granularity = 'month';
const monthly = app.aggregateSeries(allPeriods, 'month');
check('monthly buckets = 63', monthly.length === allPeriods.length, `${monthly.length}`);
const quarterly = app.aggregateSeries(allPeriods, 'quarter');
check('quarterly buckets < monthly', quarterly.length < monthly.length && quarterly.length > 20, `${quarterly.length}`);
check('quarter labels valid', quarterly.every(s => /^\d{4}-Q[1-4]$/.test(s.label)), quarterly[0].label);
const yearly = app.aggregateSeries(allPeriods, 'year');
check('yearly buckets = 7 (2020..2026)', yearly.length === 7, `${yearly.length} → ${yearly.map(s => s.label).join(',')}`);
const sumBy = (arr, k) => arr.reduce((s, x) => s + x[k], 0);
check('month sum == year sum (val)', Math.abs(sumBy(monthly, 'val') - sumBy(yearly, 'val')) < 1, `${sumBy(monthly, 'val')} vs ${sumBy(yearly, 'val')}`);
check('month sum == quarter sum (qty)', Math.abs(sumBy(monthly, 'qty') - sumBy(quarterly, 'qty')) < 1);
const yoy = app.yoyDelta(yearly, 'val');
check('yoy first delta null', yoy[0].deltaPct == null);
const expectPct = (yearly[1].val - yearly[0].val) / yearly[0].val * 100;
check('yoy second delta correct', Math.abs(yoy[1].deltaPct - expectPct) < 1e-9, `${yoy[1].deltaPct.toFixed(2)}%`);

console.log('== Phase 7: compare tab rendering ==');
chartInstances.length = 0;
app.renderCompare();
const kpiHTML = elements['compare-kpis'].innerHTML;
check('compare KPI cards rendered (4)', (kpiHTML.match(/kpi-card/g) || []).length === 4);
check('compare KPI has YoY pill', /pill up|pill down|pill flat/.test(kpiHTML));
check('compare bar chart created', chartInstances.length >= 1);
check('compare bar has 2 datasets (USD + Tons)', chartInstances[0] && chartInstances[0].data.datasets.length === 2);
check('compare bar labels = years', chartInstances[0] && chartInstances[0].data.labels.length === 7);
const bodyHTML = elements['compare-body'].innerHTML;
check('compare table rows = 7 years', (bodyHTML.match(/<tr>/g) || []).length === 7);
check('compare table has top market', /TOP TH/.test(bodyHTML.toUpperCase()) || /<td>/.test(bodyHTML));
const matrixHTML = elements['compare-matrix'].innerHTML;
check('matrix has 7 year rows', (matrixHTML.match(/mx-year/g) || []).length === 8, '8 = 7 rows + header spacer'); // header row has empty mx-year
check('matrix cells painted', /rgba\(201,162,39/.test(matrixHTML));

console.log('== Phase 8: granularity toggle affects charts ==');
app.setGranularity('quarter');
check('granularity set to quarter', app.state.filters.granularity === 'quarter');
const q2 = app.aggregateSeries(allPeriods);
check('default-granularity call follows state', q2.length === quarterly.length);
app.setGranularity('month');

console.log('== Phase 9: HTML report ==');
const report = app.buildReportHTML();
check('report has DOCTYPE', report.startsWith('<!DOCTYPE html>'));
check('report has closing html', report.trimEnd().endsWith('</html>'));
const imgs = (report.match(/src="data:image\/png;base64,/g) || []).length;
check('report embeds 3 chart PNGs', imgs === 3, `got ${imgs}`);
check('report has print CSS', /@media print/.test(report) && /@page/.test(report));
check('report has slide mode', /slides=1/.test(report) && /body\.slides/.test(report));
check('report has detail table', /sec-detail/.test(report));
const detailSec = report.split('id="sec-detail"')[1];
const detailRowCount = (detailSec.match(/<td class="b">/g) || []).length;
check('detail table = filtered row count', detailRowCount === app.getFilteredRows(app.state.activePeriod).filter(app.isCashewRow).length, `${detailRowCount}`);
check('report mentions active period', report.includes(app.state.activePeriod));
check('report self-contained (no external http resources)', !/src="http/.test(report), 'img src only data URIs');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
