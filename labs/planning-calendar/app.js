// The Planning Calendar page: every household's dated rules for the year, week by week, then one household weekday by
// weekday with each date's rule in words. Shading is days to the next date (the shared P5 scale). Nothing is stored or sent.
(() => {
  const M = JSON.parse(document.getElementById('data').textContent);
  const Y = M.year, N = M.heatSteps, DAY = 864e5, start = Date.UTC(Y, 0, 1), days = M.households[0].countdown.length;
  const off = (new Date(start).getUTCDay() + 6) % 7, weeks = Math.ceil((days + off) / 7);
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, text) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const ms = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const long = (d) => new Date(ms(d)).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const short = (d) => new Date(ms(d)).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  const step = (n) => (n > M.horizon ? 0 : Math.max(1, Math.round((N - 1) * (1 - n / M.horizon))));
  const fact = (id) => M.facts[id];
  const val = (id) => fact(id)?.value;
  const inWin = (h, t) => h.windows.some((w) => t >= ms(w.from) && t <= ms(w.to));
  let picked = M.households.find((h) => h.dates.length > 2)?.id ?? M.households[0].id;

  $('lede').textContent = `The ${Y} tax and savings dates that come with different kinds of households, from Canada's rules. Each square is shaded by how close the household's next date is; outlined squares hold a date. Shading starts ${M.horizon / 7} weeks before a date (a display choice, not a rule).`;

  // The rule behind each date, in words, from its facts.
  function ruleText(d, h) {
    const f0 = d.facts[0];
    switch (d.id) {
      case 'balance': return `The balance owing for ${Y - 1} is due ${short(d.date)}.`;
      case 'inst': return `Individuals who pay by instalments pay on ${val(f0)}.`;
      case 'return': return `Self-employed returns for ${Y - 1} are due ${short(d.date)}.`;
      case 'mature': return `An RRSP must mature by the end of the year its holder turns ${val(f0)}.`;
      case 'minimum': return `A RRIF pays out at least a minimum amount; the first must be paid ${val(f0)}.`;
      case 't2': return `A corporation's T2 return is due ${val(f0)}: for a year ending on the last day of ${Y - 1}, ${short(d.date)}.`;
      case 't3': return `A trust's T3 return is due ${val(f0)}: for a year ending on the last day of ${Y - 1}, ${short(d.date)}.`;
      case 'ye': return h.id === 'trust' ? 'The trust\'s tax year ends; its next T3 return is counted from here.' : 'The corporation\'s tax year ends; its next T2 return is counted from here.';
      case 'window': return `A loss is superficial if the same or identical property is bought in the period from ${val(f0)}, and still owned afterwards. Shaded with lines: that period around a sale on the last day of ${Y - 1} and of ${Y}.`;
      case 'fhsa': return `FHSA contributions count for the year they are made in: the contribution period is ${val(f0)}.`;
      case 'cesg': return `The basic grant is ${val(f0)}, so each calendar year's contributions count for that year.`;
      case 'gifts': return `A year's return claims ${val(f0)}.`;
      default: return d.label;
    }
  }

  function hatchDefs(svg) {
    const defs = s('defs'), p = s('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    p.append(s('line', { class: 'hatch-line', x1: 0, y1: 0, x2: 0, y2: 6 })); defs.append(p); svg.append(defs);
  }

  // Overview: one row per household, one square per week, shaded by the closest date in that week.
  function drawOverview() {
    const box = $('overview'); box.textContent = '';
    const W = Math.min(box.clientWidth || 360, 1056), narrow = W < 700, halves = narrow ? 2 : 1, per = Math.ceil(weeks / halves);
    const left = narrow ? 0 : 300, gap = 2, cell = Math.max(6, Math.min(14, Math.floor((W - left - 4) / per) - gap)), stepX = cell + gap;
    const rowH = narrow ? cell + 24 : cell + 10, top = 22, blockH = top + M.households.length * rowH + (narrow ? 17 : 4);
    const svg = s('svg', { width: W, height: halves * blockH, role: 'img', 'aria-label': `Every household's dates in ${Y}, week by week. The dates are listed for each household below.` });
    hatchDefs(svg);
    for (let half = 0; half < halves; half++) {
      const y0 = half * blockH;
      for (let m = 0; m < 12; m++) { const k = (Date.UTC(Y, m, 1) - start) / DAY, w = Math.floor((k + off) / 7); if (Math.floor(w / per) !== half) continue; svg.append(s('text', { class: 'lab', x: left + (w - half * per) * stepX, y: y0 + 13 }, new Date(Date.UTC(Y, m, 1)).toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' }))); }
      M.households.forEach((h, r) => {
        const y = y0 + top + r * rowH + (narrow ? 17 : 0);
        svg.append(s('text', { class: 'row-lab', x: 0, y: narrow ? y - 6 : y + cell - 2 }, h.label));
        if (h.id === picked) svg.append(s('rect', { class: 'pick-row', x: narrow ? W - 4 : left - 10, y: narrow ? y - 17 : y, width: 4, height: narrow ? 14 : cell }));
        for (let w = half * per; w < Math.min(weeks, (half + 1) * per); w++) {
          let best = Infinity, hit = false, win = false;
          for (let k = 0; k < 7; k++) { const i = w * 7 - off + k; if (i < 0 || i >= days) continue; const c = h.countdown[i] ?? Infinity; best = Math.min(best, c === null ? Infinity : c); if (c === 0) hit = true; if (inWin(h, start + i * DAY)) win = true; }
          // A row with a window shows the window itself, not a countdown to it.
          const x = left + (w - half * per) * stepX, st = h.windows.length ? 0 : step(best);
          svg.append(s('rect', { class: `cell ${st ? `h${st}` : 'h-off'}`, x, y, width: cell, height: cell }));
          if (win) svg.append(s('rect', { class: 'win', x, y, width: cell, height: cell }));
          if (hit) svg.append(s('rect', { class: 'hit', x: x - 1, y: y - 1, width: cell + 2, height: cell + 2 }));
        }
      });
    }
    box.append(svg);
    const key = $('key'); key.textContent = '';
    const k = s('svg', { width: 140, height: 14, 'aria-hidden': 'true' });
    for (let i = 0; i < 10; i++) k.append(s('rect', { class: `cell h${Math.max(1, Math.round((N - 1) * i / 9))}`, x: i * 12, y: 0, width: 10, height: 14 }));
    key.append(document.createTextNode(`${M.horizon / 7} weeks out`), k, document.createTextNode('the date itself.'));
    const hs = s('svg', { width: 14, height: 14, 'aria-hidden': 'true' }); hatchDefs(hs); hs.append(s('rect', { class: 'cell h-off', width: 14, height: 14 }), s('rect', { class: 'win', width: 14, height: 14 }));
    key.append(document.createTextNode(' Outlined: a date.'), hs, document.createTextNode('Lines: the superficial-loss period, a span rather than a date.'));
  }

  // One household, GitHub style: weekdays down, weeks across (the year in two halves on a phone).
  function drawDaily() {
    const h = M.households.find((x) => x.id === picked), box = $('daily'); box.textContent = '';
    const W = Math.min(box.clientWidth || 360, 1056), halves = W < 700 ? 2 : 1, per = Math.ceil(weeks / halves);
    const left = 34, gap = 3, cell = Math.max(8, Math.min(16, Math.floor((W - left) / per) - gap)), st = cell + gap, blockH = 20 + 5 * st + 12;
    const svg = s('svg', { width: left + per * st, height: halves * blockH, role: 'img', 'aria-label': `${h.label}: every weekday of ${Y}, shaded by how close the next date is. The dates are listed below.` });
    hatchDefs(svg);
    for (let i = 0; i < days; i++) {
      const t = start + i * DAY, dow = new Date(t).getUTCDay(); if (!dow || dow === 6) continue;
      const w = Math.floor((i + off) / 7), half = Math.floor(w / per), x = left + (w - half * per) * st, y = half * blockH + 20 + (dow - 1) * st, c = h.countdown[i] ?? Infinity, sv = h.windows.length ? 0 : step(c === null ? Infinity : c);
      svg.append(s('rect', { class: `cell ${sv ? `h${sv}` : 'h-off'}`, x, y, width: cell, height: cell }));
      if (inWin(h, t)) svg.append(s('rect', { class: 'win', x, y, width: cell, height: cell }));
      if (c === 0) svg.append(s('rect', { class: 'hit', x: x - 1.5, y: y - 1.5, width: cell + 3, height: cell + 3 }));
    }
    // A date on a weekend is marked on the Friday before it, so it stays visible.
    for (const d of h.dates) { const dow = new Date(ms(d.date)).getUTCDay(); if (dow && dow !== 6) continue; const i = (ms(d.date) - start) / DAY - (dow === 0 ? 2 : 1), w = Math.floor((i + off) / 7), half = Math.floor(w / per); svg.append(s('rect', { class: 'hit', x: left + (w - half * per) * st - 1.5, y: half * blockH + 20 + 4 * st - 1.5, width: cell + 3, height: cell + 3, 'stroke-dasharray': '3 2' })); }
    for (let half = 0; half < halves; half++) {
      ['Mon', 'Wed', 'Fri'].forEach((d, i) => svg.append(s('text', { class: 'lab', x: 0, y: half * blockH + 20 + i * 2 * st + cell - 2 }, d)));
      for (let m = 0; m < 12; m++) { const k = (Date.UTC(Y, m, 1) - start) / DAY, w = Math.floor((k + off) / 7); if (Math.floor(w / per) !== half) continue; svg.append(s('text', { class: 'lab', x: left + (w - half * per) * st, y: half * blockH + 13 }, new Date(Date.UTC(Y, m, 1)).toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' }))); }
    }
    box.append(svg);
    const ol = $('dates'); ol.textContent = '';
    const seen = new Set();
    for (const d of h.dates) {
      const key = `${d.id}|${ruleText(d, h)}`, li = el('li');
      li.append(el('b', {}, long(d.date)), document.createTextNode(`: ${d.label}. `));
      if (!seen.has(key)) { li.append(document.createTextNode(ruleText(d, h))); seen.add(key); }
      const src = el('div', { class: 'src' }); d.facts.forEach((id, k) => { if (k) src.append(document.createTextNode('; ')); src.append(el('a', { href: fact(id).source_url }, fact(id).title)); });
      li.append(src); ol.append(li);
    }
    $('pending-one').textContent = h.pending.length ? `Not placed yet for this household: ${h.pending.map((p) => p.label).join('; ')}. The rule is not confirmed in the facts file yet.` : '';
  }

  const pick = $('pick');
  for (const h of M.households) { const o = el('option', { value: h.id }, h.label); if (h.id === picked) o.selected = true; pick.append(o); }
  pick.addEventListener('change', () => { picked = pick.value; drawOverview(); drawDaily(); });

  for (const o of M.own) {
    if (o.values.some((v) => v === null)) continue;
    const li = el('li');
    li.append(document.createTextNode(/years/.test(fact(o.facts[0]).unit) && /dispose/.test(o.label) ? `${o.label}: every ${o.values[0]} years after it was created. ` : `${o.label}: age ${o.values[0]}. `));
    li.append(el('a', { href: fact(o.facts[0]).source_url }, 'Source'));
    $('own').append(li);
  }
  const np = M.notPlaced.filter((n) => !n.confirmed);
  $('not-placed').textContent = np.length ? `Not on the calendar yet: ${np.map((n) => n.label).join('; ')}. CRA hasn't published those dates for this year.` : '';
  for (const src of M.sources) { const li = el('li'); li.append(el('a', { href: src.source_url }, src.title), document.createTextNode(`, read ${src.as_of}.`)); $('sources').append(li); }

  drawOverview(); drawDaily();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { drawOverview(); drawDaily(); }, 150); });
})();
