// ════════════════════════════════════════════════════════════════════════════════
// DAN ON FOOD · Cashew trade reports — PDF (jsPDF, landscape A4)
//   exportAnnualPDF(year, version)    → 15 trang  (EX_TEMPLATES.annualReport.pdfPages)
//   exportMonthlyPDF(period, version) → 10 trang  (EX_TEMPLATES.monthlyReport.pdfPages)
// Toàn bộ số liệu lấy từ collectAnnualExportPayload / collectMonthlyExportPayload
// (app.js) — không suy diễn thị phần, không cộng gộp các chuỗi khác phạm vi.
// ════════════════════════════════════════════════════════════════════════════════

function exportPDF() {
  requestAnnualExport('pdf');
}

const EX_PDF_COLORS = {
  deep: '#17231F', gold: '#C9A227', goldDark: '#8A6D1C',
  cream: '#F5EBD0', soft: '#F7EFD8', muted: '#8A7B5E',
  green: '#3E7C4F', red: '#C0392B', line: '#E3E8E4', white: '#FFFFFF',
};

function exPdfPagesTotal(kind) {
  const tpl = typeof EX_TEMPLATES !== 'undefined'
    ? (kind === 'annual' ? EX_TEMPLATES.annualReport : EX_TEMPLATES.monthlyReport)
    : null;
  return (tpl && tpl.pdfPages) || (kind === 'annual' ? 15 : 10);
}

async function exPdfCreateDoc() {
  if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF chưa được tải');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let font = 'helvetica', hasVietnameseFont = false;
  try {
    const fonts = await exFetchVnFonts();
    doc.addFileToVFS('BeVietnamPro-Regular.ttf', fonts.normal);
    doc.addFont('BeVietnamPro-Regular.ttf', 'BeVietnamPro', 'normal');
    doc.addFileToVFS('BeVietnamPro-Bold.ttf', fonts.bold);
    doc.addFont('BeVietnamPro-Bold.ttf', 'BeVietnamPro', 'bold');
    font = 'BeVietnamPro';
    hasVietnameseFont = true;
  } catch (error) {
    console.warn('[export PDF] Vietnamese font unavailable; using Helvetica:', error);
  }
  return { doc, W: 297, H: 210, C: EX_PDF_COLORS, font, hasVietnameseFont };
}

// ── Shared drawing kit (header/footer/KPI/table/charts) ────────────────────────
function exPdfKit(ctx, opts) {
  const { doc, W, H, C, font, hasVietnameseFont } = ctx;
  const { vi, footerLabel, pagesTotal, sourcesLabel } = opts;
  const num = new Intl.NumberFormat(vi ? 'vi-VN' : 'en-US', { maximumFractionDigits: 0 });
  const t = v => hasVietnameseFont ? String(v ?? '') : stripAccents(String(v ?? ''));
  const fullUsd = v => (v == null || !Number.isFinite(v)) ? '—' : `${num.format(v)} USD`;
  const fullTon = v => (v == null || !Number.isFinite(v)) ? '—' : `${num.format(v)} ${vi ? 'tấn' : 't'}`;
  const compactUsd = value => {
    if (value == null || !Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    const scale = abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : abs >= 1e3 ? 1e3 : 1;
    const unit = abs >= 1e9 ? 'B' : abs >= 1e6 ? 'M' : abs >= 1e3 ? 'K' : '';
    return `${value < 0 ? '-' : ''}$${(abs / scale).toFixed(scale === 1 ? 0 : 1)}${unit}`;
  };
  const pct = value => value == null || !Number.isFinite(value)
    ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  const normalizeAlign = align => ({
    l: 'left', left: 'left',
    c: 'center', center: 'center',
    r: 'right', right: 'right',
    justify: 'justify',
  })[align] || (() => { throw new Error(`Unsupported PDF alignment: ${align}`); })();
  const drawText = (text, x, y, options = {}) => {
    if (![x, y].every(Number.isFinite)) throw new Error('PDF received a non-finite text position');
    const textOptions = options.align ? { ...options, align: normalizeAlign(options.align) } : options;
    doc.text(Array.isArray(text) ? text.map(t) : t(text), x, y, textOptions);
  };
  const rect = (x, y, w, h, style = 'F') => {
    if (![x, y, w, h].every(Number.isFinite) || w < 0 || h < 0) {
      throw new Error('PDF received invalid drawing dimensions');
    }
    doc.rect(x, y, w, h, style);
  };
  const setFont = (style, size, color) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    if (color) doc.setTextColor(color);
  };
  const header = (pageTitle, page) => {
    doc.setFillColor(C.deep);
    rect(0, 0, W, 23);
    setFont('bold', 15, C.white);
    drawText(pageTitle, 14, 15);
    setFont('normal', 8, C.muted);
    drawText(`DAN ON FOOD · ${footerLabel} · ${page}/${pagesTotal}`, 14, H - 6);
    drawText(sourcesLabel, 170, H - 6);
  };
  const cover = ({ kicker, titleLine, bigLine, subLines, metaLine, logoData }) => {
    doc.setFillColor(C.deep);
    rect(0, 0, W, H);
    doc.setDrawColor(C.goldDark);
    doc.setLineWidth(0.5);
    doc.rect(9, 9, W - 18, H - 18, 'S');
    let cy = 46;
    if (logoData) {
      try { doc.addImage(logoData, 'JPEG', W / 2 - 16, 26, 32, 32); cy = 82; } catch (e) { cy = 56; }
    }
    setFont('bold', 10.5, C.gold);
    drawText(kicker, W / 2, cy, { align: 'center', charSpace: 1.5 });
    setFont('bold', 25, C.cream);
    drawText(titleLine, W / 2, cy + 17, { align: 'center' });
    setFont('bold', 38, C.gold);
    drawText(bigLine, W / 2, cy + 33, { align: 'center' });
    doc.setFillColor(C.gold);
    rect(W / 2 - 24, cy + 43, 48, 0.9);
    setFont('normal', 11.5, C.cream);
    drawText(subLines, W / 2, cy + 53, { align: 'center' });
    setFont('normal', 9, C.muted);
    drawText(metaLine, W / 2, H - 20, { align: 'center' });
  };
  const kpi = (x, y, w, label, value, sub) => {
    doc.setFillColor(C.soft);
    doc.setDrawColor(C.gold);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, w, 24, 2, 2, 'FD');
    setFont('normal', 8, C.muted);
    drawText(label, x + 3, y + 6);
    setFont('bold', 13, C.deep);
    drawText(value, x + 3, y + 14);
    setFont('normal', 7, C.muted);
    drawText(sub, x + 3, y + 20);
  };
  const sectionTitle = (text, y, x = 14) => {
    setFont('bold', 11, C.deep);
    drawText(text, x, y);
  };
  const note = (text, x, y, w = W - 28, size = 7.5, color = C.muted) => {
    setFont('normal', size, color);
    const lines = doc.splitTextToSize(t(text), w);
    drawText(lines, x, y);
    return y + lines.length * (size * 0.452) + 2;
  };
  // table: rows = array of arrays; cell = string | { text, color, bold, align }
  const table = ({ x = 14, widths, y, headers, rows, rowH = 7, fontSize = 7.5, aligns = [] }) => {
    const totalW = widths.reduce((sum, w) => sum + w, 0);
    const colX = [];
    let acc = x;
    widths.forEach(w => { colX.push(acc); acc += w; });
    doc.setFillColor(C.deep);
    rect(x, y, totalW, rowH);
    setFont('bold', fontSize, C.white);
    headers.forEach((h, i) => {
      const align = normalizeAlign(aligns[i] || 'l');
      const tx = align === 'right' ? colX[i] + widths[i] - 2 : align === 'center' ? colX[i] + widths[i] / 2 : colX[i] + 2;
      drawText(h, tx, y + rowH - 2.2, { align });
    });
    (rows || []).forEach((row, r) => {
      const ry = y + rowH * (r + 1);
      doc.setFillColor(r % 2 ? C.white : C.soft);
      rect(x, ry, totalW, rowH);
      row.forEach((cell, i) => {
        const isObj = cell && typeof cell === 'object';
        const text = isObj ? cell.text : cell;
        const color = (isObj && cell.color) || C.deep;
        const bold = Boolean(isObj && cell.bold);
        const align = normalizeAlign((isObj && cell.align) || aligns[i] || 'l');
        setFont(bold ? 'bold' : 'normal', fontSize, color);
        const tx = align === 'right' ? colX[i] + widths[i] - 2 : align === 'center' ? colX[i] + widths[i] / 2 : colX[i] + 2;
        drawText(text, tx, ry + rowH - 2.2, { align });
      });
    });
    return y + rowH * ((rows || []).length + 1);
  };
  // 12-cột bar chart (trị giá/lượng theo tháng) — vector jsPDF
  const barChart12 = ({ title, chartY, entries, colorFor, valueFormatter, notes = [] }) => {
    setFont('bold', 10, C.deep);
    drawText(title, 14, chartY - 8);
    const chart = { x: 23, y: chartY, w: 255, h: 58 };
    doc.setDrawColor(C.line);
    doc.setLineWidth(0.25);
    doc.line(chart.x, chart.y + chart.h, chart.x + chart.w, chart.y + chart.h);
    const values = entries.map(entry => (entry.valid && Number.isFinite(entry.value) ? entry.value : null));
    const maxValue = Math.max(0, ...values.filter(v => v != null));
    const slot = chart.w / values.length;
    values.forEach((value, index) => {
      const barHeight = maxValue > 0 && value != null ? (value / maxValue) * (chart.h - 7) : 0;
      if (!Number.isFinite(barHeight) || barHeight < 0) throw new Error(`Giá trị biểu đồ không hợp lệ tại cột ${index + 1}`);
      doc.setFillColor(colorFor(index, value));
      rect(chart.x + index * slot + 2, chart.y + chart.h - barHeight, slot - 4, barHeight);
      setFont('normal', 7, C.muted);
      drawText(entries[index].label, chart.x + index * slot + slot / 2, chart.y + chart.h + 5, { align: 'center' });
    });
    setFont('normal', 7, C.muted);
    drawText(maxValue
      ? `${valueFormatter(maxValue)} ${vi ? 'cao nhất' : 'peak'}`
      : (vi ? 'Không có chuỗi tháng' : 'No monthly series'), chart.x, chart.y - 2);
    if (notes.length) drawText(notes.join(' · '), chart.x, chart.y + chart.h + 12);
    return chart;
  };
  // horizontal bars (top markets)
  const hBars = ({ y0, items, valueFormatter, color = C.gold, labelW = 44, barW = 150, rowH = 8.8, fontSize = 8 }) => {
    const max = Math.max(0, ...items.map(item => item.value || 0));
    items.forEach((item, index) => {
      const y = y0 + index * rowH;
      setFont('normal', fontSize, C.deep);
      drawText(item.label, 14, y + 4.4);
      const bw = max > 0 ? Math.max(0.4, Math.min(barW, (item.value / max) * barW)) : 0;
      doc.setFillColor(color);
      rect(14 + labelW, y, bw, 4.8);
      setFont('normal', fontSize - 1, C.muted);
      drawText(valueFormatter(item.value), 14 + labelW + barW + 4, y + 4.4);
    });
    return y0 + items.length * rowH;
  };
  // line chart 3 chuỗi — Chart.js offscreen → PNG (fallback vector nếu không có Chart.js)
  const lineChartPage = ({ chartY, seriesList, labels, height = 96 }) => {
    const chart = { x: 30, y: chartY, w: 240, h: height - 14 };
    let png = '';
    if (typeof captureChart === 'function') {
      try {
        png = captureChart({
          type: 'line',
          data: {
            labels,
            datasets: seriesList.map(series => ({
              label: series.label,
              data: series.values,
              borderColor: series.color,
              backgroundColor: series.color,
              tension: 0.3,
              spanGaps: false,
              pointRadius: 2,
              borderWidth: 2,
            })),
          },
          options: {
            plugins: {
              legend: { position: 'bottom', labels: { font: { size: 13 }, color: '#17231F', boxWidth: 18 } },
              tooltip: { enabled: false },
            },
            scales: {
              y: { ticks: { callback: v => compactUsd(v), font: { size: 11 }, color: '#5B5344' }, grid: { color: 'rgba(90,74,40,0.12)' } },
              x: { ticks: { font: { size: 11 }, color: '#5B5344' }, grid: { display: false } },
            },
          },
        }, 1500, Math.round(1500 * (height + 14) / 240));
      } catch (err) {
        console.warn('[export PDF] line chart canvas failed:', err);
        png = '';
      }
    }
    if (png) {
      doc.addImage(png, 'PNG', chart.x - 16, chart.y - 10, chart.w + 32, height + 2);
    } else {
      vectorLineChart({ chart, seriesList, labels });
    }
    return chart;
  };
  const vectorLineChart = ({ chart, seriesList, labels }) => {
    const all = seriesList.flatMap(series => series.values.filter(v => v != null && Number.isFinite(v)));
    const max = Math.max(0, ...all);
    setFont('normal', 6.5, C.muted);
    doc.setDrawColor(C.line);
    doc.setLineWidth(0.25);
    for (let i = 0; i <= 4; i++) {
      const gy = chart.y + chart.h - (chart.h * i) / 4;
      doc.line(chart.x, gy, chart.x + chart.w, gy);
      drawText(compactUsd((max * i) / 4), chart.x - 2, gy + 1, { align: 'right' });
    }
    const n = Math.max(1, seriesList[0].values.length);
    seriesList.forEach(series => {
      doc.setDrawColor(series.color);
      doc.setLineWidth(0.8);
      let prev = null;
      series.values.forEach((v, i) => {
        if (v == null || !Number.isFinite(v)) { prev = null; return; }
        const px = chart.x + ((i + 0.5) * chart.w) / n;
        const py = chart.y + chart.h - 2 - (max > 0 ? v / max : 0) * (chart.h - 6);
        if (prev) doc.line(prev.x, prev.y, px, py);
        doc.setFillColor(series.color);
        doc.circle(px, py, 0.7, 'F');
        prev = { x: px, y: py };
      });
    });
    setFont('normal', 6.5, C.muted);
    labels.forEach((lb, i) => {
      drawText(lb, chart.x + ((i + 0.5) * chart.w) / n, chart.y + chart.h + 5, { align: 'center' });
    });
    let lx = chart.x + 2;
    seriesList.forEach(series => {
      doc.setFillColor(series.color);
      rect(lx, chart.y + chart.h + 10, 4, 2.4);
      setFont('normal', 7.5, C.deep);
      drawText(series.label, lx + 6, chart.y + chart.h + 12);
      lx += 10 + t(series.label).length * 1.55;
    });
  };
  const tocPage = ({ items }) => {
    const colX = [14, 154];
    const colW = 129;
    const perCol = Math.ceil(items.length / 2);
    items.forEach((item, index) => {
      const col = Math.floor(index / perCol);
      const row = index % perCol;
      const x = colX[col];
      const y = 40 + row * 11.5;
      doc.setFillColor(C.gold);
      rect(x, y - 4.4, 6.4, 6.4);
      setFont('bold', 8.5, C.white);
      drawText(String(item.page), x + 3.2, y, { align: 'center' });
      setFont('normal', 9.5, C.deep);
      drawText(item.title, x + 10, y);
      setFont('normal', 9.5, C.goldDark);
      drawText(String(item.page), x + colW, y, { align: 'right' });
      doc.setDrawColor(C.line);
      doc.setLineWidth(0.2);
      doc.line(x + 10, y + 2.6, x + colW - 8, y + 2.6);
    });
  };
  const scopeNoteLines = (P, tchqAvailable) => (P.vi
    ? (tchqAvailable
      ? 'Tách riêng dữ liệu xuất khẩu, nhập khẩu TCHQ và nhập khẩu RCN Vinacas; không cộng gộp khác biệt phạm vi.'
      : 'Kỳ này không có bản ghi TCHQ; chỉ trình bày dữ liệu Vinacas nếu có, không suy diễn luồng còn thiếu.')
    : (tchqAvailable
      ? 'TCHQ exports, TCHQ imports, and Vinacas RCN imports are kept separate and are not combined.'
      : 'No TCHQ records for this period; only available Vinacas data is shown, with no inference for missing flows.'));

  return {
    doc, W, H, C, font, t, num, fullUsd, fullTon, compactUsd, pct,
    drawText, rect, setFont, header, cover, kpi, sectionTitle, note,
    table, barChart12, hBars, lineChartPage, tocPage, scopeNoteLines,
    _ctx: ctx,
  };
}

