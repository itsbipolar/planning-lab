// Your planning timeline. The model (rules, limits, factors and the population snapshot) is embedded in #data and the
// calculations come from model.mjs, inlined above this script. The birth year stays in this page: it is not stored,
// not put in the address and not sent anywhere. The only file this page makes is an image the visitor asks to save.
(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('data').textContent);
  var M = D.model;
  var R = M.r;
  var EXAMPLE_BIRTH = 1965, EXAMPLE_INCOME = 110000, EXAMPLE_FUND = 500000;
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
  var state = { birth: EXAMPLE_BIRTH, example: true, cpp: R.cppHi, oas: R.oasHi, income: EXAMPLE_INCOME, fund: EXAMPLE_FUND };

  // ---------- the timeline ----------
  // Every label and reading is drawn last, with a ground-coloured halo, so the "you are here" line breaks behind it and
  // no word sits on a bar.
  function halo(attrs) { attrs.stroke = col('ground'); attrs['stroke-width'] = 4; attrs['stroke-linejoin'] = 'round'; attrs['paint-order'] = 'stroke'; return attrs; }
  function backed(t) { var bb = t.getBBox(), r = el('rect', { 'class': 'backing', x: bb.x - 3, y: bb.y - 1, width: bb.width + 6, height: bb.height + 2, fill: col('ground') }); t.parentNode.insertBefore(r, t); return t; }
  function drawTimeline(p) {
    var svg = $('tl'); clear(svg);
    var W = Math.max(320, $('tl-frame').clientWidth), narrow = W < 640;
    var fs = 13, small = 12, barH = 20;
    var padL = 4, padR = narrow ? 14 : 24, top = 34;
    var tfsaH = 58, laneH = 82, rrifH = narrow ? 104 : 100, axisH = 46;
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
    var texts = [], dots = [];
    function label(y, name, detail) { texts.push(function () {
      var t = el('text', halo({ x: padL, y: y, fill: ink, 'font-size': fs + 1, 'font-weight': 650 }), svg, name);
      if (detail) el('tspan', { fill: ink2, 'font-weight': 400 }, t, '  ' + detail);
      backed(t);
    }); }
    function reading(xx, y, str, anchor) { texts.push(function () { backed(el('text', halo({ x: xx, y: y, fill: ink2, 'font-size': fs, 'text-anchor': anchor || 'start', 'class': 'mono' }), svg, str)); }); }
    var bar = function (y) { return y + 26; }, below = function (y) { return y + 26 + barH + fs + 9; };
    var lanes = []; var y = top;
    // TFSA
    var t = p.lanes[0];
    label(y + 17, 'TFSA', t.open ? 'room since ' + t.startYear + ': ' + money(t.room) + ' by ' + t.roomTo : 'room starts in ' + t.startYear);
    if (t.from < hi) el('rect', { x: x(Math.max(lo, t.from)), y: bar(y), width: x(hi) - x(Math.max(lo, t.from)), height: barH, fill: d3 }, svg);
    lanes.push(['TFSA', t.open ? 'Contribution room has built up since ' + t.startYear + ': ' + money(t.room) + ' in all by ' + t.roomTo + ', if you lived in Canada and were old enough.' : 'Contribution room starts in ' + t.startYear + '.']);
    y += tfsaH;
    // CPP: the readings sit under the bar, never on it
    label(y + 17, 'CPP', narrow ? 'start ' + R.cppLo + '–' + R.cppHi : 'start any month from ' + R.cppLo + ' to ' + R.cppHi + ' (' + p.cpp.opens + '–' + p.cpp.closes + ' for you)');
    el('rect', { x: x(R.cppLo), y: bar(y), width: x(R.cppHi + 1) - x(R.cppLo), height: barH, fill: 'url(#g-cpp)' }, svg);
    var cLo = (cppShareAt(R.cppLo) - 1) * 100, cHi = (cppShareAt(R.cppHi) - 1) * 100;
    if (x(R.cppHi + 1) - x(R.cppLo) > 110) {
      reading(x(R.cppLo), below(y), signed(cLo));
      reading(x(R.cppHi + 1), below(y), signed(cHi), 'end');
    } else reading(x(R.cppLo), below(y), signed(cLo) + ' to ' + signed(cHi));
    el('line', { x1: x(R.cppStd), x2: x(R.cppStd), y1: bar(y) - 2, y2: bar(y) + barH + 2, stroke: ink, 'stroke-width': 1.5, 'stroke-dasharray': '3 2' }, svg);
    dots.push([x(state.cpp), bar(y) + barH / 2]);
    lanes.push(['CPP', 'Can start in any month from age ' + R.cppLo + ' to ' + R.cppHi + ' (' + p.cpp.opens + ' to ' + p.cpp.closes + ' for you): ' + signed(cLo) + ' a month at ' + R.cppLo + ', ' + signed(cHi) + ' at ' + R.cppHi + '.']);
    y += laneH;
    // OAS
    var oHi = (oasShareAt(R.oasHi) - 1) * 100;
    label(y + 17, 'OAS', narrow ? 'start ' + R.oasLo + '–' + R.oasHi : 'start any month from ' + R.oasLo + ' to ' + R.oasHi + ' (' + p.oas.opens + '–' + p.oas.closes + ' for you)');
    el('rect', { x: x(R.oasLo), y: bar(y), width: x(R.oasHi + 1) - x(R.oasLo), height: barH, fill: 'url(#g-oas)' }, svg);
    reading(x(R.oasHi + 1), below(y), signed(oHi), 'end');
    if (M.oasBoostAge > R.oasHi && M.oasBoostAge < hi) {
      el('rect', { x: x(M.oasBoostAge), y: bar(y), width: x(hi) - x(M.oasBoostAge), height: barH, fill: d1, opacity: 0.35 }, svg);
      reading(x(M.oasBoostAge), below(y), '+' + pct(R.oasBoost) + ' from ' + M.oasBoostAge);
    }
    dots.push([x(state.oas), bar(y) + barH / 2]);
    lanes.push(['OAS', 'Can start from ' + R.oasLo + ', or later up to ' + R.oasHi + ' for ' + signed(oHi) + ' a month; the pension rises by ' + pct(R.oasBoost) + ' from age ' + M.oasBoostAge + '.']);
    y += laneH;
    // RRSP, then RRIF minimums as a staircase (a savings account, so the same data colour as the TFSA)
    label(y + 17, 'RRSP, then RRIF', narrow ? 'matures by ' + p.rrsp.matures : 'an RRSP must mature by the end of the year you turn ' + R.rrsp + ' (' + p.rrsp.matures + ' for you)');
    var base = y + rrifH - 4, maxF = Math.max.apply(null, M.rrif.map(function (r) { return r.factor; })), tall = rrifH - 58, band = 12;
    el('rect', { x: x(lo), y: base - band, width: x(R.rrsp + 1) - x(lo), height: band, fill: d3, opacity: 0.45 }, svg);
    M.rrif.forEach(function (r) {
      if (r.age < R.rrsp || r.age + 1 >= hi) return; // the factor for an age on January 1 applies in the year you turn one more
      var h = Math.max(2, r.factor / maxF * tall), ax = r.age + 1;
      el('rect', { x: x(ax), y: base - h, width: Math.max(1, x(ax + 1) - x(ax) - 1), height: h, fill: d3 }, svg);
    });
    var first = M.rrif.filter(function (r) { return r.age >= R.rrsp; })[0], last = M.rrif[M.rrif.length - 1];
    reading(x(first.age + 1) - 4, base - band - 6, pct(first.factor * 100, 2) + ' turning ' + (first.age + 1), 'end');
    reading(x(hi), base - tall - 7, pct(last.factor * 100, 0) + ' from ' + (last.age + 1), 'end');
    lanes.push(['RRSP and RRIF', 'An RRSP must mature by the end of the year you turn ' + R.rrsp + ' (' + p.rrsp.matures + '). As a RRIF, a minimum share comes out each year after, set by your age on January 1: ' + pct(first.factor * 100, 2) + ' in the year you turn ' + (first.age + 1) + ', rising to ' + pct(last.factor * 100, 0) + ' from ' + (last.age + 1) + '.']);
    // the axis: ages, and the calendar years they fall in for this person
    var ay = H - axisH + 6;
    el('line', { x1: x(lo), x2: x(hi), y1: ay, y2: ay, stroke: rule }, svg);
    var step = Math.round((hi - lo) / (narrow ? 4 : 8));
    for (var a = Math.ceil(lo / step) * step; a < hi; a += step) {
      if (a - lo < step / 2) continue;
      el('line', { x1: x(a), x2: x(a), y1: ay, y2: ay + 5, stroke: ink3 }, svg);
      el('text', { x: x(a), y: ay + 19, fill: ink2, 'font-size': small, 'text-anchor': 'middle', 'class': 'mono' }, svg, String(a));
      el('text', { x: x(a), y: ay + 35, fill: ink3, 'font-size': small, 'text-anchor': 'middle', 'class': 'mono' }, svg, String(p.birthYear + a));
    }
    el('text', { x: padL, y: ay + 19, fill: ink3, 'font-size': small, 'class': 'mono' }, svg, 'age');
    el('text', { x: padL, y: ay + 35, fill: ink3, 'font-size': small, 'class': 'mono' }, svg, 'year');
    // you are here: the years behind are muted; the line is drawn under every label, which breaks it with its halo
    if (p.age > lo) {
      var yx = x(Math.min(hi, p.age));
      el('rect', { 'class': 'wash', x: x(lo), y: top + 20, width: yx - x(lo), height: H - axisH - top - 14, fill: ground, opacity: 0.62 }, svg);
      if (p.age < hi) {
        el('line', { 'class': 'here', x1: yx, x2: yx, y1: 16, y2: H - axisH + 6, stroke: ink, 'stroke-width': 1.5 }, svg);
        texts.push(function () { backed(el('text', halo({ x: yx, y: 12, fill: ink, 'font-size': fs + 1, 'font-weight': 700, 'text-anchor': yx > W * 0.8 ? 'end' : yx < W * 0.2 ? 'start' : 'middle' }), svg, (state.example ? 'Example, ' : 'You, ') + p.age)); });
      }
    }
    // the start ages chosen with the sliders: the one marked choice, in the highlight colour
    dots.forEach(function (d) { el('circle', { cx: d[0], cy: d[1], r: 8, fill: point, stroke: ground, 'stroke-width': 2 }, svg); });
    texts.forEach(function (f) { f(); });
    $('tl-title').textContent = 'Planning timeline for someone born in ' + p.birthYear + ', aged ' + p.age + ' in ' + p.thisYear;
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
  // Chart text is set in CSS pixels (the SVG is drawn at its real width), never smaller than 12px. Line names sit in the
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
    var box = chartBox(svg, 230, 300), W = box[0], H = box[1], pl = 34, pr = W < 520 ? 104 : 116, pt = 26, pb = 30;
    var x0 = Math.min(startA, startB), x1 = hi;
    var ymax = Math.max(fa(x1), fb(x1)) || 1;
    var X = function (v) { return pl + (v - x0) / (x1 - x0) * (W - pl - pr); }, Y = function (v) { return H - pb - v / ymax * (H - pt - pb); };
    var ink3 = col('ink3'), rule = col('rule');
    el('line', { x1: pl, x2: W - pr, y1: H - pb, y2: H - pb, stroke: rule }, svg);
    var step = Math.round((x1 - x0) / (W < 520 ? 4 : 6));
    for (var a = Math.ceil(x0 / step) * step; a <= x1; a += step) el('text', { x: X(a), y: H - 9, fill: ink3, 'font-size': 12, 'text-anchor': 'middle', 'class': 'mono' }, svg, String(a));
    el('text', { x: pl, y: pt - 12, fill: ink3, 'font-size': 12, 'class': 'mono' }, svg, Math.round(ymax) + ' years of pension');
    el('text', { x: pl - 6, y: H - pb + 4, fill: ink3, 'font-size': 12, 'text-anchor': 'end', 'class': 'mono' }, svg, '0');
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
    if (ends.length > 1 && ends[1].y - ends[0].y < 17) { var mid = (ends[0].y + ends[1].y) / 2; ends[0].y = mid - 8.5; ends[1].y = mid + 8.5; }
    var shift = Math.max(0, pt + 4 - ends[0].y); ends.forEach(function (e) { e.y += shift; });
    ends.forEach(function (e) { el('text', halo({ x: W - pr + 8, y: e.y, fill: e.c, 'font-size': 13, 'font-weight': e.w }), svg, e.t); });
    if (cross != null && cross < x1) {
      var cx = X(cross), cy = Y(fa(cross));
      el('circle', { cx: cx, cy: cy, r: 5, fill: col('ground'), stroke: col('ink'), 'stroke-width': 2 }, svg);
      var ct = el('text', halo({ x: cx - 9, y: cy - 10, fill: col('ink'), 'font-size': 13, 'font-weight': 650, 'text-anchor': 'end' }), svg, 'about ' + (Math.round(cross * 10) / 10));
      if (ct.getBBox().x < pl) { ct.setAttribute('x', cx + 9); ct.setAttribute('y', cy + 20); ct.setAttribute('text-anchor', 'start'); } // below-right, under both lines
    }
    // the reading under the pointer: the age, and both totals at that age
    svg._unhair = deskCrosshair(svg, { x0: pl, x1: W - pr, y0: pt, y1: H - pb, read: function (px) {
      var age = Math.round(x0 + (px - pl) / (W - pl - pr) * (x1 - x0));
      var lines = ['At age ' + age, aLabel + ': ' + oneDp(fa(age)) + ' years'];
      if (!same) lines.push(bLabel + ': ' + oneDp(fb(age)) + ' years');
      return { x: X(age), y: Y(Math.max(fa(age), same ? 0 : fb(age))), lines: lines };
    } });
  }

  // ---------- the three choices ----------
  function drawCpp() {
    var a = state.cpp, s = cppShareAt(a), ch = (s - 1) * 100;
    $('cpp-age').textContent = ageText(a);
    $('cpp-big').textContent = pct(s * 100);
    var std = R.cppStd, cross = null, t = $('cpp-text');
    if (Math.abs(a - std) < 1e-9) sentence(t, 'The standard start at ' + std + ': the full amount, with no reduction or increase.');
    else if (a < std) {
      cross = crossing(function (v) { return cppTotal(std, v); }, function (v) { return cppTotal(a, v); }, std);
      sentence(t, 'Starting at ' + ageText(a) + ' pays ' + pct(Math.abs(ch), 1) + ' less every month, for life. In total it stays ahead of starting at ' + std + ' until about ', 'age ' + (Math.round(cross * 10) / 10), '; after that, ' + std + ' is ahead.');
    } else {
      cross = crossing(function (v) { return cppTotal(a, v); }, function (v) { return cppTotal(std, v); }, a);
      sentence(t, 'Starting at ' + ageText(a) + ' pays ' + pct(ch, 1) + ' more every month, for life. In total it catches up with starting at ' + std + ' at about ', 'age ' + (Math.round(cross * 10) / 10), '.');
    }
    totalsChart($('cpp-chart'), function (v) { return cppTotal(a, v); }, function (v) { return cppTotal(std, v); }, 'Start ' + ageShort(a), 'Start ' + std, a, std, Math.abs(a - std) < 1e-9 ? null : cross);
  }
  function drawOas() {
    var a = state.oas, s = oasShareAt(a), ch = (s - 1) * 100, b = R.oasLo, cross = null;
    $('oas-age').textContent = ageText(a);
    $('oas-big').textContent = pct(s * 100);
    $('oas-k').textContent = 'Each month, for life, as a share of the amount at ' + b;
    var t = $('oas-text');
    if (Math.abs(a - b) < 1e-9) sentence(t, 'Starting at ' + b + ', the earliest age. The pension rises by ' + pct(R.oasBoost) + ' from age ' + M.oasBoostAge + ', whenever it started.');
    else {
      cross = crossing(function (v) { return oasTotal(a, v); }, function (v) { return oasTotal(b, v); }, a);
      sentence(t, 'Waiting until ' + ageText(a) + ' pays ' + pct(ch, 1) + ' more every month, for life. In total it catches up with starting at ' + b + ' at about ', 'age ' + (Math.round(cross * 10) / 10), '. Both rise by ' + pct(R.oasBoost) + ' from ' + M.oasBoostAge + '.');
    }
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
    var rows = M.rrif.filter(function (r) { return r.age >= R.rrsp; }); // ages on January 1
    var first = rows[0], tenth = rows.filter(function (r) { return r.factor >= 0.1; })[0];
    var box = chartBox(svg, 220, 280), W = box[0], H = box[1], pl = 40, pr = 8, pt = 14, pb = 30;
    var a0 = first.age, a1 = rows[rows.length - 1].age + 1, maxF = rows[rows.length - 1].factor;
    var X = function (v) { return pl + (v - a0) / (a1 - a0) * (W - pl - pr); }, Y = function (f) { return H - pb - f / maxF * (H - pt - pb); };
    el('line', { x1: pl, x2: W - pr, y1: H - pb, y2: H - pb, stroke: col('rule') }, svg);
    rows.forEach(function (r) { el('rect', { x: X(r.age), y: Y(r.factor), width: Math.max(1, X(r.age + 1) - X(r.age) - 1), height: H - pb - Y(r.factor), fill: col('d3') }, svg); });
    // the share of the fund left if only the minimum comes out and it earns nothing (right-hand scale is 0 to 100%)
    var left = 1, d = 'M' + X(a0) + ' ' + (pt), ys = function (s) { return H - pb - s * (H - pt - pb); };
    d = 'M' + X(a0) + ' ' + ys(1);
    rows.forEach(function (r) { left *= 1 - r.factor; d += ' L' + X(r.age + 1).toFixed(1) + ' ' + ys(left).toFixed(1); });
    el('path', { d: d, fill: 'none', stroke: col('ink'), 'stroke-width': 2, 'stroke-dasharray': '5 3' }, svg);
    var step = Math.round((a1 - a0) / (W < 520 ? 4 : 8));
    for (var a = Math.ceil(a0 / step) * step; a <= a1; a += step) el('text', { x: X(a), y: H - 9, fill: col('ink3'), 'font-size': 12, 'text-anchor': 'middle', 'class': 'mono' }, svg, String(a));
    el('text', { x: pl - 6, y: pt + 8, fill: col('ink3'), 'font-size': 12, 'text-anchor': 'end', 'class': 'mono' }, svg, pct(maxF * 100));
    el('text', { x: pl - 6, y: H - pb + 4, fill: col('ink3'), 'font-size': 12, 'text-anchor': 'end', 'class': 'mono' }, svg, '0');
    var leftAt90 = 1; rows.forEach(function (r) { if (r.age < 90) leftAt90 *= 1 - r.factor; });
    $('rrif-text').textContent = 'An RRSP must mature by the end of the year you turn ' + R.rrsp + (p ? ' (' + p.rrsp.matures + ' for you)' : '') + ', for example by becoming a RRIF. From the next year a minimum share must come out each year, set by your age on January 1 (the chart’s ages): ' + pct(first.factor * 100, 2) + ' at ' + first.age + ', in the year you turn ' + (first.age + 1) + '; ' + (tenth ? 'more than a tenth of the fund from ' + tenth.age + '; ' : '') + pct(maxF * 100) + ' from ' + rows[rows.length - 1].age + '. If only the minimum comes out and the fund earns nothing, about ' + pct(leftAt90 * 100) + ' is left at 90, on January 1.';
    var f = state.fund, at = p && p.age - 1 > R.rrsp ? M.rrif.filter(function (r) { return r.age === Math.min(p.age - 1, rows[rows.length - 1].age); })[0] : null;
    $('fund-k').textContent = 'The minimum in the year you turn ' + (first.age + 1);
    $('fund-big').textContent = money(f * first.factor);
    $('fund-text').textContent = 'On ' + money(f) + ' on January 1, the minimum is ' + money(f * first.factor) + ' in the year you turn ' + (first.age + 1) + ': ' + pct(first.factor * 100, 2) + ', the factor for age ' + first.age + ' on January 1.';
    var fine = $('fund-fine'); fine.hidden = !at;
    if (at) fine.textContent = 'In the year you turn ' + p.age + ', the minimum on the same fund would be ' + money(f * at.factor) + ' (' + pct(at.factor * 100, 2) + ').';
  }

  // ---------- people your age ----------
  function drawPeople(p) {
    var box = $('people');
    if (!M.pop) { box.hidden = true; return; }
    box.hidden = false;
    $('people-k').textContent = 'Canadians aged ' + p.age + ' on July 1, ' + M.pop.year;
    if (p.popCount) {
      $('people-big').textContent = 'About ' + p.popCount.toLocaleString('en-CA');
      $('people-text').textContent = 'About ' + p.popCount.toLocaleString('en-CA') + ' Canadians were ' + p.age + ' on July 1, ' + M.pop.year + ', by Statistics Canada’s estimate (see the sources).';
    } else {
      $('people-big').textContent = 'Not in this snapshot';
      $('people-text').textContent = 'The Statistics Canada snapshot on this page counts ages ' + M.pop.a0 + ' to ' + M.pop.a1 + ' on July 1, ' + M.pop.year + '.';
    }
  }

  // ---------- one render for a birth year ----------
  function render() {
    var p = person(M, state.birth, thisYear);
    $('finding').textContent = finding(M, p);
    $('example-note').textContent = state.example ? 'Showing an example: born ' + EXAMPLE_BIRTH + '. Type your own birth year; it stays in this page.' : 'Showing the rules for someone born in ' + state.birth + '. The year stays in this page.';
    drawTimeline(p); drawCpp(); drawOas(); drawRrif(p); drawPeople(p);
    state.p = p;
  }

  // ---------- controls ----------
  var year = $('year'); year.min = '1900'; year.max = String(thisYear); year.value = String(EXAMPLE_BIRTH);
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = Number(year.value), err = $('error');
    if (!year.value || !Number.isInteger(v)) { err.textContent = 'Type a four-digit birth year, like ' + EXAMPLE_BIRTH + '.'; err.hidden = false; return; }
    if (v < Number(year.min) || v > thisYear) { err.textContent = 'Type a year from ' + year.min + ' to ' + thisYear + '.'; err.hidden = false; return; }
    err.hidden = true; state.birth = v; state.example = false; render();
  });
  function slider(id, loA, hiA, key) {
    var r = $(id); r.min = String(loA * 12); r.max = String(hiA * 12); r.step = '1'; r.value = String(state[key] * 12);
    r.addEventListener('input', function () { state[key] = Number(r.value) / 12; render(); r.setAttribute('aria-valuetext', ageText(state[key])); });
    r.setAttribute('aria-valuetext', ageText(state[key]));
  }
  slider('cpp-range', R.cppLo, R.cppHi, 'cpp');
  slider('oas-range', R.oasLo, R.oasHi, 'oas');
  var inc = $('income'); inc.value = String(EXAMPLE_INCOME); inc.addEventListener('input', function () { state.income = Math.max(0, Number(inc.value) || 0); drawOas(); });
  var fund = $('fund'); fund.value = String(EXAMPLE_FUND); fund.addEventListener('input', function () { state.fund = Math.max(0, Number(fund.value) || 0); drawRrif(state.p); });

  // sources
  var src = $('sources');
  M.sources.forEach(function (s) { var li = document.createElement('li'), a = document.createElement('a'); a.href = s.source_url; a.textContent = s.title; li.appendChild(a); li.appendChild(document.createTextNode(', read ' + s.as_of + '.')); src.appendChild(li); });
  if (M.pop) { var li = document.createElement('li'), a = document.createElement('a'); a.href = M.pop.source_url; a.textContent = 'Statistics Canada, population estimates by single year of age'; li.appendChild(a); li.appendChild(document.createTextNode('. ' + M.pop.attribution)); src.appendChild(li); }
  var asOf = M.sources.map(function (s) { return s.as_of; }).sort().pop();
  var mo = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var asOfText = mo[Number(asOf.slice(5, 7)) - 1] + ' ' + asOf.slice(0, 4);
  $('kicker').lastElementChild.textContent = 'Canadian rules as of ' + asOfText;

  // save the timeline as an image, made in the browser
  $('save').addEventListener('click', function () {
    var svg = $('tl'), clone = svg.cloneNode(true), W = Number(svg.getAttribute('width')), H = Number(svg.getAttribute('height'));
    clone.setAttribute('xmlns', NS);
    clone.querySelectorAll('text').forEach(function (t) { t.setAttribute('font-family', 'Libre Franklin, Helvetica, Arial, sans-serif'); });
    var pad = 32, foot = 56, img = new Image(), data = new XMLSerializer().serializeToString(clone);
    img.onload = function () {
      var c = document.createElement('canvas'), k = 2; c.width = (W + pad * 2) * k; c.height = (H + pad * 2 + foot) * k;
      var g = c.getContext('2d'); g.scale(k, k); g.fillStyle = col('ground'); g.fillRect(0, 0, W + pad * 2, H + pad * 2 + foot);
      g.fillStyle = col('ink'); g.font = '600 18px Georgia, serif'; g.fillText(document.getElementById('finding').textContent, pad, pad + 4, W);
      g.drawImage(img, pad, pad + 16, W, H);
      g.fillStyle = col('ink3'); g.font = '12px Helvetica, Arial, sans-serif';
      g.fillText('Your planning timeline. Canadian rules from official sources, ' + 'as of ' + asOfText + '. Education only, not advice. Mohammed El Chayeb.', pad, H + pad * 2 + 24);
      c.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'planning-timeline-' + state.birth + '.png'; document.body.appendChild(a); a.click(); a.remove(); });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
  });

  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(render, 120); });
  render();
  // the first fill is not a change: no underline on load
  requestAnimationFrame(function () { document.querySelectorAll('.flash').forEach(function (e) { e.classList.remove('flash'); }); });
})();
