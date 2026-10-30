from __future__ import annotations
import argparse, json, logging, re, unicodedata, shutil
import io, sys, os, stat
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]          # XNK/
try:
    from .paths import period_dir, period_pdf_dirs, resolve_output_root
except ImportError:  # direct execution: python pipeline/ocr_pipeline.py
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from pipeline.paths import period_dir, period_pdf_dirs, resolve_output_root
OUTPUT_DIR = resolve_output_root()
# Khi chạy standalone, pipeline tự tìm PDF trong output/<YYYY>/<period>_cashew.xlsx
DEFAULT_PDF_DIR = OUTPUT_DIR

CASHEW_KEYWORDS_ASCII = ["hat dieu", "dieu"]

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    PaddleOCR = True  # availability marker; import only when image OCR is requested
    _paddle_instance = None
    def _get_paddle():
        global _paddle_instance
        if _paddle_instance is None:
            from paddleocr import PaddleOCR as _PaddleOCR
            _paddle_instance = _PaddleOCR(lang="vi", use_textline_orientation=True)
        return _paddle_instance
except ImportError:
    PaddleOCR = None
    _get_paddle = None

try:
    import pandas as pd
except ImportError:
    pd = None

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter
    HEADER_FILL = PatternFill("solid", fgColor="1A3A5C")
    HEADER_FONT = Font(bold=True, color="FFFFFF", name="Calibri")
    ALT_FILL = PatternFill("solid", fgColor="EEF3F8")
    DERIVED_FILL = PatternFill("solid", fgColor="FFF3CD")
    DERIVED_FONT = Font(italic=True, color="856404", name="Calibri")
except ImportError:
    Workbook = None
    HEADER_FILL = HEADER_FONT = ALT_FILL = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def nfc(s):
    return unicodedata.normalize("NFC", s)

def strip_accents(s):
    nfd = unicodedata.normalize("NFD", s)
    s = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return s.replace("đ", "d").replace("Đ", "D")

def clean(s):
    return re.sub(r"\s+", " ", nfc(str(s or ""))).strip()

def clean_number(s, *, is_percent=False):
    t = clean(s).replace("%", "").replace(" ", "")
    if t in {"", "-", "--", "n/a", "na"}:
        return None

    if is_percent:
        # Percent columns use dots as decimal marks; never strip them as grouping.
        if "," in t and "." not in t:
            t = t.replace(",", ".")
        elif "," in t and "." in t:
            decimal_sep = "," if t.rfind(",") > t.rfind(".") else "."
            grouping_sep = "." if decimal_sep == "," else ","
            t = t.replace(grouping_sep, "").replace(decimal_sep, ".")
        try:
            return float(t)
        except ValueError:
            return None
    
    # Pattern 1: Full Vietnamese format with thousands separators (dots) + optional decimal comma
    # e.g., "1.234.567", "1.234.567,89", "64.888", "469.933.462"
    if re.fullmatch(r"[-+]?\d{1,3}(\.\d{3})+(,\d+)?", t):
        t = t.replace(".", "").replace(",", ".")
    
    # Pattern 2: Simple decimal with comma (no thousands separators)
    # e.g., "-1,5", "47,8", "1,9", "-2,2" → treat comma as decimal point
    elif re.fullmatch(r"[-+]?\d+,\d{1,2}", t):
        t = t.replace(",", ".")
    
    # Pattern 3: Plain integer, dot-decimal, or US-format thousands
    # e.g., "478", "47.8", "1,234" → remove any stray commas
    else:
        t = t.replace(",", "")
    
    try:
        return float(t)
    except ValueError:
        return None

_CASHEW_RE = re.compile(r"\bhat dieu\b|\bdieu\b(?!\s*(?:hoa|khien|khong khi))")

def is_cashew(product: str) -> bool:
    lp = strip_accents(clean(product).lower())
    return bool(_CASHEW_RE.search(lp))

def _table_has_data(rows, min_rows=5):
    n = sum(1 for row in rows for c in row if clean_number(c) is not None)
    return len(rows) >= min_rows and n >= 5

def _find_col(headers, *candidates):
    for i, h in enumerate(headers):
        hl = strip_accents(clean(h).lower())
        for c in candidates:
            if strip_accents(c.lower()) in hl:
                return i
    return None


# ── PDF Classification ────────────────────────────────────────────────────────

_COUNTRY_HINTS = ["nuoc", "quoc gia", "chia theo mat hang", "by country", "by_country"]
_COUNTRY_EXCLUDE = ["nuoc ngoai", "nước ngoài"]  # FDI context triggers false positive

def detect_report_info(pdf_path: Path) -> dict:
    name_ascii = strip_accents(unquote(pdf_path.name).lower())
    is_cashew_report_code = bool(re.search(r"(?:^|[-_\s])[25][xn](?:\s|[-_.(]|$)", name_ascii))

    # Bỏ qua ngay các báo cáo FDI (3N, 3X, 4...)
    if any(k in name_ascii for k in ("-3n", "_3n", "3n(", "-3x", "_3x", "3x(", "-4(", "_4(", "fdi")):
        return {"type": "unknown", "direction": "unknown", "version": "unknown"}

    first_text = ""
    if pdfplumber:
        try:
            with pdfplumber.open(pdf_path) as pdf:
                if pdf.pages:
                    first_text = strip_accents((pdf.pages[0].extract_text() or "")).lower()
        except Exception:
            pass

    if not is_cashew_report_code and any(k in first_text for k in ("fdi", "dau tu truc tiep nuoc ngoai", "doanh nghiep co von")):
        return {"type": "unknown", "direction": "unknown", "version": "unknown"}

    # Version: official | adjusted | preliminary
    # Note: TCHQ changed naming convention around 2026 from VN-* to TV-*
    version = "preliminary"
    if any(k in name_ascii for k in ("chinh thuc", "(vn-ct)", "-ct.", "_ct.", "-ct(", "(tv-ct)", "-ct.")):
        version = "official"
    elif any(k in name_ascii for k in ("dieu chinh", "(vn-dc", "-dc.", "_dc.", "-dc(", "(tv-dc", "(vn-dc)")):
        # "(vn-dc" bắt cả biến thể VN-DC2 / VN-DC3 (TCHQ tái điều chỉnh nhiều lần)
        version = "adjusted"
    elif any(k in name_ascii for k in ("so bo", "(vn-sb", "-sb.", "_sb.", "-sb(", "(tv-sb")):
        version = "preliminary"

    # Direction: export | import
    direction = "export"
    if ("nhap khau" in name_ascii or "nhap khau" in first_text or
        re.search(r"(?:^|[-_\s])(?:2n|5n)(?:\s|[-_.(]|$)", name_ascii)):
        direction = "import"
    elif ("xuat khau" in name_ascii or "xuat khau" in first_text or
          re.search(r"(?:^|[-_\s])(?:2x|5x)(?:\s|[-_.(]|$)", name_ascii)):
        direction = "export"

    # Type: summary | country_product | unknown
    rtype = "unknown"
    if re.search(r"(?:^|[-_\s])5[xn](?:\s|[-_.(]|$)", name_ascii):
        rtype = "country_product"
    elif re.search(r"(?:^|[-_\s])2[xn](?:\s|[-_.(]|$)", name_ascii):
        rtype = "summary"
    elif re.search(r"(?:xuat khau|nhap khau) hang hoa (?:sang|tu) mot so nuoc", first_text):
        rtype = "country_product"
    elif re.search(r"(?:xuat khau|nhap khau) hang hoa thang", first_text) or re.search(r"(?:xuat khau|nhap khau) hang hoa theo thang", first_text):
        rtype = "summary"
    elif "hang hoa thang" in name_ascii or "hang hoa theo thang" in name_ascii:
        rtype = "summary"
    elif not any(excl in first_text for excl in _COUNTRY_EXCLUDE):
        if any(h in first_text for h in _COUNTRY_HINTS) or any(h in name_ascii for h in _COUNTRY_HINTS):
            rtype = "country_product"

    return {"type": rtype, "direction": direction, "version": version}

def detect_report_type(pdf_path: Path) -> str:
    return detect_report_info(pdf_path)["type"]

def pdf_matches_period(pdf_path: Path, period: str) -> bool:
    year, month = period.split("-")
    name = strip_accents(pdf_path.name.lower())
    if year not in name:
        return False
    mi = int(month)
    # Match month markers (T01/T1, 01-2020), never report suffixes such as -2X/-5X.
    return bool(re.search(rf"(?:^|[-_])t0?{mi}(?:t|[-_.]|$)", name, re.I) or
                re.search(rf"(?:^|[-_])0?{mi}[-_]({year})(?:[-_.]|$)", name) or
                re.search(rf"thang0?{mi}(?:[-_.]|$)", name))


