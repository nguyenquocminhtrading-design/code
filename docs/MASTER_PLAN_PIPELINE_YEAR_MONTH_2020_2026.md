# Master plan — pipeline độc lập theo module, lưu chuẩn năm/tháng

## Mục tiêu người dùng

Lấy thư mục gốc dữ liệu tại `code/output` và chuẩn hóa kho theo dạng:

```text
code/output/
  2020/2020-01/...
  2020/2020-02/...
  ...
  2026/2026-12/...
  data/all_years_cashew.json
  all_years_cashew.xlsx
```

Chạy hết 2020–2026. Mỗi module phải chạy độc lập qua CLI/API, nhưng `main.py` phải có khả năng gọi chúng thành một pipeline đầy đủ:

```text
scrape → archive PDFs → OCR/parse → validate → monthly Excel/manifest
      → per-year + all-years JSON/Excel → QC report
```

## Phát hiện hiện trạng

1. `code/output/<năm>` hiện chứa Excel/manifest theo tháng ngay trong thư mục năm; PDF dồn tại `code/output/<năm>/pdfs`. Chưa có thư mục con tháng làm nơi chứa toàn bộ artifact của tháng.
2. `pipeline/scraper.py` standalone ghi output kiểu `output/YYYY-MM`, và kho source mặc định là `ROOT/<source>/raw/YYYY-MM`; khác với main và OCR.
3. `main.py` lưu Excel/manifest tại `output/YYYY/`, PDF tại `output/YYYY/pdfs/`, và chỉ các module output khác mới dùng `output/YYYY-MM`.
4. `ocr_pipeline.run_period` ghi workbook theo năm nhưng tự tìm PDF ở `output/YYYY-MM/pdfs`; đường dẫn này không trùng với nơi main copy PDF.
5. Cache `_is_cached` kiểm tra workbook và PDF trong `TCHQ/Export/YYYY-MM`, nhưng không xác thực đủ hai sheet, row count, manifest hay hash nguồn.
6. `data_builder` tìm Excel ở `output/YYYY/`; đổi layout cần hỗ trợ cả layout cũ trong giai đoạn migrate.
7. Các PDF lịch sử 2020–2024 không còn tại đường dẫn trong manifest; `TCHQ/Export` hiện chỉ có PDF 2025 flat. Để chạy lại 2020–2024 cần khôi phục/tải lại PDF. Không được suy ra OCR thành công từ manifest cũ.
8. Năm 2026 có thể chưa đủ 12 kỳ tại thời điểm chạy. Kỳ tương lai/chưa công bố phải được báo `not_available`/`no_source`, không tính là lỗi parse hay tạo workbook rỗng giả.

## Layout đích (canonical)

Mỗi kỳ giữ trọn artifact tháng trong thư mục của tháng:

```text
code/output/YYYY/YYYY-MM/
  pdfs/                         # PDF đầu vào chuẩn hóa theo kỳ
  YYYY-MM_cashew.xlsx           # workbook hợp lệ
  YYYY-MM_manifest.json         # scrape + OCR + validation + artifact paths
```

Các file tổng:

```text
code/output/data/YYYY_cashew.json
code/output/data/all_years_cashew.json
code/output/all_years_cashew.xlsx
code/output/qc/2020-2026_qc.csv
code/output/qc/2020-2026_qc.json
```

PDF raw source ngoài output có thể giữ nguyên để tương thích; bản kiểm định/archival theo từng kỳ trong output là nguồn tự đủ (self-contained) cho OCR-only rerun. Không xóa hay di chuyển file cũ cho tới khi inventory xác nhận hash và bản đích.

## Public API/CLI — mọi module độc lập

