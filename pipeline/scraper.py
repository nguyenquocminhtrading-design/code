"""Cashew trade data scraper with online/local fallback.

Usage: python code/pipeline/scraper.py --source all --period 2026-09 --mode auto
"""
from __future__ import annotations
import argparse, hashlib, json, logging, os, re, shutil, sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    requests = None
    BeautifulSoup = None
try:
    import pdfplumber
except ImportError:
    pdfplumber = None
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None
try:
    from openpyxl import Workbook
except ImportError:
    Workbook = None

ROOT = Path(__file__).resolve().parents[2]
try:
    from .paths import period_dir, period_flow_dir, period_pdf_dirs
except ImportError:
    from pipeline.paths import period_dir, period_flow_dir, period_pdf_dirs
VINACAS_URL = "https://www.vinacas.com.vn/login.htm"
TCHQ_URL = "https://www.customs.gov.vn/index.jsp?pageId=4901&group=C%C3%94NG%20B%E1%BB%90%20V%C3%80%20TH%C3%94NG%20TIN&category=S%E1%BB%91%20li%E1%BB%87u%20%C4%91%E1%BB%8Bnh%20k%E1%BB%B3"
SCHEMA = ["source","report_type","period","direction","country","product","hs_code","unit","quantity_month","value_month_usd","quantity_ytd","value_ytd_usd","average_price_usd","source_file","retrieved_at"]

def now(): return datetime.now(timezone.utc).isoformat()
def clean(s): return re.sub(r"\s+", " ", str(s or "")).strip()
def number(s):
    if s is None or clean(s) in {"", "-", "--"}: return None
    t = clean(s).replace("%", "").replace(" ", "")
    if re.fullmatch(r"[-+]?\d{1,3}(\.\d{3})+(,\d+)?", t): t=t.replace(".","").replace(",",".")
    else: t=t.replace(",","")
    try: return float(t)
    except ValueError: return None
def sha256(p):
    h=hashlib.sha256()
    with p.open("rb") as f:
        for b in iter(lambda:f.read(1024*1024),b""): h.update(b)
    return h.hexdigest()

@dataclass
class Artifact:
    source: str; path: str; mode: str; status: str; reason: str = ""

def classify_report(title: str, href: str = ""):
    text = clean(f"{title} {href}").lower()
    country = any(x in text for x in ("nước", "nuoc", "quốc gia", "quoc gia", "vùng lãnh thổ", "chia theo mặt hàng", "chia theo mat hang"))
    if "xuất khẩu hàng hóa" in text or "xuat khau hang hoa" in text:
        return "country_product" if country else "summary"
    return "unknown"

def _ascii(s):
    import unicodedata
    s = "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")
    return s.replace("đ", "d").replace("Đ", "D")

def _period_matches(value, period):
    y, m = period.split("-")
    v = _ascii(clean(value)).lower().replace(" ", "")
    return bool(re.search(rf"(?:^|[^0-9])0?{int(m)}(?:[^0-9]+){y}(?:$|[^0-9])", v))

_FDI_EXCLUDE_TERMS = (
    "fdi",
    "dau tu truc tiep nuoc ngoai",
    "doanh nghiep co von",
    "von dau tu truc tiep",
    "doanh nghiep fdi",
    "thuong mai hang hoa cua doanh nghiep",
)

def _row_kind(title, period):
    t = re.sub(r"\s+", " ", _ascii(clean(title)).lower()).strip()
    if not _period_matches(title, period): return "unknown", "unknown"
    
    # Chuẩn hóa dấu phẩy, gạch chéo, khoảng trắng để bắt trọn biến thể tiêu đề của TCHQ qua các năm
    t_clean = re.sub(r"[,/]", " ", t)
    t_clean = re.sub(r"\s+", " ", t_clean)

    # Loại bỏ triệt để các báo cáo liên quan đến FDI (3N, 3X, 4...)
    if any(k in t_clean for k in _FDI_EXCLUDE_TERMS):
        return "unknown", "unknown"

    # 1. Nhập khẩu (Import)
    if "nhap khau" in t_clean:
        if any(k in t_clean for k in ("chia theo mat hang", "mot so nuoc", "vung lanh tho", "theo mat hang")):
            return "country_product", "import"
        if "thang" in t_clean:
            return "summary", "import"

    # 2. Xuất khẩu (Export)
    if "xuat khau" in t_clean:
        if any(k in t_clean for k in ("chia theo mat hang", "mot so nuoc", "vung lanh tho", "theo mat hang")):
            return "country_product", "export"
        if "thang" in t_clean:
            return "summary", "export"

    return "unknown", "unknown"

