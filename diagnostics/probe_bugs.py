# -*- coding: utf-8 -*-
"""Verify the đ-stripping bug + File A classification + geojson properties."""
import sys, io, unicodedata, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, ".")

print("=== TEST 1: strip_accents vs đ ===")
s = "Hạt điều"
nfd = unicodedata.normalize("NFD", s)
print("NFD('Hạt điều') == original:", nfd == s, "| 'đ' decomposable:", unicodedata.normalize("NFD", "đ") == "d")
from pipeline.ocr_pipeline import strip_accents, is_cashew, _find_col
out = strip_accents(s.lower())
print("strip_accents('hạt điều') =", repr(out))
print("contains 'hat dieu':", "hat dieu" in out)
print("is_cashew('Hạt điều') =", is_cashew("Hạt điều"))
print("is_cashew('Máy điều hòa') =", is_cashew("Máy điều hòa"))
print("_find_col(['ĐVT','Lượng'], 'dvt', 'luong') =", _find_col(["ĐVT", "Lượng"], "dvt", "luong"))

print()
print("=== TEST 2: File A first-page text (why misclassified) ===")
import pdfplumber
with pdfplumber.open("_probe_dl/2026-T9-2X(VN-SB).pdf") as pdf:
    t = pdf.pages[0].extract_text() or ""
print(t[:700])
from pipeline.ocr_pipeline import detect_report_type
from pathlib import Path
print("detect_report_type(File A) =", detect_report_type(Path("_probe_dl/2026-T9-2X(VN-SB).pdf")))

print()
print("=== TEST 3: scraper._row_kind on real titles ===")
from pipeline import scraper
for title in ["Xuất khẩu hàng hóa tháng 09/2026",
              "Xuất khẩu hàng hóa tháng 9/2026",
              "Xuất khẩu hàng hóa sang một số nước/vùng lãnh thổ chia theo mặt hàng chủ yếu tháng 09/2026",
              "Xuất khẩu hàng hóa từ ngày 01/10/2026 đến hết ngày 15/10/2026"]:
    print(f"  {title!r:100} -> {scraper._row_kind(title, '2026-09')}")

print()
print("=== TEST 4: holtzy world geojson properties ===")
import requests
r = requests.get("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson", timeout=60)
feats = r.json()["features"]
props = feats[0]["properties"]
print("feature count:", len(feats))
print("first feature props keys:", list(props.keys()))
print("sample:", json.dumps({k: props[k] for k in list(props)[:6]}, ensure_ascii=False))
