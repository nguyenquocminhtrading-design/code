# MASTER PLAN - VINACAS CASHEW DATA DASHBOARD & EXPORT SYSTEM

## 📋 TỔNG QUAN DỰ ÁN

Xây dựng hệ thống xử lý, trực quan hóa và xuất báo cáo dữ liệu xuất khẩu hạt điều Vinacas từ dữ liệu "All Year Cashew Adjusted".

---

## 🎯 MỤC TIÊU CHÍNH

1. **Data Processor (Python)**: Tự động tính YTD tích lũy theo năm từ dữ liệu thô
2. **Interactive Dashboard (HTML/JS)**: Visualize CY vs YTD với toggle switch
3. **PDF Export Template (HTML)**: Format đẹp, không collapse, sẵn sàng in PDF
4. **PPTX Export Template (HTML)**: Slide-ready, responsive, professional
5. **Master Pipeline**: Tích hợp tất cả thành quy trình tự động

---

## 📊 PHÂN TÍCH DỮ LIỆU NGUỒN

### Cấu trúc dữ liệu hiện có (từ bảng Vinacas):

| Kỳ      | Lượng (tấn) | Trị giá tháng (USD) | Trị giá YTD (USD) | % Thay đổi |
| ------- | ----------- | ------------------- | ----------------- | ---------- |
| 2024-01 | 65,054      | $350.90M            | $350.90M          | —          |
| 2024-02 | —           | —                   | —                 | —          |
| 2024-03 | 58,838      | $314.86M            | $806.91M          | —          |
| ...     | ...         | ...                 | ...               | ...        |
| 2026-09 | 64,888      | $469.93M            | $3.84B            | ▼ 1.0%     |

### Vấn đề cần giải quyết:

- ❌ Tháng thiếu dữ liệu (2024-02, 2024-07, 2024-12, 2025-03, 2025-10...)
- ❌ YTD hiện tại có vẻ không chính xác (cần tính lại từ đầu năm)
- ❌ Cần tách rõ: **CY (Calendar Year - giá trị tháng)** vs **YTD (Year-to-Date - tích lũy)**

---

## 🔧 KIẾN TRÚC HỆ THỐNG

```
┌─────────────────────────────────────────────────────────────────┐
│                        MASTER PIPELINE                          │
├─────────────────────────────────────────────────────────────────┤
│  1. DATA LAYER          2. PROCESSING LAYER    3. OUTPUT LAYER  │
│  ┌─────────────────┐   ┌─────────────────┐   ┌──────────────┐  │
│  │ cashew_raw.csv  │──▶│ cashew_processor│──▶│ cashew_data  │  │
│  │ / Excel input   │   │ .py (Python)    │   │ .json        │  │
│  └─────────────────┘   └─────────────────┘   └──────────────┘  │
│                            │                    │              │
│                            ▼                    ▼              │
│                     ┌─────────────┐    ┌────────────────┐     │
│                     │ YTD Calculator│  │ dashboard.html │     │
│                     │ - cumulative │  │ (Chart.js)     │     │
│                     │ - YoY compare│  │ - CY/YTD toggle│     │
│                     └─────────────┘    └────────────────┘     │
│                            │                    │              │
│                            ▼                    ▼              │
│                     ┌─────────────┐    ┌────────────────┐     │
│                     │ Excel Export │   │ pdf_template.  │     │
│                     │ (multi-sheet)│   │ html + pptx_   │     │
│                     └─────────────┘    │ template.html  │     │
│                                        └────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 CẤU TRÚC FILE DỰ ÁN

```
C:\Users\Acer\Desktop\Dan on food\XNK\code\
│
├── 📄 MASTER_PLAN.md                    # File này
├── 🐍 cashew_data_processor.py          # Python processor chính
├── 📊 cashew_raw_data.csv               # Dữ liệu thô (sẽ tạo từ bảng bạn đưa)
├── 📊 cashew_processed_data.xlsx        # Output Excel multi-sheet
├── 📊 cashew_data.json                  # Output JSON cho dashboard
│
├── 🌐 dashboard.html                    # Dashboard interactive chính
├── 🎨 assets/
│   ├── chartjs.min.js                   # Chart.js local
│   └── style.css                        # Shared styles
│
├── 📄 pdf_template.html                 # Template xuất PDF
├── 📄 pptx_template.html                # Template xuất PPTX
│
├── 📋 pdf_generator.py                  # Script generate PDF từ HTML
├── 📋 pptx_generator.py                 # Script generate PPTX từ HTML
│
└── 📚 docs/
    ├── DATA_DICTIONARY.md               # Từ điển dữ liệu
    ├── API_REFERENCE.md                 # Tài liệu API
    └── DEPLOYMENT_GUIDE.md              # Hướng dẫn triển khai
