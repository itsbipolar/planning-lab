// The Planning Year page. The engine (inlined before this script) does the rules; this draws the heatmap, the weekly bars
// with the capacity line, the week readout, the policy comparison and the editable assumptions. Nothing is stored or sent.
(() => {
  const DATA = JSON.parse(document.getElementById('data').textContent);
  const { config, book, facts: FACTS } = DATA;
  const factsFile = { facts: FACTS };
  const F = factIndex(factsFile);
  const Y = config.year;
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, text) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const SVG = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs = {}, text) => { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const fmtDate = (t, opts = { month: 'long', day: 'numeric' }) => new Date(t).toLocaleDateString('en-CA', { ...opts, timeZone: 'UTC' });
  const longDate = (isoDate) => fmtDate(Date.UTC(+isoDate.slice(0, 4), +isoDate.slice(5, 7) - 1, +isoDate.slice(8, 10)), { month: 'long', day: 'numeric', year: 'numeric' });
  const h0 = (x) => Math.round(x).toLocaleString('en-CA');
  const ratio = (x) => x.toFixed(1);
  const fv = (id) => F.get(id)?.value;
  const typeOf = new Map(config.types.map((t) => [t.id, t]));

  const state = { policy: config.policies[0].id, filter: { segment: '', business: false, trust: false }, hours: {}, capacity: config.capacity.hoursPerWeek, week: 0 };

  // Words built from the facts, never typed figures.
  const lo = fv('cpp_earliest_start_age'), hi = fv('cpp_latest_start_age');
  $('lede').textContent = `A fictional planning practice of ${book.households.length.toLocaleString('en-CA')} households, and every dated task its rules create in ${Y}: tax deadlines, RRSPs that must mature, CPP and OAS start ages, trust and corporate dates. One square for each weekday, shaded by how many hours of work it holds.`;
  $('banner').textContent = `Synthetic data: invented households with IDs only, not a real practice or real clients. Hours and lead times are assumptions, not industry benchmarks.`;
  document.querySelectorAll('[data-assume]').forEach((e) => { e.textContent = `(${config.assumptionLabel})`; });

  for (const p of config.policies) {
    const id = `policy-${p.id}`;
    const lab = el('label', { for: id });
    const inp = el('input', { type: 'radio', name: 'policy', id, value: p.id });
    if (p.id === state.policy) inp.checked = true;
    inp.addEventListener('change', () => { state.policy = p.id; render(); });
    lab.append(inp, document.createTextNode(p.label));
    $('policies').append(lab);
  }
  const seg = $('segment');
  seg.append(el('option', { value: '' }, 'All households'));
  if (lo && hi) {
    seg.append(el('option', { value: 'before' }, `Oldest member under ${lo} (before CPP can start)`));
    seg.append(el('option', { value: 'window' }, `Oldest member ${lo} to ${hi} (the CPP start window)`));
    seg.append(el('option', { value: 'after' }, `Oldest member over ${hi}`));
  }
  seg.addEventListener('change', () => { state.filter.segment = seg.value; render(); });
  $('business').addEventListener('change', (e) => { state.filter.business = e.target.checked; render(); });
  $('trust').addEventListener('change', (e) => { state.filter.trust = e.target.checked; render(); });
  const cap = $('capacity'); cap.value = state.capacity;
  cap.addEventListener('input', () => { const n = Number(cap.value); if (n > 0) { state.capacity = n; render(); } });

  // The rule for each task, in words, from the facts it cites.
  function ruleText(t) {
    const ids = factIds(t, Y), f = ids.map((id) => F.get(id));
    if (t.kind === 'service') return 'Set by the review policy above: a practice choice, not a rule.';
    if (f.some((x) => !x)) return null;
    switch (t.id) {
      case 'rrsp_deadline': return `Contributions for ${Y - 1} are due ${longDate(String(f[0].value))}.`;
      case 't1_returns': return `The balance owing for ${Y - 1} is due ${longDate(String(f[0].value))}.`;
      case 't1_self_employed': return `Self-employed returns for ${Y - 1} are due ${longDate(String(f[0].value))}.`;
      case 'instalments': return `Individuals who pay by instalments pay on ${f[0].value}.`;
      case 't3_return': return `A trust's T3 return is due ${f[0].value}.`;
      case 'corp_year_end': return `At each holding company's year-end, which starts the clock on its T2 return (due ${f[0].value}).`;
      case 't2_return': return `Due ${f[0].value}. The book's year-ends fall on a month's last day, so the return is due on the last day of that later month.`;
      case 'rrif_conversion': return `An RRSP must mature by the end of the year its holder turns ${f[0].value}.`;
      case 'cpp_opens': return `The earliest CPP start age is ${f[0].value}: a task in the year a member reaches it.`;
      case 'standard_start': return `The standard CPP start age is ${f[0].value} and OAS starts at ${f[1].value}.`;
      case 'last_deferral': return `CPP can start as late as ${f[0].value}; OAS can be deferred to ${f[1].value}.`;
      case 'trust_21': return `A trust is deemed to dispose of its property every ${f[0].value} years after it was created.`;
      default: return t.label;
    }
  }

  // Heatmap: weeks as columns, Monday to Friday as rows. Phones get the year in two halves.
  function drawHeat(daily, offset, weeks) {
    const box = $('heat'); box.textContent = '';
    const W = Math.min(box.clientWidth || 360, 992);
    const halves = W < 700 ? 2 : 1, per = Math.ceil(weeks / halves);
    const left = 34, gap = 3, cell = Math.max(8, Math.min(16, Math.floor((W - left) / per) - gap)), step = cell + gap;
    const dayCap = state.capacity / 5;
    const level = (v) => (v <= 0 ? 0 : v < dayCap * 0.5 ? 1 : v < dayCap ? 2 : v < dayCap * 1.5 ? 3 : 4);
    const blockH = 20 + 5 * step + 14;
    const svg = s('svg', { width: left + per * step, height: halves * blockH, role: 'img', 'aria-label': heatLabel });
    const start = Date.UTC(Y, 0, 1);
    for (let k = 0; k < daily.length; k++) {
      const t = start + k * 86400000, dow = new Date(t).getUTCDay();
      if (dow === 0 || dow === 6) continue;
      const w = Math.floor((k + offset) / 7), half = Math.floor(w / per), col = w - half * per;
      svg.append(s('rect', { class: `cell l${level(daily[k])}`, x: left + col * step, y: half * blockH + 20 + (dow - 1) * step, width: cell, height: cell }));
    }
    for (let half = 0; half < halves; half++) {
      ['Mon', 'Wed', 'Fri'].forEach((d, i) => svg.append(s('text', { class: 'lab', x: 0, y: half * blockH + 20 + i * 2 * step + cell - 1 }, d)));
      for (let m = 0; m < 12; m++) {
        const k = (Date.UTC(Y, m, 1) - start) / 86400000, w = Math.floor((k + offset) / 7);
        if (Math.floor(w / per) !== half) continue;
        svg.append(s('text', { class: 'lab', x: left + (w - half * per) * step, y: half * blockH + 13 }, fmtDate(Date.UTC(Y, m, 1), { month: 'short' })));
      }
    }
    const half = Math.floor(state.week / per), col = state.week - half * per;
    svg.append(s('rect', { class: 'pick', x: left + col * step, y: half * blockH + 20 + 5 * step, width: cell, height: 3 }));
    box.append(svg);
    const key = el('p', { class: 'key' });
    key.append(document.createTextNode('Fewer hours'));
    for (let i = 0; i < 5; i++) { const sw = document.createElementNS(SVG, 'svg'); sw.setAttribute('width', 14); sw.setAttribute('height', 14); sw.setAttribute('aria-hidden', 'true'); sw.append(s('rect', { class: `l${i}`, width: 14, height: 14 })); key.append(sw); }
    key.append(document.createTextNode('More hours'));
    box.append(key);
  }
  let heatLabel = '';

  function drawBars(weekly) {
    const box = $('bars'); box.textContent = '';
    const W = Math.min(box.clientWidth || 360, 992), H = 170, top = 6, left = 4;
    const max = Math.max(state.capacity * 1.15, ...weekly), bw = (W - left) / weekly.length;
    const y = (v) => top + (H - top) * (1 - v / max);
    const svg = s('svg', { width: W, height: H + 8, role: 'img', 'aria-label': `Hours in each week of ${Y}, with the capacity line at ${h0(state.capacity)} hours. The weeks are also in the table below.` });
    weekly.forEach((v, i) => svg.append(s('rect', { class: `bar${v > state.capacity ? ' over' : ''}`, x: left + i * bw + 0.5, y: y(v), width: Math.max(1, bw - 1.5), height: H - y(v) })));
    svg.append(s('line', { class: 'cap', x1: 0, x2: W, y1: y(state.capacity), y2: y(state.capacity) }));
    svg.append(s('rect', { class: 'pick', x: left + state.week * bw + 0.5, y: H + 3, width: Math.max(1, bw - 1.5), height: 3 }));
    const key = el('p', { class: 'cap-key' }); key.append(el('i', { 'aria-hidden': 'true' }), document.createTextNode(`Capacity: ${h0(state.capacity)} hours a week (${config.assumptionLabel}). Weeks over it are drawn solid.`));
    box.append(key, svg);
  }

  function weekStart(i, offset) { return Date.UTC(Y, 0, 1) + (i * 7 - offset) * 86400000; }
  function weekName(i, offset) {
    const t = weekStart(i, offset);
    return t < Date.UTC(Y, 0, 1) ? `the first week of ${Y}` : `the week of Monday, ${fmtDate(t)}`;
  }

  let last = null;
  function render() {
    const { items, pending } = buildTriggers(book, factsFile, config, { policy: state.policy, filter: state.filter });
    const L = load(items, config, state.hours), m = metrics(L.weekly, state.capacity);
    const byType = new Map(config.types.map((t) => [t.id, load(items.filter((i) => i.type === t.id), config, state.hours).weekly]));
    const nHouse = new Set(items.map((i) => i.household)).size;
    const busiest = L.weekly.indexOf(m.peak);
    last = { items, pending, L, m, byType };
    const weeks = L.weekly.length;
    $('week').max = weeks - 1;
    if (state.week > weeks - 1) state.week = weeks - 1;

    // The summary, with the one amber mark: the weeks over capacity.
    const sum = $('summary'); sum.textContent = '';
    const policy = config.policies.find((p) => p.id === state.policy).label;
    sum.append(document.createTextNode(`${policy}, ${nHouse.toLocaleString('en-CA')} households: the busiest week is ${weekName(busiest, L.offset)}, at ${h0(m.peak)} hours, ${ratio(m.peakToAverage)} times the average week. `));
    const mk = el('mark', {}, `${m.weeksOver} ${m.weeksOver === 1 ? 'week' : 'weeks'} over capacity`);
    sum.append(mk, document.createTextNode(` (${h0(state.capacity)} hours a week).`));
    heatLabel = `Heatmap of ${Y}, one square per weekday. ${sum.textContent} The weeks are also in the table below.`;

    drawHeat(L.daily, L.offset, weeks);
    $('heat-note').textContent = `Shading compares each day with a fifth of the weekly capacity. ${pending.length ? `Not counted yet: ${pending.map((p) => p.label).join('; ')} (their rule is not yet confirmed in the facts file).` : ''}`;
    drawBars(L.weekly);
    readout();

    const tb = $('weeks'); tb.textContent = '';
    L.weekly.forEach((v, i) => { const tr = el('tr'); tr.append(el('td', {}, fmtDate(Math.max(weekStart(i, L.offset), Date.UTC(Y, 0, 1)))), el('td', {}, h0(v)), el('td', {}, v > state.capacity ? `Yes, by ${h0(v - state.capacity)}` : 'No')); tb.append(tr); });

    const cmp = $('compare'); cmp.textContent = '';
    for (const r of compare(book, factsFile, config, { filter: state.filter, hours: state.hours, capacity: state.capacity })) {
      const tr = el('tr'); tr.append(el('td', {}, r.label), el('td', {}, `${h0(r.peak)} hours`), el('td', {}, `${h0(r.average)} hours`), el('td', {}, ratio(r.peakToAverage)), el('td', {}, String(r.weeksOver)));
      cmp.append(tr);
    }
    const count = new Map(); items.forEach((i) => count.set(i.type, (count.get(i.type) ?? 0) + 1));
    document.querySelectorAll('[data-count]').forEach((td) => { td.textContent = String(count.get(td.dataset.count) ?? 0); });
  }

  function readout() {
    if (!last) return;
    const { L, byType } = last, i = state.week, v = L.weekly[i];
    const parts = config.types.map((t) => [t.label, byType.get(t.id)[i]]).filter(([, x]) => x >= 0.5).sort((a, b) => b[1] - a[1]);
    const text = `${weekName(i, L.offset).replace(/^t/, 'T')}: ${h0(v)} hours${v > state.capacity ? `, ${h0(v - state.capacity)} over capacity` : ''}. ${parts.length ? parts.map(([n, x]) => `${n} ${h0(x)}`).join(', ') + '.' : 'No dated work.'}`;
    $('readout').textContent = text;
    $('week').value = i;
    $('week').setAttribute('aria-valuetext', text);
  }
  $('week').addEventListener('input', (e) => { state.week = Number(e.target.value); render(); });

  // Rules table with editable hours.
  $('rules-caption').textContent = `Hours per task and lead weeks are ${config.assumptionLabel}. A task's hours are spread over the weekdays in its lead time.`;
  const rules = $('rules');
  for (const t of config.types) {
    const txt = ruleText(t); if (txt === null) continue;
    const tr = el('tr');
    const src = el('div', { class: 'src' });
    factIds(t, Y).forEach((id, k) => { const f = F.get(id); if (!f) return; if (k) src.append(document.createTextNode('; ')); src.append(el('a', { href: f.source_url }, f.title)); });
    const rule = el('td'); rule.append(document.createTextNode(txt), src);
    const inp = el('input', { type: 'number', min: '0', max: '100', step: '0.25', value: String(t.hours), 'aria-label': `Hours per task: ${t.label} (${config.assumptionLabel})` });
    inp.addEventListener('input', () => { const n = Number(inp.value); if (n >= 0 && inp.value !== '') { state.hours[t.id] = n; render(); } });
    const hc = el('td'); hc.append(inp);
    tr.append(el('th', { scope: 'row' }, t.label), rule, el('td', { 'data-count': t.id }), hc, el('td', {}, String(t.leadWeeks)));
    rules.append(tr);
  }
  const pend = $('pending');
  for (const t of config.types) if (ruleText(t) === null) pend.append(el('p', {}, `Pending: ${t.label}. Its rule (${factIds(t, Y).join(', ')}) is not confirmed in the facts file yet, so these tasks are not counted.`));

  // Sources: every fact the page reads.
  const ul = $('sources');
  const cited = new Set(config.types.flatMap((t) => factIds(t, Y)).concat(['cpp_earliest_start_age', 'cpp_latest_start_age']));
  for (const id of cited) { const f = F.get(id); if (!f) continue; const li = el('li'); li.append(el('a', { href: f.source_url }, f.title)); li.append(document.createTextNode(`, read ${f.as_of}.`)); ul.append(li); }

  $('csv').addEventListener('click', () => {
    const blob = new Blob([toCSV(last.items, config, state.hours)], { type: 'text/csv' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `planning-year-${Y}-synthetic.csv` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 0);
  });

  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (last) { drawHeat(last.L.daily, last.L.offset, last.L.weekly.length); drawBars(last.L.weekly); } }, 150); });
  render();
  // Start on the busiest week.
  state.week = last.L.weekly.indexOf(last.m.peak); render();
})();
