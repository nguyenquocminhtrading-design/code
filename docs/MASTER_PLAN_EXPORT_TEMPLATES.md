# DAN ON FOOD — Cashew Trade Explorer
## Master Plan v2 — Vinacas Nhập khẩu · Thanh phiên bản · Code Template

> Phiên bản: v2 · 2026-10-26 (thay thế v1 — gộp thêm 2 yêu cầu mới: Vinacas NK + bỏ nút "Tối ưu")
> Trạng thái: **ĐÃ DUYỆT & ĐÃ TRIỂN KHAI (2026-10-26)** — B ✓ · A ✓ · C ✓, syntax check pass.
> Verify end-to-end: chạy `python ui_verify.py` (có case mới: version bar 3 nút, nguồn Vinacas KPI ≠ 0, Excel stamp nguồn Vinacas).
> Nền sẵn có: Export UX Kit đang chạy (6 định dạng down ngay, `collectExportPayload()` nguồn dữ liệu duy nhất).

---

## 0. Ba nhóm việc trong plan này

| Nhóm | Việc | Nguồn yêu cầu |
|:---:|:---|:---|
| **A** | Vinacas: load số liệu + visualize **giá trị nhập khẩu** | Yêu cầu mới |
| **B** | Thanh phiên bản: **bỏ nút "Tối ưu"**, còn Sơ bộ / Chính thức / Điều chỉnh | Yêu cầu mới |
| **C** | Viết code template cho 6 định dạng download (P1 PDF+PPTX, P2 Excel+HTML + logo) | Duyệt ở v1 |

---

## A. Vinacas — load số liệu + visualize giá trị nhập khẩu

### A.1 Hiện trạng đã khảo sát (số liệu thật, không đoán)
- **Dữ liệu ĐÃ CÓ sẵn**: `output/data/all_years_cashew.json` chứa `vinacas_records` — **757 dòng**, tất cả `flow: "Import"` (RCN — Raw Cashew Nut nhập nguyên liệu), đủ `country_report, region, product, unit (Tấn), quantity, value_usd, fulldate`.
- **Chu kỳ dữ liệu**: 2018–2022 chỉ có dòng **cộng dồn cuối năm** (tháng 12, 20 dòng/năm); từ **2023-01 → 2026-09 có đủ theo tháng** (14–20 dòng/tháng) → 50 kỳ.
- **Web ĐÃ có nút nguồn** `TCHQ / Vinacas` (`#fb-source` trong index.html) — nhưng **app.js CHƯA có hàm `setDataSource()`** → bấm nút Vinacas hiện tại chỉ throw ReferenceError, không có gì xảy ra. app.js cũng **đọc 0 dòng** vinacas_records từ JSON.
- Kết luận: thiếu đúng 1 lớp **data layer + view switch** phía web; không cần đụng pipeline Python.

### A.2 Thiết kế data layer (app.js)
1. `state.dataSource = 'tchq' | 'vinacas'` (mặc định `'tchq'`).
2. `loadVinacasData()` — fetch `../output/data/all_years_cashew.json` **1 lần** (dự phòng drag-drop JSON: đọc `payload.vinacas_records`), giữ mảng records nguyên trạng trong `state.vinacasRecords`.
3. Build `state.vinacasPeriods` — map `fulldate[:7]` → kỳ `YYYY-MM`; mỗi dòng chuẩn hóa về **cùng shape row của dashboard**:
   `{ country: country_report, product, unit, quantity_month: quantity, value_month_usd: value_usd, quantity_ytd: null, value_ytd_usd: null }`
   → mọi view sẵn có (KPI, charts, bản đồ, bảng, pivot, Export Kit) hoạt động lại **không cần sửa**.
4. Switch nguồn trong đúng 3 hàm lõi (không rải if khắp code):
   - `getFilteredRowsBase(period)` → trả vinacas rows khi nguồn = vinacas
   - `getFilteredPeriods()` → trả danh sách kỳ vinacas (50 kỳ 2018-12…2026-09)
   - `periodTotals(p)` → đã đi qua `getFilteredRows` nên tự đúng theo nguồn.
5. **Kỳ Vinacas = kỳ riêng**: `state.activePeriod` khi chuyển nguồn → chọn kỳ mới nhất của nguồn đó; chips kỳ, year select, trend tự cập nhật theo nguồn.

### A.3 Visualize giá trị nhập khẩu (điểm chính user yêu cầu)
- Chọn **Vinacas → tự khóa luồng về "Nhập khẩu"** (Vinacas chỉ có Import RCN): 2 nút Xuất khẩu/Cán cân bị mờ (`disabled`) kèm tooltip "Vinacas: dữ liệu nhập khẩu nguyên liệu".
- Hero + tag đổi: `Vinacas · Nhập khẩu RCN (Raw Cashew Nut)` — phân biệt rõ với TCHQ.
- Toàn bộ view nhập khẩu hiện có hiển thị số Vinacas: KPI (lượng Tấn + trị giá USD + YTD theo dữ liệu có), bar/line theo Tháng-Quý-Năm, **bản đồ nguồn cung** (Africa 551 dòng, Cambodia 50, Asia 3, Other 153 — map theo `region` sẵn có, không cần đoán ISO), bảng chi tiết + pivot.
- Nhãn kỳ cộng dồn: các kỳ `2018-12 … 2022-12` gắn badge "Cộng dồn năm" (dữ liệu gốc là tích lũy năm, không phải tháng đơn) — tránh đọc nhầm xu hướng.
- **Badge nguồn** cạnh "Kỳ đang chọn" + footer mọi chart: "Nguồn: Vinacas" vs "Nguồn: TCHQ".