# ── OCR Extraction ────────────────────────────────────────────────────────────

def extract_table_pdfplumber(pdf_path: Path):
    if not pdfplumber:
        return None
    try:
        all_rows = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                for tbl in (page.extract_tables() or []):
                    for row in tbl:
                        all_rows.append([clean(c) for c in row])
        if _table_has_data(all_rows):
            return all_rows
        # text-based fallback
        text_rows = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                txt = page.extract_text() or ""
                for line in txt.splitlines():
                    cols = re.split(r"\s{2,}", line.strip())
                    if len(cols) >= 3:
                        text_rows.append([clean(c) for c in cols])
        return text_rows if _table_has_data(text_rows) else None
    except Exception as e:
        log.warning("pdfplumber failed %s: %s", pdf_path.name, e)
        return None

def extract_table_paddleocr(pdf_path: Path):
    if not PaddleOCR:
        raise RuntimeError("paddleocr not installed — pip install paddleocr")
    try:
        import fitz
    except ImportError:
        raise RuntimeError("PyMuPDF required — pip install pymupdf")
    ocr = _get_paddle()
    rows = []
    doc = fitz.open(str(pdf_path))
    for page_num in range(len(doc)):
        page = doc[page_num]
        pix = page.get_pixmap(dpi=200)
        img_path = pdf_path.parent / f"_tmp_ocr_{page_num}.png"
        try:
            pix.save(str(img_path))
            result = ocr.predict(str(img_path))
            if not result or not result.rec_texts:
                continue
            items = []
            for text, conf in zip(result.rec_texts, result.rec_scores or []):
                items.append({"text": clean(text), "y": 0, "x": 0, "conf": conf})
            # Use result boxes if available
            if hasattr(result, 'det_boxes') and result.det_boxes is not None:
                for i, box in enumerate(result.det_boxes):
                    if i < len(items):
                        items[i]["y"] = int(box[0][1])
                        items[i]["x"] = int(box[0][0])
            items.sort(key=lambda i: (round(i["y"] / 10), i["x"]))
            cur_y, cur_row = None, []
            for item in items:
                ry = round(item["y"] / 10)
                if cur_y is None:
                    cur_y = ry
                if ry != cur_y:
                    if cur_row:
                        rows.append(cur_row)
                    cur_row, cur_y = [], ry
                cur_row.append(item["text"])
            if cur_row:
                rows.append(cur_row)
        finally:
            if img_path.exists():
                img_path.unlink()
    doc.close()
    return rows

def extract_table(pdf_path: Path, force_engine: str = "auto"):
    """Returns (rows, engine_name). Falls back pdfplumber -> paddle -> none."""
    if force_engine not in {"auto", "pdfplumber", "paddle"}:
        raise ValueError(f"Unsupported OCR engine: {force_engine}")
    if force_engine == "pdfplumber":
        return (extract_table_pdfplumber(pdf_path) or [], "pdfplumber")
    if force_engine == "paddle":
        return (extract_table_paddleocr(pdf_path), "paddle")

    rows = extract_table_pdfplumber(pdf_path)
    if rows:
        log.info("%s: pdfplumber ok (%d rows)", pdf_path.name, len(rows))
        return (rows, "pdfplumber")

    log.info("%s: trying PaddleOCR ...", pdf_path.name)
    try:
        # Fix PaddleOCR permission issue by ensuring cache directory is writable
        import os
        import stat
        paddlex_cache = Path.home() / ".paddlex"
        if paddlex_cache.exists():
            # Fix permissions recursively
            for root, dirs, files in os.walk(paddlex_cache):
                for d in dirs:
                    os.chmod(os.path.join(root, d), stat.S_IRWXU)
                for f in files:
                    os.chmod(os.path.join(root, f), stat.S_IRUSR | stat.S_IWUSR)
        rows = extract_table_paddleocr(pdf_path)
        if _table_has_data(rows):
            log.info("%s: PaddleOCR ok (%d rows)", pdf_path.name, len(rows))
            return (rows, "paddle")
    except Exception as e:
        log.warning("%s: PaddleOCR failed: %s", pdf_path.name, e)
        log.info("%s: Falling back to no OCR", pdf_path.name)

    return ([], "none")


def _read_pdf_lines(pdf_path: Path, ocr_engine: str):
    text_lines = []
    if pdfplumber:
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    text_lines.extend((page.extract_text() or "").splitlines())
        except Exception as e:
            log.warning("pdfplumber text extraction failed %s: %s", pdf_path.name, e)
    if text_lines:
        return text_lines, "pdfplumber"

    rows, engine = extract_table(pdf_path, ocr_engine)
    lines = [" ".join(clean(cell) for cell in row if clean(cell)) for row in rows]
    return [line for line in lines if line], engine


# ── Parsers ───────────────────────────────────────────────────────────────────

def parse_summary(pdf_path: Path, period: str, ocr_engine: str = "auto"):
    """File A: monthly export summary — line-based parser matching real TCHQ layout.

    Real line format (page 0 of fixture):
      '3 Hạt điều Tấn 64.888 469.933.462 -1,5 -1,0 542.768 3.844.003.009 -2,2 1,9'
      '- Sắn Tấn 18.838 4.806.153 -58,0 -56,2 963.352 227.435.726 2,8 19,2'
      '10 Dầu mỡ động thực vật USD 97.000.618 -23,1 918.765.522 43,7'  (no YTD)
    Pattern: optional_STT + product + ĐVT + CY_L + CY_TG + [%_L %_TG] + [YTD_L YTD_TG [%_L %_TG]]
    """
    text_lines, engine = _read_pdf_lines(pdf_path, ocr_engine)

    # Regex: optional STT, product name, ĐVT, then 2-8 numbers (pairs)
    _LINE_RE = re.compile(
        r"^(?:\d+\s+)?"                            # optional STT
        r"(.+?)"                                    # product name (non-greedy)
        r"\s+(Tấn|USD|Mt|kg)\s+"                    # ĐVT
        r"([\d.,]+)"                                # CY Lượng
        r"\s+([\d.,]+)"                             # CY Trị giá
        r"\s+([-\d.,%]+)"                           # % so với tháng trước (Lượng)
        r"\s+([-\d.,%]+)"                           # % so với tháng trước (Giá)
        r"\s+([\d.,]+)"                             # YTD Lượng
        r"\s+([\d.,]+)"                             # YTD Trị giá
        r"\s+([-\d.,%]+)?"                          # optional: % so cùng kỳ (Lượng)
        r"\s+([-\d.,%]+)?"                          # optional: % so cùng kỳ (Giá)
    )
    # Also match lines WITHOUT YTD (e.g., "10 Dầu mỡ động thực vật USD ...")
    _LINE_RE_NOYTD = re.compile(
        r"^(?:\d+\s+)?"
        r"(.+?)"
        r"\s+(Tấn|USD|Mt|kg)\s+"
        r"([\d.,]+)"
        r"\s+([\d.,]+)"
        r"\s+([-\d.,%]+)"
        r"\s+([-\d.,%]+)"
        r"(?:\s+([\d.,]+)\s+([\d.,]+))?"            # optional YTD pair
    )

    results = []
    at = now_iso()
    info = detect_report_info(pdf_path)
    direction = info.get("direction", "export")
    version = info.get("version", "preliminary")

    _SKIP_SUBSTR = ("tổng trị giá", "trong đó:", "doanh nghiệp", "nước ngoài",
                    "hàng thủy sản", "hàng rau quả", "cà phê", "biểu số",
                    "cục hải quan", "bộ tài chính",
                    "so với tháng", "số trong tháng", "lượng trị giá",
                    "nhóm/mặt hàng")
    for line in text_lines:
        line = line.strip()
        if not line or len(line) < 10:
            continue
        lower = line.lower()
        if any(skip in lower for skip in _SKIP_SUBSTR):
            continue
        m = _LINE_RE.match(line) or _LINE_RE_NOYTD.match(line)
        if not m:
            continue
        product = clean(m.group(1))
        if not is_cashew(product):
            continue

        pct_prev_qty = clean_number(m.group(5), is_percent=True) if m.lastindex >= 5 and m.group(5) else None
        pct_prev_val = clean_number(m.group(6), is_percent=True) if m.lastindex >= 6 and m.group(6) else None
        qty_ytd = clean_number(m.group(7)) if m.lastindex >= 7 and m.group(7) else None
        val_ytd = clean_number(m.group(8)) if m.lastindex >= 8 and m.group(8) else None
        pct_yoy_qty = clean_number(m.group(9), is_percent=True) if m.lastindex >= 9 and m.group(9) else None
        pct_yoy_val = clean_number(m.group(10), is_percent=True) if m.lastindex >= 10 and m.group(10) else None

        results.append({
            "source": "TCHQ", "report_type": "monthly_summary",
            "period": period, "direction": direction, "version": version,
            "product": product,
            "hs_code": "",
            "unit": clean(m.group(2)),
            "quantity_month": clean_number(m.group(3)),
            "value_month_usd": clean_number(m.group(4)),
            "pct_change_prev_month_qty": pct_prev_qty,
            "pct_change_prev_month_val": pct_prev_val,
            "quantity_ytd": qty_ytd,
            "value_ytd_usd": val_ytd,
            "pct_change_yoy_qty": pct_yoy_qty,
            "pct_change_yoy_val": pct_yoy_val,
            "average_price_usd": round(clean_number(m.group(4)) / clean_number(m.group(3)), 2) if clean_number(m.group(3)) and clean_number(m.group(4)) else None,
            "is_derived": False,
            "source_note": f"TCHQ {version.title()} ({pdf_path.name})",
            "source_file": str(pdf_path),
            "retrieved_at": at,
        })
    return results, {"engine": engine, "raw_row_count": len(text_lines), "parsed_rows": len(results), "errors": []}


