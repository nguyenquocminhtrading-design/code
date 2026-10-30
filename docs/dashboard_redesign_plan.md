# 🌰 Master Plan — XNK Dashboard Redesign
## Dan on Food × Cashew Gold v2

---

## Mục tiêu

Nâng cấp toàn bộ `web/` từ basic SPA thành một **premium analytics dashboard** đẳng cấp:
- Logo Dan on Food + ảnh hạt điều thực tế chất lượng cao
- Chart suite đầy đủ (6 loại chart mới)
- Theme màu cashew giữ nguyên nhưng nâng lên premium tier
- Layout tham khảo template Sales Admin (dark sidebar + light cards + rich charts)

---

## Preview Assets đã tạo

Hình hạt điều (thực tế, food photography) và Logo Dan on Food đã sẵn sàng trong `web/assets/`.

---

## User Review Required

> [!IMPORTANT]
> **Bạn muốn load data từ nguồn nào?**
> - Option A: **Drag & drop xlsx** như hiện tại (giữ nguyên)
> - Option B: **Auto-load JSON** từ `output/data/YYYY_cashew.json` (data_builder mới tạo) — web phải served qua http, không mở file:// trực tiếp
> - Option C: **Cả hai** — JSON auto-load + xlsx manual upload fallback

> [!IMPORTANT]
> **Dashboard header style?**
> - Option A: Sidebar dark (như reference) + header light — giống layout bạn gửi ảnh
> - Option B: Full dark mode (sidebar + cards đều dark)

---

## Open Questions

> [!NOTE]
> Bạn muốn thêm chart gì cụ thể? Dưới đây tôi đề xuất 6 chart mới. Nếu thiếu hay thừa chart nào thì nói nhé.

---

## Proposed Changes

### Component 1 — Design System (style.css — OVERHAUL)

Giữ `--gold` palette, nâng lên với:
- **Glassmorphism cards**: `backdrop-filter: blur(20px)` + subtle border
- **Hero banner** đầu dashboard: ảnh cashew full-width với gradient overlay
- **Brand header**: Logo Dan on Food thay emoji 🌰 trong sidebar
- **Gradient accent bar** thay solid bar ở sidebar active state
- **Card hover animations** phong phú hơn (`transform + box-shadow`)
- **Premium typography**: Outfit 800 cho KPI numbers, Inter cho body

**Color tokens mới (bổ sung, không xóa cũ):**
```css
--cashew-cream: #F6F1E7;    /* bg page */
--cashew-wood:  #2B2113;    /* sidebar */
--cashew-gold:  #C9A227;    /* accent */
--cashew-amber: #E8A230;    /* highlight */
--glass-white:  rgba(255,255,255,0.72);
--glass-border: rgba(201,162,39,0.18);
```

---

### Component 2 — New Chart Suite (6 charts mới)

#### Chart hiện có (2 charts):
| Chart | Tab | Status |
|-------|-----|--------|
| Horizontal Bar — Top 10 Countries by Value | Overview | ✅ giữ, làm đẹp |
| Doughnut — Market Share % | Overview | ✅ giữ, làm đẹp |

#### Charts mới thêm (6 charts):

| # | Chart | Tab | Dữ liệu | Library |
|---|-------|-----|---------|---------|
| 1 | **Area Sparkline** — Trend CY Value theo tháng | Overview (below KPIs) | `tong_xk.value_month_usd` per period | Chart.js |
| 2 | **Stacked Bar** — Qty vs Value side-by-side theo tháng | Trends tab | `tong_xk` × periods | Chart.js |
| 3 | **Radar Chart** — Top 5 thị trường so sánh Qty/Value/Share | Quốc gia tab | `xk_theo_nuoc` | Chart.js |
| 4 | **Bubble Chart** — Qty (x) × Value (y) × Market Share (size) mỗi quốc gia | Quốc gia tab | `xk_theo_nuoc` | Chart.js |
| 5 | **Horizontal Progress Bar** — Market share % kèm bar fill (như reference) | Overview sidebar right | `xk_theo_nuoc` | CSS + JS |
| 6 | **Line Chart (multi-series)** — So sánh CY Lượng vs YTD Lượng qua các kỳ | Trends tab | `tong_xk` per period | Chart.js |

---

### Component 3 — index.html (OVERHAUL layout)

#### Layout mới — 3 vùng:

