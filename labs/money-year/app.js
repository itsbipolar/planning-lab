// Draws the Money Year from the embedded model: four small panels on one shared time axis (one measure each, never
// two scales on one chart), callouts computed from the data, a crosshair that follows the pointer or the slider,
// the Budget 2026 proposals as a timeline, and the numbers as a table. No request after load; nothing stored.
const M = JSON.parse(document.getElementById('data').textContent);
const NS = 'http://www.w3.org/2000/svg';
const DAY = 864e5;
const t = (d) => Date.parse(d + 'T00:00:00Z');
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const T0 = t(M.start), T1 = t(M.end), LAST = t(M.retrieved);
const DAYS = Math.round((Math.min(LAST, T1) - T0) / DAY);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longDate = (d) => { const [y, m, day] = d.split('-').map(Number); return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${day}, ${y}`; };
const fmt = (p, v) => v.toFixed(p.digits) + p.unit;
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
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
  const L = narrow ? 40 : 52, R = narrow ? 12 : 150, PH = narrow ? 118 : 150, B = 26;
  const x = (d) => L + ((t(d) - T0) / (T1 - T0)) * (W - L - R);
  M.panels.forEach((p) => {
    const box = document.createElement('section');
    box.className = 'panel';
    box.setAttribute('aria-labelledby', `h-${p.id}`);
    const h = document.createElement('h3'); h.id = `h-${p.id}`; h.textContent = p.title; box.appendChild(h);
    if (p.lines.length > 1) {
      const lg = document.createElement('p'); lg.className = 'legend';
      lg.innerHTML = p.lines.map((l) => `<span class="key${l.dashed ? ' dashed' : ''}" aria-hidden="true"></span>${l.label}`).join('<span class="sep"></span>');
      box.appendChild(lg);
    }
    const all = p.lines.flatMap((l) => l.points.map((q) => q[1]));
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = Math.max((hi - lo) * 0.25, hi * 0.02);
    lo -= pad; hi += pad;
    const y = (v) => 10 + (1 - (v - lo) / (hi - lo)) * (PH - 10);
    const svg = el('svg', { width: W, height: PH + B, viewBox: `0 0 ${W} ${PH + B}`, role: 'img', 'aria-label': `${p.title}: ${p.note}` });
    box.appendChild(svg);
    panelsRoot.appendChild(box); // on the page before drawing, so text can be measured
    // Recessive grid: three levels, labelled on the left.
    for (let i = 0; i <= 2; i++) {
      const v = lo + pad + ((hi - lo - 2 * pad) * i) / 2;
      el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }, svg);
      el('text', { x: L - 6, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg).textContent = v.toFixed(p.digits === 4 ? 2 : p.digits === 2 ? 2 : 1);
    }
    // Months along the bottom of every panel (initials on phones).
    MON.forEach((m, i) => {
      const d = `${M.year}-${String(i + 1).padStart(2, '0')}-01`;
      el('line', { x1: x(d), x2: x(d), y1: PH, y2: PH + 4, class: 'axis' }, svg);
      if (!narrow || i % 2 === 0) el('text', { x: x(d) + 2, y: PH + 18, class: 'tick' }, svg).textContent = narrow ? m[0] + m.slice(1, 3) : m;
    });
    el('line', { x1: L, x2: W - R, y1: PH, y2: PH, class: 'axis' }, svg);
    // Where the data stops: the rest of the year isn't in yet.
    if (LAST < T1) {
      const lx = x(M.retrieved);
      el('rect', { x: lx, y: 0, width: W - R - lx, height: PH, class: 'future' }, svg);
    }
    // The lines: a step for the policy rate (it changes on decision days), straight segments otherwise.
    for (const l of p.lines) {
      let dpath = '';
      l.points.forEach((q, i) => {
        const X = Math.max(L, x(q[0])), Y = y(q[1]);
        dpath += i === 0 ? `M${X},${Y}` : p.step ? `H${X}V${Y}` : `L${X},${Y}`;
      });
      if (p.step) dpath += `H${x(M.retrieved)}`;
      el('path', { d: dpath, class: `line${l.dashed ? ' dashed' : ''}` }, svg);
      if (!narrow) el('text', { x: Math.max(x(l.points.at(-1)[0]) + 14, x(M.retrieved) + 10), y: y(l.points.at(-1)[1]) + 4, class: 'endlabel' }, svg).textContent = `${fmt(p, l.points.at(-1)[1])}${p.lines.length > 1 ? ' ' + l.label : ''}`;
    }
    // Callouts: a ring on the point, a short leader, the words. A decision gets the amber mark.
    for (const c of p.callouts) {
      const cx = x(c.d), cy = y(c.v), dy = c.below ? 26 : -18;
      el('circle', { cx, cy, r: 5, class: 'ring' }, svg);
      el('line', { x1: cx, x2: cx, y1: cy + (c.below ? 6 : -6), y2: cy + dy + (c.below ? -12 : 4), class: 'leader' }, svg);
      const anchor = cx > W - R - 90 ? 'end' : cx < L + 90 ? 'start' : 'middle';
      const tx = el('text', { x: cx, y: cy + dy, class: c.mark ? 'callout marked' : 'callout', 'text-anchor': anchor }, svg);
      tx.textContent = c.text;
      if (c.mark) {
        const b = tx.getBBox();
        const r = el('rect', { x: b.x - 4, y: b.y - 2, width: b.width + 8, height: b.height + 4, class: 'mark' }, svg);
        svg.insertBefore(r, tx);
      }
    }
    const cross = el('line', { y1: 0, y2: PH, class: 'cross', visibility: 'hidden' }, svg);
    const dots = p.lines.map(() => el('circle', { r: 4, class: 'dot', visibility: 'hidden' }, svg));
    const hit = el('rect', { x: L, y: 0, width: W - R - L, height: PH, class: 'hit' }, svg);
    hit.addEventListener('pointermove', (e) => { const r = svg.getBoundingClientRect(); setDay(Math.round(((e.clientX - r.left - L) / (W - R - L)) * ((T1 - T0) / DAY))); });
    hit.addEventListener('pointerdown', (e) => hit.dispatchEvent(new PointerEvent('pointermove', e)));
    const note = document.createElement('p'); note.className = 'note'; note.textContent = p.note; box.appendChild(note);
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
document.getElementById('asof').textContent = `Data to ${longDate(M.retrieved)}. The shaded end of each chart is the part of the year that isn't in yet.`;
slider.value = DAYS;
slider.addEventListener('input', () => setDay(Number(slider.value)));
new ResizeObserver(() => draw()).observe(panelsRoot);

// The proposals timeline: in date order; an item without a confirmed date sits first, said in words.
const lane = document.getElementById('lane');
for (const p of M.proposals) {
  const li = document.createElement('li');
  li.innerHTML = `<p class="when"></p><h3></h3><p class="value"></p><p class="detail"></p><p class="stamp">Proposed, not law</p>`;
  li.querySelector('.when').textContent = p.when;
  li.querySelector('h3').textContent = p.title;
  li.querySelector('.value').textContent = p.value;
  li.querySelector('.detail').textContent = p.detail;
  lane.appendChild(li);
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
