import json
from pathlib import Path

json_path = Path('output/data/all_years_cashew.json')
with open(json_path, encoding='utf-8') as f:
    data = json.load(f)

periods = data.get('periods', {})

derived_export = []
derived_import = []
official_export = []
official_import = []

for period in sorted(periods.keys()):
    pd = periods[period]

    xk = pd.get('tong_xk')
    nk = pd.get('tong_nk')

    xk_derived = xk and (xk.get('is_derived') or xk.get('version') == 'derived')
    nk_derived = nk and (nk.get('is_derived') or nk.get('version') == 'derived')

    if xk_derived:
        derived_export.append((period, xk.get('source_note', '') or ''))
    elif xk:
        official_export.append(period)

    if nk_derived:
        derived_import.append((period, nk.get('source_note', '') or ''))
    elif nk:
        official_import.append(period)

output_lines = []
output_lines.append('=' * 80)
output_lines.append('MISSING/DERIVED PERIODS REPORT')
output_lines.append('=' * 80)
output_lines.append('')
output_lines.append(f'OFFICIAL Export periods: {len(official_export)}')
output_lines.append('')
for p in official_export:
    output_lines.append(f'  OK: {p}')

output_lines.append('')
output_lines.append(f'DERIVED (BACKFILL) Export periods: {len(derived_export)}')
output_lines.append('')
for p, note in derived_export:
    output_lines.append(f'  <<< {p} | {note}')

output_lines.append('')
output_lines.append(f'OFFICIAL Import periods: {len(official_import)}')
output_lines.append('')
for p in official_import:
    output_lines.append(f'  OK: {p}')

output_lines.append('')
output_lines.append(f'DERIVED (BACKFILL) Import periods: {len(derived_import)}')
output_lines.append('')
for p, note in derived_import:
    output_lines.append(f'  <<< {p} | {note}')

output_lines.append('')
output_lines.append('=' * 80)
output_lines.append('SUMMARY: PERIODS NEEDING MANUAL DATA ENTRY')
output_lines.append('=' * 80)
output_lines.append('')
output_lines.append('EXPORT (XK) - Needs manual PDF scrape or data entry:')
needs_xk = [p for p in sorted(periods.keys()) if not periods[p].get('tong_xk')]
for p in needs_xk:
    output_lines.append(f'  {p}')

output_lines.append('')
output_lines.append('IMPORT (NK) - Needs manual PDF scrape or data entry:')
needs_nk = [p for p in sorted(periods.keys()) if not periods[p].get('tong_nk')]
for p in needs_nk:
    output_lines.append(f'  {p}')

output_lines.append('')
output_lines.append('ALL MISSING (both XK and NK):')
needs_both = [p for p in sorted(periods.keys()) if not periods[p].get('tong_xk') and not periods[p].get('tong_nk')]
for p in needs_both:
    output_lines.append(f'  {p}')

# Write to file with UTF-8
output_path = Path('output/docs/missing_periods_report.txt')
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text('\n'.join(output_lines), encoding='utf-8')

print('Report written to output/docs/missing_periods_report.txt')
