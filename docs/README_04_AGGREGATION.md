# README 04 — Walkthrough tổng hợp all-years và Vinacas YTD

Tài liệu này đọc theo thứ tự source của [`pipeline/data_builder.py`](../pipeline/data_builder.py) và [`pipeline/vinacas_ytd.py`](../pipeline/vinacas_ytd.py). Module đầu là nhánh tổng hợp chính của dashboard; module thứ hai là bộ tính YTD Vinacas chạy độc lập.

## 1. `pipeline/data_builder.py` — Excel theo kỳ thành dữ liệu dashboard

### 1.1. Imports, schema và helper functions

| Dòng | Giải thích |
|---|---|
| [1–51](../pipeline/data_builder.py#L1-L51) | Docstring nêu input/output/CLI. Imports gồm JSON/CSV/logging/date/path. `paths.py` có relative import và fallback direct-run. Các constant tên cột phải khớp với sheet OCR; `_VERSION_KEY_MAP` thống nhất nhãn Việt/Anh thành key official/adjusted/preliminary/derived. |
| [53–65](../pipeline/data_builder.py#L53-L65) | `_version_label_to_key()` casefold nhãn, trả key chuẩn; nhãn trống/không khớp trả chuỗi rỗng. |
| [68–86](../pipeline/data_builder.py#L68-L86) | `_now_iso()` tạo timestamp UTC. `_safe_int()` xử lý None/NaN và đổi số workbook về Python `int`, lỗi kiểu dữ liệu trả `None`. |
| [88–101](../pipeline/data_builder.py#L88-L101) | `_monthly_workbooks()` quét file legacy nằm trực tiếp trong folder năm và file canonical trong subfolder `YYYY-MM`; cùng period thì file trong thư mục kỳ được ghi đè vào map cuối, sau đó trả theo thứ tự kỳ. |

### 1.2. Đọc một workbook: `_parse_xlsx()`

Source: [`_parse_xlsx()`](../pipeline/data_builder.py#L105-L292).

1. **Mở file và schema đích** (105–137): import openpyxl có kiểm soát; lỗi mở workbook được log và trả `None`. Tạo dict chuẩn gồm period, summary XK/NK, balance, lists country/version.
2. **Summary mới/legacy** (138–206): ưu tiên `Tong_Quan_XNK`, nếu không có thử `Tong_XK`. Summary mới bắt đầu sau hai dòng header nhóm; đọc direction, product, unit, CY/YTD, version và notes; summary fallback được bỏ khỏi KPI gốc để không xuất như số TCHQ quan sát. Mỗi version giữ riêng trong dict và summary đầu tiên làm primary. Nhánh legacy đọc format cũ.
3. **Country sheets đa version** (207–270): map tên sheet XK/NK + suffix sang version key. Helper `_read_country_rows()` đọc header, bỏ dòng trống/không tên quốc gia, map các cột CY/YTD/version/debug. Nếu có version sheets thì suy key từ tên sheet; nếu không thì đọc sheet gộp cũ và suy từ nhãn version.
4. **Lịch sử phiên bản và balance** (271–289): đọc `Lich_Su_Phien_Ban`; nếu có cả summary XK/NK thì `trade_balance_usd = export - import`.
5. **Đóng workbook và guard cuối** (290–292): đóng file; nếu không có summary nào và không có country rows XK thì coi workbook không dùng được.

### 1.3. JSON theo năm

Source: [`build_year()`](../pipeline/data_builder.py#L293-L332).

- Resolve output root, tìm folder năm và workbook tháng.
- Gọi `_parse_xlsx()` cho từng workbook thành dict keyed by period.
- Nếu có dữ liệu, tạo `output/data/YYYY_cashew.json` gồm year, generated timestamp và `periods`.
- Folder thiếu hoặc không có workbook hợp lệ sẽ log warning, trả `None`.

### 1.4. `apply_auto_backfill()` — bổ sung summary trong dữ liệu tổng hợp

Source: [`apply_auto_backfill()`](../pipeline/data_builder.py#L333-L535).

1. Sắp kỳ, định nghĩa helper lùi 1 tháng/lùi 1 năm/tiến 1 năm.
2. Lặp export và import riêng, chỉ xử lý kỳ thiếu primary summary.
3. Chọn version ưu tiên official → adjusted → preliminary → derived; chỉ cộng country rows cùng `version_key`.
4. Thử YTD Difference trước: tháng 01 lấy tổng country rows; các tháng khác lấy YTD kỳ hiện tại trừ YTD kỳ trước nếu cùng năm và tăng hợp lệ.
5. Không ra kết quả thì dùng YoY Proxy từ cùng tháng năm trước; nếu không có thì thử cùng tháng năm sau.
6. Gắn `is_derived`, `version=derived`, `source_note`, `debug_source_file/type/note`, và cộng vào summary list nếu cấu trúc đó tồn tại.
7. Duyệt lại kỳ có summary, tính chênh value/quantity giữa summary và country rows; nếu chưa có Other thì thêm `Other` với `debug_source_type=calculated`. Đây là residual đối soát, không phải cùng khái niệm với backfill của summary.
8. Trả số summary đã được lấp.

### 1.5. `build_all_years()` — tạo database/web output

Source: [`build_all_years()`](../pipeline/data_builder.py#L536-L1025).

Đọc source theo trật tự:

| Dòng | Block và ý nghĩa |
|---|---|
| 536–570 | Kiểm tra openpyxl/output root; khởi tạo các collection; duyệt folder năm hợp lệ, chọn workbook tháng qua `_monthly_workbooks()` và chuẩn hóa bằng `_parse_xlsx()`. Nếu không có kỳ hợp lệ thì dừng, không ghi output rỗng. |
| 571–585 | Khi `backfill=True`, gọi `apply_auto_backfill()`, sau đó ghi JSON chi tiết từng kỳ đã backfill. |
| 586–632 | Build các collection summary/version/country rows từ tất cả period, giữ các phiên bản và thông tin truy vết nguồn. |
| 633–681 | Đọc `Vincass/Vinacas.xlsx` nếu có; map cột gốc thành `vinacas_records` giữ raw country/date và tạo record chuẩn cho web. Luồng này không gọi `vinacas_ytd.compute_ytd()`. |
| 682–784 | Chuyển records TCHQ và summary sang schema phẳng có source/period/flow/version/debug; tính freshness dựa trên kỳ mới nhất; tạo JSON schema v3 với `periods`, `records`, `summary_records`, `vinacas_records`, `years`. |
| 785–880 | Tạo workbook all-years: summary theo version, balance, XK/NK theo nước, lịch sử version, Vinacas, và sheet legacy `Tong_XK_All`; lưu workbook rồi ghi JSON all-years. |
| 882–1025 | Tạo thêm workbook/JSON riêng theo version (official/adjusted/preliminary) nếu version có dữ liệu; không thay schema JSON all-years chung. |

> Range nhỏ bên trong hàm có thể dịch khi source thay đổi. Nếu line range không còn trỏ đúng block, tìm tên hàm và các comment `Sheet` gần đó.

### 1.6. Refresh kỳ, QC và CLI

- [`update_period_data()`](../pipeline/data_builder.py#L1026-L1034): validate `YYYY-MM`, build JSON của năm chứa kỳ, sau đó gọi `build_all_years()`.
- [`build_qc_report()`](../pipeline/data_builder.py#L1035-L1080): lặp từng năm và 12 tháng, đọc manifest lồng `ocr` nếu có, xuất CSV/JSON; manifest thiếu được ghi `not_run`, parse hỏng ghi `manifest_error`.
- [`validate_aggregate_outputs()`](../pipeline/data_builder.py#L1081-L1261): so JSON và workbook tổng hợp ở mức record, sheet/header, duplicate summary và giá trị KPI; kết quả `status`, `issue_count`, `issues` ghi vào `qc/aggregate_reconciliation.json`.
- [`main()`](../pipeline/data_builder.py#L1264-L1327): các nhánh `--period`, `--backfill`, `--all-years`, `--year`, hoặc mặc định rebuild mọi năm rồi tổng hợp/QC. `--output-root` thay root.

## 2. `pipeline/vinacas_ytd.py` — YTD riêng cho Vinacas

### 2.1. Cấu hình, nguồn và chuẩn hóa row

| Dòng | Giải thích |
|---|---|
| [1–64](../pipeline/vinacas_ytd.py#L1-L64) | Docstring mô tả quy tắc monthly và annual, nguồn, outputs và cảnh báo write-back. Constants xác định root, JSON/XLSX, key tổng kỳ `__TOTAL__`, product/unit mặc định và schema version. `force_utf8_console()` hỗ trợ console Windows. |
| [65–126](../pipeline/vinacas_ytd.py#L65-L126) | `load_records_json()` chọn `vinacas_records`, validate period/country, chuẩn hóa field sang period/country/product/unit/quantity/value/flow. |
| [128–196](../pipeline/vinacas_ytd.py#L128-L196) | `load_records_xlsx()` ưu tiên pandas; chỉ khi thiếu pandas mới dùng openpyxl. Header được map qua `_XLSX_COLUMN_MAP`; bỏ dòng thiếu country hoặc direction không phải import; date chuyển về `YYYY-MM`; record đầu ra có cùng schema với JSON loader. |
| [197–221](../pipeline/vinacas_ytd.py#L197-L221) | `load_rows()` ở mode `auto` thử JSON nếu có và có rows, nếu lỗi/empty thì dùng XLSX; ở mode `json` thất bại thì raise. |

### 2.2. Tính CY, YTD, totals và YoY

Source: [`_num()` đến `build_payload()`](../pipeline/vinacas_ytd.py#L222-L390).

1. [222–234] `_num()` đổi giá trị về float; None, chuỗi sai hoặc NaN thành None.
2. [235–242] `detect_annual_years()` đánh năm là annual nếu tất cả dòng chỉ xuất hiện trong đúng một kỳ period.
3. [243–267] `aggregate_per_period_country()` gộp dòng lặp theo `(period, country)`, cộng quantity/value không-null.
4. [268–295] `compute_ytd()` nhóm theo country và year, sort period. Năm annual giữ YTD bằng CY; năm monthly cộng dồn, reset từng năm.
5. [296–315] `build_totals()` cộng các country thành `__TOTAL__` từng kỳ rồi dùng cùng logic tính YTD.
6. [316–329] `apply_yoy()` so YTD cùng tháng/country với năm trước; thiếu mẫu số hoặc mẫu số bằng 0 thì phần trăm YoY là None.
7. [330–390] `build_payload()` tạo annual flag, aggregate, YTD, totals, phẳng hóa records, sort, tính YoY, lập yearly summary và meta gồm duplicate pairs, null values, các năm annual/monthly.

### 2.3. Xuất file và ghi ngược tùy chọn

- [391–399](../pipeline/vinacas_ytd.py#L391-L399): `write_json()` tạo thư mục đích rồi ghi JSON UTF-8, không escape tiếng Việt.
- [400–417](../pipeline/vinacas_ytd.py#L400-L417): `_records_frame()` đổi record chuẩn thành cột hiển thị CY hoặc YTD.
- [418–454](../pipeline/vinacas_ytd.py#L418-L454): `write_excel()` tạo `CY_Monthly`, `YTD_Cumulative`, `Yearly_Summary`; ưu tiên pandas, fallback openpyxl khi không có pandas.
- [455–478](../pipeline/vinacas_ytd.py#L455-L478): `update_all_years()` tạo backup `.json.bak`, sau đó map YTD vào records Vinacas gốc theo period + country và ghi JSON. Đây là side effect có ghi đè, mặc định không chạy.
- [479–503](../pipeline/vinacas_ytd.py#L479-L503): in bảng yearly summary và self-check cho các năm được code chọn.
- [504–541](../pipeline/vinacas_ytd.py#L504-L541): `main()` parse `--source`, `--out-dir`, `--update-all-years`; load rows, build payload, ghi hai output, in QC tóm tắt; chỉ gọi `update_all_years()` khi cờ được truyền.

Chạy không ghi ngược:

```powershell
python pipeline/vinacas_ytd.py --source auto --out-dir output
```

Chỉ dùng `--update-all-years` khi chủ động muốn sửa JSON all-years; kiểm tra backup và diff sau khi chạy.

## 3. Mô hình dữ liệu cần nhớ

- **TCHQ**: summary và country detail có version; không gộp version khi chọn số liệu.
- **Vinacas**: record riêng theo country/period, không nhập chung luồng TCHQ.
- **CY** là giá trị của kỳ; **YTD** là lũy kế theo năm với nguồn monthly. Một kỳ duy nhất trong năm được đánh annual theo logic hiện tại.
- **Derived summary** và **calculated Other residual** là hai metadata khác nhau; xem `debug_source_type` / `debug_source_note` trước khi giải thích số.

Trở lại [README_01_WORKFLOW.md](README_01_WORKFLOW.md) để xem sơ đồ pipeline hoặc [README_03_INGESTION_OCR.md](README_03_INGESTION_OCR.md) để lần theo nguồn PDF.
