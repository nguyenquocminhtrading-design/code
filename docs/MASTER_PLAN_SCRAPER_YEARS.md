# Master plan: chạy scraper theo năm được chọn

## Mục tiêu

Cho phép chạy scraper độc lập từ command line, chọn một hoặc nhiều năm bất kỳ, quét TCHQ một lần, rồi lưu PDF vào đúng thư mục năm:

```text
code/output/2020/pdfs/<file>.pdf
code/output/2022/pdfs/<file>.pdf
```

## Cách chạy

Từ thư mục gốc `XNK`:

```powershell
python code/main.py --years 2020
python code/main.py --years 2020,2022,2024
python code/main.py --years 2020-2024
python code/main.py --years 2020,2022-2024 --headed
```

`--years` chấp nhận danh sách phân tách bằng dấu phẩy và các dải năm inclusive. Chạy không tham số vẫn hỏi năm bắt đầu/kết thúc; `--from-year`/`--to-year` tiếp tục hoạt động.

## Luồng xử lý

1. Chuẩn hóa và kiểm tra các năm được yêu cầu (2000 đến năm hiện tại).
2. Tạo danh sách 12 tháng cho mỗi năm đã chọn và gọi `fetch_tchq_multi_period` một lần.
3. Tải PDF vào kho thô `TCHQ/Export/YYYY-MM/` để các bước OCR và cache hiện có tiếp tục dùng được.
4. Sao chép PDF hợp lệ vào `code/output/YYYY/pdfs/`.
5. Chạy OCR theo tháng; ghi Excel và manifest theo năm/tháng như trước.

## Tiêu chí hoàn thành

- [x] Hàm điều phối nhận tập năm tùy ý (`run_years`).
- [x] CLI parse danh sách năm và khoảng năm (`--years`).
- [x] Đầu ra PDF gom trực tiếp vào `output/<năm>/pdfs/`.
- [x] Giữ tương thích với `--period`, `--from-year`/`--to-year` và nhập tương tác.
- [ ] Chạy một đợt scrape thực tế cho năm người dùng chọn và xác nhận số PDF tải được.

## Lệnh xác minh

```powershell
python code/main.py --help
python -c "from code.main import parse_years"
```

Để kiểm tra thật mà chỉ quét một trang, dùng `python code/main.py --years 2020 --max-pages 1`; đây là lượt scrape thực và ghi dữ liệu vào output.