def parse_country_product(pdf_path: Path, period: str, ocr_engine: str = "auto"):
    """File B: country x product breakdown — line-based state machine.

    Real text layout (page 0 of fixture):
      'ACMENIA 77.042.373 715.351.613'                     <- country line (name + 2 totals, no ĐVT)
      'Túi xách, ví,vali, mũ, ô, dù USD 40.172 267.239'    <- product line (no YTD)
      'Cao su Tấn 20 47.174 528 1.230.803'                  <- product line (with YTD)
    Product line has ĐVT token (Tấn|USD|Mt|kg); country line does not.
    """
    text_lines, engine = _read_pdf_lines(pdf_path, ocr_engine)

    # Match product lines: any text + ĐVT + 2-6 numbers
    # Strict: CY columns MUST be present; YTD optional
    _PRODUCT_RE = re.compile(
        r"^(.+?)\s+(Tấn|USD|Mt|kg)\s+"
        r"([\d.,]+)\s+([\d.,]+)"        # CY Lượng, CY Trị giá (BẮT BUỘC)
        r"(?:\s+([\d.,]+)\s+([\d.,]+))?"  # optional YTD Lượng, YTD Trị giá
    )
    # Skip these exact headers / fragments
    _SKIP_EXACT = {"tháng", "năm 2026", "biểu số", "cục hải quan", "bộ tài chính",
                   "sơ bộ", "xuất khẩu nước", "vùng lãnh thổ", "mặt hàng chủ yếu",
                   "số liệu tháng báo cáo", "tháng báo cáo", "cộng dồn đến hết",
                   "lượng trị giá", "đvt", ""}
    _SKIP_STARTS = ("nước/mặt hàng",)

    results = []
    at = now_iso()
    current_country = ""

    for line in text_lines:
        line = line.strip()
        if not line or len(line) < 5:
            continue
        lower = line.lower()
        if lower in _SKIP_EXACT:
            continue
        if any(line.startswith(s) for s in _SKIP_STARTS):
            continue
        m = _PRODUCT_RE.match(line)
        if m:
            product = clean(m.group(1))
            if not is_cashew(product):
                continue
            info = detect_report_info(pdf_path)
            
            # Parse numbers
            cy_qty = clean_number(m.group(3))
            cy_val = clean_number(m.group(4))
            ytd_qty = clean_number(m.group(5)) if m.group(5) else None
            ytd_val = clean_number(m.group(6)) if m.group(6) else None
            
            # Validation: CY <= YTD (nếu có YTD)
            if ytd_qty is not None and cy_qty is not None and ytd_qty < cy_qty:
                log.warning("CY > YTD suspect line: %s (cy_qty=%s, ytd_qty=%s)", line, cy_qty, ytd_qty)
            if ytd_val is not None and cy_val is not None and ytd_val < cy_val:
                log.warning("CY_val > YTD_val suspect: cy=%s, ytd=%s", cy_val, ytd_val)

            info = detect_report_info(pdf_path)
            results.append({
                "source": "TCHQ", "report_type": "country_product",
                "period": period, "direction": info.get("direction", "export"),
                "version": info.get("version", "preliminary"),
                "country": current_country,
                "product": product,
                "unit": clean(m.group(2)),
                "quantity_month": cy_qty,
                "value_month_usd": cy_val,
                "quantity_ytd": ytd_qty,
                "value_ytd_usd": ytd_val,
                "source_file": str(pdf_path),
                "retrieved_at": at,
                # DEBUG
                "debug_source_file": pdf_path.name,
                "debug_source_type": "pdf",
                "debug_source_note": f"OCR from {pdf_path.name}",
            })
            continue
        # Potential country line: ends with exactly 2 numbers, no ĐVT
        parts = line.split()
        if len(parts) >= 3 and not re.search(r"\b(Tấn|USD|Mt|kg)\b", line):
            if re.search(r"[\d.,]+$", parts[-1]) and re.search(r"[\d.,]+$", parts[-2]):
                country_name = " ".join(parts[:-2])
                if country_name and len(country_name) > 1:
                    current_country = country_name
    # Dedup: gộp các dòng trùng (quốc gia, sản phẩm, version) -> lấy dòng đầu tiên
    seen = set()
    deduped = []
    for r in results:
        key = (r.get("country", "").upper(), r.get("product", "").upper(), r.get("version", "").lower())
        if key not in seen:
            seen.add(key)
            deduped.append(r)
    return deduped, {"engine": engine, "raw_row_count": len(text_lines), "parsed_rows": len(results), "errors": []}


# ── Normalize & Pivot ─────────────────────────────────────────────────────────

# Tên cột khớp chính xác với Power Query (File B — XK_Theo_Nuoc)
COL_VI = [
    "Quốc gia", "mặt hàng", "Đơn vị tính",
    "CY Lượng", "CY Trị giá (USD)",
    "YTD Lượng", "YTD Trị giá (USD)",
    "Phiên bản",
    # DEBUG columns
    "debug_source_file",
    "debug_source_type",
    "debug_source_note",
]

