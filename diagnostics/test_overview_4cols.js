/* Master Plan v2 · Phase 6Q — Overview "Các kỳ đã tải": 4 cột CY/YTD + mặc định Điều chỉnh.
   Reads web/app.js + web/index.html AT RUN TIME (no hardcoded results).
   Check modes:
     [BASELINE] must hold before AND after web-ui changes — failing = FAILED (exit 1)
     [PENDING ] lands with web-ui — failing now = PENDING (not a failure; rerun later)
   Run: node diagnostics/test_overview_4cols.js
   Exit: 0 when no FAILED, 1 otherwise. */
'use strict';
const fs = require('fs');
const path = require('path');
const elements = {};
function elStub(id) {
  if (!elements[id]) {
    elements[id] = {
      id: id, textContent: '', innerHTML: '', style: {}, value: '',
      classList: { add: function () {}, remove: function () {}, toggle: function () {} },
      querySelector: function () { return null; }, appendChild: function () {}, closest: function () { return null; },
    };
  }
  return elements[id];
}
global.document = {
  addEventListener: function () {},
  getElementById: function (id) { return elStub(id); },
  querySelectorAll: function () { return []; },
  createElement: function () { return elStub('_dyn' + Math.random()); },
  body: { appendChild: function () {}, removeChild: function () {} },
};
global.window = {};
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
global.sessionStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
global.performance = { now: function () { return Date.now(); } };
global.requestAnimationFrame = function (fn) { setTimeout(function () { fn(Date.now()); }, 0); };
global.FileReader = function () { this.readAsArrayBuffer = function () {}; this.readAsText = function () {}; };
global.XLSX = { utils: { sheet_to_json: function (ws) { return ws; }, json_to_sheet: function () { return {}; }, book_new: function () { return {}; }, book_append_sheet: function () {} } };
global.showToast = function () {};
const APP = path.resolve(__dirname, '..', 'web', 'app.js');
const INDEX = path.resolve(__dirname, '..', 'web', 'index.html');
let src = fs.readFileSync(APP, 'utf8');
src += '\n;module.exports = { buildPeriodsFromCanonical, periodTotals, pickVersionedSummary, loadAllYearsJSON, renderPeriodsTable, getFilteredRowsBase, periodDetailIsTrusted, filterRowsByVersion, state, COUNTRY_ISO, isCashewRow, stripAccents };';
const m = { exports: {} };
new Function('module', 'exports', src)(m, m.exports);
const app = m.exports;
const html = fs.readFileSync(INDEX, 'utf8');
let dataAvailable = false;
let dataError = '';
try {
  const payload = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'output', 'data', 'all_years_cashew.json'), 'utf8'));
  app.state.periods = app.buildPeriodsFromCanonical(payload.records || [], payload.periods || {});
  dataAvailable = Object.keys(app.state.periods).length > 0;
  if (!dataAvailable) dataError = 'all_years_cashew.json has no valid periods';
} catch (e) { dataError = e.message; }
app.state.flow = 'export';
function periodsThead() {
  const tb = html.indexOf('id="periods-body"');
  if (tb < 0) return '';
  const theadStart = html.lastIndexOf('<thead>', tb);
  // LƯU Ý: </thead> của bảng kỳ nằm TRƯỚC tbody — phải tìm từ theadStart, không phải từ tb
  const theadEnd = theadStart >= 0 ? html.indexOf('</thead>', theadStart) : -1;
  return theadStart >= 0 && theadEnd > theadStart ? html.slice(theadStart, theadEnd) : '';
}
const results = [];
function check(mode, name, fn) {
  let outcome, detail = '';
  try {
    const ok = fn();
    if (ok === true) outcome = 'PASSED';
    else if (ok === 'skip') { outcome = 'SKIPPED'; detail = dataError || 'no data'; }
    else { outcome = mode === 'baseline' ? 'FAILED' : 'PENDING'; detail = String(ok || 'assert false'); }
  } catch (e) {
    outcome = mode === 'baseline' ? 'FAILED' : 'PENDING';
    detail = e.message;
  }
  results.push({ mode: mode, outcome: outcome, name: name, detail: detail });
}
const fnSrc = function (f) { try { return f.toString(); } catch (e) { return ''; } };
console.log('== diagnostics/test_overview_4cols.js ==');
console.log('   app.js: ' + (src.length > 0) + ' · index.html: ' + (html.length > 0) + ' · data: ' + (dataAvailable ? 'loaded' : 'SKIPPED (' + dataError + ')'));
check('baseline', 'B1 · index.html bảng kỳ có tbody#periods-body + thead 5 cột (Kỳ + 4 cột dữ liệu)', function () {
  const thead = periodsThead();
  if (!thead) return 'không tìm thấy thead của periods-body';
  const thCount = (thead.match(/<th[\s>]/g) || []).length;
  return thCount === 5 && /Kỳ/.test(thead) ? true : 'thead có ' + thCount + ' cột (cần 5)';
});
check('baseline', 'B2 · renderPeriodsTable() ghi vào #periods-body và gọi periodTotals()', function () {
  const s = fnSrc(app.renderPeriodsTable);
  return /periods-body/.test(s) && /periodTotals\(/.test(s) ? true : 'thiếu periods-body/periodTotals';
});
check('baseline', 'B3 · loadAllYearsJSON() vẫn nạp all_years_cashew.json (nguồn chính không đổi)', function () {
  const s = fnSrc(app.loadAllYearsJSON);
  return /all_years_cashew\.json/.test(s) ? true : 'loadAllYearsJSON không còn trỏ all_years_cashew.json';
});
check('baseline', 'B4 · pickVersionedSummary() vẫn có chuỗi hạ cấp official → adjusted → preliminary', function () {
  const s = fnSrc(app.pickVersionedSummary);
  return s.indexOf('official') >= 0 && s.indexOf('adjusted') >= 0 && s.indexOf('preliminary') >= 0
    ? true : 'chuỗi hạ cấp phiên bản bị mất';
});
check('baseline', 'B5 · getFilteredRowsBase() vẫn lọc theo phiên bản (filterRowsByVersion)', function () {
  const s = fnSrc(app.getFilteredRowsBase);
  return /filterRowsByVersion\(/.test(s) ? true : 'getFilteredRowsBase không còn lọc version';
});
check('baseline', 'B6 · [data] periodTotals("2023-07") trả qtyY>0 và valY>0 (YTD có số liệu thật)', function () {
  if (!dataAvailable) return 'skip';
  app.state.version = 'official';
  const t = app.periodTotals('2023-07');
  return t && t.qtyY > 0 && t.valY > 0 ? true : 'periodTotals 2023-07 = ' + JSON.stringify(t);
});
check('baseline', 'B7 · [data] buildPeriodsFromCanonical nạp được ≥80 kỳ từ all_years_cashew.json', function () {
  if (!dataAvailable) return 'skip';
  return Object.keys(app.state.periods).length >= 80
    ? true : 'chỉ nạp được ' + Object.keys(app.state.periods).length + ' kỳ';
});
check('pending', 'P1 · index.html thead periods-body đủ nhãn CY Lượng / CY Trị giá / YTD Lượng / YTD Trị giá', function () {
  const thead = periodsThead();
  return /CY L\u01b0\u1ee3ng/.test(thead) && /CY Tr\u1ecb gi\u00e1/.test(thead)
    && /YTD L\u01b0\u1ee3ng/.test(thead) && /YTD Tr\u1ecb gi\u00e1/.test(thead)
    ? true : 'thead chưa đủ 4 nhãn CY/YTD';
});
check('pending', 'P2 · renderPeriodsTable() render ô YTD Lượng (t.qtyY)', function () {
  const s = fnSrc(app.renderPeriodsTable);
  return /\.qtyY/.test(s) ? true : 'renderPeriodsTable chưa render qtyY';
});
check('pending', 'P3 · loadAllYearsJSON() đặt mặc định state.version = "adjusted"', function () {
  const s = fnSrc(app.loadAllYearsJSON);
  return /state\.version\s*=\s*['"]adjusted['"]/.test(s) ? true : 'chưa đặt mặc định adjusted';
});
check('pending', 'P4 · loadAllYearsJSON() có overlay fetch all_years_cashew_DieuChinh.json', function () {
  const s = fnSrc(app.loadAllYearsJSON);
  return /all_years_cashew_DieuChinh\.json/.test(s) ? true : 'chưa có overlay DieuChinh';
});
check('pending', 'P5 · pickVersionedSummary() có fallback tổng hợp từ dòng quốc gia khi thiếu summary', function () {
  const s = fnSrc(app.pickVersionedSummary);
  return /reduce\s*\(|aggregate|tổng hợp|deriveSummary|sumCountry|versionRows/i.test(s)
    ? true : 'chưa có fallback tổng hợp trong pickVersionedSummary';
});
check('pending', 'P6 · [data] version="adjusted": periodTotals("2024-02") CY lượng+trị giá > 0 (tổng dòng Điều chỉnh)', function () {
  if (!dataAvailable) return 'skip';
  app.state.version = 'adjusted';
  const t = app.periodTotals('2024-02');
  app.state.version = 'official';
  return t && t.val > 0 && t.qty > 0 ? true : 'periodTotals 2024-02 (adjusted) = ' + JSON.stringify(t);
});
check('pending', 'P7 · [data] version="adjusted": periodTotals("2023-07") vẫn có YTD > 0 (hết KPI 0)', function () {
  if (!dataAvailable) return 'skip';
  app.state.version = 'adjusted';
  const t = app.periodTotals('2023-07');
  app.state.version = 'official';
  return t && t.valY > 0 && t.qtyY > 0 ? true : 'periodTotals 2023-07 (adjusted) = ' + JSON.stringify(t);
});
const counts = { PASSED: 0, PENDING: 0, FAILED: 0, SKIPPED: 0 };
console.log('\n' + '─'.repeat(78));
results.forEach(function (r, i) {
  counts[r.outcome] = (counts[r.outcome] || 0) + 1;
  const icon = { PASSED: 'PASSED ', PENDING: 'PENDING', FAILED: 'FAILED ', SKIPPED: 'SKIPPED' }[r.outcome];
  console.log('[' + icon + '] ' + String(i + 1).padStart(2) + ' · ' + r.name + (r.detail ? '  → ' + r.detail : ''));
});
console.log('─'.repeat(78));
console.log('TỔNG KẾT: PASSED=' + counts.PASSED + ' · PENDING=' + counts.PENDING + ' · FAILED=' + counts.FAILED + ' · SKIPPED=' + counts.SKIPPED);
if (counts.FAILED > 0) {
  console.log('❌ Có FAILED — baseline dashboard đã bị phá (xem dòng FAILED).');
} else if (counts.PENDING > 0) {
  console.log('⏳ Không có FAILED; mục PENDING chờ web-ui hoàn tất — Lead chạy lại sau.');
} else {
  console.log('✅ Tất cả PASSED — web-ui Phase 1 đã đáp ứng đủ tiêu chí.');
}
process.exit(counts.FAILED > 0 ? 1 : 0);
