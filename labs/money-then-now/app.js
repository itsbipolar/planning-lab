// Money, then and now. The yearly series are embedded in #data (computed at build time from the dated Statistics Canada
// and Bank of Canada snapshots) and the arithmetic comes from model.mjs, inlined above this script. The year and amount
// typed here stay in this page: not stored, not put in the address, not sent anywhere. The only file this page makes is
// an image the visitor asks to save.
(function () {
  'use strict';
  var M = JSON.parse(document.getElementById('data').textContent);
  var EXAMPLE_YEAR = EXAMPLE.year, EXAMPLE_AMOUNT = EXAMPLE.amount; // model.mjs
  var FS = 17;              // chart label size in px (the shared floor is 16.5px)
  var TEN = 1e1;            // the decimal base, for ticks and rounding
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };
  var YEARS = yearsOf(M), EX = extremes(M), SPANS = negSpans(M), C = counts(M);
  var state = { year: EXAMPLE_YEAR, amount: EXAMPLE_AMOUNT, example: true };

  // ---------- words and numbers ----------
  var MINUS = '−', DASH = '–';
  function fix1(v) { var r = Math.round(v * TEN) / TEN; return (r === 0 ? 0 : r).toLocaleString('en-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function signed(v) { var r = Math.round(v * TEN) / TEN; return (r > 0 ? '+' : r < 0 ? MINUS : '') + fix1(Math.abs(v)) + '%'; }
  function pct(v) { var r = Math.round(v * TEN) / TEN; return (r < 0 ? MINUS : '') + fix1(Math.abs(v)) + '%'; }
  function money(v) {
    if (v < 100) return '$' + v.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (v < 1000) return '$' + Math.round(v).toLocaleString('en-CA');
    var k = Math.pow(TEN, Math.floor(Math.log(v) / Math.LN10) - 2);
    return '$' + (Math.round(v / k) * k).toLocaleString('en-CA', { maximumFractionDigits: 0 });
  }
  function typed(v) { return '$' + v.toLocaleString('en-CA', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function span(a, b) { return a === b ? String(a) : a + DASH + (Math.floor(a / 100) === Math.floor(b / 100) ? String(b).slice(2) : b); }
  function fold(r) { return r >= 2 ? fix1(r).replace(/\.0$/, '') + '-fold' : null; }

  // ---------- colour for a stripe, from the theme's tokens ----------
  function tok(name) { return getComputedStyle(document.documentElement).getPropertyValue('--t-' + name).trim(); }
  // The site's stripes ramp (shared/desk/tokens.json "stripes", via deskCSS): six stops from falls to rises, at the yearly
  // price changes in --stripe-at, mixed in OKLab between the two stops around a year's change (as scripts/ramp.mjs does).
  function hex(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; }); }
  function toLab(h) {
    var c = hex(h).map(function (v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    var l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]), m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]), s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function fromLab(L) {
    var l = Math.pow(L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], 3), m = Math.pow(L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], 3), s = Math.pow(L[0] - 0.0894841775 * L[1] - 1.291485548 * L[2], 3);
    var rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    return 'rgb(' + rgb.map(function (v) { v = Math.max(0, Math.min(1, v)); v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.round(v * 255); }).join(',') + ')';
  }
  function palette() {
    var at = getComputedStyle(document.documentElement).getPropertyValue('--stripe-at').trim().split(/\s+/).map(Number);
    return { at: at, stops: at.map(function (_, i) { return toLab(tok('stripe-' + i)); }) };
  }
  function stripeColour(v, pal) {
    var at = pal.at, cs = pal.stops, i;
    if (v <= at[0]) return fromLab(cs[0]);
    for (i = 1; i < at.length; i++) if (v <= at[i]) {
      var t = (v - at[i - 1]) / (at[i] - at[i - 1]);
      return fromLab(cs[i - 1].map(function (x, k) { return x + (cs[i][k] - x) * t; }));
    }
    return fromLab(cs[cs.length - 1]);
  }

  // ---------- svg helpers ----------
  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(svg) { Array.prototype.slice.call(svg.childNodes).forEach(function (c) { if (c.nodeName !== 'title' && c.nodeName !== 'desc') svg.removeChild(c); }); }

  // Places labels so that no two overlap: each label tries its candidate positions in order and keeps the first that
  // stays inside the chart and clear of every label (and reserved mark) placed before it; one that fits nowhere is left out.
  // Every label placed gets a ground-coloured backing, so no line or gridline runs through its words.
  function placer(layer, W, backs) {
    var boxes = [];
    function back(b) { el('rect', { x: (b.x - 3).toFixed(1), y: (b.y - 1).toFixed(1), width: (b.w + 6).toFixed(1), height: (b.h + 2).toFixed(1), 'class': 'lbl-bg' }, backs); }
    function hit(b) { return boxes.some(function (o) { return b.x < o.x + o.w + 4 && o.x < b.x + b.w + 4 && b.y < o.y + o.h + 1 && o.y < b.y + b.h + 1; }); }
    function fill(t, text) {
      t.textContent = '';
      (typeof text === 'string' ? [[text]] : text).forEach(function (p) { el('tspan', p[1] ? { 'class': p[1] } : {}, t, p[0]); });
    }
    return {
      reserve: function (b) { boxes.push(b); },
      fixed: function (t, bare) { var bb = t.getBBox(), b = { x: bb.x, y: bb.y, w: bb.width, h: bb.height }; boxes.push(b); if (!bare) back(b); return t; },
      put: function (cls, cands) {
        var t = el('text', { 'class': cls }, layer);
        for (var i = 0; i < cands.length; i++) {
          var c = cands[i];
          fill(t, c.text); t.setAttribute('x', c.x); t.setAttribute('y', c.y); t.setAttribute('text-anchor', c.anchor || 'start');
          var bb = t.getBBox(), b = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
          var extra = c.extra ? c.extra(b) : null;
          if (b.x >= -0.25 && b.x + b.w <= W + 0.25 && !hit(b) && !(extra && hit(extra))) { boxes.push(b); back(b); if (extra) boxes.push(extra); return { t: t, b: b, c: c }; }
        }
        t.remove(); return null;
      },
    };
  }
  // Candidate spots beside a point: right of it, then left, stepping up and down until one is free.
  function beside(xr, xl, yb, text, dy, steps) {
    var out = [], offs = [0];
    for (var k = 1; k <= steps; k++) offs.push(-k * dy, k * dy);
    offs.forEach(function (o) { out.push({ x: xr, y: yb + o, anchor: 'start', text: text }, { x: xl, y: yb + o, anchor: 'end', text: text }); });
    return out;
  }
  function niceStep(range, n) {
    var raw = range / n, p = Math.pow(TEN, Math.floor(Math.log(raw) / Math.LN10)), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : TEN) * p;
  }

  // ---------- the chart: three lanes on one shared axis of years ----------
  var dropCross = null;
  function draw() {
    var svg = $('chart');
    if (dropCross) { dropCross(); dropCross = null; } // the crosshair goes before the chart is drawn again
    clear(svg);
    // Every label is drawn at the size it renders (the viewBox is the frame's own width, so nothing is scaled down): FS,
    // at least the shared 16.5px floor; the lanes are laid out around it.
    var W = Math.max(300, Math.floor($('chart-frame').clientWidth)), narrow = W < 640, fs = FS;
    var N = YEARS.length, step = W / N;
    var X = function (y) { return (y - M.first) * step; }, CX = function (y) { return X(y) + step / 2; };
    var sel = state.year, scx = CX(sel);
    var marks = el('g', {}, svg), backs = el('g', {}, svg), labels = el('g', {}, svg);
    var P = placer(labels, W, backs), lineGap = fs + 4;
    var pal = palette();

    // A lane heading: the title in bold, the note after it on the same line when it fits, else on the next line; then the
    // lane's own key on the line below, wrapping between items (never inside one).
    function head(y, title, note, key) {
      var t = el('text', { x: 0, y: y + fs + 3, 'class': 'lane-t' }, labels, title);
      var tb = t.getBBox(), bottom = y + fs + 3;
      if (note) {
        var n = el('text', { x: tb.width + 12, y: bottom, 'class': 'lbl-2' }, labels, note);
        if (tb.width + 12 + n.getBBox().width > W) { n.setAttribute('x', 0); bottom += lineGap + 2; n.setAttribute('y', bottom); }
        P.fixed(n, true);
      }
      P.fixed(t, true);
      if (key) {
        var kx = 0, sw = fs + 3, base = bottom + lineGap + 4;
        key.forEach(function (k) {
          var kt = el('text', { x: 0, y: base, 'class': k.cls ? 'key-t' : 'key-t key-note' }, labels, k.text);
          var w = (k.cls ? sw + 6 : 0) + kt.getBBox().width;
          if (kx > 0 && kx + w > W) { kx = 0; base += lineGap + 2; }
          if (k.line) el('line', { x1: kx, x2: kx + sw, y1: base - fs / 3, y2: base - fs / 3, 'class': k.cls }, labels);
          else if (k.cls) el('rect', { x: kx, y: base - fs + 3, width: sw, height: fs - 3, 'class': k.cls }, labels);
          kt.setAttribute('x', kx + (k.cls ? sw + 6 : 0)); kt.setAttribute('y', base);
          P.fixed(kt, true);
          kx += w + (narrow ? 14 : 20);
        });
        bottom = base;
      }
      return bottom + 6;
    }
    // A line or a band of marks becomes an obstacle for the labels: one box per year, from the lowest to the highest point
    // the marks reach in that year's column (with the step up from the year before).
    function obstacle(y, ys) {
      var a = Math.min.apply(null, ys), b = Math.max.apply(null, ys);
      P.reserve({ x: X(y), y: a - 2, w: step, h: b - a + 4 });
    }

    // Lane 1: prices each year, one stripe per year
    var y0 = head(0, 'Prices each year', 'change in the year’s average price level', [
      { cls: 'key-fall', text: 'prices fell' }, { cls: 'key-flat', text: 'about flat' }, { cls: 'key-rise', text: 'prices rose' },
      { text: 'deepest at ' + MINUS + Math.abs(pal.at[0]) + '% or below and +' + pal.at[pal.at.length - 1] + '% or more' }]);
    var rows = narrow ? 3 : 2, rowH = Math.ceil(fs * 1.45) + 2, bandTop = y0; // a row is a label's box (about 1.4 × its size) and a gap
    var rowY = function (r) { return bandTop + (r + 1) * rowH - 5; };
    var sTop = bandTop + rows * rowH + 4, sH = narrow ? 64 : 84;
    YEARS.forEach(function (y) {
      el('rect', { x: X(y).toFixed(2), y: sTop, width: (step + 0.4).toFixed(2), height: sH, fill: stripeColour(M.infl[y], pal), 'class': 'stripe', 'data-year': y }, marks);
    });
    P.reserve({ x: 0, y: sTop + 2, w: W, h: sH - 2 });

    // Lane 2: borrowing vs prices
    var l2 = head(sTop + sH + (narrow ? 26 : 32), 'Borrowing vs prices', 'average prime rate and price change, % a year', [
      { cls: 'line-prices', line: true, text: 'price change' }, { cls: 'line-prime', line: true, text: 'prime rate' },
      { cls: 'gap-pos', text: 'prime above prices' }, { cls: 'gap-neg', text: 'prime below prices' }]);
    var p2Top = l2 + 4, p2H = narrow ? 320 : 260, pad2 = fs + 12;
    var vals = [];
    YEARS.forEach(function (y) { vals.push(M.infl[y]); if (M.prime[y] != null) vals.push(M.prime[y]); });
    var lo2 = Math.min.apply(null, vals), hi2 = Math.max.apply(null, vals);
    var Y2 = function (v) { return p2Top + pad2 + (hi2 - v) / (hi2 - lo2) * (p2H - pad2 - 4); };
    var gs = niceStep(hi2 - lo2, narrow ? 4 : 6);
    for (var g = Math.ceil(lo2 / gs) * gs; g <= hi2; g += gs) el('line', { x1: 0, x2: W, y1: Y2(g), y2: Y2(g), 'class': Math.abs(g) < 1e-9 ? 'zero' : 'grid' }, marks);
    // the gap between prime and prices, shaded year by year from the first prime year
    YEARS.forEach(function (y) {
      var r = realRate(M, y); if (r == null) return;
      var a = Y2(M.prime[y]), b = Y2(M.infl[y]);
      el('rect', { x: X(y).toFixed(2), y: Math.min(a, b).toFixed(2), width: (step + 0.4).toFixed(2), height: Math.max(0.5, Math.abs(a - b)).toFixed(2), 'class': r >= 0 ? 'gap-pos' : 'gap-neg' }, marks);
    });
    function stepPath(get, from) {
      var d = '';
      for (var y = from; y <= M.last; y++) { var v = get(y); if (v == null) continue; var py = Y2(v).toFixed(2); d += (d ? ' L' : 'M') + X(y).toFixed(2) + ' ' + py + ' L' + X(y + 1).toFixed(2) + ' ' + py; }
      return d;
    }
    el('path', { d: stepPath(function (y) { return M.infl[y]; }, M.first), 'class': 'line-prices' }, marks);
    el('path', { d: stepPath(function (y) { return M.prime[y]; }, M.primeFirst), 'class': 'line-prime' }, marks);
    YEARS.forEach(function (y) {
      var ys = [Y2(M.infl[y])];
      if (M.prime[y] != null) ys.push(Y2(M.prime[y]));
      if (y > M.first) { ys.push(Y2(M.infl[y - 1])); if (M.prime[y - 1] != null && M.prime[y] != null) ys.push(Y2(M.prime[y - 1])); }
      obstacle(y, ys);
    });

    // Lane 3: what the amount is worth in each year's dollars (log scale)
    var l3 = head(p2Top + p2H + (narrow ? 30 : 34), 'What ' + typed(state.amount) + ' from ' + sel + ' is worth', 'in each year’s dollars, log scale');
    var p3Top = l3 + 4, p3H = narrow ? 190 : 200, pad3 = fs + 12;
    var w = {}; YEARS.forEach(function (y) { w[y] = worth(M, state.amount, sel, y); });
    var wv = YEARS.map(function (y) { return w[y]; }), lo3 = Math.min.apply(null, wv), hi3 = Math.max.apply(null, wv);
    var LL = Math.log(lo3), LH = Math.log(hi3);
    var Y3 = function (v) { return p3Top + pad3 + (LH - Math.log(v)) / (LH - LL) * (p3H - pad3 - fs - 8); };
    var grid3 = [], kLo = Math.floor(Math.log(lo3) / Math.LN10), kHi = Math.ceil(Math.log(hi3) / Math.LN10);
    for (var k = kLo; k <= kHi; k++) [1, 2, 5].forEach(function (m) { var v = m * Math.pow(TEN, k); if (v > lo3 && v < hi3) grid3.push(v); });
    var keep3 = [];
    grid3.sort(function (a, b) { return a - b; }).forEach(function (v) { if (!keep3.length || Y3(keep3[keep3.length - 1]) - Y3(v) >= fs * 2.4) keep3.push(v); });
    keep3.forEach(function (v) { el('line', { x1: 0, x2: W, y1: Y3(v), y2: Y3(v), 'class': 'grid' }, marks); });
    var d3 = '';
    YEARS.forEach(function (y) { var py = Y3(w[y]).toFixed(2); d3 += (d3 ? ' L' : 'M') + X(y).toFixed(2) + ' ' + py + ' L' + X(y + 1).toFixed(2) + ' ' + py; });
    el('path', { d: d3, 'class': 'line-money' }, marks);
    YEARS.forEach(function (y) { obstacle(y, y > M.first ? [Y3(w[y]), Y3(w[y - 1])] : [Y3(w[y])]); });
    var p3Bottom = p3Top + p3H;

    // The axis of years: decade ticks, as many as fit without touching
    var ay = p3Bottom + 6;
    el('line', { x1: 0, x2: W, y1: ay, y2: ay, 'class': 'axis' }, marks);
    var probe = el('text', { x: 0, y: 0, 'class': 'tick' }, labels, '2000'), tw = probe.getBBox().width; probe.remove();
    var every = [1, 2, 5, TEN].map(function (m) { return m * TEN; }).filter(function (m) { return m * step >= tw + 14; })[0] || TEN * TEN;
    for (var dcd = Math.ceil(M.first / every) * every; dcd <= M.last; dcd += every) {
      if (X(dcd) - tw / 2 < 0 || X(dcd) + tw / 2 > W) continue;
      el('line', { x1: X(dcd), x2: X(dcd), y1: ay, y2: ay + 5, 'class': 'axis' }, marks);
      P.fixed(el('text', { x: X(dcd), y: ay + fs + 7, 'text-anchor': 'middle', 'class': 'tick' }, labels, String(dcd)));
    }
    var H = ay + fs + 14;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);

    // The chosen year: one line through all three lanes, and its readings beside it
    // drawn lane by lane, so it never runs through a lane's heading
    [[bandTop, sTop + sH], [p2Top, p2Top + p2H], [p3Top, p3Bottom]].forEach(function (seg) {
      el('line', { x1: scx, x2: scx, y1: seg[0], y2: seg[1], 'class': 'sel-halo' }, marks);
      el('line', { x1: scx, x2: scx, y1: seg[0], y2: seg[1], 'class': 'sel-line', 'data-year': sel }, marks);
      P.reserve({ x: scx - 2, y: seg[0], w: 4, h: seg[1] - seg[0] });
    });
    var xr = scx + 9, xl = scx - 9;
    var r1 = [];
    for (var r = 0; r < rows; r++) r1.push({ x: xr, y: rowY(r), anchor: 'start', text: [[String(sel) + ' ', 'b'], [signed(M.infl[sel])]] }, { x: xl, y: rowY(r), anchor: 'end', text: [[String(sel) + ' ', 'b'], [signed(M.infl[sel])]] });
    P.put('lbl', r1);
    function dot(cx, cy, cls) { el('circle', { cx: cx, cy: cy, r: narrow ? 3.5 : 4.5, 'class': cls }, marks); }
    var dy = fs + 3;
    if (M.prime[sel] != null) {
      dot(scx, Y2(M.prime[sel]), 'dot-prime');
      P.put('lbl', beside(xr, xl, Y2(M.prime[sel]) + fs / 3, [['prime ', 'b'], [pct(M.prime[sel])]], dy, 4));
    }
    dot(scx, Y2(M.infl[sel]), 'dot-prices');
    P.put('lbl', beside(xr, xl, Y2(M.infl[sel]) + fs / 3, [['prices ', 'b'], [signed(M.infl[sel])]], dy, 4));
    if (M.prime[sel] != null) {
      var mid = (Y2(M.prime[sel]) + Y2(M.infl[sel])) / 2;
      P.put('lbl-2', beside(xr, xl, mid + fs / 3, 'real ' + signed(realRate(M, sel)), dy, 6));
    } else {
      P.put('lbl-2', beside(xr, xl, p2Top + pad2 - 2, 'no prime-rate data before ' + M.primeFirst, dy, 1).concat(beside(xr, xl, p2Top + pad2 - 2, 'no prime data yet', dy, 1)));
    }
    dot(scx, Y3(w[sel]), 'dot-money');
    P.put('lbl', beside(xr, xl, Y3(w[sel]) + fs + 6, [[typed(state.amount), 'b'], [' in ' + sel]], dy, 3));
    if (sel !== M.last) {
      dot(CX(M.last), Y3(w[M.last]), 'dot-money');
      var lx = CX(M.last), ly = Y3(w[M.last]);
      P.put('lbl', [{ x: W, y: ly - 9, anchor: 'end', text: [[money(w[M.last]), 'b'], [' in ' + M.last]] }, { x: W, y: ly + fs + 8, anchor: 'end', text: [[money(w[M.last]), 'b'], [' in ' + M.last]] }].concat(beside(lx + 9, lx - 9, ly - 9, [[money(w[M.last]), 'b'], [' in ' + M.last]], dy, 3)));
    }

    // Notable years on the stripes, with a short leader down to their stripe
    function stripeLabel(y, long, short) {
      var c = CX(y), cands = [];
      [long, short].forEach(function (text) {
        for (var r = 0; r < rows; r++) ['middle', 'start', 'end'].forEach(function (a) {
          cands.push({ x: a === 'start' ? c - 3 : a === 'end' ? c + 3 : c, y: rowY(r), anchor: a, text: text, extra: (function (rr) { return function () { return { x: c - 1, y: rowY(rr) + 4, w: 2, h: sTop - rowY(rr) - 4 }; }; })(r) });
        });
      });
      var got = P.put('lbl', cands);
      if (got) el('line', { x1: c, x2: c, y1: got.b.y + got.b.h + 1, y2: sTop, 'class': 'leader' }, marks);
    }
    stripeLabel(EX.rise, [[EX.rise + ' ', 'b'], [signed(M.infl[EX.rise]) + ', largest rise']], [[EX.rise + ' ', 'b'], [signed(M.infl[EX.rise])]]);
    stripeLabel(EX.fall, [[EX.fall + ' ', 'b'], [signed(M.infl[EX.fall]) + ', largest fall']], [[EX.fall + ' ', 'b'], [signed(M.infl[EX.fall])]]);
    if (EX.recent != null) stripeLabel(EX.recent, [[EX.recent + ' ', 'b'], [signed(M.infl[EX.recent]) + ', highest since ' + EX.since]], [[EX.recent + ' ', 'b'], [signed(M.infl[EX.recent])]]);

    // Spans when prime was below prices (a negative real rate)
    // labelled above the lines, clear of every mark
    SPANS.forEach(function (s) {
      var highest = Infinity;
      for (var y = s[0]; y <= s[1]; y++) highest = Math.min(highest, Y2(Math.max(M.prime[y], M.infl[y])));
      var a = X(s[0]), b = X(s[1] + 1), c = (a + b) / 2, cands = [];
      var foot = highest - 4, lead = function (bx) { return { x: c - 1, y: bx.y + bx.h, w: 2, h: Math.max(0, foot - bx.y - bx.h - 2) }; };
      ['prime below prices, ' + span(s[0], s[1]), span(s[0], s[1]) + ': below'].forEach(function (text) {
        for (var k = 0; k < 8; k++) [[c, 'middle'], [b, 'end'], [a, 'start']].forEach(function (p) { cands.push({ x: p[0], y: highest - 7 - k * dy, anchor: p[1], text: text, extra: k ? lead : null }); });
      });
      var got = P.put('lbl lbl-neg', cands);
      if (got && got.c.extra) el('line', { x1: c, x2: c, y1: got.b.y + got.b.h + 1, y2: foot, 'class': 'leader' }, marks);
    });

    // The prime rate's peak, and the series names where they are easy to find
    var pk = YEARS.filter(function (y) { return M.prime[y] != null; }).reduce(function (a, y) { return M.prime[y] > M.prime[a] ? y : a; });
    var pc = CX(pk), pyy = Y2(M.prime[pk]) - 6;
    P.put('lbl', [['prime rate, peak ' + pct(M.prime[pk]) + ' in ' + pk], ['prime ' + pct(M.prime[pk]) + ' in ' + pk], ['prime rate']].reduce(function (acc, t) {
      return acc.concat([{ x: pc, y: pyy, anchor: 'middle', text: t[0] }, { x: pc - 4, y: pyy, anchor: 'end', text: t[0] }, { x: pc + 4, y: pyy, anchor: 'start', text: t[0] }]);
    }, []));
    // Scale labels after the notes: on their gridline at either edge, above it or below it, or else at the first clear
    // stretch along it, wherever no mark or note is
    function tick(y, t) {
      var c = [{ x: 0, y: y - 4, text: t }, { x: W - 1, y: y - 4, anchor: 'end', text: t }, { x: 0, y: y + fs + 1, text: t }, { x: W - 1, y: y + fs + 1, anchor: 'end', text: t }];
      for (var i = 1; i < 12; i++) c.push({ x: W * i / 12, y: y - 4, text: t });
      P.put('tick', c);
    }
    for (var g2 = Math.ceil(lo2 / gs) * gs; g2 <= hi2; g2 += gs) {
      var gv = Math.round(g2 * 1e6) / 1e6;
      tick(Y2(gv), gv === 0 ? '0%' : (gv > 0 ? '+' : MINUS) + Math.abs(gv) + '%');
    }
    keep3.forEach(function (v) { tick(Y3(v), v >= 1 ? '$' + v.toLocaleString('en-CA') : money(v)); });

    var rc = CX(EX.rise), ryy = Y2(M.infl[EX.rise]) - 6;
    P.put('lbl', [{ x: rc + 4, y: ryy, anchor: 'start', text: 'price change' }, { x: rc, y: ryy, anchor: 'middle', text: 'price change' }, { x: rc + 4, y: ryy + dy * 2, anchor: 'start', text: 'price change' }]);

    // The first year's value on the money line
    if (sel !== M.first) P.put('lbl-2', beside(CX(M.first) + 4, -1, Y3(w[M.first]) - 8, money(w[M.first]) + ' in ' + M.first, dy, 2).filter(function (c) { return c.anchor === 'start'; }));

    // Words for screen readers, and the image's name
    $('chart-title').textContent = 'Canadian prices, the prime rate and purchasing power, ' + M.first + ' to ' + M.last + ', with ' + sel + ' marked';
    $('chart-desc').textContent = 'Three lanes on one axis of years. A list of what the chart shows follows it.';
    // the takeaway in plain words, each word read from the counts
    var above = C.primeYears - C.below, often = function (n, of, a, b, c) { return n >= of * 0.9 ? a : n > of / 2 ? b : c; };
    $('chart-h').textContent = 'Prices rose ' + often(C.rose, C.years, 'almost every year', 'in most years', 'in fewer than half the years')
      + ', and prime ' + often(above, C.primeYears, 'nearly always ran', 'mostly ran', 'ran less than half the time') + ' above them';
    $('chart-sub').textContent = 'Rates in % a year, ' + M.first + ' to ' + M.last + '; the amount in each year’s dollars. Point at or tap a year to read it.';
    var items = [
      'Prices each year: one stripe per year from ' + M.first + ' to ' + M.last + ', blue where prices fell and amber where they rose. Prices rose in ' + C.rose + ' of the ' + C.years + ' years and fell in ' + C.fell + '. Largest rise ' + EX.rise + ' (' + signed(M.infl[EX.rise]) + '), largest fall ' + EX.fall + ' (' + signed(M.infl[EX.fall]) + ')' + (EX.recent != null ? '; ' + EX.recent + ' (' + signed(M.infl[EX.recent]) + ') was the highest since ' + EX.since : '') + '. In ' + sel + ': ' + signed(M.infl[sel]) + '.',
      'Borrowing vs prices: the average prime rate from ' + M.primeFirst + ' against the yearly price change. Prime peaked at ' + pct(M.prime[pk]) + ' in ' + pk + '. Prime was below prices in ' + SPANS.map(function (s) { return span(s[0], s[1]); }).join(', ') + '. ' + (M.prime[sel] != null ? 'In ' + sel + ': prime ' + pct(M.prime[sel]) + ', prices ' + signed(M.infl[sel]) + ', real rate ' + signed(realRate(M, sel)) + '.' : 'No prime-rate data for ' + sel + '.'),
      'What ' + typed(state.amount) + ' from ' + sel + ' is worth in each year’s dollars: ' + money(w[M.first]) + ' in ' + M.first + ', ' + money(w[M.last]) + ' in ' + M.last + ', at its lowest ' + money(lo3) + ' and its highest ' + money(hi3) + '.',
    ];
    var ul = $('chart-text'); ul.textContent = '';
    items.forEach(function (s) { var li = document.createElement('li'); li.textContent = s; ul.appendChild(li); });

    // The crosshair (shared deskCrosshair): any year's price change, prime rate, real rate and what the amount was worth
    dropCross = deskCrosshair(svg, { x0: 0, x1: W, y0: bandTop, y1: p3Bottom, read: function (px) {
      var y = Math.max(M.first, Math.min(M.last, M.first + Math.floor(px / step)));
      var lines = [String(y), 'Prices ' + signed(M.infl[y])];
      if (M.prime[y] != null) lines.push('Prime ' + pct(M.prime[y]), 'Real rate ' + signed(realRate(M, y)));
      else lines.push('No prime-rate data');
      lines.push(typed(state.amount) + ' from ' + sel + ': ' + money(w[y]));
      return { x: CX(y), y: Y2(M.prime[y] != null ? Math.max(M.prime[y], M.infl[y]) : M.infl[y]), lines: lines };
    } });
  }

  // ---------- the headline and the readings ----------
  function finding() {
    var y = state.year, a = state.amount;
    $('answer-k').textContent = typed(a) + ' in ' + y + ', in ' + M.last + ' dollars';
    if (y === M.last) {
      $('answer-v').textContent = typed(a);
      $('finding').textContent = 'In ' + y + ', the latest full year here, ' + typed(a) + ' was worth ' + typed(a) + '. Pick an earlier year to see the change.';
      return;
    }
    var v = worth(M, a, y, M.last);
    $('answer-v').textContent = 'about ' + money(v);
    $('finding').textContent = 'What cost ' + typed(a) + ' in ' + y + ' cost about ' + money(v) + ' in ' + M.last + '.';
  }
  function readings() {
    var ul = $('readings'); ul.textContent = '';
    function item(parts) {
      var li = document.createElement('li');
      parts.forEach(function (p) { if (p[1]) { var b = document.createElement('strong'); b.textContent = p[0]; li.appendChild(b); } else li.appendChild(document.createTextNode(p[0])); });
      ul.appendChild(li);
    }
    $('readings-h').textContent = 'Prices rose in ' + C.rose + ' of the ' + C.years + ' years from ' + M.first + ' to ' + M.last + ', and fell in ' + C.fell;
    var lastSpan = SPANS[SPANS.length - 1];
    if (lastSpan) item([['Prime has been below inflation in '], [C.below + ' of the ' + C.primeYears + ' years', 1], [' since ' + M.primeFirst + ', most recently ' + span(lastSpan[0], lastSpan[1]) + '.']]);
    if (state.year !== M.last) {
      var r = M.avg[M.last] / M.avg[state.year];
      item([['Since ' + state.year + ', prices '], [r >= 1 ? (fold(r) ? 'rose ' + fold(r) : 'rose ' + Math.round((r - 1) * 100) + '%') : 'fell ' + Math.round((1 - r) * 100) + '%', 1], [' (yearly average to ' + M.last + ').']]);
    }
    item([['The steepest yearly rise was '], [EX.rise + ', ' + signed(M.infl[EX.rise]), 1], ['; the steepest fall, '], [EX.fall + ', ' + signed(M.infl[EX.fall]), 1], ['.']]);
  }

  // ---------- the readout under the form: the chosen year's three readings ----------
  function yearReadout() {
    var y = state.year, r = realRate(M, y), up = M.infl[y] >= 0;
    $('rk-year').textContent = (state.example ? 'The example year, ' : 'The year you picked, ') + y;
    $('rv-infl').textContent = signed(M.infl[y]);
    $('rv-prime').textContent = M.prime[y] != null ? pct(M.prime[y]) : 'No data';
    $('rv-real').textContent = r != null ? signed(r) : 'No data';
    $('rv-real').classList.toggle('v-pos', r != null && r >= 0); $('rv-real').classList.toggle('v-neg', r != null && r < 0); // coloured as the chart's gap
    var t;
    if (r == null) t = 'The prime-rate series here starts in ' + M.primeFirst + '. Prices ' + (up ? 'rose ' : 'fell ') + pct(Math.abs(M.infl[y])) + ' in ' + y + '.';
    else if (r >= 0) t = 'Prime was ' + fix1(r) + ' points above the year’s price change: borrowing cost more than prices ' + (up ? 'rose.' : 'moved.');
    else t = 'Prime was ' + fix1(-r) + ' points below the year’s price rise: a negative real rate, as prices rose faster than borrowing cost.';
    $('rt-year').textContent = t;
  }

  // ---------- the table and the sources (drawn once) ----------
  function table() {
    var tb = $('rows'); tb.textContent = '';
    YEARS.forEach(function (y) {
      var tr = document.createElement('tr'); tr.setAttribute('data-year', y);
      var r = realRate(M, y);
      [[String(y), 'th'], [signed(M.infl[y])], [M.prime[y] != null ? pct(M.prime[y]) : '—'], [r != null ? signed(r) : '—']].forEach(function (c) {
        var td = document.createElement(c[1] || 'td'); if (c[1]) td.setAttribute('scope', 'row'); td.textContent = c[0]; tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }
  function sources() {
    var box = $('sources'), c = M.meta.cpi, b = M.meta.rate;
    function p(parts) {
      var e = document.createElement('p');
      parts.forEach(function (x) { if (x.href) { var a = document.createElement('a'); a.href = x.href; a.textContent = x.text; e.appendChild(a); } else e.appendChild(document.createTextNode(x)); });
      box.appendChild(e); return e;
    }
    p([{ href: c.source_url, text: c.title }, '. ' + c.source + '. ' + c.licence + '. Snapshot retrieved ' + c.retrieved + '. ' + c.attribution]);
    p([{ href: b.source_url, text: b.title }, '. ' + b.source + '. Snapshot retrieved ' + b.retrieved + '; ', { href: b.terms_url, text: 'the Bank’s terms of use' }, '. ' + b.attribution]);
    p(['How it’s made: each year’s price level is the average of its monthly index values, and a year counts only when all its months are in the snapshot. The price change is that average against the year before. The prime rate is the average of a calendar year’s weekly values, for complete years from ' + M.primeFirst + '. The real rate is the year’s average prime rate minus that year’s price change. What an amount is worth in another year is the amount times the ratio of the two years’ average price levels. Past data only; nothing here looks ahead.']);
    p(['#ShowYourStripes warming stripes by Professor Ed Hawkins, University of Reading, CC BY 4.0; this page uses the idea for prices and has nothing to do with climate data.']);
    $('foot-attr').textContent = c.attribution + ' ' + b.attribution;
  }

  // ---------- one render ----------
  function render() {
    finding(); yearReadout(); readings(); draw();
    Array.prototype.forEach.call(document.querySelectorAll('#rows tr.sel'), function (tr) { tr.classList.remove('sel'); });
    var row = document.querySelector('#rows tr[data-year="' + state.year + '"]'); if (row) row.classList.add('sel');
    // the one assumptions line, beside the control
    $('example-note').textContent = (state.example ? 'An example: ' + typed(EXAMPLE_AMOUNT) + ' in ' + EXAMPLE_YEAR + '. ' : 'Showing ' + typed(state.amount) + ' from ' + state.year + '. ')
      + 'By yearly average consumer prices; what you type stays here.';
    $('q-amount').textContent = typed(state.amount);
  }

  // ---------- controls ----------
  var year = $('year'), amount = $('amount');
  year.min = String(M.first); year.max = String(M.last); year.value = String(EXAMPLE_YEAR); amount.value = String(EXAMPLE_AMOUNT);
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var y = Number(year.value), a = Number(amount.value), err = $('error');
    if (!year.value || !Number.isInteger(y) || y < M.first || y > M.last) { err.textContent = 'Pick a year from ' + M.first + ' to ' + M.last + '.'; err.hidden = false; return; }
    if (!amount.value || !isFinite(a) || a <= 0 || a > 1e12) { err.textContent = 'Type an amount above zero, like ' + EXAMPLE_AMOUNT + '.'; err.hidden = false; return; }
    err.hidden = true; state.year = y; state.amount = Math.round(a * 100) / 100; state.example = false; render();
  });

  // ---------- save the chart as an image, made in the browser ----------
  $('save').addEventListener('click', function () {
    var svg = $('chart'), clone = svg.cloneNode(true), W = Number(svg.getAttribute('width')), H = Number(svg.getAttribute('height'));
    clone.setAttribute('xmlns', NS);
    var src = svg.querySelectorAll('*'), dst = clone.querySelectorAll('*');
    for (var i = 0; i < src.length; i++) {
      var cs = getComputedStyle(src[i]);
      ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'font-size', 'font-weight', 'paint-order', 'stroke-linejoin'].forEach(function (p) { dst[i].style.setProperty(p, cs.getPropertyValue(p)); });
      if (dst[i].nodeName === 'text') dst[i].style.setProperty('font-family', 'Helvetica, Arial, sans-serif');
    }
    var pad = 32, top = 40, foot = 56, img = new Image(), data = new XMLSerializer().serializeToString(clone);
    img.onload = function () {
      var c = document.createElement('canvas'), k = 2; c.width = (W + pad * 2) * k; c.height = (H + top + pad + foot) * k;
      var g = c.getContext('2d'); g.scale(k, k); g.fillStyle = tok('ground'); g.fillRect(0, 0, W + pad * 2, H + top + pad + foot);
      g.fillStyle = tok('ink'); g.font = '600 20px Georgia, serif'; g.fillText($('finding').textContent, pad, pad + 4, W);
      g.drawImage(img, pad, pad + top - 16, W, H);
      g.fillStyle = tok('ink3'); g.font = '12px Helvetica, Arial, sans-serif';
      g.fillText('Money, then and now. ' + M.meta.cpi.attribution, pad, H + top + pad + 8, W);
      g.fillText(M.meta.rate.attribution + ' Education only, not advice. Mohammed El Chayeb.', pad, H + top + pad + 26, W);
      c.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'money-then-now-' + state.year + '.png'; document.body.appendChild(a); a.click(); a.remove(); });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
  });

  table(); sources(); render();
  // The first fill is not a change: drop the underline the shared layer gives a readout whose text changes (its observer
  // runs first, in the same microtask queue), so only what the reader's own choice changes is underlined.
  Promise.resolve().then(function () { return 0; }).then(function () { Array.prototype.forEach.call(document.querySelectorAll('[data-flash].flash'), function (e) { e.classList.remove('flash'); }); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  var rt, lastW = $('chart-frame').clientWidth;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if ($('chart-frame').clientWidth !== lastW) { lastW = $('chart-frame').clientWidth; draw(); } }, 120); });
})();
