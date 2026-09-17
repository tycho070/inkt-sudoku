"""Start het klikbare Sudoku-spel in je browser.

Gebruik (in deze map, in PowerShell of Terminal):

    python start.py

De server gebruikt alleen de Python-standaardbibliotheek.
Er is dus geen `pip install` nodig.
"""

from __future__ import annotations

import json
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from sudoku import genereer_puzzel, is_af_en_geldig, kopieer_bord, los_op

# Map waarin dit bestand staat (= de root van het project).
ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
HOST = "127.0.0.1"
PORT = 8765


class InktHandler(SimpleHTTPRequestHandler):
    """Kleine webserver: bestanden uit `web/` + een paar JSON-API's.

    /              -> web/index.html
    /api/nieuw     -> POST JSON {"niveau": "easy"|"medium"|"hard"}
    /api/oplos     -> POST JSON {"bord": [[...9 rijen...]]}
    /api/check     -> POST JSON {"bord": [[...]]}
    """

    def __init__(self, *args, **kwargs):
        # Serveer statische files vanuit de map web/.
        super().__init__(*args, directory=str(WEB), **kwargs)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        """Houd de terminal rustig: alleen echte fouten printen."""
        if self.command == "GET" and str(args[0]).startswith("200"):
            return
        super().log_message(format, *args)

    def _json(self, data: dict, status: int = 200) -> None:
        raw = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _lees_json(self) -> dict:
        lengte = int(self.headers.get("Content-Length", "0"))
        if lengte <= 0:
            return {}
        return json.loads(self.rfile.read(lengte).decode("utf-8"))

    def do_POST(self) -> None:  # noqa: N802
        """JSON-endpoints die de Python-engine gebruiken."""
        if self.path == "/api/nieuw":
            body = self._lees_json()
            niveau = body.get("niveau", "easy")
            if niveau not in ("easy", "medium", "hard"):
                niveau = "easy"
            puzzel, oplossing = genereer_puzzel(niveau)
            self._json({"puzzel": puzzel, "oplossing": oplossing, "niveau": niveau})
            return

        if self.path == "/api/oplos":
            body = self._lees_json()
            bord = kopieer_bord(body["bord"])
            gelukt = los_op(bord)
            self._json({"gelukt": gelukt, "bord": bord})
            return

        if self.path == "/api/check":
            body = self._lees_json()
            self._json({"ok": is_af_en_geldig(body["bord"])})
            return

        self.send_error(404, "Onbekend endpoint")


def main() -> None:
    """Start de server en open de browser één keer."""
    server = ThreadingHTTPServer((HOST, PORT), InktHandler)
    url = f"http://{HOST}:{PORT}/"
    print("Inkt draait op", url)
    print("Stoppen: Ctrl+C")
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nGestopt.")
        server.server_close()


if __name__ == "__main__":
    main()
