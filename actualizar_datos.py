"""Descarga todas las series del panel y las guarda como archivos JSON estáticos.

GitHub Actions lo ejecuta con las credenciales guardadas como secretos del repositorio
y luego publica la carpeta static/ en GitHub Pages. También funciona en tu computador:

    py -3 actualizar_datos.py
"""
import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from bcch_api import ROOT, BdeError, credentials_configured, fetch_series, series_ids_from_indicators

MAX_ERROR_RATIO = 0.2
ATTEMPTS = 3


def download(code):
    error = None
    for attempt in range(ATTEMPTS):
        try:
            return code, fetch_series(code), None
        except BdeError as exc:
            error = str(exc)
            if attempt < ATTEMPTS - 1:
                time.sleep(3 * (attempt + 1))
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
    print(f"Descargando {len(ids)} series del Banco Central...")

    published, errors = [], {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for code, data, error in pool.map(download, ids):
            if error:
                errors[code] = error
                print(f"  ERROR {code}: {error}")
                continue
            (out / f"{code}.json").write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
            published.append(code)
            print(f"  {code}: {len(data['obs'])} datos")

    manifest = {"generatedAt": time.time(), "series": published, "errors": errors}
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Listo: {len(published)} series publicadas, {len(errors)} con error.")

    if len(errors) > MAX_ERROR_RATIO * len(ids):
        print("Fallaron demasiadas series (¿credenciales incorrectas?); no se publica esta versión.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
