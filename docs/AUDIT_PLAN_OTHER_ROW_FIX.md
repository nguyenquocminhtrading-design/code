# 📋 AUDIT PLAN: Other Row Calculation & Missing Summary Fix

**Ngày lập:** 2026-10-26  
**Trạng thái:** Chờ phê duyệt  
**Scope:** `output/YYYY/YYYY-MM/` Excel files — sheet `Tong_Quan_XNK`, `XK_Theo_Nuoc`, `NK_Theo_Nuoc`

---

## 1. TỔNG QUAN AUDIT

### Kết quả kiểm tra 81 file Excel

| Trạng thái | Số lượng | Ghi chú |
|------------|----------|---------|
| ✅ OK | **65** | Có đủ Summary + Other row |
| ❌ Thiếu Summary | **18** | Không tính được Other |
| ⚠️ Thiếu Other | **0** | Tất cả đều có Other row |

### Quy tắc tính Other

```
Other = Summary[CY Trị giá] - SUM(Các quốc gia thật)
```

**Điều kiện để tính được Other:**
1. ✅ Có summary row trong sheet `Tong_Quan_XNK`
2. ✅ Có country rows trong sheet `XK_Theo_Nuoc` / `NK_Theo_Nuoc`
3. ❌ **Nếu summary missing → Other không tính được**

---

## 2. DANH SÁCH 18 FILE THIẾU SUMMARY (KHÔNG TÍNH ĐƯỢC OTHER)

### 2.1. Xuất khẩu (XK) — 11 kỳ thiếu summary

| # | Kỳ | File | Lý do backfill | Tình trạng Other |
|---|-----|------|----------------|------------------|
| 1 | 2020-05 | `2020\2020-05\2020-05_cashew.xlsx` | YTD Diff (2020-05 - 2020-04) | ❌ NO |
| 2 | 2020-12 | `2020\2020-12\2020-12_cashew.xlsx` | YoY Proxy (2021-12) | ❌ NO |
| 3 | 2022-04 | `2022\2022-04\2022-04_cashew.xlsx` | YTD Diff (2022-04 - 2022-03) | ❌ NO |
| 4 | 2022-06 | `2022\2022-06\2022-06_cashew.xlsx` | YTD Diff (2022-06 - 2022-05) | ❌ NO |
| 5 | 2022-11 | `2022\2022-11\2022-11_cashew.xlsx` | YoY Proxy (2021-11) | ❌ NO |
| 6 | 2023-02 | `2023\2023-02\2023-02_cashew.xlsx` | YTD Diff (2023-02 - 2023-01) | ❌ NO |
| 7 | 2024-02 | `2024\2024-02\2024-02_cashew.xlsx` | YTD Diff (2024-02 - 2024-01) | ❌ NO |
| 8 | 2024-07 | `2024\2024-07\2024-07_cashew.xlsx` | YoY Proxy (2023-07) | ❌ NO |
| 9 | 2024-12 | `2024\2024-12\2024-12_cashew.xlsx` | YoY Proxy (2023-12) | ❌ NO |
| 10 | 2025-03 | `2025\2025-03\2025-03_cashew.xlsx` | YTD Diff (2025-03 - 2025-02) | ❌ NO |
| 11 | 2025-10 | `2025\2025-10\2025-10_cashew.xlsx` | YoY Proxy (2024-10) | ❌ NO |

### 2.2. Nhập khẩu (NK) — 7 kỳ thiếu summary

| # | Kỳ | File | Lý do backfill | Tình trạng Other |
|---|-----|------|----------------|------------------|
| 1 | 2022-01 | `2022\2022-01\2022-01_cashew.xlsx` | YTD Diff (Tháng 01 YTD) | ❌ NO |
| 2 | 2022-04 | `2022\2022-04\2022-04_cashew.xlsx` | YTD Diff (2022-04 - 2022-03) | ❌ NO |
| 3 | 2022-09 | `2022\2022-09\2022-09_cashew.xlsx` | YoY Proxy (2021-09) | ❌ NO |
| 4 | 2023-02 | `2023\2023-02\2023-02_cashew.xlsx` | YTD Diff (2023-02 - 2023-01) | ❌ NO |
| 5 | 2023-04 | `2023\2023-04\2023-04_cashew.xlsx` | YTD Diff (2023-04 - 2023-03) | ❌ NO |
| 6 | 2024-03 | `2024\2024-03\2024-03_cashew.xlsx` | YoY Proxy (2023-03) | ❌ NO |
| 7 | 2024-05 | `2024\2024-05\2024-05_cashew.xlsx` | YoY Proxy (2023-05) | ❌ NO |

