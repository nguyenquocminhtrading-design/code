# MASTER PROMPT — XNK Cashew Data Intelligence Platform

---

## 🎯 PROJECT OVERVIEW

Build a **two-layer data intelligence system** for Vietnam cashew (hạt điều) export analytics, using TCHQ (Tổng cục Hải quan) and Vinacas data sources.

**Layer 1 — Python Pipeline (scraper + OCR + parser + Excel writer)**
**Layer 2 — Web Dashboard (HTML/CSS/Vanilla JS, no server backend)**

Language: **Bilingual — Vietnamese & English** throughout UI, exports, and labels.

---

## 🗂️ PROJECT STRUCTURE

```
C:\Users\Acer\Desktop\Dan on food\XNK\
├── TCHQ\
│   └── Export\          ← PDF files from TCHQ (input for OCR pipeline)
├── Vinacas\             ← (existing, Vinacas PDFs)
├── code\
│   ├── scraper.py       ← existing — extend/refactor this
│   ├── ocr_pipeline.py  ← NEW: OCR + parse pipeline
│   ├── web\             ← NEW: web dashboard
│   │   ├── index.html
│   │   ├── style.css
│   │   └── app.js
│   ├── output\
│   │   └── YYYY-MM\
│   │       ├── YYYY-MM_cashew.xlsx   ← 2-sheet Excel output
│   │       └── manifest.json
│   └── requirements.txt
```

---

## 📦 LAYER 1 — PYTHON PIPELINE

### 1.1 Data Sources

| Source | URL | Auth |
|--------|-----|------|
| TCHQ | `https://www.customs.gov.vn/index.jsp?pageId=4901` | None |
| Vinacas | `https://www.vinacas.com.vn/login.htm` | Username/password via env vars |

### 1.2 Target Files to Scrape (per month)

**File A — Monthly summary report:**
```
Title pattern: "Xuất khẩu hàng hóa tháng MM/YYYY"
Detection: PDF filename/title contains 'xuất khẩu hàng hóa' + month number + year
          AND does NOT contain 'nước' or 'quốc gia' (to distinguish from File B)
```

**File B — Country × Product breakdown report:**
```
Title pattern: "Xuất khẩu hàng hóa sang một số nước/vùng lãnh thổ chia theo mặt hàng chủ yếu tháng MM/YYYY"
Detection: PDF filename/title contains 'nước' OR 'quốc gia' OR 'vùng lãnh thổ' + month + year
```

### 1.3 Time Range

- User provides `--period-from YYYY-MM --period-to YYYY-MM` (range scraping)
- Also supports single month: `--period YYYY-MM`
- Each period produces one independent output Excel file

### 1.4 OCR Strategy

**Priority chain (per PDF file):**
1. **pdfplumber** — try first; if extracted text contains a valid table (≥5 rows with numeric content), use it
2. **PaddleOCR** — fallback if pdfplumber yields empty/corrupt text; optimized for Vietnamese (`lang='vi'`)
3. **VietOCR** — secondary fallback if PaddleOCR confidence < 0.7 average

```python
# OCR config
PADDLEOCR_LANG = 'vi'
VIETOCR_MODEL = 'vgg_transformer'
OCR_CONFIDENCE_THRESHOLD = 0.7
```

**Table extraction from OCR output:**
- Use PaddleOCR's `table_engine` or layout analysis to detect table structure
- For each detected cell: strip whitespace, normalize Vietnamese diacritics (NFC)
- Numbers: handle Vietnamese number format (dots as thousands separator, comma as decimal)

### 1.5 Parsing Logic

#### File A — `parse_summary(path, period)` → rows

Extract **only rows where column "Mặt hàng" (product) matches:**
```python
CASHEW_KEYWORDS = ['hạt điều', 'điều']
# Match: clean(product_cell).lower() contains any keyword
```

**Schema for File A rows:**
```python
{
    "source": "TCHQ",
    "report_type": "monthly_summary",    # File A
    "period": "YYYY-MM",
    "direction": "export",
    "product": str,          # e.g. "Hạt điều"
    "hs_code": str,          # if available
    "unit": str,             # e.g. "Tấn", "USD"
    "quantity_month": float | None,    # CY Lượng
    "value_month_usd": float | None,   # CY Trị giá (USD)
    "quantity_ytd": float | None,      # YTD Lượng
    "value_ytd_usd": float | None,     # YTD Trị giá (USD)
    "average_price_usd": float | None,
    "source_file": str,
    "retrieved_at": str      # ISO 8601 UTC
}
```

