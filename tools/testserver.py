#!/usr/bin/env python3
"""Server fuer den Pyodide-Selbsttest.

Liefert das Repo statisch aus und nimmt zusaetzlich ein POST auf /result
entgegen. Das braucht es, weil ein automatisierter Browserlauf sonst nicht
weiss, wann Pyodide fertig ist: die Seite meldet ihr Ergebnis selbst.

    python3 tools/testserver.py 8765 /tmp/result.txt
"""
import http.server
import pathlib
import socketserver
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / ".cache" / "selftest.txt"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_bytes(self.rfile.read(n))
        self.send_response(204)
        self.end_headers()

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as srv:
    print(f"serving {ROOT} on http://127.0.0.1:{PORT} — Ergebnis nach {OUT}", flush=True)
    srv.serve_forever()