def normalize_country_product(rows, summary_rows=None, preferred_summary=None, backfill_summary=None):
    """Pivot File B rows: chỉ giữ Hạt điều.
    Hỗ trợ xử lý tách biệt từng phiên bản (SB/DC/CT) và tính 'Other' riêng:
    - Với mỗi phiên bản (official, adjusted, preliminary, derived):
      + Lọc quốc gia của đúng phiên bản đó
      + Tính Other riêng: Other = Summary[ver] - SUM(Quốc gia[ver])
      + Gắn nhãn 'Phiên bản' tương ứng
    - Trả về dict: { version_key: DataFrame }
    - backfill_summary: dùng khi preferred_summary là None (trường hợp backfill)
    """
    if pd is None:
        raise RuntimeError("pandas required — pip install pandas")
    cashew_rows = [r for r in rows if is_cashew(r.get("product", ""))]

    # Nhóm summary theo version
    summary_by_ver = {}
    for s in (summary_rows or []):
        v = s.get("version", "unknown")
        if v not in summary_by_ver:
            summary_by_ver[v] = s

    # Nếu không có summary theo version, dùng preferred/backfill làm default
    if not summary_by_ver and preferred_summary:
        v = preferred_summary.get("version", "official")
        summary_by_ver[v] = preferred_summary
    if not summary_by_ver and backfill_summary:
        v = backfill_summary.get("version", "derived")
        summary_by_ver[v] = backfill_summary

    if not cashew_rows:
        # Trả về dict rỗng hoặc dict với Other row nếu có summary
        result = {}
        for ver, s_row in summary_by_ver.items():
            ver_vn = _ver_to_vi(ver)
            other_row = pd.DataFrame([{
                "Quốc gia": "Other",
                "mặt hàng": s_row.get("product", "Hạt điều"),
                "Đơn vị tính": s_row.get("unit", "Tấn"),
                "CY Lượng": pd.array([s_row.get("quantity_month")], dtype="Int64")[0],
                "CY Trị giá (USD)": pd.array([s_row.get("value_month_usd")], dtype="Int64")[0],
                "YTD Lượng": pd.array([s_row.get("quantity_ytd")], dtype="Int64")[0],
                "YTD Trị giá (USD)": pd.array([s_row.get("value_ytd_usd")], dtype="Int64")[0],
                "Phiên bản": ver_vn,
                "debug_source_file": s_row.get("debug_source_file", ""),
                "debug_source_type": s_row.get("debug_source_type", ""),
                "debug_source_note": s_row.get("debug_source_note", ""),
            }])
            result[ver] = other_row
        return result if result else {}

    # Nhận diện các phiên bản có trong danh sách rows
    versions_present = []
    for r in cashew_rows:
        v = r.get("version") or "official"
        if v not in versions_present:
            versions_present.append(v)

    priority = ["official", "adjusted", "preliminary", "derived"]
    versions_present.sort(key=lambda x: priority.index(x) if x in priority else 99)

    result = {}
    for ver in versions_present:
        ver_rows = [r for r in cashew_rows if r.get("version") == ver]
        if not ver_rows:
            continue

        df_v = pd.DataFrame(ver_rows)
        # Chọn đúng columns từ COL_VI + debug columns (map tên tiếng Anh → tiếng Việt)
        _RENAME_MAP = {
            "country": "Quốc gia", "product": "mặt hàng", "unit": "Đơn vị tính",
            "quantity_month": "CY Lượng", "value_month_usd": "CY Trị giá (USD)",
            "quantity_ytd": "YTD Lượng", "value_ytd_usd": "YTD Trị giá (USD)",
            "debug_source_file": "debug_source_file",
            "debug_source_type": "debug_source_type",
            "debug_source_note": "debug_source_note",
        }
        cols_to_select = [c for c in _RENAME_MAP if c in df_v.columns]
        sub_pivot = df_v[cols_to_select].copy()
        sub_pivot.columns = [_RENAME_MAP[c] for c in cols_to_select]
        for num_col in ["CY Lượng", "CY Trị giá (USD)", "YTD Lượng", "YTD Trị giá (USD)"]:
            if num_col in sub_pivot.columns:
                sub_pivot[num_col] = pd.to_numeric(sub_pivot[num_col], errors="coerce").round(0).astype("Int64")
        # Đảm bảo debug columns tồn tại
        for dc in ["debug_source_file", "debug_source_type", "debug_source_note"]:
            if dc not in sub_pivot.columns:
                sub_pivot[dc] = ""

        # Dedup quốc gia trong cùng 1 phiên bản — giữ lại debug info đầu tiên của từng quốc gia
        dedup_cols = ["Quốc gia", "mặt hàng"]
        num_cols = ["CY Lượng", "CY Trị giá (USD)", "YTD Lượng", "YTD Trị giá (USD)"]
        debug_map = {}
        for _, rd in sub_pivot.iterrows():
            key = (rd["Quốc gia"], rd["mặt hàng"])
            if key not in debug_map:
                debug_map[key] = {
                    "debug_source_file": str(rd.get("debug_source_file") or ""),
                    "debug_source_type": str(rd.get("debug_source_type") or ""),
                    "debug_source_note": str(rd.get("debug_source_note") or ""),
                }
        sub_pivot = sub_pivot.groupby(dedup_cols, as_index=False)[num_cols].sum()
        for i, rd in sub_pivot.iterrows():
            dbg = debug_map.get((rd["Quốc gia"], rd["mặt hàng"]), {})
            sub_pivot.at[i, "debug_source_file"] = dbg.get("debug_source_file", "")
            sub_pivot.at[i, "debug_source_type"] = dbg.get("debug_source_type", "")
            sub_pivot.at[i, "debug_source_note"] = dbg.get("debug_source_note", "")
        sub_pivot = sub_pivot.sort_values("CY Trị giá (USD)", ascending=False, na_position="last").reset_index(drop=True)
        if "Đơn vị tính" not in sub_pivot.columns:
            sub_pivot.insert(2, "Đơn vị tính", "Tấn")

        ver_vn = _ver_to_vi(ver)

        # Tìm dòng summary khớp đúng phiên bản này để tính Other
        s_row = summary_by_ver.get(ver)

        if s_row:
            a_luong = s_row.get("quantity_month")
            a_trigia = s_row.get("value_month_usd")
            a_unit = s_row.get("unit", "Tấn")
            a_product = s_row.get("product", "Hạt điều")

            sum_luong = int(sub_pivot["CY Lượng"].sum(skipna=True, min_count=0))
            sum_trigia = int(sub_pivot["CY Trị giá (USD)"].sum(skipna=True, min_count=0))

            other_luong = (int(a_luong) - sum_luong) if a_luong is not None else None
            other_trigia = (int(a_trigia) - sum_trigia) if a_trigia is not None else None

            other_row = pd.DataFrame([{
                "Quốc gia": "Other",
                "mặt hàng": a_product,
                "Đơn vị tính": a_unit,
                "CY Lượng": pd.array([other_luong], dtype="Int64")[0],
                "CY Trị giá (USD)": pd.array([other_trigia], dtype="Int64")[0],
                "YTD Lượng": pd.NA,
                "YTD Trị giá (USD)": pd.NA,
                "Phiên bản": ver_vn,
                "debug_source_file": "BACKFILL",
                "debug_source_type": "calculated",
                "debug_source_note": f"Other = Summary(${a_trigia/1e6:.2f}M) - Countries(${sum_trigia/1e6:.2f}M)",
            }])
            for nc in ["CY Lượng", "CY Trị giá (USD)", "YTD Lượng", "YTD Trị giá (USD)"]:
                other_row[nc] = other_row[nc].astype("Int64")

            sub_pivot["Phiên bản"] = ver_vn
            sub_pivot = pd.concat([sub_pivot, other_row], ignore_index=True)
            log.info("Version %s Other row: CY_Luong=%s, CY_TriGia=%s", ver, other_luong, other_trigia)
        else:
            sub_pivot["Phiên bản"] = ver_vn

        result[ver] = sub_pivot

    return result


def _ver_to_vi(ver):
    """Convert version key to Vietnamese label."""
    return {
        "official": "Chính thức",
        "adjusted": "Điều chỉnh",
        "preliminary": "Sơ bộ",
        "derived": "Ước tính",
    }.get(ver, str(ver).title())


# ── Backfill Helper Functions ──────────────────────────────────────────────────

def get_previous_period(period: str) -> str | None:
    """Return YYYY-MM of previous month."""
    try:
        parts = period.split("-")
        y, m = int(parts[0]), int(parts[1])
        if m == 1:
            return f"{y - 1:04d}-12"
        return f"{y:04d}-{m - 1:02d}"
    except Exception:
        return None

def get_previous_year_period(period: str) -> str | None:
    """Return YYYY-MM of same month last year."""
    try:
        parts = period.split("-")
        y, m = int(parts[0]), int(parts[1])
        return f"{y - 1:04d}-{m:02d}"
    except Exception:
        return None

def _read_period_summary(root_dir: Path, period: str, direction: str) -> dict | None:
    """Read summary row for a period and direction from existing Excel output."""
    xlsx_path = period_dir(root_dir, period) / f"{period}_cashew.xlsx"
    if xlsx_path.exists():
        try:
            import openpyxl
            wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
            if "Tong_Quan_XNK" in wb.sheetnames:
                ws = wb["Tong_Quan_XNK"]
                rows = list(ws.iter_rows(values_only=True))
                if len(rows) > 1:
                    header = [str(c).strip().lower() for c in rows[0]]
                    def idx(name):
                        for i, h in enumerate(header):
                            if name in h: return i
                        return None
                    i_dir = idx("luồng") or idx("direction")
                    i_qty = idx("lượng tháng") or idx("lượng")
                    i_val = idx("trị giá tháng") or idx("trị giá")
                    i_qty_y = idx("lũy kế lượng")
                    i_val_y = idx("lũy kế trị giá")
                    for r in rows[1:]:
                        d_val = str(r[i_dir] if i_dir is not None and i_dir < len(r) else "").lower()
                        match = ("xuất" in d_val or "export" in d_val) if direction == "export" else ("nhập" in d_val or "import" in d_val)
                        if match:
                            wb.close()
                            return {
                                "quantity_month": r[i_qty] if i_qty is not None and i_qty < len(r) else None,
                                "value_month_usd": r[i_val] if i_val is not None and i_val < len(r) else None,
                                "quantity_ytd": r[i_qty_y] if i_qty_y is not None and i_qty_y < len(r) else None,
                                "value_ytd_usd": r[i_val_y] if i_val_y is not None and i_val_y < len(r) else None,
                            }
            wb.close()
        except Exception as e:
            log.warning("Could not read summary from %s: %s", xlsx_path, e)
    return None

