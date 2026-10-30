# MASTER PLAN UI V3 — Bugfix theo kết quả điều tra

> Tiếp nối V2 (đã xong). Plan này xử lý 4 nguyên nhân gốc đã được kiểm chứng bằng dữ liệu thật
> (xem `diagnostics/investigate_map_values.js` + `diagnostics/check_country_names.py`).

## Nguyên nhân đã xác nhận (tóm tắt)
1. **Map mất ~841M USD**: `TIỂU VƯƠNG QUỐC`=UAE (521M), `ISRAEN`=Israel (317M), `BÊLARUT`=Belarus (3M) không có trong COUNTRY_ISO; `Other` (2.513M, 63 kỳ) là dòng tổng hợp không phải quốc gia nhưng đang lẫn vào top-market/đếm thị trường
2. **KPI không lọc theo khu vực/năm/tìm kiếm**: updateKPIs/Badges/DataStatus chỉ chạy trong setActivePeriod
3. **YTD chưa có chart**: Overview chỉ vẽ CY; Trends stack CY+YTD vào 1 chart (double-count ngữ nghĩa)
4. **Timeline chưa fixed**: 63 chip kỳ cuộn mất theo nội dung

---

## Phase 11 — Sửa dữ liệu & sync filter (root causes 1+2)

### 11.1 Bổ sung ISO mapping
```js
'TIEU VUONG QUOC': 'ARE',   // = UAE (stripAccents form)
'ISRAEN': 'ISR',            // chính tả TCHQ cho Israel
'BELARUT': 'BLR',           // Belarus
```
(đặt key ở dạng đã stripAccents-uppercase như các key hiện có)

### 11.2 Tách "Other" khỏi per-country visuals
- Helper mới: `isCountryRow(r)` = `isCashewRow(r) && r.country !== 'Other'`
- Áp dụng cho: map agg, donut, top-10 bar, progress bars, radar, bubble, topMarketForYear, map panel rank/share
- "Other" vẫn: ở bảng dữ liệu (giữ nguyên dòng thật), trong tổng KPI (là trị giá thật), trong donut hiển thị riêng slice "Khác (chưa phân loại)"
- Map: chân legend đã có "Không có dữ liệu"; thêm chú thích "Other = nhóm chưa phân loại"

### 11.3 Filter sync toàn bộ
- `refreshFilterDependent()` = updateKPIs + updateBadges + updateDataStatus + renderFilterBar + updatePeriodLabels
- Gọi trong: setRegionFilter, toggleYearFilter, setGranularity (chỉ filter bar), debounceSearch, resetFilters
- Kết quả: đổi Khu vực → KPI, badge, số bản ghi, chart, map cùng thay đổi ngay

---

## Phase 12 — Timeline → Slicer fixed (root cause 4)

- Bỏ chips khỏi topbar; thêm **slicer row sticky** dưới filter bar: `position: sticky; top: <filter-bar height>; z-index: 38`
- Chip nhóm theo năm: separator "2020 ▾" + các tháng; chip active tô gold + **auto scrollIntoView** khi đổi kỳ
- Nút ◀ ▶ nhảy kỳ liền trước/sau; hiển thị "Kỳ: 2026-09 · tháng 9 của 63"
- Nhận diện kỳ khuyết: chip khuyết (2024-02…) không render — khoảng trống tự nhiên theo dữ liệu thật

---

## Phase 13 — Tách CY / YTD thành 2 chart (root cause 3)

