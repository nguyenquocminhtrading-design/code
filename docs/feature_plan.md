# Plan: Other Row + Data Builder + Output Restructure

## Tổng quan 3 phần việc

| # | Phần | File thay đổi | Ghi chú |
|---|------|--------------|---------|
| 1 | Tính năng **Other row** trong XK_Theo_Nuoc | `pipeline/ocr_pipeline.py` | Thêm logic sau normalize |
| 2 | File mới **data_builder.py** | `pipeline/data_builder.py` (mới) | Layer dữ liệu cho web |
| 3 | **Migrate + tái cấu trúc** output thư mục | `migrate_output.py` (script 1 lần) + sửa path trong `ocr_pipeline.py` + `main.py` | `YYYY-MM/` → `YYYY/` |

---

## Phần 1 — Tính năng "Other" row cuối sheet XK_Theo_Nuoc

### Logic
```
Other.CY_Luong   = Tong_XK.quantity_month  − SUM(XK_Theo_Nuoc.CY_Luong)
Other.CY_TriGia  = Tong_XK.value_month_usd − SUM(XK_Theo_Nuoc.CY_TriGia_USD)
```
- YTD: để trống (None / pd.NA)
- Quốc gia: `"Other"`, mặt hàng: `"Hạt điều"`, ĐVT: kế thừa từ dòng Tong_XK

### Điểm thay đổi trong `ocr_pipeline.py`

1. **`normalize_country_product(rows, summary_rows=None)`** — thêm tham số `summary_rows`  
   - Sau khi build `pivot_df`, tính `total_from_A` từ `summary_rows`  
   - Tính `sum_B_luong` và `sum_B_trigia` từ `pivot_df`  
   - Append hàng `Other` vào `pivot_df` nếu `total_from_A` có giá trị

2. **`run_period()`** — truyền `summary_rows` vào `normalize_country_product(country_rows, summary_rows)`

3. **`write_excel_output()`** — không cần sửa gì, hàng Other tự vào cuối vì pivot_df đã có

### Dòng pivot_df cuối cùng sẽ là:
| Quốc gia | mặt hàng | ĐVT | CY Lượng | CY Trị giá (USD) | YTD Lượng | YTD Trị giá (USD) |
|----------|---------|-----|----------|-----------------|-----------|-------------------|
| Other | Hạt điều | Tấn | X | Y | `<NA>` | `<NA>` |

---

## Phần 2 — `pipeline/data_builder.py` (file mới)

### Nhiệm vụ
- Đọc tất cả `.xlsx` trong `output/YYYY/` (sau migrate)
- Parse sheet `Tong_XK` + `XK_Theo_Nuoc` từ mỗi file
- Merge thành dict `{period: {tong_xk: {...}, xk_theo_nuoc: [...]}}` 
- Ghi `output/data/YYYY_cashew.json` cho mỗi năm

### CLI
```powershell
# Rebuild tất cả
python pipeline/data_builder.py

# Chỉ rebuild 1 năm
python pipeline/data_builder.py --year 2025

# Chỉ update 1 period (gọi từ ocr_pipeline sau mỗi run)
python pipeline/data_builder.py --period 2025-09
```

### Cấu trúc JSON output
```json
{
  "year": 2025,
  "generated_at": "2025-10-24T...",
  "periods": {
    "2025-01": {
      "tong_xk": {
        "quantity_month": 64888,
        "value_month_usd": 469933462,
        "quantity_ytd": 542768,
        "value_ytd_usd": 3844003009
      },
      "xk_theo_nuoc": [
        { "country": "TRUNG QUỐC", "cy_luong": 30000, "cy_tri_gia": 200000000, "ytd_luong": null, "ytd_tri_gia": null },
        { "country": "Other", "cy_luong": 5000, "cy_tri_gia": 40000000, "ytd_luong": null, "ytd_tri_gia": null }
      ]
    }
  }
}
```

### Tích hợp với ocr_pipeline.py
Cuối `run_period()`, sau khi save xlsx, thêm:
```python
from pipeline.data_builder import update_period_data
update_period_data(period)
```

---

## Phần 3 — Tái cấu trúc output + Migration

### Layout mới
```
output/
├── 2020/
│   ├── 2020-01_cashew.xlsx
│   ├── 2020-02_cashew.xlsx
│   │     ...
│   └── 2020-12_cashew.xlsx
├── 2021/
│   └── ...
├── data/                        ← MỚI: JSON database layer
│   ├── 2020_cashew.json
│   ├── 2021_cashew.json
│   └── ...
└── _logs/
```

> **Lưu ý:** `pdfs/` và `manifest.json` từ layout cũ sẽ KHÔNG được migrate sang layout mới (chỉ xlsx là quan trọng).

### `migrate_output.py` (script 1 lần, tạo mới ở root code/)
```
Cho mỗi output/YYYY-MM/:
  1. Tìm YYYY-MM_cashew.xlsx
  2. Move → output/YYYY/YYYY-MM_cashew.xlsx
  3. Xóa thư mục YYYY-MM/ cũ (sau khi move xong)
```

### Sửa path trong ocr_pipeline.py
- `out_dir = OUTPUT_DIR / period`  
  → `out_dir = OUTPUT_DIR / year`  
- `fname = out_dir / f"{period}_cashew.xlsx"`  
  → `fname = out_dir / f"{period}_cashew.xlsx"` (tên file giữ nguyên, chỉ thư mục thay đổi)

### Sửa path trong main.py
- Chỗ nào dùng `OUTPUT_DIR / period` → `OUTPUT_DIR / year`
- Chỗ nào copy PDF vào `output/YYYY-MM/pdfs/` → bỏ qua pdfs/ hoặc giữ trong `output/YYYY/pdfs/YYYY-MM/`

---

## Thứ tự thực hiện

```
Step 1: Sửa ocr_pipeline.py — thêm Other row logic
Step 2: Tạo pipeline/data_builder.py
Step 3: Tạo migrate_output.py + chạy migrate
Step 4: Sửa path output trong ocr_pipeline.py + main.py
Step 5: Update README.md
```

---

## Files thay đổi tóm tắt

| File | Action |
|------|--------|
| `pipeline/ocr_pipeline.py` | Sửa `normalize_country_product`, `run_period`, `write_excel_output` (path) |
| `pipeline/data_builder.py` | **TẠO MỚI** |
| `migrate_output.py` | **TẠO MỚI** (script 1 lần) |
| `main.py` | Sửa output path references |
| `README.md` | Update project structure + commands |
