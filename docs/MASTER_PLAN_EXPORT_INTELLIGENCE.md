# MASTER PLAN — EXPORT INTELLIGENCE: CHUYỂN ĐỔI TỪ "XUẤT DỮ LIỆU" THÀNH "BÁO CÁO HIỂU TOÀN BỘ NGÀNH ĐIỀU"

> **Phiên bản**: v1.0 · 2025-01-15  
> **Trạng thái**: CHƯA DUYỆT — Chờ review & approve  
> **Scope**: `web/app.js` (exportPDF, exportPPTX, exportExcel, exportCSV) + `web/index.html` (UI) + `docs/` (spec)  
> **Mục tiêu**: Mọi file xuất ra (PDF/PPTX/Excel/CSV/HTML/JSON) phải cho phép **người chưa biết ngành điều** đọc hiểu được: *Vị thế ngành, Mùa vụ, Drivers, Rủi ro, Cơ hội, Kế hoạch hành động* — trong 5 phút.

---

## 0. TỔNG QUAN 4 GIAI ĐOẠN TRIỂN KHAI

| Phase | Deliverable | Timeline | Effort | Impact | Priority |
|-------|-------------|----------|--------|--------|----------|
| **0** | **Foundation**: Industry Knowledge Base + Quality Gates + Shared Tokens | Tuần 1 | S | ⭐⭐⭐⭐⭐ | P0 — Blocker cho các phase sau |
| **1** | **PDF Executive Report** (7 trang, chuẩn quốc tế) | Tuần 1-2 | M | ⭐⭐⭐⭐⭐ | P1 — Format quan trọng nhất cho Leadership |
| **2** | **PPTX Narrative Deck** (15 slides, speaker notes) | Tuần 2-3 | M | ⭐⭐⭐⭐ | P1 — Cho trình diễn, hội nghị |
| **3** | **Excel Interactive Workbook** (9 sheets, PivotTable thật) | Tuần 3-4 | L | ⭐⭐⭐⭐ | P2 — Cho Analyst deep-dive |
| **4** | **CSV Dual-Output** (Data + Meta, RFC 4180 + Schema versioning) | Tuần 1 | S | ⭐⭐⭐ | P2 — Cho ETL/BI pipeline |
| **5** | **Cross-Format Consistency** (HTML, JSON, UI selector) | Tuần 3 | M | ⭐⭐⭐ | P2 — Đảm bảo trải nghiệm thống nhất |

**Tổng effort ước lượng**: 4-5 tuần (1 dev full-time)  
**Dependencies**: Phase 0 phải xong trước khi bắt đầu Phase 1-4.

---

## 1. PHASE 0 — FOUNDATION (TUẦN 1) — **BẮT BUỘC LÀM TRƯỚC**

### 1.1 Industry Knowledge Base (`INDUSTRY_CONTEXT`) — Static Data Layer
```javascript
// Thêm vào web/app.js, dùng chung cho TẤT CẢ formats
const INDUSTRY_CONTEXT = {
  vietnam_position: {
    global_rank: 1,
    market_share_pct: 55,
    export_value_usd_bn: 3.5,
    key_competitors: [
      { country: 'Costa Rica', strength: 'Kernel quality, FTA network' },
      { country: "Ivory Coast", strength: 'Raw cashew supply, low cost' },
      { country: 'Tanzania', strength: 'Emerging, organic potential' },
      { country: 'Indonesia', strength: 'Domestic consumption + export' }
    ],
    harvest_season: {
      peak_months: [2,3,4],           // Thu hoạch vụ chính
      processing_months: [5,6,7],     // Chế biến, sấy, tách nhân
      export_peak_months: [8,9,10],   // Xuất khẩu đỉnh
      off_season: [11,12,1]           // Nghỉ vụ, chuẩn bị vụ mới
    }
  },
  value_chain: {
    farming: { households: '1.5M', avg_farm_ha: 1.2, yield_t_ha: 1.8 },
    processing: { factories: 400, capacity_mt_yr: 2.5, utilization_pct: 65 },
    export_products: [
      { code: 'RK', name: 'Raw Kernel', share_pct: 60, avg_price_usd_t: 8500 },
      { code: 'WK', name: 'White Kernel', share_pct: 25, avg_price_usd_t: 9200 },
      { code: 'SW', name: 'Scorched Wholes', share_pct: 10, avg_price_usd_t: 7800 },
      { code: 'PC', name: 'Pieces (LP/SP/DP)', share_pct: 5, avg_price_usd_t: 6500 }
    ],
    key_markets: {
      china: { share_pct: 35, driver: 'Consumption growth, Decree 248 standards' },
      usa: { share_pct: 18, driver: 'Healthy snack trend, peanut butter substitute' },
      eu: { share_pct: 22, driver: 'EUDR deforestation-free, HACCP/BRC' },
      middle_east: { share_pct: 10, driver: 'Import RK for domestic processing' },
      asean: { share_pct: 8, driver: 'Re-export hub, processing hub' }
    }
  },
  market_drivers: {
    supply_side: ['Crop yield (weather, fertilizer)', 'RCN import (Cambodia, West Africa)', 'Processing capacity utilization'],
    demand_side: ['China consumption per capita', 'Global healthy snack trend', 'Plant-based protein shift'],
    policy: ['Decree 248 (China)', 'EUDR (EU)', 'FTA (CPTPP, EVFTA, RCEP)', 'Vietnam Cashew Master Plan 2030'],
    macro: ['USD/VND exchange rate', 'Container freight index', 'Energy cost (drying)']
  },
  glossary: {
    'CY': 'Calendar Year / Current Year (năm hiện tại)',
    'YTD': 'Year to Date (lũy kế từ đầu năm)',
    'MoM': 'Month over Month (so với tháng trước)',
    'YoY': 'Year over Year (so với cùng kỳ năm trước)',
    'RCN': 'Raw Cashew Nut (hạt điều thô, chưa chế biến)',
    'Kernel': 'Hạt điều nhân (đã tách vỏ, sản phẩm xuất khẩu chính)',
    'RK/WK/SW': 'Raw Kernel / White Kernel / Scorched Wholes (phân loại kernel)',
    'HHI': 'Herfindahl-Hirschman Index (độ tập trung thị trường, <0.15 đa dạng, >0.25 tập trung)',
    'Waterfall': 'Biểu đồ phân tích hiệu ứng: Price Effect + Volume Effect + FX Effect = Total Change'
  }
};
```

