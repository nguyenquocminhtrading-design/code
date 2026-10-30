# 📊 PLAN TỔNG HỢP: Backfill Summary & Other Row

## 18 File cần fix — Quy tắc bắt buộc

---

## 🎯 CÔNG THỨC BACKFILL

### Priority 1: YTD Diff (Ưu tiên cao nhất)

```
THÁNG 01:
  Month_Qty = YTD_Qty(01)
  Month_Val = YTD_Val(01)

THÁNG M>01:
  Month_Qty(M) = YTD_Qty(M) - YTD_Qty(M-1)
  Month_Val(M) = YTD_Val(M) - YTD_Val(M-1)
```

### Priority 2: YoY Proxy (Fallback)

```
Month_Qty(N) ≈ Month_Qty(N-1, cùng tháng)
Month_Val(N) ≈ Month_Val(N-1, cùng tháng)
```

### Tính Other Row

```
Other_Val = Summary_Val - SUM(Country_Rows_Val)
Other_Qty = Summary_Qty - SUM(Country_Rows_Qty)
```

---

## 📋 CHI TIẾT 18 KỲ CẦN FIX

### XUẤT KHẨU (11 kỳ)

| Kỳ | Cơ chế | Công thức | Debug Note |
|----|--------|-----------|------------|
| **2020-05** | YTD Diff | YTD_05 - YTD_04 | `YTD_2020-05 - YTD_2020-04` |
| **2020-12** | YoY Proxy | ≈ 2021-12 | `YoY từ 2021-12` |
| **2022-04** | YTD Diff | YTD_04 - YTD_03 | `YTD_2022-04 - YTD_2022-03` |
| **2022-06** | YTD Diff | YTD_06 - YTD_05 | `YTD_2022-06 - YTD_2022-05` |
| **2022-11** | YoY Proxy | ≈ 2021-11 | `YoY từ 2021-11` |
| **2023-02** | YTD Diff | YTD_02 - YTD_01 | `YTD_2023-02 - YTD_2023-01` |
| **2024-02** | YTD Diff | YTD_02 - YTD_01 | `YTD_2024-02 - YTD_2024-01` |
| **2024-07** | YoY Proxy | ≈ 2023-07 | `YoY từ 2023-07` |
| **2024-12** | YoY Proxy | ≈ 2023-12 | `YoY từ 2023-12` |
| **2025-03** | YTD Diff | YTD_03 - YTD_02 | `YTD_2025-03 - YTD_2025-02` |
| **2025-10** | YoY Proxy | ≈ 2024-10 | `YoY từ 2024-10` |

### NHẬP KHẨU (7 kỳ)

| Kỳ | Cơ chế | Công thức | Debug Note |
|----|--------|-----------|------------|
| **2022-01** | YTD Diff | = YTD_01 | `Tháng 01 = YTD` |
| **2022-04** | YTD Diff | YTD_04 - YTD_03 | `YTD_2022-04 - YTD_2022-03` |
| **2022-09** | YoY Proxy | ≈ 2021-09 | `YoY từ 2021-09` |
| **2023-02** | YTD Diff | YTD_02 - YTD_01 | `YTD_2023-02 - YTD_2023-01` |
| **2023-04** | YTD Diff | YTD_04 - YTD_03 | `YTD_2023-04 - YTD_2023-03` |
| **2024-03** | YoY Proxy | ≈ 2023-03 | `YoY từ 2023-03` |
| **2024-05** | YoY Proxy | ≈ 2023-05 | `YoY từ 2023-05` |

---

## 🔍 VÍ DỤ CỤ THỂ: 2020-05

### Trước fix:
```json
{
  "period": "2020-05",
  "tong_xk": null,  // THIẾU!
  "xk_theo_nuoc": [
    {"country": "USA", "cy_tri_gia": 5000000},
    {"country": "China", "cy_tri_gia": 3000000},
    // ... không có Other row
  ]
}
```

### Sau fix:
```json
{
  "period": "2020-05",
  "tong_xk": {
    "quantity_month": 4500,
    "value_month_usd": 32000000,
    "is_derived": true,
    "version": "derived",
    "source_note": "Ước tính YTD Diff (2020-05 - 2020-04)",
    "debug_source_file": "BACKFILL",
    "debug_source_type": "ytd_diff",
    "debug_source_note": "YTD_2020-05(45000) - YTD_2020-04(40500) = 4500 tấn, $32M"
  },
  "xk_theo_nuoc": [
    {"country": "USA", "cy_tri_gia": 5000000},
    {"country": "China", "cy_tri_gia": 3000000},
    {
      "country": "Other",
      "cy_tri_gia": 24000000,
      "debug_source_file": "BACKFILL",
      "debug_source_type": "calculated",
      "debug_source_note": "Other = Summary($32M) - Countries($8M) = $24M"
    }
  ]
}
```

---

## ✅ CHECKLIST NGHIỆM THU

- [ ] 18/18 kỳ có summary row (derived)
- [ ] 18/18 kỳ có Other row
- [ ] Tất cả có debug fields đầy đủ
- [ ] QC report status = ok
- [ ] Dashboard hiển thị đúng

---

**👉 Chờ duyệt plan trước khi code!**
