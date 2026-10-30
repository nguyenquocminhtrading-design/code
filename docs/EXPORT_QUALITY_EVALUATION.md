# ĐÁNH GIÁ CHẤT LƯỢNG XUẤT FILE — HTML / PDF / EXCEL / PPTX / CSV / JSON

> **Ngày đánh giá**: 2025-01-15  
> **Phạm vi**: Toàn bộ 6 định dạng xuất từ `web/app.js`  
> **Mục tiêu**: Xác định các vấn đề về chữ, layout, collapse, trực quan — lên plan fix chi tiết

---

## 1. TỔNG QUAN HIỆN TRẠNG

| Format | File mẫu | Trạng thái | Vấn đề chính |
|--------|----------|------------|--------------|
| **HTML** | `buildReportHTML()` | Đã có, tự chứa | Font nhỏ, collapse sections, thiếu industry context, AI insights bị cắt, thiếu glossary tooltip |
| **PDF** | `exportPDF()` | 6 trang, font VN OK | Thiếu Exec Dashboard 1 trang, thiếu Industry Context, Waterfall chart, Strategic Segmentation, Glossary |
| **PPTX** | `exportPPTX()` | 7 slides, native charts | Thiếu Speaker Notes, thiếu Waterfall/BCG/Risk Radar, narrative flow yếu |
| **Excel** | `exportExcel()` | 5 sheets, styled | Thiếu PivotTable, Slicers, Conditional Formatting, Native Charts, Data Dictionary |
| **CSV** | `exportCSV()` | 1 file raw data | Thiếu metadata file, column definitions, quality scores, schema versioning |
| **JSON** | `exportJSON()` | Schema v1 | Thiếu quality_report, industry_context_ref, schema v2, round-trip test |

---

## 2. CHI TIẾT VẤN ĐỀ THEO TỪNG FORMAT

### 2.1 HTML REPORT (`buildReportHTML()`)

#### ❌ **Vấn đề về Typography & Readability**
| Vấn đề | Chi tiết | Mức độ |
|--------|----------|--------|
| **Font size quá nhỏ** | Base 14px, KPI label 10.5px, table 12.5px — khó đọc khi in A4 | 🔴 High |
| **Line-height thấp** | 1.55 cho body, table padding 8px — chữ dính vào nhau | 🟡 Medium |
| **Contrast thấp** | Muted color `#8A7B5E` trên background `#F6F7F5` — ratio ~3.5:1 (fail WCAG AA) | 🟡 Medium |
| **Font-family fallback** | Chỉ dùng system fonts, không có Be Vietnam Pro — tiếng Việt mất dấu khi print | 🔴 High |

#### ❌ **Layout Collapse & Spacing**
| Vấn đề | Chi tiết | Mức độ |
|--------|----------|--------|
| **Sections dính nhau** | `.rep-sec` margin-bottom 18px, không có visual separator rõ ràng | 🟡 Medium |
| **KPI cards collapse** | Grid 4 cột fixed, trên mobile/tablet bị vỡ layout | 🔴 High |
| **Chart images full-width** | `width:100%` không giới hạn max-width — chart méo trên màn hình rộng | 🟡 Medium |
| **Table overflow** | Không có `overflow-x:auto` — bảng chui ra ngoài viewport mobile | 🔴 High |
| **Filter chips wrap不好** | `.fb-chip` inline-block, không có flex-wrap container | 🟡 Medium |

#### ❌ **Thiếu nội dung then chốt (Content Gaps)**
| Thiếu | Tác động |
|-------|----------|
| **Industry Context section** | Người đọc không hiểu vị thế VN, mùa vụ, value chain |
| **Executive Dashboard 1 trang** | Không có Health Score, Waterfall chart, 3 Key Insights |
| **Strategic Segmentation** | Top 10 chỉ ranking, thiếu Core/Growth/Risk/Watch classification |
| **Glossary Tooltip** | Thuật ngữ CY, YTD, HHI, RCN... không có hover definition |
| **Waterfall Decomposition** | Không phân tích Price/Volume/FX Effect |
| **Quality Badge** | Không hiển thị Quality Gates pass/warn status |

