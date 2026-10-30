# DAN ON FOOD — Cashew Trade Explorer
## Master plan redesign giao diện và trải nghiệm

## 1. Mục tiêu sản phẩm

Biến dashboard Cashew Gold hiện tại thành một công cụ phân tích dữ liệu xuất nhập khẩu có cảm giác như một sản phẩm thật:

- Gọn, đáng tin cậy, dễ đọc.
- Tương tác trực tiếp với dữ liệu thay vì chỉ xem các card và biểu đồ.
- Không cần backend.
- Cho phép nạp dữ liệu từ Excel, CSV hoặc JSON.
- Nhận diện thương hiệu rõ ràng bằng logo DAN ON FOOD.
- Có thể mở rộng cho almond, pistachio và các nhóm sản phẩm khác sau này.

Tên định hướng mới: **DAN ON FOOD · Trade Explorer**.

---

## 2. Nguyên tắc thiết kế

### 2.1. Từ “AI dashboard” sang “data workspace”

Giảm các yếu tố khiến giao diện giống template được sinh tự động:

- Bớt gradient, glassmorphism và shadow lớn.
- Giảm số lượng card bo tròn.
- Không dùng emoji làm icon chính.
- Không để mọi thành phần đều có màu vàng.
- Ưu tiên khoảng trắng, typography và hierarchy dữ liệu.

### 2.2. Visual direction

- Nền chính: warm white hoặc xám rất nhạt.
- Màu thương hiệu: nâu đậm, vàng điều, xanh lá cho trạng thái tích cực.
- Vàng chỉ dùng cho CTA, selected state và highlight dữ liệu.
- Border mảnh, radius khoảng 8–10px.
- Typography: một font sans-serif dễ đọc; chỉ dùng font display cho tiêu đề thương hiệu.
- Biểu đồ dùng màu phân cấp, không dùng một palette vàng cho tất cả series.

### 2.3. Logo DAN ON FOOD

Logo hiện có tại:

`code/web/assets/dan_on_food_logo.jpg`

Logo cần xuất hiện ở:

1. Sidebar/header chính.
2. Màn hình upload trống.
3. Loading/empty state.
4. Footer hoặc khu vực thông tin nguồn dữ liệu.
5. Metadata khi export ảnh/PDF nếu có.

Nên xử lý logo theo nguyên tắc “brand mark + wordmark”: không lặp logo quá lớn trong cùng một viewport, không dùng logo làm background trang trí.

---

## 3. Kiến trúc trải nghiệm mới

### Navigation

1. Overview
2. Markets
3. Timeline
4. Data table
5. Data source / Export

### Global controls

Luôn hiển thị ở topbar:

- Dataset hiện tại.
- Kỳ đang chọn.
- Metric: trị giá / sản lượng / đơn giá.
- Search hoặc filter quốc gia.
- Nút reset filter.
- Trạng thái dữ liệu: số kỳ, số bản ghi, thời gian nạp.

### Interaction model

- Click một quốc gia trên chart để lọc bảng và các chart liên quan.
- Click một dòng trong bảng để mở detail drawer.
- Hover chart hiển thị tooltip có context, đơn vị và phần trăm thay đổi.
- Filter được hiển thị thành chip và có thể xóa từng chip.
- Khi không có dữ liệu, người dùng thấy rõ cần làm gì tiếp theo.

---

## 4. Master plan theo phase

## Phase 0 — Audit và chuẩn hóa phạm vi

### Mục tiêu

Hiểu chính xác giao diện, dữ liệu và các luồng đang có trước khi redesign.

### Công việc

- Kiểm tra toàn bộ `index.html`, `style.css`, `app.js`.
- Liệt kê các màn hình, chart, table và chức năng upload hiện tại.
- Kiểm tra format các file JSON/Excel mẫu.
- Xác định các field bắt buộc và field tùy chọn.
- Chụp baseline cho desktop, tablet và mobile.
- Xác định những phần cần giữ, sửa hoặc bỏ.

### Kết quả cần có

- UI inventory.
- Data schema thống nhất.
- Danh sách bug/UX issue.
- Baseline screenshots.

### Tiêu chí hoàn thành

Không còn component quan trọng nào bị “ẩn” trong code mà chưa được ghi nhận.

---

## Phase 1 — Brand system và visual foundation

### Mục tiêu

Đặt nền visual mới cho DAN ON FOOD.

