"""End-to-end TCHQ scraper -> OCR -> Excel entry point.

Modes:
  python main.py                                   # Interactive: nhập năm bắt đầu / kết thúc
  python main.py --from-year 2020 --to-year 2025   # Range liên tục (1 lượt quét)
  python main.py --years 2020,2022-2025            # Năm chọn riêng / dải năm
  python main.py --period 2026-09                  # 1 kỳ đơn lẻ
  python main.py --period 2026-09 --fixture        # Dùng PDF có sẵn trong TCHQ/Export/<period>/
"""
from __future__ import annotations
import argparse, io, json, logging, re, shutil, sys
from datetime import datetime
from pathlib import Path
from pipeline import scraper, ocr_pipeline, data_builder
from pipeline.paths import period_dir, period_pdf_dirs, period_flow_dir, resolve_output_root

# Windows console (cp1252) cannot print Vietnamese — force UTF-8 with replacement
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
TCHQ_EXPORT = ROOT / "TCHQ" / "Export"
OUTPUT_DIR = resolve_output_root()
log = logging.getLogger("xnk.main")


def _scan_existing_pdfs(raw_dir: Path) -> list:
    """Return valid PDFs already in raw_dir — fallback when scraping fails."""
    out = []
    if not raw_dir.exists():
        return out
    for p in raw_dir.rglob("*.pdf"):
        try:
            if p.stat().st_size < 100:
                continue
            if p.read_bytes()[:4] == b"%PDF":
                out.append({"path": str(p), "local_path": str(p), "mode": "local", "status": "ok",
                            "report_type": "unknown", "sha256": scraper.sha256(p),
                            "size_bytes": p.stat().st_size, "content_type": "application/pdf"})
        except OSError:
            continue
    return out


def _scan_period_pdfs(period: str) -> list:
    """Read valid TCHQ PDFs from the canonical export/import flow folders."""
    found = []
    for direction, folder in zip(("export", "import"), period_pdf_dirs(OUTPUT_DIR, period)):
        for item in _scan_existing_pdfs(folder):
            item["direction"] = direction
            code = re.search(r"(?:^|[-_\s])([25])([XN])(?:\s|\(|[-_.]|$)", Path(item["path"]).name.replace("%20", " "), re.I)
            item["report_type"] = ("summary" if code.group(1) == "2" else "country_product") if code else "unknown"
            found.append(item)
    return found


def _period_dir(period: str) -> Path:
    return period_dir(OUTPUT_DIR, period)


def purge_fdi_pdfs(root_dir: Path, period: str | None = None) -> list[Path]:
    """Remove any FDI PDFs (3N, 3X, 4) or redundant FDI files from output directories."""
    removed = []
    patterns = ["*3N*", "*3n*", "*3X*", "*3x*", "*4(*", "*-4.*", "*_4.*", "*fdi*", "*FDI*"]
    if period:
        target_dirs = [root_dir / period[:4] / period / "Xuat_Khau", root_dir / period[:4] / period / "Nhap_Khau"]
    else:
        target_dirs = list(root_dir.glob("????/????-??/Xuat_Khau")) + list(root_dir.glob("????/????-??/Nhap_Khau"))
    for d in target_dirs:
        if not d.is_dir(): continue
        for pat in patterns:
            for f in d.glob(pat):
                if f.is_file() and f.suffix.lower() == ".pdf":
                    try:
                        f.unlink()
                        removed.append(f)
                        log.info("[PURGE] Deleted FDI file: %s", f)
                    except Exception as e:
                        log.warning("[PURGE] Failed to delete %s: %s", f, e)
    return removed