#### File B — `parse_country_product(path, period)` → rows

Extract **all rows**, then the normalize function pivots them.

**Raw schema (before pivot):**
```python
{
    "source": "TCHQ",
    "report_type": "country_product",   # File B
    "period": "YYYY-MM",
    "direction": "export",
    "country": str,          # e.g. "HOA KỲ", "TRUNG QUỐC"
    "product": str,          # e.g. "Hạt điều"
    "unit": str,             # e.g. "Tấn"
    "quantity_month": float | None,    # CY Lượng
    "value_month_usd": float | None,   # CY Trị giá (USD)
    "quantity_ytd": float | None,      # YTD Lượng
    "value_ytd_usd": float | None,     # YTD Trị giá (USD)
    "source_file": str,
    "retrieved_at": str
}
```

### 1.6 Normalize & Pivot Function

```python
def normalize_country_product(rows: list[dict]) -> pd.DataFrame:
    """
    Input:  flat list of File B rows (all products, all countries)
    Output: pivot DataFrame with structure:
    
    Index:   (country, product, unit)
    Columns: [CY_Luong, CY_TriGia_USD, YTD_Luong, YTD_TriGia_USD]
    
    Filter:  only rows where product keyword in CASHEW_KEYWORDS
    Sort:    by CY_TriGia_USD descending
    """
```