def _download_record(page, anchor, title, period, kind, target, page_no, baseline, version="preliminary", column_name="Sơ bộ", direction="export", refresh=False):
    """Click a table anchor and normalize download/popup/direct-response cases."""
    href = anchor.get_attribute("href") or ""
    source_url = requests.compat.urljoin(page.url, href) if href else page.url
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", _ascii(title)).strip("_")[:100]
    report_code = ("2" if kind == "summary" else "5") + ("X" if direction == "export" else "N")
    version_code = {"official": "CT", "adjusted": "DC", "preliminary": "SB"}.get(version, version.upper()[:2])
    filename = f"{period}-{report_code}(VN-{version_code})_{safe or 'report'}.pdf"
    path = period_flow_dir(target, period, direction) / filename
    rec = {"title": title, "period": period, "report_type": kind, "direction": direction,
           "version": version, "column": column_name, "page": page_no,
           "source_url": source_url, "local_path": str(path)}
    logging.info("[ROW] Page %d matched %s [%s %s]: %s", page_no, kind, direction, version, title)

    # ── Fast-path cache: nếu PDF đã có và hash khớp → bỏ qua download ────────
    if not refresh and path.exists() and path.stat().st_size > 100 and path.read_bytes()[:4] == b"%PDF":
        digest = sha256(path)
        old = list(baseline.get(path.name, []))
        if digest in old or old:          # file cũ hợp lệ → skip click
            rec.update({"sha256": digest, "content_type": "application/pdf",
                        "size_bytes": path.stat().st_size,
                        "download_status": "already_exists_same_hash",
                        "status": "ok"})
            logging.info("[PDF][SKIP] Already cached (hash match): %s", path)
            return rec
    # ─────────────────────────────────────────────────────────────────────────

    temp_path = path.with_name(path.name + ".download-tmp")
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path.unlink(missing_ok=True)
    try:
        anchor.scroll_into_view_if_needed()
        with page.expect_download(timeout=12000) as dl_info:
            anchor.click()
        dl = dl_info.value
        dl.save_as(str(temp_path))
        rec["source_url"] = dl.url or source_url
        logging.info("[PDF] Downloaded: %s", temp_path)
    except Exception:
        # Some rows navigate directly or open a popup; use href only as a fallback.
        if href and href.lower().split("?")[0].endswith((".pdf", ".PDF")):
            try:
                r = requests.get(source_url, timeout=60, headers={"User-Agent": "cashew-data-pipeline/1.0"})
                r.raise_for_status()
                temp_path.write_bytes(r.content)
            except Exception as exc:
                temp_path.unlink(missing_ok=True)
                rec.update({"download_status": "download_error", "error": str(exc)})
                return rec
        else:
            temp_path.unlink(missing_ok=True)
            rec["download_status"] = "not_found"
            logging.warning("[PDF][NOT_FOUND] No downloadable URL for: %s", title)
            return rec
    if not temp_path.exists() or temp_path.stat().st_size <= 100 or temp_path.read_bytes()[:4] != b"%PDF":
        invalid_path = path.with_name(path.name + ".invalid")
        if temp_path.exists() and not invalid_path.exists():
            temp_path.replace(invalid_path)
            rec["local_path"] = str(invalid_path)
        else:
            temp_path.unlink(missing_ok=True)
        rec.update({"download_status": "invalid_download", "error": "Response is not a valid PDF"})
        logging.error("[PDF][INVALID] Not a valid PDF: %s", rec.get("local_path"))
        return rec
    digest = sha256(temp_path)
    old = list(baseline.get(path.name, []))
    if path.exists() and path.read_bytes()[:4] == b"%PDF" and sha256(path) == digest:
        temp_path.unlink(missing_ok=True)
        rec.update({"sha256": digest, "content_type": "application/pdf", "size_bytes": path.stat().st_size,
                    "download_status": "already_exists_same_hash", "status": "ok"})
        return rec
    temp_path.replace(path)
    rec.update({"sha256": digest, "content_type": "application/pdf", "size_bytes": path.stat().st_size})
    rec["download_status"] = "same_name_different_hash" if old and digest not in old else ("new" if not old else "already_exists_same_hash")
    rec["status"] = "ok"
    logging.info("[PDF][SAVED] status=%s size=%d path=%s", rec["download_status"], rec["size_bytes"], path)
    return rec


