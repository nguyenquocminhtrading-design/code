# MASTER FIX PLAN — KHÔI PHỤC TOÀN BỘ APP.JS + NÂNG CẤP EXPORT

> **Mục tiêu**: Khôi phục toàn bộ dashboard visualization (đã mất do corrupted rewrite) + Nâng cấp 6 export formats theo Master Plan v2
> **Phương án**: Viết lại **TOÀN BỘ app.js hoàn chỉnh** (dashboard visualization + export mới) trong 1 file duy nhất, encoding UTF-8 chuẩn
> **Cách thức**: Chia thành các PHASE, từng phase một, **chỉ code khi bạn duyệt plan phase đó**

---

## 📋 **PHÂN TÍCH HIỆN TRẠNG (AS-IS)**

### ❌ **Vấn đề hiện tại**
| Vấn đề | Mức độ | Nguyên nhân |
|--------|--------|-------------|
| `Uncaught SyntaxError: missing ) after argument list` | **CRITICAL** | Encoding corruption → string literal bị gãy |
| `ReferenceError: handleFileSelect is not defined` | **CRITICAL** | Function declaration bị gãy → parser dừng toàn bộ file |
| **Mất toàn bộ dashboard visualization** | **CRITICAL** | Rewrite chỉ giữ export, bỏ visualization |
| Encoding UTF-8 corrupted | **HIGH** | PowerShell WriteAllBytes mất BOM/encoding |

### ✅ **Đã có sẵn (Foundation - Phase 0)**
- `INDUSTRY_CONTEXT` object (dòng ~3144)
- `QUALITY_CHECKS` + `runQualityChecks()` (dòng ~3221)
- `EX_DESIGN_TOKENS` (dòng ~3245)
- `EX_TEMPLATES` updated Master Plan v2 (dòng ~3310)
- Quality Gates tích hợp 6 export functions
- Bug fix: `vi = P.vi` trong exportPDF, `hhi` init trong runQualityChecks

---

## 🎯 **PLAN FIX TOÀN DIỆN (5 PHASES)**

---

## **PHASE 1: KHÔI PHỤC DASHBOARD VISUALIZATION (CƠ SỞ)**
**Ưu tiên: CRITICAL** | **Ước lượng: 4-6h** | **Kích thước: ~1500 dòng**

### 1.1 Core Utilities & Helpers
- `stripAccents`, `esc`, `fmt`, `fmtUSD`, `parseNum`, `debounce`, `showToast`, `showLoading/hideLoading`
- `downloadBlob`, `exFileName`, `exDeltaPct`, `exRowsForFlow`, `exTotalsForFlow`, `exFiltersStamp`
- `collectExportPayload()` (đã có, review lại)

### 1.2 State Management & Filter Logic
- `getFilteredPeriods()`, `periodDetailIsTrusted()`, `getFilteredRowsBase()`, `getFilteredRows()`
- `anyFilterActive()`, `refreshFilterDependent()`, `resetFilters()`
- `setTradeFlow()`, `setDataVersion()`, `setDataSource()`, `loadVinacasData()`
- `onYearSelectChange()`, `renderFilterBar()`, `toggleYearFilter()`, `setGranularity()`, `setRegionFilter()`

### 1.3 Language & UI Helpers
- `setLang()`, `updateTopbarTitle()`, `isoOf()`, `regionOf()`, `periodDetailIsTrusted()`
- `refreshFilterDependent()`, `resetFilters()`, `periodDetailIsTrusted()`

### 1.4 Tab Management & Rendering
- `switchTab()`, `renderTab()`, `resizeTabWidgets()`, `setupKeyboardNav()`
- `renderOverview()`, `renderCountries()`, `renderMap()`, `renderTrends()`, `renderCompare()`, `renderFileList()`