**Pivot layout (matching user's table):**

| Quốc gia | Mặt hàng | Đơn vị tính | CY Lượng | CY Trị giá (USD) | YTD Lượng | YTD Trị giá (USD) |
|----------|----------|-------------|----------|-----------------|-----------|------------------|
| AI CẬP   | Hạt điều | Tấn         | 262      | 2,450,019       | 2,131     | 19,365,081       |
| ...      | ...      | ...         | ...      | ...             | ...       | ...              |

### 1.7 Excel Output (2 sheets per file)

**Filename:** `YYYY-MM_cashew.xlsx`
**Location:** `code/output/YYYY-MM/`

| Sheet | Name | Content |
|-------|------|---------|
| Sheet 1 | `Tong_XK` | File A filtered rows (cashew only) — flat table |
| Sheet 2 | `XK_Theo_Nuoc` | File B normalized pivot table (cashew only) |

**Excel formatting requirements:**
- Header row: bold, background `#1a3a5c`, white font, freeze panes
- Number columns: right-aligned, thousands separator format `#,##0.00`
- Alternate row shading for readability
- Auto-fit column widths

---

## 🌐 LAYER 2 — WEB DASHBOARD

### 2.1 Tech Stack

- **Pure HTML5 + Vanilla CSS + Vanilla JavaScript** (no React, no Node server)
- **Libraries (CDN only, no build step):**
  - `SheetJS (xlsx.js)` — read uploaded Excel file in browser
  - `Chart.js` — bar chart + line chart
  - `jsPDF + jspdf-autotable` — PDF export
  - `PptxGenJS` — PPTX export
  - `Leaflet.js + GeoJSON` — choropleth map
- **Fonts:** Google Fonts — `Inter` (UI), `Outfit` (headings)

### 2.2 UI Layout

**Single Page Application (SPA) — dark mode BI dashboard style:**

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER: Logo + Title "XNK Hạt Điều Vietnam | Cashew Trade" │
│  Subtitle + Period selector + Upload Excel button           │
├─────────────────────────────────────────────────────────────┤
│  KPI CARDS ROW (4 cards):                                   │
│  [Tổng XK tháng (Tấn)] [Tổng XK tháng (USD)]              │
│  [Tổng XK YTD (Tấn)]   [Tổng XK YTD (USD)]                │
├──────────────────────────┬──────────────────────────────────┤
│  BAR CHART               │  LINE CHART                      │
│  Top 10 quốc gia         │  Xu hướng theo tháng             │
│  (CY Trị giá USD)        │  (nếu nhiều tháng được load)     │
├──────────────────────────┴──────────────────────────────────┤
│  PIVOT TABLE — Quốc gia × Hạt điều                         │
│  Filter: [Quốc gia search] [Mặt hàng dropdown]             │
│  Sortable columns, paginated (25 rows/page)                 │
├─────────────────────────────────────────────────────────────┤
│  CHOROPLETH MAP — Leaflet, colored by CY Trị giá USD        │
├─────────────────────────────────────────────────────────────┤
│  EXPORT BAR: [📥 JSON] [📊 Excel] [📄 PDF] [📑 PPTX]       │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Design System

**Color palette (dark mode):**
```css
--bg-primary:     #0d1117;
--bg-secondary:   #161b22;
--bg-card:        #21262d;
--accent-green:   #2ea043;   /* positive growth */
--accent-blue:    #388bfd;   /* primary action */
--accent-amber:   #d29922;   /* warning/neutral */
--accent-red:     #f85149;   /* negative */
--text-primary:   #e6edf3;
--text-secondary: #8b949e;
--border:         #30363d;
--gradient-hero:  linear-gradient(135deg, #1a3a5c 0%, #0d1117 100%);
```

**Typography:**
```css
font-family: 'Inter', sans-serif;       /* body */
font-family: 'Outfit', sans-serif;      /* headings, KPI numbers */
```

**Micro-animations:**
- KPI cards: count-up animation on load
- Bar chart: slide-in on load
- Table rows: fade-in stagger
- Upload zone: pulse glow on hover
- Export buttons: ripple on click

### 2.4 Upload Flow

```
User drags/drops Excel file → FileReader API reads as ArrayBuffer
→ SheetJS parses → detect Sheet 1 ("Tong_XK") and Sheet 2 ("XK_Theo_Nuoc")
→ validate schema → populate all components
→ show period badge (e.g., "Tháng 09/2026")
```

**Multi-period compare:**
- User can upload multiple Excel files (one per month)
- Line chart shows trend across all loaded periods
- Period selector tabs at the top to switch active view

### 2.5 Filter & Search

- **Country search:** live filter on pivot table (debounce 300ms)
- **Product dropdown:** currently only "Hạt điều" but extensible
- **Sort:** click any column header to sort ascending/descending

### 2.6 Export Formats

#### JSON Export
```json
{
  "meta": {
    "period": "2026-09",
    "generated_at": "ISO8601",
    "source": "TCHQ"
  },
  "summary": { "quantity_month_ton": 0, "value_month_usd": 0, ... },
  "country_cashew": [
    {
      "country_vi": "HOA KỲ",
      "country_en": "USA",
      "product": "Hạt điều",
      "unit": "Tấn",
      "cy_quantity": 12371,
      "cy_value_usd": 86433410,
      "ytd_quantity": 102946,
      "ytd_value_usd": 704535431
    }
  ]
}
```

#### Excel Export
- Same 2-sheet structure as input, re-exported with current filter state
- Styled with header colors, number formats

#### PDF Export (jsPDF + autotable)
- Page 1: Cover — title, period, date generated, logo area
- Page 2: KPI summary table
- Page 3+: Pivot table (paginated, 30 rows/page)
- Footer: page number, source attribution
- Colors match dashboard dark theme (navy headers)

#### PPTX Export (PptxGenJS)
- **Slide 1:** Title slide — "Xuất khẩu Hạt Điều Việt Nam | Vietnam Cashew Export" + period + date
- **Slide 2:** KPI dashboard — 4 big-number cards, visually identical to web KPIs
- **Slide 3:** Bar chart — Top 10 quốc gia theo CY Trị giá USD (rendered as PPTX chart)
- **Slide 4:** Pivot table — Top 20 quốc gia (formatted table, alternating rows)
- **Slide 5:** Line chart — xu hướng theo tháng (if multi-period loaded)
- Style: dark navy background (`#1a3a5c`), white text, accent colors matching web

---

## 🔧 IMPLEMENTATION DETAILS

### Python Requirements (`requirements.txt`)

```
requests>=2.31
beautifulsoup4>=4.12
pdfplumber>=0.10
paddlepaddle>=2.6          # CPU version
paddleocr>=2.7
vietocr>=0.3
openpyxl>=3.1
pandas>=2.1
pillow>=10.0
```

### Key Python Functions to Implement

```python
# ocr_pipeline.py

def detect_report_type(pdf_path: Path) -> Literal['summary', 'country_product', 'unknown']:
    """Classify PDF as File A or File B by filename + first-page content."""

def extract_table_pdfplumber(pdf_path: Path) -> list[list[str]] | None:
    """Try pdfplumber table extraction. Return None if insufficient rows."""

def extract_table_paddleocr(pdf_path: Path) -> list[list[str]]:
    """PaddleOCR table extraction with Vietnamese language."""

def extract_table_vietocr(pdf_path: Path) -> list[list[str]]:
    """VietOCR fallback extraction."""

def clean_number(s: str) -> float | None:
    """Parse Vietnamese number format: 1.234.567 → 1234567.0"""

def normalize_country_product(rows: list[dict]) -> pd.DataFrame:
    """Pivot File B rows into Quốc gia × Mặt hàng table, cashew only."""

def write_excel_output(summary_rows, pivot_df, period: str, output_dir: Path) -> Path:
    """Write 2-sheet Excel: Sheet1=Tong_XK, Sheet2=XK_Theo_Nuoc."""
```

### CLI Interface

```bash
# Single period
python code/ocr_pipeline.py --period 2026-09

# Range of periods
python code/ocr_pipeline.py --period-from 2026-01 --period-to 2026-09

# With explicit source folder
python code/ocr_pipeline.py --period 2026-09 --pdf-dir "TCHQ/Export"

# Force OCR engine
python code/ocr_pipeline.py --period 2026-09 --ocr-engine paddle
```

---

## 📋 ACCEPTANCE CRITERIA

### Python Pipeline ✅
- [ ] Auto-detect File A vs File B from PDF filename and first-page content
- [ ] OCR chain: pdfplumber → PaddleOCR → VietOCR (with fallback)
- [ ] File A: extract cashew rows only (keyword filter)
- [ ] File B: extract all rows, apply `normalize_country_product()` → pivot
- [ ] Output: `YYYY-MM_cashew.xlsx` with 2 sheets, styled
- [ ] `manifest.json` with OCR engine used, confidence, row count, errors
- [ ] Range period support (`--period-from` / `--period-to`)

### Web Dashboard ✅
- [ ] Upload Excel (drag & drop + click), parse with SheetJS
- [ ] 4 KPI cards with count-up animation
- [ ] Bar chart: Top 10 countries by CY value
- [ ] Line chart: trend across multiple loaded periods
- [ ] Pivot table: all countries, cashew only, with search + sort + pagination
- [ ] Choropleth map: countries colored by CY export value
- [ ] Filter/search by country name (live, debounced)
- [ ] Multi-period compare (load multiple Excel files)
- [ ] Export: JSON ✓ / Excel ✓ / PDF ✓ / PPTX ✓
- [ ] PPTX: 5 slides, visually premium, dark navy theme
- [ ] PDF: cover + KPI + pivot table pages
- [ ] Bilingual labels (Việt / English) toggle
- [ ] Responsive layout (desktop ≥ 1280px primary target)
- [ ] Dark mode only

---

## 🚫 CONSTRAINTS

1. **No server backend** — web app is purely client-side (HTML/CSS/JS)
2. **No React, Vue, or build tools** for web — vanilla JS only
3. **No TailwindCSS** — vanilla CSS with CSS custom properties
4. **Python pipeline is separate** from web — connected only by the Excel file
5. **Vinacas credentials** must never be logged or stored in files — use env vars
6. **Output filenames are deterministic** — same period always overwrites previous run

---

## 🗓️ BUILD ORDER

1. **`ocr_pipeline.py`** — PDF detection + OCR chain + parse + normalize + Excel writer
2. **Update `scraper.py`** — add range period support, integrate `ocr_pipeline` module
3. **`web/style.css`** — full design system, dark mode, CSS variables
4. **`web/index.html`** — SPA structure, all sections
5. **`web/app.js`** — SheetJS parse, Chart.js, Leaflet, all export functions
6. **Test end-to-end** with sample PDF from `TCHQ/Export`

