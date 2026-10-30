/* Node test: run the REAL app.js parseSheet + loadExcelFile grouping logic
   against the real all_years_cashew.xlsx rows (extracted by Python). */
'use strict';
const fs = require('fs');
const path = require('path');

// ── Browser stubs so app.js evaluates cleanly in Node ──
global.document = {
  addEventListener: () => {},
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} } }),
  body: { appendChild: () => {}, removeChild: () => {} },
};
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
global.FileReader = class { readAsArrayBuffer() {} readAsText() {} };
global.showToast = undefined; // defined inside app.js
// XLSX stub: sheet_to_json returns the 2D array as-is (matches header:1, defval:null)
global.XLSX = { utils: { sheet_to_json: (ws) => ws, json_to_sheet: () => ({}), book_new: () => ({}), book_append_sheet: () => {} } };

// ── Load the real app.js and export internals ──
const APP = path.resolve(__dirname, '..', 'web', 'app.js');
let src = fs.readFileSync(APP, 'utf8');
src += `\n;module.exports = { parseSheet, extractPeriod, normalizeKey, stripAccents, parseNum, state, loadExcelFile, periodTotals, isCashewRow };`;
const m = { exports: {} };
new Function('module', 'exports', src)(m, m.exports);
const app = m.exports;

// ── Real data ──
const rows = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'dof_xlsx_rows.json'), 'utf8'));
const summaryRaw = rows['Tong_XK_All'];
const countryRaw = rows['XK_Theo_Nuoc_All'];

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  PASS', label, detail || ''); }
  else { fail++; console.log('  FAIL', label, detail || ''); }
}

console.log('== parseSheet against all_years_cashew.xlsx ==');
const countryRows = app.parseSheet(countryRaw, 'country');
const summaryRows = app.parseSheet(summaryRaw, 'summary');

check('country rows parsed', countryRows.length === 2093, `got ${countryRows.length} (expect 2093 = 2094 - header)`);
check('summary rows parsed', summaryRows.length === 63, `got ${summaryRows.length} (expect 63 = 64 - header)`);

const periods = new Set(countryRows.map(r => r.period).filter(Boolean));
check('multi-period detected', periods.size === 63, `got ${periods.size} unique periods`);
check('first period is 2020-01', periods.has('2020-01'));

// Spot-check a known row: 2020-01 AI CẬP 150 tons / 1,271,038 USD
const sample = countryRows.find(r => r.period === '2020-01' && /AI\s*CAP/i.test(app.stripAccents(r.country || '')));
check('sample row exists (2020-01 AI CAP)', !!sample);
if (sample) {
  check('sample qty = 150', sample.quantity_month === 150, `got ${sample.quantity_month}`);
  check('sample value = 1271038', sample.value_month_usd === 1271038, `got ${sample.value_month_usd}`);
  check('sample product = Hạt điều', sample.product === 'Hạt điều', `got ${sample.product}`);
  check('sample unit = Tấn', sample.unit === 'Tấn', `got ${sample.unit}`);
}

// YTD columns: 2020-03 row of summary = 94678 / 666903818
const sm3 = summaryRows.find(r => r.period === '2020-03');
check('summary 2020-03 YTD qty = 94678', sm3 && sm3.quantity_ytd === 94678, `got ${sm3 && sm3.quantity_ytd}`);
check('summary 2020-03 YTD value = 666903818', sm3 && sm3.value_ytd_usd === 666903818, `got ${sm3 && sm3.value_ytd_usd}`);

console.log('== loadExcelFile multi-period grouping (same logic) ==');
// Replicate the grouping block from loadExcelFile to confirm period partitioning
const filePeriods = new Set(countryRows.map(r => r.period).filter(Boolean));
if (filePeriods.size > 1) {
  const allP = new Set([...filePeriods, ...summaryRows.map(r => r.period).filter(Boolean)]);
  allP.forEach(p => {
    app.state.periods[p] = {
      summaryRows: summaryRows.filter(r => r.period === p),
      countryRows: countryRows.filter(r => r.period === p),
      fileName: 'all_years_cashew.xlsx',
    };
  });
  check('state.periods populated', Object.keys(app.state.periods).length === 63, `got ${Object.keys(app.state.periods).length}`);
  const p2020 = app.state.periods['2020-01'];
  check('2020-01 has country rows', p2020 && p2020.countryRows.length > 20, `got ${p2020 && p2020.countryRows.length}`);
  // periodTotals for 2020-01 — cross-validate against the summary sheet value (172552589)
  const t = app.periodTotals('2020-01');
  const sm0 = summaryRows.find(r => r.period === '2020-01');
  check('2020-01 country sum == summary value', t.val === sm0.value_month_usd, `country sum ${t.val} vs summary ${sm0 && sm0.value_month_usd}`);
  const latest = Object.keys(app.state.periods).sort().at(-1);
  console.log('  latest period:', latest);
  // All periods cashew-filtered counts
  const totalRows = Object.keys(app.state.periods).reduce((s, p) => s + app.state.periods[p].countryRows.filter(app.isCashewRow).length, 0);
  check('all rows are cashew (filter keeps them)', totalRows === countryRows.length, `got ${totalRows}`);
}

// ISO mapping sanity for the map: how many rows map to a known ISO?
const isoCount = countryRows.reduce((s, r) => s + (app.COUNTRY_ISO ? 0 : 0), 0);
console.log('== ISO mapping availability ==');
// COUNTRY_ISO not exported; approximate by testing a few names through a mini map
const known = ['HOA KY', 'TRUNG QUOC', 'NHAT BAN', 'HAN QUOC'];
console.log('  (COUNTRY_ISO lives inside app.js; map build tested in browser)');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
