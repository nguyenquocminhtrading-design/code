function exportPPTX() {
  requestAnnualExport('pptx');
}

function exportAnnualPPTX(year, version) {
  exCardBusy('ex-pptx', async () => {
    const P = collectAnnualExportPayload(year, version);
    const mapPng = await exAnnualMapPng(P.series.tchqExport.markets);
    if (typeof PptxGenJS === 'undefined') throw new Error('PptxGenJS chưa được tải');
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'DAN ON FOOD · Trade Explorer';
    pptx.subject = `Annual cashew trade report ${P.year}`;
    pptx.title = `Vietnam Cashew Trade · ${P.year}`;
    const C = {
      deep: '17231F', gold: 'C9A227', goldDark: '8A6D1C',
      cream: 'F5EBD0', soft: 'F7EFD8', muted: '8A7B5E',
      green: '3E7C4F', red: 'C0392B', line: 'E3E8E4', white: 'FFFFFF',
    };
    const num = new Intl.NumberFormat(P.vi ? 'vi-VN' : 'en-US', { maximumFractionDigits: 0 });
    const compactUsd = value => {
      if (value == null || !Number.isFinite(value)) return '—';
      const abs = Math.abs(value);
      const scale = abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : abs >= 1e3 ? 1e3 : 1;
      const suffix = abs >= 1e9 ? 'B' : abs >= 1e6 ? 'M' : abs >= 1e3 ? 'K' : '';
      return `${value < 0 ? '-' : ''}$${(abs / scale).toFixed(scale === 1 ? 0 : 1)}${suffix}`;
    };
    const pct = value => value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
    const seriesRows = [
      { key: 'tchqExport', label: P.vi ? 'TCHQ · Xuất khẩu' : 'TCHQ · Exports' },
      { key: 'tchqImport', label: P.vi ? 'TCHQ · Nhập khẩu' : 'TCHQ · Imports' },
      { key: 'vinacasImport', label: P.vi ? 'VINACAS · Nhập khẩu RCN' : 'VINACAS · RCN imports' },
    ];
    const addTitle = (slide, title, subtitle = '') => {
      slide.background = { color: C.white };
      slide.addText(title, { x: 0.55, y: 0.34, w: 12.15, h: 0.5, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: C.deep, margin: 0 });
      if (subtitle) slide.addText(subtitle, { x: 0.58, y: 0.88, w: 12.1, h: 0.38, fontFace: 'Aptos', fontSize: 10, color: C.muted, margin: 0 });
    };
    const addFooter = (slide, slideNumber) => {
      slide.addShape(pptx.ShapeType.line, { x: 0.55, y: 7.08, w: 12.2, h: 0, line: { color: C.line, width: 0.6 } });
      slide.addText(`DAN ON FOOD · ${P.year} · ${P.requestedVersionLabel} · ${slideNumber}/${EX_TEMPLATES.annualReport.pptxSlides}`, {
        x: 0.58, y: 7.12, w: 12.1, h: 0.2, fontFace: 'Aptos', fontSize: 8, color: C.muted, margin: 0,
      });
    };
    const addKpi = (slide, x, y, title, value, note) => {
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y, w: 2.95, h: 1.15, rectRadius: 0.08,
        fill: { color: C.soft }, line: { color: C.gold, width: 1 },
      });
      slide.addText(title, { x: x + 0.16, y: y + 0.12, w: 2.64, h: 0.22, fontFace: 'Aptos', fontSize: 10, color: C.muted, margin: 0 });
      slide.addText(value, { x: x + 0.16, y: y + 0.39, w: 2.64, h: 0.34, fontFace: 'Aptos Display', fontSize: 20, bold: true, color: C.deep, margin: 0, fit: 'shrink' });
      slide.addText(note, { x: x + 0.16, y: y + 0.82, w: 2.64, h: 0.18, fontFace: 'Aptos', fontSize: 8, color: C.muted, margin: 0, fit: 'shrink' });
    };

    // 1 — Annual executive summary
    {
      const slide = pptx.addSlide();
      slide.background = { color: C.deep };
      slide.addText('DAN ON FOOD · TRADE EXPLORER', { x: 0.75, y: 0.7, w: 11.8, h: 0.3, fontFace: 'Aptos', fontSize: 11, bold: true, charSpacing: 2, color: C.gold, margin: 0 });
      slide.addText(P.vi ? `Báo cáo thương mại hạt điều\n${P.year}` : `Cashew trade report\n${P.year}`, {
        x: 0.75, y: 1.5, w: 11.8, h: 1.4, fontFace: 'Aptos Display', fontSize: 34, bold: true, color: C.cream, breakLine: false, margin: 0,
      });
      slide.addShape(pptx.ShapeType.rect, { x: 0.76, y: 3.2, w: 2.4, h: 0.07, fill: { color: C.gold }, line: { color: C.gold } });
      slide.addText(P.vi
        ? `TCHQ xuất khẩu · TCHQ nhập khẩu · Vinacas nhập khẩu RCN\nPhiên bản TCHQ: ${P.requestedVersionLabel}`
        : `TCHQ exports · TCHQ imports · Vinacas RCN imports\nTCHQ version: ${P.requestedVersionLabel}`, {
        x: 0.78, y: 3.55, w: 11.7, h: 0.8, fontFace: 'Aptos', fontSize: 16, color: C.cream, breakLine: false, margin: 0,
      });
      slide.addText(`${P.vi ? 'Ngày tạo' : 'Generated'}: ${P.generatedAt.toLocaleDateString(P.vi ? 'vi-VN' : 'en-US')}`, {
        x: 0.78, y: 6.55, w: 11.5, h: 0.3, fontFace: 'Aptos', fontSize: 10, color: C.cream, margin: 0,
      });
    }

    // 2 — Contents
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? 'Mục lục' : 'Table of contents',
        P.vi ? `Báo cáo thương mại hạt điều · ${P.year}` : `Cashew trade report · ${P.year}`);
      const contents = [
        'Cover', 'Contents', 'Executive KPIs', 'Monthly export value',
        'Monthly export volume', 'Three-series monthly trend', 'Top 10 markets · table',
        'Top 10 markets · chart', 'Export market map', 'TCHQ imports · detail',
        'Vinacas RCN imports · detail', 'Year-over-year comparison',
        'Top market movers', 'Data quality & fallback flags', 'Sources & methodology',
      ];
      const viContents = [
        'Trang bìa', 'Mục lục', 'Tổng quan điều hành · KPI', 'Trị giá xuất khẩu theo tháng',
        'Lượng xuất khẩu theo tháng', 'Xu hướng 3 chuỗi theo tháng', 'Top 10 thị trường · bảng',
        'Top 10 thị trường · biểu đồ', 'Bản đồ thị trường xuất khẩu', 'Nhập khẩu TCHQ · chi tiết',
        'Nhập khẩu Vinacas RCN · chi tiết', 'So sánh YoY', 'Top thị trường tăng/giảm',
        'Chất lượng dữ liệu & fallback', 'Nguồn dữ liệu & phương pháp',
      ];
      const rows = Array.from({ length: 15 }, (_, index) => [
        String(index + 1),
        P.vi ? viContents[index] : contents[index],
        String(index + 1),
      ]);
      slide.addTable([
        [
          { text: '#', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Nội dung' : 'Section', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Trang' : 'Page', options: { bold: true, color: C.white, fill: C.deep } },
        ],
        ...rows,
      ], {
        x: 1.0, y: 1.42, w: 11.3, h: 5.3,
        border: { type: 'solid', color: C.line, pt: 0.6 },
        fill: C.white, color: C.deep, fontFace: 'Aptos', fontSize: 10,
        rowH: 0.32, margin: 0.06, valign: 'mid',
        colW: [0.8, 9.5, 1.0],
      });
      addFooter(slide, 2);
    }

    // 3 — Annual KPIs and coverage
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? `Tổng quan năm ${P.year}` : `${P.year} executive summary`,
        P.vi
          ? (P.tchqAvailable ? 'Ba chuỗi được trình bày riêng; số liệu thiếu hoặc fallback không bị ẩn.' : 'Không có bản ghi TCHQ trong năm này; không suy diễn các luồng còn thiếu.')
          : (P.tchqAvailable ? 'Three separate series; missing or fallback data is not concealed.' : 'No TCHQ records for this year; missing flows are not inferred.'));
      const metrics = [
        { s: P.series.tchqExport, label: P.vi ? 'TCHQ · XK trị giá' : 'TCHQ · Export value', metric: 'val' },
        { s: P.series.tchqExport, label: P.vi ? 'TCHQ · XK lượng' : 'TCHQ · Export volume', metric: 'qty' },
        { s: P.series.tchqImport, label: P.vi ? 'TCHQ · NK trị giá' : 'TCHQ · Import value', metric: 'val' },
        { s: P.series.vinacasImport, label: P.vi ? 'Vinacas · NK RCN trị giá' : 'Vinacas · RCN import value', metric: 'val' },
      ];
      metrics.forEach((item, index) => {
        const x = 0.58 + (index % 2) * 3.22;
        const y = 1.55 + Math.floor(index / 2) * 1.42;
        const value = item.metric === 'qty'
          ? (item.s.qty == null ? '—' : `${num.format(item.s.qty)} ${P.vi ? 'tấn' : 'tons'}`)
          : compactUsd(item.s.val);
        const coverage = item.s.annualRecord
          ? (P.vi ? 'Bản ghi cộng dồn năm' : 'Annual cumulative record')
          : `${item.s.monthsWithData}/12 ${P.vi ? 'tháng' : 'months'}`;
        addKpi(slide, x, y, item.label, value, `${coverage}${item.s.fallbackPeriods.length ? ` · ⚠ ${item.s.fallbackPeriods.length}` : ''}`);
      });
      slide.addText(P.vi
        ? 'Lưu ý: nhập khẩu TCHQ và nhập khẩu RCN Vinacas có phạm vi thống kê khác nhau, không cộng gộp.'
        : 'Note: TCHQ imports and Vinacas RCN imports have different statistical scopes and are not combined.', {
        x: 7.2, y: 1.65, w: 5.3, h: 1.2, fontFace: 'Aptos', fontSize: 13, bold: true, color: C.goldDark, breakLine: false, margin: 0.05,
      });
      addFooter(slide, 3);
    }

    const exportMonthly = P.series.tchqExport.monthly;
    const backfilledMonths = new Set(P.series.tchqExport.monthly
      .filter(entry => entry.valid && entry.derived).map(entry => entry.period.slice(5)));
    const monthLabels = exportMonthly.map(entry => `${entry.period.slice(5)}${backfilledMonths.has(entry.period.slice(5)) ? '*' : ''}`);
    const addExportBarSlide = (metric, slideNumber) => {
      const quantity = metric === 'qty';
      const slide = pptx.addSlide();
      addTitle(slide,
        P.vi
          ? `Xuất khẩu TCHQ · ${quantity ? 'Lượng' : 'Trị giá'} theo tháng`
          : `TCHQ exports · Monthly ${quantity ? 'volume' : 'value'}`,
        P.vi ? `Năm ${P.year} · tháng thiếu để trống, không xem là 0.` : `${P.year} · missing months are blank, not zero.`);
      slide.addChart(pptx.ChartType.bar, [{
        name: P.vi ? (quantity ? 'Lượng (tấn)' : 'Trị giá (USD)') : (quantity ? 'Volume (tons)' : 'Value (USD)'),
        labels: monthLabels,
        values: exportMonthly.map(entry => entry.valid ? (quantity ? entry.qty : entry.val) : null),
      }], {
        x: 0.72, y: 1.45, w: 11.9, h: 4.9,
        catAxisLabelFontSize: 10, valAxisLabelFontSize: 9,
        chartColors: [C.gold], showLegend: false, showValue: true,
        dataLabelPosition: 'outEnd', dataLabelFormatCode: quantity ? '#,##0' : '#,##0,, "M"',
        valAxisLabelFormatCode: quantity ? '#,##0' : '#,##0,, "M"',
        showTitle: false, showBorder: false,
      });
      if (backfilledMonths.size) {
        slide.addText(`${P.vi ? '* Backfill tại tháng: ' : '* Backfilled months: '}${[...backfilledMonths].join(', ')}`, {
          x: 0.75, y: 6.4, w: 11.8, h: 0.3, fontFace: 'Aptos', fontSize: 9, color: C.muted, margin: 0,
        });
      }
      addFooter(slide, slideNumber);
    };

    // 4 — Monthly export value
    addExportBarSlide('val', 4);

    // 5 — Monthly export volume
    addExportBarSlide('qty', 5);

    // 6 — Three-series trend
    {
      const slide = pptx.addSlide();
      const chartSeriesInfo = [
        { key: 'tchqExport', name: P.vi ? 'TCHQ XK' : 'TCHQ exports' },
        { key: 'tchqImport', name: P.vi ? 'TCHQ NK' : 'TCHQ imports' },
        { key: 'vinacasImport', name: P.vi ? 'Vinacas RCN NK' : 'Vinacas RCN imports' },
      ];
      const derivedBySeries = chartSeriesInfo.map(item => ({
        name: item.name,
        periods: P.series[item.key].monthly.filter(entry => entry.valid && entry.derived).map(entry => entry.period),
      })).filter(item => item.periods.length);
      addTitle(slide, P.vi ? 'Xu hướng trị giá · 3 chuỗi theo tháng' : 'Monthly value trend · three series',
        `${P.vi ? `Năm ${P.year} · tháng thiếu để trống, không xem là 0.` : `${P.year} · missing months are blank, not zero.`}${derivedBySeries.length ? (P.vi ? ' · * = backfill' : ' · * = backfilled') : ''}`);
      slide.addChart(pptx.ChartType.line, chartSeriesInfo.map(item => ({
        name: item.name,
        labels: monthLabels,
        values: P.series[item.key].monthly.map(entry => entry.valid ? entry.val : null),
      })), {
        x: 0.65, y: 1.5, w: 11.9, h: 4.8,
        showTitle: false, showLegend: true, legendPos: 'b', legendFontSize: 11,
        chartColors: [C.gold, C.green, C.deep],
        showValue: false, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9,
        valAxisLabelFormatCode: '#,##0,, "M"',
        showMarker: true, markerSize: 4, lineSize: 2, showBorder: false,
      });
      if (derivedBySeries.length) {
        slide.addText(`${P.vi ? '* Backfill theo chuỗi: ' : '* Backfilled series: '}${derivedBySeries.map(item => `${item.name} ${item.periods.map(period => period.slice(5)).join(', ')}`).join(' · ')}`, {
          x: 0.72, y: 6.37, w: 11.9, h: 0.45, fontFace: 'Aptos', fontSize: 8, color: C.muted, margin: 0.02, fit: 'shrink',
        });
      }
      addFooter(slide, 6);
    }

    const markets = P.series.tchqExport.markets || [];
    const topMarkets = markets.slice(0, 10);
    const marketSum = markets.reduce((sum, market) => sum + (Number(market.value) || 0), 0);

    // 7 — Top 10 export markets table
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? 'Thị trường xuất khẩu · Top 10 (bảng)' : 'Export markets · Top 10 (table)',
        P.vi ? 'Chỉ gồm phân rã quốc gia đối soát được với tổng TCHQ cùng kỳ/phiên bản.' : 'Only country breakdowns reconciling to the same TCHQ period/version are included.');
      if (topMarkets.length) {
        slide.addTable([
          [
            { text: '#', options: { bold: true, color: C.white, fill: C.deep } },
            { text: P.vi ? 'Quốc gia' : 'Country', options: { bold: true, color: C.white, fill: C.deep } },
            { text: P.vi ? 'Trị giá (USD)' : 'Value (USD)', options: { bold: true, color: C.white, fill: C.deep } },
            { text: P.vi ? 'Lượng (tấn)' : 'Volume (tons)', options: { bold: true, color: C.white, fill: C.deep } },
            { text: P.vi ? 'Thị phần' : 'Share', options: { bold: true, color: C.white, fill: C.deep } },
          ],
          ...topMarkets.map((market, index) => [
            String(index + 1), market.country,
            market.value == null ? '—' : `${num.format(market.value)} USD`,
            market.qty == null ? '—' : `${num.format(market.qty)} ${P.vi ? 'tấn' : 'tons'}`,
            marketSum > 0 ? `${(market.value / marketSum * 100).toFixed(1)}%` : '—',
          ]),
        ], {
          x: 0.65, y: 1.55, w: 12.0, h: 4.6,
          border: { type: 'solid', color: C.line, pt: 0.7 },
          fill: C.white, color: C.deep, fontFace: 'Aptos', fontSize: 10,
          rowH: 0.42, margin: 0.08, valign: 'mid',
          colW: [0.7, 4.2, 2.7, 2.6, 1.8],
        });
      } else {
        slide.addText(P.vi ? 'Không có phân rã quốc gia đối soát được; không suy diễn thị phần.' : 'No reconciled country breakdown is available; market share is not inferred.', {
          x: 0.9, y: 2.5, w: 11.5, h: 0.8, fontFace: 'Aptos', fontSize: 15, color: C.muted, align: 'center', margin: 0.1,
        });
      }
      addFooter(slide, 7);
    }

    // 8 — Top 10 export markets chart
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? 'Thị trường xuất khẩu · Top 10 (biểu đồ)' : 'Export markets · Top 10 (chart)');
      if (topMarkets.length) {
        slide.addChart(pptx.ChartType.bar, [{
          name: P.vi ? 'Trị giá USD' : 'Value USD',
          labels: topMarkets.map(market => market.country),
          values: topMarkets.map(market => market.value),
        }], {
          x: 0.72, y: 1.45, w: 11.9, h: 4.9,
          barDir: 'bar', catAxisLabelFontSize: 10, valAxisLabelFontSize: 9,
          chartColors: [C.gold], showLegend: false, showValue: true,
          dataLabelPosition: 'outEnd', dataLabelFormatCode: '#,##0,, "M"',
          valAxisLabelFormatCode: '#,##0,, "M"', showTitle: false, showBorder: false,
        });
      } else {
        slide.addText(P.vi ? 'Không có dữ liệu phân rã để vẽ biểu đồ.' : 'No reconciled breakdown data to chart.', {
          x: 0.9, y: 2.5, w: 11.5, h: 0.8, fontFace: 'Aptos', fontSize: 15, color: C.muted, align: 'center', margin: 0.1,
        });
      }
      addFooter(slide, 8);
    }

    // 9 — Export market map
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? 'Bản đồ thị trường xuất khẩu' : 'Export market map',
        P.vi ? 'Phân bố theo trị giá xuất khẩu đã đối soát.' : 'Distribution by reconciled export value.');
      if (mapPng) {
        slide.addImage({ data: mapPng, x: 2.15, y: 1.45, w: 9.0, h: 4.5 });
      } else {
        slide.addText(P.vi
          ? (topMarkets.length ? 'Bản đồ không khả dụng; bảng và biểu đồ vẫn dùng số liệu đã đối soát.' : 'Không có dữ liệu xuất khẩu TCHQ để lập bản đồ.')
          : (topMarkets.length ? 'Map unavailable; the table and chart retain reconciled data.' : 'No TCHQ export data is available to map.'), {
          x: 1.0, y: 2.5, w: 11.4, h: 0.8, fontFace: 'Aptos', fontSize: 15, color: C.muted, align: 'center', margin: 0.1,
        });
      }
      slide.addText(P.vi
        ? 'Vàng đậm: trị giá xuất khẩu cao hơn · Xám: không có phân rã đối soát'
        : 'Darker gold: higher export value · Gray: no reconciled breakdown', {
        x: 0.8, y: 6.1, w: 11.8, h: 0.3, fontFace: 'Aptos', fontSize: 9, color: C.muted, align: 'center', margin: 0,
      });
      addFooter(slide, 9);
    }

    const addImportDetail = (seriesKey, slideNumber) => {
      const s = P.series[seriesKey];
      const isVinacas = seriesKey === 'vinacasImport';
      const title = isVinacas
        ? (P.vi ? 'Nhập khẩu Vinacas RCN · Chi tiết' : 'Vinacas RCN imports · detail')
        : (P.vi ? 'Nhập khẩu TCHQ · Chi tiết' : 'TCHQ imports · detail');
      const slide = pptx.addSlide();
      addTitle(slide, title, isVinacas
        ? (P.vi ? 'Chuỗi nhập khẩu hạt điều thô RCN độc lập; không lọc phiên bản TCHQ.' : 'Independent raw cashew nut (RCN) series; not filtered by TCHQ version.')
        : (P.vi ? `Phiên bản yêu cầu: ${P.requestedVersionLabel}. Không cộng với Vinacas RCN.` : `Requested version: ${P.requestedVersionLabel}. Not combined with Vinacas RCN.`));
      addKpi(slide, 0.75, 1.45, isVinacas ? (P.vi ? 'VINACAS · Trị giá' : 'VINACAS · Value') : (P.vi ? 'TCHQ · Trị giá' : 'TCHQ · Value'), compactUsd(s.val), `${s.annualRecord ? (P.vi ? 'Bản ghi cộng dồn năm' : 'Annual cumulative record') : `${s.monthsWithData}/12 ${P.vi ? 'tháng có số liệu' : 'months with data'}`}`);
      addKpi(slide, 3.95, 1.45, P.vi ? 'Lượng' : 'Volume', s.qty == null ? '—' : `${num.format(s.qty)} ${P.vi ? 'tấn' : 'tons'}`, `${P.vi ? 'Phiên bản yêu cầu' : 'Requested version'}: ${P.requestedVersionLabel}`);
      const rows = s.monthly.map(entry => [
        entry.period.slice(5),
        entry.valid ? compactUsd(entry.val) : '—',
        entry.valid && entry.qty != null ? `${num.format(entry.qty)} ${P.vi ? 'tấn' : 'tons'}` : '—',
        entry.valid ? (entry.fallback ? (P.vi ? 'Fallback / ước tính' : 'Fallback / estimated') : (P.vi ? 'Khớp' : 'Matched')) : (P.vi ? 'Thiếu dữ liệu' : 'Missing'),
      ]);
      slide.addTable([
        [
          { text: P.vi ? 'Tháng' : 'Month', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Trị giá' : 'Value', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Lượng' : 'Volume', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Trạng thái' : 'Status', options: { bold: true, color: C.white, fill: C.deep } },
        ],
        ...rows,
      ], {
        x: 0.65, y: 2.82, w: 12.0, h: 3.85,
        border: { type: 'solid', color: C.line, pt: 0.65 },
        fill: C.white, color: C.deep, fontFace: 'Aptos', fontSize: 9,
        rowH: 0.28, margin: 0.06, valign: 'mid',
        colW: [1.2, 3.7, 3.4, 3.7],
      });
      addFooter(slide, slideNumber);
    };

    // 10 — TCHQ imports detail
    addImportDetail('tchqImport', 10);

    // 11 — Vinacas imports detail
    addImportDetail('vinacasImport', 11);

    // 12 — Year-over-year comparison
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? `So sánh YoY · ${P.year} với ${P.previousYear}` : `YoY comparison · ${P.year} vs ${P.previousYear}`,
        P.vi ? 'YoY chỉ hiện khi cả hai năm có đủ dữ liệu theo quy tắc của từng chuỗi.' : 'YoY is shown only when both years meet each series completeness rules.');
      const rows = seriesRows.map(item => {
        const s = P.series[item.key];
        const previous = s.previousYear || {};
        return [
          item.label,
          s.val == null ? '—' : `${num.format(s.val)} USD`,
          previous.val == null ? '—' : `${num.format(previous.val)} USD`,
          pct(s.yoyValuePct),
          s.qty == null ? '—' : `${num.format(s.qty)} ${P.vi ? 'tấn' : 'tons'}`,
          previous.qty == null ? '—' : `${num.format(previous.qty)} ${P.vi ? 'tấn' : 'tons'}`,
          pct(s.yoyQtyPct),
          s.annualRecord ? (P.vi ? 'Cộng dồn năm' : 'Annual') : `${s.monthsWithData}/12`,
        ];
      });
      slide.addTable([
        [
          { text: P.vi ? 'Nguồn / luồng' : 'Source / flow', options: { bold: true, color: C.white, fill: C.deep } },
          { text: `${P.vi ? 'Trị giá' : 'Value'} ${P.year}`, options: { bold: true, color: C.white, fill: C.deep } },
          { text: `${P.vi ? 'Trị giá' : 'Value'} ${P.previousYear}`, options: { bold: true, color: C.white, fill: C.deep } },
          { text: 'YoY', options: { bold: true, color: C.white, fill: C.deep } },
          { text: `${P.vi ? 'Lượng' : 'Volume'} ${P.year}`, options: { bold: true, color: C.white, fill: C.deep } },
          { text: `${P.vi ? 'Lượng' : 'Volume'} ${P.previousYear}`, options: { bold: true, color: C.white, fill: C.deep } },
          { text: 'YoY', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Phủ dữ liệu' : 'Coverage', options: { bold: true, color: C.white, fill: C.deep } },
        ],
        ...rows,
      ], {
        x: 0.45, y: 1.65, w: 12.45, h: 2.35,
        border: { type: 'solid', color: C.line, pt: 0.7 },
        fill: C.white, color: C.deep, fontFace: 'Aptos', fontSize: 8,
        rowH: 0.48, margin: 0.05, valign: 'mid',
        colW: [2.4, 1.75, 1.75, 1.0, 1.75, 1.75, 1.0, 1.05],
      });
      slide.addText(P.vi
        ? 'Vinacas 2018–2022 có thể chỉ có bản ghi cộng dồn năm; không được diễn giải như số tháng hoặc gộp với TCHQ.'
        : 'Vinacas 2018–2022 may contain annual cumulative records only; do not treat them as monthly records or combine with TCHQ.', {
        x: 0.75, y: 4.45, w: 11.8, h: 0.7, fontFace: 'Aptos', fontSize: 11, color: C.muted, margin: 0.05, fit: 'shrink',
      });
      addFooter(slide, 12);
    }

    // 13 — Market movers
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? 'Phân tích thị trường · Top tăng / Top giảm' : 'Market analysis · top movers',
        P.vi
          ? 'Chỉ so sánh thị trường có phân rã đã đối soát ở cả hai năm; thị trường vắng dữ liệu không bị xem là 0.'
          : 'Only markets with reconciled breakdowns in both years are compared; missing markets are not treated as zero.');
      const priorMarkets = P.series.tchqExport.previousYear?.markets || [];
      const priorByCountry = new Map(priorMarkets.map(market => [market.country, market]));
      const movers = markets.flatMap(market => {
        const prior = priorByCountry.get(market.country);
        if (!prior || !Number.isFinite(market.value) || !Number.isFinite(prior.value)) return [];
        return [{
          country: market.country,
          current: market.value,
          previous: prior.value,
          delta: market.value - prior.value,
          pct: prior.value === 0 ? null : ((market.value - prior.value) / Math.abs(prior.value)) * 100,
          coverage: `${market.monthsWithData || 0}/12 · ${prior.monthsWithData || 0}/12`,
        }];
      });
      const topUp = movers.filter(item => item.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5);
      const topDown = movers.filter(item => item.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);
      const moverRows = [
        ...topUp.map(item => [{ text: P.vi ? 'Tăng' : 'Up', options: { color: C.green, bold: true } }, item.country, compactUsd(item.previous), compactUsd(item.current), compactUsd(item.delta), pct(item.pct), item.coverage]),
        ...topDown.map(item => [{ text: P.vi ? 'Giảm' : 'Down', options: { color: C.red, bold: true } }, item.country, compactUsd(item.previous), compactUsd(item.current), compactUsd(item.delta), pct(item.pct), item.coverage]),
      ];
      if (moverRows.length) {
        slide.addTable([
          [
            { text: P.vi ? 'Xu hướng' : 'Direction', options: { bold: true, color: C.white, fill: C.deep } },
            { text: P.vi ? 'Thị trường' : 'Market', options: { bold: true, color: C.white, fill: C.deep } },
            { text: P.previousYear, options: { bold: true, color: C.white, fill: C.deep } },
            { text: P.year, options: { bold: true, color: C.white, fill: C.deep } },
            { text: 'Δ USD', options: { bold: true, color: C.white, fill: C.deep } },
            { text: 'YoY', options: { bold: true, color: C.white, fill: C.deep } },
            { text: P.vi ? 'Phủ dữ liệu N/N-1' : 'Coverage Y/Y-1', options: { bold: true, color: C.white, fill: C.deep } },
          ],
          ...moverRows,
        ], {
          x: 0.55, y: 1.6, w: 12.2, h: 3.9,
          border: { type: 'solid', color: C.line, pt: 0.7 },
          fill: C.white, color: C.deep, fontFace: 'Aptos', fontSize: 9,
          rowH: 0.42, margin: 0.06, valign: 'mid',
          colW: [1.2, 2.7, 1.8, 1.8, 2.0, 1.2, 1.5],
        });
      } else {
        slide.addText(P.vi
          ? 'Không đủ dữ liệu thị trường đã đối soát ở cả hai năm để tính Top movers.'
          : 'There are not enough reconciled market records in both years to calculate top movers.', {
          x: 1.0, y: 2.5, w: 11.3, h: 0.8, fontFace: 'Aptos', fontSize: 14, color: C.muted, align: 'center', margin: 0.1,
        });
      }
      addFooter(slide, 13);
    }

    // 14 — Data quality and fallback flags
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? 'Chất lượng dữ liệu & cờ fallback' : 'Data quality & fallback flags',
        P.vi ? `Phiên bản TCHQ yêu cầu: ${P.requestedVersionLabel}` : `Requested TCHQ version: ${P.requestedVersionLabel}`);
      const fallbackGroups = seriesRows.flatMap(item => {
        const flags = P.series[item.key].fallbackPeriods || [];
        return flags.map(flag => `${item.label} · ${flag.period} · ${flag.version}${flag.derived ? (P.vi ? ' · Ước tính/backfill' : ' · Estimated/backfilled') : ''}${flag.note ? ` · ${flag.note}` : ''}`);
      });
      const text = fallbackGroups.length
        ? fallbackGroups.join('\n')
        : (P.vi ? 'Không ghi nhận fallback trong phạm vi phiên bản đã chọn.' : 'No fallback was recorded within the selected version scope.');
      slide.addText(text, {
        x: 0.8, y: 1.55, w: 11.8, h: 4.9, fontFace: 'Aptos', fontSize: 11,
        color: fallbackGroups.length ? C.red : C.muted, breakLine: false, margin: 0.08, fit: 'shrink',
      });
      addFooter(slide, 14);
    }

    // 15 — Sources and methodology
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? 'Nguồn dữ liệu & phương pháp' : 'Sources & methodology',
        P.vi ? `Báo cáo năm ${P.year} · Phiên bản TCHQ: ${P.requestedVersionLabel}` : `Annual report ${P.year} · TCHQ version: ${P.requestedVersionLabel}`);
      const sourceText = P.vi
        ? [
          'Nguồn: Tổng cục Hải quan Việt Nam (TCHQ) và Hiệp hội Điều Việt Nam (VINACAS).',
          `TCHQ sử dụng phiên bản được yêu cầu: ${P.requestedVersionLabel}; các kỳ khác phiên bản hoặc ước tính được đánh dấu tại trang 14.`,
          'Vinacas là chuỗi nhập khẩu hạt điều thô RCN độc lập, không lọc theo phiên bản TCHQ và không cộng với nhập khẩu TCHQ.',
          'Tháng thiếu để trống, không xem là 0. Thị phần chỉ được tính từ phân rã quốc gia khớp tổng TCHQ cùng kỳ/phiên bản.',
          'YoY chỉ được hiển thị khi đủ dữ liệu theo quy tắc hoàn chỉnh của từng chuỗi; không suy diễn giá trị thiếu.',
        ].join('\n\n')
        : [
          'Sources: Vietnam Customs (TCHQ) and the Vietnam Cashew Association (VINACAS).',
          `TCHQ uses the requested version: ${P.requestedVersionLabel}; different-version and estimated periods are flagged on page 14.`,
          'Vinacas is an independent raw cashew nut (RCN) import series, not filtered by TCHQ version and never combined with TCHQ imports.',
          'Missing months remain blank, not zero. Market shares use only country breakdowns reconciling to the same TCHQ period/version.',
          'YoY appears only when each series meets its completeness rule; missing values are never inferred.',
        ].join('\n\n');
      slide.addText(sourceText, {
        x: 0.85, y: 1.55, w: 11.5, h: 4.9, fontFace: 'Aptos', fontSize: 13,
        color: C.deep, breakLine: false, margin: 0.1, fit: 'shrink', valign: 'mid',
      });
      addFooter(slide, 15);
    }

    const filename = `cashew_trade_${P.year}_annual.pptx`;
    await pptx.writeFile({ fileName: filename });
    showToast(`PPTX ✓ · ${P.year} · ${EX_TEMPLATES.annualReport.pptxSlides} slides`, 'success');
  });
}