### 1.5 Chart Rendering (Chart.js)
- `renderOverview()`: KPI cards, Area chart, Donut chart, Bar chart, Progress bars, Periods table
- `renderCountries()`: Table với sort, filter, pagination, Radar chart, Bubble chart
- `renderMap()`: Leaflet world map, country click detail, trend chart
- `renderTrends()`: Line chart, YTD line, Stacked bar, YTD qty, Period breakdown table
- `renderCompare()`: Year comparison bar chart, Year table, Year×Quarter matrix
- Chart helpers: `buildRadarChart()`, `buildBubbleChart()`, `buildLineChart()`, `buildStackedChart()`, etc.

### 1.6 Map (Leaflet)
- `renderMap()`: World map, geoJSON, click country → detail panel + trend chart
- `resetMapView()`, `jumpToCountryTable()`

### 1.7 Data Loading & Parsing
- `loadJSONFile()`, `loadExcelFile()`, `loadAllYearsJSON()`, `loadAllYearsExcel()`
- `parseSheet()`, `parseVinacasSheet()`, `buildPeriodsFromCanonical()`, `classifyWorkbookLayout()`
- `activateLoadedData()`, `persistLocalData()`, `restoreLocalData()`

### 1.8 Drag & Drop / Upload
- `handleDragOver()`, `handleDragLeave()`, `handleDrop()`, `handleFileSelect()`, `loadDataFile()`

### 1.9 Utility Functions
- `periodTotals()`, `yearlyTotals()`, `aggregateSeries()`, `isCashewRow()`, `isCountryRow()`
- `exRowsForFlow()`, `exTotalsForFlow()`, `exFiltersStamp()`, `EX_LABELS()`, `EX_GRAN_LABEL()`
- `generateMarketNarrative()`, `EX_AI_BLOCKS()`, `exLLMSystemPrompt()`, `exLLMUserPrompt()`
- `fetchLLMInsights()`, `exCaptureChart()`, `exCardBusy()`, `exToastOk()`, `exLogoDataUrl()`, `exLogoSync()`

### 1.10 Init & Event Listeners
- `DOMContentLoaded`: `setLang('vi')`, `setupKeyboardNav()`, nav click handlers
- Filter bar events, period slicer nav, region filter, country search
- Auto-load data: `loadAllYearsExcel()` → fallback `loadAllYearsJSON()`
- `exLogoDataUrl()` preload

---

## **PHASE 2: PDF EXPORT - 7 TRANG (MASTER PLAN v2)**
**Ưu tiên: P1** | **Ước lượng: 3-4h** | **Kích thước: ~600 dòng**
> **ĐÃ HOÀN THÀNH** (file `new_exportPDF.js` đã tạo) - Cần integrate vào app.js

