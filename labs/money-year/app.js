// Draws the Money Year from the embedded model: the policy rate as the hero chart and three smaller panels on one shared
// time axis (one measure each, never two scales on one chart), callouts computed from the data, a Budget 2026 line
// through every chart, a crosshair that follows the pointer or the slider, the proposals grouped by the year they
// would start, and the numbers as a table. No request after load; nothing stored.
const M = JSON.parse(document.getElementById('data').textContent);
const NS = 'http://www.w3.org/2000/svg';
const DAY = 864e5;
const t = (d) => Date.parse(d + 'T00:00:00Z');
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const T0 = t(M.start), T1 = t(M.end), LAST = t(M.retrieved);
const DAYS = Math.round((Math.min(LAST, T1) - T0) / DAY);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = (d) => { const [y, m, day] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${day}, ${y}`; };
const fmt = (p, v) => v.toFixed(p.digits) + p.unit;
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
const html = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
// The value in force on a day: the last observation on or before it.
const valueAt = (pts, d) => { let r = null; for (const p of pts) { if (p[0] <= d) r = p; else break; } return r; };

const panelsRoot = document.getElementById('panels');
const slider = document.getElementById('when');
const readout = document.getElementById('readout');
const views = [];

function draw() {
  panelsRoot.textContent = '';
  views.length = 0;
  const W = Math.max(300, panelsRoot.clientWidth);
  const narrow = W < 700;
  const L = narrow ? 40 : 56, R = narrow ? 12 : 160, B = 28;
  const x = (d) => L + ((t(d) - T0) / (T1 - T0)) * (W - L - R);
  M.panels.forEach((p) => {
    const PH = p.hero ? (narrow ? 230 : 340) : (narrow ? 130 : 170);
    const box = html('section', p.hero ? 'panel hero' : 'panel');
    box.setAttribute('aria-labelledby', `h-${p.id}`);
    // The header: the measure's name, and where it started and where it is now, large.
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
      lg.innerHTML = p.lines.map((l) => `<span class="key${l.dashed ? ' dashed' : ''}" aria-hidden="true"></span>${l.label}`).join('<span class="sep"></span>');
      box.appendChild(lg);
    }
    const all = p.lines.flatMap((l) => l.points.map((q) => q[1]));
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = Math.max((hi - lo) * 0.3, hi * 0.02);
    lo -= pad; hi += pad;
    const y = (v) => 14 + (1 - (v - lo) / (hi - lo)) * (PH - 14);
    const svg = el('svg', { width: W, height: PH + B, viewBox: `0 0 ${W} ${PH + B}`, role: 'img', 'aria-label': `${p.title}: ${p.note}` });
    box.appendChild(svg);
    panelsRoot.appendChild(box); // on the page before drawing, so text can be measured
    for (let i = 0; i <= 2; i++) {
      const v = lo + pad + ((hi - lo - 2 * pad) * i) / 2;
      el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }, svg);
      el('text', { x: L - 8, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg).textContent = v.toFixed(p.digits === 1 ? 1 : 2);
    }
    MON.forEach((m, i) => {
      const d = `${M.year}-${String(i + 1).padStart(2, '0')}-01`;
      el('line', { x1: x(d), x2: x(d), y1: PH, y2: PH + 5, class: 'axis' }, svg);
      if (!narrow || i % 2 === 0) el('text', { x: x(d) + 2, y: PH + 20, class: 'tick' }, svg).textContent = m;
    });
    el('line', { x1: L, x2: W - R, y1: PH, y2: PH, class: 'axis' }, svg);
    if (LAST < T1) { const lx = x(M.retrieved); el('rect', { x: lx, y: 0, width: W - R - lx, height: PH, class: 'future' }, svg); }
    // Budget 2026: one line through every chart, joining the year to what's proposed next.
    if (M.budgetDay) {
      const bx = x(M.budgetDay);
      el('line', { x1: bx, x2: bx, y1: 0, y2: PH, class: 'budget' }, svg);
      if (p.hero) el('text', { x: bx - 6, y: 12, class: 'budget-label', 'text-anchor': 'end' }, svg).textContent = 'Budget 2026';
    }
    for (const l of p.lines) {
      const pts = l.points.map((q) => [Math.max(L, x(q[0])), y(q[1])]);
      let d = '';
      pts.forEach(([X, Y], i) => { d += i === 0 ? `M${X},${Y}` : p.step ? `H${X}V${Y}` : `L${X},${Y}`; });
      if (p.step) d += `H${x(M.retrieved)}`;
      if (!l.dashed) el('path', { d: `${d}V${PH}H${pts[0][0]}Z`, class: 'area' }, svg);
      el('path', { d, class: `line${l.dashed ? ' dashed' : ''}${p.hero ? ' heavy' : ''}` }, svg);
      if (!narrow) el('text', { x: Math.max(x(l.points.at(-1)[0]) + 14, x(M.retrieved) + 10), y: y(l.points.at(-1)[1]) + 5, class: 'endlabel' }, svg).textContent = `${fmt(p, l.points.at(-1)[1])}${p.lines.length > 1 ? ' ' + l.label : ''}`;
    }
    for (const c of p.callouts) {
      const cx = x(c.d), cy = y(c.v), dy = c.below ? 30 : -22;
      el('circle', { cx, cy, r: p.hero ? 7 : 5.5, class: 'ring' }, svg);
      el('line', { x1: cx, x2: cx, y1: cy + (c.below ? 7 : -7), y2: cy + dy + (c.below ? -14 : 5), class: 'leader' }, svg);
      const anchor = cx > W - R - 110 ? 'end' : cx < L + 110 ? 'start' : 'middle';
      const tx = el('text', { x: cx, y: cy + dy, class: `callout${c.mark ? ' marked' : ''}${p.hero ? ' big' : ''}`, 'text-anchor': anchor }, svg);
      tx.textContent = c.text;
      if (c.mark) { const b = tx.getBBox(); svg.insertBefore(el('rect', { x: b.x - 6, y: b.y - 3, width: b.width + 12, height: b.height + 6, class: 'mark' }), tx); }
    }
    const cross = el('line', { y1: 0, y2: PH, class: 'cross', visibility: 'hidden' }, svg);
    const dots = p.lines.map(() => el('circle', { r: 4.5, class: 'dot', visibility: 'hidden' }, svg));
    const hit = el('rect', { x: L, y: 0, width: W - R - L, height: PH, class: 'hit' }, svg);
    hit.addEventListener('pointermove', (e) => { const r = svg.getBoundingClientRect(); setDay(Math.round(((e.clientX - r.left - L) / (W - R - L)) * ((T1 - T0) / DAY))); });
    hit.addEventListener('pointerdown', (e) => hit.dispatchEvent(new PointerEvent('pointermove', e)));
    box.appendChild(html('p', 'note', p.note));
    views.push({ p, x, y, cross, dots });
  });
  setDay(Number(slider.value));
}

// One day picked, by pointer or slider: every panel shows it, and the readout says it in words.
function setDay(n) {
  n = Math.max(0, Math.min(DAYS, n));
  slider.value = n;
  const d = iso(T0 + n * DAY);
  const parts = [];
  for (const v of views) {
    const X = v.x(d);
    v.cross.setAttribute('x1', X); v.cross.setAttribute('x2', X); v.cross.setAttribute('visibility', 'visible');
    v.p.lines.forEach((l, i) => {
      const q = valueAt(l.points, d);
      if (!q) { v.dots[i].setAttribute('visibility', 'hidden'); return; }
      v.dots[i].setAttribute('cx', X); v.dots[i].setAttribute('cy', v.y(q[1])); v.dots[i].setAttribute('visibility', 'visible');
      parts.push(`${l.label} ${fmt(v.p, q[1])}${v.p.monthly ? ` (${MON[Number(q[0].slice(5, 7)) - 1]})` : ''}`);
    });
  }
  const text = `${longDate(d)}: ${parts.join(', ')}.`;
  readout.textContent = text;
  slider.setAttribute('aria-valuetext', text);
}

slider.max = DAYS;
slider.value = DAYS;
document.getElementById('asof').textContent = `Data to ${longDate(M.retrieved)}. The shaded end of each chart is the part of the year that isn't in yet.${M.budgetDay ? ` The dashed line marks Budget 2026, ${longDate(M.budgetDay)}.` : ''}`;
slider.addEventListener('input', () => setDay(Number(slider.value)));
new ResizeObserver(() => draw()).observe(panelsRoot);

// The proposals, grouped by the year they would start; an item without a confirmed date goes in the first group.
const lane = document.getElementById('lane');
const groups = new Map();
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
  lane.appendChild(col);
}
if (!M.proposals.length) document.getElementById('budget').hidden = true;
if (M.budgetUrl) document.getElementById('budget-link').href = M.budgetUrl;

// The numbers: each series at the end of every month so far (the last value in force that day).
const tbody = document.getElementById('rows');
const series = M.panels.flatMap((p) => p.lines.map((l) => ({ p, l })));
document.getElementById('head').innerHTML = '<th scope="col">End of month</th>' + series.map(({ l }) => `<th scope="col">${l.label}</th>`).join('');
for (let m = 1; m <= 12; m++) {
  const endOfMonth = iso(Date.UTC(M.year, m, 0));
  const d = endOfMonth > M.retrieved ? M.retrieved : endOfMonth;
  if (d < `${M.year}-${String(m).padStart(2, '0')}-01`) break;
  const tr = document.createElement('tr');
  tr.innerHTML = `<th scope="row">${longDate(d)}</th>` + series.map(({ p, l }) => { const q = valueAt(l.points, d); return `<td>${q ? fmt(p, q[1]) : '–'}</td>`; }).join('');
  tbody.appendChild(tr);
}
document.getElementById('src').textContent = `${M.source.attribution} Series retrieved ${longDate(M.source.retrieved)}.`;