def _is_cached(period: str) -> bool:
    """True nếu cả Excel output và ít nhất 1 PDF đã có sẵn, và có đủ cả 2 folder Xuat_Khau / Nhap_Khau.

    Điều kiện skip toàn bộ pipeline:
    - File Excel output/YYYY/YYYY-MM/YYYY-MM_cashew.xlsx đã tồn tại và > 1000 bytes
    - Thư mục Xuat_Khau và Nhap_Khau đều đã được tạo và chứa file Excel
    - Manifest ghi nhận OCR thành công
    """
    year = period.split("-")[0]
    xlsx_options = [OUTPUT_DIR / year / period / f"{period}_cashew.xlsx",
                    OUTPUT_DIR / year / f"{period}_cashew.xlsx"]
    xlsx = next((p for p in xlsx_options if p.is_file() and p.stat().st_size > 1000), None)
    manifest_options = [OUTPUT_DIR / year / period / f"{period}_manifest.json",
                        OUTPUT_DIR / year / f"{period}_manifest.json"]
    manifest = next((p for p in manifest_options if p.is_file()), None)
    if xlsx is None or manifest is None:
        return False
    try:
        check = json.loads(manifest.read_text(encoding="utf-8"))
        # Explicit partial scans must be retried. Legacy/standalone OCR manifests
        # without this field remain cacheable when OCR and canonical PDFs validate.
        if check.get("scrape_complete") is False:
            return False
        ocr = check.get("ocr", check)
        p_count = ocr.get("pivot_rows", 0) or (ocr.get("export_pivot_rows", 0) + ocr.get("import_pivot_rows", 0))
        if ocr.get("status") not in ("ok", "partial") or (not ocr.get("summary_rows", 0) and not p_count):
            return False
    except Exception:
        return False

    # Smart check: Phải có đủ cả folder Xuat_Khau và Nhap_Khau (mỗi folder có file Excel)
    xk_dir = OUTPUT_DIR / year / period / "Xuat_Khau"
    nk_dir = OUTPUT_DIR / year / period / "Nhap_Khau"
    if not (xk_dir.exists() and any(xk_dir.glob("*.xlsx"))) or not (nk_dir.exists() and any(nk_dir.glob("*.xlsx"))):
        return False

    valid_pdfs = _scan_period_pdfs(period)
    return len(valid_pdfs) >= 1


def _copy_pdfs(period: str, records: list) -> int:
    """Place valid PDFs in their export/import flow folder, preserving the name."""
    n = 0
    for rec in records:
        src = Path(rec.get("local_path") or rec.get("path") or "")
        if src.is_file():
            direction = rec.get("direction")
            if direction not in {"export", "import"}:
                code = re.search(r"(?:^|[-_\s])([25])([XN])(?:\s|\(|[-_.]|$)", src.name.replace("%20", " "), re.I)
                direction = ("export" if code.group(2).upper() == "X" else "import") if code else None
            if direction not in {"export", "import"}:
                continue
            out_dir = period_flow_dir(OUTPUT_DIR, period, direction)
            out_dir.mkdir(parents=True, exist_ok=True)
            dst = out_dir / src.name
            if src.resolve() == dst.resolve():
                rec["local_path"] = str(dst)
                rec.setdefault("sha256", scraper.sha256(dst))
                rec.setdefault("size_bytes", dst.stat().st_size)
                rec.setdefault("content_type", "application/pdf")
                n += 1
                continue
            digest = scraper.sha256(src)
            if dst.exists() and scraper.sha256(dst) != digest:
                dst = dst.with_name(f"{dst.stem}__{digest[:8]}{dst.suffix}")
            if not dst.exists():
                shutil.copy2(src, dst)
            rec["local_path"] = str(dst)
            rec["sha256"] = digest
            rec["size_bytes"] = dst.stat().st_size
            rec["content_type"] = "application/pdf"
            n += 1
    return n


def _write_manifest(period, source, captcha, artifacts, errors, ocr, scrape_complete=False):
    year = period.split("-")[0]
    manifest_path = _period_dir(period) / f"{period}_manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps({
        "period": period, "source": source, "captcha": captcha,
        "scrape": {"rows": len(artifacts)},
        "scrape_complete": bool(scrape_complete),
        "download_validation": artifacts, "errors": errors, "ocr": ocr,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest_path


