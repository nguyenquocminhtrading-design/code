"""Browser regression test for All Years XLSX vs standalone Vinacas upload."""
from __future__ import annotations

import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

CODE = Path(__file__).resolve().parents[1]
ALL_YEARS = CODE / "output" / "all_years_cashew.xlsx"
VINACAS = CODE / "Vincass" / "Vinacas.xlsx"


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=str(CODE)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"http://127.0.0.1:{server.server_port}/web/", wait_until="load", timeout=45000)

            page.set_input_files("#file-input", str(ALL_YEARS))
            page.wait_for_function(
                "typeof state !== 'undefined' && state.dataSource === 'tchq' && Object.keys(state.periods).length >= 70",
                timeout=30000,
            )
            tchq = page.evaluate("({source: state.dataSource, periods: Object.keys(state.periods).length, sample: state.periods['2020-01']})")
            assert tchq["source"] == "tchq", f"All Years workbook changed source: {tchq['source']}"
            assert tchq["sample"] and tchq["sample"]["countryRowsXk"], "All Years XLSX has no TCHQ export country rows"
            assert tchq["sample"]["tong_xk"], "All Years XLSX has no TCHQ summary for 2020-01"

            page.set_input_files("#file-input", str(VINACAS))
            page.wait_for_function(
                "typeof state !== 'undefined' && state.dataSource === 'vinacas' && state.vinacasRecords.length >= 700",
                timeout=30000,
            )
            vinacas = page.evaluate("({source: state.dataSource, records: state.vinacasRecords.length, periods: Object.keys(state.periods).length})")
            assert vinacas["source"] == "vinacas" and vinacas["records"] == 757, f"Vinacas load mismatch: {vinacas}"
            assert not errors, "Browser page errors: " + " | ".join(errors)
            print(f"PASS All Years XLSX: {tchq['periods']} periods; TCHQ summary and country rows present")
            print(f"PASS Standalone Vinacas XLSX: {vinacas['records']} records; {vinacas['periods']} periods")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == "__main__":
    main()
