# Master plan điều tra OCR — dữ liệu 2020–2024

**Trạng thái:** điều tra hoàn tất ở mức mã nguồn, manifest và file hiện có; chưa sửa parser, chưa scrape lại và chưa ghi đè workbook.  
**Phạm vi:** `code/main.py`, `code/pipeline/ocr_pipeline.py`, `code/pipeline/data_builder.py`, manifest/output 2020–2024, PDF nguồn còn hiện diện.

## Kết luận

Nguyên nhân chính không phải một lỗi OCR đơn lẻ. Pipeline có lỗi đường dẫn giữa bước scrape/copy và bước OCR, dữ liệu PDF gốc lịch sử không còn trong kho, nhánh multi-year báo thành công từ manifest cũ thay vì xác nhận PDF đọc được, và parser không kiểm định đủ hai báo cáo bắt buộc trước khi ghi Excel. Vì vậy:

- 2021–2024: các manifest của cả 48 tháng đều ghi `ocr.status = no_files`; parser không được gọi. Có 46 tháng mà manifest lại ghi 1–4 lượt download thành công, nhưng các đường dẫn PDF trong manifest hiện không tồn tại. Hai kỳ còn lại không có artifact ngay từ bước scrape. Không có PDF lịch sử nào trong `TCHQ/Export` cho các năm 2020–2024.
- 2020: 8 workbook có dung lượng và dữ liệu; 4 tháng còn lại có manifest `no_files` và file xlsx 0 byte dạng cũ. Các PDF còn lại trong `output/2020/pdfs` cho phép nhận diện lỗi schema/parser bổ sung: báo cáo quốc gia thường bị thiếu ở các kỳ có tên file `5X.pdf` hoặc tên không có tháng; một vài kỳ ghi workbook dù thiếu một trong hai bảng cần thiết.
- Môi trường code hiện tại còn lỗi cấu trúc mới: PDF được gom vào `output/YYYY/pdfs`, nhưng OCR dò `output/YYYY-MM/pdfs`. OCR chạy qua `run_years` dùng `TCHQ/Export/YYYY-MM`, song `TCHQ/Export` hiện chỉ có PDF 2025 dạng flat, không có PDF ở thư mục kỳ lịch sử.

## Bằng chứng và nguyên nhân gốc