#### ❌ **AI Insights Issues**
| Vấn đề | Chi tiết |
|--------|----------|
| **AI insights bị cắt** | Chỉ render 3 blocks đầu, `recommendations` bị bỏ qua |
| **Không có "So What?"** | Thiếu business impact assessment |
| **Refresh button broken** | Hardcoded Chinese labels, endpoint localhost:3000 không configurable |
| **Baseline data wrong** | `totalsXk` calculation sai logic (reduce nested loops) |

---

### 2.2 PDF EXPORT (`exportPDF()`)

#### ❌ **Cấu trúc 6 trang hiện tại vs 7 trang yêu cầu**
| Trang hiện tại | Trang yêu cầu (Master Plan) | Gap |
|----------------|----------------------------|-----|
| 1. Cover | 1. Cover + Industry Badge | ➕ Badge |
| 2. Exec Briefing (AI) | 2. **Exec Dashboard** (Health Score + Waterfall + 3 Insights) | 🔴 **Thiếu hoàn toàn** |
| 3. KPI + YoY | 3. Industry Context (Vị thế VN, Mùa vụ, Benchmark) | 🔴 **Thiếu hoàn toàn** |
| 4. Top 10 | 4. Exec Briefing (AI) + **So What?** | ➕ So What? |
| 5. Trend | 5. Market Deep Dive (Strategic Segmentation + Heatmap) | 🔴 **Thiếu hoàn toàn** |
| 6. Detail | 6. Trade Flow (Price/Vol/FX Waterfall) | 🔴 **Thiếu hoàn toàn** |
| — | 7. Appendix (Glossary, Methodology, Quality Report) | 🔴 **Thiếu hoàn toàn** |

#### ❌ **Visual Issues**
- Waterfall chart: **Không có** (chỉ có bar/line chart)
- Heatmap Country×Month: **Không có**
- Glossary: **Không có**
- Bookmarks/Outline: Chưa test
- Font subsetting: Chưa implement (file size lớn)

---

### 2.3 PPTX EXPORT (`exportPPTX()`)

#### ❌ **Slide Structure (7 vs 15 slides)**
| Slide hiện tại | Slide yêu cầu | Gap |
|----------------|---------------|-----|
| 1. Cover | 1. Cover + Classification | ➕ Classification |
| 2. KPI Cards | 2. Agenda | 🔴 Thiếu |
| 3. Insights (3 bullets) | 3. Industry Snapshot | 🔴 Thiếu |
| 4. Top 10 Bar | 4. Exec Summary (3 Takeaways) | 🔴 Thiếu |
| 5. Regions Donut | 5. **Waterfall Chart** | 🔴 **Thiếu** |
| 6. Trend Line | 6. **BCG Matrix** | 🔴 **Thiếu** |
| 7. Detail Tables | 7. Top 10 Deep (YoY% + Maturity) | ➕ YoY% |
| — | 8. Regional Div (HHI Gauge) | 🔴 Thiếu |
| — | 9. Seasonality Heatmap | 🔴 **Thiếu** |
| — | 10. Price-Volume Scatter | 🔴 **Thiếu** |
| — | 11. Risk Radar | 🔴 **Thiếu** |
| — | 12. Strategic Recs (3 Pillars) | 🔴 Thiếu |
| — | 13. Action Plan + KPIs | 🔴 **Thiếu** |
| — | 14. Methodology | 🔴 Thiếu |
| — | 15. Q&A/Contact | 🔴 Thiếu |

#### ❌ **Missing Features**
- **Speaker Notes**: Hoàn toàn thiếu
- **Animations**: Không có build animations
- **Master Layout**: Header/Footer chưa có period/flow/classification
- **Color-blind safe palette**: Chưa verify

---

### 2.4 EXCEL EXPORT (`exportExcel()`)

#### ❌ **Sheet Structure (5 vs 9 sheets)**
| Sheet hiện tại | Sheet yêu cầu | Gap |
|----------------|---------------|-----|
| Tong_Quan | 1. **Dashboard** (PivotTable + Slicers + Sparklines) | 🔴 **Thiếu PivotTable/Slicers** |
| XK_Theo_Nuoc | 2. XK_Theo_Nuoc (+ CF) | ➕ Conditional Formatting |
| NK_Theo_Nuoc | 3. NK_Theo_Nuoc (+ CF) | ➕ Conditional Formatting |
| Bieu_Do (ảnh PNG) | 4. **Pivot_Country_Period** (PivotTable thật) | 🔴 **Thiếu PivotTable** |
| _Meta | 5. **Price_Volume_FX** (Waterfall formulas) | 🔴 **Thiếu** |
| — | 6. **Seasonality** (Heatmap 12×5 + Mùa vụ) | 🔴 **Thiếu** |
| — | 7. **Charts** (Native: Combo, Waterfall, Funnel, Sunburst) | 🔴 **Thiếu native charts** |
| — | 8. **Data_Dictionary** (7 cột definition) | 🔴 **Thiếu** |
| — | 9. _Meta + Data Lineage + Quality Metrics | ➕ Lineage, Quality |

