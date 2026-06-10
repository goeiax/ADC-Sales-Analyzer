#!/usr/bin/env python3
"""
Improved launcher for the ADC Dashboard ETL pipeline.

This script sets the output directory and then runs the real ETL script.
The real ETL logic now lives locally in ./etl/build_dashboard_data.py (self-contained project).

Usage examples:
    python build_dashboard_data.py
    python build_dashboard_data.py --etl-script "C:\Path\To\real_etl.py"
    python build_dashboard_data.py --out-dir ./data --verbose

Environment variables (can be overridden by CLI):
    ADC_ETL_SCRIPT   - Path to the real ETL script
    ADC_DASHBOARD_OUT - Output directory for dashboard-data.json
"""

import argparse
import os
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description="Run the ADC Clinic dashboard ETL pipeline."
    )
    parser.add_argument(
        "--etl-script",
        default=os.environ.get("ADC_ETL_SCRIPT"),
        help="Path to the real ETL script (default: ../ADC Files/Neosoft Export/build_dashboard_data.py)",
    )
    parser.add_argument(
        "--out-dir",
        default=os.environ.get("ADC_DASHBOARD_OUT"),
        help="Directory where dashboard-data.json will be written (default: current folder)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Print extra information about paths and execution",
    )

    args = parser.parse_args()

    # Resolve output directory
    if args.out_dir:
        out_dir = Path(args.out_dir).resolve()
    else:
        out_dir = Path(__file__).resolve().parent

    os.environ["ADC_DASHBOARD_OUT"] = str(out_dir)

    # Resolve ETL script path
    if args.etl_script:
        etl_script = Path(args.etl_script).resolve()
    else:
        # Default to local self-contained copy (./etl/build_dashboard_data.py)
        # This makes the project portable — the real ETL logic now lives inside this folder.
        localEtl = Path(__file__).resolve().parent / "etl" / "build_dashboard_data.py"
        if localEtl.exists():
            etl_script = localEtl
        else:
            # Fallback to the original external location (for transition / large raw CSV setups)
            etl_script = Path(__file__).resolve().parent.parent / "ADC Files" / "Neosoft Export" / "build_dashboard_data.py"

    if args.verbose:
        print(f"[INFO] Output directory : {out_dir}")
        print(f"[INFO] ETL script       : {etl_script}")

    # Validation
    if not etl_script.exists():
        print(f"[ERROR] ETL script not found: {etl_script}", file=sys.stderr)
        print("        You can override the path with --etl-script or the ADC_ETL_SCRIPT environment variable.", file=sys.stderr)
        sys.exit(1)

    if not out_dir.exists():
        print(f"[INFO] Creating output directory: {out_dir}")
        out_dir.mkdir(parents=True, exist_ok=True)

    # Run the real ETL
    try:
        import runpy
        if args.verbose:
            print("[INFO] Starting ETL pipeline...\n")
        runpy.run_path(str(etl_script), run_name="__main__")
    except Exception as e:
        print(f"[ERROR] ETL script failed: {e}", file=sys.stderr)
        sys.exit(1)

    if args.verbose:
        print(f"\n[SUCCESS] dashboard-data.json written to: {out_dir}")


if __name__ == "__main__":
    main()
