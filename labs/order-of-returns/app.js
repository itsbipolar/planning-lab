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
    buffer: words(S.bufferYears), orders: intF.format(ORDERS), after: String(N + 1), nWords: words(N), horizon: String(HZ),
  };
  document.querySelectorAll('[data-v]').forEach((e) => { e.textContent = fill[e.dataset.v]; });

  // ---------- drawing helpers ----------
  const NS = 'http://www.w3.org/2000/svg';
  // The one size rule (redesign v2): every piece of chart text is drawn at TXT px or more, at real pixel size (each chart
  // is drawn at its container's width, viewBox = width), so nothing is scaled down on a phone.
  const TXT = 17.5;
  const el = (name, attrs, parent, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) if (attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const mctx = document.createElement('canvas').getContext('2d');
  // text is measured in the face the page really draws it in (the desk's tokens, read from the page's own CSS)
  const face = () => getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() || 'sans-serif';
  const tw = (s, size, weight = 400) => {
    mctx.font = weight + ' ' + size + 'px ' + face(false);
    return mctx.measureText(s).width;
  };
  // A line of text's real box at a size: the font's ascent above the baseline and descent below it (what the browser
  // gives an SVG text element), so stacked lines are spaced by the face's own metrics rather than by a guessed gap.
  const vm = (size, weight = 400) => {
    mctx.font = weight + ' ' + size + 'px ' + face();
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
    const fs = TXT, lfs = narrow ? TXT : TXT + 1, rfs = TXT;
    // stacked label lines: the name (bold) then its reading, each in its real box, one pixel of air between boxes
    const mN = vm(lfs, 700), mR = vm(rfs), mF = vm(fs, 600), mT = vm(fs), air = 1;
    const H = cfg.height ? cfg.height(W) : narrow ? 340 : Math.round(Math.min(520, Math.max(380, W * 0.3)));
    setup(svg, W, H);
    let max = cfg.yMax || 0; if (!cfg.yMax) for (const s of cfg.series) for (const v of s.pts) max = Math.max(max, v);
    const ys = yScale(max, narrow || cfg.compact ? 3 : 4);
    const tickLabs = []; for (let g = 0; g <= ys.max + 1e-6; g += ys.step) tickLabs.push(g);
    const L = Math.ceil(Math.max(...tickLabs.map((g) => tw(kfmt(g), fs)))) + 10;
    const labelled = cfg.series.filter((s) => s.name);
    const full = (s) => s.upto === undefined || s.upto >= HZ;
    // the labels go in a gutter on the right; on narrow and small charts their words wrap to keep the gutter slim
    const gutMax = tight ? (narrow ? 92 : 110) : 400;
    // on a phone "Lasts N years" reads "N years" under its name, so a reading keeps to one line in the slim gutter
    const said = (r) => (narrow ? r.replace(/^Lasts (\d+ years?)$/, '$1') : r);
    for (const s of labelled) { s.nameLines = wrap(s.name, gutMax, lfs, 700); s.readLines = s.reading ? wrap(said(s.reading), gutMax, rfs, 400) : []; }
    const gut = Math.ceil(Math.max(0, ...labelled.filter(full).flatMap((s) => s.nameLines.map((l) => tw(l, lfs, 700)).concat(s.readLines.map((l) => tw(l, rfs)))))) + 22;
    const B = 34 + (cfg.bottomPad || 0), R = gut;
    const x = (t) => L + t / HZ * (W - L - R);
    // the band's two labels sit above the plot: on one row when the first fits inside the band, else on two rows
    let T = 14, band = null;
    if (cfg.band) {
      const a = narrow ? 'Dealt years' : 'The ' + words(N) + ' dealt years', b = narrow ? 'Then ' + pct1(AVG) + ' a year' : 'Then the ' + pct1(AVG) + ' average, every year';
      const one = tw(a, fs) + 16 <= x(N) - x(0);
      band = { a, b, ya: 2 + mT.asc, yb: one ? 2 + mT.asc : 2 + mT.h + 2 + mT.asc };
      T = (one ? mT.h : mT.h * 2 + 2) + 10;
    }
    const y = (v) => T + (1 - v / ys.max) * (H - T - B);
    const g0 = el('g', {}, svg);
    if (band) {
      el('rect', { x: x(0), y: T, width: x(N) - x(0), height: y(0) - T, class: 'band' }, g0);
      el('text', { x: x(0) + 6, y: band.ya, class: 'ax', 'font-size': fs }, g0, band.a);
      el('text', { x: x(N) + 6, y: band.yb, class: 'ax', 'font-size': fs }, g0, band.b);
    }
    for (const g of tickLabs) {
      el('line', { x1: L, x2: W - R, y1: y(g), y2: y(g), class: g === 0 ? 'zero' : 'grid' }, g0);
      el('text', { x: L - 8, y: y(g) + mT.asc / 2 - 2, 'text-anchor': 'end', class: 'ax', 'font-size': fs }, g0, kfmt(g));
    }
    // year ticks: "Year 10" when there is room, bare numbers and a "years" note in the gutter when there is not
    const tickY = H - 10, roomy = x(5) - x(0) > tw('Year ' + HZ, fs) + 12;
    for (let t = 0; t <= HZ; t += 5) el('text', { x: x(t), y: tickY, 'text-anchor': t === 0 && roomy ? 'start' : 'middle', class: 'ax', 'font-size': fs }, g0, roomy ? (t === 0 ? 'Start' : 'Year ' + t) : String(t));
    if (!roomy) el('text', { x: x(HZ) + 14, y: tickY, class: 'ax', 'font-size': fs }, g0, 'years');
    if (cfg.extra) cfg.extra(g0, { x, y, W, H, T, B, L, R, fs });
    const gl = el('g', {}, svg), gd = el('g', {}, svg), gt = el('g', {}, svg);
    for (const s of cfg.series) {
      const upto = s.upto === undefined ? s.pts.length - 1 : s.upto;
      const d = s.pts.slice(0, upto + 1).map((v, t) => (t ? 'L' : 'M') + x(t).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
      el('path', { d, class: 'ln s-' + s.key + (s.thin ? ' thin' : '') + (s.dash ? ' dash' : '') + (s.faint ? ' faint' : '') }, gl);
      if (s.dep && s.dep <= upto) el('circle', { cx: x(s.dep), cy: y(0), r: s.thin ? 4 : 5.5, class: 'dot f-' + s.key }, gd);
    }
    // readings at the end of the dealt years
    if (cfg.readAt) {
      // each reading sits just above and right of its dot, clear of the line that falls away after it
      const rs = cfg.series.filter((s) => (s.upto === undefined || s.upto >= cfg.readAt) && !s.thin).map((s) => ({ s, v: s.pts[cfg.readAt], want: y(s.pts[cfg.readAt]) - mF.h / 2 - 3, size: mF.h }));
      spread(rs, T + 2, y(0) - 2, 2);
      for (const r of rs) {
        el('circle', { cx: x(cfg.readAt), cy: y(r.v), r: 3.5, class: 'f-' + r.s.key }, gd);
        el('text', { x: x(cfg.readAt) + 8, y: r.pos - mF.h / 2 + mF.asc, class: 'halo t-' + r.s.key, 'font-size': fs, 'font-weight': 600 }, gt, money(r.v));
      }
    }
    // the series labels: in the gutter at the height of their line's end, spread so they never overlap, with a leader
    // when they had to move; a path that stops early (a partly dealt order) is labelled at its end instead, its words
    // wrapped to the room left before the gutter
    const blocks = labelled.map((s) => {
      const upto = s.upto === undefined ? s.pts.length - 1 : s.upto;
      if (!full(s)) {
        const room = Math.max(60, W - R - x(upto) - 14);
        s.nameLines = wrap(s.name, room, lfs, 700); s.readLines = s.reading ? wrap(said(s.reading), room, rfs, 400) : [];
      }
      const lines = s.nameLines.length + s.readLines.length;
      const size = s.nameLines.length * mN.h + s.readLines.length * mR.h + (lines - 1) * air;
      return { s, upto, end: y(s.pts[upto]), size, want: y(s.pts[upto]) };
    });
    const gutter = blocks.filter((b) => full(b.s)), over = blocks.filter((b) => !full(b.s));
    over.forEach((b) => { b.want = b.end - b.size / 2 - 8; });
    // the gutter's floor: above the year ticks' row by their ascent and a little air, so the last label never sits on
    // "Year 25" or the "years" note; its ceiling: below the band's labels
    spread(gutter, band ? T : Math.max(4, T - 10), Math.min(H - B + 8, tickY - mT.asc - 3), 6);
    spread(over, T, y(0) - 6, 4);
    for (const b of blocks) {
      const inGut = gutter.includes(b), ex = x(b.upto), tx = inGut ? W - R + 14 : ex + 8;
      const top = b.pos - b.size / 2;
      if (inGut && Math.abs(b.pos - b.end) > 3) el('path', { d: `M${ex + 3} ${b.end}L${ex + 6} ${b.end}L${tx - 4} ${b.pos}`, class: 'leader' }, gt);
      // each line's box starts where the one above ends (plus the air); its baseline sits its ascent below that
      let ly = top;
      for (const l of b.s.nameLines) { el('text', { x: tx, y: ly + mN.asc, class: 'halo t-' + b.s.key, 'font-size': lfs, 'font-weight': 700 }, gt, l); ly += mN.h + air; }
      for (const l of b.s.readLines) { el('text', { x: tx, y: ly + mR.asc, class: 'halo t-ink2', 'font-size': rfs }, gt, l); ly += mR.h + air; }
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

  // ---------- Ruth and Sam ----------
  const ruthS = (res = RUTH, extra = {}) => ({ key: 'ruth', name: 'Ruth', reading: short(res), pts: pts(res), dep: res.depletionYear, ...extra });
  const samS = (res = SAM, extra = {}) => ({ key: 'sam', name: 'Sam', reading: short(res), pts: pts(res), dep: res.depletionYear, ...extra });
  // the question (built into the page from story.json)
  $('headline').textContent = `Same ${words(N)} years. Why does one retiree run out?`;
  // "lasts N years" (whole years paid in full) and "runs out in year N + 1" said together, so the chart's reading and the
  // dot on the year axis agree with the words
  const fate = (name, res) => res.depletionYear ? `${name}’s money lasts ${yrs(yearsLasted(res.depletionYear, HZ))} and runs out in year ${res.depletionYear}` : `${name} still has ${money(res.endBalance)} after ${HZ} years`;

  // ---------- the deal: ten face-down cards, the answer beside them (redesign v2, step 4) ----------
  // The answer reads the sorted-outcome distribution written at build for the story (enumerate.mjs distribution()), so it
  // is there at once; "lasts" counts whole years paid in full, capped at the horizon, so many orders tie and the share
  // says "at least as long as".
  const DIST = JSON.parse($('dist').textContent);
  const lastedOf = (res) => yearsLasted(res.depletionYear || 0, HZ);
  const yrs = (n) => n + (n === 1 ? ' year' : ' years');
  const lastsPhrase = (res) => res.depletionYear ? `lasts ${yrs(lastedOf(res))}` : `lasts all ${HZ} years`;
  let order = null, shown = 0, dealt = [], deals = 0, longest = null, shortest = null, guess = null;
  const isFull = () => dealt.length === N;
  const youRes = () => run(dealt, W0);
  const deckEl = $('deck-cards'), dealBtn = $('deal'), oneBtn = $('one');
  const cardEls = Array.from({ length: N }, (_, i) => {
    const li = document.createElement('li'); li.className = 'card';
    li.innerHTML = '<span class="card-in" aria-hidden="true"><span class="card-back"></span><span class="card-face"></span></span><span class="sr"></span>';
    li.querySelector('.card-back').textContent = String(i + 1);
    deckEl.appendChild(li); return li;
  });
  function paintCards(stagger) {
    cardEls.forEach((li, i) => {
      const up = i < shown, v = order ? order[i] : null;
      li.querySelector('.card-face').textContent = v === null ? '' : card(v);
      li.classList.toggle('neg', v !== null && v < 0);
      li.querySelector('.card-in').style.transitionDelay = stagger ? (i * 40) + 'ms' : '';
      li.classList.toggle('up', up);
      li.querySelector('.sr').textContent = `Year ${i + 1}: ` + (up ? card(v) : 'face down');
    });
  }
  // a new order: every card back face down at once, then dealt
  function newOrder() {
    const o = S.cards.slice();
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    order = o; shown = 0;
    deckEl.classList.add('instant'); cardEls.forEach((li) => li.classList.remove('up')); void deckEl.offsetWidth; deckEl.classList.remove('instant');
  }

  const answer = deskReadout('#answer', { format: (n) => yrs(Math.round(n)) });
  // the guess asks for the share of orders that last the full horizon, so while it waits that share is not given away
  let guessOpen = true;
  const shareLine = (res) => {
    const y = lastedOf(res);
    if (!res.depletionYear && guessOpen) return `It lasts the full ${HZ} years. What share of orders do? Guess below.`;
    if (!res.depletionYear) return `Like ${share(DIST.lasts, DIST.total)} of all ${intF.format(DIST.total)} orders, it lasts the full ${HZ} years.`;
    return `It lasts at least as long as ${share(atLeastAsLong(DIST, y), DIST.total)} of all ${intF.format(DIST.total)} orders.`;
  };
  const startLine = `Ruth’s order ${lastsPhrase(RUTH)}. Sam’s ${lastsPhrase(SAM)}.`;
  function drawDeal(svg = $('c-deal'), width) {
    // before a deal Ruth and Sam are the story, drawn at full weight; once there is an order, they step back for it
    const ctx = dealt.length ? { thin: true, faint: true } : {};
    const series = [ruthS(RUTH, ctx), samS(SAM, { ...ctx, reading: lastsPhrase(SAM).replace(/^l/, 'L') })];
    if (dealt.length) {
      const r = youRes(), k = dealt.length;
      series.push({ key: 'you', name: 'This order', reading: isFull() ? (r.depletionYear ? lastsPhrase(r).replace(/^l/, 'L') : short(r)) : money(r.balances[k - 1]) + ' after year ' + k, pts: pts(r), dep: r.depletionYear, upto: isFull() ? undefined : k });
    }
    const live = svg.id === 'c-deal';
    if (live) dropCross(svg);
    const g = lineChart(svg, { series, band: true, width });
    if (live) addCross(svg, g);
  }
  function dealText() {
    const r = youRes(), k = dealt.length;
    $('t-deal').textContent = isFull() ? (r.depletionYear ? `This order lasts ${lastedOf(r)} years, between Ruth’s and Sam’s` : `This order lasts all ${HZ} years, with ${money(r.endBalance)} left`)
      : k ? `This order so far: ${k} of ${N} years dealt` : `Ruth’s and Sam’s paths split in the first ${words(N)} years`;
    $('sub-deal').textContent = k ? 'Savings at the end of each year: Ruth, Sam and this order (amber)' : 'Savings at the end of each year: Ruth and Sam';
    $('s-deal').textContent = `After the ${words(N)} dealt years Ruth has ${money(RUTH.balances[N - 1])} and Sam ${money(SAM.balances[N - 1])}. ${fate('Ruth', RUTH)}; ${fate('Sam', SAM)}.` +
      (isFull() ? ` This order: ${r.depletionYear ? 'the money runs out in year ' + r.depletionYear : money(r.endBalance) + ' left after ' + HZ + ' years'}.` : '');
  }

  // the strip: how every order ends, shortest to longest, this order's bar in amber
  const stripBars = () => DIST.strip.byYear.concat(DIST.strip.left.counts);
  function drawStrip() {
    const svg = $('c-strip'), W = Math.max(240, Math.floor(svg.parentNode.getBoundingClientRect().width)), fs = TXT, mt = vm(fs);
    const bars = stripBars(), nDep = DIST.strip.byYear.length, max = Math.max(...bars), barH = 64, H = barH + 8 + mt.h + 4;
    setup(svg, W, H);
    const gapX = 10, unit = (W - gapX) / bars.length, bw = Math.max(3, unit - 3);
    const bx = (i) => i * unit + (i >= nDep ? gapX : 0);
    const mine = isFull() ? (() => { const o = outcome(youRes()); return stripBar(DIST, o.dep, o.value); })() : -1;
    bars.forEach((c, i) => {
      const h = Math.max(c ? 2 : 0, c / max * barH);
      el('rect', { x: bx(i), y: barH - h, width: bw, height: h, class: i === mine ? 'f-you' : 'bar strip-bar' }, svg);
    });
    el('line', { x1: 0, x2: W, y1: barH + 0.5, y2: barH + 0.5, class: 'zero' }, svg);
    const ty = barH + 6 + mt.asc;
    el('text', { x: 0, y: ty, class: 'ax', 'font-size': fs }, svg, 'Runs out sooner');
    el('text', { x: W, y: ty, 'text-anchor': 'end', class: 'ax', 'font-size': fs }, svg, 'Lasts longer');
    $('strip-k').textContent = isFull() ? `This order (amber) among all ${intF.format(DIST.total)}` : `How all ${intF.format(DIST.total)} orders end`;
    const first = DIST.strip.firstYear;
    $('strip-s').textContent = `Bars: orders that run out in year ${first} to ${HZ}, then orders that last, by money left in steps of ${money(DIST.strip.left.step)}.` +
      (mine >= 0 ? ` This order is in bar ${mine + 1} of ${bars.length}.` : '');
  }
  function drawTally() {
    const t = $('tally');
    t.hidden = !deals;
    if (deals) t.textContent = `Deals ${intF.format(deals)} · Longest ${yrs(longest)} · Shortest ${yrs(shortest)}`;
  }

  function showDeal(stagger) {
    dealt = order ? order.slice(0, shown) : [];
    paintCards(stagger);
    drawDeal(); dealText(); drawStrip();
    if (!dealt.length) { answer.set({ text: '?', label: 'This order lasts', line: startLine }); }
    else if (!isFull()) {
      const r = youRes(), k = dealt.length;
      answer.set({ text: '?', label: 'This order lasts', line: `${k} of ${N} dealt: ${money(r.balances[k - 1])} after year ${k}.` });
    } else {
      const r = youRes(), y = lastedOf(r);
      deals++; longest = longest === null ? y : Math.max(longest, y); shortest = shortest === null ? y : Math.min(shortest, y);
      answer.set({ n: y, label: 'This order lasts', line: shareLine(r) });
      dealBtn.textContent = 'Deal again';
      $('save-row').hidden = false;
      if (guess) guess.show();
      // while the guess waits, the strip of how every order ends (which would give the share away) steps aside
      $('strip-box').hidden = guessOpen;
    }
    drawTally();
    youChanged();
  }
  dealBtn.addEventListener('click', () => { newOrder(); shown = N; showDeal(true); });
  oneBtn.addEventListener('click', () => { if (!order || shown === N) newOrder(); shown++; showDeal(false); });

  // the optional bridge after the first deal: a guess, then the share, always skippable
  guess = deskGuess('#guess', {
    question: `What share of all orders last the full ${HZ} years?`, min: 0, max: 100, step: 1, start: 50,
    format: (v) => v + '%', answer: () => DIST.lasts / DIST.total * 100,
    reveal: (g) => `${share(DIST.lasts, DIST.total)}. You guessed ${g}%.`,
    // once answered or skipped, a full-length deal on screen gets its share line back
    onDone: () => { guessOpen = false; $('strip-box').hidden = false; drawStrip(); if (isFull()) $('answer-t').textContent = shareLine(youRes()); },
  });

  // Save my card: the dealt result as a 1080x1350 PNG drawn in this browser (deskCard), shared or downloaded
  deskSaveButton($('save'), () => {
    const r = youRes(), cs = getComputedStyle(document.documentElement), c = (k) => cs.getPropertyValue(k).trim();
    return deskCard({
      question: $('headline').textContent, bigValue: $('answer-v').textContent, line: $('answer-t').textContent,
      labels: [r.depletionYear ? `Runs out in year ${r.depletionYear}` : `${money(r.endBalance)} left`, 'Made-up returns'],
      draw: (ctx, box, C) => {
        const all = [RUTH, SAM, r], max = Math.max(S.start, ...all.flatMap((x) => x.balances));
        const X = (t) => box.x + t / HZ * box.w, Y = (v) => box.y + box.h - v / max * box.h;
        ctx.fillStyle = C.raised; ctx.fillRect(X(0), box.y, X(N) - X(0), box.h);
        ctx.fillStyle = C.ink; ctx.fillRect(box.x, box.y + box.h, box.w, 2);
        [[RUTH, c('--t-d1'), 4], [SAM, c('--t-d4'), 4], [r, C.point, 9]].forEach(([res, colour, lw]) => {
          ctx.strokeStyle = colour; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
          pts(res).forEach((v, t) => (t ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v)))); ctx.stroke();
        });
      },
    }).then((blob) => ({ blob, name: 'order-of-returns-my-card.png', title: $('headline').textContent }));
  });

  // "How this is worked out", from the story and the distribution
  $('how-1').textContent = `Each order starts with ${money(S.start)} and takes out ${money(W0)} in the first year, ${pctF(S.indexation)} more each year after. The ${words(N)} cards (${S.cards.map(card).join(', ')}) average ${pct1(AVG)}; from year ${N + 1} to year ${HZ}, every year earns that average. Ruth gets the cards best first, Sam worst first.`;
  $('how-2').textContent = `A year counts when its whole withdrawal is paid, up to ${HZ}. Counted in whole years, many orders tie, so the share counts every order that lasts no longer than this one. It comes from all ${intF.format(DIST.total)} orders, worked out with the same engine when the page was built.`;

  // ---------- shuffle with no withdrawals ----------
  let samOrder = BAD.slice();
  const ZERO_END = run(GOOD, 0).endBalance;
  $('h-shuffle').textContent = `With nothing taken out, every order ends with ${money(ZERO_END)}`;
  $('t-shuffle').textContent = Math.round(run(BAD, 0).endBalance) === Math.round(ZERO_END) ? 'Shuffled or not, the two lines end at the same amount' : 'Ruth’s order and Sam’s shuffled order';
  let shuffles = 0;
  function drawShuffle() {
    const r = run(GOOD, 0), s = run(samOrder, 0);
    lineChart($('c-shuffle'), { series: [ruthS(r), samS(s, { reading: money(s.endBalance) + ' left' })], band: true, height: (W) => W < 600 ? 280 : 340 });
    // the readout under the button: Sam's ending, what it means, and the order he got this time
    const same = Math.round(s.endBalance) === Math.round(r.endBalance);
    $('rk-shuffle').textContent = 'Sam’s ending, nothing taken out';
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

  // ---------- why: the share that last, by the first five years (the full heat strip's top row) ----------
  function whyChart() {
    const svg = $('c-why'), W = widthOf(svg), narrow = W < 600, fs = TXT, lfs = TXT + 1, mt = vm(fs), ml = vm(lfs, 700);
    const gs = DIST.groups, lo = gs[0].avg, hi = gs[gs.length - 1].avg, minCw = tw('100%', fs) + 8;
    const yLab = (p) => Math.round(p * 100) + '%';
    const L = Math.ceil(tw(yLab(1), fs)) + 10, R = 4;
    const ncOf = (bw) => Math.floor(hi / bw + 1e-9) - Math.floor(lo / bw + 1e-9) + 1;
    let bw = niceStep((hi - lo) / 14);
    while (ncOf(bw) * minCw > W - L - R) bw = niceStep(bw * 1.01);
    const c0 = Math.floor(lo / bw + 1e-9), c1 = Math.floor(hi / bw + 1e-9), nc = c1 - c0 + 1;
    const cols = Array.from({ length: nc }, () => ({ n: 0, lasts: 0 }));
    // one rounding for the bars' labels and the sentence under the chart
    const colPct = (c) => { const p = c.lasts / c.n; return p > 0 && p < 0.005 ? 'under 1%' : Math.round(p * 100) + '%'; };
    const colOf = (avg) => Math.floor(avg / bw + 1e-9) - c0;
    for (const g of gs) { const c = cols[colOf(g.avg)]; c.n += g.n; c.lasts += g.lasts; }
    const T = mt.h + 4 + ml.h + 14 + mt.h + 6, plotH = narrow ? 180 : 240, B = 8 + mt.h + 10 + mt.h + 6, H = T + plotH + B;
    setup(svg, W, H);
    const cw = (W - L - R) / nc, cx = (i) => L + i * cw, y = (p) => T + (1 - p) * plotH, base = y(0);
    for (const p of [0, 0.5, 1]) {
      el('line', { x1: L, x2: W - R, y1: y(p), y2: y(p), class: p === 0 ? 'zero' : 'grid' }, svg);
      el('text', { x: L - 8, y: y(p) + mt.asc / 2 - 2, 'text-anchor': 'end', class: 'ax', 'font-size': fs }, svg, yLab(p));
    }
    const ms = marks().map((m) => ({ m, col: colOf(m.f5) })), markedCols = new Set(ms.map((x) => x.col));
    const vals = [];
    cols.forEach((c, i) => {
      if (!c.n) return;
      const p = c.lasts / c.n, top = y(p), you = ms.some((x) => x.m.key === 'you' && x.col === i);
      el('rect', { x: cx(i) + 2, y: top, width: Math.max(1, cw - 4), height: Math.max(0, base - top), class: you ? 'f-you' : 'bar' }, svg);
      const t = colPct(c).replace('under ', '<'), w = tw(t, fs);
      vals.push({ i, t, p, x0: cx(i) + cw / 2 - w / 2, x1: cx(i) + cw / 2 + w / 2, prio: (markedCols.has(i) ? 2 : 0) + p });
    });
    // the columns left of the "all run out" rule say so in one annotation, so they carry no "0%" of their own
    let allOut = -1; for (let i = 0; i < nc; i++) { if (cols[i].n && cols[i].lasts > 0) break; allOut = i; }
    for (const v of thin(vals.filter((v) => v.i > allOut), 4)) el('text', { x: cx(v.i) + cw / 2, y: y(v.p) - 6, 'text-anchor': 'middle', class: 'ax val', 'font-size': fs }, svg, v.t);
    // x ticks at whole-number averages, thinned to fit, and the axis title
    const tickStep = niceStep(bw * Math.max(1, Math.ceil((tw('−10%', fs) + 12) / cw)));
    for (let v = Math.ceil(c0 * bw / tickStep - 1e-9) * tickStep; v <= (c1 + 1) * bw + 1e-9; v += tickStep) {
      const px = L + (v / bw - c0) * cw, t = minus(String(Math.round(v * 100))) + '%', w = tw(t, fs);
      if (px - w / 2 < L - 2) continue; // clear of the 0% label on the axis
      el('line', { x1: px, x2: px, y1: base, y2: base + 5, class: 'zero' }, svg);
      el('text', { x: Math.min(W - w / 2, px), y: base + 8 + mt.asc, 'text-anchor': 'middle', class: 'ax', 'font-size': fs }, svg, t);
    }
    const gt = 'Average return of the first five years', gw = tw(gt, fs, 600);
    el('text', { x: Math.max(gw / 2, Math.min(W - gw / 2, L + (W - L - R) / 2)), y: H - 6, 'text-anchor': 'middle', class: 'ax grp', 'font-size': fs, 'font-weight': 600 }, svg, gt);
    // the one annotation: the rule left of which every order runs out, then the names over their columns
    const all = ms.map((x) => ({ ...x, want: cx(x.col) + cw / 2, size: tw(x.m.name, lfs, 700) + 8 }));
    if (allOut >= 0) { const t = narrow ? 'All run out' : 'Every order left of here runs out'; all.push({ rule: true, want: cx(allOut + 1), size: tw(t, fs, 600) + 8, t }); }
    spread(all, 0, W - R, 6);
    const emptyStack = {};
    const ruleY = 2 + mt.asc, nameY = 2 + mt.h + 4 + ml.asc, nameBottom = nameY + ml.h - ml.asc;
    for (const it of all) {
      if (it.rule) {
        const px = cx(allOut + 1);
        el('line', { x1: px, x2: px, y1: ruleY + 6, y2: base, class: 'rule' }, svg);
        el('text', { x: it.pos, y: ruleY, 'text-anchor': 'middle', class: 'ax halo', 'font-size': fs, 'font-weight': 600 }, svg, it.t);
        continue;
      }
      const c = cols[it.col], top = y(c.lasts / c.n) - mt.h - 6;
      // a name over a column with no bar sits just above the axis, under its column, with no leader across the grid
      // names that share an empty column stack upwards instead of sitting on top of each other
      if (!c.lasts) { const k = (emptyStack[it.col] = (emptyStack[it.col] || 0) + 1) - 1; el('text', { x: cx(it.col) + cw / 2, y: base - 8 - (ml.h - ml.asc) - k * (ml.h + 4), 'text-anchor': 'middle', class: 'halo t-' + it.m.key, 'font-size': lfs, 'font-weight': 700 }, svg, it.m.name); continue; }
      el('text', { x: it.pos, y: nameY, 'text-anchor': 'middle', class: 'halo t-' + it.m.key, 'font-size': lfs, 'font-weight': 700 }, svg, it.m.name);
      el('path', { d: `M${it.pos} ${nameBottom + 2}L${it.pos} ${nameBottom + 6}L${cx(it.col) + cw / 2} ${Math.min(top, T - 2)}L${cx(it.col) + cw / 2} ${top}`, class: 'leader s-' + it.m.key }, svg);
    }
    const ruthCol = cols[colOf(first5(GOOD))], samCol = cols[colOf(first5(BAD))];
    let a = null; for (const g of gs) { if (g.lasts > 0) break; a = g.avg; }
    $('s-why').textContent = (a !== null ? `Every order whose first five years average ${pct1(a)} or less runs out within ${HZ} years. ` : '') +
      `In Ruth’s column ${colPct(ruthCol)} of orders last; in Sam’s, ${colPct(samCol)}. All ${words(N)} years average ${pct1(AVG)} in every order.`;
  }

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
    if (dealt && isFull()) m.push({ key: 'you', name: 'This order', o: outcome(youRes()), f5: first5(dealt) });
    return m;
  };

  // The two charts of every order are drawn once the count is done; until then each keeps its height and says what it is
  // waiting for, so the page never shows an empty box.
  const histH = (W) => W < 600 ? 380 : 440;
  const heatGeom = (W, y0) => { const narrow = W < 600, T = 112, ch = narrow ? 28 : 32, B = 64; return { T, ch, B, H: T + ch * (HZ - y0 + 2) + B }; };
  function waiting(svg, H) {
    const W = widthOf(svg), narrow = W < 600;
    setup(svg, W, H);
    el('rect', { x: 0, y: 0, width: W, height: H, class: 'band' }, svg);
    el('text', { x: W / 2, y: H / 2 + 5, 'text-anchor': 'middle', class: 'ax val', 'font-size': narrow ? TXT : TXT + 1 }, svg, `Counting all ${intF.format(ORDERS)} orders…`);
  }
  function drawWaiting() {
    if (BASE) return;
    waiting($('c-all'), histH(widthOf($('c-all'))));
    waiting($('c-early'), heatGeom(widthOf($('c-early')), SAM.depletionYear || HZ).H);
  }

  // Keeps the labels that fit on one row: items [{ x0, x1, prio }] (higher prio first); a label is kept when it clears every
  // label kept before it by `gap`. Returns the kept items.
  function thin(items, gap) {
    const kept = [];
    for (const it of items.slice().sort((a, b) => b.prio - a.prio)) if (kept.every((k) => it.x1 + gap <= k.x0 || k.x1 + gap <= it.x0)) kept.push(it);
    return kept;
  }

  function histChart(sum) {
    const svg = $('c-all'), W = widthOf(svg), narrow = W < 600, fs = TXT, lfs = TXT + 1, mt = vm(fs), mg = vm(fs, 600), ml = vm(lfs, 700);
    const H0 = histH(W), y0 = firstYear(sum), nDep = HZ - y0 + 1;
    const buckets = [];
    for (let d = y0; d <= HZ; d++) buckets.push(sum.byYear[d]);
    for (const c of sum.left.counts) buckets.push(c);
    const yMax = yScale(Math.max(...buckets) / sum.total, 4);
    const pl = (p) => Math.round(p * 100) + '%';
    const L = Math.ceil(tw(pl(yMax.max), fs)) + 10, R = 4;
    const unit = (W - L - R) / (buckets.length + 0.8), bw = unit * 0.8;
    const bx = (i) => L + i * unit + (i >= nDep ? 0.8 * unit : 0) + (unit - bw) / 2;
    // the two group names under the axis: on one row when they fit side by side, else on two
    const gA = narrow ? 'Runs out in year' : 'The money runs out in year', gB = narrow ? 'Lasts: left at the end' : `Lasts all ${HZ} years: money left at the end`;
    const wA = tw(gA, fs, 600), wB = tw(gB, fs, 600);
    const mid1 = (bx(0) + bx(nDep - 1) + bw) / 2, mid2 = (bx(nDep) + bx(buckets.length - 1) + bw) / 2;
    const cA = Math.max(L + wA / 2, mid1), cB = Math.min(W - R - wB / 2, mid2), oneRow = cA + wA / 2 + 16 <= cB - wB / 2;
    const T = ml.h + 40, B = 12 + mt.h + 8 + mg.h * (oneRow ? 1 : 2) + 6;
    const H = H0 + (oneRow ? 0 : mg.h);
    setup(svg, W, H);
    const y = (p) => T + (1 - p / yMax.max) * (H - T - B);
    for (let p = 0; p <= yMax.max + 1e-9; p += yMax.step) {
      el('line', { x1: L, x2: W - R, y1: y(p), y2: y(p), class: p === 0 ? 'zero' : 'grid' }, svg);
      el('text', { x: L - 8, y: y(p) + mt.asc / 2 - 2, 'text-anchor': 'end', class: 'ax', 'font-size': fs }, svg, pl(p));
    }
    const ms = marks().map((m) => ({ ...m, b: bucketOf(sum, m.o) }));
    const gb = el('g', {}, svg);
    buckets.forEach((c, i) => {
      const p = c / sum.total, top = y(p);
      el('rect', { x: bx(i), y: top, width: bw, height: Math.max(0, y(0) - top), class: 'bar' }, gb);
    });
    // each bar's share above it where there is room: the marked bars first, then the tallest; the rest are in the table
    const valText = (p) => narrow ? (p === 0 ? '0' : p < 0.01 ? '<1%' : Math.round(p * 100) + '%') : (p === 0 ? '0' : p < 0.001 ? '<0.1%' : (Math.round(p * 1000) / 10).toFixed(1) + '%');
    const markedBars = new Set(ms.map((m) => m.b));
    const vals = buckets.map((c, i) => { const t = valText(c / sum.total), w = tw(t, fs), cx = bx(i) + bw / 2; return { i, t, x0: cx - w / 2, x1: cx + w / 2, prio: (markedBars.has(i) ? 2 : 0) + c / sum.total }; });
    for (const v of thin(vals, 4)) el('text', { x: bx(v.i) + bw / 2, y: y(buckets[v.i] / sum.total) - 7, 'text-anchor': 'middle', class: 'ax val', 'font-size': fs }, gb, v.t);
    for (const m of ms) el('rect', { x: bx(m.b) - 2.5, y: y(buckets[m.b] / sum.total) - 2.5, width: bw + 5, height: y(0) - y(buckets[m.b] / sum.total) + 5, class: 'mark s-' + m.key }, gb);
    // ticks under the axis: the years, then the money-left bin edges, thinned so none collide
    const ty = y(0) + 6 + mt.asc, ticks = [];
    const yearEvery = [1, 2, 5].find((k) => k * unit >= tw(String(HZ), fs) + 8) || 5;
    for (let i = 0; i < nDep; i++) if ((y0 + i) % yearEvery === 0 || yearEvery === 1) { const t = String(y0 + i), cx = bx(i) + bw / 2, w = tw(t, fs); ticks.push({ t, cx, x0: cx - w / 2, x1: cx + w / 2, prio: 1 - i / 1000 }); }
    const edge = (k) => bx(nDep + k) - (unit - bw) / 2;
    const nLeft = sum.left.counts.length, lw = tw(kfmt(sum.left.step * nLeft), fs) + 8, every = Math.max(1, Math.ceil(lw / unit));
    for (let k = 0; k <= nLeft; k += every) { const t = kfmt(sum.left.step * k), cx = k === nLeft ? edge(k - 1) + unit : edge(k), w = tw(t, fs); ticks.push({ t, cx, x0: cx - w / 2, x1: cx + w / 2, prio: 0.5 - k / 1000 }); }
    for (const tk of thin(ticks.filter((tk) => tk.x0 >= 0 && tk.x1 <= W), 6)) el('text', { x: tk.cx, y: ty, 'text-anchor': 'middle', class: 'ax', 'font-size': fs }, svg, tk.t);
    const gy = H - 8 - (oneRow ? 0 : mg.h);
    el('text', { x: cA, y: gy, 'text-anchor': 'middle', class: 'ax grp', 'font-size': fs, 'font-weight': 600 }, svg, gA);
    el('text', { x: cB, y: H - 8, 'text-anchor': 'middle', class: 'ax grp', 'font-size': fs, 'font-weight': 600 }, svg, gB);
    // markers along the top, spread so they never collide, with a leader down to their bar
    const items = ms.map((m) => ({ m, want: bx(m.b) + bw / 2, size: tw(m.name, lfs, 700) + 8 }));
    spread(items, L, W - R, 6);
    const nameY = 2 + ml.asc, legTop = 2 + ml.h + 3;
    for (const it of items) {
      const cx = bx(it.m.b) + bw / 2, top = y(buckets[it.m.b] / sum.total) - mt.h - 18; // stops clear of the bar's share label
      el('text', { x: it.pos, y: nameY, 'text-anchor': 'middle', class: 't-' + it.m.key, 'font-size': lfs, 'font-weight': 700 }, svg, it.m.name);
      el('path', { d: `M${it.pos} ${legTop}L${it.pos} ${legTop + 6}L${cx} ${Math.min(top, T - 4)}L${cx} ${top}`, class: 'leader s-' + it.m.key }, svg);
    }
    // the table
    const tb = document.querySelector('#tab-all tbody'); tb.replaceChildren();
    buckets.forEach((c, i) => { const tr = document.createElement('tr'); [bucketLabel(sum, i), intF.format(c), share(c, sum.total)].forEach((t, j) => { const td = document.createElement(j ? 'td' : 'th'); if (!j) td.scope = 'row'; td.textContent = t; tr.appendChild(td); }); tb.appendChild(tr); });
  }

  // the heat strip: columns are bins of the first five years' average; rows are how the orders end. The bins are as fine
  // as the width allows while each column still holds its share at full size.
  function heatChart(sum) {
    const svg = $('c-early'), W = widthOf(svg), narrow = W < 600, fs = TXT, lfs = TXT + 1, mt = vm(fs), ml = vm(lfs, 700);
    const y0 = firstYear(sum), rows = [0]; for (let d = HZ; d >= y0; d--) rows.push(d);
    const rowLab = (d) => d === 0 ? (narrow ? 'Lasts' : `Lasts ${HZ} years`) : (narrow ? 'Year ' + d : 'Runs out, year ' + d);
    const { T, ch, H } = heatGeom(W, y0), L = Math.ceil(Math.max(...rows.map((d) => tw(rowLab(d), fs)))) + 12, R = 4;
    const gs = sum.groups, lo = gs[0].avg, hi = gs[gs.length - 1].avg, minCw = tw('100', fs) + 10;
    const ncOf = (bw) => Math.floor(hi / bw + 1e-9) - Math.floor(lo / bw + 1e-9) + 1;
    let bw = niceStep((hi - lo) / 18);
    while (ncOf(bw) * minCw > W - L - R) bw = niceStep(bw * 1.01);
    const c0 = Math.floor(lo / bw + 1e-9), c1 = Math.floor(hi / bw + 1e-9), nc = c1 - c0 + 1;
    const cols = Array.from({ length: nc }, (_, i) => ({ lo: (c0 + i) * bw, n: 0, counts: new Array(HZ + 1).fill(0) }));
    const colOf = (avg) => Math.floor(avg / bw + 1e-9) - c0;
    for (const g of gs) { const c = cols[colOf(g.avg)]; c.n += g.n; g.counts.forEach((v, d) => { c.counts[d] += v; }); }
    const cw = (W - L - R) / nc, pctSign = tw('100%', fs) + 8 <= cw;
    setup(svg, W, H);
    const cx = (i) => L + i * cw;
    const gc = el('g', {}, svg);
    // the share that last, printed above each column
    const shareY = T - 12;
    el('text', { x: L - 8, y: shareY, 'text-anchor': 'end', class: 'ax', 'font-size': fs, 'font-weight': 600 }, svg, narrow ? '% last' : 'Share that last');
    cols.forEach((c, i) => {
      if (!c.n) return;
      rows.forEach((d, r) => {
        const p = c.counts[d] / c.n;
        el('rect', { x: cx(i) + 1, y: T + r * ch + 1, width: cw - 2, height: ch - 2, class: p > 0 ? 'cell' : 'cell0', 'fill-opacity': p > 0 ? (0.14 + 0.86 * p).toFixed(3) : undefined }, gc);
      });
      const p0 = c.counts[0] / c.n, t = Math.round(p0 * 100) + (pctSign ? '%' : '');
      el('text', { x: cx(i) + cw / 2, y: shareY, 'text-anchor': 'middle', class: 'ax val', 'font-size': fs }, svg, p0 > 0 && p0 < 0.005 ? '<1' + (pctSign ? '%' : '') : t);
    });
    rows.forEach((d, r) => el('text', { x: L - 8, y: T + r * ch + ch / 2 + mt.asc / 2 - 2, 'text-anchor': 'end', class: 'ax', 'font-size': fs }, svg, rowLab(d)));
    // x ticks at whole-number averages, thinned to fit
    const tickStep = niceStep(bw * Math.max(1, Math.ceil((tw('−10%', fs) + 12) / cw)));
    const axisY = T + rows.length * ch;
    for (let v = Math.ceil(c0 * bw / tickStep - 1e-9) * tickStep; v <= (c1 + 1) * bw + 1e-9; v += tickStep) {
      const px = L + (v / bw - c0) * cw, t = minus(String(Math.round(v * 100))) + '%', w = tw(t, fs);
      el('line', { x1: px, x2: px, y1: axisY, y2: axisY + 5, class: 'zero' }, svg);
      el('text', { x: Math.max(w / 2, Math.min(W - w / 2, px)), y: axisY + 6 + mt.asc, 'text-anchor': 'middle', class: 'ax', 'font-size': fs }, svg, t);
    }
    const gt = 'Average return of the first five years', gw = tw(gt, fs, 600);
    el('text', { x: Math.max(gw / 2, Math.min(W - gw / 2, L + (W - L - R) / 2)), y: H - 8, 'text-anchor': 'middle', class: 'ax grp', 'font-size': fs, 'font-weight': 600 }, svg, gt);
    // the line left of which every order runs out
    let allOut = -1; for (let i = 0; i < nc; i++) { if (cols[i].n && cols[i].counts[0] > 0) break; allOut = i; }
    const items = marks().map((m) => ({ m, col: colOf(m.f5) }));
    items.forEach((it) => { it.want = cx(it.col) + cw / 2; it.size = tw(it.m.name, lfs, 700) + 8; });
    const all = items.slice();
    if (allOut >= 0) { const t = narrow ? 'All run out' : 'Every order left of here runs out'; all.push({ rule: true, want: cx(allOut + 1), size: tw(t, fs, 600) + 8, t }); }
    spread(all, 0, W - R, 6);
    // two rows above the strip: the rule's note on top, the names under it
    const ruleY = 2 + mt.asc, nameY = 2 + mt.h + 4 + ml.asc, nameBottom = nameY + ml.h - ml.asc;
    for (const it of all) {
      if (it.rule) {
        const px = cx(allOut + 1);
        el('line', { x1: px, x2: px, y1: ruleY + 6, y2: axisY, class: 'rule' }, svg);
        el('text', { x: it.pos, y: ruleY, 'text-anchor': 'middle', class: 'ax halo', 'font-size': fs, 'font-weight': 600 }, svg, it.t);
        continue;
      }
      const ccx = cx(it.col) + cw / 2, mtop = shareY - mt.asc - 6;
      el('rect', { x: cx(it.col) - 1, y: mtop, width: cw + 2, height: axisY - mtop + 1, class: 'mark s-' + it.m.key }, svg);
      el('text', { x: it.pos, y: nameY, 'text-anchor': 'middle', class: 'halo t-' + it.m.key, 'font-size': lfs, 'font-weight': 700 }, svg, it.m.name);
      el('path', { d: `M${it.pos} ${nameBottom + 2}L${ccx} ${mtop}`, class: 'leader s-' + it.m.key }, svg);
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
    if (dealt && isFull()) parts.push(`This order’s first five average ${pct1(first5(dealt))}.`);
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
    // a section hed of 12 words or fewer; who has the best and the worst order goes in the line under the chart
    $('h-all').textContent = `Of all ${intF.format(s.total)} orders, ${s.lasts / s.total < 0.5 ? 'only ' : ''}${lastPct} last ${HZ} years`;
    $('t-all').textContent = `Running out in year ${top} is the most common ending`;
    $('s-all').textContent = (best && worst ? 'Ruth has the best order; Sam has the worst. ' : '') + `${lastPct} of the orders last all ${HZ} years. The most common ending is running out in year ${top} (${share(s.byYear[top], s.total)} of orders). ` + (ranks.ruth ? rankText(ranks.ruth, 'Ruth’s order') + ' ' : '') + (ranks.sam ? rankText(ranks.sam, 'Sam’s order') : '');
  }
  function youChanged() {
    whyChart(); drawRrif();
    if (BASE) drawAll();
  }

  $('run-text').textContent = `Counting all ${intF.format(ORDERS)} orders…`;
  Runner.start('base', ENUM, (p) => {
    $('run-bar').value = p; $('run-text').textContent = `Counting all ${intF.format(ORDERS)} orders: ${Math.floor(p * 10) * 10}%`;
  }, (d) => {
    BASE = d.summary; $('run-bar').value = 1; $('run-bar').hidden = true; // done: the bar goes, the line stays
    $('run-text').textContent = `All ${intF.format(BASE.total)} orders worked out in this browser in ${(d.ms / 1000).toFixed(1)} seconds.`;
    document.body.dataset.enumMs = String(Math.round(d.ms));
    allText(); youChanged();
    Runner.rank('base', outcome(RUTH), (r) => { ranks.ruth = r; allText(); });
    Runner.rank('base', outcome(SAM), (r) => { ranks.sam = r; allText(); });
  });

  // ---------- rescuing Sam ----------
  const SOLVE = largestLastingWithdrawal({ start: S.start, indexation: S.indexation, returns: returnsOf(BAD) });
  const SOLVED = run(BAD, SOLVE);
  $('h-rescue').textContent = `Sam’s money lasts if his first withdrawal is ${money(SOLVE)} or less`;
  $('p-solver').textContent = `That is ${money(W0 - SOLVE)} less than the ${money(W0)} in the story, about ${Math.round((1 - SOLVE / W0) * 100)}% less, rising ${pctF(S.indexation)} a year the same way.`;
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
  $('t-levers').textContent = `${cap(words(LEVERS.length))} changes, one at a time, against Sam’s path before`;
  LEVERS.forEach((lv, i) => {
    const f = document.createElement('figure'); f.className = 'small-multiple';
    f.innerHTML = `<figcaption id="t-lv${i}"></figcaption><svg id="c-lv${i}" role="img" aria-labelledby="t-lv${i} s-lv${i}"></svg><p class="reading" id="s-lv${i}"></p>`;
    $('levers').appendChild(f);
    $('t-lv' + i).textContent = lv.title;
    $('s-lv' + i).textContent = 'Sam’s money ' + compare(lv.res, SAM);
  });
  const LV_MAX = Math.max(S.start, ...LEVERS.flatMap((lv) => lv.res.balances), ...SAM.balances);
  const before = (extra) => ({ key: 'before', name: 'Before', reading: short(SAM), pts: pts(SAM), dep: SAM.depletionYear, thin: true, ...extra });
  function drawLevers() {
    LEVERS.forEach((lv, i) => lineChart($('c-lv' + i), { compact: true, yMax: LV_MAX, height: (W) => W < 600 ? 270 : 280,
      series: [before({ reading: undefined }), { key: 'sam', name: 'With it', reading: short(lv.res), pts: pts(lv.res), dep: lv.res.depletionYear }] }));
  }
  const w = $('w'), wout = $('wout'), flex = $('flex'), buffer = $('buffer');
  w.min = String(Math.round(W0 * 0.6 / 1000) * 1000); w.max = String(Math.round(W0 * 1.6 / 1000) * 1000); w.step = '100'; w.value = String(W0);
  function drawMix() {
    const wv = Number(w.value), res = run(BAD, wv, { flex: flex.checked, buffer: buffer.checked });
    wout.textContent = money(wv); w.setAttribute('aria-valuetext', money(wv));
    lineChart($('c-mix'), { series: [before(), { key: 'sam', name: 'With changes', reading: short(res), pts: pts(res), dep: res.depletionYear }], height: (W) => W < 600 ? 360 : 400 });
    $('t-mix').textContent = 'With these changes, Sam’s money ' + (res.depletionYear ? 'runs out in year ' + res.depletionYear : `lasts all ${HZ} years`);
    $('rv-mix').textContent = res.depletionYear ? 'Runs out in year ' + res.depletionYear : `Lasts all ${HZ} years`;
    $('rk-paid').textContent = `Paid out over ${HZ} years`;
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
  // the Sources fold: the confirmed facts this page uses, with their links and as-of dates
  [FX.maturity, FX.rrif].forEach((f) => {
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = f.source_url; a.textContent = f.title; li.append(a, `, as of ${f.as_of}.`); $('src-list').appendChild(li);
  });
  const RR = { ruth: rr(GOOD), sam: rr(BAD) };
  const FT = { ruth: forcedTotals(GOOD, RR.ruth.on), sam: forcedTotals(BAD, RR.sam.on) };
  {
    const hit = ['ruth', 'sam'].filter((k) => FT[k].all > 0.5).map((k) => k === 'ruth' ? 'Ruth' : 'Sam');
    const miss = ['ruth', 'sam'].filter((k) => FT[k].all <= 0.5).map((k) => k === 'ruth' ? 'Ruth' : 'Sam');
    $('h-rrif').textContent = hit.length === 1 ? `From age ${turns}, the RRIF minimum takes extra from ${hit[0]}, not ${miss[0]}` : `What the RRIF minimum does from age ${turns}`;
  }
  const rrifPanels = [{ key: 'ruth', name: 'Ruth', order: () => GOOD }, { key: 'sam', name: 'Sam', order: () => BAD }, { key: 'you', name: 'This order', order: () => dealt }];
  rrifPanels.forEach((p) => {
    const f = document.createElement('figure'); f.className = 'small-multiple';
    f.innerHTML = `<figcaption id="t-rr-${p.key}"></figcaption><svg id="c-rr-${p.key}" role="img" aria-labelledby="t-rr-${p.key} s-rr-${p.key}"></svg><p class="reading" id="s-rr-${p.key}"></p>`;
    $('rrif-panels').appendChild(f);
  });
  function rrifReading(name, order, r) {
    const ft = forcedTotals(order, r.on);
    if (ft.all <= 0.5) return `${name}: no change. The planned withdrawal is above the minimum every year, so the minimum never adds anything.`;
    return `${name}: the minimum takes out ${money(ft.all)} more than planned, ${money(ft.down)} of it in years that follow a down year. ` +
      `The RRIF ${r.on.depletionYear ? 'runs out in year ' + r.on.depletionYear : 'ends with ' + money(r.on.endBalance)}, against ${r.off.depletionYear ? 'running out in year ' + r.off.depletionYear : money(r.off.endBalance)} without the minimum.`;
  }
  function rrifChart(svg, key, name, order, r, on, yMax, fMax) {
    const W = widthOf(svg), narrow = W < 600, fs = TXT, top = narrow ? 290 : 300, bars = 64, gap = 30;
    const series = on
      ? [{ key, name: 'Without', reading: short(r.off), pts: pts(r.off), dep: r.off.depletionYear, thin: true, dash: true }, { key, name: 'With minimum', reading: short(r.on), pts: pts(r.on), dep: r.on.depletionYear }]
      : [{ key, name, reading: short(r.off), pts: pts(r.off), dep: r.off.depletionYear }];
    lineChart(svg, { compact: true, yMax, width: W, height: () => top + gap + bars, series, extra: (g, k) => {
      // shift the balance plot up: the bottom band holds the forced extra, one bar per year
      const by = k.y(0) + gap, bh = bars - 6, x = k.x, colW = (x(1) - x(0)) * 0.7;
      // the year the minimums start, drawn first so the strip's label sits over it
      const tx = x(RRIF_T0);
      // the rule breaks at the strip's label row, so it never runs through the words
      el('line', { x1: tx, x2: tx, y1: k.T, y2: by - 6 - fs - 2, class: 'rule' }, g);
      el('line', { x1: tx, x2: tx, y1: by, y2: by + bh, class: 'rule' }, g);
      el('text', { x: tx + 4, y: k.T + 14, class: 'ax halo', 'font-size': fs }, g, `Turns ${turns}`);
      el('text', { x: k.L, y: by - 6, class: 'ax halo', 'font-size': fs }, g, on ? (narrow ? 'Taken out by the minimum' : 'Taken out beyond the plan because of the minimum') : 'Minimums off');
      el('line', { x1: k.L, x2: k.W - k.R, y1: by + bh, y2: by + bh, class: 'zero' }, g);
      if (on) r.on.forced.forEach((f, t) => {
        if (f <= 0.5) return;
        const h = f / fMax * (bh - 14);
        el('rect', { x: x(t + 0.5) - colW / 2, y: by + bh - h, width: colW, height: h, class: 'f-' + key + (downBefore(order, t) ? '' : ' light') }, g);
      });
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
      // an empty panel takes no room: its title and the line asking for a full deal stand alone
      svg.toggleAttribute('hidden', !p.r);
      if (!p.r) { svg.replaceChildren(); svg.removeAttribute('viewBox'); svg.setAttribute('height', 0); $('s-rr-' + p.key).textContent = `Deal all ${words(N)} cards at the top to add this order here.`; continue; }
      rrifChart(svg, p.key, p.name, p.ord, p.r, on, yMax, fMax);
      $('s-rr-' + p.key).textContent = on ? rrifReading(p.name, p.ord, p.r) : `${p.name}: ${short(p.r.off)} without the minimum. Apply the minimums to compare.`;
    }
    // the readout under the switch: the share of all orders that run out, with the minimums and without
    $('t-rrif-panels').textContent = on ? 'Ruth, Sam and the dealt order, with and without the RRIF minimums' : 'Ruth, Sam and the dealt order, without the RRIF minimums';
    $('rk-rrif-on').textContent = 'Orders that run out, with minimums';
    $('rk-rrif-off').textContent = on ? 'Without them' : 'Orders that run out, no minimums';
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

  // ---------- first draw, and redraw when the width or the fonts change ----------
  // the first fill is not a deal: draw without counting it
  function firstDraw() { dealt = []; paintCards(false); drawDeal(); dealText(); drawStrip(); answer.set({ text: '?', label: 'This order lasts', line: startLine }); whyChart(); drawRrif(); drawShuffle(); drawLevers(); drawMix(); drawAll(); }
  firstDraw();
  // The first fill is not a change: drop the underline the shared layer gives a readout whose text changes (its observer
  // runs first, in the same microtask queue), so only what the reader's own action changes is underlined.
  Promise.resolve().then(() => 0).then(() => document.querySelectorAll('[data-flash].flash').forEach((e) => e.classList.remove('flash')));
  // a redraw at a new width or once the fonts load, or when Go deeper opens (its charts are drawn at their real width)
  function redraw() { paintCards(false); drawDeal(); dealText(); drawStrip(); whyChart(); drawRrif(); drawShuffle(); drawLevers(); drawMix(); drawAll(); }
  $('deeper').addEventListener('toggle', () => { if ($('deeper').open) redraw(); });
  let lastW = innerWidth, t;
  addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(t); t = setTimeout(redraw, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
})();
