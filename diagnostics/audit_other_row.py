"""
Audit script: Kiểm tra tất cả file Excel trong output/YYYY/YYYY-MM/
- Đọc sheet XK_Theo_Nuoc và NK_Theo_Nuoc
- Kiểm tra có dòng "Other" không
- Kiểm tra summary row có khớp với tổng country rows không
- Xác định các kỳ không thể tính "Other" (thiếu summary hoặc mismatch)
"""
import json
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl required")
    exit(1)

OUTPUT_ROOT = Path('output')
COL_VI = ["Quốc gia", "mặt hàng", "Đơn vị tính", "CY Lượng", "CY Trị giá (USD)", "YTD Lượng", "YTD Trị giá (USD)", "Phiên bản"]

def parse_xk_sheet(ws):
    """Parse XK_Theo_Nuoc sheet, return list of dicts"""
    rows = list(ws.iter_rows(values_only=True))
    if not rows or len(rows) < 2:
        return []
    header = [str(c).strip() if c is not None else '' for c in rows[0]]
    def idx(name):
        try: return header.index(name)
        except ValueError: return None
    i_country = idx(COL_VI[0])
    i_product = idx(COL_VI[1])
    i_unit = idx(COL_VI[2])
    i_cy_l = idx(COL_VI[3])
    i_cy_tg = idx(COL_VI[4])
    i_ytd_l = idx(COL_VI[5])
    i_ytd_tg = idx(COL_VI[6])
    i_ver = idx("Phiên bản")

    result = []
    for row in rows[1:]:
        if row is None or all(v is None for v in row):
            continue
        country = str(row[i_country] if i_country is not None and i_country < len(row) else '').strip()
        if not country:
            continue
        result.append({
            'country': country,
            'product': str(row[i_product] if i_product is not None and i_product < len(row) else 'Hạt điều').strip(),
            'unit': str(row[i_unit] if i_unit is not None and i_unit < len(row) else 'Tấn').strip(),
            'cy_luong': row[i_cy_l] if i_cy_l is not None and i_cy_l < len(row) else None,
            'cy_tri_gia': row[i_cy_tg] if i_cy_tg is not None and i_cy_tg < len(row) else None,
            'ytd_luong': row[i_ytd_l] if i_ytd_l is not None and i_ytd_l < len(row) else None,
            'ytd_tri_gia': row[i_ytd_tg] if i_ytd_tg is not None and i_ytd_tg < len(row) else None,
            'version': str(row[i_ver] if i_ver is not None and i_ver < len(row) else 'Chính thức').strip(),
        })
    return result

def parse_summary_sheet(ws):
    """Parse Tong_Quan_XNK sheet, return export/import summary dicts"""
    rows = list(ws.iter_rows(values_only=True))
    if not rows or len(rows) < 3:
        return {}
    results = {}
    for row in rows[2:]:
        if row is None or all(v is None for v in row):
            continue
        if len(row) >= 7:
            flow = str(row[2] or '').lower()
            if 'xuất' in flow or 'export' in flow:
                results['export'] = {
                    'period': str(row[1] or ''),
                    'product': str(row[3] or 'Hạt điều'),
                    'unit': str(row[4] or 'Tấn'),
                    'quantity_month': row[5],
                    'value_month_usd': row[6],
                    'quantity_ytd': row[9] if len(row) > 9 else None,
                    'value_ytd_usd': row[10] if len(row) > 10 else None,
                    'version': str(row[11] or '') if len(row) > 11 else '',
                    'source_note': str(row[12] or '') if len(row) > 12 else '',
                }
            elif 'nhập' in flow or 'import' in flow:
                results['import'] = {
                    'period': str(row[1] or ''),
                    'product': str(row[3] or 'Hạt điều'),
                    'unit': str(row[4] or 'Tấn'),
                    'quantity_month': row[5],
                    'value_month_usd': row[6],
                    'quantity_ytd': row[9] if len(row) > 9 else None,
                    'value_ytd_usd': row[10] if len(row) > 10 else None,
                    'version': str(row[11] or '') if len(row) > 11 else '',
                    'source_note': str(row[12] or '') if len(row) > 12 else '',
                }
    return results