| Module | Python API | CLI dự kiến | Vai trò |
|---|---|---|---|
| `pipeline.scraper` | `scrape_period(period, output_dir, ...)`, `scrape_periods(periods, output_root, ...)` | `python code/pipeline/scraper.py --period 2020-01 --output-root code/output`; hỗ trợ `--period-from/--period-to` hoặc `--years 2020-2026` | Tìm, tải, hash và lưu PDF vào `YYYY/YYYY-MM/pdfs`; kết quả chuẩn hóa dạng record. |
| `pipeline.ocr_pipeline` | `run_period(period, pdf_dir=None, output_root=None, ...)`, `run_periods(periods, ...)` | `python code/pipeline/ocr_pipeline.py --period 2020-01 --output-root code/output`; range/năm; `--pdf-dir` override | Đọc archive theo kỳ, phân loại bằng nội dung và parse; không phụ thuộc `main`. |
| `pipeline.data_builder` | `build_year(year, output_root=None)`, `build_all_years(output_root=None)` | `python code/pipeline/data_builder.py --year 2020`; `--years 2020-2026`; `--all-years` | Dựng JSON theo năm và Excel/JSON toàn bộ từ workbook tháng hợp lệ. |
| `main.py` | `run_period`, `run_years`, `run_all` | `python code/main.py --years 2020-2026` hoặc `--period-from 2020-01 --period-to 2026-12` | Orchestrator; gọi API module, không nhân đôi logic scrape/OCR. |

Mỗi module phải có `main()`/`if __name__ == '__main__'`, trả exit code có ý nghĩa, logging cấu trúc, và nhận `output_root` thay vì tự ghép những root khác nhau. CLI parse chung format kỳ/năm.

## Kế hoạch triển khai

### Phase 0 — Inventory & bảo toàn dữ liệu

- Lập inventory toàn bộ `output`, raw TCHQ và manifest: relative path, period, byte size, SHA256, PDF magic, workbook mở được, sheet names/row counts, manifest status.
- Phân biệt file hợp lệ, file 0-byte, file trùng hash, thiếu nguồn và kỳ chưa công bố.
- Sao lưu/giữ file gốc. Không overwrite file hợp lệ trong đợt inventory.

**Nghiệm thu:** báo cáo inventory 2020–2026, tổng số artifact và từng kỳ cần khôi phục rõ ràng.

### Phase 1 — Chuẩn hóa đường dẫn và API module

- Tạo helper dùng chung để parse `YYYY-MM`, validate year/month, build `output_root/YYYY/YYYY-MM`.
- Thêm `output_root` vào scraper, OCR, data builder.
- Chuyển scraper standalone khỏi `ROOT/source/raw` và `output/YYYY-MM`; mỗi PDF được lưu vào `YYYY/YYYY-MM/pdfs`.
- OCR tìm PDF trong đúng thư mục kỳ; không quét fallback toàn bộ năm, tránh đưa PDF tháng khác vào.
- Cho phép input directory override để OCR-only chạy độc lập.
- Giữ tương thích đọc layout hiện có trong thời gian migrate; ghi đầu ra mới theo canonical layout.

**Nghiệm thu:** có thể gọi API và CLI từng module cho một kỳ; tất cả ghi/đọc cùng một canonical path.

### Phase 2 — Độ tin cậy scrape/archive

- Scraper trả download record chỉ sau khi file tồn tại, PDF magic hợp lệ, hash được tính; deduplicate theo SHA256.
- Nếu trùng tên nhưng khác hash, giữ cả hai bằng tên xác định từ kỳ + loại báo cáo + hash ngắn.
- Retry/network/Playwright failure lưu lỗi theo artifact/kỳ; không biến thành record thành công rỗng.
- Không quét nhiều năm thành một danh sách rồi gọi OCR từ các bản ghi cũ không còn file.
- Với báo cáo lịch sử không còn nguồn, ghi `source_missing` và cho phép chạy lại sau; không dùng file năm khác thay thế.

**Nghiệm thu:** mỗi PDF trong manifest có path tồn tại, hash đúng, kỳ đúng; record không còn file sẽ không vào OCR.

