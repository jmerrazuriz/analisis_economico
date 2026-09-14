(function () {
  "use strict";

  const SECTIONS = window.SECTIONS;
  const STRIP = window.STRIP;
  const EXPLANATIONS = window.EXPLANATIONS || {};
  const IS_MOBILE = document.body.dataset.version === "movil";
  const RANGES = [
    { id: "1", label: "1 año", years: 1 },
    { id: "3", label: "3 años", years: 3 },
    { id: "5", label: "5 años", years: 5 },
    { id: "10", label: "10 años", years: 10 },
    { id: "all", label: "Todo", years: null },
  ];
  const DAY = 864e5;
  // Distancia máxima para asociar una fecha con un dato: un período completo de cada frecuencia.
  const TOLERANCE = { D: 7 * DAY, M: 31 * DAY, T: 92 * DAY, A: 366 * DAY };
  const MIN_POINTS = { D: 20, M: 12, T: 8, A: 8 };
  const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const now = new Date();
  const TODAY = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (id) => document.getElementById(id);

  function load(key) {
    try { return localStorage.getItem("panel-macro:" + key); } catch (e) { return null; }
  }
  function save(key, value) {
    try { localStorage.setItem("panel-macro:" + key, value); } catch (e) { /* almacenamiento no disponible */ }
  }

  const state = {
    // "api": servidor local con credenciales. "static": datos publicados (GitHub Pages).
    mode: null,
    manifest: null,
    section: null,
    range: RANGES.some((r) => r.id === load("range")) ? load("range") : "5",
    zoom: null,
    raw: new Map(),
    errors: new Map(),
    inflight: new Map(),
    cards: new Map(),
    converter: null,
    personalItems: [],
    lastPublic: null,
    configError: null,
    connectionError: null,
  };
  state.section = initialSection();

  /* ---------- utilidades ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function key(color) {
    const node = el("i", "key");
    node.style.background = color;
    return node;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  const freqOf = (id) => id.slice(-1);
  const toTime = (d) => Date.parse(d + "T00:00:00Z");
  const isoOf = (t) => new Date(t).toISOString().slice(0, 10);
  const shiftYears = (d, n) => String(Number(d.slice(0, 4)) + n) + d.slice(4);

  const formatters = new Map();
  function nf(decimals) {
    if (!formatters.has(decimals)) {
      formatters.set(decimals, new Intl.NumberFormat("es-CL", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: "always",
      }));
    }
    return formatters.get(decimals);
  }

  function formatValue(v, spec) {
    const digits = nf(spec.decimals ?? 1).format(Math.abs(v));
    const sign = v < 0 && /[1-9]/.test(digits) ? "−" : "";
    return `${sign}${spec.prefix ? spec.prefix + " " : ""}${digits}${spec.suffix || ""}`;
  }

  function dateLabel(d, freq, long) {
    const year = d.slice(0, 4);
    const month = Number(d.slice(5, 7));
    if (freq === "D") return `${Number(d.slice(8, 10))} ${MES[month - 1]} ${year}`;
    if (freq === "M") return `${(long ? MES_LARGO : MES)[month - 1]} ${year}`;
    if (freq === "T") {
      const quarter = Math.floor((month - 1) / 3) + 1;
      return long ? `${quarter}.º trimestre ${year}` : `${quarter}T ${year}`;
    }
    return year;
  }

  function describeChange(cur, prev, spec) {
    if (!cur || !prev) return null;
    let diff;
    let text;
    if (spec.change === "pct") {
      if (!prev.v) return null;
      diff = (cur.v / prev.v - 1) * 100;
      // Variaciones pequeñas (como la UF diaria) necesitan más decimales para no verse como 0.
      text = nf(Math.abs(diff) < 0.1 ? 2 : 1).format(Math.abs(diff)) + "%";
    } else if (spec.change === "pp") {
      diff = cur.v - prev.v;
      const decimals = spec.decimals ?? 1;
      text = nf(decimals).format(Math.abs(diff));
      if (diff !== 0 && !/[1-9]/.test(text)) text = nf(decimals + 1).format(Math.abs(diff));
      text += " pp";
    } else {
      diff = cur.v - prev.v;
      text = formatValue(Math.abs(diff), spec);
    }
    const zero = cur.v === prev.v;
    return { zero, diff, arrow: zero ? "=" : diff > 0 ? "▲" : "▼", amount: text };
  }

  // Flecha verde si el cambio favorece a la economía chilena y roja si la perjudica (según goodUp).
  function changeNode(change, goodUp) {
    const node = el("span", "delta");
    const arrow = el("span", "delta-arrow", change.arrow);
    node.append(arrow, document.createTextNode(` ${change.amount}`));
    if (!change.zero && goodUp != null) {
      const good = (change.diff > 0) === goodUp;
      arrow.classList.add(good ? "is-good" : "is-bad");
      node.title = good ? "Cambio favorable para la economía chilena" : "Cambio desfavorable para la economía chilena";
      node.appendChild(el("span", "sr-only", good ? " (favorable)" : " (desfavorable)"));
    }
    return node;
  }

  function unchangedSince(points) {
    const last = points[points.length - 1];
    for (let i = points.length - 2; i >= 0; i--) {
      if (points[i].v !== last.v) return points[i + 1];
    }
    return points[0];
  }

  /* ---------- datos ---------- */

  function transform(points, kind) {
    if (kind === "yoy") {
      const byDate = new Map(points.map((p) => [p.d, p.v]));
      const out = [];
      points.forEach((p) => {
        const base = byDate.get(shiftYears(p.d, -1));
        if (base) out.push({ d: p.d, t: p.t, v: (p.v / base - 1) * 100 });
      });
      return out;
    }
    if (kind === "pop") {
      const out = [];
      for (let i = 1; i < points.length; i++) {
        if (points[i - 1].v) out.push({ d: points[i].d, t: points[i].t, v: (points[i].v / points[i - 1].v - 1) * 100 });
      }
      return out;
    }
    return points;
  }

  function seriesPoints(id, kind) {
    const raw = state.raw.get(id);
    if (!raw) return null;
    return transform(raw.points.filter((p) => p.d <= TODAY), kind);
  }

  function inZoom(points) {
    let start = 0;
    while (start < points.length && points[start].d < state.zoom.from) start++;
    let end = points.length;
    while (end > start && points[end - 1].d > state.zoom.to) end--;
    // Una serie trimestral o anual puede quedar con menos de dos datos: se amplía a los vecinos.
    while (end - start < 2 && (start > 0 || end < points.length)) {
      if (start > 0) start--;
      if (end - start < 2 && end < points.length) end++;
    }
    return points.slice(start, end);
  }

  function inRange(points, freq) {
    if (!points.length) return points;
    if (state.zoom) return inZoom(points);
    const range = RANGES.find((r) => r.id === state.range);
    if (!range.years) return points;
    const start = shiftYears(TODAY, -range.years);
    let index = points.findIndex((p) => p.d >= start);
    if (index < 0) index = points.length;
    index = Math.min(index, Math.max(0, points.length - MIN_POINTS[freq]));
    return points.slice(index);
  }

  const currentSection = () => SECTIONS.find((s) => s.id === state.section);
  const stripIds = () => STRIP.map((q) => q.id);

  function sectionIds(id) {
    const sec = SECTIONS.find((s) => s.id === id);
    if (sec.type === "converter") return sec.units.flatMap((u) => (u.cross ? [u.cross.dollar, u.cross.parity] : [u.id]));
    if (sec.type === "personal") {
      return personalItems().flatMap((item) => [...item.series.map((s) => s.id), ...(item.extras || []).map((x) => x.id)]);
    }
    return sec.items.flatMap((item) => [...item.series.map((s) => s.id), ...(item.extras || []).map((x) => x.id)]);
  }

  function storeSeries(id, s) {
    state.raw.set(id, {
      stale: Boolean(s.stale),
      fetchedAt: s.fetchedAt,
      points: s.obs.map(([d, v]) => ({ d, t: toTime(d), v })),
    });
    state.errors.delete(id);
  }

  async function detectMode() {
    // Solo el servidor local (server.py) tiene API; en GitHub Pages se leen los datos publicados.
    if (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) {
      try {
        const response = await fetch("api/status", { cache: "no-store" });
        const type = response.headers.get("content-type") || "";
        if (response.ok && type.includes("application/json")) {
          const body = await response.json();
          state.mode = "api";
          state.configError = body.configured ? null : "Faltan BCCH_USER y BCCH_PASS en el archivo .env.";
          return;
        }
      } catch (err) { /* sin servidor local: se usan los datos publicados */ }
    }
    state.mode = "static";
    await loadManifest();
  }

  async function loadManifest() {
    try {
      const response = await fetch("data/manifest.json", { cache: "no-store" });
      if (!response.ok) throw new Error("sin manifiesto");
      state.manifest = await response.json();
      state.connectionError = null;
    } catch (err) {
      state.connectionError = "No se encontraron datos publicados. Revisa tu conexión y recarga la página.";
    }
  }

  async function requestStatic(ids) {
    const manifest = state.manifest;
    await Promise.all(ids.map(async (id) => {
      if (!manifest) {
        state.errors.set(id, state.connectionError);
        return;
      }
      try {
        const response = await fetch(`data/${id}.json?v=${Math.round(manifest.generatedAt)}`);
        if (!response.ok) throw new Error((manifest.errors && manifest.errors[id]) || "Esta serie no está en la última publicación de datos.");
        storeSeries(id, await response.json());
      } catch (err) {
        state.errors.set(id, err instanceof TypeError ? "No se pudo descargar la serie. Revisa tu conexión." : err.message);
      }
    }));
  }

  async function requestApi(ids, refresh) {
    try {
      const response = await fetch(`api/series?ids=${encodeURIComponent(ids.join(","))}${refresh ? "&refresh=1" : ""}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `El servidor local respondió con el código ${response.status}.`);
      Object.entries(body.series || {}).forEach(([id, s]) => storeSeries(id, s));
      Object.entries(body.errors || {}).forEach(([id, msg]) => state.errors.set(id, msg));
      state.connectionError = null;
    } catch (err) {
      const msg = err instanceof TypeError
        ? "No hay conexión con el servidor local. Inícialo con iniciar.bat y recarga la página."
        : err.message;
      state.connectionError = msg;
      ids.forEach((id) => { if (!state.raw.has(id)) state.errors.set(id, msg); });
    }
  }

  function fetchSeries(ids, refresh = false) {
    const waits = [];
    const needed = [];
    new Set(ids).forEach((id) => {
      if (!refresh && state.inflight.has(id)) waits.push(state.inflight.get(id));
      else if (refresh || !state.raw.has(id)) needed.push(id);
    });
    for (let i = 0; i < needed.length; i += 20) {
      const chunk = needed.slice(i, i + 20);
      const request = state.mode === "api" ? requestApi(chunk, refresh) : requestStatic(chunk);
      const promise = request.finally(() => {
        chunk.forEach((id) => { if (state.inflight.get(id) === promise) state.inflight.delete(id); });
      });
      chunk.forEach((id) => state.inflight.set(id, promise));
      waits.push(promise);
    }
    return Promise.all(waits);
  }

  /* ---------- navegación y controles ---------- */

  function initialSection() {
    const hash = location.hash.slice(1);
    if (SECTIONS.some((s) => s.id === hash)) return hash;
    const saved = load("section");
    return SECTIONS.some((s) => s.id === saved) ? saved : SECTIONS[0].id;
  }

  function goSection(id, cardKey) {
    if (id !== state.section) {
      if (currentSection().type !== "personal") state.lastPublic = state.section;
      state.section = id;
      save("section", id);
      if (location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id);
      renderNav();
      renderSection();
      window.scrollTo({ top: 0 });
      fetchSeries(sectionIds(id)).then(() => {
        if (state.section === id) { updateCards(); updateStatus(); }
      });
    }
    if (cardKey) {
      const card = $("card-" + cardKey);
      if (card) card.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    }
  }

  function renderNav() {
    const nav = $("nav");
    nav.textContent = "";
    SECTIONS.forEach((sec) => {
      const button = el("button");
      button.type = "button";
      button.appendChild(el("span", "nav-label", IS_MOBILE ? sec.short || sec.name : sec.name));
      const count = sec.items
        ? sec.items.length
        : sec.type === "personal" && Accounts.current() ? Accounts.selection().length : null;
      button.title = count === null ? sec.name : `${sec.name}: ${count} gráficos`;
      if (!IS_MOBILE && count !== null) button.appendChild(el("span", "count", String(count)));
      if (sec.id === state.section) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => goSection(sec.id));
      nav.appendChild(button);
    });
  }

  function renderRanges() {
    const wrap = $("ranges");
    wrap.textContent = "";
    RANGES.forEach((range) => {
      const button = el("button", null, range.label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(!state.zoom && range.id === state.range));
      button.addEventListener("click", () => {
        state.range = range.id;
        state.zoom = null;
        save("range", range.id);
        renderRanges();
        updateCards();
      });
      wrap.appendChild(button);
    });

    const zoom = $("zoom");
    zoom.textContent = "";
    if (state.zoom) {
      zoom.appendChild(el("span", "zoom-range", `Zoom: ${dateLabel(state.zoom.from, "D")} – ${dateLabel(state.zoom.to, "D")}`));
      const reset = el("button", "btn btn-small", "Quitar zoom");
      reset.type = "button";
      reset.addEventListener("click", () => setZoom(null));
      zoom.appendChild(reset);
    } else {
      zoom.appendChild(el("span", "zoom-hint", IS_MOBILE
        ? "Toca un gráfico para ver sus valores. Arrastra de lado para acercar un período; para volver, usa «Quitar zoom» en el gráfico."
        : "Arrastra sobre un gráfico para acercar un período; doble clic para volver."));
    }
  }

  function setZoom(zoom) {
    state.zoom = zoom;
    renderRanges();
    updateCards();
  }

  // Aplica un cambio y corrige el scroll para que "node" quede en el mismo lugar de la pantalla.
  function keepInView(node, action) {
    const before = node.getBoundingClientRect().top;
    action();
    const shift = node.getBoundingClientRect().top - before;
    if (shift) window.scrollBy(0, shift);
  }

  /* ---------- pizarra de valores del día ---------- */

  function renderStrip() {
    const strip = $("strip");
    strip.textContent = "";
    STRIP.forEach((quote) => {
      const button = el("button", "quote");
      button.type = "button";
      button.appendChild(el("span", "quote-label", quote.label));
      const freq = freqOf(quote.id);
      const points = seriesPoints(quote.id);
      if (!points || !points.length) {
        button.appendChild(el("span", "quote-value", state.errors.has(quote.id) ? "Sin datos" : "…"));
      } else {
        const cur = points[points.length - 1];
        button.appendChild(el("span", "quote-value", formatValue(cur.v, quote)));
        const meta = el("span", "quote-meta");
        const change = describeChange(cur, points[points.length - 2], quote);
        if (change && change.zero) {
          meta.appendChild(el("span", null, `Sin cambio desde ${dateLabel(unchangedSince(points).d, freq)}`));
        } else {
          if (change) meta.appendChild(changeNode(change, quote.goodUp));
          meta.appendChild(el("span", null, dateLabel(cur.d, freq)));
        }
        button.appendChild(meta);
      }
      button.addEventListener("click", () => goSection("diarios", quote.card));
      strip.appendChild(button);
    });
  }

  /* ---------- secciones ---------- */

  function renderSection() {
    const sec = currentSection();
    $("section-title").textContent = sec.name;
    $("section-intro").textContent = sec.intro;
    document.title = `${sec.name} · Panel macro Chile`;
    $("chart-controls").hidden = sec.type === "converter";
    Plot.clear();
    const cards = $("cards");
    cards.textContent = "";
    state.cards.clear();
    state.converter = null;
    state.personalItems = [];

    if (sec.type === "personal") {
      renderPersonal(cards);
      return;
    }

    if (sec.type === "converter") {
      state.converter = Converter.mount(cards, {
        section: sec,
        points: (id) => (state.raw.has(id) ? state.raw.get(id).points : null),
        error: (id) => state.errors.get(id),
        atOrBefore: Plot.atOrBefore,
        dateLabel,
        today: TODAY,
      });
      return;
    }

    sec.items.forEach((item) => cards.appendChild(buildCard(item)));
    updateCards();
  }

  /* ---------- Personalizado y cuenta local ---------- */

  const USER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';

  function panelItem(key) {
    for (const sec of SECTIONS) {
      const item = sec.items && sec.items.find((i) => i.key === key);
      if (item) return item;
    }
    return null;
  }

  function catalogEntry(id) {
    for (const group of window.CATALOG || []) {
      const serie = group.series.find((x) => x.id === id);
      if (serie) return serie;
    }
    return null;
  }

  // Convierte una serie del catálogo en un indicador con el mismo formato que los del panel.
  function catalogItem(entry, view) {
    const yoy = view === "yoy" && !entry.id.endsWith(".D");
    return {
      key: `serie-${entry.id.replace(/[^A-Za-z0-9]/g, "-")}${yoy ? "-yoy" : ""}`,
      name: yoy ? `${entry.name}, variación anual` : entry.name,
      desc: entry.title,
      series: [{ id: entry.id, label: entry.name }],
      kind: yoy ? "bars" : "line",
      transform: yoy ? "yoy" : undefined,
      prefix: yoy ? undefined : entry.prefix,
      suffix: yoy ? "%" : entry.suffix,
      decimals: yoy ? 1 : entry.decimals === "auto" ? 2 : entry.decimals,
      autoDecimals: !yoy && entry.decimals === "auto",
      unit: yoy ? "variación anual" : entry.unit,
      change: yoy ? "pp" : entry.change,
      goodUp: null,
    };
  }

  function personalItems() {
    if (!window.Accounts || !Accounts.current()) return [];
    return Accounts.selection().map((selected) => {
      if (selected.type === "panel") return panelItem(selected.key);
      const entry = catalogEntry(selected.id);
      return entry ? catalogItem(entry, selected.view) : null;
    }).filter(Boolean);
  }

  function updateAccountButton() {
    const button = $("account-button");
    if (!button) return;
    const user = Accounts.current();
    button.textContent = "";
    if (IS_MOBILE) {
      if (user) {
        const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
        button.appendChild(el("span", "account-initials", initials));
      } else {
        button.innerHTML = USER_ICON;
      }
      button.setAttribute("aria-label", user ? `Mi panel de ${user.name}` : "Iniciar sesión");
    } else {
      button.append(
        el("span", "account-label", user ? user.name : "Iniciar sesión"),
        el("span", "account-sub", user ? "Ver mi pestaña personalizada" : "Arma tu pestaña personalizada"),
      );
    }
  }

  function openLogin(mode) {
    LoginView.open({
      mode,
      onSuccess: () => {
        updateAccountButton();
        renderNav();
        if (currentSection().type !== "personal") {
          goSection("personalizado");
          return;
        }
        renderSection();
        fetchSeries(sectionIds(state.section)).then(() => {
          if (currentSection().type === "personal") { updateCards(); updateStatus(); }
        });
      },
      onClose: () => {
        if (currentSection().type === "personal" && !Accounts.current()) goSection(state.lastPublic || SECTIONS[0].id);
      },
    });
  }

  function renderPersonal(cards) {
    const user = Accounts.current();
    updateAccountButton();
    if (!user) {
      $("chart-controls").hidden = true;
      const card = el("article", "card personal-locked");
      const actions = el("div", "personal-actions");
      const login = el("button", "btn btn-primary", "Iniciar sesión");
      login.type = "button";
      login.addEventListener("click", () => openLogin("login"));
      const register = el("button", "btn", "Crear cuenta");
      register.type = "button";
      register.addEventListener("click", () => openLogin("register"));
      actions.append(login, register);
      card.append(
        el("h2", null, "Arma tu propia pestaña"),
        el("p", "card-desc", "Inicia sesión o crea una cuenta en este dispositivo para elegir los indicadores y series que quieres ver juntos."),
        actions,
      );
      cards.appendChild(card);
      openLogin("login");
      return;
    }

    state.personalItems = personalItems();
    $("chart-controls").hidden = state.personalItems.length === 0;
    Personal.mount(cards, {
      user,
      selection: Accounts.selection(),
      sections: SECTIONS.filter((sec) => sec.items),
      catalog: window.CATALOG || [],
      onSave: (selection) => {
        Accounts.saveSelection(selection);
        renderNav();
        renderSection();
        fetchSeries(sectionIds(state.section)).then(() => {
          if (currentSection().type === "personal") { updateCards(); updateStatus(); }
        });
      },
      onSignedOut: () => {
        updateAccountButton();
        renderNav();
        goSection(state.lastPublic || SECTIONS[0].id);
      },
    });
    state.personalItems.forEach((item) => cards.appendChild(buildCard(item)));
    updateCards();
  }

  function buildCard(item) {
    const info = EXPLANATIONS[item.key] || {};
    const card = el("article", "card");
    card.id = "card-" + item.key;

    const main = el("div", "card-main");
    const head = el("header", "card-head");
    head.append(el("h2", null, item.name), el("p", "card-desc", info.summary || item.desc || ""));

    const howPanel = el("div", "how");
    howPanel.id = "how-" + item.key;
    howPanel.hidden = true;
    const howButton = el("button", "how-toggle", "¿Cómo se calcula?");
    howButton.type = "button";
    howButton.hidden = !info.words;
    howButton.setAttribute("aria-expanded", "false");
    howButton.setAttribute("aria-controls", howPanel.id);
    howButton.addEventListener("click", () => {
      const open = howPanel.hidden;
      if (open && !howPanel.childElementCount) buildHow(howPanel, info);
      howPanel.hidden = !open;
      howButton.setAttribute("aria-expanded", String(open));
    });
    head.appendChild(howButton);

    const legend = el("div", "legend");
    if (item.series.length > 1) {
      item.series.forEach((s, i) => {
        const entry = el("span");
        entry.append(key(`var(--series-${i + 1})`), document.createTextNode(s.label));
        legend.appendChild(entry);
      });
    } else {
      legend.hidden = true;
    }

    const plot = el("div", "plot");
    plot.tabIndex = 0;
    plot.setAttribute("role", "img");
    plot.setAttribute("aria-label", `Gráfico de ${item.name}. Usa las flechas izquierda y derecha para recorrer los datos.`);

    const details = el("details", "data");
    const tableWrap = el("div", "table-wrap");
    details.append(el("summary", null, "Ver datos en tabla"), tableWrap);
    details.addEventListener("toggle", () => { if (details.open) fillTable(item); });

    // En el teléfono cada gráfico tiene su propio botón para quitar el zoom.
    let zoomBar = null;
    let zoomText = null;
    if (IS_MOBILE) {
      zoomBar = el("div", "card-zoom");
      zoomBar.hidden = true;
      zoomText = el("span", "card-zoom-range");
      const zoomReset = el("button", "btn btn-small", "Quitar zoom");
      zoomReset.type = "button";
      zoomReset.addEventListener("click", () => keepInView(card, () => setZoom(null)));
      zoomBar.append(zoomText, zoomReset);
    }

    main.append(head, howPanel, legend, ...(zoomBar ? [zoomBar] : []), plot, details);

    const side = el("aside", "card-side");
    side.setAttribute("aria-label", `Valor actual de ${item.name}`);

    card.append(main, side);
    state.cards.set(item.key, { plot, side, tableWrap, details, zoomBar, zoomText });
    return card;
  }

  function renderTex(node, tex, display) {
    if (window.katex) {
      try {
        window.katex.render(tex, node, { displayMode: display, throwOnError: false });
        return;
      } catch (e) { /* se muestra el texto TeX tal cual */ }
    }
    node.textContent = tex;
    node.classList.add("tex-fallback");
  }

  function buildHow(panel, info) {
    const words = el("section", "how-col");
    words.appendChild(el("h3", null, "En palabras"));
    info.words.forEach((text) => words.appendChild(el("p", null, text)));

    const math = el("section", "how-col");
    math.appendChild(el("h3", null, "En matemáticas"));
    (info.formulas || []).forEach((formula) => {
      const figure = el("figure", "formula");
      const tex = el("div", "formula-tex");
      renderTex(tex, formula.tex, true);
      figure.appendChild(tex);
      if (formula.caption) figure.appendChild(el("figcaption", null, formula.caption));
      math.appendChild(figure);
    });
    if (info.symbols && info.symbols.length) {
      math.appendChild(el("p", "symbols-intro", "Donde:"));
      const list = el("dl", "symbols");
      info.symbols.forEach(([symbol, meaning]) => {
        const dt = el("dt");
        renderTex(dt, symbol, false);
        list.append(dt, el("dd", null, meaning));
      });
      math.appendChild(list);
    }

    panel.append(words, math);
  }

  function updateCards() {
    if (state.converter) {
      state.converter.update();
      updateTimestamp();
      return;
    }
    const sec = currentSection();
    const items = sec.type === "personal" ? state.personalItems : sec.items;
    if (!items) return;
    const colors = [cssVar("--series-1"), cssVar("--series-2"), cssVar("--series-3")];
    items.forEach((item) => fillCard(item, colors));
    updateTimestamp();
  }

  function fillCard(item, colors) {
    const refs = state.cards.get(item.key);
    if (!refs) return;
    if (refs.zoomBar) {
      refs.zoomBar.hidden = !state.zoom;
      if (state.zoom) refs.zoomText.textContent = `Zoom: ${dateLabel(state.zoom.from, "D")} – ${dateLabel(state.zoom.to, "D")}`;
    }
    const missing = item.series.map((s) => s.id).filter((id) => !state.raw.has(id));
    if (missing.length) {
      const error = missing.map((id) => state.errors.get(id)).find(Boolean);
      Plot.message(refs.plot, error ? `No se pudo cargar la serie ${missing[0]}. ${error}` : "Cargando datos del Banco Central…", Boolean(error));
      refs.side.textContent = "";
      refs.side.appendChild(el("p", "side-note", error ? "Sin datos disponibles." : "Cargando…"));
      return;
    }

    const freq = freqOf(item.series[0].id);
    const full = item.series.map((s, i) => {
      const all = seriesPoints(s.id, item.transform);
      return { ...s, color: colors[i], all, points: inRange(all, freqOf(s.id)) };
    });
    if (item.autoDecimals) {
      const last = full[0].all[full[0].all.length - 1];
      if (last) item.decimals = Math.abs(last.v) >= 1 ? 2 : Math.abs(last.v) >= 0.1 ? 3 : 4;
    }

    Plot.render(refs.plot, {
      kind: item.kind,
      height: IS_MOBILE ? 200 : 240,
      series: full.map((s) => ({ label: s.label, color: s.color, step: Boolean(s.step), points: s.points })),
      colors: { pos: cssVar("--pos"), neg: cssVar("--neg") },
      refLine: item.refLine,
      tolerance: TOLERANCE[freq],
      formatAxis: (v, decimals) => nf(decimals).format(v) + (item.suffix === "%" ? "%" : ""),
      formatValue: (v) => formatValue(v, item),
      formatDate: (p) => dateLabel(p.d, freq, true),
      formatTime: (t) => dateLabel(isoOf(t), "D"),
      // keepInView evita que la página salte cuando aparecen o desaparecen las barras de zoom.
      onZoom: (from, to) => keepInView(refs.plot, () => setZoom({ from: isoOf(from), to: isoOf(to) })),
      onReset: () => { if (state.zoom) keepInView(refs.plot, () => setZoom(null)); },
    });

    fillSide(refs.side, item, full, freq);
    if (refs.details.open) fillTable(item);
  }

  function addStat(list, label, value, detail) {
    const row = el("div");
    const dd = el("dd");
    if (typeof value === "string") dd.textContent = value;
    else dd.appendChild(value);
    if (detail) dd.appendChild(el("small", null, detail));
    row.append(el("dt", null, label), dd);
    list.appendChild(row);
  }

  function fillSide(side, item, full, freq) {
    side.textContent = "";
    const main = full[0];
    const cur = main.all[main.all.length - 1];
    if (!cur) {
      side.appendChild(el("p", "side-note", "La serie aún no tiene datos publicados."));
      return;
    }

    side.appendChild(el("p", "side-date", dateLabel(cur.d, freq, true)));
    side.appendChild(el("p", "side-value", formatValue(cur.v, item)));
    const unit = el("p", "side-unit");
    if (full.length > 1) unit.append(key(main.color), document.createTextNode(`${main.label}, ${item.unit}`));
    else unit.textContent = item.unit;
    side.appendChild(unit);

    const stats = el("dl", "side-stats");
    const prev = main.all[main.all.length - 2];
    const prevChange = describeChange(cur, prev, item);
    if (prevChange) {
      addStat(stats, "Respecto al dato anterior",
        prevChange.zero ? "Sin cambio" : changeNode(prevChange, item.goodUp),
        prevChange.zero ? `desde ${dateLabel(unchangedSince(main.all).d, freq)}` : `${formatValue(prev.v, item)} en ${dateLabel(prev.d, freq)}`);
    }
    if (freq !== "A") {
      const yearAgo = Plot.atOrBefore(main.all, toTime(shiftYears(cur.d, -1)), TOLERANCE[freq]);
      const yearChange = describeChange(cur, yearAgo, item);
      if (yearChange) addStat(stats, "Respecto a un año atrás", changeNode(yearChange, item.goodUp), `${formatValue(yearAgo.v, item)} en ${dateLabel(yearAgo.d, freq)}`);
    }
    if (main.points.length > 1) {
      let low = main.points[0];
      let high = main.points[0];
      main.points.forEach((p) => {
        if (p.v < low.v) low = p;
        if (p.v > high.v) high = p;
      });
      addStat(stats, "Mínimo del período", formatValue(low.v, item), dateLabel(low.d, freq));
      addStat(stats, "Máximo del período", formatValue(high.v, item), dateLabel(high.d, freq));
    }
    side.appendChild(stats);

    if (full.length > 1) {
      const list = el("ul", "side-series");
      full.slice(1).forEach((s) => {
        const last = s.all[s.all.length - 1];
        if (!last) return;
        const label = el("span", "side-series-label");
        label.append(key(s.color), document.createTextNode(s.label));
        const li = el("li");
        li.append(label, el("strong", null, formatValue(last.v, item)));
        if (last.d !== cur.d) li.appendChild(el("small", null, dateLabel(last.d, freqOf(s.id))));
        list.appendChild(li);
      });
      side.appendChild(list);
    }

    if (item.extras && item.extras.length) {
      const extras = el("dl", "side-stats");
      item.extras.forEach((extra) => {
        const points = seriesPoints(extra.id, extra.transform);
        if (!points || !points.length) return;
        const last = points[points.length - 1];
        addStat(extras, extra.label, formatValue(last.v, extra), dateLabel(last.d, freqOf(extra.id)));
      });
      if (extras.childElementCount) side.appendChild(extras);
    }

    const raw = state.raw.get(main.id);
    const latest = raw.points[raw.points.length - 1];
    if (!item.transform && latest && latest.d > TODAY) {
      side.appendChild(el("p", "side-note", `Ya publicado: ${formatValue(latest.v, item)} para ${dateLabel(latest.d, freq, true)}.`));
    }
    if (full.some((s) => state.raw.get(s.id).stale)) {
      side.appendChild(el("p", "side-note is-warning", "La API no respondió; se muestra la última copia guardada."));
    }
  }

  function fillTable(item) {
    const refs = state.cards.get(item.key);
    if (!refs) return;
    const wrap = refs.tableWrap;
    wrap.textContent = "";
    if (!item.series.every((s) => state.raw.has(s.id))) return;

    const freq = freqOf(item.series[0].id);
    const columns = item.series.map((s) => ({ label: s.label, points: seriesPoints(s.id, item.transform) }));
    const rows = inRange(columns[0].points, freq).slice(-60).reverse();

    const table = el("table");
    const headRow = el("tr");
    headRow.appendChild(el("th", null, "Fecha"));
    columns.forEach((c) => headRow.appendChild(el("th", null, c.label)));
    const thead = el("thead");
    thead.appendChild(headRow);
    const tbody = el("tbody");
    rows.forEach((p) => {
      const tr = el("tr");
      tr.appendChild(el("td", null, dateLabel(p.d, freq, true)));
      columns.forEach((c, i) => {
        const q = i === 0 ? p : Plot.atOrBefore(c.points, p.t, TOLERANCE[freq]);
        tr.appendChild(el("td", null, q ? formatValue(q.v, item) : "sin dato"));
      });
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    wrap.appendChild(table);
    wrap.appendChild(el("p", "side-note", `Últimos ${rows.length} datos del período elegido. Código BDE: ${item.series.map((s) => s.id).join(", ")}.`));
  }

  /* ---------- estado ---------- */

  function updateTimestamp() {
    const target = $("updated");
    if (state.mode === "static") {
      target.textContent = state.manifest
        ? `Datos publicados el ${new Date(state.manifest.generatedAt * 1000).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
        : "";
      return;
    }
    let latest = 0;
    state.raw.forEach((r) => { latest = Math.max(latest, r.fetchedAt || 0); });
    target.textContent = latest
      ? `Última consulta a la API: ${new Date(latest * 1000).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`
      : "";
  }

  function updateStatus() {
    const status = $("status");
    let text = state.mode === "static"
      ? "Datos del Banco Central de Chile, actualizados automáticamente."
      : "Conectado a la API del Banco Central de Chile.";
    let isError = false;
    if (state.configError) {
      text = state.configError;
      isError = true;
    } else if (state.connectionError) {
      text = state.connectionError;
      isError = true;
    } else if (state.errors.size) {
      text = state.mode === "static"
        ? `${state.errors.size} series no están disponibles en esta publicación.`
        : `${state.errors.size} series no respondieron. Revisa las credenciales en .env o usa Actualizar datos.`;
      isError = true;
    }
    status.textContent = text;
    status.classList.toggle("is-error", isError);
  }

  async function refresh() {
    const button = $("refresh");
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Actualizando…";
    document.body.classList.add("is-refreshing");
    if (state.mode === "static") await loadManifest();
    await fetchSeries([...stripIds(), ...sectionIds(state.section)], true);
    document.body.classList.remove("is-refreshing");
    button.disabled = false;
    button.textContent = label;
    renderStrip();
    updateCards();
    updateStatus();
  }

  function bindVersionSwitch() {
    const link = $("switch-version");
    if (!link) return;
    link.addEventListener("click", () => {
      save("version", link.dataset.version);
      link.href = link.getAttribute("href").split("#")[0] + location.hash;
    });
  }

  // La pizarra queda fija arriba: al bajar se vuelve semitransparente y arriba del todo se ve sólida.
  function bindStickyStrip() {
    const strip = $("strip");
    const sticky = $("topbar") || strip;
    const onScroll = () => strip.classList.toggle("is-scrolled", window.scrollY > 8);
    // Al saltar a una tarjeta, se descuenta la altura de lo que queda fijo arriba.
    const measure = () => {
      const height = getComputedStyle(sticky).position === "sticky" ? sticky.offsetHeight : 0;
      document.documentElement.style.setProperty("--sticky-offset", `${height}px`);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    // Se vuelve a medir justo antes de saltar a una tarjeta desde la pizarra (fase de captura).
    strip.addEventListener("click", measure, true);
    new ResizeObserver(measure).observe(sticky);
    onScroll();
    measure();
  }

  async function init() {
    $("refresh").addEventListener("click", refresh);
    window.addEventListener("hashchange", () => {
      const hash = location.hash.slice(1);
      if (SECTIONS.some((s) => s.id === hash)) goSection(hash);
    });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      renderStrip();
      updateCards();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.zoom && !e.target.closest(".plot")) setZoom(null);
    });
    bindVersionSwitch();
    bindStickyStrip();
    $("account-button").addEventListener("click", () => goSection("personalizado"));
    updateAccountButton();
    window.addEventListener("storage", (event) => {
      if (!event.key || !event.key.startsWith("panel-macro:")) return;
      updateAccountButton();
      renderNav();
      if (currentSection().type === "personal") renderSection();
    });

    renderNav();
    renderRanges();
    renderStrip();
    renderSection();

    await detectMode();
    updateStatus();

    await Promise.all([
      fetchSeries(stripIds()).then(renderStrip),
      fetchSeries(sectionIds(state.section)).then(updateCards),
    ]);
    updateStatus();

    // Precarga el resto de las secciones, una a la vez, para que cambiar de sección sea inmediato.
    for (const sec of SECTIONS) {
      if (sec.id !== state.section) await fetchSeries(sectionIds(sec.id));
    }
    updateStatus();
  }

  init();
})();
