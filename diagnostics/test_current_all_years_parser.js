/* Regression check for current All Years workbook layout + Vinacas classifier. */
'use strict';
const fs = require('fs');
const path = require('path');
global.document = { addEventListener: () => {}, getElementById: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} } }), body: { appendChild() {}, removeChild() {} } };
global.window = {};
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 0);
global.FileReader = class {};
global.XLSX = { utils: { sheet_to_json: ws => ws } };
let source = fs.readFileSync(path.resolve(__dirname, '..', 'web', 'app.js'), 'utf8');
source += '\n;module.exports = { classifyWorkbookLayout, parseSheet };';
const moduleStub = { exports: {} };
new Function('module', 'exports', source)(moduleStub, moduleStub.exports);
const app = moduleStub.exports;
const rowsPath = process.argv[2];
if (!rowsPath) throw new Error('Pass JSON sheet rows extracted from current all_years_cashew.xlsx');
const sheets = JSON.parse(fs.readFileSync(rowsPath, 'utf8'));

const assert = (ok, message) => { if (!ok) throw new Error(message); console.log('PASS', message); };
const names = ['Tong_Quan_XNK_All', 'Can_Can_Thuong_Mai_All', 'XK_Theo_Nuoc_All', 'NK_Theo_Nuoc_All', 'Lich_Su_Phien_Ban_All', 'Vinacas', 'Tong_XK_All'];
assert(app.classifyWorkbookLayout(names) === 'all_years', 'All Years workbook remains TCHQ even with Vinacas sheet');
assert(app.classifyWorkbookLayout(['Vinacas']) === 'vinacas', 'standalone Vinacas workbook is classified separately');

const summary = app.parseSheet(sheets.Tong_Quan_XNK_All, 'summary');
const xk = app.parseSheet(sheets.XK_Theo_Nuoc_All, 'country-export');
const nk = app.parseSheet(sheets.NK_Theo_Nuoc_All, 'country-import');
const versions = app.parseSheet(sheets.Lich_Su_Phien_Ban_All, 'version');
const periods = new Set([...summary, ...xk, ...nk].map(r => r.period).filter(Boolean));
assert(periods.size === 81, `81 periods parsed (got ${periods.size})`);
assert(xk.some(r => r.period === '2020-01' && r.country && r.quantity_month != null), '2020-01 export country records parsed');
assert(nk.some(r => r.period === '2025-09' && r.country && r.value_month_usd != null), '2025-09 import country records parsed');
assert(summary.some(r => r.period === '2020-01' && r.direction === 'export' && r.value_month_usd != null), 'summary flow/value parsed');
assert(versions.length > 0 && versions.every(r => r.period && r.version), 'version history parsed');
