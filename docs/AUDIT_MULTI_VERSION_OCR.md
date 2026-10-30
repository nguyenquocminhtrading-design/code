# 🔍 KIỂM TRA OCR ĐA PHIÊN BẢN — Báo Cáo & Kế Hoạch Sửa Chữa (Đã Cập Nhật)

**Ngày lập:** 2026-10-27  
**Trạng thái:** ✅ ĐÃ IMPLEMENT & VERIFY (2026-10-27)  
**Phạm vi:** `pipeline/ocr_pipeline.py`, `pipeline/data_builder.py`, `web/app.js`

---

## MỤC LỤC

1. [Thực Trạng Hiện Tại](#1-thực-trạng-hiện-tại)
2. [Phân Tích Vấn Đề](#2-phân-tích-vấn-đề)
3. [Thiết Kế Mới — Cấu Trúc Excel & JSON](#3-thiết-kế-mới)
4. [Kế Hoạch Sửa Chữa Chi Tiết](#4-kế-hoạch-sửa-chữa-chi-tiết)
5. [Kiểm Thử Nghiệm Thu](#5-kiểm-thử-nghiệm-thu)
6. [Rủi Ro & Lưu Ý](#6-rủi-ro--lưu-ý)

---

## 1. THỰC TRẠNG HIỆN TẠI

### 1.1. Ví Dụ Kỳ 2020-01

**File PDF có trong thư mục:**
```
output/2020/2020-01/Xuat_Khau/
├── 2020-T01-2X(VN-DC2).pdf      ← Adjusted
├── 2020-T01T-2X(VN-CT).pdf      ← Official
├── 2020-T01T-2X(VN-SB).pdf      ← Preliminary
├── 2020-T01T-5X(VN-CT)-final.pdf
├── 2020-T01T-5X(VN-DC).pdf
└── 2020-T01T-5X(VN-SB).pdf
```
→ **6 PDF** (3 phiên bản × 2 loại: 2X tóm tắt + 5X theo quốc gia)

**Excel hiện tại (`2020-01_cashew.xlsx`):**

| Sheet | Dòng | Vấn đề |
|-------|------|--------|
| `Tong_Quan_XNK` | 2 | ❌ Chỉ Official, thiếu Adjusted + Preliminary |
| `XK_Theo_Nuoc` | 31 | ❌ Tất cả gán "Chính thức", thiếu 2 version còn lại |
| `NK_Theo_Nuoc` | 31 | ❌ Tương tự |
| `Lich_Su_Phien_Ban` | 7 | ⚠️ Có đủ 3 version nhưng không gắn file nguồn |

### 1.2. Kiểm Tra Nhanh

```
Tong_Quan_XNK:
  Row 1: XK - Chính thức - 25.259 tấn - $176,6M ✅
  Row 2: NK - Chính thức - 52.084 tấn - $85,0M ✅
         ❌ THIẾU: Điều chỉnh + Sơ bộ

XK_Theo_Nuoc:
  - 30 quốc gia + 1 Other = 31 dòng
  - ❌ THIẾU: 30 dòng Điều chỉnh + 30 dòng Sơ bộ
  - ❌ THIẾU: Cột debug_source_file
```

---

## 2. PHÂN TÍCH VẤN ĐỀ

### 2.1. Hàm `_best_summary_row()` Chỉ Giữ 1 Phiên Bản

**Vị trí:** `ocr_pipeline.py:1245-1254`

```python
def _best_summary_row(rows_list):
    for v in ("official", "adjusted", "preliminary", "derived"):
        for r in rows_list:
            if r.get("version") == v:
                return r  # ← Tìm là trả về, bỏ qua các version khác!
```

**Hậu quả:** 3 summary rows → chỉ giữ 1 → mất 2 version.

### 2.2. `normalize_country_product()` Không Xử Lý Đa Version

```python
s_row = next((r for r in summary_list if r.get("version") == ver), None)
if not s_row and preferred_summary:
    s_row = preferred_summary  # ← Fallback sang best summary!
```

**Hậu quả:** All versions dùng chung 1 summary → Other row sai.

### 2.3. Thiếu Debug Columns

**COL_VI hiện tại:**
```python
["Quốc gia", "mặt hàng", "Đơn vị tính",
 "CY Lượng", "CY Trị giá (USD)",
 "YTD Lượng", "YTD Trị giá (USD)",
 "Phiên bản"]
```

**Thiếu:** `debug_source_file`, `debug_source_type`, `debug_source_note`

---

## 3. THIẾT KẾ MỚI

### 3.1. Cấu Trúc Excel Mỗi Kỳ (Ví dụ 2020-01)

#### Sheet 1: `Tong_Quan_XNK` — TẤT CẢ SUMMARY GỌP CHUNG

| STT | Kỳ | Luồng | Mặt hàng | ĐVT | CY Lượng | CY Trị giá | % Tháng trước | YTD Lượng | YTD Trị giá | Phiên bản | File nguồn |
|-----|-----|-------|----------|-----|----------|------------|---------------|-----------|-------------|-----------|------------|
| 1 | 2020-01 | XK | Hạt điều | Tấn | 25.253 | 176.571.066 | - | 25.253 | 176.571.066 | Điều chỉnh | 2X(VN-DC2).pdf |
| 2 | 2020-01 | XK | Hạt điều | Tấn | 25.259 | 176.602.478 | -405 | -407 | 25.259 | 176.602.478 | Chính thức | 2X(VN-CT).pdf |
| 3 | 2020-01 | XK | Hạt điều | Tấn | 24.687 | 172.552.589 | - | - | 24.687 | 172.552.589 | Sơ bộ | 2X(VN-SB).pdf |
| 4 | 2020-01 | NK | Hạt điều | Tấn | ... | ... | ... | ... | ... | Điều chỉnh | 2N(VN-DC2).pdf |
| 5 | 2020-01 | NK | Hạt điều | Tấn | ... | ... | ... | ... | ... | Chính thức | 2N(VN-CT).pdf |
| 6 | 2020-01 | NK | Hạt điều | Tấn | ... | ... | ... | ... | ... | Sơ bộ | 2N(VN-SB).pdf |

→ **6 dòng summary** (3 XK + 3 NK)

---

#### Sheet 2: `XK_ChinhThuc` — Xuất khẩu Chính thức

| Quốc gia | mặt hàng | ĐVT | CY Lượng | CY Trị giá | YTD Lượng | YTD Trị giá | Phiên bản | debug_source_file |
|----------|----------|-----|----------|------------|-----------|-------------|-----------|-------------------|
| HOA KỲ | Hạt điều | Tấn | 8.121 | 54.943.127 | 8.121 | 54.943.127 | Chính thức | 5X(VN-CT).pdf |
| HÀ LAN | Hạt điều | Tấn | 2.767 | 21.130.979 | 2.767 | 21.130.979 | Chính thức | 5X(VN-CT).pdf |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Other | Hạt điều | Tấn | 2.542 | 17.041.759 | null | null | Chính thức | BACKFILL |

→ **~31 dòng** (30 quốc gia + 1 Other)

---

#### Sheet 3: `XK_DieuChinh` — Xuất khẩu Điều chỉnh

| Quốc gia | ... | debug_source_file |
|----------|-----|-------------------|
| HOA KỲ | ... | 5X(VN-DC).pdf |
| ... | ... | ... |
| Other | ... | BACKFILL |

→ **~31 dòng**

---

#### Sheet 4: `XK_SoBo` — Xuất khẩu Sơ bộ

→ **~31 dòng**

---

#### Sheet 5-7: Tương tự cho NK (NK_ChinhThuc, NK_DieuChinh, NK_SoBo)

---

### 3.2. Cấu Trúc JSON — 1 FILE DUY NHẤT

**File:** `output/data/all_years_cashew.json`

```json
{
  "schema_version": 3,
  "generated_at": "...",
  "years": [2020, 2021, ...],
  "periods": {
    "2020-01": {
      "tong_xk": [
        { "version": "adjusted", "quantity_month": 25253, "value_month_usd": 176571066, "debug_source_file": "2X(VN-DC2).pdf" },
        { "version": "official",  "quantity_month": 25259, "value_month_usd": 176602478, "debug_source_file": "2X(VN-CT).pdf" },
        { "version": "preliminary", "quantity_month": 24687, "value_month_usd": 172552589, "debug_source_file": "2X(VN-SB).pdf" }
      ],
      "tong_nk": [ ... ],
      "xk_theo_nuoc": {
        "Chính thức": [
          { "country": "HOA KỲ", "cy_luong": 8121, "cy_tri_gia": 54943127, "debug_source_file": "5X(VN-CT).pdf" },
          { "country": "Other", "cy_luong": 2542, "cy_tri_gia": 17041759, "debug_source_type": "calculated" }
        ],
        "Điều chỉnh": [ ... ],
        "Sơ bộ": [ ... ]
      },
      "nk_theo_nuoc": { ... }
    }
  },
  "records": [
    // Flat list cho web load nhanh
    { "period": "2020-01", "source": "tchq", "flow": "export", "version": "official",
      "country": "HOA KỲ", "cy_luong": 8121, "cy_tri_gia": 54943127,
      "debug_source_file": "5X(VN-CT).pdf" },
    ...
  ]
}
```

---

### 3.3. Cấu Trúc All-Years Excel — splits Theo Phiên Bản

**Vấn đề:** Nếu gộp tất cả vào 1 file Excel → file quá lớn (~50MB+).

**Giải pháp:** Tách thành 3 file Excel + 1 JSON duy nhất:

```
output/
├── all_years_cashew.json                    ← 1 file JSON duy nhất (web load từ đây)
├── all_years_cashew_ChinhThuc.xlsx          ← Sheet: Tong_Quan + XK_ChinhThuc + NK_ChinhThuc
├── all_years_cashew_DieuChinh.xlsx          ← Sheet: Tong_Quan + XK_DieuChinh + NK_DieuChinh
└── all_years_cashew_SoBo.xlsx               ← Sheet: Tong_Quan + XK_SoBo + NK_SoBo
```

**Tên sheet trong mỗi file:**
- `Tong_Quan` — summary của phiên bản đó
- `XK_ChinhThuc` / `XK_DieuChinh` / `XK_SoBo` — country breakdown
- `NK_ChinhThuc` / `NK_DieuChinh` / `NK_SoBo` — country breakdown
- `Lich_Su_Phien_Ban` — version history (chung cho cả 3 file)

---

## 4. KẾ HOẠCH SỬA CHỮA CHI TIẾT

### Phase 1: Thêm Debug Columns (P0)

**File:** `pipeline/ocr_pipeline.py`

#### 1.1. Cập nhật COL_VI
```python
COL_VI = [
    "Quốc gia", "mặt hàng", "Đơn vị tính",
    "CY Lượng", "CY Trị giá (USD)",
    "YTD Lượng", "YTD Trị giá (USD)",
    "Phiên bản",
    # DEBUG
    "debug_source_file",
    "debug_source_type",
    "debug_source_note",
]
```

#### 1.2. Thêm debug vào `parse_country_product()`
```python
results.append({
    ...
    "debug_source_file": pdf_path.name,
    "debug_source_type": "pdf",
    "debug_source_note": f"OCR from {pdf_path.name}",
})
```

#### 1.3. Thêm debug vào `parse_summary()`
```python
results.append({
    ...
    "debug_source_file": pdf_path.name,
    "debug_source_type": "pdf",
    "debug_source_note": f"Summary OCR from {pdf_path.name}",
})
```

---

### Phase 2: Giữ Lại Tất Cả Phiên Bản (P0)

**File:** `pipeline/ocr_pipeline.py`

#### 2.1. Bỏ hàm `_best_summary_row()`, giữ tất cả
```python
# XÓA hàm _best_summary_row()
# THAY BẰNG:
all_export_summaries = export_summary  # Giữ TẤT CẢ
all_import_summaries = import_summary
```

#### 2.2. Sửa `normalize_country_product()` — Nhóm theo version
```python
def normalize_country_product(rows, summary_rows=None):
    """
    Group by version, calculate Other for EACH version independently.
    Returns dict: { version_name: DataFrame }
    """
    # Nhóm country rows theo version
    version_groups = {}
    for r in rows:
        v = r.get("version", "unknown")
        if v not in version_groups:
            version_groups[v] = []
        version_groups[v].append(r)
    
    # Tìm summary cho mỗi version
    summary_by_ver = {}
    for s in (summary_rows or []):
        v = s.get("version", "unknown")
        if v not in summary_by_ver:
            summary_by_ver[v] = s
    
    result = {}
    for ver, ver_rows in version_groups.items():
        s_row = summary_by_ver.get(ver)
        df = build_pivot_df(ver_rows, s_row)
        result[ver] = df
    
    return result
```

#### 2.3. Cập nhật lời gọi trong `run_period()`
```python
# TRƯỚC:
export_pivot_df = normalize_country_product(export_country, export_summary, best_export_s)

# SAU:
version_pivots = normalize_country_product(export_country, all_export_summaries)
# Trả về dict: {"Chính thức": df, "Điều chỉnh": df, "Sơ bộ": df}
```

---

### Phase 3: Excel Output — Multiple Sheets (P0)

**File:** `pipeline/ocr_pipeline.py`

#### 3.1. Sheet Tong_Quan_XNK — Viết TẤT CẢ summary
```python
def write_excel_output(summary_rows, pivot_dfs, period, out_dir, ...):
    # summary_rows: list of ALL summaries (SB, DC, CT)
    # pivot_dfs: dict {version_name: DataFrame}
    
    ws1 = wb.active
    ws1.title = "Tong_Quan_XNK"
    
    stt = 1
    for r in summary_rows:
        ws1.append([
            stt, r.get("period"), flow_label, r.get("product"), r.get("unit"),
            r.get("quantity_month"), r.get("value_month_usd"),
            ..., r.get("version"), r.get("debug_source_file", "")
        ])
        stt += 1
```

#### 3.2. Tạo sheets riêng cho từng version
```python
VERSION_SHEET_MAP = {
    "official": "XK_ChinhThuc",
    "adjusted": "XK_DieuChinh",
    "preliminary": "XK_SoBo",
}

for ver, df in pivot_dfs.items():
    sheet_name = VERSION_SHEET_MAP.get(ver, f"XK_{ver}")
    ws = wb.create_sheet(sheet_name)
    # Write df to ws...
```

---

### Phase 4: All-Years — Split Into 3 Excel Files (P1)

**File:** `pipeline/data_builder.py`

#### 4.1. Chia dữ liệu theo phiên bản
```python
def build_all_years(output_root=None, backfill=True):
    ...
    # Group periods by version
    by_version = {"official": {}, "adjusted": {}, "preliminary": {}}
    for period, data in periods_data.items():
        for ver in ["official", "adjusted", "preliminary"]:
            if data.get(f"xk_{ver}"):  # Có dữ liệu version này
                by_version[ver][period] = data
    
    # Write 3 Excel files
    for ver, name_suffix in [("official", "ChinhThuc"), ("adjusted", "DieuChinh"), ("preliminary", "SoBo")]:
        wb = build_workbook(by_version[ver])
        wb.save(output_dir / f"all_years_cashew_{name_suffix}.xlsx")
    
    # Write 1 JSON file (all versions combined)
    write_json(periods_data, json_path)
```

#### 4.2. JSON schema mới
```json
{
  "schema_version": 3,
  "periods": {
    "2020-01": {
      "tong_xk": [
        { "version": "official", "qty": 25259, "val": 176602478, "debug_source_file": "2X(VN-CT).pdf" },
        { "version": "adjusted", "qty": 25253, "val": 176571066, "debug_source_file": "2X(VN-DC2).pdf" },
        { "version": "preliminary", "qty": 24687, "val": 172552589, "debug_source_file": "2X(VN-SB).pdf" }
      ],
      "xk_theo_nuoc": {
        "Chính thức": [{ "country": "HOA KỲ", "cy_luong": 8121, ... }],
        "Điều chỉnh": [{ ... }],
        "Sơ bộ": [{ ... }]
      }
    }
  },
  "records": [
    // Flat list cho web load nhanh
    { "period": "2020-01", "flow": "export", "version": "official", "country": "HOA KỲ", ... }
  ]
}
```

---

### Phase 5: Dashboard Update (P1)

**File:** `web/app.js`

#### 5.1. Load multi-version data
```javascript
async function loadAllYearsJSON() {
  const resp = await fetch('/output/data/all_years_cashew.json');
  const payload = await resp.json();
  
  // Build periods with multi-version support
  state.periods = buildPeriodsFromCanonical(payload.records, payload.periods);
  
  // Store version-specific data for tab switching
  state.versions = {
    official: buildPeriodsByVersion(payload, 'official'),
    adjusted: buildPeriodsByVersion(payload, 'adjusted'),
    preliminary: buildPeriodsByVersion(payload, 'preliminary'),
  };
}
```

#### 5.2. Version filter in filter bar
```html
<!-- Add version switcher -->
<div class="fb-group">
  <span class="fb-label">Phiên bản</span>
  <div class="seg-toggle" id="fb-version">
    <button data-ver="official" class="active">Chính thức</button>
    <button data-ver="adjusted">Điều chỉnh</button>
    <button data-ver="preliminary">Sơ bộ</button>
  </div>
</div>
```

---

## 5. KIỂM THỬ NGHIỆM THU

### 5.1. Test Case: 2020-01

**Trước khi sửa:**
```
Tong_Quan_XNK: 2 summary rows
XK_Theo_Nuoc: 31 rows (chỉ Official)
Total: 33 rows
```

**Sau khi sửa (mong đợi):**
```
Tong_Quan_XNK: 6 summary rows (3 XK + 3 NK)
XK_ChinhThuc: 31 rows
XK_DieuChinh: 31 rows
XK_SoBo: 31 rows
NK_ChinhThuc: 31 rows
NK_DieuChinh: 31 rows
NK_SoBo: 31 rows
Lich_Su_Phien_Ban: 7 rows
Total: ~194 rows
```

### 5.2. Test Script

```powershell
python diagnostics/audit_multi_version.py
```

**Expected output:**
```
2020-01:
  Summary rows: 6/6 ✅
  Country rows: 186/186 ✅
  Other rows: 6/6 ✅
  Debug columns: đầy đủ ✅
  Sheets: 7/7 ✅
```

### 5.3. QC Report

```json
{
  "status": "ok",
  "issue_count": 0,
  "issues": []
}
```

---

## 6. RISKS & LƯU Ý

### 6.1. Excel File Size
- **Hiện tại:** 1 file ~274KB
- **Sau fix:** 3 files × ~150KB = ~450KB (tăng không đáng kể)

### 6.2. JSON File Size
- **Hiện tại:** ~2.8MB (1 version)
- **Sau fix:** ~8MB (3 versions) — vẫn load được trong browser

### 6.3. Dashboard Compatibility
- Cần cập nhật `pickVersionedSummary()` để chọn đúng version
- Cần thêm version switcher trong filter bar

### 6.4. Backward Compatibility
- File Excel cũ vẫn đọc được (legacy mode)
- JSON schema mới có `schema_version: 3` để detect

---

## 7. TIMELINE DỰ KIẾN

| Phase | Công Việc | Thời Gian |
|-------|-----------|-----------|
| 1 | Debug columns | 1 giờ |
| 2 | Multi-version logic | 3 giờ |
| 3 | Excel output (multi-sheet) | 2 giờ |
| 4 | All-years split (3 files) | 2 giờ |
| 5 | Dashboard update | 2 giờ |
| 6 | Test + QC | 2 giờ |
| **Tổng** | | **~12 giờ** |

---

## 8. FILES CẦN SỬA

| File | Lines | Thay đổi |
|------|-------|----------|
| `pipeline/ocr_pipeline.py` | +100 | Debug cols, multi-version, multi-sheet |
| `pipeline/data_builder.py` | +80 | Split 3 Excel, JSON v3 |
| `web/app.js` | +50 | Multi-version load, version filter |
| `diagnostics/audit_multi_version.py` | New | Test script |
| `docs/AUDIT_MULTI_VERSION_OCR.md` | This file | Documentation |

---

## 9. LỆNH CHẠY SAU KHI SỬA

```powershell
# 1. Rebuild all-years
python main.py --backfill

# 2. Run audit
python diagnostics/audit_multi_version.py

# 3. Check output structure
Get-ChildItem output\*.xlsx
Get-ChildItem output\data\*.json

# 4. Khởi động dashboard
python serve_dashboard.py
# Mở http://127.0.0.1:8080
```

---

**👉 Chờ phê duyệt plan trước khi implement!**
