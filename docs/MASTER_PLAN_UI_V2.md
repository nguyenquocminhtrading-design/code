# MASTER PLAN UI V2 — Year Comparison · Filters · Sticky Header · Data Labels · HTML Report

> Tiếp nối `frontend-optimization-plan.md` (5 phase đã hoàn tất — vanilla JS, Excel-only backend).
> Bản plan này gồm 5 phase mới (6→10), mỗi phase chạy end-to-end: code → test → verify.

## Yêu cầu gốc từ user
1. Thiết kế **so sánh từng năm** (year-over-year comparison view)
2. **Bổ sung thanh filter** (bộ lọc dùng chung cho mọi tab)
3. **Header không collapse** (topbar ổn định ở mọi kích thước màn hình)
4. **Data labels trên chart tròn** (donut)
5. Line chart **chỉnh được theo Quý / Năm** (aggregation toggle)
6. **KPI so sánh % thay đổi theo từng năm** (YoY deltas)
7. Gộp output PPTX + report thành **1 nền tảng HTML** (unified HTML report)
8. Master plan có từng phase

---

## Phase 6 — Header bền vững + Hệ thống Filter toàn cục

### 6.1 Header không collapse (sửa hiện trạng)
**Hiện trạng gây collapse:** tại `@media (max-width: 980px)` thì `.data-status` bị `display:none`, chips wrap nhiễu, sidebar thu về 66px.

**Giải pháp:**
- Topbar **sticky** (`position: sticky; top: 0; z-index`) + nền mờ blur
- Một hàng duy nhất: brand → spacer → data-status → chips strip → nút thêm dữ liệu
- Chips strip + filters strip dùng `overflow-x: auto` (scroll ngang, KHÔNG ẩn phần tử, KHÔNG wrap)
- Bỏ hết rule `display:none` của topbar trong media queries; mobile thu gọn bằng `font-size` + `padding`, không cắt nội dung
- Sidebar mobile: giữ icon rail (không đếm là "collapse header")

### 6.2 Filter bar toàn cục (sticky dưới topbar)
Các filter áp dụng cho MỌI tab (overview, countries, map, trends, compare):
| Filter | Kiểu | Ghi chú |
|---|---|---|
| Năm | multi-select chips (2020…2026) | chọn ≥1 năm |
| Chi tiết kỳ | toggle `Tháng / Quý / Năm` | mặc định Tháng |
| Khu vực | `Tất cả / Châu Á / Châu Âu / Châu Mỹ / Châu Phi / Trung Đông / Khác` | mapping ISO → region |
| Quốc gia | search box (chuyển từ tab Countries lên global) | strip-accents như cũ |
| Reset | nút ↺ | xóa filter, giữ kỳ đang chọn |

**State mới:** `state.filters = { years:Set, granularity:'month'|'quarter'|'year', region:'', country:'' }`
**Hàm lõi mới:** `getFilteredPeriods()` trả danh sách kỳ sau filter — mọi render đi qua hàm này.

### Files đụng đến
- `index.html`: thêm `<div class="filter-bar">` vào topbar area
- `style.css`: `.topbar` sticky + `.filter-bar` + chips-select styles; sửa media queries
- `app.js`: `state.filters`, `getFilteredPeriods()`, `applyRegionFilter()`, REGION_MAP (ISO→region)

---

## Phase 7 — So sánh từng năm (tab mới "So sánh")

### 7.1 Tab mới `compare` (đặt sau Trends)
**Nội dung tab:**
1. **KPI YoY row** (4 thẻ): Tổng trị giá năm N · Δ% so N-1 · Sản lượng năm N · Δ% — count-up + pill màu như KPI cũ
2. **Grouped bar chart**: trị giá theo năm (mỗi năm 1 cột, gold scale, data label trên cột)
3. **YoY table**: Năm · Trị giá · Δ% vs năm trước · Sản lượng · Δ% · Top thị trường · Δ top market
4. **Matrix năm × quý** (heatmap grid CSS): ô màu theo trị giá — nhìn ngay mùa vụ xuất khẩu