```

---

## 🐍 MODULE 1: PYTHON DATA PROCESSOR (`cashew_data_processor.py`)

### Chức năng chính:

```python
class CashewDataProcessor:
    1. load_data(source)           # Load CSV/Excel/JSON
    2. clean_data()                # Xử lý missing values, parse numbers
    3. calculate_ytd()             # TÍNH YTD TÍCH LŨY THEO NĂM
    4. calculate_cy()              # CY = giá trị tháng (gốc)
    5. calculate_yoy()             # So sánh cùng kỳ năm trước
    6. generate_comparison_table() # Bảng 4 cột: CY Vol, CY Val, YTD Vol, YTD Val
    7. export_json()               # Cho dashboard
    8. export_excel()              # Multi-sheet báo cáo
```

### Logic tính YTD (QUAN TRỌNG):

```
YTD tại tháng M của năm Y = Σ(giá trị tháng 1 đến M của năm Y)

Ví dụ 2024:
- YTD 2024-01 = 350.90M
- YTD 2024-03 = 350.90M + 0(tháng 2) + 314.86M = 665.76M  ✓
- YTD 2024-04 = 665.76M + 358.35M = 1,024.11M             ✓
```

### Xử lý tháng thiếu dữ liệu:

- **Option A**: Giữ NaN, không cộng vào YTD (khuyên dùng)
- **Option B**: Nội suy tuyến tính
- **Option C**: Copy tháng trước
- → **Quyết định**: Mặc định Option A, có parameter config

### Output 4 cột yêu cầu:

| Năm  | Tháng | CY Lượng (tấn) | CY Trị giá (USD) | YTD Lượng (tấn) | YTD Trị giá (USD) |
| ---- | ----- | -------------- | ---------------- | --------------- | ----------------- |
| 2024 | 01    | 65,054         | 350,900,000      | 65,054          | 350,900,000       |
| 2024 | 02    | —              | —                | 65,054          | 350,900,000       |
| 2024 | 03    | 58,838         | 314,860,000      | 123,892         | 665,760,000       |
| ...  | ...   | ...            | ...              | ...             | ...               |

---

## 🌐 MODULE 2: INTERACTIVE DASHBOARD (`dashboard.html`)

### Tech Stack:

- **Chart.js v4** (local, không CDN) - chart bar/line combo
- **Vanilla JS** (ES6+) - không framework, nhẹ, nhanh
- **CSS Grid/Flexbox** - responsive
- **Local JSON** - data source

### Features:

| Feature              | Mô tả                                                    |
| -------------------- | -------------------------------------------------------- |
| 🔄 **CY/YTD Toggle** | Nút switch lớn, rõ ràng, lưu localStorage                |
| 📊 **Chart Types**   | Bar (Volume) + Line (Value) dual axis                    |
| 📅 **Year Selector** | Multi-select: 2024, 2025, 2026...                        |
| 📈 **YoY Overlay**   | Hiển thị % thay đổi cùng kỳ năm trước                    |
| 🔍 **Hover Tooltip** | Chi tiết: Period, CY Vol, CY Val, YTD Vol, YTD Val, YoY% |
| 📱 **Responsive**    | Desktop ≥ 1200px, Tablet 768-1199px, Mobile < 768px      |
| 🎨 **Theme**         | Light/Dark mode, Vinacas brand colors                    |

### Layout Dashboard:

```
┌────────────────────────────────────────────────────────────┐
│  VINACAS CASHEW EXPORT DASHBOARD          [☀/🌙] [CY/YTD]  │
├────────────────────────────────────────────────────────────┤
│  [2024] [2025] [2026] [All]    |    [Volume] [Value] [Both] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                    CHART AREA (Chart.js)                   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  █ █ █  █ █  █  █  █  █  █  █  █  █  █  █  █  █   │  │
│  │  █ █ █  █ █  █  █  █  █  █  █  █  █  █  █  █  █   │  │
│  │  ────────────────────────────────────────────────  │  │
│  │  Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  SUMMARY CARDS                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │CY Volume │ │CY Value  │ │YTD Volume│ │YTD Value │      │
│  │  577K t  │ │ $3.43B   │ │  577K t  │ │ $3.43B   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└────────────────────────────────────────────────────────────┘
```

### Data Format JSON cho Dashboard:

```json
{
  "metadata": {
    "source": "Vinacas All Year Cashew Adjusted",
    "generated": "2026-01-15T10:30:00Z",
    "years": [2024, 2025, 2026],
    "lastPeriod": "2026-09"
  },
  "data": {
    "2024": {
      "cy": [
        {"period": "2024-01", "month": 1, "volume": 65054, "value": 350900000, "volPct": null, "valPct": null},
        {"period": "2024-02", "month": 2, "volume": null, "value": null, "volPct": 0, "valPct": 0},
        ...
      ],
      "ytd": [
        {"period": "2024-01", "month": 1, "volume": 65054, "value": 350900000, "volYoY": null, "valYoY": null},
        {"period": "2024-02", "month": 2, "volume": 65054, "value": 350900000, "volYoY": null, "valYoY": null},
        ...
      ]
    },
    "2025": {...},
    "2026": {...}
  }
}
```

---

## 📄 MODULE 3: PDF EXPORT TEMPLATE (`pdf_template.html`)

### Yêu cầu: "Không bị collapse quá nhiều" - Layout cố định, professional

### Design Specification:

```
┌─────────────────────────────────────────────────────────────┐
│  VINACAS - BÁO CÁO XUẤT KHẨU HẠT ĐIỀU                       │
│  Năm 2024-2026 | Chế độ: [CY Monthly] / [YTD Cumulative]   │
│  Ngày tạo: DD/MM/YYYY                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. EXECUTIVE SUMMARY (1 trang)                            │
│     - Tổng quan 3 năm, highlight key metrics               │
│                                                             │
│  2. BẢNG SO SÁNH 4 CỘT (2-3 trang)                         │
│     ┌────┬──────┬──────────┬────────────┬──────────┬────────┐│
│     │STT │ Kỳ   │ CY Lượng │ CY Trị giá │ YTD Lượng│ YTD TG ││
│     ├────┼──────┼──────────┼────────────┼──────────┼────────┤│
│     │ 1  │2024-01│ 65,054  │ $350.9M   │  65,054  │$350.9M ││
│     │ 2  │2024-02│    —    │    —      │  65,054  │$350.9M ││
│     │... │ ...  │   ...   │    ...    │   ...    │  ...   ││
│     └────┴──────┴──────────┴────────────┴──────────┴────────┘│
│     * Fixed header, striped rows, page-break-inside: avoid  │
│                                                             │
│  3. BIỂU ĐỒ (1 trang/năm)                                   │
│     - Chart.js render to canvas → image trong PDF           │
│                                                             │
│  4. PHÂN TÍCH YoY (1 trang)                                 │
│     - Bảng % thay đổi cùng kỳ                                │
│                                                             │
│  5. PHỤ LỤC: Raw Data & Methodology                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### CSS for Print (PDF):

