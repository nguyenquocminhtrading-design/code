# -*- coding: utf-8 -*-
"""Extract 2D arrays from all_years_cashew.xlsx exactly as SheetJS sheet_to_json(header:1, defval:null) would."""
import json
import openpyxl
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "output" / "all_years_cashew.xlsx"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "diagnostics" / "dof_xlsx_rows.json"

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
data = {}
for name in wb.sheetnames:
    ws = wb[name]
    rows = []
    for row in ws.iter_rows(values_only=True):
        rows.append([c.isoformat() if isinstance(c, (date, datetime)) else c if c is not None else None for c in row])
    data[name] = rows

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
print("sheets:", {k: len(v) for k, v in data.items()})
print("saved:", OUT)
