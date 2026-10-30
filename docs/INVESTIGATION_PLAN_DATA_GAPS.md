# 🔎 PLAN ĐIỀU TRA — Tại Sao JSON & Excel Vẫn Chưa Có Full Data

**Ngày lập:** 2026-10-27
**Trạng thái:** ⏳ CHỜ PHÊ DUYỆT — **không chạy / không sửa code nào cho tới khi duyệt**
**Nguồn bằng chứng:** Log chạy thật `main.py --from-year 2020 --to-year 2026 --reuse-pdfs --force` (job pwsh-211, exit 0) + verify_multiversion + QC reconciliation

---

## 1. TÓM TẮT HIỆN TƯỢNG

Job rebuild xong với con số đẹp: `periods=84 | ok=81 | pdfs=720 | summary_rows=352 | pivot_rows=7108`, QC `ok`.
**NHƯNG** đọc kỹ log từng kỳ, có **3 nhóm dấu hiệu bất thường** khiến dữ liệu chưa "full / chuẩn":

| Nhóm | Hiện tượng | Ví dụ từ log |
|------|-----------|--------------|
| **G1** | Kỳ có **0 hoặc ~2-3 pivot rows** (thực chất chỉ còn dòng Other) | 2021-06 XK=3 · 2023-09 XK=2 · 2023-12 XK=2/NK=0 · 2022-10 NK=0 · 2024-05 NK=0 · 2024-07 XK=0 · 2024-10 NK=0 · 2024-12 XK=0 · 2025-08 NK=0 |
| **G2** | Dòng **Other BỊ ÂM** (sum quốc gia > summary) | 2023-05 −76.559 tấn/−$105,5M · 2023-08 −12.355 · 2023-09 −24.480 · 2023-10 −27.432 · 2023-11 −57.736 · 2024-08 −11.997 · 2024-09 −33.776 · 2025-09 −51.127 |
| **G3** | Số **backfill YTD Diff phình ~3×** so với mặt bằng thật | 2020-05 XK = **355.080 tấn/tháng** (thật ~118k) · 2020-12 = 454.312 · 2022-04 NK = 1.581.111 · 2022-09 NK = 1.339.731 · 2025-10 = 514.136 |

**Chứng minh nhanh G3 bằng số học (chưa cần chạy gì):**
- 355.080 = 3 × YTD₅(thật) − YTD₄ → YTD₅(thật) ≈ 165.059 tấn
- Trừ YTD₄ chính thức (140.096 tấn) → tháng 5 thật ≈ **24.963 tấn ≈ đúng con số cũ 24.798**
- ⇒ Suy luận mạnh: **sum YTD đang cộng trùng 3 phiên bản** (country list giờ chứa đủ 3 sheet ChinhThuc/DieuChinh/SoBo) — xem giả thuyết H1.

---

## 2. GIẢ THUYẾT & CÁCH XÁC MINH

### H1 — Backfill cộng trùng 3 phiên bản (P0 · nghi phạm chính của G3)

**Cơ chế nghi vấn:** `data_builder.apply_auto_backfill()` tính
`c_y_q = sum(r["ytd_luong"] for r in item[country_key])` — nhưng `country_key` giờ chứa
**cả 3 sheet phiên bản** (93 dòng = 31 × 3) → YTD bị ×3. Tương tự ở
`ocr_pipeline.attempt_backfill_summary()` khi nhận `country_rows` đa phiên bản.

**Xác minh (read-only):**
1. Đọc `all_years_cashew.json`: so `periods["2020-05"].tong_xk.quantity_month` với `sum(ytd_luong của CHỈ sheet ChinhThuc)` − YTD₄
2. Rule kiểm chứng: nếu `backfill_qty ≈ 3 × country_ytd_diff` → H1 đúng
3. Quét TOÀN BỘ 17 kỳ backfill, lập bảng `backfill_qty / 3` để thấy quy luật

### H2 — Other âm: sum quốc gia > summary (P0 · G2)

**Nghi vấn con:** (a) parser 5X đọc nhầm cột **Cộng dồn (YTD)** thành CY tháng → lượng/tháng quốc gia bị phình;
(b) quốc gia trùng do nhiều trang PDF trùng dòng chưa dedup đúng; (c) parse_summary đọc thiếu số (summary nhỏ hơn thật).

**Xác minh (read-only):**
1. Với 2023-05 XK official: xuất danh sách `(quốc gia, cy_luong, ytd_luong)` từ JSON → kiểm tra `Σcy vs summary` và tìm quốc gia có `cy_luong ≈ ytd_luong` (dấu hiệu đọc nhầm cột)
2. Đếm quốc gia trùng (sau strip accents + upper) trong 1 phiên bản
3. Đối chiếu 3-5 dòng với PDF gốc bằng `pdfplumber` thủ công (in text dòng đó)

### H3 — PaddleOCR hỏng → PDF scan ra 0 quốc gia (P0 · giải thích G1 một phần)

**Bằng chứng có sẵn trong log:**
```
9962024-T3-5X(VN-SB)new.pdf: trying PaddleOCR ...
PaddleOCR failed: [Errno 13] Permission denied:
  'C:\Users\Acer\.paddlex\official_models\UVDoc\inference.yml'
```
→ Mọi PDF **scan (không có text layer)** sẽ parse thất bại hoàn toàn.