```css
@page {
  size: A4 landscape;
  margin: 20mm 15mm;
  @top-center {
    content: "VINACAS - Cashew Export Report";
  }
  @bottom-center {
    content: "Page " counter(page) " of " counter(pages);
  }
}

@media print {
  .no-print {
    display: none !important;
  }
  table {
    page-break-inside: avoid;
  }
  thead {
    display: table-header-group;
  }
  .page-break {
    page-break-before: always;
  }
  .chart-container {
    page-break-inside: avoid;
  }
}
```

### Generate PDF Options:

- **Option 1**: Puppeteer/Playwright (headless Chrome) - chất lượng cao nhất
- **Option 2**: WeasyPrint (Python) - pure Python, không cần browser
- **Option 3**: wkhtmltopdf - nhanh, nhẹ
- → **Khuyên dùng**: Playwright (có sẵn trong môi trường hoặc cài dễ)

---

## 📊 MODULE 4: PPTX EXPORT TEMPLATE (`pptx_template.html` + generator)

### Slide Structure (1 file PPTX, multiple slides):

| Slide # | Layout               | Nội dung                                              |
| ------- | -------------------- | ----------------------------------------------------- |
| 1       | Title Slide          | VINACAS Cashew Export Report, Năm, Chế độ CY/YTD      |
| 2       | Agenda               | 4 sections: Summary, Data Table, Charts, YoY Analysis |
| 3       | Executive Summary    | 4 KPI cards + key insights (bullets)                  |
| 4       | CY Monthly Chart     | Bar+Line chart, full slide                            |
| 5       | YTD Cumulative Chart | Area chart, full slide                                |
| 6       | Comparison Table     | 4-column table (fit to slide, font 10-11pt)           |
| 7       | YoY Analysis         | Waterfall/bar chart % change                          |
| 8       | Yearly Summary       | 3-year comparison table                               |
| 9       | Appendix             | Methodology, Data source, Notes                       |