// Chuỗi KPI dùng chung (4 thẻ: XK giá trị, XK lượng, NK TCHQ, NK Vinacas)
const EX_PDF_KPI_SERIES = vi => ([
  { key: 'tchqExport', metric: 'val', label: vi ? 'TCHQ · XK trị giá' : 'TCHQ · Export value' },
  { key: 'tchqExport', metric: 'qty', label: vi ? 'TCHQ · XK lượng' : 'TCHQ · Export volume' },
  { key: 'tchqImport', metric: 'val', label: vi ? 'TCHQ · NK trị giá' : 'TCHQ · Import value' },
  { key: 'vinacasImport', metric: 'val', label: vi ? 'Vinacas · NK RCN trị giá' : 'Vinacas · RCN import value' },
]);

function exPdfSeriesList(vi) {
  return [
    { key: 'tchqExport', label: vi ? 'TCHQ · Xuất khẩu' : 'TCHQ · Exports' },
    { key: 'tchqImport', label: vi ? 'TCHQ · Nhập khẩu' : 'TCHQ · Imports' },
    { key: 'vinacasImport', label: vi ? 'VINACAS · Nhập khẩu RCN' : 'VINACAS · RCN imports' },
  ];
}

// ════════════════════════════════════════════════════════════════════════════════
// ANNUAL — 15 trang
// ════════════════════════════════════════════════════════════════════════════════
function exportAnnualPDF(year, version) {
  exCardBusy('ex-pdf', async () => {
    const P = collectAnnualExportPayload(year, version);
    const mapPng = await exAnnualMapPng(P.series.tchqExport.markets);
    const logoData = await exLogoDataUrl();
    const ctx = await exPdfCreateDoc();
    const kit = exPdfKit(ctx, {
      vi: P.vi,
      footerLabel: `${P.year} · ${P.requestedVersionLabel}`,
      pagesTotal: exPdfPagesTotal('annual'),
      sourcesLabel: P.vi ? 'Nguồn: TCHQ và VINACAS · Đơn vị: USD, tấn' : 'Sources: TCHQ and VINACAS · Units: USD, tons',
    });
    drawAnnualPdfPages(ctx, kit, P, mapPng, logoData);
    if (ctx.doc.getNumberOfPages() !== EX_TEMPLATES.annualReport.pdfPages) {
      throw new Error(`Annual PDF page count mismatch: expected ${EX_TEMPLATES.annualReport.pdfPages}, got ${ctx.doc.getNumberOfPages()}`);
    }
    const blob = ctx.doc.output('blob');
    ctx.doc.save(`cashew_trade_${P.year}_annual.pdf`);
    exToastOk('PDF', blob);
  });
}