#### ❌ **Missing Excel Native Features**
- **PivotTable thật**: Chỉ có flat table
- **Slicers/Timeline**: Hoàn toàn thiếu
- **Conditional Formatting**: Data Bars, Icon Sets, Color Scale, Top/Bottom 10
- **Native Charts**: Chỉ embed PNG, không có chart Excel native
- **Data Validation**: Dropdown cho Period/Flow/Region
- **Named Ranges**: Cho Price/Vol/FX formulas
- **Hyperlinks nội bộ**: Navigate giữa sheets

---

### 2.5 CSV EXPORT (`exportCSV()`)

#### ❌ **Single File vs Dual Output**
| Hiện tại | Yêu cầu | Gap |
|----------|---------|-----|
| 1 file `_data.csv` | 2 files: `_data.csv` + `_meta.csv` | 🔴 **Thiếu meta file** |
| Raw data only | Metadata: column defs, filters, quality scores | 🔴 **Thiếu metadata** |
| No schema version | Schema versioning (`schema_version: 2`) | 🔴 **Thiếu versioning** |
| RFC 4180 basic | Comment rows cho metadata sections | 🔴 **Thiếu comment sections** |

#### ❌ **Meta.csv Structure Missing**
```csv
# METADATA SECTION (missing)
property,value
period,2025-09
flow,export
data_quality_score,0.95
hhi_index,0.18
schema_version,2

# COLUMN DEFINITIONS (missing)
column_name,data_type,unit,description,example,validation_rule

# SUMMARY STATISTICS (missing)
metric,value,unit,note
```

---

### 2.6 JSON EXPORT (`exportJSON()`)

#### ❌ **Schema v1 vs v2**
| Hiện tại (v1) | Yêu cầu (v2) | Gap |
|---------------|--------------|-----|
| Basic schema | `schema_version: 2` | 🔴 Thiếu version |
| No quality report | `quality_report: {passed, warnings[], hhi}` | 🔴 **Thiếu** |
| No industry context ref | `industry_context_ref: "INDUSTRY_CONTEXT.v1"` | 🔴 **Thiếu** |
| No round-trip test | Round-trip validation | 🔴 **Thiếu test** |

---

## 3. ROOT CAUSE ANALYSIS

### 3.1 **Thiết kế chưa có "Unified Intelligence Layer"**
- Mỗi format tự render riêng → duplicate logic, inconsistent data
- Chưa có `INDUSTRY_CONTEXT` shared layer
- Chưa có `QUALITY_CHECKS` gate

### 3.2 **Templates hardcoded, không modular**
- HTML: CSS inline 1000+ lines, không tách component
- PDF: Render logic lẫn data logic
- PPTX: Slide logic hardcoded, không reusable
- Excel: Không dùng ExcelJS advanced features (PivotTable, CF, Native Charts)

### 3.3 **Chưa có Design System tập trung**
- Colors, fonts, spacing scattered
- Chart palette không thống nhất
- Responsive breakpoints ad-hoc

### 3.4 **Chưa có Quality Gates**
- Export chạy mà không validate data quality
- Không có warning cho HHI cao, Top 1 share cao, data stale

---

## 4. PLAN FIX CHI TIẾT (THEO MASTER PLAN v2)

### PHASE 0 — FOUNDATION (✅ ĐÃ XONG)
- [x] `INDUSTRY_CONTEXT` object
- [x] `QUALITY_CHECKS` + `runQualityChecks()`
- [x] `EX_DESIGN_TOKENS`
- [x] `EX_TEMPLATES` updated to Master Plan v2 structure
- [x] Quality Gates integrated into 6 exports
- [x] Bug fixes: `vi is not defined`, `hhi is not defined`