### PPTX Generator (python-pptx):

```python
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE

def create_pptx(data_json, template_type='CY', output_path):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Slide 1: Title
    # Slide 2: KPI Cards
    # Slide 3: Chart (insert chart from data)
    # Slide 4: Table (4 columns)
    # ...
    prs.save(output_path)
```

### HTML Template for PPTX Preview:

- Single page HTML simulating slides
- CSS `page-break-after: always` cho từng slide
- Có thể in PDF hoặc chụp màn hình làm slide

---

## 🔄 MODULE 5: MASTER PIPELINE ORCHESTRATOR

### File: `run_pipeline.py`

```python
#!/usr/bin/env python3
"""
Master Pipeline - Chạy toàn bộ quy trình một lệnh
Usage: python run_pipeline.py --mode all --year 2024,2025,2026
"""

import argparse
from cashew_data_processor import CashewDataProcessor
from pdf_generator import generate_pdf
from pptx_generator import generate_pptx

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['data', 'dashboard', 'pdf', 'pptx', 'all'], default='all')
    parser.add_argument('--years', default='2024,2025,2026')
    parser.add_argument('--input', default='cashew_raw_data.csv')
    parser.add_argument('--output-dir', default='./output')
    args = parser.parse_args()

    years = [int(y) for y in args.years.split(',')]

    # 1. Process Data
    processor = CashewDataProcessor(args.input)
    processor.calculate_ytd()
    processor.export_to_json(f'{args.output_dir}/cashew_data.json')
    processor.export_to_excel(f'{args.output_dir}/cashew_report.xlsx')

    # 2. Generate Dashboard (copy template + inject data)
    if args.mode in ['dashboard', 'all']:
        generate_dashboard(args.output_dir, years)

    # 3. Generate PDF
    if args.mode in ['pdf', 'all']:
        generate_pdf(f'{args.output_dir}/cashew_data.json',
                     f'{args.output_dir}/cashew_report_CY.pdf', mode='CY')
        generate_pdf(f'{args.output_dir}/cashew_data.json',
                     f'{args.output_dir}/cashew_report_YTD.pdf', mode='YTD')

    # 4. Generate PPTX
    if args.mode in ['pptx', 'all']:
        generate_pptx(f'{args.output_dir}/cashew_data.json',
                      f'{args.output_dir}/cashew_report_CY.pptx', mode='CY')
        generate_pptx(f'{args.output_dir}/cashew_data.json',
                      f'{args.output_dir}/cashew_report_YTD.pptx', mode='YTD')
```

