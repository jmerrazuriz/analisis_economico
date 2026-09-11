"""Cliente mínimo de la API BDE del Banco Central de Chile (SieteRestWS).

Lo usan server.py (panel local) y actualizar_datos.py (datos estáticos para GitHub Pages).
Las credenciales se leen de .env o de variables de entorno (BCCH_USER, BCCH_PASS).
"""
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API_URL = "https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx"
FIRST_DATE = "1996-01-01"
SERIES_ID = re.compile(r"^[A-Z][A-Z0-9]*(\.[A-Za-z0-9]+)+$")


def load_env(path=ROOT / ".env"):
    env = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip()
    # Las variables de entorno (por ejemplo, secretos de GitHub Actions) tienen prioridad.
    env.update({k: v for k, v in os.environ.items() if (k.startswith("BCCH_") or k == "PORT") and v})
    return env


ENV = load_env()


def credentials_configured():
    return bool(ENV.get("BCCH_USER") and ENV.get("BCCH_PASS"))


def _ssl_context():
    # Algunas distribuciones de Python (p. ej. la que trae Inkscape) no incluyen
    # certificados raíz; certifi los aporta cuando está instalado.
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


SSL_CTX = _ssl_context()


class BdeError(Exception):
    """Error al obtener una serie desde la API del Banco Central."""


def fetch_series(code):
    """Descarga una serie completa desde FIRST_DATE. Los mensajes de error nunca incluyen la clave."""
    params = urllib.parse.urlencode({
        "user": ENV.get("BCCH_USER", ""),
        "pass": ENV.get("BCCH_PASS", ""),
        "firstdate": FIRST_DATE,
        # Incluye valores ya publicados hacia adelante (la UF se conoce con un mes de anticipación).
        "lastdate": f"{date.today().year + 1}-12-31",
        "timeseries": code,
        "function": "GetSeries",
    })
    request = urllib.request.Request(f"{API_URL}?{params}", headers={"User-Agent": "panel-macro-chile/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=90, context=SSL_CTX) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        raise BdeError(f"La API respondió con el código HTTP {exc.code}.") from None
    except (urllib.error.URLError, TimeoutError) as exc:
        reason = getattr(exc, "reason", exc)
        raise BdeError(f"No se pudo conectar con la API del Banco Central ({reason}).") from None

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")
    try:
        payload = json.loads(text)
    except ValueError:
        raise BdeError("La API devolvió una respuesta que no es JSON.") from None

    if payload.get("Codigo") != 0:
        raise BdeError(payload.get("Descripcion") or "La API rechazó la consulta.")

    info = payload.get("Series") or {}
    observations = []
    for obs in info.get("Obs") or []:
        if obs.get("statusCode") != "OK":
            continue
        try:
            value = float(obs["value"])
            day, month, year = obs["indexDateString"].split("-")
        except (KeyError, TypeError, ValueError):
            continue
        observations.append([f"{year}-{month}-{day}", value])

    return {
        "id": code,
        "title": (info.get("descripEsp") or "").strip(),
        "obs": observations,
        "fetchedAt": time.time(),
    }


def series_ids_from_indicators(path=ROOT / "static" / "indicators.js"):
    """Todos los códigos de serie que usa la interfaz; indicators.js es la fuente única."""
    text = path.read_text(encoding="utf-8")
    ids = re.findall(r'\bid:\s*"([^"]+)"', text)
    return list(dict.fromkeys(i for i in ids if SERIES_ID.match(i)))