function drawAnnualPdfPages(ctx, kit, P, mapPng, logoData) {
  const { doc, W, H, C, vi } = ctx;
  const {
    drawText, rect, setFont, header, cover, kpi, sectionTitle, note, table,
    barChart12, hBars, lineChartPage, tocPage, fullUsd, fullTon, compactUsd, pct, num,
  } = kit;
  const seriesList = exPdfSeriesList(vi);
  const kpiDefs = EX_PDF_KPI_SERIES(vi);

  // ── Trang 1 · Cover ──────────────────────────────────────────────────────────
  cover({
    kicker: 'DAN ON FOOD · TRADE EXPLORER',
    titleLine: vi ? 'Báo cáo thương mại hạt điều' : 'Cashew trade report',
    bigLine: String(P.year),
    subLines: [
      vi ? 'TCHQ xuất khẩu · TCHQ nhập khẩu · Vinacas nhập khẩu RCN' : 'TCHQ exports · TCHQ imports · Vinacas RCN imports',
      `${vi ? 'Phiên bản TCHQ' : 'TCHQ version'}: ${P.requestedVersionLabel}`,
    ],
    metaLine: `${vi ? 'Ngày tạo' : 'Generated'}: ${P.generatedAt.toLocaleDateString(vi ? 'vi-VN' : 'en-US')} · ${EX_TEMPLATES.annualReport.pdfPages} ${vi ? 'trang' : 'pages'} · ${vi ? 'Đơn vị' : 'Units'}: USD · ${vi ? 'tấn' : 'tons'}`,
    logoData,
  });

  // ── Trang 2 · Mục lục ────────────────────────────────────────────────────────
  doc.addPage();
  header(vi ? 'Mục lục' : 'Table of contents', 2);
  tocPage({
    items: [
      { page: 1, title: vi ? 'Trang bìa' : 'Cover' },
      { page: 2, title: vi ? 'Mục lục' : 'Table of contents' },
      { page: 3, title: vi ? 'Tổng quan điều hành · KPI năm' : 'Executive summary · Annual KPIs' },
      { page: 4, title: vi ? 'Xuất khẩu TCHQ · Trị giá theo tháng' : 'TCHQ exports · Monthly value' },
      { page: 5, title: vi ? 'Xuất khẩu TCHQ · Lượng theo tháng' : 'TCHQ exports · Monthly volume' },
      { page: 6, title: vi ? 'Xu hướng trị giá · 3 chuỗi dữ liệu' : 'Value trend · three series' },
      { page: 7, title: vi ? 'Thị trường xuất khẩu · Top 10 (bảng)' : 'Export markets · Top 10 (table)' },
      { page: 8, title: vi ? 'Thị trường xuất khẩu · Top 10 (biểu đồ)' : 'Export markets · Top 10 (chart)' },
      { page: 9, title: vi ? 'Bản đồ thị trường xuất khẩu' : 'Export market map' },
      { page: 10, title: vi ? 'Nhập khẩu TCHQ · Chi tiết' : 'TCHQ imports · detail' },
      { page: 11, title: vi ? 'Nhập khẩu Vinacas RCN · Chi tiết' : 'Vinacas RCN imports · detail' },
      { page: 12, title: vi ? `So sánh năm ${P.year} và ${P.previousYear}` : `${P.year} vs ${P.previousYear} comparison` },
      { page: 13, title: vi ? 'Thị trường · Top tăng / Top giảm' : 'Markets · top movers' },
      { page: 14, title: vi ? 'Chất lượng dữ liệu · Fallback & Backfill' : 'Data quality · fallback flags' },
      { page: 15, title: vi ? 'Nguồn dữ liệu & Phương pháp' : 'Sources & methodology' },
    ],
  });

  // ── Trang 3 · Executive Summary — KPI ────────────────────────────────────────
  doc.addPage();
  header(vi ? `Tổng quan điều hành · KPI năm ${P.year}` : `Executive summary · ${P.year} KPIs`, 3);
  setFont('normal', 9, C.muted);
  drawText(kit.scopeNoteLines(P, P.tchqAvailable), 14, 31);
  kpiDefs.forEach((item, index) => {
    const s = P.series[item.key];
    const amount = item.metric === 'qty' ? s.qty : s.val;
    const value = item.metric === 'qty' ? fullTon(amount) : compactUsd(amount);
    const coverage = s.annualRecord
      ? (vi ? 'Bản ghi cộng dồn năm' : 'Annual cumulative record')
      : `${s.monthsWithData}/12 ${vi ? 'tháng có số liệu' : 'months with data'}`;
    const flagged = s.fallbackPeriods.length ? ` · (!) ${s.fallbackPeriods.length}` : '';
    kpi(14 + index * 67.5, 37, 65, item.label, value, coverage + flagged);
  });
  sectionTitle(vi ? 'Diễn biến chính' : 'Key takeaways', 72);
  const annualTakeaways = [];
  const xk = P.series.tchqExport;
  if (xk.val != null) {
    annualTakeaways.push(vi
      ? `Xuất khẩu TCHQ ${P.year}: ${fullUsd(xk.val)} · ${fullTon(xk.qty)} (${xk.monthsWithData}/12 tháng${xk.yoyValuePct != null ? ` · YoY ${pct(xk.yoyValuePct)}` : ''}).`
      : `TCHQ exports ${P.year}: ${fullUsd(xk.val)} · ${fullTon(xk.qty)} (${xk.monthsWithData}/12 months${xk.yoyValuePct != null ? ` · YoY ${pct(xk.yoyValuePct)}` : ''}).`);
  }
  if (P.series.tchqImport.val != null) {
    annualTakeaways.push(vi
      ? `Nhập khẩu TCHQ: ${fullUsd(P.series.tchqImport.val)} — chuỗi riêng, không cộng với Vinacas.`
      : `TCHQ imports: ${fullUsd(P.series.tchqImport.val)} — a separate series, never combined with Vinacas.`);
  }
  if (P.series.vinacasImport.val != null) {
    annualTakeaways.push(vi
      ? `Vinacas NK RCN: ${fullUsd(P.series.vinacasImport.val)}${P.series.vinacasImport.annualRecord ? ' (bản ghi cộng dồn năm)' : ''}.`
      : `Vinacas RCN imports: ${fullUsd(P.series.vinacasImport.val)}${P.series.vinacasImport.annualRecord ? ' (annual cumulative record)' : ''}.`);
  }
  const totalFlags = seriesList.reduce((sum, item) => sum + P.series[item.key].fallbackPeriods.length, 0);
  annualTakeaways.push(totalFlags
    ? (vi ? `${totalFlags} kỳ được gắn cờ fallback/ước tính — xem trang 14.` : `${totalFlags} period(s) flagged fallback/estimated — see page 14.`)
    : (vi ? 'Không có kỳ fallback trong phạm vi phiên bản đã chọn.' : 'No fallback periods within the selected version.'));
  let takeawaysY = 80;
  annualTakeaways.forEach(line => { takeawaysY = note(line, 14, takeawaysY, 269, 9, C.deep) + 2; });

  // ── Trang 4 · Biểu đồ cột — XK giá trị theo tháng ────────────────────────────
  doc.addPage();
  header(vi ? 'Xuất khẩu TCHQ · Trị giá theo tháng' : 'TCHQ exports · Monthly value', 4);
  drawAnnualMonthBarPage(kit, P, 'val', value => compactUsd(value), 4);

  // ── Trang 5 · Biểu đồ cột — XK lượng theo tháng ──────────────────────────────
  doc.addPage();
  header(vi ? 'Xuất khẩu TCHQ · Lượng theo tháng' : 'TCHQ exports · Monthly volume', 5);
  drawAnnualMonthBarPage(kit, P, 'qty', value => fullTon(value), 5);

  // ── Trang 6 · Biểu đồ xu hướng 3 chuỗi ───────────────────────────────────────
  doc.addPage();
  header(vi ? 'Xu hướng trị giá · 3 chuỗi dữ liệu' : 'Value trend · three data series', 6);
  const backfilledMonths = new Set(seriesList
    .flatMap(item => P.series[item.key].monthly.filter(entry => entry.valid && entry.derived).map(entry => entry.period.slice(5))));
  const trendLabels = P.series.tchqExport.monthly.map(entry => `${entry.period.slice(5)}${backfilledMonths.has(entry.period.slice(5)) ? '*' : ''}`);
  setFont('normal', 8, C.muted);
  drawText(vi
    ? `Năm ${P.year} · tháng thiếu để trống, không xem là 0${backfilledMonths.size ? ' · * = có luồng backfill tại tháng này' : ''}`
    : `${P.year} · missing months are blank, not zero${backfilledMonths.size ? ' · * = a series is backfilled this month' : ''}`, 14, 31);
  lineChartPage({
    chartY: 42,
    seriesList: seriesList.map(item => ({
      label: item.label,
      values: P.series[item.key].monthly.map(entry => entry.valid ? entry.val : null),
      color: item.key === 'tchqExport' ? C.gold : item.key === 'tchqImport' ? C.green : C.deep,
    })),
    labels: trendLabels,
  });
  if (backfilledMonths.size) {
    note(vi ? `* Backfill: ${[...backfilledMonths].sort().join(', ')}` : `* Backfilled: ${[...backfilledMonths].sort().join(', ')}`, 14, 168, 269, 7.5);
  }

  // ── Trang 7 · Top 10 thị trường — bảng ───────────────────────────────────────
  doc.addPage();
  header(vi ? 'Thị trường xuất khẩu · Top 10 (bảng)' : 'Export markets · Top 10 (table)', 7);
  const markets = P.series.tchqExport.markets || [];
  const marketSum = markets.reduce((sum, m) => sum + (Number(m.value) || 0), 0);
  if (!markets.length) {
    note(vi
      ? 'Không có phân rã quốc gia khớp tổng TCHQ; không suy diễn thị phần từ tổng fallback.'
      : 'No country breakdown reconciles to the TCHQ total; market shares are not inferred from fallback totals.', 14, 40, 269, 9.5);
  } else {
    sectionTitle(vi ? `Top ${Math.min(10, markets.length)} thị trường · trị giá, lượng và thị phần` : `Top ${Math.min(10, markets.length)} markets · value, volume and share`, 32);
    table({
      y: 40,
      widths: [12, 110, 52, 48, 47],
      aligns: ['c', 'l', 'r', 'r', 'r'],
      headers: ['#', vi ? 'Quốc gia' : 'Country', vi ? 'Trị giá (USD)' : 'Value (USD)', vi ? 'Lượng (tấn)' : 'Volume (t)', vi ? 'Thị phần*' : 'Share*'],
      rows: markets.slice(0, 10).map((m, index) => ([
        String(index + 1),
        m.country,
        fullUsd(m.value),
        m.qty == null ? '—' : num.format(m.qty),
        marketSum > 0 ? `${(m.value / marketSum * 100).toFixed(1)}%` : '—',
      ])),
      rowH: 8.2,
      fontSize: 8,
    });
    note(vi
      ? '* Thị phần tính trên tổng trị giá của phân rã quốc gia đã đối soát (khớp tổng TCHQ cùng kỳ/phiên bản), không phải tổng cả năm.'
      : '* Share is computed on the reconciled country breakdown (matching the same period/version TCHQ total), not the annual total.', 14, 175, 269, 7.5);
  }

  // ── Trang 8 · Top 10 thị trường — biểu đồ ────────────────────────────────────
  doc.addPage();
  header(vi ? 'Thị trường xuất khẩu · Top 10 (biểu đồ)' : 'Export markets · Top 10 (chart)', 8);
  if (!markets.length) {
    note(vi ? 'Không có dữ liệu phân rã để vẽ biểu đồ.' : 'No reconciled breakdown data to chart.', 14, 40, 269, 9.5);
  } else {
    sectionTitle(vi ? 'Trị giá xuất khẩu theo thị trường (USD)' : 'Export value by market (USD)', 32);
    hBars({
      y0: 42,
      items: markets.slice(0, 10).map(m => ({ label: m.country, value: m.value })),
      valueFormatter: compactUsd,
    });
    note(vi
      ? 'Chỉ gồm thị trường có phân rã quốc gia đối soát được với tổng cùng kỳ/phiên bản.'
      : 'Only markets whose country breakdown reconciles to the same period/version total.', 14, 140, 269, 7.5);
  }

  // ── Trang 9 · Bản đồ thị trường ──────────────────────────────────────────────
  doc.addPage();
  header(vi ? 'Bản đồ thị trường xuất khẩu' : 'Export market map', 9);
  if (mapPng) {
    doc.addImage(mapPng, 'PNG', 48.5, 40, 200, 100);
  } else {
    doc.setFillColor(C.soft);
    doc.setDrawColor(C.line);
    doc.roundedRect(48.5, 40, 200, 100, 2, 2, 'FD');
    setFont('normal', 9, C.muted);
    const mapUnavailableText = vi
      ? (markets.length ? 'Bản đồ hiện không khả dụng; bảng Top 10 vẫn dựa trên số liệu đã đối soát.' : 'Không có dữ liệu xuất khẩu TCHQ để lập bản đồ thị trường.')
      : (markets.length ? 'Map unavailable; the Top 10 table remains based on reconciled data.' : 'No TCHQ export data is available to map.');
    doc.text(doc.splitTextToSize(kit.t(mapUnavailableText), 170), W / 2, 92, { align: 'center' });
  }
  setFont('normal', 8, C.muted);
  drawText(vi
    ? 'Vàng đậm: trị giá XK cao hơn · Vàng nhạt: trị giá thấp hơn · Xám: không có phân rã đối soát'
    : 'Darker gold: higher export value · Lighter gold: lower value · Gray: no reconciled breakdown', W / 2, 148, { align: 'center' });

  // ── Trang 10 · Nhập khẩu TCHQ — chi tiết ─────────────────────────────────────
  doc.addPage();
  header(vi ? 'Nhập khẩu TCHQ · Chi tiết' : 'TCHQ imports · detail', 10);
  drawImportDetailPage(kit, P.series.tchqImport, {
    title: vi ? 'TCHQ · Nhập khẩu hạt điều' : 'TCHQ · Cashew imports',
    scopeNote: vi
      ? 'Chuỗi nhập khẩu TCHQ dùng phiên bản đã chọn; không cộng với chuỗi Vinacas (khác phạm vi thống kê).'
      : 'The TCHQ import series uses the selected version; never combined with the Vinacas series (different statistical scope).',
    page: 10,
  });

  // ── Trang 11 · Nhập khẩu Vinacas RCN — chi tiết ─────────────────────────────
  doc.addPage();
  header(vi ? 'Nhập khẩu Vinacas RCN · Chi tiết' : 'Vinacas RCN imports · detail', 11);
  drawImportDetailPage(kit, P.series.vinacasImport, {
    title: vi ? 'VINACAS · Nhập khẩu RCN' : 'VINACAS · RCN imports',
    scopeNote: vi
      ? 'Chuỗi độc lập từ Vinacas (hạt điều thô RCN), không lọc theo phiên bản TCHQ; không cộng với nhập khẩu TCHQ.'
      : 'An independent Vinacas series (raw cashew nuts, RCN), not filtered by the TCHQ version; never combined with TCHQ imports.',
    page: 11,
  });

  // ── Trang 12 · So sánh YoY — 3 chuỗi ─────────────────────────────────────────
  doc.addPage();
  header(vi ? `So sánh năm ${P.year} với ${P.previousYear}` : `${P.year} vs ${P.previousYear} comparison`, 12);
  sectionTitle(vi ? 'Trị giá, lượng và YoY theo chuỗi' : 'Value, volume and YoY per series', 32);
  table({
    y: 40,
    widths: [52, 38, 38, 24, 30, 30, 24, 33],
    aligns: ['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
    headers: [
      vi ? 'Nguồn / luồng' : 'Source / flow',
      vi ? `Trị giá ${P.year}` : `Value ${P.year}`,
      vi ? `Trị giá ${P.previousYear}` : `Value ${P.previousYear}`,
      vi ? 'YoY trị giá' : 'Value YoY',
      vi ? `Lượng ${P.year}` : `Volume ${P.year}`,
      vi ? `Lượng ${P.previousYear}` : `Volume ${P.previousYear}`,
      vi ? 'YoY lượng' : 'Volume YoY',
      vi ? 'Phủ dữ liệu' : 'Coverage',
    ],
    rows: seriesList.map(item => {
      const s = P.series[item.key];
      const prev = s.previousYear || {};
      return [
        item.label,
        fullUsd(s.val),
        fullUsd(prev.val),
        { text: pct(s.yoyValuePct), color: s.yoyValuePct == null ? C.muted : s.yoyValuePct >= 0 ? C.green : C.red, bold: s.yoyValuePct != null },
        s.qty == null ? '—' : num.format(s.qty),
        prev.qty == null ? '—' : num.format(prev.qty),
        { text: pct(s.yoyQtyPct), color: s.yoyQtyPct == null ? C.muted : s.yoyQtyPct >= 0 ? C.green : C.red, bold: s.yoyQtyPct != null },
        s.annualRecord ? (vi ? 'Cộng dồn năm' : 'Annual') : `${s.monthsWithData}/12`,
      ];
    }),
    rowH: 9,
    fontSize: 8,
  });
  note(vi
    ? 'YoY chỉ hiện khi cả hai năm đủ 12 tháng hoặc có bản ghi cộng dồn năm (Vinacas). Giá trị dương: xanh; âm: đỏ.'
    : 'YoY is shown only when both years have 12 months or Vinacas annual cumulative records. Positive: green; negative: red.', 14, 92, 269, 7.5);
  // mini bar so sánh trị giá N-1 vs N cho chuỗi XK
  const yoyChart = { x: 30, y: 112, w: 220, h: 60 };
  const yoyPairs = seriesList.map(item => ({
    label: item.label,
    cur: P.series[item.key].val,
    prev: (P.series[item.key].previousYear || {}).val,
  }));
  const yoyMax = Math.max(0, ...yoyPairs.flatMap(pair => [pair.cur, pair.prev].filter(v => v != null && Number.isFinite(v))));
  const groupW = yoyChart.w / Math.max(1, yoyPairs.length);
  yoyPairs.forEach((pair, index) => {
    const gx = yoyChart.x + index * groupW;
    [['prev', C.muted], ['cur', C.gold]].forEach(([slotKey, color]) => {
      const v = pair[slotKey];
      const bh = yoyMax > 0 && v != null && Number.isFinite(v) ? (v / yoyMax) * (yoyChart.h - 8) : 0;
      doc.setFillColor(color);
      rect(gx + (slotKey === 'prev' ? 6 : groupW / 2 + 2), yoyChart.y + yoyChart.h - bh, groupW / 2 - 10, bh);
    });
    setFont('normal', 7, C.muted);
    drawText(compactUsd(pair.prev), gx + 6, yoyChart.y + yoyChart.h + 5, { align: 'left' });
    drawText(compactUsd(pair.cur), gx + groupW / 2 + 2, yoyChart.y + yoyChart.h + 5, { align: 'left' });
    setFont('normal', 7.5, C.deep);
    drawText(pair.label, gx + groupW / 2, yoyChart.y + yoyChart.h + 12, { align: 'center' });
  });
  setFont('normal', 7, C.muted);
  drawText(vi ? 'Xám: năm trước · Vàng: năm báo cáo' : 'Gray: previous year · Gold: report year', 30, yoyChart.y - 4);

  // ── Trang 13 · Top movers ────────────────────────────────────────────────────
  doc.addPage();
  header(vi ? 'Thị trường · Top tăng / Top giảm theo trị giá YoY' : 'Markets · top movers by value YoY', 13);
  const curMarkets = new Map((P.series.tchqExport.markets || []).map(m => [m.country, m.value]));
  const prevMarkets = new Map(((P.series.tchqExport.previousYear || {}).markets || []).map(m => [m.country, m.value]));
  const movers = [];
  curMarkets.forEach((value, country) => {
    const prevValue = prevMarkets.get(country);
    if (prevValue == null || !Number.isFinite(prevValue) || prevValue === 0) return;
    movers.push({ country, value, prevValue, delta: value - prevValue, pctDelta: (value - prevValue) / Math.abs(prevValue) * 100 });
  });
  const topGain = movers.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5);
  const topLoss = movers.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);
  if (!movers.length) {
    note(vi
      ? 'Không đủ phân rã quốc gia đối soát ở cả hai năm để tính top tăng/giảm theo thị trường.'
      : 'Not enough reconciled country breakdowns in both years to compute market-level movers.', 14, 40, 269, 9.5);
  } else {
    sectionTitle(vi ? 'Top 5 thị trường tăng · Top 5 giảm (trị giá)' : 'Top 5 gainers · Top 5 decliners (value)', 32);
    table({
      y: 40,
      widths: [28, 62, 44, 44, 46, 28],
      aligns: ['c', 'l', 'r', 'r', 'r', 'r'],
      headers: [
        vi ? 'Loại' : 'Type',
        vi ? 'Quốc gia' : 'Country',
        vi ? `Trị giá ${P.previousYear}` : `Value ${P.previousYear}`,
        vi ? `Trị giá ${P.year}` : `Value ${P.year}`,
        vi ? 'Δ trị giá' : 'Δ value',
        'Δ%',
      ],
      rows: [
        ...topGain.map(m => ([
          { text: vi ? 'Tăng' : 'Gain', color: C.green, bold: true },
          m.country,
          fullUsd(m.prevValue),
          fullUsd(m.value),
          { text: fullUsd(m.delta), color: C.green },
          { text: pct(m.pctDelta), color: C.green },
        ])),
        ...topLoss.map(m => ([
          { text: vi ? 'Giảm' : 'Decline', color: C.red, bold: true },
          m.country,
          fullUsd(m.prevValue),
          fullUsd(m.value),
          { text: fullUsd(m.delta), color: C.red },
          { text: pct(m.pctDelta), color: C.red },
        ])),
      ],
      rowH: 7.8,
      fontSize: 8,
    });
    note(vi
      ? 'Chỉ tính thị trường có phân rã đối soát ở cả hai năm và trị giá năm trước > 0; thị trường mới/mất không xếp hạng.'
      : 'Only markets reconciled in both years with a positive previous-year value rank; new/lost markets are excluded.', 14, 140, 269, 7.5);
  }

  // ── Trang 14 · Data quality & fallback flags ─────────────────────────────────
  doc.addPage();
  header(vi ? 'Chất lượng dữ liệu · Fallback & Backfill' : 'Data quality · fallback & backfill flags', 14);
  seriesList.forEach((item, index) => {
    const s = P.series[item.key];
    kpi(14 + index * 67.5, 32, 65, item.label,
      `${s.fallbackPeriods.length}/${Math.max(1, s.monthsWithData)}`,
      vi ? 'kỳ gắn cờ / kỳ có số liệu' : 'flagged / months with data');
  });
  const flagRows = [];
  seriesList.forEach(item => {
    P.series[item.key].fallbackPeriods.forEach(flag => {
      flagRows.push([
        item.label,
        flag.period,
        flag.version || '—',
        flag.derived ? (vi ? 'Ước tính / backfill' : 'Estimated / backfill') : (vi ? 'Khác phiên bản yêu cầu' : 'Different version'),
        { text: flag.note || '—', color: C.muted },
      ]);
    });
  });
  if (!flagRows.length) {
    setFont('normal', 9, C.green);
    drawText(vi
      ? `Không ghi nhận fallback; phiên bản TCHQ yêu cầu: ${P.requestedVersionLabel}.`
      : `No fallback recorded; requested TCHQ version: ${P.requestedVersionLabel}.`, 14, 72);
  } else {
    const maxRows = 14;
    const shown = flagRows.slice(0, maxRows);
    table({
      y: 66,
      widths: [56, 22, 36, 44, 111],
      aligns: ['l', 'c', 'l', 'l', 'l'],
      headers: [vi ? 'Chuỗi' : 'Series', vi ? 'Kỳ' : 'Period', vi ? 'Phiên bản' : 'Version', vi ? 'Loại cờ' : 'Flag', vi ? 'Ghi chú nguồn' : 'Source note'],
      rows: shown,
      rowH: 6.4,
      fontSize: 7,
    });
    if (flagRows.length > maxRows) {
      note(vi ? `… và ${flagRows.length - maxRows} kỳ gắn cờ nữa (không liệt kê hết).` : `… and ${flagRows.length - maxRows} more flagged period(s).`, 14, 66 + 6.4 * (maxRows + 1) + 2, 269, 7);
    }
  }
  note(vi
    ? 'Cờ "Ước tính / backfill": số liệu suy ngược từ YTD hoặc proxy YoY. Cờ "Khác phiên bản": kỳ dùng phiên bản khác phiên bản yêu cầu. Cột trống trên biểu đồ không phải số 0.'
    : '"Estimated / backfill": figures derived from YTD diff or YoY proxy. "Different version": the period uses another version than requested. Blank chart bars are not zero values.', 14, 172, 269, 7.5);

  // ── Trang 15 · Nguồn dữ liệu & phương pháp ───────────────────────────────────
  doc.addPage();
  header(vi ? 'Nguồn dữ liệu & Phương pháp' : 'Sources & methodology', 15);
  let sy = 36;
  sectionTitle(vi ? 'TCHQ · Tổng cục Hải quan Việt Nam' : 'TCHQ · Vietnam General Department of Customs', sy);
  sy = note(vi
    ? `Số liệu xuất khẩu và nhập khẩu hạt điều từ báo cáo định kỳ customs.gov.vn — biểu 015.T (xuất khẩu hàng hóa tháng) và 020.T (theo nước/vùng lãnh thổ, chia theo mặt hàng). Phiên bản trình bày: ${P.requestedVersionLabel}. Số liệu "Sơ bộ" có thể được hải quan điều chỉnh sau.`
    : `Cashew export/import figures from customs.gov.vn periodic statistics — form 015.T (monthly exports) and 020.T (by country/territory by commodity). Version shown: ${P.requestedVersionLabel}. "Preliminary" figures may be revised later.`, 14, sy + 6, 269, 8.5) + 4;
  sectionTitle(vi ? 'VINACAS · Hiệp hội Điều Việt Nam' : 'VINACAS · Vietnam Cashew Association', sy);
  sy = note(vi
    ? 'Chuỗi nhập khẩu hạt điều thô (RCN) độc lập do Vinacas công bố, không lọc theo phiên bản TCHQ và có phạm vi thống kê khác (hạng mục, đối tượng khai báo).'
    : 'An independent raw cashew nut (RCN) import series published by Vinacas, not filtered by the TCHQ version and with a different statistical scope.', 14, sy + 6, 269, 8.5) + 4;
  sectionTitle(vi ? 'Nguyên tắc trình bày' : 'Presentation principles', sy);
  sy = note(vi
    ? '• Ba chuỗi (TCHQ XK, TCHQ NK, Vinacas NK RCN) trình bày riêng biệt, không cộng thành tổng XNK chung.\n• Tháng thiếu dữ liệu để trống — không thay bằng 0; kỳ backfill được gắn dấu * và liệt kê ở trang chất lượng dữ liệu.\n• Thị phần chỉ tính trên phân rã quốc gia đối soát khớp tổng cùng kỳ/phiên bản; không suy diễn từ tổng fallback.'
    : '• Three series (TCHQ exports, TCHQ imports, Vinacas RCN imports) are shown separately and never summed.\n• Missing months stay blank — never zero; backfilled periods are starred and listed on the data-quality page.\n• Market share uses only reconciled country breakdowns matching the same period/version total; never inferred from fallback totals.', 14, sy + 6, 269, 8.5) + 4;
  sectionTitle(vi ? 'Thông tin tệp' : 'File information', sy);
  sy = note(vi
    ? `Năm báo cáo: ${P.year} · So sánh với: ${P.previousYear} · Phiên bản TCHQ yêu cầu: ${P.requestedVersionLabel} · Ngày tạo: ${P.generatedAt.toLocaleString(vi ? 'vi-VN' : 'en-US')} · Kỳ có dữ liệu: TCHQ XK ${P.series.tchqExport.monthsWithData}/12, TCHQ NK ${P.series.tchqImport.monthsWithData}/12, Vinacas ${P.series.vinacasImport.monthsWithData}/12.`
    : `Report year: ${P.year} · Compared with: ${P.previousYear} · Requested TCHQ version: ${P.requestedVersionLabel} · Generated: ${P.generatedAt.toLocaleString('en-US')} · Periods with data: TCHQ exports ${P.series.tchqExport.monthsWithData}/12, TCHQ imports ${P.series.tchqImport.monthsWithData}/12, Vinacas ${P.series.vinacasImport.monthsWithData}/12.`, 14, sy + 6, 269, 8.5);
}

