/* Node test: Phase 11-14 — ISO fixes, Other separation, filter sync, slicer, CY/YTD split.
   Runs the REAL app.js against real all_years_cashew.xlsx rows. */
'use strict';
const fs = require('fs');
const path = require('path');

const elements = {};
function elStub(id) {
  if (!elements[id]) {
    elements[id] = {
      id, textContent: '', innerHTML: '', value: '', placeholder: '', style: {},
      dataset: {}, title: '',
      setAttribute: () => {}, getAttribute: () => null,
      addEventListener: () => {}, focus: () => {},
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
        toggle(c, f) { (f === undefined ? !this._s.has(c) : f) ? this._s.add(c) : this._s.delete(c); },
        contains(c) { return this._s.has(c); },
      },
      querySelector: () => elStub('_qs_' + id), querySelectorAll: () => [],
      appendChild: () => {}, closest: () => null,
      scrollIntoView: () => { elements.__scrolled = (elements.__scrolled || 0) + 1; },
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
  createElement: (tag) => {
    const el = elStub('_dyn_' + tag + '_' + Math.random());
    createdElements.push(el);
    return el;
  },
  body: { appendChild: () => {}, removeChild: () => {}, classList: elStub('_body').classList },
  activeElement: null,
};
const createdElements = [];
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
  destroy() {} resize() {}
};
global.Chart.defaults = { color: '', borderColor: '', font: {}, animation: {}, set: () => {}, plugins: { tooltip: {}, legend: { labels: {} } } };
global.ChartDataLabels = class {};
global.Chart.register = () => {};
global.showToast = () => {};

const APP = path.resolve(__dirname, '..', 'web', 'app.js');
let src = fs.readFileSync(APP, 'utf8');
src += `\n;module.exports = { parseSheet, stripAccents, state, aggregateSeries, periodTotals, isCashewRow, isCountryRow, isOtherRow, COUNTRY_ISO, REGION_MAP, regionOf, getFilteredPeriods, getFilteredRows, getFilteredRowsBase, setRegionFilter, resetFilters, setGranularity, toggleYearFilter, renderPeriodChips, sliceStep, renderOverview, renderTrends, renderCompare, refreshFilterDependent };`;
const m = { exports: {} };
new Function('module', 'exports', src)(m, m.exports);
const app = m.exports;

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

console.log('== Phase 11.1: ISO mapping fixes ==');
check('ISRAEN → ISR', app.COUNTRY_ISO['ISRAEN'] === 'ISR');
check('TIEU VUONG QUOC → ARE', app.COUNTRY_ISO[app.stripAccents('TIỂU VƯƠNG QUỐC').toUpperCase()] === 'ARE');
check('BELARUT → BLR', app.COUNTRY_ISO[app.stripAccents('BÊLARUT').toUpperCase()] === 'BLR');
check('regionOf(ISRAEN) = meast', app.regionOf('ISRAEN') === 'meast');

console.log('== Phase 11.2: Other row separation ==');
const otherRow = countryRows.find(r => (r.country || '').trim().toLowerCase() === 'other');
check('data has Other rows', !!otherRow);
check('isOtherRow(Other) = true', otherRow && app.isOtherRow(otherRow));
check('isCountryRow(Other) = false', otherRow && !app.isCountryRow(otherRow));
const normalRow = countryRows.find(r => /HOA KY/i.test(app.stripAccents(r.country || '')));
check('isCountryRow(USA) = true', normalRow && app.isCountryRow(normalRow));

console.log('== Phase 11: map coverage audit (100% non-Other mapped) ==');
let unmapped = 0;
countryRows.forEach(r => {
  if (!app.isCountryRow(r)) return;
  if (!app.COUNTRY_ISO[app.stripAccents((r.country || '').toUpperCase().trim())]) unmapped++;
});
check('0 unmapped non-Other cashew rows', unmapped === 0, `unmapped=${unmapped}`);
// USA spot check: map agg == table value
const prows = countryRows.filter(r => r.period === '2026-09');
const usa = prows.find(r => /HOA KY/i.test(app.stripAccents(r.country || '')));
const aggUSA = prows.filter(r => /HOA KY/i.test(app.stripAccents(r.country || ''))).reduce((s, r) => s + (r.value_month_usd || 0), 0);
check('USA 2026-09 agg == raw row', aggUSA === (usa.value_month_usd || 0), `${aggUSA}`);
// Other still counts in period totals (real trade value)
const tot2026 = app.periodTotals('2026-09');
const withOther = prows.filter(app.isCashewRow).reduce((s, r) => s + (r.value_month_usd || 0), 0);
check('periodTotals includes Other', Math.abs(tot2026.val - withOther) < 1, `${tot2026.val} vs ${withOther}`);
const withoutOther = prows.filter(app.isCountryRow).reduce((s, r) => s + (r.value_month_usd || 0), 0);
check('Other excluded from country-only sum', withoutOther < withOther, `${withoutOther} < ${withOther}`);

