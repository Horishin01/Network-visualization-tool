"""
Simple static file server for this project.

- Always serves files from the directory where this script lives.
- Uses Python's built-in http.server so no extra dependencies.
- Default port is 8000; override with the PORT environment variable.
"""

from __future__ import annotations

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def run() -> None:
    root = Path(__file__).resolve().parent
    os.chdir(root)

    port = int(os.environ.get("PORT", "8000"))

    # Extend MIME map to ensure correct content types.
    SimpleHTTPRequestHandler.extensions_map.update({
        ".js": "application/javascript",
        ".css": "text/css",
        ".html": "text/html; charset=utf-8",
    })

    with ThreadingHTTPServer(("", port), SimpleHTTPRequestHandler) as httpd:
        print(f"Serving {root} at http://localhost:{port}/ (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    run()