def fetch_tchq_playwright(period, target, headless=True, captcha="none", max_pages=None, refresh=False):
    if not sync_playwright: raise RuntimeError("Playwright missing; run playwright install chromium")
    target = Path(target)
    target.mkdir(parents=True, exist_ok=True)
    baseline = {}
    for flow_dir in period_pdf_dirs(target, period):
        flow_dir.mkdir(parents=True, exist_ok=True)
        for p in flow_dir.glob("*.pdf"):
            baseline.setdefault(p.name, []).append(sha256(p))
    rows_seen, downloads, fingerprints = [], [], set()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        page = browser.new_page(accept_downloads=True)
        logging.info("[SCRAPE] Launching browser and opening TCHQ")
        page.goto(TCHQ_URL, wait_until="domcontentloaded", timeout=60000)
        # Robust wait: SPA needs ~10s on cold load; retry up to 30s
        import time as _time
        deadline = _time.time() + 30
        table = None
        while _time.time() < deadline:
            tables = page.locator("table")
            for i in range(tables.count()):
                txt = _ascii(tables.nth(i).inner_text()).lower()
                if "noi dung" in txt and "so bo" in txt and "chinh thuc" in txt:
                    table = tables.nth(i); break
            if table is not None: break
            page.wait_for_timeout(1000)
        if table is None:
            raise RuntimeError("Could not find TCHQ results table after 30s wait")
        if captcha == "manual": input("Nhấn Enter sau khi bảng kết quả đã hiển thị: ")
        page_no = 1
        empty_streak = 0
        while max_pages is None or page_no <= max_pages:
            logging.info("[SCRAPE] Reading results page %d", page_no)
            table.scroll_into_view_if_needed()
            rows = table.locator("tr"); headers = [clean(x) for x in rows.nth(0).locator("th,td").all_inner_texts()]
            idx = {_ascii(h).lower().strip(): i for i, h in enumerate(headers)}
            content_i = next((i for k,i in idx.items() if "noi dung" in k), 0)
            prelim_i = next((i for k,i in idx.items() if "so bo" in k), None)
            adj_i = next((i for k,i in idx.items() if "dieu chinh" in k), None)
            official_i = next((i for k,i in idx.items() if "chinh thuc" in k), None)
            if prelim_i is None and official_i is None:
                raise RuntimeError("Could not identify Sơ bộ or Chính thức column")

            version_cols = []
            if official_i is not None: version_cols.append(("official", "Chính thức", official_i))
            if adj_i is not None: version_cols.append(("adjusted", "Điều chỉnh", adj_i))
            if prelim_i is not None: version_cols.append(("preliminary", "Sơ bộ", prelim_i))

            fingerprint = "|".join(clean(x) for x in rows.all_inner_texts())
            if fingerprint in fingerprints: break
            fingerprints.add(fingerprint)
            matching_on_page = 0
            for ri in range(1, rows.count()):
                try:
                    cells = rows.nth(ri).locator("td"); vals = cells.all_inner_texts()
                    if len(vals) <= content_i: continue
                    title = clean(vals[content_i]); kind, direction = _row_kind(title, period)
                    if kind == "unknown": continue
                    row_rec = {"title": title, "period": period, "report_type": kind, "direction": direction, "page": page_no}
                    rows_seen.append(row_rec)
                    found_any = False
                    for ver_key, ver_name, col_idx in version_cols:
                        if col_idx < cells.count():
                            anchors = cells.nth(col_idx).locator("a")
                            if anchors.count():
                                dl_rec = _download_record(page, anchors.first, title, period, kind, target, page_no, baseline, version=ver_key, column_name=ver_name, direction=direction, refresh=refresh)
                                downloads.append(dl_rec)
                                if dl_rec.get("status") == "ok":
                                    found_any = True
                            else:
                                downloads.append({**row_rec, "version": ver_key, "column": ver_name,
                                                  "download_status": "not_found", "status": "missing_link"})
                    if not found_any:
                        logging.warning("[ROW][NO_LINK] Page %d has no downloadable links: %s", page_no, title)
                        if not version_cols:
                            downloads.append({**row_rec, "column": "None", "download_status": "not_found"})
                    matching_on_page += 1
                except Exception as row_exc:
                    logging.warning("[ROW][ERROR] Page %d row %d failed: %s", page_no, ri, row_exc)
            logging.info("[SCRAPE] Page %d processed; matching rows=%d (this page=%d)", page_no, len(rows_seen), matching_on_page)
            if matching_on_page == 0:
                empty_streak += 1
                if empty_streak >= 5:
                    logging.info("[SCRAPE] 5 consecutive pages with no matches — stopping early")
                    break
            else:
                empty_streak = 0
            nxt = page.get_by_text(re.compile(r"^Trang sau\s*>|^Next", re.I))
            if not nxt.count() or not nxt.first.is_visible(): break
            nxt.first.click(); page.wait_for_timeout(1200)
            logging.debug("[SCRAPE] Navigated to next results page")
            page_no += 1
        browser.close()
    return {"rows": rows_seen, "downloads": downloads, "pages": len(fingerprints)}