### 1.2 Quality Gates (`QUALITY_CHECKS`) — Tự Động Kiểm Tra Trước Khi Xuất
```javascript
const QUALITY_CHECKS = {
  // Hard gates (chặn xuất nếu fail)
  hard: {
    min_countries: 5,                    // Ít nhất 5 quốc gia có dữ liệu
    max_missing_pct: 0.15,               // <15% missing values trong cột quan trọng
    min_periods_for_trend: 3,            // Cần ≥3 kỳ để vẽ trend YoY
    data_freshness_days: 45,             // Dữ liệu không quá 45 ngày
  },
  // Soft gates (cảnh báo nhưng cho xuất)
  soft: {
    hhi_threshold: 0.25,                 // Cảnh báo nếu tập trung thị trường > 0.25
    top1_share_threshold: 0.40,          // Cảnh báo nếu Top 1 > 40%
    yoy_decline_threshold: -0.20,        // Cảnh báo nếu giảm > 20% YoY
    price_volatility_pct: 0.15,          // Cảnh báo nếu biến động giá > 15% MoM
  },
  // Metadata bắt buộc trong mọi export
  required_meta: [
    'period', 'flow', 'generated_at', 'source', 'records_count',
    'filters_applied', 'data_quality_score', 'schema_version'
  ]
};

function runQualityChecks(P) {
  const warnings = [], errors = [];
  // Hard checks
  if (P.rows.length < QUALITY_CHECKS.hard.min_countries) {
    errors.push(`Dữ liệu quá ít: chỉ ${P.rows.length} quốc gia (yêu cầu ≥${QUALITY_CHECKS.hard.min_countries})`);
  }
  // Soft checks
  if (P.regions.length) {
    const hhi = P.regions.reduce((s, r) => s + Math.pow(r.value / P.totalVal, 2), 0);
    if (hhi > QUALITY_CHECKS.soft.hhi_threshold) {
      warnings.push(`Thị trường tập trung cao: HHI = ${hhi.toFixed(3)} (ngưỡng ${QUALITY_CHECKS.soft.hhi_threshold})`);
    }
  }
  return { passed: errors.length === 0, errors, warnings, hhi: hhi || null };
}
```

### 1.3 Shared Design Tokens (`EX_DESIGN_TOKENS`) — Consistency Cross-Format
```javascript
const EX_DESIGN_TOKENS = {
  colors: {
    deep: '#17231F', gold: '#C9A227', goldDark: '#8A6D1C',
    cream: '#F5EBD0', soft: '#F7EFD8', muted: '#8A7B5E',
    up: '#3E7C4F', down: '#C0392B', flat: '#B3A782',
    line: '#E3E8E4', bg: '#FAFAF8', white: '#FFFFFF',
    // Semantic
    primary: '#C9A227', secondary: '#17231F',
    success: '#3E7C4F', danger: '#C0392B', warning: '#C9A227', info: '#3E7C4F'
  },
  fonts: {
    heading: 'BeVietnamPro, Inter, system-ui',
    body: 'BeVietnamPro, Inter, system-ui',
    mono: 'JetBrains Mono, Consolas, monospace',
    fallback: 'Helvetica, Arial, sans-serif'
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, pill: 999 },
  shadows: { sm: '0 1px 2px rgba(0,0,0,0.05)', md: '0 4px 12px rgba(0,0,0,0.08)', lg: '0 8px 24px rgba(0,0,0,0.12)' },
  chart_palette: ['#C9A227', '#3E7C4F', '#8A6D1C', '#B3A782', '#2B2113', '#D4C89A', '#6B756F', '#5C470F', '#E3C772', '#EDD99A'],
  // Chart defaults
  chart: {
    fontSize: 11, titleSize: 14, labelSize: 10,
    gridColor: 'rgba(90,74,40,0.08)', axisColor: '#E3E8E4',
    tooltipBg: 'rgba(255,255,255,0.98)', tooltipBorder: '#E3E8E4'
  }
};
```

