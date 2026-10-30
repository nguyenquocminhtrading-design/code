# 📖 GIẢI THÍCH CƠ CHẾ "BÙ THÁNG" TRONG CODEBASE

> Giải thích bằng tiếng Việt, kèm vị trí code cụ thể

---

## 1. CƠ CHẾ "OTHER" (RESIDUAL) — BÙ NGÀY TRONG NGÀy

### 📍 Vị trí: `pipeline/ocr_pipeline.py` dòng 533–563

```python
# ── Hàng "Other": residual = Tong_XK − SUM(các quốc gia) ────────────────
other_luong  = int(a_luong)  - sum_luong
other_trigia = int(a_trigia) - sum_trigia

other_row = pd.DataFrame([{
    "Quốc gia": "Other",
    "CY Lượng": other_luong,
    "CY Trị giá (USD)": other_trigia,
}])
```

### 🤔 Cơ chế hoạt động:

Giả sử TCHQ báo cáo:
- **Tổng xuất khẩu tháng 5/2024**: 100,000 tấn
- **Chi tiết theo quốc gia** (từ file 5X):
  - Hoa Kỳ: 30,000 tấn
  - Trung Quốc: 25,000 tấn
  - Nhật Bản: 20,000 tấn
  - ... (tổng 32 quốc gia = 85,000 tấn)

→ **Other = 100,000 - 85,000 = 15,000 tấn**

"Other" chính là phần **chưa phân bổ cho quốc gia cụ thể** — có thể là:
- Các quốc gia nhỏ chưa liệt kê
- Lỗi OCR làm mất một số dòng
- Dữ liệu tổng hợp từ nhiều nguồn

### ⚠️ Vấn đề gặp phải:

Nếu **cùng một quốc gia bị trùng** (do parse từ 2 file PDF khác nhau), tổng chi tiết bị ** đội lên**:

```
Tổng TCHQ báo: 100,000 tấn
Chi tiết (có trùng):
  - Hoa Kỳ: 30,000 (từ file CT)
  - Hoa Kỳ: 30,000 (từ file SB) ← TRÙNG!
  - ...
  → Tổng chi tiết = 115,000 tấn

Other = 100,000 - 115,000 = -15,000 tấn ❌ (ÂM!)
```

→ Dashboard hiện `negative_other_residual` → ẩn kỳ đó khỏi biểu đồ.

### ✅ Fix đã áp dụng:

Thêm **dedup** trước khi tính Other (dòng 519–531):

```python
# Deduplicate: group by country+product, sum numeric cols
pivot = pivot.groupby(["Quốc gia", "mặt hàng"], as_index=False)[num_cols].sum()
```

---

## 2. CƠ CHẾ "IS_DERIVED" — ĐÁNH DẤU DỮ LIỆU TÍNH SUY NGƯỢC

### 📍 Vị trí: `pipeline/ocr_pipeline.py` dòng 398

```python
# Khi parse summary từ PDF:
"is_derived": False,  # Mặc định là dữ liệu thật từ TCHQ
```

### 📍 Vị trí: `pipeline/data_builder.py` dòng 144–150

```python
# Lọc bỏ dữ liệu suy ngược ra khỏi KPI
if "fallback" in version_text or "ước tính" in version_text \
        or "uoc tinh" in note_text or "suy ngược" in note_text:
    continue  # Bỏ qua, không đưa vào dashboard
```

### 🤔 Ý nghĩa:

| Trường hợp | is_derived | Hiển thị trên dashboard? |
|------------|------------|-------------------------|
| Dữ liệu thật từ TCHQ | `False` | ✅ Có |
| Dữ liệu tính từ YTD | `True` | ⚠️ Có nhưng có badge "Ước tính" |
| Dữ liệu suy ngược (fallback) | `True` | ❌ Không (bị lọc) |

---

## 3. CƠ CHẾ BACKFILL — BÙ THÁNG THIẾU

### 📍 Vị trí: `backfill_safe.py` và `backfill_ytd_diff.py`

Đây là **2 script riêng** tôi viết để bù dữ liệu cho các tháng thiếu.

### Cách hoạt động của YTD Diff:

```
Month(t) = YTD(t) - YTD(t-1)
```

**Ví dụ thực tế:**

```
Tháng 3/2024 thiếu dữ liệu.
Nhưng tháng 4/2024 có:
  - YTD(2024-04) = 400,000 tấn
  - YTD(2024-03) = 350,000 tấn (có trong dữ liệu tháng 3)

→ Month(2024-03) = 400,000 - 350,000 = 50,000 tấn ✅
```