def run(period, source="tchq", captcha="none", headless=True, fixture=False,
        ocr_engine="auto", max_pages=None, force=False, clean=False):
    """Single-period mode: scrape -> OCR -> Excel for one YYYY-MM."""
    if force or clean:
        purged = purge_fdi_pdfs(OUTPUT_DIR, period=period)
        if purged:
            log.info("[PURGE] Dọn dẹp %d file FDI cho %s", len(purged), period)

    # ── Cache check ———————————————————————————————————————
    if not force and not clean and not fixture and _is_cached(period):
        year = period.split("-")[0]
        xlsx = OUTPUT_DIR / year / f"{period}_cashew.xlsx"
        log.info("[CACHE] %s: Excel + PDF đã có sẵn → bỏ qua pipeline. Dùng --force để chạy lại.", period)
        log.info("[CACHE] Output hiện tại: %s", xlsx)
        return 0
    # ───────────────────────────────────────────────
    log.info("[START] period=%s source=%s captcha=%s headless=%s fixture=%s max_pages=%s",
             period, source, captcha, headless, fixture, max_pages or "ALL")
    raw = period_dir(OUTPUT_DIR, period)
    raw.mkdir(parents=True, exist_ok=True)
    artifacts, errors = [], []
    scrape_complete = False
    if fixture:
        log.info("[SCRAPE] Fixture mode; searching local TCHQ PDFs")
        files = scraper.local_candidates("TCHQ", period)
        if not files:
            files = [Path(r["path"]) for r in (_scan_existing_pdfs(TCHQ_EXPORT / period) or
                                                   _scan_period_pdfs(period))]
        artifacts = [{"path": str(p), "mode": "local", "status": "ok", "report_type": scraper.classify_report(p.name)} for p in files]
        log.info("[SCRAPE] Local fixture candidates found: %d", len(artifacts))
    else:
        try:
            result = scraper.fetch_tchq_playwright(period, OUTPUT_DIR, headless=headless, captcha=captcha, max_pages=max_pages, refresh=force)
            artifacts = result["downloads"]
            scrape_complete = max_pages is None
            log.info("[SCRAPE] Completed: pages=%s rows=%d downloads=%d", result.get("pages", "?"), len(result.get("rows", [])), len(artifacts))
        except Exception as exc:
            log.exception("[SCRAPE][ERROR] Scraping failed")
            errors.append(f"scrape failed: {exc}")
    if not artifacts:
        existing = _scan_period_pdfs(period)
        if existing:
            log.info("[SCRAPE] Reconciled %d existing PDF(s) from raw dir", len(existing))
            artifacts = existing
    if not artifacts:
        log.error("[DOWNLOAD][ERROR] No TCHQ PDF artifacts found")
        errors.append("no TCHQ PDF artifacts found")
    valid = [x for x in artifacts if x.get("status") == "ok"]
    n_copied = _copy_pdfs(period, valid)
    if n_copied:
        log.info("[OUTPUT] Reconciled %d PDF(s) into flow folders for %s", n_copied, period)
    if valid:
        log.info("[OCR] Starting OCR pipeline with engine=%s for %d valid files", ocr_engine, len(valid))
        ocr = ocr_pipeline.run_period(period, raw, ocr_engine, OUTPUT_DIR)
        log.info("[OCR] Completed: status=%s summary_rows=%s export_pivots=%s import_pivots=%s",
                 ocr.get("status"), ocr.get("summary_rows", 0), ocr.get("export_pivot_rows", 0), ocr.get("import_pivot_rows", 0))
    else:
        log.warning("[OCR] Skipped because no valid PDF files were downloaded")
        ocr = {"period": period, "status": "no_files"}
    manifest_path = _write_manifest(period, source, captcha, artifacts, errors, ocr, scrape_complete=scrape_complete)
    ok = bool(valid) and ocr.get("status") in ("ok", "partial") and (ocr.get("summary_rows", 0) > 0 or ocr.get("export_pivot_rows", 0) > 0 or ocr.get("import_pivot_rows", 0) > 0)
    log.info("[FINISH] success=%s errors=%d output=%s", ok and not errors, len(errors), manifest_path.parent)
    return 0 if ok and not errors else 1


