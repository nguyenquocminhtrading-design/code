# -*- coding: utf-8 -*-
"""Test OCR pipeline on the two real TCHQ PDFs."""
import sys, io, json, logging
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, ".")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s | %(message)s")
from pathlib import Path
from pipeline import ocr_pipeline as op

print("=== RAW TABLE PREVIEW (pdfplumber, first rows) ===")
for pdf in sorted(Path("diagnostics/fixtures_2026-09").glob("*.pdf")):
    rows = op.extract_table_pdfplumber(pdf) or []
    print(f"\n--- {pdf.name}: {len(rows)} rows ---")
    for r in rows[:14]:
        print("   ", r)
    rtype = op.detect_report_type(pdf)
    print("   detect_report_type:", rtype, "| matches period:", op.pdf_matches_period(pdf, "2026-09"))

print("\n=== parse_summary ===")
rows_a, meta_a = op.parse_summary(Path("diagnostics/fixtures_2026-09/2026-T9-2X(VN-SB).pdf"), "2026-09")
print("meta:", meta_a)
for r in rows_a: print("  ", json.dumps(r, ensure_ascii=False))

print("\n=== parse_country_product ===")
rows_b, meta_b = op.parse_country_product(Path("diagnostics/fixtures_2026-09/2026-T9-5X(VN-SB).pdf"), "2026-09")
print("meta:", meta_b)
print("total country rows:", len(rows_b))
cashew = [r for r in rows_b if op.is_cashew(r.get("product", ""))]
print("cashew rows:", len(cashew))
for r in cashew[:10]: print("  ", json.dumps(r, ensure_ascii=False))

print("\n=== FULL run_period ===")
res = op.run_period("2026-09", "diagnostics/fixtures_2026-09", "auto")
print(json.dumps({k: v for k, v in res.items() if k != "artifacts"}, ensure_ascii=False, indent=2))
for a in res.get("artifacts", []): print("  artifact:", json.dumps(a, ensure_ascii=False))

