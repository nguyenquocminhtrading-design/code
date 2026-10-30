# KẾ HOẠCH CHI TIẾT SETUP TEMPLATE OUTPUT (PDF, PPTX, EXCEL, HTML)

> **Mục tiêu:** Hoàn thiện và chuẩn hóa toàn bộ template output từ dữ liệu web HTML/JS (`web/app.js`, `web/style.css`, `web/index.html`) sang các định dạng **PDF, PPTX, Excel, HTML, JSON, CSV** đảm bảo:
> 1. **Đầy đủ tiếng Việt có dấu** (Sử dụng VFS font `Be Vietnam Pro` hoặc fallback chuẩn).
> 2. **Branding nhất quán** với bộ nhận diện **DAN ON FOOD** (Logo `assets/dan_on_food_logo.jpg`, màu chủ đạo: Deep `#17231F`, Gold `#C9A227`, Cream `#F5EBD0`).
> 3. **Tôn trọng 100% bộ lọc hiện tại trên web** (Năm, Kỳ, Khu vực, Tìm kiếm quốc gia, Luồng Xuất khẩu / Nhập khẩu / Cán cân, Nguồn TCHQ / Vinacas, Phiên bản Sơ bộ / Chính thức / Điều chỉnh).
> 4. **Trực quan ngang dashboard** (Có KPI cards, biểu đồ trực quan, bảng số liệu styled, Executive Briefing/Insights).

---

## 1. Đánh giá hiện trạng code hiện tại (`web/app.js`)

- **Nguồn dữ liệu duy nhất:** `collectExportPayload()` đã được thiết lập sẵn, lấy đúng kỳ active, luồng active (`export` / `import` / `balance`), và các filter đang áp dụng.
- **HTML Report (`exportHTMLReport()`):** Đã có sẵn báo cáo HTML tự chứa (self-contained), hỗ trợ in PDF (`Ctrl+P`) và chế độ trình chiếu (`?slides=1`). Cần bổ sung section nhận định AI & luồng Nhập khẩu / Cán cân chuẩn chỉnh.
- **PDF (`exportPDF()`):** Sử dụng `jsPDF` + `jspdf-autotable`. Cần cấu hình VFS font tiếng Việt (`Be Vietnam Pro`), bổ sung Trang 2 Executive Briefing (khung thẻ 2 cột nhận định), trang KPI cards, ảnh chart trực quan từ `captureChart()`, và autoTable chuẩn màu web.
- **PPTX (`exportPPTX()`):** Sử dụng `PptxGenJS`. Cần chuẩn hóa các slide: Slide 1 (Cover + Logo), Slide 2 (KPI cards + Delta pills), Slide 3 (Executive Insights / Key Takeaways), Slide 4 (Top 10 Native Bar Chart), Slide 5 (Region Share Doughnut Chart), Slide 6 (Trend Line Chart), Slides 7+ (Bảng chi tiết quốc gia phân trang).
- **Excel (`exportExcel()`):** Sử dụng `ExcelJS`. Cần đảm bảo xuất đủ 5 sheet (`Tong_Quan` với banner logo + khối nhận định điều hành + bảng KPI, `XK_Theo_Nuoc`, `NK_Theo_Nuoc`, `Bieu_Do` chứa chart PNGs, `_Meta` trace thông tin lọc), định dạng số `#,##0`, banded rows, freeze panes và print area tự động.

---

## 2. Kế hoạch triển khai chi tiết (4 bước)

### Bước 1: Chuẩn hóa `collectExportPayload()` & Data Layer cho các template
- Đảm bảo `collectExportPayload()` lấy chính xác số liệu theo nguồn đang chọn (`TCHQ` hoặc `Vinacas`), luồng active (`export`, `import`, `balance`), phiên bản (`official`, `adjusted`, `preliminary`), và các filter phụ (năm, khu vực, search).
- Bổ sung thông tin metadata (`_export_meta`, `ai_analysis` block từ `generateMarketNarrative()`) vào payload chung để các template PDF, PPTX, Excel, HTML đều có dữ liệu nhận định điều hành.

