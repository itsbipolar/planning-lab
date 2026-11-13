// The Order of Returns: the page. engine.mjs and enumerate.mjs are inlined above this script at build time.
// Every number on the page is computed here from story.json, the engine and the confirmed facts; none is typed in.
// Nothing the reader does is stored, put in the address or sent anywhere. A saved image is made in the browser.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const S = JSON.parse($('story').textContent), FX = JSON.parse($('facts').textContent);
  const moneyF = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
  const money = (v) => moneyF.format(Math.round(v) === 0 ? 0 : v);
  const intF = new Intl.NumberFormat('en-CA');
  const minus = (s) => s.replace('-', '−');
  const card = (v) => { const p = Math.round(v * 100); return (p < 0 ? '−' : '+') + Math.abs(p) + '%'; };
  const pct1 = (v) => minus((Math.round(v * 1000) / 10).toFixed(1)) + '%';
  const pctF = (v) => minus(String(Math.round(v * 10000) / 100)) + '%';
  const share = (n, d) => { const p = n / d * 100; if (p > 0 && p < 0.1) return 'under 0.1%'; if (p < 100 && p > 99.9) return 'over 99.9%'; return (Math.round(p * 10) / 10).toFixed(p >= 10 ? 0 : 1) + '%'; };
  const kfmt = (v) => v === 0 ? '$0' : v >= 1e6 ? '$' + (Math.round(v / 1e5) / 10) + 'M' : '$' + Math.round(v / 1000) + 'k';
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const words = (n) => WORDS[n] || String(n);
  const years = (n) => words(n) + (n === 1 ? ' year' : ' years');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);

  // ---------- the story, run through the engine ----------
  const N = S.cards.length, HZ = S.horizon, W0 = S.withdrawal, AVG = average(S.cards), ORDERS = factorial(N);
  const TAIL = Array.from({ length: HZ - N }, () => AVG);
  const GOOD = S.cards.slice().sort((a, b) => b - a), BAD = S.cards.slice().sort((a, b) => a - b);
  const MAT = Number(FX.maturity.value);
  const RRIF_F = rrifFactorsByYear({ startAge: S.startAge, maturityAge: MAT, rows: FX.rrif.value, years: HZ });
  const RRIF_T0 = RRIF_F.findIndex((f) => f > 0);
  const returnsOf = (order) => order.concat(Array(Math.max(0, N - order.length)).fill(AVG), TAIL);
  const run = (order, w, lv = {}) => simulate({ start: S.start, withdrawal: w, indexation: S.indexation, returns: returnsOf(order),
    flexRule: lv.flex ? { trim: S.flexTrim } : null, cashBuffer: lv.buffer ? { years: S.bufferYears } : null, minimumFactors: lv.rrif ? RRIF_F : null });
  const total = (res) => res.paid.reduce((a, b) => a + b, 0);
  const pts = (res) => [S.start].concat(res.balances);
  const outcome = (res) => ({ dep: res.depletionYear || 0, value: res.depletionYear ? total(res) : res.endBalance });
  const short = (res) => res.depletionYear ? 'runs out in year ' + res.depletionYear : money(res.endBalance) + ' left';
  const RUTH = run(GOOD, W0), SAM = run(BAD, W0);
  const first5 = (order) => average(order.slice(0, Math.min(5, N)));
  const ENUM = { start: S.start, withdrawal: W0, indexation: S.indexation, cards: S.cards, tail: TAIL };

  const fill = {
    start: money(S.start), withdrawal: money(W0), indexation: pctF(S.indexation), avg: pct1(AVG), trim: pctF(S.flexTrim),
    buffer: words(S.bufferYears), orders: intF.format(ORDERS), after: String(N + 1),
  };
  document.querySelectorAll('[data-v]').forEach((e) => { e.textContent = fill[e.dataset.v]; });

  // ---------- drawing helpers ----------
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) if (attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const mctx = document.createElement('canvas').getContext('2d');
  // text is measured in the face the page really draws it in (the desk's tokens, read from the page's own CSS)
  const face = (mono) => getComputedStyle(document.documentElement).getPropertyValue(mono ? '--font-mono' : '--font-ui').trim() || 'sans-serif';
  const tw = (s, size, weight = 400, mono = false) => {
    mctx.font = weight + ' ' + size + 'px ' + face(mono);
    return mctx.measureText(s).width;
  };
  // A line of text's real box at a size: the font's ascent above the baseline and descent below it (what the browser
  // gives an SVG text element), so stacked lines are spaced by the face's own metrics rather than by a guessed gap.
  const vm = (size, weight = 400) => {
    mctx.font = weight + ' ' + size + 'px ' + face(false);
    const m = mctx.measureText('Hg'), asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
    return asc > 0 ? { asc, desc, h: asc + desc } : { asc: size, desc: size / 2, h: size * 1.5 };
  };
  const widthOf = (svg) => Math.max(260, Math.floor(svg.parentNode.getBoundingClientRect().width));
  const setup = (svg, W, H) => {
    svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
  };

  // Label avoidance in one dimension. items: [{ want, size }] (want = the centre the label would like). Sets item.pos (the
  // centre it gets) so that no two labels overlap (keeping `gap` between them), all stay inside [lo, hi], and each moves as
  // little as possible: labels that collide are merged into a block centred on their wishes, and blocks that then collide
  // merge again.
  function spread(items, lo, hi, gap) {
    const list = items.slice().sort((a, b) => a.want - b.want), blocks = [];
    const place = (b) => { b.start = Math.max(lo, Math.min(hi - b.size, b.sum / b.items.length)); };
    for (const it of list) {
      it.off = 0;
      const b = { items: [it], size: it.size, sum: it.want - it.size / 2 };
      place(b); blocks.push(b);
      while (blocks.length > 1) {
        const p = blocks[blocks.length - 2], c = blocks[blocks.length - 1];
        if (p.start + p.size + gap <= c.start + 1e-9) break;
        const shift = p.size + gap;
        for (const ci of c.items) { ci.off += shift; p.items.push(ci); }
        p.sum += c.sum - shift * c.items.length; p.size += gap + c.size;
        blocks.pop(); place(p);
      }
    }
    for (const b of blocks) for (const it of b.items) it.pos = b.start + it.off + it.size / 2;
    return items;
  }

  function yScale(max, ticks) { const step = niceStep(max / ticks); return { step, max: Math.max(step, Math.ceil(max / step - 1e-9) * step) }; }

  // A line chart of balances by year. series: [{ key, name, reading, pts, dep, upto, thin, dash }]
  function lineChart(svg, cfg) {
    const W = cfg.width || widthOf(svg), narrow = W < 600, tight = narrow || cfg.compact;
    const fs = narrow ? 12 : 13, lfs = narrow ? 12 : 14;
    // stacked label lines: the name (bold) then its reading, each in its real box, one pixel of air between boxes
    const mN = vm(lfs, 700), mR = vm(lfs - 1), mF = vm(fs, 600), air = 1;
    const H = cfg.height ? cfg.height(W) : narrow ? 320 : Math.round(Math.min(500, Math.max(360, W * 0.3)));
    setup(svg, W, H);
    let max = cfg.yMax || 0; if (!cfg.yMax) for (const s of cfg.series) for (const v of s.pts) max = Math.max(max, v);
    const ys = yScale(max, narrow || cfg.compact ? 3 : 4);
    const tickLabs = []; for (let g = 0; g <= ys.max + 1e-6; g += ys.step) tickLabs.push(g);
    const L = Math.ceil(Math.max(...tickLabs.map((g) => tw(kfmt(g), fs)))) + 10;
    const labelled = cfg.series.filter((s) => s.name);
    const full = (s) => s.upto === undefined || s.upto >= HZ;
    // the labels go in a gutter on the right; on narrow and small charts their words wrap to keep the gutter slim
    const gutMax = tight ? (narrow ? 76 : 96) : 400;
    for (const s of labelled) { s.nameLines = wrap(s.name, gutMax, lfs, 700); s.readLines = s.reading ? wrap(s.reading, gutMax, lfs - 1, 400) : []; }
    const gut = Math.ceil(Math.max(0, ...labelled.filter(full).flatMap((s) => s.nameLines.map((l) => tw(l, lfs, 700)).concat(s.readLines.map((l) => tw(l, lfs - 1)))))) + 22;
    const T = cfg.band ? 34 : 14, B = 30 + (cfg.bottomPad || 0), R = gut;
    const x = (t) => L + t / HZ * (W - L - R), y = (v) => T + (1 - v / ys.max) * (H - T - B);
    const g0 = el('g', {}, svg);
    if (cfg.band) {
      el('rect', { x: x(0), y: T, width: x(N) - x(0), height: y(0) - T, class: 'band' }, g0);
      const a = narrow ? 'Dealt years' : 'The ten dealt years', b = narrow ? 'Then ' + pct1(AVG) + ' a year' : 'Then the ' + pct1(AVG) + ' average, every year';
      el('text', { x: x(0) + 6, y: T - 10, class: 'mono ax', 'font-size': 11 }, g0, a);
      el('text', { x: x(N) + 6, y: T - 10, class: 'mono ax', 'font-size': 11 }, g0, b);
    }
    for (const g of tickLabs) {
      el('line', { x1: L, x2: W - R, y1: y(g), y2: y(g), class: g === 0 ? 'zero' : 'grid' }, g0);
      el('text', { x: L - 8, y: y(g) + 4, 'text-anchor': 'end', class: 'ax', 'font-size': fs }, g0, kfmt(g));
    }
    // year ticks: "Year 10" when there is room, bare numbers and a "years" note in the gutter when there is not
    const roomy = x(5) - x(0) > tw('Year ' + HZ, fs) + 12;
    for (let t = 0; t <= HZ; t += 5) el('text', { x: x(t), y: H - 9, 'text-anchor': t === 0 && roomy ? 'start' : 'middle', class: 'ax', 'font-size': fs }, g0, roomy ? (t === 0 ? 'Start' : 'Year ' + t) : String(t));
    if (!roomy) el('text', { x: x(HZ) + 14, y: H - 9, class: 'ax', 'font-size': fs }, g0, 'years');
    if (cfg.extra) cfg.extra(g0, { x, y, W, H, T, B, L, R, fs });
    const gl = el('g', {}, svg), gd = el('g', {}, svg), gt = el('g', {}, svg);
    for (const s of cfg.series) {
      const upto = s.upto === undefined ? s.pts.length - 1 : s.upto;
      const d = s.pts.slice(0, upto + 1).map((v, t) => (t ? 'L' : 'M') + x(t).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
      el('path', { d, class: 'ln s-' + s.key + (s.thin ? ' thin' : '') + (s.dash ? ' dash' : '') }, gl);
      if (s.dep && s.dep <= upto) el('circle', { cx: x(s.dep), cy: y(0), r: s.thin ? 4 : 5.5, class: 'dot f-' + s.key }, gd);
    }
    // readings at the end of the dealt years
    if (cfg.readAt) {
      const rs = cfg.series.filter((s) => (s.upto === undefined || s.upto >= cfg.readAt) && !s.thin).map((s) => ({ s, v: s.pts[cfg.readAt], want: y(s.pts[cfg.readAt]), size: mF.h }));
      spread(rs, T + 2, y(0) - 2, 2);
      for (const r of rs) {
        el('circle', { cx: x(cfg.readAt), cy: y(r.v), r: 3.5, class: 'f-' + r.s.key }, gd);
        el('text', { x: x(cfg.readAt) + 8, y: r.pos - mF.h / 2 + mF.asc, class: 'halo t-' + r.s.key, 'font-size': fs, 'font-weight': 600 }, gt, money(r.v));
      }
    }
    // the series labels: in the gutter at the height of their line's end, spread so they never overlap, with a leader
    // when they had to move; a path that stops early (a partly dealt order) is labelled at its end instead
    const blocks = labelled.map((s) => {
      const upto = s.upto === undefined ? s.pts.length - 1 : s.upto, lines = s.nameLines.length + s.readLines.length;
      const size = s.nameLines.length * mN.h + s.readLines.length * mR.h + (lines - 1) * air;
      return { s, upto, end: y(s.pts[upto]), size, want: y(s.pts[upto]) };
    });
    const gutter = blocks.filter((b) => full(b.s)), over = blocks.filter((b) => !full(b.s));
    over.forEach((b) => { b.want = b.end - b.size / 2 - 8; });
    // the gutter's floor: above the year ticks' row (baseline H - 9) by their ascent and a little air, so the last label
    // never sits on "Year 25" or the "years" note
    spread(gutter, Math.max(4, T - 10), Math.min(H - B + 8, H - 9 - vm(fs).asc - 3), 6);
    spread(over, T, y(0) - 6, 4);
    for (const b of blocks) {
      const inGut = gutter.includes(b), ex = x(b.upto), tx = inGut ? W - R + 14 : ex + 8;
      const top = b.pos - b.size / 2;
      if (inGut && Math.abs(b.pos - b.end) > 3) el('path', { d: `M${ex + 3} ${b.end}L${ex + 6} ${b.end}L${tx - 4} ${b.pos}`, class: 'leader' }, gt);
      // each line's box starts where the one above ends (plus the air); its baseline sits its ascent below that
      let ly = top;
      for (const l of b.s.nameLines) { el('text', { x: tx, y: ly + mN.asc, class: 'halo t-' + b.s.key, 'font-size': lfs, 'font-weight': 700 }, gt, l); ly += mN.h + air; }
      for (const l of b.s.readLines) { el('text', { x: tx, y: ly + mR.asc, class: 'halo t-ink2', 'font-size': lfs - 1 }, gt, l); ly += mR.h + air; }
    }
    return { x, y, T, series: cfg.series };
  }

  // A crosshair on a balance chart (the shared deskCrosshair): the year under the pointer and each line's balance then.
  // The returned remover is called before the chart is drawn again.
  const xhairs = {};
  const dropCross = (svg) => { if (xhairs[svg.id]) { xhairs[svg.id](); delete xhairs[svg.id]; } };
  function addCross(svg, g) {
    dropCross(svg);
    xhairs[svg.id] = deskCrosshair(svg, { x0: g.x(0), x1: g.x(HZ), y0: g.T, y1: g.y(0), read: (px) => {
      const t = Math.max(0, Math.min(HZ, Math.round((px - g.x(0)) / (g.x(HZ) - g.x(0)) * HZ)));
      const lines = [t === 0 ? 'At the start' : 'End of year ' + t];
      let top = g.y(0);
      for (const s of g.series) {
        const upto = s.upto === undefined ? HZ : s.upto;
        if (t > upto) continue;
        const gone = s.dep && t >= s.dep;
        lines.push(s.name + ': ' + (gone ? 'ran out in year ' + s.dep : money(s.pts[t])));
        top = Math.min(top, g.y(s.pts[t]));
      }
      return { x: g.x(t), y: top, lines };
    } });
  }
  function wrap(text, max, size, weight) {
    const out = []; let line = '';
    for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (line && tw(t, size, weight) > max) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line);
    return out;
  }

  // ---------- the lead chart ----------
  const ruthS = (res = RUTH, extra = {}) => ({ key: 'ruth', name: 'Ruth', reading: short(res), pts: pts(res), dep: res.depletionYear, ...extra });
  const samS = (res = SAM, extra = {}) => ({ key: 'sam', name: 'Sam', reading: short(res), pts: pts(res), dep: res.depletionYear, ...extra });
  const headline = RUTH.depletionYear === null && SAM.depletionYear
    ? `Same ten years, same average return. In one order the savings last all ${HZ} years; in the other they run out in year ${SAM.depletionYear}.`
    : `Same ten years, same average return: ${short(RUTH)} for Ruth, ${short(SAM)} for Sam.`;
  $('headline').textContent = headline;
  $('deck').textContent = `Ruth and Sam are made up. They retire with the same savings, take the same withdrawals and live through the same ${words(N)} market years. Only the order of the years differs. Further down, the page runs all ${intF.format(ORDERS)} possible orders of those years, lets you deal your own, and tries to rescue Sam.`;
  $('t-lead').textContent = 'Savings at the end of each year, after that year’s withdrawal';
  const fate = (name, res) => res.depletionYear ? `${name}\u2019s money runs out in year ${res.depletionYear}` : `${name} still has ${money(res.endBalance)} after ${HZ} years`;
  $('s-lead').textContent = `Both take out ${money(W0)} in the first year, ${pctF(S.indexation)} more each year after. After the ${words(N)} dealt years Ruth has ${money(RUTH.balances[N - 1])} and Sam ${money(SAM.balances[N - 1])}. ${fate('Ruth', RUTH)}; ${fate('Sam', SAM)}.`;
  const drawLead = () => { const svg = $('c-lead'); dropCross(svg); addCross(svg, lineChart(svg, { series: [ruthS(), samS()], band: true, readAt: N })); };

  // ---------- the cards ----------
  for (const v of S.cards) { const li = document.createElement('li'); li.textContent = card(v); if (v < 0) li.className = 'down'; $('cards').appendChild(li); }

  // ---------- shuffle with no withdrawals ----------
  let samOrder = BAD.slice();
  const ZERO_END = run(GOOD, 0).endBalance;
  $('h-shuffle').textContent = `With nothing taken out, every order ends with ${money(ZERO_END)}`;
  $('t-shuffle').textContent = 'Savings with no withdrawals: Ruth’s order against Sam’s shuffled order';
  let shuffles = 0;
  function drawShuffle() {
    const r = run(GOOD, 0), s = run(samOrder, 0);
    lineChart($('c-shuffle'), { series: [ruthS(r), samS(s, { reading: money(s.endBalance) + ' left' })], band: true, height: (W) => W < 600 ? 280 : 340 });
    // the readout under the button: Sam's ending, what it means, and the order he got this time
    const same = Math.round(s.endBalance) === Math.round(r.endBalance);
    $('rk-shuffle').textContent = `Sam’s ending balance after ${HZ} years, nothing taken out`;
    $('rv-shuffle').textContent = money(s.endBalance);
    $('s-shuffle').textContent = same
      ? `Same ending as Ruth: with nothing taken out, the order of the years doesn’t matter.`
      : `Ruth ends with ${money(r.endBalance)}.`;
    $('rk-order').textContent = shuffles ? `Sam’s order this time (shuffle ${intF.format(shuffles)})` : 'Sam’s order: worst years first';
    const ol = $('sam-order'); ol.replaceChildren();
    for (const v of samOrder) { const li = document.createElement('li'); li.textContent = card(v); if (v < 0) li.className = 'down'; ol.appendChild(li); }
  }
  $('shuffle').addEventListener('click', () => {
    for (let i = samOrder.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [samOrder[i], samOrder[j]] = [samOrder[j], samOrder[i]]; }
    shuffles++; drawShuffle();
  });

  // ---------- deal the years ----------
  let hand, dealt;
  const handEl = $('hand'), dealtEl = $('dealt');
  const youRes = () => run(dealt, W0);
  const isFull = () => dealt.length === N;
  function drawDeal(svg = $('c-deal'), width) {
    const series = [ruthS(RUTH, { thin: false }), samS()];
    if (dealt.length) {
      const r = youRes(), k = dealt.length;
      series.push({ key: 'you', name: 'Your order', reading: isFull() ? short(r) : money(r.balances[k - 1]) + ' after year ' + k, pts: pts(r), dep: r.depletionYear, upto: isFull() ? undefined : k });
    }
    const live = svg.id === 'c-deal';
    if (live) dropCross(svg);
    const g = lineChart(svg, { series, band: true, width });
    if (live) addCross(svg, g);
  }
  // the readout under the deal buttons: where your order ends, and (once every order is counted) how it ranks
  function dealReadout() {
    const r = youRes(), k = dealt.length, v = $('rv-deal');
    v.hidden = !k;
    if (!k) {
      $('rk-deal').textContent = 'Your order';
      $('rt-deal').textContent = 'Deal a card above, or deal the rest at random, to draw your path.';
      $('rf-deal').textContent = '';
      return;
    }
    $('rf-deal').textContent = `Ruth, best years first: ${short(RUTH)}. Sam, worst years first: ${short(SAM)}. Synthetic sequence: not historical, not a forecast.`;
    if (!isFull()) {
      $('rk-deal').textContent = `Your order so far: ${k} of ${N} years dealt`;
      v.textContent = money(r.balances[k - 1]) + ' after year ' + k;
      $('rt-deal').textContent = `Deal the other ${years(N - k)} to see where it ends and how it ranks among all ${intF.format(ORDERS)} orders.`;
      return;
    }
    $('rk-deal').textContent = 'Where your order ends';
    v.textContent = r.depletionYear ? 'Runs out in year ' + r.depletionYear : `Lasts all ${HZ} years, ${money(r.endBalance)} left`;
    $('rt-deal').textContent = BASE ? 'Ranking it among every order…' : `Ranking it among all ${intF.format(ORDERS)} orders once the count below finishes…`;
  }
  function deal(focusNext) {
    handEl.replaceChildren(); dealtEl.replaceChildren();
    for (const v of dealt) { const li = document.createElement('li'); li.textContent = card(v); if (v < 0) li.className = 'down'; dealtEl.appendChild(li); }
    hand.forEach((v, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = card(v); if (v < 0) b.className = 'down';
      b.setAttribute('aria-label', 'Deal the year ' + card(v));
      b.addEventListener('click', () => { dealt.push(v); hand.splice(i, 1); deal(true); });
      handEl.appendChild(b);
    });
    drawDeal();
    const r = youRes(), k = dealt.length;
    $('t-deal').textContent = isFull() ? 'Your order: the money ' + short(r).replace(/^(\$[\d,]+) left$/, 'lasts, with $1 left after ' + HZ + ' years') : k ? `Your order so far: ${k} of ${N} years dealt` : 'Deal a card to draw your path';
    dealReadout();
    if (focusNext) { const nb = handEl.querySelector('button'); (nb || $('s-deal')).focus(); }
    youChanged();
  }
  $('reset').addEventListener('click', () => { hand = GOOD.slice(); dealt = []; deal(false); });
  $('random').addEventListener('click', () => { while (hand.length) dealt.push(hand.splice(Math.floor(Math.random() * hand.length), 1)[0]); deal(false); });

  // ---------- every possible order: a Web Worker from a blob: URL, or the page itself if no worker can start ----------
  const Runner = (() => {
    let worker = null, rid = 0;
    const jobs = {}, local = {}, rankCbs = {};
    const runLocal = (key) => setTimeout(() => {
      const j = jobs[key], t0 = performance.now(), res = enumerateOrders(j.params);
      local[key] = res; j.done({ ms: performance.now() - t0, summary: summarize(res, j.params.cards), where: 'page' });
    }, 30);
    try {
      const url = URL.createObjectURL(new Blob([$('worker-src').textContent], { type: 'text/javascript' }));
      worker = new Worker(url);
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'progress' && jobs[m.key]) jobs[m.key].progress(m.p);
        else if (m.type === 'done') { const j = jobs[m.key]; j.finished = true; j.done({ ms: performance.now() - j.t0, summary: m.summary, where: 'worker' }); }
        else if (m.type === 'rank') { rankCbs[m.id](m.rank); delete rankCbs[m.id]; }
      };
      worker.onerror = (e) => { e.preventDefault(); worker = null; for (const k in jobs) if (!jobs[k].finished) runLocal(k); };
    } catch (err) { worker = null; }
    return {
      start(key, params, progress, done) {
        if (jobs[key]) return;
        jobs[key] = { params, progress, done, t0: performance.now() };
        if (worker) worker.postMessage({ type: 'run', key, params }); else runLocal(key);
      },
      rank(key, o, cb) {
        if (local[key]) return cb(rankOutcome(local[key], o.dep, o.value));
        const id = ++rid; rankCbs[id] = cb; worker.postMessage({ type: 'rank', key, id, dep: o.dep, value: o.value });
      },
    };
  })();

  let BASE = null, RRIF_SUM = null, ranks = {};
  const bucketLabel = (sum, i) => { const y = firstYear(sum); return i < HZ - y + 1 ? 'Runs out in year ' + (y + i) : `Lasts ${HZ} years, ${kfmt(sum.left.step * (i - (HZ - y + 1)))} to ${kfmt(sum.left.step * (i - (HZ - y + 1) + 1))} left`; };
  const firstYear = (sum) => { for (let d = 1; d <= HZ; d++) if (sum.byYear[d]) return d; return HZ; };
  const bucketOf = (sum, o) => { const y = firstYear(sum); return o.dep ? Math.max(0, o.dep - y) : HZ - y + 1 + Math.min(sum.left.counts.length - 1, Math.floor(o.value / sum.left.step)); };
  const marks = () => {
    const m = [{ key: 'ruth', name: 'Ruth', o: outcome(RUTH), f5: first5(GOOD) }, { key: 'sam', name: 'Sam', o: outcome(SAM), f5: first5(BAD) }];
    if (dealt && isFull()) m.push({ key: 'you', name: 'Your order', o: outcome(youRes()), f5: first5(dealt) });
    return m;
  };

  // The two charts of every order are drawn once the count is done; until then each keeps its height and says what it is
  // waiting for, so the page never shows an empty box.
  const histH = (W) => W < 600 ? 330 : 420;
  const heatGeom = (W, y0) => { const narrow = W < 600, T = 88, ch = narrow ? 26 : 32, B = 52; return { T, ch, B, H: T + ch * (HZ - y0 + 2) + B }; };
  function waiting(svg, H) {
    const W = widthOf(svg), narrow = W < 600;
    setup(svg, W, H);
    el('rect', { x: 0, y: 0, width: W, height: H, class: 'band' }, svg);
    el('text', { x: W / 2, y: H / 2 + 5, 'text-anchor': 'middle', class: 'ax val', 'font-size': narrow ? 14 : 16 }, svg, `Counting all ${intF.format(ORDERS)} orders…`);
  }
  function drawWaiting() {
    if (BASE) return;
    waiting($('c-all'), histH(widthOf($('c-all'))));
    waiting($('c-early'), heatGeom(widthOf($('c-early')), SAM.depletionYear || HZ).H);
  }

  function histChart(sum) {
    const svg = $('c-all'), W = widthOf(svg), narrow = W < 600, fs = narrow ? 11 : 13, lfs = narrow ? 13 : 14;
    const H = histH(W), y0 = firstYear(sum), nDep = HZ - y0 + 1;
    const buckets = [];
    for (let d = y0; d <= HZ; d++) buckets.push(sum.byYear[d]);
    for (const c of sum.left.counts) buckets.push(c);
    setup(svg, W, H);
    const yMax = yScale(Math.max(...buckets) / sum.total, 4);
    const pl = (p) => Math.round(p * 100) + '%';
    const L = Math.ceil(tw(pl(yMax.max), fs)) + 10, R = 4, T = 56, B = 50;
    const unit = (W - L - R) / (buckets.length + 0.8), bw = unit * 0.8;
    const bx = (i) => L + i * unit + (i >= nDep ? 0.8 * unit : 0) + (unit - bw) / 2;
    const y = (p) => T + (1 - p / yMax.max) * (H - T - B);
    for (let p = 0; p <= yMax.max + 1e-9; p += yMax.step) {
      el('line', { x1: L, x2: W - R, y1: y(p), y2: y(p), class: p === 0 ? 'zero' : 'grid' }, svg);
      el('text', { x: L - 8, y: y(p) + 4, 'text-anchor': 'end', class: 'ax', 'font-size': fs }, svg, pl(p));
    }
    const ms = marks().map((m) => ({ ...m, b: bucketOf(sum, m.o) }));
    const gb = el('g', {}, svg);
    buckets.forEach((c, i) => {
      const p = c / sum.total, top = y(p);
      el('rect', { x: bx(i), y: top, width: bw, height: Math.max(0, y(0) - top), class: 'bar' }, gb);
      let t = p === 0 ? '0' : p < 0.001 ? '<0.1%' : (Math.round(p * 1000) / 10).toFixed(1) + '%';
      if (narrow) t = p === 0 ? '0' : p < 0.01 ? '<1%' : Math.round(p * 100) + '%';
      el('text', { x: bx(i) + bw / 2, y: top - 6, 'text-anchor': 'middle', class: 'ax val', 'font-size': fs }, gb, t);
    });
    for (const m of ms) el('rect', { x: bx(m.b) - 2.5, y: y(buckets[m.b] / sum.total) - 2.5, width: bw + 5, height: y(0) - y(buckets[m.b] / sum.total) + 5, class: 'mark s-' + m.key }, gb);
    // ticks: the years, then the money-left bin edges (thinned when they would collide)
    for (let i = 0; i < nDep; i++) el('text', { x: bx(i) + bw / 2, y: y(0) + 17, 'text-anchor': 'middle', class: 'ax', 'font-size': fs }, svg, String(y0 + i));
    const edge = (k) => bx(nDep + k) - (unit - bw) / 2;
    const nLeft = sum.left.counts.length, lw = tw(kfmt(sum.left.step * nLeft), fs) + 6, every = Math.max(1, Math.ceil(lw / unit));
    for (let k = 0; k <= nLeft; k += every) el('text', { x: k === nLeft ? edge(k - 1) + unit : edge(k), y: y(0) + 17, 'text-anchor': 'middle', class: 'ax', 'font-size': fs }, svg, kfmt(sum.left.step * k));
    const gA = narrow ? 'Runs out in year' : 'The money runs out in year', gB = narrow ? 'Lasts: left at the end' : `Lasts all ${HZ} years: money left at the end`;
    const mid1 = (bx(0) + bx(nDep - 1) + bw) / 2, mid2 = (bx(nDep) + bx(buckets.length - 1) + bw) / 2;
    el('text', { x: Math.max(L + tw(gA, fs, 600) / 2, mid1), y: H - 8, 'text-anchor': 'middle', class: 'ax grp', 'font-size': fs, 'font-weight': 600 }, svg, gA);
    el('text', { x: Math.min(W - R - tw(gB, fs, 600) / 2, mid2), y: H - 8, 'text-anchor': 'middle', class: 'ax grp', 'font-size': fs, 'font-weight': 600 }, svg, gB);
    // markers along the top, spread so they never collide, with a leader down to their bar
    const items = ms.map((m) => ({ m, want: bx(m.b) + bw / 2, size: tw(m.name, lfs, 700) + 8 }));
    spread(items, L, W - R, 6);
    for (const it of items) {
      const cx = bx(it.m.b) + bw / 2, top = y(buckets[it.m.b] / sum.total) - fs - 10;
      el('text', { x: it.pos, y: 18, 'text-anchor': 'middle', class: 't-' + it.m.key, 'font-size': lfs, 'font-weight': 700 }, svg, it.m.name);
      el('path', { d: `M${it.pos} 24L${it.pos} 30L${cx} ${Math.min(top, T - 4)}L${cx} ${top}`, class: 'leader s-' + it.m.key }, svg);
    }
    // the table
    const tb = document.querySelector('#tab-all tbody'); tb.replaceChildren();
    buckets.forEach((c, i) => { const tr = document.createElement('tr'); [bucketLabel(sum, i), intF.format(c), share(c, sum.total)].forEach((t, j) => { const td = document.createElement(j ? 'td' : 'th'); if (!j) td.scope = 'row'; td.textContent = t; tr.appendChild(td); }); tb.appendChild(tr); });
  }

  // the heat strip: columns are bins of the first five years' average; rows are how the orders end
  function heatChart(sum) {
    const svg = $('c-early'), W = widthOf(svg), narrow = W < 600, fs = narrow ? 11 : 13, lfs = narrow ? 13 : 14;
    const y0 = firstYear(sum), rows = [0]; for (let d = HZ; d >= y0; d--) rows.push(d);
    const gs = sum.groups, lo = gs[0].avg, hi = gs[gs.length - 1].avg, bw = niceStep((hi - lo) / (narrow ? 9 : 18));
    const c0 = Math.floor(lo / bw + 1e-9), c1 = Math.floor(hi / bw + 1e-9), nc = c1 - c0 + 1;
    const cols = Array.from({ length: nc }, (_, i) => ({ lo: (c0 + i) * bw, n: 0, counts: new Array(HZ + 1).fill(0) }));
    const colOf = (avg) => Math.floor(avg / bw + 1e-9) - c0;
    for (const g of gs) { const c = cols[colOf(g.avg)]; c.n += g.n; g.counts.forEach((v, d) => { c.counts[d] += v; }); }
    const rowLab = (d) => d === 0 ? (narrow ? 'Lasts' : `Lasts ${HZ} years`) : (narrow ? 'Year ' + d : 'Runs out, year ' + d);
    const { T, ch, H } = heatGeom(W, y0), L = Math.ceil(Math.max(...rows.map((d) => tw(rowLab(d), fs)))) + 12, R = 4, cw = (W - L - R) / nc;
    setup(svg, W, H);
    const cx = (i) => L + i * cw;
    const gc = el('g', {}, svg);
    // the share that last, printed above each column
    el('text', { x: L - 8, y: T - 12, 'text-anchor': 'end', class: 'ax', 'font-size': fs, 'font-weight': 600 }, svg, narrow ? '% last' : 'Share that last');
    cols.forEach((c, i) => {
      if (!c.n) return;
      rows.forEach((d, r) => {
        const p = c.counts[d] / c.n;
        el('rect', { x: cx(i) + 1, y: T + r * ch + 1, width: cw - 2, height: ch - 2, class: p > 0 ? 'cell' : 'cell0', 'fill-opacity': p > 0 ? (0.14 + 0.86 * p).toFixed(3) : undefined }, gc);
      });
      const p0 = c.counts[0] / c.n, t = Math.round(p0 * 100) + (cw > 34 ? '%' : '');
      if (cw > 18) el('text', { x: cx(i) + cw / 2, y: T - 12, 'text-anchor': 'middle', class: 'ax val', 'font-size': narrow ? 10 : fs }, svg, p0 > 0 && p0 < 0.005 ? '<1' + (cw > 34 ? '%' : '') : t);
    });
    rows.forEach((d, r) => el('text', { x: L - 8, y: T + r * ch + ch / 2 + 4, 'text-anchor': 'end', class: 'ax', 'font-size': fs }, svg, rowLab(d)));
    // x ticks at whole-number averages, thinned to fit
    const tickStep = niceStep(bw * Math.max(1, Math.ceil((tw('−10%', fs) + 10) / cw)));
    for (let v = Math.ceil(c0 * bw / tickStep - 1e-9) * tickStep; v <= (c1 + 1) * bw + 1e-9; v += tickStep) {
      const px = L + (v / bw - c0) * cw;
      el('line', { x1: px, x2: px, y1: T + rows.length * ch, y2: T + rows.length * ch + 5, class: 'zero' }, svg);
      el('text', { x: px, y: T + rows.length * ch + 19, 'text-anchor': 'middle', class: 'ax', 'font-size': fs }, svg, minus(String(Math.round(v * 100))) + '%');
    }
    el('text', { x: L + (W - L - R) / 2, y: H - 8, 'text-anchor': 'middle', class: 'ax grp', 'font-size': fs, 'font-weight': 600 }, svg, 'Average return of the first five years');
    // the line left of which every order runs out
    let allOut = -1; for (let i = 0; i < nc; i++) { if (cols[i].n && cols[i].counts[0] > 0) break; allOut = i; }
    const items = marks().map((m) => ({ m, col: colOf(m.f5) }));
    items.forEach((it) => { it.want = cx(it.col) + cw / 2; it.size = tw(it.m.name, lfs, 700) + 8; });
    const all = items.slice();
    if (allOut >= 0) { const t = narrow ? 'All run out' : 'Every order left of here runs out'; all.push({ rule: true, want: cx(allOut + 1), size: tw(t, fs, 600) + 8, t }); }
    spread(all, 0, W - R, 6);
    for (const it of all) {
      if (it.rule) {
        const px = cx(allOut + 1);
        el('line', { x1: px, x2: px, y1: 24, y2: T + rows.length * ch, class: 'rule' }, svg);
        el('text', { x: it.pos, y: 18, 'text-anchor': 'middle', class: 'ax halo', 'font-size': fs, 'font-weight': 600 }, svg, it.t);
        continue;
      }
      const ccx = cx(it.col) + cw / 2;
      el('rect', { x: cx(it.col) - 1, y: T - 30, width: cw + 2, height: rows.length * ch + 31, class: 'mark s-' + it.m.key }, svg);
      el('text', { x: it.pos, y: 42, 'text-anchor': 'middle', class: 't-' + it.m.key, 'font-size': lfs, 'font-weight': 700 }, svg, it.m.name);
      el('path', { d: `M${it.pos} 47L${ccx} ${T - 30}`, class: 'leader s-' + it.m.key }, svg);
    }
  }

  function earlyText(sum) {
    const gs = sum.groups;
    let a = null; for (const g of gs) { if (g.counts[0] > 0) break; a = g.avg; }
    let b = null; for (let i = gs.length - 1; i >= 0; i--) { if (gs[i].counts[0] / gs[i].n < 0.5) break; b = gs[i].avg; }
    const parts = [];
    if (a !== null) parts.push(`Every order whose first five years average ${pct1(a)} or less runs out within ${HZ} years.`);
    if (b !== null) parts.push(`Where they average ${pct1(b)} or more, at least half the orders last.`);
    parts.push(`Ruth’s first five average ${pct1(first5(GOOD))}; Sam’s, ${pct1(first5(BAD))}.`);
    if (dealt && isFull()) parts.push(`Yours average ${pct1(first5(dealt))}.`);
    parts.push(`All ten years average ${pct1(AVG)} in every order.`);
    return parts.join(' ');
  }

  function rankText(r, who) {
    const tot = intF.format(r.total);
    if (r.better === 0 && r.same === 1) return `${who} is the best of all ${tot} orders.`;
    if (r.worse === 0 && r.same === 1) return `${who} is the worst of all ${tot} orders.`;
    const tie = r.same > 1 ? ` ${intF.format(r.same - 1)} other orders end exactly the same way.` : '';
    return `${who} does worse than ${share(r.better, r.total)} of all ${tot} orders and better than ${share(r.worse, r.total)}.${tie}`;
  }

  function drawAll() {
    if (!BASE) return drawWaiting();
    histChart(BASE); heatChart(BASE);
    $('s-early').textContent = earlyText(BASE);
  }
  function allText() {
    const s = BASE, lastPct = share(s.lasts, s.total);
    let top = 1; for (let d = 1; d <= HZ; d++) if (s.byYear[d] > s.byYear[top]) top = d;
    const best = ranks.ruth && ranks.ruth.better === 0 && ranks.ruth.same === 1, worst = ranks.sam && ranks.sam.worse === 0 && ranks.sam.same === 1;
    $('h-all').textContent = `Of all ${intF.format(s.total)} orders, ${s.lasts / s.total < 0.5 ? 'only ' : ''}${lastPct} last ${HZ} years.` + (best && worst ? ' Ruth has the best; Sam has the worst.' : '');
    $('s-all').textContent = `${lastPct} of the orders last all ${HZ} years. The most common ending is running out in year ${top} (${share(s.byYear[top], s.total)} of orders). ` + (ranks.ruth ? rankText(ranks.ruth, 'Ruth’s order') + ' ' : '') + (ranks.sam ? rankText(ranks.sam, 'Sam’s order') : '');
  }
  function youChanged() {
    drawRrif();
    if (!BASE) return;
    drawAll();
    if (!isFull()) { $('s-rank').textContent = 'Deal all ten cards above to see where your order lands among them.'; return; }
    const o = outcome(youRes()), at = dealt.join();
    Runner.rank('base', o, (r) => { if (dealt.join() !== at) return; $('s-rank').textContent = rankText(r, 'Your order'); $('rt-deal').textContent = rankText(r, 'Your order'); });
  }

  $('run-text').textContent = `Counting all ${intF.format(ORDERS)} orders…`;
  Runner.start('base', ENUM, (p) => {
    $('run-bar').value = p; $('run-text').textContent = `Counting all ${intF.format(ORDERS)} orders: ${Math.floor(p * 10) * 10}%`;
  }, (d) => {
    BASE = d.summary; $('run-bar').value = 1;
    $('run-text').textContent = `All ${intF.format(BASE.total)} orders worked out in this browser in ${(d.ms / 1000).toFixed(1)} seconds.`;
    document.body.dataset.enumMs = String(Math.round(d.ms));
    allText(); youChanged();
    Runner.rank('base', outcome(RUTH), (r) => { ranks.ruth = r; allText(); });
    Runner.rank('base', outcome(SAM), (r) => { ranks.sam = r; allText(); });
  });

  // ---------- rescuing Sam ----------
  const SOLVE = largestLastingWithdrawal({ start: S.start, indexation: S.indexation, returns: returnsOf(BAD) });
  const SOLVED = run(BAD, SOLVE);
  $('h-rescue').textContent = `Sam’s money lasts all ${HZ} years if his first-year withdrawal is ${money(SOLVE)} or less`;
  $('p-solver').textContent = `That is ${money(W0 - SOLVE)} less than the ${money(W0)} in the story, about ${Math.round((1 - SOLVE / W0) * 100)}% less, rising ${pctF(S.indexation)} a year the same way. The amount comes from running Sam’s order through the engine with different first-year withdrawals until the largest one that pays every year in full is found.`;
  function compare(after, before) {
    const a = after.depletionYear, b = before.depletionYear, d = total(after) - total(before);
    const paid = `Over the ${HZ} years it pays out ${money(total(after))} in total, ` + (Math.abs(d) < 0.5 ? 'the same as before.' : `${money(Math.abs(d))} ${d > 0 ? 'more' : 'less'} than before.`);
    if (!a && !b) return `lasts all ${HZ} years either way: ${money(after.endBalance)} left, against ${money(before.endBalance)} before.`;
    if (!a) return `lasts all ${HZ} years, with ${money(after.endBalance)} left. Before, it ran out in year ${b}.`;
    if (!b) return `runs out in year ${a}; before, it lasted all ${HZ} years. ${paid}`;
    if (a === b) return `still runs out in year ${a}, the same year as before. ${paid}`;
    return `runs out in year ${a}, ${years(Math.abs(a - b))} ${a > b ? 'later' : 'sooner'} than before (year ${b}). ${paid}`;
  }
  const LEVERS = [
    { title: `Spend ${pctF(S.flexTrim)} less in a year after a down year`, res: run(BAD, W0, { flex: true }) },
    { title: `Keep ${words(S.bufferYears)} years of withdrawals in cash`, res: run(BAD, W0, { buffer: true }) },
    { title: `Start at ${money(SOLVE)} instead of ${money(W0)}`, res: SOLVED },
  ];
  LEVERS.forEach((lv, i) => {
    const f = document.createElement('figure'); f.className = 'fig small-multiple';
    f.innerHTML = `<p class="fig-title" id="t-lv${i}"></p><svg id="c-lv${i}" role="img" aria-labelledby="t-lv${i} s-lv${i}"></svg><p class="reading" id="s-lv${i}"></p><figcaption class="syn">Synthetic sequence: not historical, not a forecast.</figcaption>`;
    $('levers').appendChild(f);
    $('t-lv' + i).textContent = lv.title;
    $('s-lv' + i).textContent = 'Sam’s money ' + compare(lv.res, SAM);
  });
  const LV_MAX = Math.max(S.start, ...LEVERS.flatMap((lv) => lv.res.balances), ...SAM.balances);
  const before = (extra) => ({ key: 'before', name: 'Before', reading: short(SAM), pts: pts(SAM), dep: SAM.depletionYear, thin: true, ...extra });
  function drawLevers() {
    LEVERS.forEach((lv, i) => lineChart($('c-lv' + i), { compact: true, yMax: LV_MAX, height: (W) => W < 600 ? 240 : 250,
      series: [before({ reading: undefined }), { key: 'sam', name: 'With it', reading: short(lv.res), pts: pts(lv.res), dep: lv.res.depletionYear }] }));
  }
  const w = $('w'), wout = $('wout'), flex = $('flex'), buffer = $('buffer');
  w.min = String(Math.round(W0 * 0.6 / 1000) * 1000); w.max = String(Math.round(W0 * 1.6 / 1000) * 1000); w.step = '100'; w.value = String(W0);
  $('t-mix').textContent = 'Sam’s savings, before and with your changes';
  function drawMix() {
    const wv = Number(w.value), res = run(BAD, wv, { flex: flex.checked, buffer: buffer.checked });
    wout.textContent = money(wv); w.setAttribute('aria-valuetext', money(wv));
    lineChart($('c-mix'), { series: [before(), { key: 'sam', name: 'With changes', reading: short(res), pts: pts(res), dep: res.depletionYear }], height: (W) => W < 600 ? 300 : 400 });
    $('rv-mix').textContent = res.depletionYear ? 'Runs out in year ' + res.depletionYear : `Lasts all ${HZ} years`;
    $('rk-paid').textContent = `Paid out to him over the ${HZ} years`;
    $('rv-paid').textContent = money(total(res));
    $('s-mix').textContent = 'With these changes, Sam’s money ' + compare(res, SAM);
  }
  [w, flex, buffer].forEach((e) => { e.addEventListener('input', drawMix); e.addEventListener('change', drawMix); });

  // ---------- the RRIF lane ----------
  const rr = (order) => ({ off: run(order, W0), on: run(order, W0, { rrif: true }) });
  const downBefore = (order, t) => t > 0 && returnsOf(order)[t - 1] < 0;
  const forcedTotals = (order, res) => { let all = 0, down = 0; res.forced.forEach((f, t) => { all += f; if (downBefore(order, t)) down += f; }); return { all, down }; };
  const turns = MAT + 1, f0 = RRIF_F[RRIF_T0];
  // The one RRIF sentence used across the labs (redesign v2), from the facts: the factor for an age on January 1 applies in
  // the year you turn one more.
  const rrifRule = () => {
    const rows = FX.rrif.value.map((r) => ({ age: Number(r.age), factor: Number(r.factor) })).sort((a, b) => a.age - b.age);
    const first = rows.find((r) => r.age >= MAT), last = rows[rows.length - 1];
    return `At least ${pctF(first.factor)} must come out the year you turn ${first.age + 1}, rising to ${pctF(last.factor)} from the year you turn ${last.age + 1}`;
  };
  $('p-rrif').textContent = `Suppose all of Ruth’s and Sam’s savings are in a RRIF and they are ${S.startAge} when year 1 starts (an illustrative age). An RRSP must wind up by the end of the year its owner turns ${MAT} (most become a RRIF), and this sketch assumes theirs become a RRIF then. ${rrifRule()}. From year ${RRIF_T0 + 1}, the year they turn ${turns}, each year’s withdrawal is at least the balance at the start of that year times the factor for their age at the start of it (${pctF(f0)} at ${S.startAge + RRIF_T0}). When the minimum is more than they planned to take, the difference has to come out anyway, in good years and bad.`;
  const srcEl = $('p-rrif-src');
  srcEl.append('Sources: ');
  [FX.maturity, FX.rrif].forEach((f, i) => {
    const a = document.createElement('a'); a.href = f.source_url; a.textContent = f.title; srcEl.append(a, `, as of ${f.as_of}${i ? '.' : '; '}`);
  });
  const RR = { ruth: rr(GOOD), sam: rr(BAD) };
  const FT = { ruth: forcedTotals(GOOD, RR.ruth.on), sam: forcedTotals(BAD, RR.sam.on) };
  {
    const hit = ['ruth', 'sam'].filter((k) => FT[k].all > 0.5).map((k) => k === 'ruth' ? 'Ruth' : 'Sam');
    const miss = ['ruth', 'sam'].filter((k) => FT[k].all <= 0.5).map((k) => k === 'ruth' ? 'Ruth' : 'Sam');
    $('h-rrif').textContent = hit.length === 1 ? `From the year they turn ${turns}, the RRIF minimum forces money out of ${hit[0]}’s savings but not ${miss[0]}’s` : `What the RRIF minimum does to Ruth’s and Sam’s savings from the year they turn ${turns}`;
  }
  const rrifPanels = [{ key: 'ruth', name: 'Ruth', order: () => GOOD }, { key: 'sam', name: 'Sam', order: () => BAD }, { key: 'you', name: 'Your order', order: () => dealt }];
  rrifPanels.forEach((p) => {
    const f = document.createElement('figure'); f.className = 'fig small-multiple';
    f.innerHTML = `<p class="fig-title" id="t-rr-${p.key}"></p><svg id="c-rr-${p.key}" role="img" aria-labelledby="t-rr-${p.key} s-rr-${p.key}"></svg><p class="reading" id="s-rr-${p.key}"></p><figcaption class="syn">Synthetic sequence: not historical, not a forecast.</figcaption>`;
    $('rrif-panels').appendChild(f);
  });
  function rrifReading(name, order, r) {
    const ft = forcedTotals(order, r.on);
    if (ft.all <= 0.5) return `${name}: no change. The planned withdrawal is above the minimum every year, so the minimum never adds anything.`;
    return `${name}: the minimum takes out ${money(ft.all)} more than planned, ${money(ft.down)} of it in years that follow a down year. ` +
      `The RRIF ${r.on.depletionYear ? 'runs out in year ' + r.on.depletionYear : 'ends with ' + money(r.on.endBalance)}, against ${r.off.depletionYear ? 'running out in year ' + r.off.depletionYear : money(r.off.endBalance)} without the minimum.`;
  }
  function rrifChart(svg, key, name, order, r, on, yMax, fMax) {
    const W = widthOf(svg), narrow = W < 600, fs = narrow ? 11 : 12, top = narrow ? 250 : 270, bars = 64, gap = 28;
    const series = on
      ? [{ key, name: 'Without', reading: short(r.off), pts: pts(r.off), dep: r.off.depletionYear, thin: true, dash: true }, { key, name: 'With minimum', reading: short(r.on), pts: pts(r.on), dep: r.on.depletionYear }]
      : [{ key, name, reading: short(r.off), pts: pts(r.off), dep: r.off.depletionYear }];
    lineChart(svg, { compact: true, yMax, width: W, height: () => top + gap + bars, series, extra: (g, k) => {
      // shift the balance plot up: the bottom band holds the forced extra, one bar per year
      const by = k.y(0) + gap, bh = bars - 6, x = k.x, colW = (x(1) - x(0)) * 0.7;
      el('text', { x: k.L, y: by - 6, class: 'mono ax halo', 'font-size': 11 }, g, on ? (narrow ? 'Taken out because of the minimum' : 'Taken out beyond the plan because of the minimum') : 'Minimums off');
      el('line', { x1: k.L, x2: k.W - k.R, y1: by + bh, y2: by + bh, class: 'zero' }, g);
      if (on) r.on.forced.forEach((f, t) => {
        if (f <= 0.5) return;
        const h = f / fMax * (bh - 14);
        el('rect', { x: x(t + 0.5) - colW / 2, y: by + bh - h, width: colW, height: h, class: 'f-' + key + (downBefore(order, t) ? '' : ' light') }, g);
      });
      const tx = x(RRIF_T0);
      el('line', { x1: tx, x2: tx, y1: k.T, y2: by + bh, class: 'rule' }, g);
      el('text', { x: tx + 4, y: k.T + 10, class: 'mono ax halo', 'font-size': 11 }, g, `Turns ${turns}`);
    }, bottomPad: bars + gap });
  }
  function drawRrif() {
    const on = $('rrif').checked;
    const list = rrifPanels.map((p) => ({ ...p, ord: p.order(), r: p.key === 'you' ? (dealt && isFull() ? rr(dealt) : null) : RR[p.key] }));
    const yMax = Math.max(S.start, ...list.filter((p) => p.r).flatMap((p) => p.r.off.balances.concat(p.r.on.balances)));
    const fMax = Math.max(1, ...list.filter((p) => p.r).flatMap((p) => p.r.on.forced));
    for (const p of list) {
      $('t-rr-' + p.key).textContent = p.name + (p.key === 'you' ? '' : p.key === 'ruth' ? ': best years first' : ': worst years first');
      const svg = $('c-rr-' + p.key);
      if (!p.r) { svg.replaceChildren(); svg.removeAttribute('viewBox'); svg.setAttribute('height', 0); $('s-rr-' + p.key).textContent = 'Deal all ten cards above to add your order here.'; continue; }
      rrifChart(svg, p.key, p.name, p.ord, p.r, on, yMax, fMax);
      $('s-rr-' + p.key).textContent = on ? rrifReading(p.name, p.ord, p.r) : `${p.name}: ${short(p.r.off)} without the minimum. Apply the minimums to compare.`;
    }
    // the readout under the switch: the share of all orders that run out, with the minimums and without
    $('rk-rrif-on').textContent = `Orders that run out within ${HZ} years, with the minimums`;
    $('rk-rrif-off').textContent = on ? 'Without them' : `Orders that run out within ${HZ} years, no minimums`;
    $('rv-rrif-off').textContent = BASE ? share(BASE.total - BASE.lasts, BASE.total) : 'Counting…';
    $('rc-rrif-on').hidden = !on;
    if (!on) { $('s-rrif').textContent = 'Apply the minimums to run every order again with them.'; return; }
    if (!RRIF_SUM) {
      $('rv-rrif-on').textContent = 'Counting…';
      $('s-rrif').textContent = `Working out all ${intF.format(ORDERS)} orders with the minimums…`;
      Runner.start('rrif', { ...ENUM, minimumFactors: RRIF_F }, () => {}, (d) => { RRIF_SUM = d.summary; drawRrif(); });
      return;
    }
    if (!BASE) return;
    const a = BASE.total - BASE.lasts, b = RRIF_SUM.total - RRIF_SUM.lasts;
    $('rv-rrif-on').textContent = share(b, RRIF_SUM.total);
    $('s-rrif').textContent = `Across all ${intF.format(BASE.total)} orders, the RRIF is empty before the end of year ${HZ} in ${share(b, RRIF_SUM.total)} of them with the minimums, against ${share(a, BASE.total)} without. Orders that start well hold more money at ${turns}, so the minimum takes more from them.`;
  }
  $('rrif').addEventListener('change', drawRrif);

  // ---------- save the "your order" chart as an image, made in the browser ----------
  const STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linejoin', 'stroke-linecap', 'opacity', 'font-family', 'font-size', 'font-weight', 'paint-order', 'font-variant-numeric'];
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('save').addEventListener('click', () => {
    const WIDTH = 1200, box = document.createElement('div');
    box.className = 'offstage'; box.style.width = WIDTH + 'px';
    const svg = document.createElementNS(NS, 'svg'); box.appendChild(svg); document.body.appendChild(box);
    drawDeal(svg, WIDTH);
    const src = svg.querySelectorAll('*'), clone = svg.cloneNode(true), dst = clone.querySelectorAll('*');
    src.forEach((n, i) => { const cs = getComputedStyle(n); dst[i].setAttribute('style', STYLE_PROPS.map((p) => p + ':' + cs.getPropertyValue(p)).join(';')); dst[i].removeAttribute('class'); });
    const H = Number(svg.getAttribute('height')); box.remove();
    const root = getComputedStyle(document.documentElement), v = (k) => root.getPropertyValue(k).trim();
    let fonts = '';
    for (const sh of document.styleSheets) for (const rule of sh.cssRules) if (rule instanceof CSSFontFaceRule) fonts += rule.cssText;
    const d = new Date(), date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const pad = 40, head = 84, foot = 76, OW = WIDTH + pad * 2, OH = head + H + foot;
    const out = `<svg xmlns="${NS}" width="${OW}" height="${OH}" viewBox="0 0 ${OW} ${OH}"><style>${fonts}</style>` +
      `<rect width="${OW}" height="${OH}" fill="${v('--t-ground')}"/>` +
      `<text x="${pad}" y="56" fill="${v('--t-ink')}" style="font-family:${esc(v('--font-display'))};font-size:30px;font-weight:600">${esc($('t-deal').textContent)}</text>` +
      `<g transform="translate(${pad} ${head})">${clone.innerHTML}</g>` +
      `<text x="${pad}" y="${head + H + 32}" fill="${v('--t-ink2')}" style="font-family:${esc(v('--font-ui'))};font-size:16px">Synthetic sequence: not historical, not a forecast. No taxes, fees or benefits. Education only, not advice.</text>` +
      `<text x="${pad}" y="${head + H + 58}" fill="${v('--t-ink3')}" style="font-family:${esc(v('--font-mono'))};font-size:14px">The Order of Returns, Mohammed El Chayeb. Saved ${date}.</text></svg>`;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = OW * 2; c.height = OH * 2;
      const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
      c.toBlob((blob) => {
        const a = document.createElement('a'), u = URL.createObjectURL(blob);
        a.href = u; a.download = 'order-of-returns-your-order.png'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 1000);
        $('save-note').textContent = 'Saved order-of-returns-your-order.png, made in your browser.';
      }, 'image/png');
    };
    img.onerror = () => { $('save-note').textContent = 'This browser could not make the image.'; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out);
  });

  // ---------- first draw, and redraw when the width or the fonts change ----------
  function drawEverything() { drawLead(); drawShuffle(); drawDeal(); drawLevers(); drawMix(); drawRrif(); drawAll(); }
  hand = GOOD.slice(); dealt = [];
  deal(false); drawMix(); drawEverything();
  // The first fill is not a change: drop the underline the shared layer gives a readout whose text changes (its observer
  // runs first, in the same microtask queue), so only what the reader's own action changes is underlined.
  Promise.resolve().then(() => 0).then(() => document.querySelectorAll('[data-flash].flash').forEach((e) => e.classList.remove('flash')));
  let lastW = innerWidth, t;
  addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(t); t = setTimeout(drawEverything, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawEverything);
})();
