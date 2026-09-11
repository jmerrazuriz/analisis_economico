/* Explicación de cada indicador: un resumen breve y la sección "¿Cómo se calcula?",
   con una versión en palabras y otra en fórmulas (TeX, dibujadas con KaTeX).
   Las claves coinciden con "key" en indicators.js. */
(function () {
  "use strict";

  // Variación porcentual respecto a "lag" períodos atrás.
  const change = (symbol, lag, caption) => ({
    tex: String.raw`\Delta\%_t = \left(\dfrac{${symbol}_t}{${symbol}_{t-${lag}}} - 1\right) \times 100`,
    caption,
  });

  const dolarHow = {
    words: [
      "El Banco Central reúne todas las compras y ventas de dólares al contado (spot) que hicieron los bancos y las demás entidades del mercado cambiario formal durante un día hábil.",
      "Con esas operaciones calcula un precio promedio en el que las operaciones de mayor monto pesan más, y lo publica como el dólar observado del día hábil siguiente.",
    ],
    formulas: [
      {
        tex: String.raw`\text{DO}_t = \dfrac{\displaystyle\sum_{i=1}^{N} P_{i,\,t-1}\, M_{i,\,t-1}}{\displaystyle\sum_{i=1}^{N} M_{i,\,t-1}}`,
        caption: "Promedio de precios ponderado por monto, con las operaciones del día hábil anterior.",
      },
      change(String.raw`\text{DO}`, 1, "Variación respecto al dato anterior que se muestra al costado."),
    ],
    symbols: [
      [String.raw`P_{i,\,t-1}`, "precio de la operación i, en pesos por dólar"],
      [String.raw`M_{i,\,t-1}`, "monto de la operación i, en dólares"],
      [String.raw`N`, "número de operaciones del día"],
    ],
  };

  window.EXPLANATIONS = {
    dolar: {
      summary: "Es el precio de referencia del dólar en pesos. Se usa en contratos, en la contabilidad de las empresas y para convertir a pesos montos expresados en dólares.",
      ...dolarHow,
    },

    euro: {
      summary: "Precio de un euro en pesos. Sirve de referencia para el comercio y los pagos con la zona euro.",
      words: [
        "En Chile no existe un mercado del euro tan profundo como el del dólar, por lo que el Banco Central cruza dos precios del mismo día: cuántos pesos vale un dólar (el dólar observado) y cuántos dólares vale un euro en los mercados internacionales.",
        "Multiplicar ambos entrega cuántos pesos vale un euro.",
      ],
      formulas: [
        { tex: String.raw`\text{EUR}_t = \text{DO}_t \times \left(\dfrac{\text{USD}}{\text{EUR}}\right)_t`, caption: "Tipo de cambio cruzado." },
        change(String.raw`\text{EUR}`, 1, "Variación respecto al dato anterior."),
      ],
      symbols: [
        [String.raw`\text{DO}_t`, "dólar observado, en pesos por dólar"],
        [String.raw`\left(\tfrac{\text{USD}}{\text{EUR}}\right)_t`, "dólares por euro en el mercado internacional"],
      ],
    },

    uf: {
      summary: "Unidad de cuenta que conserva su poder de compra porque sube con la inflación. Se usa en créditos hipotecarios, arriendos, seguros y contratos de largo plazo.",
      words: [
        "Entre el día 10 de un mes y el día 9 del mes siguiente, la UF sube un poco cada día.",
        "La tasa de reajuste es la variación del IPC del mes anterior, que el INE publica a comienzos de mes. Esa inflación se reparte en partes iguales, de forma compuesta, entre los días del período, de modo que al llegar al día 9 la UF acumula exactamente esa variación.",
        "Por eso el valor de la UF se conoce por adelantado: apenas se publica el IPC ya se saben todos los valores hasta el día 9 del mes siguiente. Si el IPC baja, la UF también baja.",
      ],
      formulas: [
        {
          tex: String.raw`\text{UF}_d = \text{UF}_{d-1}\,\left(1 + \pi_{m-1}\right)^{1/D}`,
          caption: "Reajuste diario entre el día 10 del mes m y el día 9 del mes m + 1 (se redondea a dos decimales).",
        },
        {
          tex: String.raw`\text{UF}_{9,\;m+1} = \text{UF}_{9,\;m}\,\left(1 + \pi_{m-1}\right)`,
          caption: "Resultado del período completo: la UF sube justo la inflación mensual.",
        },
      ],
      symbols: [
        [String.raw`\pi_{m-1}`, "variación mensual del IPC del mes anterior, en decimales (0,6% = 0,006)"],
        [String.raw`D`, "número de días del mes en que comienza el período"],
        [String.raw`\text{UF}_{d-1}`, "valor de la UF el día anterior"],
      ],
    },

    utm: {
      summary: "Unidad tributaria que se reajusta cada mes con la inflación. Se usa para calcular impuestos, multas, patentes y otros montos fijados por ley.",
      words: [
        "La publica el Servicio de Impuestos Internos. Cada mes toma el valor del mes anterior y lo reajusta según la variación del IPC de dos meses antes; por ejemplo, la UTM de septiembre usa la inflación de julio.",
        "El resultado se redondea a pesos enteros y rige durante todo el mes.",
      ],
      formulas: [
        {
          tex: String.raw`\text{UTM}_m = \operatorname{redondeo}\big(\text{UTM}_{m-1}\,(1 + \pi_{m-2})\big)`,
          caption: "Reajuste mensual.",
        },
        change(String.raw`\text{UTM}`, 1, "Variación respecto al mes anterior."),
      ],
      symbols: [
        [String.raw`\pi_{m-2}`, "variación mensual del IPC de dos meses antes, en decimales"],
        [String.raw`\text{UTM}_{m-1}`, "valor de la UTM del mes anterior"],
      ],
    },

    tpm: {
      summary: "Tasa de interés que el Banco Central usa como su principal herramienta para mantener la inflación cerca de 3%. Influye en el costo de los créditos y en la rentabilidad del ahorro.",
      words: [
        "La TPM no sale de una fórmula: la decide el Consejo del Banco Central en sus Reuniones de Política Monetaria, según cómo proyecta la inflación y la actividad de los próximos dos años.",
        "Una vez fijada, el Banco Central entrega o retira liquidez para que la tasa a la que los bancos se prestan entre sí de un día para otro (la tasa interbancaria) quede en torno a la TPM.",
        "El swap promedio cámara (SPC) a 90 días es la tasa fija que el mercado acepta hoy a cambio de recibir la tasa interbancaria de los próximos 90 días. Por eso refleja lo que el mercado espera que ocurra con la TPM.",
      ],
      formulas: [
        { tex: String.raw`i^{\text{interbancaria}}_t \approx \text{TPM}_t`, caption: "Objetivo operativo del Banco Central." },
        {
          tex: String.raw`1 + \text{SPC}_{90}\cdot\dfrac{90}{360} = \prod_{j=1}^{n}\left(1 + i_j\,\dfrac{d_j}{360}\right)`,
          caption: "El swap iguala una tasa fija con la tasa interbancaria capitalizada durante 90 días.",
        },
        {
          tex: String.raw`\text{TPM}_t = r^{*} + \pi^{e}_t + \alpha\,(\pi^{e}_t - 3\%) + \beta\,\text{brecha}_t`,
          caption: "Regla de Taylor: referencia académica de cómo reacciona una tasa de política. No es la fórmula oficial.",
        },
      ],
      symbols: [
        [String.raw`i_j,\ d_j`, "tasa interbancaria del día j y días en que rige"],
        [String.raw`r^{*}`, "tasa de interés real neutral"],
        [String.raw`\pi^{e}_t`, "inflación esperada"],
        [String.raw`\text{brecha}_t`, "diferencia porcentual entre el PIB efectivo y su tendencia"],
        [String.raw`\alpha,\ \beta`, "intensidad de la reacción ante inflación y actividad"],
      ],
    },

    imacec: {
      summary: "Estimación mensual de la producción de bienes y servicios de la economía. Es el termómetro más rápido del crecimiento, ya que el PIB se publica solo cada trimestre.",
      words: [
        "El Banco Central reúne indicadores de producción de cada sector (minería, industria, comercio, servicios y otros) y los combina según el peso de cada actividad en la economía del año anterior.",
        "El resultado es un índice de volumen encadenado con referencia 2018 = 100: mide cantidades producidas, sin el efecto de los precios.",
        "Las columnas comparan cada mes con el mismo mes del año anterior, lo que elimina los efectos estacionales. La serie desestacionalizada permite comparar un mes con el anterior.",
      ],
      formulas: [
        {
          tex: String.raw`I_t = \bar I_{a-1}\times\dfrac{\sum_s \bar p_{s,\,a-1}\; q_{s,\,t}}{\sum_s \bar p_{s,\,a-1}\; \bar q_{s,\,a-1}}`,
          caption: "Índice de volumen a precios del año anterior, encadenado año a año.",
        },
        change("I", 12, "Variación anual, la que muestran las columnas."),
        {
          tex: String.raw`\Delta\%^{\text{m/m}}_t = \left(\dfrac{I^{d}_t}{I^{d}_{t-1}} - 1\right)\times 100`,
          caption: "Variación mensual con la serie desestacionalizada (método X-13ARIMA-SEATS).",
        },
      ],
      symbols: [
        [String.raw`q_{s,\,t}`, "volumen producido por el sector s en el mes t"],
        [String.raw`\bar p_{s,\,a-1},\ \bar q_{s,\,a-1}`, "precio y volumen promedio del sector s el año anterior"],
        [String.raw`\bar I_{a-1}`, "promedio del índice el año anterior"],
        [String.raw`I^{d}_t`, "índice desestacionalizado"],
      ],
    },

    pib_trimestral: {
      summary: "Valor de todos los bienes y servicios finales producidos en Chile durante un trimestre. Su variación es la medida oficial del crecimiento económico.",
      words: [
        "El PIB se puede medir por tres caminos que deben coincidir: sumando lo que agrega cada actividad productiva, sumando el gasto en consumo, inversión y exportaciones netas, o sumando los ingresos que se generan.",
        "Para medir el crecimiento real, el Banco Central valora las cantidades a precios del año anterior y encadena los años (referencia 2018), de modo que la inflación no infle el resultado.",
        "Las columnas comparan cada trimestre con el mismo trimestre del año anterior.",
      ],
      formulas: [
        { tex: String.raw`\text{PIB} = \sum_s \text{VA}_s + \text{Impuestos netos sobre productos}`, caption: "Enfoque de la producción." },
        { tex: String.raw`\text{PIB} = C + G + \text{FBCF} + \Delta E + X - M`, caption: "Enfoque del gasto." },
        change(String.raw`\text{PIB}`, 4, "Variación anual, la que muestran las columnas."),
        {
          tex: String.raw`\Delta\%^{\text{t/t}}_t = \left(\dfrac{\text{PIB}^{d}_t}{\text{PIB}^{d}_{t-1}} - 1\right)\times 100`,
          caption: "Variación respecto al trimestre anterior, con la serie desestacionalizada.",
        },
      ],
      symbols: [
        [String.raw`\text{VA}_s`, "valor agregado del sector s: producción menos consumo intermedio"],
        [String.raw`C,\ G`, "consumo de hogares y consumo de gobierno"],
        [String.raw`\text{FBCF},\ \Delta E`, "inversión fija y variación de existencias"],
        [String.raw`X,\ M`, "exportaciones e importaciones"],
      ],
    },

    pib_anual: {
      summary: "Producción total de la economía en un año calendario. Su variación es la tasa de crecimiento anual de Chile.",
      words: [
        "Se construye con la misma metodología que el PIB trimestral, pero para el año completo, en volumen a precios del año anterior encadenados.",
        "Cada columna compara el volumen de un año con el del año anterior. El PIB nominal usa precios corrientes, así que incluye la inflación. El PIB per cápita en dólares divide el PIB nominal convertido a dólares por la población.",
      ],
      formulas: [
        change(String.raw`\text{PIB}`, 1, "Crecimiento anual (t es el año)."),
        {
          tex: String.raw`\text{PIB per cápita}_t = \dfrac{\text{PIB nominal}_t \,/\, \overline{\text{TC}}_t}{\text{Población}_t}`,
          caption: "PIB por habitante expresado en dólares.",
        },
      ],
      symbols: [
        [String.raw`\overline{\text{TC}}_t`, "tipo de cambio promedio del año, en pesos por dólar"],
      ],
    },

    demanda_interna: {
      summary: "Todo lo que gastan en consumo e inversión los hogares, las empresas y el gobierno dentro del país, sin importar si lo comprado se produjo en Chile o en el extranjero.",
      words: [
        "Suma el consumo privado, el consumo de gobierno y la formación bruta de capital, que es la inversión fija más la variación de existencias.",
        "La diferencia con el PIB son las exportaciones netas: cuando la demanda interna crece más que el PIB, normalmente suben las importaciones.",
      ],
      formulas: [
        { tex: String.raw`\text{DI} = C + G + \text{FBCF} + \Delta E`, caption: "Composición de la demanda interna." },
        { tex: String.raw`\text{PIB} = \text{DI} + X - M`, caption: "Relación con el PIB." },
        change(String.raw`\text{DI}`, 4, "Variación anual, en volumen."),
      ],
      symbols: [
        [String.raw`C,\ G`, "consumo privado y consumo de gobierno"],
        [String.raw`\text{FBCF},\ \Delta E`, "inversión fija y variación de existencias"],
      ],
    },

    consumo_privado: {
      summary: "Gasto de los hogares en bienes y servicios como alimentos, vestuario, autos o salud. Es el componente más grande del PIB por el lado del gasto.",
      words: [
        "Se estima con información de ventas del comercio, producción e importaciones de bienes de consumo y encuestas de servicios. Incluye a las instituciones privadas sin fines de lucro que sirven a los hogares.",
        "Se divide en bienes durables, bienes no durables y servicios, y se mide en volumen encadenado para excluir el efecto de los precios.",
      ],
      formulas: [
        { tex: String.raw`C = C^{\text{durables}} + C^{\text{no durables}} + C^{\text{servicios}}`, caption: "Componentes del consumo privado." },
        change("C", 4, "Variación anual, en volumen."),
      ],
      symbols: [],
    },

    consumo_gobierno: {
      summary: "Valor de los servicios que el Estado entrega a la población, como educación, salud, seguridad y administración pública.",
      words: [
        "Como la mayoría de estos servicios no se venden a precio de mercado, se valoran por lo que cuesta producirlos: remuneraciones de los funcionarios, compras de bienes y servicios y desgaste del capital público.",
        "A ese costo se le restan los ingresos por ventas que obtiene el propio gobierno.",
      ],
      formulas: [
        {
          tex: String.raw`G = \text{Remuneraciones} + \text{Consumo intermedio} + \text{Consumo de capital fijo} - \text{Ventas}`,
          caption: "Valoración al costo de producción.",
        },
        change("G", 4, "Variación anual, en volumen."),
      ],
      symbols: [],
    },

    inversion: {
      summary: "Gasto en bienes que se usan para producir por más de un año: edificios, obras de infraestructura, maquinaria y equipos. Anticipa la capacidad futura de la economía para crecer.",
      words: [
        "Suma la inversión en construcción y otras obras (viviendas, edificios, caminos, obras mineras) y la inversión en maquinaria y equipos, incluidos los importados.",
        "Se mide en volumen encadenado, a precios del año anterior.",
      ],
      formulas: [
        { tex: String.raw`\text{FBCF} = \text{Construcción y otras obras} + \text{Maquinaria y equipos}`, caption: "Desagregación que publica el Banco Central." },
        change(String.raw`\text{FBCF}`, 4, "Variación anual, en volumen."),
      ],
      symbols: [],
    },

    exportaciones_cn: {
      summary: "Volumen de bienes y servicios que Chile vende al resto del mundo, como cobre, fruta, celulosa o servicios a turistas extranjeros.",
      words: [
        "Se basa en los registros de aduanas para los bienes y en encuestas para los servicios. Se expresa en volumen encadenado para aislar el efecto de los precios, por ejemplo del cobre.",
        "Por eso el valor exportado en dólares puede subir aunque el volumen caiga, y al revés.",
      ],
      formulas: [
        { tex: String.raw`X^{\text{vol}}_t = \dfrac{X^{\text{valor}}_t}{P^{X}_t}`, caption: "El volumen es el valor dividido por un índice de precios de exportación." },
        change("X", 4, "Variación anual, en volumen."),
      ],
      symbols: [[String.raw`P^{X}_t`, "índice de precios de las exportaciones"]],
    },

    importaciones_cn: {
      summary: "Volumen de bienes y servicios que Chile compra al exterior, como combustibles, maquinaria, vehículos y bienes de consumo.",
      words: [
        "Se basa en los registros de aduanas y en encuestas de servicios, y se mide en volumen encadenado para excluir el efecto de los precios y del tipo de cambio.",
        "Suele moverse junto con la demanda interna: cuando crecen el consumo y la inversión, aumentan las compras al exterior.",
      ],
      formulas: [
        { tex: String.raw`M^{\text{vol}}_t = \dfrac{M^{\text{valor}}_t}{P^{M}_t}`, caption: "El volumen es el valor dividido por un índice de precios de importación." },
        change("M", 4, "Variación anual, en volumen."),
      ],
      symbols: [[String.raw`P^{M}_t`, "índice de precios de las importaciones"]],
    },

    ipc_anual: {
      summary: "Mide cuánto subieron los precios de una canasta representativa de bienes y servicios en los últimos 12 meses. El Banco Central busca que se mantenga en torno a 3%.",
      words: [
        "Cada mes el INE registra precios de cientos de productos en todo el país y arma el Índice de Precios al Consumidor (IPC), en el que cada producto pesa según su importancia en el gasto de los hogares (canasta base 2023).",
        "La inflación en 12 meses compara el IPC de este mes con el del mismo mes del año anterior.",
        "El IPC sin volátiles quita los productos con precios más inestables, como frutas y verduras frescas y combustibles, y reparte su peso entre el resto. Así muestra la tendencia de fondo de la inflación (inflación subyacente).",
      ],
      formulas: [
        { tex: String.raw`\text{IPC}_t = 100 \times \sum_i w_i\,\dfrac{P_{i,\,t}}{P_{i,\,0}}`, caption: "Índice ponderado de la canasta (tipo Laspeyres)." },
        {
          tex: String.raw`\pi^{12m}_t = \left(\dfrac{\text{IPC}_t}{\text{IPC}_{t-12}} - 1\right)\times 100`,
          caption: "Inflación en 12 meses.",
        },
        {
          tex: String.raw`\text{IPCSV}_t = 100 \times \sum_{i \notin V} \dfrac{w_i}{\sum_{j \notin V} w_j}\,\dfrac{P_{i,\,t}}{P_{i,\,0}}`,
          caption: "Misma canasta sin el grupo V de productos volátiles.",
        },
      ],
      symbols: [
        [String.raw`w_i`, "peso del producto i en la canasta (los pesos suman 1)"],
        [String.raw`P_{i,\,t},\ P_{i,\,0}`, "precio del producto i en el mes t y en el período base"],
        [String.raw`V`, "conjunto de productos volátiles"],
      ],
    },

    ipc_mensual: {
      summary: "Cambio de los precios de la canasta del IPC respecto al mes anterior. Es el dato que el INE publica cada mes y el que usa la UF para reajustarse.",
      words: [
        "Compara el índice del mes con el del mes anterior. Una variación positiva indica que, en promedio, los precios subieron; una negativa, que bajaron.",
        "Dentro de cada producto, el INE combina los precios que recoge en distintos puntos de venta con un promedio geométrico antes de agregarlos a la canasta.",
        "Encadenar las variaciones de 12 meses seguidos entrega la inflación anual.",
      ],
      formulas: [
        {
          tex: String.raw`\pi^{m}_t = \left(\dfrac{\text{IPC}_t}{\text{IPC}_{t-1}} - 1\right)\times 100`,
          caption: "Variación mensual.",
        },
        {
          tex: String.raw`I_{e,\,t} = \prod_{k=1}^{n}\left(\dfrac{p_{k,\,t}}{p_{k,\,0}}\right)^{1/n}`,
          caption: "Índice elemental de un producto: media geométrica de sus n cotizaciones.",
        },
        {
          tex: String.raw`1 + \dfrac{\pi^{12m}_t}{100} = \prod_{j=0}^{11}\left(1 + \dfrac{\pi^{m}_{t-j}}{100}\right)`,
          caption: "Relación entre inflación mensual y anual.",
        },
      ],
      symbols: [[String.raw`p_{k,\,t}`, "precio de la cotización k del producto en el mes t"]],
    },

    balanza_comercial: {
      summary: "Diferencia entre lo que Chile exporta e importa en bienes cada mes. Un saldo positivo (superávit) indica que entran más dólares por ventas al exterior que los que salen por compras.",
      words: [
        "Se calcula con el valor de las exportaciones e importaciones de bienes, ambas valoradas FOB: el precio del bien puesto en el puerto de embarque, sin fletes ni seguros internacionales.",
        "Las importaciones se registran en aduana a valor CIF, que sí incluye fletes y seguros, por lo que se ajustan antes de restar. Las cifras están en millones de dólares corrientes.",
      ],
      formulas: [
        { tex: String.raw`\text{BC}_t = X^{\text{FOB}}_t - M^{\text{FOB}}_t`, caption: "Saldo de la balanza comercial." },
        { tex: String.raw`M^{\text{FOB}}_t = M^{\text{CIF}}_t - \text{Fletes}_t - \text{Seguros}_t`, caption: "Ajuste de las importaciones." },
        { tex: String.raw`\Delta_t = \text{BC}_t - \text{BC}_{t-1}`, caption: "Cambio respecto al mes anterior, en millones de dólares." },
      ],
      symbols: [],
    },

    comercio: {
      summary: "Valor en dólares de los bienes que Chile vende y compra al exterior cada mes. Refleja tanto las cantidades como los precios, por ejemplo el del cobre.",
      words: [
        "Los datos provienen de las declaraciones de aduana, que el Banco Central ajusta al criterio de balanza de pagos, es decir, al momento en que cambia la propiedad del bien.",
        "Cada operación se valora como precio por cantidad y se suman todas las del mes.",
      ],
      formulas: [
        { tex: String.raw`X_t = \sum_k p^{\text{FOB}}_{k,\,t}\; q_{k,\,t}`, caption: "Exportaciones del mes (lo mismo para importaciones)." },
        change("X", 1, "Variación respecto al mes anterior."),
      ],
      symbols: [
        [String.raw`p^{\text{FOB}}_{k,\,t}`, "precio FOB del envío k, en dólares"],
        [String.raw`q_{k,\,t}`, "cantidad del envío k"],
      ],
    },

    cuenta_corriente: {
      summary: "Resume todas las transacciones corrientes de Chile con el resto del mundo. Un déficit indica que el país gasta más de lo que genera y se financia con recursos del exterior.",
      words: [
        "Suma cuatro saldos: bienes (la balanza comercial), servicios (turismo, fletes, servicios profesionales), ingreso primario (utilidades e intereses que se pagan o reciben del exterior) e ingreso secundario (transferencias como las remesas).",
        "Se publica cada trimestre según el Manual de Balanza de Pagos del FMI. La razón respecto al PIB suma los últimos cuatro trimestres para evitar efectos estacionales.",
      ],
      formulas: [
        {
          tex: String.raw`\text{CC} = (X_b - M_b) + (X_s - M_s) + \text{IP}_{\text{neto}} + \text{IS}_{\text{neto}}`,
          caption: "Componentes de la cuenta corriente.",
        },
        { tex: String.raw`\text{CC} = S - I`, caption: "Equivale al ahorro nacional menos la inversión." },
        {
          tex: String.raw`\dfrac{\text{CC}}{\text{PIB}}\bigg|_{12m} = \dfrac{\sum_{j=0}^{3} \text{CC}_{t-j}}{\sum_{j=0}^{3} \text{PIB}^{\text{US\$}}_{t-j}} \times 100`,
          caption: "Razón respecto al PIB de los últimos cuatro trimestres.",
        },
      ],
      symbols: [
        [String.raw`X_b,\ M_b,\ X_s,\ M_s`, "exportaciones e importaciones de bienes y de servicios"],
        [String.raw`\text{IP},\ \text{IS}`, "ingreso primario y secundario, recibido menos pagado"],
        [String.raw`S,\ I`, "ahorro nacional e inversión"],
      ],
    },

    reservas: {
      summary: "Activos en moneda extranjera que el Banco Central mantiene disponibles para enfrentar crisis, intervenir en el mercado cambiario o cumplir pagos con el exterior.",
      words: [
        "Incluyen depósitos e inversiones en bonos de otros países (divisas), oro, derechos especiales de giro (DEG) y la posición de reserva en el FMI.",
        "Se valoran a precios de mercado y se expresan en dólares. Por eso cambian no solo cuando el Banco Central compra o vende, sino también por los intereses ganados y por las variaciones en el valor de otras monedas y de los bonos.",
      ],
      formulas: [
        { tex: String.raw`\text{RI} = \text{Divisas} + \text{Oro} + \text{DEG} + \text{Posición en el FMI} + \text{Otros}`, caption: "Composición de las reservas." },
        { tex: String.raw`\Delta\text{RI}_t = \text{Operaciones}_t + \text{Intereses}_t + \text{Revalorización}_t`, caption: "Qué explica su cambio en un mes." },
      ],
      symbols: [],
    },

    tcn: {
      summary: "Cantidad de pesos que se necesita para comprar un dólar. Cuando sube, el peso se deprecia; cuando baja, se aprecia.",
      ...dolarHow,
    },

    tcr: {
      summary: "Compara el poder de compra del peso con el de las monedas de los principales socios comerciales, descontando la inflación de cada país. Un alza indica que el peso se deprecia en términos reales y que los productos chilenos se abaratan frente a los extranjeros.",
      words: [
        "Para cada socio comercial se calcula un tipo de cambio real bilateral: el tipo de cambio nominal multiplicado por los precios del socio y dividido por los precios de Chile.",
        "Luego se combinan con un promedio geométrico en el que cada país pesa según su importancia en el comercio de Chile. El índice vale 100 en el promedio de 1986.",
      ],
      formulas: [
        { tex: String.raw`\text{TCR}_{j,\,t} = \dfrac{E_{j,\,t}\; P^{*}_{j,\,t}}{P_t}`, caption: "Tipo de cambio real bilateral con el socio j." },
        {
          tex: String.raw`\text{TCR}_t = 100 \times \prod_j \left(\dfrac{\text{TCR}_{j,\,t}}{\text{TCR}_{j,\,1986}}\right)^{w_j}`,
          caption: "Índice multilateral (promedio geométrico ponderado).",
        },
      ],
      symbols: [
        [String.raw`E_{j,\,t}`, "pesos por unidad de la moneda del socio j"],
        [String.raw`P^{*}_{j,\,t}`, "índice de precios del socio j"],
        [String.raw`P_t`, "IPC de Chile"],
        [String.raw`w_j`, "peso del socio j en el comercio (los pesos suman 1)"],
      ],
    },

    desocupacion: {
      summary: "Porcentaje de las personas que quieren trabajar y buscan empleo pero no lo encuentran. Es el principal indicador de holgura del mercado laboral.",
      words: [
        "El INE aplica la Encuesta Nacional de Empleo y clasifica a las personas de 15 años o más en ocupadas, desocupadas o fuera de la fuerza de trabajo.",
        "Una persona está desocupada si no trabajó en la semana de referencia, buscó empleo en las últimas cuatro semanas y está disponible para empezar a trabajar.",
        "Las cifras son promedios de trimestres móviles. La serie ajustada estacionalmente quita patrones que se repiten cada año, como el empleo agrícola de temporada.",
      ],
      formulas: [
        { tex: String.raw`\text{TD}_t = \dfrac{D_t}{\text{FT}_t}\times 100`, caption: "Tasa de desocupación." },
        { tex: String.raw`\text{FT}_t = O_t + D_t`, caption: "Fuerza de trabajo." },
        { tex: String.raw`\Delta_{\text{pp}} = \text{TD}_t - \text{TD}_{t-1}`, caption: "Cambio en puntos porcentuales respecto al dato anterior." },
      ],
      symbols: [
        [String.raw`D_t`, "personas desocupadas"],
        [String.raw`O_t`, "personas ocupadas"],
        [String.raw`\text{FT}_t`, "fuerza de trabajo"],
      ],
    },

    ocupados: {
      summary: "Número de personas que tienen trabajo en Chile. Su evolución muestra si la economía está creando o destruyendo empleos.",
      words: [
        "Según la Encuesta Nacional de Empleo del INE, una persona está ocupada si trabajó al menos una hora en la semana de referencia a cambio de un pago, o si tiene un empleo del que estuvo temporalmente ausente.",
        "Como la encuesta se aplica a una muestra de hogares, cada persona encuestada representa a muchas otras según su factor de expansión.",
      ],
      formulas: [
        { tex: String.raw`O_t = \sum_{i\,\in\,\text{muestra}} f_i \cdot \mathbf{1}[\,i \text{ está ocupada}\,]`, caption: "Estimación del total de ocupados." },
        { tex: String.raw`\text{TO}_t = \dfrac{O_t}{\text{PET}_t}\times 100`, caption: "Tasa de ocupación, como referencia." },
        change("O", 1, "Variación respecto al dato anterior."),
      ],
      symbols: [
        [String.raw`f_i`, "factor de expansión de la persona encuestada i"],
        [String.raw`\text{PET}_t`, "población en edad de trabajar (15 años o más)"],
      ],
    },

    agregados: {
      summary: "Miden la cantidad de dinero en la economía, desde el efectivo y las cuentas corrientes (M1) hasta formas de ahorro menos líquidas (M3). Ayudan a seguir las condiciones financieras y el gasto.",
      words: [
        "M1 agrupa el dinero que se puede usar de inmediato: billetes y monedas en poder del público y depósitos a la vista, como las cuentas corrientes.",
        "M2 suma a M1 los depósitos a plazo, los depósitos de ahorro a plazo, las cuotas de fondos mutuos de corto plazo y los depósitos en cooperativas de ahorro y crédito.",
        "M3 agrega instrumentos de ahorro menos líquidos: depósitos en moneda extranjera, documentos del Banco Central y de la Tesorería, letras hipotecarias, bonos de empresas, cuotas del resto de los fondos mutuos y ahorro voluntario en AFP. Para no contar dos veces, se descuenta lo que los fondos mutuos y las AFP ya tienen invertido dentro de estos agregados.",
      ],
      formulas: [
        { tex: String.raw`\text{M1} = \text{Circulante} + \text{Depósitos a la vista}`, caption: "Dinero de uso inmediato." },
        {
          tex: String.raw`\text{M2} = \text{M1} + \text{Depósitos a plazo} + \text{Ahorro a plazo} + \text{FM corto plazo} + \text{Cooperativas} - \text{FM en M2}`,
          caption: "Agregado intermedio.",
        },
        {
          tex: String.raw`\text{M3} = \text{M2} + \text{Depósitos en US\$} + \text{Documentos BCCh y Tesorería} + \text{Letras y bonos} + \text{Resto FM} + \text{APV} - \text{FM y AFP en M3}`,
          caption: "Agregado amplio.",
        },
        change(String.raw`\text{M}`, 1, "Variación respecto al mes anterior."),
      ],
      symbols: [
        [String.raw`\text{FM}`, "fondos mutuos"],
        [String.raw`\text{APV}`, "ahorro previsional voluntario en AFP"],
      ],
    },

    colocaciones: {
      summary: "Monto total de créditos en pesos que el sistema bancario ha entregado a empresas y personas: comerciales, de consumo e hipotecarios. Muestra qué tan dinámico está el crédito.",
      words: [
        "Considera el saldo de los préstamos vigentes en moneda nacional, reajustables y no reajustables, al sector público y privado.",
        "La serie es un promedio mensual de los saldos diarios, lo que suaviza los movimientos de fin de mes. La variación anual es nominal, es decir, incluye la inflación; para verla en términos reales hay que descontar el IPC.",
      ],
      formulas: [
        { tex: String.raw`\bar C_m = \dfrac{1}{D_m}\sum_{d=1}^{D_m} C_d`, caption: "Promedio mensual de los saldos diarios." },
        change(String.raw`\bar C`, 12, "Variación anual nominal."),
        {
          tex: String.raw`\Delta\%^{\text{real}} = \left(\dfrac{1 + \Delta\%/100}{1 + \pi^{12m}/100} - 1\right)\times 100`,
          caption: "Variación real, descontando la inflación en 12 meses.",
        },
      ],
      symbols: [
        [String.raw`C_d`, "saldo de colocaciones el día d"],
        [String.raw`D_m`, "número de días del mes"],
      ],
    },
  };
})();