// Trang biểu đồ cột 12 tháng (trị giá hoặc lượng) — dùng cho trang 4 & 5
function drawAnnualMonthBarPage(kit, P, metric, valueFormatter, page) {
  const { doc, C, vi } = ctxOf(kit);
  const series = P.series.tchqExport;
  const backfilled = series.monthly.filter(entry => entry.valid && entry.derived).map(entry => entry.period.slice(5));
  const missing = series.monthly.filter(entry => !entry.valid).map(entry => entry.period.slice(5));
  const notes = [];
  if (backfilled.length) notes.push(`${vi ? '* Backfill' : '* Backfilled'}: ${backfilled.join(', ')}`);
  if (missing.length) notes.push(`${vi ? 'Thiếu' : 'Missing'}: ${missing.join(', ')}`);
  if (backfilled.length || missing.length) notes.push(vi ? 'cột trống không phải số 0' : 'blank bars are not zero values');
  kit.barChart12({
    title: vi
      ? `Trị giá xuất khẩu TCHQ theo tháng${backfilled.length ? ' (* = backfill)' : ''} — ${metric === 'qty' ? 'lượng (tấn)' : 'trị giá (USD)'}`
      : `Monthly TCHQ export ${metric === 'qty' ? 'volume (tons)' : 'value (USD)'}${backfilled.length ? ' (* = backfill)' : ''}`,
    chartY: 42,
    entries: series.monthly.map(entry => ({
      label: String(Number(entry.period.slice(5))) + (entry.derived ? '*' : ''),
      valid: entry.valid,
      value: metric === 'qty' ? entry.qty : entry.val,
    })),
    colorFor: (index, value) => (value == null ? C.line : metric === 'qty' ? C.green : C.gold),
    valueFormatter,
    notes,
  });
  const unitLine = metric === 'qty'
    ? (vi ? 'Đơn vị: tấn' : 'Unit: tons')
    : (vi ? 'Đơn vị: USD' : 'Unit: USD');
  kit.setFont('normal', 8, C.muted);
  kit.drawText(unitLine, 14, 172);
}

