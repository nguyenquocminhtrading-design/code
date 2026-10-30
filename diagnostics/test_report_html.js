/* Master Plan v2 · Phase 6Q — Báo cáo HTML: in PDF không collapse + slide 16:9 + nhúng new_export*.js.
   Reads web/app.js + web/index.html AT RUN TIME (no hardcoded results).
   Modes: [BASELINE] failing = FAILED (exit 1) · [PENDING] lands with web-ui = PENDING (not fail).
   Run: node diagnostics/test_report_html.js */
'use strict';
const fs = require('fs');
const path = require('path');
const APP = path.resolve(__dirname, '..', 'web', 'app.js');
const INDEX = path.resolve(__dirname, '..', 'web', 'index.html');
const appSrc = fs.readFileSync(APP, 'utf8');
const html = fs.readFileSync(INDEX, 'utf8');

// ── Report CSS lives inside the buildReportHTML template literal ──
function reportCss() {
  const start = appSrc.indexOf('return \`<!DOCTYPE html>');
  if (start < 0) return '';
  const styleStart = appSrc.indexOf('<style>', start);
  const styleEnd = appSrc.indexOf('</style>', start);
  return styleStart >= 0 && styleEnd > styleStart ? appSrc.slice(styleStart, styleEnd) : '';
}
function scriptPos(name) { return html.indexOf(name); }            // tìm tên file bất kỳ (CDN URL đầy đủ)
function scriptSrcAttr(name) { return html.indexOf('src="' + name); } // tìm tag <script src="name..." (file local)

const results = [];
function check(mode, name, fn) {
  let outcome, detail = '';
  try {
    const ok = fn();
    if (ok === true) outcome = 'PASSED';
    else if (ok === 'skip') { outcome = 'SKIPPED'; detail = String(ok); }
    else { outcome = mode === 'baseline' ? 'FAILED' : 'PENDING'; detail = String(ok || 'assert false'); }
  } catch (e) {
    outcome = mode === 'baseline' ? 'FAILED' : 'PENDING';
    detail = e.message;
  }
  results.push({ mode: mode, outcome: outcome, name: name, detail: detail });
}

console.log('== diagnostics/test_report_html.js ==');
console.log('   app.js: ' + appSrc.length + ' chars · index.html: ' + html.length + ' chars · css: ' + reportCss().length + ' chars');

// ═══════════ BASELINE ═══════════
check('baseline', 'B1 · app.js có buildReportHTML() + captureChart() + EX_TEMPLATES', function () {
  return appSrc.indexOf('function buildReportHTML') >= 0
    && appSrc.indexOf('function captureChart') >= 0
    && appSrc.indexOf('EX_TEMPLATES') >= 0
    ? true : 'thiếu hàm nền của Báo cáo HTML';
});
check('baseline', 'B2 · report CSS có @media print và slide mode ?slides=1', function () {
  const css = reportCss();
  return css.indexOf('@media print') >= 0 && appSrc.indexOf('?slides=1') >= 0
    ? true : 'thiếu @media print / slides mode';
});
check('baseline', 'B3 · index.html vẫn nạp jspdf + autotable + pptxgenjs (fallback export)', function () {
  return scriptPos('jspdf.umd.min.js') >= 0
    && scriptPos('jspdf.plugin.autotable.min.js') >= 0
    && scriptPos('pptxgen.bundle.js') >= 0
    ? true : 'thiếu CDN export cũ';
});
check('baseline', 'B4 · new_exportPDF.js + new_exportPPTX.js (root) tồn tại và parse OK', function () {
  let ok = 0;
  ['new_exportPDF.js', 'new_exportPPTX.js'].forEach(function (f) {
    const p = path.resolve(__dirname, '..', f);
    if (fs.existsSync(p)) {
      try { new Function(fs.readFileSync(p, 'utf8')); ok++; } catch (e) { throw new Error(f + ' lỗi cú pháp: ' + e.message); }
    }
  });
  return ok === 2 ? true : 'thiếu/failed: ' + ok + '/2 file';
});
check('baseline', 'B5 · app.js vẫn cung cấp đủ dependency cho new_export*.js', function () {
  const deps = ['collectExportPayload', 'runQualityChecks', 'exCardBusy', 'exFetchVnFonts', 'exLogoDataUrl',
    'exToastOk', 'exLogoSync', 'exFileName', 'downloadBlob', 'QUALITY_CHECKS', 'EX_TEMPLATES', 'EX_THEME',
    'generateMarketNarrative', 'EX_AI_BLOCKS', 'exAICtxJSON', 'stripAccents'];
  const miss = deps.filter(function (d) { return appSrc.indexOf('function ' + d) < 0 && appSrc.indexOf('const ' + d) < 0; });
  return miss.length === 0 ? true : 'app.js thiếu: ' + miss.join(', ');
});