### 1.4 Acceptance Criteria cho Phase 0
- [ ] `INDUSTRY_CONTEXT` object tồn tại, có đầy đủ 4 sections (vietnam_position, value_chain, market_drivers, glossary)
- [ ] `QUALITY_CHECKS.hard` chạy trong mọi `export*()` function, chặn xuất nếu fail
- [ ] `EX_DESIGN_TOKENS` được import/use bởi PDF/PPTX/Excel/HTML
- [ ] Unit test: `runQualityChecks(mockPayload)` trả về đúng passed/warnings/errors

---

## 2. PHASE 1 — PDF EXECUTIVE REPORT (TUẦN 1-2) — **P1**

### 2.1 Cấu Trúc 7 Trang Mới

| Trang | Tên | Nội Dung Chính | Visual Elements | Page Ref |
|-------|-----|----------------|-----------------|----------|
| 1 | **Cover** | Title, Period, Classification, Industry Position Badge | Logo, Brand gradient, Gold accent line | `pdf.pages.cover` |
| 2 | **Executive Dashboard** | 5 KPI cards + Waterfall chart + 3 Insight bullets + Health Score | Waterfall (native jsPDF), Sparkline, Score gauge | `pdf.pages.exec_dashboard` |
| 3 | **Industry Context & Seasonality** | Vị thế VN, Value chain, Mùa vụ calendar, Benchmark 3 nước | World map (simple), Seasonality calendar heatmap, Competitor radar | `pdf.pages.industry_context` |
| 4 | **Executive Briefing (AI)** | 4 khối: Summary, Drivers, Price Alerts, Recommendations + **So What?** | 2-column cards, Icon + text, Priority badges | `pdf.pages.exec_brief` |
| 5 | **Market Deep Dive** | Top 10 + **Strategic Segmentation** (Core/Growth/Risk/Watch) + Heatmap Country×Month | Grouped bar, Heatmap, Quadrant chart | `pdf.pages.market_deep` |
| 6 | **Trade Flow Analysis** | XK vs NK vs Balance + Avg Price trend + FX impact + Margin analysis | Combo chart (bar+line), Waterfall decomposition | `pdf.pages.trade_flow` |
| 7 | **Appendix** | Glossary, Methodology, Data Sources, Assumptions, Version History, Quality Report | Clean tables, Checklist | `pdf.pages.appendix` |

### 2.2 Cải Tiến Kỹ Thuật PDF
```javascript
// Cập nhật EX_TEMPLATES.pdf
pdf: {
  pages: ['cover', 'exec_dashboard', 'industry_context', 'exec_brief', 'market_deep', 'trade_flow', 'appendix'],
  logoOnCover: true, logoOnPages: true, footer: true,
  // New
  bookmarks: true,                    // PDF outline/bookmarks
  hyperlinks: true,                   // Internal links (click "Top 10" → jump page 5)
  fontSubset: true,                   // Chỉ embed glyphs used (giảm size 60%)
  digitalSignature: false,            // Placeholder cho future
  pageNumbers: { start: 2, format: 'Page {current} of {total}' },
  watermark: { text: 'CONFIDENTIAL', opacity: 0.05, angle: 45 } // optional
}
```

