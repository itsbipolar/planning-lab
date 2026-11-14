// Your year (planning timeline). The model (rules, limits, factors and the population snapshot) is embedded in #data and the
// calculations come from model.mjs and the shared core (shared/desk/your-year-core.mjs), inlined above this script.
// The birth year the visitor sets is kept for this visit only in sessionStorage 'mo.year' (a 4-digit year), so Money,
// then and now and Retirement wave can open on it; <head> reads it into <html data-year> before this script runs. It is
// never put in the address and never sent anywhere. The only file this page makes is the card the visitor asks to save.
// Redesign v2 (Your year): one year control (stepper, input, chips; live, no submit button), one big answer (what $100
// from that year costs now, from the shared core, as on the site's home lead), the box score in the tense for the
// visitor's year, one life line chart; the RRIF curve and the CPP and OAS totals sit in the closed Go deeper.
(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('data').textContent);
  var M = D.model;
  var R = M.r;
  var EXAMPLE_BIRTH = EXAMPLE_BIRTH_YEAR, EXAMPLE_INCOME = 110000, EXAMPLE_FUND = 500000;
  var thisYear = new Date().getFullYear();
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };
  var money = function (v) { return '$' + Math.round(v).toLocaleString('en-CA'); };
  var pct = function (v, dp) { return (Math.round(v * Math.pow(10, dp || 0)) / Math.pow(10, dp || 0)).toLocaleString('en-CA', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 }) + '%'; };
  var signed = function (v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + pct(Math.abs(v)); };
  var ageText = function (a) { var y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); return m ? y + ' years ' + m + ' month' + (m > 1 ? 's' : '') : String(y); };
  var col = function (name) { return getComputedStyle(document.documentElement).getPropertyValue('--t-' + name).trim(); };
  // the highlight: amber on the dark ground, its deep shade on the light ground so lines and words keep their contrast
  var pick = function () { return document.documentElement.getAttribute('data-theme') === 'light' ? col('point-deep') : col('point'); };
  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(svg) { Array.prototype.slice.call(svg.childNodes).forEach(function (c) { if (c.nodeName !== 'title') svg.removeChild(c); }); }

  var LAST = M.rrif[M.rrif.length - 1].age;
  var lo = R.tfsaAge, hi = LAST + 1;
  // the date the rules were last read at their sources, for the assumptions line
  var asOf = M.sources.map(function (s) { return s.as_of; }).sort().pop();
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var asOfText = MONTHS[Number(asOf.slice(5, 7)) - 1] + ' ' + asOf.slice(0, 4);
  var state = { birth: EXAMPLE_BIRTH, example: true, cpp: R.cppHi, oas: R.oasHi, income: EXAMPLE_INCOME, fund: EXAMPLE_FUND };
  // The control's bounds (the plan's stepper, as on the home lead): from YEAR_MIN to the youngest year whose TFSA opens
  // by the last confirmed limit (that year minus the TFSA age), so every year offered has a sum to show. The chips are
  // jump points, not rules.
  var YEAR_MIN = 1930, CHIPS = [1960, 1970, 1980, 1990, 2000];
  var YEAR_MAX = Math.max.apply(null, Object.keys(M.tfsa).map(Number)) - R.tfsaAge;
  if (M.prices) YEAR_MIN = Math.max(YEAR_MIN, M.prices.first);
  var valid = function (y) { return Number.isInteger(y) && y >= YEAR_MIN && y <= YEAR_MAX; };
  // the year carried from this visit (set on <html data-year> by the <head> script); anything else shows the example
  var carried = Number(document.documentElement.getAttribute('data-year'));
  if (valid(carried)) { state.birth = carried; state.example = false; }
  function remember(y) { try { sessionStorage.setItem('mo.year', String(y)); } catch (e) { /* storage blocked: the year stays in this page */ } if (window.deskYearChip) window.deskYearChip(); }

  // ---------- the timeline ----------
  // Every label and reading is drawn last, with a ground-coloured halo, so the "you are here" line breaks behind it and
  // no word sits on a bar.
  function halo(attrs) { attrs.stroke = col('ground'); attrs['stroke-width'] = 4; attrs['stroke-linejoin'] = 'round'; attrs['paint-order'] = 'stroke'; return attrs; }
  function backed(t) { var bb = t.getBBox(), r = el('rect', { 'class': 'backing', x: bb.x - 3, y: bb.y - 1, width: bb.width + 6, height: bb.height + 2, fill: col('ground') }); t.parentNode.insertBefore(r, t); return t; }
  function drawTimeline(p) {
    var svg = $('tl'); clear(svg);
    var W = Math.max(320, $('tl-frame').clientWidth), narrow = W < 640;
    // chart text at 17.5px (labels 17.5px or more; Mo: never smaller), drawn at the frame's real width so nothing scales down
    var fs = 17.5, small = 17.5, barH = 20;
    var padL = 4, padR = narrow ? 14 : 24, top = 40;
    var tfsaH = 66, laneH = 94, rrifH = narrow ? 128 : 118, axisH = 58;
    var H = top + tfsaH + laneH * 2 + rrifH + axisH;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    var x = function (a) { return padL + (a - lo) / (hi - lo) * (W - padL - padR); };
    var ink = col('ink'), ink2 = col('ink2'), ink3 = col('ink3'), rule = col('rule'), ground = col('ground');
    var d1 = col('d1'), d3 = col('d3'), d4 = col('d4'), neutral = col('neutral'), point = pick();
    var defs = el('defs', {}, svg);
    function grad(id, stops) { var g = el('linearGradient', { id: id, x1: 0, x2: 1, y1: 0, y2: 0 }, defs); stops.forEach(function (s) { el('stop', { offset: s[0], 'stop-color': s[1] }, g); }); }
    var stdAt = (R.cppStd - R.cppLo) / (R.cppHi - R.cppLo);
    grad('g-cpp', [[0, d4], [stdAt, neutral], [1, d1]]);
    grad('g-oas', [[0, neutral], [1, d1]]);
    var texts = [];
    function label(y, name, detail) { texts.push(function () {
      var t = el('text', halo({ x: padL, y: y, fill: ink, 'font-size': fs + 1, 'font-weight': 700 }), svg, name);
      if (detail) el('tspan', { fill: ink2, 'font-weight': 400 }, t, '  ' + detail);
      backed(t);
    }); }
    function reading(xx, y, str, anchor) { texts.push(function () { backed(el('text', halo({ x: xx, y: y, fill: ink2, 'font-size': fs, 'text-anchor': anchor || 'start' }), svg, str)); }); }
    var bar = function (y) { return y + 30; }, below = function (y) { return y + 30 + barH + fs + 7; };
    var lanes = []; var y = top;
    // TFSA
    var t = p.lanes[0];
    label(y + 19, 'TFSA', t.open ? (narrow ? 'room ' + money(t.room) + ' since ' + t.startYear : 'room since ' + t.startYear + ': ' + money(t.room) + ' by ' + t.roomTo) : 'room starts in ' + t.startYear);
    if (t.from < hi) el('rect', { x: x(Math.max(lo, t.from)), y: bar(y), width: x(hi) - x(Math.max(lo, t.from)), height: barH, fill: d3 }, svg);
    lanes.push(['TFSA', t.open ? 'Contribution room has built up since ' + t.startYear + ': ' + money(t.room) + ' in all by ' + t.roomTo + ', if you lived in Canada and were old enough.' : 'Contribution room starts in ' + t.startYear + '.']);
    y += tfsaH;
    // CPP: the gradient's meaning is written on the chart, under the bar and never on it: start early, a smaller cheque;
    // wait, a bigger one. The percentages sit in the lane's label.
    var cLo = (cppShareAt(R.cppLo) - 1) * 100, cHi = (cppShareAt(R.cppHi) - 1) * 100;
    label(y + 19, 'CPP', narrow ? signed(cLo) + ' at ' + R.cppLo + ' · ' + signed(cHi) + ' at ' + R.cppHi
      : 'start any month from ' + R.cppLo + ' to ' + R.cppHi + ' (' + p.cpp.opens + '–' + p.cpp.closes + ' for you): ' + signed(cLo) + ' a month at ' + R.cppLo + ', ' + signed(cHi) + ' at ' + R.cppHi);
    el('rect', { x: x(R.cppLo), y: bar(y), width: x(R.cppHi + 1) - x(R.cppLo), height: barH, fill: 'url(#g-cpp)' }, svg);
    var gy = below(y);
    texts.push(function () {
      var a1 = narrow ? { x: padL, anchor: 'start' } : { x: x(R.cppLo) - 8, anchor: 'end' }, b1 = narrow ? { x: W - padR, anchor: 'end' } : { x: x(R.cppHi + 1) + 8, anchor: 'start' };
      var l = backed(el('text', halo({ 'class': 'grad-l', x: a1.x, y: gy, fill: ink, 'font-size': fs, 'text-anchor': a1.anchor }), svg, 'Start early: smaller cheque'));
      var r = backed(el('text', halo({ 'class': 'grad-r', x: b1.x, y: gy, fill: ink, 'font-size': fs, 'text-anchor': b1.anchor }), svg, 'Wait: bigger'));
      // too tight on a narrow phone: the shorter pair
      var lb = l.getBBox(), rb = r.getBBox();
      if (lb.x + lb.width + 10 > rb.x) { l.textContent = 'Early: smaller'; l.previousSibling.setAttribute('width', l.getBBox().width + 6); }
    });
    el('line', { x1: x(R.cppStd), x2: x(R.cppStd), y1: bar(y) - 2, y2: bar(y) + barH + 2, stroke: ink, 'stroke-width': 1.5, 'stroke-dasharray': '3 2' }, svg);
    lanes.push(['CPP', 'Can start in any month from age ' + R.cppLo + ' to ' + R.cppHi + ' (' + p.cpp.opens + ' to ' + p.cpp.closes + ' for you): at ' + R.cppLo + ' a ' + pct(Math.abs(cLo)) + ' smaller cheque, for life; at ' + R.cppHi + ' ' + pct(cHi) + ' bigger.']);
    y += laneH;
    // OAS
    var oHi = (oasShareAt(R.oasHi) - 1) * 100;
    label(y + 19, 'OAS', narrow ? 'start ' + R.oasLo + '–' + R.oasHi : 'start any month from ' + R.oasLo + ' to ' + R.oasHi + ' (' + p.oas.opens + '–' + p.oas.closes + ' for you)');
    el('rect', { x: x(R.oasLo), y: bar(y), width: x(R.oasHi + 1) - x(R.oasLo), height: barH, fill: 'url(#g-oas)' }, svg);
    reading(x(R.oasHi + 1), below(y), signed(oHi), 'end');
    if (M.oasBoostAge > R.oasHi && M.oasBoostAge < hi) {
      el('rect', { x: x(M.oasBoostAge), y: bar(y), width: x(hi) - x(M.oasBoostAge), height: barH, fill: d1, opacity: 0.35 }, svg);
      reading(x(M.oasBoostAge), below(y), '+' + pct(R.oasBoost) + ' from ' + M.oasBoostAge);
    }
    lanes.push(['OAS', 'Can start from ' + R.oasLo + ', or later up to ' + R.oasHi + ' for ' + signed(oHi) + ' a month; the pension rises by ' + pct(R.oasBoost) + ' from age ' + M.oasBoostAge + '.']);
    y += laneH;
    // RRSP, then RRIF minimums as a staircase (a savings account, so the same data colour as the TFSA)
    label(y + 19, 'RRSP, then RRIF', narrow ? 'winds up by ' + p.rrsp.matures : 'an RRSP must wind up by the end of the year you turn ' + R.rrsp + ' (' + p.rrsp.matures + ' for you)');
    var base = y + rrifH - 4, maxF = Math.max.apply(null, M.rrif.map(function (r) { return r.factor; })), tall = rrifH - 66, band = 12;
    el('rect', { x: x(lo), y: base - band, width: x(R.rrsp + 1) - x(lo), height: band, fill: d3, opacity: 0.45 }, svg);
    M.rrif.forEach(function (r) {
      if (r.age < R.rrsp || r.age + 1 >= hi) return; // the factor for an age on January 1 applies in the year you turn one more
      var h = Math.max(2, r.factor / maxF * tall), ax = r.age + 1;
      el('rect', { x: x(ax), y: base - h, width: Math.max(1, x(ax + 1) - x(ax) - 1), height: h, fill: d3 }, svg);
    });
    var first = M.rrif.filter(function (r) { return r.age >= R.rrsp; })[0], last = M.rrif[M.rrif.length - 1];
    reading(x(first.age + 1) - 4, base - band - 6, pct(first.factor * 100, 2) + ' turning ' + (first.age + 1), 'end');
    reading(x(hi), base - tall - 7, pct(last.factor * 100, 0) + ' from ' + (last.age + 1), 'end');
    lanes.push(['RRSP and RRIF', 'An RRSP must wind up by the end of ' + p.rrsp.matures + ', the year you turn ' + R.rrsp + ' (most become a RRIF). ' + rrifRule(M)]);
    // the axis: ages, and the calendar years they fall in for this person
    var ay = H - axisH + 6;
    el('line', { x1: x(lo), x2: x(hi), y1: ay, y2: ay, stroke: rule }, svg);
    var step = Math.round((hi - lo) / (narrow ? 4 : 8));
    for (var a = Math.ceil(lo / step) * step; a < hi; a += step) {
      if (a - lo < step / 2) continue;
      el('line', { x1: x(a), x2: x(a), y1: ay, y2: ay + 5, stroke: ink3 }, svg);
      el('text', { x: x(a), y: ay + 21, fill: ink2, 'font-size': small, 'text-anchor': 'middle' }, svg, String(a));
      el('text', { x: x(a), y: ay + 46, fill: ink3, 'font-size': small, 'text-anchor': 'middle' }, svg, String(p.birthYear + a));
    }
    el('text', { x: padL, y: ay + 21, fill: ink3, 'font-size': small }, svg, 'age');
    el('text', { x: padL, y: ay + 46, fill: ink3, 'font-size': small }, svg, 'year');
    // you are here: the years behind are muted; the line is drawn under every label, which breaks it with its halo
    if (p.age > lo) {
      var yx = x(Math.min(hi, p.age));
      el('rect', { 'class': 'wash', x: x(lo), y: top + 20, width: yx - x(lo), height: H - axisH - top - 14, fill: ground, opacity: 0.62 }, svg);
      if (p.age < hi) {
        el('line', { 'class': 'here', x1: yx, x2: yx, y1: 20, y2: H - axisH + 6, stroke: point, 'stroke-width': 2 }, svg);
        texts.push(function () { backed(el('text', halo({ 'class': 'today', x: yx, y: 16, fill: ink, 'font-size': fs + 1, 'font-weight': 700, 'text-anchor': yx > W * 0.8 ? 'end' : yx < W * 0.2 ? 'start' : 'middle' }), svg, 'Today, age ' + p.age)); });
      }
    }
    texts.forEach(function (f) { f(); });
    $('tl-title').textContent = 'Planning timeline for someone born in ' + p.birthYear + ', aged ' + p.age + ' in ' + p.thisYear;
    $('tl-take').textContent = 'Every rule on one line, by age, for someone born in ' + p.birthYear;
    $('tl-example').hidden = !state.example;
    var ul = $('tl-text'); ul.textContent = '';
    lanes.forEach(function (l) { var li = document.createElement('li'); li.textContent = l[0] + ': ' + l[1]; ul.appendChild(li); });
  }

  // ---------- shares and totals ----------
  function cppShareAt(a) { return 1 + (a < R.cppStd ? -(R.cppStd - a) * 12 * R.cppRed : (a - R.cppStd) * 12 * R.cppInc) / 100; }
  function oasShareAt(a) { return 1 + (a - R.oasLo) * 12 * R.oasInc / 100; }
  function cppTotal(a, xAge) { return Math.max(0, xAge - a) * cppShareAt(a); }
  function oasTotal(a, xAge) { return oasShareAt(a) * (Math.max(0, xAge - a) + R.oasBoost / 100 * Math.max(0, xAge - Math.max(a, M.oasBoostAge))); }
  function crossing(fA, fB, from) { // first age where fA(x) >= fB(x) after the start, scanned by month
    for (var xa = from; xa <= hi + 20; xa += 1 / 12) if (fA(xa) >= fB(xa) && fB(xa) > 0) return xa;
    return null;
  }

  // ---------- a small two-line chart of totals ----------
  // Chart text is set in CSS pixels (the SVG is drawn at its real width), at 17px (the one size rule: 16.5px or more). Line names sit in the
  // right margin past the line ends; the crossing age sits above-left of its dot, clear of both lines.
  var ageShort = function (a) { var y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); return m ? y + ' y ' + m + ' m' : String(y); };
  function chartBox(svg, narrowH, wideH) {
    var W = Math.max(280, Math.floor(svg.parentNode.clientWidth));
    var H = W < 520 ? narrowH : Math.round(Math.min(wideH, Math.max(narrowH, W * 0.34)));
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    return [W, H];
  }
  // a sentence with one figure set in bold (and underlined briefly when it changes)
  // the same three nodes are kept, so the bold figure is the one that is underlined when it changes
  function sentence(node, before, figure, after) {
    if (!node._b) {
      node.textContent = ''; node._pre = document.createTextNode(''); node._b = document.createElement('b'); node._post = document.createTextNode('');
      node._b.setAttribute('data-flash', ''); node.appendChild(node._pre); node.appendChild(node._b); node.appendChild(node._post);
      if (window.deskWatchFlash) window.deskWatchFlash(node._b);
    }
    node._pre.textContent = before; node._b.textContent = figure == null ? '' : figure; node._post.textContent = after || '';
  }
  var oneDp = function (v) { return (Math.round(v * 10) / 10).toLocaleString('en-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
  function totalsChart(svg, fa, fb, aLabel, bLabel, startA, startB, cross) {
    if (svg._unhair) svg._unhair();
    clear(svg);
    var box = chartBox(svg, 250, 310), W = box[0], H = box[1], pl = 34, pr = W < 520 ? 128 : 140, pt = 32, pb = 39;
    var x0 = Math.min(startA, startB), x1 = hi;
    var ymax = Math.max(fa(x1), fb(x1)) || 1;
    var X = function (v) { return pl + (v - x0) / (x1 - x0) * (W - pl - pr); }, Y = function (v) { return H - pb - v / ymax * (H - pt - pb); };
    var ink3 = col('ink3'), rule = col('rule');
    el('line', { x1: pl, x2: W - pr, y1: H - pb, y2: H - pb, stroke: rule }, svg);
    var step = Math.round((x1 - x0) / (W < 520 ? 4 : 6));
    for (var a = Math.ceil(x0 / step) * step; a <= x1; a += step) el('text', { x: X(a), y: H - 8, fill: ink3, 'font-size': 17.5, 'text-anchor': 'middle' }, svg, String(a));
    el('text', { x: pl, y: pt - 14, fill: ink3, 'font-size': 17.5 }, svg, Math.round(ymax) + ' years of pension');
    el('text', { x: pl - 6, y: H - pb + 5, fill: ink3, 'font-size': 17.5, 'text-anchor': 'end' }, svg, '0');
    function path(f, start, color, width) {
      var d = 'M' + X(start) + ' ' + Y(0); for (var v = start; v <= x1; v += 0.25) d += ' L' + X(v).toFixed(1) + ' ' + Y(f(v)).toFixed(1);
      el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linejoin': 'round' }, svg);
    }
    var same = Math.abs(startA - startB) < 1e-9;
    if (!same) path(fb, startB, col('d1'), 2);
    path(fa, startA, pick(), 3);
    // names at the line ends, kept at least a line apart and inside the plot
    var ends = [{ y: Y(fa(x1)) + 4, t: aLabel, c: pick(), w: 700 }];
    if (!same) ends.push({ y: Y(fb(x1)) + 4, t: bLabel, c: col('d1'), w: 650 });
    ends.sort(function (p, q) { return p.y - q.y; });
    if (ends.length > 1 && ends[1].y - ends[0].y < 24) { var mid = (ends[0].y + ends[1].y) / 2; ends[0].y = mid - 12; ends[1].y = mid + 12; }
    var shift = Math.max(0, pt + 6 - ends[0].y); ends.forEach(function (e) { e.y += shift; });
    ends.forEach(function (e) { el('text', halo({ x: W - pr + 8, y: e.y, fill: e.c, 'font-size': 17.5, 'font-weight': e.w }), svg, e.t); });
    if (cross != null && cross < x1) {
      var cx = X(cross), cy = Y(fa(cross));
      el('circle', { cx: cx, cy: cy, r: 5, fill: col('ground'), stroke: col('ink'), 'stroke-width': 2 }, svg);
      var ct = el('text', halo({ x: cx - 9, y: cy - 10, 'class': 'annot', fill: col('ink'), 'font-size': 17.5, 'font-weight': 600, 'text-anchor': 'end' }), svg, 'about ' + (Math.round(cross * 10) / 10));
      if (ct.getBBox().x < pl) { ct.setAttribute('x', cx + 9); ct.setAttribute('y', cy + 24); ct.setAttribute('text-anchor', 'start'); } // below-right, under both lines
    }
    // the reading under the pointer: the age, and both totals at that age
    var unhair = deskCrosshair(svg, { x0: pl, x1: W - pr, y0: pt, y1: H - pb, read: function (px) {
      var age = Math.round(x0 + (px - pl) / (W - pl - pr) * (x1 - x0));
      var lines = ['At age ' + age, aLabel + ': ' + oneDp(fa(age)) + ' years'];
      if (!same) lines.push(bLabel + ': ' + oneDp(fb(age)) + ' years');
      return { x: X(age), y: Y(Math.max(fa(age), same ? 0 : fb(age))), lines: lines };
    } });
    var unfit = keepInside(svg, W);
    svg._unhair = function () { unfit(); unhair(); };
  }

  // the crosshair's reading box (17px text) can be wider than the space beside the line on a phone: after the shared
  // crosshair places it, slide it back inside the chart's own width
  function keepInside(svg, W) {
    function fit() {
      var g = svg.querySelector('.crosshair'); if (!g || g.style.display === 'none') return;
      var box = g.querySelector('rect'), txt = g.querySelector('text'), bx = Number(box.getAttribute('x')), w = Number(box.getAttribute('width'));
      var nx = Math.max(0, Math.min(W - w, bx)); if (nx === bx) return;
      box.setAttribute('x', nx); txt.setAttribute('transform', 'translate(' + (nx + 6) + ',' + (Number(box.getAttribute('y')) + 6) + ')');
    }
    svg.addEventListener('pointermove', fit); svg.addEventListener('pointerdown', fit);
    return function () { svg.removeEventListener('pointermove', fit); svg.removeEventListener('pointerdown', fit); };
  }

  // ---------- the three choices ----------
  function drawCpp() {
    var a = state.cpp, s = cppShareAt(a), ch = (s - 1) * 100;
    $('cpp-age').textContent = ageText(a);
    $('cpp-big').textContent = pct(s * 100);
    $('cpp-k').textContent = 'Each month, against starting at ' + R.cppStd;
    var std = R.cppStd, cross = null, t = $('cpp-text');
    if (Math.abs(a - std) < 1e-9) sentence(t, 'The standard start at ' + std + ': the full amount, with no reduction or increase.');
    else if (a < std) {
      cross = crossing(function (v) { return cppTotal(std, v); }, function (v) { return cppTotal(a, v); }, std);
      sentence(t, 'Starting at ' + ageText(a) + ' pays ' + pct(Math.abs(ch), 1) + ' less every month, for life. In total it stays ahead of starting at ' + std + ' until about ', 'age ' + (Math.round(cross * 10) / 10), '; after that, ' + std + ' is ahead.');
    } else {
      cross = crossing(function (v) { return cppTotal(a, v); }, function (v) { return cppTotal(std, v); }, a);
      sentence(t, 'Starting at ' + ageText(a) + ' pays ' + pct(ch, 1) + ' more every month, for life. In total it catches up with starting at ' + std + ' at about ', 'age ' + (Math.round(cross * 10) / 10), '.');
    }
    $('cpp-take').textContent = Math.abs(a - std) < 1e-9 ? 'Starting at ' + std + ', the standard age: the full amount each month'
      : a < std ? 'Starting at ' + ageText(a) + ' stays ahead in total until about age ' + (Math.round(cross * 10) / 10)
      : 'Starting at ' + ageText(a) + ' catches up in total at about age ' + (Math.round(cross * 10) / 10);
    totalsChart($('cpp-chart'), function (v) { return cppTotal(a, v); }, function (v) { return cppTotal(std, v); }, 'Start ' + ageShort(a), 'Start ' + std, a, std, Math.abs(a - std) < 1e-9 ? null : cross);
  }
  function drawOas() {
    var a = state.oas, s = oasShareAt(a), ch = (s - 1) * 100, b = R.oasLo, cross = null;
    $('oas-age').textContent = ageText(a);
    $('oas-big').textContent = pct(s * 100);
    $('oas-k').textContent = 'Each month, against starting at ' + b;
    var t = $('oas-text');
    if (Math.abs(a - b) < 1e-9) sentence(t, 'Starting at ' + b + ', the earliest age. The pension rises by ' + pct(R.oasBoost) + ' from age ' + M.oasBoostAge + ', whenever it started.');
    else {
      cross = crossing(function (v) { return oasTotal(a, v); }, function (v) { return oasTotal(b, v); }, a);
      sentence(t, 'Waiting until ' + ageText(a) + ' pays ' + pct(ch, 1) + ' more every month, for life. In total it catches up with starting at ' + b + ' at about ', 'age ' + (Math.round(cross * 10) / 10), '. Both rise by ' + pct(R.oasBoost) + ' from ' + M.oasBoostAge + '.');
    }
    $('oas-take').textContent = cross == null ? 'Starting at ' + b + ', the earliest age: the most years paid'
      : 'Waiting until ' + ageText(a) + ' catches up in total at about age ' + (Math.round(cross * 10) / 10);
    totalsChart($('oas-chart'), function (v) { return oasTotal(a, v); }, function (v) { return oasTotal(b, v); }, 'Start ' + ageShort(a), 'Start ' + b, a, b, cross);
    // the recovery tax, for the latest year with a confirmed threshold
    var yrs = Object.keys(M.thresholds).map(Number).filter(function (y) { return y <= thisYear; });
    var ty = yrs.length ? Math.max.apply(null, yrs) : null;
    if (ty == null) { $('oas').querySelector('.recovery').hidden = true; return; }
    var th = M.thresholds[ty], rep = Math.max(0, state.income - th) * R.oasRecovery / 100;
    $('rec-year').textContent = ty;
    $('rec-big').textContent = money(rep);
    $('rec-text').textContent = 'In ' + ty + ', OAS is reduced by ' + pct(R.oasRecovery) + ' of net income above ' + money(th) + '. ' + (rep > 0 ? 'At ' + money(state.income) + ', that is ' + money(rep) + ' a year, up to the full pension.' : 'At ' + money(state.income) + ', nothing is repaid.');
  }
  function drawRrif(p) {
    var svg = $('rrif-chart'); clear(svg);
    // the factor for an age on January 1 applies in the year you turn one more: the chart runs by the year you turn
    var rows = M.rrif.filter(function (r) { return r.age >= R.rrsp; });
    var first = rows[0], tenth = rows.filter(function (r) { return r.factor >= 0.1; })[0];
    var box = chartBox(svg, 230, 290), W = box[0], H = box[1], pl = 48, pr = 8, pt = 19, pb = 39;
    var a0 = first.age + 1, a1 = rows[rows.length - 1].age + 2, maxF = rows[rows.length - 1].factor;
    var X = function (v) { return pl + (v - a0) / (a1 - a0) * (W - pl - pr); }, Y = function (f) { return H - pb - f / maxF * (H - pt - pb); };
    el('line', { x1: pl, x2: W - pr, y1: H - pb, y2: H - pb, stroke: col('rule') }, svg);
    rows.forEach(function (r) { el('rect', { x: X(r.age + 1), y: Y(r.factor), width: Math.max(1, X(r.age + 2) - X(r.age + 1) - 1), height: H - pb - Y(r.factor), fill: col('d3') }, svg); });
    // the share of the fund left if only the minimum comes out and it earns nothing (right-hand scale is 0 to 100%)
    var left = 1, d = 'M' + X(a0) + ' ' + (pt), ys = function (s) { return H - pb - s * (H - pt - pb); };
    d = 'M' + X(a0) + ' ' + ys(1);
    rows.forEach(function (r) { left *= 1 - r.factor; d += ' L' + X(r.age + 2).toFixed(1) + ' ' + ys(left).toFixed(1); });
    el('path', { d: d, fill: 'none', stroke: col('ink'), 'stroke-width': 2, 'stroke-dasharray': '5 3' }, svg);
    var step = Math.round((a1 - a0) / (W < 520 ? 4 : 8));
    for (var a = Math.ceil(a0 / step) * step; a <= a1; a += step) el('text', { x: X(a), y: H - 8, fill: col('ink3'), 'font-size': 17.5, 'text-anchor': 'middle' }, svg, String(a));
    el('text', { x: pl - 6, y: pt + 6, fill: col('ink3'), 'font-size': 17.5, 'text-anchor': 'end' }, svg, pct(maxF * 100));
    el('text', { x: pl - 6, y: H - pb + 5, fill: col('ink3'), 'font-size': 17.5, 'text-anchor': 'end' }, svg, '0');
    var leftAt90 = 1; rows.forEach(function (r) { if (r.age < 90) leftAt90 *= 1 - r.factor; });
    $('rrif-text').textContent = 'An RRSP must wind up by the end of the year you turn ' + R.rrsp + (p ? ' (' + p.rrsp.matures + ' for you)' : '') + '; most become a RRIF. ' + rrifRule(M) + (tenth ? ' More than a tenth of the fund must come out from the year you turn ' + (tenth.age + 1) + '.' : '') + ' If only the minimum comes out and the fund earns nothing, about ' + pct(leftAt90 * 100) + ' of it is left after the year you turn 90.';
    var f = state.fund, at = p && p.age - 1 > R.rrsp ? M.rrif.filter(function (r) { return r.age === Math.min(p.age - 1, rows[rows.length - 1].age); })[0] : null;
    $('fund-k').textContent = 'Minimum, the year you turn ' + (first.age + 1);
    $('fund-big').textContent = money(f * first.factor);
    $('fund-text').textContent = 'On ' + money(f) + ' at the start of the year you turn ' + (first.age + 1) + ', the minimum that year is ' + money(f * first.factor) + ' (' + pct(first.factor * 100, 2) + ').';
    var fine = $('fund-fine'); fine.hidden = !at;
    if (at) fine.textContent = 'In the year you turn ' + p.age + ', the minimum on the same fund would be ' + money(f * at.factor) + ' (' + pct(at.factor * 100, 2) + ').';
  }

  // ---------- the big answer and the box score ----------
  var answer = deskReadout('#answer', { format: function (n) { return dollars(n); } });
  // acronyms are spelled out on first use (an <abbr> with its full name), once per page
  var ABBR = { TFSA: 'Tax-Free Savings Account', CPP: 'Canada Pension Plan', OAS: 'Old Age Security', RRSP: 'Registered Retirement Savings Plan', RRIF: 'Registered Retirement Income Fund' };
  function withAbbr(node, text, seen) {
    var re = /\b(TFSA|CPP|OAS|RRSP|RRIF)\b/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (seen[m[1]]) continue;
      seen[m[1]] = true;
      node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var ab = document.createElement('abbr'); ab.title = ABBR[m[1]]; ab.textContent = m[1]; node.appendChild(ab);
      last = m.index + m[1].length;
    }
    node.appendChild(document.createTextNode(text.slice(last)));
  }
  function drawBox(p) {
    var box = $('box'), seen = {};
    box.textContent = '';
    boxScore(M, p).forEach(function (r) {
      var row = document.createElement('div'); row.className = 'box-row'; row.setAttribute('data-row', r.key);
      var dt = document.createElement('dt'); withAbbr(dt, r.label, seen);
      var dv = document.createElement('dd'); dv.className = 'box-v'; withAbbr(dv, r.value, seen);
      var dl = document.createElement('dd'); dl.className = 'box-t'; withAbbr(dl, r.line, seen);
      row.appendChild(dt); row.appendChild(dv); row.appendChild(dl); box.appendChild(row);
    });
    $('box-h').textContent = (state.example ? 'Example: born ' : 'Born in ') + p.birthYear + ', in ' + p.thisYear;
  }
  function drawAnswer(p, animate) {
    var Y = p.core;
    $('base').textContent = dollars(BASE_AMOUNT);
    answer.set({ n: Y.cpiNow, animate: animate, label: 'Prices since ' + p.birthYear, line: 'What ' + dollars(BASE_AMOUNT) + ' bought in ' + p.birthYear + ' cost this much in ' + Y.cpiLatestYear + '.' });
    $('answer-how').textContent = 'Statistics Canada’s Consumer Price Index, all items: the average of the twelve monthly values for ' + Y.cpiLatestYear + ', divided by the average for ' + p.birthYear + ', times ' + dollars(BASE_AMOUNT) + ' (exactly ' + Y.cpiNowExact.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '). Rounded as on the home page: whole dollars to $999, then three significant figures. The same arithmetic as Money, then and now.';
  }

  // ---------- one render for a birth year ----------
  function render(animate) {
    var p = person(M, state.birth, thisYear);
    state.p = p;
    drawAnswer(p, animate);
    drawBox(p);
    // the one assumptions line, beside the control
    // one short line (the qualifiers sit on each row, and "amounts depend on your own record" in Sources)
    $('example-note').textContent = (state.example ? 'Example: born ' + EXAMPLE_BIRTH + '; a year you pick stays in this tab' : 'Showing someone born in ' + state.birth + '; your year stays in this tab')
      + '; rules as of ' + asOfText + '.';
    drawTimeline(p);
    drawRrif(p);
    // the fold's readouts are written now; its charts are drawn again when it opens (they need its width)
    drawCpp(); drawOas();
    syncControl();
  }

  // ---------- the year control: a stepper, the field and the chips; live, no submit button ----------
  var year = $('year');
  year.min = String(YEAR_MIN); year.max = String(YEAR_MAX); year.value = String(state.birth);
  $('year-range').textContent = 'Any year from ' + YEAR_MIN + ' to ' + YEAR_MAX + '.';
  var chips = $('chips');
  CHIPS.filter(valid).forEach(function (c) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'yy-chip'; b.setAttribute('data-chip', c); b.textContent = String(c);
    b.addEventListener('click', function () { move(c); });
    chips.appendChild(b);
  });
  function syncControl() {
    if (document.activeElement !== year) year.value = String(state.birth);
    [].forEach.call(chips.children, function (c) { c.setAttribute('aria-pressed', String(Number(c.getAttribute('data-chip')) === state.birth)); });
    [].forEach.call(document.querySelectorAll('[data-step]'), function (b) { b.disabled = Number(b.getAttribute('data-step')) < 0 ? state.birth <= YEAR_MIN : state.birth >= YEAR_MAX; });
  }
  function move(y) {
    if (!valid(y)) return;
    var same = y === state.birth && !state.example;
    state.birth = y; state.example = false; remember(y);
    if (!same) render(true); else syncControl();
  }
  year.addEventListener('input', function () { var v = Number(year.value); if (/^\d{4}$/.test(year.value) && valid(v)) move(v); });
  year.addEventListener('change', function () {
    var v = Math.round(Number(year.value));
    if (!year.value || !isFinite(v)) { year.value = String(state.birth); return; }
    v = Math.min(YEAR_MAX, Math.max(YEAR_MIN, v)); year.value = String(v); move(v);
  });
  [].forEach.call(document.querySelectorAll('[data-step]'), function (b) {
    b.addEventListener('click', function () { var v = Math.min(YEAR_MAX, Math.max(YEAR_MIN, state.birth + Number(b.getAttribute('data-step')))); year.value = String(v); move(v); });
  });

  function slider(id, loA, hiA, key, draw) {
    var r = $(id); r.min = String(loA * 12); r.max = String(hiA * 12); r.step = '1'; r.value = String(state[key] * 12);
    r.addEventListener('input', function () { state[key] = Number(r.value) / 12; draw(); r.setAttribute('aria-valuetext', ageText(state[key])); });
    r.setAttribute('aria-valuetext', ageText(state[key]));
  }
  slider('cpp-range', R.cppLo, R.cppHi, 'cpp', function () { drawCpp(); });
  slider('oas-range', R.oasLo, R.oasHi, 'oas', function () { drawOas(); });
  var inc = $('income'); inc.value = String(EXAMPLE_INCOME); inc.addEventListener('input', function () { state.income = Math.max(0, Number(inc.value) || 0); drawOas(); });
  var fund = $('fund'); fund.value = String(EXAMPLE_FUND); fund.addEventListener('input', function () { state.fund = Math.max(0, Number(fund.value) || 0); drawRrif(state.p); });
  var deeper = document.querySelector('details.deeper');
  deeper.addEventListener('toggle', function () { if (deeper.open) { drawRrif(state.p); drawCpp(); drawOas(); } });

  // sources
  var src = $('sources');
  M.sources.forEach(function (s) { var li = document.createElement('li'), a = document.createElement('a'); a.href = s.source_url; a.textContent = s.title; li.appendChild(a); li.appendChild(document.createTextNode(', read ' + s.as_of + '.')); src.appendChild(li); });
  if (M.prices) { var lp = document.createElement('li'), ap = document.createElement('a'); ap.href = M.prices.source.source_url; ap.textContent = M.prices.source.title; lp.appendChild(ap); lp.appendChild(document.createTextNode('. Prices: the yearly average of the monthly index, ' + M.prices.first + ' to ' + M.prices.last + '. ' + (M.prices.source.attribution || ''))); src.appendChild(lp); }
  if (M.pop) { var li = document.createElement('li'), a = document.createElement('a'); a.href = M.pop.source_url; a.textContent = 'Statistics Canada, population estimates by single year of age'; li.appendChild(a); li.appendChild(document.createTextNode('. ' + M.pop.attribution)); src.appendChild(li); }
  // the January-1 detail of the RRIF factors lives here (the page says "the year you turn" throughout)
  (function () {
    var first = M.rrif.filter(function (r) { return r.age >= R.rrsp; })[0];
    $('rrif-convention').textContent = 'RRIF minimums: each year’s factor is set by your age on January 1, so the factor for age ' + first.age + ' (' + pct(first.factor * 100, 2) + ') applies in the year you turn ' + (first.age + 1) + '.';
  })();

  // Save my card: a 1080x1350 picture drawn in this page (the shared deskCard), shared or downloaded; nothing is sent
  deskSaveButton($('save'), function () {
    var p = state.p, Y = p.core;
    return deskCard({
      question: 'What opens, and when, for your year?',
      bigValue: dollars(BASE_AMOUNT) + ' → ' + Y.cpiNowText,
      line: 'What ' + dollars(BASE_AMOUNT) + ' bought in ' + p.birthYear + ' cost about ' + Y.cpiNowText + ' in ' + Y.cpiLatestYear + '.',
      labels: ['Born ' + p.birthYear, 'CPP ' + Y.y60 + '–' + Y.y70 + ', if you qualify', 'RRSP by ' + Y.y71],
    }).then(function (blob) { return { blob: blob, name: 'your-year-' + p.birthYear + '.png', title: 'Your year' }; });
  });

  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { render(false); }, 120); });
  render(false);
  // the first fill is not a change: no underline on load
  requestAnimationFrame(function () { document.querySelectorAll('.flash').forEach(function (e) { e.classList.remove('flash'); }); });
})();