### 7.2 Aggregation engine (dùng chung, đặt ở app.js)
```
aggregateSeries(periods, granularity)
  → 'month'   : như cũ (theo YYYY-MM)
  → 'quarter' : gom YYYY-Qn (sum qty/val, max ytd)
  → 'year'    : gom YYYY (sum)
yoyDelta(series) → [{label, value, deltaPct, prevValue}]
```
Trends tab dùng lại engine này cho line/stacked charts (Phase 8).

### Files đụng đến
- `index.html`: nav-item "So sánh" + `#tab-compare` panel
- `app.js`: `aggregateSeries()`, `yoyDelta()`, `renderCompare()`, `buildGroupedBarChart()`, `buildYoYTable()`, `buildYearQuarterMatrix()`; TABS/TAB_TITLES thêm 'compare'
- `style.css`: `.matrix-grid`, `.mx-cell`, YoY pill variants

---

## Phase 8 — Data labels + Aggregation toggle trên charts

### 8.1 Donut có data label (yêu cầu 4)
- Thêm CDN `chartjs-plugin-datalabels@2` vào index.html
- Nhãn trên từng miếng: **%** (≥5% mới hiện, tránh rối) + hover tooltip giữ nguyên USD
- Custom plugin fallback nếu CDN fail: vẽ % bằng `afterDatasetsDraw`

### 8.2 Line charts theo Quý / Năm (yêu cầu 5)
- Toggle `Tháng / Quý / Năm` trên tab Trends (và Compare) — đọc từ `state.filters.granularity`
- `renderLineChart()` + `buildMultiLineChart()` + `buildStackedBarChart()` đi qua `aggregateSeries()`
- Point labels: hiện giá trị USD tại điểm last/peak
- Area sparkline ở Overview cũng theo granularity

### 8.3 Bar charts
- Top-10 bar: data label USD ở đầu thanh
- Grouped bar (Phase 7): label trên cột

### Files đụng đến
- `index.html`: script tag datalabels; segment toggle ở Trends
- `app.js`: cấu hình datalabels per-chart; refactor 4 hàm chart qua aggregateSeries
- `style.css`: `.seg-toggle` (segmented control)

---

## Phase 9 — Báo cáo HTML hợp nhất (thay thế cặp PDF + PPTX)

### 9.1 Một thẻ export mới: "Báo cáo HTML"
Tạo **1 file `YYYY_report.html` tự chứa** (single-file, mở offline, không cần internet):
1. **Cover**: brand Dan on Food · dải kỳ báo cáo · ngày tạo · nguồn TCHQ
2. **KPI section**: 4 KPI + YoY delta
3. **So sánh năm**: bảng YoY + grouped bar (nhúng ảnh)
4. **Top 10 thị trường**: bar chart ảnh nhúng + bảng
5. **Chi tiết quốc gia**: bảng đầy đủ (7 cột, striped, format VN)
6. **Nhúng chart**: `canvas.toDataURL('image/png')` → `<img src="data:...">` — 0 dependency ngoài file
7. **Print CSS**: `@media print` → A4, ngắt trang sạch → **Ctrl+P = PDF** (thay PDF export)
8. **Slide mode**: `?slides=1` → mỗi section 1 "slide" full-page scroll-snap + nút ▶ Present (thay PPTX)
9. Bilingual VI/EN theo `state.lang`

### 9.2 Vị trí các export cũ
- Giữ nguyên Excel/CSV/JSON (data exports)
- PDF + PPTX giữ lại nhưng ghi chú "khuyến nghị dùng Báo cáo HTML" (không xóa — backward compatible)

### Files đụng đến
- `index.html`: thẻ export thứ 6 "Báo cáo HTML"
- `app.js`: `exportHTMLReport()` — build DOM string, inline charts, download blob; `reportSlideMode()`
- `style.css`: (styles nhúng trong report, không đụng dashboard CSS)

---

## Phase 10 — QA + Verify end-to-end

### 10.1 Unit test mở rộng (Node, không cần browser)
- `test_aggregate_yoy.js`: aggregateSeries (tháng/quý/năm) + yoyDelta — so kết quả tay từ xlsx thật
- `test_filters.js`: getFilteredPeriods theo years/region/country
- `test_report_html.js`: exportHTMLReport tạo HTML hợp lệ (tag balance, có img data URI, có bảng)

