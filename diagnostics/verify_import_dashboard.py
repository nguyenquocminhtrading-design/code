"""Focused browser verification for import KPIs and market charts."""
from __future__ import annotations

import json
from functools import partial
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

import openpyxl
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = ROOT / "output" / "all_years_cashew.xlsx"


def expected_summary(period: str):
    wb = openpyxl.load_workbook(WORKBOOK, read_only=True, data_only=True)
    ws = wb["Tong_Quan_XNK_All"]
    result = None
    for row in ws.iter_rows(min_row=2, values_only=True):
        if str(row[0]) == period and "nhập" in str(row[1] or "").lower():
            result = {"qty": row[4], "val": row[5]}
            break
    wb.close()
    return result


def main():
    expected_valid = expected_summary("2022-02")
    expected_mismatch = expected_summary("2023-05")
    assert expected_valid and expected_mismatch
    errors: list[str] = []

    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
            page.goto(f"http://127.0.0.1:{server.server_port}/web/index.html", wait_until="domcontentloaded", timeout=60000)
            page.set_input_files("#file-input", str(WORKBOOK))
            page.wait_for_function("Object.keys(state.periods || {}).length === 81", timeout=30000)
            page.evaluate("setTradeFlow('import')")
            page.evaluate("switchTab('overview')")

            # A reconciled import period must show the official TCHQ summary and detail.
            page.evaluate("setActivePeriod('2022-02')")
            page.wait_for_timeout(900)
            valid = page.evaluate("({t: periodTotals('2022-02'), rows: getFilteredRowsBase('2022-02').length})")
            assert valid["rows"] > 0, f"Expected reconciled import detail: {valid}"
            assert valid["t"]["qty"] == expected_valid["qty"], (valid, expected_valid)
            assert valid["t"]["val"] == expected_valid["val"], (valid, expected_valid)
            valid_chart_count = page.evaluate("['bar-chart','donut-chart'].filter(id => Chart.getChart(document.getElementById(id))).length")
            assert valid_chart_count == 2, f"Expected both import market charts to render, got {valid_chart_count}"

            # A missing TCHQ summary must stay unknown, never use inferred values.
            page.evaluate("setActivePeriod('2022-01')")
            page.wait_for_timeout(900)
            missing = page.evaluate("({t: periodTotals('2022-01'), rows: getFilteredRowsBase('2022-01').length})")
            assert missing["t"]["qty"] is None and missing["t"]["val"] is None, missing
            assert missing["rows"] == 0, missing

            # Mismatched country details must be suppressed while the TCHQ KPI remains.
            page.evaluate("setActivePeriod('2023-05')")
            page.wait_for_timeout(900)
            mismatched = page.evaluate("({period:state.activePeriod, tab:state.activeTab, t: periodTotals('2023-05'), rows: getFilteredRowsBase('2023-05').length})")
            assert mismatched["rows"] == 0, mismatched
            assert mismatched["t"]["qty"] == expected_mismatch["qty"], (mismatched, expected_mismatch)
            assert mismatched["t"]["val"] == expected_mismatch["val"], (mismatched, expected_mismatch)
            page.evaluate("renderBarChart(); renderDonutChart()")
            mismatch_charts = page.evaluate("['bar-chart','donut-chart'].map(id => { const c=Chart.getChart(document.getElementById(id)); return c ? {id, labels:c.data.labels, destroyed:c._destroyed, rows:getFilteredRows('2023-05').length} : null }).filter(Boolean)")
            assert not mismatch_charts, f"Invalid import detail chart still rendered: {mismatch_charts}; state={mismatched}"

            page.evaluate("switchTab('trends')")
            trends = page.evaluate("({monthly:aggregateSeries(['2022-01','2022-02'],'month'), line:Chart.getChart(document.getElementById('line-chart'))?.data})")
            assert trends["monthly"][0]["val"] is None, trends
            assert trends["monthly"][1]["val"] == expected_valid["val"], trends
            assert trends["line"] is not None, "Import trend chart did not render"

            page.evaluate("switchTab('compare')")
            yearly = page.evaluate("yearlyTotals('2022')")
            assert yearly["val"] is None and yearly["qty"] is None, yearly

            browser.close()
    finally:
        server.shutdown()

    if errors:
        raise AssertionError("Browser errors: " + json.dumps(errors, ensure_ascii=False))
    print(json.dumps({"status": "ok", "valid_period": valid, "missing_period": missing,
                      "mismatched_detail_period": mismatched, "browser_errors": errors}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