---

## 🎨 DESIGN SYSTEM & BRANDING

### Vinacas Color Palette:

```css
:root {
  /* Primary */
  --vinacas-green: #1b5e20; /* Dark green - primary */
  --vinacas-green-light: #2e7d32; /* Medium green */
  --vinacas-green-lighter: #4caf50; /* Light green */

  /* Secondary */
  --vinacas-gold: #f9a825; /* Gold accent */
  --vinacas-amber: #ffb300; /* Amber */

  /* Neutral */
  --dark-bg: #1a1a2e;
  --card-bg: #ffffff;
  --text-primary: #1a1a2e;
  --text-secondary: #4a4a5a;
  --border-color: #e0e0e0;

  /* Status */
  --positive: #2e7d32;
  --negative: #c62828;
  --neutral: #1565c0;

  /* Chart Colors */
  --chart-cy-volume: #1b5e20;
  --chart-cy-value: #f9a825;
  --chart-ytd-volume: #4caf50;
  --chart-ytd-value: #ffb300;
  --chart-yoy-positive: #2e7d32;
  --chart-yoy-negative: #c62828;
}
```

### Typography:

- **Heading**: 'Inter', 'Roboto', sans-serif (Bold 700)
- **Body**: 'Inter', 'Roboto', sans-serif (Regular 400, Medium 500)
- **Monospace**: 'JetBrains Mono', 'Fira Code' (cho số liệu)

---

## ⚙️ CẤU HÌNH & TUỲ CHỈNH

### Config File: `config.yaml`

```yaml
data:
  input_file: "cashew_raw_data.csv"
  missing_month_strategy: "keep_nan" # keep_nan | interpolate | forward_fill
  ytd_calculation: "cumulative_sum" # cumulative_sum | rolling_window

output:
  json_path: "output/cashew_data.json"
  excel_path: "output/cashew_report.xlsx"
  pdf_dir: "output/pdf/"
  pptx_dir: "output/pptx/"
  dashboard_path: "output/dashboard.html"

dashboard:
  default_view: "CY" # CY | YTD
  default_years: [2024, 2025, 2026]
  chart_height: 500
  theme: "light" # light | dark | auto
  show_yoy: true
  animation_duration: 750

pdf:
  page_size: "A4"
  orientation: "landscape"
  margins: { top: 20, right: 15, bottom: 20, left: 15 }
  font_size_table: 9
  font_size_header: 11

pptx:
  slide_width: 13.333
  slide_height: 7.5
  font_name: "Calibri"
  theme_color: "#1B5E20"
```

---

## 📅 ROADMAP TRIỂN KHAI

| Phase       | Task                                           | Délai | Trạng thái   |
| ----------- | ---------------------------------------------- | ----- | ------------ |
| **Phase 1** | Tạo file dữ liệu thô CSV từ bảng bạn cung cấp  | 15'   | ⏳ Chờ duyệt |
| **Phase 2** | Viết `cashew_data_processor.py` hoàn chỉnh     | 30'   | ⏳ Chờ duyệt |
| **Phase 3** | Tạo `dashboard.html` + Chart.js local          | 45'   | ⏳ Chờ duyệt |
| **Phase 4** | Tạo `pdf_template.html` + `pdf_generator.py`   | 30'   | ⏳ Chờ duyệt |
| **Phase 5** | Tạo `pptx_template.html` + `pptx_generator.py` | 30'   | ⏳ Chờ duyệt |
| **Phase 6** | Tạo `run_pipeline.py` orchestrator             | 15'   | ⏳ Chờ duyệt |
| **Phase 7** | Test end-to-end, fix bugs                      | 30'   | ⏳ Chờ duyệt |
| **Phase 8** | Handover & documentation                       | 15'   | ⏳ Chờ duyệt |

