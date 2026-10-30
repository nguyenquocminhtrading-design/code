# Plan: OCR Pipeline Standalone + Sửa Header Tong_XK

## Mục tiêu

1. **`ocr_pipeline.py` chạy độc lập** — không cần args, tự tìm PDF từ `output/<period>/pdfs/`
2. **Header `Tong_XK` đúng format báo cáo TCHQ** — 2 dòng merged cells, chỉ 7 cột (không có % so sánh)

---

## Quyết định đã xác nhận

| # | Quyết định | Lựa chọn |
|---|---|---|
| 1 | PDF dir | **Chỉ tìm trong `output/<period>/pdfs/`** — không dùng TCHQ/Export |
| 2 | Header style | **2 dòng merged** (openpyxl `merge_cells`) — không qua Power Query |
| 3 | Cột % | **Bỏ qua** — chỉ cần Lượng + Trị giá cho tháng + cộng dồn |

---

## Proposed Changes

### Component 1 — `pipeline/ocr_pipeline.py`

#### [MODIFY] `ocr_pipeline.py`

---

### 1a. Sửa hằng số đường dẫn PDF

**Hiện tại:**
```python
ROOT = Path(__file__).resolve().parents[2]          # XNK/
DEFAULT_PDF_DIR = ROOT / "TCHQ" / "Export"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "output"
```

**Sau khi sửa:**
```python
ROOT = Path(__file__).resolve().parents[2]          # XNK/
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "output"   # code/output/
# Default PDF dir khi chạy standalone: tìm trong output/<period>/pdfs/
# (được populate bởi main.py -> _copy_pdfs sau khi scraper download)
DEFAULT_PDF_DIR = OUTPUT_DIR   # chỉ dùng làm base, run_period tự ghép /<period>/pdfs/
```

---

### 1b. Sửa `run_period()` — tự tìm PDF theo period trong `output/`

**Hiện tại:**
```python
def run_period(period: str, pdf_dir, ocr_engine: str) -> dict:
    pdfs = [p for p in Path(pdf_dir).rglob("*.pdf") if pdf_matches_period(p, period)]
    if not pdfs:
        log.warning("No PDFs found matching %s in %s", period, pdf_dir)
        return {"period": period, "status": "no_files"}
```

**Sau khi sửa:**
```python
def run_period(period: str, pdf_dir=None, ocr_engine: str = "auto") -> dict:
    log.info("=== Processing %s ===", period)
    
    # Khi gọi từ main.py: pdf_dir là TCHQ/Export/<period>/ — dùng nguyên
    # Khi chạy standalone (pdf_dir=None): tìm trong output/<period>/pdfs/
    candidates = []
    if pdf_dir is not None:
        search_dir = Path(pdf_dir)
        candidates = [p for p in search_dir.rglob("*.pdf")
                      if pdf_matches_period(p, period)]
    
    # Luôn thêm fallback từ output/<period>/pdfs/
    output_pdf_dir = OUTPUT_DIR / period / "pdfs"
    if output_pdf_dir.exists():
        extra = [p for p in output_pdf_dir.rglob("*.pdf")
                 if p not in candidates]
        if extra:
            log.info("Found %d PDF(s) in output dir: %s", len(extra), output_pdf_dir)
            candidates.extend(extra)
    
    pdfs = candidates
    if not pdfs:
        log.warning("No PDFs found for %s", period)
        return {"period": period, "status": "no_files"}
    ...
```

> [!NOTE]
> Khi `main.py` gọi `run_period(period, TCHQ_EXPORT/period, engine)` — vẫn hoạt động bình thường như cũ + có thêm fallback từ output.  
> Khi `ocr_pipeline.py` chạy standalone với `--period 2025-09` — `pdf_dir` được truyền từ `DEFAULT_PDF_DIR` → hàm tự tìm trong `output/2025-09/pdfs/`.

---

### 1c. Sửa `main()` trong `ocr_pipeline.py` — chạy được không cần args

