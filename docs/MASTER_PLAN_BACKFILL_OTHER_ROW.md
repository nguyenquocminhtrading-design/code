# 🔎 MASTER PLAN: Backfill Summary & Other Row Calculation
## Kết hợp Audit + Cơ chế Fallback + Debug Tracking

**Ngày lập:** 2026-10-26  
**Trạng thái:** Chờ phê duyệt  
**Scope:** 18 file Excel thiếu summary → tính toán fallback từ YTD adjacent months

---

## MỤC LỤC

1. [Tổng quan Audit](#1-tổng-quan-audit)
2. [Quy tắc Backfill Bắt buộc](#2-quy-tắc-backfill-bắt-buộc)
3. [Chi tiết từng kỳ cần fix](#3-chi-tiết-từng-kỳ-cần-fix)
4. [Cơ chế Debug Note](#4-cơ-chế-debug-note)
5. [Kế hoạch Implementation](#5-kế-hoạch-implementation)
6. [Checklist Nghiệm thu](#6-checklist-nghiệm-thu)

---

## 1. TỔNG QUAN AUDIT

### Kết quả kiểm tra 81 file Excel

| Trạng thái | Số file | Ghi chú |
|------------|---------|---------|
| ✅ OK | **65** | Có đủ Summary + Other row |
| ❌ THIẾU SUMMARY | **18** | Không tính được Other |

### 18 File cần xử lý:

#### Xuất khẩu (11 kỳ):
```
2020-05, 2020-12, 2022-04, 2022-06, 2022-11,
2023-02, 2024-02, 2024-07, 2024-12, 2025-03, 2025-10
```

#### Nhập khẩu (7 kỳ):
```
2022-01, 2022-04, 2022-09,
2023-02, 2023-04, 2024-03, 2024-05
```

---

## 2. QUY TẮC BACKFILL BẮT BUỘC

### 2.1. Công thức tính toán

```
─────────────────────────────────────────────────────────────────
THÁNG 01 (YTD = CY vì là tháng đầu năm):
─────────────────────────────────────────────────────────────────
Month_Qty(01) = YTD_Qty(01)
Month_Val(01) = YTD_Val(01)

─────────────────────────────────────────────────────────────────
THÁNG M>01 (Dùng YTD Diff):
─────────────────────────────────────────────────────────────────
Month_Qty(M) = YTD_Qty(M) - YTD_Qty(M-1)
Month_Val(M) = YTD_Val(M) - YTD_Val(M-1)

─────────────────────────────────────────────────────────────────
KHI THÁNG SAU THIẾU (Dùng YoY Proxy):
─────────────────────────────────────────────────────────────────
Month_Qty(M,N) = Month_Qty(M,N-1)  // Cùng tháng năm trước
Month_Val(M,N) = Month_Val(M,N-1)

─────────────────────────────────────────────────────────────────
TÍNH OTHER ROW:
─────────────────────────────────────────────────────────────────
Other_Val = Summary_Val - SUM(Country_Rows_Val)
Other_Qty = Summary_Qty - SUM(Country_Rows_Qty)
```

### 2.2. Priority Chain (Thứ tự ưu tiên)

```
PRIORITY 1: YTD Diff (Chính xác nhất)
├── Tháng 01: Month = YTD(01)
├── Tháng M>01: Month = YTD(M) - YTD(M-1)
└── Điều kiện: Cả M và M-1 đều có data

PRIORITY 2: YoY Proxy (Fallback)
├── Month(N) ≈ Month(N-1) cùng tháng
└── Điều kiện: Có data cùng tháng năm trước

PRIORITY 3: Linear Interpolation (Last resort)
├── Nội suy tuyến tính từ trước và sau
└── Điều kiện: Có data cả trước và sau
```

### 2.3. Debug Note Bắt buộc

Mỗi bản ghi backfill PHẢI có:
```json
{
  "is_derived": true,
  "version": "derived",
  "source_note": "<Công thức đã dùng>",
  "debug_source_file": "BACKFILL",
  "debug_source_type": "ytd_diff|yoy_proxy|interpolation",
  "debug_source_note": "<Chi tiết tính toán>"
}
```

---

## 3. CHI TIẾT TỪNG KỲ CẦN FIX

### 3.1. XUẤT KHẨU (11 kỳ)

#### 📅 2020-05

**Vấn đề:** Thiếu summary row → không tính được Other

**Giải pháp: YTD Diff**
```
Month_Qty(2020-05) = YTD_Qty(2020-05) - YTD_Qty(2020-04)
Month_Val(2020-05) = YTD_Val(2020-05) - YTD_Val(2020-04)
```

**Debug Note:**
```
source_note: "Ước tính YTD Diff (2020-05 - 2020-04)"
debug_source_type: "ytd_diff"
debug_source_note: "YTD_05 - YTD_04 = X - Y = Z tấn, $W USD"
```

---

#### 📅 2020-12

**Vấn đề:** Thiếu summary row

**Giải pháp: YoY Proxy** (vì 2021-12 đã có nhưng là năm sau)
```
Month_Qty(2020-12) ≈ Month_Qty(2019-12)  // Nếu có
Hoặc: Month_Qty(2020-12) ≈ Month_Qty(2021-12)  // YoY tới năm sau
```

**Debug Note:**
```
source_note: "Ước tính YoY Proxy (2021-12)"
debug_source_type: "yoy_proxy"
debug_source_note: "Lấy giá trị từ 2021-12 làm proxy"
```

---

#### 📅 2022-04

**Vấn đề:** Thiếu summary row

**Giải pháp: YTD Diff**
```
Month_Qty(2022-04) = YTD_Qty(2022-04) - YTD_Qty(2022-03)
Month_Val(2022-04) = YTD_Val(2022-04) - YTD_Val(2022-03)
```

**Debug Note:**
```
source_note: "Ước tính YTD Diff (2022-04 - 2022-03)"
debug_source_type: "ytd_diff"
debug_source_note: "YTD_04 - YTD_03"
```

---

#### 📅 2022-06

**Vấn đề:** Thiếu summary row

**Giải pháp: YTD Diff**
```
Month_Qty(2022-06) = YTD_Qty(2022-06) - YTD_Qty(2022-05)
Month_Val(2022-06) = YTD_Val(2022-06) - YTD_Val(2022-05)
```

**Debug Note:**
```
source_note: "Ước tính YTD Diff (2022-06 - 2022-05)"
debug_source_type: "ytd_diff"
```

---

#### 📅 2022-11

**Vấn đề:** Thiếu summary row

**Giải pháp: YoY Proxy**
```
Month_Qty(2022-11) ≈ Month_Qty(2021-11)
Month_Val(2022-11) ≈ Month_Val(2021-11)
```

**Debug Note:**
```
source_note: "Ước tính YoY Proxy (2021-11)"
debug_source_type: "yoy_proxy"
```

---

#### 📅 2023-02

**Vấn đề:** Thiếu summary row (CẢ XK và NK)

**Giải pháp: YTD Diff**
```
Month_Qty(2023-02) = YTD_Qty(2023-02) - YTD_Qty(2023-01)
Month_Val(2023-02) = YTD_Val(2023-02) - YTD_Val(2023-01)
```

**Debug Note:**
```
source_note: "Ước tính YTD Diff (2023-02 - 2023-01)"
debug_source_type: "ytd_diff"
```

---

#### 📅 2024-02

**Vấn đề:** Thiếu summary row

**Giải pháp: YTD Diff**
```
Month_Qty(2024-02) = YTD_Qty(2024-02) - YTD_Qty(2024-01)
Month_Val(2024-02) = YTD_Val(2024-02) - YTD_Val(2024-01)
```

**Debug Note:**
```
source_note: "Ước tính YTD Diff (2024-02 - 2024-01)"
debug_source_type: "ytd_diff"
```

---

#### 📅 2024-07

**Vấn đề:** Thiếu summary row

**Giải pháp: YoY Proxy**
```
Month_Qty(2024-07) ≈ Month_Qty(2023-07)
Month_Val(2024-07) ≈ Month_Val(2023-07)
```

**Debug Note:**
```
source_note: "Ước tính YoY Proxy (2023-07)"
debug_source_type: "yoy_proxy"
```

---

#### 📅 2024-12

**Vấn đề:** Thiếu summary row

**Giải pháp: YoY Proxy**
```
Month_Qty(2024-12) ≈ Month_Qty(2023-12)
Month_Val(2024-12) ≈ Month_Val(2023-12)
```

**Debug Note:**
```
source_note: "Ước tính YoY Proxy (2023-12)"
debug_source_type: "yoy_proxy"
```

---

#### 📅 2025-03

**Vấn đề:** Thiếu summary row

**Giải pháp: YTD Diff**
```
Month_Qty(2025-03) = YTD_Qty(2025-03) - YTD_Qty(2025-02)
Month_Val(2025-03) = YTD_Val(2025-03) - YTD_Val(2025-02)
```

**Debug Note:**
```
source_note: "Ước tính YTD Diff (2025-03 - 2025-02)"
debug_source_type: "ytd_diff"
```

---

#### 📅 2025-10

**Vấn đề:** Thiếu summary row

**Giải pháp: YoY Proxy**
```
Month_Qty(2025-10) ≈ Month_Qty(2024-10)
Month_Val(2025-10) ≈ Month_Val(2024-10)
```

**Debug Note:**
```
source_note: "Ước tính YoY Proxy (2024-10)"
debug_source_type: "yoy_proxy"
```

---

### 3.2. NHẬP KHẨU (7 kỳ)

#### 📅 2022-01

**Vấn đề:** Thiếu summary row

**Giải pháp: YTD Diff (Tháng 01 = YTD)**
```
Month_Qty(2022-01) = YTD_Qty(2022-01)
Month_Val(2022-01) = YTD_Val(2022-01)
```

**Debug Note:**
```
source_note: "Ước tính YTD Diff (Tháng 01 YTD)"
debug_source_type: "ytd_diff"
```

---

#### 📅 2022-04

**Vấn đề:** Thiếu summary row (CẢ XK và NK)

**Giải pháp: YTD Diff**
```
Month_Qty(2022-04) = YTD_Qty(2022-04) - YTD_Qty(2022-03)
Month_Val(2022-04) = YTD_Val(2022-04) - YTD_Val(2022-03)
```

**Debug Note:**
```
source_note: "Ước tính YTD Diff (2022-04 - 2022-03)"
debug_source_type: "ytd_diff"
```

---

#### 📅 2022-09

**Vấn đề:** Thiếu summary row

**Giải pháp: YoY Proxy**
```
Month_Qty(2022-09) ≈ Month_Qty(2021-09)
Month_Val(2022-09) ≈ Month_Val(2021-09)
```

**Debug Note:**
```
source_note: "Ước tính YoY Proxy (2021-09)"
debug_source_type: "yoy_proxy"
```

---

#### 📅 2023-02

**Vấn đề:** Thiếu summary row (Cả XK và NK)

**Giải pháp: YTD Diff**
```
Month_Qty(2023-02) = YTD_Qty(2023-02) - YTD_Qty(2023-01)
Month_Val(2023-02) = YTD_Val(2023-02) - YTD_Val(2023-01)
```

**Debug Note:**
```
source_note: "Ước tính YTD Diff (2023-02 - 2023-01)"
debug_source_type: "ytd_diff"
```

---

#### 📅 2023-04

**Vấn đề:** Thiếu summary row

**Giải pháp: YTD Diff**
```
Month_Qty(2023-04) = YTD_Qty(2023-04) - YTD_Qty(2023-03)
Month_Val(2023-04) = YTD_Val(2023-04) - YTD_Val(2023-03)
```

**Debug Note:**
```
source_note: "Ước tính YTD Diff (2023-04 - 2023-03)"
debug_source_type: "ytd_diff"
```

---

#### 📅 2024-03

**Vấn đề:** Thiếu summary row

**Giải pháp: YoY Proxy**
```
Month_Qty(2024-03) ≈ Month_Qty(2023-03)
Month_Val(2024-03) ≈ Month_Val(2023-03)
```

**Debug Note:**
```
source_note: "Ước tính YoY Proxy (2023-03)"
debug_source_type: "yoy_proxy"
```

---

#### 📅 2024-05

**Vấn đề:** Thiếu summary row

**Giải pháp: YoY Proxy**
```
Month_Qty(2024-05) ≈ Month_Qty(2023-05)
Month_Val(2024-05) ≈ Month_Val(2023-05)
```

**Debug Note:**
```
source_note: "Ước tính YoY Proxy (2023-05)"
debug_source_type: "yoy_proxy"
```

---

## 4. CƠ CHẾ DEBUG NOTE

### 4.1. Trường Debug Bắt buộc

Mỗi bản ghi backfill PHẢI có 3 trường debug:

| Field | Giá trị | Mô tả |
|-------|---------|-------|
| `debug_source_file` | `"BACKFILL"` | Nhận diện đây là dữ liệu suy ngược |
| `debug_source_type` | `"ytd_diff"` \| `"yoy_proxy"` \| `"interpolation"` | Loại cơ chế đã dùng |
| `debug_source_note` | Chi tiết công thức | Ví dụ: `"YTD_05 - YTD_04 = 45000 - 38000 = 7000 tấn"` |

### 4.2. Ví dụ cụ thể

#### 2020-05 (YTD Diff)
```json
{
  "period": "2020-05",
  "direction": "export",
  "quantity_month": 4500,
  "value_month_usd": 32000000,
  "is_derived": true,
  "version": "derived",
  "source_note": "Ước tính YTD Diff (2020-05 - 2020-04)",
  "debug_source_file": "BACKFILL",
  "debug_source_type": "ytd_diff",
  "debug_source_note": "YTD_2020-05(45000) - YTD_2020-04(40500) = 4500 tấn, $3.2M"
}
```

#### 2020-12 (YoY Proxy)
```json
{
  "period": "2020-12",
  "direction": "export",
  "quantity_month": 52000,
  "value_month_usd": 38000000,
  "is_derived": true,
  "version": "derived",
  "source_note": "Ước tính YoY Proxy (2021-12)",
  "debug_source_file": "BACKFILL",
  "debug_source_type": "yoy_proxy",
  "debug_source_note": "Lấy giá trị từ 2021-12: 52000 tấn, $38M"
}
```

### 4.3. Hiển thị trên Dashboard

Khi user hover vào badge "⚡ Ước tính (Fallback)":
```
Nguồn: YTD Diff (2020-05 - 2020-04)
Chi tiết: YTD_05 = 45,000 → YTD_04 = 40,500 → Month = 4,500 tấn
```

---

## 5. KẾ HOẠCH IMPLEMENTATION

### Phase 1: Sửa `data_builder.py` — Backfill Summary + Other

**File:** `pipeline/data_builder.py`  
**Hàm:** `apply_auto_backfill()`

#### Thay đổi 1: Thêm logic YTD Diff cho tháng 01

```python
# THÁNG 01: Month = YTD
if month == "01":
    ytd_qty = sum(r.get('ytd_luong') or 0 for r in country_rows)
    ytd_val = sum(r.get('ytd_tri_gia') or 0 for r in country_rows)
    
    backfilled[sum_key] = {
        "quantity_month": ytd_qty,
        "value_month_usd": ytd_val,
        "quantity_ytd": ytd_qty,
        "value_ytd_usd": ytd_val,
        "is_derived": True,
        "version": "derived",
        "source_note": "Ước tính YTD Diff (Tháng 01 YTD)",
        # DEBUG
        "debug_source_file": "BACKFILL",
        "debug_source_type": "ytd_diff",
        "debug_source_note": f"YTD_01 = sum(country_rows) = {ytd_qty} tấn, ${ytd_val/1e6:.2f}M",
    }
```

#### Thay đổi 2: Thêm logic YTD Diff cho tháng M>01

```python
# THÁNG M>01: Month = YTD(M) - YTD(M-1)
prev_p = get_previous_period(period)
if prev_p in periods_data:
    prev_ytd_q = periods_data[prev_p].get(sum_key, {}).get('quantity_ytd') or 0
    prev_ytd_v = periods_data[prev_p].get(sum_key, {}).get('value_ytd_usd') or 0
    
    curr_ytd_q = sum(r.get('ytd_luong') or 0 for r in country_rows)
    curr_ytd_v = sum(r.get('ytd_tri_gia') or 0 for r in country_rows)
    
    if curr_ytd_q > prev_ytd_q and curr_ytd_v > prev_ytd_v:
        month_q = curr_ytd_q - prev_ytd_q
        month_v = curr_ytd_v - prev_ytd_v
        
        backfilled[sum_key] = {
            ...
            "source_note": f"Ước tính YTD Diff ({period} - {prev_p})",
            "debug_source_note": f"YTD_{period}({curr_ytd_q}) - YTD_{prev_p}({prev_ytd_q}) = {month_q} tấn",
        }
```

#### Thay đổi 3: Thêm logic YoY Proxy

```python
# YoY Proxy: Month(N) ≈ Month(N-1)
prev_year_p = get_previous_year_period(period)
if prev_year_p in periods_data:
    prev_sum = periods_data[prev_year_p].get(sum_key, {})
    if prev_sum.get('quantity_month') and prev_sum.get('value_month_usd'):
        backfilled[sum_key] = {
            ...
            "source_note": f"Ước tính YoY Proxy ({prev_year_p})",
            "debug_source_type": "yoy_proxy",
            "debug_source_note": f"Lấy từ {prev_year_p}: {prev_sum['quantity_month']} tấn",
        }
```

#### Thay đổi 4: Tính Other row sau khi backfill

```python
# Sau khi backfill summary, đảm bảo Other row tồn tại
for period, item in periods_data.items():
    # Export
    if item.get('tong_xk'):
        sum_val = item['tong_xk'].get('value_month_usd') or 0
        calc_val = sum(r.get('cy_tri_gia') or 0 for r in item.get('xk_theo_nuoc', []))
        other_val = sum_val - calc_val
        
        # Kiểm tra Other row
        other_rows = [r for r in item.get('xk_theo_nuoc', []) 
                     if r.get('country', '').upper() == 'OTHER']
        
        if not other_rows and other_val != 0:
            # Thêm Other row
            item['xk_theo_nuoc'].append({
                'country': 'Other',
                'product': 'Hạt điều',
                'unit': 'Tấn',
                'cy_luong': sum_val - sum(r.get('cy_luong') or 0 for r in item['xk_theo_nuoc']),
                'cy_tri_gia': other_val,
                'debug_source_file': 'BACKFILL',
                'debug_source_type': 'calculated',
                'debug_source_note': f'Other = Summary(${sum_val/1e6:.2f}M) - Countries(${calc_val/1e6:.2f}M)',
            })
```

### Phase 2: Sửa `ocr_pipeline.py` — Normalize với Backfill Summary

**File:** `pipeline/ocr_pipeline.py`  
**Hàm:** `normalize_country_product()`

#### Thêm parameter `backfill_summary`

```python
def normalize_country_product(rows, summary_rows=None, preferred_summary=None, backfill_summary=None):
    """
    backfill_summary: dict summary từ backfill (khi preferred_summary là None)
    """
    # Ưu tiên: preferred_summary → backfill_summary → summary_rows
    s_row = preferred_summary or backfill_summary
    if not s_row and summary_rows:
        s_row = summary_rows[0] if summary_rows else None
```

### Phase 3: Rebuild & Verify

```powershell
# Bước 1: Rebuild all-years với backfill mới
python main.py --backfill

# Bước 2: Verify kết quả
python diagnostics/audit_other_row.py

# Bước 3: Check JSON có debug fields
python -c "
import json
with open('output/data/all_years_cashew.json') as f:
    data = json.load(f)
for p in ['2020-05', '2022-04', '2023-02']:
    xk = data['periods'].get(p, {}).get('tong_xk', {})
    print(f'{p}: derived={xk.get(\"is_derived\")}, debug={xk.get(\"debug_source_type\")}')
"
```

---

## 6. CHECKLIST NGHIỆM THU

### Trước khi chạy fix:
- [ ] Backup `output/data/all_years_cashew.json`
- [ ] Backup `output/all_years_cashew.xlsx`

### Sau khi chạy fix:
- [ ] 18/18 kỳ có summary row (official hoặc derived)
- [ ] 18/18 kỳ có Other row trong country sheets
- [ ] Tất cả derived rows có debug fields đầy đủ
- [ ] QC report `aggregate_reconciliation.json` status = `ok`
- [ ] Dashboard hiển thị đúng "Other" value cho 18 kỳ
- [ ] Không có duplicate rows

### Test cases:
- [ ] 2020-05: Month = YTD_05 - YTD_04 ✓
- [ ] 2020-12: Month ≈ 2021-12 (YoY) ✓
- [ ] 2022-01: Month = YTD_01 (tháng 01) ✓
- [ ] 2024-07: Month ≈ 2023-07 (YoY) ✓

---

## 7. DANH SÁCH FILES SỬA ĐỔI

| File | Hàm sửa | Lines ước lượng |
|------|---------|-----------------|
| `pipeline/data_builder.py` | `apply_auto_backfill()` | +50 lines |
| `pipeline/ocr_pipeline.py` | `normalize_country_product()` | +10 lines |
| `diagnostics/audit_other_row.py` | (giữ nguyên) | - |
| `README.md` | Cập nhật docs | +20 lines |

---

## 8. LỆNH THỰC THI SAU KHI DUYỆT

```powershell
# 1. Rebuild với backfill mới
python main.py --backfill

# 2. Verify audit
python diagnostics/audit_other_row.py
Get-Content output/docs/audit_other_row_report.txt

# 3. Check debug fields trong JSON
python -c "
import json
with open('output/data/all_years_cashew.json') as f:
    data = json.load(f)
missing = [p for p in data['periods'] if not data['periods'][p].get('tong_xk')]
print(f'Periods still missing XK summary: {missing}')
"

# 4. Khởi động dashboard
python serve_dashboard.py
# Mở http://127.0.0.1:8080
```

---

**👉 Chờ phê duyệt plan trước khi viết code!**