def attempt_backfill_summary(period: str, direction: str, root_dir: Path, country_rows: list, summary_version: str = "official") -> dict | None:
    """Attempt backfill for missing monthly summary:
    - Primary: YTD Difference (YTD(T) - YTD(T-1) or Month(01) = YTD(01))
    - Fallback: YoY Proxy (Same month last year)
    
    Args:
        summary_version: version key of the summary being backfilled ('official', 'adjusted', 'preliminary')
    """
    month = period.split("-")[1]
    year = period.split("-")[0]
    
    # Lọc country_rows theo version của summary đang backfill (tránh cộng trùng 3 phiên bản)
    def _filter_by_version(rows, ver_key):
        return [r for r in rows if r.get("version_key", "").lower() == ver_key.lower()]

    ver_rows = _filter_by_version(country_rows, summary_version)

    # 1. YTD Difference
    if month == "01":
        cashew_country = [r for r in country_rows if is_cashew(r.get("product", "")) and r.get("direction") == direction]
        # Lấy YTD từ version matching summary
        ver_rows_01 = _filter_by_version(cashew_country, summary_version)
        ytd_qty = sum(r.get("quantity_ytd") or 0 for r in ver_rows_01 if r.get("quantity_ytd"))
        ytd_val = sum(r.get("value_ytd_usd") or 0 for r in ver_rows_01 if r.get("value_ytd_usd"))
        if ytd_qty > 0 and ytd_val > 0:
            debug_note = f"YTD_01 = sum(country_rows_ver={summary_version}) = {ytd_qty} tấn, ${ytd_val/1e6:.2f}M"
            log.info("[%s %s] Backfill Month 01 from YTD sum: Qty=%d, Val=%d", period, direction, ytd_qty, ytd_val)
            return {
                "period": period, "direction": direction, "product": "Hạt điều", "unit": "Tấn",
                "quantity_month": ytd_qty, "value_month_usd": ytd_val,
                "quantity_ytd": ytd_qty, "value_ytd_usd": ytd_val,
                "pct_change_prev_month_qty": None, "pct_change_prev_month_val": None,
                "is_derived": True, "version": "derived",
                "source_note": "Ước tính YTD Diff (Tháng 01 YTD)",
                "debug_source_file": "BACKFILL",
                "debug_source_type": "ytd_diff",
                "debug_source_note": debug_note,
            }

    prev_period = get_previous_period(period)
    if prev_period and prev_period.split("-")[0] == year: # cùng năm
        prev_summary = _read_period_summary(root_dir, prev_period, direction)
        if prev_summary and prev_summary.get("quantity_ytd") and prev_summary.get("value_ytd_usd"):
            prev_ytd_q = prev_summary["quantity_ytd"]
            prev_ytd_v = prev_summary["value_ytd_usd"]
            # Lọc country rows theo version của summary hiện tại
            ver_rows = _filter_by_version(country_rows, summary_version)
            curr_ytd_q = sum(r.get("quantity_ytd") or 0 for r in ver_rows if r.get("quantity_ytd"))
            curr_ytd_v = sum(r.get("value_ytd_usd") or 0 for r in ver_rows if r.get("value_ytd_usd"))
            if curr_ytd_q > prev_ytd_q and curr_ytd_v > prev_ytd_v:
                month_q = curr_ytd_q - prev_ytd_q
                month_v = curr_ytd_v - prev_ytd_v
                debug_note = f"YTD_{period}({curr_ytd_q}) - YTD_{prev_period}({prev_ytd_q}) = {month_q} tấn, ${month_v/1e6:.2f}M"
                log.info("[%s %s] Backfill YTD Diff: Qty=%d, Val=%d", period, direction, month_q, month_v)
                return {
                    "period": period, "direction": direction, "product": "Hạt điều", "unit": "Tấn",
                    "quantity_month": month_q, "value_month_usd": month_v,
                    "quantity_ytd": curr_ytd_q, "value_ytd_usd": curr_ytd_v,
                    "pct_change_prev_month_qty": None, "pct_change_prev_month_val": None,
                    "is_derived": True, "version": "derived",
                    "source_note": f"Ước tính YTD Diff ({period} - {prev_period})",
                    "debug_source_file": "BACKFILL",
                    "debug_source_type": "ytd_diff",
                    "debug_source_note": debug_note,
                }

    # 2. YoY Proxy (Fallback)
    prev_year_period = get_previous_year_period(period)
    if prev_year_period:
        prev_year_summary = _read_period_summary(root_dir, prev_year_period, direction)
        if prev_year_summary and prev_year_summary.get("quantity_month") and prev_year_summary.get("value_month_usd"):
            q_proxy = prev_year_summary["quantity_month"]
            v_proxy = prev_year_summary["value_month_usd"]
            debug_note = f"Lấy từ {prev_year_period}: {q_proxy} tấn, ${v_proxy/1e6:.2f}M"
            log.info("[%s %s] Backfill YoY Proxy from %s: Qty=%s, Val=%s", period, direction, prev_year_period, q_proxy, v_proxy)
            return {
                "period": period, "direction": direction, "product": "Hạt điều", "unit": "Tấn",
                "quantity_month": q_proxy, "value_month_usd": v_proxy,
                "quantity_ytd": None, "value_ytd_usd": None,
                "pct_change_prev_month_qty": None, "pct_change_prev_month_val": None,
                "is_derived": True, "version": "derived",
                "source_note": f"Ước tính YoY Proxy ({prev_year_period})",
                "debug_source_file": "BACKFILL",
                "debug_source_type": "yoy_proxy",
                "debug_source_note": debug_note,
            }

    return None


# ── Excel Writer ──────────────────────────────────────────────────────────────

def _style_header(ws, ncols):
    for col in range(1, ncols + 1):
        c = ws.cell(row=1, column=col)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

def _auto_width(ws):
    for col_cells in ws.columns:
        w = max((len(str(c.value or "")) for c in col_cells), default=8)
        ws.column_dimensions[get_column_letter(col_cells[0].column)].width = min(w + 4, 40)