def run_years(years, captcha="none", headless=True,
              ocr_engine="auto", max_pages=None, force=False, reuse_pdfs=False, clean=False):
    """Scrape selected years in one TCHQ scan, then OCR each matching month."""
    if force or clean:
        purged = purge_fdi_pdfs(OUTPUT_DIR)
        if purged:
            log.info("[PURGE] Dọn dẹp %d file FDI toàn bộ các năm", len(purged))

    years = sorted(set(int(y) for y in years))
    if not years or any(y < 2000 or y > datetime.now().year for y in years):
        raise ValueError("Years must be between 2000 and the current year")
    periods = [f"{y}-{m:02d}" for y in years for m in range(1, 13)]
    log.info("[START] years=%s => %d periods | captcha=%s headless=%s", years, len(periods), captcha, headless)
    scrape_complete = False
    if reuse_pdfs:
        log.info("[SCRAPE] Reusing verified PDFs from output/YYYY/YYYY-MM/Xuat_Khau and Nhap_Khau")
        downloads_by_period = {p: _scan_period_pdfs(p) for p in periods}
    else:
        for p in periods:
            for flow_dir in period_pdf_dirs(OUTPUT_DIR, p):
                flow_dir.mkdir(parents=True, exist_ok=True)
        try:
            log.info("[SCRAPE] Single full scan of TCHQ list for all %d periods (this takes a few minutes) ...", len(periods))
            downloads_by_period = scraper.fetch_tchq_multi_period(periods, OUTPUT_DIR, headless=headless, captcha=captcha, max_pages=max_pages, refresh=force)
            scrape_complete = max_pages is None
        except Exception as exc:
            log.exception("[SCRAPE][ERROR] Multi-period scan failed — falling back to existing local PDFs")
            downloads_by_period = {p: _scan_period_pdfs(p) for p in periods}

    results = {}
    total_pdfs = total_summary = total_pivot = ok_periods = 0
    for p in periods:
        recs = downloads_by_period.get(p, [])
        valid = [r for r in recs if r.get("status") == "ok"]
        # ── Cache check cho từng period trong range
        if not force and _is_cached(p):
            year = p.split("-")[0]
            xlsx = OUTPUT_DIR / year / p / f"{p}_cashew.xlsx"
            log.info("[CACHE] %s: đã có output → bỏ qua. Dùng --force để chạy lại.", p)
            results[p] = {"pdfs": 0, "summary": 0, "pivot": 0, "ok": True, "cached": True}
            ok_periods += 1
            continue
        # ───────────────────────────────────────────────
        if not valid:
            valid = _scan_period_pdfs(p)
        n_copied = _copy_pdfs(p, valid)
        valid = [r for r in valid if Path(r.get("local_path") or r.get("path") or "").is_file()]
        if not valid:
            valid = _scan_period_pdfs(p)
        if valid:
            ocr = _ocr_period(p, ocr_engine)
        else:
            ocr = {"period": p, "status": "no_files"}
        s_rows = ocr.get("summary_rows", 0)
        p_rows = ocr.get("export_pivot_rows", 0) + ocr.get("import_pivot_rows", 0) or ocr.get("pivot_rows", 0)
        total_pdfs += len(valid); total_summary += s_rows; total_pivot += p_rows
        ok = bool(valid) and ocr.get("status") in ("ok", "partial") and (s_rows > 0 or p_rows > 0)
        if ok:
            ok_periods += 1
        results[p] = {"pdfs": len(valid), "summary": s_rows, "pivot": p_rows, "ok": ok}
        _write_manifest(p, "tchq", captcha, recs, [], ocr, scrape_complete=scrape_complete)
        log.info("[PERIOD] %s | pdfs=%d | summary=%d | export_pivots=%d | import_pivots=%d | %s",
                 p, len(valid), s_rows, ocr.get("export_pivot_rows", 0), ocr.get("import_pivot_rows", 0), "OK" if ok else "EMPTY")

    log.info("=" * 64)
    log.info("[FINISH] periods=%d | ok=%d | pdfs=%d | summary_rows=%d | pivot_rows=%d", len(periods), ok_periods, total_pdfs, total_summary, total_pivot)
    log.info("[OUTPUT] Excel + PDFs: %s", OUTPUT_DIR)
    log.info("[OUTPUT] JSON data:    %s", OUTPUT_DIR / "data")
    try:
        # Auto-backfill: tự động bù các kỳ thiếu summary bằng YTD Diff & YoY Proxy
        data_builder.build_all_years(output_root=OUTPUT_DIR, backfill=True)
        data_builder.build_qc_report(output_root=OUTPUT_DIR, years=years)
        report = data_builder.validate_aggregate_outputs(output_root=OUTPUT_DIR)
        log.info("[BACKFILL] Aggregate reconciliation: %s", report)
    except Exception:
        log.exception("[OUTPUT] Failed to rebuild combined all-years Excel/JSON")
    log.info("=" * 64)
    return 0 if ok_periods > 0 else 1


