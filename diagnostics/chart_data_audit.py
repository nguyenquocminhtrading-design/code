"""Audit source records used by the Cashew dashboard KPIs and charts."""
from __future__ import annotations

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.data_builder import resolve_output_root


def audit_chart_data(output_root=None) -> Path:
    root = resolve_output_root(output_root)
    source = root / "data" / "all_years_cashew.json"
    payload = json.loads(source.read_text(encoding="utf-8"))
    issues: list[dict] = []
    checks: list[dict] = []

    for period, data in sorted(payload.get("periods", {}).items()):
        for flow, summary_key, rows_key in (
            ("export", "tong_xk", "xk_theo_nuoc"),
            ("import", "tong_nk", "nk_theo_nuoc"),
        ):
            summary = data.get(summary_key) or {}
            rows = data.get(rows_key) or []
            if not summary:
                issues.append({"period": period, "flow": flow, "type": "missing_summary"})
            if summary and not rows:
                issues.append({"period": period, "flow": flow, "type": "missing_country_detail"})

            # "Other" is the residual bucket. Compare detail plus residual to
            # the official monthly total, but flag negative residuals because
            # those must never be rendered as a chart slice.
            other = [r for r in rows if str(r.get("country", "")).strip().casefold() == "other"]
            for field in ("cy_luong", "cy_tri_gia"):
                neg = [r for r in other if isinstance(r.get(field), (int, float)) and r[field] < 0]
                if neg:
                    issues.append({"period": period, "flow": flow, "type": "negative_other_residual", "field": field,
                                   "value": sum(r[field] for r in neg)})

            for field, total_key in (("cy_luong", "quantity_month"), ("cy_tri_gia", "value_month_usd")):
                observed = sum(r.get(field) or 0 for r in rows if isinstance(r.get(field), (int, float)))
                expected = summary.get(total_key)
                delta = observed - expected if isinstance(expected, (int, float)) else None
                # No detail means unknown; tolerate OCR/integer rounding by 1.
                if delta is not None and abs(delta) > 1:
                    issues.append({"period": period, "flow": flow, "type": "detail_summary_mismatch",
                                   "field": field, "detail_total": observed, "summary_total": expected, "delta": delta})
            checks.append({"period": period, "flow": flow, "summary_present": bool(summary),
                           "detail_rows": len(rows), "other_rows": len(other)})

    report = {
        "status": "ok" if not issues else "review_required",
        "period_count": len(payload.get("periods", {})),
        "vinacas_record_count": len(payload.get("vinacas_records", [])),
        "check_count": len(checks),
        "issue_count": len(issues),
        "issues": issues,
        "checks": checks,
    }
    target = root / "qc" / "chart_data_audit.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return target


if __name__ == "__main__":
    print(audit_chart_data())
