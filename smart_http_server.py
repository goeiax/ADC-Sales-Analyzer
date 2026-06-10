#!/usr/bin/env python3
"""
Smart HTTP server with auto-shutdown after X minutes of inactivity.

Usage:
    python smart_http_server.py [minutes]

Default: 15 minutes of inactivity before shutdown.

This is used by the hidden .vbs launchers so the dashboard server
automatically stops when not used, freeing the port and resources.
"""

import http.server
import socketserver
import threading
import time
import socket
import sys

# Default inactivity timeout in minutes
DEFAULT_TIMEOUT_MINUTES = 15
PORT = 8765

if len(sys.argv) > 1:
    try:
        DEFAULT_TIMEOUT_MINUTES = max(1, int(sys.argv[1]))
    except ValueError:
        pass

INACTIVITY_SECONDS = DEFAULT_TIMEOUT_MINUTES * 60
last_activity = time.time()
shutdown_event = threading.Event()
httpd = None


class AutoShutdownHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        global last_activity
        last_activity = time.time()
        return super().do_GET()

    def log_message(self, format, *args):
        # Silent (pythonw has no console)
        pass


def inactivity_watcher():
    """Background thread that shuts down the server after inactivity timeout."""
    while not shutdown_event.is_set():
        time.sleep(30)  # Check twice per minute
        idle = time.time() - last_activity
        if idle > INACTIVITY_SECONDS:
            print(f"[smart_server] No activity for {DEFAULT_TIMEOUT_MINUTES} minutes. Shutting down.")
            shutdown_event.set()
            # Wake up the server accept() loop
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(1.0)
                s.connect(("127.0.0.1", PORT))
                s.close()
            except Exception:
                pass
            break


def run_server():
    global httpd
    Handler = AutoShutdownHandler

    socketserver.TCPServer.allow_reuse_address = True

    # Bind to loopback only — the dashboard serves patient PII and must not be
    # reachable from other devices on the LAN.
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as server:
        httpd = server
        print(f"[smart_server] Serving on port {PORT} (auto-shutdown after {DEFAULT_TIMEOUT_MINUTES} min inactivity)")

        # Start the watcher thread
        watcher = threading.Thread(target=inactivity_watcher, daemon=True)
        watcher.start()

        # Serve until shutdown_event is set
        while not shutdown_event.is_set():
            server.handle_request()


if __name__ == "__main__":
    try:
        run_server()
    except KeyboardInterrupt:
        print("[smart_server] Keyboard interrupt — shutting down.")
    finally:
        if httpd:
            httpd.server_close()
        print("[smart_server] Server stopped.")