def _title_period(title, period_set):
    """Extract reporting period from a row title ('tháng 09/2026' -> '2026-09'); None if not requested."""
    period = extract_reporting_period(title)
    return period if period in period_set else None


def extract_reporting_period(title):
    """Extract YYYY-MM from a TCHQ title, including dates outside a requested range."""
    t = _ascii(clean(title)).lower()
    m = re.search(r"thang\s*(\d{1,2})/(\d{4})", t)
    if not m:
        return None
    return f"{m.group(2)}-{int(m.group(1)):02d}"


def fetch_tchq_multi_period(periods, target_base, headless=True, captcha="none", max_pages=None, refresh=False):
    """Single full scan of the TCHQ list; download PDFs for every requested period.

    The list is sorted newest-first (~115 pages for 2009-now), so ONE full scan
    finds all historical months far faster than scanning per period.
    Returns {period: [download_record, ...]}.
    """
    if not sync_playwright: raise RuntimeError("Playwright missing; run playwright install chromium")
    if not periods:
        return {}
    period_set = set(periods)
    target_base.mkdir(parents=True, exist_ok=True)
    baseline = {}
    for p in periods:
        for pdir in period_pdf_dirs(target_base, p):
            pdir.mkdir(parents=True, exist_ok=True)
            if pdir.exists():
                for pdf in pdir.glob("*.pdf"):
                    baseline.setdefault(pdf.name, []).append(sha256(pdf))
    downloads_by_period = {p: [] for p in periods}
    rows_seen, fingerprints = [], set()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        page = browser.new_page(accept_downloads=True)
        logging.info("[SCRAPE] Launching browser — multi-period scan (%d periods)", len(periods))
        page.goto(TCHQ_URL, wait_until="domcontentloaded", timeout=60000)
        import time as _time
        deadline = _time.time() + 30
        table = None
        while _time.time() < deadline:
            tables = page.locator("table")
            for i in range(tables.count()):
                txt = _ascii(tables.nth(i).inner_text()).lower()
                if "noi dung" in txt and "so bo" in txt and "chinh thuc" in txt:
                    table = tables.nth(i); break
            if table is not None: break
            page.wait_for_timeout(1000)
        if table is None:
            raise RuntimeError("Could not find TCHQ results table after 30s wait")
        if captcha == "manual": input("Nhấn Enter sau khi bảng kết quả đã hiển thị: ")
        page_no = 1
        total_ok = 0
        oldest_requested = min(period_set)
        previous_page_latest = None
        page_order_descending = True
        descending_page_streak = 0
        while max_pages is None or page_no <= max_pages:
            table.scroll_into_view_if_needed()
            rows = table.locator("tr"); headers = [clean(x) for x in rows.nth(0).locator("th,td").all_inner_texts()]
            idx = {_ascii(h).lower().strip(): i for i, h in enumerate(headers)}
            content_i = next((i for k,i in idx.items() if "noi dung" in k), 0)
            prelim_i = next((i for k,i in idx.items() if "so bo" in k), None)
            adj_i = next((i for k,i in idx.items() if "dieu chinh" in k), None)
            official_i = next((i for k,i in idx.items() if "chinh thuc" in k), None)
            if prelim_i is None and official_i is None:
                raise RuntimeError("Could not identify Sơ bộ or Chính thức column")

            version_cols = []
            if official_i is not None: version_cols.append(("official", "Chính thức", official_i))
            if adj_i is not None: version_cols.append(("adjusted", "Điều chỉnh", adj_i))
            if prelim_i is not None: version_cols.append(("preliminary", "Sơ bộ", prelim_i))

            fingerprint = "|".join(clean(x) for x in rows.all_inner_texts())
            if fingerprint in fingerprints: break
            fingerprints.add(fingerprint)
            matched_on_page = 0
            observed_page_periods = []
            for ri in range(1, rows.count()):
                try:
                    cells = rows.nth(ri).locator("td"); vals = cells.all_inner_texts()
                    if len(vals) <= content_i: continue
                    title = clean(vals[content_i])
                    reported_period = extract_reporting_period(title)
                    if reported_period is None: continue
                    observed_page_periods.append(reported_period)
                    per = reported_period if reported_period in period_set else None
                    if per is None: continue
                    kind, direction = _row_kind(title, per)
                    if kind == "unknown": continue
                    row_rec = {"title": title, "period": per, "report_type": kind, "direction": direction, "page": page_no}
                    rows_seen.append(row_rec)
                    found_any = False
                    for ver_key, ver_name, col_idx in version_cols:
                        if col_idx < cells.count():
                            anchors = cells.nth(col_idx).locator("a")
                            if anchors.count():
                                rec = _download_record(page, anchors.first, title, per, kind, target_base, page_no, baseline, version=ver_key, column_name=ver_name, direction=direction, refresh=refresh)
                                downloads_by_period[per].append(rec)
                                if rec.get("status") == "ok":
                                    total_ok += 1
                                    found_any = True
                            else:
                                downloads_by_period[per].append({**row_rec, "version": ver_key, "column": ver_name,
                                    "download_status": "not_found", "status": "missing_link"})
                    if not found_any:
                        logging.warning("[ROW][NO_LINK] Page %d: %s", page_no, title)
                        if not version_cols:
                            downloads_by_period[per].append({**row_rec, "column": "None", "download_status": "not_found"})
                    matched_on_page += 1
                except Exception as row_exc:
                    logging.warning("[ROW][ERROR] Page %d row %d failed: %s", page_no, ri, row_exc)
            logging.info("[SCRAPE] Page %d processed; matched=%d total_downloaded=%d", page_no, matched_on_page, total_ok)
            if observed_page_periods:
                page_latest = max(observed_page_periods)
                if previous_page_latest is not None and page_latest > previous_page_latest:
                    page_order_descending = False
                    logging.warning("[SCRAPE] Reporting periods are not newest-first; disabling early cutoff")
                elif previous_page_latest is not None:
                    descending_page_streak += 1
                previous_page_latest = page_latest
                if page_order_descending and descending_page_streak >= 2 and page_latest < oldest_requested:
                    logging.info("[SCRAPE] Passed oldest requested period %s on page %d; stopping scan", oldest_requested, page_no)
                    break
            nxt = page.get_by_text(re.compile(r"^Trang sau\s*>|^Next", re.I))
            if not nxt.count() or not nxt.first.is_visible(): break
            try:
                nxt.first.click(timeout=8000)
            except Exception as nav_exc:
                logging.warning("[SCRAPE] Pagination failed at page %d: %s — stopping", page_no, nav_exc)
                break
            page.wait_for_timeout(1200)
            page_no += 1
        browser.close()
    logging.info("[SCRAPE] Scan complete: %d pages, %d rows matched, %d PDFs ok", len(fingerprints), len(rows_seen), total_ok)
    return downloads_by_period


