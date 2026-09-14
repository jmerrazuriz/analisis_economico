/* Secciones e indicadores del panel.
   Cada "id" es un código de la Base de Datos Estadísticos (BDE) del Banco Central de Chile.
   La última letra del código indica la frecuencia: D diaria, M mensual, T trimestral, A anual.

   Campos de un indicador:
     kind       "line" (líneas) o "bars" (columnas, azul positivo / rojo negativo)
     transform  "yoy" variación respecto a igual período del año anterior, "pop" respecto al período previo
     change     cómo se comparan valores: "pct" (variación %), "pp" (puntos porcentuales), "diff" (diferencia)
     goodUp     true si un alza favorece a la economía chilena (flecha verde), false si la perjudica
                (flecha roja) y null si el efecto es ambiguo (flecha gris)
     extras     mediciones complementarias que se muestran en el costado
   Los textos explicativos de cada indicador están en explanations.js. */

window.STRIP = [
  { id: "F073.TCO.PRE.Z.D", label: "Dólar observado", prefix: "$", decimals: 2, change: "pct", card: "dolar", goodUp: false },
  { id: "F072.CLP.EUR.N.O.D", label: "Euro", prefix: "$", decimals: 2, change: "pct", card: "euro", goodUp: false },
  { id: "F073.UFF.PRE.Z.D", label: "Unidad de Fomento", prefix: "$", decimals: 2, change: "pct", card: "uf", goodUp: false },
  { id: "F073.UTR.PRE.Z.M", label: "UTM", prefix: "$", decimals: 0, change: "pct", card: "utm", goodUp: false },
  { id: "F022.TPM.TIN.D001.NO.Z.D", label: "Tasa de política monetaria", suffix: "%", decimals: 2, change: "pp", card: "tpm", goodUp: false },
];

