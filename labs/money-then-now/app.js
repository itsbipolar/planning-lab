// Money, then and now. The yearly series are embedded in #data (computed at build time from the dated Statistics Canada
// and Bank of Canada snapshots, with this year's Bank of Canada measures and the confirmed budget proposals in M.now)
// and the arithmetic comes from model.mjs, inlined above this script. The year and amount typed here stay in this page:
// not stored, not put in the address, not sent anywhere. A birth year set in Your year this visit (sessionStorage
// 'mo.year', read by the <head> script into <html data-year>) is the year it opens on. The only file this page makes is
// an image the visitor asks to save. The address may carry #this-year, which opens This year in money.
(function () {
  'use strict';
  var M = JSON.parse(document.getElementById('data').textContent), N = M.now;
  var EXAMPLE_YEAR = EXAMPLE.year, EXAMPLE_AMOUNT = EXAMPLE.amount; // model.mjs
  var FS = 17.5;            // chart label size in px (labels 17.5px or more)
  var TEN = 1e1;            // the decimal base, for ticks, steps and rounding
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };
  var YEARS = yearsOf(M), EX = extremes(M), SPANS = negSpans(M), C = counts(M);
  var state = { year: EXAMPLE_YEAR, amount: EXAMPLE_AMOUNT, example: true };
  var carried = Number(document.documentElement.getAttribute('data-year')), CARRIED = null;
  if (Number.isInteger(carried) && carried >= M.first && carried <= M.last) { CARRIED = carried; state.year = carried; state.example = false; }

  // ---------- words and numbers ----------
  var MINUS = '−', DASH = '–', ARROW = '→';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
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
  function moved(y) { var r = Math.round(M.infl[y] * TEN) / TEN; return r > 0 ? 'prices rose ' + pct(r) : r < 0 ? 'prices fell ' + pct(-r) : 'prices were flat'; }
  function longDate(d) { var p = d.split('-').map(Number); return MONTHS[p[1] - 1] + ' ' + p[2] + ', ' + p[0]; }
  function monthYear(d) { var p = d.split('-').map(Number); return MONTHS[p[1] - 1] + ' ' + p[0]; }
  var WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  function count(n) { return WORDS[n] || String(n); }

  // ---------- colour for a stripe, from the theme's tokens ----------
  function tok(name) { return getComputedStyle(document.documentElement).getPropertyValue('--t-' + name).trim(); }
  // The site's stripes ramp (shared/desk/tokens.json "stripes", via deskCSS): six stops from falls to rises, at the yearly
  // price changes in --stripe-at, mixed in OKLab between the two stops around a year's change (as scripts/ramp.mjs does).
  var SRGB = 12 / 5; // the sRGB transfer exponent
  function hex(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; }); }
  function toLab(h) {
    var c = hex(h).map(function (v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, SRGB); });
    var l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]), m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]), s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function fromLab(L) {
    var l = Math.pow(L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], 3), m = Math.pow(L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], 3), s = Math.pow(L[0] - 0.0894841775 * L[1] - 1.291485548 * L[2], 3);
    var rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    return 'rgb(' + rgb.map(function (v) { v = Math.max(0, Math.min(1, v)); v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / SRGB) - 0.055; return Math.round(v * 255); }).join(',') + ')';
  }
  function palette() {
    var at = getComputedStyle(document.documentElement).getPropertyValue('--stripe-at').trim().split(/\s+/).map(Number);
    return { at: at, stops: at.map(function (_, i) { return toLab(tok('stripe-' + i)); }) };
  }
  // Dark scheme: lightness and chroma are mixed and the more colourful stop's hue is kept (as the site's src/lib/ramp.mjs
  // does), so small rises read as a muted amber rather than olive.
  function mixHue(a, b, t) {
    var ca = Math.hypot(a[1], a[2]), cb = Math.hypot(b[1], b[2]);
    var h = cb >= ca ? Math.atan2(b[2], b[1]) : Math.atan2(a[2], a[1]), Cc = ca + (cb - ca) * t;
    return [a[0] + (b[0] - a[0]) * t, Cc * Math.cos(h), Cc * Math.sin(h)];
  }
  function stripeColour(v, pal) {
    var at = pal.at, cs = pal.stops, i, dark = document.documentElement.getAttribute('data-theme') !== 'light';
    if (v <= at[0]) return fromLab(cs[0]);
    for (i = 1; i < at.length; i++) if (v <= at[i]) {
      var t = (v - at[i - 1]) / (at[i] - at[i - 1]);
      if (dark) return fromLab(mixHue(cs[i - 1], cs[i], t));
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
  function html(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
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
      put: function (cls, cands, top) {
        var t = el('text', { 'class': cls }, layer);
        for (var i = 0; i < cands.length; i++) {
          var c = cands[i];
          fill(t, c.text); t.setAttribute('x', c.x); t.setAttribute('y', c.y); t.setAttribute('text-anchor', c.anchor || 'start');
          var bb = t.getBBox(), b = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
          var extra = c.extra ? c.extra(b) : null;
          if (b.x >= -0.25 && b.x + b.w <= W + 0.25 && b.y >= (top || 0) - 0.25 && !hit(b) && !(extra && hit(extra))) { boxes.push(b); back(b); if (extra) boxes.push(extra); return { t: t, b: b, c: c }; }
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
  // Year ticks along an axis: the first multiple of 1, 2 or 5 times a power of ten years whose labels fit without touching.
  function yearTicks(labels, marks, P, X, from, to, ay, W, bare) {
    var probe = el('text', { x: 0, y: 0, 'class': 'tick' }, labels, '2000'), tw = probe.getBBox().width; probe.remove();
    var px = (X(to) - X(from)) / Math.max(1, to - from), every = null;
    for (var k = 0; every == null && k < 4; k++) [1, 2, 5].forEach(function (m) { var s = m * Math.pow(TEN, k); if (every == null && s * px >= tw * 2) every = s; });
    every = every || Math.pow(TEN, 3);
    if (!bare) el('line', { x1: 0, x2: W, y1: ay, y2: ay, 'class': 'axis' }, marks);
    for (var d = Math.ceil(from / every) * every; d <= to; d += every) {
      if (X(d) - tw / 2 < 0 || X(d) + tw / 2 > W) continue;
      el('line', { x1: X(d), x2: X(d), y1: ay, y2: ay + 5, 'class': 'axis' }, marks);
      P.fixed(el('text', { x: X(d), y: ay + FS + 7, 'text-anchor': 'middle', 'class': 'tick' }, labels, String(d)));
    }
    return ay + FS + 14;
  }

  // ---------- the line chart: what the amount costs each year since the chosen year (linear) ----------
  var dropCross = null;
  function drawWorth() {
    var svg = $('chart');
    if (dropCross) { dropCross(); dropCross = null; }
    clear(svg);
    var W = Math.max(300, Math.floor($('chart-frame').clientWidth)), narrow = W < 640, fs = FS;
    var from = state.year, a = state.amount, to = M.last, n = to - from;
    var marks = el('g', {}, svg), backs = el('g', {}, svg), labels = el('g', {}, svg);
    var P = placer(labels, W, backs), dy = fs + 3;
    var v = {}; for (var y = from; y <= to; y++) v[y] = worth(M, a, from, y);
    var vs = Object.keys(v).map(function (k) { return v[k]; }), hi = Math.max.apply(null, vs);
    var gs = niceStep(hi, narrow ? 4 : 5), top = Math.ceil(hi / gs) * gs;
    // padL keeps the first year's dot whole inside the frame
    var padT = fs + 14, PH = narrow ? 260 : 330, padR = 8, padL = 7;
    var X = function (yy) { return n ? padL + (yy - from) / n * (W - padR - padL) : W / 2; };
    var Y = function (val) { return padT + (top - val) / top * PH; };
    for (var g = 0; g <= top + 1e-9; g += gs) el('line', { x1: 0, x2: W, y1: Y(g), y2: Y(g), 'class': g === 0 ? 'zero' : 'grid' }, marks);
    var d = '';
    for (y = from; y <= to; y++) d += (d ? ' L' : 'M') + X(y).toFixed(2) + ' ' + Y(v[y]).toFixed(2);
    if (n) el('path', { d: d, 'class': 'line-money s-named' }, marks);
    for (y = from; y < to; y++) { var y1 = Y(v[y]), y2 = Y(v[y + 1]); P.reserve({ x: X(y), y: Math.min(y1, y2) - 3, w: Math.max(1, X(y + 1) - X(y)), h: Math.abs(y1 - y2) + 6 }); }
    function dot(cx, cy) { el('circle', { cx: cx, cy: cy, r: narrow ? 4 : 5, 'class': 'dot-money' }, marks); P.reserve({ x: cx - 6, y: cy - 6, w: 12, h: 12 }); }
    var H = yearTicks(labels, marks, P, X, from, to, Y(0), W, true);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);

    dot(X(from), Y(a));
    if (n) dot(X(to), Y(v[to]));
    // the readings on the line: where it starts, then the one annotation, then where it ends
    var inPlot = function (cs) { return cs.filter(function (c) { return c.y <= Y(0) - 7; }); }; // no reading below the plot
    P.put('lbl', inPlot(beside(X(from) + 9, X(from) - 9, Y(a) - 12, [[typed(a), 'b'], [' in ' + from]], dy, 5).concat(beside(X(from) + 9, X(from) - 9, Y(a) + fs + 9, [[typed(a), 'b'], [' in ' + from]], dy, 3))), padT - fs);
    // the one annotation: the steepest yearly rise in the span, with a 1px leader to the line
    var sy = steepest(M, from);
    if (sy != null && sy !== to && M.infl[sy] > 0) {
      var sx = X(sy), syy = Y(v[sy]), room = Math.min(syy, sy < to ? Y(v[sy + 1]) : syy) - 5, cands = [];
      [[[sy + ': ', 'b'], ['prices ' + signed(M.infl[sy]) + ', the steepest year']], [[sy + ': ', 'b'], [signed(M.infl[sy]) + ', the steepest']]].forEach(function (txt) {
        for (var k = 1; k < 9; k++) [['middle', sx], ['start', sx - 6], ['end', sx + 6]].forEach(function (p) {
          cands.push({ x: p[1], y: room - 4 - k * dy, anchor: p[0], text: txt, extra: function (bx) { return { x: sx - 1, y: bx.y + bx.h, w: 2, h: Math.max(0, room - bx.y - bx.h) }; } });
        });
      });
      var got = P.put('annot', cands, padT - fs);
      if (got) el('line', { x1: sx, x2: sx, y1: got.b.y + got.b.h + 1, y2: syy - 5, 'class': 'leader' }, marks);
    }
    if (n) P.put('lbl', inPlot([12, 17, 24, -fs - 12, -fs - 17].map(function (o) { return { x: W, y: Y(v[to]) - o, anchor: 'end', text: [[money(v[to]), 'b'], [' in ' + to]] }; }).concat(beside(X(to) + 9, X(to) - 9, Y(v[to]) - 12, [[money(v[to]), 'b'], [' in ' + to]], dy, 4))), 0);
    if (!n) P.put('lbl-2', [1, 2, 3, -2, -3].map(function (k) { return { x: W / 2, y: Y(a) + k * fs * 1.6, anchor: 'middle', text: 'Pick an earlier year to draw the line' }; }), 0);

    // the scale: dollar labels at the left edge, above their gridlines or, where a reading sits there, just under them;
    // only a label with no room at the left moves along its gridline
    for (g = gs; g <= top + 1e-9; g += gs) {
      var t = '$' + g.toLocaleString('en-CA'), gy = Y(g), c = [{ x: 0, y: gy - 5, text: t }, { x: 0, y: gy + FS + 11, text: t }, { x: 14, y: gy + FS + 11, text: t }];
      for (var i = 1; i < 12; i++) c.push({ x: (W - FS * 4) * i / 12, y: gy - 5, text: t });
      P.put('tick', c, 0);
    }

    // words for screen readers
    $('chart-title').textContent = 'What ' + typed(a) + ' from ' + from + ' costs in each year’s dollars, ' + from + ' to ' + to;
    $('chart-desc').textContent = 'A line chart. A list of what it shows follows it.';
    var r = M.avg[to] / M.avg[from];
    $('chart-h').textContent = !n ? to + ' is the latest full year here' : r >= 1 ? 'Since ' + from + ', prices rose ' + (fold(r) || Math.round((r - 1) * 100) + '%') : 'Since ' + from + ', prices fell ' + Math.round((1 - r) * 100) + '%';
    $('chart-sub').textContent = 'What ' + typed(a) + ' from ' + from + ' costs in each year’s dollars, by yearly average consumer prices. Point at or tap the line to read a year.';
    var ul = $('chart-text'); ul.textContent = '';
    [typed(a) + ' in ' + from + ' costs about ' + money(v[to]) + ' in ' + to + '.',
      sy != null && sy !== to && M.infl[sy] > 0 ? 'The steepest yearly rise in that span was ' + sy + ', ' + signed(M.infl[sy]) + '.' : 'No later year in the span rose more steeply.',
      'Highest along the way: ' + money(hi) + '.'].forEach(function (s) { ul.appendChild(html('li', null, s)); });
    if (n) dropCross = deskCrosshair(svg, { x0: 0, x1: W, y0: padT, y1: Y(0), read: function (px) {
      var yy = Math.max(from, Math.min(to, Math.round(from + (px - padL) / (W - padR - padL) * n)));
      return { x: X(yy), y: Y(v[yy]), lines: [String(yy), typed(a) + ' from ' + from + ': ' + money(v[yy]), 'That year ' + moved(yy)] };
    } });
  }

  // ---------- Go deeper: borrowing vs prices (drawn when the fold is open) ----------
  var dropCross2 = null;
  function drawRates() {
    var svg = $('rates');
    if (!$('deeper').open) return;
    if (dropCross2) { dropCross2(); dropCross2 = null; }
    clear(svg);
    var W = Math.max(300, Math.floor($('rates-frame').clientWidth)), narrow = W < 640, fs = FS;
    var NY = YEARS.length, step = W / NY;
    var X = function (y) { return (y - M.first) * step; }, CX = function (y) { return X(y) + step / 2; };
    var sel = state.year, scx = CX(sel);
    var marks = el('g', {}, svg), backs = el('g', {}, svg), labels = el('g', {}, svg);
    var P = placer(labels, W, backs), lineGap = Math.ceil(fs * 1.45), dy = fs + 3;

    // the key, wrapping between items (never inside one)
    var kx = 0, sw = fs + 3, base = fs + 2;
    [{ cls: 'line-prices', line: true, text: 'price change' }, { cls: 'line-prime', line: true, text: 'prime rate' },
      { cls: 'gap-pos', text: 'prime above prices' }, { cls: 'gap-neg', text: 'prime below prices' }].forEach(function (k) {
      var kt = el('text', { x: 0, y: base, 'class': 'key-t' }, labels, k.text);
      var w = sw + 6 + kt.getBBox().width;
      if (kx > 0 && kx + w > W) { kx = 0; base += lineGap; }
      if (k.line) el('line', { x1: kx, x2: kx + sw, y1: base - fs / 3, y2: base - fs / 3, 'class': k.cls }, labels);
      else el('rect', { x: kx, y: base - fs + 3, width: sw, height: fs - 3, 'class': k.cls }, labels);
      kt.setAttribute('x', kx + sw + 6); kt.setAttribute('y', base);
      P.fixed(kt, true);
      kx += w + (narrow ? 14 : 20);
    });
    var p2Top = base + 12, p2H = narrow ? 320 : 280, pad2 = fs + 12;
    var vals = [];
    YEARS.forEach(function (y) { vals.push(M.infl[y]); if (M.prime[y] != null) vals.push(M.prime[y]); });
    var lo2 = Math.min.apply(null, vals), hi2 = Math.max.apply(null, vals);
    var Y2 = function (v) { return p2Top + pad2 + (hi2 - v) / (hi2 - lo2) * (p2H - pad2 - 4); };
    var gs = niceStep(hi2 - lo2, narrow ? 4 : 6);
    for (var g = Math.ceil(lo2 / gs) * gs; g <= hi2; g += gs) el('line', { x1: 0, x2: W, y1: Y2(g), y2: Y2(g), 'class': Math.abs(g) < 1e-9 ? 'zero' : 'grid' }, marks);
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
      var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
      P.reserve({ x: X(y), y: lo - 2, w: step, h: hi - lo + 4 });
    });
    var p2Bottom = p2Top + p2H, H = yearTicks(labels, marks, P, X, M.first, M.last + 1, p2Bottom + 6, W);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);

    // the chosen year: one line through the plot, and its readings beside it
    el('line', { x1: scx, x2: scx, y1: p2Top, y2: p2Bottom, 'class': 'sel-halo' }, marks);
    el('line', { x1: scx, x2: scx, y1: p2Top, y2: p2Bottom, 'class': 'sel-line', 'data-year': sel }, marks);
    P.reserve({ x: scx - 2, y: p2Top, w: 4, h: p2H });
    var xr = scx + 9, xl = scx - 9;
    function dot(cx, cy, cls) { el('circle', { cx: cx, cy: cy, r: narrow ? 3.5 : 4.5, 'class': cls }, marks); }
    if (M.prime[sel] != null) {
      dot(scx, Y2(M.prime[sel]), 'dot-prime');
      P.put('lbl', beside(xr, xl, Y2(M.prime[sel]) + fs / 3, [['prime ', 'b'], [pct(M.prime[sel])]], dy, 4));
    }
    dot(scx, Y2(M.infl[sel]), 'dot-prices');
    P.put('lbl', beside(xr, xl, Y2(M.infl[sel]) + fs / 3, [[sel + ' prices ', 'b'], [signed(M.infl[sel])]], dy, 4).concat(beside(xr, xl, Y2(M.infl[sel]) + fs / 3, [['prices ', 'b'], [signed(M.infl[sel])]], dy, 4)));
    if (M.prime[sel] != null) {
      var mid = (Y2(M.prime[sel]) + Y2(M.infl[sel])) / 2;
      P.put('lbl-2', beside(xr, xl, mid + fs / 3, 'real ' + signed(realRate(M, sel)), dy, 6));
    } else {
      P.put('lbl-2', beside(xr, xl, p2Top + pad2 - 2, 'no prime-rate data before ' + M.primeFirst, dy, 1).concat(beside(xr, xl, p2Top + pad2 - 2, 'no prime data yet', dy, 1)));
    }
    // spans when prime was below prices (a negative real rate), labelled above the lines, clear of every mark
    SPANS.forEach(function (s) {
      var highest = Infinity;
      for (var y = s[0]; y <= s[1]; y++) highest = Math.min(highest, Y2(Math.max(M.prime[y], M.infl[y])));
      var a = X(s[0]), b = X(s[1] + 1), c = (a + b) / 2, cands = [];
      var foot = highest - 4, lead = function (bx) { return { x: c - 1, y: bx.y + bx.h, w: 2, h: Math.max(0, foot - bx.y - bx.h - 2) }; };
      ['prime below prices, ' + span(s[0], s[1]), span(s[0], s[1]) + ': below'].forEach(function (text) {
        for (var k = 0; k < 8; k++) [[c, 'middle'], [b, 'end'], [a, 'start']].forEach(function (p) { cands.push({ x: p[0], y: highest - 7 - k * dy, anchor: p[1], text: text, extra: k ? lead : null }); });
      });
      var got = P.put('lbl lbl-neg', cands, p2Top);
      if (got && got.c.extra) el('line', { x1: c, x2: c, y1: got.b.y + got.b.h + 1, y2: foot, 'class': 'leader' }, marks);
    });
    // the prime rate's peak
    var pk = YEARS.filter(function (y) { return M.prime[y] != null; }).reduce(function (a, y) { return M.prime[y] > M.prime[a] ? y : a; });
    var pc = CX(pk), pyy = Y2(M.prime[pk]) - 6;
    P.put('lbl', [['prime rate, peak ' + pct(M.prime[pk]) + ' in ' + pk], ['prime ' + pct(M.prime[pk]) + ' in ' + pk], ['prime rate']].reduce(function (acc, t) {
      return acc.concat([{ x: pc, y: pyy, anchor: 'middle', text: t[0] }, { x: pc - 4, y: pyy, anchor: 'end', text: t[0] }, { x: pc + 4, y: pyy, anchor: 'start', text: t[0] }]);
    }, []), p2Top);
    // scale labels on their gridline at either edge, or at the first clear stretch along it
    function tick(y, t) {
      var c = [{ x: 0, y: y - 4, text: t }, { x: W - 1, y: y - 4, anchor: 'end', text: t }, { x: 0, y: y + fs + 1, text: t }, { x: W - 1, y: y + fs + 1, anchor: 'end', text: t }];
      for (var i = 1; i < 12; i++) c.push({ x: W * i / 12, y: y - 4, text: t });
      P.put('tick', c, p2Top);
    }
    for (var g2 = Math.ceil(lo2 / gs) * gs; g2 <= hi2; g2 += gs) {
      var gv = Math.round(g2 * 1e6) / 1e6;
      tick(Y2(gv), gv === 0 ? '0%' : (gv > 0 ? '+' : MINUS) + Math.abs(gv) + '%');
    }
    var rc = CX(EX.rise), ryy = Y2(M.infl[EX.rise]) - 6;
    P.put('lbl', [{ x: rc + 4, y: ryy, anchor: 'start', text: 'price change' }, { x: rc, y: ryy, anchor: 'middle', text: 'price change' }, { x: rc + 4, y: ryy + dy * 2, anchor: 'start', text: 'price change' }], p2Top);

    $('rates-svg-title').textContent = 'The average prime rate against the yearly price change, ' + M.first + ' to ' + M.last + ', with ' + sel + ' marked';
    $('rates-desc').textContent = 'Two step lines on one axis of years, with the gap between them shaded. A list of what the chart shows follows it.';
    var ul = $('rates-text'); ul.textContent = '';
    ['The average prime rate from ' + M.primeFirst + ' against the yearly price change from ' + M.first + '. Prime peaked at ' + pct(M.prime[pk]) + ' in ' + pk + '.',
      'Prime was below prices in ' + SPANS.map(function (s) { return span(s[0], s[1]); }).join(', ') + '.',
      M.prime[sel] != null ? 'In ' + sel + ': prime ' + pct(M.prime[sel]) + ', prices ' + signed(M.infl[sel]) + ', real rate ' + signed(realRate(M, sel)) + '.' : 'No prime-rate data for ' + sel + '; prices ' + signed(M.infl[sel]) + '.']
      .forEach(function (s) { ul.appendChild(html('li', null, s)); });
    dropCross2 = deskCrosshair(svg, { x0: 0, x1: W, y0: p2Top, y1: p2Bottom, read: function (px) {
      var y = Math.max(M.first, Math.min(M.last, M.first + Math.floor(px / step)));
      var lines = [String(y), 'Prices ' + signed(M.infl[y])];
      if (M.prime[y] != null) lines.push('Prime ' + pct(M.prime[y]), 'Real rate ' + signed(realRate(M, y)));
      else lines.push('No prime-rate data');
      return { x: CX(y), y: Y2(M.prime[y] != null ? Math.max(M.prime[y], M.infl[y]) : M.infl[y]), lines: lines };
    } });
  }

  // ---------- the stripes: every year's price change, a slider you can tap, drag or move with the arrow keys ----------
  var band = $('stripes'), cells = {}, hover = null, readQuiet = 0;
  function buildStripes() {
    YEARS.forEach(function (y) { var s = html('span', 'stripe'); s.setAttribute('data-year', y); band.appendChild(s); cells[y] = s; });
    band.setAttribute('aria-valuemin', M.first); band.setAttribute('aria-valuemax', M.last);
    $('ax-first').textContent = M.first; $('ax-last').textContent = M.last;
    $('stripes-h').textContent = 'Prices rose in ' + C.rose + ' of the ' + C.years + ' years';
    $('stripes-sub').textContent = 'One stripe per year, ' + M.first + ' to ' + M.last + ', by the change in average consumer prices. Tap, drag or use the arrow keys to pick a year.';
  }
  function paintStripes() { var pal = palette(); YEARS.forEach(function (y) { cells[y].style.background = stripeColour(M.infl[y], pal); }); }
  function stripeText(y) { return y + ': ' + moved(y); }
  function stripeRead() {
    var y = hover != null ? hover : state.year, out = $('stripe-read');
    out.setAttribute('aria-busy', 'true'); clearTimeout(readQuiet);
    readQuiet = setTimeout(function () { out.removeAttribute('aria-busy'); }, 250);
    out.textContent = stripeText(y);
    YEARS.forEach(function (yy) { cells[yy].classList.toggle('hover', yy === hover && hover !== state.year); });
  }
  function markStripe() {
    YEARS.forEach(function (y) { cells[y].classList.toggle('you', y === state.year); });
    band.setAttribute('aria-valuenow', state.year); band.setAttribute('aria-valuetext', stripeText(state.year));
    stripeRead();
  }
  function yearAt(clientX) { var r = band.getBoundingClientRect(); return Math.max(M.first, Math.min(M.last, M.first + Math.floor((clientX - r.left) / r.width * YEARS.length))); }
  var dragging = false;
  band.addEventListener('pointerdown', function (e) { dragging = true; try { band.setPointerCapture(e.pointerId); } catch (x) {} hover = null; pick(yearAt(e.clientX)); });
  band.addEventListener('pointermove', function (e) { var y = yearAt(e.clientX); if (dragging) pick(y); else if (e.pointerType === 'mouse') { hover = y; stripeRead(); } });
  ['pointerup', 'pointercancel'].forEach(function (t) { band.addEventListener(t, function () { dragging = false; }); });
  band.addEventListener('pointerleave', function () { if (!dragging) { hover = null; stripeRead(); } });
  band.addEventListener('keydown', function (e) {
    var y = state.year, k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowDown') y--; else if (k === 'ArrowRight' || k === 'ArrowUp') y++;
    else if (k === 'PageDown') y -= TEN; else if (k === 'PageUp') y += TEN;
    else if (k === 'Home') y = M.first; else if (k === 'End') y = M.last; else return;
    e.preventDefault(); hover = null; pick(Math.max(M.first, Math.min(M.last, y)));
  });

  // ---------- the big answer ----------
  var answer = deskReadout('#answer', { format: function (n) { return 'about ' + money(n); } });
  function finding() {
    var y = state.year, a = state.amount, label = typed(a) + ' in ' + y + ', in ' + M.last + ' dollars';
    if (y === M.last) {
      answer.set({ text: typed(a), label: label, line: y + ' is the latest full year here. Pick an earlier one.' });
    } else {
      var v = worth(M, a, y, M.last);
      answer.set({ n: v, label: label, line: 'What cost ' + typed(a) + ' in ' + y + ' cost about ' + money(v) + ' in ' + M.last + '.' });
    }
    $('how').textContent = 'Statistics Canada’s consumer price index averaged ' + M.avg[y].toLocaleString('en-CA', { maximumFractionDigits: 1 }) + ' over the twelve months of ' + y
      + ' and ' + M.avg[M.last].toLocaleString('en-CA', { maximumFractionDigits: 1 }) + ' over ' + M.last + '. ' + typed(a) + ' × '
      + M.avg[M.last].toLocaleString('en-CA', { maximumFractionDigits: 1 }) + ' ÷ ' + M.avg[y].toLocaleString('en-CA', { maximumFractionDigits: 1 }) + ' = ' + money(worth(M, a, y, M.last))
      + '. It follows a typical basket of goods and services; what any one person buys may have risen faster or slower.';
  }
  function chips() {
    var box = $('ychips');
    if (!box.firstChild) {
      var list = (CARRIED != null ? [CARRIED] : []).concat(CHIP_YEARS.filter(function (y) { return y >= M.first && y <= M.last; }));
      list.forEach(function (y, i) {
        var b = html('button', 'ychip', i === 0 && CARRIED != null ? 'Your year: ' + y : String(y));
        b.type = 'button'; b.setAttribute('data-y', y);
        b.addEventListener('click', function () { pick(y); });
        box.appendChild(b);
      });
    }
    [].forEach.call(box.children, function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-y')) === state.year)); });
  }
  function readings() {
    var ul = $('readings'); ul.textContent = '';
    function item(parts) {
      var li = document.createElement('li');
      parts.forEach(function (p) { if (p[1]) li.appendChild(html('strong', null, p[0])); else li.appendChild(document.createTextNode(p[0])); });
      ul.appendChild(li);
    }
    item([['Prices rose in '], [C.rose + ' of the ' + C.years + ' years', 1], [' from ' + M.first + ' to ' + M.last + ', and fell in ' + C.fell + '.']]);
    var lastSpan = SPANS[SPANS.length - 1];
    if (lastSpan) item([['Prime has been below inflation in '], [C.below + ' of the ' + C.primeYears + ' years', 1], [' since ' + M.primeFirst + ', most recently ' + span(lastSpan[0], lastSpan[1]) + '.']]);
    if (state.year !== M.last) {
      var r = M.avg[M.last] / M.avg[state.year];
      item([['Since ' + state.year + ', prices '], [r >= 1 ? (fold(r) ? 'rose ' + fold(r) : 'rose ' + Math.round((r - 1) * 100) + '%') : 'fell ' + Math.round((1 - r) * 100) + '%', 1], [' (yearly average to ' + M.last + ').']]);
    }
    item([['The steepest yearly rise was '], [EX.rise + ', ' + signed(M.infl[EX.rise]), 1], ['; the steepest fall, '], [EX.fall + ', ' + signed(M.infl[EX.fall]), 1], ['.']]);
    if (EX.recent != null) item([[EX.recent + ', at '], [signed(M.infl[EX.recent]), 1], [', was the highest since ' + EX.since + '.']]);
  }
  function yearReadout() {
    var y = state.year, r = realRate(M, y), up = M.infl[y] >= 0;
    $('rk-year').textContent = (state.example ? 'The example year, ' : 'The year you picked, ') + y;
    $('rv-infl').textContent = signed(M.infl[y]);
    $('rv-prime').textContent = M.prime[y] != null ? pct(M.prime[y]) : 'No data';
    $('rv-real').textContent = r != null ? signed(r) : 'No data';
    $('rv-real').classList.toggle('v-pos', r != null && r >= 0); $('rv-real').classList.toggle('v-neg', r != null && r < 0);
    var t;
    if (r == null) t = 'The prime-rate series here starts in ' + M.primeFirst + '. Prices ' + (up ? 'rose ' : 'fell ') + pct(Math.abs(M.infl[y])) + ' in ' + y + '.';
    else if (r >= 0) t = 'Prime was ' + fix1(r) + ' points above the year’s price change: borrowing cost more than prices ' + (up ? 'rose.' : 'moved.');
    else t = 'Prime was ' + fix1(-r) + ' points below the year’s price rise: a negative real rate, as prices rose faster than borrowing cost.';
    $('rt-year').textContent = t;
    var above = C.primeYears - C.below, often = function (n, of, a, b, c) { return n >= of * 0.9 ? a : n > of / 2 ? b : c; };
    $('rates-title').textContent = 'Prime ' + often(above, C.primeYears, 'nearly always ran', 'mostly ran', 'ran less than half the time') + ' above prices';
    $('rates-sub').textContent = 'The average prime rate from ' + M.primeFirst + ' and the yearly price change from ' + M.first + ', % a year. Point at or tap a year to read it.';
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
  function link(href, text) { var a = document.createElement('a'); a.href = href; a.textContent = text; return a; }
  function para(box, parts) {
    var e = document.createElement('p');
    parts.forEach(function (x) { e.appendChild(x.href ? link(x.href, x.text) : document.createTextNode(x)); });
    box.appendChild(e); return e;
  }
  function sources() {
    var box = $('sources'), c = M.meta.cpi, b = M.meta.rate, S = N.source;
    para(box, [{ href: c.source_url, text: c.title }, '. ' + c.source + '. ' + c.licence + '. Snapshot retrieved ' + c.retrieved + '. ' + c.attribution]);
    para(box, [{ href: b.source_url, text: b.title }, '. ' + b.source + '. Snapshot retrieved ' + b.retrieved + '; ', { href: b.terms_url, text: 'the Bank’s terms of use' }, '. ' + b.attribution]);
    para(box, [{ href: S.source_url, text: 'Bank of Canada data' }, ' for This year in money (the policy rate, the posted 5-year mortgage rate, CPI-trim and CPI-median, and USD/CAD). Series retrieved ' + longDate(S.retrieved) + '; ', { href: S.terms_url, text: 'the Bank’s terms of use' }, '. ' + S.attribution]);
    if (N.budgetUrl) para(box, [N.budgetName + ' proposals: Department of Finance Canada, ' + N.budgetName + ', ', { href: N.budgetUrl, text: 'Tax measures: Supplementary information' }, '. Each figure is copied from that page and checked against it; proposals are not law unless enacted.']);
    para(box, ['How it’s made: each year’s price level is the average of its monthly index values, and a year counts only when all its months are in the snapshot. The price change is that average against the year before. The prime rate is the average of a calendar year’s weekly values, for complete years from ' + M.primeFirst + '. The real rate is the year’s average prime rate minus that year’s price change. What an amount is worth in another year is the amount times the ratio of the two years’ average price levels. Past data only; nothing here looks ahead.']);
    para(box, ['#ShowYourStripes warming stripes by Professor Ed Hawkins, University of Reading, CC BY 4.0; this page uses the idea for prices and has nothing to do with climate data.']);
    var foot = $('foot-attr');
    foot.textContent = c.attribution + ' ' + b.attribution + (S.attribution !== b.attribution ? ' ' + S.attribution : '') + ' ';
    foot.appendChild(link(S.terms_url, 'Terms of use')); foot.appendChild(document.createTextNode('.'));
  }

  // ---------- This year in money (#this-year): the budget's proposals, then four measures from January to now ----------
  var LABEL = { policy: 'Bank of Canada rate', mortgage: 'Posted 5-year mortgage', inflation: 'Core inflation (CPI-trim)', loonie: 'US$1 in C$' };
  var COLOUR = { policy: 'd1', mortgage: 'd1', inflation: 'd2', loonie: 'd4' };
  // the value in force on a day: the last point on or before it
  function valueAt(pts, d) { var r = null; for (var i = 0; i < pts.length; i++) { if (pts[i][0] <= d) r = pts[i]; else break; } return r; }
  function fmtN(p, v) { return v.toFixed(p.digits) + p.unit; }
  function spark(p) {
    var Wd = 300, Hd = 64, svg = el('svg', { viewBox: '0 0 ' + Wd + ' ' + Hd, preserveAspectRatio: 'none', 'class': 'spark', 'aria-hidden': 'true', focusable: 'false' });
    var all = p.lines.reduce(function (a, l) { return a.concat(l.points); }, []);
    var t = function (d) { return Date.parse(d + 'T00:00:00Z'); };
    var t0 = Math.min.apply(null, all.map(function (q) { return t(q[0]); })), t1 = Math.max.apply(null, all.map(function (q) { return t(q[0]); }));
    var lo = Math.min.apply(null, all.map(function (q) { return q[1]; })), hi = Math.max.apply(null, all.map(function (q) { return q[1]; }));
    if (hi === lo) { hi += 1; lo -= 1; }
    var sx = function (d) { return (t(d) - t0) / Math.max(1, t1 - t0) * Wd; }, sy = function (v) { return 6 + (hi - v) / (hi - lo) * (Hd - 12); };
    p.lines.forEach(function (l) {
      var d = '';
      l.points.forEach(function (q, i) { var x = sx(q[0]).toFixed(1), y = sy(q[1]).toFixed(1); if (!i) d = 'M' + x + ' ' + y; else d += (p.step ? ' H' + x + ' V' + y : ' L' + x + ' ' + y); });
      el('path', { d: d, 'class': 'spark-line c-' + (COLOUR[p.id] || 'd1') + (l.dashed ? ' dashed' : ''), 'vector-effect': 'non-scaling-stroke' }, svg);
    });
    // Budget Day, as on the money-year page: one dashed upright line through every measure (named in the line under them)
    if (N.budgetDay && t(N.budgetDay) >= t0 && t(N.budgetDay) <= t1) el('line', { x1: sx(N.budgetDay), x2: sx(N.budgetDay), y1: 0, y2: Hd, 'class': 'spark-budget', 'vector-effect': 'non-scaling-stroke' }, svg);
    // the callouts' points (the rate decisions, the highs and lows), as short ticks on the line
    (p.callouts || []).forEach(function (c) { var x = sx(c.d), y = sy(c.v); el('line', { x1: x, x2: x, y1: y - 7, y2: y + 7, 'class': 'spark-mark', 'vector-effect': 'non-scaling-stroke' }, svg); });
    return svg;
  }
  function thisYear() {
    if (!N) { $('this-year').hidden = true; $('ty-link').hidden = true; return; }
    $('ty-sub').textContent = N.year + ' so far' + (N.proposals.length && N.budgetName ? ', and what ' + N.budgetName + ' proposes' : '');
    // the proposals first, each labelled as a proposal
    var ol = $('proposals');
    if (!N.proposals.length) $('budget').hidden = true;
    else {
      $('h-budget').textContent = 'What ' + N.budgetName + ' proposes';
      var lede = $('budget-lede');
      lede.append(count(N.proposals.length) + ' measures, in the order they would start. Proposed, not yet law: each becomes law only if enacted. Each figure is copied from the budget’s ');
      lede.appendChild(link(N.budgetUrl, 'tax measures')); lede.append(' and checked against that page.');
      N.proposals.forEach(function (p) {
        var li = html('li', 'card');
        li.append(html('p', 'when', p.when), html('h3', null, p.title), html('p', 'value', p.value), html('p', 'detail', p.detail),
          html('p', 'stamp', p.stamp ? p.stamp + ', not yet law' : 'Proposed, not yet law'));
        ol.appendChild(li);
      });
    }
    // then the four measures: the year's finding (from the policy rate's decisions) and the other three in one lede, as
    // the money-year page said them, then where each began the year and where it is now
    $('h-measures').textContent = count(N.panels.length) + ' measures this year';
    var panel = function (id) { return N.panels.filter(function (p) { return p.id === id; })[0]; };
    var pol = panel('policy'), dec = pol ? pol.decisions || [] : [];
    var fin = !pol ? '' : !dec.length ? 'The Bank of Canada held its policy rate at ' + pol.summary.to + ' all of ' + N.year + ' so far.'
      : dec.length === 1 ? 'The Bank of Canada held its policy rate at ' + pol.summary.from + ' until ' + longDate(dec[0].d).replace(/, \d{4}$/, '') + ', then ' + (dec[0].to > dec[0].from ? 'raised' : 'cut') + ' it to ' + pol.summary.to + '.'
        : 'The Bank of Canada changed its policy rate ' + dec.length + ' times in ' + N.year + ', from ' + pol.summary.from + ' to ' + pol.summary.to + '.';
    $('ty-finding').textContent = fin; $('ty-finding').hidden = !fin;
    var out = [], num = parseFloat, move = function (s, up, down) { return num(s.to) > num(s.from) ? up : num(s.to) < num(s.from) ? down : null; };
    var mor = panel('mortgage'), inf = panel('inflation'), fx = panel('loonie'), w;
    if (mor) { w = move(mor.summary, 'rose', 'fell'); out.push(w ? 'posted 5-year mortgage rates ' + w + ' from ' + mor.summary.from + ' to ' + mor.summary.to : 'posted 5-year mortgage rates stood at ' + mor.summary.to); }
    if (inf) { w = move(inf.summary, 'rose', 'eased'); out.push(w ? 'core inflation (' + inf.summary.label + ') ' + w + ' from ' + inf.summary.from + ' to ' + inf.summary.to : 'core inflation (' + inf.summary.label + ') stood at ' + inf.summary.to); }
    if (fx) { w = move(fx.summary, 'weakened', 'strengthened'); out.push(w ? 'the loonie ' + w + ': a US dollar went from ' + fx.summary.from + ' to ' + fx.summary.to + ' Canadian dollars' : 'a US dollar cost ' + fx.summary.to + ' Canadian dollars'); }
    var last = out.pop();
    $('measures-lede').textContent = (last ? 'Over the same months, ' + (out.length ? out.join(', ') + ', and ' : '') + last + '. ' : '') + 'Where each began ' + N.year + ' and its latest reading, from Bank of Canada data to ' + longDate(N.retrieved) + '.';
    var ul = $('pairs');
    N.panels.forEach(function (p) {
      var pts = p.lines[0].points, a = pts[0][0], b = pts[pts.length - 1][0], when = p.monthly ? [monthYear(a), monthYear(b)] : [longDate(a), longDate(b)];
      var li = html('li', 'pair c-' + (COLOUR[p.id] || 'd1'));
      var k = html('p', 'pair-k', LABEL[p.id] || p.title);
      var v = html('p', 'pair-v'); v.append(html('span', null, p.summary.from), html('span', 'arr', ' ' + ARROW + ' '), html('span', 'to', p.summary.to));
      li.append(k, v, html('p', 'pair-when', when[0] + ' ' + ARROW + ' ' + when[1]), spark(p));
      // the lines named, with their latest values, where a measure has more than one (CPI-trim solid, CPI-median dashed)
      if (p.lines.length > 1) li.append(html('p', 'pair-key', p.lines.map(function (l) { var q = l.points[l.points.length - 1]; return (l.dashed ? 'Dashed: ' : 'Solid: ') + l.label + ', ' + fmtN(p, q[1]) + ' in ' + monthYear(q[0]); }).join('. ') + '.'));
      // the callouts the money-year charts carried: the rate decisions, the highs and the lows (ticks on the line)
      if ((p.callouts || []).length) li.append(html('p', 'pair-marks', p.callouts.map(function (c) { return c.mark ? c.text : c.text + ' (' + longDate(c.d).replace(/, \d{4}$/, '') + ')'; }).join(' · ')));
      li.append(html('p', 'pair-note', p.note));
      ul.appendChild(li);
    });
    $('ty-asof').textContent = 'Data to ' + longDate(N.retrieved) + '. Ticks on a line mark the readings named under it.' + (N.budgetDay ? ' The dashed upright line marks ' + (N.budgetName || 'the budget') + ', ' + longDate(N.budgetDay) + '.' : '');
    // the numbers, month by month: each series at the end of every month so far (the last value in force that day)
    var series = []; N.panels.forEach(function (p) { p.lines.forEach(function (l) { series.push({ p: p, l: l }); }); });
    var head = $('ty-head'), th = html('th', null, 'End of month'); th.scope = 'col'; head.appendChild(th);
    series.forEach(function (x) { var c = html('th', null, x.l.label); c.scope = 'col'; head.appendChild(c); });
    for (var m = 1; m <= 12; m++) {
      var eom = new Date(Date.UTC(N.year, m, 0)).toISOString().split('T')[0], d = eom > N.retrieved ? N.retrieved : eom;
      if (d < N.year + '-' + String(m).padStart(2, '0') + '-01') break;
      var tr = document.createElement('tr'), rh = html('th', null, longDate(d)); rh.scope = 'row'; tr.appendChild(rh);
      series.forEach(function (x) { var q = valueAt(x.l.points, d); tr.appendChild(html('td', null, q ? fmtN(x.p, q[1]) : '–')); });
      $('ty-rows').appendChild(tr);
    }
    var at = $('ty-attr'); at.textContent = N.source.attribution + ' '; at.appendChild(link(N.source.terms_url, 'Terms of use')); at.append('.');
  }
  function openThisYear(scroll) {
    var d = $('this-year');
    if (!d.open) d.open = true;
    if (scroll) d.scrollIntoView({ block: 'start' });
  }
  $('ty-link').addEventListener('click', function () { openThisYear(false); });
  addEventListener('hashchange', function () { if (location.hash === '#this-year') openThisYear(true); });

  // ---------- one render ----------
  var guess = null, acted = false;
  function render(user) {
    finding(); chips(); yearReadout(); readings(); markStripe(); drawWorth(); drawRates();
    Array.prototype.forEach.call(document.querySelectorAll('#rows tr.sel'), function (tr) { tr.classList.remove('sel'); });
    var row = document.querySelector('#rows tr[data-year="' + state.year + '"]'); if (row) row.classList.add('sel');
    // the one assumptions line, beside the control
    $('example-note').textContent = (state.example ? 'An example: ' + typed(EXAMPLE_AMOUNT) + ' in ' + EXAMPLE_YEAR + '. ' : 'Showing ' + typed(state.amount) + ' from ' + state.year + '. ')
      + 'By yearly average consumer prices; what you type stays here.';
    $('q-amount').textContent = typed(state.amount);
    $('tag-example').hidden = !state.example;
    if (user && !acted) { acted = true; if (guess) guess.show(); }
  }
  // a year picked by a chip or a stripe: the field follows
  function pick(y) {
    if (y === state.year && !state.example) { stripeRead(); return; }
    state.year = y; state.example = false; year.value = String(y); $('error').hidden = true; render(true);
  }

  // ---------- controls: live, no button ----------
  var year = $('year'), amount = $('amount');
  year.min = String(M.first); year.max = String(M.last); year.value = String(state.year); amount.value = String(EXAMPLE_AMOUNT);
  function readInputs(strict) {
    var y = Number(year.value), a = Number(amount.value), err = $('error');
    var yOk = !!year.value && Number.isInteger(y) && y >= M.first && y <= M.last, aOk = !!amount.value && isFinite(a) && a > 0 && a <= 1e12;
    if (!yOk && year.value.length >= 4) strict = true;
    if (!yOk || !aOk) {
      if (strict) { err.textContent = !yOk ? 'Pick a year from ' + M.first + ' to ' + M.last + '.' : 'Type an amount above zero, like ' + EXAMPLE_AMOUNT + '.'; err.hidden = false; }
      return;
    }
    err.hidden = true;
    var na = Math.round(a * 100) / 100;
    if (y === state.year && na === state.amount && !state.example) return;
    state.year = y; state.amount = na; state.example = false; render(true);
  }
  [year, amount].forEach(function (f) {
    f.addEventListener('input', function () { readInputs(false); });
    f.addEventListener('change', function () { readInputs(true); });
    f.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); readInputs(true); } });
  });

  // ---------- save the chart as an image, made in the browser (shared, then downloaded) ----------
  deskSaveButton($('save'), function () {
    return new Promise(function (resolve, reject) {
      var svg = $('chart'), clone = svg.cloneNode(true), W = Number(svg.getAttribute('width')), H = Number(svg.getAttribute('height'));
      clone.setAttribute('xmlns', NS);
      var src = svg.querySelectorAll('*'), dst = clone.querySelectorAll('*');
      for (var i = 0; i < src.length; i++) {
        var cs = getComputedStyle(src[i]);
        ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'font-size', 'font-weight', 'paint-order', 'stroke-linejoin'].forEach(function (p) { dst[i].style.setProperty(p, cs.getPropertyValue(p)); });
        if (dst[i].nodeName === 'text') dst[i].style.setProperty('font-family', 'Helvetica, Arial, sans-serif');
      }
      var pad = 32, top = 44, foot = 64, img = new Image(), data = new XMLSerializer().serializeToString(clone);
      img.onload = function () {
        var c = document.createElement('canvas'), k = 2; c.width = (W + pad * 2) * k; c.height = (H + top + pad + foot) * k;
        var g = c.getContext('2d'); g.scale(k, k); g.fillStyle = tok('ground'); g.fillRect(0, 0, W + pad * 2, H + top + pad + foot);
        g.fillStyle = tok('ink'); g.font = '600 22px Georgia, serif'; g.fillText($('finding').textContent, pad, pad + 6, W);
        g.drawImage(img, pad, pad + top - 16, W, H);
        g.fillStyle = tok('ink3'); g.font = '16px Helvetica, Arial, sans-serif';
        g.fillText('Money, then and now. ' + M.meta.cpi.attribution, pad, H + top + pad + 9, W);
        g.fillText(M.meta.rate.attribution + ' Education only, not advice. Mohammed El Chayeb.', pad, H + top + pad + 32, W);
        c.toBlob(function (b) { if (b) resolve({ blob: b, name: 'money-then-now-' + state.year + '.png', title: $('finding').textContent }); else reject(new Error('no image')); }, 'image/png');
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
    });
  });

  // ---------- guess, then reveal: shown after the visitor's first result, always skippable ----------
  var gAns = worth(M, EXAMPLE_AMOUNT, M.first, M.last), gStep = niceStep(gAns, 40), gMax = Math.ceil(gAns * 2 / gStep) * gStep;
  guess = deskGuess('#guess', {
    question: 'Now guess: what did ' + typed(EXAMPLE_AMOUNT) + ' from ' + M.first + ' cost in ' + M.last + '?',
    min: EXAMPLE_AMOUNT, max: gMax, step: gStep, start: EXAMPLE_AMOUNT + Math.round((gMax - EXAMPLE_AMOUNT) / 4 / gStep) * gStep,
    format: function (n) { return money(n); }, answer: function () { return gAns; },
    reveal: function (g, a) {
      var off = Math.abs(g - a) / a;
      return 'About ' + money(a) + '. You guessed ' + money(g) + (off <= 0.1 ? ', within a tenth of it.' : g < a ? ': prices rose further than that.' : ': prices rose less than that.') + ' Tap ' + M.first + ' on the stripes to see the line.';
    },
  });

  buildStripes(); paintStripes(); table(); sources(); thisYear(); render(false); deskDeeper();
  if (location.hash === '#this-year') { openThisYear(true); addEventListener('load', function () { openThisYear(true); }); }
  // The first fill is not a change: drop the underline the shared layer gives a readout whose text changes (its observer
  // runs first, in the same microtask queue), so only what the reader's own choice changes is underlined.
  Promise.resolve().then(function () { return 0; }).then(function () { Array.prototype.forEach.call(document.querySelectorAll('[data-flash].flash'), function (e) { e.classList.remove('flash'); }); });
  $('deeper').addEventListener('toggle', drawRates);
  function redraw() { drawWorth(); drawRates(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  new MutationObserver(function () { paintStripes(); redraw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  var rt, lastW = $('chart-frame').clientWidth;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if ($('chart-frame').clientWidth !== lastW) { lastW = $('chart-frame').clientWidth; redraw(); } }, 120); });
})();