def pdf_text(path):
    if not pdfplumber: raise RuntimeError("Install pdfplumber to parse PDFs")
    with pdfplumber.open(path) as pdf:
        return "\n".join((p.extract_text() or "") for p in pdf.pages)

def local_candidates(source, period):
    year, month = period.split("-"); roots=[ROOT/source]
    out=[]
    for root in roots:
        for p in root.rglob("*.pdf"):
            n=p.name.lower()
            month_tokens = (f"t{int(month)}", f"_{int(month)}_", f"{int(month)}_{year}", f"-{int(month)}-", f"-{month}-")
            if year in n and any(token in n for token in month_tokens): out.append(p)
    return sorted(out, key=lambda p:p.stat().st_mtime, reverse=True)

def fetch_online(source, period, target):
    """Best-effort discovery. Sites change their markup; local fallback remains authoritative."""
    if not requests or not BeautifulSoup: raise RuntimeError("Install requests and beautifulsoup4")
    url = VINACAS_URL if source == "Vinacas" else TCHQ_URL
    r=requests.get(url, timeout=30, headers={"User-Agent":"cashew-data-pipeline/1.0"})
    r.raise_for_status(); soup=BeautifulSoup(r.text,"html.parser")
    links=[]
    for a in soup.select("a[href]"):
        href=a.get("href",""); text=clean(a.get_text(" "))
        if ".pdf" in href.lower() and (str(period[:4]) in href or str(int(period[5:])) in href or str(int(period[5:])) in text): links.append((href,text))
    if not links: raise RuntimeError(f"No {period} PDF link discovered at {url}")
    saved=[]
    for href,text in links:
        full=requests.compat.urljoin(url,href)
        data=requests.get(full,timeout=60,headers={"User-Agent":"cashew-data-pipeline/1.0"})
        data.raise_for_status(); name=Path(requests.utils.urlparse(full).path).name or f"{source}_{period}.pdf"
        kind, direction = _row_kind(f"{text} {href}", period)
        if source == "Vinacas":
            direction = "import"
        if direction not in {"export", "import"}:
            continue
        flow_dir = period_flow_dir(target, period, direction)
        flow_dir.mkdir(parents=True, exist_ok=True)
        if source == "TCHQ":
            report_code = ("2" if kind == "summary" else "5") + ("X" if direction == "export" else "N")
            name = f"{period}-{report_code}(VN-SB)_{name}"
        p=flow_dir/name
        p.write_bytes(data.content)
        if p.stat().st_size <= 100 or p.read_bytes()[:4] != b"%PDF":
            p.unlink(missing_ok=True)
            continue
        saved.append(p)
    return saved