**Hiện tại:**
```python
def main():
    ...
    else:
        ap.error("Provide --period or --period-from + --period-to")
```

**Sau khi sửa:**
```python
def main():
    ap = argparse.ArgumentParser(description="XNK Cashew OCR Pipeline (standalone)")
    ap.add_argument("--period", help="Kỳ đơn lẻ YYYY-MM")
    ap.add_argument("--period-from", help="Kỳ bắt đầu YYYY-MM")
    ap.add_argument("--period-to",   help="Kỳ kết thúc YYYY-MM")
    ap.add_argument("--period-auto", action="store_true",
                    help="Tự động dùng kỳ tháng trước (không cần nhập)")
    ap.add_argument("--pdf-dir",     default=None,
                    help="Thư mục PDF (mặc định: tự tìm trong output/<period>/pdfs/)")
    ap.add_argument("--ocr-engine",
                    choices=["auto", "pdfplumber", "paddle", "vietocr"], default="auto")
    ap.add_argument("--force", action="store_true",
                    help="Chạy lại dù output đã tồn tại")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    # Xác định danh sách period
    if args.period:
        periods = [args.period]
    elif args.period_from and args.period_to:
        periods = list(iter_periods(args.period_from, args.period_to))
    elif args.period_auto:
        from datetime import date
        today = date.today()
        m = today.month - 1 or 12
        y = today.year if today.month > 1 else today.year - 1
        periods = [f"{y}-{m:02d}"]
        log.info("--period-auto: dùng kỳ %s", periods[0])
    else:
        # Interactive fallback
        print("\n=== XNK OCR Pipeline — Standalone ===")
        raw = input("Nhập kỳ cần xử lý (YYYY-MM) hoặc năm (YYYY): ").strip()
        if re.fullmatch(r"\d{4}", raw):
            periods = [f"{raw}-{m:02d}" for m in range(1, 13)]
        elif re.fullmatch(r"\d{4}-\d{2}", raw):
            periods = [raw]
        else:
            print(f"Định dạng không hợp lệ: {raw!r}. Dùng YYYY-MM hoặc YYYY.")
            return 1

    pdf_dir = Path(args.pdf_dir) if args.pdf_dir else None
    for period in periods:
        run_period(period, pdf_dir, args.ocr_engine)
    return 0
```

---

### Component 2 — Sửa header `Tong_XK` trong `write_excel_output()`

#### [MODIFY] `write_excel_output()` — hàm trong `ocr_pipeline.py`

**Layout header 2 dòng mới (7 cột dữ liệu, A–G):**

```
     A          B                        C     D          E                  F          G
Row1 STT  Nhóm/Mặt hàng chủ yếu   ĐVT  [Số trong tháng báo cáo]  [Cộng dồn đến hết tháng báo cáo]
                                              ← merged D1:E1 →         ← merged F1:G1 →
Row2  ↑         ↑                   ↑    Lượng  Trị giá (USD)       Lượng    Trị giá (USD)
```

