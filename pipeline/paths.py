"""Shared filesystem layout and path helpers for the cashew pipeline."""
from __future__ import annotations

import re
from pathlib import Path

CODE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_ROOT = CODE_DIR / "output"
PERIOD_RE = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


def resolve_output_root(output_root: str | Path | None = None) -> Path:
    """Resolve a caller-supplied output root or the canonical code/output directory."""
    return Path(output_root).expanduser().resolve() if output_root else DEFAULT_OUTPUT_ROOT


def period_dir(output_root: str | Path | None, period: str) -> Path:
    match = PERIOD_RE.fullmatch(period)
    if not match:
        raise ValueError(f"Invalid reporting period: {period!r}; expected YYYY-MM")
    return resolve_output_root(output_root) / match.group(1) / period


def period_flow_dir(output_root: str | Path | None, period: str, direction: str) -> Path:
    if direction not in {"export", "import"}:
        raise ValueError(f"Invalid trade direction: {direction!r}")
    return period_dir(output_root, period) / ("Xuat_Khau" if direction == "export" else "Nhap_Khau")


def period_pdf_dirs(output_root: str | Path | None, period: str) -> tuple[Path, Path]:
    """Canonical PDF locations for a reporting period, in export/import order."""
    return (period_flow_dir(output_root, period, "export"),
            period_flow_dir(output_root, period, "import"))


def all_years_json_path(output_root: str | Path | None = None) -> Path:
    return resolve_output_root(output_root) / "data" / "all_years_cashew.json"


def all_years_xlsx_path(output_root: str | Path | None = None) -> Path:
    return resolve_output_root(output_root) / "all_years_cashew.xlsx"