### 2.3 Chi Tiết Trang 2 — Executive Dashboard (Quantum Leap)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EXECUTIVE DASHBOARD · 2025-09 · XUẤT KHẨU HẠT ĐIỀU VIỆT NAM               │
├─────────────────────────────────────────────────────────────────────────────┤
│  HEALTH SCORE: 78/100  ●●●○○  (Good)     │  CLASSIFICATION: INTERNAL       │
├──────┬──────────┬──────────┬──────────┬──────────┬────────────────────────┤
│ 📦   │ 💰       │ 📈       │ 🌍       │ ⚖️       │  WATERFALL DECOMPOSITION │
│ LƯỢNG│ TRỊ GIÁ  │ YTD VAL  │ MARKETS  │ BALANCE  │  (vs 2025-08)          │
│ 520K │ $3.45B   │ $28.2B   │ 42       │ +$1.2B   │                         │
│ ▲+8% │ ▲+12%    │ ▲+15%    │ ▼-2      │ ▲+5%     │  ┌─────────────────┐    │
│      │          │          │          │          │  │ Prev:   $3.1B   │    │
│      │          │          │          │          │  │ Price:  +$180M  │ ▲+6% │
│      │          │          │          │          │  │ Volume: +$120M  │ ▲+4% │
│      │          │          │          │          │  │ FX:     +$50M   │ ▲+1% │
│      │          │          │          │          │  │ Curr:   $3.45B  │    │
│      │          │          │          │          │  └─────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│  🎯 TOP 3 INSIGHTS                                                          │
│  1. Trung Quốc tăng 22% YoY nhờ nới lỏng tiêu chuẩn Decree 248 → cơ hội   │
│     mở rộng kernel cao cấp (WK/SW) mục tiêu +5% thị phần Q4.              │
│  2. Giá RK giảm 3% MoM doupply vụ mới Cambodia → chốt hợp đồng forward   │
│     3 tháng để bảo vệ margin.                                              │
│  3. HHI = 0.18 (đa dạng tốt) nhưng Top 3 (CN, US, NL) chiếm 65% → cần   │
│     đẩy mạnh UAE,Ả Rập,Ấn Độ để giảm rủi ro tập trung.                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Acceptance Criteria Phase 1
- [ ] PDF 7 trang render đúng, không lỗi font VN, không tràn trang
- [ ] Trang 2 (Dashboard) có Waterfall chart native (không phải ảnh chụp)
- [ ] Trang 3 có Industry Context: Vị thế VN, Mùa vụ calendar, Benchmark 3 nước
- [ ] Trang 5 có Strategic Segmentation (Core/Growth/Risk/Watch) + Heatmap
- [ ] Trang 6 có Price/Volume/FX decomposition waterfall
- [ ] Bookmarks/Outline hoạt động, click nhảy trang đúng
- [ ] File size < 2MB (font subset), render < 3s
- [ ] Quality gates chạy, hiển thị warnings trong Appendix nếu có

---

## 3. PHASE 2 — PPTX NARRATIVE DECK (TUẦN 2-3) — **P1**

### 3.1 Cấu Trúc 15 Slides

| # | Slide Title | Purpose | Key Visual | Speaker Notes |
|---|-------------|---------|------------|---------------|
| 1 | **Cover** | Brand, Period, Classification | Logo, Gradient, Gold line | "Chào cả nhà, hôm nay chúng ta review..." |
| 2 | **Agenda** | Roadmap 5 sections | Timeline 5 steps | "Chúng ta sẽ đi qua 5 phần trong 15 phút" |
| 3 | **Industry Snapshot** | Vị thế VN thế giới | World map + Sparkline 5yr | "Việt Nam giữ #1 thế giới 17 năm liên tiếp..." |
| 4 | **Executive Summary** | 3 Takeaways | 3 Icon cards + Metrics | "3 điểm then chốt: Performance, Driver, Outlook" |
| 5 | **Performance Waterfall** | Price/Volume/FX decomposition | Native Waterfall chart | "Phân tích: Giá +6%, Lượng +4%, FX +1% = Tổng +11%" |
| 6 | **Market Portfolio (BCG)** | Core/Growth/Risk/Watch | Bubble chart 4 quadrants | "Trung Quốc là Star, Mỹ Cash Cow, UAE Question Mark" |
| 7 | **Top 10 Markets Deep** | Bar + YoY% + Maturity | Combo chart | "Ấn Độ tăng 45% YoY nhưng từ cơ số nhỏ..." |
| 8 | **Regional Diversification** | Doughnut + HHI Gauge | Doughnut + Gauge | "HHI 0.18 = đa dạng tốt, nhưng Top 3 = 65%" |
| 9 | **Seasonality Heatmap** | 12 tháng × 5 năm + Mùa vụ icons | Heatmap + Icons | "Tháng 2-4 thu hoạch, 5-7 chế biến, 8-10 xuất khẩu đỉnh" |
| 10 | **Price-Volume Scatter** | Price vs Volume, size=Value | Bubble scatter | "Quadrant: High Price/High Vol = Premium markets" |
| 11 | **Risk Radar** | 5 rủi ro chính | Radar chart | "Rủi ro cao nhất: Giá RCN (West Africa crop)" |
| 12 | **Strategic Recommendations** | 3 Pillars + Actions | Framework visual | "Ba trụ cột: Đa dạng thị trường, Nâng cao giá trị, Quản trị rủi ro" |
| 13 | **Action Plan & KPIs** | Gantt-style table | Table + Timeline | "Q4: Mở UAE, Chốt forward, Audit EUDR compliance" |
| 14 | **Appendix: Methodology** | Sources, Definitions, Limitations | Clean text | "Dữ liệu TCHQ, Biểu 015.T/020.T, sơ bộ có thể điều chỉnh" |
| 15 | **Q&A / Contact** | Analyst, Refresh schedule | Simple | "Cảm ơn, mời mọi người đặt câu hỏi" |

