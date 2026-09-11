/* Gráficos SVG livianos para el panel: líneas, escalones y columnas.
   - Al pasar el mouse, la fecha se proyecta en todos los gráficos de la pantalla.
   - Arrastrar dentro del gráfico selecciona un rango de fechas y llama a cfg.onZoom.
   - Doble clic llama a cfg.onReset. Las flechas del teclado recorren los datos. */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const DRAG_THRESHOLD = 8;
  const measure = document.createElement("canvas").getContext("2d");
  const plots = new Set();
  let source = null;
  let frame = 0;

  function svg(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function div(className, text) {
    const node = document.createElement("div");
    node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function textWidth(text) {
    measure.font = "12px 'Instrument Sans', system-ui, sans-serif";
    return measure.measureText(text).width;
  }

  // Índice del último punto con fecha <= t, si no está más lejos que la tolerancia; -1 si no hay.
  function indexAtOrBefore(points, t, tolerance) {
    let lo = 0;
    let hi = points.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid].t <= t) { found = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    if (found < 0 || t - points[found].t > tolerance) return -1;
    return found;
  }

  function atOrBefore(points, t, tolerance) {
    const index = indexAtOrBefore(points, t, tolerance);
    return index < 0 ? null : points[index];
  }

  function niceStep(raw) {
    const exp = Math.floor(Math.log10(raw));
    const f = raw / Math.pow(10, exp);
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * Math.pow(10, exp);
  }

  function valueTicks(min, max, count) {
    if (min === max) {
      const pad = Math.abs(min) * 0.05 || 1;
      min -= pad;
      max += pad;
    }
    const step = niceStep((max - min) / Math.max(1, count - 1));
    const first = Math.floor(min / step + 1e-9);
    const last = Math.ceil(max / step - 1e-9);
    const ticks = [];
    for (let i = first; i <= last; i++) ticks.push(+(i * step).toFixed(10));
    const text = step.toFixed(6).replace(/0+$/, "");
    const decimals = text.endsWith(".") ? 0 : text.split(".")[1].length;
    return { ticks, decimals };
  }

  function timeTicks(t0, t1, width) {
    const maxTicks = Math.max(2, Math.floor(width / 74));
    const spanYears = (t1 - t0) / (365.25 * 864e5);
    const ticks = [];
    if (spanYears > 2.5) {
      const step = [1, 2, 5, 10, 20].find((s) => spanYears / s <= maxTicks) || 20;
      const y0 = new Date(t0).getUTCFullYear();
      const y1 = new Date(t1).getUTCFullYear();
      for (let year = Math.ceil(y0 / step) * step; year <= y1; year += step) {
        const t = Date.UTC(year, 0, 1);
        if (t >= t0 && t <= t1) ticks.push({ t, label: String(year) });
      }
    } else {
      const step = [1, 2, 3, 6, 12].find((s) => (spanYears * 12) / s <= maxTicks) || 12;
      const start = new Date(t0);
      const year = start.getUTCFullYear();
      let month = start.getUTCMonth() + (start.getUTCDate() > 1 ? 1 : 0);
      month = Math.ceil(month / step) * step;
      for (let t = Date.UTC(year, month, 1); t <= t1; month += step, t = Date.UTC(year, month, 1)) {
        const d = new Date(t);
        ticks.push({ t, label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` });
      }
    }
    return ticks;
  }

  function barPath(left, width, base, end, radius) {
    const right = left + width;
    if (radius <= 0.5) return `M${left},${base}H${right}V${end}H${left}Z`;
    const r = end <= base ? radius : -radius;
    return `M${left},${base}V${end + r}Q${left},${end} ${left + Math.abs(r)},${end}` +
      `H${right - Math.abs(r)}Q${right},${end} ${right},${end + r}V${base}Z`;
  }

  /* ---------- dibujo ---------- */

  function render(container, cfg) {
    container._cfg = cfg;
    plots.add(container);
    if (!container._bound) bind(container);
    draw(container);
  }

  function message(container, text, isError) {
    if (source === container) clearAll();
    container._cfg = null;
    container._geo = null;
    container.textContent = "";
    const p = document.createElement("p");
    p.className = "plot-msg" + (isError ? " is-error" : "");
    p.textContent = text;
    container.appendChild(p);
  }

  function draw(container) {
    const cfg = container._cfg;
    if (!cfg) return;
    if (source === container) clearAll();
    const width = container.clientWidth;
    container._width = width;
    container._drag = null;
    container.textContent = "";
    container._geo = null;

    const series = cfg.series.filter((s) => s.points.length);
    if (!series.length || width < 60) {
      const p = document.createElement("p");
      p.className = "plot-msg";
      p.textContent = "No hay datos para el período elegido.";
      container.appendChild(p);
      return;
    }

    const bars = cfg.kind === "bars";
    const height = cfg.height || 240;
    let vmin = Infinity, vmax = -Infinity, t0 = Infinity, t1 = -Infinity;
    series.forEach((s) => s.points.forEach((p) => {
      if (p.v < vmin) vmin = p.v;
      if (p.v > vmax) vmax = p.v;
      if (p.t < t0) t0 = p.t;
      if (p.t > t1) t1 = p.t;
    }));
    if (bars) { vmin = Math.min(0, vmin); vmax = Math.max(0, vmax); }
    if (cfg.refLine) { vmin = Math.min(vmin, cfg.refLine.value); vmax = Math.max(vmax, cfg.refLine.value); }

    const { ticks, decimals } = valueTicks(vmin, vmax, 5);
    const labels = ticks.map((v) => cfg.formatAxis(v, decimals));
    const labelWidth = labels.reduce((w, l) => Math.max(w, textWidth(l)), 0);
    const m = { top: 12, right: bars ? 6 : 12, bottom: 28, left: Math.ceil(labelWidth) + 12 };
    const pw = Math.max(20, width - m.left - m.right);
    const ph = height - m.top - m.bottom;
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const y = (v) => m.top + ph - ((v - lo) / (hi - lo)) * ph;
    const slot = bars ? pw / series[0].points.length : 0;
    const xa = m.left + slot / 2;
    const xb = m.left + pw - slot / 2;
    const x = (t) => (t1 === t0 ? (xa + xb) / 2 : xa + ((t - t0) / (t1 - t0)) * (xb - xa));
    const invert = (px) => {
      if (t1 === t0) return t0;
      const t = t0 + ((px - xa) / (xb - xa)) * (t1 - t0);
      return Math.max(t0, Math.min(t1, t));
    };
    const surface = getComputedStyle(container).getPropertyValue("--surface").trim() || "#fff";

    const root = svg("svg", { width, height, viewBox: `0 0 ${width} ${height}`, "aria-hidden": "true" });
    container.appendChild(root);

    const axes = svg("g", {}, root);
    ticks.forEach((v, i) => {
      const yy = Math.round(y(v)) + 0.5;
      svg("line", { x1: m.left, x2: m.left + pw, y1: yy, y2: yy, class: v === 0 && bars ? "baseline" : "gridline" }, axes);
      svg("text", { x: m.left - 8, y: yy, class: "tick", "text-anchor": "end", "dominant-baseline": "middle" }, axes).textContent = labels[i];
    });
    timeTicks(t0, t1, pw).forEach((tick) => {
      const xx = x(tick.t);
      const half = textWidth(tick.label) / 2;
      const anchor = xx - half < 0 ? "start" : xx + half > width ? "end" : "middle";
      svg("text", { x: xx, y: height - 8, class: "tick", "text-anchor": anchor }, axes).textContent = tick.label;
    });

    if (cfg.refLine) {
      const yy = Math.round(y(cfg.refLine.value)) + 0.5;
      svg("line", { x1: m.left, x2: m.left + pw, y1: yy, y2: yy, class: "refline" }, root);
      svg("text", { x: m.left + 6, y: yy - 6, class: "reflabel" }, root).textContent = cfg.refLine.label;
    }

    let barNodes = null;
    if (bars) {
      const bw = Math.max(1, Math.min(24, slot - 2));
      const base = y(0);
      const group = svg("g", { class: "bars" }, root);
      barNodes = series[0].points.map((p) => {
        const end = y(p.v);
        const radius = Math.min(4, bw / 2, Math.abs(base - end));
        return svg("path", { d: barPath(x(p.t) - bw / 2, bw, base, end, radius), fill: p.v >= 0 ? cfg.colors.pos : cfg.colors.neg }, group);
      });
    } else {
      const group = svg("g", {}, root);
      series.forEach((s) => {
        let d = "";
        s.points.forEach((p, i) => {
          const xx = x(p.t).toFixed(1);
          const yy = y(p.v).toFixed(1);
          if (i === 0) d += `M${xx},${yy}`;
          else if (s.step) d += `H${xx}V${yy}`;
          else d += `L${xx},${yy}`;
        });
        svg("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, group);
      });
      series.forEach((s) => {
        const last = s.points[s.points.length - 1];
        svg("circle", { cx: x(last.t), cy: y(last.v), r: 4, fill: s.color, stroke: surface, "stroke-width": 2 }, group);
      });
    }

    const selection = svg("rect", { x: 0, y: m.top, width: 0, height: ph, class: "selection", visibility: "hidden" }, root);
    const hoverLayer = svg("g", { visibility: "hidden" }, root);
    const cross = svg("line", { y1: m.top, y2: m.top + ph, class: "crosshair" }, hoverLayer);
    const dots = series.map((s) => svg("circle", { r: 4, fill: s.color, stroke: surface, "stroke-width": 2 }, hoverLayer));

    const tip = div("plot-tip");
    tip.hidden = true;
    container.appendChild(tip);

    container._geo = { x, y, invert, m, pw, series, bars: barNodes, hover: hoverLayer, cross, dots, selection, tip, index: -1 };
  }

  /* ---------- hover sincronizado ---------- */

  // En pantallas táctiles no existe "salir del gráfico": el valor queda visible hasta tocar fuera.
  document.addEventListener("pointerdown", (e) => {
    if (source && !(e.target instanceof Element && e.target.closest(".plot"))) clearAll();
  });

  function bind(container) {
    container._bound = true;
    new ResizeObserver(() => {
      if (container._cfg && container.clientWidth !== container._width) draw(container);
    }).observe(container);
    container.addEventListener("pointerdown", (e) => startDrag(container, e));
    container.addEventListener("pointermove", (e) => onMove(container, e));
    container.addEventListener("pointerup", (e) => endDrag(container, e));
    container.addEventListener("pointercancel", () => cancelDrag(container));
    container.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse" && !container._drag && source === container) clearAll();
    });
    container.addEventListener("dblclick", () => {
      const cfg = container._cfg;
      if (cfg && cfg.onReset) cfg.onReset();
    });
    container.addEventListener("keydown", (e) => onKey(container, e));
    container.addEventListener("focus", () => {
      const geo = container._geo;
      if (geo && container.matches(":focus-visible")) hover(container, geo.series[0].points.length - 1);
    });
    container.addEventListener("blur", () => { if (source === container) clearAll(); });
  }

  function localX(container, event) {
    return event.clientX - container.getBoundingClientRect().left;
  }

  function nearestIndex(geo, px) {
    const pts = geo.series[0].points;
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (geo.x(pts[mid].t) < px) lo = mid; else hi = mid;
    }
    return Math.abs(geo.x(pts[lo].t) - px) <= Math.abs(geo.x(pts[hi].t) - px) ? lo : hi;
  }

  function onMove(container, event) {
    const geo = container._geo;
    if (!geo) return;
    const px = localX(container, event);
    if (container._drag) {
      updateDrag(container, px);
      return;
    }
    if (px < geo.m.left - 6 || px > geo.m.left + geo.pw + 6) {
      if (source === container) clearAll();
      return;
    }
    const index = nearestIndex(geo, px);
    if (index !== geo.index || source !== container) hover(container, index);
  }

  function onKey(container, event) {
    const geo = container._geo;
    if (!geo) return;
    const n = geo.series[0].points.length;
    let index = geo.index < 0 ? n - 1 : geo.index;
    if (event.key === "ArrowLeft") index -= 1;
    else if (event.key === "ArrowRight") index += 1;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = n - 1;
    else if (event.key === "Escape") { clearAll(); return; }
    else return;
    event.preventDefault();
    hover(container, Math.max(0, Math.min(n - 1, index)));
  }

  // Muestra el dato en el gráfico activo y proyecta la misma fecha en los demás gráficos.
  function hover(container, index) {
    source = container;
    const t = container._geo.series[0].points[index].t;
    showAt(container, index);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      plots.forEach((other) => {
        if (!other.isConnected) { plots.delete(other); return; }
        if (other === container || !other._geo || other._drag) return;
        const i = indexAtOrBefore(other._geo.series[0].points, t, other._cfg.tolerance);
        if (i < 0) hideOn(other); else showAt(other, i);
      });
    });
  }

  function clearAll() {
    source = null;
    cancelAnimationFrame(frame);
    plots.forEach((container) => { if (container._geo) hideOn(container); });
  }

  function showAt(container, index) {
    const geo = container._geo;
    const cfg = container._cfg;
    geo.index = index;
    const point = geo.series[0].points[index];
    const rows = geo.series.map((s, i) => ({ s, p: i === 0 ? point : atOrBefore(s.points, point.t, cfg.tolerance) }));
    const xx = geo.x(point.t);

    if (geo.bars) {
      geo.bars.forEach((bar, i) => bar.classList.toggle("dim", i !== index));
    } else {
      geo.hover.setAttribute("visibility", "visible");
      geo.cross.setAttribute("x1", xx);
      geo.cross.setAttribute("x2", xx);
      rows.forEach(({ p }, i) => {
        const dot = geo.dots[i];
        if (p) {
          dot.setAttribute("cx", geo.x(p.t));
          dot.setAttribute("cy", geo.y(p.v));
          // "inherit" (y no "visible") para que al ocultar la capa también se oculten los puntos.
          dot.setAttribute("visibility", "inherit");
        } else {
          dot.setAttribute("visibility", "hidden");
        }
      });
    }

    const tip = geo.tip;
    tip.textContent = "";
    tip.appendChild(div("tip-date", cfg.formatDate(point)));
    rows.forEach(({ s, p }) => {
      const row = div("tip-row");
      const key = document.createElement("span");
      key.className = "key";
      key.style.background = geo.bars ? (p && p.v < 0 ? cfg.colors.neg : cfg.colors.pos) : s.color;
      const value = document.createElement("strong");
      value.textContent = p ? cfg.formatValue(p.v) : "sin dato";
      const label = document.createElement("span");
      label.className = "tip-label";
      label.textContent = s.label;
      row.append(key, value, label);
      tip.appendChild(row);
    });
    tip.hidden = false;
    placeTip(container, xx);
  }

  function placeTip(container, xx) {
    const geo = container._geo;
    const tip = geo.tip;
    let left = xx + 12;
    if (left + tip.offsetWidth > container.clientWidth) left = xx - tip.offsetWidth - 12;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${geo.m.top}px`;
  }

  function hideOn(container) {
    const geo = container._geo;
    geo.index = -1;
    geo.tip.hidden = true;
    geo.hover.setAttribute("visibility", "hidden");
    if (geo.bars) geo.bars.forEach((bar) => bar.classList.remove("dim"));
  }

  /* ---------- zoom arrastrando ---------- */

  function startDrag(container, event) {
    const geo = container._geo;
    const cfg = container._cfg;
    if (!geo || !cfg.onZoom || event.button !== 0) return;
    const px = localX(container, event);
    if (px < geo.m.left || px > geo.m.left + geo.pw) return;
    event.preventDefault();
    container._drag = { x0: px, x1: px };
    container.setPointerCapture(event.pointerId);
  }

  function updateDrag(container, px) {
    const geo = container._geo;
    const cfg = container._cfg;
    const drag = container._drag;
    drag.x1 = Math.max(geo.m.left, Math.min(geo.m.left + geo.pw, px));
    const left = Math.min(drag.x0, drag.x1);
    const width = Math.abs(drag.x1 - drag.x0);
    if (width < DRAG_THRESHOLD) {
      geo.selection.setAttribute("visibility", "hidden");
      return;
    }
    if (source) clearAll();
    geo.selection.setAttribute("x", left);
    geo.selection.setAttribute("width", width);
    geo.selection.setAttribute("visibility", "visible");

    const tip = geo.tip;
    tip.textContent = "";
    const range = div("tip-row");
    const strong = document.createElement("strong");
    strong.textContent = `${cfg.formatTime(geo.invert(left))} – ${cfg.formatTime(geo.invert(left + width))}`;
    range.appendChild(strong);
    tip.append(range, div("tip-date", "Suelta para acercar este período"));
    tip.hidden = false;
    placeTip(container, left + width);
  }

  function endDrag(container, event) {
    const drag = container._drag;
    if (!drag) return;
    container._drag = null;
    if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
    const geo = container._geo;
    geo.selection.setAttribute("visibility", "hidden");
    geo.tip.hidden = true;
    if (Math.abs(drag.x1 - drag.x0) < DRAG_THRESHOLD) {
      onMove(container, event);
      return;
    }
    const from = geo.invert(Math.min(drag.x0, drag.x1));
    const to = geo.invert(Math.max(drag.x0, drag.x1));
    container._cfg.onZoom(from, to);
  }

  function cancelDrag(container) {
    if (!container._drag) return;
    container._drag = null;
    if (container._geo) {
      container._geo.selection.setAttribute("visibility", "hidden");
      container._geo.tip.hidden = true;
    }
  }

  window.Plot = { render, message, atOrBefore, clear: clearAll };
})();
