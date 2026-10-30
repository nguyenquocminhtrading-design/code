# DAN ON FOOD — Cashew Trade Explorer
## Master Plan — Export UX Parity: "Download nào cũng trực quan như trên web"

> Phiên bản: v1 · 2026-10-26
> Phạm vi: chỉ `web/` (app.js · index.html · style.css) + tài liệu + kiểm thử. Không đổi pipeline Python.

---

## 1. Mục tiêu

Khi người dùng bấm 1 trong 6 thẻ xuất (HTML / JSON / Excel / CSV / PDF / PPTX) trên tab
**Dữ liệu & Xuất**, file tải về phải có trải nghiệm trực quan ngang dashboard:

- Brand DAN ON FOOD + bảng màu web: deep `#17231F` · gold `#C9A227` · cream `#F5EBD0`.
- KPI cards, biểu đồ, bảng styled — giống những gì họ vừa nhìn trên web.
- **Tiếng Việt đầy đủ dấu** trong mọi file (PDF hiện mất dấu: "Xuat Khau Hat Dieu").
- Số liệu **khớp đúng filter đang hiển thị** (năm · khu vực · từ khóa · Tháng/Quý/Năm).
- Hỗ trợ **cả 2 luồng** Xuất khẩu (XK) và Nhập khẩu (NK) theo toggle trên web.

## 2. Audit hiện trạng (web/app.js)

| Format | Hàm | Hiện trạng | Khoảng cách so với web |
|---|---|---|---|
| HTML | `exportHTMLReport()` | Đã tốt: cover, KPI, YoY, Top-10, trend, bảng chi tiết, print CSS, slides | Bổ sung luồng NK |
| JSON | `exportJSON()` | Dump thô `{meta, summary, country_cashew}` | Không round-trip ngược vào dashboard được |
| Excel | `exportExcel()` | SheetJS community — 2 sheet trần, không style/KPI/chart | Gần như khác hoàn toàn dashboard |
| CSV | `exportCSV()` | Chỉ country rows XK | Bỏ qua filter + flow toggle |
| PDF | `exportPDF()` | Cover + 1 autoTable; font helvetica mất dấu tiếng Việt | Không KPI card, không chart |
| PPTX | `exportPPTX()` | 5 slide; Top-10 vẽ rect tay; text không dấu | Thiếu chart thật, bảng màu web |

Điểm chung: (1) mọi format trừ HTML dùng `buildExportData()` raw → **bỏ qua filter**;
(2) **không format nào có NK** dù web có toggle XK/NK.

## 3. Kiến trúc giải pháp — Export Kit

Một nguồn dữ liệu duy nhất `collectExportPayload()` cho cả 6 format:

```
collectExportPayload()
├── period           ← state.activePeriod
├── flow             ← state.flow ('export' | 'import')
├── rows             ← getFilteredRows(period)   ← TÔN TRỌNG filter hiện tại
├── kpis             ← periodTotals() + Δ% kỳ trước (lượng, trị giá, YTD)
├── tongXk / tongNk  ← từ state.periods[period]
├── top10 / years    ← sort trị giá + gom theo năm
├── series           ← aggregateSeries() cho trend (Tháng/Quý/Năm)
├── filtersStamp     ← năm, khu vực, search, granularity
├── lang             ← state.lang cho mọi nhãn
└── chartImages      ← captureChart() → PNG data-URI (dùng cho Excel + PDF)
```

- `THEME = { deep:'#17231F', gold:'#C9A227', cream:'#F5EBD0', soft:'#F7EFD8', up:'#3E7C4F', down:'#C0392B', muted:'#8A7B5E' }`.
- `exportButtonBusy(cardEl, fn)`: spinner trên thẻ + disable + toast kèm kích thước file.
- Quy ước tên file: `{period}_cashew_{flow}_{format}` (vd `2025-05_cashew_xk.xlsx`).

## 4. Các Phase

