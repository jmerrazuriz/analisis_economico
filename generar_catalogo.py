"""Genera static/catalog.js: series adicionales que se pueden agregar en la sección Personalizado.

Consulta el catálogo de la API (SearchSeries), verifica que cada serie exista y siga vigente,
y agrega automáticamente todas las monedas con tipo de cambio diario. Uso:

    py -3 generar_catalogo.py

Después, actualizar_datos.py (y el GitHub Action) descargan también estas series.
"""
import json
import re
import sys
from datetime import date

from bcch_api import ROOT, BdeError, credentials_configured, search_series

OUTPUT = ROOT / "static" / "catalog.js"
MIN_YEAR = date.today().year - 1
YEAR = date.today().year

# Cada serie: (código, nombre, unidad o None para usar la del grupo, opciones que reemplazan las del grupo).
GROUPS = [
    {
        "group": "Materias primas",
        "defaults": {"prefix": "US$", "decimals": 2, "change": "pct"},
        "series": [
            ("F019.PPB.PRE.100.D", "Cobre refinado BML", "dólares por libra"),
            ("F019.PPB.PRE.44.D", "Oro", "dólares por onza troy"),
            ("F019.PPB.PRE.45.D", "Plata", "dólares por onza troy"),
            ("F019.PPB.PRE.41B.D", "Petróleo WTI", "dólares por barril"),
            ("F019.PPB.PRE.41AB.M", "Petróleo Brent", "dólares por barril"),
            ("F019.PPB.PRE.49B.M", "Gas natural", "dólares por millón de BTU"),
            ("F019.PPB.PRE.42.M", "Gasolina en EE.UU.", "dólares por metro cúbico"),
            ("F019.PPB.PRE.37.D", "Litio", "dólares por kilo"),
        ],
    },
    {
        "group": "Bolsas",
        "defaults": {"decimals": 0, "change": "pct", "unit": "puntos"},
        "series": [
            ("F013.IBC.IND.N.7.LAC.CL.CLP.BLO.M", "IPSA (Chile)", None),
            ("F013.IBG.IND.N.7.LAC.CL.CLP.BLO.M", "IGPA (Chile)", None),
            ("F019.IBC.IND.50.M", "Dow Jones (EE.UU.)", None),
            ("F019.IBC.IND.51.M", "Nasdaq (EE.UU.)", None),
            ("F019.IBC.IND.BRA.M", "Ibovespa (Brasil)", None),
            ("F019.IBC.IND.MEX.M", "S&P/BMV IPC (México)", None),
            ("F019.IBC.IND.55.M", "DAX (Alemania)", None),
            ("F019.IBC.IND.53.M", "FTSE 100 (Reino Unido)", None),
            ("F019.IBC.IND.52.M", "Nikkei (Japón)", None),
            ("F022.MB3.STO.Z.Z.Z.M", "Capitalización bursátil de Santiago", "millones de dólares", {"prefix": "US$"}),
        ],
    },
    {
        "group": "Tasas de interés",
        "defaults": {"suffix": "%", "decimals": 2, "change": "pp", "unit": "porcentaje"},
        "series": [
            ("F022.SPC.TPR.D180.NO.Z.D", "Swap promedio cámara 180 días", None),
            ("F022.SPC.TPR.D360.NO.Z.D", "Swap promedio cámara 360 días", None),
            ("F022.BCLP.TIS.AN02.NO.Z.D", "Bonos en pesos a 2 años (BCP)", None),
            ("F022.BCLP.TIS.AN05.NO.Z.D", "Bonos en pesos a 5 años (BCP)", None),
            ("F022.BCLP.TIS.AN10.NO.Z.D", "Bonos en pesos a 10 años (BCP)", None),
            ("F022.BUF.TIS.AN02.UF.Z.D", "Bonos en UF a 2 años", "porcentaje sobre UF"),
            ("F022.BUF.TIS.AN05.UF.Z.D", "Bonos en UF a 5 años", "porcentaje sobre UF"),
            ("F022.BUF.TIS.AN10.UF.Z.D", "Bonos en UF a 10 años", "porcentaje sobre UF"),
            ("F022.BUF.TIS.AN20.UF.Z.D", "Bonos en UF a 20 años", "porcentaje sobre UF"),
            ("F022.CAP.TIP.D089.NO.Z.D", "Depósitos a 30-89 días en pesos", None),
            ("F022.CAP.TIP.AN01.NO.Z.D", "Depósitos a 90 días-1 año en pesos", None),
            ("F022.COL.TIP.D030.NO.Z.D", "Créditos a 1-30 días en pesos", None),
            ("F022.COL.TIP.D089.NO.Z.D", "Créditos a 30-89 días en pesos", None),
            ("F022.COL.TIP.AN01.NO.Z.D", "Créditos a 90 días-1 año en pesos", None),
            ("F022.COL.TIP.D090.UF.Z.D", "Créditos a 90 días-1 año en UF", "porcentaje sobre UF"),
        ],
    },
    {
        "group": "Crédito bancario",
        "defaults": {"prefix": "$", "decimals": 0, "change": "pct", "unit": "miles de millones de pesos"},
        "series": [
            ("F022.COLCONS.PRO.Z.Z.CLP.D", "Créditos de consumo", None),
            ("F022.COLVIV.PRO.Z.Z.CLP.D", "Créditos para vivienda", None),
            ("F022.COLCOM.PRO.Z.Z.CLP.D", "Créditos comerciales", None),
        ],
    },
    {
        "group": "Expectativas",
        "defaults": {"suffix": "%", "decimals": 2, "change": "pp", "unit": "mediana de la encuesta de expectativas"},
        "series": [
            ("F089.IPC.V12.14.M", "Inflación esperada en 11 meses", None),
            ("F089.IPC.V12.15.M", "Inflación esperada en 23 meses", None),
            ("F089.TPM.TAS.14.M", "TPM esperada en 11 meses", None),
            ("F089.TPM.TAS.15.M", "TPM esperada en 23 meses", None),
            ("F089.TCN.PRE.14.M", "Dólar esperado en 11 meses", "pesos por dólar", {"prefix": "$", "suffix": None, "decimals": 0, "change": "pct"}),
            (f"F089.PIB.V12.{YEAR}.M", f"Crecimiento esperado del PIB {YEAR}", None),
            (f"F089.PIB.V12.{YEAR + 1}.M", f"Crecimiento esperado del PIB {YEAR + 1}", None),
            ("F089.ICC.IND.B1M.M", "Confianza de los consumidores (IPSOS)", "índice", {"suffix": None, "decimals": 1, "change": "pct"}),
        ],
    },
    {
        "group": "Actividad por sector (IMACEC)",
        "defaults": {"decimals": 1, "change": "pct", "unit": "índice 2018 = 100"},
        "series": [
            ("F032.IMC.IND.Z.Z.EP18.03.Z.0.M", "IMACEC minero", None),
            ("F032.IMC.IND.Z.Z.EP18.N03.Z.0.M", "IMACEC no minero", None),
            ("F032.IMC.IND.Z.Z.EP18.04.Z.0.M", "IMACEC industria", None),
            ("F032.IMC.IND.Z.Z.EP18.COM.Z.0.M", "IMACEC comercio", None),
            ("F032.IMC.IND.Z.Z.EP18.SERV.Z.0.M", "IMACEC servicios", None),
            ("F032.IMC.IND.Z.Z.EP18.PB.Z.0.M", "IMACEC producción de bienes", None),
            ("F032.IMC.IND.Z.Z.EP18.RB.Z.0.M", "IMACEC resto de bienes", None),
        ],
    },
    {
        "group": "Mercado laboral",
        "defaults": {"suffix": "%", "decimals": 1, "change": "pp", "unit": "de la fuerza de trabajo"},
        "series": [
            ("F049.DES.TAS.INE.02.M", "Desocupación de hombres", None),
            ("F049.DES.TAS.INE.03.M", "Desocupación de mujeres", None),
            ("F049.DES.PMT.INE.10.M", "Personas desocupadas", "miles de personas", {"suffix": None, "decimals": 0, "change": "pct"}),
            ("F049.FTR.PMT.INE.10.M", "Fuerza de trabajo", "miles de personas", {"suffix": None, "decimals": 0, "change": "pct"}),
        ],
    },
]