### Công việc

- Tích hợp logo DAN ON FOOD ở sidebar và upload state.
- Thiết kế lại màu sắc, typography, spacing và elevation.
- Thay emoji icon bằng SVG/icon system thống nhất.
- Giảm radius, shadow và decorative effects.
- Xây CSS variables cho màu thương hiệu.
- Chuẩn hóa trạng thái hover, active, focus, disabled, loading và error.
- Tạo logo lockup: logo + “DAN ON FOOD” + “Trade Explorer”.

### Kết quả cần có

- Brand tokens.
- Component styles cơ bản.
- Sidebar/topbar mới.
- Empty state có nhận diện thương hiệu.

### Tiêu chí hoàn thành

Giao diện nhìn nhất quán ngay cả khi chưa có dữ liệu; người dùng nhận ra thương hiệu DAN ON FOOD trong vài giây đầu.

---

## Phase 2 — Redesign shell và navigation

### Mục tiêu

Chuyển dashboard thành một application shell rõ ràng và ít “template-like” hơn.

### Công việc

- Sidebar gọn hơn, hỗ trợ collapse.
- Topbar có dataset, kỳ dữ liệu và trạng thái load.
- Tách navigation khỏi các nội dung trang.
- Thêm breadcrumb hoặc context label cho từng màn hình.
- Thêm responsive layout cho màn hình nhỏ.
- Thêm keyboard focus và accessibility cơ bản.

### Kết quả cần có

- Overview shell.
- Markets shell.
- Timeline shell.
- Data shell.
- Data source shell.

### Tiêu chí hoàn thành

Người dùng luôn biết mình đang ở màn hình nào, đang xem kỳ nào và dữ liệu đến từ đâu.

---

## Phase 3 — Data ingestion không cần backend

### Mục tiêu

Cho phép người dùng nạp và quản lý dữ liệu local một cách đáng tin cậy.

### Công việc

- Hỗ trợ `.xlsx`, `.xls`, `.csv`, `.json`.
- Chuẩn hóa tất cả input về một data model chung.
- Preview trước khi import.
- Hiển thị số sheet, số dòng và cột được nhận diện.
- Cảnh báo thiếu cột hoặc sai kiểu dữ liệu.
- Cho phép nạp nhiều file/kỳ.
- Lưu dataset đã chuẩn hóa vào `localStorage` hoặc `IndexedDB`.
- Có nút remove từng file và clear all.
- Có thể export dataset chuẩn hóa thành JSON.

### Data model đề xuất

```js
{
  period: "2026-09",
  country: "Hoa Kỳ",
  product: "Hạt điều",
  unit: "Tấn",
  quantityMonth: 1200,
  valueMonthUsd: 4500000,
  quantityYtd: 9200,
  valueYtdUsd: 32000000
}
```

### Tiêu chí hoàn thành

Người dùng có thể đóng/mở lại trang mà không mất dataset đã nạp trong trình duyệt.

---

## Phase 4 — Overview tương tác

### Mục tiêu

Biến Overview thành nơi khám phá dữ liệu, không chỉ là nơi xem số liệu.

### Công việc

- KPI có delta so với kỳ trước và tooltip giải thích.
- Cho phép đổi metric giữa trị giá, sản lượng và đơn giá.
- Chart xu hướng có zoom và hover detail.
- Chart Top markets có thể click để filter.
- Market share có thể click legend để ẩn/hiện nhóm.
- Thêm filter chips.
- Thêm nút reset toàn bộ filter.
- Thêm insight ngắn được tính từ dữ liệu, ví dụ:
  - thị trường tăng mạnh nhất;
  - thị trường chiếm tỷ trọng lớn nhất;
  - kỳ có trị giá cao nhất.

### Tiêu chí hoàn thành

Mỗi chart chính đều có ít nhất một thao tác có ý nghĩa và thao tác đó cập nhật những phần liên quan trên trang.

---

## Phase 5 — Markets và detail drawer

### Mục tiêu

Tạo cảm giác ứng dụng interactive bằng cách drill-down dữ liệu.

### Công việc

- Bảng có search, sort, filter và pagination.
- Click row mở detail drawer bên phải.
- Drawer hiển thị:
  - tổng trị giá;
  - sản lượng;
  - tỷ trọng;
  - biến động theo kỳ;
  - mini trend chart;
  - các sản phẩm liên quan nếu có.
