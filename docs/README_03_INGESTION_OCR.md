# README 03 — Walkthrough scraper và OCR

Tài liệu đi theo thứ tự source của [`pipeline/scraper.py`](../pipeline/scraper.py) rồi [`pipeline/ocr_pipeline.py`](../pipeline/ocr_pipeline.py). Mỗi hàng là một nhóm statement có chung nhiệm vụ; mở line link để đọc code ngay tại chỗ.

## 1. `pipeline/scraper.py` — tìm và tải PDF

### 1.1. Imports, optional dependencies và helpers

| Dòng | Giải thích |
|---|---|
| [1–22](../pipeline/scraper.py#L1-L22) | Docstring nêu CLI riêng. Các thư viện ngoài được import trong `try/except ImportError`; dependency thiếu thành `None`, để nhánh tương ứng báo lỗi rõ ràng khi cần. Import `paths.py` hỗ trợ cả chạy như package lẫn chạy trực tiếp. |
| [24–38](../pipeline/scraper.py#L24-L38) | Khai báo root dự án, URL TCHQ/Vinacas và thứ tự cột `SCHEMA` cho workbook standalone. |
| [40–54](../pipeline/scraper.py#L40-L54) | `now()` tạo timestamp UTC; `clean()` gom whitespace; `number()` chuẩn hóa một số dạng phân cách; `sha256()` đọc file theo block 1MB để hash file lớn. |
| [56–57](../pipeline/scraper.py#L56-L57) | `Artifact` là record nhẹ cho source/path/mode/status/reason trong standalone workflow. `asdict()` được dùng khi ghi metadata. |
| [59–69](../pipeline/scraper.py#L59-L69) | `classify_report()` là classifier giản lược cho title/link; `_ascii()` bỏ dấu; `_period_matches()` kiểm tra tháng/năm trong text sau chuẩn hóa. |
| [71–84](../pipeline/scraper.py#L71-L84) | `_FDI_EXCLUDE_TERMS` gom cụm từ loại trừ. `_row_kind()` trước hết buộc period khớp, bỏ báo cáo FDI, chuẩn hóa dấu phẩy/gạch chéo rồi xác định import/export và summary/country-product. Kết quả không chắc chắn là `("unknown", "unknown")`. |

### 1.2. Tải PDF từ một kết quả

Source: [`_download_record()`](../pipeline/scraper.py#L113-L191).

1. **Tên file/metadata** (113–132): lấy href, tạo URL đầy đủ, tạo tên an toàn từ title, ánh xạ summary/country và flow sang mã 2X/5X/2N/5N, version sang CT/DC/SB; xác định thư mục đích.
2. **Cache/hash** (134–145): nếu không refresh và PDF cùng tên đã có hợp lệ, hash cũ được kiểm tra để có thể trả về `status=ok` mà không click tải lại.
3. **Tải** (147–169): ưu tiên Playwright `expect_download`; nếu click không tạo download nhưng href là PDF thì thử `requests`. Các lỗi được ghi vào artifact và file tạm bị dọn.
4. **Xác thực** (170–181): file phải tồn tại, lớn hơn ngưỡng và bắt đầu bằng `%PDF`. File không hợp lệ được chuyển sang `.invalid` hoặc xóa.
5. **Commit file** (182–191): tính SHA-256, bỏ temp nếu file đích giống; nếu khác thì atomically replace temp sang tên đích và ghi trạng thái/hash/size.

### 1.3. Scrape một kỳ và scrape nhiều kỳ

| Source | Trình tự |
|---|---|
| [`fetch_tchq_playwright()`](../pipeline/scraper.py#L192-L287) | Kiểm tra Playwright; tạo thư mục hai flow và snapshot hash baseline; mở Chromium; đợi tối đa 30 giây tìm bảng có cột Nội dung/Sơ bộ/Chính thức; tùy `captcha` có thể chờ người dùng; đọc các trang, tìm cột version, fingerprint nội dung để dừng khi trang lặp, gọi `_row_kind()` cho từng dòng và tải từng version link. `max_pages` giới hạn lượt test. |
| [`extract_reporting_period()`](../pipeline/scraper.py#L288-L302) | Tách `tháng M/YYYY` thành `YYYY-MM`; `_title_period()` chỉ giữ kỳ thuộc tập request. |
| [`fetch_tchq_multi_period()`](../pipeline/scraper.py#L303-L429) | Tạo map rỗng cho từng kỳ; quét bảng một lần; gán mỗi row đúng period được yêu cầu và download version links. Có thể early-stop khi thứ tự trang newest-first ổn định và đã đi qua kỳ cũ nhất; nếu phát hiện thứ tự đổi thì vô hiệu cutoff. Trả `downloads_by_period`. |

### 1.4. Standalone local/online và parser nhẹ

Source: [`pdf_text()` đến `main()`](../pipeline/scraper.py#L430-L548).

- [430–434](../pipeline/scraper.py#L430-L434): `pdf_text()` dùng pdfplumber lấy text tất cả trang; nếu dependency không có thì raise.
- [435–444](../pipeline/scraper.py#L435-L444): `local_candidates()` tìm file theo năm và các pattern tháng, mới nhất trước.
- [445–478](../pipeline/scraper.py#L445-L478): `fetch_online()` quét anchor PDF bằng requests/BeautifulSoup, tải link, route theo direction, kiểm tra chữ ký PDF; đây là best-effort, không phải nhánh Playwright multi-period của `main.py`.
- [479–487](../pipeline/scraper.py#L479-L487): `parse_tchq()` dùng regex để lấy dòng có mặt hàng hạt điều, nhưng chỉ tạo schema nhẹ gồm CY/YTD/đơn vị/source.
- [488–498](../pipeline/scraper.py#L488-L498): `parse_vinacas()` nhận diện dòng bắt đầu bằng số thứ tự và rút các số bằng regex. Đây là parser thử nghiệm đơn giản, không phải parser Vinacas chuẩn trong `data_builder.py`.
- [499–509](../pipeline/scraper.py#L499-L509): `write_excel()` ghi `Data`, `Metadata`, `Validation Errors` vào `cashew_normalized.xlsx`.
- [510–543](../pipeline/scraper.py#L510-L543): `run()` chọn source, online rồi local fallback theo mode; parse file; copy về folder flow; ghi workbook và `manifest.json`; exit `0` nếu có rows và không bị strict-error.
- [544–548](../pipeline/scraper.py#L544-L548): `main()` validate `--period`, cấu hình `--source`, `--mode`, `--output-root`, `--strict`, rồi dispatch.

**Phân biệt hai entry point:** luồng chính gọi Playwright (`fetch_tchq_playwright` hoặc `fetch_tchq_multi_period`). CLI scraper độc lập có `auto|online|local`, parser đơn giản và workbook riêng; không nên xem hai đường này là cùng một pipeline.

## 2. `pipeline/ocr_pipeline.py` — trích xuất, chuẩn hóa và ghi workbook

### 2.1. Khởi tạo và chuẩn hóa dữ liệu

| Dòng | Giải thích |
|---|---|
| [1–58](../pipeline/ocr_pipeline.py#L1-L58) | Imports, logger, root/output path; relative import có fallback cho chạy trực tiếp. `pdfplumber`, `pandas`, `openpyxl`, PaddleOCR được bật tùy dependency. Paddle chỉ được import và khởi tạo khi cần. |
| [61–114](../pipeline/ocr_pipeline.py#L61-L114) | Timestamp, Unicode NFC, bỏ dấu, whitespace và parser số. `clean_number(..., is_percent=True)` giữ chấm thập phân theo ngữ cảnh phần trăm; nhánh số thường ưu tiên định dạng Việt Nam `1.234.567,89`, rồi decimal comma ngắn, sau đó xử lý dấu phẩy còn lại. |
| [115–135](../pipeline/ocr_pipeline.py#L115-L135) | `is_cashew()` dùng regex sau khi bỏ dấu; `_table_has_data()` tránh nhận bảng quá ít dòng/số; `_find_col()` tìm header theo cụm ứng viên đã chuẩn hóa. |

### 2.2. Nhận diện PDF và lấy text/table

- [137–210](../pipeline/ocr_pipeline.py#L137-L210): `detect_report_info()` kết hợp tên file và text trang đầu để suy ra type/direction/version, đồng thời bỏ report FDI. Mã version trong tên file được nhận trước; nội dung là fallback cho loại report. `detect_report_type()` là wrapper, `pdf_matches_period()` kiểm tra kỳ.
- [212–237](../pipeline/ocr_pipeline.py#L212-L237): `extract_table_pdfplumber()` thử bảng PDF; nếu bảng không đủ data, thử tách dòng text theo khoảng trắng.
- [238–284](../pipeline/ocr_pipeline.py#L238-L284): `extract_table_paddleocr()` render PDF page thành ảnh, chạy OCR, sắp xếp text theo tọa độ, gom thành dòng và xóa ảnh tạm trong `finally`.
- [285–322](../pipeline/ocr_pipeline.py#L285-L322): `extract_table()` validate tên engine; `auto` thử pdfplumber trước rồi PaddleOCR. Nếu cả hai không có bảng hợp lệ thì trả danh sách rỗng và engine `none`.
- [323–341](../pipeline/ocr_pipeline.py#L323-L341): `_read_pdf_lines()` ưu tiên text-layer trực tiếp qua pdfplumber; chỉ khi không thu được text mới gọi table extraction rồi ghép cell thành dòng.

### 2.3. Parse summary và country-product

[`parse_summary()`](../pipeline/ocr_pipeline.py#L342-L433) đi theo thứ tự:

1. Đọc dòng PDF qua `_read_pdf_lines()`.
2. Hai regex phân biệt dòng đủ cặp YTD và dòng không có YTD; bắt product, unit, CY quantity/value, phần trăm và YTD.
3. Bỏ tiêu đề/nhãn bị liệt kê trong `_SKIP_SUBSTR`; chỉ giữ product khớp `is_cashew()`.
4. Gọi `clean_number()` riêng cho cột tỷ lệ với `is_percent=True`; CY/YTD dùng parser số thông thường.
5. Ghi record có direction/version, giá trị tháng/năm, average price, source file, timestamp và `is_derived=False`; trả thêm metadata engine/số dòng/parse errors.

[`parse_country_product()`](../pipeline/ocr_pipeline.py#L434-L542):

- Regex `_PRODUCT_RE` nhận dòng mặt hàng có đơn vị, hai số CY bắt buộc và cặp YTD tùy chọn.
- Khi gặp product hạt điều, parser dùng `current_country` gần nhất làm quốc gia, lấy direction/version từ report và ghi giá trị cùng source file.
- Cảnh báo nếu CY quantity/value lớn hơn YTD tương ứng.
- Các dòng không có unit có thể là header quốc gia; state machine cập nhật country hiện hành cho các product rows tiếp theo.
- Các header/nhãn cụ thể bị bỏ trước khi thêm kết quả.

### 2.4. Pivot theo version và dòng Other

Source: [`normalize_country_product()`](../pipeline/ocr_pipeline.py#L543-L695).

1. Nếu thiếu pandas thì raise; lọc chỉ sản phẩm cashew.
2. Lập `summary_by_ver`; nếu không có summary map thì dùng `preferred_summary`, rồi `backfill_summary` làm fallback.
3. Không có country rows nhưng có summary: tạo một dòng `Other` bằng toàn bộ summary cho version đó.
4. Có country rows: tìm các version hiện diện và sắp theo official → adjusted → preliminary → derived.
5. Với từng version, chọn các cột chuẩn, chuyển kiểu số sang nullable `Int64`, bảo đảm debug fields tồn tại.
6. Gộp dòng trùng theo country + product; giữ bộ debug đầu tiên; sort giảm dần theo CY trị giá.
7. Nếu có summary cùng version, tính `Other = Summary - sum(country rows)` riêng cho từng version, gắn `debug_source_type=calculated` và ghi công thức vào `debug_source_note`.
8. Trả dict `{version: DataFrame}` để workbook không trộn các phiên bản.

### 2.5. Backfill summary bị thiếu

Source: [`get_previous_period()` đến `attempt_backfill_summary()`](../pipeline/ocr_pipeline.py#L696-L856).

- Hàm kỳ lùi trả về tháng trước/same month năm trước; `_read_period_summary()` đọc summary có sẵn trong workbook cũ.
- `attempt_backfill_summary()` trước tiên lọc country rows theo đúng version.
- Tháng 01 có thể suy CY từ tổng YTD của country rows cùng version.
- Các tháng khác thử `YTD(current) - YTD(previous month)` khi cùng năm và cả lượng/trị giá đều tăng.
- Nếu không tính được YTD difference, thử YoY Proxy từ cùng tháng năm trước.
- Mỗi kết quả được đánh `is_derived=True`, version `derived`, `debug_source_file=BACKFILL`, `debug_source_type` và note chi tiết; không có nguồn phù hợp thì trả `None`.

### 2.6. Excel theo kỳ, PDF folder và `run_period()`

- [857–868](../pipeline/ocr_pipeline.py#L857-L868): style header và điều chỉnh độ rộng cột.
- [869–1155](../pipeline/ocr_pipeline.py#L869-L1155): `write_excel_output()` tạo workbook theo kỳ: summary XNK mọi version, cán cân theo version ưu tiên, sheets country tách version XK/NK, lịch sử version, đối chiếu Vinacas và `_Meta`. Các dòng derived được tô khác màu; Other nằm trong sheet version tương ứng.
- [1156–1202](../pipeline/ocr_pipeline.py#L1156-L1202): `_copy_pdfs_to_flow_folders()` chọn PDF phù hợp và lưu vào hai folder luồng; ưu tiên CT rồi DC rồi SB trong danh sách tên file.
- [1203–1414](../pipeline/ocr_pipeline.py#L1203-L1414): `run_period()` thu thập PDF từ `pdf_dir` và flow folders; deduplicate theo hash + type + direction + version; phân loại và parse từng file; chia export/import; chọn summary ưu tiên; backfill khi thiếu; normalize country rows; ghi workbook, copy PDFs, tổng hợp validation errors và ghi manifest (giữ scrape metadata cũ nếu có). Khi `update_data=True`, gọi `data_builder.update_period_data()`.
- [1415–1425](../pipeline/ocr_pipeline.py#L1415-L1425): `iter_periods()` tạo danh sách kỳ inclusive giữa hai đầu.
- [1426–1523](../pipeline/ocr_pipeline.py#L1426-L1523): CLI standalone hỗ trợ kỳ, range, kỳ tháng trước, PDF dir, output root, engine `auto|pdfplumber|paddle`, `force`, hoặc prompt tương tác; lỗi một kỳ không ngăn batch tiếp tục các kỳ sau.

## 3. Luồng dữ liệu một câu

`PDF → detect_report_info → _read_pdf_lines → parse_summary/parse_country_product → version-specific normalize + optional backfill → write_excel_output + manifest → data_builder`.

Đọc tiếp: [README_02_ORCHESTRATOR.md](README_02_ORCHESTRATOR.md) cho lệnh gọi/điều phối; [README_04_AGGREGATION.md](README_04_AGGREGATION.md) cho bước đọc lại workbook thành dữ liệu dashboard.
