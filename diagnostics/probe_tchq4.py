# -*- coding: utf-8 -*-
"""Acid test: run the project's real fetch_tchq_playwright with max_pages=1."""
import sys, io, json, logging
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, ".")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s | %(message)s")
from pathlib import Path
from pipeline import scraper

raw = Path("diagnostics/fixtures_2026-09")
res = scraper.fetch_tchq_playwright("2026-09", raw, headless=True, captcha="none", max_pages=1)
print("\n=== RESULT ===")
print("pages:", res.get("pages"), "| rows_seen:", len(res.get("rows", [])), "| downloads:", len(res.get("downloads", [])))
for r in res.get("rows", []):
    print("  ROW:", r["title"][:80], "| url:", (r.get("preliminary_url") or "")[:80])
for d in res.get("downloads", []):
    print("  DL :", json.dumps({k: d.get(k) for k in ("title", "report_type", "download_status", "status", "local_path", "size_bytes")}, ensure_ascii=False))