### 13.1 Trends tab
1. **"Trị giá CY theo kỳ"** (line, tuân theo Tháng/Quý/Năm) — giữ peak label
2. **"Trị giá YTD lũy kế theo kỳ"** (line, màu xanh #3E7C4F) — chart riêng, reset mỗi năm (label bước nhảy năm)
3. **"Sản lượng CY theo kỳ"** (bar) — bỏ stack CY+YTD sai ngữ nghĩa
4. **"Sản lượng YTD lũy kế"** (line xanh) — chart riêng
→ 4 card, mỗi chart 1 canvas id riêng (`line-chart`, `ytd-line-chart`, `stacked-chart`, `ytd-qty-chart`)

### 13.2 Overview tab
- Thêm sparkline thứ 2 cạnh sparkline CY: **"YTD lũy kế"** → dữ liệu cột YTD của sheet Tong_XK_All giờ có chart
- KPI sub-label làm rõ "CY = tháng · YTD = lũy kế năm"

---

## Phase 14 — QA

### Test Node mới (`test_phase11_14.js`)
- Map coverage: 0 dòng cashew-khác-Other unmapped (audit lại = 100% mapped)
- ISRAEN→ISR, TIỂU VƯƠNG QUỐC→ARE, BÊLARUT→BLR
- Other: không vào top-market/donut per-country slice list, nhưng vẫn trong periodTotals
- refreshFilterDependent tồn tại và được gọi bởi setRegionFilter
- buildReportHTML dùng 4 chart? (report giữ 3 chart — không đổi)
- Slicer: renderSlicer tạo đủ chip theo kỳ thật (63), auto-scroll gọi được

### ui_verify v3
- Screenshot slicer fixed khi cuộn xuống (2 vị trí scroll)
- Đổi region → assert text KPI thay đổi ngay
- Trends 4 chart; overview 2 sparkline

## Thứ tự: 11 → 12 → 13 → 14 (mỗi phase test ngay)

## Định nghĩa xong
- [x] Map audit: 100% dòng quốc gia mapped (0 unmapped, trừ Other có chủ đích); USA 2026-09 map == table = 77.940.473 USD
- [x] Đổi khu vực → KPI + badge + chart cập nhật ngay qua `refreshFilterDependent()` (verify: data-status đổi từ "63 kỳ · 35 bản ghi" → "12 bản ghi" khi chọn Europe)
- [x] Trends có 4 chart riêng: Trị giá CY · Trị giá YTD lũy kế (label mốc cuối năm) · Sản lượng CY (bar 1 dataset, hết double-count) · Sản lượng YTD (line xanh dương)
- [x] Overview có 2 sparkline: CY (gold) + YTD lũy kế (green) — cột YTD của sheet Tổng quan giờ đã có chart
- [x] Slicer kỳ fixed trong header-stack (sticky cả topbar + filter + slicer khi cuộn), nhóm theo năm, auto-scrollIntoView, nút ◀▶, hiển thị "n/63"
- [x] Toàn bộ test PASS: **99/99** (15 parser + 17 map + 37 phase 6-10 + 30 phase 11-14)

## Kết quả thực thi (đã hoàn tất)
| Phase | Deliverable | Test |
|---|---|---|
| 11 | ISO map +3 (`TIEU VUONG QUOC→ARE`, `ISRAEN→ISR`, `BELARUT→BLR`); `isCountryRow` tách Other khỏi 8 visual per-country (giữ trong bảng + KPI tổng); `refreshFilterDependent()` sync KPI/badge/status/labels | 15 asserts |
| 12 | `.header-stack` sticky hợp nhất; period slicer: chip nhóm năm, `sliceStep()` ◀▶, auto-scroll, vị trí n/63 | 7 asserts |
| 13 | `periodTotals` + `qtyY`; `aggregateSeries` qtyY=max; 4 chart riêng + `buildYtdSparkline` Overview | 8 asserts |
| 14 | QA: regression 69/69 cũ + 30 mới = 99/99; HTML balance; ui_verify v3 (slicer mid-scroll, KPI europe, UAE panel) | — |

**Ghi chú:** nút ✕ xóa kỳ cũ trên chip đã chuyển vào tab Dữ liệu & Xuất (danh sách file) — slicer chỉ chọn kỳ, tránh xóa nhầm.

## Hotfix v4 (sau report user: chart Tổng quan trắng)
- **Nguyên nhân gốc:** trình duyệt chạy **app.js cache cũ** + index.html mới (đã bỏ `#period-chips`) → `renderPeriodChips` TypeError → `setActivePeriod` chết → toàn bộ chart không vẽ, lỗi bị nuốt vào console.warn
- **Fix:** cache-busting `app.js?v=4` + `style.css?v=4`; version marker `APP_VERSION` in console + sidebar (nhìn là biết đang chạy version nào)
- **Cứng hóa thêm:** guard `typeof Chart === 'undefined'` ở 7 chỗ gọi `new Chart` — CDN fail thì card hiện empty-state thay vì dashboard trắng
- **Xác nhận kỳ mặc định:** `activateLoadedData` luôn chọn kỳ mới nhất = **2026-09** (Node check: MATCH YES); KPI delta so với 2026-08; slicer chip `09` active, info `63/63`
## Hotfix v5 (sau report user: "Canvas is already in use. Chart with ID '0'…")
- **Nguyên nhân:** Chart.js từ chối tạo chart mới khi canvas vẫn còn instance chưa destroy — xảy ra khi render chồng nhau/state tracking lệch (destroy chạy trên instance stale, canvas vẫn bị instance #0 giữ)
- **Fix triệt để:** helper `safeChart(canvas, config)` — dùng **`Chart.getChart(canvas)`** (API chính thức) tìm và hủy BẤT KỲ instance đang chiếm canvas trước khi tạo, bọc try/catch để lỗi chart không giết chuỗi render. Áp dụng cho cả 7 chỗ tạo chart (bar, donut, line, ytd-line, qty bar, ytd-qty, compare, map-trend, captureChart)
- Cache bump `?v=5`; APP_VERSION = `v5 · safeChart anti-collision`
- Regression: **99/99 PASS**
- Hướng dẫn user: **Ctrl+F5 một lần** — từ đó `?v=` tự bust cache mỗi lần nâng version
