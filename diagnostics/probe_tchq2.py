# -*- coding: utf-8 -*-
"""Playwright probe: see what the TCHQ page actually renders. Read-only, no downloads."""
import re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

TCHQ_URL = "https://www.customs.gov.vn/index.jsp?pageId=4901&group=C%C3%94NG%20B%E1%BB%90%20V%C3%80%20TH%C3%94NG%20TIN&category=S%E1%BB%91%20li%E1%BB%87u%20%C4%91%E1%BB%8Bnh%20k%E1%BB%B3"

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page(accept_downloads=True)
    print("goto:", TCHQ_URL)
    page.goto(TCHQ_URL, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(10000)  # give the SPA time to render
    print("URL after JS:", page.url)
    print("TITLE:", page.title())
    print("tables:", page.locator("table").count())
    print("iframes:", page.locator("iframe").count())
    body = page.locator("body").inner_text(timeout=15000)
    print("body text length:", len(body))
    for kw in ["Sơ bộ", "Chính thức", "Trang sau", "Số liệu định kỳ", "Xuất khẩu hàng hóa"]:
        print(f"  body has {kw!r}:", kw in body)
    # first 1200 chars of visible text
    print("--- BODY SAMPLE ---")
    print(body[:1200])
    print("--- END SAMPLE ---")
    # links mentioning dinh ky / so lieu
    links = page.eval_on_selector_all("a", "els => els.map(e => (e.innerText||'').trim() + ' => ' + (e.getAttribute('href')||''))")
    hits = [l for l in links if re.search(r"(?i)(định kỳ|dinh ky|số liệu|so lieu)", l)]
    print("--- MENU LINK HITS (%d) ---" % len(hits))
    for h in hits[:25]:
        print("  ", h)
    page.screenshot(path="probe_home.png", full_page=False)
    print("screenshot saved: probe_home.png")
    browser.close()
