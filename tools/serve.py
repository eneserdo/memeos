"""Static dev server with correct MIME types (Windows' registry sometimes maps .js to text/plain).

    python tools/serve.py [port]      # default 8765, serves the project root
"""
import mimetypes
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

for ext, mt in {".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".html": "text/html", ".webp": "image/webp", ".md": "text/markdown"}.items():
    mimetypes.add_type(mt, ext, strict=True)


class H(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ThreadingHTTPServer(("127.0.0.1", port), partial(H, directory=str(Path(__file__).resolve().parents[1]))).serve_forever()