### 10.2 ui_verify.py update
- Screenshot 6 tab (+ tab So sánh, + filter bar sticky)
- Tương tác: đổi granularity → ảnh chart thay đổi; bật filter năm → KPI đổi
- Gửi file `*_report.html` generate → assert có `<img src="data:image/png`

### 10.3 Tài liệu
- Cập nhật `docs/frontend-optimization-plan.md` + README phần tính năng mới

---

## Timeline & thứ tự phụ thuộc
```
Phase 6 (Header + Filters)  ← nền cho mọi thứ
   └→ Phase 7 (So sánh năm, dùng aggregateSeries + filters)
        └→ Phase 8 (Data labels + toggle Quý/Năm trên charts cũ)
             └→ Phase 9 (HTML report gom KPI + YoY + charts)
                  └→ Phase 10 (QA toàn bộ)
```
Chạy tuần tự 6 → 7 → 8 → 9 → 10 (mỗi phase code xong chạy test ngay).

## Rủi ro & giảm thiểu
| Rủi ro | Giảm thiểu |
|---|---|
| Sửa topbar phá responsive cũ | Chỉ bỏ rule ẩn; thêm scroll; test 1440/980/640px qua ui_verify |
| 63 kỳ × labels quá dày | Datalabels chỉ hiện ≥5%; x-axis maxTicksLimit |
| Datalabels CDN fail | Custom plugin fallback vẽ % bằng canvas |
| Report HTML quá nặng (nhiều ảnh) | Nén PNG 2x DPR; chỉ nhúng 4-5 chart chính |
| Phá tab cũ | Mọi render đi qua getFilteredPeriods — cũ mới dùng chung 1 đường dữ liệu |

## Tiêu chí xong (Definition of Done)
- [x] Header không ẩn/broken ở 1440 / 980 / 640 px — topbar `height:auto + overflow-x:auto`, đã bỏ rule `display:none` của `.data-status`; filter bar wrap ở ≤1100px nhưng không ẩn phần tử
- [x] Filter bar lọc được tất cả tab — `state.filters` (năm multi-select · Tháng/Quý/Năm · Khu vực · tìm quốc gia 2 chiều với bảng) + `getFilteredPeriods()`/`getFilteredRows()` làm nguồn dữ liệu duy nhất
- [x] Tab So sánh: KPI YoY + grouped bar (USD + Tấn, 2 trục) + bảng YoY + ma trận Năm×Quý heatmap
- [x] Donut có % label (datalabels plugin, ≥5% mới hiện); line/area/stacked đổi được Tháng/Quý/Năm qua `aggregateSeries()`; bar có label USD
- [x] File `*_report.html` tự chứa 100% (3 chart nhúng base64, 0 external resource), Ctrl+P ra PDF (@media print A4 + page-break), `?slides=1` chế độ trình chiếu (←→/Space/Esc)
- [x] Toàn bộ Node test PASS: **69/69** (15 parser + 17 map panel + 37 phase 6-10)
- [x] ui_verify.py v2: screenshot 12 cảnh (7 tab + filter + granularity + report slide mode) + assert file report sinh ra

## Kết quả thực thi (đã hoàn tất)
| Phase | Deliverable | Test |
|---|---|---|
| 6 | Sticky topbar không collapse + filter bar toàn cục (REGION_MAP ~70 nước, ISO→region) | 9 asserts |
| 7 | Tab "So sánh": `aggregateSeries()` + `yoyDelta()` + KPI YoY + bar 2 trục + bảng + ma trận | 15 asserts |
| 8 | Datalabels: donut %, bar USD, line peak-label; toggle Tháng/Quý/Năm trên 4 chart | 2 asserts |
| 9 | `exportHTMLReport()` → 1 file .html tự chứa: KPI+YoY+Top10+Trend+Chi tiết, print PDF, slide mode | 7 asserts |
| 10 | QA: 37 asserts mới + regression 32 cũ = 69/69; HTML balance; syntax; ui_verify v2 | — |

**Ghi chú dữ liệu thật:** file all_years_cashew.xlsx có khuyết tháng (2020 thiếu 05; 2024 thiếu 02/03/07/12) — filter năm 2024 cho đúng 8 kỳ, không phải 12. Engine aggregation xử lý đúng các khuyết này.
