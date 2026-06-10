#!/usr/bin/env python3
"""
ADC POS Dashboard — standalone launcher.

Double-click the built `ADC Dashboard.exe` and it will:
  1. Rebuild dashboard-data.json from any CSVs in the `Raw CSVs` folder beside it.
  2. Start a local web server bound to 127.0.0.1 (never exposed to the network).
  3. Open the dashboard in the default browser.
  4. Auto-shut down after a period of inactivity.

The dashboard HTML/JS are baked into the exe. Only the data lives outside:
    ADC Dashboard.exe
    Raw CSVs\\        <- drop monthly Neosoft CSV exports here, then relaunch
    dashboard-data.json   <- written by the ETL on each launch

Run as a plain script for testing:
    python app.py            # builds data, serves, opens browser
    python app.py --no-open  # serves without opening a browser (handy for tests)
"""

import http.server
import importlib
import json
import os
import socket
import socketserver
import sys
import threading
import time
import webbrowser
from pathlib import Path

PORT = 8765
HOST = "127.0.0.1"  # loopback only — the data is patient PII and must stay on this machine
DASHBOARD_FILE = "ADC POS Dashboard.html"
INACTIVITY_MINUTES = 20


def is_frozen():
    return getattr(sys, "frozen", False)


def bundle_dir() -> Path:
    """Where the baked static assets (HTML/JS) live."""
    if is_frozen():
        return Path(sys._MEIPASS)  # PyInstaller extraction dir
    return Path(__file__).resolve().parent


def app_dir() -> Path:
    """The folder the user sees — next to the exe (or the script in dev)."""
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def rebuild_data():
    """Run the bundled ETL against the external `Raw CSVs` folder, if present."""
    base = app_dir()
    raw = base / "Raw CSVs"
    raw.mkdir(exist_ok=True)  # create on first run so the user has somewhere to drop files

    csvs = list(raw.glob("*.csv"))
    if not csvs:
        print(f"[app] No CSVs in {raw} — using existing/embedded data.")
        return

    os.environ["ADC_RAW_DIR"] = str(raw)
    os.environ["ADC_DASHBOARD_OUT"] = str(base)
    print(f"[app] Building dashboard-data.json from {len(csvs)} CSV files in {raw} ...")
    try:
        # Imported after env vars are set, since the ETL reads them at import time.
        if is_frozen():
            etl = importlib.import_module("etl.build_dashboard_data")
        else:
            sys.path.insert(0, str(bundle_dir()))
            etl = importlib.import_module("etl.build_dashboard_data")
        etl.main()
    except Exception as e:  # never let a data error stop the dashboard from opening
        print(f"[app] ETL failed ({e}). The dashboard will load the last good data or its embedded fallback.")


# ── Server with auto-shutdown + external data file ────────────────────────────
_last_activity = time.time()
_shutdown = threading.Event()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Static assets are served from the (baked) bundle dir.
        super().__init__(*args, directory=str(bundle_dir()), **kwargs)

    def translate_path(self, path):
        # dashboard-data.json is the one file that lives OUTSIDE the bundle,
        # next to the exe, so refreshes are visible without rebuilding the exe.
        if path.split("?")[0].rstrip("/").endswith("dashboard-data.json"):
            return str(app_dir() / "dashboard-data.json")
        return super().translate_path(path)

    def do_GET(self):
        global _last_activity
        _last_activity = time.time()
        if self.path.split("?")[0].rstrip("/") == "/refresh":
            return self._handle_refresh()
        return super().do_GET()

    def _handle_refresh(self):
        """Re-run the ETL against Raw CSVs without restarting the app."""
        try:
            rebuild_data()
            body, code = json.dumps({"ok": True}).encode(), 200
        except Exception as e:
            body, code = json.dumps({"ok": False, "error": str(e)}).encode(), 500
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # quiet (windowed exe has no console)


def inactivity_watcher():
    while not _shutdown.is_set():
        time.sleep(30)
        if time.time() - _last_activity > INACTIVITY_MINUTES * 60:
            print(f"[app] Idle for {INACTIVITY_MINUTES} min — shutting down.")
            _shutdown.set()
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(1.0)
                s.connect((HOST, PORT))
                s.close()
            except Exception:
                pass
            break


def serve(open_browser=True):
    socketserver.TCPServer.allow_reuse_address = True
    try:
        server = socketserver.TCPServer((HOST, PORT), Handler)
    except OSError as e:
        # Most likely a previous instance is still running — just open the browser at it.
        print(f"[app] Could not bind {HOST}:{PORT} ({e}). Is it already running? Opening browser anyway.")
        if open_browser:
            webbrowser.open(f"http://{HOST}:{PORT}/{DASHBOARD_FILE.replace(' ', '%20')}")
        return

    with server:
        url = f"http://{HOST}:{PORT}/{DASHBOARD_FILE.replace(' ', '%20')}"
        print(f"[app] Serving on {url} (auto-shutdown after {INACTIVITY_MINUTES} min idle)")
        threading.Thread(target=inactivity_watcher, daemon=True).start()
        if open_browser:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        while not _shutdown.is_set():
            server.handle_request()
    print("[app] Stopped.")


def main():
    open_browser = "--no-open" not in sys.argv
    rebuild_data()
    serve(open_browser=open_browser)


if __name__ == "__main__":
    main()