def write_excel_output(summary_rows, export_pivot_dfs, import_pivot_dfs, period: str, out_dir, version_history=None):
    """Write the per-period master workbook.

    export_pivot_dfs / import_pivot_dfs: dict {version_key: DataFrame} — mỗi phiên bản
    (official/adjusted/preliminary/derived) được ghi vào sheet riêng:
      XK_ChinhThuc / XK_DieuChinh / XK_SoBo / XK_UocTinh (tương tự NK_*)
    Sheet Tong_Quan_XNK chứa TẤT CẢ các dòng summary của mọi phiên bản.
    """
    if Workbook is None:
        raise RuntimeError("openpyxl required — pip install openpyxl")
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    fname = out_dir / f"{period}_cashew.xlsx"

    # Đảm bảo tham số pivot là dict {version_key: DataFrame} (tương thích ngược)
    if not isinstance(export_pivot_dfs, dict):
        export_pivot_dfs = {"official": export_pivot_dfs} if export_pivot_dfs is not None else {}
    if not isinstance(import_pivot_dfs, dict):
        import_pivot_dfs = {"official": import_pivot_dfs} if import_pivot_dfs is not None else {}

    wb = Workbook()

    # ── Sheet 1: Tong_Quan_XNK ───────────────────────────────────────────────
    ws1 = wb.active
    ws1.title = "Tong_Quan_XNK"
    NCOLS1 = 13  # A..M

    # Dòng 1: Group headers
    ws1["A1"] = "STT"
    ws1["B1"] = "Kỳ"
    ws1["C1"] = "Luồng"
    ws1["D1"] = "Mặt hàng"
    ws1["E1"] = "ĐVT"
    ws1["F1"] = "Số trong tháng báo cáo"
    ws1["H1"] = "So với tháng trước (%)"
    ws1["J1"] = "Cộng dồn đến hết tháng báo cáo"
    ws1["L1"] = "Phiên bản"
    ws1["M1"] = "Ghi chú nguồn"

    # Merge group headers
    ws1.merge_cells("F1:G1")
    ws1.merge_cells("H1:I1")
    ws1.merge_cells("J1:K1")
    for single_col in ("A1:A2", "B1:B2", "C1:C2", "D1:D2", "E1:E2", "L1:L2", "M1:M2"):
        ws1.merge_cells(single_col)

    # Dòng 2: Sub-headers
    ws1["F2"] = "Lượng"
    ws1["G2"] = "Trị giá (USD)"
    ws1["H2"] = "Lượng (%)"
    ws1["I2"] = "Trị giá (%)"
    ws1["J2"] = "Lượng"
    ws1["K2"] = "Trị giá (USD)"

    center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for row in (1, 2):
        for col in range(1, NCOLS1 + 1):
            c = ws1.cell(row=row, column=col)
            c.fill = HEADER_FILL
            c.font = HEADER_FONT
            c.alignment = center
    ws1.row_dimensions[1].height = 30
    ws1.row_dimensions[2].height = 22
    ws1.freeze_panes = "A3"

    for i, r in enumerate(summary_rows, start=3):
        stt = i - 2
        is_der = bool(r.get("is_derived"))
        flow_label = "Xuất khẩu" if r.get("direction") == "export" else "Nhập khẩu"
        ver_label = r.get("version", "preliminary").title()
        if is_der:
            ver_label = "Ước tính (Fallback)"

        ws1.append([
            stt,
            r.get("period") or period,
            flow_label,
            r.get("product"),
            r.get("unit"),
            r.get("quantity_month"),
            r.get("value_month_usd"),
            r.get("pct_change_prev_month_qty"),
            r.get("pct_change_prev_month_val"),
            r.get("quantity_ytd"),
            r.get("value_ytd_usd"),
            ver_label,
            r.get("source_note") or "",
        ])

        for col in range(1, NCOLS1 + 1):
            cell = ws1.cell(row=i, column=col)
            if is_der:
                cell.fill = DERIVED_FILL
                if DERIVED_FONT: cell.font = DERIVED_FONT
            elif stt % 2 == 0:
                cell.fill = ALT_FILL

        for ci in (6, 7, 10, 11):
            cell = ws1.cell(row=i, column=ci)
            if cell.value is not None:
                cell.number_format = "#,##0"
        for ci in (8, 9):
            cell = ws1.cell(row=i, column=ci)
            if cell.value is not None:
                cell.number_format = "0.0"
    _auto_width(ws1)

    # ── Sheet 2: Can_Can_Thuong_Mai ──────────────────────────────────────────
    ws2 = wb.create_sheet("Can_Can_Thuong_Mai")
    b_cols = ["STT", "Kỳ", "Chỉ số / Luồng", "ĐVT", "Lượng tháng", "Trị giá tháng (USD)", "Lũy kế lượng", "Lũy kế trị giá (USD)", "Trạng thái cán cân"]
    ws2.append(b_cols)
    _style_header(ws2, len(b_cols))
    ws2.freeze_panes = "A2"

    _VER_PRIORITY = ("official", "adjusted", "preliminary", "derived")
    def _pick_summary(direction):
        cands = [r for r in summary_rows if r.get("direction") == direction]
        for v in _VER_PRIORITY:
            for r in cands:
                if (r.get("version") or "").lower() == v:
                    return r
        return cands[0] if cands else None

    exp_r = _pick_summary("export")
    imp_r = _pick_summary("import")

    q_exp = (exp_r.get("quantity_month") or 0) if exp_r else 0
    v_exp = (exp_r.get("value_month_usd") or 0) if exp_r else 0
    qy_exp = (exp_r.get("quantity_ytd") or 0) if exp_r else 0
    vy_exp = (exp_r.get("value_ytd_usd") or 0) if exp_r else 0

    q_imp = (imp_r.get("quantity_month") or 0) if imp_r else 0
    v_imp = (imp_r.get("value_month_usd") or 0) if imp_r else 0
    qy_imp = (imp_r.get("quantity_ytd") or 0) if imp_r else 0
    vy_imp = (imp_r.get("value_ytd_usd") or 0) if imp_r else 0

    net_val = v_exp - v_imp
    net_qty = q_exp - q_imp
    net_vy = vy_exp - vy_imp
    net_qy = qy_exp - qy_imp
    status_label = "Thặng dư (Xuất siêu)" if net_val >= 0 else "Thâm hụt (Nhập siêu)"

    ws2.append([1, period, "Xuất khẩu hạt điều", "Tấn / USD", q_exp, v_exp, qy_exp, vy_exp, "—"])
    ws2.append([2, period, "Nhập khẩu hạt điều", "Tấn / USD", q_imp, v_imp, qy_imp, vy_imp, "—"])
    ws2.append([3, period, "Cán cân thương mại ròng (Net Balance)", "Tấn / USD", net_qty, net_val, net_qy, net_vy, status_label])

    for row_idx in (2, 3, 4):
        for ci in (5, 6, 7, 8):
            cell = ws2.cell(row=row_idx, column=ci)
            if cell.value is not None:
                cell.number_format = "#,##0"
        if row_idx == 4:
            for ci in range(1, len(b_cols) + 1):
                ws2.cell(row=row_idx, column=ci).fill = DERIVED_FILL
    _auto_width(ws2)

    # ── Sheets 3+: XK theo nước — TÁCH RIÊNG TỪNG PHIÊN BẢN ─────────────────
    _VER_SHEET_SUFFIX = {
        "official": "ChinhThuc",
        "adjusted": "DieuChinh",
        "preliminary": "SoBo",
        "derived": "UocTinh",
    }

    def _write_version_sheet(prefix, ver, df):
        suffix = _VER_SHEET_SUFFIX.get(ver, str(ver).title())
        ws_v = wb.create_sheet(f"{prefix}_{suffix}")
        if df is not None and not df.empty:
            cols_v = list(df.columns)
            ws_v.append(cols_v)
            _style_header(ws_v, len(cols_v))
            ws_v.freeze_panes = "A2"
            import pandas as _pd
            for i, rd in enumerate(df.itertuples(index=False), start=2):
                row_vals = [None if (v is _pd.NA or (isinstance(v, float) and v != v)) else v for v in rd]
                ws_v.append(row_vals)
                if i % 2 == 0:
                    for col in range(1, len(cols_v) + 1):
                        ws_v.cell(row=i, column=col).fill = ALT_FILL
                for ci in [4, 5, 6, 7]:
                    cell = ws_v.cell(row=i, column=ci)
                    if cell.value is not None:
                        cell.number_format = "#,##0"
            _auto_width(ws_v)
        else:
            ws_v.append([f"Không có dữ liệu {'xuất' if prefix == 'XK' else 'nhập'} khẩu phiên bản {suffix} cho kỳ này."])
        return ws_v

    for ver in ("official", "adjusted", "preliminary", "derived"):
        if ver in export_pivot_dfs:
            _write_version_sheet("XK", ver, export_pivot_dfs.get(ver))
    if not export_pivot_dfs:
        ws3 = wb.create_sheet("XK_Theo_Nuoc")
        ws3.append(["Không có dữ liệu xuất khẩu theo nước."])

    for ver in ("official", "adjusted", "preliminary", "derived"):
        if ver in import_pivot_dfs:
            _write_version_sheet("NK", ver, import_pivot_dfs.get(ver))
    if not import_pivot_dfs:
        ws4 = wb.create_sheet("NK_Theo_Nuoc")
        ws4.append(["Chưa có dữ liệu nhập khẩu theo nước cho kỳ này."])

    # ── Sheet 5: Lich_Su_Phien_Ban ───────────────────────────────────────────
    ws5 = wb.create_sheet("Lich_Su_Phien_Ban")
    ver_cols = ["STT", "Kỳ", "Luồng", "Phiên bản", "Mặt hàng", "ĐVT", "Lượng tháng", "Trị giá (USD)", "File nguồn", "Ghi chú"]
    ws5.append(ver_cols)
    _style_header(ws5, len(ver_cols))
    ws5.freeze_panes = "A2"
    vh = version_history or summary_rows
    for idx, item in enumerate(vh, start=1):
        ws5.append([
            idx,
            item.get("period") or period,
            "Xuất khẩu" if item.get("direction") == "export" else "Nhập khẩu",
            (item.get("version") or "preliminary").title(),
            item.get("product") or "Hạt điều",
            item.get("unit") or "Tấn",
            item.get("quantity_month"),
            item.get("value_month_usd"),
            Path(item.get("source_file") or "").name,
            item.get("source_note") or "",
        ])
        if idx % 2 == 0:
            for c in range(1, len(ver_cols) + 1):
                ws5.cell(row=idx + 1, column=c).fill = ALT_FILL
        for ci in (7, 8):
            cell = ws5.cell(row=idx + 1, column=ci)
            if cell.value is not None:
                cell.number_format = "#,##0"
    _auto_width(ws5)

    # ── Sheet 6: Vinacas_Doi_Chieu ───────────────────────────────────────────
    ws6 = wb.create_sheet("Vinacas_Doi_Chieu")
    vc_cols = ["Kỳ", "Tên Nước Data gốc", "Tên quốc gia trong Report", "Region", "Mặt hàng", "ĐVT", "Lượng", "Trị giá (USD)", "Luồng (Export/Import)", "Nguồn"]
    ws6.append(vc_cols)
    _style_header(ws6, len(vc_cols))
    ws6.freeze_panes = "A2"
    vinacas_file = Path(__file__).resolve().parents[1] / "Vincass" / "Vinacas.xlsx"
    if not vinacas_file.exists():
        vinacas_file = Path("Vincass/Vinacas.xlsx")
    matched_v = []
    if vinacas_file.exists():
        try:
            import openpyxl as _op
            vwb = _op.load_workbook(str(vinacas_file), data_only=True, read_only=True)
            vws = vwb.active
            for vrow in list(vws.iter_rows(values_only=True))[1:]:
                if not vrow or len(vrow) < 8: continue
                fdate_str = str(vrow[7] or "")[:7]
                if fdate_str == period:
                    matched_v.append([
                        period, str(vrow[0] or ""), str(vrow[1] or ""), str(vrow[2] or ""),
                        str(vrow[3] or ""), str(vrow[4] or ""), vrow[5], vrow[6], str(vrow[8] or ""), "Vinacas"
                    ])
            vwb.close()
        except Exception as v_err:
            log.warning("Vinacas load error: %s", v_err)
    if matched_v:
        for v_item in matched_v:
            ws6.append(v_item)
    else:
        ws6.append([period, "Chưa có dữ liệu Vinacas đối chiếu cho kỳ này", "", "", "", "", None, None, "", "Vinacas"])
    _auto_width(ws6)

    # ── Meta sheet ───────────────────────────────────────────────────────────
    ws_meta = wb.create_sheet("_Meta")
    ws_meta.append(["Key", "Value"])
    total_export_rows = sum(len(df) for df in export_pivot_dfs.values() if df is not None and not df.empty)
    total_import_rows = sum(len(df) for df in import_pivot_dfs.values() if df is not None and not df.empty)
    for kv in [
        ("period", period), ("generated_at", now_iso()),
        ("summary_rows", len(summary_rows)),
        ("summary_versions", ", ".join(sorted({(r.get("version") or "") for r in summary_rows}))),
        ("export_pivot_rows", total_export_rows),
        ("import_pivot_rows", total_import_rows),
        ("export_versions", ", ".join(sorted(export_pivot_dfs.keys()))),
        ("import_versions", ", ".join(sorted(import_pivot_dfs.keys()))),
        ("source", "TCHQ & Vinacas"),
    ]:
        ws_meta.append(list(kv))

    wb.save(fname)
    log.info("Saved multi-version Excel (%d summary rows, %d export version sheets, %d import version sheets): %s",
             len(summary_rows), len(export_pivot_dfs), len(import_pivot_dfs), fname)
    return fname


