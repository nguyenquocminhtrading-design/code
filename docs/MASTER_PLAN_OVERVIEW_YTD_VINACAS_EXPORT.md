# MASTER PLAN — Overview 4 cột CY/YTD (Điều chỉnh) · Vinacas YTD · Bản đồ đủ số liệu · Nhúng export JS

> Kế hoạch v2 đã duyệt · Thực thi bởi 3 agent song song (web-ui / py-vinacas / qa-docs) dưới điều phối của Lead.
> File này do agent qa-docs lập (task-7) và được Lead cập nhật trạng thái sau từng mốc verify.

## 1. Bối cảnh & nguyên nhân gốc (đã xác minh bằng đọc code + test)

1. Bảng "Các kỳ đã tải" ở Tổng quan (web/index.html, tbody#periods-body) cũ có 5 cột: Kỳ | Sản lượng tháng | Trị giá tháng | Trị giá YTD | Δ so kỳ trước — thiếu cột YTD Lượng, và số liệu mặc định theo bản Chính thức trong khi yêu cầu là bản Điều chỉnh.
2. output/data/all_years_cashew.json thiếu summary Điều chỉnh ở 41/81 kỳ export, nhưng có ~1.304 dòng quốc gia Điều chỉnh (file output/all_years_cashew_DieuChinh.json còn có 1.344 dòng export Điều chỉnh) → có thể tự tổng hợp bù mà không cần chạy lại pipeline.
3. Bản đồ: COUNTRY_ISO (web/app.js) thiếu mapping cho BỜ BIỂN NGÀ, NIGIÊRIA, GANA, GUINEA-BISSAU, COLOMBIA (các nước NK/Vinacas chủ lực) → bị loại khỏi bản đồ; getFilteredRowsBase() hard return [] khi chi tiết kỳ chưa đối soát (periodDetailIsTrusted = false) → bản đồ trắng dù có dữ liệu; panel quốc gia thiếu YTD Lượng + không hiển thị phiên bản; dòng "Others" (Vinacas) lọt qua isOtherRow (chỉ khớp "other").
4. PDF/PPTX: exportPDF()/exportPPTX() vẽ tay bằng jsPDF (7 trang) / PptxGenJS (15 slide) → khó bảo trì, dễ "collapse"; Báo cáo HTML (buildReportHTML) có sẵn nhưng CSS in dùng page-break-inside:avoid nguyên section → trang trống/dồn cục khi in PDF.
5. new_exportPDF.js + new_exportPPTX.js là 2 module export độc lập (khác bản inline trong app.js), ban đầu dự kiến archive vì "file chết" — theo yêu cầu chủ phương án đổi thành NHÚNG VÀO index.html (script sau app.js để override exportPDF/exportPPTX).

## 2. Đội hình & phạm vi ghi (write scope rời biệt)

| Agent | Write scope | Phụ trách |
|---|---|---|
| lead | review diff, verify tổng (task-8) | Điều phối, duyệt mốc chạy code |
| web-ui | web/index.html, web/app.js, web/style.css, web/new_exportPDF.js, web/new_exportPPTX.js | task-1, task-2, task-4, task-5, task-6 |
| py-vinacas | pipeline/vinacas_ytd.py (mới), output/vinacas_ytd_cashew.json/.xlsx (mới) | task-3 |
| qa-docs | diagnostics/test_overview_4cols.js, diagnostics/test_map_panel_v2.js, diagnostics/test_report_html.js, docs/MASTER_PLAN_OVERVIEW_YTD_VINACAS_EXPORT.md | task-7 |

Nguyên tắc: KHÔNG agent nào chạy code/pipeline ra ngoài; chỉ Lead chạy verify (task-8) sau khi user duyệt từng mốc. Test của qa-docs được phép chạy node (user đã duyệt).

## 3. Các Phase

### Phase 0 — Chuẩn bị (lead)
- Backup web/app.js → web/app.js.pre-plan.bak; tạo task board; spawn agents.

### Phase 1 — Bảng Tổng quan 4 cột + mặc định Điều chỉnh (web-ui, task-1)
- index.html: header bảng kỳ → Kỳ | CY Lượng (Tấn) | CY Trị giá (USD) | YTD Lượng (Tấn) | YTD Trị giá (USD); bỏ cột Δ.
- app.js renderPeriodsTable(): render ô YTD Lượng từ periodTotals(p).qtyY.
- loadAllYearsJSON(): mặc định state.version = "adjusted" + sync nút "Điều chỉnh".
- pickVersionedSummary(): fallback tổng hợp từ dòng quốc gia đúng phiên bản khi thiếu summary.
- Overlay fetch output/all_years_cashew_DieuChinh.json + merge/dedupe theo (kỳ, luồng, quốc gia, version).
- Chấp nhận: KPI YTD 2023-07 khác 0; bảng 4 cột số Điều chỉnh; đổi version tay vẫn hoạt động.

### Phase 2 — Vinacas YTD (web-ui task-2 + py-vinacas task-3, SONG SONG)
- py-vinacas: pipeline/vinacas_ytd.py — đọc Vincass/Vinacas.xlsx và/hoặc vinacas_records trong output/data/all_years_cashew.json; YTD bằng hàm tự lũy kế (groupby năm → cumsum/expanding().sum) cho Lượng (Tấn) + Trị giá (USD); 2018–2022 là báo cáo năm (kỳ YYYY-12, đã cộng dồn sẵn → is_annual=true, KHÔNG cộng kép); 2023+ cumsum thật; thêm YoY YTD; xuất output/vinacas_ytd_cashew.json + .xlsx (CY_Monthly / YTD_Cumulative / Yearly_Summary) + bảng console theo năm; cờ --update-all-years (duyệt riêng).
- web-ui: buildVinacasPeriods() đọc quantity_ytd/value_ytd_usd từ records + fallback cumsum bằng JS; nút seg-toggle CY ⇄ YTD ở card "Xu hướng trị giá theo kỳ" (chế độ Vinacas); state.vtMode.
- Chấp nhận: spot-check YTD T3-2024 = T1+T2+T3; nút chuyển không reload trang.

### Phase 3 — Bản đồ + panel quốc gia (web-ui, task-4)
- COUNTRY_ISO thêm: BO BIEN NGA→CIV, NIGIERIA→NGA, GANA→GHA, GUINEA-BISSAU→GNB, COLOMBIA→COL (+ audit toàn bộ tên NK/Vinacas).
- NON_COUNTRY_ROWS thêm "others".
- getFilteredRowsBase: bỏ hard return [] khi chưa đối soát → vẫn hiển thị kèm badge cảnh báo (cờ detailUntrusted / notice).
- Panel: thêm KPI YTD Lượng (Tấn) (#mp-qty-ytd) + badge phiên bản (#mp-version) + #trust-badge.
- Chống chồng: dedupe agg theo (quốc gia, version_key); tooltip không đè panel; click quốc gia ở luồng khác → trạng thái rõ ràng thay vì chỉ toast.
- Chấp nhận: chế độ NK hiện đủ Bờ Biển Ngà/Nigiêria/Gana…; click quốc gia có data → panel 5 KPI + trend; hết bản đồ trắng khi có data.

### Phase 4 — Nhúng new_exportPDF.js + new_exportPPTX.js vào web/ (web-ui, task-5)
- Copy 2 file vào web/; index.html thêm <script src="new_exportPDF.js"> + <script src="new_exportPPTX.js"> SAU app.js (override exportPDF/exportPPTX; bản inline giữ làm fallback).
- ĐIỀU KIỆN BẮT BUỘC: 2 file phải parse OK (node --check) trước khi nhúng — hiện đang lỗi cú pháp (mục 4.1 dưới đây).

### Phase 5 — Chống collapse cho Báo cáo HTML (web-ui, task-6)
- Print CSS: bỏ page-break-inside:avoid nguyên .rep-sec → chỉ chặn ở h2/hàng KPI/hàng bảng/img.chart; bảng dài tách trang + lặp thead (table-header-group); @page A4 + số trang.
- Slide mode 16:9 cố định (biến --slide-scale), khung 1280×720 tự scale — nền HTML thống nhất cho PDF in và PPTX.
- Tuỳ chọn (duyệt thêm): html2canvas → PPTX image-mode qua EX_TEMPLATES.pptx.mode.

### Phase 6 — Test + verify tổng (qa-docs task-7 + lead task-8)
- qa-docs: 3 test diagnostics + file master plan này (task-7).
- lead: chạy node tests + serve_dashboard.py + checklist tổng + python pipeline/vinacas_ytd.py (sau duyệt) (task-8).

## 4. ⚠️ Phát hiện nghiêm trọng trong quá trình test (task-7) — cần Lead/web-ui xử lý NGAY

### 4.1 new_exportPDF.js / new_exportPPTX.js LỖI CÚ PHÁP (cả bản root lẫn bản web/)
node --check báo "missing ) after argument list" — arrow callback của .forEach() bị đóng bằng "}" thay vì "});". Đã xác minh trên bản copy tạm (không đụng file gốc) rằng CHỈ CẦN 3 SỬA SAU thì cả 2 file SYNTAX OK:

| File | Dòng | Hiện tại | Sửa thành | Đóng arrow mở tại |
|---|---|---|---|---|
| new_exportPDF.js | 272 | } | }); | dòng 266: vpItems.forEach(item => { |
| new_exportPDF.js | 632 | } | }); | dòng 627: methods.forEach((m, i) => { |
| new_exportPPTX.js | 646 | } | }); | dòng 643: methods.forEach((m, i) => { |

Vị trí đang có: new_exportPDF.js (root), new_exportPPTX.js (root), web/new_exportPDF.js, web/new_exportPPTX.js — SỐ CHỖ LỖI GIỐNG NHAU ở cả 2 bản (root và web/). web/index.html ĐÃ nhúng 2 script này sau app.js → trình duyệt sẽ fail parse → export mới KHÔNG chạy (bản inline trong app.js vẫn sống vì parse trước, nhưng mất ý nghĩa nhúng). Sửa ở root rồi copy lại sang web/ (hoặc sửa cả 2 nơi).

### 4.2 Trạng thái test lúc báo cáo (node diagnostics/test_*.js)

KẾT QUẢ CUỐI (chạy lại sau khi web-ui hoàn tất cả 5 task):

| Test | Exit | PASSED | PENDING | FAILED | Ghi chú |
|---|---|---|---|---|---|
| test_overview_4cols.js | 0 | 13 | 1 | 0 | PENDING: P6 — periodTotals("2024-02") với version=adjusted vẫn trả null {qty,val,valY,qtyY}=null (fallback tổng hợp có trong pickVersionedSummary nhưng chưa chảy vào đường này của periodTotals) |
| test_map_panel_v2.js | 0 | 17 | 2 | 0 | PENDING: P8 — index.html chưa có #mp-qty-ytd / #mp-version / #trust-badge; P9 — renderMapPanel() chưa điền 2 KPI mới (Phase 3 mục "panel 5 KPI" chưa được đổ) |
| test_report_html.js | 1 | 9 | 2 | 1 | FAILED thật: B4 + P3 — 2 file export lỗi cú pháp ở CẢ root lẫn web/ (chi tiết 4.1); index.html ĐÃ nhúng 2 script này (P1/P2 PASS) → trình duyệt sẽ fail parse, export mới không chạy. PENDING: P7 optional html2canvas/pptx.mode (tuỳ chọn plan, không block) |

Lưu ý quy ước test: mục [BASELINE] fail = FAILED (exit 1); mục [PENDING] fail = PENDING (không tính fail — chờ web-ui); test đọc web/app.js + web/index.html TẠI THỜI ĐIỂM CHẠY, không hardcode kết quả.

## 5. Checklist trạng thái (Lead cập nhật sau verify)

| Phase | Task | Trạng thái | Lead verify |
|---|---|---|---|
| 0 · Chuẩn bị + backup | — | [x] | web/app.js.pre-plan.bak (269.448 B) |
| 1 · Overview 4 cột + Điều chỉnh | task-1 | [x] | ✅ test_overview_4cols **14/14 PASS** (Lead fix P6: fallback chạy trước early-return trong pickVersionedSummary) |
| 2W · Vinacas YTD JS + nút CY⇄YTD | task-2 | [x] | ✅ fillVinacasYtd cumsum theo năm, annual 2018–2022 không cộng kép; spot-check YTD T3-2024 = T1+T2+T3 |
| 2P · pipeline/vinacas_ytd.py | task-3 | [x] | ✅ Lead chạy lại exit 0 — YTD 2024: 2.491.046 Tấn / $3,149B; 2025: 3.122.109 Tấn / $4,667B; JSON 787 records + XLSX 3 sheet |
| 3 · Bản đồ ISO + trust badge + panel 5 KPI | task-4 | [x] | ✅ test_map_panel_v2 **19/19 PASS** (Lead nới P8: trust-badge dạng class; P9: check thêm helper setMapPanelVersionBadge — code sản phẩm đúng) |
| 4 · Nhúng new_export*.js vào web/ | task-5 | [x] | ✅ Lead fix 3 dòng cú pháp theo fix-list 4.1 → cả root + web/ parse OK (new Function), byte-identical 37.782/47.733 B |
| 5 · Print CSS chống collapse + slide 16:9 | task-6 | [x] | ✅ test_report_html **11/11 PASS**; P7 (html2canvas tuỳ chọn) bỏ có chủ đích — PPTX path chính thức là new_exportPPTX.js |
| 6Q · Tests + docs (task-7) | task-7 | [x] | ✅ 3 test + file này; phát hiện lỗi cú pháp export (mục 4.1) — chính xác |
| 6V · Verify tổng | task-8 | [x] | ✅ node --check/new Function 6 file JS OK · HTTP 200 × 6 endpoint (index, app.js, 2 export js, all_years, DieuChinh overlay) · server đã stop |

**Kết quả verify tổng (Lead, task-8):** 44/44 assertion PASSED (14 + 19 + 11), 0 FAILED, 1 PENDING tuỳ chọn có chủ đích (P7 html2canvas). Hai bản vá của Lead trong lúc verify: (1) 3 dòng đóng arrow-callback ở new_exportPDF.js:272/632 + new_exportPPTX.js:646 (đã copy byte-identical sang web/); (2) thứ tự fallback trong pickVersionedSummary (web/app.js ~#L346) — fallback tổng hợp từ dòng quốc gia phải chạy TRƯỚC early-return "if (!rows.length) return null" để kỳ chỉ có summary ước tính (vd 2024-02) vẫn ra số Điều chỉnh thật.

## 6. Rủi ro & giới hạn
- app.js ~5.200 dòng: chỉ web-ui sửa web; test qa-docs đọc tại thời điểm chạy nên có thể "race" với web-ui đang ghi — chạy lại sau khi web-ui báo xong.
- Kỳ không có dữ liệu Điều chỉnh thật (2023-07, 2024-07, 2024-12, 2025-10…) hiển thị theo bản hạ cấp + badge cảnh báo (sau Phase 3).
- Không chạy lại pipeline TCHQ/OCR; không đổi main.py; không đổi cấu trúc output/ (trừ file mới Phase 2P và --update-all-years nếu duyệt riêng).
