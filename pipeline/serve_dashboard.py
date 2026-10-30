"""Simple HTTP server for Cashew Dashboard.

Serves the web/ directory and output/ directory for data access.
Usage:
  python serve_dashboard.py
  python serve_dashboard.py --port 8080
"""
import sys
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[0]
WEB_DIR = ROOT / "web"
OUTPUT_DIR = ROOT / "output"

class CustomHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)
    
    def translate_path(self, path):
        """Translate URL path to filesystem path."""
        # Remove query string
        if '?' in path:
            path = path.split('?')[0]
        
        # Map /data/ to output/data/
        if path.startswith('/data/'):
            rel_path = path.replace('/data/', '', 1)
            return str(OUTPUT_DIR / "data" / rel_path)
        
        # Map /output/ to output/
        if path.startswith('/output/'):
            rel_path = path.replace('/output/', '', 1)
            return str(OUTPUT_DIR / rel_path)
        
        # Default: serve from web/ directory
        return super().translate_path(path)
    
    def log_message(self, format, *args):
        """Suppress default logging or customize."""
        pass  # Silent mode


def main():
    import argparse
    ap = argparse.ArgumentParser(description="Cashew Dashboard Server")
    ap.add_argument("--port", type=int, default=8080, help="Port to serve on")
    ap.add_argument("--open", action="store_true", help="Open browser automatically")
    args = ap.parse_args()
    
    server = HTTPServer(('127.0.0.1', args.port), CustomHandler)
    url = f"http://127.0.0.1:{args.port}/index.html"
    
    print("=" * 60)
    print(f"  CASHEW DASHBOARD SERVER")
    print("=" * 60)
    print(f"\n  Server running at: {url}")
    print(f"  Web directory: {WEB_DIR}")
    print(f"  Data directory: {OUTPUT_DIR}")
    print(f"\n  Available endpoints:")
    print(f"    - {url} (Dashboard)")
    print(f"    - http://127.0.0.1:{args.port}/output/data/all_years_cashew.json")
    print(f"    - http://127.0.0.1:{args.port}/output/all_years_cashew.xlsx")
    print(f"\n  Press Ctrl+C to stop")
    print("=" * 60)
    
    if args.open:
        webbrowser.open(url)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\nServer stopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