### 3.2 Cải Tiến Kỹ Thuật PPTX
```javascript
// Cập nhật EX_TEMPLATES.pptx
pptx: {
  slides: ['cover','agenda','industry_snapshot','exec_summary','waterfall','bcg_matrix',
           'top10_deep','regional_div','seasonality','price_volume','risk_radar',
           'strategic_recs','action_plan','methodology','qa'],
  logoEachSlide: true, footer: true,
  // New
  speakerNotes: true,                 // Thêm notes cho từng slide
  animations: {                       // Build animations
    waterfall: 'fade', bcg: 'zoom', heatmap: 'wipe'
  },
  masterLayout: {
    header: { text: '{period} | {flow} | {classification}', color: 'muted', size: 8 },
    footer: { text: '{source} | Slide {slideNumber}/{totalSlides} | CONFIDENTIAL', color: 'muted', size: 7 }
  },
  colorBlindSafe: true,               // Viridis palette option
  aspectRatio: '16:9'                 // LAYOUT_WIDE
}
```

### 3.3 Acceptance Criteria Phase 2
- [ ] 15 slides render đúng, native charts (Waterfall, BCG Bubble, Radar, Heatmap)
- [ ] Speaker notes có cho TẤT CẢ slides (≥50 từ/slide)
- [ ] Master layout: Header (period/flow/classification), Footer (source/page/confidential)
- [ ] Animations build cho Waterfall, BCG, Heatmap
- [ ] Color-blind safe palette (test với Coblis simulator)
- [ ] File size < 5MB, mở PowerPoint < 3s

---

## 4. PHASE 3 — EXCEL INTERACTIVE WORKBOOK (TUẦN 3-4) — **P2**

### 4.1 Cấu Trúc 9 Sheets

| Sheet | Tên | Nội Dung Mới | Tính Năng Excel Native |
|-------|-----|--------------|------------------------|
| 1 | **Dashboard** | Executive summary + **Slicers** (Period, Flow, Region, Market) + **Timeline** | PivotTable + Slicers + Timeline + Sparklines + Data Bars + Icon Sets |
| 2 | **XK_Theo_Nuoc** | Giữ + **Conditional Formatting** (Top/Bottom 10%, Data Bars Value, Icon Sets YoY) | AutoFilter, Data Bars, Icon Sets, Top 10 Filter |
| 3 | **NK_Theo_Nuoc** | Giữ + cùng CF | AutoFilter, Data Bars, Icon Sets |
| 4 | **Pivot_Country_Period** | Ma trận Quốc gia × Kỳ (Month/Quarter/Year) có **drill-down** | **PivotTable thật** (không phải flat table) |
| 5 | **Price_Volume_FX** | Phân tích Price/Volume/FX Effect (waterfall data) có **giả định thay đổi được** | Formula-driven, Named Ranges, Scenario Manager ready |
| 6 | **Seasonality** | Heatmap 12 tháng × 5 năm + **Mùa vụ annotation** (icons) | Conditional Formatting Heatmap, Custom number format |
| 7 | **Charts** | **Native Excel Charts**: Combo (Price+Volume), Waterfall, Funnel (Market), Sunburst (Region) | Interactive, Drill-down, Filter-connected |
| 8 | **Data_Dictionary** | Mô tả từng cột: Tên, Kiểu, Đơn vị, Nguồn, Ví dụ, Validation rule | Documentation sheet, Hyperlink đến Dashboard |
| 9 | **_Meta** | Giữ + **Data Lineage** + **Quality Metrics** (Completeness, Freshness, Consistency) | Audit trail, Hyperlink đến Data_Dictionary |

### 4.2 Cải Tiến Kỹ Thuật Excel
```javascript
// Cập nhật EX_TEMPLATES.excel
excel: {
  sheets: ['dashboard', 'xk_theo_nuoc', 'nk_theo_nuoc', 'pivot_country_period',
           'price_volume_fx', 'seasonality', 'charts', 'data_dictionary', '_meta'],
  logoInBanner: true, printArea: true,
  // New
  pivotTables: true,                  // Sheet 1, 4 dùng PivotTable thật
  slicers: ['period', 'flow', 'region', 'market'],  // Dashboard slicers
  timeline: 'period',                 // Timeline filter cho Period
  conditionalFormatting: {
    dataBars: ['value_month_usd', 'value_ytd_usd'],
    iconSets: ['yoy_pct', 'mom_pct'],
    colorScale: ['quantity_month', 'value_month_usd'],
    topBottom: { top: 10, bottom: 10, column: 'value_month_usd' }
  },
  namedRanges: true,                  // Cho Price_Volume_FX formulas
  dataValidation: {                   // Dropdown cho Dashboard
    period: 'list', flow: 'list', region: 'list', market: 'list'
  },
  hyperlinks: {                       // Internal navigation
    'Dashboard!A1': 'Go to Dashboard',
    'Charts!A1': 'View Charts'
  },
  protection: { structure: true, windows: false },  // Lock structure, allow data edit
  printSettings: { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 }
}
```