```
┌─────────────────────────────────────────────────────────────┐
│  SIDEBAR (dark #2B2113)                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [Logo Dan on Food]  DAN ON FOOD                     │    │
│  │                     Premium Food Analytics          │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ • Overview                                          │    │
│  │ • Countries                                         │    │
│  │ • Map                                               │    │
│  │ • Trends                                            │    │
│  │ • Export                                            │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  TOPBAR: Title | Period chips | Upload btn                  │
├─────────────────────────────────────────────────────────────┤
│  HERO BANNER (hiện khi có data)                             │
│  ┌─ ảnh cashew bg ─────────────────────────────────────┐    │
│  │ Xuất khẩu Hạt Điều Việt Nam                         │    │
│  │ Kỳ: 2025-09   ● TCHQ · Tổng cục Hải quan            │    │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  KPI CARDS (4 cards — glassmorphism style)                  │
├─────────────────────────────────────────────────────────────┤
│  CHARTS ROW 1: Area Sparkline (2/3) | Donut (1/3)          │
├─────────────────────────────────────────────────────────────┤
│  CHARTS ROW 2: Top 10 Bar (2/3) | Progress Bars (1/3)      │
├─────────────────────────────────────────────────────────────┤
│  Periods table                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Tab Countries — mới:
```
┌─────────────────────────────────────────────────────────────┐
│  CHARTS ROW: Radar (1/2) | Bubble (1/2)                     │
├─────────────────────────────────────────────────────────────┤
│  Countries Table (searchable, sortable)                     │
└─────────────────────────────────────────────────────────────┘
```

#### Tab Trends — mới:
```
┌─────────────────────────────────────────────────────────────┐
│  Line Chart multi-series (CY vs YTD Volume)                 │
├─────────────────────────────────────────────────────────────┤
│  Stacked Bar Chart (Value by Month)                         │
├─────────────────────────────────────────────────────────────┤
│  Trends table                                               │
└─────────────────────────────────────────────────────────────┘
```

---

### Component 4 — app.js (mở rộng)

**Không xóa logic cũ** — chỉ thêm:

1. `buildAreaSparkline(periods)` — Area chart trend
2. `buildStackedBarChart(periods)` — Stacked bar theo tháng
3. `buildRadarChart(countryRows)` — Top 5 thị trường radar
4. `buildBubbleChart(countryRows)` — Bubble chart QTY × Value × Share
5. `buildProgressBars(countryRows)` — Market share % bars (CSS)
6. `buildMultiLineChart(periods)` — CY vs YTD Line

**Data source integration:**
- Giữ nguyên `handleFileSelect()` (xlsx upload)
- Thêm `loadFromJSON(year)` — load từ `output/data/YYYY_cashew.json`

---

## Visual Design Details

### Hero Banner
```
- Background: ảnh cashew_hero.jpg
- Overlay: linear-gradient(90deg, rgba(43,33,19,0.88) 40%, transparent)
- Left side: text (kỳ, sản lượng, trị giá)
- Right side: logo Dan on Food tròn
- Height: 160px
- Border-radius: 16px
```

### KPI Cards (glassmorphism)
```
- Background: rgba(255,255,255,0.72)
- Backdrop-filter: blur(20px)
- Border: 1px solid rgba(201,162,39,0.2)
- Icon: SVG thay emoji
- Number: font-size 28px Outfit 800
- Accent bar: left 4px gradient gold
```

### Chart Colors (cashew palette)
```javascript
const CASHEW_PALETTE = [
  '#C9A227', // gold
  '#8A6D1C', // gold dark
  '#E8A230', // amber
  '#5C470F', // deep brown
  '#F0DFA8', // light gold
  '#3E7C4F', // green accent
  '#2C6E9B', // blue accent
  '#B85C38', // orange-red
];
```

---

## Verification Plan

### Manual Verification
1. Mở `web/index.html` trong browser (file://)
2. Tải file `output/2025/2025-09_cashew.xlsx`
3. Kiểm tra 8 charts render đúng
4. Kiểm tra Hero banner hiện ảnh cashew + logo
5. Kiểm tra KPI glassmorphism
6. Resize browser → responsive

---

## Thứ tự thực hiện

```
Step 1: Cập nhật style.css — design system premium
Step 2: Sửa index.html — layout mới + hero banner + chart slots
Step 3: Mở rộng app.js — 6 chart builders mới
Step 4: Test với 2025-09_cashew.xlsx
```

**Files thay đổi:**

| File | Action |
|------|--------|
| `web/style.css` | OVERHAUL — glassmorphism, hero, premium KPI |
| `web/index.html` | OVERHAUL — layout, hero banner, new chart slots |
| `web/app.js` | EXTEND — 6 new chart builders |
| `web/assets/cashew_hero.jpg` | NEW (đã copy) |
| `web/assets/dan_on_food_logo.jpg` | NEW (đã copy) |