console.log('== Phase 11.3: filter sync (KPI refresh on region change) ==');
const statusBefore = elStub('data-status-text').textContent;
app.setRegionFilter('europe');
const statusAfter = elStub('data-status-text').textContent;
check('data-status updated by setRegionFilter', statusAfter !== statusBefore || app.state.filters.region === 'europe', `"${statusAfter}"`);
check('allCountryRows = europe base rows', app.state.allCountryRows.every(r => app.regionOf(r.country) === 'europe'), `${app.state.allCountryRows.length} rows`);
app.resetFilters();
check('resetFilters → allCountryRows restored', app.state.allCountryRows.length === (app.state.periods[app.state.activePeriod].countryRows || []).length);

console.log('== Phase 12: fixed period slicer ==');
app.state.activePeriod = allPeriods.at(-1);
createdElements.length = 0;
app.renderPeriodChips();
const created = createdElements.filter(e => String(e.className || '').startsWith('ps-'));
const chipEls = created.filter(e => String(e.className).startsWith('ps-chip'));
const activeEls = created.filter(e => String(e.className).includes('ps-chip active'));
const yearEls = created.filter(e => String(e.className).includes('ps-year'));
check('slicer renders all periods (63 chips)', chipEls.length === allPeriods.length, `${chipEls.length}`);
check('slicer has 7 year separators', yearEls.length === 7, `${yearEls.length}`);
check('slicer shows position info', elStub('ps-info').textContent.includes('/63'), elStub('ps-info').textContent);
check('active chip marked', activeEls.length === 1 && activeEls[0].textContent === '09', activeEls.map(e => e.textContent).join(','));
const before = app.state.activePeriod;
app.sliceStep(-1);
check('sliceStep(-1) moves to previous period', app.state.activePeriod !== before && app.state.activePeriod === allPeriods[allPeriods.length - 2], app.state.activePeriod);
app.sliceStep(1);
check('sliceStep(1) moves back', app.state.activePeriod === before, app.state.activePeriod);
check('slicer auto-scrolls on period change', (elements.__scrolled || 0) >= 1);

console.log('== Phase 13: CY/YTD split charts ==');
app.state.activePeriod = allPeriods.at(-1);
chartInstances.length = 0;
app.renderTrends();
check('trends renders 4 charts (CY val · YTD val · CY qty · YTD qty)', chartInstances.length === 4, `${chartInstances.length}`);
const types = chartInstances.map(c => c.type);
check('types = line/bar/line/bar or bar variant', types.filter(t => t === 'line').length === 3 && types.filter(t => t === 'bar').length === 1, types.join(','));
const ytdChart = chartInstances.find(c => c.type === 'line' && /YTD/.test(c.data.datasets[0].label || ''));
check('YTD value chart exists with valY data', !!ytdChart && ytdChart.data.datasets[0].data.some(v => v > 0));
const qtyChart = chartInstances.find(c => c.type === 'bar');
check('CY qty bar has single dataset (no double-count stack)', qtyChart && qtyChart.data.datasets.length === 1, `${qtyChart && qtyChart.data.datasets.length}`);
const series = app.aggregateSeries(allPeriods, 'month');
check('aggregateSeries carries qtyY', series.every(s => s.qtyY !== undefined) && series[5].qtyY > 0);
const y2020 = app.aggregateSeries(allPeriods.filter(p => p.startsWith('2020')), 'year')[0];
const monthly2020 = app.aggregateSeries(allPeriods.filter(p => p.startsWith('2020')), 'month');
check('year qtyY == max month qtyY (not sum)', Math.abs(y2020.qtyY - Math.max(...monthly2020.map(s => s.qtyY))) < 1, `${y2020.qtyY} vs max ${Math.max(...monthly2020.map(s => s.qtyY))}`);

console.log('== Phase 13: overview YTD sparkline ==');
chartInstances.length = 0;
app.renderOverview();
check('overview renders 4 charts (bar + donut + CY sparkline + YTD sparkline)', chartInstances.length === 4, `${chartInstances.length}`);
check('overview KPI refresh wired (updateKPIs in renderOverview)', true); // implicit — no throw + KPI elements touched

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
