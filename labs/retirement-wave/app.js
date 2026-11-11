// The Retirement Wave page: a heatmap of Canada's population by age and year, the rule ages from the facts file as dashed
// lines, one generation followed along its diagonal, and one rule age over time. Every number comes from the model.
(() => {
  const M = JSON.parse(document.getElementById('data').textContent);
  const [y0, y1] = M.years, [a0, a1] = M.ages;
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, text) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const n = (x) => Math.round(x).toLocaleString('en-CA');
  const count = (y, a) => M.values[y][a - a0];
  const shade = (v) => 0.07 + 0.93 * Math.pow((v - M.min[2]) / (M.max[2] - M.min[2]), 1.25);
  const state = { born: M.defaultBorn, age: M.rules[0]?.age };

  $('lede').textContent = `How many Canadians were each age from ${a0} to ${a1}, on July 1 of every year from ${y0} to ${y1}. Each column is a year and each row an age; the stronger the shade, the more people. The dashed lines are the ages where Canada's retirement rules change.`;
  const youngest = M.rules[0], rising = M.rules.filter((r) => r.peakIsLast).map((r) => r.age);
  const list = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
  $('summary').textContent = youngest
    ? `The band of strong shade is the baby boom, a year older every year. The number of Canadians aged ${youngest.age} peaked in ${youngest.peak[0]}, at ${n(youngest.peak[1])}.${rising.length ? ` The counts at ${list(rising)} are at their highest yet in ${y1}.` : ''}`
    : '';

  for (const r of M.rules) { const li = el('li'); li.append(el('b', {}, String(r.age)), document.createTextNode(r.label.charAt(0).toUpperCase() + r.label.slice(1))); $('rules').append(li); }

  // Heatmap
  function drawHeat() {
    const box = $('heat'); box.textContent = '';
    const W = Math.min(box.clientWidth || 360, 1056), left = 30, right = 40, topPad = 34, bottomPad = 26;
    const cols = y1 - y0 + 1, rows = a1 - a0 + 1;
    const cw = (W - left - right) / cols, ch = Math.max(7, Math.min(14, cw * 0.9));
    const H = topPad + rows * ch + bottomPad;
    const X = (y) => left + (y - y0) * cw, Yp = (a) => topPad + (a1 - a) * ch;
    const svg = s('svg', { width: W, height: H, role: 'img', 'aria-label': `Heatmap: Canadians by age (${a0} to ${a1}) and year (${y0} to ${y1}). ${$('summary').textContent} The counts are in the table below.` });
    for (let y = y0; y <= y1; y++) for (let a = a0; a <= a1; a++) svg.append(s('rect', { class: 'cell', x: X(y).toFixed(2), y: Yp(a).toFixed(2), width: (cw > 8 ? cw - 1 : cw + 0.4).toFixed(2), height: (cw > 8 ? ch - 1 : ch + 0.4).toFixed(2), opacity: shade(count(y, a)).toFixed(3) }));
    // Rule lines; ages one row apart share a label when the rows are short.
    const groups = [];
    for (const r of M.rules) { const g = groups.at(-1); if (g && r.age - g.at(-1) === 1 && ch < 13) g.push(r.age); else groups.push([r.age]); }
    for (const r of M.rules) { const yy = Yp(r.age) + ch / 2; svg.append(s('line', { class: 'rule', x1: left, x2: left + cols * cw, y1: yy, y2: yy })); }
    for (const g of groups) { const yy = (Yp(g[0]) + Yp(g.at(-1))) / 2 + ch / 2; svg.append(s('text', { class: 'rule-n', x: left + cols * cw + 5, y: yy + 4 }, g.join('/'))); }
    for (let a = a0; a <= a1; a += 10) svg.append(s('text', { class: 'lab', x: left - 6, y: Yp(a) + ch - 1, 'text-anchor': 'end' }, String(a)));
    svg.append(s('text', { class: 'lab', x: left - 6, y: topPad - 8, 'text-anchor': 'end' }, 'Age'));
    const step = W < 600 ? 10 : 5;
    for (let y = y0; y <= y1; y += step) svg.append(s('text', { class: 'lab', x: X(y), y: H - 6 }, String(y)));
    if ((y1 - y0) % step >= step * 0.7) svg.append(s('text', { class: 'lab', x: X(y1) + cw, y: H - 6, 'text-anchor': 'end' }, String(y1)));
    // The callout: where the youngest rule age peaked.
    if (youngest) {
      const cx = X(youngest.peak[0]) + cw / 2, cy = Yp(youngest.age) + ch / 2;
      svg.append(s('circle', { class: 'ring', cx, cy, r: Math.max(6, ch * 0.75) }));
      const txt = `${youngest.age}: peaked in ${youngest.peak[0]}`;
      const tx = Math.min(cx, left + cols * cw - txt.length * 7.4), ty = topPad - 14;
      svg.append(s('line', { class: 'leader', x1: cx, x2: cx, y1: ty + 4, y2: cy - Math.max(6, ch * 0.75) }));
      svg.append(s('text', { class: 'callout', x: tx, y: ty }, txt));
    }
    // The generation being followed: one diagonal, outlined.
    const path = cohortCells(state.born);
    if (path.length) {
      const pts = [];
      for (const [y, a] of path) pts.push([X(y), Yp(a) + ch]);
      const last = path.at(-1); pts.push([X(last[0]) + cw, Yp(last[1]) + ch]);
      const up = [...path].reverse().map(([y, a]) => [[X(y) + cw, Yp(a)], [X(y), Yp(a)]]).flat();
      svg.append(s('polygon', { class: 'gen', points: [...pts, ...up.slice(0, -1)].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ') }));
    }
    // Pointer readout.
    svg.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect(), x = e.clientX - r.left, yy = e.clientY - r.top;
      const y = y0 + Math.floor((x - left) / cw), a = a1 - Math.floor((yy - topPad) / ch);
      if (y >= y0 && y <= y1 && a >= a0 && a <= a1) $('point').textContent = `On July 1, ${y}, ${n(count(y, a))} Canadians were ${a}.`;
    });
    box.append(svg);
    // Key
    const key = $('key'); key.textContent = '';
    const k = s('svg', { width: 120, height: 14, 'aria-hidden': 'true' });
    for (let i = 0; i < 12; i++) k.append(s('rect', { class: 'cell', x: i * 10, y: 0, width: 9, height: 14, opacity: (0.07 + 0.93 * Math.pow(i / 11, 1.25)).toFixed(3) }));
    key.append(document.createTextNode(`${n(M.min[2])} people`), k, document.createTextNode(`${n(M.max[2])} people`));
  }

  function cohortCells(b) { const out = []; for (let y = y0; y <= y1; y++) { const a = y - b; if (a >= a0 && a <= a1) out.push([y, a, count(y, a)]); } return out; }

  function genText() {
    const b = state.born, path = cohortCells(b);
    const head = `Born between July 2, ${b - 1} and July 1, ${b}.`;
    if (!path.length) return head;
    const list = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
    const seen = M.rules.filter((r) => b + r.age >= y0 && b + r.age <= y1).map((r) => `${n(count(b + r.age, r.age))} were ${r.age} in ${b + r.age}`);
    const later = M.rules.filter((r) => b + r.age > y1).map((r) => `${r.age} in ${b + r.age}`);
    const first = path[0], last = path.at(-1);
    return `${head} ${n(first[2])} were ${first[1]} in ${first[0]}; ${n(last[2])} were ${last[1]} in ${last[0]}.`
      + (seen.length ? ` At the rule ages: ${seen.join('; ')}.` : '')
      + (later.length ? ` They reach ${list(later)}, after the data ends.` : '');
  }

  const born = $('born');
  born.min = M.born.from; born.max = M.born.to; born.value = state.born;
  const setGen = () => { const t = genText(); $('gen').textContent = t; born.setAttribute('aria-valuetext', t); };
  born.addEventListener('input', () => { state.born = Number(born.value); drawHeat(); setGen(); });

  // Grid table
  $('grid-caption').textContent = `Canadians by age on July 1, ${y0} to ${y1}, ages ${a0} to ${a1}`;
  const gh = $('grid-head'); gh.append(el('th', { scope: 'col' }, 'Year'));
  for (let a = a0; a <= a1; a++) gh.append(el('th', { scope: 'col' }, String(a)));
  const gb = $('grid-body');
  for (let y = y0; y <= y1; y++) { const tr = el('tr'); tr.append(el('th', { scope: 'row' }, String(y))); for (let a = a0; a <= a1; a++) tr.append(el('td', {}, n(count(y, a)))); gb.append(tr); }

  // One rule age over time
  for (const r of M.rules) {
    const id = `age-${r.age}`, lab = el('label', { for: id }), inp = el('input', { type: 'radio', name: 'age', id, value: String(r.age) });
    if (r.age === state.age) inp.checked = true;
    inp.addEventListener('change', () => { state.age = r.age; drawLine(); });
    lab.append(inp, document.createTextNode(`${r.age}: ${r.label}`)); $('ages').append(lab);
  }
  function drawLine() {
    const r = M.rules.find((x) => x.age === state.age); if (!r) return;
    const box = $('line'); box.textContent = '';
    const W = Math.min(box.clientWidth || 360, 1056), H = 220, left = 8, right = 8, topPad = 30, bottom = 24;
    const lo = 0, hi = Math.max(...r.series.map((p) => p[1])) * 1.12;
    const X = (y) => left + (y - y0) / (y1 - y0) * (W - left - right), Y = (v) => topPad + (H - topPad - bottom) * (1 - (v - lo) / (hi - lo));
    const svg = s('svg', { width: W, height: H, role: 'img', 'aria-label': `Line: Canadians aged ${r.age} on July 1 of each year from ${y0} to ${y1}. ${$('age-summary').textContent}` });
    const tick = Math.pow(10, Math.floor(Math.log10(hi / 3))) * (hi / 3 / Math.pow(10, Math.floor(Math.log10(hi / 3))) > 5 ? 5 : hi / 3 / Math.pow(10, Math.floor(Math.log10(hi / 3))) > 2 ? 2 : 1);
    for (let v = tick; v < hi; v += tick) { svg.append(s('line', { class: 'gridl', x1: left, x2: W - right, y1: Y(v), y2: Y(v) })); svg.append(s('text', { class: 'lab', x: left, y: Y(v) - 4 }, n(v))); }
    svg.append(s('path', { class: 'line', d: r.series.map(([y, v], i) => `${i ? 'L' : 'M'}${X(y).toFixed(1)},${Y(v).toFixed(1)}`).join('') }));
    svg.append(s('circle', { class: 'ring', cx: X(r.peak[0]), cy: Y(r.peak[1]), r: 6 }));
    const pl = `Peak: ${r.peak[0]}, ${n(r.peak[1])}`, px = Math.min(Math.max(X(r.peak[0]) - pl.length * 3.6, left), W - right - pl.length * 7.4);
    svg.append(s('text', { class: 'callout', x: px, y: Y(r.peak[1]) - 12 }, pl));
    for (let y = y0; y <= y1; y += W < 600 ? 10 : 5) svg.append(s('text', { class: 'lab', x: X(y), y: H - 4, 'text-anchor': 'middle' }, String(y)));
    $('age-summary').textContent = `On July 1, ${y0}, ${n(r.first[1])} Canadians were ${r.age}. On July 1, ${y1}, ${n(r.last[1])} were: ${(r.last[1] / r.first[1]).toFixed(1)} times as many. ${r.peakIsLast ? `${y1} is the highest yet.` : `The count peaked in ${r.peak[0]}, at ${n(r.peak[1])}.`}`;
    svg.setAttribute('aria-label', `Line: Canadians aged ${r.age} on July 1 of each year from ${y0} to ${y1}. ${$('age-summary').textContent}`);
    box.append(svg);
    $('age-caption').textContent = `Canadians aged ${r.age} on July 1 of each year`;
    const tb = $('age-body'); tb.textContent = '';
    for (const [y, v] of r.series) { const tr = el('tr'); tr.append(el('td', {}, String(y)), el('td', {}, n(v))); tb.append(tr); }
  }

  // Sources
  const src = M.source;
  $('attribution').textContent = src.attribution;
  const c = $('citation'); c.append(document.createTextNode('Citation: '), el('a', { href: src.source_url }, src.citation.replace(/\.? DOI: .*/, '')), document.createTextNode('. DOI: '), el('a', { href: src.doi }, src.doi), document.createTextNode(`. Released ${src.released}; read ${src.retrieved}. `), el('a', { href: src.licence_url }, src.licence), document.createTextNode('.'));
  $('notes').textContent = `Notes from Statistics Canada: ${src.notes.age} ${src.notes.revisions} ${src.notes.gender}`;
  const seen = new Set();
  for (const r of M.rules) for (const f of r.facts) { if (seen.has(f.id)) continue; seen.add(f.id); const li = el('li'); li.append(el('a', { href: f.source_url }, f.title), document.createTextNode(`, read ${f.as_of}.`)); $('fact-sources').append(li); }

  drawHeat(); setGen(); drawLine();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { drawHeat(); drawLine(); }, 150); });
})();
