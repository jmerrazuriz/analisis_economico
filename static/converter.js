/* Sección "Convertir": pasa montos entre pesos chilenos y otras unidades (UF, UTM, monedas)
   con el valor publicado para la fecha elegida. Se puede escribir en cualquiera de los dos campos. */
(function () {
  "use strict";

  const DAY = 864e5;
  const formatters = new Map();

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // Formato chileno con entre minDecimals y maxDecimals decimales: format(24.4487, 4) → "24,4487".
  function format(value, maxDecimals, minDecimals = 0) {
    const key = `${minDecimals}-${maxDecimals}`;
    if (!formatters.has(key)) {
      formatters.set(key, new Intl.NumberFormat("es-CL", {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals,
        useGrouping: "always",
      }));
    }
    return formatters.get(key).format(value);
  }

  // Las monedas muestran sus centavos completos (918,30); UF y UTM, sin ceros sobrantes.
  function formatUnit(value, unit) {
    return format(value, unit.decimals, unit.decimals <= 2 ? unit.decimals : 0);
  }

  // Acepta el formato chileno ("1.234,56") y también "1234.56".
  function parseAmount(text) {
    let s = String(text).replace(/[\s$€£¥]/g, "").replace(/[A-Za-z/]/g, "");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    const value = Number(s);
    return Number.isFinite(value) ? value : NaN;
  }

  function addStat(list, label, value) {
    const row = el("div");
    row.append(el("dt", null, label), el("dd", null, value));
    list.appendChild(row);
  }

  function amountField(id, labelText, affixText) {
    const wrap = el("div", "field");
    const label = el("label", "field-label", labelText);
    label.htmlFor = id;
    const box = el("div", "amount-box");
    const input = el("input", "input amount-input");
    input.id = id;
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.spellcheck = false;
    const affix = el("span", "amount-affix", affixText);
    affix.setAttribute("aria-hidden", "true");
    box.append(input, affix);
    const hint = el("p", "field-hint");
    hint.id = id + "-hint";
    input.setAttribute("aria-describedby", hint.id);
    wrap.append(label, box, hint);
    return { wrap, label, input, affix, hint };
  }

  /* ctx: { section, points(id), error(id), atOrBefore, dateLabel, today } */
  function mount(container, ctx) {
    const units = ctx.section.units;
    const s = { unit: units[0], date: ctx.today, edited: "unit" };

    container.textContent = "";

    const card = el("article", "card converter");
    const main = el("div", "card-main");
    const form = el("div", "converter-form");

    // Unidad y fecha
    const row = el("div", "form-row");
    const unitField = el("div", "field");
    const unitLabel = el("label", "field-label", "Unidad");
    unitLabel.htmlFor = "conv-unit";
    const select = el("select", "input select");
    select.id = "conv-unit";
    [...new Set(units.map((u) => u.group))].forEach((group) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group;
      units.filter((u) => u.group === group).forEach((u) => {
        const option = document.createElement("option");
        option.value = u.id;
        option.textContent = `${u.name} (${u.code})`;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    });
    unitField.append(unitLabel, select);

    const dateField = el("div", "field");
    const dateLabel = el("label", "field-label", "Fecha del valor");
    dateLabel.htmlFor = "conv-date";
    const dateRow = el("div", "date-row");
    const dateInput = el("input", "input");
    dateInput.id = "conv-date";
    dateInput.type = "date";
    dateInput.value = s.date;
    const todayButton = el("button", "btn", "Hoy");
    todayButton.type = "button";
    dateRow.append(dateInput, todayButton);
    dateField.append(dateLabel, dateRow);
    row.append(unitField, dateField);

    // Montos
    const amounts = el("div", "amounts");
    const unitAmount = amountField("conv-amount", "Monto", "");
    const pesoAmount = amountField("conv-pesos", "Monto en pesos chilenos", "CLP");
    const equals = el("span", "amounts-eq", "=");
    equals.setAttribute("aria-hidden", "true");
    amounts.append(unitAmount.wrap, equals, pesoAmount.wrap);
    unitAmount.input.value = "1";

    form.append(row, amounts);
    main.appendChild(form);

    const side = el("aside", "card-side");
    side.setAttribute("aria-live", "polite");
    card.append(main, side);

    const others = el("article", "card converter-others");
    const othersTitle = el("h2", null, "El mismo monto en otras unidades");
    const othersIntro = el("p", "card-desc");
    const othersList = el("dl", "others-list");
    others.append(othersTitle, othersIntro, othersList);

    container.append(card, others);

    function rateFor(unit) {
      const points = ctx.points(unit.id);
      if (!points) {
        const error = ctx.error(unit.id);
        return error ? { status: "error", message: error } : { status: "loading" };
      }
      if (!points.length) return { status: "empty" };
      const first = points[0];
      const last = points[points.length - 1];
      const tolerance = unit.id.endsWith(".M") ? 31 * DAY : 10 * DAY;
      const point = ctx.atOrBefore(points, Date.parse(s.date + "T00:00:00Z"), tolerance);
      return point ? { status: "ok", point, first, last } : { status: "missing", first, last };
    }

    function renderSide(info, unit) {
      side.textContent = "";
      const freq = unit.id.slice(-1);
      if (info.status === "loading") {
        side.appendChild(el("p", "side-note", "Cargando valores del Banco Central…"));
        return;
      }
      if (info.status === "error") {
        side.appendChild(el("p", "side-note is-warning", `No se pudo cargar el valor de ${unit.name}. ${info.message}`));
        return;
      }
      if (info.status !== "ok") {
        side.appendChild(el("p", "side-note", info.first
          ? `No hay valor publicado para esa fecha. Hay datos entre el ${ctx.dateLabel(info.first.d, freq)} y el ${ctx.dateLabel(info.last.d, freq)}.`
          : "La serie no tiene datos publicados."));
        return;
      }

      const p = info.point;
      side.appendChild(el("p", "side-date", `Valor al ${ctx.dateLabel(p.d, freq, true)}`));
      side.appendChild(el("p", "side-value", `$ ${format(p.v, p.v < 10 ? 4 : 2, 2)}`));
      side.appendChild(el("p", "side-unit", `pesos por 1 ${unit.code}`));

      const stats = el("dl", "side-stats");
      addStat(stats, "Fecha elegida", ctx.dateLabel(s.date, "D"));
      addStat(stats, "Pesos", "monto × valor");
      addStat(stats, unit.plural.charAt(0).toUpperCase() + unit.plural.slice(1), "pesos ÷ valor");
      side.appendChild(stats);

      if (p.d !== s.date) {
        side.appendChild(el("p", "side-note", freq === "M"
          ? `La ${unit.code} tiene un solo valor para todo el mes.`
          : "Ese día no hay valor publicado (fin de semana o feriado), así que se usa el del último día hábil anterior."));
      }
    }

    function renderOthers(pesos) {
      othersList.textContent = "";
      if (pesos === null || !Number.isFinite(pesos)) {
        othersIntro.textContent = "Escribe un monto para ver cuánto equivale en cada unidad.";
        return;
      }
      othersIntro.textContent = `$ ${format(pesos, 2)} pesos chilenos equivalen, al ${ctx.dateLabel(s.date, "D")}, a:`;
      units.forEach((u) => {
        const info = rateFor(u);
        const item = el("div", u === s.unit ? "is-current" : null);
        item.append(
          el("dt", null, u.name),
          el("dd", null, info.status === "ok" ? `${formatUnit(pesos / info.point.v, u)} ${u.code}` : "sin dato"),
        );
        othersList.appendChild(item);
      });
    }

    function update() {
      const unit = s.unit;
      select.value = unit.id;
      unitAmount.label.textContent = `Monto en ${unit.plural}`;
      unitAmount.affix.textContent = unit.code;

      const info = rateFor(unit);
      if (info.first) {
        dateInput.min = info.first.d;
        dateInput.max = info.last.d > ctx.today ? info.last.d : ctx.today;
      }
      renderSide(info, unit);

      const source = s.edited === "unit" ? unitAmount : pesoAmount;
      const target = s.edited === "unit" ? pesoAmount : unitAmount;
      const value = parseAmount(source.input.value);
      source.input.removeAttribute("aria-invalid");
      source.hint.textContent = "";
      target.hint.textContent = "";

      let pesos = null;
      if (value === null) {
        target.input.value = "";
      } else if (Number.isNaN(value)) {
        source.input.setAttribute("aria-invalid", "true");
        source.hint.textContent = "Escribe solo números, por ejemplo 1.500,50.";
        target.input.value = "";
      } else if (info.status === "ok") {
        if (s.edited === "unit") {
          pesos = value * info.point.v;
          target.input.value = format(pesos, 2, 2);
        } else {
          pesos = value;
          target.input.value = formatUnit(value / info.point.v, unit);
        }
      } else {
        target.input.value = "";
      }
      renderOthers(pesos);
    }

    function tidy(field, decimals) {
      const value = parseAmount(field.input.value);
      if (value !== null && !Number.isNaN(value)) field.input.value = format(value, decimals);
    }

    select.addEventListener("change", () => {
      s.unit = units.find((u) => u.id === select.value);
      update();
    });
    dateInput.addEventListener("change", () => {
      if (!dateInput.value) return;
      s.date = dateInput.value;
      update();
    });
    todayButton.addEventListener("click", () => {
      s.date = ctx.today;
      dateInput.value = s.date;
      update();
    });
    unitAmount.input.addEventListener("input", () => { s.edited = "unit"; update(); });
    pesoAmount.input.addEventListener("input", () => { s.edited = "pesos"; update(); });
    unitAmount.input.addEventListener("blur", () => tidy(unitAmount, s.unit.decimals));
    pesoAmount.input.addEventListener("blur", () => tidy(pesoAmount, 2));

    update();
    return { update };
  }

  window.Converter = { mount, parseAmount };
})();
