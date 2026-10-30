# 📋 PLAN XỬ LÝ LỖI LOAD DATA — XNK Cashew Dashboard

**Ngày:** 2026-10-26  
**Trạng thái:** Đang xử lý

---

## 🔍 ĐỀ XUẤT NGUYÊN NHÂN

### Vấn đề: Dữ liệu không load được khi mở dashboard

**Dấu hiệu:**
- File `output/all_years_cashew.xlsx` tồn tại (274KB)
- File `output/data/all_years_cashew.json` tồn tại (2.8MB)
- Cả 2 file đều có cấu trúc hợp lệ
- Nhưng dashboard hiển thị "Chưa có dữ liệu"

---

## 🐛 NGUYÊN NHÂN CÓ THỂ

### 1. CORS Issue (Khả năng cao)
- Dashboard chạy qua DeepSeek Harness Web GUI tại `http://127.0.0.1:19387`
- Files nằm ngoài domain gốc → browser block fetch requests
- Error: `Failed to fetch` hoặc `CORS policy`

### 2. Path Issues
- Code dùng relative path `../output/...` từ thư mục `web/`
- Nếu server không serve đúng base path → 404

### 3. Excel Parser Error
- SheetJS (xlsx library) không parse được file
- Sheet names không match expected patterns

---

## ✅ FIX ĐÃ ÁP DỤNG

### 1. Thêm JSON Fallback (Đã fix)
**File:** `web/app.js:4454-4465`

```javascript
// TRƯỚC (chỉ load Excel):
try { await loadAllYearsExcel(); }
catch (err) {
  showToast('Data load failed: ' + err.message, 'error');
}

// SAU (có fallback JSON):
try { await loadAllYearsExcel(); }
catch (err) {
  console.warn('Excel load failed, trying JSON fallback:', err.message);
  try { await loadAllYearsJSON(); }
  catch (err2) {
    showToast('Data load failed: ' + err2.message, 'error');
  }
}
```

### 2. Verifications Đã Làm
- ✅ File XLSX tồn tại, 274KB, 7 sheets
- ✅ File JSON tồn tại, 2.8MB, 81 periods
- ✅ Cấu trúc data hợp lệ (schema_version: 2)
- ✅ ISO mappings đã thêm 3 entries còn thiếu

---

## 🧪 CẦN KIỂM TRA THÊM

### Bước 1: Kiểm tra Console Error
Mở dashboard → F12 → Console tab:
```
Tìm lỗi: "Failed to fetch" hoặc "CORS" hoặc "404"
```

### Bước 2: Test Fetch Trực Tiếp
```javascript
// Mở Console và chạy:
fetch('../output/data/all_years_cashew.json')
  .then(r => r.json())
  .then(d => console.log('Loaded', d.periods.length, 'periods'))
  .catch(e => console.error('Error:', e));
```

### Bước 3: Kiểm tra Network Tab
- Xem request đến `../output/data/all_years_cashew.json`
- Status code: 200 hay 404?
- Response có data hay empty?

---

## 🔧 CÁC FIX BỔ SUNG (Nếu Cần)

### Fix 1: Absolute Path (Thay vì Relative)
**File:** `web/app.js`

Thay đổi line ~884:
```javascript
// TRƯỚC:
const url = '../output/data/all_years_cashew.json';

// SAU (absolute từ root):
const url = '/output/data/all_years_cashew.json';
```

### Fix 2: Server-Side Data Injection
Tạo endpoint API trả về JSON thay vì fetch file:
```python
# Trong main.py hoặc separate server
@app.get('/api/data')
async def get_data():
    with open('output/data/all_years_cashew.json') as f:
        return json.load(f)
```

### Fix 3: Embed Data in HTML
Th nhúng data trực tiếp vào page (không cần fetch):
```javascript
// Thêm vào index.html trước </body>
<script>
window.__INITIAL_DATA__ = { /* JSON content */ };
</script>
```

---

## 📊 KẾT QUẢ DỰ KIẾN

Sau khi apply fix:
- Dashboard load được 81 periods
- Charts hiển thị đầy đủ
- KPIs hiển thị số liệu
- Map hiển thị các quốc gia (kể cả Madagascar, Bangladesh...)

---

## 🚀 NEXT ACTIONS

1. **Test hiện tại:** Mở dashboard và kiểm tra console
2. **Nếu vẫn lỗi:** Capture console error và gửi cho tui
3. **Apply thêm fixes** tùy thuộc vào nguyên nhân cụ thể

---

*Lưu ý: Các fix Phase 1 (TV-variant, dedup, ISO mappings) đã được apply và verified.*