**Cấu trúc 7 trang:**
1. **Cover** - Industry Position Badge (#1 thế giới)
2. **Exec Dashboard** - Health Score Gauge, Waterfall Chart, 5 KPI Cards, 3 Key Insights
3. **Industry Context** - Vị thế VN, Mùa vụ Calendar, Value Chain, Benchmark 3 nước
4. **Exec Briefing (AI)** - 4 KPI + AI 4 blocks + **"So What?"** Business Impact
5. **Market Deep Dive** - Strategic Segmentation (Core/Growth/Risk/Watch) + Heatmap Country×Period
6. **Trade Flow** - Price/Volume/FX Waterfall + Margin Analysis Table
6. **Appendix** - Glossary, Methodology, Quality Report, Version History

**Technical:** Native Waterfall Chart, Health Score Gauge, Font VN BeVietnamPro, Bookmarks, Hyperlinks

---

## **PHASE 3: PPTX EXPORT - 15 SLIDES (MASTER PLAN v2)**
**Ưu tiên: P1** | **Ước lượng: 4-5h** | **Kích thước: ~800 dòng**
> **ĐÃ TẠO FILE RIÊNG** `new_exportPPTX.js` - Cần integrate

**15 Slides:**
1. Cover (Classification badge)
2. Agenda (Timeline 12 sections)
3. Industry Snapshot (Metrics + Competitor table + Seasonality)
4. Executive Summary (3 Takeaways)
5. Performance Waterfall (Price/Volume/FX native chart)
6. BCG Matrix (Core/Growth/Risk/Watch bubble chart)
7. Top 10 Deep (Bar chart + YoY% + Share%)
8. Regional Diversification (HHI Gauge + Doughnut)
9. Seasonality Heatmap (12 tháng × 5 năm table + Mùa vụ icons)
10. Price-Volume Scatter (Bubble scatter)
11. Risk Radar (Radar chart + Risk table)
12. Strategic Recommendations (3 Pillars)
13. Action Plan & KPIs (Gantt-style table)
14. Methodology & Limitations
15. Q&A / Contact

**Features:** Speaker Notes, Animations, Master Layout, Color-blind safe palette

---

## **PHASE 4: EXCEL EXPORT - 9 SHEETS (MASTER PLAN v2)**
**Ưu tiên: P2** | **Ước lượng: 3-4h** | **Kích thước: ~500 dòng**

**9 Sheets:**
1. **Dashboard** - PivotTable + 4 Slicers (Period, Flow, Region, Market) + Timeline + Sparklines
2. **XK_Theo_Nuoc** - Flat table + Conditional Formatting (Data Bars, Icon Sets, Color Scale, Top/Bottom 10)
3. **NK_Theo_Nuoc** - Tương tự XK
3. **Pivot_Country_Period** - PivotTable thật Country × Period (drill-down)
4. **Price_Volume_FX** - Named Ranges + Formulas Price/Volume/FX decomposition
5. **Seasonality** - Heatmap 12 tháng × 5 năm + Mùa vụ icons (Conditional Formatting)
5. **Charts** - Native Excel Charts: Combo, Waterfall, Funnel, Sunburst
6. **Data_Dictionary** - 7 cột: column_name, data_type, unit, description, example, validation_rule
6. **_Meta** - Data Lineage + Quality Metrics (Completeness, Freshness, Consistency)

**Features:** Hyperlinks nội bộ, Print Areas, Protection, Data Validation dropdowns

---

## **PHASE 5: CSV DUAL-OUTPUT + JSON v2**
**Ưu tiên: P2** | **Ước lượng: 1-2h** | **Kích thước: ~150 dòng**

### 5.1 CSV Dual-Output
- Output 1: `{period}_cashew_{flow}_data.csv` (raw data)
- Output 2: `{period}_cashew_{flow}_meta.csv` (metadata: column defs, filters, quality scores, schema_version: 2)
- RFC 4180 compliant, UTF-8 BOM, Comment rows cho metadata sections

### 5.2 JSON Schema v2
```json
{
  "schema_version": 2,
  "quality_report": { "passed": true, "warnings": [], "hhi": 0.18 },
  "industry_context_ref": "INDUSTRY_CONTEXT.v1",
  "periods": { ... }
}
```
- Round-trip test: Export JSON → Drag-drop vào dashboard → Load đúng

---

## **PHASE 6: CROSS-FORMAT CONSISTENCY & UI**
**Ưu tiên: P2** | **Ước lượng: 2-3h** | **Kích thước: ~200 dòng**

### 6.1 HTML Report Enhancements
- Quality Badge real-time (từ `runQualityChecks()`)
- Format Selector dropdown: Standard / Executive / Analyst
- Industry Context Section (collapsible)
- Glossary Tooltips (hover术语 → popup definition)
- AI Insights full 4 blocks + "So What?" + Refresh button fixed

### 6.2 JSON Schema v2 + Round-trip
- `schema_version: 2`, `quality_report`, `industry_context_ref`
- Round-trip test: Export JSON → Drag-drop → Load đúng data + context

### 6.3 UI Export Selector (index.html)
- Report Tier Selector: Standard / Executive / Analyst
- Quality Badge real-time indicator

### 6.4 Cross-Format Verification
- Tất cả 6 formats dùng chung: `INDUSTRY_CONTEXT`, `QUALITY_CHECKS`, `EX_DESIGN_TOKENS`
- `collectExportPayload()` single source of truth

---

## **PHASE 7: TESTING & VERIFICATION**
**Ưu tiên: P1** | **Ước lượng: 2h**

### 7.1 Automated Tests (`ui_verify.py` mở rộng)
- PDF: 7 pages, bookmarks, font VN, waterfall chart
- PPTX: 15 slides, speaker notes, native charts
- Excel: PivotTable, Slicers, Conditional Formatting
- CSV: Dual output, meta sections, schema v2
- Quality Gates: Hard/Soft gates trigger correctly
- Round-trip: Export JSON → Import → Verify

### 7.2 Manual Acceptance Tests
| Persona | Test | Expected |
|---------|------|----------|
| CEO | Read PDF Dashboard (30s) | Health, Top Risk, Top Opp, Next Action |
| Analyst | Filter China 2025 in Excel | Price/Vol/FX breakdown + YoY + Rank |
| Presenter | Rehearse PPTX | 15p no prep needed (speaker notes) |
| Auditor | Check CSV Meta + Excel _Meta | Source→Transform→Output traceable |
| Newcomer | Read PDF Appendix | Hiểu value chain, mùa vụ, drivers |

---

## 📦 **TỔNG KẾT KÍCH THƯỚC**

| Phase | Dòng code | Thời gian | Priority |
|-------|-----------|-----------|----------|
| **Phase 1: Dashboard Visualization** | ~1500 | 4-6h | CRITICAL |
| **Phase 2: PDF (7 pages)** | ~600 | 3-4h | P1 |
| **Phase 3: PPTX (15 slides)** | ~800 | 4-5h | P1 |
| **Phase 4: Excel (9 sheets)** | ~500 | 3-4h | P2 |
| **Phase 5: CSV + JSON** | ~150 | 1-2h | P2 |
| **Phase 6: Cross-Format + UI** | ~200 | 2-3h | P2 |
| **Phase 7: Testing** | ~100 | 2h | P1 |
| **TỔNG** | **~4500** | **20-25h** | |

---

## 🚀 **CÁCH THỨC TRIỂN KHAI**

### Quy tắc:
1. **Mỗi phase = 1 lần duyệt plan** → bạn duyệt → tôi code phase đó
2. **Code trực tiếp vào `web/app.js`** (single file, UTF-8 clean)
3. **Sau mỗi phase** → test manual + bạn verify → duyệt phase tiếp
3. **Không dùng PowerShell replace** - viết trực tiếp append/insert vào file

### Thứ tự ưu tiên:
```
Phase 1 (CRITICAL) → Phase 2 (P1) → Phase 3 (P1) → Phase 7 (P1)
                                    → Phase 4 (P2) → Phase 5 (P2) → Phase 6 (P2)
```

---

## ✅ **CHUẨN BỊ TRƯỚC KHI BẮT ĐẦU**

- [ ] Backup `web/app.js` hiện tại (corrupted)
- [ ] Backup `web/index.html` (nếu cần sửa UI)
- [ ] Chuẩn bị test files: `test_cashew_data.json`, `test_cashew_legacy.json`, `test_cashew_vinacas.json`
- [ ] Chạy server: `python serve_dashboard.py` (port 8000)

---

## ❓ **CẦN BẠN DUYỆT**

> **Reply: "APPROVE PHASE 1"** để tôi bắt đầu khôi phục Dashboard Visualization (Phase 1).
> 
> Hoặc cho tôi biết nếu muốn điều chỉnh scope/thứ tự phases.

---

*Plan version: 1.0 | Created: 2025-01-15 | Total estimated: 20-25h*