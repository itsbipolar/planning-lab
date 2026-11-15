// Estate freeze: the page. The engine is FREEZE (model.mjs, inlined by build.mjs); every rate comes from the confirmed
// facts in the page's data block. Inputs live in memory only: nothing in the address, nothing stored. The page makes no
// request after it loads; the card and the one-page sheet are made in this browser.
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('data').textContent);
  var F = FREEZE, B = F.BOUNDS, E = F.EXAMPLE;
  var R = F.freezeRules(DATA.facts);
  var STAMP = 'Hypothetical illustration · Education, not advice';
  var NS = 'http://www.w3.org/2000/svg';
  var SANS = '"Source Sans 3 Variable", system-ui, sans-serif', SERIF = '"Source Serif 4 Variable", Georgia, serif';
  var FS = 17.5;                                   // every chart label 17.5px or more
  var $ = function (id) { return document.getElementById(id); };
  var KEYS = ['value', 'cost', 'growth', 'freezeAge', 'deathAge', 'income', 'eligibleShare', 'incomeGrowth'];
  var START = {};
  KEYS.forEach(function (k) { START[k] = k === 'deathAge' ? F.defaultDeathAge(R, E.freezeAge) : E[k]; });
  var st = copy(START), S = null;

  function copy(o) { var c = {}; KEYS.forEach(function (k) { c[k] = o[k]; }); return c; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ordinal(n) { var t = n % 100, o = n % 10; return n + (t >= 11 && t <= 13 ? 'th' : o === 1 ? 'st' : o === 2 ? 'nd' : o === 3 ? 'rd' : 'th'); }
  function rate(r) { return F.fmtRate(r).replace('.00%', '%'); }
  function money0(n) { return '$' + Math.round(n).toLocaleString('en-CA'); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(d) { var p = String(d).split('-').map(Number); return MONTHS[p[1] - 1] + ' ' + p[2] + ', ' + p[0]; }
  var Y21 = ordinal(R.trustYears);
  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(svg) { Array.prototype.slice.call(svg.childNodes).forEach(function (c) { if (c.nodeName !== 'title' && c.nodeName !== 'desc') svg.removeChild(c); }); }
  var ctx2 = document.createElement('canvas').getContext('2d');
  function measure(text, font) { ctx2.font = font; return ctx2.measureText(text).width; }
  var fSans = '400 ' + FS + 'px ' + SANS, fSans6 = '600 ' + FS + 'px ' + SANS;

  // ---- the chart: two stacked bands whose top edge is always the no-freeze gain ----
  function niceStep(range, n) {
    var raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  function Placer(W, H) {
    var boxes = [];
    function hit(b) { return b.x < 0 || b.x + b.w > W || b.y < 0 || b.y + b.h > H || boxes.some(function (o) { return b.x < o.x + o.w + 4 && o.x < b.x + b.w + 4 && b.y < o.y + o.h + 2 && o.y < b.y + b.h + 2; }); }
    return { hit: hit, add: function (b) { boxes.push(b); }, boxes: boxes };
  }
  function textBox(x, y, w, anchor, size) { var s = size || FS; var x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x; return { x: x0, y: y - s * 0.8, w: w, h: s * 1.05 }; }

  // drawBand(svg, S, { W, H, print, hatch }): draws the chart into svg (1 unit = 1px); returns the scales for the crosshair
  function drawBand(svg, S, o) {
    clear(svg);
    var W = o.W, H = o.H, narrow = W < 640, VF = o.print ? 18 : 19, LH = Math.round(FS * 1.5);
    var fVal = '600 ' + VF + 'px ' + SERIF;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    var defs = el('defs', {}, svg);
    var pat = el('pattern', { id: o.hatch, patternUnits: 'userSpaceOnUse', width: 7, height: 7, patternTransform: 'rotate(45)' }, defs);
    el('line', { x1: 1, y1: 0, x2: 1, y2: 7, 'class': 'hatch-line' }, pat);
    var hatch = 'url(#' + o.hatch + ')';
    var rows = S.rows, n = S.n, a0 = S.inp.freezeAge, aD = S.inp.deathAge, a21 = S.deemedAge, aMax = S.xMax, last = rows[n];

    // the right gutter for the readings: wide enough for the longest word line
    var gut = Math.ceil(Math.max(112, 0.14 * W, measure('taxed at death', fSans) + 18, measure('$00.0M', fVal) + 18));
    var x0 = 0, x1 = W - gut;
    var X = function (a) { return x0 + (a - a0) / (aMax - a0) * (x1 - x0); };

    // the marker labels above the plot, in rows: death (an example age) and the trust's 21st year
    var P = Placer(W, H), markRows = 0, markers = [];
    var marks = [{ age: a21, text: 'Trust’s ' + Y21 + ' year, age ' + a21, cls: 'deemed-line' }, { age: aD, text: 'Death at ' + aD + ' (example)', cls: 'death-line' }];
    if (a21 === aD) marks = [{ age: aD, text: 'Death and the trust’s ' + Y21 + ' year, ' + aD, cls: 'death-line' }];
    marks.forEach(function (m) {
      var w = measure(m.text, fSans6), x = X(m.age), done = false;
      for (var r = 0; r < 3 && !done; r++) {
        var y = 4 + FS + r * LH;
        var cands = [['end', x - 6], ['start', x + 6]];
        for (var c = 0; c < cands.length && !done; c++) {
          var b = textBox(cands[c][1], y, w, cands[c][0]);
          if (!P.hit(b)) { P.add(b); m.row = r; m.anchor = cands[c][0]; m.tx = cands[c][1]; m.ty = y; markRows = Math.max(markRows, r + 1); done = true; }
        }
      }
      if (!done) { var xx = Math.min(W, Math.max(w, x)); m.row = markRows; m.anchor = 'end'; m.tx = xx; m.ty = 4 + FS + markRows * LH; markRows++; }
      markers.push(m);
    });
    var padT = 8 + markRows * LH + 10, padB = FS + 16, PH = H - padT - padB;
    var hi = 0; rows.forEach(function (r) { hi = Math.max(hi, r.gainNo); });
    if (hi <= 0) hi = S.inp.value || 1;
    var step = niceStep(hi, narrow ? 3 : 4), top = Math.ceil(hi / step) * step;
    if (top - hi < step * 0.15) top += step;
    var Y = function (v) { return padT + (1 - v / top) * PH; };
    var gGrid = el('g', {}, svg), gMarks = el('g', {}, svg), gText = el('g', {}, svg);

    // gridlines and y labels (left-aligned, above their lines); the zero line in ink
    for (var t = step; t <= top + 1e-6; t += step) {
      el('line', { x1: x0, x2: x1, y1: Y(t).toFixed(1), y2: Y(t).toFixed(1), 'class': 'grid' }, gGrid);
      var lb = F.fmtAxis(t), by = Y(t) - 6, bw = measure(lb, fSans), bb = textBox(0, by, bw, 'start');
      // a label that would sit on a band edge is left out (the gridline still reads)
      var onEdge = rows.some(function (r, k) { var x = X(r.age); if (x > bb.x + bb.w + (x1 - x0) / Math.max(1, aMax - a0)) return false; return [r.gainNo, r.gainWith].some(function (v) { var yy = Y(v); return yy > bb.y - 4 && yy < bb.y + bb.h + 4; }); });
      if (!onEdge && !P.hit(bb)) { P.add(bb); el('text', { x: 0, y: by.toFixed(1), 'class': 'ylab' }, gText, lb); }
    }

    // the step edge of the frozen shares' gain (it drops at each year-end redemption)
    function stepPts(t0, t1) {
      var pts = [[X(rows[t0].age), Y(rows[t0].gainWith)]];
      for (var i = t0 + 1; i <= t1; i++) { pts.push([X(rows[i].age), Y(rows[i - 1].gainWith)]); pts.push([X(rows[i].age), Y(rows[i].gainWith)]); }
      return pts;
    }
    function line(pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(''); }
    function band(topPts, botPts) { return line(topPts.concat(botPts.slice().reverse())) + 'Z'; }
    var iD = n, i21 = a21 - a0, edge = stepPts(0, iD);
    // taxed at death (with the freeze): from zero to the step edge, ending at death
    el('path', { d: line([[X(a0), Y(0)]].concat(edge).concat([[X(aD), Y(0)]])) + 'Z', 'class': 'band-death' }, gMarks);
    // to the trust, taxed later: between the step edge and the no-freeze gain (restarting after a deemed sale)
    var tops = [], t1 = S.deemedFirst ? i21 : iD;
    for (var k = 0; k <= t1; k++) tops.push([X(rows[k].age), Y(rows[k].gainNo)]);
    var bandD = band(tops, stepPts(0, t1));
    el('path', { d: bandD, 'class': 'band-trust' }, gMarks);
    el('path', { d: bandD, 'class': 'band-hatch', fill: hatch }, gMarks);
    if (S.deemedFirst && i21 < iD) {
      var tops2 = [];
      for (var k2 = i21; k2 <= iD; k2++) tops2.push([X(rows[k2].age), Y(rows[k2].gainWith + rows[k2].trustDrawn)]);
      var bandR = band(tops2, stepPts(i21, iD));
      el('path', { d: bandR, 'class': 'band-trust' }, gMarks);
      el('path', { d: bandR, 'class': 'band-hatch', fill: hatch }, gMarks);
      el('path', { d: line(tops2), 'class': 'restart' }, gMarks);
    }
    el('path', { d: line(edge), 'class': 'edge-death' }, gMarks);
    // after death: the trust's shares, hatch only, flat at their gain at death, until the trust's 21st year
    if (!S.deemedFirst && a21 > aD) {
      el('rect', { x: X(aD).toFixed(1), y: Y(S.trust).toFixed(1), width: (X(a21) - X(aD)).toFixed(1), height: Math.max(0, Y(0) - Y(S.trust)).toFixed(1), 'class': 'after', fill: hatch }, gMarks);
    }
    // no freeze: the whole gain, taxed at death
    var nf = []; for (var k3 = 0; k3 <= iD; k3++) nf.push([X(rows[k3].age), Y(rows[k3].gainNo)]);
    el('path', { d: line(nf), 'class': 'nofreeze' }, gMarks);
    el('line', { x1: x0, x2: x1, y1: Y(0), y2: Y(0), 'class': 'zero' }, gMarks);
    // the death line and the trust's 21st year, with their labels
    markers.forEach(function (m) {
      var x = X(m.age).toFixed(1);
      el('line', { x1: x, x2: x, y1: (m.ty + 6).toFixed(1), y2: Y(0).toFixed(1), 'class': m.cls }, gMarks);
      el('text', { x: m.tx.toFixed(1), y: m.ty.toFixed(1), 'text-anchor': m.anchor, 'class': 'mark-t' }, gText, m.text);
    });

    // x ticks: the freeze, death and the 21st year always; every 5 years when wide
    var must = [a0, aD, a21].filter(function (a, i, s) { return s.indexOf(a) === i; }).sort(function (p, q) { return p - q; });
    var extra = [];
    if (!narrow) for (var a = Math.ceil(a0 / 5) * 5; a <= aMax; a += 5) if (must.indexOf(a) < 0) extra.push(a);
    var ty = Y(0) + FS + 8;
    must.concat(extra).forEach(function (age, i) {
      var txt = age === a0 ? 'Age ' + age : String(age), w = measure(txt, fSans), x = X(age);
      var cands = age === a0 ? [['start', x]] : age === aMax ? [['end', x + 4], ['middle', x]] : [['middle', x], ['end', x + w / 2], ['start', x - w / 2]];
      for (var c = 0; c < cands.length; c++) {
        var b = textBox(cands[c][1], ty, w, cands[c][0]);
        if (b.x + b.w <= W && !P.hit(b)) {
          P.add(b);
          el('text', { x: cands[c][1].toFixed(1), y: ty.toFixed(1), 'text-anchor': cands[c][0], 'class': 'tick' }, gText, txt);
          el('line', { x1: x.toFixed(1), x2: x.toFixed(1), y1: Y(0), y2: Y(0) + 5, 'class': 'zero' }, gMarks);
          return;
        }
      }
    });

    // the readings in the right gutter, each with a 1px leader to its band at death; no legend
    var wordW = gut - 14;
    var reads = [
      { key: 'death', v: last.gainWith, words: 'taxed at death', ty: (Y(0) + Y(last.gainWith)) / 2 },
      { key: 'trust', v: S.trust, words: 'to the trust, taxed later', ty: (Y(last.gainWith) + Y(last.gainWith + last.trustDrawn)) / 2 },
      { key: 'nofreeze', v: last.gainNo, words: 'no freeze', ty: Y(last.gainNo) },
    ];
    reads.forEach(function (r) {
      r.lines = wrapText(r.words, wordW, function (s) { return measure(s, fSans); });
      r.h = VF * 1.15 + r.lines.length * FS * 1.2;
    });
    function layout(list) {
      var lo = padT - 4, hiY = Y(0) - 3, gap = 8;
      list.sort(function (p, q) { return p.ty - q.ty; });
      list.forEach(function (r) { r.top = r.ty - r.h / 2; });
      for (var pass = 0; pass < 40; pass++) {
        var moved = false;
        for (var i = 0; i < list.length; i++) {
          var r = list[i];
          if (r.top < lo) { r.top = lo; moved = true; }
          if (r.top + r.h > hiY) { r.top = hiY - r.h; moved = true; }
          if (i && r.top < list[i - 1].top + list[i - 1].h + gap) {
            var over = list[i - 1].top + list[i - 1].h + gap - r.top;
            r.top += over / 2; list[i - 1].top -= over / 2; moved = true;
          }
        }
        if (!moved) break;
      }
      for (var j = 0; j < list.length; j++) {
        if (list[j].top < lo - 0.5 || list[j].top + list[j].h > hiY + 0.5) return false;
        if (j && list[j].top < list[j - 1].top + list[j - 1].h + gap - 0.5) return false;
      }
      return true;
    }
    var shown = reads.slice();
    if (!layout(shown)) { shown = reads.filter(function (r) { return r.key !== 'nofreeze'; }); layout(shown); }
    var lx = x1 + 12, xd = X(aD);
    shown.forEach(function (r) {
      var mid = r.top + VF * 0.6;
      el('path', { d: 'M' + (xd + 2).toFixed(1) + ' ' + r.ty.toFixed(1) + 'L' + (x1 + 3).toFixed(1) + ' ' + r.ty.toFixed(1) + 'L' + (lx - 4).toFixed(1) + ' ' + mid.toFixed(1), 'class': 'leader', fill: 'none' }, gMarks);
      var tx = el('text', { x: lx, y: (r.top + VF * 0.95).toFixed(1), 'class': 'rd' }, gText);
      el('tspan', { x: lx, 'class': 'rd-v r-' + r.key }, tx, F.fmtM1(r.v));
      r.lines.forEach(function (s, i) { el('tspan', { x: lx, dy: (i ? FS * 1.2 : VF * 0.2 + FS * 1.05).toFixed(1), 'class': 'rd-w' }, tx, s); });
      P.add({ x: lx, y: r.top, w: gut - 12, h: r.h });
    });

    // the one annotation, inside the taxed-at-death band, with a 1px leader to its stepped edge
    if (S.pref0 > 0) {
      var texts = narrow ? [['Each redemption', 'trims this']] : [['Each redemption trims this'], ['Each redemption', 'trims this']];
      for (var q = 0; q < texts.length; q++) {
        var ls = texts[q], w = Math.max.apply(null, ls.map(function (s) { return measure(s, fSans6); })), h = ls.length * FS * 1.2;
        var ax = X(a0) + 8, base = Y(0) - 7 - (ls.length - 1) * FS * 1.2, boxA = { x: ax - 2, y: base - FS * 0.85, w: w + 4, h: h };
        var reach = Math.min(aD, a0 + (ax + w + 28 - x0) / (x1 - x0) * (aMax - a0)), ti = Math.min(iD, Math.ceil(reach - a0));
        if (ti < 1 || Y(rows[ti].gainWith) > boxA.y - 3 || P.hit(boxA)) continue;
        P.add(boxA);
        var at = el('text', { x: ax.toFixed(1), y: base.toFixed(1), 'class': 'annot' }, gText);
        ls.forEach(function (s, i) { el('tspan', { x: ax.toFixed(1), dy: i ? (FS * 1.2).toFixed(1) : 0 }, at, s); });
        var lxA = ax + Math.min(w * 0.55, measure(ls[0], fSans6) * 0.8), la = a0 + (lxA - x0) / (x1 - x0) * (aMax - a0), li = Math.min(iD, Math.max(1, Math.ceil(la - a0)));
        if (Y(rows[li].gainWith) + 3 < boxA.y - 3) el('path', { d: 'M' + lxA.toFixed(1) + ' ' + (boxA.y - 3).toFixed(1) + 'V' + (Y(rows[li].gainWith) + 3).toFixed(1), 'class': 'leader', fill: 'none' }, gMarks);
        break;
      }
    }
    return { X: X, Y: Y, x0: X(a0), x1: X(aMax), padT: padT, y0: Y(0), W: W };
  }

  // ---- the chart on the page ----
  var chart = $('chart'), frame = $('chart-frame'), dropCross = null, scales = null, kbAge = null;
  function drawChart() {
    var W = Math.max(300, Math.floor(frame.clientWidth)), H = W < 640 ? 310 : W < 1000 ? 400 : 440;
    if (dropCross) { dropCross(); dropCross = null; }
    scales = drawBand(chart, S, { W: W, H: H, print: false, hatch: 'ef-hatch' });
    var rows = S.rows, a0 = S.inp.freezeAge, aD = S.inp.deathAge, aMax = S.xMax;
    dropCross = deskCrosshair(chart, { x0: scales.x0, x1: scales.x1, y0: scales.padT, y1: scales.y0, read: function (px) {
      var a = Math.round(a0 + (px - scales.x0) / (scales.x1 - scales.x0) * (aMax - a0));
      a = Math.max(a0, Math.min(aMax, a));
      if (a <= aD) {
        var r = rows[a - a0];
        return { x: scales.X(a), y: scales.Y(r.gainNo), lines: ['Age ' + a, 'Taxed at death ' + F.fmtM1(r.gainWith), 'To the trust ' + F.fmtM1(r.trustDrawn), 'No freeze ' + F.fmtM1(r.gainNo)] };
      }
      return { x: scales.X(a), y: scales.Y(S.trust), lines: ['Age ' + a + ', after death', 'To the trust ' + F.fmtM1(S.trust), 'Taxed when sold or deemed sold'] };
    } });
  }
  // the arrow keys step the reading one year at a time when the chart has focus
  chart.addEventListener('keydown', function (e) {
    var a0 = S.inp.freezeAge, aMax = S.xMax, k = e.key;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(k) < 0) return;
    e.preventDefault();
    if (kbAge == null) kbAge = S.inp.deathAge; else kbAge += k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
    if (k === 'Home') kbAge = a0; if (k === 'End') kbAge = aMax;
    kbAge = Math.max(a0, Math.min(aMax, kbAge));
    var rc = chart.getBoundingClientRect(), x = rc.left + scales.X(kbAge) * rc.width / scales.W;
    chart.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: rc.top + rc.height / 2 }));
  });
  chart.addEventListener('blur', function () { kbAge = null; chart.dispatchEvent(new PointerEvent('pointerleave')); });

  // ---- the first move: the portfolio-value slider ----
  var range = $('value'), bubble = $('value-out');
  range.min = B.value.min; range.max = B.value.max; range.step = B.value.step; range.value = st.value;
  $('tick-lo').textContent = F.fmtInput(B.value.min); $('tick-hi').textContent = F.fmtInput(B.value.max);
  $('tick-mid').textContent = F.fmtInput(B.value.midTick); $('tick-mid').style.left = ((B.value.midTick - B.value.min) / (B.value.max - B.value.min) * 100) + '%';
  function paintSlider() {
    var f = (st.value - B.value.min) / (B.value.max - B.value.min), w = range.clientWidth, thumb = 28;
    bubble.textContent = F.fmtInput(st.value);
    range.setAttribute('aria-valuetext', F.fmtInput(st.value));
    var half = bubble.offsetWidth / 2, x = f * (w - thumb) + thumb / 2;
    bubble.style.left = Math.max(half, Math.min(w - half, x)) + 'px';
    range.style.setProperty('--fill', (f * 100).toFixed(2) + '%');
  }
  // the words and figures follow at once; the chart redraws on the next frame
  range.addEventListener('input', function () { setValue(Number(range.value)); paintSlider(); render(false, true); });
  range.addEventListener('keydown', function (e) {
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
    e.preventDefault();
    var v = Math.max(B.value.min, Math.min(B.value.max, st.value + (e.key === 'PageUp' ? 1 : -1) * B.value.page));
    range.value = v; setValue(v); paintSlider(); render(false, true);
  });
  function setValue(v) {
    st.value = v;
    if (st.cost > st.value) { st.cost = st.value; $('clamp').textContent = 'Tax cost lowered to ' + F.fmtInput(st.cost); }
    else $('clamp').textContent = '';
  }

  // ---- steppers: label, minus, the value, plus; 48px buttons, disabled at a bound, never wrapping ----
  var STEPS = [
    { key: 'cost', label: 'Tax cost', name: 'tax cost', fmt: F.fmtInput, min: function () { return B.cost.min; }, max: function () { return st.value; }, step: B.cost.step },
    { key: 'growth', label: 'Growth a year', name: 'growth', fmt: F.fmtPct, min: function () { return B.growth.min; }, max: function () { return B.growth.max; }, step: B.growth.step },
    { key: 'freezeAge', label: 'Age at the freeze', name: 'age at the freeze', fmt: String, min: function () { return B.freezeAge.min; }, max: function () { return B.freezeAge.max; }, step: B.freezeAge.step },
    { key: 'deathAge', label: 'Age at death', name: 'age at death', fmt: String, min: function () { return st.freezeAge + 1; }, max: function () { return B.deathAge.max; }, step: B.deathAge.step },
  ];
  var MORE = [
    { key: 'income', label: 'Investment income a year', name: 'investment income', fmt: F.fmtInput, min: function () { return B.income.min; }, max: function () { return B.income.max; }, step: B.income.step },
    { key: 'eligibleShare', label: 'Share that is eligible dividends', name: 'eligible dividend share', fmt: F.fmtPct, min: function () { return B.eligibleShare.min; }, max: function () { return B.eligibleShare.max; }, step: B.eligibleShare.step },
    { key: 'incomeGrowth', label: 'Income growth a year', name: 'income growth', fmt: F.fmtPct, min: function () { return B.incomeGrowth.min; }, max: function () { return B.incomeGrowth.max; }, step: B.incomeGrowth.step },
  ];
  function snap(v, step) { return Math.round(Math.round(v / step) * step * 1e6) / 1e6; }
  function makeStepper(host, c) {
    var box = document.createElement('div'); box.className = 'stepper';
    var id = 'st-' + c.key, lab = document.createElement('span'); lab.className = 'stepper-l'; lab.id = id + '-l'; lab.textContent = c.label;
    var row = document.createElement('div'); row.className = 'stepper-row'; row.setAttribute('role', 'group'); row.setAttribute('aria-labelledby', id + '-l');
    var dn = document.createElement('button'), up = document.createElement('button'), out = document.createElement('output');
    dn.type = up.type = 'button'; dn.textContent = '−'; up.textContent = '+'; out.id = id; out.setAttribute('data-flash', '');
    row.appendChild(dn); row.appendChild(out); row.appendChild(up); box.appendChild(lab); box.appendChild(row); host.appendChild(box);
    function go(dir) {
      var v = snap(st[c.key] + dir * c.step, c.step);
      v = Math.max(c.min(), Math.min(c.max(), v));
      if (v === st[c.key]) return;
      st[c.key] = v;
      if (c.key === 'freezeAge' && st.deathAge < st.freezeAge + 1) st.deathAge = st.freezeAge + 1;
      $('clamp').textContent = '';
      render();
    }
    dn.addEventListener('click', function () { go(-1); }); up.addEventListener('click', function () { go(1); });
    c.paint = function () {
      var v = st[c.key], txt = c.fmt(v);
      out.textContent = txt;
      dn.disabled = v <= c.min() + 1e-9; up.disabled = v >= c.max() - 1e-9;
      dn.setAttribute('aria-label', 'Decrease ' + c.name + ', now ' + txt);
      up.setAttribute('aria-label', 'Increase ' + c.name + ', now ' + txt);
    };
    c.out = out;
  }
  STEPS.forEach(function (c) { makeStepper($('steppers'), c); });
  MORE.forEach(function (c) { makeStepper($('steppers-more'), c); });
  $('reset').addEventListener('click', function () { st = copy(START); range.value = st.value; $('clamp').textContent = ''; paintSlider(); render(); range.focus(); });

  // ---- the ledger: built once, its figures updated on every change ----
  var LED = {};
  (function buildLedger() {
    function row(tb, key, labelHTML, cls) {
      var tr = document.createElement('tr'); if (cls) tr.className = cls;
      var th = document.createElement('td'); th.innerHTML = labelHTML; tr.appendChild(th);
      var a = document.createElement('td'), b = document.createElement('td'); a.className = b.className = 'n';
      a.setAttribute('data-flash', ''); b.setAttribute('data-flash', '');
      tr.appendChild(a); tr.appendChild(b); tb.appendChild(tr);
      LED[key] = { label: th, no: a, with: b };
    }
    var now = $('ledger-now'), later = $('ledger-later');
    row(now, 'gain', '<span class="sw death" aria-hidden="true"></span>Gain taxed at death');
    row(now, 'tax', 'Income tax on it');
    if (R.eat) row(now, 'eat', 'Ontario estate administration tax');
    row(now, 'pay', 'Payable at death', 'total');
    var h = document.createElement('tr'), hth = document.createElement('th'); hth.setAttribute('scope', 'rowgroup'); hth.colSpan = 3; hth.textContent = 'Taxed later'; h.appendChild(hth); later.appendChild(h);
    row(later, 'trust', '<span class="sw trust" aria-hidden="true"></span>Gain held by the trust');
    row(later, 'defer', 'Its income tax at today’s rate, deferred');
    row(later, 'when', 'Taxed when the trust sells, or is deemed to sell at its ' + Y21 + ' year');
  })();
  function paintLedger() {
    $('ledger-h').textContent = 'At death, age ' + S.inp.deathAge;
    LED.gain.no.textContent = F.fmtM2(S.gainNo); LED.gain.with.textContent = F.fmtM2(S.gainWith);
    LED.tax.label.innerHTML = 'Income tax on it <span class="lg-note">(' + esc(rate(R.cgRate)) + ' top rate on gains, ' + R.rateYear + ')</span>';
    LED.tax.no.textContent = F.fmtM2(S.taxNo); LED.tax.with.textContent = F.fmtM2(S.taxWith);
    if (LED.eat) { LED.eat.no.textContent = F.fmtM2(S.eatNo); LED.eat.with.textContent = 'not payable (assumed)'; LED.eat.with.className = 'w'; }
    LED.pay.no.textContent = F.fmtM2(S.payableNo); LED.pay.with.textContent = F.fmtM2(S.payableWith);
    LED.trust.label.innerHTML = '<span class="sw trust" aria-hidden="true"></span>Gain held by the trust <span class="lg-note">(' + esc(F.fmtM2(S.trustSplit.growth)) + ' growth + ' + esc(F.fmtM2(S.trustSplit.redemptions)) + ' redeemed)</span>';
    LED.trust.no.textContent = 'none'; LED.trust.no.className = 'w'; LED.trust.with.textContent = F.fmtM2(S.trust);
    LED.defer.no.textContent = 'none'; LED.defer.no.className = 'w'; LED.defer.with.textContent = F.fmtM2(S.pushed);
    LED.when.no.textContent = ''; LED.when.with.textContent = 'age ' + S.deemedAge;
  }

  // ---- the caveats (the same six on the page and on the sheet) ----
  function caveats(link) {
    var once = link ? '<a href="/watch/double-tax-at-death/">taxed once</a>' : 'taxed once';
    var list = [
      'One spouse owns everything. Gifts to a surviving spouse are not shown.',
      'The freeze is set up so corporate attribution does not apply.',
      'Post-mortem planning is in place, so the gain is ' + once + ', at capital-gains rates.',
      'The note stays unpaid until death.',
    ];
    if (R.eat) list.push('The note and frozen shares pass under a secondary will that probate does not reach: an assumption, not a rule.');
    list.push('Yearly tax on income and redemptions, fees, corporate costs and many technical rules are left out.');
    return list;
  }
  $('caveats').innerHTML = caveats(true).map(function (s) { return '<li>' + s + '</li>'; }).join('');

  // ---- the readout and the words that follow the state ----
  var readout = deskReadout('#answer', { format: F.fmtBig });
  function fact(ids, text) { return '<span data-fact="' + esc(ids) + '">' + esc(text) + '</span>'; }
  function paintWords(first) {
    var i = S.inp, last = S.rows[S.n];
    var label = S.state === 'deemedFirst' ? 'Income tax moved to the trust' : 'Income tax pushed past death';
    var line = {
      normal: 'Deferred, not removed: the trust’s shares are taxed when sold or deemed sold.',
      deemedFirst: 'Here the trust’s ' + Y21 + ' year, age ' + S.deemedAge + ', comes before death.',
      noGrowth: 'With no growth, the trust’s gain comes only from redemptions.',
      nothing: 'Nothing moves to the trust without growth or redemptions.',
    }[S.state];
    readout.set({ n: S.pushed, label: label, line: line, animate: first ? false : undefined });
    $('answer-sub').innerHTML = 'Owed at death: <b>' + esc(F.fmtM2(S.taxWith)) + '</b> with the freeze, <b>' + esc(F.fmtM2(S.taxNo)) + '</b> without.';
    var extra = S.exhausted ? 'The preferred shares are all bought back by age ' + S.exhaustedAge + '.' : S.noGainAtFreeze ? 'No gain at the freeze: all later growth goes to the trust.' : '';
    $('answer-extra').textContent = extra; $('answer-extra').hidden = !extra;
    $('lede').textContent = 'A made-up retiree, ' + i.freezeAge + ', moves a portfolio into a company and freezes its value.';
    $('assume-text').textContent = 'One made-up Ontario owner, ' + R.rateYear + ' top rates, every figure an example. Tax moved to the trust is deferred, not removed.';
    $('chart-title').textContent = S.deemedFirst
      ? 'The trust’s ' + Y21 + ' year, at ' + S.deemedAge + ', comes before death at ' + i.deathAge + '.'
      : 'At ' + i.deathAge + ': ' + F.fmtM1(S.gainWith) + ' taxed at death, not ' + F.fmtM1(S.gainNo) + '. The trust’s ' + F.fmtM1(S.trust) + ' is taxed later.';
    $('chart-desc').textContent = 'From age ' + i.freezeAge + ' to ' + i.deathAge + ', the gain not yet taxed grows from ' + F.fmtM1(S.rows[0].gainNo) + ' to ' + F.fmtM1(S.gainNo)
      + '. With the freeze, ' + F.fmtM1(S.gainWith) + ' of it is taxed at death and the trust holds ' + F.fmtM1(S.trust) + ', taxed when it sells or is deemed to sell (its ' + Y21 + ' year is at age ' + S.deemedAge + '). The year-by-year table in Go deeper has every number.';
    // How this is worked out
    var rid = 'federal_brackets.' + R.rateYear + ' ontario_brackets.' + R.rateYear + ' ontario_surtax.' + R.rateYear;
    var how = [
      'Portfolio at ' + i.deathAge + ' = ' + esc(F.fmtInput(i.value)) + ' grown ' + esc(F.fmtPct(i.growth)) + ' a year for ' + S.n + (S.n === 1 ? ' year' : ' years') + ' = ' + esc(F.fmtM2(S.Vn)) + '.',
      'No freeze: gain = ' + esc(F.fmtM2(S.Vn)) + ' − tax cost ' + esc(F.fmtInput(i.cost)) + ' = ' + esc(F.fmtM2(S.gainNo)) + '.',
      'Freeze: the note takes the ' + esc(F.fmtInput(i.cost)) + ' tax cost, so the preferred shares (' + esc(F.fmtM2(S.pref0)) + ') carry the whole gain. Each year’s redemption = (interest × '
        + fact('refundable_investment_income_rate', rate(R.refInvest)) + ' + eligible dividends × ' + fact('part_iv_tax_rate', rate(R.partIV)) + ') ÷ ' + fact('dividend_refund_rate', rate(R.refundRate))
        + ', so ' + esc(F.fmtM2(S.redeemed)) + ' is bought back by ' + i.deathAge + ', leaving ' + esc(F.fmtM2(S.gainWith)) + '.',
      'Tax at death = gain × ' + fact('capital_gains_inclusion_rate', rate(R.inclusion)) + ' × ' + fact(rid, rate(R.topOrdinary)) + ' (the ' + R.rateYear
        + ' top federal and Ontario rates with the Ontario surtax) = gain × ' + fact(rid + ' capital_gains_inclusion_rate', rate(R.cgRate)) + '.',
    ];
    var lt0 = R.lifeTable;
    how.push('The age at death, ' + i.deathAge + ', is an example: ' + (i.freezeAge === lt0.age && i.deathAge === F.defaultDeathAge(R, i.freezeAge)
      ? 'about ' + Math.round((lt0.male + lt0.female) / 2) + ' more years at ' + lt0.age + ', between men\u2019s ' + fact('life_expectancy_age70_male', String(lt0.male)) + ' and women\u2019s ' + fact('life_expectancy_age70_female', String(lt0.female)) + ' (Statistics Canada, ' + lt0.from + ' to ' + lt0.to + '), not a prediction for anyone.'
      : 'changed from the example; not a prediction for anyone.'));
    if (R.eat) how.push('Estate administration tax = ' + fact('ontario_estate_admin_tax_rate', money0(R.eat.rate)) + ' per ' + esc(money0(R.eat.per)) + ' (or part) of the estate over '
      + fact('ontario_estate_admin_tax_exemption', money0(R.eat.exemption)) + ', on ' + esc(F.fmtM2(S.Vn)) + '. With the freeze it is assumed not payable (a secondary will).');
    $('how').innerHTML = '<ol>' + how.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol><p>The big figure is the trust’s ' + esc(F.fmtM2(S.trust))
      + ' gain at death times today’s ' + esc(rate(R.cgRate)) + '. The real tax comes when the trust sells or is deemed to sell, at the rates of that day. Growth after death is not modelled.</p>';
    // the death-age hint (only at the life table's age)
    var lt = R.lifeTable, hint = $('death-hint');
    if (i.freezeAge === lt.age) {
      hint.textContent = 'About ' + Math.round((lt.male + lt.female) / 2) + ' more years: between men’s ' + lt.male + ' and women’s ' + lt.female + ' at ' + lt.age
        + ' (Statistics Canada, ' + lt.from + ' to ' + lt.to + '). An example, not a prediction.';
      hint.hidden = false;
    } else hint.hidden = true;
    $('reset').hidden = KEYS.every(function (k) { return Math.abs(st[k] - START[k]) < 1e-9; });
    var fl = $('flow').children;
    var flow = [
      'The retiree moves the portfolio into a new company.',
      'Back come a note for its tax cost (<b>' + esc(F.fmtInput(i.cost)) + '</b>) and preferred shares fixed at today’s gain (<b>' + esc(F.fmtInput(S.pref0)) + '</b>).',
      'A family trust buys the company’s common shares for a nominal amount; growth from here lands on them.',
      'Each year the company buys back some preferred shares.',
    ];
    if (!fl.length) $('flow').innerHTML = flow.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    else flow.forEach(function (s, k) { if (fl[k].innerHTML !== s) fl[k].innerHTML = s; });
  }

  // ---- Go deeper: redemptions and the year-by-year table (drawn when open) ----
  var deeper = $('deeper');
  function drawDeeper() {
    if (!deeper.open) return;
    var svg = $('bars'), W = Math.max(280, Math.floor($('bars-frame').clientWidth)), H = 220, rows = S.rows.slice(1);
    clear(svg); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    var hi = 0; rows.forEach(function (r) { hi = Math.max(hi, r.R); });
    var padT = FS * 2.6, padB = FS + 14, PH = H - padT - padB, bw = W / rows.length;
    var Y = function (v) { return padT + (1 - (hi ? v / hi : 0)) * PH; };
    rows.forEach(function (r, i) { if (r.R > 0) el('rect', { x: (i * bw + 1).toFixed(1), y: Y(r.R).toFixed(1), width: Math.max(1, bw - 2).toFixed(1), height: (Y(0) - Y(r.R)).toFixed(1), 'class': 'bar' }, svg); });
    el('line', { x1: 0, x2: W, y1: Y(0), y2: Y(0), 'class': 'zero' }, svg);
    var first = rows[0], lastR = rows[rows.length - 1];
    var t1 = el('text', { x: 0, y: FS + 2, 'class': 'rd' }, svg, 'Year 1: about ' + money0(first.R));
    if (rows.length > 1) {
      var w1 = measure(t1.textContent, '600 ' + FS + 'px ' + SERIF), lt = 'Year ' + rows.length + ': ' + money0(lastR.R), w2 = measure(lt, '600 ' + FS + 'px ' + SERIF);
      el('text', { x: W, y: w1 + w2 + 24 < W ? FS + 2 : FS * 2.3 + 2, 'text-anchor': 'end', 'class': 'rd' }, svg, lt);
    }
    el('text', { x: 0, y: H - 4, 'class': 'tick' }, svg, 'Age ' + (S.inp.freezeAge + 1));
    if (rows.length > 1) el('text', { x: W, y: H - 4, 'text-anchor': 'end', 'class': 'tick' }, svg, String(S.inp.deathAge));
    var c1 = S.rows[1];
    $('cash-line').textContent = c1.cash == null ? '' : 'In year one the company earns ' + money0(c1.income) + ', pays ' + money0(c1.corpTax) + ' in tax, gets ' + money0(c1.refund) + ' back and buys back ' + money0(c1.R) + ' of shares.';
    $('cash-line').hidden = c1.cash == null;
    $('mechanism').textContent = 'Part of the tax the company pays on its investment income is refundable: it comes back when the company pays dividends, and buying back its own shares counts as one. So each year it buys back just enough to recover that tax: the refundable tax ÷ the ' + rate(R.refundRate) + ' dividend refund rate.'
      + (S.exhausted ? ' Here the preferred shares run out at age ' + S.exhaustedAge + '.' : '');
    $('years-rows').innerHTML = S.rows.map(function (r) {
      return '<tr' + (r.t === S.n ? ' class="death"' : '') + '><td>' + r.age + (r.t === S.n ? ' (death)' : '') + '</td><td>' + F.fmtM2(r.V) + '</td><td>' + (r.t ? money0(r.R) : '–') + '</td><td>' + F.fmtM2(r.prefLeft)
        + '</td><td>' + F.fmtM2(r.trust) + '</td><td>' + F.fmtM2(r.gainNo) + '</td><td>' + F.fmtM2(r.gainWith) + '</td></tr>';
    }).join('');
  }
  deeper.addEventListener('toggle', drawDeeper);

  // ---- Sources and the version line ----
  (function sources() {
    var items = R.used.map(function (f) { return '<li><a href="' + esc(f.source_url) + '">' + esc(f.title) + '</a> · as of ' + esc(longDate(f.as_of)) + '</li>'; });
    var ver = 'Version ' + DATA.version + ' · rates as of ' + longDate(DATA.asOf) + ' · made in this browser; nothing was sent.';
    $('sources').innerHTML = '<p>Every rate and rule on this page is read from these official sources (confirmed values only). The life expectancy figures are from <a href="' + esc(R.lifeTable.url)
      + '">Statistics Canada table 13-10-0114-01</a>, life tables, ' + R.lifeTable.from + ' to ' + R.lifeTable.to + '.</p><ul>' + items.join('') + '</ul>'
      + '<p>How it’s made: the calculation was written from scratch for this site and runs in this browser. The retiree and the inputs are made up: example assumptions, not facts, and not anyone’s situation. ' + esc(ver) + '</p>';
    $('foot-version').textContent = ver;
  })();

  // ---- Save as one page: the sheet, built from the current state, then the browser's print ----
  var sheet = $('sheet');
  function buildSheet() {
    var i = S.inp, notes = document.querySelector('.desk-notes');
    // the sources, shortened to statute sections and page names (one line or two on paper)
    var acts = [], pagesBy = [], HOSTS = [['canada.ca', 'CRA tax rates and T4127'], ['ontario.ca', 'Ontario estate administration and corporate tax pages'], ['statcan.gc.ca', 'Statistics Canada table 13-10-0114-01']];
    R.used.forEach(function (f) {
      var m = f.title.match(/Income Tax Act ([\d.]+)/);
      if (m) { if (acts.indexOf(m[1]) < 0) acts.push(m[1]); return; }
      var host = f.source_url.replace(/^https:\/\/([^/]+).*$/, '$1'), hit = HOSTS.filter(function (h) { return host === h[0] || host.slice(-h[0].length - 1) === '.' + h[0]; })[0];
      var name = hit ? hit[1] : f.title.split(/ \(|,/)[0].trim();
      if (pagesBy.indexOf(name) < 0) pagesBy.push(name);
    });
    acts.sort(function (p, q) { return parseFloat(p) - parseFloat(q); });
    var srcs = pagesBy;
    var addr = siteAddress(DESK_SITE.origin), date = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
    var rowsNow = [
      ['Gain taxed at death', F.fmtM2(S.gainNo), F.fmtM2(S.gainWith)],
      ['Income tax on it (' + rate(R.cgRate) + ' top rate on gains, ' + R.rateYear + ')', F.fmtM2(S.taxNo), F.fmtM2(S.taxWith)],
    ];
    if (R.eat) rowsNow.push(['Ontario estate administration tax', F.fmtM2(S.eatNo), 'not payable (assumed)']);
    var td = function (v) { return '<td class="' + (/^\$/.test(v) ? 'n' : 'w') + '">' + esc(v) + '</td>'; };
    var tr = function (r, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + esc(r[0]) + '</td>' + td(r[1]) + td(r[2]) + '</tr>'; };
    sheet.innerHTML = '<div class="sh-top"><span>' + esc(STAMP) + '</span><span class="sh-r">' + esc(addr) + ' · Printed ' + esc(date) + '</span></div>'
      + '<p class="sh-title">' + esc($('question').textContent) + '</p>'
      + '<p class="sh-inputs">A made-up retiree, <b>' + i.freezeAge + '</b>: portfolio <b>' + esc(F.fmtInput(i.value)) + '</b>, tax cost <b>' + esc(F.fmtInput(i.cost)) + '</b>, growth <b>' + esc(F.fmtPct(i.growth))
        + '</b> a year, income <b>' + esc(F.fmtInput(i.income)) + '</b> (' + esc(F.fmtPct(i.eligibleShare)) + ' eligible dividends, growing ' + esc(F.fmtPct(i.incomeGrowth)) + '), death at <b>' + i.deathAge
        + '</b> (example). Ontario, ' + R.rateYear + ' top rates.</p>'
      + '<div class="sh-chart"><svg id="sheet-chart" role="img" aria-label="Gain not yet taxed, by age"></svg></div>'
      + '<table class="sh-ledger"><thead><tr><th>At death, age ' + i.deathAge + '</th><th>No freeze</th><th>With the freeze</th></tr></thead><tbody>'
      + rowsNow.map(function (r) { return tr(r); }).join('') + tr(['Payable at death', F.fmtM2(S.payableNo), F.fmtM2(S.payableWith)], 'total')
      + '<tr class="later-h"><th colspan="3">Taxed later</th></tr>'
      + tr(['Gain held by the trust (' + F.fmtM2(S.trustSplit.growth) + ' growth + ' + F.fmtM2(S.trustSplit.redemptions) + ' redeemed)', 'none', F.fmtM2(S.trust)])
      + tr(['Its income tax at today’s rate, deferred', 'none', F.fmtM2(S.pushed)])
      + tr(['Taxed when the trust sells, or is deemed to sell at its ' + Y21 + ' year', '', 'age ' + S.deemedAge]) + '</tbody></table>'
      + '<ul class="sh-caveats">' + caveats(false).map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>'
      + '<p class="sh-close">How any of this applies to a real family is a question for a tax professional and a lawyer.</p>'
      + '<div class="sh-foot"><p>Sources: Income Tax Act ss. ' + esc(acts.join(', ')) + '; ' + esc(srcs.join('; ')) + '.</p>'
      + '<p>Version ' + esc(DATA.version) + ' · rates as of ' + esc(longDate(DATA.asOf)) + ' · made in this browser; nothing was sent.</p>'
      + '<p>Made with an interactive tool by ' + esc(DESK_SITE.wordmark) + '. ' + esc(notes ? notes.textContent.replace(/\s+/g, ' ').trim() : '') + '</p></div>';
    drawBand($('sheet-chart'), S, { W: 680, H: 180, print: true, hatch: 'ef-sh-hatch' });
  }
  $('print').addEventListener('click', function () { buildSheet(); try { window.print(); } catch (e) { /* the sheet is ready for the browser's own print */ } });
  addEventListener('beforeprint', buildSheet);

  // ---- Save my card: 1080x1350, the two bands, the stamp ----
  function tok(n) { return getComputedStyle(document.documentElement).getPropertyValue('--t-' + n).trim(); }
  function miniBand(x, box, C) {
    var rows = S.rows, a0 = S.inp.freezeAge, aD = S.inp.deathAge, aMax = S.xMax, d3 = tok('d3'), d4 = tok('d4');
    var hi = 0; rows.forEach(function (r) { hi = Math.max(hi, r.gainNo); }); hi = hi || 1;
    var X = function (a) { return box.x + (a - a0) / (aMax - a0) * box.w; }, Y = function (v) { return box.y + box.h - v / hi * box.h; };
    function path(pts, close) { x.beginPath(); pts.forEach(function (p, k) { if (k) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); if (close) x.closePath(); }
    var edge = [[X(a0), Y(rows[0].gainWith)]];
    for (var k = 1; k <= S.n; k++) { edge.push([X(rows[k].age), Y(rows[k - 1].gainWith)]); edge.push([X(rows[k].age), Y(rows[k].gainWith)]); }
    var topPts = rows.map(function (r) { return [X(r.age), Y(r.gainWith + r.trustDrawn)]; });
    x.save(); x.globalAlpha = 0.4; x.fillStyle = d4; path([[X(a0), Y(0)]].concat(edge).concat([[X(aD), Y(0)]]), true); x.fill();
    x.fillStyle = d3; path(topPts.concat(edge.slice().reverse()), true); x.fill();
    if (!S.deemedFirst) { x.fillRect(X(aD), Y(S.trust), X(S.deemedAge) - X(aD), Y(0) - Y(S.trust)); }
    x.restore();
    // the hatch over the trust's share
    x.save(); path(topPts.concat(edge.slice().reverse()), true);
    if (!S.deemedFirst) x.rect(X(aD), Y(S.trust), X(S.deemedAge) - X(aD), Y(0) - Y(S.trust));
    x.clip(); x.strokeStyle = d3; x.lineWidth = 3;
    for (var h = box.x - box.h; h < box.x + box.w; h += 18) { x.beginPath(); x.moveTo(h, box.y + box.h); x.lineTo(h + box.h, box.y); x.stroke(); }
    x.restore();
    x.strokeStyle = d4; x.lineWidth = 5; path(edge); x.stroke();
    x.strokeStyle = C.ink; x.lineWidth = 5; path(rows.map(function (r) { return [X(r.age), Y(r.gainNo)]; })); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.moveTo(X(aD), box.y); x.lineTo(X(aD), box.y + box.h); x.stroke();
    x.strokeStyle = d3; x.lineWidth = 3; x.setLineDash([14, 10]); x.beginPath(); x.moveTo(X(S.deemedAge), box.y); x.lineTo(X(S.deemedAge), box.y + box.h); x.stroke(); x.setLineDash([]);
    x.fillStyle = C.ink; x.fillRect(box.x, box.y + box.h, box.w, 2);
  }
  deskSaveButton('#card', function () {
    return deskCard({
      question: $('question').textContent, bigValue: F.fmtBig(S.pushed),
      line: (S.state === 'deemedFirst' ? 'income tax moved to the trust' : 'income tax pushed past death') + ': deferred, not removed',
      labels: ['Taxed at death: ' + F.fmtM1(S.gainNo) + ' → ' + F.fmtM1(S.gainWith), 'Trust’s ' + Y21 + ' year: age ' + S.deemedAge],
      draw: miniBand, stamp: STAMP,
    }).then(function (blob) { return { blob: blob, name: 'estate-freeze-card.png', title: $('question').textContent }; });
  });

  // ---- one render for every change ----
  var queued = false;
  function render(first, later) {
    S = F.freeze(R, st);
    st.cost = S.inp.cost; st.deathAge = S.inp.deathAge;
    paintWords(first === true);
    paintLedger();
    STEPS.concat(MORE).forEach(function (c) { c.paint(); });
    if (!later) { drawChart(); drawDeeper(); return; }
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; drawChart(); drawDeeper(); });
  }
  render(true);
  paintSlider();
  // the ink underline marks a change the visitor made, so the watchers start after the first paint
  Object.keys(LED).forEach(function (k) { deskWatchFlash(LED[k].no); deskWatchFlash(LED[k].with); });
  STEPS.concat(MORE).forEach(function (c) { deskWatchFlash(c.out); });
  var lastW = frame.clientWidth;
  new ResizeObserver(function () { if (frame.clientWidth !== lastW) { lastW = frame.clientWidth; drawChart(); drawDeeper(); paintSlider(); } }).observe(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { drawChart(); paintSlider(); });
})();