**Code diff:**
```diff
-    ws1 = wb.active
-    ws1.title = "Tong_XK"
-    h1 = ["Mat hang / Product", "Ma HS / HS Code", "Don vi / Unit",
-          "CY Luong / Qty", "CY Tri gia (USD) / Value",
-          "YTD Luong / Qty", "YTD Tri gia (USD) / Value", "Gia TB (USD)"]
-    ws1.append(h1)
-    _style_header(ws1, len(h1))
-    ws1.freeze_panes = "A2"
+    ws1 = wb.active
+    ws1.title = "Tong_XK"
+    NCOLS = 7
+
+    # ── Dòng 1: Group headers ──────────────────────────────────────
+    ws1["A1"] = "STT"
+    ws1["B1"] = "Nhóm/Mặt hàng chủ yếu"
+    ws1["C1"] = "ĐVT"
+    ws1["D1"] = "Số trong tháng báo cáo"
+    ws1["F1"] = "Cộng dồn đến hết tháng báo cáo"
+    ws1.merge_cells("D1:E1")   # Số trong tháng: Lượng + Trị giá
+    ws1.merge_cells("F1:G1")   # Cộng dồn: Lượng + Trị giá
+    # Merge A, B, C theo chiều dọc (row 1 + 2)
+    ws1.merge_cells("A1:A2")
+    ws1.merge_cells("B1:B2")
+    ws1.merge_cells("C1:C2")
+
+    # ── Dòng 2: Sub-headers ────────────────────────────────────────
+    ws1["D2"] = "Lượng"
+    ws1["E2"] = "Trị giá (USD)"
+    ws1["F2"] = "Lượng"
+    ws1["G2"] = "Trị giá (USD)"
+
+    # ── Style 2 header rows ────────────────────────────────────────
+    for row in (1, 2):
+        for col in range(1, NCOLS + 1):
+            c = ws1.cell(row=row, column=col)
+            c.fill = HEADER_FILL
+            c.font = HEADER_FONT
+            c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
+
+    ws1.row_dimensions[1].height = 30
+    ws1.freeze_panes = "A3"      # Freeze 2 header rows
```

**Mapping dữ liệu — bắt đầu từ row 3:**
```diff
-    for i, r in enumerate(summary_rows, start=2):
-        ws1.append([
-            r.get("product"), r.get("hs_code"), r.get("unit"),
-            r.get("quantity_month"), r.get("value_month_usd"),
-            r.get("quantity_ytd"), r.get("value_ytd_usd"),
-            r.get("average_price_usd"),
-        ])
+    for i, r in enumerate(summary_rows, start=3):
+        stt = i - 2   # 1, 2, 3, ...
+        ws1.append([
+            stt,
+            r.get("product"),
+            r.get("unit"),
+            r.get("quantity_month"),
+            r.get("value_month_usd"),
+            r.get("quantity_ytd"),
+            r.get("value_ytd_usd"),
+        ])
+        if i % 2 == 1:   # zebra striping (dòng lẻ từ row 3 trở đi)
+            for col in range(1, NCOLS + 1):
+                ws1.cell(row=i, column=col).fill = ALT_FILL
+        for ci in [4, 5, 6, 7]:   # cột số: Lượng, Trị giá (x2)
+            cell = ws1.cell(row=i, column=ci)
+            if cell.value is not None:
+                cell.number_format = "#,##0"
```

> [!NOTE]
> Bỏ cột `Ma HS / HS Code` và `Gia TB (USD)` vì không có trong yêu cầu mới.  
> Không cần các cột `%` — bỏ hoàn toàn.

---

## Verification Plan

### Automated Tests — Chạy sau khi implement

```powershell
# Test 1: Standalone với kỳ cụ thể (PDF phải đã có trong output/2025-09/pdfs/)
cd "c:\Users\Acer\Desktop\Dan on food\XNK\code"
python pipeline/ocr_pipeline.py --period 2025-09

# Test 2: Auto-period (kỳ tháng trước)
python pipeline/ocr_pipeline.py --period-auto

# Test 3: Interactive (không args)
python pipeline/ocr_pipeline.py

# Test 4: Chạy qua main.py vẫn hoạt động như cũ
python main.py --period 2025-09 --fixture
```

### Manual Verification

Sau khi chạy, mở `output/2025-09/2025-09_cashew.xlsx`:
- ✅ Sheet `Tong_XK`:
  - Row 1: `STT | Nhóm/Mặt hàng chủ yếu | ĐVT | Số trong tháng báo cáo [D1:E1] | Cộng dồn đến hết tháng báo cáo [F1:G1]`
  - Row 2: `(merged) | (merged) | (merged) | Lượng | Trị giá (USD) | Lượng | Trị giá (USD)`
  - Row 3+: dữ liệu với STT, format số `#,##0`
  - Freeze tại A3 (2 header rows không scroll)
- ✅ Script chạy được khi không có args (hỏi input)
- ✅ `main.py --fixture` vẫn hoạt động bình thường
