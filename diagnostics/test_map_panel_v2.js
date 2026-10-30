/* Master Plan v2 · Phase 6Q — Bản đồ + panel quốc gia: đủ ISO mapping, trust badge, panel 5 KPI.
   Reads web/app.js + web/index.html AT RUN TIME (no hardcoded results).
   Modes: [BASELINE] failing = FAILED (exit 1) · [PENDING] lands with web-ui = PENDING (not fail).
   Run: node diagnostics/test_map_panel_v2.js */
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
global.XLSX = { utils: { sheet_to_json: function (ws) { return ws; } } };
global.showToast = function () {};
global.L = {};
const APP = path.resolve(__dirname, '..', 'web', 'app.js');
const INDEX = path.resolve(__dirname, '..', 'web', 'index.html');
let src = fs.readFileSync(APP, 'utf8');
src += '\n;module.exports = { COUNTRY_ISO, NON_COUNTRY_ROWS, getFilteredRowsBase, periodDetailIsTrusted, renderMap, renderMapPanel, selectMapCountry, resetMapView, stripAccents, isOtherRow, setMapPanelVersionBadge, state };';
const m = { exports: {} };
new Function('module', 'exports', src)(m, m.exports);
const app = m.exports;
const html = fs.readFileSync(INDEX, 'utf8');

// ── Real country names (read-only; data checks degrade to SKIPPED when absent) ──
let namesBySource = null;
let dataError = '';
try {
  const payload = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'output', 'data', 'all_years_cashew.json'), 'utf8'));
  namesBySource = { export: new Set(), import: new Set(), vinacas: new Set() };
  (payload.records || []).forEach(function (r) {
    if (r.country && namesBySource[r.flow]) namesBySource[r.flow].add(String(r.country));
  });
  (payload.vinacas_records || []).forEach(function (r) {
    const n = r.country_report || r.country_raw;
    if (n) namesBySource.vinacas.add(String(n));
  });
} catch (e) { dataError = e.message; }