### 2.3. Kỳ thiếu CẢ 2 luồng (XK + NK)

| Kỳ | File XK | File NK | Ghi chú |
|----|---------|---------|---------|
| 2022-04 | ❌ | ❌ | Thiếu cả 2 |
| 2023-02 | ❌ | ❌ | Thiếu cả 2 |

---

## 3. PHÂN TÍCH NGUYÊN NHÂN

### Tại sao backfill không tạo được Other row?

**Code hiện tại trong `ocr_pipeline.py` (line 494-607):**

```python
def normalize_country_product(rows, summary_rows=None, preferred_summary=None):
    # ...
    if s_row:  # Nếu có summary
        # Tính Other = Summary - SUM(countries)
        other_luong = int(a_luong) - sum_luong
        other_trigia = int(a_trigia) - sum_trigia
        # Thêm Other row vào pivot_df
    else:
        # KHÔNG CÓ SUMMARY → KHÔNG TÍNH ĐƯỢC OTHER
        sub_pivot["Phiên bản"] = ver_vn
        # pivot_df không có Other row!
```

**Vấn đề:** Khi `preferred_summary` là None (backfill chưa chạy), hàm `normalize_country_product()` không thêm được Other row.

### Chuỗi sự kiện gây lỗi

```
1. PDF không có → OCR không chạy
         ↓
2. summary_rows = [] (trống)
         ↓
3. attempt_backfill_summary() → trả về None (chưa có prev/next period)
         ↓
4. write_excel_output() → pivot_df không có Other row
         ↓
5. File Excel thiếu summary + Other row
```

---

## 4. KẾ HOẠCH SỬA CHỮA

### Phase 1: Sửa ocr_pipeline.py — Backfill Other row

**File:** `pipeline/ocr_pipeline.py`  
**Hàm:** `normalize_country_product()`

#### Thay đổi 1: Thêm parameter `backfill_summary`

```python
def normalize_country_product(rows, summary_rows=None, preferred_summary=None, backfill_summary=None):
    """
    backfill_summary: dict với keys quantity_month, value_month_usd
    Dùng khi preferred_summary là None (backfill case)
    """
```

#### Thay đổi 2: Ưu tiên backfill_summary khi preferred_summary trống

```python
# TRƯỚC:
s_row = next((r for r in summary_list if r.get("version") == ver ...), None)
if not s_row and preferred_summary:
    s_row = preferred_summary

# SAU:
s_row = next((r for r in summary_list if r.get("version") == ver ...), None)
if not s_row and preferred_summary:
    s_row = preferred_summary
if not s_row and backfill_summary:
    s_row = backfill_summary  # MỚI: dùng backfill summary
```

#### Thay đổi 3: Cập nhật lời gọi hàm

```python
# Trong run_period() — line ~1239
export_pivot_df = normalize_country_product(
    export_country, 
    export_summary, 
    best_export_s,
    backfill_summary=best_export_s  # MỚI: truyền backfill summary
)
```

### Phase 2: Sửa data_builder.py — Ensure Other row exists

**File:** `pipeline/data_builder.py`  
**Hàm:** `apply_auto_backfill()`

#### Thêm logic tạo Other row sau backfill

```python
def apply_auto_backfill(periods_data: dict) -> int:
    # ... existing backfill logic ...

    # MỚI: Sau khi backfill summary, đảm bảo Other row tồn tại
    for period, item in periods_data.items():
        # Xử lý export
        if item.get('tong_xk') and item.get('xk_theo_nuoc'):
            sum_val = item['tong_xk'].get('value_month_usd') or 0
            calc_val = sum(r.get('cy_tri_gia') or 0 for r in item['xk_theo_nuoc'])
            other_val = sum_val - calc_val

            # Kiểm tra có Other row chưa
            has_other = any(r.get('country', '').upper() == 'OTHER' for r in item['xk_theo_nuoc'])
            if not has_other:
                # Thêm Other row
                item['xk_theo_nuoc'].append({
                    'country': 'Other',
                    'product': 'Hạt điều',
                    'unit': 'Tấn',
                    'cy_luong': sum_val - sum(r.get('cy_luong') or 0 for r in item['xk_theo_nuoc']),
                    'cy_tri_gia': other_val,
                    'ytd_luong': None,
                    'ytd_tri_gia': None,
                    'version': 'Chính thức',
                    'debug_source_file': 'BACKFILL',
                    'debug_source_type': 'derived',
                    'debug_source_note': f'Calculated: Summary({sum_val}) - Countries({calc_val})',
                })

        # Tương tự cho import...

    return backfilled_count
```

