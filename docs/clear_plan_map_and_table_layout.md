# CLEAR PLAN: TỐI ƯU TRÌNH BÀY BẢN ĐỒ & BẢNG DỮ LIỆU (KHÔNG BỊ COLLAPSE)

## 1. Phân tích hiện trạng từ ảnh thực tế & Codebase
Từ ảnh chụp màn hình thực tế và mã nguồn HTML/CSS:
1. **Vấn đề Bản đồ (Map Tab):**
   - **Kích thước Map cố định (`height: 520px`)**: Không tự động giãn theo độ cao màn hình, trong khi cột panel bên phải (`.map-panel`) lại bị dài tràn hoặc cuộn riêng, làm bố cục 2 cột không cân xứng.
   - **Thẻ KPI trong Map Panel (`.mp-kpis`)**: Hiện tại đang ép `grid-template-columns: 1fr 1fr` với chiều rộng panel chỉ `310px`, dẫn đến các chỉ số trị giá lớn (như `$46.01M`, `6.890`, `$6.65M`) bị bó hẹp, nhãn chữ bị chật chội.
   - **Biểu đồ xu hướng mini (`#mp-trend-chart`)**: Trục thời gian bị dồn cục ở góc dưới (`2020-01...2025-09`), đường line bị tụt xuống đáy hoặc đè lên text, thiếu padding.
   - **Chân bản đồ**: Chú thích (Legend) đang là `absolute` đè lên góc trái dưới của bản đồ, che mất các nước Nam Bán Cầu (Úc, Nam Phi, Nam Mỹ) và dễ bị click nhầm.

2. **Vấn đề Bảng dữ liệu (Table):**
   - Cả 2 bảng: **Bảng Quốc gia (`#pivot-table`)** và **Bảng Các kỳ đã tải (`#periods-body`)** hiện đang thiếu chiều cao tối đa (`max-height`) kèm `sticky header` độc lập, khi cuộn trang dài làm mất tiêu đề cột.
   - Bảng quốc gia khi màn hình nhỏ bị co rúm cột hoặc tràn thanh cuộn ngang không rõ ràng, thanh tỷ lệ trị giá (`.value-bar`) chưa có độ rộng tối thiểu cố định dẫn đến các dòng bị lệch hàng (alignment không thẳng cột).

---

## 2. Kế hoạch chi tiết (Implementation Plan)

### Mục 1: Nâng cấp Bố cục Bản đồ & Map Panel (`tab-map`)
- **Tăng chiều rộng và cân đối cột Panel:**
  - Nâng chiều rộng cột panel từ `310px` lên `360px` (`grid-template-columns: 1fr 360px; min-height: 580px;`).
  - Đặt chiều cao container `#world-map` thành `580px` đồng bộ với panel, bo góc viền tinh tế, thêm hiệu ứng đổ bóng nhẹ (`box-shadow: inset 0 0 12px rgba(0,0,0,0.03)`).
- **Tái cấu trúc thẻ KPI trong Map Panel (`.mp-kpis`):**
  - Chuyển layout KPI sang dạng card thông thoáng, font số `Outfit` sắc nét:
    - **Hàng 1 (Tháng hiện tại):** `CY Trị giá (USD)` và `CY Lượng (Tấn)` (nền vàng kim nhạt đẳng cấp).
    - **Hàng 2 (Lũy kế đầu năm):** `YTD Trị giá (USD)` và `YTD Lượng (Tấn)` (nền xanh lá / gold soft chuyên nghiệp).
    - **Hàng 3 (Thị phần & Thứ hạng):** Trình bày full-width nổi bật với thanh progress bar thị phần trực quan.
- **Tối ưu Biểu đồ xu hướng Mini (`#mp-trend-chart`):**
  - Chỉnh lại cấu hình Chart.js trong `renderMapPanel`:
    - Tăng chiều cao container biểu đồ từ `150px` lên `165px`.
    - Giảm số lượng ticks trục X (`maxTicksLimit: 4`), xoay góc chữ nhẹ hoặc chỉ hiện năm đầu/năm cuối để không bị đè chữ.
    - Bật tooltip rõ ràng khi rê chuột vào điểm mốc thời gian.
- **Tối ưu Vị trí Chú thích màu (`.map-legend`):**
  - Căn chỉnh lại `position: absolute; bottom: 16px; left: 16px;` với nền kính mờ (`backdrop-filter: blur(8px); background: rgba(255,255,255,0.92)`), gọn gàng và không chắn tầm nhìn tương tác bản đồ.

---

### Mục 2: Nâng cấp Bảng dữ liệu (Chi tiết Quốc gia & Bảng Kỳ đã tải)
- **Container cuộn chuẩn (`.table-wrap`):**
  - Bổ sung `max-height: 600px; overflow-y: auto; overflow-x: auto;`.
  - Giữ cố định hàng tiêu đề (`thead th { position: sticky; top: 0; z-index: 5; background: #FAF5E8; }`) để cuộn xem hàng trăm nước vẫn nhìn thấy tiêu đề cột.
- **Định dạng cột chuẩn tài chính:**
  - Cột Quốc gia: Cố định độ rộng tối thiểu `180px`, in đậm tên nước, kèm icon cờ/chấm tròn phân loại khu vực.
  - Cột Trị giá & Sản lượng: Căn phải (`text-align: right`), font `tabular-nums` thẳng hàng từng chữ số.
  - Cột Thanh tỷ lệ (`.value-bar`): Đặt độ rộng tối thiểu cố định `140px`, thanh bar mượt mà chuyển màu gradient vàng kim sang trọng.
- **Trải nghiệm phân trang & Tìm kiếm (`.table-toolbar`):**
  - Đặt `search-box` và bộ lọc trải rộng cân đối, bổ sung nút xóa nhanh tìm kiếm (`clear search`).
  - Hàng dòng chẵn lẻ (Zebra stripe) nhẹ nhàng (`nth-child(even) { background: #FCFAF6; }`) giúp bảng dễ đọc, không mỏi mắt khi đối chiếu nhiều số liệu.

---

### Mục 3: Đảm bảo chống Collapse tuyệt đối
- Thiết lập CSS `min-width: 0;` cho `.map-canvas-wrap` và `#world-map` (ngăn lỗi grid/flex làm container con bị xẹp về 0px).
- Kích hoạt lại `invalidateSize()` ngay khi load tab hoặc thay đổi kích thước trình duyệt.

---

## 3. Các file sẽ chỉnh sửa
1. [web/style.css](file:///c:/Users/Acer/Desktop/Dan%20on%20food/XNK/code/web/style.css): Bổ sung & điều chỉnh các CSS rules cho `.map-layout`, `.map-panel`, `#world-map`, `.mp-kpis`, `.data-table`, `.table-wrap`.
2. [web/index.html](file:///c:/Users/Acer/Desktop/Dan%20on%20food/XNK/code/web/index.html): Tinh chỉnh lại cấu trúc markup thẻ KPI trong `#map-panel-detail` cho rõ ràng, thoáng đãng.
3. [web/app.js](file:///c:/Users/Acer/Desktop/Dan%20on%20food/XNK/code/web/app.js): Cân chỉnh cấu hình options của `#mp-trend-chart` (trục X không bị chồng lấn chữ).

---

## 4. Hành động tiếp theo
Kế hoạch đã sẵn sàng. Xin vui lòng xác nhận hoặc bấm **Proceed** để bắt đầu triển khai ngay!