| ID | Mức | Nguyên nhân | Bằng chứng |
|---|---|---|---|
| A1 | P0 | PDF lịch sử đã tải trước đó không còn tại `TCHQ/Export/YYYY-MM` | Manifest 2020–2024 chứa `local_path` và SHA256 nhưng `Test-Path` trả false cho toàn bộ; `TCHQ/Export` chỉ có 12 PDF 2025 tên `Export detail -MM25 -TCHQ.pdf`. |
| A2 | P0 | OCR không tìm kho PDF mới theo cấu trúc năm | `_copy_pdfs` ghi `output/YYYY/pdfs/`; `run_period` chỉ tìm `pdf_dir` và `output/YYYY-MM/pdfs/`. Không quét `output/YYYY/pdfs` theo tên kỳ. |
| A3 | P0 | Multi-year bỏ qua kiểm tra tính tồn tại của PDF trước OCR | `run_years` nhận các record `status=ok`, gọi `_copy_pdfs`, rồi gọi `_ocr_period` nếu list `valid` không rỗng. `_copy_pdfs` trả 0 nếu `local_path` mất; nhưng caller không dùng kết quả này để loại record và OCR vẫn được gọi. Sau đó OCR trả `no_files`. |
| A4 | P1 | Cache kiểmнима theo xlsx+PDF ở kho cũ, còn lỗi đầu ra | `_is_cached` coi xlsx bất kỳ dung lượng >0 cùng PDF hợp lệ trong `TCHQ/Export/YYYY-MM` là cache; không kiểm tra manifest `summary_rows/pivot_rows`, không kiểm tra schema hoặc file theo kỳ ở kho `output/YYYY/pdfs`. |
| A5 | P1 | Parser country/product dựa tên file để phân loại, tên `5X.pdf` không đủ hint | `detect_report_type` phân loại dựa filename và text trang đầu. Tên `5X.pdf` không nói loại báo cáo; nếu PDF text không được pdfplumber trích xuất đúng, nó thành `unknown`. Manifest 2020-02 cho thấy 2 artifact country/product trỏ cùng `5X.pdf`, nhưng OCR artifact list chỉ có report summary — PDF B không được parse. |
| A6 | P1 | OCR gọi dò table/OCR dù parser đã lấy text bằng pdfplumber | `parse_summary` và `parse_country_product` gọi `extract_table(pdf, ocr_engine)` chỉ để lấy nhãn `engine`; trong `auto`, nếu bảng pdfplumber không qua ngưỡng `_table_has_data`, có thể khởi tạo PaddleOCR. Điều này có thể kéo chậm hoặc làm nhánh OCR nặng dù PDF có text; kiểm tra trực tiếp trong phiên bị kéo dài khi Paddle/TensorFlow khởi tạo. |
| A7 | P1 | Workbook được ghi dù chỉ parse được một trong hai báo cáo | `run_period` luôn gọi `write_excel_output` và ghi `status: ok`, kể cả `summary_rows=0` hoặc country rows rỗng. Bằng chứng: 2020-02 có 1 summary, 0 country; 2020-05 có 0 summary, 31 pivot. Đây không thỏa format dữ liệu yêu cầu. |
| A8 | P1 | Summary parser đang quá cứng theo vị trí cột | Regex `_LINE_RE` bắt buộc hai số CY, hai số %, và sau đó chờ YTD; regex fallback cũng bắt buộc hai trường % trước cặp YTD. Biến thể bảng thiếu/tái bố trí cột có thể làm rớt dòng điều; bằng chứng workbook 2020-05 thiếu summary, nhưng cần tái chạy parser trên PDF tương ứng để chốt riêng. |
| A9 | P2 | Khởi tạo số tháng `Txx` và tên file không chuẩn gây nhân đôi/không khớp | Manifest 2020-02 có 2 record country/product cùng URL, cùng hash và local filename `5X.pdf`; scraper không khử trùng record trước copy/parse. `pdf_matches_period` cũng không đáng tin cho dạng `T01`/năm trong tên. |

## Mức độ dữ liệu hiện tại

- 2020: 8/12 workbook usable theo tiêu chí chỉ kiểm tra workbook có dữ liệu; trong đó chỉ các workbook có summary và country sheet cùng dữ liệu mới được xem là đúng format. 2020-02 và 2020-05 chắc chắn thiếu một bảng theo manifest; 2020-01 country sheet chỉ có header dù OCR manifest trước đó từng ghi 31 pivot rows, nên workbook và manifest hiện tại không nhất quán.
- 2021–2024: 0/48 workbook usable; tất cả file `YYYY-MM-cashew.xlsx` kiểu gạch nối có dung lượng 0. Manifest đúng kỳ nằm tên underscore và báo `no_files`.
- Tổng hợp JSON/Excel hiện tại chỉ phản ánh 8 tháng 2020 được `data_builder` đọc thành công; không đại diện đủ 2020–2024.

## Kế hoạch khắc phục (chưa thực thi)

### Phase 1 — Khoanh đúng nguồn PDF và khôi phục an toàn

1. Chốt vị trí PDF canonical: `TCHQ/Export/YYYY-MM/` làm raw archive và `code/output/YYYY/pdfs/` làm bản gom theo năm.
2. Sửa `run_period` tìm thêm `output/YYYY/pdfs` nhưng lọc theo kỳ chắc chắn từ title/metadata/chuẩn tên; không fallback lấy toàn bộ PDF của năm cho mỗi tháng.
3. Sửa `_copy_pdfs` để khi đích đã có cùng tên nhưng hash khác thì ghi tên duy nhất; khử trùng theo SHA256, không dựa filename.
4. Tạo inventory khớp manifest ↔ file thật ↔ SHA256; tải lại các PDF thiếu cho 2020–2024 vào đúng thư mục kỳ. Không đánh dấu kỳ thành công chỉ từ `status=ok` cũ.