function hitRate(names) {
  const real = [...names].filter(function (n) { return !app.isOtherRow({ country: n }); });
  if (!real.length) return { rate: 1, miss: [] };
  const miss = real.filter(function (n) { return !app.COUNTRY_ISO[app.stripAccents(n.toUpperCase().trim())]; });
  return { rate: (real.length - miss.length) / real.length, miss: miss };
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

console.log('== diagnostics/test_map_panel_v2.js ==');
console.log('   app.js: ' + (src.length > 0) + ' · index.html: ' + (html.length > 0) + ' · data: ' + (namesBySource ? 'loaded' : 'SKIPPED (' + dataError + ')'));

// ═══════════ BASELINE ═══════════
check('baseline', 'B1 · COUNTRY_ISO tồn tại với ≥100 mục ISO A3', function () {
  const n = Object.keys(app.COUNTRY_ISO).length;
  return n >= 100 ? true : 'COUNTRY_ISO chỉ có ' + n + ' mục';
});
check('baseline', 'B2 · mapping sẵn có đúng: HOA KY→USA, TRUNG QUOC→CHN', function () {
  return app.COUNTRY_ISO['HOA KY'] === 'USA' && app.COUNTRY_ISO['TRUNG QUOC'] === 'CHN'
    ? true : 'mapping gốc sai: ' + app.COUNTRY_ISO['HOA KY'] + '/' + app.COUNTRY_ISO['TRUNG QUOC'];
});
check('baseline', 'B3 · NON_COUNTRY_ROWS chứa "other" (loại dòng tổng hợp khỏi bản đồ)', function () {
  return app.NON_COUNTRY_ROWS.has('other') ? true : 'NON_COUNTRY_ROWS = ' + [...app.NON_COUNTRY_ROWS];
});
check('baseline', 'B4 · index.html panel bản đồ có #mp-val, #mp-qty, #mp-ytd, #mp-share, #map-panel-detail', function () {
  return ['mp-val', 'mp-qty', 'mp-ytd', 'mp-share', 'map-panel-detail'].every(function (id) {
    return html.indexOf('id="' + id + '"') >= 0;
  }) ? true : 'thiếu element panel gốc';
});
check('baseline', 'B5 · app.js có renderMap / renderMapPanel / selectMapCountry / resetMapView', function () {
  return [app.renderMap, app.renderMapPanel, app.selectMapCountry, app.resetMapView].every(function (f) { return typeof f === 'function'; })
    ? true : 'thiếu hàm bản đồ';
});
check('baseline', 'B6 · getFilteredRowsBase() vẫn lọc theo phiên bản (filterRowsByVersion)', function () {
  return /filterRowsByVersion\(/.test(fnSrc(app.getFilteredRowsBase)) ? true : 'không còn lọc version';
});
check('baseline', 'B7 · [data] tỷ lệ map được tên quốc gia XK ≥ 90%', function () {
  if (!namesBySource) return 'skip';
  const h = hitRate(namesBySource.export);
  return h.rate >= 0.9 ? true : 'hit rate XK = ' + (h.rate * 100).toFixed(1) + '% · thiếu: ' + h.miss.join(', ');
});
check('baseline', 'B8 · [data] tỷ lệ map được tên quốc gia NK ≥ 75% (guard hồi quy)', function () {
  if (!namesBySource) return 'skip';
  const h = hitRate(namesBySource.import);
  return h.rate >= 0.75 ? true : 'hit rate NK = ' + (h.rate * 100).toFixed(1) + '%';
});

// ═══════════ PENDING (Phase 3 — web-ui) ═══════════
check('pending', 'P1 · COUNTRY_ISO["BO BIEN NGA"] === "CIV" (Bờ Biển Ngà)', function () {
  return app.COUNTRY_ISO['BO BIEN NGA'] === 'CIV' ? true : 'giá trị: ' + app.COUNTRY_ISO['BO BIEN NGA'];
});
check('pending', 'P2 · COUNTRY_ISO["NIGIERIA"] === "NGA" (Nigiêria)', function () {
  return app.COUNTRY_ISO['NIGIERIA'] === 'NGA' ? true : 'giá trị: ' + app.COUNTRY_ISO['NIGIERIA'];
});
check('pending', 'P3 · COUNTRY_ISO["GANA"] === "GHA" (Gana)', function () {
  return app.COUNTRY_ISO['GANA'] === 'GHA' ? true : 'giá trị: ' + app.COUNTRY_ISO['GANA'];
});
check('pending', 'P4 · COUNTRY_ISO["GUINEA-BISSAU"] === "GNB"', function () {
  return app.COUNTRY_ISO['GUINEA-BISSAU'] === 'GNB' ? true : 'giá trị: ' + app.COUNTRY_ISO['GUINEA-BISSAU'];
});
check('pending', 'P5 · COUNTRY_ISO["COLOMBIA"] === "COL"', function () {
  return app.COUNTRY_ISO['COLOMBIA'] === 'COL' ? true : 'giá trị: ' + app.COUNTRY_ISO['COLOMBIA'];
});
check('pending', 'P6 · NON_COUNTRY_ROWS thêm "others" (dòng "Others" của Vinacas không vào bản đồ)', function () {
  return app.NON_COUNTRY_ROWS.has('others') ? true : 'NON_COUNTRY_ROWS = ' + [...app.NON_COUNTRY_ROWS];
});
check('pending', 'P7 · getFilteredRowsBase bỏ hard return [] khi chưa đối soát + có cơ chế cảnh báo (cờ/notice)', function () {
  const s = fnSrc(app.getFilteredRowsBase);
  const noHardGate = !/if\s*\(\s*!periodDetailIsTrusted\([^)]*\)\s*\)\s*return\s*\[\]\s*;/.test(s);
  const hasMechanism = /detailUntrusted|untrusted|ch\u01b0a \u0111\u1ed1i so\u00e1t|trustNotice|trust-badge|reconNotice/i.test(s)
    || /state\.detailUntrusted/.test(fnSrc(app.periodDetailIsTrusted));
  return noHardGate && hasMechanism ? true : 'noHardGate=' + noHardGate + ' · hasMechanism=' + hasMechanism;
});
check('pending', 'P8 · index.html panel có #mp-qty-ytd, #mp-version, badge chưa đối soát (id/class trust-badge)', function () {
  // Phase 6V: trust-badge là CLASS trên 3 span (thiết kế của web-ui) — chấp nhận cả id= lẫn class=
  const hasTrust = html.indexOf('id="trust-badge"') >= 0 || html.indexOf('class="trust-badge"') >= 0;
  const okAll = ['mp-qty-ytd', 'mp-version'].every(function (id) {
    return html.indexOf('id="' + id + '"') >= 0;
  }) && hasTrust;
  return okAll ? true : 'thiếu element mới của panel';
});
check('pending', 'P9 · renderMapPanel() (trực tiếp hoặc qua helper) điền #mp-qty-ytd và #mp-version', function () {
  // Phase 6V: badge phiên bản nằm ở helper setMapPanelVersionBadge được gọi từ renderMapPanel
  const s = fnSrc(app.renderMapPanel) + (app.setMapPanelVersionBadge ? fnSrc(app.setMapPanelVersionBadge) : '');
  return s.indexOf('mp-qty-ytd') >= 0 && s.indexOf('mp-version') >= 0
    ? true : 'renderMapPanel/helper chưa điền KPI mới';
});
check('pending', 'P10 · [data] tỷ lệ map được tên quốc gia NK ≥ 90% (sau khi thêm CIV/NGA/GHA/GNB/COL)', function () {
  if (!namesBySource) return 'skip';
  const h = hitRate(namesBySource.import);
  return h.rate >= 0.9 ? true : 'hit rate NK = ' + (h.rate * 100).toFixed(1) + '% · thiếu: ' + h.miss.join(', ');
});
check('pending', 'P11 · [data] tỷ lệ map được tên quốc gia Vinacas ≥ 95%', function () {
  if (!namesBySource) return 'skip';
  const h = hitRate(namesBySource.vinacas);
  return h.rate >= 0.95 ? true : 'hit rate Vinacas = ' + (h.rate * 100).toFixed(1) + '% · thiếu: ' + h.miss.join(', ');
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
  console.log('❌ Có FAILED — baseline bản đồ/panel đã bị phá.');
} else if (counts.PENDING > 0) {
  console.log('⏳ Không có FAILED; mục PENDING chờ web-ui Phase 3 — Lead chạy lại sau.');
} else {
  console.log('✅ Tất cả PASSED — Phase 3 đã đáp ứng đủ tiêu chí bản đồ/panel.');
}
process.exit(counts.FAILED > 0 ? 1 : 0);