**Tổng ước lượng**: ~3.5 giờ làm việc

---

## ✅ TIÊU CHÍ CHẤP NHẬN (ACCEPTANCE CRITERIA)

### Data Processor:

- [ ] Đọc được CSV/Excel input
- [ ] Tính YTD chính xác: YTD tháng M = Σ(tháng 1..M)
- [ ] Xử lý tháng thiếu dữ liệu (keep NaN, forward fill YTD)
- [ ] Tính YoY% so với cùng kỳ năm trước
- [ ] Xuất JSON đúng schema cho dashboard
- [ ] Xuất Excel 5 sheets: Raw, CY, YTD, Comparison, Summary

### Dashboard:

- [ ] Toggle CY/YTD hoạt động mượt, lưu preference
- [ ] Chart hiển thị đúng: Bar=Volume, Line=Value (dual axis)
- [ ] Multi-year selector (checkbox từng năm)
- [ ] Tooltip hiển thị 4 giá trị + YoY%
- [ ] Responsive 3 breakpoint
- [ ] Dark/Light mode
- [ ] Không phụ thuộc CDN (offline ready)

### PDF Export:

- [ ] Layout A4 landscape, không collapse bảng
- [ ] Header/footer cố định trên mọi trang
- [ ] Bảng 4 cột break đúng trang, repeat header
- [ ] Chart render vector/hi-res
- [ ] Tạo được 2 file: CY report, YTD report

### PPTX Export:

- [ ] 9 slides theo cấu trúc định sẵn
- [ ] Table fit slide, font ≥ 10pt
- [ ] Chart native PowerPoint (editable)
- [ ] Theme color Vinacas
- [ ] Tạo được 2 file: CY, YTD

---

## 🔧 DEPENDENCIES

### Python (requirements.txt):

```
pandas>=2.0
openpyxl>=3.1
numpy>=1.24
pyyaml>=6.0
playwright>=1.40      # cho PDF generation
python-pptx>=0.6      # cho PPTX generation
jinja2>=3.1           # template rendering
```

### JS (local files):

```
chart.js v4.4.x (minified)
chartjs-adapter-date-fns v3.x (nếu cần time scale)
```

### System:

- Python 3.10+
- Node.js (optional, cho dev)
- Playwright browsers: `playwright install chromium`

---

## ❓ CÂU HỎI CẦN XÁC NHẬN TRƯỚC KHI BẮT ĐẦU

| #   | Câu hỏi                                | Lựa chọn                                                                                             | Khuyến nghị                                                       |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | **Tháng thiếu dữ liệu xử lý như nào?** | A) Giữ NaN, YTD không cộng thêmB) Nội suy tuyến tínhC) Copy tháng trước                              | **A** - Giữ thật, minh bạch                                       |
| 2   | **Đơn vị trị giá trong JSON/Excel?**   | A) Triệu USD (350.9)B) USD đầy đủ (350,900,000)C) Cả 2                                               | **B** - USD đầy đủ cho tính toán, format hiển thị tùy UI          |
| 3   | **Dashboard host như nào?**            | A) File HTML tĩnh mở trình duyệtB) HTTP server local (python -m http.server)C) Deploy Netlify/Vercel | **A/B** - Local first                                             |
| 4   | **PDF engine ưu tiên?**                | A) Playwright (Chromium headless)B) WeasyPrint (pure Python)C) wkhtmltopdf                           | **A** - Chất lượng tốt nhất                                       |
| 5   | **PPTX chart: native hay image?**      | A) Native PowerPoint chart (editable)B) High-res image embed                                         | **A** - Professional hơn                                          |
| 6   | **Có cần so sánh 2023 không?**         | Có / Không                                                                                           | Dữ liệu bạn đưa chỉ 2024-2026 → **Không** (trừ khi có file riêng) |
| 7   | **Format số hiển thị?**                | A) 65,054 (comma separator)B) 65.054 (dot - VN style)C) 65054                                        | **B** - Theo thói quen VN (1.234,56)                              |
| 8   | **Tên file output convention?**        | `cashew_report_YYYYMMDD_CY.pdfcashew_report_YYYYMMDD_YTD.pdf`                                        | Timestamp + mode                                                  |