### Phase 3 — OCR/parser và hợp đồng workbook

- Phân loại report bằng nội dung/title trước; filename chỉ là hint. Hỗ trợ tên chung như `5X.pdf`.
- PDF có text chạy pdfplumber text parser; không khởi tạo PaddleOCR chỉ để điền engine label. Chỉ dùng OCR ảnh khi PDF scan/không có text.
- Sửa parsers cho các biến thể layout giai đoạn 2020–2026, kiểm định số format VN, dòng hàng điều và bảng country/product.
- Định nghĩa workbook complete: sheet `Tong_XK`, `XK_Theo_Nuoc`; ít nhất một summary row điều và country rows hợp lệ (trừ khi source report không phát hành bảng đó, phải ghi lý do QC rõ).
- Không ghi đè workbook tốt bằng output rỗng/partial; ghi `partial`/`failed` và lưu log. Không dùng status `ok` nếu schema/row validation fail.
- Manifest ghi rõ OCR engine, file đầu vào/hash, loại report, parsed count, validation errors, workbook path.

**Nghiệm thu:** fixture đại diện đầu/giữa/cuối từng giai đoạn; số liệu đối chiếu PDF với Excel; workbook mở được và không 0-byte.

### Phase 4 — Migration an toàn sang năm/tháng

- Tạo thư mục `YYYY/YYYY-MM/pdfs` và lưu/copy PDF vào đó theo hash.
- Đưa Excel/manifest hiện có vào `YYYY/YYYY-MM/` chỉ sau khi kiểm chứng file hợp lệ; không chuyển file 0-byte thành nguồn dữ liệu.
- Cập nhật reader data_builder để đọc canonical layout trước, layout cũ sau trong giai đoạn chuyển tiếp.
- Đánh dấu legacy files, không xóa cho đến khi QC và file tổng được xác minh.

**Nghiệm thu:** inventory trước/sau khớp hash; không mất bản nguồn; module OCR-only xử lý được từ archive mới.

### Phase 5 — Chạy 2020–2026

- Tạo 84 kỳ lịch (2020-01 đến 2026-12); xác định kỳ đã phát hành từ nguồn thực tế.
- Duyệt tuần tự theo năm/tháng. Mỗi tháng: scrape/recover → verify source → OCR → validate → write monthly workbook/manifest.
- Cache chỉ bỏ qua khi workbook và manifest đều đạt hợp đồng; `--force` chạy lại kỳ được chọn.
- Kỳ chưa có báo cáo (đặc biệt kỳ tương lai 2026) được đánh dấu `not_available`, không tạo Excel hợp lệ giả.
- Có thể resume; lỗi một tháng không dừng các tháng còn lại. Tóm tắt cuối theo status từng kỳ.

**Nghiệm thu:** QC có trạng thái cho đủ 84 kỳ; số kỳ hoàn tất, chưa công bố, thiếu nguồn, lỗi parse được tách riêng.

### Phase 6 — Dataset visualize và QC tổng

- Dựng mỗi `YYYY_cashew.json` từ các monthly workbook đạt QC.
- Dựng `all_years_cashew.json` giữ schema dashboard hiện hỗ trợ: `{generated_at, years, periods: {"YYYY-MM": {tong_xk, xk_theo_nuoc}}}`.
- Dựng `all_years_cashew.xlsx` có sheet summary và country/product với cột kỳ để lọc.
- Dashboard auto-loader đọc JSON tổng, hoặc người dùng có thể upload JSON tổng.
- Viết QC CSV/JSON cho mọi kỳ, lỗi và số dòng.

**Nghiệm thu:** JSON tổng nạp vào dashboard; periods và năm khớp workbook QC; workbook tổng lọc được theo kỳ.

## Luồng orchestration mục tiêu

