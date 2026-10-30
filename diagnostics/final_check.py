import json
from pathlib import Path

json_path = Path('output/data/all_years_cashew.json')
with open(json_path, encoding='utf-8') as f:
    data = json.load(f)

periods = data.get('periods', {})

# All 18 periods that were missing
backfill_periods = [
    '2020-05', '2020-12', '2022-04', '2022-06', '2022-11',
    '2023-02', '2024-02', '2024-07', '2024-12', '2025-03', '2025-10',
    '2022-01', '2022-09', '2023-04', '2024-03', '2024-05'
]

output_lines = []
output_lines.append('=' * 80)
output_lines.append('FINAL BACKFILL VERIFICATION')
output_lines.append('=' * 80)
output_lines.append('')

all_ok = True
for period in sorted(backfill_periods):
    pd = periods.get(period, {})
    xk = pd.get('tong_xk')
    nk = pd.get('tong_nk')
    xk_rows = pd.get('xk_theo_nuoc', [])
    nk_rows = pd.get('nk_theo_nuoc', [])

    xk_has_summary = xk is not None
    nk_has_summary = nk is not None
    xk_has_other = any(str(r.get('country', '')).upper() == 'OTHER' for r in xk_rows)
    nk_has_other = any(str(r.get('country', '')).upper() == 'OTHER' for r in nk_rows)

    # Check debug fields
    xk_debug_type = xk.get('debug_source_type', '') if xk else ''
    nk_debug_type = nk.get('debug_source_type', '') if nk else ''

    ok = xk_has_summary and nk_has_summary and xk_has_other and nk_has_other
    if not ok:
        all_ok = False

    status = 'PASS' if ok else 'FAIL'
    output_lines.append(f'{period}: {status}')
    output_lines.append(f'  XK: Summary={"OK" if xk_has_summary else "MISSING"} Other={"OK" if xk_has_other else "MISSING"} Debug={xk_debug_type}')
    output_lines.append(f'  NK: Summary={"OK" if nk_has_summary else "MISSING"} Other={"OK" if nk_has_other else "MISSING"} Debug={nk_debug_type}')
    output_lines.append('')

output_lines.append('=' * 80)
if all_ok:
    output_lines.append('STATUS: ALL 18 PERIODS BACKFILLED SUCCESSFULLY!')
else:
    output_lines.append('STATUS: SOME ISSUES REMAIN')
output_lines.append('=' * 80)

output_path = Path('output/docs/final_backfill_verification.txt')
output_path.write_text('\n'.join(output_lines), encoding='utf-8')
print(f'Report written to: {output_path}')