### ⚠️ Điều kiện áp dụng:

1. **Phải có YTD của tháng hiện tại** (thường có trong báo cáo tháng sau)
2. **Phải có YTD của tháng trước**
3. **Không áp dụng được cho tháng 1** (vì không có YTD tháng 12 cùng năm)

---

## 4. TÓM TẮT LUỒNG DỮ LIỆU

```
┌─────────────────────────────────────────────────────────────────┐
│                        TCHQ WEBSITE                            │
│  ↓ Tải PDF: 2X (summary) + 5X (country detail)                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              pipeline/ocr_pipeline.py                           │
│  ↓ Parse PDF → Excel monthly                                    │
│  - parse_summary(): đọc file 2X → tong_xk/tong_nk               │
│  - parse_country_product(): đọc file 5X → chi tiết theo nước    │
│  - normalize_country_product():                                 │
│      + Dedup quốc gia (groupby)                                 │
│      + Tính "Other" = Tổng - Σ chi tiết                         │
│  - Viết file: YYYY-MM_cashew.xlsx                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              pipeline/data_builder.py                           │
│  ↓ Đọc monthly xlsx → aggregate JSON                           │
│  - _parse_xlsx(): đọc sheet Tong_Quan_XNK, XK_Theo_Nuoc        │
│  - Lọc bỏ dữ liệu "fallback/ước tính" (is_derived=True)         │
│  - Viết: output/data/YYYY_cashew.json                           │
│  - Viết: output/all_years_cashew.{json,xlsx}                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              web/app.js (Dashboard)                             │
│  ↓ Load data → Visualize                                       │
│  - loadAllYearsJSON(): fetch ../output/data/all_years.json      │
│  - buildPeriodsFromCanonical(): chuyển đổi sang format internal│
│  - periodDetailIsTrusted(): kiểm tra reconciliation             │
│      + Nếu delta > 1 → ẩn period (trừ phi có badge)            │
│  - isEstimatedSummary(): kiểm tra is_derived                    │
│  - Hiển thị badge "Ước tính" cho derived data                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. CÁC TRƯỜNG HỢP ĐẶC BIỆT

### Trường hợp 1: Tháng chỉ có 2X, không có 5X

**Ví dụ**: 2023-12 nhập khẩu
- Có: `2023-T12T-2N(VN-CT).pdf` (tổng quan)
- Không có: file 5N (chi tiết theo nước)

→ Dashboard vẫn hiển thị được KPI tổng quan, nhưng **không có biểu đồ pie/bar theo quốc gia**.

### Trường hợp 2: Tháng hoàn toàn thiếu

**Ví dụ**: 2024-05 nhập khẩu
- Không có 2N, không có 5N

→ Cần **backfill** bằng YTD diff hoặc YoY proxy.

### Trường hợp 3: Dữ liệu bị trùng (duplicate)

**Nguyên nhân**: TCHQ publish nhiều phiên bản (CT, DC, SB) cho cùng tháng.
**Fix**: Dedup bằng `groupby(["Quốc gia", "mặt hàng"]).sum()`

---

## 6. HƯỚNG DẪN SỬ DỤNG

### Kiểm tra trạng thái:
```bash
python quick_status.py
```

### Chạy backfill thủ công:
```bash
# Phương pháp YoY Proxy (dùng data năm trước)
python backfill_safe.py --execute

# Phương pháp YTD Diff (dùng data cùng năm)
python backfill_ytd_diff.py --execute
```

### Rebuild toàn bộ data:
```bash
python pipeline/data_builder.py --all-years
```

### Chạy lại OCR cho kỳ cụ thể:
```bash
python main.py --period 2023-12 --force
```

---

## 7. KẾT LUẬN

| Thành phần | File | Chức năng |
|------------|------|-----------|
| **Khác (Other)** | `ocr_pipeline.py:533` | Tính phần chưa phân bổ = Tổng - Σ chi tiết |
| **Dedup** | `ocr_pipeline.py:519` | Loại bỏ trùng quốc gia |
| **Lọc derived** | `data_builder.py:148` | Loại dữ liệu suy ngược khỏi KPI |
| **Backfill** | `backfill_safe.py` | Bù tháng thiếu bằng YoY proxy |
| **Backfill** | `backfill_ytd_diff.py` | Bù tháng thiếu bằng YTD diff |

**Lưu ý quan trọng**: Backfill scripts chưa được tích hợp vào `main.py` — cần chạy thủ công sau mỗi lần rebuild data.