### Bước 2: Nâng cấp Template PDF (`exportPDF()`)
- **Font chữ:** Tích hợp font tiếng Việt `Be Vietnam Pro` qua VFS (`exFetchVnFonts()`) với fallback an toàn.
- **Bố cục trang:**
  - *Trang 1:* Cover trang trọng (Nền Deep `#17231F`, viền Gold `#C9A227`, Logo DAN ON FOOD, tiêu đề song ngữ, badge kỳ báo cáo, timestamp).
  - *Trang 2:* Executive Briefing & Market Insights (Khung KPI cards tổng quan + 4 khối nhận định điều hành 2 cột).
  - *Trang 3:* KPI chi tiết & Bảng so sánh YoY (Sản lượng, trị giá, YTD, delta pill).
  - *Trang 4:* Top 10 thị trường (Ảnh biểu đồ ngang nét cao + bảng số liệu thị phần).
  - *Trang 5:* Xu hướng theo kỳ (Ảnh biểu đồ line).
  - *Trang 6+:* Bảng chi tiết theo quốc gia (autoTable phân trang sạch sẽ, footer trang kèm nguồn).

### Bước 3: Nâng cấp Template PPTX (`exportPPTX()` via PptxGenJS)
- **Slide 1:** Cover (Nền deep, tiêu đề, kỳ, thời gian, luồng).
- **Slide 2:** KPI Overview (4 thẻ KPI nổi bật + delta pills màu sắc tăng/giảm).
- **Slide 3:** Executive Insights (Các điểm nhấn thị trường / Key Takeaways).
- **Slide 4:** Top 10 Markets (Biểu đồ cột ngang native `ChartType.bar`, màu Gold chủ đạo).
- **Slide 5:** Region Share (Biểu đồ tròn `ChartType.doughnut` phân bổ theo khu vực).
- **Slide 6:** Value & Volume Trend (Biểu đồ đường xu hướng `ChartType.line`).
- **Slides 7+:** Detailed Data Tables (Bảng dữ liệu chi tiết theo quốc gia, phân trang tự động ~17 dòng/slide, định dạng header tối màu chữ trắng, dòng xen kẽ soft cream).

### Bước 4: Nâng cấp Template Excel (`exportExcel()` via ExcelJS)
- **Sheet 1 (`Tong_Quan`):** Banner tiêu đề có logo DAN ON FOOD, khối bình luận điều hành & phân tích xu hướng (viền gold, nền soft cream), bảng KPI tháng/YTD so sánh kỳ trước kèm delta, bảng tổng hợp 2 luồng (Xuất khẩu / Nhập khẩu / Cán cân).
- **Sheet 2 (`XK_Theo_Nuoc`):** Bảng chi tiết xuất khẩu theo quốc gia (Header gold đậm, banded rows, định dạng số `#,##0`, auto-fit column width, freeze panes).
- **Sheet 3 (`NK_Theo_Nuoc`):** Bảng chi tiết nhập khẩu theo quốc gia (định dạng tương tự).
- **Sheet 4 (`Bieu_Do`):** Nhúng 2-3 ảnh biểu đồ (Top 10, Trend, YoY) trực tiếp vào sheet.
- **Sheet 5 (`_Meta`):** Lưu trữ metadata trace (kỳ, luồng, thời gian tạo, bộ lọc, nguồn, chữ ký AI integrity fingerprint).

---

## 3. Tiêu chí nghiệm thu (Acceptance Criteria)

1. Bấm nút tải **PDF**: File tải về định dạng A4 landscape, font tiếng Việt có dấu hoàn hảo, có logo DAN ON FOOD, Cover trang trọng, trang Executive Briefing đầy đủ nhận định, biểu đồ và bảng chi tiết.
2. Bấm nút tải **PPTX**: File PowerPoint gồm các slide thiết kế chuyên nghiệp, biểu đồ native chỉnh sửa được, tiếng Việt có dấu, logo và footer chuẩn nhận diện.
3. Bấm nút tải **Excel**: File Excel 5 sheet đầy đủ style, banner, khối nhận định, số liệu khớp hoàn toàn với dashboard đang hiển thị theo đúng bộ lọc.
4. Bấm nút tải **HTML Report**: Mở ra báo cáo trực quan, nhấn `Ctrl+P` in ra PDF chuẩn, hoặc thêm `?slides=1` để xem chế độ trình chiếu.
