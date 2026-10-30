import json
from pathlib import Path

json_path = Path('output/data/all_years_cashew.json')
with open(json_path, encoding='utf-8') as f:
    data = json.load(f)

periods = data.get('periods', {})

backfill_periods = [
    '2020-05', '2020-12', '2022-04', '2022-06', '2022-11',
    '2023-02', '2024-02', '2024-07', '2024-12', '2025-03', '2025-10',
    '2022-01', '2022-09', '2023-04', '2024-03', '2024-05'
]

output_lines = []
output_lines.append('=' * 80)
output_lines.append('BACKFILL RESULT CHECK')
output_lines.append('=' * 80)
output_lines.append('')

xk_ok = 0
nk_ok = 0
xk_other_ok = 0
nk_other_ok = 0

for period in sorted(backfill_periods):
    pd = periods.get(period, {})
    xk = pd.get('tong_xk')
    nk = pd.get('tong_nk')
    xk_rows = pd.get('xk_theo_nuoc', [])
    nk_rows = pd.get('nk_theo_nuoc', [])

    xk_has_summary = xk is not None
    nk_has_summary = nk is not None
    xk_has_other = any(r.get('country', '').upper() == 'OTHER' for r in xk_rows)
    nk_has_other = any(r.get('country', '').upper() == 'OTHER' for r in nk_rows)

    if xk_has_summary:
        xk_ok += 1
    if nk_has_summary:
        nk_ok += 1
    if xk_has_other:
        xk_other_ok += 1
    if nk_has_other:
        nk_other_ok += 1

    output_lines.append(f'{period}:')
    output_lines.append(f'  XK Summary: {"OK" if xk_has_summary else "MISSING"} | Other: {"OK" if xk_has_other else "MISSING"}')
    output_lines.append(f'  NK Summary: {"OK" if nk_has_summary else "MISSING"} | Other: {"OK" if nk_has_other else "MISSING"}')
    output_lines.append('')

output_lines.append('=' * 80)
output_lines.append('SUMMARY')
output_lines.append('=' * 80)
output_lines.append(f'XK Summary present: {xk_ok}/11')
output_lines.append(f'NK Summary present: {nk_ok}/7')
output_lines.append(f'XK Other row present: {xk_other_ok}/11')
output_lines.append(f'NK Other row present: {nk_other_ok}/7')
output_lines.append('')

if xk_ok == 11 and nk_ok == 7 and xk_other_ok == 11 and nk_other_ok == 7:
    output_lines.append('STATUS: ALL BACKFILL COMPLETED SUCCESSFULLY!')
else:
    output_lines.append('STATUS: SOME ISSUES REMAIN')

output_path = Path('output/docs/backfill_result_check.txt')
output_path.write_text('\n'.join(output_lines), encoding='utf-8')
print(f'Result written to: {output_path}')