def check_other_row(country_rows, direction):
    """Check if 'Other' row exists and if it's calculable"""
    other_rows = [r for r in country_rows if r['country'].upper() == 'OTHER']
    non_other_rows = [r for r in country_rows if r['country'].upper() != 'OTHER']

    if not other_rows:
        return {
            'has_other': False,
            'other_row': None,
            'can_calculate': len(non_other_rows) > 0,
            'sum_qty': sum(r.get('cy_luong') or 0 for r in non_other_rows),
            'sum_val': sum(r.get('cy_tri_gia') or 0 for r in non_other_rows),
            'issue': 'MISSING_OTHER_ROW'
        }

    other = other_rows[0]
    return {
        'has_other': True,
        'other_row': other,
        'can_calculate': True,
        'sum_qty': sum(r.get('cy_luong') or 0 for r in non_other_rows),
        'sum_val': sum(r.get('cy_tri_gia') or 0 for r in non_other_rows),
        'issue': None
    }

def main():
    report = []
    issues = {
        'missing_other': [],
        'missing_summary': [],
        'summary_no_match': [],
        'no_country_rows': [],
        'all_ok': []
    }

    # Scan all year directories
    for year_dir in sorted(OUTPUT_ROOT.iterdir()):
        if not year_dir.is_dir() or not year_dir.name.isdigit():
            continue
        year = year_dir.name

        # Check for flat xlsx files (output/YYYY/YYYY-MM_cashew.xlsx)
        for xlsx in sorted(year_dir.glob(f'{year}-??_cashew.xlsx')):
            audit_one_file(xlsx, year, None, report, issues)

        # Check for period subdirectories
        for period_dir in sorted(year_dir.glob(f'{year}-??')):
            if not period_dir.is_dir():
                continue
            period = period_dir.name
            # Check master xlsx
            xlsx = period_dir / f'{period}_cashew.xlsx'
            if xlsx.exists():
                audit_one_file(xlsx, year, period, report, issues)

    # Sort report by year and period
    report.sort(key=lambda x: (x['year'], x.get('period') or ''))

    # Generate output
    generate_report(report, issues)

def audit_one_file(xlsx_path, year, period, report, issues):
    """Audit a single xlsx file"""
    try:
        wb = openpyxl.load_workbook(str(xlsx_path), read_only=True, data_only=True)
    except Exception as e:
        report.append({
            'file': str(xlsx_path.relative_to(OUTPUT_ROOT)),
            'year': year,
            'period': period,
            'error': f'Cannot open: {e}'
        })
        return

    result = {
        'file': str(xlsx_path.relative_to(OUTPUT_ROOT)),
        'year': year,
        'period': period or '',
        'sheets': wb.sheetnames,
        'xk_summary': None,
        'nk_summary': None,
        'xk_other': None,
        'nk_other': None,
        'xk_country_count': 0,
        'nk_country_count': 0,
        'issues': []
    }

    # Parse summary sheet
    summary_sheet = 'Tong_Quan_XNK' if 'Tong_Quan_XNK' in wb.sheetnames else None
    if summary_sheet:
        summaries = parse_summary_sheet(wb[summary_sheet])
        result['xk_summary'] = summaries.get('export')
        result['nk_summary'] = summaries.get('import')

    # Parse XK sheet
    xk_sheet = 'XK_Theo_Nuoc' if 'XK_Theo_Nuoc' in wb.sheetnames else None
    if xk_sheet:
        xk_rows = parse_xk_sheet(wb[xk_sheet])
        result['xk_country_count'] = len(xk_rows)
        result['xk_other'] = check_other_row(xk_rows, 'export')

    # Parse NK sheet
    nk_sheet = 'NK_Theo_Nuoc' if 'NK_Theo_Nuoc' in wb.sheetnames else None
    if nk_sheet:
        nk_rows = parse_xk_sheet(wb[nk_sheet])
        result['nk_country_count'] = len(nk_rows)
        result['nk_other'] = check_other_row(nk_rows, 'import')

    # Analyze issues
    # Check XK
    if result['xk_summary'] is None:
        result['issues'].append('MISSING_SUMMARY_XK')
        issues['missing_summary'].append(result['file'])
    elif not result['xk_other']['has_other'] and result['xk_other']['can_calculate']:
        result['issues'].append('MISSING_OTHER_XK')
        issues['missing_other'].append(result['file'])
    elif result['xk_other']['has_other']:
        # Check if Other matches calculated
        other_val = result['xk_other']['other_row'].get('cy_tri_gia') or 0
        calc_val = result['xk_other']['sum_val']
        if result['xk_summary'] and result['xk_summary'].get('value_month_usd'):
            summary_val = result['xk_summary'].get('value_month_usd') or 0
            if abs(other_val - (summary_val - calc_val)) > 1:
                result['issues'].append('OTHER_MISMATCH_XK')
                issues['summary_no_match'].append(result['file'])

    # Check NK
    if result['nk_summary'] is None:
        result['issues'].append('MISSING_SUMMARY_NK')
        issues['missing_summary'].append(result['file'])
    elif not result['nk_other']['has_other'] and result['nk_other']['can_calculate']:
        result['issues'].append('MISSING_OTHER_NK')
        issues['missing_other'].append(result['file'])
    elif result['nk_other']['has_other']:
        other_val = result['nk_other']['other_row'].get('cy_tri_gia') or 0
        calc_val = result['nk_other']['sum_val']
        if result['nk_summary'] and result['nk_summary'].get('value_month_usd'):
            summary_val = result['nk_summary'].get('value_month_usd') or 0
            if abs(other_val - (summary_val - calc_val)) > 1:
                result['issues'].append('OTHER_MISMATCH_NK')
                issues['summary_no_match'].append(result['file'])

    if not result['issues']:
        issues['all_ok'].append(result['file'])

    report.append(result)
    wb.close()

