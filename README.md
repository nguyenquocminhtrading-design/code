# XNK Cashew Data Intelligence Platform — Hệ Thống Phân Tích XNK Hạt Điều

Nền tảng thu thập, xử lý OCR, phân tích và trực quan hóa dữ liệu **Xuất khẩu - Nhập khẩu Hạt điều Việt Nam** từ Tổng cục Hải quan (TCHQ) và đối soát hiệp hội Vinacas.

---

## 1. Cấu Trúc Dự Án (Project Structure)

```
code/
├── pipeline/
│   ├── scraper.py            # Cào dữ liệu TCHQ (Playwright): 4 báo cáo (2X, 5X, 2N, 5N) × 3 phiên bản
│   ├── ocr_pipeline.py       # OCR + trích xuất bảng + Fallback suy ngược + Xuất Excel 6 Sheet & 2 Folder
│   ├── data_builder.py       # Tổng hợp đa năm, tính Cán cân, nhúng Vinacas.xlsx, xuất all_years & JSON
│   ├── paths.py              # Chuẩn hóa output root và đường dẫn kỳ/luồng
│   ├── vinacas_ytd.py        # Tính YTD Vinacas độc lập
│   └── serve_dashboard.py    # HTTP server helper cho web dashboard
├── main.py                   # Điểm kích hoạt toàn hệ thống: Range runner, Smart Cache, điều phối
├── restructure_output.py     # Preview/chuẩn hóa output/YYYY/YYYY-MM/ và kiểm tra cây thư mục
├── Vincass/
│   └── Vinacas.xlsx          # Bộ dữ liệu đối soát chéo lịch sử từ Hiệp hội Vinacas (757 bản ghi)
├── web/                      # Giao diện Web Dashboard (SPA Dark BI / Gold Theme)
│   ├── index.html            # Giao diện chính (Bộ chọn năm Dropdown, Luồng XNK, Phiên bản)
│   ├── style.css             # Thiết kế chuẩn Dark BI / Gold Theme Dan On Foods
│   └── app.js                # Xử lý logic lọc, biểu đồ Chart.js, bản đồ Leaflet, xuất báo cáo
├── output/                   # Kho dữ liệu chuẩn hóa
│   ├── YYYY/YYYY-MM/         # Thư mục từng tháng báo cáo
│   │   ├── YYYY-MM_cashew.xlsx     # File Master 6 Sheet (Gộp XNK, Cán cân, Vinacas)
│   │   ├── YYYY-MM_manifest.json   # Metadata kiểm soát chất lượng & trạng thái OCR
│   │   ├── Xuat_Khau/              # 📁 THƯ MỤC XUẤT KHẨU
│   │   │   ├── YYYY-MM_xuat_khau.xlsx  # Excel XK 3 sheet
│   │   │   └── PDF 2X/5X mọi phiên bản SB/DC/CT
│   │   ├── Nhap_Khau/              # 📁 THƯ MỤC NHẬP KHẨU
│   │   │   ├── YYYY-MM_nhap_khau.xlsx  # Excel NK 3 sheet
│   │   │   └── PDF 2N/5N mọi phiên bản SB/DC/CT
│   ├── data/
│   │   ├── YYYY_cashew.json        # Database JSON từng năm
│   │   └── all_years_cashew.json   # Database JSON toàn bộ các năm (2020–2026 + Vinacas)
│   ├── qc/                         # Báo cáo kiểm soát chất lượng (QC Report CSV/JSON)
│   └── all_years_cashew.xlsx       # Workbook tổng hợp 7 sheet (Tong_Quan, Can_Can, XK, NK, Phien_Ban, Vinacas, Tong_XK)
├── requirements.txt          # Thư viện phụ thuộc
├── docs/                     # 📚 Tài liệu chi tiết từng module
│   ├── README_01_WORKFLOW.md         # Tổng quan luồng dữ liệu và cách vận hành
│   ├── README_02_ORCHESTRATOR.md     # Walkthrough main.py + pipeline/paths.py
│   ├── README_03_INGESTION_OCR.md    # Walkthrough scraper.py + ocr_pipeline.py
│   ├── README_04_AGGREGATION.md      # Walkthrough data_builder.py + vinacas_ytd.py
│   └── AUDIT_MULTI_VERSION_OCR.md    # Plan đa phiên bản SB/DC/CT (đã implement)
└── README.md
```

