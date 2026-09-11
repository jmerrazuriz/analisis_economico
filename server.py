"""Servidor local del panel de indicadores económicos de Chile.

Sirve la interfaz (carpeta static/) y actúa como proxy con caché hacia la
API BDE del Banco Central de Chile, de modo que las credenciales se quedan
en este proceso y nunca llegan al navegador.

Uso:  py -3 server.py [--abrir]
"""
import json
import sys
import threading
import time
import urllib.parse
import webbrowser
from concurrent.futures import ThreadPoolExecutor
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from bcch_api import ENV, ROOT, SERIES_ID, BdeError, credentials_configured, fetch_series

STATIC_DIR = ROOT / "static"
CACHE_DIR = ROOT / "cache"
MAX_IDS = 40
POOL = ThreadPoolExecutor(max_workers=8)

_memory = {}
_locks = {}
_locks_guard = threading.Lock()


def cache_ttl(code):
    # Las series diarias cambian durante el día; el resto se publica con menos frecuencia.
    return 30 * 60 if code.endswith(".D") else 6 * 3600


def get_series(code, refresh=False):
    with _locks_guard:
        lock = _locks.setdefault(code, threading.Lock())
    with lock:
        path = CACHE_DIR / f"{code}.json"
        entry = _memory.get(code)
        if entry is None and path.exists():
            try:
                entry = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                entry = None
        if entry and not refresh and time.time() - entry["fetchedAt"] < cache_ttl(code):
            _memory[code] = entry
            return entry

        try:
            fresh = fetch_series(code)
        except BdeError:
            if entry:
                return {**entry, "stale": True}
            raise

        CACHE_DIR.mkdir(exist_ok=True)
        path.write_text(json.dumps(fresh), encoding="utf-8")
        _memory[code] = fresh
        return fresh


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        if url.path == "/api/series":
            return self.api_series(urllib.parse.parse_qs(url.query))
        if url.path == "/api/status":
            return self.send_json(200, {"configured": credentials_configured()})
        if url.path.startswith("/api/"):
            return self.send_json(404, {"error": "Ruta no encontrada."})
        return super().do_GET()

    def api_series(self, query):
        ids = [i for i in query.get("ids", [""])[0].split(",") if i]
        if not ids or len(ids) > MAX_IDS or not all(SERIES_ID.match(i) for i in ids):
            return self.send_json(400, {"error": "El parámetro ids no es válido."})
        refresh = query.get("refresh", ["0"])[0] == "1"

        def load(code):
            try:
                return code, get_series(code, refresh), None
            except BdeError as exc:
                return code, None, str(exc)

        series, errors = {}, {}
        for code, data, error in POOL.map(load, dict.fromkeys(ids)):
            if error:
                errors[code] = error
            else:
                series[code] = data
        self.send_json(200, {"series": series, "errors": errors})

    def send_json(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")
        super().end_headers()

    def log_request(self, code="-", size="-"):
        if self.path.startswith("/api/") or (isinstance(code, int) and code >= 400):
            super().log_request(code, size)


def main():
    if not credentials_configured():
        print("Aviso: faltan BCCH_USER y BCCH_PASS en el archivo .env; la API rechazará las consultas.")
    port = int(ENV.get("PORT", "8050"))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    except OSError as exc:
        print(f"No se pudo abrir el puerto {port}: {exc}. Cambia PORT en .env o cierra la otra instancia.")
        sys.exit(1)
    url = f"http://127.0.0.1:{port}"
    print(f"Panel disponible en {url}  (versión para teléfono: {url}/movil.html)  Ctrl+C para detener")
    if "--abrir" in sys.argv:
        threading.Timer(0.8, webbrowser.open, [url]).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