// Trang chi tiết nhập khẩu (TCHQ trang 10 / Vinacas trang 11)
function drawImportDetailPage(kit, s, cfg) {
  const { doc, C, vi } = ctxOf(kit);
  kit.sectionTitle(cfg.title, 32);
  kit.kpi(14, 38, 62, vi ? 'Trị giá cả năm' : 'Annual value', kit.compactUsd(s.val),
    `${s.monthsWithData}/12 ${vi ? 'tháng' : 'months'}${s.fallbackPeriods.length ? ` · (!) ${s.fallbackPeriods.length}` : ''}`);
  kit.kpi(79, 38, 62, vi ? 'Lượng cả năm' : 'Annual volume', kit.fullTon(s.qty),
    s.annualRecord ? (vi ? 'Bản ghi cộng dồn năm' : 'Annual cumulative record') : (vi ? 'Cộng các tháng có số liệu' : 'Sum of months with data'));
  kit.kpi(144, 38, 62, vi ? 'Phiên bản' : 'Version',
    s.versionLabels.length ? s.versionLabels.join(', ') : '—',
    vi ? 'phiên bản xuất hiện trong năm' : 'versions present this year');
  kit.kpi(209, 38, 62, 'YoY', kit.pct(s.yoyValuePct),
    vi ? `so với năm trước${s.complete ? '' : ' · yêu cầu đủ 12 tháng'}` : `vs previous year${s.complete ? '' : ' · requires 12 months'}`);
  const noteY = kit.note(cfg.scopeNote, 14, 70, 269, 7.5);
  kit.sectionTitle(vi ? 'Số liệu theo tháng' : 'Monthly figures', noteY + 4);
  kit.table({
    y: noteY + 10,
    widths: [22, 52, 44, 30, 121],
    aligns: ['c', 'r', 'r', 'c', 'l'],
    headers: [vi ? 'Tháng' : 'Month', vi ? 'Trị giá (USD)' : 'Value (USD)', vi ? 'Lượng (tấn)' : 'Volume (t)', vi ? 'Cờ' : 'Flag', vi ? 'Ghi chú' : 'Note'],
    rows: s.monthly.map(entry => ([
      entry.period.slice(5) + (entry.derived ? '*' : ''),
      entry.valid ? kit.num.format(entry.val) : '—',
      entry.valid && entry.qty != null ? kit.num.format(entry.qty) : '—',
      !entry.valid
        ? { text: vi ? 'Thiếu' : 'Missing', color: C.muted }
        : entry.fallback
          ? { text: vi ? 'Fallback' : 'Fallback', color: C.red }
          : { text: 'OK', color: C.green },
      { text: entry.sourceNote || (entry.cumulative ? (vi ? 'Bản ghi cộng dồn năm' : 'Annual cumulative record') : '—'), color: C.muted },
    ])),
    rowH: 7.4,
    fontSize: 7.5,
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// MONTHLY — 10 trang
// ════════════════════════════════════════════════════════════════════════════════
function exportMonthlyPDF(period, version) {
  exCardBusy('ex-pdf', async () => {
    const P = collectMonthlyExportPayload(period, version);
    if (!P.tchqAvailable && !P.vinacasAvailable) {
      throw new Error(`Không có dữ liệu cho kỳ ${period}`);
    }
    let annual = null;
    try { annual = collectAnnualExportPayload(P.year, version); } catch (err) { console.warn('[monthly PDF] YTD context unavailable:', err); }
    const mapPng = await exAnnualMapPng(P.current.tchqExport.markets);
    const logoData = await exLogoDataUrl();
    const ctx = await exPdfCreateDoc();
    const kit = exPdfKit(ctx, {
      vi: P.vi,
      footerLabel: `${P.period} · ${P.requestedVersionLabel}`,
      pagesTotal: exPdfPagesTotal('monthly'),
      sourcesLabel: P.vi ? 'Nguồn: TCHQ và VINACAS · Đơn vị: USD, tấn' : 'Sources: TCHQ and VINACAS · Units: USD, tons',
    });
    drawMonthlyPdfPages(ctx, kit, P, annual, mapPng, logoData);
    if (ctx.doc.getNumberOfPages() !== EX_TEMPLATES.monthlyReport.pdfPages) {
      throw new Error(`Monthly PDF page count mismatch: expected ${EX_TEMPLATES.monthlyReport.pdfPages}, got ${ctx.doc.getNumberOfPages()}`);
    }
    const blob = ctx.doc.output('blob');
    ctx.doc.save(`cashew_trade_${P.period}_monthly.pdf`);
    exToastOk('PDF', blob);
  });
}

function drawMonthlyPdfPages(ctx, kit, P, annual, mapPng, logoData) {
  const { doc, W, H, C, vi } = ctx;
  const {
    drawText, rect, setFont, header, cover, kpi, sectionTitle, note, table,
    barChart12, hBars, fullUsd, fullTon, compactUsd, pct, num,
  } = kit;
  const seriesList = exPdfSeriesList(vi);
  const kpiDefs = EX_PDF_KPI_SERIES(vi);
  const monthLabel = vi
    ? `Tháng ${P.period.slice(5, 7)}/${P.year}`
    : `${P.period.slice(5, 7)}/${P.year}`;

  // ── Trang 1 · Cover ──────────────────────────────────────────────────────────
  cover({
    kicker: 'DAN ON FOOD · TRADE EXPLORER',
    titleLine: vi ? 'Báo cáo thương mại hạt điều' : 'Cashew trade report',
    bigLine: monthLabel,
    subLines: [
      vi ? 'TCHQ xuất khẩu · TCHQ nhập khẩu · Vinacas nhập khẩu RCN' : 'TCHQ exports · TCHQ imports · Vinacas RCN imports',
      `${vi ? 'Phiên bản TCHQ' : 'TCHQ version'}: ${P.requestedVersionLabel}`,
    ],
    metaLine: `${vi ? 'Ngày tạo' : 'Generated'}: ${P.generatedAt.toLocaleDateString(vi ? 'vi-VN' : 'en-US')} · ${EX_TEMPLATES.monthlyReport.pdfPages} ${vi ? 'trang' : 'pages'} · ${vi ? 'Kỳ báo cáo' : 'Period'}: ${P.period}`,
    logoData,
  });

  // ── Trang 2 · Tóm tắt tháng — KPI ────────────────────────────────────────────
  doc.addPage();
  header(vi ? `Tóm tắt tháng ${monthLabel}` : `Monthly summary · ${monthLabel}`, 2);
  setFont('normal', 9, C.muted);
  drawText(kit.scopeNoteLines(P, P.tchqAvailable), 14, 31);
  kpiDefs.forEach((item, index) => {
    const s = P.current[item.key];
    const amount = item.metric === 'qty' ? s.qty : s.val;
    const value = item.metric === 'qty' ? fullTon(amount) : compactUsd(amount);
    const momPct = item.metric === 'qty' ? s.momQtyPct : s.momValPct;
    const yoyPct = item.metric === 'qty' ? s.yoyQtyPct : s.yoyValPct;
    const flags = s.fallback ? ' · (!) fallback' : '';
    const sub = `${vi ? 'MoM' : 'MoM'} ${pct(momPct)} · YoY ${pct(yoyPct)}${flags}`;
    kpi(14 + index * 67.5, 37, 65, item.label, value, sub);
  });
  sectionTitle(vi ? 'Diễn biến chính của tháng' : 'Key takeaways', 72);
  const monthTakeaways = [];
  const cx = P.current.tchqExport;
  if (cx.valid) {
    monthTakeaways.push(vi
      ? `Xuất khẩu TCHQ tháng ${P.period.slice(5, 7)}: ${fullUsd(cx.val)} · ${fullTon(cx.qty)}${cx.momValPct != null ? ` · MoM ${pct(cx.momValPct)}` : ''}${cx.yoyValPct != null ? ` · YoY ${pct(cx.yoyValPct)}` : ''}.`
      : `TCHQ exports in ${P.period.slice(5, 7)}: ${fullUsd(cx.val)} · ${fullTon(cx.qty)}${cx.momValPct != null ? ` · MoM ${pct(cx.momValPct)}` : ''}${cx.yoyValPct != null ? ` · YoY ${pct(cx.yoyValPct)}` : ''}.`);
  } else {
    monthTakeaways.push(vi
      ? `Không có bản ghi xuất khẩu TCHQ hợp lệ cho ${P.period} — không suy diễn số thiếu.`
      : `No valid TCHQ export record for ${P.period} — missing figures are not inferred.`);
  }
  if (P.current.tchqImport.valid) {
    monthTakeaways.push(vi
      ? `Nhập khẩu TCHQ: ${fullUsd(P.current.tchqImport.val)} — chuỗi riêng, không cộng với Vinacas.`
      : `TCHQ imports: ${fullUsd(P.current.tchqImport.val)} — a separate series, never combined with Vinacas.`);
  }
  if (P.current.vinacasImport.valid) {
    monthTakeaways.push(vi
      ? `Vinacas NK RCN: ${fullUsd(P.current.vinacasImport.val)}.`
      : `Vinacas RCN imports: ${fullUsd(P.current.vinacasImport.val)}.`);
  }
  let mtY = 80;
  monthTakeaways.forEach(line => { mtY = note(line, 14, mtY, 269, 9, C.deep) + 2; });

  // ── Trang 3 · YTD context — bar chart ────────────────────────────────────────
  doc.addPage();
  header(vi ? `Bối cảnh YTD · trị giá XK ${P.year}` : `YTD context · ${P.year} export value`, 3);
  const monthlyEntries = annual
    ? annual.series.tchqExport.monthly.map(entry => ({
      label: String(Number(entry.period.slice(5))),
      valid: entry.valid,
      value: entry.val,
    }))
    : [{ label: String(P.monthNum), valid: P.current.tchqExport.valid, value: P.current.tchqExport.val }];
  const ytdBackfilled = annual
    ? annual.series.tchqExport.monthly.filter(entry => entry.valid && entry.derived).map(entry => entry.period.slice(5))
    : (P.current.tchqExport.derived ? [P.period.slice(5, 7)] : []);
  const ytdNotes = [];
  if (ytdBackfilled.length) ytdNotes.push(`${vi ? '* Backfill' : '* Backfilled'}: ${ytdBackfilled.join(', ')}`);
  ytdNotes.push(vi ? 'Xanh lá: tháng đang chọn · Vàng: tháng khác · Xám: thiếu dữ liệu' : 'Green: selected month · Gold: other months · Gray: missing');
  barChart12({
    title: vi
      ? `Trị giá xuất khẩu TCHQ theo tháng năm ${P.year} — tháng ${P.period.slice(5, 7)} được làm nổi bật`
      : `Monthly TCHQ export value ${P.year} — month ${P.period.slice(5, 7)} highlighted`,
    chartY: 42,
    entries: monthlyEntries.map((entry, index) => ({
      ...entry,
      label: entry.label + (ytdBackfilled.includes(String(index + 1).padStart(2, '0')) ? '*' : ''),
    })),
    colorFor: (index, value) => {
      if (value == null) return C.line;
      if (index === P.monthNum - 1) return C.green;
      return C.gold;
    },
    valueFormatter: compactUsd,
    notes: ytdNotes,
  });
  const ytdVal = annual ? annual.series.tchqExport.val : null;
  if (ytdVal != null && P.current.tchqExport.valid) {
    const share = P.current.tchqExport.val / ytdVal * 100;
    setFont('normal', 8.5, C.deep);
    drawText(vi
      ? `Tháng ${P.period.slice(5, 7)} đóng góp ${share.toFixed(1)}% trị giá XK ${P.monthNum < 12 ? 'lũy kế' : ''} năm ${P.year} (${compactUsd(ytdVal)}).`
      : `Month ${P.period.slice(5, 7)} contributes ${share.toFixed(1)}% of ${P.year} export value (${compactUsd(ytdVal)}).`, 14, 172);
  }

  // ── Trang 4 · Top 10 thị trường tháng — bảng ─────────────────────────────────
  doc.addPage();
  header(vi ? `Top 10 thị trường XK · ${monthLabel} (bảng)` : `Top 10 export markets · ${monthLabel} (table)`, 4);
  const monthMarkets = P.current.tchqExport.markets || [];
  const monthMarketSum = monthMarkets.reduce((sum, m) => sum + (Number(m.value) || 0), 0);
  if (!monthMarkets.length) {
    note(vi
      ? 'Không có phân rã quốc gia khớp tổng TCHQ của tháng; không suy diễn thị phần từ tổng fallback.'
      : 'No country breakdown reconciles to the monthly TCHQ total; market shares are not inferred from fallback totals.', 14, 40, 269, 9.5);
  } else {
    sectionTitle(vi ? `Top ${Math.min(10, monthMarkets.length)} thị trường · ${monthLabel}` : `Top ${Math.min(10, monthMarkets.length)} markets · ${monthLabel}`, 32);
    table({
      y: 40,
      widths: [12, 110, 52, 48, 47],
      aligns: ['c', 'l', 'r', 'r', 'r'],
      headers: ['#', vi ? 'Quốc gia' : 'Country', vi ? 'Trị giá (USD)' : 'Value (USD)', vi ? 'Lượng (tấn)' : 'Volume (t)', vi ? 'Thị phần' : 'Share'],
      rows: monthMarkets.slice(0, 10).map((m, index) => ([
        String(index + 1),
        m.country,
        fullUsd(m.value),
        m.qty == null ? '—' : num.format(m.qty),
        monthMarketSum > 0 ? `${(m.value / monthMarketSum * 100).toFixed(1)}%` : '—',
      ])),
      rowH: 8.2,
      fontSize: 8,
    });
    note(vi
      ? 'Thị phần tính trên tổng trị giá phân rã quốc gia đã đối soát của tháng (khớp tổng TCHQ cùng kỳ/phiên bản).'
      : 'Share is computed on the reconciled country breakdown of the month (matching the same period/version TCHQ total).', 14, 175, 269, 7.5);
  }

  // ── Trang 5 · Top 10 thị trường tháng — biểu đồ ──────────────────────────────
  doc.addPage();
  header(vi ? `Top 10 thị trường XK · ${monthLabel} (biểu đồ)` : `Top 10 export markets · ${monthLabel} (chart)`, 5);
  if (!monthMarkets.length) {
    note(vi ? 'Không có dữ liệu phân rã để vẽ biểu đồ.' : 'No reconciled breakdown data to chart.', 14, 40, 269, 9.5);
  } else {
    sectionTitle(vi ? `Trị giá xuất khẩu theo thị trường (USD) · ${monthLabel}` : `Export value by market (USD) · ${monthLabel}`, 32);
    hBars({
      y0: 42,
      items: monthMarkets.slice(0, 10).map(m => ({ label: m.country, value: m.value })),
      valueFormatter: compactUsd,
    });
  }

  // ── Trang 6 · Bản đồ thị trường tháng ────────────────────────────────────────
  doc.addPage();
  header(vi ? `Bản đồ thị trường xuất khẩu · ${monthLabel}` : `Export market map · ${monthLabel}`, 6);
  if (mapPng) {
    doc.addImage(mapPng, 'PNG', 48.5, 40, 200, 100);
  } else {
    doc.setFillColor(C.soft);
    doc.setDrawColor(C.line);
    doc.roundedRect(48.5, 40, 200, 100, 2, 2, 'FD');
    setFont('normal', 9, C.muted);
    const mapUnavailableText = vi
      ? (monthMarkets.length ? 'Bản đồ hiện không khả dụng; bảng Top 10 vẫn dựa trên số liệu đã đối soát.' : 'Không có dữ liệu xuất khẩu TCHQ để lập bản đồ thị trường.')
      : (monthMarkets.length ? 'Map unavailable; the Top 10 table remains based on reconciled data.' : 'No TCHQ export data is available to map.');
    doc.text(doc.splitTextToSize(kit.t(mapUnavailableText), 170), W / 2, 92, { align: 'center' });
  }
  setFont('normal', 8, C.muted);
  drawText(vi
    ? 'Vàng đậm: trị giá XK cao hơn · Vàng nhạt: trị giá thấp hơn · Xám: không có phân rã đối soát'
    : 'Darker gold: higher export value · Lighter gold: lower value · Gray: no reconciled breakdown', W / 2, 148, { align: 'center' });

  // ── Trang 7 · So sánh MoM ────────────────────────────────────────────────────
  doc.addPage();
  header(vi ? `So sánh MoM · ${monthLabel} với ${P.priorPeriod}` : `MoM comparison · ${monthLabel} vs ${P.priorPeriod}`, 7);
  drawDeltaPage(kit, {
    title: vi ? 'Giá trị và lượng theo nguồn — tháng này so với tháng trước' : 'Value and volume per source — current vs previous month',
    rows: seriesList.map(item => {
      const c = P.current[item.key];
      return [
        item.label,
        c.val == null ? '—' : fullUsd(c.val),
        P.mom[item.key].val == null ? '—' : fullUsd(P.mom[item.key].val),
        { text: fullUsd(c.momValDelta), color: deltaColor(c.momValDelta) },
        { text: pct(c.momValPct), color: deltaColor(c.momValPct) },
        c.qty == null ? '—' : num.format(c.qty),
        { text: c.momQtyDelta == null ? '—' : num.format(c.momQtyDelta), color: deltaColor(c.momQtyDelta) },
        { text: pct(c.momQtyPct), color: deltaColor(c.momQtyPct) },
      ];
    }),
    headers: [
      vi ? 'Nguồn / luồng' : 'Source / flow',
      vi ? `Trị giá ${P.period}` : `Value ${P.period}`,
      vi ? `Trị giá ${P.priorPeriod}` : `Value ${P.priorPeriod}`,
      'Δ ' + (vi ? 'trị giá' : 'value'),
      'Δ%',
      vi ? `Lượng ${P.period}` : `Volume ${P.period}`,
      'Δ ' + (vi ? 'lượng' : 'volume'),
      'Δ%',
    ],
    note: vi
      ? 'MoM so sánh với tháng liền trước cùng nguồn/luồng. Δ dương: xanh; âm: đỏ. Kỳ trước thiếu dữ liệu → Δ để trống, không suy diễn.'
      : 'MoM compares with the previous month of the same source/flow. Positive Δ: green; negative: red. Missing prior data → Δ left blank, never inferred.',
  });

  // ── Trang 8 · So sánh YoY tháng ──────────────────────────────────────────────
  doc.addPage();
  header(vi ? `So sánh YoY · ${monthLabel} với ${P.yoyPeriod}` : `YoY comparison · ${monthLabel} vs ${P.yoyPeriod}`, 8);
  drawDeltaPage(kit, {
    title: vi ? 'Giá trị và lượng theo nguồn — tháng này so với cùng kỳ năm trước' : 'Value and volume per source — current vs same month last year',
    rows: seriesList.map(item => {
      const c = P.current[item.key];
      return [
        item.label,
        c.val == null ? '—' : fullUsd(c.val),
        P.yoy[item.key].val == null ? '—' : fullUsd(P.yoy[item.key].val),
        { text: fullUsd(c.yoyValDelta), color: deltaColor(c.yoyValDelta) },
        { text: pct(c.yoyValPct), color: deltaColor(c.yoyValPct) },
        c.qty == null ? '—' : num.format(c.qty),
        { text: c.yoyQtyDelta == null ? '—' : num.format(c.yoyQtyDelta), color: deltaColor(c.yoyQtyDelta) },
        { text: pct(c.yoyQtyPct), color: deltaColor(c.yoyQtyPct) },
      ];
    }),
    headers: [
      vi ? 'Nguồn / luồng' : 'Source / flow',
      vi ? `Trị giá ${P.period}` : `Value ${P.period}`,
      vi ? `Trị giá ${P.yoyPeriod}` : `Value ${P.yoyPeriod}`,
      'Δ ' + (vi ? 'trị giá' : 'value'),
      'Δ%',
      vi ? `Lượng ${P.period}` : `Volume ${P.period}`,
      'Δ ' + (vi ? 'lượng' : 'volume'),
      'Δ%',
    ],
    note: vi
      ? 'YoY so sánh với cùng tháng năm trước. Vinacas 2018–2022 chỉ có bản ghi cộng dồn năm nên không dùng cho so sánh tháng.'
      : 'YoY compares with the same month of the previous year. Vinacas 2018–2022 only has annual cumulative records, excluded from monthly comparisons.',
  });

  // ── Trang 9 · Nhập khẩu tháng ────────────────────────────────────────────────
  doc.addPage();
  header(vi ? `Nhập khẩu tháng ${monthLabel}` : `Monthly imports · ${monthLabel}`, 9);
  const importBoxes = [
    { s: P.current.tchqImport, title: vi ? 'TCHQ · Nhập khẩu hạt điều' : 'TCHQ · Cashew imports', x: 20 },
    { s: P.current.vinacasImport, title: vi ? 'VINACAS · Nhập khẩu RCN' : 'VINACAS · RCN imports', x: 152 },
  ];
  importBoxes.forEach(({ s, title, x }) => {
    doc.setFillColor(C.soft);
    doc.setDrawColor(C.gold);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, 38, 125, 78, 2.5, 2.5, 'FD');
    setFont('bold', 12, C.deep);
    drawText(title, x + 8, 52);
    setFont('bold', 20, C.goldDark);
    drawText(compactUsd(s.val), x + 8, 68);
    setFont('normal', 10, C.deep);
    drawText(s.qty == null ? '—' : `${num.format(s.qty)} ${vi ? 'tấn' : 't'}`, x + 8, 78);
    setFont('normal', 8, C.muted);
    drawText(`MoM ${pct(s.momValPct)} · YoY ${pct(s.yoyValPct)}`, x + 8, 88);
    drawText(s.fallback
      ? (vi ? '(!) Kỳ dùng bản ước tính/phiên bản khác yêu cầu' : '(!) Estimated version or different from requested')
      : (vi ? 'Phiên bản khớp yêu cầu' : 'Matches requested version'), x + 8, 98);
  });
  note(vi
    ? 'Hai chuỗi nhập khẩu có nguồn và phạm vi thống kê khác nhau (TCHQ: hạt điều các loại theo biểu hải quan; Vinacas: hạt điều thô RCN) — KHÔNG cộng thành tổng nhập khẩu.'
    : 'The two import series have different sources and statistical scopes (TCHQ: cashew categories per customs forms; Vinacas: raw cashew nuts, RCN) — never summed into one import total.', 20, 128, 257, 8.5);

  // ── Trang 10 · Nguồn & data quality ──────────────────────────────────────────
  doc.addPage();
  header(vi ? 'Nguồn dữ liệu & Chất lượng' : 'Sources & data quality', 10);
  setFont('normal', 9, C.deep);
  drawText(vi
    ? `Kỳ báo cáo: ${P.period} · Phiên bản TCHQ yêu cầu: ${P.requestedVersionLabel} · So sánh: MoM với ${P.priorPeriod}, YoY với ${P.yoyPeriod}.`
    : `Report period: ${P.period} · Requested TCHQ version: ${P.requestedVersionLabel} · Comparisons: MoM vs ${P.priorPeriod}, YoY vs ${P.yoyPeriod}.`, 14, 32);
  const statusRows = seriesList.map(item => {
    const c = P.current[item.key];
    const status = !c.valid
      ? { text: vi ? 'Thiếu dữ liệu' : 'Missing data', color: C.muted }
      : c.fallback
        ? { text: vi ? 'Fallback / ước tính' : 'Fallback / estimated', color: C.red }
        : { text: 'OK', color: C.green };
    return [
      item.label,
      status,
      c.valid ? (c.versionLabel || '—') : '—',
      { text: c.sourceNote || '—', color: C.muted },
    ];
  });
  table({
    y: 42,
    widths: [56, 44, 42, 127],
    aligns: ['l', 'c', 'l', 'l'],
    headers: [vi ? 'Chuỗi' : 'Series', vi ? 'Trạng thái' : 'Status', vi ? 'Phiên bản' : 'Version', vi ? 'Ghi chú nguồn' : 'Source note'],
    rows: statusRows,
    rowH: 7.6,
    fontSize: 7.5,
  });
  let fqY = 42 + 7.6 * 4 + 8;
  sectionTitle(vi ? 'Phương pháp & nguồn' : 'Methodology & sources', fqY);
  fqY = note(vi
    ? `Nguồn: Tổng cục Hải quan Việt Nam (TCHQ — biểu 015.T/020.T, phiên bản ${P.requestedVersionLabel}) và Hiệp hội Điều Việt Nam (VINACAS — nhập khẩu RCN, chuỗi độc lập). Số liệu ước tính/backfill được gắn cờ; các chuỗi khác phạm vi không cộng gộp; tháng thiếu để trống, không phải 0.`
    : `Sources: Vietnam General Department of Customs (TCHQ — forms 015.T/020.T, version ${P.requestedVersionLabel}) and the Vietnam Cashew Association (VINACAS — RCN imports, an independent series). Estimated/backfilled figures are flagged; series with different scopes are never combined; missing months stay blank, never zero.`, 14, fqY + 6, 269, 8.5);
  note(vi
    ? 'Báo cáo tháng phản ánh đúng kỳ đang chọn trên dashboard; MoM/YoY dùng cùng nguồn và luồng, không trộn phiên bản trong cùng một phép so sánh.'
    : 'The monthly report mirrors the active dashboard period; MoM/YoY use the same source and flow without mixing versions in one comparison.', 14, fqY + 2, 269, 7.5);
}

// Trang bảng delta dùng chung (MoM trang 7 / YoY trang 8)
function drawDeltaPage(kit, cfg) {
  kit.sectionTitle(cfg.title, 32);
  kit.table({
    y: 40,
    widths: [52, 36, 36, 33, 21, 34, 31, 21],
    aligns: ['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
    headers: cfg.headers,
    rows: cfg.rows,
    rowH: 9,
    fontSize: 7.5,
  });
  kit.note(cfg.note, 14, 40 + 9 * (cfg.rows.length + 1) + 6, 269, 7.5);
}

function deltaColor(v) {
  if (v == null || !Number.isFinite(v)) return EX_PDF_COLORS.muted;
  return v >= 0 ? EX_PDF_COLORS.green : EX_PDF_COLORS.red;
}

// ctxOf: kit giữ tham chiếu ctx (doc/W/H/C/vi) để các hàm vẽ dùng chung
function ctxOf(kit) {
  return kit._ctx;
}