### 4.3 Acceptance Criteria Phase 3
- [ ] Sheet 1 (Dashboard) có 4 Slicers + Timeline, PivotTable refresh tự động
- [ ] Sheet 2/3 có Data Bars, Icon Sets, Top 10 Filter hoạt động
- [ ] Sheet 4 là PivotTable thật (drill-down Quốc gia → Tháng)
- [ ] Sheet 5 có formulas Price/Volume/FX decomposition, có thể thay đổi input
- [ ] Sheet 6 Heatmap 12 tháng × 5 năm có Mùa vụ icons (conditional formatting icons)
- [ ] Sheet 7 có 4 native charts: Combo, Waterfall, Funnel, Sunburst
- [ ] Sheet 8 Data_Dictionary hoàn chỉnh 7 cột định nghĩa
- [ ] Sheet 9 _Meta có Data Lineage + Quality Metrics
- [ ] Hyperlinks nội bộ hoạt động, Print areas thiết lập đúng

---

## 5. PHASE 4 — CSV DUAL-OUTPUT (TUẦN 1) — **P2**

### 5.1 Hai File Output

| File | Suffix | Nội Dung | Use Case |
|------|--------|----------|----------|
| 1 | `_data.csv` | Raw rows (filter-aware, current flow) | ETL, BI, Python/R, ML pipeline |
| 2 | `_meta.csv` | Metadata: Column defs, Filters, Summary stats, Quality scores | Documentation, Audit, Data catalog |

### 5.2 Cấu Trúc `_meta.csv` (RFC 4180 + Comment Rows)
```csv
# METADATA SECTION
property,value
period,2025-09
flow,export
generated_at,2025-10-15T14:30:00Z
source,TCHQ
records_count,42
filters_applied,"year=2025|region=asia|search="
data_quality_score,0.95
completeness,0.98
freshness_days,2
hhi_index,0.18
schema_version,2

# COLUMN DEFINITIONS
column_name,data_type,unit,description,example,validation_rule
country,string,,Tên quốc gia (chuẩn TCHQ),"TRUNG QUỐC",not_null
product,string,,Mặt hàng,"Hạt điều",not_null
unit,string,,Đơn vị tính,"Tấn",in_list(Tấn,KG)
quantity_month,number,Tấn,Sản lượng tháng,45000,gte_0
value_month_usd,number,USD,Trị giá tháng,320000000,gte_0
quantity_ytd,number,Tấn,Lũy kế năm,420000,gte_0
value_ytd_usd,number,USD,Trị giá lũy kế,2800000000,gte_0

# SUMMARY STATISTICS
metric,value,unit,note
total_quantity_month,485000,Tấn,
total_value_month_usd,3450000000,USD,
top1_country,TRUNG QUỐC,,
top1_share_pct,35.2,%,Top 1 market share
hhi_index,0.18,,Herfindahl-Hirschman Index
yoy_value_pct,12.5,%,Year-over-Year value growth
yoy_quantity_pct,8.3,%,Year-over-Year volume growth
price_avg_usd_t,7113,USD/Tấn,Weighted average
price_mom_pct,-2.1,%,Month-over-Month price change
```

### 5.3 Acceptance Criteria Phase 4
- [ ] Xuất 2 file: `{period}_cashew_{flow}_data.csv` + `{period}_cashew_{flow}_meta.csv`
- [ ] `_meta.csv` có 3 sections: Metadata, Column Definitions, Summary Statistics
- [ ] UTF-8 with BOM, RFC 4180 compliant
- [ ] Schema version trong metadata (`schema_version: 2`)
- [ ] Có thể load ngược vào dashboard (round-trip test)

---

## 6. PHASE 5 — CROSS-FORMAT CONSISTENCY (TUẦN 3) — **P2**

### 6.1 HTML Report — Nâng Cấp Từ Template Hiện Có
- Thêm **Report Quality Badge** (Health Score từ Quality Gates)
- Thêm **Export Format Selector** dropdown: Standard / Executive / Analyst
- Thêm **Industry Context Section** (collapsible, từ `INDUSTRY_CONTEXT`)
- Thêm **Glossary Tooltip** (hover thuật ngữ → popup definition từ glossary)
- Giữ: Print→PDF, Slides mode (`?slides=1`), Self-contained

### 6.2 JSON Export — Schema Versioning & Round-trip
```json
{
  "schema_version": 2,
  "generated_at": "2025-10-15T14:30:00Z",
  "period": "2025-09",
  "flow": "export",
  "source": "TCHQ",
  "quality_report": { "passed": true, "warnings": [...], "hhi": 0.18 },
  "industry_context_ref": "INDUSTRY_CONTEXT.v1",
  "periods": { "2025-09": { ... } },
  "_export_meta": { ... }
}
```

