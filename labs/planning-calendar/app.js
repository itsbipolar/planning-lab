// The planning calendar page. The rules, the facts they cite and the engine (engine.mjs, inlined above this script) are
// in the page; the twelve months start on the page's own date. The household's situations stay in this page: they are
// not stored, not put in the address and not sent anywhere. The only file it makes is the calendar the visitor saves.
(function () {
  'use strict';
  const D = JSON.parse(document.getElementById('data').textContent);
  const C = D.config, FF = D.facts, NS = 'http://www.w3.org/2000/svg', KINDS = Object.keys(C.kinds);
  const $ = (id) => document.getElementById(id);
  const now = new Date(), TODAY = iso(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const example = C.presets.find((p) => p.id === C.example) ?? C.presets[0];
  const state = { picked: example.situations.slice(), touched: false };
  const short = (d) => new Date(ms(d)).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const weekday = (d) => new Date(ms(d)).toLocaleDateString('en-CA', { weekday: 'long', timeZone: 'UTC' });
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const presetOf = (picked) => C.presets.find((p) => sameSet(p.situations, picked));
  function h(tag, attrs, parent, text) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function s(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const cal = (picked) => rolling(C, FF, TODAY, picked);

  // Fixed for the page: every situation at once (for the sources) and each situation alone (the count beside its box).
  const ALL = cal(C.situations.map((x) => x.id));
  const alone = Object.fromEntries(C.situations.map((x) => { const c = cal([x.id]); return [x.id, [c.events.length, c.pending.length]]; }));

  // ---------- build your household ----------
  for (const p of C.presets) {
    const b = h('button', { type: 'button', 'data-preset': p.id, 'aria-pressed': 'false' }, $('picks'), p.label);
    b.addEventListener('click', () => { state.picked = p.situations.slice(); state.touched = true; render(); });
  }
  for (const x of C.situations) {
    const l = h('label', { class: 'sit' }, $('sits'));
    const i = h('input', { type: 'checkbox', value: x.id }, l);
    h('span', {}, l, x.label);
    const [n, np] = alone[x.id];
    h('span', { class: 'n' }, l, np ? (n ? `${plural(n, 'date', 'dates')}, ${np} unconfirmed` : `${np} unconfirmed`) : plural(n, 'date', 'dates'));
    i.addEventListener('change', () => {
      state.picked = C.situations.map((y) => y.id).filter((id) => (id === x.id ? i.checked : state.picked.includes(id)));
      state.touched = true; render();
    });
  }

  // ---------- the pile-up strip ----------
  function clear(svg) { Array.from(svg.childNodes).forEach((c) => { if (c.nodeName !== 'title') svg.removeChild(c); }); }
  const box = (t) => { const b = t.getBBox(); return { x: b.x, y: b.y, r: b.x + b.width, b: b.y + b.height }; };
  const hits = (a, b, pad) => a.x < b.r + pad && b.x < a.r + pad && a.y < b.b && b.y < a.b;

  let unhair = null;
  function drawStrip(c) {
    const svg = $('strip');
    if (unhair) unhair();
    clear(svg);
    const W = Math.max(280, $('frame').clientWidth), narrow = W < 640, wk = c.weeks, n = wk.length;
    // the SVG is drawn at the frame's own width (viewBox = width), so a label's font size is the size it renders at
    const colW = W / n, gap = colW > 12 ? 2 : 1, barW = Math.max(2, colW - gap), u = narrow ? 11 : 16;
    const fs = parseFloat(getComputedStyle(svg).fontSize); // the chart's label size, from style.css (#strip)
    const tall = Math.max(4, ...wk.map((w) => w.events.length)), rowH = fs + 6, top = rowH * 2 + 8, base = top + tall * (u + 1);
    // the axis: the month row, then the year row a full text line under it (a label's box is about 1.4 times its size)
    const lineH = Math.ceil(fs * 1.45), ay = base + fs + 16, yy = ay + lineH, H = yy + Math.ceil(fs / 2);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
    const mon0 = ms(wk[0].monday), X = (d) => ((ms(d) - mon0) / 864e5 / 7) * colW;
    const defs = s('defs', {}, svg), pat = s('pattern', { id: 'hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    s('line', { class: 'hatch-line', x1: 0, y1: 0, x2: 0, y2: 5 }, pat);

    // a slot under every week, then each date as one block, stacked by kind
    wk.forEach((w, k) => {
      const x = k * colW + gap / 2;
      s('rect', { class: 'slot', x, y: base + 1, width: barW, height: 3 }, svg);
      const es = w.events.slice().sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
      es.forEach((e, j) => {
        const r = s('rect', { class: `k-${e.kind}`, x, y: base - (j + 1) * (u + 1), width: barW, height: u }, svg);
        s('title', {}, r, `${longDate(e.date)}: ${e.label}`);
      });
    });
    // the superficial-loss period, hatched under the weeks it covers
    for (const w of c.windows) {
      const x0 = X(w.from), x1 = X(iso(ms(w.to) + 864e5));
      s('rect', { x: x0, y: base + 6, width: Math.max(2, x1 - x0), height: 7, fill: 'url(#hatch)', class: 'win' }, svg);
    }
    // today: the strip starts here
    const xt = X(c.today);
    s('line', { class: 'today', x1: xt, x2: xt, y1: top - 4, y2: base + fs + 12 }, svg);

    // the axis: today's date, then each month's first day, with the year under the first label of each year
    const labels = [];
    const put = (x, y, text, cls, alt) => {
      const t = s('text', { x, y, 'font-size': fs, class: cls || '' }, svg, text);
      let b = box(t);
      if (b.r > W - 2) { t.setAttribute('text-anchor', 'end'); t.setAttribute('x', W - 2); b = box(t); }
      if (labels.some((o) => hits(b, o, 4))) {
        if (alt) { t.textContent = alt; b = box(t); }
        if (!alt || labels.some((o) => hits(b, o, 4))) { t.remove(); return null; }
      }
      labels.push(b); return t;
    };
    put(xt + 4, ay, short(c.today), 'read');
    put(xt + 4, yy, c.today.slice(0, 4), 'yr');
    const y0 = +c.today.slice(0, 4), m0 = +c.today.slice(5, 7);
    for (let k = 1; k <= 12; k++) {
      const first = iso(Date.UTC(y0, m0 - 1 + k, 1));
      if (first > c.end) break;
      const name = new Date(ms(first)).toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' });
      put(X(first) + 2, ay, name, '', name.slice(0, 1));
      if (first.slice(5, 7) === '01') put(X(first) + 2, yy, first.slice(0, 4), 'yr');
    }

    // readings on the chart: the busiest weeks, then the next date, each written just above its own pile when there is
    // room (else higher up, with a leader line); a reading that fits nowhere is left to the list and the headline.
    const piles = wk.map((w, k) => ({ k, x: k * colW, r: k * colW + colW, y: base - w.events.length * (u + 1), b: base })).filter((p) => p.y < base);
    const reads = wk.map((w, k) => ({ w, k, n: w.events.length })).filter((x) => x.n > 1).sort((a, b) => b.n - a.n || a.k - b.k)
      .slice(0, narrow ? 2 : 3).map((x) => ({ k: x.k, n: x.n, text: narrow ? `${x.n} dates · ${short(x.w.from)}` : `${x.n} dates, week of ${short(x.w.from)}` }));
    if (c.events.length) {
      const e = c.events[0], k = wk.findIndex((w) => e.date >= w.from && e.date <= w.to);
      if (!reads.some((r) => r.k === k)) reads.push({ k, n: wk[k].events.length, text: narrow ? `Next: ${short(e.date)}` : `Next: ${short(e.date)}, in ${plural(e.days, 'day', 'days')}` });
    }
    const placed = [];
    for (const r of reads) {
      const cx = r.k * colW + colW / 2, pileTop = base - r.n * (u + 1);
      let done = false;
      for (let y = pileTop - 6; y >= fs && !done; y -= rowH) {
        for (const [anchor, x] of [['middle', cx], ['end', cx + colW / 2], ['start', cx - colW / 2]]) {
          const t = s('text', { x, y, 'font-size': fs, 'text-anchor': anchor, class: 'read' }, svg, r.text);
          let b = box(t);
          if (b.x < xt + 4) { t.setAttribute('x', xt + 4); t.setAttribute('text-anchor', 'start'); b = box(t); }
          if (b.r > W - 2) { t.setAttribute('x', W - 2); t.setAttribute('text-anchor', 'end'); b = box(t); }
          const far = pileTop - b.b > 8, lead = { x: cx - 1, r: cx + 1, y: b.b, b: pileTop };
          if (placed.some((o) => hits(b, o, 6) || (far && hits(lead, o, 0))) || piles.some((p) => hits(b, p, 2) || (far && p.k !== r.k && hits(lead, p, 0)))) { t.remove(); continue; }
          placed.push(b);
          if (far) s('line', { class: 'lead', x1: cx, x2: cx, y1: b.b + 3, y2: pileTop - 3 }, svg);
          done = true; break;
        }
      }
    }
    // the week under the pointer: its dates, in a box over its pile
    unhair = deskCrosshair(svg, { x0: 0, x1: W - 0.01, y0: top - 4, y1: base, read: (px) => {
      const k = Math.min(n - 1, Math.max(0, Math.floor(px / colW))), w = wk[k], es = w.events, shown = es.slice(0, 4);
      const lines = [`Week of ${short(w.from)}`];
      if (!es.length) lines.push('No dates this week');
      for (const e of shown) lines.push(`${short(e.date)}: ${e.what}`);
      if (es.length > shown.length) lines.push(`and ${plural(es.length - shown.length, 'more', 'more')}, listed below`);
      return { x: k * colW + colW / 2, y: base - es.length * (u + 1), lines };
    } });
    // keep the reading box inside the chart: on a phone a box beside a middle week would run off the left edge
    const fit = () => {
      const g = svg.querySelector('.crosshair'), r = g && g.querySelector('rect'), t = g && g.querySelector('text');
      if (!r || g.style.display === 'none') return;
      const bx = +r.getAttribute('x'), bw = +r.getAttribute('width'), nx = Math.max(0, Math.min(W - bw, bx));
      if (nx === bx) return;
      r.setAttribute('x', nx);
      t.setAttribute('transform', t.getAttribute('transform').replace(/translate\(([-\d.e]+)/, (m, x) => `translate(${+x + nx - bx}`));
    };
    svg.addEventListener('pointermove', fit); svg.addEventListener('pointerdown', fit);
    const unbox = unhair;
    unhair = () => { svg.removeEventListener('pointermove', fit); svg.removeEventListener('pointerdown', fit); unbox(); };
    const most = wk.reduce((a, w) => (w.events.length > a.events.length ? w : a), wk[0]);
    // the takeaway, in plain words: the month that holds the most dates (the earliest, on a tie)
    const months = new Map();
    for (const e of c.events) months.set(e.date.slice(0, 7), (months.get(e.date.slice(0, 7)) || 0) + 1);
    const [topMonth, most1] = [...months].reduce((a, m) => (m[1] > a[1] ? m : a), ['', 0]);
    const monthName = (ym) => new Date(ms(ym + '-01')).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    $('chart-title').textContent = !c.events.length ? 'No confirmed date falls in these twelve months.'
      : most1 > 1 ? `${monthName(topMonth)} holds the most: ${most1} of the ${plural(c.events.length, 'date', 'dates')}.`
      : `${plural(c.events.length, 'date', 'dates')}, no two in the same month.`;
    $('chart-sub').textContent = `One block per date, one column per week, from ${longDate(c.today)} to ${longDate(c.end)}.`;
    $('strip-t').textContent = c.events.length
      ? `${plural(c.events.length, 'date', 'dates')} in the next twelve months, week by week; the busiest week, of ${short(most.from)}, has ${most.events.length}. Every date is listed below.`
      : 'No confirmed date falls in the next twelve months for this household.';
  }

  function legend(c) {
    const p = $('legend'); p.textContent = '';
    for (const k of KINDS) { const sp = h('span', {}, p); h('i', { class: `sw k-${k}`, 'aria-hidden': 'true' }, sp); sp.append(C.kinds[k]); }
    if (c.windows.length) { const w = h('span', {}, p); h('i', { class: 'sw hatch', 'aria-hidden': 'true' }, w); w.append('The superficial-loss period around a sale on the year’s last day'); }
  }

  // ---------- the dates, in words ----------
  function list(c) {
    const ol = $('dates'); ol.textContent = '';
    const first = {};
    for (const e of c.events) {
      const li = h('li', {}, ol), when = h('div', { class: 'when' }, li);
      when.append(`${weekday(e.date)}, ${longDate(e.date)}`);
      h('span', { class: 'in' }, when, e.days === 0 ? 'today' : e.days === 1 ? 'tomorrow' : `in ${e.days} days`);
      const body = h('div', {}, li), what = h('p', { class: 'what' }, body);
      h('i', { class: `sw k-${e.kind}`, 'aria-hidden': 'true' }, what); what.append(e.label);
      h('p', {}, body, first[e.rule] ? `The same rule as on ${longDate(first[e.rule])}.` : e.text);
      first[e.rule] = first[e.rule] || e.date;
      const src = h('p', { class: 'src' }, body, 'Source: ');
      e.sources.forEach((x, k) => { if (k) src.append('; '); h('a', { href: x.url }, src, x.title); if (x.authority === 'cra_position') src.append(' (CRA’s position)'); });
    }
    if (!c.events.length) h('li', {}, ol, c.situations.length ? 'No confirmed date falls in the next twelve months for this household.' : 'Tick a situation above to see its dates.');
    const pd = $('pending'); pd.textContent = ''; pd.hidden = !c.pending.length;
    if (c.pending.length) {
      h('h3', {}, pd, 'Not confirmed yet');
      h('p', { class: 'note' }, pd, 'The rule for these dates is not confirmed in the verified facts file yet, so they are not on the strip or in the calendar file.');
      const ul = h('ul', {}, pd);
      for (const p of c.pending) {
        const li = h('li', {}, ul, `${p.label}, in ${p.year}. `);
        p.sources.forEach((x) => h('a', { href: x.url }, li, x.title));
      }
    }
  }

  // ---------- add to my calendar ----------
  let current = null;
  $('ics').addEventListener('click', () => {
    if (!current || !current.events.length) return;
    const url = URL.createObjectURL(new Blob([toICS(current)], { type: 'text/calendar;charset=utf-8' }));
    const a = h('a', { href: url, download: `planning-dates-${current.today}.ics` }, document.body);
    a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // the household's answer, under the quick picks: the next date, and how many there are
  const KIND_WORDS = { pay: ['payment due', 'payments due'], file: ['return due', 'returns due'], cutoff: ['cut-off', 'cut-offs'] };
  function readouts(c) {
    const np = c.pending.length, fine = $('rd-count-fine');
    fine.hidden = !np;
    if (np) fine.textContent = `${plural(np, 'more date is', 'more dates are')} not confirmed yet; listed under the dates, left out of the calendar file.`;
    if (!c.events.length) {
      $('rd-next-v').textContent = 'None';
      $('rd-next-t').textContent = c.situations.length ? 'No confirmed date falls in the next twelve months for this household.' : 'Tick a situation to see its dates.';
      $('rd-count-v').textContent = plural(0, 'date', 'dates');
      $('rd-count-t').textContent = 'Nothing to add to a calendar yet.';
      return;
    }
    const e = c.events[0], same = c.events.filter((x) => x.date === e.date).length;
    $('rd-next-v').textContent = e.days === 0 ? 'Today' : e.days === 1 ? 'Tomorrow' : `In ${plural(e.days, 'day', 'days')}`;
    $('rd-next-t').textContent = `${longDate(e.date)} · ${e.label}${same > 1 ? ` · and ${plural(same - 1, 'other', 'others')} that day` : ''}`;
    $('rd-count-v').textContent = plural(c.events.length, 'date', 'dates');
    const parts = KINDS.map((k) => [k, c.events.filter((x) => x.kind === k).length]).filter(([, m]) => m)
      .map(([k, m]) => (KIND_WORDS[k] ? `${m} ${KIND_WORDS[k][m === 1 ? 0 : 1]}` : `${m}: ${C.kinds[k]}`));
    $('rd-count-t').textContent = `${parts.join(', ')}, through ${longDate(c.end)}.`;
  }

  function render() {
    const c = cal(state.picked), p = presetOf(state.picked);
    current = c;
    readouts(c);
    $('finding').textContent = finding(c, p ? p.noun : null);
    $('assume').textContent = (p && p.id === example.id && !state.touched ? `An example to start: ${p.noun}. ` : '') +
      'Assumes a December year-end for a corporation or trust, and no weekend or holiday moves.';
    document.querySelectorAll('#picks button').forEach((b) => b.setAttribute('aria-pressed', String(!!p && b.dataset.preset === p.id)));
    document.querySelectorAll('#sits input').forEach((i) => { i.checked = state.picked.includes(i.value); });
    drawStrip(c); legend(c); list(c);
    const np = c.pending.length;
    $('ics').disabled = !c.events.length;
    $('ics').textContent = c.events.length ? `Add ${c.events.length === 1 ? 'this date' : `these ${c.events.length} dates`} to my calendar` : 'Add to my calendar';
    $('ics-note').textContent = c.events.length
      ? `A file of ${plural(c.events.length, 'all-day date', 'all-day dates')} for any calendar app, each with its rule, its source and “${EDU}” Made in this page; nothing is sent.${np ? ` ${plural(np, 'date', 'dates')} not confirmed yet ${np === 1 ? 'is' : 'are'} left out.` : ''}`
      : 'Nothing to save yet: no confirmed date falls in these twelve months.';
  }

  // ---------- own-date rules and sources ----------
  for (const o of D.own) {
    const li = h('li', {}, $('own'), /dispose/.test(o.label) ? `${o.label}: every ${o.value} years after it was created. ` : `${o.label}: age ${o.value}. `);
    h('a', { href: o.url }, li, 'Source');
  }
  const used = new Map();
  for (const e of ALL.events) for (const x of e.sources) used.set(x.id, x);
  for (const x of used.values()) { const li = h('li', {}, $('sources')); h('a', { href: x.url }, li, x.title); li.append(`, read ${x.as_of}${x.authority === 'cra_position' ? ' (CRA’s position)' : ''}.`); }

  render();
  // the first fill is not a change: no underline on load
  requestAnimationFrame(() => document.querySelectorAll('.flash').forEach((e) => e.classList.remove('flash')));
  // the first drawing may measure labels before the inlined fonts are ready: place them again once they are
  if (document.fonts) document.fonts.ready.then(() => current && drawStrip(current));
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => current && drawStrip(current), 150); });
})();