def run_range(year_from, year_to, captcha="none", headless=True,
              ocr_engine="auto", max_pages=None, force=False, reuse_pdfs=False, clean=False):
    """Backward-compatible contiguous range runner."""
    if year_from > year_to:
        raise ValueError("from-year must be less than or equal to to-year")
    return run_years(range(year_from, year_to + 1), captcha, headless,
                     ocr_engine, max_pages, force, reuse_pdfs, clean=clean)


def _ocr_period(period: str, ocr_engine: str) -> dict:
    try:
        return ocr_pipeline.run_period(period, period_dir(OUTPUT_DIR, period),
                                       ocr_engine, OUTPUT_DIR, update_data=False)
    except Exception as exc:
        log.exception("[OCR][ERROR] %s", period)
        return {"period": period, "status": "error", "errors": [str(exc)]}


def ask_year_range():
    """Interactive prompt: nhập năm bắt đầu và kết thúc."""
    print()
    print("=" * 56)
    print("  XNK Cashew Pipeline — Interactive Runner")
    print("=" * 56)
    print("  (1 lượt quét duy nhất, sau đó OCR từng kỳ — có thể mất 15-25 phút cho range nhiều năm)")
    now_year = datetime.now().year
    while True:
        try:
            y1 = int(input(f"  Năm bắt đầu (vd 2020): ").strip())
            y2 = int(input(f"  Năm kết thúc (vd {now_year - 1}): ").strip())
            if 2000 <= y1 <= y2 <= now_year:
                return y1, y2
            print(f"  ⚠️ Nhập năm hợp lệ (2000..{now_year}, bắt đầu ≤ kết thúc)")
        except ValueError:
            print("  ⚠️ Vui lòng nhập số nguyên")


def parse_years(value):
    """Parse comma-separated years and inclusive ranges, e.g. 2020,2022-2024."""
    years = set()
    try:
        for token in value.split(","):
            token = token.strip()
            if not token:
                continue
            if "-" in token:
                start, end = (int(part.strip()) for part in token.split("-", 1))
                if start > end:
                    raise ValueError
                years.update(range(start, end + 1))
            else:
                years.add(int(token))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Use years like 2020,2022-2024") from exc
    if not years or any(y < 2000 or y > datetime.now().year for y in years):
        raise argparse.ArgumentTypeError(f"Years must be between 2000 and {datetime.now().year}")
    return sorted(years)