def clean_title(title):
    return re.sub(r"\s+", " ", (title or "").split("|")[0]).strip()


def entry(code, name, title, options):
    data = {"id": code, "name": name, "title": clean_title(title)}
    data.update({k: v for k, v in options.items() if v is not None})
    return data


def main():
    if not credentials_configured():
        print("Faltan BCCH_USER y BCCH_PASS en .env.", file=sys.stderr)
        return 1

    catalog = {}
    for frequency in ("DAILY", "MONTHLY", "QUARTERLY", "ANNUAL"):
        try:
            for info in search_series(frequency):
                catalog[info["seriesId"]] = info
        except BdeError as exc:
            print(f"No se pudo leer el catálogo {frequency}: {exc}", file=sys.stderr)
            return 1

    def current(code):
        info = catalog.get(code)
        if not info:
            return None
        last = info.get("lastObservation") or ""
        return info if last[-4:].isdigit() and int(last[-4:]) >= MIN_YEAR else None

    groups = []

    currencies = []
    for code, info in catalog.items():
        match = re.fullmatch(r"F072\.CLP\.([A-Z]+)\.N\.O\.D", code)
        if not match or not current(code):
            continue
        name = re.sub(r"(?i)^tipo de cambio nominal", "", clean_title(info.get("spanishTitle"))).strip()
        name = name[:1].upper() + name[1:]
        currencies.append(entry(code, f"{name} ({match.group(1)})", info.get("spanishTitle"),
                                {"prefix": "$", "decimals": "auto", "change": "pct", "unit": "pesos por unidad"}))
    groups.append({"group": "Monedas", "series": sorted(currencies, key=lambda s: s["name"].lower())})

    for group in GROUPS:
        series = []
        for item in group["series"]:
            code, name, unit = item[:3]
            overrides = item[3] if len(item) > 3 else {}
            info = current(code)
            if not info:
                print(f"  Se omite {code} ({name}): no existe o no tiene datos recientes.")
                continue
            options = {**group["defaults"], **({"unit": unit} if unit else {}), **overrides}
            series.append(entry(code, name, info.get("spanishTitle"), options))
        if series:
            groups.append({"group": group["group"], "series": series})

    divisions = []
    for code, info in catalog.items():
        if re.fullmatch(r"F074\.IPC\.IND\.DIV\d+\.2023\.C\.M", code) and current(code):
            name = clean_title(info.get("spanishTitle")).replace("División - ", "")
            divisions.append(entry(code, f"IPC {name.lower()}", info.get("spanishTitle"),
                                   {"decimals": 2, "change": "pct", "unit": "índice 2023 = 100"}))
    if divisions:
        groups.append({"group": "IPC por división", "series": sorted(divisions, key=lambda s: s["name"])})

    total = sum(len(g["series"]) for g in groups)
    text = (
        "/* Catálogo ampliado para la sección Personalizado.\n"
        "   Archivo generado por generar_catalogo.py: no editar a mano. */\n"
        f"window.CATALOG = {json.dumps(groups, ensure_ascii=False, indent=2)};\n"
    )
    OUTPUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"catalog.js: {total} series en {len(groups)} grupos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