`main.run_period(period)` gọi API scraper → OCR → validator; sau đó cập nhật JSON năm. `main.run_years(years)` lặp từng kỳ và tiếp tục dù tháng riêng lẻ lỗi. Khi xong batch, gọi data_builder một lần để tạo all-years JSON/Excel và QC.

`main` chỉ điều phối và quản lý cache/log/status; không chứa code download, parsing hay workbook transformation trùng với module chuyên trách.

## Lệnh mục tiêu sau triển khai

```powershell
# Một kỳ, mỗi module chạy độc lập
python code/pipeline/scraper.py --period 2020-01 --output-root code/output
python code/pipeline/ocr_pipeline.py --period 2020-01 --output-root code/output
python code/pipeline/data_builder.py --year 2020 --output-root code/output

# Toàn bộ 2020–2026 qua main
python code/main.py --years 2020-2026

# Chạy lại OCR riêng từ archive, không scrape
python code/pipeline/ocr_pipeline.py --period-from 2020-01 --period-to 2026-12 --output-root code/output

# Rebuild file tổng
python code/pipeline/data_builder.py --all-years --output-root code/output
```

## Kết quả thực thi end-to-end — 2026-10-24

### Đã triển khai

- Scraper, OCR và data builder nhận output root; output chuẩn theo `YYYY/YYYY-MM/`.
- OCR đọc canonical folder theo kỳ và legacy folder theo bộ lọc kỳ chặt hơn; không lấy hậu tố `-2X`/`-5X` làm tháng.
- PaddleOCR import trì hoãn; PDF có text không khởi tạo Paddle chỉ để gán engine.
- OCR ghi `partial` khi thiếu summary hoặc country/product; data builder loại workbook chưa đủ hai bảng.
- Data builder ưu tiên workbook canonical khi vẫn tồn tại bản legacy cùng kỳ.
- Main có `--reuse-pdfs` để chạy lại OCR từ archive mà không tải lại.
- README, CLI và API độc lập đã được kiểm tra; `py_compile` thành công cho 4 module.

### Kết quả batch 2020–2026

- Scraper quét 94 trang TCHQ và tải 160 artifact record; 144 PDF hợp lệ được đưa vào OCR theo 84 kỳ lịch.
- End-to-end: 84 kỳ được ghi manifest; 63 kỳ đạt cả summary và country/product; 16 kỳ partial; 5 kỳ không có PDF nguồn.
- Các kỳ `no_files`: 2024-07, 2024-12, 2026-10, 2026-11, 2026-12. Tháng cuối 2026 chưa được phát hành tại thời điểm chạy.
- Các kỳ `partial` chi tiết ở `output/qc/2020-2026_qc.csv` và `.json`; nguyên nhân chủ yếu là scraper chỉ tìm thấy một trong hai report 2X/5X. Riêng 2024-03 report 5X là PDF scan ~10 MB: nhận diện đúng nhưng pdfplumber trả 0 hàng; thử `auto` kéo dài quá mức và đã dừng. Cần tối ưu/render OCR scan riêng cho file này.
- File tổng được dựng từ kỳ hoàn chỉnh: `output/all_years_cashew.xlsx` (2,093 dòng dữ liệu country/product + header) và `output/data/all_years_cashew.json` (63 periods, đủ năm 2020–2026).
- Có 84 thư mục tháng; workbook/manifest mới nằm trong `YYYY/YYYY-MM/`. File legacy tại `YYYY/` được giữ nguyên để bảo toàn nguồn.

### Hạn chế còn lại

- 16 kỳ partial cần điều tra nguồn công bố: thiếu PDF loại 2X hoặc 5X; không nên tự điền từ kỳ khác.
- PDF scan 2024-03 chưa parse được bảng country/product; thử auto OCR quá chậm, chưa đạt kỳ đó.
- Excel tổng và JSON tổng chỉ bao gồm 63 kỳ đủ hai bảng; đây là chủ đích để visualization không nhận dữ liệu thiếu.
- Các file 0-byte legacy chưa bị xóa.