def _copy_pdfs_to_flow_folders(period: str, pdf_paths: list, out_dir: Path):
    """Copy PDFs to Xuat_Khau/ and Nhap_Khau/ folders (no Excel creation)."""
    for direction in ("export", "import"):
        folder_name = "Xuat_Khau" if direction == "export" else "Nhap_Khau"
        target_dir = Path(out_dir) / folder_name
        target_dir.mkdir(parents=True, exist_ok=True)

        summary_code = "2x" if direction == "export" else "2n"
        country_code = "5x" if direction == "export" else "5n"
        all_pdfs = [Path(p) for p in pdf_paths]

        def _pick_best(code):
            matched = []
            for p in all_pdfs:
                nm = p.name.lower()
                if f"-{code}" in nm or f"_{code}" in nm or f"{code}(" in nm or f"{code}-" in nm or f"t{code}" in nm:
                    matched.append(p)
                elif code.startswith("2") and f"{direction}_summary" in nm:
                    matched.append(p)
                elif code.startswith("5") and f"{direction}_country" in nm:
                    matched.append(p)
            if not matched:
                return None
            for tag in ["(vn-ct)", "vn-ct", "-ct", "chinh_thuc", "(tv-ct)", "tv-ct",
                        "(vn-dc)", "vn-dc", "-dc", "(tv-dc)", "tv-dc",
                        "(vn-sb)", "vn-sb", "-sb", "(tv-sb)", "tv-sb"]:
                for m in matched:
                    if tag in m.name.lower():
                        return m
            return matched[0]

        best_s = _pick_best(summary_code)
        best_c = _pick_best(country_code)

        for pdf_file in (best_s, best_c):
            if pdf_file and pdf_file.exists():
                dst = target_dir / pdf_file.name
                if dst.resolve() != pdf_file.resolve() and not dst.exists():
                    try:
                        shutil.copy2(pdf_file, dst)
                        log.info("Copied %s to %s", pdf_file.name, target_dir)
                    except Exception as c_err:
                        log.warning("Copy PDF error: %s", c_err)


# ── Main Pipeline ─────────────────────────────────────────────────────────────