### 6.3 UI Export Selector (index.html)
```html
<!-- Thêm vào tab Export -->
<div class="export-options">
  <label>Report Tier:</label>
  <select id="export-tier">
    <option value="standard">Standard (Data only)</option>
    <option value="executive" selected>Executive (Insights + Context)</option>
    <option value="analyst">Analyst (Deep dive + Methodology)</option>
  </select>
  <span id="quality-badge" class="badge">Quality: Checking...</span>
</div>
```

### 6.4 Acceptance Criteria Phase 5
- [ ] HTML report có Quality Badge real-time, Format Selector
- [ ] JSON `schema_version: 2`, có `quality_report`, `industry_context_ref`
- [ ] Round-trip: Export JSON → Drag-drop vào dashboard → Load đúng dữ liệu + context
- [ ] Tất cả 6 formats dùng chung `INDUSTRY_CONTEXT`, `QUALITY_CHECKS`, `EX_DESIGN_TOKENS`

---

## 7. RỦI RO & MITIGATION

| Rủi ro | Mức độ | Mitigation |
|--------|--------|------------|
| **Font VN load fail trên PDF** | High | Fallback Helvetica + stripAccents + toast warning; preload fonts ở init |
| **PPTX native chart không render đúng trên Mac/LibreOffice** | Medium | Test cross-platform; cung cấp PNG fallback trong `_Meta` sheet |
| **Excel PivotTable không hoạt động trên Excel Online/Google Sheets** | Medium | Giữ flat table song song; document limitation |
| **Dữ liệu quá lớn → PDF/PPTX render timeout** | Low | Chunk processing, progress toast, async generation |
| **Industry Context nhanh lỗi thời** | Low | Versioning (`INDUSTRY_CONTEXT.v1`), cập nhật quý/yearly |
| **Quality Gates chặn xuất nhầm** | Medium | Soft warnings không chặn; log chi tiết để debug |

---

## 8. CHECKLIST TRIỂN KHAI (DEVELOPER)

### Trước khi bắt đầu (Setup)
- [ ] Tạo branch `feature/export-intelligence-v2`
- [ ] Backup `web/app.js` hiện tại
- [ ] Cài dependencies: `npm install` (nếu có package.json) hoặc verify CDN links

### Phase 0 Checklist
- [ ] Thêm `INDUSTRY_CONTEXT` object
- [ ] Thêm `QUALITY_CHECKS` + `runQualityChecks()`
- [ ] Thêm `EX_DESIGN_TOKENS`
- [ ] Unit test quality checks
- [ ] Commit: `feat(export): Phase 0 - Foundation (knowledge base, quality gates, tokens)`

### Phase 1 Checklist (PDF)
- [ ] Cập nhật `EX_TEMPLATES.pdf.pages` = 7 trang mới
- [ ] Viết `renderExecDashboard()` → Waterfall chart native jsPDF
- [ ] Viết `renderIndustryContext()` → World map + Seasonality calendar + Benchmark
- [ ] Cập nhật `renderExecBrief()` → Thêm "So What?" section
- [ ] Viết `renderMarketDeep()` → Strategic Segmentation + Heatmap
- [ ] Viết `renderTradeFlow()` → Price/Volume/FX Waterfall
- [ ] Cập nhật `renderAppendix()` → Glossary + Methodology + Quality Report
- [ ] Test: PDF 7 trang, font VN, bookmarks, hyperlinks, <2MB, <3s
- [ ] Commit: `feat(export): Phase 1 - PDF Executive Report 7 pages`

### Phase 2 Checklist (PPTX)
- [ ] Cập nhật `EX_TEMPLATES.pptx.slides` = 15 slides
- [ ] Viết `addWaterfallChart()` native PptxGenJS
- [ ] Viết `addBCGMatrixChart()` (bubble chart 4 quadrants)
- [ ] Viết `addRiskRadarChart()` (radar chart 5 risks)
- [ ] Viết `addSeasonalityHeatmap()` (heatmap conditional formatting style)
- [ ] Thêm Speaker Notes cho 15 slides
- [ ] Thêm Master Layout header/footer
- [ ] Test: 15 slides, speaker notes, animations, color-blind safe
- [ ] Commit: `feat(export): Phase 2 - PPTX Narrative Deck 15 slides`