- Đồng bộ selection giữa table, map và chart.
- Cho phép copy/export detail của một quốc gia.

### Tiêu chí hoàn thành

Người dùng có thể đi từ tổng quan đến chi tiết một quốc gia mà không bị mất context hoặc phải tải lại trang.

---

## Phase 6 — Timeline và data explorer

### Mục tiêu

Làm rõ dữ liệu theo thời gian và tăng khả năng phân tích.

### Công việc

- Timeline theo tháng/quý/năm.
- So sánh nhiều kỳ.
- Chọn phạm vi thời gian.
- Toggle giữa monthly, YTD và year-over-year.
- Bảng dữ liệu có column visibility.
- Freeze header và hỗ trợ horizontal scroll.
- Export CSV/JSON theo filter hiện tại.

### Tiêu chí hoàn thành

Người dùng có thể trả lời nhanh: “thị trường nào tăng?”, “tăng trong kỳ nào?” và “tăng bao nhiêu?”.

---

## Phase 7 — Map và visual storytelling

### Mục tiêu

Giữ bản đồ như một lớp khám phá, không biến nó thành phần trang trí.

### Công việc

- Map dùng chung filter với Markets.
- Click quốc gia trên map mở detail drawer.
- Scale màu có chú thích dễ hiểu.
- Cho phép chuyển metric trên map.
- Hiển thị trạng thái không có mapping thay vì silently bỏ dữ liệu.
- Có fallback table khi map không tải được.

### Tiêu chí hoàn thành

Bản đồ giúp trả lời câu hỏi phân bố thị trường và vẫn dùng được khi không có mạng hoặc map tile lỗi.

---

## Phase 8 — Export, sharing và quality polish

### Mục tiêu

Hoàn thiện trải nghiệm sử dụng thực tế.

### Công việc

- Export CSV/JSON theo filter.
- Export report ảnh/PDF nếu cần.
- In logo DAN ON FOOD và thời gian dữ liệu trên report.
- Thêm sample dataset để demo.
- Loading skeleton.
- Error state dễ hiểu.
- Toast không che nội dung.
- Kiểm tra mobile, tablet và màn hình lớn.
- Kiểm tra dữ liệu rỗng, file lỗi, file trùng kỳ và số liệu null.

### Tiêu chí hoàn thành

Người dùng mới có thể mở web, nạp file và hiểu cách dùng mà không cần hướng dẫn trực tiếp.

---

## 5. Thứ tự ưu tiên triển khai

### P0 — Bắt buộc

- Brand system mới.
- Tích hợp logo DAN ON FOOD.
- Redesign shell.
- Excel/JSON/CSV loader.
- Data model thống nhất.
- Filter xuyên suốt dashboard.
- Chart click để filter.

### P1 — Nên có

- Detail drawer.
- localStorage/IndexedDB.
- Timeline comparison.
- Export filtered data.
- Loading/error states.

### P2 — Có thể mở rộng

- PDF report.
- Saved views.
- Bookmark filter.
- Multi-product comparison.
- Dark mode.
- PWA/offline cache.

---

## 6. Definition of Done

Web được xem là hoàn thành khi:

- Logo DAN ON FOOD xuất hiện đúng và không bị lạm dụng.
- Giao diện không còn phụ thuộc vào một màu vàng hoặc các card trang trí.
- Upload Excel/JSON/CSV hoạt động ổn định.
- Không cần backend để xem và phân tích dữ liệu.
- Filter được đồng bộ giữa KPI, chart, table và map.
- Click chart hoặc table tạo ra hành động rõ ràng.
- Có empty, loading, error và success states.
- Giao diện responsive.
- Dữ liệu local được giữ lại sau khi refresh.
- Export được dữ liệu sau khi lọc.

---

## 7. Kết luận định hướng

Không nên chỉ “làm đẹp” giao diện hiện tại. Cần chuyển từ một dashboard trình bày số liệu sang một **interactive trade data workspace**.

Thứ tự đúng là:

```text
Brand rõ ràng
→ Shell gọn và đáng tin
→ Data loading chắc chắn
→ Filter xuyên suốt
→ Drill-down trực tiếp
→ Export và polish
```

Logo DAN ON FOOD là phần nhận diện xuyên suốt, còn giá trị chính của web nằm ở khả năng giúp người dùng khám phá, so sánh và hiểu dữ liệu nhanh hơn.