### A.4 Export Kit hưởng lợi tự động
- `collectExportPayload()` đã đi qua `getFilteredRows*` → mọi file tải về (Excel/PDF/PPTX/JSON/CSV/HTML) tự chứa số Vinacas khi nguồn = vinacas; thêm dòng `_Meta`/stamp: `source: Vinacas · Import RCN`.
- Sheet `NK_Theo_Nuoc` trong Excel xuất đúng dữ liệu Vinacas ở chế độ này.

### A.5 Việc cần làm — liệt kê
| # | Việc | File | Effort |
|:---:|:---|:---|:---:|
| A1 | `state.dataSource` + `setDataSource()` + nút active/disabled flow | app.js, index.html | S |
| A2 | `loadVinacasData()` + chuẩn hóa records → periods | app.js | M |
| A3 | Switch 3 hàm lõi + activePeriod theo nguồn | app.js | M |
| A4 | Hero/tag/badge nguồn + badge "Cộng dồn năm" | app.js, index.html | S |
| A5 | Export stamp nguồn Vinacas | app.js | S |

---

## B. Thanh phiên bản — bỏ "Tối ưu"

### B.1 Hiện trạng
- `#fb-version` có **4 nút**: 🏆 Tối ưu (`all`) · Chính thức · Điều chỉnh · Sơ bộ.
- `setDataVersion()` chỉ đổi `state.version` + UI — **chưa lọc dữ liệu thật** (stub).

### B.2 Việc cần làm
| # | Việc | Chi tiết |
|:---:|:---|:---|
| B1 | **Bỏ nút "Tối ưu"** | index.html xóa button `data-ver="all"`; còn lại 3: Sơ bộ / Chính thức / Điều chỉnh |
| B2 | Default = **Chính thức** | `state.version` mặc định `'official'`; khi kỳ không có row đúng phiên bản → tự hạ thấp về phiên bản có sẵn (official → adjusted → preliminary) + toast thông báo kỳ này chưa có Chính thức |
| B3 | Wire lọc thật (nhẹ) | Khi `state.version ≠ 'all'`: lọc `summaryRows` theo `version` (row có `version: preliminary/official/adjusted/derived`); KPI tổng theo summary đã lọc; **country rows giữ nguyên** (PDF 5X/5N không mang phiên bản). Fallbackderived giữ hiển thị kèm nhãn "Ước tính" |
| B4 | Toast + tooltip chuẩn i18n | "Phiên bản: Chính thức" … |

Effort tổng B: **S–M** (1 nửa phiên).

---

## C. Code template cho 6 định dạng download (chốt từ v1)

Giữ nguyên spec đã duyệt — tóm tắt trạng thái + việc code:

| Format | Template hiện tại | Việc code | Ưu tiên |
|:---|:---|:---|:---:|
| PDF | 5 trang inline, font Be Vietnam Pro | Tách `EX_TEMPLATES.pdf.pages` + logo cover/header mỗi trang | **P1** |
| PPTX | 6+ slide native chart inline | Tách `EX_TEMPLATES.pptx.slides` + logo slide master | **P1** |
| Excel | 5 sheet styled inline | Tách `EX_TEMPLATES.excel.sheets` + logo banner + print area | P2 |
| HTML | Template thật `buildReportHTML()` | Gán vào `EX_TEMPLATES.html` + logo cover + section NK khi balance | P2 |
| JSON | Schema round-trip | Thêm `schema_version: 1` | P0 |
| CSV | Header chuẩn | Giữ nguyên | P0 |

Nguyên tắc giữ nguyên: generator chỉ đọc template + payload; đổi template không đụng
`collectExportPayload()`; logo dùng `web/assets/dan_on_food_logo.jpg` (sẵn có).

---

## 5. Thứ tự triển khai khi được duyệt

```
B (bỏ Tối ưu + wire version)  →  A (Vinacas data layer + visualize NK)
                              →  C (P1 PDF/PPTX → P2 Excel/HTML → P0 JSON)
Verify: python ui_verify.py  (+ mở rộng 1 case: nguồn Vinacas → KPI ≠ 0, PDF/PPTX stamp nguồn)
```

Lý do thứ tự: B nhỏ và độc lập; A mở khóa dữ liệu NK cho mọi view + export; C đẹp nhất khi chạy sau vì template tự ăn theo nguồn Vinacas.

## 6. Điều kiện hoàn thành (acceptance)

1. Bấm **Vinacas** → dashboard hiển thị **giá trị nhập khẩu RCN** (KPI, chart, bản đồ, bảng) — không còn nút chết; kỳ mới nhất 2026-09 có số.
2. Thanh phiên bản còn đúng 3 nút **Sơ bộ / Chính thức / Điều chỉnh**, default Chính thức, tự hạ cấp có thông báo khi thiếu phiên bản.
3. Ở nguồn Vinacas, mọi file export stamp "Vinacas · Import RCN" và chứa số NK đúng trên dashboard.
4. Template PDF/PPTX/Excel/HTML tách riêng — logo DAN ON FOOD xuất hiện trong file tải về.
5. `ui_verify.py` pass (kèm case Vinacas mới).

## 7. Rủi ro

| Rủi ro | Biện pháp |
|:---|:---|
| Kỳ TCHQ ≠ kỳ Vinacas gây nhảy kỳ khi đổi nguồn | activePeriod + chips + year-select reset theo nguồn, nhớ lựa chọn cũ mỗi nguồn (per-source memory) |
| Dòng cộng dồn 2018–2022 gây hiểu nhầm xu hướng | Badge "Cộng dồn năm" + loại khỏi trend nối tháng khi granularity = month (ngắt chuỗi) |
| Version filter làm trang trống dữ liệu | Fallback hạ cấp có toast — không bao giờ trắng trang |
| Refactor template hỏng output | ui_verify so assertion cũ (sheet names, font PDF, native charts, Vietnamese) |