---

## 2. Quy Cách Dữ Liệu Excel Định Kỳ

### A. File Master Tháng `{YYYY-MM}_cashew.xlsx` (Chuẩn Đa Phiên Bản — schema v3)

|  STT  | Tên Sheet            | Nội Dung                           | Ghi Chú                                                                                       |
| :---: | :------------------- | :--------------------------------- | :-------------------------------------------------------------------------------------------- |
| **1** | `Tong_Quan_XNK`      | Tổng quan hợp nhất **TẤT CẢ phiên bản** (SB/DC/CT) của 2 luồng XK & NK | Mỗi phiên bản 1 dòng, kèm file nguồn PDF. Dòng fallback tô vàng nhạt `#FFF3CD`. |
| **2** | `Can_Can_Thuong_Mai` | Cán cân thương mại hạt điều        | Net USD ($Val_{XK} - Val_{NK}$), Net Tấn, Net YTD — dùng summary phiên bản ưu tiên cao nhất. |
| **3** | `XK_ChinhThuc`       | XK theo quốc gia — phiên bản **Chính thức** | Quốc gia + dòng Other riêng của phiên bản + cột `debug_source_file`. |
| **4** | `XK_DieuChinh`       | XK theo quốc gia — phiên bản **Điều chỉnh** | Tách riêng để tránh nhầm lẫn giữa các phiên bản. |
| **5** | `XK_SoBo`            | XK theo quốc gia — phiên bản **Sơ bộ** | Chỉ tạo khi kỳ đó có PDF phiên bản tương ứng. |
| **6** | `NK_ChinhThuc` / `NK_DieuChinh` / `NK_SoBo` | NK theo quốc gia — tách theo phiên bản | Cấu trúc giống sheet XK. |
| **7** | `Lich_Su_Phien_Ban`  | Lưu vết các phiên bản TCHQ         | Đối chiếu số liệu giữa `Sơ bộ (VN-SB)`, `Điều chỉnh (VN-DC/DC2)`, `Chính thức (VN-CT)`. |
| **8** | `Vinacas_Doi_Chieu`  | Số liệu đối soát Vinacas           | Trích xuất các dòng cùng kỳ từ `Vinacas.xlsx` để so sánh chéo.                                |

**Cột debug truy vết nguồn** (trong các sheet quốc gia): `debug_source_file` (tên PDF), `debug_source_type` (pdf/backfill/calculated), `debug_source_note` (chi tiết tính toán).

### B. Cấu Trúc 2 Thư Mục Riêng (`Xuat_Khau/` và `Nhap_Khau/`)

Mỗi tháng chứa 2 thư mục con độc lập. Mỗi folder có workbook luồng và tất cả PDF TCHQ thuộc luồng đó, gồm mọi phiên bản SB/DC/CT:

- **`Xuat_Khau/`**:
  1. `{YYYY-MM}_xuat_khau.xlsx` _(3 sheet: Tong_Quan_XK, XK_Theo_Nuoc, Lich_Su_Phien_Ban)_
  2. PDF báo cáo 2X/5X ở các phiên bản SB/DC/CT đang có
- **`Nhap_Khau/`**:
  1. `{YYYY-MM}_nhap_khau.xlsx` _(3 sheet: Tong_Quan_NK, NK_Theo_Nuoc, Lich_Su_Phien_Ban)_
  2. PDF báo cáo 2N/5N ở các phiên bản SB/DC/CT đang có

---

## 3. Workflow Chi Tiết Của Từng Bộ Code