// ═══════════ PENDING (Phase 4 nhúng + Phase 5 chống collapse) ═══════════
check('pending', 'P1 · index.html nhúng <script src="new_exportPDF.js"> + <script src="new_exportPPTX.js">', function () {
  const a = scriptSrcAttr('new_exportPDF.js');
  const b = scriptSrcAttr('new_exportPPTX.js');
  return a >= 0 && b >= 0 ? true : 'index.html chưa nhúng 2 file (pdf@' + a + ', pptx@' + b + ')';
});
check('pending', 'P2 · 2 script nhúng nằm SAU app.js (override exportPDF/exportPPTX)', function () {
  const appPos = scriptSrcAttr('app.js');
  const a = scriptSrcAttr('new_exportPDF.js');
  const b = scriptSrcAttr('new_exportPPTX.js');
  return appPos >= 0 && a > appPos && b > appPos
    ? true : 'thứ tự script sai: app@' + appPos + ' pdf@' + a + ' pptx@' + b;
});
check('pending', 'P3 · web/new_exportPDF.js + web/new_exportPPTX.js tồn tại (đưa vào thư mục web/)', function () {
  let ok = 0;
  ['new_exportPDF.js', 'new_exportPPTX.js'].forEach(function (f) {
    const p = path.resolve(__dirname, '..', 'web', f);
    if (fs.existsSync(p)) {
      try { new Function(fs.readFileSync(p, 'utf8')); ok++; } catch (e) { throw new Error('web/' + f + ' lỗi cú pháp: ' + e.message); }
    }
  });
  return ok === 2 ? true : 'chỉ có ' + ok + '/2 trong web/';
});
check('pending', 'P4 · print CSS không còn chặn ngắt trang nguyên section (.rep-sec { ... page-break-inside:avoid })', function () {
  const css = reportCss();
  return !/\.rep-sec\s*\{[^}]*page-break-inside\s*:\s*avoid/.test(css)
    ? true : 'vẫn còn page-break-inside:avoid trên .rep-sec';
});
check('pending', 'P5 · print CSS có table-header-group (bảng dài tách trang + lặp thead)', function () {
  return reportCss().indexOf('table-header-group') >= 0 ? true : 'chưa có table-header-group';
});
check('pending', 'P6 · slide mode 16:9 có biến --slide-scale', function () {
  return reportCss().indexOf('--slide-scale') >= 0 ? true : 'chưa có --slide-scale';
});
check('pending', 'P7 · (optional) PPTX image-mode: html2canvas hoặc EX_TEMPLATES.pptx.mode', function () {
  return appSrc.indexOf('html2canvas') >= 0 || appSrc.indexOf("pptx.mode") >= 0 || appSrc.indexOf('pptx: {') === -1
    ? true : 'chưa có html2canvas/pptx.mode (tuỳ chọn trong plan)';
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
  console.log('❌ Có FAILED — nền Báo cáo HTML/export đã bị phá.');
} else if (counts.PENDING > 0) {
  console.log('⏳ Không có FAILED; mục PENDING chờ web-ui Phase 4+5 — Lead chạy lại sau.');
} else {
  console.log('✅ Tất cả PASSED — Phase 4+5 đã đáp ứng đủ tiêu chí export.');
}
process.exit(counts.FAILED > 0 ? 1 : 0);