### Phase 3 Checklist (Excel)
- [ ] Cập nhật `EX_TEMPLATES.excel.sheets` = 9 sheets
- [ ] Sheet 1: Tạo PivotTable + 4 Slicers + Timeline + Sparklines
- [ ] Sheet 2/3: Conditional Formatting (Data Bars, Icon Sets, Color Scale)
- [ ] Sheet 4: PivotTable thật Country × Period (drill-down)
- [ ] Sheet 5: Named Ranges + Formulas Price/Volume/FX decomposition
- [ ] Sheet 6: Heatmap 12 tháng × 5 năm + Mùa vụ icons
- [ ] Sheet 7: 4 Native Charts (Combo, Waterfall, Funnel, Sunburst)
- [ ] Sheet 8: Data_Dictionary 7 cột
- [ ] Sheet 9: _Meta + Data Lineage + Quality Metrics
- [ ] Hyperlinks nội bộ, Print areas, Protection
- [ ] Commit: `feat(export): Phase 3 - Excel Interactive Workbook 9 sheets`

### Phase 4 Checklist (CSV)
- [ ] Refactor `exportCSV()` → xuất 2 file (_data + _meta)
- [ ] `_meta.csv` 3 sections: Metadata, Column Defs, Summary Stats
- [ ] Schema versioning (`schema_version: 2`)
- [ ] Round-trip test: CSV → Dashboard load
- [ ] Commit: `feat(export): Phase 4 - CSV Dual-Output with Meta`

### Phase 5 Checklist (Cross-Format)
- [ ] HTML: Quality Badge, Format Selector, Industry Context section, Glossary tooltips
- [ ] JSON: schema_version: 2, quality_report, industry_context_ref, round-trip test
- [ ] Verify: Tất cả formats dùng chung INDUSTRY_CONTEXT, QUALITY_CHECKS, DESIGN_TOKENS
- [ ] Commit: `feat(export): Phase 5 - Cross-Format Consistency & Polish`

---

## 9. TEST PLAN & VERIFICATION

### 9.1 Automated Tests (`ui_verify.py` mở rộng)
```python
# Mới thêm vào diagnostics/ui_verify.py
def test_pdf_structure():
    """Verify PDF có 7 trang, bookmarks, font VN, waterfall chart"""
    # download PDF → pdfplumber kiểm tra pages, text, images

def test_pptx_slides():
    """Verify 15 slides, speaker notes, native charts"""
    # python-pptx kiểm tra slides, notes, chart types

def test_excel_pivots():
    """Verify PivotTable, Slicers, Conditional Formatting"""
    # openpyxl kiểm tra pivotCache, slicerCache, cfRules

def test_csv_meta():
    """Verify dual output, meta sections, schema version"""
    # csv module parse, validate RFC 4180

def test_quality_gates():
    """Verify hard/soft gates trigger đúng"""
    # Mock payload với missing data, high HHI, low freshness

def test_round_trip():
    """Export JSON → Import → Verify data integrity"""
    # Drag-drop file JSON → state.periods khớp
```

### 9.2 Manual Acceptance Testing
| Test Case | Format | Expected Result |
|-----------|--------|-----------------|
| CEO reads Dashboard (30s) | PDF Trang 2 | Nắm: Health, Top Risk, Top Opp, Next Action |
| Analyst filters China 2025 | Excel Slicer | Price/Vol/FX breakdown + YoY + Rank |
| Presenter rehearses | PPTX Speaker Notes | 15 phút không cần prep thêm |
| Auditor checks lineage | CSV Meta + Excel _Meta | Source → Transform → Output traceable |
| Newcomer reads Appendix | PDF Trang 7 | Hiểu value chain, mùa vụ, drivers |

---

## 10. APPROVAL & SIGN-OFF

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Tech Lead | | | |
| Data Analyst Lead | | | |
| QA Lead | | | |

---

## 11. PHỤ LỤC: MAPPING HIỆN TẠI → TƯƠNG LAI

| Current Feature | Future Enhancement | Phase |
|-----------------|-------------------|-------|
| PDF 5 trang (Cover, KPI, Top10, Trend, Detail) | 7 trang (Dashboard, Industry Context, Trade Flow, Appendix) | 1 |
| PPTX 6 slides (Cover, KPI, Insights, Top10, Regions, Trend, Detail) | 15 slides (Agenda, Snapshot, Waterfall, BCG, Risk Radar, Action Plan) | 2 |
| Excel 5 sheets (Tong_Quan, XK, NK, Bieu_Do, _Meta) | 9 sheets (Dashboard+Slicers, Pivot, PriceVolFX, Seasonality, Charts, Dict, Lineage) | 3 |
| CSV 1 file (raw data) | 2 files (data + meta) + schema versioning | 4 |
| AI Insights: 4 blocks (Summary, Drivers, Price, Recs) | + So What?, Strategic Segmentation, Risk Radar, Action Plan | 1,2 |
| Quality: Không có | Hard/Soft Gates + Quality Report in Appendix | 0 |
| Design: Inline colors/fonts | DESIGN_TOKENS centralized | 0 |
| Industry Context: Không có | INDUSTRY_CONTEXT static knowledge base | 0 |

---

**KẾT THÚC MASTER PLAN**  
*Document này là bản thiết kế chi tiết. Cần duyệt từ Product Owner & Tech Lead trước khi bắt đầu code Phase 0.*