**Nghiệm thu:** mỗi artifact có PDF tồn tại, magic `%PDF`, hash xác minh; không còn kỳ nào chạy OCR từ file của kỳ khác.

### Phase 2 — Phân loại và parse theo nội dung, không phụ thuộc tên

1. Dùng `_row_kind`/title scraper đã biết làm loại báo cáo ưu tiên; với file đã lưu, nhận diện bằng tiêu đề trong text trang đầu. Tên `5X.pdf` không được phân loại là `unknown` nếu text chỉ rõ bảng quốc gia.
2. Tách trích xuất text pdfplumber khỏi table/OCR. PDF có text phải đi parser text trực tiếp, không khởi tạo PaddleOCR chỉ để gán nhãn engine.
3. Chuẩn hóa parser summary cho các layout lịch sử; kiểm thử từng biến thể header/dòng, đảm bảo lấy hàng “Hạt điều” và số CY/YTD đúng.
4. Chuẩn hóa parser country/product để giữ đúng quốc gia, sản phẩm, đơn vị và 4 trường số; kiểm tra fill-down và chống header/total bị nhận thành quốc gia.
5. Thêm khử trùng PDF trước parse để một báo cáo không tạo duplicate records.

**Nghiệm thu:** mỗi kỳ có đúng loại báo cáo theo nguồn; số hàng tổng Hạt điều = 1 (hoặc có lý do cụ thể), có dữ liệu country/product khi báo cáo nguồn cung cấp; không nhân đôi.

### Phase 3 — Bảo vệ đầu ra và cache

1. Không ghi đè workbook hợp lệ bằng workbook rỗng/thiếu bảng; ghi trạng thái `partial`/`failed` và giữ manifest chẩn đoán.
2. Cache chỉ coi là hoàn chỉnh nếu workbook mở được, có cả 2 sheet với dòng dữ liệu đạt yêu cầu, manifest báo số dòng dương, và PDF nguồn còn xác minh được.
3. Thống nhất tên Excel một định dạng `YYYY-MM_cashew.xlsx`; dọn file 0-byte `YYYY-MM-cashew.xlsx` sau khi đã giữ manifest/inventory phục vụ đối chiếu.
4. Sau mỗi năm, dựng lại `YYYY_cashew.json`; sau toàn bộ đợt, dựng `all_years_cashew.xlsx` và `all_years_cashew.json`.

### Phase 4 — Chạy lại và kiểm định 2020–2024

1. Dùng chế độ force có log rõ ràng, scrape/recover đủ 60 kỳ (2020–2024), rồi chạy OCR.
2. Xuất báo cáo QC dạng CSV/JSON: kỳ, PDF A/B, SHA256, report type, summary rows, country rows, trạng thái schema, lỗi.
3. Kiểm tra mẫu đầu-cuối mỗi năm và kỳ có khác biệt layout; đối chiếu các số trong PDF với Excel.
4. Chỉ khi toàn bộ QC qua mới thay file tổng JSON/Excel.

## Tiêu chí nghiệm thu tổng

- Mỗi kỳ trong 2020–2024 có manifest mới, không giữ lại `no_files` cũ nếu đã được xử lý.
- Các PDF đầu vào tồn tại và được phân loại theo nội dung; không dùng dữ liệu 2025 nhầm vào lịch sử.
- Mỗi workbook hợp lệ mở được, chứa `Tong_XK` và `XK_Theo_Nuoc`, dữ liệu kỳ khớp tên file; không có workbook 0-byte hoặc chỉ header được coi là thành công.
- `all_years_cashew.xlsx` và `all_years_cashew.json` chứa tất cả các kỳ QC đạt; số kỳ và năm được ghi rõ.
- Dashboard nạp JSON tổng và hiển thị được kỳ lịch sử.

## Quyết định hiện tại

Chưa chạy lại scraper/OCR và chưa ghi lại workbook, vì ưu tiên của người dùng là tìm nguyên nhân và lập plan trước. Bước triển khai tiếp theo là Phase 1 (inventory/recovery), sau đó sửa parser và mới rebuild output tổng.