def main():
    ap = argparse.ArgumentParser(description="XNK Cashew pipeline: scrape TCHQ -> OCR -> Excel")
    ap.add_argument("--period", default=None, help="Single period YYYY-MM")
    ap.add_argument("--from-year", type=int, default=None, help="Start year for range mode")
    ap.add_argument("--to-year", type=int, default=None, help="End year for range mode")
    ap.add_argument("--years", type=parse_years, default=None,
                    help="Selected years, e.g. 2020,2022-2024 (one scan, PDFs grouped by flow under output/<year>/<period>/)")
    ap.add_argument("--captcha", choices=["manual", "none"], default="none")
    ap.add_argument("--headed", action="store_true", help="Show the browser window for debugging")
    ap.add_argument("--fixture", action="store_true", help="(single-period only) reuse local PDFs")
    ap.add_argument("--ocr-engine", choices=["auto", "pdfplumber", "paddle", "vietocr"], default="auto")
    ap.add_argument("--max-pages", type=int, default=None, help="Limit result pages (for testing)")
    ap.add_argument("--force", action="store_true",
                    help="Buộc chạy lại toàn bộ pipeline dù Excel + PDF đã tồn tại (bỏ qua cache)")
    ap.add_argument("--reuse-pdfs", action="store_true",
                    help="Tái sử dụng PDF đã tải trong Xuat_Khau/Nhap_Khau — không mở trình duyệt cào mạng")
    ap.add_argument("--clean", action="store_true",
                    help="Tự động dọn dẹp các file PDF FDI (3N, 3X, 4) cũ và chạy pipeline sạch")
    ap.add_argument("--backfill", action="store_true",
                    help="Tự động bù khoảng trống dữ liệu (YTD Diff & YoY Proxy) và cập nhật Excel/JSON")
    ap.add_argument("--output-root", default=None, help="Thư mục output chuẩn (mặc định code/output)")
    args = ap.parse_args()
    global OUTPUT_DIR
    OUTPUT_DIR = resolve_output_root(args.output_root)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    headless = not args.headed

    if args.backfill:
        log.info("[BACKFILL] Bắt đầu tự động bù khoảng trống dữ liệu (YTD Diff & YoY Proxy)...")
        data_builder.build_all_years(output_root=OUTPUT_DIR, backfill=True)
        report = data_builder.validate_aggregate_outputs(OUTPUT_DIR)
        log.info("[BACKFILL] Aggregate reconciliation report: %s", report)
        log.info("[BACKFILL] Hoàn tất!")
        return 0

    if args.period:
        return run(args.period, captcha=args.captcha, headless=headless, fixture=args.fixture,
                   ocr_engine=args.ocr_engine, max_pages=args.max_pages, force=args.force, clean=args.clean)
    if args.years:
        return run_years(args.years, captcha=args.captcha, headless=headless,
                         ocr_engine=args.ocr_engine, max_pages=args.max_pages, force=args.force, reuse_pdfs=args.reuse_pdfs, clean=args.clean)
    if args.from_year is not None or args.to_year is not None:
        y1 = args.from_year if args.from_year is not None else args.to_year
        y2 = args.to_year if args.to_year is not None else args.from_year
        return run_range(y1, y2, captcha=args.captcha, headless=headless,
                         ocr_engine=args.ocr_engine, max_pages=args.max_pages, force=args.force, reuse_pdfs=args.reuse_pdfs, clean=args.clean)
    y1, y2 = ask_year_range()
    return run_range(y1, y2, captcha=args.captcha, headless=headless,
                     ocr_engine=args.ocr_engine, max_pages=args.max_pages, force=args.force, reuse_pdfs=args.reuse_pdfs, clean=args.clean)


if __name__ == "__main__":
    sys.exit(main())