function exportMonthlyPPTX(period, version) {
  exCardBusy('ex-pptx', async () => {
    const P = collectMonthlyExportPayload(period, version);
    if (!P.tchqAvailable && !P.vinacasAvailable) {
      throw new Error(`Không có dữ liệu cho kỳ ${period}`);
    }
    if (typeof PptxGenJS === 'undefined') throw new Error('PptxGenJS chưa được tải');

    let annual = null;
    try {
      annual = collectAnnualExportPayload(P.year, version);
    } catch (error) {
      console.warn('[monthly PPTX] YTD context unavailable:', error);
    }
    const mapPng = await exAnnualMapPng(P.current.tchqExport.markets);
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'DAN ON FOOD · Trade Explorer';
    pptx.subject = `Monthly cashew trade report ${P.period}`;
    pptx.title = `Vietnam Cashew Trade · ${P.period}`;

    const C = {
      deep: '17231F', gold: 'C9A227', goldDark: '8A6D1C',
      cream: 'F5EBD0', soft: 'F7EFD8', muted: '8A7B5E',
      green: '3E7C4F', red: 'C0392B', line: 'E3E8E4', white: 'FFFFFF',
    };
    const num = new Intl.NumberFormat(P.vi ? 'vi-VN' : 'en-US', { maximumFractionDigits: 0 });
    const compactUsd = value => {
      if (value == null || !Number.isFinite(value)) return '—';
      const abs = Math.abs(value);
      const scale = abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : abs >= 1e3 ? 1e3 : 1;
      const suffix = abs >= 1e9 ? 'B' : abs >= 1e6 ? 'M' : abs >= 1e3 ? 'K' : '';
      return `${value < 0 ? '-' : ''}$${(abs / scale).toFixed(scale === 1 ? 0 : 1)}${suffix}`;
    };
    const fullUsd = value => value == null || !Number.isFinite(value) ? '—' : `${num.format(value)} USD`;
    const fullQty = value => value == null || !Number.isFinite(value) ? '—' : `${num.format(value)} ${P.vi ? 'tấn' : 'tons'}`;
    const pct = value => value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
    const delta = value => value == null || !Number.isFinite(value) ? '—' : num.format(value);
    const monthLabel = P.vi ? `Tháng ${P.monthNum}/${P.year}` : `${P.period.slice(5)}/${P.year}`;
    const seriesRows = [
      { key: 'tchqExport', label: P.vi ? 'TCHQ · Xuất khẩu' : 'TCHQ · Exports' },
      { key: 'tchqImport', label: P.vi ? 'TCHQ · Nhập khẩu' : 'TCHQ · Imports' },
      { key: 'vinacasImport', label: P.vi ? 'VINACAS · Nhập khẩu RCN' : 'VINACAS · RCN imports' },
    ];
    const addTitle = (slide, title, subtitle = '') => {
      slide.background = { color: C.white };
      slide.addText(title, { x: 0.55, y: 0.34, w: 12.15, h: 0.5, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: C.deep, margin: 0 });
      if (subtitle) slide.addText(subtitle, { x: 0.58, y: 0.88, w: 12.1, h: 0.38, fontFace: 'Aptos', fontSize: 10, color: C.muted, margin: 0 });
    };
    const addFooter = (slide, slideNumber) => {
      slide.addShape(pptx.ShapeType.line, { x: 0.55, y: 7.08, w: 12.2, h: 0, line: { color: C.line, width: 0.6 } });
      slide.addText(`DAN ON FOOD · ${P.period} · ${P.requestedVersionLabel} · ${slideNumber}/${EX_TEMPLATES.monthlyReport.pptxSlides}`, {
        x: 0.58, y: 7.12, w: 12.1, h: 0.2, fontFace: 'Aptos', fontSize: 8, color: C.muted, margin: 0,
      });
    };
    const addComparisonTable = (slide, metric, previousKey, title, y) => {
      slide.addText(title, { x: 0.72, y, w: 11.9, h: 0.32, fontFace: 'Aptos Display', fontSize: 15, bold: true, color: C.deep, margin: 0 });
      const rows = [
        [
          { text: P.vi ? 'Nguồn / luồng' : 'Source / flow', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Kỳ này' : 'Current', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Kỳ trước' : 'Previous', options: { bold: true, color: C.white, fill: C.deep } },
          { text: 'Δ', options: { bold: true, color: C.white, fill: C.deep } },
          { text: 'Δ%', options: { bold: true, color: C.white, fill: C.deep } },
        ],
        ...seriesRows.map(item => {
          const c = P.current[item.key];
          const p = P[previousKey][item.key];
          const cur = metric === 'quantity' ? c.qty : c.val;
          const prev = metric === 'quantity' ? p.qty : p.val;
          const difference = cur == null || prev == null ? null : cur - prev;
          const changePct = previousKey === 'mom'
            ? (metric === 'quantity' ? c.momQtyPct : c.momValPct)
            : (metric === 'quantity' ? c.yoyQtyPct : c.yoyValPct);
          const format = metric === 'quantity' ? fullQty : fullUsd;
          return [item.label, format(cur), format(prev), delta(difference), pct(changePct)];
        }),
      ];
      slide.addTable(rows, {
        x: 0.65, y: y + 0.4, w: 12.0, h: 1.72,
        border: { type: 'solid', color: C.line, pt: 0.7 },
        fill: C.white, color: C.deep, fontFace: 'Aptos', fontSize: 10,
        rowH: 0.42, margin: 0.08, valign: 'mid',
        colW: [3.1, 2.4, 2.4, 2.1, 2.0],
      });
    };

    // 1 — Cover
    {
      const slide = pptx.addSlide();
      slide.background = { color: C.deep };
      slide.addText('DAN ON FOOD · TRADE EXPLORER', { x: 0.75, y: 0.7, w: 11.8, h: 0.3, fontFace: 'Aptos', fontSize: 11, bold: true, charSpacing: 2, color: C.gold, margin: 0 });
      slide.addText(P.vi ? `Báo cáo thương mại hạt điều\n${monthLabel}` : `Cashew trade report\n${monthLabel}`, {
        x: 0.75, y: 1.5, w: 11.8, h: 1.4, fontFace: 'Aptos Display', fontSize: 34, bold: true, color: C.cream, breakLine: false, margin: 0,
      });
      slide.addShape(pptx.ShapeType.rect, { x: 0.76, y: 3.2, w: 2.4, h: 0.07, fill: { color: C.gold }, line: { color: C.gold } });
      slide.addText(P.vi
        ? `TCHQ xuất khẩu · TCHQ nhập khẩu · Vinacas nhập khẩu RCN\nPhiên bản TCHQ: ${P.requestedVersionLabel}`
        : `TCHQ exports · TCHQ imports · Vinacas RCN imports\nTCHQ version: ${P.requestedVersionLabel}`, {
        x: 0.78, y: 3.55, w: 11.7, h: 0.8, fontFace: 'Aptos', fontSize: 16, color: C.cream, breakLine: false, margin: 0,
      });
      slide.addText(`${P.vi ? 'Ngày tạo' : 'Generated'}: ${P.generatedAt.toLocaleDateString(P.vi ? 'vi-VN' : 'en-US')}`, {
        x: 0.78, y: 6.55, w: 11.5, h: 0.3, fontFace: 'Aptos', fontSize: 10, color: C.cream, margin: 0,
      });
    }

    // 2 — Monthly summary
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? `Tóm tắt tháng ${monthLabel}` : `Monthly summary · ${monthLabel}`,
        P.vi ? 'Ba chuỗi được trình bày riêng; số liệu thiếu hoặc fallback không bị ẩn.' : 'Three separate series; missing or fallback data is not concealed.');
      seriesRows.forEach((item, index) => {
        const s = P.current[item.key];
        const x = 0.72 + index * 4.12;
        slide.addShape(pptx.ShapeType.roundRect, { x, y: 1.65, w: 3.75, h: 2.05, rectRadius: 0.08, fill: { color: C.soft }, line: { color: C.gold, width: 1 } });
        slide.addText(item.label, { x: x + 0.18, y: 1.9, w: 3.38, h: 0.38, fontFace: 'Aptos', fontSize: 12, bold: true, color: C.deep, align: 'center', margin: 0.02, fit: 'shrink' });
        slide.addText(compactUsd(s.val), { x: x + 0.18, y: 2.48, w: 3.38, h: 0.46, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: C.goldDark, align: 'center', margin: 0 });
        slide.addText(fullQty(s.qty), { x: x + 0.18, y: 3.05, w: 3.38, h: 0.25, fontFace: 'Aptos', fontSize: 11, color: C.deep, align: 'center', margin: 0 });
        slide.addText(`${P.vi ? 'MoM' : 'MoM'} ${pct(s.momValPct)} · YoY ${pct(s.yoyValPct)}${s.fallback ? ' · ⚠ fallback' : ''}`, {
          x: x + 0.18, y: 3.38, w: 3.38, h: 0.2, fontFace: 'Aptos', fontSize: 8, color: s.fallback ? C.red : C.muted, align: 'center', margin: 0, fit: 'shrink',
        });
      });
      slide.addText(P.vi
        ? 'Lưu ý: nhập khẩu TCHQ và nhập khẩu RCN Vinacas có phạm vi thống kê khác nhau, không cộng gộp.'
        : 'Note: TCHQ imports and Vinacas RCN imports have different statistical scopes and are not combined.', {
        x: 0.8, y: 4.25, w: 11.8, h: 0.65, fontFace: 'Aptos', fontSize: 13, bold: true, color: C.goldDark, align: 'center', margin: 0.05,
      });
      addFooter(slide, 2);
    }

    // 3 — Year-to-date monthly trend
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? `Xu hướng trị giá theo tháng · ${P.year}` : `Monthly value trend · ${P.year}`,
        P.vi ? `Tháng ${P.monthNum} được làm nổi bật; tháng thiếu để trống, không xem là 0.` : `Month ${P.monthNum} is highlighted; missing months are blank, not zero.`);
      const labels = Array.from({ length: 12 }, (_, index) => String(index + 1));
      const trendKeys = [
        { key: 'tchqExport', name: P.vi ? 'TCHQ XK' : 'TCHQ exports' },
        { key: 'tchqImport', name: P.vi ? 'TCHQ NK' : 'TCHQ imports' },
        { key: 'vinacasImport', name: P.vi ? 'Vinacas RCN NK' : 'Vinacas RCN imports' },
      ];
      const chartSeries = trendKeys.map(item => ({
        name: item.name,
        labels,
        values: annual
          ? annual.series[item.key].monthly.map(entry => entry.valid ? entry.val : null)
          : labels.map((_, index) => index === P.monthNum - 1 && P.current[item.key].valid ? P.current[item.key].val : null),
      }));
      slide.addChart(pptx.ChartType.line, chartSeries, {
        x: 0.65, y: 1.48, w: 11.9, h: 4.85,
        showTitle: false, showLegend: true, legendPos: 'b', legendFontSize: 10,
        chartColors: [C.gold, C.green, C.deep],
        showValue: false, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9,
        valAxisLabelFormatCode: '#,##0,, "M"',
        showMarker: true, markerSize: 4, lineSize: 2, showBorder: false,
      });
      addFooter(slide, 3);
    }

    const markets = P.current.tchqExport.markets || [];
    const marketTotal = markets.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

    // 4 — Top export markets table
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? `Top thị trường xuất khẩu · ${monthLabel}` : `Top export markets · ${monthLabel}`,
        P.vi ? 'Chỉ hiển thị phân rã quốc gia khớp tổng TCHQ cùng kỳ/phiên bản.' : 'Only country breakdowns reconciling to the same period/version are included.');
      const rows = [
        [
          { text: '#', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Quốc gia' : 'Country', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Trị giá (USD)' : 'Value (USD)', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Lượng (tấn)' : 'Volume (tons)', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Thị phần' : 'Share', options: { bold: true, color: C.white, fill: C.deep } },
        ],
        ...markets.slice(0, 10).map((item, index) => [
          String(index + 1), item.country, fullUsd(item.value), fullQty(item.qty),
          marketTotal > 0 ? `${(item.value / marketTotal * 100).toFixed(1)}%` : '—',
        ]),
      ];
      if (!markets.length) {
        slide.addText(P.vi
          ? 'Không có phân rã quốc gia đối soát được; không suy diễn thị phần từ tổng fallback.'
          : 'No reconciled country breakdown is available; market shares are not inferred from fallback totals.', {
          x: 0.9, y: 2.5, w: 11.5, h: 0.8, fontFace: 'Aptos', fontSize: 15, color: C.muted, align: 'center', margin: 0.1,
        });
      } else {
        slide.addTable(rows, {
          x: 0.65, y: 1.55, w: 12.0, h: 4.8,
          border: { type: 'solid', color: C.line, pt: 0.7 },
          fill: C.white, color: C.deep, fontFace: 'Aptos', fontSize: 10,
          rowH: 0.38, margin: 0.08, valign: 'mid',
          colW: [0.7, 4.2, 2.5, 2.4, 2.2],
        });
      }
      addFooter(slide, 4);
    }

    // 5 — Top export markets chart
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? `Trị giá theo thị trường · ${monthLabel}` : `Export value by market · ${monthLabel}`);
      if (markets.length) {
        slide.addChart(pptx.ChartType.bar, [{
          name: P.vi ? 'Trị giá USD' : 'Value USD',
          labels: markets.slice(0, 10).map(item => item.country),
          values: markets.slice(0, 10).map(item => item.value),
        }], {
          x: 0.75, y: 1.45, w: 11.8, h: 4.9,
          barDir: 'bar', catAxisLabelFontSize: 10, valAxisLabelFontSize: 9,
          chartColors: [C.gold], showLegend: false, showValue: true,
          dataLabelPosition: 'outEnd', dataLabelFormatCode: '#,##0,, "M"',
          valAxisLabelFormatCode: '#,##0,, "M"', showTitle: false, showBorder: false,
        });
      } else {
        slide.addText(P.vi ? 'Không có dữ liệu phân rã để vẽ biểu đồ.' : 'No reconciled breakdown data to chart.', {
          x: 1, y: 2.6, w: 11.3, h: 0.6, fontFace: 'Aptos', fontSize: 15, color: C.muted, align: 'center', margin: 0.1,
        });
      }
      addFooter(slide, 5);
    }

    // 6 — Market map
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? `Bản đồ thị trường xuất khẩu · ${monthLabel}` : `Export market map · ${monthLabel}`);
      if (mapPng) {
        slide.addImage({ data: mapPng, x: 2.15, y: 1.45, w: 9.0, h: 4.5 });
      } else {
        slide.addText(P.vi
          ? (markets.length ? 'Bản đồ hiện không khả dụng; bảng Top 10 vẫn dựa trên số liệu đã đối soát.' : 'Không có dữ liệu xuất khẩu TCHQ để lập bản đồ thị trường.')
          : (markets.length ? 'Map unavailable; the Top 10 table still uses reconciled data.' : 'No TCHQ export data is available to map.'), {
          x: 1.2, y: 2.45, w: 10.9, h: 0.8, fontFace: 'Aptos', fontSize: 15, color: C.muted, align: 'center', margin: 0.1,
        });
      }
      slide.addText(P.vi
        ? 'Vàng đậm: thị trường có trị giá xuất khẩu cao hơn · Xám: không có phân rã đối soát'
        : 'Darker gold: higher export value · Gray: no reconciled breakdown', {
        x: 0.8, y: 6.1, w: 11.8, h: 0.3, fontFace: 'Aptos', fontSize: 9, color: C.muted, align: 'center', margin: 0,
      });
      addFooter(slide, 6);
    }

    // 7 — Month-over-month comparisons
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? `So sánh MoM · ${P.period} với ${P.priorPeriod}` : `MoM comparison · ${P.period} vs ${P.priorPeriod}`,
        P.vi ? 'Giá trị và lượng theo cùng nguồn/luồng; thiếu dữ liệu kỳ trước thì không suy diễn.' : 'Value and volume use the same source/flow; missing prior data is not inferred.');
      addComparisonTable(slide, 'value', 'mom', P.vi ? 'Trị giá (USD)' : 'Value (USD)', 1.4);
      addComparisonTable(slide, 'quantity', 'mom', P.vi ? 'Lượng (tấn)' : 'Volume (tons)', 4.0);
      addFooter(slide, 7);
    }

    // 8 — Year-over-year comparisons
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? `So sánh YoY · ${P.period} với ${P.yoyPeriod}` : `YoY comparison · ${P.period} vs ${P.yoyPeriod}`,
        P.vi ? 'So sánh cùng tháng năm trước; chuỗi Vinacas cộng dồn năm không dùng cho phép so sánh tháng.' : 'Same month of the prior year; annual cumulative Vinacas records are excluded from monthly comparisons.');
      addComparisonTable(slide, 'value', 'yoy', P.vi ? 'Trị giá (USD)' : 'Value (USD)', 1.4);
      addComparisonTable(slide, 'quantity', 'yoy', P.vi ? 'Lượng (tấn)' : 'Volume (tons)', 4.0);
      addFooter(slide, 8);
    }

    // 9 — Imports
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? `Nhập khẩu tháng ${monthLabel}` : `Monthly imports · ${monthLabel}`,
        P.vi ? 'Hai chuỗi có nguồn và phạm vi thống kê riêng, không cộng thành tổng nhập khẩu.' : 'The series have different sources and scopes and are never combined.');
      [
        { s: P.current.tchqImport, title: P.vi ? 'TCHQ · Nhập khẩu hạt điều' : 'TCHQ · Cashew imports', x: 0.75 },
        { s: P.current.vinacasImport, title: P.vi ? 'VINACAS · Nhập khẩu RCN' : 'VINACAS · RCN imports', x: 6.75 },
      ].forEach(({ s, title, x }) => {
        slide.addShape(pptx.ShapeType.roundRect, { x, y: 1.65, w: 5.65, h: 3.35, rectRadius: 0.08, fill: { color: C.soft }, line: { color: C.gold, width: 1 } });
        slide.addText(title, { x: x + 0.25, y: 1.95, w: 5.15, h: 0.45, fontFace: 'Aptos Display', fontSize: 18, bold: true, color: C.deep, align: 'center', margin: 0.02, fit: 'shrink' });
        slide.addText(compactUsd(s.val), { x: x + 0.25, y: 2.75, w: 5.15, h: 0.62, fontFace: 'Aptos Display', fontSize: 30, bold: true, color: C.goldDark, align: 'center', margin: 0 });
        slide.addText(fullQty(s.qty), { x: x + 0.25, y: 3.55, w: 5.15, h: 0.3, fontFace: 'Aptos', fontSize: 14, color: C.deep, align: 'center', margin: 0 });
        slide.addText(`MoM ${pct(s.momValPct)} · YoY ${pct(s.yoyValPct)}${s.fallback ? ' · ⚠ fallback' : ''}`, {
          x: x + 0.25, y: 4.2, w: 5.15, h: 0.25, fontFace: 'Aptos', fontSize: 10, color: s.fallback ? C.red : C.muted, align: 'center', margin: 0,
        });
      });
      addFooter(slide, 9);
    }

    // 10 — Sources and data quality
    {
      const slide = pptx.addSlide();
      addTitle(slide, P.vi ? 'Nguồn dữ liệu & chất lượng' : 'Sources & data quality',
        P.vi ? `Kỳ ${P.period} · Phiên bản TCHQ yêu cầu: ${P.requestedVersionLabel}` : `${P.period} · Requested TCHQ version: ${P.requestedVersionLabel}`);
      const rows = [
        [
          { text: P.vi ? 'Chuỗi' : 'Series', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Trạng thái' : 'Status', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Phiên bản' : 'Version', options: { bold: true, color: C.white, fill: C.deep } },
          { text: P.vi ? 'Ghi chú nguồn' : 'Source note', options: { bold: true, color: C.white, fill: C.deep } },
        ],
        ...seriesRows.map(item => {
          const s = P.current[item.key];
          return [
            item.label,
            !s.valid ? (P.vi ? 'Thiếu dữ liệu' : 'Missing data') : (s.fallback ? (P.vi ? 'Fallback / ước tính' : 'Fallback / estimated') : 'OK'),
            s.valid ? (s.versionLabel || '—') : '—',
            s.sourceNote || '—',
          ];
        }),
      ];
      slide.addTable(rows, {
        x: 0.65, y: 1.48, w: 12.0, h: 2.4,
        border: { type: 'solid', color: C.line, pt: 0.7 },
        fill: C.white, color: C.deep, fontFace: 'Aptos', fontSize: 10,
        rowH: 0.48, margin: 0.08, valign: 'mid',
        colW: [2.8, 2.4, 2.2, 4.6],
      });
      slide.addText(P.vi
        ? 'Nguồn: Tổng cục Hải quan Việt Nam (TCHQ) và Hiệp hội Điều Việt Nam (VINACAS). Số liệu ước tính/backfill được gắn cờ; tháng thiếu để trống, không phải 0.'
        : 'Sources: Vietnam Customs (TCHQ) and Vietnam Cashew Association (VINACAS). Estimated/backfilled figures are flagged; missing months stay blank, never zero.', {
        x: 0.78, y: 4.35, w: 11.7, h: 0.8, fontFace: 'Aptos', fontSize: 11, color: C.muted, margin: 0.05, fit: 'shrink',
      });
      addFooter(slide, 10);
    }

    await pptx.writeFile({ fileName: `cashew_trade_${P.period}_monthly.pptx` });
    showToast(`PPTX ✓ · ${P.period} · ${EX_TEMPLATES.monthlyReport.pptxSlides} slides`, 'success');
  });
}
