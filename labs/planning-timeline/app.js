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
  function drawTimeline(p) {
    var svg = $('tl'); clear(svg);
    var W = Math.max(320, $('tl-frame').clientWidth), narrow = W < 640;
    var padL = 4, padR = narrow ? 14 : 24, top = 34, laneH = narrow ? 64 : 62, rrifH = narrow ? 92 : 86, axisH = 46;
    var H = top + laneH * 3 + rrifH + axisH;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    var x = function (a) { return padL + (a - lo) / (hi - lo) * (W - padL - padR); };
    var ink = col('ink'), ink2 = col('ink2'), ink3 = col('ink3'), rule = col('rule'), ground = col('ground');
    var d1 = col('d1'), d2 = col('d2'), d3 = col('d3'), d4 = col('d4'), neutral = col('neutral'), point = col('point');
    var defs = el('defs', {}, svg);
    function grad(id, stops) { var g = el('linearGradient', { id: id, x1: 0, x2: 1, y1: 0, y2: 0 }, defs); stops.forEach(function (s) { el('stop', { offset: s[0], 'stop-color': s[1] }, g); }); }
    var stdAt = (R.cppStd - R.cppLo) / (R.cppHi - R.cppLo);
    grad('g-cpp', [[0, d4], [stdAt, neutral], [1, d1]]);
    grad('g-oas', [[0, neutral], [1, d1]]);
    var fs = narrow ? 12 : 13;
    var later = [];
    function label(y, name, detail) { later.push([y, name, detail]); }
    function drawLabels() { later.forEach(function (l) {
      var t = el('text', { x: padL, y: l[0], fill: ink, 'font-size': fs + 1, 'font-weight': 650 }, svg, l[1]);
      if (l[2]) el('tspan', { fill: ink2, 'font-weight': 400 }, t, '  ' + l[2]);
    }); }
    var lanes = []; var y = top;
    // TFSA
    var t = p.lanes[0];
    label(y + 16, 'TFSA', t.open ? 'room since ' + t.startYear + ': ' + money(t.room) + ' by ' + t.roomTo : 'room starts in ' + t.startYear);
    if (t.from < hi) el('rect', { x: x(Math.max(lo, t.from)), y: y + 26, width: x(hi) - x(Math.max(lo, t.from)), height: 20, fill: d3 }, svg);
    lanes.push(['TFSA', t.open ? 'Contribution room has built up since ' + t.startYear + ': ' + money(t.room) + ' in all by ' + t.roomTo + ', if you lived in Canada and were old enough.' : 'Contribution room starts in ' + t.startYear + '.']);
    y += laneH;
    // CPP
    label(y + 16, 'CPP', narrow ? 'start ' + R.cppLo + '–' + R.cppHi : 'start any month from ' + R.cppLo + ' to ' + R.cppHi + ' (' + p.cpp.opens + '–' + p.cpp.closes + ' for you)');
    el('rect', { x: x(R.cppLo), y: y + 26, width: x(R.cppHi + 1) - x(R.cppLo), height: 20, fill: 'url(#g-cpp)' }, svg);
    var cLo = (cppShareAt(R.cppLo) - 1) * 100, cHi = (cppShareAt(R.cppHi) - 1) * 100;
    if (x(R.cppHi + 1) - x(R.cppLo) > 110) {
      el('text', { x: x(R.cppLo), y: y + 61, fill: ink2, 'font-size': fs, 'class': 'mono' }, svg, signed(cLo));
      el('text', { x: x(R.cppHi + 1), y: y + 61, fill: ink2, 'font-size': fs, 'text-anchor': 'end', 'class': 'mono' }, svg, signed(cHi));
    } else el('text', { x: x(R.cppLo), y: y + 61, fill: ink2, 'font-size': fs, 'class': 'mono', 'text-anchor': 'end' }, svg, signed(cLo) + ' to ' + signed(cHi));
    el('line', { x1: x(R.cppStd), x2: x(R.cppStd), y1: y + 24, y2: y + 48, stroke: ink, 'stroke-width': 1.5, 'stroke-dasharray': '3 2' }, svg);
    var hx = x(state.cpp); el('circle', { cx: hx, cy: y + 26 + 10, r: 8, fill: point, stroke: ground, 'stroke-width': 2 }, svg);
    lanes.push(['CPP', 'Can start in any month from age ' + R.cppLo + ' to ' + R.cppHi + ' (' + p.cpp.opens + ' to ' + p.cpp.closes + ' for you): ' + signed(cLo) + ' a month at ' + R.cppLo + ', ' + signed(cHi) + ' at ' + R.cppHi + '.']);
    y += laneH;
    // OAS
    var oHi = (oasShareAt(R.oasHi) - 1) * 100;
    label(y + 16, 'OAS', narrow ? 'start ' + R.oasLo + '–' + R.oasHi : 'start any month from ' + R.oasLo + ' to ' + R.oasHi + ' (' + p.oas.opens + '–' + p.oas.closes + ' for you)');
    el('rect', { x: x(R.oasLo), y: y + 26, width: x(R.oasHi + 1) - x(R.oasLo), height: 20, fill: 'url(#g-oas)' }, svg);
    el('text', { x: x(R.oasHi + 1), y: y + 61, fill: ink2, 'font-size': fs, 'text-anchor': 'end', 'class': 'mono' }, svg, signed(oHi));
    if (M.oasBoostAge > R.oasHi && M.oasBoostAge < hi) {
      el('rect', { x: x(M.oasBoostAge), y: y + 26, width: x(hi) - x(M.oasBoostAge), height: 20, fill: d1, opacity: 0.35 }, svg);
      el('text', { x: x(M.oasBoostAge) + 4, y: y + 61, fill: ink2, 'font-size': fs, 'class': 'mono' }, svg, '+' + pct(R.oasBoost) + ' from ' + M.oasBoostAge);
    }
    var ox = x(state.oas); el('circle', { cx: ox, cy: y + 26 + 10, r: 8, fill: point, stroke: ground, 'stroke-width': 2 }, svg);
    lanes.push(['OAS', 'Can start from ' + R.oasLo + ', or later up to ' + R.oasHi + ' for ' + signed(oHi) + ' a month; the pension rises by ' + pct(R.oasBoost) + ' from age ' + M.oasBoostAge + '.']);
    y += laneH;
    // RRSP, then RRIF minimums as a staircase
    label(y + 16, 'RRSP, then RRIF', narrow ? 'matures by ' + p.rrsp.matures : 'an RRSP must mature by the end of the year you turn ' + R.rrsp + ' (' + p.rrsp.matures + ' for you)');
    var base = y + rrifH - 14, maxF = Math.max.apply(null, M.rrif.map(function (r) { return r.factor; })), tall = rrifH - 46;
    el('rect', { x: x(lo), y: base - 12, width: x(R.rrsp + 1) - x(lo), height: 12, fill: d2, opacity: 0.55 }, svg);
    M.rrif.forEach(function (r) {
      if (r.age <= R.rrsp) return;
      var h = Math.max(2, r.factor / maxF * tall);
      el('rect', { x: x(r.age), y: base - h, width: Math.max(1, x(r.age + 1) - x(r.age) - 1), height: h, fill: d2 }, svg);
    });
    var first = M.rrif.filter(function (r) { return r.age > R.rrsp; })[0], last = M.rrif[M.rrif.length - 1];
    el('text', { x: x(first.age), y: base - first.factor / maxF * tall - 6, fill: ink2, 'font-size': fs, 'class': 'mono', 'text-anchor': 'middle' }, svg, pct(first.factor * 100, 1));
    el('text', { x: x(hi), y: base - tall - 6, fill: ink2, 'font-size': fs, 'class': 'mono', 'text-anchor': 'end' }, svg, pct(last.factor * 100, 0) + ' at ' + last.age);
    lanes.push(['RRSP and RRIF', 'An RRSP must mature by the end of the year you turn ' + R.rrsp + ' (' + p.rrsp.matures + '). As a RRIF, a minimum share comes out each year, from ' + pct(first.factor * 100, 2) + ' at ' + first.age + ' to ' + pct(last.factor * 100, 0) + ' at ' + last.age + '.']);
    // the axis: ages, and the calendar years they fall in for this person
    var ay = H - axisH + 6;
    el('line', { x1: x(lo), x2: x(hi), y1: ay, y2: ay, stroke: rule }, svg);
    var step = Math.round((hi - lo) / (narrow ? 4 : 8));
    for (var a = Math.ceil(lo / step) * step; a < hi; a += step) {
      if (a - lo < step / 2) continue;
      el('line', { x1: x(a), x2: x(a), y1: ay, y2: ay + 5, stroke: ink3 }, svg);
      el('text', { x: x(a), y: ay + 19, fill: ink2, 'font-size': fs, 'text-anchor': 'middle', 'class': 'mono' }, svg, String(a));
      el('text', { x: x(a), y: ay + 35, fill: ink3, 'font-size': fs - 1, 'text-anchor': 'middle', 'class': 'mono' }, svg, String(p.birthYear + a));
    }
    el('text', { x: padL, y: ay + 19, fill: ink3, 'font-size': fs - 1, 'class': 'mono' }, svg, 'age');
    el('text', { x: padL, y: ay + 35, fill: ink3, 'font-size': fs - 1, 'class': 'mono' }, svg, 'year');
    // you are here: the years behind are muted
    if (p.age > lo) {
      var yx = x(Math.min(hi, p.age));
      el('rect', { x: x(lo), y: top + 20, width: yx - x(lo), height: H - axisH - top - 14, fill: ground, opacity: 0.62 }, svg);
      if (p.age < hi) {
        el('line', { x1: yx, x2: yx, y1: 14, y2: H - axisH + 6, stroke: point, 'stroke-width': 2 }, svg);
        el('text', { x: yx, y: 12, fill: point, 'font-size': fs + 1, 'font-weight': 700, 'text-anchor': yx > W * 0.8 ? 'end' : 'middle' }, svg, (state.example ? 'Example, ' : 'You, ') + p.age);
      }
    }
    drawLabels();
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
  function totalsChart(svg, fa, fb, aLabel, bLabel, startA, startB, cross) {
    clear(svg);
    var W = Math.max(260, svg.parentNode.clientWidth - 2), H = 170, pl = 30, pr = 8, pt = 12, pb = 26;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    var x0 = Math.min(startA, startB), x1 = hi;
    var ymax = Math.max(fa(x1), fb(x1)) || 1;
    var X = function (v) { return pl + (v - x0) / (x1 - x0) * (W - pl - pr); }, Y = function (v) { return H - pb - v / ymax * (H - pt - pb); };
    var ink2 = col('ink2'), ink3 = col('ink3'), rule = col('rule');
    el('line', { x1: pl, x2: W - pr, y1: H - pb, y2: H - pb, stroke: rule }, svg);
    var step = Math.round((x1 - x0) / 4);
    for (var a = Math.ceil(x0 / step) * step; a <= x1; a += step) el('text', { x: X(a), y: H - 8, fill: ink3, 'font-size': 11, 'text-anchor': 'middle', 'class': 'mono' }, svg, String(a));
    el('text', { x: pl + 2, y: pt + 2, fill: ink3, 'font-size': 11, 'class': 'mono' }, svg, Math.round(ymax) + ' years of pension');
    el('text', { x: pl - 4, y: H - pb, fill: ink3, 'font-size': 11, 'text-anchor': 'end', 'class': 'mono' }, svg, '0');
    function path(f, start, color, width) {
      var d = 'M' + X(start) + ' ' + Y(0); for (var v = start; v <= x1; v += 0.25) d += ' L' + X(v).toFixed(1) + ' ' + Y(f(v)).toFixed(1);
      el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': width }, svg);
    }
    var same = Math.abs(startA - startB) < 1e-9;
    if (!same) path(fb, startB, col('d1'), 2);
    path(fa, startA, col('point'), 3);
    var ya = Y(fa(x1)), yb = Y(fb(x1)), up = ya <= yb;
    el('text', { x: W - pr, y: ya + (up ? -8 : 16), fill: col('point'), 'font-size': 12, 'font-weight': 700, 'text-anchor': 'end' }, svg, aLabel);
    if (!same) el('text', { x: W - pr, y: yb + (up ? 16 : -8), fill: col('d1'), 'font-size': 12, 'font-weight': 600, 'text-anchor': 'end' }, svg, bLabel);
    if (cross != null && cross < x1) {
      el('circle', { cx: X(cross), cy: Y(fa(cross)), r: 5, fill: col('ground'), stroke: col('ink'), 'stroke-width': 2 }, svg);
      el('text', { x: X(cross), y: Y(fa(cross)) - 10, fill: col('ink'), 'font-size': 12, 'font-weight': 650, 'text-anchor': X(cross) > W * 0.75 ? 'end' : 'middle' }, svg, 'about ' + (Math.round(cross * 10) / 10));
    }
  }

  // ---------- the three choices ----------
  function drawCpp() {
    var a = state.cpp, s = cppShareAt(a), ch = (s - 1) * 100;
    $('cpp-age').textContent = ageText(a);
    $('cpp-big').textContent = pct(s * 100) + ' of the standard amount';
    var std = R.cppStd, cross = null, txt;
    if (Math.abs(a - std) < 1e-9) txt = 'The standard start at ' + std + ': the full amount, with no reduction or increase.';
    else if (a < std) {
      cross = crossing(function (v) { return cppTotal(std, v); }, function (v) { return cppTotal(a, v); }, std);
      txt = 'Starting at ' + ageText(a) + ' pays ' + pct(Math.abs(ch), 1) + ' less every month, for life. In total it stays ahead of starting at ' + std + ' until about age ' + (Math.round(cross * 10) / 10) + '; after that, ' + std + ' is ahead.';
    } else {
      cross = crossing(function (v) { return cppTotal(a, v); }, function (v) { return cppTotal(std, v); }, a);
      txt = 'Starting at ' + ageText(a) + ' pays ' + pct(ch, 1) + ' more every month, for life. In total it catches up with starting at ' + std + ' at about age ' + (Math.round(cross * 10) / 10) + '.';
    }
    $('cpp-text').textContent = txt;
    totalsChart($('cpp-chart'), function (v) { return cppTotal(a, v); }, function (v) { return cppTotal(std, v); }, 'Start at ' + ageText(a), 'Start at ' + std, a, std, Math.abs(a - std) < 1e-9 ? null : cross);
  }
  function drawOas() {
    var a = state.oas, s = oasShareAt(a), ch = (s - 1) * 100, b = R.oasLo, cross = null, txt;
    $('oas-age').textContent = ageText(a);
    $('oas-big').textContent = pct(s * 100) + ' of the amount at ' + b;
    if (Math.abs(a - b) < 1e-9) txt = 'Starting at ' + b + ', the earliest age. The pension rises by ' + pct(R.oasBoost) + ' from age ' + M.oasBoostAge + ', whenever it started.';
    else {
      cross = crossing(function (v) { return oasTotal(a, v); }, function (v) { return oasTotal(b, v); }, a);
      txt = 'Waiting until ' + ageText(a) + ' pays ' + pct(ch, 1) + ' more every month, for life. In total it catches up with starting at ' + b + ' at about age ' + (Math.round(cross * 10) / 10) + '. Both rise by ' + pct(R.oasBoost) + ' from ' + M.oasBoostAge + '.';
    }
    $('oas-text').textContent = txt;
    totalsChart($('oas-chart'), function (v) { return oasTotal(a, v); }, function (v) { return oasTotal(b, v); }, 'Start at ' + ageText(a), 'Start at ' + b, a, b, cross);
    // the recovery tax, for the latest year with a confirmed threshold
    var yrs = Object.keys(M.thresholds).map(Number).filter(function (y) { return y <= thisYear; });
    var ty = yrs.length ? Math.max.apply(null, yrs) : null;
    if (ty == null) { $('oas').querySelector('.recovery').hidden = true; return; }
    var th = M.thresholds[ty], rep = Math.max(0, state.income - th) * R.oasRecovery / 100;
    $('rec-year').textContent = ty;
    $('rec-text').textContent = 'In ' + ty + ', OAS is reduced by ' + pct(R.oasRecovery) + ' of net income above ' + money(th) + '. ' + (rep > 0 ? 'At ' + money(state.income) + ', that is ' + money(rep) + ' a year, up to the full pension.' : 'At ' + money(state.income) + ', nothing is repaid.');
  }
  function drawRrif(p) {
    var svg = $('rrif-chart'); clear(svg);
    var rows = M.rrif.filter(function (r) { return r.age > R.rrsp; });
    var first = rows[0], tenth = rows.filter(function (r) { return r.factor >= 0.1; })[0];
    var W = Math.max(260, svg.parentNode.clientWidth - 2), H = 190, pl = 30, pr = 8, pt = 14, pb = 26;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    var a0 = first.age, a1 = rows[rows.length - 1].age + 1, maxF = rows[rows.length - 1].factor;
    var X = function (v) { return pl + (v - a0) / (a1 - a0) * (W - pl - pr); }, Y = function (f) { return H - pb - f / maxF * (H - pt - pb); };
    el('line', { x1: pl, x2: W - pr, y1: H - pb, y2: H - pb, stroke: col('rule') }, svg);
    rows.forEach(function (r) { el('rect', { x: X(r.age), y: Y(r.factor), width: Math.max(1, X(r.age + 1) - X(r.age) - 1), height: H - pb - Y(r.factor), fill: col('d2') }, svg); });
    // the share of the fund left if only the minimum comes out and it earns nothing (right-hand scale is 0 to 100%)
    var left = 1, d = 'M' + X(a0) + ' ' + (pt), ys = function (s) { return H - pb - s * (H - pt - pb); };
    d = 'M' + X(a0) + ' ' + ys(1);
    rows.forEach(function (r) { left *= 1 - r.factor; d += ' L' + X(r.age + 1).toFixed(1) + ' ' + ys(left).toFixed(1); });
    el('path', { d: d, fill: 'none', stroke: col('ink'), 'stroke-width': 2, 'stroke-dasharray': '5 3' }, svg);
    var step = Math.round((a1 - a0) / 4);
    for (var a = Math.ceil(a0 / step) * step; a <= a1; a += step) el('text', { x: X(a), y: H - 8, fill: col('ink3'), 'font-size': 11, 'text-anchor': 'middle', 'class': 'mono' }, svg, String(a));
    el('text', { x: pl - 4, y: pt + 8, fill: col('ink3'), 'font-size': 11, 'text-anchor': 'end', 'class': 'mono' }, svg, pct(maxF * 100));
    var leftAt90 = 1; rows.forEach(function (r) { if (r.age < 90) leftAt90 *= 1 - r.factor; });
    $('rrif-text').textContent = 'An RRSP must mature by the end of the year you turn ' + R.rrsp + (p ? ' (' + p.rrsp.matures + ' for you)' : '') + ', for example by becoming a RRIF. From then on a minimum share must come out each year: ' + pct(first.factor * 100, 2) + ' at ' + first.age + ', ' + (tenth ? 'more than a tenth of the fund from ' + tenth.age + ', ' : '') + pct(maxF * 100) + ' from ' + rows[rows.length - 1].age + '. If only the minimum comes out and the fund earns nothing, about ' + pct(leftAt90 * 100) + ' is left at 90.';
    var f = state.fund, at = p && p.age > R.rrsp ? M.rrif.filter(function (r) { return r.age === Math.min(p.age, rows[rows.length - 1].age); })[0] : null;
    $('fund-text').textContent = 'On ' + money(f) + ', the minimum is ' + money(f * first.factor) + ' at ' + first.age + (at ? ' and ' + money(f * at.factor) + ' at ' + p.age + ', using that age’s factor' : '') + '.';
  }

  // ---------- people your age ----------
  function drawPeople(p) {
    var box = $('people');
    if (!p.popCount) { box.hidden = true; return; }
    box.hidden = false; box.textContent = '';
    var h = document.createElement('p'); h.className = 'kicker'; h.style.margin = '0'; h.textContent = 'People your age'; box.appendChild(h);
    var t = document.createElement('p'); t.textContent = 'About ' + p.popCount.toLocaleString('en-CA') + ' Canadians were ' + p.age + ' on July 1, ' + M.pop.year + '.'; box.appendChild(t);
    var s = document.createElement('p'); s.className = 'note'; s.textContent = M.pop.attribution; box.appendChild(s);
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
  if (M.pop) { var li = document.createElement('li'), a = document.createElement('a'); a.href = M.pop.source_url; a.textContent = 'Statistics Canada, population estimates by single year of age'; li.appendChild(a); src.appendChild(li); }
  var asOf = M.sources.map(function (s) { return s.as_of; }).sort().pop();
  var mo = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  $('kicker').textContent = 'Interactive · Canadian rules as of ' + mo[Number(asOf.slice(5, 7)) - 1] + ' ' + asOf.slice(0, 4);

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
      g.fillText('Your planning timeline. Canadian rules from official sources, ' + $('kicker').textContent.replace('Interactive · Canadian rules ', '') + '. Education only, not advice. Mohammed El Chayeb.', pad, H + pad * 2 + 24);
      c.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'planning-timeline-' + state.birth + '.png'; document.body.appendChild(a); a.click(); a.remove(); });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
  });

  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(render, 120); });
  render();
})();
