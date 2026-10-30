/* Investigation: why map values look wrong + ISO coverage audit
   against the REAL all_years_cashew.xlsx rows. */
'use strict';
const fs = require('fs');
const path = require('path');

global.document = { addEventListener: () => {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }), body: { appendChild: () => {} } };
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {} };
global.XLSX = { utils: { sheet_to_json: (ws) => ws } };

const APP = path.resolve(__dirname, '..', 'web', 'app.js');
let src = fs.readFileSync(APP, 'utf8');
src += `\n;module.exports = { parseSheet, stripAccents, COUNTRY_ISO, state, isCashewRow };`;
const m = { exports: {} };
new Function('module', 'exports', src)(m, m.exports);
const app = m.exports;

const rows = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'dof_xlsx_rows.json'), 'utf8'));
const countryRows = app.parseSheet(rows['XK_Theo_Nuoc_All'], 'country');

// 1. Unique countries + unmapped audit
const byCountry = new Map();
countryRows.forEach(r => {
  const c = (r.country || '').trim() || '(BLANK)';
  const e = byCountry.get(c) || { count: 0, val: 0 };
  e.count++; e.val += (r.value_month_usd || 0);
  byCountry.set(c, e);
});

console.log('== ISO coverage audit (all periods) ==');
let mappedN = 0, unmappedN = 0, unmappedVal = 0;
const unmapped = [];
byCountry.forEach((e, c) => {
  const iso = app.COUNTRY_ISO[app.stripAccents(c.toUpperCase())];
  if (iso) mappedN += e.count;
  else { unmappedN += e.count; unmappedVal += e.val; unmapped.push(`  "${c}" — ${e.count} rows · ${Math.round(e.val / 1e6)}M USD`); }
});
const total = mappedN + unmappedN;
console.log(`total rows: ${total} · mapped: ${mappedN} (${(mappedN / total * 100).toFixed(1)}%) · UNMAPPED: ${unmappedN} (${(unmappedN / total * 100).toFixed(1)}%) · unmapped value: ${Math.round(unmappedVal / 1e6)}M USD`);
console.log('UNMAPPED countries:');
unmapped.sort().forEach(l => console.log(l));

// 2. Spot-check: map agg for active period vs raw table
console.log('\n== Map agg spot-check (2026-09) ==');
const period = '2026-09';
const prows = countryRows.filter(r => r.period === period);
const agg = {};
prows.forEach(r => {
  const iso = app.COUNTRY_ISO[app.stripAccents((r.country || '').toUpperCase().trim())];
  if (!iso) return;
  agg[iso] = (agg[iso] || 0) + (r.value_month_usd || 0);
});
console.log('rows in period:', prows.length, '· mapped markets:', Object.keys(agg).length);
const top = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 5);
top.forEach(([iso, v]) => console.log(`  ${iso}: ${Math.round(v / 1e6)}M`));
// USA raw row
const usa = prows.find(r => /HOA KY/i.test(app.stripAccents(r.country || '')));
console.log('USA raw row:', usa ? `qty=${usa.quantity_month} val=${usa.value_month_usd} ytdVal=${usa.value_ytd_usd}` : 'NOT FOUND');
console.log('USA map agg:', agg.USA);

// 3. YTD semantics check — is CY monthly and YTD cumulative?
console.log('\n== CY vs YTD semantics (summary sheet) ==');
const summary = app.parseSheet(rows['Tong_XK_All'], 'summary');
const s2020 = summary.filter(r => (r.period || '').startsWith('2020')).slice(0, 4);
s2020.forEach(r => console.log(`  ${r.period}: CY qty=${r.quantity_month} · YTD qty=${r.quantity_ytd} · CY val=${Math.round(r.value_month_usd / 1e6)}M · YTD val=${Math.round(r.value_ytd_usd / 1e6)}M`));
const cumCheck = s2020.reduce((s, r) => s + (r.quantity_month || 0), 0);
console.log(`sum of first 4 months CY qty = ${cumCheck} vs last YTD = ${s2020[3] && s2020[3].quantity_ytd}`);