### Phase 3: Sửa write_excel_output() — Đảm bảo ghi Other row

**File:** `pipeline/ocr_pipeline.py`  
**Hàm:** `write_excel_output()`

#### Thêm validation trước khi ghi

```python
def write_excel_output(summary_rows, pivot_df, period, out_dir, ...):
    # Validation: đảm bảo pivot_df có Other row nếu có summary
    if pivot_df is not None and not pivot_df.empty:
        has_other = 'Other' in pivot_df['Quốc gia'].values
        has_summary = any(r.get('value_month_usd') for r in summary_rows)

        if has_summary and not has_other:
            log.warning("[%s] pivot_df missing Other row — recalculating...", period)
            # Recalculate Other row
            recalculated = recalculate_other_row(pivot_df, summary_rows)
            if recalculated is not None:
                pivot_df = recalculated
```

### Phase 4: Rebuild all-years với fix mới

```powershell
# Chạy lại toàn bộ backfill với Other row fix
python main.py --backfill

# Verify kết quả
python diagnostics/audit_other_row.py
```

---

## 5. DANH SÁCH HÀNH ĐỘNG CHI TIẾT

### Action 1: Sửa `normalize_country_product()` trong `ocr_pipeline.py`

**Dòng cần sửa:** ~494-607  
**Thay đổi:**
- Thêm parameter `backfill_summary`
- Ưu tiên dùng backfill_summary khi preferred_summary là None
- Đảm bảo Other row được tính đúng

### Action 2: Sửa `apply_auto_backfill()` trong `data_builder.py`

**Dòng cần sửa:** ~299-407  
**Thay đổi:**
- Thêm block sau khi backfill xong: đảm bảo Other row tồn tại
- Tính `Other = Summary - SUM(countries)` cho mỗi period
- Thêm debug columns vào Other row

### Action 3: Sửa `write_excel_output()` trong `ocr_pipeline.py`

**Dòng cần sửa:** ~748-1002  
**Thay đổi:**
- Thêm validation: check Other row trước khi ghi
- Tự động recalculcate Other nếu thiếu

### Action 4: Run rebuild

```powershell
python main.py --backfill
python diagnostics/audit_other_row.py  # Verify
```

---

## 6. KẾT QUẢ MONG ĐỢI SAU KHI FIX

### Trước fix (hiện tại):
```
18 files: MISSING_SUMMARY_XK hoặc MISSING_SUMMARY_NK
→ Other row không tồn tại
→ Dashboard hiển thị "Other" = 0 hoặc missing
```

### Sau fix:
```
81 files: TẤT CẢ ĐỀU CÓ Summary + Other row
→ Other row được tính từ Summary - SUM(countries)
→ Dashboard hiển thị đúng "Other" value
→ QC report status = ok
```

---

## 7. CHECKLIST NGHIỆM THU

- [ ] 18 file thiếu summary được thêm backfill summary row
- [ ] 18 file có Other row sau backfill
- [ ] QC report `aggregate_reconciliation.json` status = `ok`
- [ ] Dashboard hiển thị đúng "Other" value cho 18 kỳ
- [ ] Không có duplicate Other rows
- [ ] Debug columns đúng định dạng

---

## 8. FILES CẦN SỬA

| File | Hàm cần sửa | Số dòng ước lượng |
|------|-------------|-------------------|
| `pipeline/ocr_pipeline.py` | `normalize_country_product()`, `write_excel_output()` | ~50 lines |
| `pipeline/data_builder.py` | `apply_auto_backfill()` | ~30 lines |
| `diagnostics/audit_other_row.py` | (giữ nguyên — đã có) | - |

---

**👉 Chờ phê duyệt plan để bắt đầu implement!**