**Xác minh:**
1. Quét manifest `artifacts[].parsed_rows = 0` của tất cả kỳ → lập danh sách PDF "vô sản lượng"
2. Với mỗi PDF đó: check có text layer không (`pdfplumber.extract_text()` dài bao nhiêu ký tự)
3. Kiểm tra quyền file `~/.paddlex/official_models/UVDoc/inference.yml` (attrib/ACL) — nghi bị khóa read-only

### H4 — Kỳ thật sự chưa có (không phải bug)

2026-10/11/12: TCHQ chưa công bố → đúng là trống. Xác minh: liệt kê folder kỳ — không có PDF nào. **Không cần fix.**

### H5 — Thiết kế: combined workbook + JSON chỉ chứa 1 summary/luồng (P2 · có thể là "cảm giác thiếu")

`Tong_Quan_XNK_All` và `periods[p].tong_xk` chỉ giữ **phiên bản ưu tiên** (official).
Đủ phiên bản nằm ở: 3 file all-years tách + `tong_xk_versions` + records.
Nếu user xem JSON/cột "Phiên bản" mong đợi 3 dòng/luồng thì sẽ thấy "thiếu".

**Xác minh:** đếm dòng `Tong_Quan_XNK_All` (81 kỳ × ~2 = ~162) vs tổng summary thực (352) → chênh lệch đúng bằng số phiên bản phụ. Quyết định产品: có cần thêm all-versions vào combined không (chờ duyệt).

---

## 3. KẾ HOẠCH THỰC THI SAU KHI DUYỆT

### Bước 1 — Script điều tra tổng (read-only, KHÔNG ghi đè gì ngoài report)

`diagnostics/audit_data_gaps.py` xuất `output/docs/data_gaps_report.txt`:

| Section | Nội dung |
|---------|----------|
| A | Ma trận kỳ × luồng × phiên bản: `n_summary, n_country, n_other, other_val` — tô đỏ mọi ô 0/nghĩa |
| B | Danh sách PDF parse-fail (từ manifest) + có/không text layer → tách "scan cần OCR" vs "parser lỗi" |
| C | Bảng 17 kỳ backfill: `qty_recorded`, `qty/3`, `ytd_curr_official_only` → kết luận H1 từng kỳ |
| D | Bảng 8 kỳ Other âm: quốc gia top có `cy≈ytd`, số dòng trùng, chênh Σcy − summary |
| E | Đếm dòng combined `Tong_Quan_XNK_All` vs tổng phiên bản (H5) |

### Bước 2 — Chốt root cause từng nhóm → trình fix riêng

| Root cause | Hướng fix dự kiến (duyệt sau) |
|------------|-------------------------------|
| H1 đúng | Lọc `version_key == phiên bản summary đang dùng` trước khi sum YTD ở **cả** `apply_auto_backfill()` và `attempt_backfill_summary()`; chạy lại `--backfill` |
| H2a đúng | Parser 5X: siết regex tách cột CY vs YTD (yêu cầu 4 số cho dòng có YTD) |
| H2b đúng | Dedup chéo trang theo (quốc gia, sản phẩm, số liệu) |
| H3 đúng | Sửa quyền `.paddlex` (attrib -R) rồi OCR lại các PDF scan bằng `--ocr-engine paddle` cho đúng kỳ |
| H5 chốt | Option: viết cả 3 phiên bản vào `Tong_Quan_XNK_All` (thêm cột Phiên bản đã có sẵn) |

### Bước 3 — Chạy lại + nghiệm thu

```powershell
# (sau khi fix được duyệt)
python main.py --backfill                     # nếu chỉ lỗi backfill
python main.py --years 2023,2024 --reuse-pdfs --force   # nếu lỗi parser/OCR
python diagnostics/audit_data_gaps.py         # re-audit → kỳ nào còn gap
python -c "import json; print(json.load(open('output/qc/aggregate_reconciliation.json'))['status'])"
```

**Nghiệm thu:** (1) 0 kỳ có pivot=0 (trừ 2026-10/11/12); (2) 0 Other âm; (3) backfill qty ≤ mức hợp lý (≤ 1.2 × trung bình 3 tháng lân cận); (4) QC ok.

---

## 4. THỜI LƯỢNG DỰ KIẾN

| Bước | Thời gian |
|------|-----------|
| Viết + chạy audit script (read-only) | ~45 phút |
| Chốt root cause + trình fix | ~30 phút |
| (Sau duyệt) Fix H1 + rebuild backfill | ~1 giờ |
| (Sau duyệt) Fix H2/H3 + OCR lại các kỳ ảnh hưởng | ~2-3 giờ |

---

## 5. RỦI RO

- Fix H1 sẽ **đổi KPI các 17 kỳ backfill** về đúng (số hiện tại phình ~3×) — cần note cho user trước khi rebuild
- Fix H3 (OCR scan) có thể kéo thêm dữ liệu mới → QC cần chạy lại toàn bộ
- Không đụng gì tới web/dashboard trong pha điều tra

---

**👉 Chờ phê duyệt: chỉ cần gõ "duyet" — tôi sẽ viết `audit_data_gaps.py` (read-only) chạy trước, xong mới trình phương án fix chi tiết theo root cause thực tế.**
