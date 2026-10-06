"""Descarga todas las series del panel y las guarda como archivos JSON estáticos.

GitHub Actions lo ejecuta con las credenciales guardadas como secretos del repositorio
y luego publica la carpeta static/ en GitHub Pages. También funciona en tu computador:

    py -3 actualizar_datos.py

Si la API del Banco Central falla con alguna serie, se reutiliza la copia ya publicada
en el sitio para no dejar ese indicador sin datos ni perder toda la actualización.
"""
import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from bcch_api import ROOT, SSL_CTX, BdeError, credentials_configured, fetch_series, series_ids_from_indicators

MAX_MISSING_RATIO = 0.2
ATTEMPTS = 4
WORKERS = 4


def published_base():
    """Dirección de los datos ya publicados, que sirven de respaldo si la API falla."""
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    if "/" in repository:
        owner, name = repository.split("/", 1)
        return f"https://{owner}.github.io/{name}/data"
    return os.environ.get("DATOS_PUBLICADOS", "")


def published_series(base, code):
    if not base:
        return None
    request = urllib.request.Request(f"{base}/{code}.json", headers={"User-Agent": "panel-macro-chile/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=60, context=SSL_CTX) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return None
    return data if data.get("obs") else None


def download(code):
    error = None
    for attempt in range(ATTEMPTS):
        try:
            return code, fetch_series(code), None
        except BdeError as exc:
            error = str(exc)
            if attempt < ATTEMPTS - 1:
                # Espera creciente con algo de azar, para no reintentar todas las series a la vez.
                time.sleep(4 * (attempt + 1) + random.random() * 2)
    return code, None, error


def main():
    parser = argparse.ArgumentParser(description="Descarga las series del panel como JSON estáticos.")
    parser.add_argument("--salida", default=str(ROOT / "static" / "data"), help="carpeta donde se escriben los JSON")
    args = parser.parse_args()

    if not credentials_configured():
        print("Faltan BCCH_USER y BCCH_PASS (en .env o como secretos del repositorio).", file=sys.stderr)
        return 1

    out = Path(args.salida)
    out.mkdir(parents=True, exist_ok=True)
    ids = series_ids_from_indicators()
    base = published_base()
    print(f"Descargando {len(ids)} series del Banco Central...")

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(download, ids))

    published, reused, errors = [], [], {}
    for code, data, error in results:
        if error:
            data = published_series(base, code)
            if data is None:
                errors[code] = error
                print(f"  ERROR {code}: {error}")
                continue
            # El panel avisa que es una copia guardada cuando la serie viene con "stale".
            data["stale"] = True
            reused.append(code)
            print(f"  {code}: se mantiene la copia publicada ({error})")
        else:
            print(f"  {code}: {len(data['obs'])} datos")
        (out / f"{code}.json").write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
        published.append(code)

    manifest = {"generatedAt": time.time(), "series": published, "stale": reused, "errors": errors}
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Listo: {len(published)} series publicadas ({len(reused)} desde la copia anterior), {len(errors)} sin datos.")

    if not published:
        print("No se pudo descargar ninguna serie (¿credenciales incorrectas?).", file=sys.stderr)
        return 1
    if len(errors) > MAX_MISSING_RATIO * len(ids):
        print("Demasiadas series quedaron sin datos y sin copia publicada; no se publica esta versión.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
