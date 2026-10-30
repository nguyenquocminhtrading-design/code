# -*- coding: utf-8 -*-
"""Probe 3: inspect TCHQ results table rows/anchors and test one download. Read-only."""
import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from pathlib import Path
from playwright.sync_api import sync_playwright

TCHQ_URL = "https://www.customs.gov.vn/index.jsp?pageId=4901&group=C%C3%94NG%20B%E1%BB%90%20V%C3%80%20TH%C3%94NG%20TIN&category=S%E1%BB%91%20li%E1%BB%87u%20%C4%91%E1%BB%8Bnh%20k%E1%BB%B3"
OUT = Path("_probe_dl"); OUT.mkdir(exist_ok=True)

def _ascii(s):
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page(accept_downloads=True)
    page.goto(TCHQ_URL, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(10000)

    # replicate scraper table detection
    tables = page.locator("table")
    table = None
    for i in range(tables.count()):
        txt = _ascii(tables.nth(i).inner_text()).lower()
        if "noi dung" in txt and "so bo" in txt and "chinh thuc" in txt:
            table = tables.nth(i); print(f"[OK] results table found at index {i}")
            break
    if table is None:
        print("[FAIL] no table matched scraper's criteria"); browser.close(); sys.exit(0)

    rows = table.locator("tr")
    print("rows:", rows.count())
    headers = [x.strip() for x in rows.nth(0).locator("th,td").all_inner_texts()]
    print("headers:", headers)

    # scan first 12 data rows: cells + anchors per column
    for ri in range(1, min(rows.count(), 13)):
        cells = rows.nth(ri).locator("td")
        vals = [c.strip().replace("\n", " | ") for c in cells.all_inner_texts()]
        anchor_info = []
        for ci in range(cells.count()):
            a = cells.nth(ci).locator("a")
            if a.count():
                href = a.first.get_attribute("href") or ""
                target = a.first.get_attribute("target") or ""
                anchor_info.append(f"col{ci}:n={a.count()},href={href[:90]!r},target={target!r}")
        print(f"row{ri}: {vals}")
        if anchor_info:
            print(f"   anchors: {anchor_info}")

    body_txt = page.locator("body").inner_text()
    print("body contains 'tháng 9/2026':", "tháng 9/2026" in body_txt)
    print("body contains 'tháng 09/2026':", "tháng 09/2026" in body_txt)

    # find the first row about monthly export report for any month, then test download
    target = None
    for ri in range(1, rows.count()):
        cells = rows.nth(ri).locator("td")
        vals = cells.all_inner_texts()
        if not vals: continue
        title = vals[0].strip()
        if re.search(r"[Xx]uất khẩu hàng hóa tháng", title):
            target = (ri, title, cells)
            break
    if target:
        ri, title, cells = target
        print(f"\n[TEST] monthly export row found: row{ri}: {title!r}")
        a = cells.nth(2).locator("a")  # Sơ bộ column
        if a.count():
            print("   Sơ bộ href:", a.first.get_attribute("href"))
            try:
                with page.expect_download(timeout=20000) as dl_info:
                    a.first.click()
                dl = dl_info.value
                p = OUT / (dl.suggested_filename or "test.pdf")
                dl.save_as(str(p))
                head = p.read_bytes()[:8]
                print(f"   DOWNLOAD OK: file={dl.suggested_filename!r} url={dl.url[:110]}")
                print(f"   saved size={p.stat().st_size}, magic={head!r}")
            except Exception as e:
                print("   DOWNLOAD FAILED:", type(e).__name__, str(e)[:200])
        else:
            print("   no anchor in Sơ bộ column")
    else:
        print("\n[INFO] no 'Xuất khẩu hàng hóa tháng' row on page 1")

    # pagination check (scraper's selector)
    nxt = page.get_by_text(re.compile(r"^Trang sau\s*>|^Next", re.I))
    print("\npagination 'Trang sau' matches:", nxt.count())
    if nxt.count():
        print("  first match visible:", nxt.first.is_visible(), "| text:", (nxt.first.text_content() or "").strip()[:40], "| tag:", nxt.first.evaluate("e=>e.tagName"))
    browser.close()