---

## 🚀 LỆNH CHẠY DỰ KIẾN (SAU KHI DUYỆT)

```bash
# 1. Cài dependencies
pip install -r requirements.txt
playwright install chromium

# 2. Chạy full pipeline
python run_pipeline.py --mode all --years 2024,2025,2026

# 3. Hoặc chạy từng bước
python cashew_data_processor.py          # Chỉ xử lý data
python run_pipeline.py --mode dashboard  # Chỉ dashboard
python run_pipeline.py --mode pdf        # Chỉ PDF
python run_pipeline.py --mode pptx       # Chỉ PPTX

# 4. Mở dashboard
# Mở file output/dashboard.html bằng trình duyệt
```

---

## 📞 HANDOVER & SUPPORT

### Deliverables giao cho bạn:

1. ✅ Source code đầy đủ, comment tiếng Việt
2. ✅ File `config.yaml` để tùy chỉnh không cần sửa code
3. ✅ `README.md` hướng dẫn chạy, troubleshoot
4. ✅ Dữ liệu mẫu `cashew_raw_data.csv` (từ bảng bạn đưa)
5. ✅ Output samples: JSON, Excel, PDF, PPTX

### Maintenance:

- Cập nhật dữ liệu tháng mới: chỉ cần thêm row vào CSV → chạy lại pipeline
- Thêm năm mới: tự động detect từ data
- Thay đổi format: sửa `config.yaml` hoặc template HTML

---

## 📝 GHI CHÚ KỸ THUẬT QUAN TRỌNG

### 1. YTD Calculation Logic (đã verify với dữ liệu bạn đưa):

```
2024-01: CY=350.90M, YTD=350.90M     ✓
2024-02: CY=NaN,     YTD=350.90M     ✓ (forward fill)
2024-03: CY=314.86M, YTD=665.76M     ✓ (350.90+314.86)
2024-04: CY=358.35M, YTD=1024.11M    ✓ (665.76+358.35)
2024-05: CY=413.29M, YTD=1437.40M    ✓
2024-06: CY=380.85M, YTD=1818.25M    ✓
2024-07: CY=NaN,     YTD=1818.25M    ✓
2024-08: CY=410.61M, YTD=2228.86M    ✓
2024-09: CY=373.58M, YTD=2602.44M    ✓
2024-10: CY=425.44M, YTD=3027.88M    ✓
2024-11: CY=397.73M, YTD=3425.61M    ✓
2024-12: CY=NaN,     YTD=3425.61M    ✓
```

### 2. So sánh với bảng Vinacas gốc:

- Bảng gốc có cột "Trị giá YTD" → Ta sẽ **tính lại** để đảm bảo chính xác
- Các % thay đổi trong bảng gốc (▲13.8%, ▼7.8%...) là **CY month-over-month**
- Ta sẽ tính thêm **YTD YoY%** (so với cùng kỳ năm trước)

### 3. Performance:

- Data size: ~36 rows × 3 years = ~100 records → cực nhẹ
- Dashboard load < 500ms
- PDF/PPTX generation < 10s

---

## ✅ TRẠNG THÁI: CHỜ DUYỆT

> **Kế hoạch này đã sẵn sàng để bạn review.**Hãy cho tôi biết:
>
> 1. **Approve** → Tôi sẽ triển khai từng Phase
> 2. **Adjust** → Nêu rõ điểm cần chỉnh (câu hỏi 1-8 hoặc bất kỳ chỗ nào)
> 3. **Priority** → Nên làm module nào trước (data processor → dashboard → pdf → pptx)

---

_Document version: 1.0_
_Created: 2026-01-15_
_Author: AI Assistant for Vinacas Cashew Data Project_