---

### PHASE 1 — PDF EXECUTIVE REPORT (7 TRANG) — **P1**
**Timeline**: Tuần 1-2 | **Effort**: M | **Priority**: P1

#### 1.1 Cập nhật `EX_TEMPLATES.pdf.pages`
```javascript
pdf: {
  pages: ['cover', 'exec_dashboard', 'industry_context', 'exec_brief', 
          'market_deep', 'trade_flow', 'appendix'],
  bookmarks: true, hyperlinks: true, fontSubset: true
}
```

#### 1.2 Implement 6 hàm render mới
| Hàm | Trang | Nội dung chính | Dependencies |
|-----|-------|----------------|--------------|
| `renderExecDashboard()` | 2 | Health Score (gauge), Waterfall chart (native jsPDF), 5 KPI cards, 3 Insight bullets | `EX_DESIGN_TOKENS`, `INDUSTRY_CONTEXT` |
| `renderIndustryContext()` | 3 | Vị thế VN (#1 thế giới), Mùa vụ calendar (icons), Value chain, Benchmark 3 nước (radar chart) | `INDUSTRY_CONTEXT.vietnam_position`, `INDUSTRY_CONTEXT.value_chain` |
| `renderExecBrief()` | 4 | AI 4 blocks + **"So What?"** section (business impact) | `P.aiAnalysis`, `INDUSTRY_CONTEXT.market_drivers` |
| `renderMarketDeep()` | 5 | Strategic Segmentation (Core/Growth/Risk/Watch), Heatmap Country×Month | `P.top10`, `P.regions`, `P.series` |
| `renderTradeFlow()` | 6 | Price/Volume/FX Waterfall, Avg Price trend, Margin analysis | `P.totalsXk`, `P.totalsNk`, `P.series` |
| `renderAppendix()` | 7 | Glossary (từ `INDUSTRY_CONTEXT.glossary`), Methodology, Quality Report, Version History | `INDUSTRY_CONTEXT.glossary`, `QUALITY_CHECKS` |

#### 1.3 Technical Improvements
- **Waterfall chart native**: Vẽ bằng jsPDF `rect` + `text` (không dùng ảnh)
- **Font subsetting**: Chỉ embed glyphs used (giảm 60% file size)
- **Bookmarks/Outline**: `doc.addPage()` + `doc.addOutline()`
- **Hyperlinks internal**: Click "Top 10" → jump page 5
- **Digital signature placeholder**: For future use

#### Acceptance Criteria Phase 1
- [ ] PDF 7 trang render đúng, font VN OK, không tràn trang
- [ ] Trang 2 có Waterfall chart native (không phải ảnh)
- [ ] Trang 3 có Industry Context: Vị thế VN, Mùa vụ calendar, Benchmark
- [ ] Trang 5 có Strategic Segmentation + Heatmap
- [ ] Trang 6 có Price/Volume/FX Waterfall
- [ ] Trang 7 có Glossary + Quality Report
- [ ] Bookmarks/Outline hoạt động, click nhảy trang đúng
- [ ] File size < 2MB, render < 3s

---

### PHASE 2 — PPTX NARRATIVE DECK (15 SLIDES) — **P1**
**Timeline**: Tuần 2-3 | **Effort**: M | **Priority**: P1

#### 2.1 Cập nhật `EX_TEMPLATES.pptx.slides` (15 slides)
```javascript
slides: ['cover', 'agenda', 'industry_snapshot', 'exec_summary', 'waterfall', 
         'bcg_matrix', 'top10_deep', 'regional_div', 'seasonality', 
         'price_volume', 'risk_radar', 'strategic_recs', 'action_plan', 
         'methodology', 'qa'],
speakerNotes: true,
animations: { waterfall: 'fade', bcg: 'zoom', heatmap: 'wipe' }
```

#### 2.2 Implement 8 slides mới + Speaker Notes
| Slide | Nội dung mới | Chart Type | Speaker Notes |
|-------|--------------|------------|---------------|
| 2. Agenda | Timeline 5 sections | — | "Chúng ta sẽ đi qua 5 phần trong 15 phút" |
| 3. Industry Snapshot | World map + Sparkline 5yr | Map + Sparkline | "Việt Nam giữ #1 thế giới 17 năm liên tiếp..." |
| 5. Waterfall | Price/Vol/FX decomposition | **Native Waterfall** | "Phân tích: Giá +6%, Lượng +4%, FX +1% = Tổng +11%" |
| 6. BCG Matrix | Core/Growth/Risk/Watch | **Bubble Chart 4 quadrants** | "Trung Quốc là Star, Mỹ Cash Cow, UAE Question Mark" |
| 8. Regional Div | HHI Gauge | **Gauge Chart** | "HHI 0.18 = đa dạng tốt, nhưng Top 3 = 65%" |
| 9. Seasonality | Heatmap 12×5 + Mùa vụ icons | **Heatmap** | "Tháng 2-4 thu hoạch, 5-7 chế biến, 8-10 xuất khẩu đỉnh" |
| 11. Risk Radar | 5 rủi ro: Giá RCN, FX, Logistics, Policy, Climate | **Radar Chart** | "Rủi ro cao nhất: Giá RCN (West Africa crop)" |
| 13. Action Plan | Gantt-style table: Action, Owner, Timeline, KPI | Table | "Q4: Mở UAE, Chốt forward, Audit EUDR compliance" |

#### 2.3 Technical
- **Speaker Notes**: `slide.addNotes()` cho 15 slides
- **Master Layout**: Header `{period} | {flow} | {classification}`, Footer `{source} | Slide {n}/15 | CONFIDENTIAL`
- **Animations**: Build cho Waterfall, BCG, Heatmap
- **Color-blind safe**: Viridis palette option

#### Acceptance Criteria Phase 2
- [ ] 15 slides render đúng, native charts (Waterfall, BCG, Radar, Heatmap, Gauge)
- [ ] Speaker notes có cho 15 slides (≥50 từ/slide)
- [ ] Master layout: Header (period/flow/classification), Footer (source/page/confidential)
- [ ] Animations build cho Waterfall, BCG, Heatmap
- [ ] Color-blind safe palette (test Coblis)
- [ ] File size < 5MB, mở PowerPoint < 3s

---

### PHASE 3 — EXCEL INTERACTIVE WORKBOOK (9 SHEETS) — **P2**
**Timeline**: Tuần 3-4 | **Effort**: L | **Priority**: P2

#### 3.1 Cập nhật `EX_TEMPLATES.excel.sheets` (9 sheets)
```javascript
sheets: ['dashboard', 'xk_theo_nuoc', 'nk_theo_nuoc', 'pivot_country_period',
         'price_volume_fx', 'seasonality', 'charts', 'data_dictionary', '_meta'],
pivotTables: true,
slicers: ['period', 'flow', 'region', 'market'],
timeline: 'period',
conditionalFormatting: {
  dataBars: ['value_month_usd', 'value_ytd_usd'],
  iconSets: ['yoy_pct', 'mom_pct'],
  colorScale: ['quantity_month', 'value_month_usd'],
  topBottom: { top: 10, bottom: 10, column: 'value_month_usd' }
}
```

#### 3.2 Sheet Details
| Sheet | Key Implementation |
|-------|-------------------|
| 1. Dashboard | PivotTable + 4 Slicers (Period, Flow, Region, Market) + Timeline + Sparklines + Data Bars |
| 2. XK_Theo_Nuoc | Flat table + CF: Data Bars (Value), Icon Sets (YoY%), Color Scale, Top 10 Filter |
| 3. NK_Theo_Nuoc | Same as XK |
| 4. Pivot_Country_Period | **PivotTable thật** (Rows: Country, Cols: Period, Values: Qty/Val) + Drill-down |
| 5. Price_Volume_FX | Named Ranges + Formulas: Price Effect = (Price_curr - Price_prev) × Vol_prev, etc. |
| 6. Seasonality | Heatmap 12 tháng × 5 năm (Conditional Formatting Color Scale) + Mùa vụ icons (Custom format) |
| 7. Charts | **Native Excel Charts**: Combo (Price+Vol), Waterfall, Funnel (Market), Sunburst (Region) |
| 8. Data_Dictionary | 7 cột: column_name, data_type, unit, description, example, validation_rule |
| 9. _Meta | Data Lineage (Source → Transform → Output) + Quality Metrics (Completeness, Freshness, Consistency) |

#### 3.3 Technical
- **Hyperlinks nội bộ**: Sheet Dashboard A1 → "Go to Dashboard"
- **Print Areas**: Mỗi sheet fit to 1 page wide
- **Protection**: Structure locked, data editable
- **Data Validation**: Dropdown lists cho Slicers

#### Acceptance Criteria Phase 3
- [ ] Sheet 1: PivotTable + 4 Slicers + Timeline + Sparklines hoạt động
- [ ] Sheet 2/3: Data Bars, Icon Sets, Top 10 Filter hoạt động
- [ ] Sheet 4: PivotTable thật drill-down Country → Period
- [ ] Sheet 5: Formulas Price/Vol/FX decomposition, thay đổi input được
- [ ] Sheet 6: Heatmap 12×5 + Mùa vụ icons (conditional formatting)
- [ ] Sheet 7: 4 native charts (Combo, Waterfall, Funnel, Sunburst)
- [ ] Sheet 8: Data_Dictionary 7 cột đầy đủ
- [ ] Sheet 9: Data Lineage + Quality Metrics
- [ ] Hyperlinks, Print areas, Protection đúng

---

### PHASE 4 — CSV DUAL-OUTPUT — **P2**
**Timeline**: Tuần 1 | **Effort**: S | **Priority**: P2

#### 4.1 Refactor `exportCSV()` → Dual Output
```javascript
// Output 1: {period}_cashew_{flow}_data.csv (raw data)
// Output 2: {period}_cashew_{flow}_meta.csv (metadata)
```

#### 4.2 Meta.csv Structure (RFC 4180 + Comment Rows)
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
```

#### 4.3 Acceptance Criteria
- [ ] Xuất 2 file: `_data.csv` + `_meta.csv`
- [ ] `_meta.csv` có 3 sections: Metadata, Column Defs, Summary Stats
- [ ] UTF-8 with BOM, RFC 4180 compliant
- [ ] Schema version trong metadata (`schema_version: 2`)
- [ ] Round-trip: CSV → Dashboard load đúng

---

### PHASE 5 — CROSS-FORMAT CONSISTENCY — **P2**
**Timeline**: Tuần 3 | **Effort**: M | **Priority**: P2

#### 5.1 HTML Report Enhancements
- **Quality Badge**: Real-time indicator từ `runQualityChecks()` (Pass/Warning/Fail)
- **Format Selector**: Dropdown Standard / Executive / Analyst
- **Industry Context Section**: Collapsible, từ `INDUSTRY_CONTEXT`
- **Glossary Tooltips**: Hover thuật ngữ → popup definition (từ `INDUSTRY_CONTEXT.glossary`)
- **AI Insights**: Full 4 blocks + "So What?" + Refresh button fixed

#### 5.2 JSON Schema v2
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

#### 5.3 UI Export Selector (index.html)
```html
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

#### 5.4 Acceptance Criteria
- [ ] HTML report có Quality Badge real-time, Format Selector
- [ ] JSON `schema_version: 2`, có `quality_report`, `industry_context_ref`
- [ ] Round-trip: Export JSON → Drag-drop vào dashboard → Load đúng data + context
- [ ] Tất cả 6 formats dùng chung `INDUSTRY_CONTEXT`, `QUALITY_CHECKS`, `EX_DESIGN_TOKENS`

---

## 5. RISK MATRIX & MITIGATION

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Font VN load fail on PDF | High | High | Fallback Helvetica + stripAccents + toast; preload fonts at init |
| PPTX native chart fail on Mac/LibreOffice | Medium | Medium | Test cross-platform; provide PNG fallback in _Meta |
| Excel PivotTable fail on Excel Online | Medium | Medium | Keep flat table parallel; document limitation |
| Data too large → render timeout | Low | Medium | Chunk processing, progress toast, async generation |
| Industry Context outdated | Low | Low | Versioning (`INDUSTRY_CONTEXT.v1`), update quarterly |
| Quality Gates false positive | Medium | Medium | Soft warnings don't block; detailed logging |

---

## 6. CHECKLIST TRIỂN KHAI (DEVELOPER)

### Phase 0 (✅ DONE)
- [x] `INDUSTRY_CONTEXT`, `QUALITY_CHECKS`, `EX_DESIGN_TOKENS`
- [x] `EX_TEMPLATES` updated to Master Plan v2
- [x] Quality Gates integrated into 6 exports
- [x] Bug fixes: `vi`, `hhi`

### Phase 1 Checklist (PDF)
- [ ] `EX_TEMPLATES.pdf.pages` = 7 pages mới
- [ ] `renderExecDashboard()` → Waterfall chart native
- [ ] `renderIndustryContext()` → World map + Seasonality + Benchmark
- [ ] `renderExecBrief()` → + "So What?" section
- [ ] `renderMarketDeep()` → Strategic Segmentation + Heatmap
- [ ] `renderTradeFlow()` → Price/Vol/FX Waterfall
- [ ] `renderAppendix()` → Glossary + Methodology + Quality Report
- [ ] Test: 7 pages, font VN, bookmarks, hyperlinks, <2MB, <3s

### Phase 2 Checklist (PPTX)
- [ ] `EX_TEMPLATES.pptx.slides` = 15 slides
- [ ] `addWaterfallChart()` native PptxGenJS
- [ ] `addBCGMatrixChart()` (bubble 4 quadrants)
- [ ] `addRiskRadarChart()` (radar 5 risks)
- [ ] `addSeasonalityHeatmap()` (heatmap style)
- [ ] Speaker Notes cho 15 slides
- [ ] Master Layout header/footer
- [ ] Test: 15 slides, speaker notes, animations, color-blind safe

### Phase 3 Checklist (Excel)
- [ ] `EX_TEMPLATES.excel.sheets` = 9 sheets
- [ ] Sheet 1: PivotTable + 4 Slicers + Timeline + Sparklines
- [ ] Sheet 2/3: CF (Data Bars, Icon Sets, Color Scale)
- [ ] Sheet 4: PivotTable thật Country × Period
- [ ] Sheet 5: Named Ranges + Formulas Price/Vol/FX
- [ ] Sheet 6: Heatmap 12×5 + Mùa vụ icons
- [ ] Sheet 7: 4 Native Charts (Combo, Waterfall, Funnel, Sunburst)
- [ ] Sheet 8: Data_Dictionary 7 cột
- [ ] Sheet 9: Data Lineage + Quality Metrics
- [ ] Hyperlinks, Print areas, Protection

### Phase 4 Checklist (CSV)
- [ ] `exportCSV()` → 2 files (_data + _meta)
- [ ] `_meta.csv` 3 sections: Metadata, Column Defs, Summary Stats
- [ ] Schema versioning (`schema_version: 2`)
- [ ] Round-trip test

### Phase 5 Checklist (Cross-Format)
- [ ] HTML: Quality Badge, Format Selector, Industry Context, Glossary tooltips
- [ ] JSON: schema_version: 2, quality_report, industry_context_ref, round-trip
- [ ] Verify: All formats use shared INDUSTRY_CONTEXT, QUALITY_CHECKS, DESIGN_TOKENS

---

## 7. TEST PLAN

### 7.1 Automated Tests (`ui_verify.py` mở rộng)
```python
def test_pdf_structure():      # 7 pages, bookmarks, font VN, waterfall
def test_pptx_slides():        # 15 slides, speaker notes, native charts
def test_excel_pivots():       # PivotTable, Slicers, CF
def test_csv_meta():           # Dual output, meta sections, schema v2
def test_quality_gates():      # Hard/soft gates trigger correctly
def test_round_trip():         # Export JSON → Import → Verify
```

### 7.2 Manual Acceptance (CEO/Analyst/Presenter/Auditor/Newcomer Tests)
| Persona | Test | Expected |
|---------|------|----------|
| CEO | Read PDF Dashboard (30s) | Health, Top Risk, Top Opp, Next Action |
| Analyst | Filter China 2025 in Excel | Price/Vol/FX breakdown + YoY + Rank |
| Presenter | Rehearse PPTX | 15p no prep needed (speaker notes) |
| Auditor | Check CSV Meta + Excel _Meta | Source→Transform→Output traceable |
| Newcomer | Read PDF Appendix | Hiểu value chain, mùa vụ, drivers |

---

## 8. APPROVAL REQUIRED

> **Cần duyệt từ bạn trước khi bắt đầu Phase 1.**

**Hành động cần bạn**: Review file này → Reply **"APPROVE Phase 1"** hoặc yêu cầu chỉnh sửa.

---
*File này sẽ được cập nhật khi implement từng phase. Version: 1.0*