window.SECTIONS = [
  {
    id: "diarios",
    name: "Indicadores diarios",
    short: "Diarios",
    intro: "Tipos de cambio, unidades reajustables y tasas de interés que se publican cada día hábil.",
    items: [
      {
        key: "dolar",
        goodUp: false,
        name: "Dólar observado",
        series: [{ id: "F073.TCO.PRE.Z.D", label: "Dólar observado" }],
        kind: "line", prefix: "$", decimals: 2, unit: "pesos por dólar", change: "pct",
      },
      {
        key: "euro",
        goodUp: false,
        name: "Euro",
        series: [{ id: "F072.CLP.EUR.N.O.D", label: "Euro" }],
        kind: "line", prefix: "$", decimals: 2, unit: "pesos por euro", change: "pct",
      },
      {
        key: "uf",
        goodUp: false,
        name: "Unidad de Fomento (UF)",
        series: [{ id: "F073.UFF.PRE.Z.D", label: "UF" }],
        kind: "line", prefix: "$", decimals: 2, unit: "pesos", change: "pct",
      },
      {
        key: "utm",
        goodUp: false,
        name: "Unidad Tributaria Mensual (UTM)",
        series: [{ id: "F073.UTR.PRE.Z.M", label: "UTM", step: true }],
        kind: "line", prefix: "$", decimals: 0, unit: "pesos", change: "pct",
      },
      {
        key: "tpm",
        goodUp: false,
        name: "Tasa de Política Monetaria (TPM)",
        series: [
          { id: "F022.TPM.TIN.D001.NO.Z.D", label: "TPM", step: true },
          { id: "F022.SPC.TPR.D090.NO.Z.D", label: "Swap promedio cámara 90 días" },
        ],
        kind: "line", suffix: "%", decimals: 2, unit: "tasa anual", change: "pp",
      },
    ],
  },
  {
    id: "actividad",
    name: "Cuentas nacionales y actividad",
    short: "Actividad",
    intro: "Crecimiento de la economía según el IMACEC, el PIB y los componentes del gasto. Las columnas muestran la variación respecto del mismo período del año anterior.",
    items: [
      {
        key: "imacec",
        goodUp: true,
        name: "IMACEC",
        series: [{ id: "F032.IMC.IND.Z.Z.EP18.Z.Z.0.M", label: "IMACEC" }],
        transform: "yoy", kind: "bars", suffix: "%", decimals: 1, unit: "variación anual", change: "pp",
        extras: [
          { label: "Variación mensual desestacionalizada", id: "F032.IMC.IND.Z.Z.EP18.Z.Z.1.M", transform: "pop", suffix: "%", decimals: 1 },
          { label: "Índice (2018 = 100)", id: "F032.IMC.IND.Z.Z.EP18.Z.Z.0.M", decimals: 1 },
        ],
      },
      {
        key: "pib_trimestral",
        goodUp: true,
        name: "PIB trimestral",
        series: [{ id: "F032.PIB.FLU.R.CLP.EP18.Z.Z.0.T", label: "PIB" }],
        transform: "yoy", kind: "bars", suffix: "%", decimals: 1, unit: "variación anual", change: "pp",
        extras: [
          { label: "Variación trimestral desestacionalizada", id: "F032.PIB.FLU.R.CLP.EP18.Z.Z.1.T", transform: "pop", suffix: "%", decimals: 1 },
          { label: "Nivel (miles de millones de $ encadenados)", id: "F032.PIB.FLU.R.CLP.EP18.Z.Z.0.T", decimals: 0 },
        ],
      },
      {
        key: "pib_anual",
        goodUp: true,
        name: "PIB anual",
        series: [{ id: "F032.PIB.FLU.R.CLP.HIST18.Z.Z.0.A", label: "PIB anual" }],
        transform: "yoy", kind: "bars", suffix: "%", decimals: 1, unit: "variación anual", change: "pp",
        extras: [
          { label: "PIB nominal (miles de millones de $)", id: "F032.PIB.FLU.N.CLP.HIST18.Z.Z.0.A", decimals: 0 },
          { label: "PIB per cápita", id: "F032.PIB.PP.Z.USD.2018.Z.Z.0.A", prefix: "US$", decimals: 0 },
        ],
      },
      {
        key: "demanda_interna",
        goodUp: true,
        name: "Demanda interna",
        series: [{ id: "F033.DDI.FLU.R.CLP.EP18.0.T", label: "Demanda interna" }],
        transform: "yoy", kind: "bars", suffix: "%", decimals: 1, unit: "variación anual", change: "pp",
      },
      {
        key: "consumo_privado",
        goodUp: true,
        name: "Consumo privado",
        series: [{ id: "F033.CPR.FLU.R.CLP.EP18.0.T", label: "Consumo privado" }],
        transform: "yoy", kind: "bars", suffix: "%", decimals: 1, unit: "variación anual", change: "pp",
      },
      {
        key: "consumo_gobierno",
        goodUp: true,
        name: "Consumo de gobierno",
        series: [{ id: "F033.COG.FLU.R.CLP.EP18.0.T", label: "Consumo de gobierno" }],
        transform: "yoy", kind: "bars", suffix: "%", decimals: 1, unit: "variación anual", change: "pp",
      },
      {
        key: "inversion",
        goodUp: true,
        name: "Inversión (formación bruta de capital fijo)",
        series: [{ id: "F033.FKF.FLU.R.CLP.EP18.0.T", label: "Formación bruta de capital fijo" }],
        transform: "yoy", kind: "bars", suffix: "%", decimals: 1, unit: "variación anual", change: "pp",
      },
      {
        key: "exportaciones_cn",
        goodUp: true,
        name: "Exportaciones de bienes y servicios",
        series: [{ id: "F033.XBS.FLU.R.CLP.EP18.0.T", label: "Exportaciones" }],
        transform: "yoy", kind: "bars", suffix: "%", decimals: 1, unit: "variación anual", change: "pp",
      },
      {
        key: "importaciones_cn",
        goodUp: null,
        name: "Importaciones de bienes y servicios",
        series: [{ id: "F033.IBS.FLU.R.CLP.EP18.0.T", label: "Importaciones" }],
        transform: "yoy", kind: "bars", suffix: "%", decimals: 1, unit: "variación anual", change: "pp",
      },
    ],
  },
  {
    id: "precios",
    name: "Precios e inflación",
    short: "Precios",
    intro: "Inflación medida por el IPC del INE y por el IPC sin volátiles, la medida subyacente que excluye los precios más inestables de alimentos y energía.",
    items: [
      {
        key: "ipc_anual",
        goodUp: false,
        name: "Inflación en 12 meses",
        series: [
          { id: "F074.IPC.V12.Z.EP23.C.M", label: "IPC general" },
          { id: "G073.IPCSV.V12.2023.M", label: "IPC sin volátiles" },
        ],
        kind: "line", suffix: "%", decimals: 1, unit: "variación en 12 meses", change: "pp",
        refLine: { value: 3, label: "Meta 3%" },
      },
      {
        key: "ipc_mensual",
        goodUp: false,
        name: "IPC mensual",
        series: [{ id: "F074.IPC.VAR.Z.EP23.C.M", label: "IPC general" }],
        kind: "bars", suffix: "%", decimals: 1, unit: "variación mensual", change: "pp",
        extras: [
          { label: "IPC sin volátiles, variación mensual", id: "G073.IPCSV.VAR.2023.M", suffix: "%", decimals: 1 },
        ],
      },
    ],
  },
  {
    id: "externo",
    name: "Sector externo y tipo de cambio",
    short: "Externo",
    intro: "Comercio de bienes, balanza de pagos, reservas internacionales y tipo de cambio nominal y real.",
    items: [
      {
        key: "balanza_comercial",
        goodUp: true,
        name: "Balanza comercial",
        series: [{ id: "F068.B1.VAR.T0.0.S.N.Z.Z.Z.Z.6.0.M", label: "Saldo comercial" }],
        kind: "bars", prefix: "US$", decimals: 0, unit: "millones de dólares", change: "diff",
      },
      {
        key: "comercio",
        goodUp: true,
        name: "Exportaciones e importaciones de bienes",
        series: [
          { id: "F068.B1.FLU.Z.0.C.N.Z.Z.Z.Z.6.0.M", label: "Exportaciones" },
          { id: "F068.B1.FLU.Z.0.D.N.0.T.Z.Z.6.0.M", label: "Importaciones" },
        ],
        kind: "line", prefix: "US$", decimals: 0, unit: "millones de dólares", change: "pct",
      },
      {
        key: "cuenta_corriente",
        goodUp: true,
        name: "Balanza de pagos: cuenta corriente",
        series: [{ id: "F068.A.FLU.Z.0.S.N.Z.Z.Z.Z.6.0.T", label: "Cuenta corriente" }],
        kind: "bars", prefix: "US$", decimals: 0, unit: "millones de dólares", change: "diff",
        extras: [
          { label: "Cuenta corriente, % del PIB (12 meses)", id: "F068.A.PFA18.Z.0.S.N.Z.Z.Z.Z.6.0.T", suffix: "%", decimals: 1 },
        ],
      },
      {
        key: "reservas",
        goodUp: true,
        name: "Reservas internacionales",
        series: [{ id: "F062.A5.STO.PF.USD.M", label: "Reservas internacionales" }],
        kind: "line", prefix: "US$", decimals: 0, unit: "millones de dólares", change: "pct",
      },
      {
        key: "tcn",
        goodUp: false,
        name: "Tipo de cambio nominal",
        series: [{ id: "F073.TCO.PRE.Z.D", label: "Dólar observado" }],
        kind: "line", prefix: "$", decimals: 2, unit: "pesos por dólar", change: "pct",
      },
      {
        key: "tcr",
        goodUp: null,
        name: "Tipo de cambio real",
        series: [{ id: "F073.TCR.IND.199101.M", label: "Tipo de cambio real" }],
        kind: "line", decimals: 2, unit: "índice, promedio 1986 = 100", change: "pct",
      },
    ],
  },
  {
    id: "laboral",
    name: "Mercado laboral y monetario",
    short: "Laboral",
    intro: "Empleo y desocupación de la Encuesta Nacional de Empleo del INE, junto a los agregados monetarios y el crédito bancario.",
    items: [
      {
        key: "desocupacion",
        goodUp: false,
        name: "Tasa de desocupación",
        series: [{ id: "F049.DES.TAS.INE.10.M", label: "Tasa de desocupación" }],
        kind: "line", suffix: "%", decimals: 1, unit: "de la fuerza de trabajo", change: "pp",
        extras: [
          { label: "Tasa sin ajuste estacional", id: "F049.DES.TAS.INE9.10.M", suffix: "%", decimals: 1 },
        ],
      },
      {
        key: "ocupados",
        goodUp: true,
        name: "Empleo",
        series: [{ id: "F049.OCU.PMT.INE.10.M", label: "Personas ocupadas" }],
        kind: "line", decimals: 0, unit: "miles de personas", change: "pct",
        extras: [
          { label: "Fuerza de trabajo (miles)", id: "F049.FTR.PMT.INE.10.M", decimals: 0 },
        ],
      },
      {
        key: "agregados",
        goodUp: null,
        name: "Agregados monetarios M1, M2 y M3",
        series: [
          { id: "F021.M1.STO.N.CLP.5.M", label: "M1" },
          { id: "F021.M2.STO.N.CLP.5.M", label: "M2" },
          { id: "F021.M3.STO.N.CLP.5.M", label: "M3" },
        ],
        kind: "line", prefix: "$", decimals: 0, unit: "miles de millones de pesos", change: "pct",
      },
      {
        key: "colocaciones",
        goodUp: true,
        name: "Créditos bancarios (colocaciones)",
        series: [{ id: "F022.COL.PRO.Z.Z.CLP.M", label: "Colocaciones" }],
        kind: "line", prefix: "$", decimals: 0, unit: "miles de millones de pesos", change: "pct",
        extras: [
          { label: "Variación anual", id: "F022.COL.PRO.Z.Z.CLP.M", transform: "yoy", suffix: "%", decimals: 1 },
        ],
      },
    ],
  },
  {
    id: "convertir",
    type: "converter",
    name: "Convertir",
    short: "Convertir",
    intro: "Convierte un monto entre pesos chilenos y otra unidad con el valor oficial de la fecha que elijas. Puedes escribir en cualquiera de los dos campos.",
    units: [
      { id: "F073.UFF.PRE.Z.D", group: "Unidades reajustables", code: "UF", name: "Unidad de Fomento", plural: "UF", decimals: 4 },
      { id: "F073.UTR.PRE.Z.M", group: "Unidades reajustables", code: "UTM", name: "Unidad Tributaria Mensual", plural: "UTM", decimals: 4 },
      { id: "F073.TCO.PRE.Z.D", group: "Monedas", code: "US$", name: "Dólar observado", plural: "dólares", decimals: 2 },
      { id: "F072.CLP.EUR.N.O.D", group: "Monedas", code: "€", name: "Euro", plural: "euros", decimals: 2 },
      { id: "F072.CLP.GBP.N.O.D", group: "Monedas", code: "£", name: "Libra esterlina", plural: "libras", decimals: 2 },
      { id: "F072.CLP.CNY.N.O.D", group: "Monedas", code: "CNY", name: "Yuan chino", plural: "yuanes", decimals: 2 },
      { id: "F072.CLP.JPY.N.O.D", group: "Monedas", code: "¥", name: "Yen japonés", plural: "yenes", decimals: 0 },
      { id: "F072.CLP.BRL.N.O.D", group: "Monedas", code: "R$", name: "Real brasileño", plural: "reales", decimals: 2 },
      { id: "F072.CLP.ARS.N.O.D", group: "Monedas", code: "ARS", name: "Peso argentino", plural: "pesos argentinos", decimals: 2 },
      { id: "F072.CLP.PEN.N.O.D", group: "Monedas", code: "S/", name: "Sol peruano", plural: "soles", decimals: 2 },
      { id: "F072.CLP.MXN.N.O.D", group: "Monedas", code: "MXN", name: "Peso mexicano", plural: "pesos mexicanos", decimals: 2 },
      { id: "F072.CLP.UYU.N.O.D", group: "Monedas", code: "UYU", name: "Peso uruguayo", plural: "pesos uruguayos", decimals: 2 },
      // El BCCh publica pesos por guaraní redondeado a $0,16; se calcula con el dólar observado y la paridad (guaraníes por dólar).
      { id: "F072.CLP.PYG.N.O.D", cross: { dollar: "F073.TCO.PRE.Z.D", parity: "F072.PYG.USD.N.O.D" }, group: "Monedas", code: "PYG", name: "Guaraní paraguayo", plural: "guaraníes", decimals: 0 },
    ],
  },
  {
    id: "personalizado",
    type: "personal",
    name: "Personalizado",
    short: "Mi panel",
    intro: "Tu propia pestaña con los indicadores y series que elijas, incluidas monedas, materias primas, bolsas y tasas que no aparecen en las otras secciones.",
  },
];
