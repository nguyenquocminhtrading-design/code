# -*- coding: utf-8 -*-
"""Check suspicious country names: overlap per period + 2026-09 composition."""
import json
from collections import defaultdict

d = json.load(open(r'C:\Users\Acer\Desktop\Dan on food\XNK\code\diagnostics\dof_xlsx_rows.json', encoding='utf-8'))
rows = d['XK_Theo_Nuoc_All'][1:]

susp = ['TIỂU VƯƠNG QUỐC', 'ARẬP XÊÚT', 'ISRAEN', 'ISRAEL', 'Other', 'BÊLARUT']
per = defaultdict(set)
vals = defaultdict(float)
for r in rows:
    c = str(r[1]).strip()
    if c in susp:
        per[c].add(str(r[0])[:7])
        vals[c] += float(r[5] or 0)

for c in susp:
    ps = sorted(per.get(c, []))
    first = ps[0] if ps else '-'
    last = ps[-1] if ps else '-'
    print('%-20s %3d periods · %8.0fM USD · %s → %s' % (c, len(ps), vals[c] / 1e6, first, last))

arap_periods = set(str(r[0])[:7] for r in rows if str(r[1]).strip() == 'ARẬP THỐNG NHẤT')
tvq_periods = set(str(r[0])[:7] for r in rows if str(r[1]).strip() == 'TIỂU VƯƠNG QUỐC')
print('ARẬP THỐNG NHẤT periods:', len(arap_periods), '· overlap with TIỂU VƯƠNG QUỐC:', len(arap_periods & tvq_periods))

print()
print('=== 2026-09 rows (suspicious + UAE) ===')
for r in rows:
    if str(r[0])[:7] == '2026-09' and str(r[1]).strip() in susp + ['ARẬP THỐNG NHẤT']:
        print('  %-22s qty=%8s val=%7.1fM ytd=%8.1fM' % (str(r[1]).strip(), r[4], float(r[5]) / 1e6, float(r[7]) / 1e6))

# How big is "Other" per period vs total?
print()
print('=== "Other" share per sample periods ===')
for p in ['2020-01', '2023-06', '2026-09']:
    tot = sum(float(r[5]) for r in rows if str(r[0])[:7] == p)
    oth = sum(float(r[5]) for r in rows if str(r[0])[:7] == p and str(r[1]).strip() == 'Other')
    if tot:
        print('  %s: Other=%.1fM / total=%.1fM = %.1f%%' % (p, oth / 1e6, tot / 1e6, oth / tot * 100))
