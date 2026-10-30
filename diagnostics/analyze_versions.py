import json
from pathlib import Path

json_path = Path('output/data/all_years_cashew.json')
with open(json_path, encoding='utf-8') as f:
    data = json.load(f)

periods = data.get('periods', {})

# Check 2020-01 in detail
p = '2020-01'
pd = periods.get(p, {})

lines = []
lines.append('=' * 80)
lines.append('DETAILED ANALYSIS: 2020-01')
lines.append('=' * 80)
lines.append('')

# Check summary rows
lines.append('=== SUMMARY ROWS ===')
xk = pd.get('tong_xk')
nk = pd.get('tong_nk')
lines.append(f'XK Summary: {xk is not None}')
if xk:
    lines.append(f'  Version: {xk.get("version")}')
    lines.append(f'  Quantity: {xk.get("quantity_month")}')
    lines.append(f'  Value: {xk.get("value_month_usd")}')
    lines.append(f'  Source note: {xk.get("source_note", "")[:60]}')
lines.append('')
lines.append(f'NK Summary: {nk is not None}')
if nk:
    lines.append(f'  Version: {nk.get("version")}')
    lines.append(f'  Quantity: {nk.get("quantity_month")}')
    lines.append(f'  Value: {nk.get("value_month_usd")}')
lines.append('')

# Check country rows by version
lines.append('=== COUNTRY ROWS BY VERSION ===')
xk_rows = pd.get('xk_theo_nuoc', [])
lines.append(f'Total XK country rows: {len(xk_rows)}')

# Group by version
versions = {}
for r in xk_rows:
    v = r.get('version', 'unknown')
    if v not in versions:
        versions[v] = []
    versions[v].append(r)

for v, rows in versions.items():
    lines.append(f'  Version "{v}": {len(rows)} rows')
    other_rows = [r for r in rows if r.get('country', '').upper() == 'OTHER']
    lines.append(f'    Other rows: {len(other_rows)}')
    if other_rows:
        lines.append(f'    Other value: ${other_rows[0].get("cy_tri_gia", 0)/1e6:.2f}M')

lines.append('')

# Check what versions exist in the raw data
lines.append('=== VERSIONS IN PDF FILES ===')
pdf_dir = Path('output/2020/2020-01/Xuat_Khau')
pdfs = sorted(pdf_dir.glob('*.pdf'))
for pdf in pdfs:
    name = pdf.name
    if '2X' in name or '5X' in name:
        if 'CT' in name or 'chinh' in name.lower():
            ver = 'official'
        elif 'DC' in name or 'dieu' in name.lower():
            ver = 'adjusted'
        else:
            ver = 'preliminary'
        lines.append(f'  {name} -> version: {ver}')

lines.append('')
lines.append('=== ISSUE IDENTIFICATION ===')
lines.append('Problem 1: Only 1 summary row (Official) instead of 3 (SB, DC, CT)')
lines.append('Problem 2: Country rows may not have version field for proper grouping')
lines.append('Problem 3: No debug_source_file column to trace which PDF each row came from')
lines.append('Problem 4: Other row only calculated for best version, not all versions')

output_path = Path('output/docs/analysis_2020_01.txt')
output_path.write_text('\n'.join(lines), encoding='utf-8')
print(f'Report written to: {output_path}')
