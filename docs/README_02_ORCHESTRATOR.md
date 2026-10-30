# README 02 — Walkthrough `main.py` và quy ước đường dẫn

Đây là walkthrough theo thứ tự source: mỗi đoạn gom các câu lệnh cùng nhiệm vụ, có line range để mở đúng chỗ. Phạm vi: `main.py` và `pipeline/paths.py`; server chỉ được giới thiệu ở [README_01_WORKFLOW.md](README_01_WORKFLOW.md).

## 1. `main.py` — imports, cấu hình process và helpers

Source: [`main.py`](../main.py).

### 1.1. Từng hàm helper: kiểm tra và chuẩn bị PDF

| Hàm | Dòng | Đầu vào → đầu ra | Cách hoạt động và lý do tồn tại |
|---|---:|---|---|
| [`_scan_existing_pdfs()`](../main.py#L29-L46) | 29–46 | Thư mục cần quét → list artifact PDF hợp lệ. | Duyệt đệ quy `*.pdf`, loại file nhỏ hơn 100 byte và file không có magic header `%PDF`; mỗi artifact có path/local_path, mode, status, SHA-256, size và content type. Lỗi đọc một file được bỏ qua riêng để không làm hỏng toàn bộ scan. |
| [`_scan_period_pdfs()`](../main.py#L47-L58) | 47–58 | `YYYY-MM` → artifact trong hai thư mục flow chuẩn. | Ghép các kết quả từ `period_pdf_dirs()` theo thứ tự export/import, gắn direction theo folder rồi suy loại báo cáo từ mã `2X/5X/2N/5N` trong filename. Không suy được mã thì giữ `unknown`, không tự loại file PDF hợp lệ. |
| [`_period_dir()`](../main.py#L59-L62) | 59–62 | Kỳ báo cáo → `Path` folder kỳ. | Wrapper dùng `OUTPUT_DIR` hiện hành. Vì vậy sau khi CLI áp dụng `--output-root`, các chỗ gọi wrapper này cũng theo output root mới. |
| [`purge_fdi_pdfs()`](../main.py#L63-L84) | 63–84 | Root, tùy chọn một kỳ → list path đã xóa. | Chỉ tìm trong hai flow folder của kỳ hoặc các flow folder theo năm; xóa PDF khớp tên FDI/nhóm report 3N, 3X, 4. Lỗi unlink được log rồi tiếp tục; đây là thao tác có xóa file, được gọi bởi `--clean`/`--force`, không phải bước chạy mặc định. |
| [`_is_cached()`](../main.py#L85-L124) | 85–124 | Kỳ → boolean cache có thể bỏ qua pipeline. | Kiểm tra workbook chính đủ kích thước, manifest đọc được, scrape không bị đánh dấu incomplete, OCR `ok/partial` có summary hoặc pivot, cả hai flow folder có workbook và có ít nhất một PDF hợp lệ. Thiếu bất kỳ điều kiện nào trả cache miss để kỳ được chạy lại. |
| [`_copy_pdfs()`](../main.py#L125-L159) | 125–159 | Kỳ và danh sách artifact → số artifact đã đặt vào output chuẩn. | Ưu tiên direction metadata; nếu thiếu thì suy ra từ mã X/N của tên file. Giữ nguyên tên; nếu đích đã tồn tại với nội dung khác, thêm một phần hash vào tên thay vì ghi đè. Cập nhật local path, hash, kích thước và content type trên chính artifact. |
| [`_write_manifest()`](../main.py#L160-L172) | 160–172 | Kỳ, nguồn, CAPTCHA, artifacts, lỗi, kết quả OCR → path manifest. | Tạo folder kỳ rồi ghi một JSON tổng kết: số hàng scrape, cờ `scrape_complete`, xác thực download, lỗi và object OCR. Cờ complete được lưu rõ để cache có thể phân biệt lần quét đầy đủ với lượt bị giới hạn trang. |

### 1.2. Ý nghĩa từng đoạn trong `main.py`

| Dòng | Đọc lần lượt như thế nào |
|---|---|
| [1–14](../main.py#L1-L14) | Docstring ghi các chế độ CLI tiêu biểu; `__future__` bật annotation hiện đại. Imports gom argparse, I/O, JSON, logging, regex, copy file và thời gian. Ba module (`scraper`, `ocr_pipeline`, `data_builder`) là các worker; helpers đường dẫn được import riêng. |
| [16–27](../main.py#L16-L27) | Trên Windows, stdout/stderr được bọc UTF-8 để log tiếng Việt không lỗi mã hóa. `ROOT` là thư mục cha của thư mục code; `TCHQ_EXPORT` trỏ đến PDF fixture/local; `OUTPUT_DIR` khởi tạo từ helper nhưng có thể đổi bởi `--output-root`. |
| [29–46](../main.py#L29-L46) | `_scan_existing_pdfs()` duyệt đệ quy, bỏ file quá nhỏ/không có magic `%PDF`, rồi trả artifact local kèm hash/size. `OSError` được bỏ qua cho từng file không đọc được, không làm dừng cả lượt scan. |
| [47–58](../main.py#L47-L58) | `_scan_period_pdfs()` chỉ tìm trong hai thư mục flow chuẩn. Hướng giao dịch lấy từ vị trí folder; loại báo cáo `2` hay `5` suy ra từ tên file, nếu không nhận dạng được thì để `unknown`. |
| [59–62](../main.py#L59-L62) | `_period_dir()` là wrapper để mọi chỗ dùng `OUTPUT_DIR` hiện tại thay vì tự ghép đường dẫn. |
| [63–84](../main.py#L63-L84) | `purge_fdi_pdfs()` chọn folder của một kỳ hoặc quét các folder theo năm; chỉ unlink PDF khớp mẫu FDI. Lỗi từng file được ghi warning và tiếp tục. Chỉ gọi khi yêu cầu `--clean` hoặc `--force`. |
| [85–124](../main.py#L85-L124) | `_is_cached()` đòi có workbook lớn hơn 1KB và manifest. Nếu manifest xác nhận scrape incomplete, OCR status không phải `ok/partial`, không có summary/pivot, hoặc một trong hai flow folder thiếu workbook thì cache miss. Cuối cùng phải tồn tại ít nhất một PDF hợp lệ. Manifest cũ không có `scrape_complete` vẫn có thể được cache nếu các điều kiện còn lại hợp lệ. |
| [125–159](../main.py#L125-L159) | `_copy_pdfs()` ưu tiên direction trong artifact; nếu thiếu, suy ra từ mã X/N của tên file. Nếu tên đích đã tồn tại với hash khác, tạo tên có hậu tố hash để tránh ghi đè nội dung khác; cập nhật `local_path` và metadata sau copy. |
| [160–172](../main.py#L160-L172) | `_write_manifest()` ghi metadata scrape, kiểm tra tải, lỗi, OCR và boolean `scrape_complete` vào thư mục kỳ bằng UTF-8/JSON không escape tiếng Việt. |

## 2. Chạy một kỳ: `run()`

Source: [`run()`](../main.py#L173-L237).

1. **Dọn dữ liệu cũ** (173–179): `force` hoặc `clean` gọi `purge_fdi_pdfs()` cho kỳ đang xử lý.
2. **Cache gate** (181–187): nếu không ép chạy, không clean và không dùng fixture, kỳ đã đủ cache thì trả `0` ngay.
3. **Chuẩn bị thư mục và trạng thái** (188–195): tạo period dir; khởi tạo artifact/error và giả định scrape chưa hoàn tất.
4. **Fixture/local** (196–202): lấy PDF từ `scraper.local_candidates()`, rồi thử thư mục fixture TCHQ hoặc PDF canonical.
5. **Scrape online** (203–211): gọi `fetch_tchq_playwright()`. Lỗi được log có stack trace, đưa vào `errors`; `scrape_complete=True` chỉ khi không giới hạn `max_pages`.
6. **Tái dùng PDF còn trên đĩa** (212–218): nếu không có artifact mới thì scan các PDF canonical; nếu cuối cùng vẫn trống, ghi lỗi rõ ràng.
7. **OCR hoặc skipped** (219–228): chỉ truyền artifact `status == "ok"` vào `_copy_pdfs()` và `ocr_pipeline.run_period()`. Không có PDF hợp lệ thì trạng thái OCR là `no_files`.
8. **Manifest và exit status** (229–237): manifest luôn được ghi; success cần PDF hợp lệ, OCR `ok/partial`, có summary hoặc pivot, và không còn lỗi scrape/manifest.

## 3. Chạy nhiều năm: `run_years()` và wrapper

Source: [`run_years()`](../main.py#L238-L317), [`run_range()`](../main.py#L318-L326), [`_ocr_period()`](../main.py#L327-L335).

| Dòng | Luồng điều khiển |
|---|---|
| 238–251 | `run_years()` dọn FDI toàn output khi được yêu cầu; chuẩn hóa năm và kiểm tra khoảng 2000..năm hiện tại; tạo danh sách đủ 12 kỳ cho mỗi năm. Đây là tầng điều phối range chứ chưa scrape/OCR. |
| 252–266 | Nếu `reuse_pdfs=True`, gọi `_scan_period_pdfs()` cho từng kỳ. Nếu không, tạo flow folder và gọi `fetch_tchq_multi_period()` một lần cho cả range; lỗi scrape được log và chuyển sang dùng PDF local đã có. |
| 268–307 | Lặp theo từng kỳ: cache hit thì ghi trạng thái cached; nếu không, chọn download hợp lệ hoặc scan PDF hiện có, copy vào folder chuẩn, gọi `_ocr_period()`, tính số summary/pivot và ghi manifest cho kỳ. |
| 308–315 | Sau vòng lặp, tạo all-years với backfill, QC theo các năm đã chọn và reconciliation workbook/JSON. Đây là hậu xử lý một lần cho batch, tránh rebuild tổng hợp sau từng kỳ. |
| 316–317 | Trả mã `0` khi có ít nhất một kỳ được xác nhận OK; nếu không có kỳ thành công trả `1`. |
| [`run_range()`](../main.py#L318-L326) | 318–326 | Hai năm đầu/cuối → mã thoát batch. | Kiểm tra `year_from <= year_to`, biến dải inclusive thành iterable năm rồi chuyển nguyên cấu hình sang `run_years()`. Dùng cho CLI `--from-year/--to-year` và tương thích với caller cũ. |
| [`_ocr_period()`](../main.py#L327-L335) | 327–335 | Kỳ, engine OCR → dict kết quả OCR. | Gọi `run_period()` trên folder kỳ chuẩn với `update_data=False`, để mỗi kỳ trong batch không kích hoạt build all-years riêng. Nếu OCR ném exception thì log stack trace, trả status `error` để batch tiếp tục xử lý kỳ kế tiếp. |

## 4. Nhập năm và phân tích CLI

Source: [`ask_year_range()`](../main.py#L336-L354), [`parse_years()`](../main.py#L355-L376), [`main()`](../main.py#L377-L427).

### [`ask_year_range()`](../main.py#L336-L354) — nhập range tương tác

In hướng dẫn và hỏi năm bắt đầu/kết thúc trong vòng lặp. Chỉ trả khi hai giá trị là số nguyên, nằm trong `2000..năm hiện tại` và năm bắt đầu không lớn hơn năm kết thúc; input sai sẽ nhận thông báo và được hỏi lại.

### [`parse_years()`](../main.py#L355-L376) — parse danh sách/range năm

Nhận chuỗi như `2020,2022-2024`: tách theo dấu phẩy; mỗi token là một năm hoặc range hai đầu inclusive; gộp năm lặp bằng `set`, sort trước khi trả. Token sai, range ngược, danh sách rỗng hoặc năm ngoài giới hạn được chuyển thành `argparse.ArgumentTypeError` để argparse in hướng dẫn CLI.

### [`main()`](../main.py#L377-L427) — chọn chế độ chạy

1. Khai báo CLI cho kỳ đơn, range, năm rời/range, CAPTCHA, browser, fixture, OCR engine, giới hạn trang, cache, tái sử dụng PDF, dọn FDI, backfill và output root.
2. Sau parse, cập nhật `OUTPUT_DIR` qua `resolve_output_root()` trước khi gọi runner.
3. Nếu có `--backfill`, ưu tiên rebuild all-years và validate; nhánh này không scrape/OCR.
4. Nếu chạy thông thường, ưu tiên `--period`, rồi `--years`, rồi `--from-year/--to-year`; nếu không có thì dùng prompt `ask_year_range()`.
5. `--headed` chuyển browser khỏi headless; các cờ `--force`, `--reuse-pdfs`, `--clean` được truyền đến runner tương ứng.

> **Điểm cần lưu ý khi đọc CLI:** `main.py` hiện cho phép `--ocr-engine vietocr`, nhưng `ocr_pipeline.extract_table()` chỉ nhận `auto`, `pdfplumber`, `paddle`. Hai danh sách chưa đồng bộ; chọn `vietocr` có thể bị từ chối ở OCR runtime.

## 5. `pipeline/paths.py` — một nơi chuẩn hóa đường dẫn

Source: [`paths.py`](../pipeline/paths.py).

| Dòng | Ý nghĩa |
|---|---|
| [1–10](../pipeline/paths.py#L1-L10) | Khai báo `CODE_DIR` theo vị trí module, output mặc định là `code/output` và regex chỉ chấp nhận chuỗi tháng `YYYY-MM` với tháng 01–12. |
| [`resolve_output_root()`](../pipeline/paths.py#L12-L15) | Chuẩn hóa output root truyền vào bằng `expanduser().resolve()`; `None` hoặc chuỗi rỗng dùng `DEFAULT_OUTPUT_ROOT`. Đây là điểm chung để các module thống nhất nơi đọc/ghi artifact. |
| [`period_dir()`](../pipeline/paths.py#L17-L22) | Validate kỳ bằng full match; sai định dạng raise `ValueError`. Kỳ hợp lệ thành `root/YYYY/YYYY-MM`; helper chỉ tạo path, không tự tạo thư mục. |
| [`period_flow_dir()`](../pipeline/paths.py#L24-L28) | Validate direction chỉ là `export` hoặc `import`, sau đó gắn folder `Xuat_Khau` hoặc `Nhap_Khau` vào path kỳ. Dữ liệu hướng khác không bị âm thầm đổi sang một flow hợp lệ. |
| [`period_pdf_dirs()`](../pipeline/paths.py#L30-L33) | Trả cặp PDF directory theo thứ tự export rồi import; callers có thể zip cặp này với hai direction theo cùng thứ tự. |
| [`all_years_json_path()`](../pipeline/paths.py#L36-L38) | Tạo path chuẩn tới `root/data/all_years_cashew.json`; không kiểm tra file đã tồn tại. |
| [`all_years_xlsx_path()`](../pipeline/paths.py#L40-L41) | Tạo path chuẩn tới `root/all_years_cashew.xlsx`; giữ workbook ở root output, không đặt bên trong `data/`. |

## 6. Lệnh thường dùng

```powershell
python main.py --period 2026-09
python main.py --from-year 2020 --to-year 2026 --reuse-pdfs --force
python main.py --years 2020,2022-2025
python main.py --backfill
```

Mở [README_01_WORKFLOW.md](README_01_WORKFLOW.md) để hiểu các artifact đầu/cuối; sang [README_03_INGESTION_OCR.md](README_03_INGESTION_OCR.md) nếu muốn đọc sâu hai module mà `main.py` gọi.