```mermaid
flowchart LR
    A["main.py (Điều phối)"] --> B["pipeline/scraper.py (Cào TCHQ)"]
    B --> C["Tải PDF 2X, 5X, 2N, 5N"]
    C --> D["pipeline/ocr_pipeline.py (OCR & Fallback)"]
    D --> E["Sinh Master 6 Sheet & 2 Folder Xuat_Khau / Nhap_Khau"]
    E --> F["pipeline/data_builder.py (Tổng hợp)"]
    F --> G["all_years_cashew.xlsx (+ Sheet Vinacas) & all_years_cashew.json"]
    G --> H["web/ (Dashboard SPA)"]
```

### 1. `main.py` — Điều phối toàn hệ thống

- Quản lý chế độ chạy: Tương tác (`interactive`), dải năm (`--from-year --to-year`), danh sách năm (`--years`), hoặc kỳ đơn lẻ (`--period`).
- **Smart Cache (`_is_cached`)**: Tự động kiểm tra tính đầy đủ của cả 2 luồng. Nếu kỳ nào thiếu thư mục `Nhap_Khau` hoặc thiếu số liệu NK, hệ thống tự động kích hoạt cào và OCR bổ sung mà không bỏ qua.
- Tự động gọi `data_builder.build_all_years()` sau khi hoàn tất.

### 2. `pipeline/scraper.py` — Cào dữ liệu đa luồng & đa phiên bản

- Sử dụng Playwright quét bảng danh sách công bố định kỳ của TCHQ.
- **Regex mềm (`_row_kind`)**: Nhận diện chuẩn xác cả 4 loại báo cáo kể cả khi TCHQ thay đổi dấu câu (dấu phẩy `,`, dấu gạch `/`, khoảng trắng):
  - `export_summary` (2X) & `export_country` (5X)
  - `import_summary` (2N) & `import_country` (5N)
- Quét đủ cả 3 cột trạng thái: **`Sơ bộ`**, **`Điều chỉnh`**, và **`Chính thức`**.

### 3. `pipeline/ocr_pipeline.py` — Bóc tách bảng, Fallback toán học & Phân bổ thư mục

- Nhận diện loại báo cáo từ nội dung văn bản (`detect_report_info`).
- Bóc tách số liệu hạt điều: Lượng, Trị giá, % tháng trước, YTD, YoY, đơn giá.
- **Cơ chế Fallback toán học**: Tự động suy ngược tháng $M$ từ tháng $M+1$:
  $$
  Q_M = \frac{Q_{M+1}}{1 + \frac{\%\Delta Q_{M+1}}{100}}, \quad V_M = \frac{V_{M+1}}{1 + \frac{\%\Delta V_{M+1}}{100}}
  $$
- Tạo file Master 6 Sheet và phân bổ toàn bộ PDF hợp lệ vào folder XK/NK theo mã báo cáo.

### 4. `pipeline/data_builder.py` — Hợp nhất đa năm & Nhúng Vinacas

- Hợp nhất tất cả các kỳ trong `output/` vào file `output/all_years_cashew.xlsx`.
- **Nhúng Vinacas**: Nạp trực tiếp 757 dòng dữ liệu từ `Vincass/Vinacas.xlsx` thành Sheet độc lập **`Vinacas`**.
- Tính toán Cán cân thương mại ($Val_{XK} - Val_{NK}$) cho từng tháng và xuất file JSON tối ưu `output/data/all_years_cashew.json`.

### 5. `web/` — Web Dashboard phân tích trực quan

- **Bộ lọc Dropdown Năm (`#fb-year-select`)**: Chuyển đổi nhanh giữa `Tất cả năm (All)`, `2026`, `2025`, `2024`, `2023`, `2022`, `2021`, `2020`.
- **Chuyển đổi Luồng (`#fb-flow`)**: Chuyển tức thì giữa **Xuất khẩu**, **Nhập khẩu**, và **Cán cân**.
- **Chuyển đổi Phiên bản (`#fb-version`)**: Tối ưu (Hợp nhất), Chính thức, Điều chỉnh, Sơ bộ.
- **Badge Fallback**: Tự động bật thông báo `⚡ Ước tính (Fallback)` kèm giải trình nguồn khi chọn kỳ dùng số liệu suy ngược.