def run_period(period: str, pdf_dir=None, ocr_engine: str = "auto", output_root=None,
               update_data: bool = True) -> dict:
    log.info("=== Processing %s ===", period)
    year = period.split("-")[0]
    root_dir = resolve_output_root(output_root)

    # Collect PDF candidates
    candidates: list[Path] = []

    if pdf_dir is not None:
        search_dir = Path(pdf_dir)
        if search_dir.exists():
            month_dir = period_dir(root_dir, period)
            scoped_dirs = {month_dir, *period_pdf_dirs(root_dir, period)}
            if any(search_dir.resolve() == p.resolve() for p in scoped_dirs):
                candidates = list(search_dir.rglob("*.pdf"))
            else:
                candidates = [p for p in search_dir.rglob("*.pdf") if pdf_matches_period(p, period)]

    flow_dirs = period_pdf_dirs(root_dir, period)
    for flow_dir in flow_dirs:
        if flow_dir.exists():
            extra = [p for p in flow_dir.rglob("*.pdf") if p not in candidates and pdf_matches_period(p, period)]
            if extra:
                log.info("Found %d PDF(s) in flow folder: %s", len(extra), flow_dir)
                candidates.extend(extra)

    pdfs = candidates
    if not pdfs:
        log.warning("No PDFs found for %s (checked: %s and %s)",
                    period, pdf_dir or "<none>", ", ".join(map(str, flow_dirs)))
        return {"period": period, "status": "no_files", "summary_rows": 0, "pivot_rows": 0}

    unique = {}
    for pdf in candidates:
        try:
            from pipeline.scraper import sha256 as _sha256
            info = detect_report_info(pdf)
            unique.setdefault((_sha256(pdf), info.get("type"), info.get("direction"), info.get("version")), pdf)
        except Exception:
            unique.setdefault(str(pdf.resolve()).lower(), pdf)
    pdfs = list(unique.values())

    summary_rows, country_rows, artifacts = [], [], []
    parse_errors = []
    for pdf in pdfs:
        rtype, direction, ver = "unknown", "unknown", "unknown"
        try:
            info = detect_report_info(pdf)
            rtype = info["type"]
            direction = info["direction"]
            ver = info["version"]
            log.info("  %s -> %s [%s %s]", pdf.name, rtype, direction, ver)
            if rtype == "summary":
                rows, meta = parse_summary(pdf, period, ocr_engine)
                summary_rows.extend(rows)
                if not rows:
                    error = "no cashew summary rows parsed"
                    meta.setdefault("errors", []).append(error)
                    parse_errors.append({"file": pdf.name, "error": error})
                    log.warning("%s: %s", pdf.name, error)
                artifacts.append({"file": pdf.name, "type": "summary", "direction": direction, "version": ver, **meta})
            elif rtype == "country_product":
                rows, meta = parse_country_product(pdf, period, ocr_engine)
                country_rows.extend(rows)
                if not rows:
                    error = "no cashew country/product rows parsed"
                    meta.setdefault("errors", []).append(error)
                    parse_errors.append({"file": pdf.name, "error": error})
                    log.warning("%s: %s", pdf.name, error)
                artifacts.append({"file": pdf.name, "type": "country_product", "direction": direction, "version": ver, **meta})
            else:
                log.warning("  Unknown report type: %s", pdf.name)
                artifacts.append({"file": pdf.name, "type": "unknown"})
        except Exception as e:
            error = f"{type(e).__name__}: {e}"
            log.exception("Failed parsing %s for %s", pdf.name, period)
            parse_errors.append({"file": pdf.name, "error": error})
            artifacts.append({
                "file": pdf.name, "type": rtype, "direction": direction,
                "version": ver, "engine": ocr_engine, "parsed_rows": 0,
                "errors": [error],
            })

    # Separate by direction
    export_summary = [r for r in summary_rows if r.get("direction") == "export"]
    import_summary = [r for r in summary_rows if r.get("direction") == "import"]
    export_country = [r for r in country_rows if r.get("direction") == "export"]
    import_country = [r for r in country_rows if r.get("direction") == "import"]

    def _best_summary_row(rows_list):
        if not rows_list:
            return None
        for version in ("official", "adjusted", "preliminary", "derived"):
            for row in rows_list:
                if row.get("version") == version:
                    return row
        return rows_list[0]

    best_export_s = _best_summary_row(export_summary)
    best_import_s = _best_summary_row(import_summary)

    # Backfill missing summary if needed (YTD Diff primary, YoY Proxy fallback)
    if not export_summary:
        # Dùng version của best summary để backfill đúng phiên bản
        backfilled_exp = attempt_backfill_summary(period, "export", root_dir, export_country, 
                                                  best_export_s.get("version", "official") if best_export_s else "official")
        if backfilled_exp:
            export_summary.append(backfilled_exp)
            summary_rows.append(backfilled_exp)

    if not import_summary:
        backfilled_imp = attempt_backfill_summary(period, "import", root_dir, import_country,
                                                  best_import_s.get("version", "official") if best_import_s else "official")
        if backfilled_imp:
            import_summary.append(backfilled_imp)
            summary_rows.append(backfilled_imp)

    # Giữ TẤT CẢ summary rows (không chỉ best)
    all_export_summaries = export_summary
    all_import_summaries = import_summary

    # Best summary vẫn giữ để dùng cho flow folder
    best_export_s = _best_summary_row(all_export_summaries)
    best_import_s = _best_summary_row(all_import_summaries)

    # Multi-version normalization: trả về dict {version: DataFrame}
    export_pivot_dfs = normalize_country_product(export_country, all_export_summaries)
    import_pivot_dfs = normalize_country_product(import_country, all_import_summaries) if import_country else {}

    version_history = list(summary_rows)

    consolidated_summary = all_export_summaries + all_import_summaries
    # Sắp xếp: official trước, rồi adjusted, preliminary, derived — tách theo luồng
    _VER_PRIORITY = ("official", "adjusted", "preliminary", "derived")
    consolidated_summary.sort(key=lambda r: (
        0 if r.get("direction") == "export" else 1,
        _VER_PRIORITY.index((r.get("version") or "").lower()) if (r.get("version") or "").lower() in _VER_PRIORITY else 99,
    ))

    out_dir = period_dir(root_dir, period)
    xlsx_path = write_excel_output(consolidated_summary, export_pivot_dfs, import_pivot_dfs, period, out_dir,
                                   version_history=version_history)

    # ── Copy PDFs to Xuat_Khau/ and Nhap_Khau/ folders (no Excel) ───────────────
    _copy_pdfs_to_flow_folders(period, pdfs, out_dir)

    status = "ok"
    validation_errors = []
    if not export_summary and not import_summary:
        validation_errors.append("missing cashew summary row")
    if not export_country and not import_country:
        validation_errors.append("missing cashew country/product rows")
    if validation_errors:
        status = "partial"
    if parse_errors:
        status = "partial"
        validation_errors.extend(
            f"failed to parse {error['file']}: {error['error']}" for error in parse_errors
        )

    export_total = sum(len(df) for df in export_pivot_dfs.values() if df is not None and not df.empty)
    import_total = sum(len(df) for df in import_pivot_dfs.values() if df is not None and not df.empty)
    manifest = {
        "period": period, "status": status,
        "generated_at": now_iso(),
        "summary_rows": len(consolidated_summary),
        "summary_records": summary_rows,
        "export_pivot_rows": export_total,
        "import_pivot_rows": import_total,
        "pivot_rows": export_total + import_total,
        "export_versions": sorted(export_pivot_dfs.keys()),
        "import_versions": sorted(import_pivot_dfs.keys()),
        "output_excel": str(xlsx_path),
        "artifacts": artifacts,
        "parse_errors": parse_errors,
        "validation_errors": validation_errors,
    }
    manifest_path = out_dir / f"{period}_manifest.json"
    previous_manifest = {}
    if manifest_path.is_file():
        try:
            previous_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception:
            previous_manifest = {}
    if previous_manifest.get("download_validation") is not None or previous_manifest.get("scrape_complete") is not None:
        previous_manifest["ocr"] = manifest
        previous_manifest["ocr_updated_at"] = manifest["generated_at"]
        manifest_to_write = previous_manifest
    else:
        manifest_to_write = manifest
    temp_manifest = manifest_path.with_name(manifest_path.name + ".tmp")
    temp_manifest.write_text(json.dumps(manifest_to_write, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_manifest.replace(manifest_path)
    log.info("Done %s: %d summary rows, %d export pivot rows (%d versions), %d import pivot rows (%d versions)",
             period, len(consolidated_summary), export_total, len(export_pivot_dfs),
             import_total, len(import_pivot_dfs))
    # ── Trigger data_builder để update JSON database layer ───────────────────
    if update_data:
        try:
            try:
                from . import data_builder
            except ImportError:
                sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
                from pipeline import data_builder
            data_builder.update_period_data(period, output_root=root_dir)
        except Exception as _db_err:
            log.warning("data_builder update skipped: %s", _db_err)

    return manifest


def iter_periods(pfrom: str, pto: str):
    y0, m0 = (int(x) for x in pfrom.split("-"))
    y1, m1 = (int(x) for x in pto.split("-"))
    y, m = y0, m0
    while (y, m) <= (y1, m1):
        yield f"{y:04d}-{m:02d}"
        m += 1
        if m > 12:
            m, y = 1, y + 1


def main():
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "buffer"):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(
        description="XNK Cashew OCR Pipeline — standalone mode",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Ví dụ:
  python pipeline/ocr_pipeline.py --period 2025-09
  python pipeline/ocr_pipeline.py --period-from 2025-01 --period-to 2025-09
  python pipeline/ocr_pipeline.py --period-auto
  python pipeline/ocr_pipeline.py          (interactive)""",
    )
    ap.add_argument("--period",      help="Kỳ đơn lẻ YYYY-MM")
    ap.add_argument("--period-from", help="Kỳ bắt đầu YYYY-MM")
    ap.add_argument("--period-to",   help="Kỳ kết thúc YYYY-MM")
    ap.add_argument("--period-auto", action="store_true",
                    help="Tự động dùng kỳ của tháng trước")
    ap.add_argument("--pdf-dir",     default=None,
                    help="Thư mục dữ liệu kỳ (mặc định: tự tìm trong Xuat_Khau/Nhap_Khau)")
    ap.add_argument("--output-root", default=None, help="Output root (default: code/output)")
    ap.add_argument("--ocr-engine",
                    choices=["auto", "pdfplumber", "paddle"], default="auto")
    ap.add_argument("--force", action="store_true",
                    help="Chạy lại dù output đã tồn tại")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.period_from or args.period_to:
        if not (args.period_from and args.period_to):
            ap.error("--period-from and --period-to must be used together")
        for value in (args.period_from, args.period_to):
            if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value):
                ap.error(f"Invalid period {value!r}; expected YYYY-MM")
        if args.period and (args.period_from or args.period_to):
            ap.error("--period cannot be combined with --period-from/--period-to")
        if args.period_auto:
            ap.error("--period-auto cannot be combined with an explicit period")
        if args.period_from > args.period_to:
            ap.error("--period-from must be earlier than or equal to --period-to")
    if args.period:
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", args.period):
            ap.error(f"Invalid period {args.period!r}; expected YYYY-MM")
        if args.period_auto:
            ap.error("--period cannot be combined with --period-auto")

    # Xác định pdf_dir (None = tự tìm trong output/)
    pdf_dir = Path(args.pdf_dir) if args.pdf_dir else None

    # Xác định danh sách periods
    periods: list[str] = []
    if args.period:
        periods = [args.period]
    elif args.period_from and args.period_to:
        periods = list(iter_periods(args.period_from, args.period_to))
    elif args.period_auto:
        from datetime import date
        today = date.today()
        m = today.month - 1 if today.month > 1 else 12
        y = today.year if today.month > 1 else today.year - 1
        periods = [f"{y}-{m:02d}"]
        log.info("--period-auto: xử lý kỳ %s", periods[0])
    else:
        # Interactive fallback — không cần args
        print()
        print("=" * 52)
        print("  XNK Cashew OCR Pipeline — Standalone")
        print("=" * 52)
        print("  PDF sẽ được tìm tự động trong output/<YYYY>/<period>/Xuat_Khau và Nhap_Khau")
        print()
        raw = input("  Nhập kỳ (YYYY-MM) hoặc năm (YYYY): ").strip()
        if re.fullmatch(r"\d{4}", raw):
            periods = [f"{raw}-{m:02d}" for m in range(1, 13)]
            log.info("Xử lý cả năm %s: %d kỳ", raw, len(periods))
        elif re.fullmatch(r"\d{4}-\d{2}", raw):
            periods = [raw]
        else:
            print(f"  ⚠ Định dạng không hợp lệ: {raw!r}. Dùng YYYY-MM hoặc YYYY.")
            return 1

    batch_failed = False
    for period in periods:
        try:
            result = run_period(period, pdf_dir, args.ocr_engine, args.output_root)
            if result.get("status") != "ok":
                batch_failed = True
                log.error("Period %s completed with status %s", period, result.get("status"))
        except Exception:
            batch_failed = True
            log.exception("Period %s failed; continuing with the next period", period)
    return 1 if batch_failed else 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