def generate_report(report, issues):
    """Generate text report"""
    lines = []
    lines.append('=' * 100)
    lines.append('AUDIT REPORT: Other Row Analysis for All Period Excel Files')
    lines.append('=' * 100)
    lines.append('')
    lines.append(f'Total files audited: {len(report)}')
    lines.append(f'Files with issues: {len(issues["missing_other"]) + len(issues["missing_summary"]) + len(issues["summary_no_match"])}')
    lines.append(f'Files OK: {len(issues["all_ok"])}')
    lines.append('')

    # Summary stats
    lines.append('-' * 100)
    lines.append('SUMMARY')
    lines.append('-' * 100)
    lines.append(f'Missing Other row (can calculate): {len(issues["missing_other"])}')
    lines.append(f'Missing summary row: {len(issues["missing_summary"])}')
    lines.append(f'Other/Summary mismatch: {len(issues["summary_no_match"])}')
    lines.append(f'All OK: {len(issues["all_ok"])}')
    lines.append('')

    # Detailed issues
    if issues['missing_other']:
        lines.append('-' * 100)
        lines.append('FILES MISSING "Other" ROW (Can Calculate from Summary - Country Rows)')
        lines.append('-' * 100)
        for f in issues['missing_other']:
            lines.append(f'  [ ] {f}')
        lines.append('')

    if issues['missing_summary']:
        lines.append('-' * 100)
        lines.append('FILES MISSING SUMMARY ROW (Cannot Calculate Other)')
        lines.append('-' * 100)
        for f in issues['missing_summary']:
            lines.append(f'  [ ] {f}')
        lines.append('')

    if issues['summary_no_match']:
        lines.append('-' * 100)
        lines.append('FILES WITH OTHER/SUMMARY MISMATCH')
        lines.append('-' * 100)
        for f in issues['summary_no_match']:
            lines.append(f'  [!] {f}')
        lines.append('')

    # All OK files
    if issues['all_ok']:
        lines.append('-' * 100)
        lines.append('FILES OK (Have Other row and matching summary)')
        lines.append('-' * 100)
        for f in issues['all_ok']:
            lines.append(f'  [OK] {f}')
        lines.append('')

    # Full detail table
    lines.append('-' * 100)
    lines.append('FULL DETAIL TABLE')
    lines.append('-' * 100)
    lines.append(f"{'File':<50} {'Period':<10} {'XK_Sum':<8} {'NK_Sum':<8} {'XK_Other':<10} {'NK_Other':<10} {'Issues'}")
    lines.append('-' * 100)
    for r in report:
        xk_sum = 'YES' if r['xk_summary'] else 'NO'
        nk_sum = 'YES' if r['nk_summary'] else 'NO'
        xk_other = 'YES' if r['xk_other'] and r['xk_other']['has_other'] else 'NO'
        nk_other = 'YES' if r['nk_other'] and r['nk_other']['has_other'] else 'NO'
        issue_str = ', '.join(r['issues']) if r['issues'] else '-'
        file_short = r['file'][:48]
        lines.append(f'{file_short:<50} {r["period"]:<10} {xk_sum:<8} {nk_sum:<8} {xk_other:<10} {nk_other:<10} {issue_str}')
    lines.append('-' * 100)

    # Write to file
    output_path = OUTPUT_ROOT / 'docs' / 'audit_other_row_report.txt'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text('\n'.join(lines), encoding='utf-8')
    print(f'Report written to: {output_path}')

    # Also print to console
    print('\n'.join(lines[:100]))  # Print first 100 lines

if __name__ == '__main__':
    main()