def parse_tchq(path, period):
    text=pdf_text(path); rows=[]; direction="export" if "XUẤT KHẨU" in text.upper() else "import"
    pat=re.compile(r"(?:^|\n)\s*(\d+)\s+(.+?)\s+(Tấn|USD)\s+([\d.,]+)?\s*([\d.,]+)?\s+[-\d.,% ]*\s*([\d.,]+)?\s*([\d.,]+)?")
    for m in pat.finditer(text):
        product=clean(m.group(2));
        if product.lower() in {"hạt điều","điều"} or "điều" in product.lower():
            rows.append({"source":"TCHQ","report_type":"monthly_trade","period":period,"direction":direction,"country":"","product":product,"hs_code":"","unit":m.group(3),"quantity_month":number(m.group(4)),"value_month_usd":number(m.group(5)),"quantity_ytd":number(m.group(6)),"value_ytd_usd":number(m.group(7)),"average_price_usd":None,"source_file":str(path),"retrieved_at":now()})
    return rows

def parse_vinacas(path, period):
    text=pdf_text(path); direction="export" if "xuất khẩu" in text.lower() else "import"; rows=[]
    for line in text.splitlines():
        s=clean(line)
        if not re.match(r"^(?:[1-9]|1[0-2])\s+",s): continue
        vals=re.findall(r"[-+]?\d[\d.,]*%?",s)
        nums=[number(x) for x in vals]
        if len(nums)>=3:
            rows.append({"source":"Vinacas","report_type":"cashew_statistics","period":period,"direction":direction,"country":"","product":"cashew","hs_code":"","unit":"Mt","quantity_month":nums[1] if len(nums)>1 else None,"value_month_usd":nums[3] if len(nums)>3 else None,"quantity_ytd":None,"value_ytd_usd":None,"average_price_usd":nums[5] if len(nums)>5 else None,"source_file":str(path),"retrieved_at":now()})
    return rows

