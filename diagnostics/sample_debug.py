import json
from pathlib import Path

json_path = Path('output/data/all_years_cashew.json')
with open(json_path, encoding='utf-8') as f:
    data = json.load(f)

p = '2020-05'
pd = data['periods'].get(p, {})
xk = pd.get('tong_xk')

lines = []
lines.append('=== SAMPLE DEBUG INFO (2020-05) ===')
lines.append(f'Summary exists: {xk is not None}')
lines.append(f'Is derived: {xk.get("is_derived") if xk else None}')
lines.append(f'Quantity: {xk.get("quantity_month") if xk else None}')
lines.append(f'Value: {xk.get("value_month_usd") if xk else None}')
lines.append(f'Source note: {xk.get("source_note", "") if xk else None}')
lines.append(f'Debug type: {xk.get("debug_source_type", "") if xk else None}')
lines.append(f'Debug file: {xk.get("debug_source_file", "") if xk else None}')
lines.append(f'Debug note: {xk.get("debug_source_note", "") if xk else None}')
lines.append('')

# Check Other row
xk_rows = pd.get('xk_theo_nuoc', [])
other_rows = [r for r in xk_rows if str(r.get('country', '')).upper() == 'OTHER']
if other_rows:
    o = other_rows[0]
    lines.append('Other row:')
    lines.append(f'  Value: {o.get("cy_tri_gia")}')
    lines.append(f'  Debug type: {o.get("debug_source_type")}')
    lines.append(f'  Debug note: {str(o.get("debug_source_note", ""))[:80]}...')

output_path = Path('output/docs/debug_sample.txt')
output_path.write_text('\n'.join(lines), encoding='utf-8')
print('Done')
