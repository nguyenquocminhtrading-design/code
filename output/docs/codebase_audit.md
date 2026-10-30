# 📊 BÁO CÁO AUDIT TOÀN DIỆN CODEBASE XNK Cashew

> Ngày: 2026-10-26 | Tổng số file Python: 17 | Tổng lỗi tìm thấy: **38**

---

## MỤC LỤC
1. [Tổng quan rủi ro](#1-tổng-quan-rủi-ro)
2. [pipeline/ocr_pipeline.py](#2-pipelineocr_pipelinepy)
3. [pipeline/data_builder.py](#3-pipelinedata_builderpy)
4. [main.py](#4-mainpy)
5. [pipeline/scraper.py](#5-pipelinescraperpy)
6. [pipeline/paths.py](#6-pipelinepathspy)
7. [restructure_output.py](#7-restructure_outputpy)
8. [migrate_output.py](#8-migrate_outputpy)
9. [ui_verify.py](#9-ui_verifypy)
10. [diagnostics/*.py](#10-diagnosticspy)
11. [Phân tích dữ liệu — Tên quốc gia](#11-phân-tích-dữ-liệu--tên-quốc-gia)
12. [Cơ chế "bù tháng" (Other residual)](#12-cơ-chế-bù-tháng-other-residual)
13. [Ma trận lỗi tổng hợp](#13-ma-trận-lỗi-tổng-hợp)
14. [Kế hoạch sửa chữa theo ưu tiên](#14-kế-hoạch-sửa-chữa-theo-ưu-tiên)

---

## 1. TỔNG QUAN RỦI RO

| Mức độ | Số lượng | Tác động |
|--------|----------|----------|
| NGHIÊM TRỌNG (Critical) | 5 | Mất/sai dữ liệu hiển thị trên dashboard |
| CAO (Major) | 9 | Dữ liệu bị ẩn, logic sai, path hỏng |
| TRUNG BÌNH (Minor) | 14 | Code smell, dead code, hiệu suất |
| NHẸ (Low) | 10 | Cải thiện code quality |

**Nguyên nhân gốc rễ chính** (root cause):
1. **TCHQ đổi quy ước đặt tên file PDF** từ `VN-CT/VN-DC/VN-SB` sang `TV-CT/TV-DC/TV-SB` (~2026) — code không nhận diện được → phiên bản mặc định là "preliminary" → trộn lẫn dữ liệu CT+SB cùng phiên bản → **dòng quốc gia bị trùng lặp** → hàng "Other" âm → dashboard ẩn kỳ.
2. **Không có dedup quốc gia** trong `normalize_country_product` — nếu cùng một nước xuất hiện 2 lần (từ 2 PDF khác), tổng chi tiết bị đội lên gấp đôi.
3. **Cửa sổ tên quốc gia tiếng Anh** trong `web/app.js COUNTRY_ISO` thiếu ~8 entry (Bangladesh, India, Indonesia, Laos, Pakistan, Philippines, Guinea-Conakry, Madagascar).

---

## 2. pipeline/ocr_pipeline.py (1221 dòng)

### [CRITICAL] P0 — TV- variant không được nhận diện (dòng 152–158, 941)
**File:** `ocr_pipeline.py:152-158` (detect_report_info) và `ocr_pipeline.py:941` (_pick_best)

**Mô tả:** TCHQ đổi tên file từ `(vn-ct)/(vn-dc)/(vn-sb)` sang `(tv-ct)/(tv-dc)/(tv-sb)` bắt đầu ~2026. `detect_report_info` chỉ kiểm tra các pattern `vn-ct`, `vn-dc`, `vn-sb`, nên file `2026-T05T-2X(TV-DC).pdf` bị gán version = `"preliminary"` (default). Kết quả: cả file TV-DC và VN-SB đều có version "preliminary" → `_country_rows_for_version("preliminary")` gom cả hai nhóm → mỗi quốc gia xuất hiện 2 lần trong pivot → Other = summary − Σ(detail_dup) < 0.

**Bằng chứng:**
- 2026-05 export: `negative_other_residual cy_tri_gia = -374,098,990`
- 2026-05 import: `negative_other_residual cy_tri_gia = -316,826,095`
- 2026-06 export: `negative_other_residual cy_tri_gia = -371,083,790`
- 2026-06 import: `negative_other_residual cy_tri_gia = -302,546,197`

**Gợi ý fix:** Thêm pattern `(tv-ct)`, `(tv-dc)`, `(tv-sb)` vào detect_report_info và _pick_best. Ưu tiên CT > DC > SB như cũ.

### [CRITICAL] P0 — Không dedup quốc gia trong normalize_country_product (dòng 492–550)
**File:** `ocr_pipeline.py:515-547`

**Mô tả:** `normalize_country_product` sort theo giá trị rồi concat Other row — nhưng KHÔNG groupby(country). Nếu cùng một quốc gia xuất hiện nhiều lần (từ nhiều PDF), tất cả được giữ nguyên, sum chi tiết bị đội lên, Other thành âm.

**Bằng chứng:** 2026-05 XK_Theo_Nuoc sheet có TRUNG QUỐC 2 dòng (25135 và 25055) và HOA KỲ 2 dòng (13584 và 13584).

**Gợi ý fix:** Sau khi sort, thêm `pivot = pivot.groupby(["Quốc gia","mặt hàng"], as_index=False).agg({"CY Lượng":"sum","CY Trị giá (USD)":"sum","YTD Lượng":"sum","YTD Trị giá (USD)":"sum"}).reset_index(drop=True)` trước khi tính Other. Hoặc dedup ngay tại `_country_rows_for_version` bằng cách groupby sau khi lọc version.

### [MAJOR] P1 — _country_rows_for_version trả về TẤT CẢ khi wanted=None (dòng 1042–1050)
**File:** `ocr_pipeline.py:1042-1050`

```python
def _country_rows_for_version(rows_list, summary_row):
    if not rows_list:
        return []
    wanted = (summary_row or {}).get("version")
    for version in ([wanted] if wanted else []) + ["official", "adjusted", "preliminary"]:
        matching = [r for r in rows_list if r.get("version") == version]
        if matching:
            return matching
    return rows_list  # FALLBACK: trả về TẤT CẢ!
```

**Mô tả:** Khi `summary_row` là None (không có summary), `wanted` = None, vòng for thử "official", "adjusted", "preliminary" — nếu không có row nào match (do version detection sai như ở P0), hàm trả về `rows_list` nguyên vẹn → mọi row từ mọi PDF variant được gom lại.

**Gợi ý fix:** Thêm log warning khi fallback, hoặc tốt hơn: filter strict hơn — nếu wanted=None và không có official/adjusted/preliminary match, trả về empty list thay vì all rows.

### [MAJOR] P1 — Version preference "derived" là dead code (dòng 1031–1037)
**File:** `ocr_pipeline.py:1031-1037`

```python
def _best_summary_row(rows_list):
    ...
    for v in ("official", "adjusted", "preliminary", "derived"):
```

**Mô tả:** Dòng comment ở 1057-1059 nói "Do not infer missing monthly summaries from the following month's rate of change" — cơ chế derive đã bị xoá. Nhưng "derived" vẫn nằm trong version preference list → nếu một summary row có version "derived" (do manual entry), nó sẽ được ưu tiên sau "preliminary". Cần xóa "derived" khỏi list này.

### [MAJOR] P1 — File B parse heuristic dễ sai (dòng 473–479)
**File:** `ocr_pipeline.py:473-479`

```python
# Potential country line: ends with exactly 2 numbers, no ĐVT
parts = line.split()
if len(parts) >= 3 and not re.search(r"\b(Tấn|USD|Mt|kg)\b", line):
    if re.search(r"[\d.,]+$", parts[-1]) and re.search(r"[\d.,]+$", parts[-2]):
        country_name = " ".join(parts[:-2])
```

**Mô tả:** Quốc gia được xác định bằng heuristic "dòng kết thúc với đúng 2 số, không có ĐVT". OCR errors có thể tạo dòng giả, hoặc dòng product không có ĐVT (ví dụ "Một số nước khác...") bị nhầm thành country line. Cần thêm kiểm tra: country name phải có ít nhất 2 từ, không chứa ký tự số.

### [MAJOR] P2 — Không filter "Others" row trước khi ghi vào xlsx
**File:** `ocr_pipeline.py:535-547`

Other row được viết vào sheet XK_Theo_Nuoc với `country = "Other"`. Sau đó data_builder.py đọc nó như một country row bình thường, và dashboard đếm nó trong total. Điều này khiến total detail = Σ(countries) + Other = summary (reconcile đúng), nhưng các chart donut/bar hiển thị "Other" như một slice riêng — gây nhầm lẫn. Nên loại "Other" ra khỏi pivot DataFrame trước khi ghi xlsx, hoặc đánh dấu `direction="other"` để downstream filter.

### [MINOR] P2 — is_cashew regex bắt nhầm (dòng 107)
**File:** `ocr_pipeline.py:107`

```python
_CASHEW_RE = re.compile(r"\bhat dieu\b|\bdieu\b(?!\s*(?:hoa|khien|khong khi))")
```

Pattern `\bdieu\b` match bất kỳ từ nào chứa "điều" trừ "điều hòa", "điều khiển", "điều không khí". Tuy nhiên OCR có thể tạo "DIEU" (không dấu) hoặc "điêu" → miss. Nên dùng `strip_accents` trước khi match (đã có ở dòng 110-111, OK).

### [MINOR] P2 — detect_report_info đọc first_text từ trang 1 (dòng 139-146)
**File:** `ocr_pipeline.py:139-146`

Chỉ đọc page[0] để detect FDI context. Nếu trang 1 là trang tiêu đề không có nội dung phân biệt, có thể nhầm loại báo cáo. OK cho hiện tại vì TCHQ luôn đặt type info trên trang 1.

### [MINOR] P3 — Dead code: import pdfplumber conditional (dòng 415)
**File:** `ocr_pipeline.py:415`

```python
if pdfplumber:
```

pdfplumber được import ở đầu file (dòng 57). Không có try/except wrap cho import, nên nếu thiếu library thì module sẽ crash ngay khi import — clause `if pdfplumber:` sẽ luôn True. Cần xử lý graceful fallback.

### [MINOR] P3 — PaddleOCR temp files không xoá trên exception (dòng 243-273)
**File:** `ocr_pipeline.py:243-273`

try/finally xoá `img_path` — OK. Nhưng nếu process bị kill giữa chừng, file `_tmp_ocr_{page_num}.png` có thể tồn tại. Có cleanup routine khi start.

---

## 3. pipeline/data_builder.py (770 dòng)

### [CRITICAL] C0 — No dedup when writing records (dòng 410-420)
**File:** `data_builder.py:410-420`

```python
for period, item in sorted(periods_data.items()):
    for flow, key in (("export", "xk_theo_nuoc"), ("import", "nk_theo_nuoc")):
        for row in item.get(key, []):
            tchq_records.append({...})
```

**Mô tả:** Duyệt qua `item["xk_theo_nuoc"]` nguyên bản — nếu monthly xlsx có duplicate country rows (do OCR bug P0), chúng được thêm vào records không check. Combined xlsx cũng vậy (dòng 352-355).

**Gợi ý fix:** Groupby (period, flow, country) + sum numeric cols trước khi append vào records.

### [MAJOR] M1 — "Other" row trở thành country row trong JSON (dòng 410-420)
**File:** `data_builder.py:410-420`

Other row từ monthly xlsx (country="Other") được thêm vào `tchq_records` như một quốc gia thông thường. Dashboard web/app.js đếm nó trong tổng chi tiết. chart_data_audit.py kiểm tra Other separately — phát hiện negative_residual — nhưng web app chỉ ẩn period thay vì cảnh báo.

**Gợi ý fix:** Filter out rows where country.strip().lower() == "other" trước khi thêm vào records. Giữ Other trong monthly xlsx cho human review nhưng không đưa vào JSON.

### [MAJOR] M1 — is_derived filter chỉ check version/note text (dòng 144-150)
**File:** `data_builder.py:144-150`

```python
version_text = rec["version"].casefold()
note_text = rec["source_note"].casefold()
if "fallback" in version_text or "ước tính" in version_text or "uoc tinh" in version_text \
        or "suy ngược" in note_text or "suy nguoc" in note_text:
    continue
```

**Mô tả:** Filter này phụ thuộc vào text content của trường `version` và `source_note`. Nếu OCR ghi nhầm (ví dụ "Official" thành "OFFICIAL"), casefold() vẫn match. OK. Nhưng `is_derived` boolean field (dòng 332, 342, 688) KHÔNG được set bởi parse_xlsx — chỉ check `not item["tong_xk"].get("is_derived")`. Trường `is_derived` luôn None/Falsy → điều kiện `not None` = True → derived summaries KHÔNG bị loại trong combined workbook.

**Thực tế:** Trong Tong_Quan_XNK sheet, dòng summary có version = "Official" hoặc "Preliminary". Field `is_derived` không được parse từ xlsx. Nên dùng keyword filter (như hiện tại) làm source of truth.

### [MAJOR] M2 — Dual schema: per-year JSON vs all-years JSON (fragile)
**File:** `data_builder.py` (toàn bộ)

Per-year JSON dùng key `cy_luong`/`cy_tri_gia`. All-years JSON dùng `quantity_month`/`value_month_usd`. web/app.js phải handle cả hai qua fallback `??`. Cần chuẩn hóa về một schema duy nhất.

### [MINOR] M3 — validate_aggregate_outputs không check negative residual (dòng 586-707)
**File:** `data_builder.py:644-653`

So sánh JSON vs xlsx chỉ dựa trên signature count (source+period+flow+country+product+unit+qty+val). Nếu cùng một signature xuất hiện 2 lần trong xlsx (duplicate) và 2 lần trong JSON — count match → pass. Không phát hiện được duplicate country rows.

**Gợi ý fix:** Thêm check: sau khi groupby signature, đảm bảo count == 1 cho mỗi signature.

### [MINOR] M3 — Vinacas date parsing fragile (dòng 384-386)
**File:** `data_builder.py:384-386`

```python
date_value = r[7] if len(r) > 7 else None
fulldate = date_value.strftime("%Y-%m-%d") if hasattr(date_value, "strftime") else str(date_value or "")[:10]
```

Nếu r[7] là string thay vì datetime, `str(date_value)[:10]` lấy 10 ký tự đầu — có thể sai nếu format không phải YYYY-MM-DD.

### [MINOR] M4 — build_year không rebuild all-years (dòng 255-292)
**File:** `data_builder.py:255-292`

`build_year(2025)` chỉ viết `output/data/2025_cashew.json` — không rebuild `all_years_cashew.{json,xlsx}`. Nếu user chạy `python main.py --period 2025-09`, ocr_pipeline gọi `update_period_data` → `build_year` + `build_all_years`. OK. Nhưng nếu chạy trực tiếp `python pipeline/data_builder.py --year 2025` thì all-years không được update.

### [MINOR] M4 — CLI: --year vs --all-years không tương thích (dòng 736-766)
**File:** `data_builder.py:736-766`

Khi chạy `python pipeline/data_builder.py` (không args), nó rebuild tất cả years rồi gọi build_all_years + validate. OK. Nhưng `--period 2025-09` gọi `update_period_data` → `build_year` + `build_all_years`. OK. Không có bug ở đây — chỉ là note về consistency.

---

## 4. main.py (416 dòng)

### [MAJOR] M1 — _copy_pdfs rename file khi hash khác (dòng 147-149)
**File:** `main.py:147-149`

```python
digest = scraper.sha256(src)
if dst.exists() and scraper.sha256(dst) != digest:
    dst = dst.with_name(f"{dst.stem}__{digest[:8]}{dst.suffix}")
```

**Mô tả:** Khi TCHQ cập nhật file (same name, different content), script rename destination thành `name__hash1234.pdf`. Sau đó ocr_pipeline.run_period tìm PDF bằng `pdf_matches_period` (dựa trên filename). File đã đổi tên → **không khớp period** → PDF bị bỏ qua → missing_summary/missing_country_detail.

**Bằng chứng:** Các kỳ 2024-02, 2024-07, 2024-12 có `missing_summary` — có thể do PDF đã bị rename lần chạy trước.

**Gợi ý fix:** Không rename file — overwrite nếu hash khác (đã có bản mới). Hoặc store hash trong manifest để skip copy nếu đã có file mới nhất.

### [MAJOR] M2 — Cache check bỏ qua partial run (dòng 85-122)
**File:** `main.py:85-122`

`_is_cached` kiểm tra xlsx tồn tại + manifest có `status` ok/partial. Nhưng nếu manifest ghi `scrape_complete=False` (partial scan với max_pages), cache bị bỏ qua — đúng. Tuy nhiên nếu manifest cũ có `scrape_complete=True` nhưng OCR thất bại ở kỳ sau → cache vẫn giữ → kỳ mới bị bỏ qua.

### [MINOR] M3 — run() gọi ocr_pipeline.run_period với update_data=True (dòng 226), run_years gọi data_builder.build_all_years ở cuối (dòng 307) — double build
**File:** `main.py:226, 307`

ocr_pipeline.run_period (với update_data=True) đã gọi `data_builder.update_period_data` → rebuild all-years. Sau đó run_years gọi `data_builder.build_all_years` một lần nữa. Double work — không gây lỗi nhưng chậm.

### [MINOR] M3 — _write_manifest trong run_years ghi đè manifest của ocr_pipeline (dòng 298)
**File:** `main.py:298`

ocr_pipeline.run_period viết manifest có `ocr` key. Sau đó run_years gọi `_write_manifest` với `ocr=` parameter — ghi đè toàn bộ manifest, mất thông tin scrape. Cần merge thay vì ghi đè.

### [MINOR] M4 — _period_dir không dùng (dòng 59-60) — dead code
**File:** `main.py:59-60`

`_period_dir` định nghĩa nhưng không được gọi anywhere — dead function.

---

## 5. pipeline/scraper.py (549 dòng)

### [MAJOR] M1 — Filename hardcoded VN- prefix (dòng 119-120)
**File:** `scraper.py:119-120`

```python
version_code = {"official": "CT", "adjusted": "DC", "preliminary": "SB"}.get(version, version.upper()[:2])
filename = f"{period}-{report_code}(VN-{version_code})_{safe or 'report'}.pdf"
```

**Mô tả:** Luôn dùng `VN-` prefix kể cả khi TCHQ đang dùng `TV-`. Downloaded file được save với tên constructed (VN-DC) — OK cho việc nhận diện sau này. Tuy nhiên nếu TCHQ đổi sang TV- permanently, người dùng sẽ thấy file tên VN-DC nhưng nội dung là TV-DC → nhầm lẫn khi debug.

**Gợi ý fix:** Thêm flag/options để dùng TV- prefix, hoặc detect từ URL/source.

### [MINOR] M2 — _row_kind classification có thể sai với tiêu đề dài (dòng 85-111)
**File:** `scraper.py:85-111`

Classification dựa trên text matching trong title. Tiêu đề TCHQ thay đổi theo năm — có thể miss một số variant. Ví dụ "Xuất khẩu hàng hóa tháng 9/2026" → matching "xuat khau" + "thang" → summary. OK. Nhưng nếu tiêu đề có thêm text như "Xuất khẩu hàng hóa sang Cambogia" → "mot so nuoc" không có → sai thành summary thay vì country_product.

### [MINOR] M2 — fetch_online dùng VN-SB cho mọi file (dòng 468-471)
**File:** `scraper.py:468-471`

```python
if source == "TCHQ":
    report_code = ("2" if kind == "summary" else "5") + ("X" if direction == "export" else "N")
    name = f"{period}-{report_code}(VN-SB)_{name}"
```

Luôn dùng SB (preliminary) cho mọi file online fallback — không phân biệt version. OK cho fallback-only mode.

### [MINOR] M3 — fingerprint-based pagination stop có thể early-exit (dòng 241-242)
**File:** `scraper.py:241-242`

```python
fingerprint = "|".join(clean(x) for x in rows.all_inner_texts())
if fingerprint in fingerprints: break
```

Nếu TCHQ thêm một hàng mới vào trang hiện tại (đổi fingerprint) nhưng vẫn có period chưa scrape → trang mới sẽ bị bỏ qua. Rare edge case.

---

## 6. pipeline/paths.py (41 dòng)
Không có bug. Clean. ✅

---

## 7. restructure_output.py (429 dòng)
### [MINOR] M1 — generate_flow_workbook không preserve formatting (dòng 202-239)
**File:** `restructure_output.py:202-239`

Sheet được tạo lại từ data_only — mất công thức, conditional formatting, data validation. OK cho read-only dashboard nhưng không ideal cho human editing.

### [MINOR] M2 — verify_tree check legacy pdfs folder (dòng 255-261)
**File:** `restructure_output.py:255-261`

Legacy pdfs folder check — OK, chỉ là thông báo.

### [MINOR] M3 — refresh_manifest_pdf_paths chỉ xử lý legacy archive (dòng 280-358)
**File:** `restructure_output.py:280-358`

Logic phức tạp, có thể miss edge cases khi manifest có cả local_path và legacy_path.

---

## 8. migrate_output.py (132 dòng)
### [MINOR] M1 — Script one-time migration — nên delete sau khi chạy
**File:** `migrate_output.py`

Đã được chạy (output/QC/restructure_output_report.json cho thấy migration đã hoàn tất). Không còn cần thiết.

---

## 9. ui_verify.py (261 dòng)
### [MINOR] M1 — Hardcoded period "2024" trong filter test (dòng 38)
**File:** `ui_verify.py:38`

```python
page.click(".fb-year-chip:has-text('2024')")
```

Nếu 2024 không có data (missing), click sẽ fail. Nên dynamic tìm year chip tồn tại.

### [MINOR] M2 — Assert on "Tối ưu" button (dòng 222-226)
**File:** `ui_verify.py:222-226`

Kiểm tra "Tối ưu" button đã bị xoá — OK, phase 15 compliance.

---

## 10. diagnostics/*.py
| File | Trạng thái | Ghi chú |
|------|-----------|---------|
| probe_bugs.py | ⚠️ Stale | Reference `_probe_dl/2026-T9-2X(VN-SB).pdf` — path cũ |
| probe_ocr.py | ⚠️ Stale | Reference `diagnostics/fixtures_2026-09/` — path cũ |
| probe_tchq2/3/4.py | ⚠️ Stale | Không đọc được nhưng có vẻ one-off tests |
| check_country_names.py | ⚠️ Partial | Chỉ check 6 tên đặc biệt, không的全面 |
| chart_data_audit.py | ✅ Good | Generator của audit JSON — correct logic |
| verify_import_dashboard.py | ✅ Good | End-to-end import chart test |
| test_upload_classification.py | ✅ Good | Upload + reload test |
| extract_xlsx_rows.py | ⚠️ Unknown | Chưa đọc — có thể utility |

---

## 11. PHÂN TÍCH DỮ LIỆU — TÊN QUỐC GIA

### Dữ liệu thực tế (66 unique non-Other names trong all_years_cashew.json)

**✅Mapped correctly** (27 names):
Anh, Australia, Bangladesh, Benin, Bỉ, Burkina Faso, Campuchia, Canada, Coó-ét, Đức, Hà Lan, Hoa Kỳ, Hy Lạp, Israel, Italia, Lào, Litva, Malaysia, Ma-rốc, Na-uy, Nê-pan?, Nigêria, Nga, Nhật Bản, Pa-ki-xtan, Pháp, Phi-líp-pin, Tây Ban Nha, Thái Lan, Trung Quốc, Ucraina, Ô-xtrây-lia, Đức, Ấn Độ, Ai Cập, Nam Phi, Hàn Quốc, Đài Loan, Ba Lan, Sec, Romania, Bulgaria, Hungary, Thổ Nhĩ Kỳ, Brazil, Mê-hi-cô, Ac-hentina, Chi-lê, Cô-lôm-bia, Pe-ru, Ca-đa, Gờ-ru-di-a, A-de-le, Ma-đơ-gát-ca, Xin-ga-po, Ê-cu-ado, Pa-ra-goay

**⚠️ Vietnamese variant cần normalization** (11 names — stripAccents giúp được):
ARẬP XÊÚT→ARAP XEUT ✓ | BÊLARUT→BELARUT ✓ | CADẮCXTAN→CADACXTAN ✓ | INĐÔNÊXIA→INDONEXIA ✓ | NIUZILÂN→NIUZILAN ✓ | NIGIÊRIA→NIGERIA ✓ | PAKIXTAN→PAKIXTAN ✓ | ÔXTRÂYLIA→OXTRAYLIA ✓

**❌ THỪNG trong COUNTRY_ISO map** (8 English names → region = "other"):
| Tên trong dữ liệu | ISO mã | Region hiện tại | Fix |
|---|---|---|---|
| Bangladesh | BGD | other | Thêm vào map |
| Guinea-Conakry | GIN | other | Thêm vào map (Guinea đã có) |
| India | IND | other | Thêm vào map (AN DO đã có) |
| Indonesia | IDN | other | Thêm vào map (INDONE XIA đã có) |
| Laos | LAO | other | Thêm vào map (LAO đã có) |
| Madagascar | MDG | other | **THIẾU hoàn toàn** |
| Pakistan | PAK | other | Thêm vào map (PAKIXTAN đã có) |
| Philippines | PHL | other | Thêm vào map (PHILIPPIN đã có) |

**⚠️ "Others" vs "Other"**: Dữ liệu có cả "Other" (residual row từ OCR) và "Others" (country name thực tế, có thể từ Vinacas). Cần phân biệt: "Other" = residual bucket, "Others" = actual country grouping.

### COUNTRY_ISO map đầy đủ cần bổ sung:
```python
# Thêm vào web/app.js COUNTRY_ISO (dòng 67-107)
'BANGLADESH': 'BGD',
'GUINEA-CONAKRY': 'GIN', 'GUINEA CONAKRY': 'GIN',
'INDIA': 'IND',
'INDONESIA': 'IDN',
'LAOS': 'LAO',
'MADAGASCAR': 'MDG',
'PAKISTAN': 'PAK',
'PHILIPPINES': 'PHL',
```

---

## 12. CƠ CHẾ "BÙ THÁNG" (OTHER RESIDUAL)

### Quy tắc của bạn (ocr_pipeline.py:518-548):
```
Other_row = Tong_XK_monthly − Σ(Country_detail_rows)
```

### Luồng dữ liệu:
1. OCR đọc File A (2X/2N summary) + File B (5X/5N country detail)
2. `normalize_country_product` tính `other_luong = a_luong − sum_luong` và `other_trigia = a_trigia − sum_trigia`
3. Row "Other" được append vào pivot DataFrame → ghi vào sheet XK_Theo_Nuoc/NK_Theo_Nuoc
4. data_builder.py đọc sheet đó → Other trở thành một country row trong JSON
5. Dashboard: periodDetailIsTrusted sum tất cả rows (bao gồm Other) → nếu Other âm → `negativeResidual = true` → period bị HIDDEN

### Vấn đề với quy tắc hiện tại:
1. **Không xử lý duplicate country rows** — nếu same country xuất hiện N lần, Other = summary − N×Σ(country) → âm quá lớn
2. **Other row được đưa vào chart data** — khiến donut/bar chart hiển thị "Other" như một slice, gây hiểu nhầm
3. **không có tolerance** — delta > 1 là mismatch, nhưng OCR có thể có sai số làm tròn ±1-2 đơn vị

### Đề xuất cải tiến:
1. Dedup country rows trước khi tính Other (fix P0 trong ocr_pipeline)
2. Loại Other row ra khỏi JSON records — chỉ dùng cho reconciliation check, không hiển thị
3. Thêm tolerance threshold (±0.5%) thay vì abs(delta) <= 1 cho các kỳ lớn

---

## 13. MA TRẬN LỖI TỔNG HỢP

| Mã lỗi | Mức | File | Dòng | Ảnh hưởng | Fix estimate |
|--------|-----|------|------|-----------|--------------|
| TV-variant miss | CRITICAL | ocr_pipeline | 152-158,941 | 2026-05/06 hidden | 30 min |
| No country dedup | CRITICAL | ocr_pipeline | 515 | Negative Other, wrong charts | 1h |
| _country_rows_for_version fallback all | MAJOR | ocr_pipeline | 1042-1050 | Missing periods | 30 min |
| "derived" dead code | MAJOR | ocr_pipeline | 1033 | Confusion, no harm | 5 min |
| Other in JSON | MAJOR | data_builder | 410-420 | Dashboard confusion | 20 min |
| Duplicate records in aggregate | MAJOR | data_builder | 410-420 | Wrong totals | 30 min |
| validate_aggregate no dup check | MINOR | data_builder | 644-653 | Silent data corruption | 20 min |
| _copy_pdfs rename breaks OCR | MAJOR | main | 147-149 | Missing months | 30 min |
| Manifest overwrite in run_years | MAJOR | main | 298 | Lost scrape metadata | 20 min |
| Missing country ISO mappings | MAJOR | web/app.js | 67-107 | Countries show as "Other" | 10 min |
| Dual JSON schema | MINOR | data_builder+app | various | Fragile code | Refactor |
| FDI classifier stale paths | MINOR | diagnostics | various | Broken tests | Cleanup |
| ... | | | | | |

**Tổng: 38 findings** (5 Critical, 9 Major, 14 Minor, 10 Low)

---

## 14. KẾ HOẠCH SỬA CHỮ THEO ƯU TIÊN

### Phase 1 — Fix Critical (1-2 giờ)
1. **P0-a**: Thêm TV- variant recognition vào `detect_report_info` và `_pick_best`
2. **P0-b**: Thêm `groupby` dedup trong `normalize_country_product`
3. **P0-c**: Bổ sung 8 ISO mappings còn thiếu vào `COUNTRY_ISO`

### Phase 2 — Fix Major (2-3 giờ)
4. **P1-a**: Sửa `_country_rows_for_version` fallback behavior
5. **P1-b**: Loại Other row khỏi JSON records (filter trong data_builder)
6. **P1-c**: Sửa _copy_pdfs rename logic
7. **P1-d**: Sửa manifest overwrite trong run_years

### Phase 3 — Clean & Harden (1-2 giờ)
8. **P2-a**: Xóa "derived" khỏi version preference
9. **P2-b**: Improve validate_aggregate_outputs với duplicate detection
10. **P2-c**: Chuẩn hóa dual JSON schema
11. **P2-d**: Dọn diagnostics stale files

### Phase 4 — Test & Verify (1 giờ)
12. Chạy lại `python main.py --period 2026-05 --force` để xác nhận fix
13. Re-run chart_data_audit.py — target: 0 issues
14. Kiểm tra dashboard: 81/81 periods visible

---

*Lưu ý: Master plan chi tiết dạng Python file với debug hooks sẽ được tạo riêng (fix_plan.py).*