### Phase 0 — Nền tảng Export Kit ✅ nền móng
- Section `// ── Export Kit ──` mới trong app.js (payload, THEME, busy-state).
- index.html: id cho từng export card + mô tả mới ("5 sheet có biểu đồ", "PDF có KPI + chart"…).

### Phase 1 — Excel qua **ExcelJS** (khoảng cách lớn nhất)
- CDN `exceljs@4.4.0` thêm vào index.html.
- Workbook 5 sheet: **Tong_Quan** (banner + KPI + bảng 2 luồng) · **XK_Theo_Nuoc** ·
  **NK_Theo_Nuoc** · **Bieu_Do** (2–3 ảnh chart) · **_Meta** (kỳ, filters, generated_at).
- Style: header gold, banded rows, `#,##0`, freeze panes, auto-width, print area.

### Phase 2 — PDF: dấu tiếng Việt + KPI + chart
- Font Unicode **Noto Sans** (Regular/Bold) fetch runtime từ CDN jsdelivr → `addFileToVFS()`
  + `addFont()`; cache trong module; offline → fallback helvetica + toast cảnh báo.
- Layout mới theo section của HTML report: cover → trang KPI cards → bảng YoY →
  ảnh Top-10 → ảnh trend → autoTable chi tiết → footer. Landscape A4, auto page-break.

### Phase 3 — PPTX: chart thật + tiếng Việt có dấu
- PptxGenJS hỗ trợ Unicode → thay toàn bộ text ASCII.
- Top-10 chuyển sang native `ChartType.bar`; thêm slide donut **thị phần theo khu vực**
  (`REGION_LABELS`); trend giữ line chart; bảng chi tiết tự phân trang ~17 dòng/slide.

### Phase 4 — JSON & CSV
- JSON: schema chuẩn pipeline `{periods: {…}}` (`tong_xk`, `tong_nk`, `trade_balance_usd`,
  `xk_theo_nuoc[]`, `nk_theo_nuoc[]`) → **kéo-thả lại vào dashboard là load đúng**.
- CSV: theo `state.flow` + dòng meta ghi filter.

### Phase 5 — Nhất quán
- Cả 6 format dùng `collectExportPayload()`; PDF/PPTX/CSV theo `state.flow`;
  Excel/JSON luôn chứa cả 2 luồng khi có dữ liệu; mọi nhãn theo `state.lang`.

### Phase 6 — Kiểm thử & tài liệu
- Mở rộng `ui_verify.py`: bấm từng thẻ export → `page.expect_download()` → lưu
  `diagnostics/export_shots/` → assert file > 0 byte + không console-error; đọc lại
  xlsx bằng openpyxl; test round-trip JSON.
- Checklist thủ công từng file trong Excel/PowerPoint/PDF reader.
- Cập nhật README.md phần "Layer 2 — Export".

## 5. Rủi ro & biện pháp

| Rủi ro | Biện pháp |
|---|---|
| ExcelJS ~1MB qua CDN | Nạp như các lib hiện có; guard `typeof ExcelJS === 'undefined'` → toast hướng dẫn |
| Font TTF làm PDF nặng | Chỉ fetch 2 weight khi bấm export; cache module; fallback helvetica |
| `captureChart` cần Chart.js (CDN) | Guard `typeof Chart === 'undefined'` → bỏ ảnh, giữ bảng |
| Số liệu lệch dashboard | 1 nguồn duy nhất `collectExportPayload()`; ui_verify so KPI |

## 6. Điều kiện hoàn thành (acceptance)

1. Mỗi file tải về có brand, bảng màu web, tiếng Việt có dấu, KPI + ít nhất 1 biểu đồ
   (Excel/PDF/PPTX), số liệu khớp dashboard cùng filter.
2. Excel: 5 sheet styled, freeze panes, number format đúng.
3. PDF: không còn chữ mất dấu; có ảnh chart.
4. PPTX: native charts; tiếng Việt có dấu.
5. JSON round-trip: drop file JSON vừa xuất vào dashboard → dữ liệu load lại đúng.
6. `ui_verify.py` mở rộng chạy pass, không console error.
