// The retirement wave. The model (counts by place, gender, year and age; each year's population; the rule ages from the
// confirmed facts) is embedded in #data, and the calculations come from model.mjs, inlined above this script. The birth
// year, place and choices stay in this page: not stored, not put in the address, not sent anywhere. The only file this
// page makes is an image the visitor asks to save.
(() => {
  'use strict';
  const D = JSON.parse(document.getElementById('data').textContent), M = D.model, STEPS = D.steps;
  const EXAMPLE_BIRTH = 1950;
  const [y0, y1] = M.years, [a0, a1] = M.ages, [bLo, bHi] = bornRange(M);
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const n = (v) => Math.round(v).toLocaleString('en-CA');
  const state = { place: 'CA', gender: 'all', mode: 'count', born: EXAMPLE_BIRTH, example: true };
  let V = view(M, state.place, state.gender);
  const fmt = (v, mode = state.mode) => (mode === 'share' ? pct(v, 2) : n(v));
  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const html = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  const clear = (svg) => [...svg.childNodes].forEach((c) => { if (c.nodeName !== 'title') svg.removeChild(c); });
  // Spread items apart vertically (each item has a centre `want` and a height `h`) so none comes closer than `pad` to the
  // next, staying between lo and hi. Returns the items with their centre `y`.
  function relax(items, pad, lo, hi) {
    items.sort((p, q) => p.want - q.want);
    const gap = (i) => (items[i - 1].h + items[i].h) / 2 + pad;
    items.forEach((it, i) => { it.y = Math.max(it.want, lo + it.h / 2, i ? items[i - 1].y + gap(i) : -Infinity); });
    for (let i = items.length - 1; i >= 0; i--) items[i].y = Math.min(items[i].y, i < items.length - 1 ? items[i + 1].y - gap(i + 1) : hi - items[i].h / 2);
    items.forEach((it, i) => { it.y = Math.max(it.y, lo + it.h / 2, i ? items[i - 1].y + gap(i) : -Infinity); });
    return items;
  }
  const hit = (a, b, pad = 0) => a.x < b.r + pad && b.x < a.r + pad && a.y < b.b + pad && b.y < a.b + pad;
  // The real box of one line of text in a class, measured in the chart itself: its height (ascent plus descent, the box the
  // browser gives the text) and the shift from a line's centre to its baseline. Line spacing and label heights come from
  // this, so they follow the face and size the page really draws.
  function metrics(svg, cls) {
    const t = el('text', { class: cls, x: 0, y: 0 }, svg, 'Hg'), b = t.getBBox(); t.remove();
    const asc = -b.y, desc = b.height + b.y;
    return { h: b.height, lh: b.height + 1, mid: (asc - desc) / 2 };
  }
  // Lines of text in one group with one ground-coloured backing behind them: [[tspan text, class], ...] per line, spaced
  // and centred on cy by the class's metrics m.
  function label(parent, cls, lines, x, cy, anchor, m) {
    const g = el('g', { class: `lbl ${cls}-g` }, parent), bg = el('rect', { class: `${cls}-bg`, rx: 2 }, g);
    const t = el('text', { class: cls, 'text-anchor': anchor }, g);
    lines.forEach((parts, k) => {
      parts.forEach(([text, c], j) => {
        const sp = el('tspan', c ? { class: c } : {}, t, text);
        if (j === 0) { sp.setAttribute('x', x); sp.setAttribute('y', (cy + m.mid + (k - (lines.length - 1) / 2) * m.lh).toFixed(1)); }
      });
    });
    const fit = () => { const b = t.getBBox(); bg.setAttribute('x', b.x - 4); bg.setAttribute('y', b.y - 2); bg.setAttribute('width', b.width + 8); bg.setAttribute('height', b.height + 4); return { x: b.x - 4, y: b.y - 2, r: b.x + b.width + 4, b: b.y + b.height + 2 }; };
    const move = (nx, na) => { t.setAttribute('text-anchor', na); t.querySelectorAll('tspan[x]').forEach((sp) => sp.setAttribute('x', nx)); return fit(); };
    return { g, t, box: fit(), move };
  }

  // ---------- the heatmap ----------
  // where the pointer is, read before the chart's own listeners (the crosshair reads across; this gives the row)
  let pointerY = null;
  for (const ev of ['pointermove', 'pointerdown']) $('frame').addEventListener(ev, (e) => { pointerY = e.clientY; }, true);
  let unhair = null;
  function drawHeat() {
    const svg = $('heat');
    if (unhair) unhair();
    clear(svg);
    const W = Math.max(300, $('frame').clientWidth), narrow = W < 640;
    // The grid runs the full width. Wide: the rule names sit inside the grid on a ground-coloured backing, wherever the
    // line is clear of the diagonal's readings. Narrow: a thin gutter on the right holds the rule ages, and the names are
    // in the key under the chart.
    const left = narrow ? 26 : 34, right = narrow ? 28 : 3, top = 8, bottom = 30;
    const cols = y1 - y0 + 1, rows = a1 - a0 + 1, cw = (W - left - right) / cols;
    const ch = narrow ? Math.min(9, Math.max(8, cw * 1.5)) : Math.min(15, Math.max(9, cw * 0.75));
    const plotW = cols * cw, plotH = rows * ch, H = top + plotH + bottom, R = left + plotW;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
    const X = (y) => left + (y - y0) * cw, Y = (a) => top + (a1 - a) * ch, Yc = (a) => Y(a) + ch / 2;
    const [lo, hi] = range(M, V, state.mode);
    const cells = el('g', {}, svg);
    for (let y = y0; y <= y1; y++) for (let a = a0; a <= a1; a++) {
      el('rect', { class: `cell q${level(value(M, V, state.mode, y, a), lo, hi, STEPS)}`, x: X(y).toFixed(2), y: Y(a).toFixed(2), width: (cw + 0.5).toFixed(2), height: (ch + 0.5).toFixed(2) }, cells);
    }
    // axes: ages on the left, years along the bottom
    for (const a of niceTicks(a0, a1, narrow ? 4 : 8).ticks) el('text', { class: 'lab', x: left - 6, y: Yc(a) + 4, 'text-anchor': 'end' }, svg, String(a));
    const yt = niceTicks(y0, y1, narrow ? 4 : 11).ticks, ly = top + plotH + 19, xs = [];
    for (const y of yt) { el('line', { class: 'leader', x1: X(y) + cw / 2, x2: X(y) + cw / 2, y1: top + plotH, y2: top + plotH + 4 }, svg); el('text', { class: 'lab', x: X(y) + cw / 2, y: ly, 'text-anchor': 'middle' }, svg, String(y)); xs.push(X(y) + cw / 2); }
    if (xs[0] - X(y0) > 58) el('text', { class: 'lab', x: X(y0), y: ly, 'text-anchor': 'start' }, svg, String(y0));
    if (R - xs.at(-1) > 58) el('text', { class: 'lab', x: R, y: ly, 'text-anchor': 'end' }, svg, String(y1));

    // the rule ages: dashed lines across the whole grid
    for (const r of M.rules) {
      el('line', { class: 'rule-halo', x1: left, x2: R, y1: Yc(r.age), y2: Yc(r.age) }, svg);
      el('line', { class: 'rule', x1: left, x2: R, y1: Yc(r.age), y2: Yc(r.age) }, svg);
    }

    // the diagonal: one group of people, a year older every July 1
    const d = diagonal(M, V, state.mode, state.born);
    if (d.cells.length) {
      // A band through the diagonal's cells: from the first cell's bottom edge to the last cell's top edge.
      const [fy, fa] = d.cells[0], [ly, la] = d.last;
      const pts = [[X(fy), Y(fa) + ch], [X(fy) + cw, Y(fa) + ch], [X(ly) + cw, Y(la)], [X(ly), Y(la)]].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
      el('polygon', { class: 'diag-halo', points: pts }, svg);
      el('polygon', { class: 'diag', points: pts }, svg);
    }
    // readings where the diagonal crosses each rule age, and where it starts and ends in the data; crossings a year or
    // two apart share one tag, so their readings never sit on top of each other
    const marks = d.crossings.filter((c) => c.when === 'in').map((c) => ({ year: c.year, age: c.age, v: c.value }));
    const near = (a) => marks.some((m) => Math.abs(m.age - a) < 3);
    if (d.cells.length) {
      const [fy, fa, fv] = d.cells[0], [ly2, la, lv] = d.last;
      if (!near(fa)) marks.push({ year: fy, age: fa, v: fv });
      if (!near(la) && (la !== fa)) marks.push({ year: ly2, age: la, v: lv });
    }
    marks.sort((p, q) => p.age - q.age);
    const groups = [];
    for (const m of marks) { const g = groups.at(-1); if (g && m.age - g.at(-1).age <= 2) g.push(m); else groups.push([m]); }
    // a backing reaches 2px above and below its text (label's fit), so a label is its lines plus 4
    const TM = metrics(svg, 'tag'), RM = metrics(svg, 'rule-n'), back = 4;
    const tagLayer = el('g', {}, svg), dotLayer = el('g', {}, svg), obstacles = [];
    const parts = (m) => [[`${m.age} in ${m.year}`], [`: ${fmt(m.v)}`, 'v']];
    const tags = relax(groups.map((g) => {
      const cx = g.reduce((s, m) => s + X(m.year) + cw / 2, 0) / g.length, cy = g.reduce((s, m) => s + Yc(m.age), 0) / g.length;
      const k = narrow && g.length > 1 ? g.length : 1;
      return { g, cx, cy, want: cy, h: TM.h + (k - 1) * TM.lh + back };
    }), 3, top + 2, top + plotH - 2);
    for (const it of tags) {
      const xs2 = it.g.map((m) => X(m.year) + cw / 2), xl = Math.min(...xs2) - 9, xr = Math.max(...xs2) + 9;
      // One line when it fits beside the dots; otherwise one reading per line, in the same backing.
      const one = [it.g.flatMap((m, k) => (k ? [[' · '], ...parts(m)] : parts(m)))];
      const many = it.g.slice().reverse().map(parts);
      let L = label(tagLayer, 'tag', narrow && it.g.length > 1 ? many : one, xl, it.y, 'end', TM);
      if (L.box.x < left + 1) {
        L.box = L.move(xr, 'start');
        if (L.box.r > R - 1 && it.g.length > 1 && !(narrow)) { L.g.remove(); L = label(tagLayer, 'tag', many, xl, it.y, 'end', TM); if (L.box.x < left + 1) L.box = L.move(xr, 'start'); }
        if (L.box.r > R - 1) L.box = L.move(Math.max(left + 5, R - 5 - (L.box.r - L.box.x - 8)), 'start');
      }
      obstacles.push(L.box);
      for (const m of it.g) {
        const cx = X(m.year) + cw / 2, cy = Yc(m.age);
        if (Math.abs(it.y - cy) > 2 || it.g.length > 1) {
          const ex = L.box.x > cx ? L.box.x : L.box.r, ey = Math.min(Math.max(cy, L.box.y + 3), L.box.b - 3);
          if (Math.abs(ex - cx) > 6 || Math.abs(ey - cy) > 3) el('path', { class: 'leader', d: `M${cx},${cy} L${ex},${ey}` }, tagLayer);
        }
        el('circle', { class: 'dot', cx, cy, r: narrow ? 3.5 : 4.5 }, dotLayer);
        obstacles.push({ x: cx - 6, r: cx + 6, y: cy - 6, b: cy + 6 });
      }
    }
    svg.appendChild(dotLayer);

    // the rule names
    const ruleLayer = el('g', {}, svg);
    if (narrow) {
      const rl = relax(M.rules.map((r) => ({ r, want: Yc(r.age), h: RM.h })), 2, top, top + plotH + 8);
      for (const it of rl) {
        const x = R + 6;
        if (Math.abs(it.y - it.want) > 1) el('path', { class: 'leader', d: `M${R},${Yc(it.r.age)} L${x - 2},${it.y}` }, ruleLayer);
        const g = el('g', { class: 'lbl' }, ruleLayer);
        el('text', { class: 'rule-n', x, y: it.y + RM.mid }, g, String(it.r.age));
      }
    } else {
      const rl = relax(M.rules.map((r) => ({ r, want: Yc(r.age), h: RM.h + back })), 3, top, top + plotH);
      const placed = [];
      for (const it of rl) {
        const age = it.r.age, yc = state.born + age;
        // the diagonal's own cells near this line are kept clear too
        const zone = yc >= y0 && yc <= y1 ? [{ x: X(yc - 1), r: X(yc + 2), y: it.y - RM.h / 2, b: it.y + RM.h / 2 }] : [];
        const L = label(ruleLayer, 'rule-n', [[[String(age), 'age'], [`  ${it.r.label}`, 'what']]], left + 6, it.y, 'start', RM);
        const wdt = L.box.r - L.box.x, clear = (b) => ![...obstacles, ...zone].some((o) => hit(b, o, 2)) && !placed.some((o) => hit(b, o, 0));
        // left edge first, then the right edge, then along the line
        const tries = [[left + 6, 'start'], [R - 6, 'end']];
        for (let x = left + 6 + 48; x + wdt < R - 6; x += 48) tries.push([x, 'start']);
        let ok = false;
        for (const [x, a] of tries) { const b = L.move(x, a); if (clear(b)) { L.box = b; ok = true; break; } }
        if (!ok) L.box = L.move(left + 6, 'start');
        placed.push(L.box);
      }
    }
    $('rule-key').hidden = !narrow;

    $('heat-title').textContent = `Heatmap of ${state.mode === 'share' ? 'each age’s share of the population' : 'the number of people at each age'}, ${who(M, state.place, state.gender)}, ages ${a0} to ${a1}, July 1, ${y0} to ${y1}, with the rule ages as dashed lines and the diagonal for people born in ${state.born}. The numbers are in the table below the chart.`;
    svg.onpointermove = (e) => {
      const r = svg.getBoundingClientRect(), k = W / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
      const y = y0 + Math.floor((px - left) / cw), a = a1 - Math.floor((py - top) / ch);
      if (y < y0 || y > y1 || a < a0 || a > a1) return;
      $('point').textContent = `July 1, ${y}: ${n(V.counts[y][a - a0])} ${who(M, state.place, state.gender)} were ${a}, ${pct(value(M, V, 'share', y, a), 2)} of the population.`;
    };
    // the reading box over the square under the pointer: its year, age, count and share
    unhair = deskCrosshair(svg, { x0: left, x1: R - 0.01, y0: top, y1: top + plotH, read: (px) => {
      if (pointerY == null) return null;
      const r = svg.getBoundingClientRect(), py = (pointerY - r.top) * (W / r.width);
      const y = Math.min(y1, y0 + Math.floor((px - left) / cw)), a = a1 - Math.floor((py - top) / ch);
      if (a < a0 || a > a1) return null;
      return { x: X(y) + cw / 2, y: Y(a), lines: [`Age ${a}, July 1, ${y}`, `${n(V.counts[y][a - a0])} people`, `${pct(value(M, V, 'share', y, a), 2)} of the population`] };
    } });
    drawLegend(lo, hi);
    return d;
  }

  // ---------- the colour key, with real values ----------
  function drawLegend(lo, hi) {
    const box = $('legend'); box.textContent = '';
    box.appendChild(html('p', state.mode === 'share' ? 'Share of the whole population, at one age' : 'Number of people, at one age', 'legend-t'));
    const W = Math.min(Math.max(260, box.clientWidth), 480), H = 40, pad = 4, bw = W - pad * 2;
    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img' });
    const { step, ticks } = niceTicks(lo, hi, W < 380 ? 4 : 7);
    const dp = Math.max(0, Math.ceil(-Math.log10(step * 100) - 1e-9));
    const lab = (v) => (state.mode === 'share' ? pct(v, dp) : n(v));
    el('title', {}, svg, `Colour key: from the faintest to the strongest shade, ${fmt(lo)} to ${fmt(hi)}${state.mode === 'share' ? ' of the population' : ' people'}.`);
    for (let k = 0; k < STEPS; k++) el('rect', { class: `q${k}`, x: pad + k * bw / STEPS, y: 0, width: bw / STEPS + 0.5, height: 12 }, svg);
    for (const t of ticks) {
      const x = pad + (t - lo) / (hi - lo) * bw;
      el('line', { class: 'leader', x1: x, x2: x, y1: 12, y2: 17 }, svg);
      el('text', { class: 'lab', x, y: 32, 'text-anchor': x < 30 ? 'start' : x > W - 30 ? 'end' : 'middle' }, svg, lab(t));
    }
    box.appendChild(svg);
  }

  // ---------- everything for the current choices ----------
  function render() {
    V = view(M, state.place, state.gender);
    const f = finding(M, V), W = who(M, state.place, state.gender);
    $('finding').textContent = f.lede;
    $('lede').textContent = f.more;
    // the chart's headline: the biggest single age in this view
    let top = [y0, a0, -1];
    for (let y = y0; y <= y1; y++) for (let a = a0; a <= a1; a++) { const v = value(M, V, state.mode, y, a); if (v > top[2]) top = [y, a, v]; }
    $('chart-h').textContent = state.mode === 'share'
      ? `The biggest single age: ${pct(top[2], 2)} of ${W} were ${top[1]} on July 1, ${top[0]}`
      : `The biggest single age: ${n(top[2])} ${W} were ${top[1]} on July 1, ${top[0]}`;
    $('chart-sub').textContent = `Each square is one age (rows, ${a0} at the bottom to ${a1} at the top) on July 1 of one year (columns, ${y0} to ${y1}). `
      + (state.mode === 'share' ? 'The stronger the shade, the bigger that age’s share of the whole population, all ages, that year. ' : 'The stronger the shade, the more people were that age. ')
      + 'Dashed lines mark the rule ages; the amber outline is one group of people, a year older every July 1.';
    const d = drawHeat();
    // the readings as text
    const b = state.born, ul = $('readings'); ul.textContent = '';
    $('readings-h').textContent = `${state.example ? 'Example diagonal' : 'Your diagonal'}: born July 2, ${b - 1} to July 1, ${b}`;
    for (const c of d.crossings) {
      const li = html('li', null, c.when === 'in' ? '' : 'after');
      const what = c.rule.text;
      if (c.when === 'in') li.textContent = `${c.age} in ${c.year} (${what}): ${n(V.counts[c.year][c.age - a0])} people, ${pct(value(M, V, 'share', c.year, c.age), 2)} of the population.`;
      else if (c.when === 'after') li.textContent = `${c.age} in ${c.year} (${what}): after the data ends.`;
      else li.textContent = `${c.age} in ${c.year} (${what}): before the data starts.`;
      ul.appendChild(li);
    }
    if (d.last && !d.crossings.some((c) => c.year === d.last[0])) ul.appendChild(html('li', `${d.last[1]} in ${d.last[0]}${d.last[0] === y1 ? ', the latest year' : ''}: ${n(V.counts[d.last[0]][d.last[1] - a0])} people, ${pct(value(M, V, 'share', d.last[0], d.last[1]), 2)} of the population.`));
    $('born-note').textContent = state.example
      ? `An example: born ${EXAMPLE_BIRTH}. Type your own year; it stays in this page.`
      : 'The year stays in this page.';
    bornReadout(d);
    $('point').textContent = 'Point at a square to read it.';
    drawTable(W);
  }

  // the diagonal's key reading, under the birth year: how many of these people there were in the latest year they appear,
  // and the rule age they reached most recently (or reach next, after the data ends)
  function bornReadout(d) {
    const b = state.born;
    $('born-k').textContent = `Born July 2, ${b - 1} to July 1, ${b}`;
    if (!d.last) { $('born-v').textContent = 'Not in the data'; $('born-t').textContent = `The chart covers ages ${a0} to ${a1} on July 1, ${y0} to ${y1}.`; return; }
    const [ly, la] = d.last, count = V.counts[ly][la - a0], share = value(M, V, 'share', ly, la);
    // the figure big, its unit beside it at text size
    const bv = $('born-v'); bv.textContent = '';
    bv.append(state.mode === 'share' ? pct(share, 2) : n(count), ' ', html('span', state.mode === 'share' ? 'of the population' : 'people', 'unit'));
    const past = d.crossings.filter((c) => c.when === 'in').at(-1), next = d.crossings.find((c) => c.when === 'after');
    let t = `They were ${la} on July 1, ${ly}${ly === y1 ? ', the latest year' : ''}: ${state.mode === 'share' ? `${n(count)} ${who(M, state.place, state.gender)}` : `${pct(share, 2)} of the population`}.`;
    if (past) t += ` They reached ${past.age} (${past.rule.text}) in ${past.year}.`;
    if (next) t += ` They reach ${next.age} (${next.rule.text}) in ${next.year}, after the data ends.`;
    $('born-t').textContent = t;
  }

  function drawTable(W) {
    $('grid-caption').textContent = `${state.mode === 'share' ? 'Share of the whole population at each age' : 'Number of people at each age'}, ${W}, July 1, ${y0} to ${y1}`;
    const head = $('grid-head'); head.textContent = '';
    const th = html('th', 'Year'); th.scope = 'col'; head.appendChild(th);
    for (let a = a0; a <= a1; a++) { const h = html('th', String(a)); h.scope = 'col'; head.appendChild(h); }
    const body = $('grid-body'); body.textContent = '';
    for (let y = y0; y <= y1; y++) {
      const tr = document.createElement('tr'), rh = html('th', String(y)); rh.scope = 'row'; tr.appendChild(rh);
      for (let a = a0; a <= a1; a++) tr.appendChild(html('td', fmt(value(M, V, state.mode, y, a))));
      body.appendChild(tr);
    }
  }

  // ---------- controls ----------
  const sel = $('place');
  for (const p of M.places) { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; sel.appendChild(o); }
  sel.value = state.place;
  sel.addEventListener('change', () => { state.place = sel.value; render(); });
  for (const [v, t] of [['all', 'All'], ...M.genders.map((g) => [g, g])]) {
    const lab = document.createElement('label'), inp = document.createElement('input');
    inp.type = 'radio'; inp.name = 'gender'; inp.value = v; inp.checked = v === state.gender;
    inp.addEventListener('change', () => { state.gender = v; render(); });
    lab.append(inp, document.createTextNode(' ' + t)); $('genders').appendChild(lab);
  }
  document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => { state.mode = r.value; render(); }));
  const born = $('born'); born.min = String(bLo); born.max = String(bHi); born.value = String(EXAMPLE_BIRTH);
  $('controls').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = Number(born.value), err = $('error');
    if (!born.value || !Number.isInteger(v) || v < bLo || v > bHi) {
      err.textContent = `Type a birth year from ${bLo} to ${bHi}: the chart covers ages ${a0} to ${a1} on July 1, ${y0} to ${y1}.`;
      err.hidden = false; born.setAttribute('aria-invalid', 'true'); return;
    }
    err.hidden = true; born.removeAttribute('aria-invalid'); state.born = v; state.example = false; render();
  });

  // ---------- sources ----------
  const src = M.source;
  $('attribution').textContent = src.attribution;
  const c = $('citation'), link = (href, text) => { const a = document.createElement('a'); a.href = href; a.textContent = text; return a; };
  c.append('Citation: ', link(src.source_url, src.citation.replace(/\.? DOI: .*/, '')), '. DOI: ', link(src.doi, src.doi), `. Released ${src.released}; read ${src.retrieved}. `, link(src.licence_url, src.licence), '.');
  for (const k of ['age', 'revisions', 'gender', 'genders', 'territories', 'ninety', 'adapted']) if (src.notes[k]) $('notes').appendChild(html('li', (k === 'adapted' ? 'How this page adapts it: ' : 'Statistics Canada: ') + src.notes[k]));
  for (const r of M.rules) { const li = html('li'); li.append(html('b', String(r.age)), ` ${r.text}`); $('rule-key').appendChild(li); }
  const seen = new Set();
  for (const r of M.rules) for (const f of r.facts) {
    if (seen.has(f.id)) continue; seen.add(f.id);
    const li = document.createElement('li'); li.append(link(f.source_url, f.title), `, read ${f.as_of}.`); $('fact-sources').appendChild(li);
  }
  $('foot-src').textContent = `Data: Statistics Canada, Table 17-10-0005-01, released ${src.released}, read ${src.retrieved}; the rule ages from official federal sources, listed under Sources and notes.`;

  // ---------- save the chart as an image, made in the browser ----------
  $('save').addEventListener('click', () => {
    const svg = $('heat'), clone = svg.cloneNode(true), W = Number(svg.getAttribute('width')), H = Number(svg.getAttribute('height'));
    clone.setAttribute('xmlns', NS);
    const live = svg.querySelectorAll('*'), copy = clone.querySelectorAll('*');
    live.forEach((node, i) => {
      const cs = getComputedStyle(node), s = copy[i];
      for (const p of ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-size', 'font-weight']) s.setAttribute(p, cs.getPropertyValue(p));
      if (node.nodeName === 'text') s.setAttribute('font-family', 'Libre Franklin, Helvetica, Arial, sans-serif');
    });
    const pad = 32, head = 74, foot = 56, img = new Image(), cs = getComputedStyle(document.documentElement), col = (k) => cs.getPropertyValue('--t-' + k).trim();
    img.onload = () => {
      const cv = document.createElement('canvas'), k = 2, w = W + pad * 2, h = H + pad * 2 + head + foot;
      cv.width = w * k; cv.height = h * k;
      const g = cv.getContext('2d'); g.scale(k, k); g.fillStyle = col('ground'); g.fillRect(0, 0, w, h);
      g.fillStyle = col('ink'); g.font = '600 19px Georgia, serif'; g.fillText($('question').textContent, pad, pad + 8, W);
      g.fillStyle = col('ink2'); g.font = '14px Helvetica, Arial, sans-serif'; g.fillText($('finding').textContent, pad, pad + 30, W);
      g.fillText($('chart-h').textContent, pad, pad + 48, W);
      g.drawImage(img, pad, pad + head, W, H);
      g.fillStyle = col('ink3'); g.font = '12px Helvetica, Arial, sans-serif';
      g.fillText(src.attribution, pad, pad + head + H + 26, W);
      g.fillText('The retirement wave. Education only, not advice. Mohammed El Chayeb.', pad, pad + head + H + 44, W);
      cv.toBlob((blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `retirement-wave-${state.place}-${state.born}.png`; document.body.appendChild(a); a.click(); a.remove(); });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  });

  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 120); });
  render();
  // the first fill is not a change: no underline on load
  requestAnimationFrame(() => document.querySelectorAll('.flash').forEach((e) => e.classList.remove('flash')));
})();