def write_excel(rows, errors, out, artifacts):
    if not Workbook: raise RuntimeError("Install openpyxl to write Excel")
    out.mkdir(parents=True,exist_ok=True); wb=Workbook(); ws=wb.active; ws.title="Data"; ws.append(SCHEMA)
    for r in rows: ws.append([r.get(k) for k in SCHEMA])
    meta=wb.create_sheet("Metadata"); meta.append(["key","value"]); meta.append(["generated_at",now()]); meta.append(["row_count",len(rows)])
    for a in artifacts: meta.append(["artifact",json.dumps(asdict(a),ensure_ascii=False)])
    er=wb.create_sheet("Validation Errors"); er.append(["error"])
    for e in errors: er.append([e])
    # Deterministic filename makes reruns idempotent and avoids stale workbooks.
    wb.save(out/"cashew_normalized.xlsx")

def run(args):
    _SRC_MAP = {"tchq": "TCHQ", "vinacas": "Vinacas"}
    sources = ["TCHQ", "Vinacas"] if args.source == "all" else [_SRC_MAP.get(args.source.lower(), args.source.title())]
    period = args.period; artifacts = []; rows = []; errors = []
    output_root = Path(getattr(args, "output_root", None) or ROOT / "code" / "output")
    for source in sources:
        raw = output_root; files = []
        if args.mode in {"online", "auto"}:
            try: files = fetch_online(source, period, raw); artifacts += [Artifact(source, str(p), "online", "ok") for p in files]
            except Exception as e:
                logging.warning("%s online failed: %s", source, e)
                if args.mode == "online": errors.append(f"{source}: online failed: {e}")
        if not files and args.mode in {"local", "auto"}:
            files = local_candidates(source, period)
            if files: artifacts += [Artifact(source, str(p), "local", "fallback", "online unavailable") for p in files]
        if not files: errors.append(f"{source}: no PDF found for {period}"); continue
        for p in files:
            try:
                parsed = parse_tchq(p, period) if source == "TCHQ" else parse_vinacas(p, period)
                rows += parsed
                direction = (parsed[0].get("direction") if parsed else "import")
                flow_dir = period_flow_dir(output_root, period, direction)
                flow_dir.mkdir(parents=True, exist_ok=True)
                destination = flow_dir / p.name
                if p.resolve() != destination.resolve() and not destination.exists():
                    shutil.copy2(p, destination)
            except Exception as e: errors.append(f"{p}: parse failed: {e}")
    out = output_root / period[:4] / period
    write_excel(rows, errors, out, artifacts)
    manifest = {"period": period, "mode": args.mode, "generated_at": now(), "rows": len(rows), "errors": errors, "artifacts": [asdict(a) for a in artifacts]}
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    logging.info("Done: %s rows, %s errors, output=%s", len(rows), len(errors), out)
    return 0 if rows and not (args.strict and errors) else 1

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--source",choices=["tchq","vinacas","all"],default="all"); ap.add_argument("--period",required=True,help="YYYY-MM"); ap.add_argument("--mode",choices=["auto","online","local"],default="auto"); ap.add_argument("--output-root",default=None,help="Output root (default: code/output)"); ap.add_argument("--strict",action="store_true"); args=ap.parse_args()
    logging.basicConfig(level=logging.INFO,format="%(levelname)s %(message)s")
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])",args.period): ap.error("period must be YYYY-MM")
    return run(args)
if __name__=="__main__": sys.exit(main())
