// Draws the Money Year from the embedded model: a headline that states the year's finding, then four charts across the
// full width on one shared time axis (one measure each, never two scales on one chart), coloured by the kind of data
// (interest rates, prices, the currency). Readings sit on the charts: the decisions, highs and lows, the latest values
// and, as the slider or pointer moves, the value on that day. A Budget 2026 line runs through every chart; the proposals
// follow, grouped by the year they would start; then the numbers as a table. Every figure comes from the model, computed
// at build time from the dated Bank of Canada snapshot and the confirmed facts. No request after load; nothing stored;
// nothing put in the address.
(function () {
  'use strict';
  const M = JSON.parse(document.getElementById('data').textContent);
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const DAY = 864e5;
  const t = (d) => Date.parse(d + 'T00:00:00Z');
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const T0 = t(M.start), T1 = t(M.end), LAST = t(M.retrieved);
  const DAYS = Math.round((Math.min(LAST, T1) - T0) / DAY);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const longDate = (d) => { const [y, m, day] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${day}, ${y}`; };
  const monthDay = (d) => { const [, m, day] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${day}`; };
  const fmt = (p, v) => v.toFixed(p.digits) + p.unit;
  // Colour by the kind of data: interest rates, prices, the currency. Amber stays for the one highlight.
  const COLOUR = { policy: 'd1', mortgage: 'd1', inflation: 'd3', loonie: 'd4' };
  const panel = (id) => M.panels.find((p) => p.id === id);
  const el = (tag, attrs, parent, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const html = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  // The value in force on a day: the last observation on or before it.
  const valueAt = (pts, d) => { let r = null; for (const p of pts) { if (p[0] <= d) r = p; else break; } return r; };
  const niceStep = (range, n) => {
    const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  };

  // Places labels so that no two overlap: each label tries its candidate spots in order and keeps the first that stays
  // inside the chart and clear of every box placed before it; a label that fits nowhere is left out.
  function placer(W, H, seed) {
    const boxes = seed ? seed.slice() : [];
    const hit = (b) => boxes.some((o) => b.x < o.x + o.w + 3 && o.x < b.x + b.w + 3 && b.y < o.y + o.h + 1 && o.y < b.y + b.h + 1);
    return {
      boxes,
      reserve(b) { boxes.push(b); },
      fixed(tx) { const b = tx.getBBox(); boxes.push({ x: b.x, y: b.y, w: b.width, h: b.height }); return tx; },
      put(layer, cls, cands, pad) {
        pad = pad || 0;
        const tx = el('text', { class: cls }, layer);
        for (const c of cands) {
          tx.textContent = c.text; tx.setAttribute('x', c.x); tx.setAttribute('y', c.y); tx.setAttribute('text-anchor', c.anchor || 'start');
          const bb = tx.getBBox(), b = { x: bb.x - pad, y: bb.y - pad, w: bb.width + 2 * pad, h: bb.height + 2 * pad };
          if (b.x >= 0 && b.x + b.w <= W && b.y >= 0 && b.y + b.h <= H && !hit(b)) { boxes.push(b); return { tx, b, c }; }
        }
        tx.remove();
        return null;
      },
    };
  }
  // Candidate spots beside a point: right of it, then left, stepping up and down until one is free.
  // With rightFirst, every spot on the right is tried before any on the left.
  function beside(px, py, text, gap, dy, steps, rightFirst) {
    const out = [], offs = [0], right = [], left = [];
    for (let k = 1; k <= steps; k++) offs.push(-k * dy, k * dy);
    for (const o of offs) { right.push({ x: px + gap, y: py + o, anchor: 'start', text }); left.push({ x: px - gap, y: py + o, anchor: 'end', text }); }
    if (rightFirst) return right.concat(left);
    right.forEach((r, i) => out.push(r, left[i]));
    return out;
  }

  const panelsRoot = $('panels');
  const slider = $('when');
  const readout = $('readout');
  const views = [];

  function draw() {
    panelsRoot.textContent = '';
    views.length = 0;
    const W = Math.max(300, Math.floor(panelsRoot.clientWidth)), narrow = W < 640, fs = narrow ? 12 : 13, dy = fs + 4;
    const x = (d) => ((t(d) - T0) / (T1 - T0)) * W; // the whole year, edge to edge, the same on every chart
    const xr = x(M.retrieved);
    M.panels.forEach((p) => {
      const box = html('section', `panel c-${COLOUR[p.id] || 'd1'}${p.hero ? ' hero' : ''}`);
      box.setAttribute('aria-labelledby', `h-${p.id}`);
      // The header: the measure's name, and where it started and where it is now.
      const head = html('div', 'panel-head');
      const h = html('h3', null, p.title); h.id = `h-${p.id}`; head.appendChild(h);
      if (p.summary) {
        const s = html('p', 'delta');
        s.append(html('span', 'from', p.summary.from), html('span', 'arrow', ' to '), html('span', 'to', p.summary.to));
        if (p.summary.label) s.append(html('span', 'what', ` ${p.summary.label}`));
        head.appendChild(s);
      }
      box.appendChild(head);
      if (p.lines.length > 1) {
        const lg = html('p', 'legend');
        p.lines.forEach((l) => { const k = html('span', 'item'); k.append(html('span', `key${l.dashed ? ' dashed' : ''}`), document.createTextNode(l.label)); k.firstChild.setAttribute('aria-hidden', 'true'); lg.appendChild(k); });
        box.appendChild(lg);
      }

      const PH = p.hero ? (narrow ? 210 : 290) : (narrow ? 150 : 180);
      const TOP = fs + 10, H = PH + fs + 12;
      const all = p.lines.flatMap((l) => l.points.map((q) => q[1]));
      let lo = Math.min(...all), hi = Math.max(...all);
      const pad = Math.max((hi - lo) * 0.3, hi * 0.02);
      lo -= pad; hi += pad;
      const y = (v) => TOP + (1 - (v - lo) / (hi - lo)) * (PH - TOP - 6);
      const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${p.title}: ${p.note}` });
      box.appendChild(svg);
      panelsRoot.appendChild(box); // on the page before drawing, so text can be measured
      const marks = el('g', {}, svg), labels = el('g', {}, svg);
      const P = placer(W, PH);

      // Grid, the part of the year not in yet, the axis of months
      const gs = niceStep(hi - lo, narrow ? 3 : 4), dec = Math.max(0, -Math.floor(Math.log10(gs) + 1e-9));
      const grid = [];
      for (let g = Math.ceil(lo / gs) * gs; g <= hi; g += gs) { grid.push(g); el('line', { x1: 0, x2: W, y1: y(g), y2: y(g), class: 'grid' }, marks); }
      if (LAST < T1) el('rect', { x: xr, y: 0, width: W - xr, height: PH, class: 'future' }, marks);
      el('line', { x1: 0, x2: W, y1: PH, y2: PH, class: 'axis' }, marks);
      MON.forEach((m, i) => {
        const d = `${M.year}-${String(i + 1).padStart(2, '0')}-01`, mx = x(d);
        el('line', { x1: mx, x2: mx, y1: PH, y2: PH + 5, class: 'axis' }, marks);
        if (!narrow || i % 2 === 0) el('text', { x: mx + 3, y: PH + fs + 6, class: 'tick' }, labels, m);
      });

      // Budget 2026: one line through every chart, joining the year to what's proposed next.
      const bx = M.budgetDay ? x(M.budgetDay) : null;
      if (bx != null) el('line', { x1: bx, x2: bx, y1: 0, y2: PH, class: 'budget' }, marks);

      // The lines
      for (const l of p.lines) {
        // a value from before the year (carried in for the summary) is drawn only if no value of the year starts the line
        const inYear = l.points.filter((q) => q[0] >= M.start);
        const drawn = inYear.length && inYear[0][0] === M.start ? inYear : l.points;
        const pts = drawn.map((q) => [Math.max(0, x(q[0])), y(q[1])]);
        if (p.step) pts.push([xr, pts.at(-1)[1]]);
        let d = '';
        pts.forEach(([X, Y], i) => { d += i === 0 ? `M${X},${Y}` : p.step ? `H${X}V${Y}` : `L${X},${Y}`; });
        // the line's path is kept clear of labels: reserve it in short pieces
        pts.forEach(([X, Y], i) => {
          if (!i) return;
          const [X0, Y0] = pts[i - 1];
          const pieces = p.step ? [[X0, Y0, X, Y0], [X, Y0, X, Y]] : [[X0, Y0, X, Y]];
          for (const [a, b, c, e] of pieces) {
            const n = Math.max(1, Math.ceil(Math.abs(c - a) / 6));
            for (let k = 0; k < n; k++) {
              const xa = a + ((c - a) * k) / n, xb = a + ((c - a) * (k + 1)) / n, ya = b + ((e - b) * k) / n, yb = b + ((e - b) * (k + 1)) / n;
              P.reserve({ x: Math.min(xa, xb), y: Math.min(ya, yb) - 1.5, w: Math.abs(xb - xa), h: Math.abs(yb - ya) + 3 });
            }
          }
        });
        if (!l.dashed) el('path', { d: `${d}V${PH}H${pts[0][0]}Z`, class: 'area' }, marks);
        el('path', { d, class: `line${l.dashed ? ' dashed' : ''}${p.hero ? ' heavy' : ''}` }, marks);
      }

      // Callouts: the rate decisions (the one amber highlight), the highs and the lows
      for (const c of p.callouts) {
        const cx = x(c.d), cy = y(c.v), r = p.hero ? 6 : 5;
        el('circle', { cx, cy, r, class: 'ring' }, marks);
        P.reserve({ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r });
        const near = c.below ? cy + r + fs + 6 : cy - r - 8, step = c.below ? dy : -dy, cands = [];
        for (let k = 0; k < 4; k++) for (const [ax, an] of [[cx, 'middle'], [cx - 4, 'end'], [cx + 4, 'start']]) cands.push({ x: ax, y: near + k * step, anchor: an, text: c.text });
        for (let k = 0; k < 3; k++) cands.push({ x: cx - r - 6, y: cy + fs / 3 - k * step, anchor: 'end', text: c.text }, { x: cx + r + 6, y: cy + fs / 3 - k * step, anchor: 'start', text: c.text });
        const got = P.put(labels, `callout${c.mark ? ' marked' : ''}${p.hero ? ' big' : ''}`, cands, c.mark ? 4 : 0);
        if (!got) continue;
        if (c.mark) labels.insertBefore(el('rect', { x: got.b.x, y: got.b.y, width: got.b.w, height: got.b.h, rx: 2, class: 'mark' }), got.tx);
        if (got.b.x < cx && got.b.x + got.b.w > cx) { // straight above or below: a short leader to the ring
          const y1 = c.below ? cy + r : cy - r, y2 = c.below ? got.b.y : got.b.y + got.b.h;
          if (Math.abs(y2 - y1) > 3) el('line', { x1: cx, x2: cx, y1, y2, class: 'leader' }, marks);
        }
      }

      // The latest value of each line, written at its end
      for (const l of p.lines) {
        // a line that ends close to the latest day is labelled past it, clear of the day marker
        const q = l.points.at(-1), lx = p.step || x(q[0]) > xr - 40 ? xr : x(q[0]), ly = y(q[1]);
        const text = `${fmt(p, q[1])}${p.lines.length > 1 ? ' ' + l.label : ''}`;
        P.put(labels, `endlabel${l.dashed ? ' soft' : ''}`, beside(lx, ly + fs / 3, text, 8, dy, 4, true));
      }
      if (bx != null && p.hero) P.put(labels, 'budget-label', [{ x: bx - 6, y: fs + 2, anchor: 'end', text: 'Budget 2026' }, { x: bx + 6, y: fs + 2, text: 'Budget 2026' }, { x: bx - 6, y: PH - 8, anchor: 'end', text: 'Budget 2026' }]);
      // Scale labels last: they give way to everything else
      for (const g of grid) {
        const s = g.toFixed(dec) + p.unit;
        P.put(labels, 'tick', [{ x: 0, y: y(g) - 4, text: s }, { x: W - 2, y: y(g) - 4, anchor: 'end', text: s }]);
      }

      // the day marker sits under the written readings, so it never hides one
      const cross = el('line', { y1: 0, y2: PH, class: 'cross', visibility: 'hidden' }, marks);
      const dots = p.lines.map(() => el('circle', { r: narrow ? 4 : 4.5, class: 'dot', visibility: 'hidden' }, marks));
      const live = el('g', { class: 'live' }, svg);
      const hitArea = el('rect', { x: 0, y: 0, width: W, height: PH, class: 'hit' }, svg);
      hitArea.addEventListener('pointermove', (e) => { const r = svg.getBoundingClientRect(); setDay(Math.round(((e.clientX - r.left) / r.width) * ((T1 - T0) / DAY))); });
      hitArea.addEventListener('pointerdown', (e) => hitArea.dispatchEvent(new PointerEvent('pointermove', e)));
      box.appendChild(html('p', 'note', p.note));
      views.push({ p, x, y, cross, dots, live, W, PH, fs, dy, seed: P.boxes.slice() });
    });
    setDay(Number(slider.value));
  }

  // One day picked, by pointer or slider: every chart shows it and writes its value there, and the readout says it all
  // in words. A line's latest value is already written at its end, so it isn't repeated.
  function setDay(n) {
    n = Math.max(0, Math.min(DAYS, n));
    slider.value = n;
    const d = iso(T0 + n * DAY);
    const parts = [];
    for (const v of views) {
      const X = v.x(d);
      v.cross.setAttribute('x1', X); v.cross.setAttribute('x2', X); v.cross.setAttribute('visibility', 'visible');
      v.live.textContent = '';
      const P = placer(v.W, v.PH, v.seed);
      P.reserve({ x: X - 1, y: 0, w: 2, h: v.PH });
      v.p.lines.forEach((l, i) => {
        const q = valueAt(l.points, d);
        if (!q) { v.dots[i].setAttribute('visibility', 'hidden'); return; }
        const Y = v.y(q[1]);
        v.dots[i].setAttribute('cx', X); v.dots[i].setAttribute('cy', Y); v.dots[i].setAttribute('visibility', 'visible');
        const said = `${fmt(v.p, q[1])}${v.p.monthly ? ` (${MON[Number(q[0].slice(5, 7)) - 1]})` : ''}`;
        parts.push(`${l.label} ${said}`);
        if (q !== l.points.at(-1)) P.put(v.live, 'now', beside(X, Y - 8, v.p.lines.length > 1 ? `${l.label} ${said}` : said, 9, v.dy, 3));
      });
    }
    const text = `${longDate(d)}: ${parts.join(', ')}.`;
    readout.textContent = text;
    slider.setAttribute('aria-valuetext', text);
  }

  // The headline states the year's finding, from the policy rate's decisions; the lede gives the other three.
  function finding() {
    const h = $('finding'), pol = panel('policy');
    h.textContent = '';
    const add = (text, hl) => { if (hl) h.appendChild(html('span', 'hl', text)); else h.appendChild(document.createTextNode(text)); };
    if (!pol) { add("Canada's money year, graphed"); return; }
    const dec = pol.decisions || [];
    if (!dec.length) { add('The Bank of Canada held its policy rate at '); add(pol.summary.to, true); add(` all of ${M.year} so far.`); return; }
    if (dec.length === 1) {
      const c = dec[0];
      add(`The Bank of Canada held its policy rate at ${pol.summary.from} until ${monthDay(c.d)}, then ${c.to > c.from ? 'raised' : 'cut'} it to `);
      add(pol.summary.to, true); add('.');
      return;
    }
    add(`The Bank of Canada changed its policy rate ${dec.length} times in ${M.year}, from ${pol.summary.from} to `);
    add(pol.summary.to, true); add('.');
  }
  function lede() {
    const out = [], num = (s) => parseFloat(s);
    const mor = panel('mortgage'), inf = panel('inflation'), fx = panel('loonie');
    const move = (s, up, down) => (num(s.to) > num(s.from) ? up : num(s.to) < num(s.from) ? down : null);
    if (mor) { const w = move(mor.summary, 'rose', 'fell'); out.push(w ? `posted 5-year mortgage rates ${w} from ${mor.summary.from} to ${mor.summary.to}` : `posted 5-year mortgage rates stood at ${mor.summary.to}`); }
    if (inf) { const w = move(inf.summary, 'rose', 'eased'); out.push(w ? `core inflation (${inf.summary.label}) ${w} from ${inf.summary.from} to ${inf.summary.to}` : `core inflation (${inf.summary.label}) stood at ${inf.summary.to}`); }
    if (fx) { const w = move(fx.summary, 'weakened', 'strengthened'); out.push(w ? `the loonie ${w}: a US dollar went from ${fx.summary.from} to ${fx.summary.to} Canadian dollars` : `a US dollar cost ${fx.summary.to} Canadian dollars`); }
    let s = '';
    if (out.length) { const last = out.pop(); s = `Over the same months, ${out.length ? out.join(', ') + ', and ' : ''}${last}. `; }
    s += `Four measures on one timeline${M.proposals.length ? ', then what Budget 2026 proposes next' : ''}.`;
    $('lede').textContent = s;
  }

  // The proposals, grouped by the year they would start; an item without a confirmed date goes in the first group.
  function lane() {
    const root = $('lane'), groups = new Map();
    for (const p of M.proposals) { const yr = p.at ? p.at.slice(0, 4) : String(M.year); (groups.get(yr) ?? groups.set(yr, []).get(yr)).push(p); }
    for (const [yr, items] of groups) {
      const col = html('li', 'year-col');
      col.appendChild(html('p', 'year', yr));
      const ol = html('ol', 'cards');
      for (const p of items) {
        const li = html('li', 'card');
        li.append(html('p', 'when', p.when), html('h3', null, p.title), html('p', 'value', p.value), html('p', 'detail', p.detail), html('p', 'stamp', p.stamp ?? 'Proposed, not law'));
        ol.appendChild(li);
      }
      col.appendChild(ol);
      root.appendChild(col);
    }
    if (!M.proposals.length) $('budget').hidden = true;
    if (M.budgetUrl) $('budget-link').href = M.budgetUrl;
  }

  // The numbers: each series at the end of every month so far (the last value in force that day).
  function table() {
    const tbody = $('rows'), series = M.panels.flatMap((p) => p.lines.map((l) => ({ p, l })));
    const head = $('head');
    head.appendChild(Object.assign(html('th', null, 'End of month'), { scope: 'col' }));
    for (const { l } of series) head.appendChild(Object.assign(html('th', null, l.label), { scope: 'col' }));
    for (let m = 1; m <= 12; m++) {
      const endOfMonth = iso(Date.UTC(M.year, m, 0));
      const d = endOfMonth > M.retrieved ? M.retrieved : endOfMonth;
      if (d < `${M.year}-${String(m).padStart(2, '0')}-01`) break;
      const tr = document.createElement('tr');
      tr.appendChild(Object.assign(html('th', null, longDate(d)), { scope: 'row' }));
      for (const { p, l } of series) { const q = valueAt(l.points, d); tr.appendChild(html('td', null, q ? fmt(p, q[1]) : '–')); }
      tbody.appendChild(tr);
    }
  }

  function sources() {
    const S = M.source, link = (href, text) => Object.assign(html('a', null, text), { href });
    const src = $('src');
    src.append(link(S.source_url, 'Bank of Canada data'), ` (the policy rate, the posted 5-year mortgage rate, CPI-trim and CPI-median, and USD/CAD). Series retrieved ${longDate(S.retrieved)}; `, link(S.terms_url, 'the Bank’s terms of use'), `. ${S.attribution}`);
    const foot = $('foot-attr');
    foot.append(`${S.attribution} `, link(S.terms_url, 'Terms of use'), '.');
    if (M.budgetUrl) { const b = $('budget-src'); b.textContent = 'Budget 2026 proposals: Department of Finance Canada, Budget 2026, '; b.append(link(M.budgetUrl, 'Tax measures: Supplementary information'), '.'); }
    $('kicker').textContent = `Data story · Bank of Canada data to ${longDate(M.retrieved)}`;
  }

  slider.max = DAYS;
  slider.value = DAYS;
  $('asof').textContent = `Data to ${longDate(M.retrieved)}. The shaded end of each chart is the part of the year that isn't in yet.${M.budgetDay ? ` The dashed line marks Budget 2026, ${longDate(M.budgetDay)}.` : ''}`;
  slider.addEventListener('input', () => setDay(Number(slider.value)));
  finding(); lede(); lane(); table(); sources(); draw();
  let lastW = panelsRoot.clientWidth;
  new ResizeObserver(() => { if (panelsRoot.clientWidth !== lastW) { lastW = panelsRoot.clientWidth; draw(); } }).observe(panelsRoot);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();