**Nguồn tự nạp:** Dashboard đọc `output/all_years_cashew.xlsx`, gồm các sheet TCHQ và `Vinacas`. JSON toàn năm được tạo từ cùng các bản ghi để trao đổi và đối soát, không phải nguồn nạp trang.

**Upload workbook:** Bộ nạp Excel phân loại workbook theo cấu trúc sheet. Workbook All Years có sheet `Vinacas` vẫn được nhận dạng là TCHQ + Vinacas tổng hợp; chỉ workbook Vinacas độc lập mới đổi sang nguồn Vinacas.

---

## 4. Hướng Dẫn Chạy & Cập Nhật Cấu Trúc Toàn Bộ Các Năm

### 🚀 Bảng Lệnh Nhanh — Toàn Bộ Chức Năng

| # | Chức năng | Lệnh |
|---|-----------|------|
| 1 | Cào + OCR 1 kỳ mới từ TCHQ | `python main.py --period 2026-10` |
| 2 | 1 kỳ dùng PDF có sẵn trong `TCHQ/Export/` | `python main.py --period 2026-09 --fixture` |
| 3 | Dải năm liên tục (1 lượt quét TCHQ) | `python main.py --from-year 2020 --to-year 2026` |
| 4 | Năm chọn riêng | `python main.py --years 2020,2022-2025` |
| 5 | **Tái OCR toàn bộ từ PDF sẵn có** (không mạng) | `python main.py --from-year 2020 --to-year 2026 --reuse-pdfs --force` |
| 6 | Bù kỳ thiếu (YTD Diff + YoY) + rebuild all-years + QC | `python main.py --backfill` |
| 7 | Bỏ qua smart cache / dọn FDI | thêm `--force` / `--clean` |
| 8 | Debug scraping (hiện browser, giới hạn trang) | `--headed`, `--max-pages 2`, `--captcha manual` |
| 9 | Chọn engine OCR | `--ocr-engine auto\|pdfplumber\|paddle\|vietocr` |
| 10 | Đổi kho output | `--output-root <đường-dẫn>` |
| 11 | OCR standalone nhiều kỳ | `python pipeline/ocr_pipeline.py --period-from 2020-01 --period-to 2026-09` |
| 12 | OCR standalone 1 kỳ / tự kỳ tháng trước | `python pipeline/ocr_pipeline.py --period 2025-09` / `--period-auto` |
| 13 | Rebuild JSON từng năm + all-years | `python pipeline/data_builder.py` / `--year 2025` / `--period 2025-09` |
| 14 | Build all-years / backfill riêng | `python pipeline/data_builder.py --all-years` / `--backfill` |
| 15 | Scraper standalone (debug) | `python pipeline/scraper.py --source tchq --period 2026-09 --mode online` |
| 16 | Mở web dashboard | `python pipeline/serve_dashboard.py` (→ http://127.0.0.1:8080) |
| 17 | Audit kỳ thiếu / Other row / đa phiên bản | `python diagnostics/audit_other_row.py` · `check_which_periods_new.py` · `verify_multiversion.py` |

> 📚 **Bộ tài liệu kỹ thuật (docs/):**
> [README_01_WORKFLOW.md](docs/README_01_WORKFLOW.md) — tổng quan workflow end-to-end ·
> [README_02_ORCHESTRATOR.md](docs/README_02_ORCHESTRATOR.md) — `main.py` + `pipeline/paths.py` ·
> [README_03_INGESTION_OCR.md](docs/README_03_INGESTION_OCR.md) — `scraper.py` + `ocr_pipeline.py` ·
> [README_04_AGGREGATION.md](docs/README_04_AGGREGATION.md) — `data_builder.py` + `vinacas_ytd.py`

### Cách 1: Chạy Tự Động Toàn Diện (Khuyên dùng khi cần cào bổ sung NK cho toàn bộ 2020–2026)

Lệnh này sẽ tự động kiểm tra, cào các PDF còn thiếu từ TCHQ, bóc tách OCR, tạo workbook theo luồng và workbook master cho toàn bộ các năm:

```powershell
python main.py --from-year 2020 --to-year 2026
```

Để đặt kho output ở vị trí khác, thêm `--output-root <đường-dẫn>`.

### Cách 2: Chạy lại OCR từ PDF đã có trong folder XK/NK

Nếu các PDF đã nằm trong `Xuat_Khau/` và `Nhap_Khau/`, có thể chạy OCR lại mà không cần mở trình duyệt cào mạng:

```powershell
python main.py --from-year 2020 --to-year 2026 --reuse-pdfs --force
```

Hoặc chạy trực tiếp qua OCR standalone:

```powershell
python pipeline/ocr_pipeline.py --period-from 2020-01 --period-to 2026-09
```

### Cách 3: Đồng Bộ Lại File All-Years & Web Dashboard JSON

Sau khi dữ liệu các kỳ được cập nhật, chạy lệnh sau để làm mới file Excel tổng hợp (kèm sheet `Vinacas`) và cơ sở dữ liệu JSON cho web:

```powershell
python pipeline/data_builder.py
```

Hoặc **tự động bù dữ liệu thiếu** (YTD Diff + YoY Proxy) rồi build all-years:

```powershell
python main.py --backfill
```

Lệnh trên dựng workbook/JSON tổng hợp và ghi đối soát tại `output/qc/aggregate_reconciliation.json` (yêu cầu status `ok`).

**Output all-years (schema v3):**

```
output/
├── all_years_cashew.xlsx               # Workbook tổng hợp đầy đủ (tất cả phiên bản)
├── all_years_cashew_ChinhThuc.xlsx     # Chỉ phiên bản Chính thức (Tong_Quan + XK/NK)
├── all_years_cashew_DieuChinh.xlsx     # Chỉ phiên bản Điều chỉnh
├── all_years_cashew_SoBo.xlsx          # Chỉ phiên bản Sơ bộ
└── data/all_years_cashew.json          # 1 file JSON duy nhất (web load từ đây)
```

### Chuẩn hóa cây thư mục hiện có

Script mặc định chỉ preview, không di chuyển file:

```powershell
python restructure_output.py
```

Áp dụng việc sắp xếp sau khi xem preview, rồi kiểm tra cấu trúc:

```powershell
python restructure_output.py --execute --report output/qc/restructure_report.json
python restructure_output.py --verify
```

Script không ghi đè file đích. Trùng nội dung được gộp sau khi so hash; trùng tên khác nội dung được giữ thành file riêng có hậu tố hash. PDF được chuyển theo luồng vào `Xuat_Khau/` hoặc `Nhap_Khau/`; layout mới không tạo `pdfs/`. Verify báo nếu còn thư mục legacy hoặc tệp trong đó. `migration_plan.json` là kế hoạch cũ có đích `output/YYYY/xlsx/`; không dùng file đó.

Sau khi dựng workbook và JSON aggregate, `output/qc/aggregate_reconciliation.json` ghi kiểm tra sheet, header, bản ghi trùng và đối chiếu lượng/trị giá theo nguồn, kỳ, luồng và quốc gia.

### Cách scraper xử lý phiên bản

Chế độ dải năm quét trang TCHQ một lượt cho toàn bộ kỳ. Khi thứ tự thời gian giữa các trang xác nhận đang đi từ mới đến cũ, scraper dừng sau kỳ cũ nhất cần lấy. Mọi PDF hợp lệ được lưu trực tiếp vào folder luồng tương ứng: 2X/5X trong `Xuat_Khau/`, 2N/5N trong `Nhap_Khau/`, gồm mọi phiên bản SB/DC/CT. OCR đọc PDF từ hai folder luồng, giữ lịch sử summary theo phiên bản và chỉ dùng một phiên bản nhất quán để tính pivot quốc gia.

### Chạy 1 Kỳ Đơn Lẻ Để Thử Nghiệm:

```powershell
python main.py --period 2025-09
```

---

## 5. Khởi Chạy Web Dashboard

> **⚠️ QUAN TRỌNG:** Dashboard **PHẢI** chạy qua HTTP server, không mở trực tiếp file `index.html`.
> Mở qua `file://` sẽ bị browser block `fetch()` → dữ liệu không load được.

### Cách 1: Dùng server tích hợp (Khuyên dùng)

```powershell
python pipeline/serve_dashboard.py
```

Truy cập: http://127.0.0.1:8080

> Lưu ý: helper hiện nằm trong `pipeline/`, nhưng đường dẫn `web/` và `output/` bên trong script đang được resolve tương đối với chính thư mục đó. Xem [README_01_WORKFLOW.md](docs/README_01_WORKFLOW.md) trước khi dùng; đường dẫn server cần được sửa để khớp cây thư mục dự án.

Server tự động map:
- `/output/...` → `output/...`
- `/data/...` → `output/data/...`

### Cách 2: Python built-in server

```powershell
cd web
python -m http.server 8088
# Truy cập: http://127.0.0.1:8088/index.html
```

### Cách 3: Mở trực tiếp (CHỈ dùng để xem giao diện, không có dữ liệu)

```powershell
start web\index.html
```
→ Dashboard sẽ hiển thị thông báo yêu cầu khởi động server.

---

## 6. Xuất Dữ Liệu — Export UX Kit (`docs/MASTER_PLAN_EXPORT_UX.md`)

Mọi định dạng tải về từ tab **Dữ liệu & Xuất** đều có brand DAN ON FOOD, bảng màu web,
KPI + biểu đồ, tiếng Việt đầy đủ dấu, tôn trọng bộ lọc đang bật (năm/khu vực/tìm kiếm/
Tháng-Quý-Năm) và luồng XK/NK đang chọn. Tên file: `{period}_cashew_{xk|nk|xnk}.{ext}`.

| Format    | Nội dung file tải về                                                                                                                         |
| :-------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **HTML**  | Báo cáo tự chứa: cover + KPI + YoY + Top-10 + trend + bảng chi tiết; Ctrl+P in PDF; `?slides=1` trình chiếu                                  |
| **Excel** | ExcelJS 5 sheet: `Tong_Quan` (banner + KPI + tổng hợp XK/NK/cán cân) · `XK_Theo_Nuoc` · `NK_Theo_Nuoc` · `Bieu_Do` (ảnh chart) · `_Meta`     |
| **PDF**   | jsPDF + font Be Vietnam Pro (OFL, fetch từ CDN): cover → KPI cards + delta pill → YoY → Top-10 chart → trend → bảng chi tiết                 |
| **PPTX**  | 6+ slide: cover → KPI + delta pills → Top-10 (native bar chart) → thị phần khu vực (doughnut) → trend (line) → bảng phân trang 17 dòng/slide |
| **JSON**  | Schema chuẩn pipeline (`periods.tong_xk / tong_nk / xk_theo_nuoc / nk_theo_nuoc`) — kéo-thả lại vào dashboard là load đúng                   |
| **CSV**   | Theo luồng đang chọn (XK/NK) + filter; header sạch để round-trip                                                                             |

Kiểm thử tự động toàn bộ 6 định dạng (tải file, kiểm font tiếng Việt, native chart,
round-trip JSON):

python main.py --backfill chạy lại full lệnh quét OCR lại và chạy ra JSON và excel

```powershell
python ui_verify.py    # mở dashboard và kiểm tra workbook, bộ lọc, Vinacas, xuất file
```

> **Lưu ý:** PDF/PPTX/Excel dùng thư viện CDN (jsPDF, PptxGenJS, ExcelJS, Chart.js) —
> cần kết nối mạng khi bấm xuất; nếu offline, PDF tự fallback về font helvetica (mất dấu).
