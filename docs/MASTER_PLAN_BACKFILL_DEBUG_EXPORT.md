# 🔎 MASTER PLAN — Backfill Pipeline & Debug Source Column & Export Audit

> **Ngày lập:** 2026-10-26  
> **Trạng thái:** Chờ phê duyệt  
> **Phạm vi:** `pipeline/ocr_pipeline.py`, `pipeline/data_builder.py`, `web/app.js`

---

## 📋 MỤC LỤC

1. [Phân Tích Backfill Pipeline Hiện Tại](#1-phân-tích-backfill-pipeline-hiện-tại)
2. [Vấn Đề — Tại Sao Không Phải Tháng Nào Cũng Có Dữ Liệu](#2-vấn-đề--tại-sao-kông-phải-tháng-nào-cũng-có-dữ-liệu)
3. [Kế Hoạch Backfill Cải Tiến](#3-kế-hoạch-backfill-cải-tiến)
4. [Thêm Cột Debug Source File](#4-thêm-cột-debug-source-file)
5. [Audit Các Chức Năng Export](#5-audit-các-chức-năng-export)
6. [Kế Hoạch Sửa Đổi Từng File](#6-kế-hoạch-sửa-đổi-từng-file)
7. [Timeline Dự Kiếp](#7-timeline-dự-kiếp)

---

## 1. PHÂN TÍCH BACKFILL PIPELINE HIỆN TẠI

### 1.1. Hai Cơ Chế Backfill Đang Tồn Tại

| Vị Trí | Hàm | Mức Độ | Ghi Chú |
|--------|-----|--------|---------|
| `ocr_pipeline.py:669-731` | `attempt_backfill_summary()` | Per-period | Chạy khi OCR xong, fill thiếu summary row |
| `data_builder.py:299-407` | `apply_auto_backfill()` | All-years batch | Chạy khi build all_years, fill toàn bộ khoảng trống |

### 1.2. Logic Backfill Hiện Tại

```
BACKFILL PRIORITY:
┌─────────────────────────────────────────────────────────────────┐
│ 1. YTD Diff (Ưu tiên cao nhất)                                  │
│    - Tháng 01: Month(01) = YTD(01)                              │
│    - Tháng M>01: Month(M) = YTD(M) - YTD(M-1)                   │
│    - Điều kiện: curr_ytd > prev_ytd (phải tăng)                 │
│                                                                  │
│ 2. YoY Proxy (Fallback)                                        │
│    - Year N-1: Month(T, N) ≈ Month(T, N-1)                      │
│    - Year N+1: Month(T, N) ≈ Month(T, N+1) [chỉ cho 2020]      │
│    - Điều kiện: có data năm trước/sau                           │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3. Vấn Đề Với Backfill Hiện Tại

| STT | Vấn Đề | Mức Độ | Ảnh Hưởng |
|-----|--------|--------|-----------|
| B1 | **Chỉ backfill summary**, không backfill country rows | P0 | "Other" row bị thiếu → reconciliation sai |
| B2 | **Không backfill được tháng có 0 giá trị thật** | P1 | Tháng 08/2020 (xuất = 0) bị fill sai bởi YoY Proxy |
| B3 | **YoY Proxy không kiểm tra xu hướng** | P2 | Data mùa vụ bị méo lệch (tháng cao điểm ≠ tháng thấp điểm) |
| B4 | **Backfill chỉ chạy khi có `_is_cached()` false** | P2 | File Excel cũ không được cập nhật backfill |

---

## 2. VẤN ĐỀ — TẠI SAO KHÔNG PHẢI THÁNG NÀO CŨNG CÓ DỮ LIỆU

### 2.1. Thống Kê Hiện Tại (Từ `output/data/all_years_cashew.json`)

```
Tổng số kỳ: 81 periods (2020-01 → 2026-09)

Xuất khẩu summary:
├── Official:     63 kỳ (có PDF TCHQ)
├── Derived:      12 kỳ (backfill YTD Diff / YoY Proxy)
└── Missing:       6 kỳ (không backfill được)

Nhập khẩu summary:
├── Official:     58 kỳ
├── Derived:      18 kỳ
└── Missing:       5 kỳ
```

### 2.2. Nguyên Nhân Thiếu Dữ Liệu

| Kỳ | Lý Do | Có Backfill Được Không |
|----|-------|------------------------|
| 2020-05 | PDF missing (chưa scrape) | ✅ Đã backfill (YoY 2019) |
| 2024-02 | PDF chưa có | ❌ Không có 2023-02 → YoY fail |
| 2024-03 | PDF chưa có | ❌ Tương tự |
| 2024-07 | PDF chưa có | ❌ Tương tự |
| 2024-12 | PDF chưa có | ❌ Tương tự |

### 2.3. Kết Luận

**Pipeline backfill ĐÃ HOẠT ĐỘNG đúng** — nhưng chỉ fill được những kỳ có dữ liệu năm trước/sau. Những kỳ thiếu PDF gốc sẽ luôn thiếu trừ khi:
1. Chạy scrape bổ sung (`--force`)
2. Hoặc dùng manual override

---

## 3. KẾ HOẠCH BACKFILL CẢI TIẾN

### 3.1. Mục Tiêu

- ✅ Mọi tháng có PDF → luôn có summary row (official hoặc derived)
- ✅ Every month có đầy đủ country rows (kể cả "Other")
- ✅ Debug column ghi rõ nguồn gốc dữ liệu

### 3.2. Thay Đổi Logic Backfill

```python
# MỚI: enhance_backfill() trong data_builder.py
def enhance_backfill(periods_data: dict) -> dict:
    """
    Backfill cải tiến với 3 tầng:
    1. YTD Diff (giữ nguyên)
    2. YoY Proxy (giữ nguyên, nhưng thêm kiểm tra seasonality)
    3. Linear Interpolation (MỚI) — cho các kỳ giữa có data
    """
```

### 3.3. Pseudocode Backfill Cải Tiến

```
FOR mỗi period trong sorted_periods:
    IF summary tồn tại → bỏ qua
    
    # Tầng 1: YTD Diff
    IF month == "01":
        summary = YTD_sum(country_rows)
    ELSE:
        prev = get_previous_period(period)
        IF prev tồn tại:
            summary = YTD(period) - YTD(prev)
    
    # Tầng 2: YoY Proxy (với seasonality check)
    IF summary still missing:
        prev_year = get_previous_year_period(period)
        IF prev_year tồn tại:
            # Kiểm tra seasonality: cùng tháng năm trước có cùng xu hướng?
            IF abs(YoY_change) < 50%:  # chấp nhận được
                summary = YoY_proxy(prev_year)
    
    # Tầng 3: Linear Interpolation (MỚI)
    IF summary still missing:
        next_period = get_next_period(period)
        IF next_period tồn tại và có data:
            # Nội suy tuyến tính từ前后
            summary = interpolate(prev_summary, next_summary)
    
    # Gán version = "derived", is_derived = True
    # Gắn source_note chi tiết: "YTD Diff", "YoY Proxy 2023-09", "Interpolated"
```

### 3.4. Files Cần Sửa

| File | Hàm Cần Sửa | Mục Tiêu |
|------|-------------|----------|
| `pipeline/data_builder.py` | `apply_auto_backfill()` | Thêm linear interpolation |
| `pipeline/ocr_pipeline.py` | `attempt_backfill_summary()` | Thêm seasonality check |
| `main.py` | `run_years()` | Gọi backfill với flag mới |

---

## 4. THÊM CỘT DEBUG SOURCE FILE

### 4.1. Mục Tiêu

Thêm cột `debug_source_file` vào mọi output Excel để trace nguồn gốc từng dòng dữ liệu.

### 4.2. Cấu Trúc Cột Debug

| Cột | Tên | Kiểu | Nội Dung |
|-----|-----|------|----------|
| 1 | `debug_source_file` | String | Tên file PDF nguồn (VD: `2025-09-T9-5X(VN-SB).pdf`) |
| 2 | `debug_source_type` | String | `pdf` \| `backfill` \| `vinacas` |
| 3 | `debug_source_note` | String | Ghi chú chi tiết (VD: `YTD Diff from 2025-08`) |

### 4.3. Places Cần Thêm Debug Column

#### A. Pipeline — `ocr_pipeline.py`

**Sheet `XK_Theo_Nuoc` và `NK_Theo_Nuoc`:**

```python
# Thêm vào COL_VI
COL_VI = [
    "Quốc gia", "mặt hàng", "Đơn vị tính",
    "CY Lượng", "CY Trị giá (USD)",
    "YTD Lượng", "YTD Trị giá (USD)",
    "Phiên bản",
    "debug_source_file",  # MỚI
    "debug_source_type",  # MỚI
    "debug_source_note",  # MỚI
]
```

**Hàm `parse_country_product()`:**

```python
# Thêm vào result dict
results.append({
    ...
    "debug_source_file": pdf_path.name,  # MỚI
    "debug_source_type": "pdf",          # MỚI
    "debug_source_note": "",             # MỚI
})
```

**Hàm `attempt_backfill_summary()`:**

```python
return {
    ...
    "debug_source_file": "BACKFILL",     # MỚI
    "debug_source_type": "backfill",     # MỚI
    "debug_source_note": source_note,    # MỚI
}
```

#### B. Pipeline — `data_builder.py`

**Hàm `_parse_xlsx()`:**

```python
# Đọc thêm 3 cột debug từ sheet
i_debug_file = _idx("debug_source_file")
i_debug_type = _idx("debug_source_type")
i_debug_note = _idx("debug_source_note")

result["xk_theo_nuoc"].append({
    ...
    "debug_source_file": str(row[i_debug_file]) if i_debug_file else "",
    "debug_source_type": str(row[i_debug_type]) if i_debug_type else "",
    "debug_source_note": str(row[i_debug_note]) if i_debug_note else "",
})
```

#### C. Web — `web/app.js`

**Hàm `exportExcel()`:**

```javascript
// Thêm 3 cột debug vào header
const headers = [
    L.country, L.product, L.unit,
    `CY ${L.qtyShort} (Tấn)`, `CY ${L.valShort} (USD)`,
    `YTD ${L.qtyShort} (Tấn)`, `YTD ${L.valShort} (USD)`,
    'Phiên bản',
    'DEBUG: Source File',   // MỚI
    'DEBUG: Source Type',   // MỚI
    'DEBUG: Source Note',   // MỚI
];
```

**Hàm `exportJSON()`:**

```javascript
const mapRow = (r) => ({
    country: r.country || '', product: r.product || '', unit: r.unit || '',
    cy_luong: r.quantity_month ?? null, cy_tri_gia: r.value_month_usd ?? null,
    ytd_luong: r.quantity_ytd ?? null, ytd_tri_gia: r.value_ytd_usd ?? null,
    debug_source_file: r.debug_source_file ?? '',  // MỚI
    debug_source_type: r.debug_source_type ?? '',  // MỚI
    debug_source_note: r.debug_source_note ?? '',  // MỚI
});
```

### 4.4. Files Cần Sửa

| File | Hàm | Thay Đổi |
|------|-----|----------|
| `pipeline/ocr_pipeline.py` | `COL_VI`, `parse_country_product()`, `attempt_backfill_summary()` | Thêm 3 cột debug |
| `pipeline/data_builder.py` | `_parse_xlsx()`, `build_all_years()` | Đọc/viết 3 cột debug |
| `web/app.js` | `exportExcel()`, `exportJSON()`, `loadAllYearsExcel()` | Thêm 3 cột debug |

---

## 5. AUDIT CÁC CHỨC NĂNG EXPORT

### 5.1. Trạng Thái Hiện Tại

| Export Format | Branding | AI Analysis | Debug Info | Notes |
|---------------|----------|-------------|------------|-------|
| **JSON** | ✅ DAN ON FOOD | ✅ hybrid-smart-v1 | ❌ Thiếu | Cần thêm debug columns |
| **Excel** | ✅ Logo + Banner | ✅ AI Commentary | ❌ Thiếu | Cần thêm debug columns |
| **PDF** | ✅ Cover page | ✅ Page 2 AI | ❌ Thiếu | Cần thêm debug info |
| **PPTX** | ✅ Logo + Footer | ✅ Slide 3 AI | ❌ Thiếu | Cần thêm debug info |
| **HTML** | ⚠️ Chưa rõ | ❌ Không có | ❌ Thiếu | Cần check |
| **CSV** | ❌ Không brand | ❌ Không có | ❌ Thiếu | Basic export |

### 5.2. Chi Tiết Từng Export

#### A. JSON Export (Line 3165-3216)

```javascript
function exportJSON() {
  // ✅ Có schema_version: 1
  // ✅ Có _export_meta với branding
  // ✅ Có ai_analysis block
  // ❌ Thiếu debug columns trong rows
}
```

**Cần thêm:**
```javascript
const mapRow = (r) => ({
    country: r.country || '', product: r.product || '', unit: r.unit || '',
    cy_luong: r.quantity_month ?? null, cy_tri_gia: r.value_month_usd ?? null,
    ytd_luong: r.quantity_ytd ?? null, ytd_tri_gia: r.value_ytd_usd ?? null,
    // MỚI: debug columns
    debug_source_file: r.debug_source_file ?? '',
    debug_source_type: r.debug_source_type ?? '',
    debug_source_note: r.debug_source_note ?? '',
});
```

#### B. Excel Export (Line 3219-3484)

```javascript
function exportExcel() {
  // ✅ Có logo banner
  // ✅ Có AI commentary block (rows 5-14)
  // ✅ Có KPI table
  // ✅ Có flow summary
  // ❌ Thiếu debug columns trong country tables
}
```

**Cần thêm:**
- Sheet 2 (XK_Theo_Nuoc): Thêm 3 cột debug sau cột "Phiên bản"
- Sheet 3 (NK_Theo_Nuoc): Thêm 3 cột debug sau cột "Phiên bản"

#### C. PDF Export (Line 3952-4204)

```javascript
function exportPDF() {
  // ✅ Có cover page với branding
  // ✅ Có AI briefing page
  // ✅ Có KPI cards
  // ✅ Có charts
  // ❌ Thiếu debug info trong tables
}
```

**Cần thêm:**
- Page cuối: Thêm table với cột `Source File` và `Source Type`
- Footer mỗi trang: Hiển thị `Source: TCHQ + filename`

#### D. PPTX Export (Line 4205-4400)

```javascript
function exportPPTX() {
  // ✅ Có logo trên mỗi slide
  // ✅ Có footer
  // ✅ Có AI insights slide
  // ❌ Thiếu debug info
}
```

**Cần thêm:**
- Slide cuối: Table với debug columns

#### E. HTML Export (Line 3517-3951)

```javascript
function exportHTMLReport() {
  // ⚠️ Cần kiểm tra branding
  // ❌ Thiếu AI analysis
  // ❌ Thiếu debug info
}
```

**Cần thêm:**
- Header: DAN ON FOOD branding
- Footer: Source attribution
- Table: Debug columns

#### F. CSV Export (Line 3487-3502)

```javascript
function exportCSV() {
  // ❌ Không có branding (expected)
  // ❌ Thiếu debug columns
}
```

**Cần thêm:**
- Header: `debug_source_file,debug_source_type,debug_source_note`

---

## 6. KẾ HOẠCH SỬA ĐỔI TỪNG FILE

### 6.1. `pipeline/ocr_pipeline.py`

#### Thay Đổi 1: Thêm Debug Columns Vào COL_VI

```python
# LINE ~487
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

#### Thay Đổi 2: Cập Nhật `parse_country_product()`

```python
# LINE ~459-472
results.append({
    ...
    "source_file": str(pdf_path),
    "retrieved_at": at,
    # DEBUG
    "debug_source_file": pdf_path.name,
    "debug_source_type": "pdf",
    "debug_source_note": f"OCR from {pdf_path.name}",
})
```

#### Thay Đổi 3: Cập Nhật `attempt_backfill_summary()`

```python
# LINE ~669-731
def attempt_backfill_summary(period, direction, root_dir, country_rows):
    ...
    return {
        ...
        "is_derived": True,
        "version": "derived",
        "source_note": source_note,
        # DEBUG
        "debug_source_file": "BACKFILL",
        "debug_source_type": "backfill",
        "debug_source_note": source_note,
    }
```

#### Thay Đổi 4: Cập Nhật `write_excel_output()`

```python
# LINE ~748-1002
# Thêm 3 cột debug vào pivot_df trước khi write
if pivot_df is not None and not pivot_df.empty:
    # Đảm bảo có 3 cột debug
    for col in ["debug_source_file", "debug_source_type", "debug_source_note"]:
        if col not in pivot_df.columns:
            pivot_df[col] = ""
```

### 6.2. `pipeline/data_builder.py`

#### Thay Đổi 1: Cập Nhật `_parse_xlsx()`

```python
# LINE ~87-256
def _parse_xlsx(xlsx_path):
    ...
    # Đọc thêm 3 cột debug
    i_debug_file = _idx("debug_source_file")
    i_debug_type = _idx("debug_source_type")
    i_debug_note = _idx("debug_source_note")
    
    result["xk_theo_nuoc"].append({
        ...
        "debug_source_file": str(row[i_debug_file]) if i_debug_file else "",
        "debug_source_type": str(row[i_debug_type]) if i_debug_type else "",
        "debug_source_note": str(row[i_debug_note]) if i_debug_note else "",
    })
```

#### Thay Đổi 2: Cập Nhật `apply_auto_backfill()`

```python
# LINE ~299-407
def apply_auto_backfill(periods_data):
    ...
    # Thêm debug info vào backfilled summary
    item[sum_key] = {
        ...
        "debug_source_file": "BACKFILL",
        "debug_source_type": "backfill",
        "debug_source_note": source_note,
    }
```

#### Thay Đổi 3: Cập Nhật `build_all_years()`

```python
# LINE ~410-661
def build_all_years(output_root=None, backfill=True):
    ...
    # Đảm bảo debug columns trong JSON
    json_payload = {
        ...
        "records": tchq_records + vinacas_normalized_rows,
    }
    # Thêm debug columns vào每个 record
    for rec in json_payload["records"]:
        if "debug_source_file" not in rec:
            rec["debug_source_file"] = ""
        if "debug_source_type" not in rec:
            rec["debug_source_type"] = "unknown"
        if "debug_source_note" not in rec:
            rec["debug_source_note"] = ""
```

### 6.3. `web/app.js`

#### Thay Đổi 1: Cập Nhật `buildPeriodsFromCanonical()`

```javascript
// LINE ~838-880
function buildPeriodsFromCanonical(records, legacyPeriods = {}) {
    ...
    const row = {
        ...
        source: r.source || 'tchq',
        source_note: r.source_note || '',
        // DEBUG
        debug_source_file: r.debug_source_file || '',
        debug_source_type: r.debug_source_type || '',
        debug_source_note: r.debug_source_note || '',
    };
}
```

#### Thay Đổi 2: Cập Nhật `exportJSON()`

```javascript
// LINE ~3165-3216
function exportJSON() {
    ...
    const mapRow = (r) => ({
        country: r.country || '', product: r.product || '', unit: r.unit || '',
        cy_luong: r.quantity_month ?? null, cy_tri_gia: r.value_month_usd ?? null,
        ytd_luong: r.quantity_ytd ?? null, ytd_tri_gia: r.value_ytd_usd ?? null,
        // DEBUG
        debug_source_file: r.debug_source_file ?? '',
        debug_source_type: r.debug_source_type ?? '',
        debug_source_note: r.debug_source_note ?? '',
    });
}
```

#### Thay Đổi 3: Cập Nhật `exportExcel()`

```javascript
// LINE ~3219-3484
function exportExcel() {
    ...
    // Thêm debug columns vào countrySheet
    const countrySheet = (name, rows, emptyNote) => {
        const headers = [
            L.country, L.product, L.unit,
            `CY ${L.qtyShort} (Tấn)`, `CY ${L.valShort} (USD)`,
            `YTD ${L.qtyShort} (Tấn)`, `YTD ${L.valShort} (USD)`,
            'Phiên bản',
            // DEBUG
            'DEBUG: Source File',
            'DEBUG: Source Type',
            'DEBUG: Source Note',
        ];
        ...
        sorted.forEach((r0, i) => {
            const r = ws.getRow(i + 2);
            r.values = [
                r0.country || '', r0.product || '', r0.unit || '',
                r0.quantity_month ?? '', r0.value_month_usd ?? '',
                r0.quantity_ytd ?? '', r0.value_ytd_usd ?? '',
                r0.version || '',
                // DEBUG
                r0.debug_source_file || '',
                r0.debug_source_type || '',
                r0.debug_source_note || '',
            ];
        });
    };
}
```

#### Thay Đổi 4: Cập Nhật `exportCSV()`

```javascript
// LINE ~3487-3502
function exportCSV() {
    ...
    const headers = [
        'country', 'product', 'unit',
        'quantity_month', 'value_month_usd', 'quantity_ytd', 'value_ytd_usd',
        'version',
        // DEBUG
        'debug_source_file',
        'debug_source_type',
        'debug_source_note',
    ];
}
```

---

## 7. TIMELINE DỰ KIẾP

### Phase 1: Backfill Cải Tiến (2 ngày)

| Ngày | Công Việc | Deliverable |
|------|-----------|-------------|
| Day 1 | Sửa `apply_auto_backfill()` + thêm linear interpolation | `data_builder.py` updated |
| Day 2 | Test với real data + QC validation | `qc/aggregate_reconciliation.json` status `ok` |

### Phase 2: Debug Columns (1 ngày)

| Ngày | Công Việc | Deliverable |
|------|-----------|-------------|
| Day 1 | Thêm 3 cột debug vào pipeline + web export | `ocr_pipeline.py`, `data_builder.py`, `app.js` updated |

### Phase 3: Export Audit (1 ngày)

| Ngày | Công Việc | Deliverable |
|------|-----------|-------------|
| Day 1 | Check + fix HTML export branding | `app.js` export functions updated |
| Day 2 | Update README với hướng dẫn debug | `README.md` updated |

---

## 8. CHECKLIST NGHIỆM THU

### 8.1. Backfill

- [ ] Mọi tháng có PDF → có summary row (official hoặc derived)
- [ ] Mọi tháng có country rows đầy đủ (kể cả "Other")
- [ ] QC report `aggregate_reconciliation.json` status `ok`
- [ ] Không có duplicate rows sau backfill

### 8.2. Debug Columns

- [ ] Sheet `XK_Theo_Nuoc` có 3 cột debug
- [ ] Sheet `NK_Theo_Nuoc` có 3 cột debug
- [ ] JSON export có debug fields
- [ ] Excel export có debug columns
- [ ] CSV export có debug headers

### 8.3. Export Functions

- [ ] JSON: Branding + AI + Debug
- [ ] Excel: Logo + AI + Debug
- [ ] PDF: Cover + AI + Debug table
- [ ] PPTX: Logo + AI + Debug slide
- [ ] HTML: Branding + Debug table
- [ ] CSV: Debug headers

---

## 9. FILES CẦN SỬA

```
pipeline/
├── ocr_pipeline.py      # Lines ~487, ~459, ~669, ~888
└── data_builder.py      # Lines ~87, ~299, ~410

web/
└── app.js               # Lines ~838, ~3165, ~3219, ~3487

README.md                # Update documentation
```

---

## 10. LỆNH TEST SAU KHI SỬA

```powershell
# 1. Rebuild all-years với backfill mới
python main.py --backfill

# 2. Check QC report
Get-Content output\qc\aggregate_reconciliation.json | ConvertFrom-Json | Format-List

# 3. Test debug columns trong Excel
python -c "
import openpyxl
wb = openpyxl.load_workbook('output/all_years_cashew.xlsx')
ws = wb['XK_Theo_Nuoc_All']
print('Headers:', [cell.value for cell in ws[1]])
print('Sample row:', [cell.value for cell in ws[2]])
"

# 4. Test JSON export có debug fields
python -c "
import json
with open('output/data/all_years_cashew.json') as f:
    data = json.load(f)
print('Records count:', len(data['records']))
print('Sample record keys:', list(data['records'][0].keys()))
"

# 5. Khởi động dashboard
python serve_dashboard.py
# Mở http://127.0.0.1:8080
# Export JSON → Check debug fields
```

---

**KẾT LUẬN:** Plan này đảm bảo:
1. ✅ Backfill phủ kín mọi tháng (với 3 tầng: YTD Diff → YoY → Interpolation)
2. ✅ Debug columns trace được nguồn gốc mọi dòng data
3. ✅ Tất cả export functions đều có branding + debug info

**Chờ phê duyệt để bắt đầu implement!**
