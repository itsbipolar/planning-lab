// Estate freeze: the page. The engine is FREEZE (model.mjs, inlined by build.mjs); every rate comes from the confirmed
// facts in the page's data block. Inputs live in memory only: nothing in the address, nothing stored. The page makes no
// request after it loads; the card and the one-page sheet are made in this browser.
// Clarity pass (2026-11-16): the main path speaks only in income tax (every tax figure through one formatter,
// FREEZE.taxScale), says the sum (due at death + paid by the trust = the tax without a freeze), explains the moves
// before the chart, and the chart ends at death. Gains live in folds, always called "gain".
// Second pass (2026-11-16, after fresh readers): the answer is the income tax moved to the trust (it no longer falls
// when the trust's anniversary comes first); the shown parts are rounded once (FREEZE.taxParts) so they add up; the
// moves carry their figures and say who gets what; "original cost" replaces "amount paid"; the ledger sits in Go deeper.
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
  var st = copy(START), S = null, T = null, TP = null; // T: the one income-tax formatter; TP: the parts as shown (they add up)

  function copy(o) { var c = {}; KEYS.forEach(function (k) { c[k] = o[k]; }); return c; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ordinal(n) { var t = n % 100, o = n % 10; return n + (t >= 11 && t <= 13 ? 'th' : o === 1 ? 'st' : o === 2 ? 'nd' : o === 3 ? 'rd' : 'th'); }
  function rate(r) { return F.fmtRate(r).replace('.00%', '%'); }
  function money0(n) { return '$' + Math.round(n).toLocaleString('en-CA'); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function shortDate(d) { var p = String(d).split('-').map(Number); return MONTHS[p[1] - 1].slice(0, 3) + ' ' + p[2] + ', ' + p[0]; }
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

  // ---- the words for the trust's anniversaries (computed: the 21 is a fact, every age comes from the state) ----
  function agesText(list) { return list.length < 2 ? String(list[0]) : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  function anns(S) { return S.anniversaries; }                       // ages of the trust’s anniversaries up to death
  function annWhen(S) { var a = anns(S); return a[a.length - 1] < S.inp.deathAge ? 'before death' : 'in the year of death'; }
  function annPhrase(S) { return 'at ' + agesText(anns(S)); }         // "at 81", "at 76 and 97"
  // the per-age income tax at today's rate: due at death with the freeze, paid later by the trust, paid by the trust at
  // its anniversaries in life, and due at death without a freeze (the first three add up to the last)
  function taxAt(r) {
    var cg = R.cgRate;
    return { death: r.gainWith * cg, later: r.trustDrawn * cg, early: (r.trust - r.trustDrawn) * cg, no: r.gainNo * cg };
  }

  // ---- the chart: income tax if death came at each age; three stacked bands under the no-freeze line ----
  function niceStep(range, n) {
    var raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  function Placer(W, H) {
    var boxes = [];
    function hit(b) { return b.x < 0 || b.x + b.w > W || b.y < 0 || b.y + b.h > H || boxes.some(function (o) { return b.x < o.x + o.w + 4 && o.x < b.x + b.w + 4 && b.y < o.y + o.h + 2 && o.y < b.y + b.h + 2; }); }
    return { hit: hit, add: function (b) { boxes.push(b); }, boxes: boxes, grow: function (h) { H = h; } };
  }
  function textBox(x, y, w, anchor, size) { var s = size || FS; var x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x; return { x: x0, y: y - s * 0.8, w: w, h: s * 1.05 }; }

  // drawBand(svg, S, { W, H, print, hatch }): draws the chart into svg (1 unit = 1px); returns the scales for the crosshair
  function drawBand(svg, S, o) {
    clear(svg);
    var W = o.W, H = o.H, narrow = W < 640, VF = o.print ? 18 : 19, LH = Math.round(FS * 1.5);
    var fVal = '600 ' + VF + 'px ' + SERIF, TX = F.taxScale(S), PT = F.taxParts(S);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    var defs = el('defs', {}, svg);
    var pat = el('pattern', { id: o.hatch, patternUnits: 'userSpaceOnUse', width: 7, height: 7, patternTransform: 'rotate(45)' }, defs);
    el('line', { x1: 1, y1: 0, x2: 1, y2: 7, 'class': 'hatch-line' }, pat);
    var hatch = 'url(#' + o.hatch + ')';
    var rows = S.rows, n = S.n, a0 = S.inp.freezeAge, aD = S.inp.deathAge, last = taxAt(rows[n]);
    var tx = rows.map(taxAt), A = anns(S), aFirst = A.length ? A[0] : null;

    // the y scale first (its labels set the left gutter): $0 and round steps, a little headroom over the top value
    var hi = 0; tx.forEach(function (t) { hi = Math.max(hi, t.no); });
    if (hi <= 0) hi = S.inp.value * R.cgRate || 1;
    var step = niceStep(hi, o.print ? 3 : 4), top = hi * 1.08, ticks = [];
    for (var tv = 0; tv <= top + 1e-6; tv += step) ticks.push(tv);
    // the axis speaks in the answer's unit: $1M steps beside $X.XXM figures, $K steps beside $XXXK figures
    var axisFmt = /M$/.test(TX(S.taxNo)) ? F.fmtAxis : TX;
    var lgut = Math.ceil(Math.max.apply(null, ticks.map(function (t) { return measure(axisFmt(t), fSans); })) + 10);

    // the readings at death, in the order the bands stack, bottom to top: due at death, paid by the trust at its
    // anniversaries (solid), paid later (hatched, on top, under the no-freeze line). Each names what it is and when it
    // is paid; lo and hi are its band. The figures are the shown parts (they add up to the no-freeze figure).
    var reads;
    if (last.later + last.early <= 0) reads = [{ key: 'nofreeze', v: PT.total, words: 'all due at death', at: last.no }];
    else {
      reads = [
        { key: 'death', v: PT.death, words: 'due at death with the freeze', lo: 0, hi: last.death },
        { key: 'early', v: PT.early, words: 'paid by the trust ' + annPhrase(S), lo: last.death, hi: last.death + last.early },
        { key: 'later', v: PT.later, words: 'paid later, by the trust', lo: last.death + last.early, hi: last.no },
        { key: 'nofreeze', v: PT.total, words: 'due at death without a freeze', at: last.no },
      ].filter(function (r) { return r.key === 'nofreeze' || r.v > 0; });
    }
    // the right gutter: wide enough for the readings (on paper each is one line, value and words)
    var printW = !o.print ? 0 : Math.max.apply(null, reads.map(function (r) { return measure(TX(r.v) + ' ', fVal) + measure(r.words, fSans); })) + 24;
    var gut = Math.ceil(Math.max(narrow ? 140 : 150, printW, narrow ? 0 : 0.15 * W, measure('$00.00M', fVal) + 24));
    var x0 = lgut, x1 = W - gut;
    var X = function (a) { return x0 + (a - a0) / (aD - a0) * (x1 - x0); };
    // each reading's height (on screen: the figure, then its words wrapped to the gutter)
    var bx = x1 + 7, lx = x1 + 18, wordW = W - lx - 2;
    reads.forEach(function (r) {
      r.lines = o.print ? [] : wrapText(r.words, wordW, function (s) { return measure(s, fSans); });
      r.h = o.print ? VF * 1.25 : VF * 1.15 + r.lines.length * FS * 1.2;
    });

    // the marker labels above the plot, set in age order (top row first); a label never crosses an earlier marker's line
    var P = Placer(W, H), markRows = 0, markers = [], lines = [];
    var marks = [];
    if (aFirst === aD) marks.push({ age: aD, v: ['Death and the trust’s ' + Y21 + ' anniversary, ' + aD, 'Death and the trust’s', Y21 + ' anniversary, ' + aD], cls: 'death-line' });
    else {
      // on paper the inputs line already says the age at death is an example
      marks.push({ age: aD, v: o.print ? ['Death at ' + aD, 'Death at', String(aD)] : ['Death at ' + aD + ' (example)', 'Death at ' + aD, '(example)'], cls: 'death-line' });
      if (aFirst != null) {
        var paid = TX(tx[aFirst - a0].early);
        marks.push({ age: aFirst, v: [Y21 + ' anniversary, ' + aFirst + ': trust pays ' + paid + ' tax', Y21 + ' anniversary, ' + aFirst + ':', 'trust pays ' + paid + ' tax'], cls: 'deemed-line' });
      }
    }
    marks.sort(function (p, q) { return p.age - q.age; });
    function crossesLine(b) { return lines.some(function (l) { return b.x < l.x + 6 && l.x - 6 < b.x + b.w && b.y + b.h > l.y; }); }
    marks.forEach(function (m) {
      var x = X(m.age), variants = [[m.v[0]], [m.v[1], m.v[2]]], done = false;
      for (var r = 0; r < 4 && !done; r++) {
        for (var vi = 0; vi < variants.length && !done; vi++) {
          var ls = variants[vi], w = Math.max.apply(null, ls.map(function (s) { return measure(s, fSans6); }));
          var cands = [['end', x - 6], ['start', x + 6], ['end', W - 2]];
          for (var c = 0; c < cands.length && !done; c++) {
            var bs = ls.map(function (s, k) { return textBox(cands[c][1], 4 + FS + (r + k) * LH, w, cands[c][0]); });
            if (bs.some(function (b) { return P.hit(b) || crossesLine(b); })) continue;
            bs.forEach(P.add);
            m.lines = ls; m.anchor = cands[c][0]; m.tx = cands[c][1]; m.ty = 4 + FS + r * LH; m.bottom = 4 + FS + (r + ls.length - 1) * LH;
            markRows = Math.max(markRows, r + ls.length); done = true;
          }
        }
      }
      if (!done) { m.lines = [m.v[0]]; m.anchor = 'end'; m.tx = Math.min(W - 2, Math.max(measure(m.v[0], fSans6), x)); m.ty = m.bottom = 4 + FS + markRows * LH; markRows++; }
      lines.push({ x: x, y: m.bottom + 4 });
      markers.push(m);
    });
    var padT = 8 + markRows * LH + 10, padB = FS + 16;
    // on screen the plot grows until every reading fits beside it, the no-freeze one included
    if (!o.print) {
      var need = reads.reduce(function (t, r) { return t + r.h; }, 0) + 8 * (reads.length - 1) + 10;
      if (H - padT - padB < need) { H = Math.ceil(padT + padB + need); P.grow(H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('height', H); }
    }
    var PH = H - padT - padB;
    var Y = function (v) { return padT + (1 - v / top) * PH; };
    var gGrid = el('g', {}, svg), gMarks = el('g', {}, svg), gText = el('g', {}, svg);

    // gridlines, and the y labels in the left gutter, centred on their lines
    ticks.forEach(function (t) {
      if (t > 0) el('line', { x1: x0, x2: x1, y1: Y(t).toFixed(1), y2: Y(t).toFixed(1), 'class': 'grid' }, gGrid);
      var lb = axisFmt(t), by = Y(t) + FS * 0.33;
      el('text', { x: x0 - 8, y: by.toFixed(1), 'text-anchor': 'end', 'class': 'ylab' }, gText, lb);
      P.add(textBox(x0 - 8, by, measure(lb, fSans), 'end'));
    });

    function line(pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(''); }
    function band(topPts, botPts) { return line(topPts.concat(botPts.slice().reverse())) + 'Z'; }
    // a stepped line from row k0 to death: it steps at each year end (the buy-backs, the trust's anniversaries)
    function stepLine(f, k0) {
      var pts = [[X(rows[k0].age), Y(f(k0))]];
      for (var i = k0 + 1; i <= n; i++) { pts.push([X(rows[i].age), Y(f(i - 1))]); pts.push([X(rows[i].age), Y(f(i))]); }
      return pts;
    }
    var fDeath = function (k) { return tx[k].death; }, fMid = function (k) { return tx[k].death + tx[k].early; };
    var edge = stepLine(fDeath, 0), noPts = tx.map(function (t, k) { return [X(rows[k].age), Y(t.no)]; });
    // due at death with the freeze: from zero to the step edge
    el('path', { d: line([[X(a0), Y(0)]].concat(edge).concat([[X(aD), Y(0)]])) + 'Z', 'class': 'band-death' }, gMarks);
    // paid later, by the trust (hatched: waiting): on top, from what is due at death (and what the trust paid at its
    // anniversaries) up to the no-freeze line. At an anniversary it starts again from nothing.
    var bandL = band(noPts, stepLine(fMid, 0));
    el('path', { d: bandL, 'class': 'band-trust' }, gMarks);
    el('path', { d: bandL, 'class': 'band-hatch', fill: hatch }, gMarks);
    // paid by the trust at its anniversaries, in life (solid: paid): from the first anniversary, on the due-at-death band
    if (aFirst != null) {
      var k1 = aFirst - a0;
      el('path', { d: band(stepLine(fMid, k1), stepLine(fDeath, k1)), 'class': 'band-early' }, gMarks);
      if (k1 < n) el('path', { d: line(stepLine(fMid, k1)), 'class': 'restart' }, gMarks);
    }
    el('path', { d: line(edge), 'class': 'edge-death' }, gMarks);
    // without a freeze: all of it due at death
    el('path', { d: line(tx.map(function (t, k) { return [X(rows[k].age), Y(t.no)]; })), 'class': 'nofreeze' }, gMarks);
    el('line', { x1: x0, x2: x1, y1: Y(0), y2: Y(0), 'class': 'zero' }, gMarks);
    // later anniversaries before death: their line only
    A.slice(1).forEach(function (a) { if (a < aD) el('line', { x1: X(a).toFixed(1), x2: X(a).toFixed(1), y1: padT, y2: Y(0).toFixed(1), 'class': 'deemed-line' }, gMarks); });
    // the death line (the right edge) and the trust's first anniversary, with their labels
    markers.forEach(function (m) {
      var x = X(m.age).toFixed(1);
      el('line', { x1: x, x2: x, y1: (m.bottom + 6).toFixed(1), y2: Y(0).toFixed(1), 'class': m.cls }, gMarks);
      var t = el('text', { x: m.tx.toFixed(1), y: m.ty.toFixed(1), 'text-anchor': m.anchor, 'class': 'mark-t' }, gText);
      m.lines.forEach(function (s, i) { el('tspan', { x: m.tx.toFixed(1), dy: i ? LH : 0 }, t, s); });
    });

    // x ticks: the freeze, death and the first anniversary always; every 5 years when wide
    var must = [a0, aD].concat(aFirst != null && aFirst < aD ? [aFirst] : []).sort(function (p, q) { return p - q; });
    var extra = [];
    if (!narrow) for (var a = Math.ceil(a0 / 5) * 5; a <= aD; a += 5) if (must.indexOf(a) < 0) extra.push(a);
    var ty = Y(0) + FS + 8;
    must.concat(extra).forEach(function (age) {
      var txt = age === a0 ? 'Age ' + age : String(age), w = measure(txt, fSans), x = X(age);
      var cands = age === a0 ? [['start', x - Math.min(lgut, w / 2)], ['start', x]] : age === aD ? [['middle', x], ['end', x + 4]] : [['middle', x], ['end', x + w / 2], ['start', x - w / 2]];
      for (var c = 0; c < cands.length; c++) {
        var b = textBox(cands[c][1], ty, w, cands[c][0]);
        if (b.x >= 0 && b.x + b.w <= W && !P.hit(b)) {
          P.add(b);
          el('text', { x: cands[c][1].toFixed(1), y: ty.toFixed(1), 'text-anchor': cands[c][0], 'class': 'tick' }, gText, txt);
          el('line', { x1: x.toFixed(1), x2: x.toFixed(1), y1: Y(0), y2: Y(0) + 5, 'class': 'zero' }, gMarks);
          return;
        }
      }
    });

    // the readings in the right gutter. A band's reading has a 2px bracket in its colour spanning the band at death, so
    // its height is its value; the no-freeze reading points at the top line. No legend.
    reads.forEach(function (r) { r.ty = r.at != null ? Y(r.at) : (Y(r.lo) + Y(r.hi)) / 2; });
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
    // too many to fit (on paper only; on screen the plot grew): the no-freeze reading goes first (its figure is in the answer)
    if (!layout(shown)) { shown = reads.filter(function (r) { return r.key !== 'nofreeze' || reads.length === 1; }); layout(shown); }
    shown.forEach(function (r) {
      var mid = r.top + VF * 0.6;
      if (r.at != null) {
        el('circle', { cx: (x1 + 1).toFixed(1), cy: r.ty.toFixed(1), r: 3, 'class': 'end-dot' }, gMarks);
        el('path', { d: 'M' + (x1 + 4).toFixed(1) + ' ' + r.ty.toFixed(1) + 'L' + (lx - 4).toFixed(1) + ' ' + mid.toFixed(1), 'class': 'leader', fill: 'none' }, gMarks);
      } else {
        var yH = Y(r.hi) + 1, yL = Y(r.lo) - 1;
        if (yL - yH >= 3) el('path', { d: 'M' + (bx - 4).toFixed(1) + ' ' + yH.toFixed(1) + 'H' + bx.toFixed(1) + 'V' + yL.toFixed(1) + 'H' + (bx - 4).toFixed(1), 'class': 'bracket b-' + r.key, fill: 'none' }, gMarks);
        else el('circle', { cx: bx.toFixed(1), cy: r.ty.toFixed(1), r: 2.5, 'class': 'bracket-dot b-' + r.key }, gMarks);
        el('path', { d: 'M' + (bx + 2).toFixed(1) + ' ' + r.ty.toFixed(1) + 'L' + (lx - 4).toFixed(1) + ' ' + mid.toFixed(1), 'class': 'leader', fill: 'none' }, gMarks);
      }
      var t = el('text', { x: lx, y: (r.top + VF * 0.95).toFixed(1), 'class': 'rd' }, gText);
      el('tspan', { x: lx, 'class': 'rd-v r-' + r.key }, t, TX(r.v));
      if (o.print) el('tspan', { 'class': 'rd-w', dx: 6 }, t, r.words);
      r.lines.forEach(function (s, i) { el('tspan', { x: lx, dy: (i ? FS * 1.2 : VF * 0.2 + FS * 1.05).toFixed(1), 'class': 'rd-w' }, t, s); });
      P.add({ x: lx, y: r.top, w: W - lx, h: r.h });
    });

    // the one annotation, inside the due-at-death band, with a 1px leader to its stepped edge (only when there are buy-backs)
    if (S.pref0 > 0 && S.redeemed > 0) {
      var texts = narrow ? [['Yearly buy-backs', 'shrink this']] : [['Yearly buy-backs shrink this'], ['Yearly buy-backs', 'shrink this']];
      for (var q = 0; q < texts.length; q++) {
        var ls = texts[q], w = Math.max.apply(null, ls.map(function (s) { return measure(s, fSans6); })), h = ls.length * FS * 1.2;
        var ax = X(a0) + 8, base = Y(0) - 7 - (ls.length - 1) * FS * 1.2, boxA = { x: ax - 2, y: base - FS * 0.85, w: w + 4, h: h };
        var reach = Math.min(aD, a0 + (ax + w + 28 - x0) / (x1 - x0) * (aD - a0)), ti = Math.min(n, Math.ceil(reach - a0));
        if (ti < 1 || Y(tx[ti].death) > boxA.y - 3 || P.hit(boxA)) continue;
        P.add(boxA);
        var at = el('text', { x: ax.toFixed(1), y: base.toFixed(1), 'class': 'annot' }, gText);
        ls.forEach(function (s, i) { el('tspan', { x: ax.toFixed(1), dy: i ? (FS * 1.2).toFixed(1) : 0 }, at, s); });
        var lxA = ax + Math.min(w * 0.55, measure(ls[0], fSans6) * 0.8), la = a0 + (lxA - x0) / (x1 - x0) * (aD - a0), li = Math.min(n, Math.max(1, Math.ceil(la - a0)));
        if (Y(tx[li].death) + 3 < boxA.y - 3) el('path', { d: 'M' + lxA.toFixed(1) + ' ' + (boxA.y - 3).toFixed(1) + 'V' + (Y(tx[li].death) + 3).toFixed(1), 'class': 'leader', fill: 'none' }, gMarks);
        break;
      }
    }
    return { X: X, Y: Y, x0: X(a0), x1: X(aD), padT: padT, y0: Y(0), W: W };
  }

  // ---- the chart on the page ----
  var chart = $('chart'), frame = $('chart-frame'), dropCross = null, scales = null, kbAge = null;
  function drawChart() {
    var W = Math.max(300, Math.floor(frame.clientWidth)), H = W < 640 ? 344 : W < 1000 ? 420 : 440;
    if (dropCross) { dropCross(); dropCross = null; }
    scales = drawBand(chart, S, { W: W, H: H, print: false, hatch: 'ef-hatch' });
    var rows = S.rows, a0 = S.inp.freezeAge, aD = S.inp.deathAge;
    // x1 is the svg's right edge, not death's: the reading box may then use the gutter, so on a phone it is never pushed
    // off the left edge (a point in the gutter reads the age at death)
    dropCross = deskCrosshair(chart, { x0: scales.x0, x1: scales.W - 2, y0: scales.padT, y1: scales.y0, read: function (px) {
      var a = Math.round(a0 + (px - scales.x0) / (scales.x1 - scales.x0) * (aD - a0));
      a = Math.max(a0, Math.min(aD, a));
      // in the card's order: without a freeze first, then the parts with it (rounded once, so they add up)
      var t = taxAt(rows[a - a0]), past = anns(S).filter(function (x) { return x <= a; });
      var p = F.taxParts({ taxNo: t.no, taxWith: t.death, taxTrustEarly: t.early }, S);
      var lines = ['If death came at ' + a, 'Without a freeze, due at death ' + T(p.total), 'With the freeze, due at death ' + T(p.death)];
      if (past.length) lines.push('Paid by the trust at ' + agesText(past) + ' ' + T(p.early));
      lines.push('Paid later, by the trust ' + T(p.later));
      // pinned to the top of the plot, so the reading box never sits on the point it reads
      return { x: scales.X(a), y: scales.padT, lines: lines };
    } });
  }
  // the arrow keys step the reading one year at a time when the chart has focus
  chart.addEventListener('keydown', function (e) {
    var a0 = S.inp.freezeAge, aMax = S.inp.deathAge, k = e.key;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(k) < 0) return;
    e.preventDefault();
    if (kbAge == null) kbAge = S.inp.deathAge; else kbAge += k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
    if (k === 'Home') kbAge = a0; if (k === 'End') kbAge = aMax;
    kbAge = Math.max(a0, Math.min(aMax, kbAge));
    var rc = chart.getBoundingClientRect(), x = rc.left + scales.X(kbAge) * rc.width / scales.W;
    chart.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: rc.top + rc.height / 2 }));
  });
  chart.addEventListener('blur', function () { kbAge = null; chart.dispatchEvent(new PointerEvent('pointerleave')); });
  // touch: a finger lifting fires pointerleave, which would hide the reading at once. On touch the reading stays until a
  // tap outside the chart (this capture listener runs before the shared crosshair's own).
  chart.addEventListener('pointerleave', function (e) { if (e.pointerType === 'touch') e.stopImmediatePropagation(); }, true);
  document.addEventListener('pointerdown', function (e) {
    if (chart.contains(e.target)) return;
    var g = chart.querySelector('.crosshair'); if (g) g.style.display = 'none';
  });

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
  // the original cost the visitor chose (or the example's): a portfolio below it lowers it only while it is below
  var wantCost = st.cost;
  function setValue(v) {
    st.value = v;
    st.cost = Math.min(wantCost, v);
    paintClamp();
  }
  function paintClamp() {
    $('clamp').textContent = st.cost < wantCost ? 'What the retiree first paid for the investments (the original cost) is set to ' + F.fmtInput(st.cost) + ' here: it can’t be more than the portfolio. It goes back to ' + F.fmtInput(wantCost) + ' once the portfolio is ' + F.fmtInput(wantCost) + ' or more.' : '';
  }

  // ---- steppers: label, minus, the value, plus; 48px buttons, disabled at a bound, never wrapping ----
  var STEPS = [
    { key: 'cost', label: 'Original cost', name: 'original cost', fmt: F.fmtInput, min: function () { return B.cost.min; }, max: function () { return st.value; }, step: B.cost.step },
    { key: 'growth', label: 'Growth a year', name: 'growth', fmt: F.fmtPct, min: function () { return B.growth.min; }, max: function () { return B.growth.max; }, step: B.growth.step },
    { key: 'freezeAge', label: 'Age at the freeze', name: 'age at the freeze', fmt: String, min: function () { return B.freezeAge.min; }, max: function () { return B.freezeAge.max; }, step: B.freezeAge.step },
    { key: 'deathAge', label: 'Age at death', name: 'age at death', fmt: String, min: function () { return st.freezeAge + 1; }, max: function () { return B.deathAge.max; }, step: B.deathAge.step },
  ];
  var MORE = [
    { key: 'income', label: 'Investment income a year', name: 'investment income', fmt: F.fmtInput, min: function () { return B.income.min; }, max: function () { return B.income.max; }, step: B.income.step },
    { key: 'eligibleShare', label: 'Share that is eligible dividends', name: 'eligible dividend share', fmt: F.fmtPct, min: function () { return B.eligibleShare.min; }, max: function () { return B.eligibleShare.max; }, step: B.eligibleShare.step },
    { key: 'incomeGrowth', label: 'Income growth a year', name: 'income growth', fmt: F.fmtPct, min: function () { return B.incomeGrowth.min; }, max: function () { return B.incomeGrowth.max; }, step: B.incomeGrowth.step },
  ];
  var cueKey = 'cost';                              // the cue line names what the last-touched control changes
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
      if (c.key === 'cost') { wantCost = v; paintClamp(); }
      if (c.key === 'freezeAge' && st.deathAge < st.freezeAge + 1) st.deathAge = st.freezeAge + 1;
      if (STEPS.indexOf(c) >= 0) cueKey = c.key;
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
  $('reset').addEventListener('click', function () { st = copy(START); wantCost = st.cost; cueKey = 'cost'; range.value = st.value; paintClamp(); paintSlider(); render(); range.focus(); });

  // ---- the ledger: income tax only, built once, its figures updated on every change. Due at death; paid by the trust
  // at its anniversaries (only when one comes before death); paid later, by the trust; and in all ----
  var LED = {};
  (function buildLedger() {
    var tb = $('ledger-rows');
    function row(key, cls) {
      var tr = document.createElement('tr'); if (cls) tr.className = cls;
      var th = document.createElement('th'); th.setAttribute('scope', 'row'); tr.appendChild(th);
      var a = document.createElement('td'), b = document.createElement('td'); a.className = b.className = 'n';
      a.setAttribute('data-flash', ''); b.setAttribute('data-flash', '');
      tr.appendChild(a); tr.appendChild(b); tb.appendChild(tr);
      LED[key] = { tr: tr, label: th, no: a, with: b };
    }
    row('death'); row('early'); row('later'); row('all', 'total');
  })();
  function laterNote(S) {
    // counted from death, never as the retiree's age (the retiree is no longer alive then)
    var k = Math.round((S.nextDeemedAge - S.inp.freezeAge) / R.trustYears), yrs = S.nextDeemedAge - S.inp.deathAge;
    return 'when it sells, or at its ' + ordinal(k * R.trustYears) + ' anniversary, ' + yrs + (yrs === 1 ? ' year' : ' years') + ' after death';
  }
  // the ledger's rows as [key, label HTML, without, with]; the sheet reuses them
  function ledgerRows() {
    var t = [['death', '<span class="sw death" aria-hidden="true"></span>Due at death', T(TP.total), T(TP.death)]];
    if (S.deemedFirst) t.push(['early', '<span class="sw early" aria-hidden="true"></span>Paid by the trust ' + annPhrase(S) + ', ' + annWhen(S), 'none', T(TP.early)]);
    t.push(['later', '<span class="sw trust" aria-hidden="true"></span>Paid later, by the trust <span class="lg-note">' + esc(laterNote(S)) + '</span>', 'none', T(TP.later)]);
    t.push(['all', 'In all, at today’s rates <span class="lg-note">yearly tax on income and buy-backs left out of both</span>', T(TP.total), T(TP.total)]);
    return t;
  }
  function paintLedger() {
    $('ledger-h').textContent = 'Income tax, death at ' + S.inp.deathAge;
    LED.early.tr.hidden = !S.deemedFirst;
    ledgerRows().forEach(function (r) {
      var L = LED[r[0]];
      L.label.innerHTML = r[1];
      L.no.textContent = r[2]; L.no.className = r[2] === 'none' ? 'w' : 'n';
      L.with.textContent = r[3];
    });
  }

  // ---- the caveats, in three groups (the same seven on the page; shorter on the sheet) ----
  var LAW = 'https://laws-lois.justice.gc.ca/eng/acts/I-3.3/';
  // the Income Tax Act sections the illustration rests on, named but not quantified (no figure is read from them)
  var STATUTES = [
    { s: '70(5)', page: 'section-70.html', what: 'deemed disposition at death' },
    { s: '70(6)', page: 'section-70.html', what: 'rollover to a surviving spouse' },
    { s: '74.4', page: 'section-74.4.html', what: 'corporate attribution' },
    { s: '84(3)', page: 'section-84.html', what: 'deemed dividend on a redemption' },
    { s: '85', page: 'section-85.html', what: 'tax-deferred transfer to a company' },
    { s: '104(4)', page: 'section-104.html', what: 'a trust’s deemed disposition every ' + R.trustYears + ' years' },
  ];
  function caveatGroups(link) {
    var twice = link ? '<a href="/watch/double-tax-at-death/">taxed twice</a>' : 'taxed twice';
    var death = [
      'After death, the estate does the planning that keeps the gain from being ' + twice + '; it is taxed once, as a capital gain.',
      'The IOU stays unpaid until death.',
    ];
    if (R.eat) death.push('The IOU and fixed shares pass under a secondary will that is not submitted for probate, so no estate administration tax (probate) is charged on them. That comes from holding company shares, not from the freeze, and it is an assumption, not a rule.');
    return [
      ['The family and the set-up', [
        'No surviving spouse, or this is the second death. Leaving property to a surviving spouse can defer the tax at death (section 70(6)); that is not shown.',
        'The move uses a section 85 election, so it is tax-deferred, and the freeze is set up so corporate attribution does not apply.',
      ]],
      ['At and after death', death],
      ['Left out', [
        'The company’s own unrealized gain on the portfolio, and its tax when it sells.',
        'How a trust may plan for its ' + Y21 + ' anniversary: the example simply taxes the trust’s gain then.',
        'Yearly tax on the income and the buy-backs, fees, corporate costs and many technical rules.',
      ]],
    ];
  }
  // the same caveats, said shorter for the one-page sheet
  function caveatsShort() {
    var list = [
      'No surviving spouse, or the second death; a spouse could defer the tax (70(6)).',
      'A section 85 election defers tax on the move; no corporate attribution.',
      'After death, planning stops the gain being taxed twice; it counts as a capital gain.',
      'The IOU stays unpaid until death.',
    ];
    if (R.eat) list.push('IOU and fixed shares pass under a secondary will not submitted for probate (assumed; from holding company shares, not the freeze).');
    list.push('Not shown: the company’s own gain and its tax; planning for the trust’s ' + Y21 + ' year.');
    list.push('Left out: yearly tax, fees, costs, many rules.');
    return list;
  }
  $('caveats').innerHTML = caveatGroups(true).map(function (g) {
    return '<div class="cv-group"><h3 class="cv-h">' + g[0] + '</h3><ul>' + g[1].map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul></div>';
  }).join('');

  // ---- What happens: the four moves, before the chart, with the example's figures and who gets what ----
  function stepsFor(S) {
    var i = S.inp, v = esc(F.fmtInput(i.value)), c = esc(F.fmtInput(i.cost)), f = esc(F.fmtInput(S.pref0));
    var freeze = S.noGainAtFreeze
      ? '<b>Freeze.</b> The retiree gets back an IOU for what they first paid for the investments (the original cost, ' + c + '). Here that equals the portfolio, so there is no gain to freeze and no fixed shares.'
      : '<b>Freeze.</b> The retiree gets back an IOU for what they first paid for the investments (the original cost, ' + c + ') and preferred shares with a fixed redemption value for the rest (' + f + ', today’s gain): together, today’s ' + v + ' portfolio.';
    var buy = S.noGainAtFreeze ? '<b>Buy back.</b> With no fixed shares, there is nothing to buy back.'
      : S.redeemed <= 0 ? '<b>Buy back.</b> With no investment income here, the company buys back nothing; the retiree keeps all the fixed shares until death.'
        : '<b>Buy back.</b> Each year the company uses its investment income to buy back some fixed shares, so less is left to tax at death. The portfolio isn’t spent: that value moves to the trust’s shares.';
    return [
      '<b>Move.</b> The portfolio goes into a new company. A section 85 election defers the tax on the move.',
      freeze,
      '<b>Trust.</b> A family trust for the retiree’s family buys the growth shares for a nominal amount. All growth from now on is the trust’s.',
      buy,
    ];
  }

  // ---- the readout and the words that follow the state ----
  var readout = deskReadout('#answer', { format: F.fmtBig });
  function fact(ids, text) { return '<span data-fact="' + esc(ids) + '">' + esc(text) + '</span>'; }
  // the line under the answer (14 words or fewer): when the trust pays the tax moved to it
  function lineFor(S) {
    var A = anns(S), many = A.length > 1, atDeath = A[A.length - 1] === S.inp.deathAge;
    return {
      normal: 'Deferred, not removed: the family trust pays it later, when it sells its shares.',
      deemedFirst: TP.later <= 0
        ? (many ? 'The trust pays it at its anniversaries, ' + agesText(A) + ', the last in the year of death.'
          : 'The trust pays it at ' + A[0] + ', its ' + Y21 + ' anniversary' + (atDeath ? ', the year of death.' : '.'))
        : many ? 'The trust pays ' + T(TP.early) + ' of tax at its anniversaries (' + agesText(A) + '), and ' + T(TP.later) + ' later.'
          : 'The trust pays ' + T(TP.early) + ' of tax at ' + A[0] + ', its ' + Y21 + ' anniversary, and ' + T(TP.later) + ' later.',
      noGrowth: 'With no growth, the trust’s tax comes only from the buy-backs.',
      nothing: 'Nothing moves to the trust without growth or buy-backs.',
    }[S.state];
  }
  // the split: without a freeze, all due at death; with it, the same income tax in two (or three) parts. Equal bar
  // lengths show the sum.
  // the split's words; fig(v) sets each figure (the page sets them in the serif)
  function splitWith(S, sep, fig) {
    var f = fig || function (v) { return v; };
    if (S.state === 'nothing') return f(T(TP.death)) + ', all due at death too';
    var p = [f(T(TP.death)) + ' due at death'];
    if (S.deemedFirst) p.push(f(T(TP.early)) + ' paid by the trust ' + annPhrase(S));
    if (!S.deemedFirst || TP.later > 0) p.push(f(T(TP.later)) + (S.deemedFirst ? ' paid later' : ' paid later, by the trust'));
    return p.join(sep);
  }
  function figB(v) { return '<b>' + esc(v) + '</b>'; }
  function paintSplit() {
    var tot = S.taxNo, pc = function (v) { return tot > 0 ? Math.max(0, Math.min(100, v / tot * 100)).toFixed(2) + '%' : '0%'; };
    $('split-no-t').innerHTML = figB(T(TP.total)) + ', all due at death';
    $('split-with-t').innerHTML = splitWith(S, ' + ', figB);
    var q = function (c) { return document.querySelector('#split .' + c); };
    q('seg-no').style.width = tot > 0 ? '100%' : '0%';
    q('seg-death').style.width = pc(S.taxWith); q('seg-early').style.width = pc(S.taxTrustEarly); q('seg-later').style.width = pc(S.deferred);
    // the sum, in the shown figures (rounded once, so they add up), and what both sides leave out
    var parts = [T(TP.death)].concat(S.deemedFirst ? [T(TP.early)] : []).concat(!S.deemedFirst || TP.later > 0 ? [T(TP.later)] : []);
    $('split-sr').textContent = S.state === 'nothing' ? 'The same income tax, all due at death. Yearly tax on income and buy-backs is left out of both.'
      : parts.join(' + ') + ' = ' + T(TP.total) + ': the same income tax at today’s rates, paid at different times. Yearly tax on income and buy-backs is left out of both.';
  }
  function cueFor(S) {
    var a21 = S.deemedAge, i = S.inp;
    return {
      cost: 'Original cost: what the retiree first paid for the investments. Gain = portfolio − original cost, so the cost changes the tax due at death.',
      growth: 'More growth means more gain, and all of it after the freeze is the trust’s.',
      freezeAge: 'The trust’s ' + Y21 + ' anniversary is ' + R.trustYears + ' years after the freeze, here at ' + a21 + '.',
      deathAge: i.deathAge < a21 ? 'Past ' + a21 + ', the trust’s ' + Y21 + ' anniversary comes first and the trust pays then.'
        : a21 === i.deathAge ? 'Here death and the trust’s ' + Y21 + ' anniversary fall in the same year, ' + a21 + ': the trust pays its tax then.'
          : 'Here the trust’s ' + Y21 + ' anniversary, at ' + a21 + ', comes first: the trust pays then, before death.',
    }[cueKey];
  }
  // the age at death, said the same way in the hint and in How this is worked out (only at the life table's age)
  function deathLine(i, withFacts) {
    var lt = R.lifeTable, lo = Math.round(Math.min(lt.male, lt.female)), hi = Math.round(Math.max(lt.male, lt.female));
    if (i.freezeAge !== lt.age) return null;
    var avg = 'on average a person of ' + lt.age + ' has about ' + lo + ' to ' + hi + ' more years';
    if (i.deathAge === F.defaultDeathAge(R, i.freezeAge)) {
      return 'Death at ' + i.deathAge + ' is an example: ' + avg + (withFacts ? ' (men ' + fact('life_expectancy_age70_male', String(lt.male)) + ', women ' + fact('life_expectancy_age70_female', String(lt.female)) + '; ' : ' (')
        + 'Statistics Canada, ' + lt.from + ' to ' + lt.to + '). Not a prediction.';
    }
    var y = i.deathAge - i.freezeAge;
    return 'Death at ' + i.deathAge + ' is an example, ' + y + (y === 1 ? ' year' : ' years') + ' after the freeze. On average a person of ' + lt.age + ' has about ' + lo + ' to ' + hi + ' more years.';
  }
  function paintWords(first) {
    var i = S.inp;
    readout.set({ n: TP.moved, format: T, label: 'Income tax moved to the trust', line: lineFor(S), animate: first ? false : undefined });
    paintSplit();
    var extra = S.exhausted ? 'By ' + S.exhaustedAge + ' the company has bought back all the fixed shares, so nothing of the retiree’s is left to tax at death.'
      : S.noGainAtFreeze ? 'Here the original cost equals the portfolio, so there is no gain to freeze and no buy-backs: all growth is the trust’s.' : '';
    var stp = stepsFor(S), li = $('steps').children;
    if (li.length !== stp.length) $('steps').innerHTML = stp.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    else stp.forEach(function (s, k) { if (li[k].innerHTML !== s) li[k].innerHTML = s; });
    $('answer-extra').textContent = extra; $('answer-extra').hidden = !extra;
    $('lede').textContent = 'A made-up retiree, ' + i.freezeAge + ', moves a portfolio into a company and freezes its value.';
    $('assume-text').textContent = 'One made-up Ontario owner, ' + R.rateYear + ' top rates, every figure an example.';
    // the chart's title says what to look at (no figures, so it never competes with the answer); the line under it says
    // what happens after death, which the chart does not draw
    $('chart-title').textContent = S.state === 'nothing' ? 'With no growth and no buy-backs, all the tax stays due at death'
      : S.deemedFirst ? (anns(S).length > 1 ? 'At ' + agesText(anns(S)) + ', the trust’s anniversaries, the trust pays its share' : 'At ' + anns(S)[0] + ', the trust’s ' + Y21 + ' anniversary, the trust pays its share')
      : 'The longer the retiree lives, the more of the tax the trust carries';
    var after = $('chart-after');
    after.textContent = S.state === 'nothing' || TP.later <= 0 ? ''
      : 'After death, the trust’s ' + T(TP.later) + ' of tax' + (S.deemedFirst ? ' on growth since ' + anns(S)[anns(S).length - 1] : '') + ' waits until it sells its shares, or until its ' + laterNote(S).replace('when it sells, or at its ', '') + '. Growth after death is not shown.';
    after.hidden = !after.textContent;
    var t0 = taxAt(S.rows[0]);
    $('chart-desc').textContent = 'Income tax if death came at each age from ' + i.freezeAge + ' to ' + i.deathAge + '. Without a freeze it grows from ' + T(t0.no) + ' to ' + T(TP.total) + ', all due at death. With the freeze, '
      + T(TP.death) + ' is due at death' + (S.deemedFirst ? ', the trust pays ' + T(TP.early) + ' ' + annPhrase(S) + ', ' + annWhen(S) + ',' : '') + ' and the trust pays ' + T(TP.later) + ' later. The tables in Go deeper have every number.';
    // How this is worked out: plain steps, every rate wrapped in its fact
    var rid = 'federal_brackets.' + R.rateYear + ' ontario_brackets.' + R.rateYear + ' ontario_surtax.' + R.rateYear, m2 = function (v) { return esc(F.fmtM2(v)); };
    var how = [
      'The portfolio grows ' + esc(F.fmtPct(i.growth)) + ' a year: ' + esc(F.fmtInput(i.value)) + ' at ' + i.freezeAge + ' is ' + m2(S.Vn) + ' at ' + i.deathAge + '.',
      'Without a freeze: gain = ' + m2(S.Vn) + ' − ' + esc(F.fmtInput(i.cost)) + ' original cost = ' + m2(S.gainNo) + ', all taxed at death: ' + esc(T(TP.total)) + ' of tax.',
      'With the freeze: today’s ' + esc(F.fmtInput(S.pref0)) + ' gain sits in the fixed shares. The company buys back ' + m2(S.redeemed) + ' of them by ' + i.deathAge + ', so ' + m2(S.gainWith) + ' of gain is taxed at death: ' + esc(T(TP.death)) + ' of tax.',
      // why the trust's gain is more than the growth: the buy-backs are paid from income, so their value stays in the
      // portfolio and lands on the trust's shares
      'The trust’s shares hold the rest, ' + m2(S.trust) + ' of gain: ' + m2(S.trustSplit.growth) + ' of growth since ' + i.freezeAge
        + (S.redeemed > 0 ? ', plus the ' + m2(S.trustSplit.redemptions) + ' of fixed shares bought back. The buy-backs are paid from the company’s yearly income, not from the portfolio, so that value stays in the portfolio and lands on the trust’s shares.' : '.')
        + (S.deemedFirst
          ? ' Of that gain, ' + m2(S.trustTaxedEarly) + ' is taxed ' + annPhrase(S) + ', the trust’s ' + (anns(S).length > 1 ? 'anniversaries' : Y21 + ' anniversary') + ': ' + esc(T(TP.early)) + ' of tax, ' + annWhen(S) + '.'
            + (TP.later > 0 ? ' Its gain after that, ' + m2(S.trustHeld) + ', is taxed later: ' + esc(T(TP.later)) + ' of tax.' : '')
          : ' Its tax, ' + esc(T(TP.later)) + ', is paid later.'),
      'Tax = gain × ' + fact('capital_gains_inclusion_rate', rate(R.inclusion)) + ' (the share of a capital gain that is taxed) × ' + fact(rid, rate(R.topOrdinary)) + ' (the ' + R.rateYear
        + ' top federal and Ontario rate with the Ontario surtax) = gain × ' + fact(rid + ' capital_gains_inclusion_rate', rate(R.cgRate)) + '.',
    ];
    var dl = deathLine(i, true);
    how.push(dl || 'Death at ' + i.deathAge + ' is an example; not a prediction for anyone.');
    if (R.eat) how.push('Ontario estate administration tax (probate) = ' + fact('ontario_estate_admin_tax_rate', money0(R.eat.rate)) + ' per ' + esc(money0(R.eat.per)) + ' (or part) of the estate over '
      + fact('ontario_estate_admin_tax_exemption', money0(R.eat.exemption)) + ', on ' + m2(S.Vn) + ': ' + m2(S.eatNo) + ' of tax without a freeze. With it, assumed not payable: the IOU and fixed shares are holding company shares that pass under a secondary will. That comes from holding company shares, not from the freeze.');
    var close = 'At today’s rates. The trust’s real tax depends on the rates in the year it pays. Growth after death is not shown. Yearly tax on income and buy-backs is left out, without and with the freeze. The yearly buy-back arithmetic is in Go deeper.';
    if (S.exhausted) close += ' Once the fixed shares are all bought back, the example stops paying the retiree, and the company’s kept income is not counted.';
    else if (S.noGainAtFreeze) close += ' With no fixed shares, the example pays the retiree nothing, and the company’s kept income is not counted.';
    $('how').innerHTML = '<ol>' + how.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol><p>' + close + '</p>';
    // Change the example: the cue, the age at death, the echo
    $('cue').textContent = cueFor(S);
    var hint = $('death-hint'), dh = deathLine(i, false);
    hint.textContent = dh || ''; hint.hidden = !dh;
    var changed = !KEYS.every(function (k) { return Math.abs(st[k] - START[k]) < 1e-9; });
    $('reset').hidden = !changed;
    var echo = $('echo');
    echo.textContent = !changed ? '' : 'Now, income tax: ' + T(TP.total) + ' due at death without a freeze; with it, ' + T(TP.death) + ' due at death, '
      + (S.deemedFirst ? T(TP.early) + ' paid by the trust ' + annPhrase(S) + ' and ' + T(TP.later) + ' paid later.' : T(TP.later) + ' paid later, by the trust.');
    echo.hidden = !changed;
  }

  // ---- Go deeper: buy-backs and the year-by-year table (drawn when open) ----
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
    var first = rows[0], lastR = rows[rows.length - 1], fR = '600 ' + FS + 'px ' + SERIF;
    var t1 = el('text', { x: 0, y: FS + 2, 'class': 'rd' }, svg, 'Year 1: about ' + F.fmtAbout(first.R));
    if (rows.length > 1) {
      var w1 = measure(t1.textContent, fR), lt = 'Year ' + rows.length + ': about ' + F.fmtAbout(lastR.R), w2 = measure(lt, fR);
      el('text', { x: W - 3, y: w1 + w2 + 24 < W ? FS + 2 : FS * 2.3 + 2, 'text-anchor': 'end', 'class': 'rd' }, svg, lt);
    }
    el('text', { x: 0, y: H - 4, 'class': 'tick' }, svg, 'Age ' + (S.inp.freezeAge + 1));
    if (rows.length > 1) el('text', { x: W - 3, y: H - 4, 'text-anchor': 'end', 'class': 'tick' }, svg, String(S.inp.deathAge));
    var paid = rows.map(function (r) { return r.R; }).filter(function (v) { return v > 0; });
    $('buy-open').textContent = !paid.length ? 'With no investment income, the company buys back nothing.'
      : 'Each year the company pays the retiree about ' + F.fmtAbout(Math.min.apply(null, paid)) + (paid.length > 1 && F.fmtAbout(Math.min.apply(null, paid)) !== F.fmtAbout(Math.max.apply(null, paid)) ? ' to ' + F.fmtAbout(Math.max.apply(null, paid)) : '')
        + ' to buy back fixed shares. The retiree is taxed on it as a dividend; that yearly tax is not shown.';
    var c1 = S.rows[1];
    $('cash-line').textContent = c1.cash == null ? '' : 'In year one the company earns ' + money0(c1.income) + ', pays ' + money0(c1.corpTax) + ' in tax, gets ' + money0(c1.refund) + ' back and buys back ' + money0(c1.R) + ' of shares.';
    $('cash-line').hidden = c1.cash == null;
    $('mechanism').innerHTML = 'Why that amount: part of the company’s tax on investment income is refundable when it pays dividends. A buy-back counts as a dividend for the amount above the shares’ paid-up capital (nil here, so all of it). So each year the company buys back just enough to get that tax back: (interest × '
      + fact('refundable_investment_income_rate', rate(R.refInvest)) + ' + eligible dividends × ' + fact('part_iv_tax_rate', rate(R.partIV)) + ') ÷ the ' + fact('dividend_refund_rate', rate(R.refundRate)) + ' dividend refund rate.'
      + (S.exhausted ? ' Here the fixed shares run out at age ' + S.exhaustedAge + '.' : '');
    // the numbers behind the chart: the income tax first (so a phone shows it before any swipe), then the portfolio and
    // the year's buy-back (the paid-at-anniversaries column only when one comes before death)
    var cols = ['If death came at', 'Tax due at death, without a freeze', 'Tax due at death, with the freeze'];
    if (S.deemedFirst) cols.push('Tax paid by the trust at its anniversaries');
    cols.push('Tax paid later, by the trust', 'Portfolio', 'Bought back that year');
    $('years-head').innerHTML = cols.map(function (c) { return '<th scope="col">' + c + '</th>'; }).join('');
    $('years-rows').innerHTML = S.rows.map(function (r) {
      var t = taxAt(r), p = F.taxParts({ taxNo: t.no, taxWith: t.death, taxTrustEarly: t.early }, S), cells = [r.age + (r.t === S.n ? ' (death)' : ''), T(p.total), T(p.death)];
      if (S.deemedFirst) cells.push(T(p.early));
      cells.push(T(p.later), F.fmtM2(r.V), r.t ? money0(r.R) : '–');
      return '<tr' + (r.t === S.n ? ' class="death"' : '') + '><th scope="row">' + cells[0] + '</th><td>' + cells.slice(1).join('</td><td>') + '</td></tr>';
    }).join('');
    // on a phone, say how many columns are off to the right
    var wrap = $('years-wrap'), wr = wrap.getBoundingClientRect(), hidden = 0;
    [].forEach.call(document.querySelectorAll('#years-head th'), function (th) { if (th.getBoundingClientRect().right - wr.left + wrap.scrollLeft > wrap.clientWidth + 1) hidden++; });
    $('years-cap').textContent = 'At the end of each year; income tax at today’s rates.' + (hidden ? ' On a phone, swipe the table for ' + hidden + ' more column' + (hidden === 1 ? '' : 's') + ' →' : '');
  }
  deeper.addEventListener('toggle', drawDeeper);

  // ---- Sources and the version line ----
  (function sources() {
    var items = R.used.map(function (f) { return '<li><a href="' + esc(f.source_url) + '">' + esc(f.title) + '</a> · as of ' + esc(longDate(f.as_of)) + '</li>'; });
    var laws = STATUTES.map(function (x) { return '<li><a href="' + esc(LAW + x.page) + '">Income Tax Act ' + esc(x.s) + '</a>: ' + esc(x.what) + '</li>'; });
    var ver = 'Version ' + DATA.version + ' · rates as of ' + longDate(DATA.asOf) + ' · made in this browser; nothing was sent.';
    $('sources').innerHTML = '<p>Every rate and rule on this page is read from these official sources (confirmed values only). The life expectancy figures are from <a href="' + esc(R.lifeTable.url)
      + '">Statistics Canada table 13-10-0114-01</a> (its data download), life tables, ' + R.lifeTable.from + ' to ' + R.lifeTable.to + '.</p><ul>' + items.join('') + '</ul>'
      + '<p>The rules the example rests on, described here without figures (the trust’s ' + R.trustYears + ' years are read from the facts above):</p><ul>' + laws.join('') + '</ul>'
      + '<p>How it’s made: the calculation was written from scratch for this site and runs in this browser. The retiree and the inputs are made up: example assumptions, not facts, and not anyone’s situation. ' + esc(ver) + '</p>';
    $('foot-version').textContent = ver;
  })();

  // ---- Save as one page: the sheet, built from the current state, then the browser's print ----
  var sheet = $('sheet');
  function buildSheet() {
    var i = S.inp, notes = document.querySelector('.desk-notes');
    // the sources, shortened to statute sections and page names (one line or two on paper)
    var acts = STATUTES.map(function (x) { return x.s; }), pagesBy = [], HOSTS = [['canada.ca', 'CRA T4127 and rates'], ['ontario.ca', 'Ontario.ca'], ['statcan.gc.ca', 'Statistics Canada 13-10-0114-01']];
    R.used.forEach(function (f) {
      var m = f.title.match(/Income Tax Act ([\d.]+(?:\(\d+\))?)/);
      if (m) { if (acts.indexOf(m[1]) < 0) acts.push(m[1]); return; }
      var host = f.source_url.replace(/^https:\/\/([^/]+).*$/, '$1'), hit = HOSTS.filter(function (h) { return host === h[0] || host.slice(-h[0].length - 1) === '.' + h[0]; })[0];
      var name = hit ? hit[1] : f.title.split(/ \(|,/)[0].trim();
      if (pagesBy.indexOf(name) < 0) pagesBy.push(name);
    });
    acts.sort(function (p, q) { return parseFloat(p) - parseFloat(q) || (p < q ? -1 : 1); });
    var addr = siteAddress(DESK_SITE.origin), date = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
    var td = function (v) { return '<td class="' + (/^\$/.test(v) ? 'n' : 'w') + '">' + esc(v) + '</td>'; };
    var tr = function (r, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + r[0] + '</td>' + td(r[1]) + td(r[2]) + '</tr>'; };
    // on paper the ledger drops its swatches and keeps its notes short; the probate and gain rows follow as plain rows
    var rows = ledgerRows().map(function (r) { return tr([r[1].replace(/<span class="sw[^>]*><\/span>/, '').replace(/ ?<span class="lg-note">[^<]*<\/span>/, ''), r[2], r[3]], r[0] === 'all' ? 'total' : ''); });
    // probate is not income tax: its own row, labelled so, and credited to the holding company shares, not the freeze
    if (R.eat) rows.push(tr(['Not income tax: probate', F.fmtM2(S.eatNo), 'not payable (assumed)'], 'more'));
    var split = 'Without a freeze, ' + T(TP.total) + ' is due at death. With it, ' + (S.state === 'nothing' ? T(TP.death) + ' is due at death too.'
      : S.deemedFirst ? T(TP.death) + ' is due at death, ' + T(TP.early) + ' is paid by the trust ' + annPhrase(S) + ', ' + annWhen(S) + ', and ' + T(TP.later) + ' is paid later.'
        : T(TP.death) + ' is due at death and ' + T(TP.later) + ' is paid later, by the trust.');
    var steps = ['<b>1 Move:</b> into a company, section 85 election (tax-deferred).',
      '<b>2 Freeze:</b> an IOU for the original cost (' + esc(F.fmtInput(i.cost)) + '), preferred shares at a fixed redemption value (' + esc(F.fmtInput(S.pref0)) + ').',
      '<b>3 Trust:</b> a family trust takes the growth.',
      '<b>4 Buy back:</b> yearly; the value moves to the trust.'];
    sheet.innerHTML = '<div class="sh-top"><span>' + esc(STAMP) + '</span><span class="sh-r">Printed ' + esc(date) + '</span></div>'
      + '<p class="sh-title">' + esc($('question').textContent) + '</p>'
      + '<p class="sh-answer"><span class="sh-big">' + esc(T(TP.moved)) + '</span> of income tax moved to the trust' + (S.deemedFirst ? ': not removed.' : ': deferred, not removed.') + ' <span class="sh-sub">' + esc(split) + '</span></p>'
      + '<p class="sh-inputs">A made-up retiree, <b>' + i.freezeAge + '</b>: portfolio <b>' + esc(F.fmtInput(i.value)) + '</b>, original cost <b>' + esc(F.fmtInput(i.cost)) + '</b>, growth <b>' + esc(F.fmtPct(i.growth))
        + '</b>, income <b>' + esc(F.fmtInput(i.income)) + '</b> (' + esc(F.fmtPct(i.eligibleShare)) + ' eligible dividends, +' + esc(F.fmtPct(i.incomeGrowth)) + ' a year), death at <b>' + i.deathAge
        + '</b> (example).</p>'
      + '<p class="sh-steps">' + steps.join(' ') + '</p>'
      + '<div class="sh-chart"><svg id="sheet-chart" role="img" aria-label="Income tax if death came at each age"></svg>'
      + '<p class="sh-cap">Income tax if death came at each age (Ontario, ' + R.rateYear + ' top rates), $ millions. ' + esc($('chart-after').textContent) + '</p></div>'
      + '<table class="sh-ledger"><thead><tr><th>Income tax, death at ' + i.deathAge + '</th><th>Without a freeze</th><th>With the freeze</th></tr></thead><tbody>'
      + rows.join('') + '</tbody></table>'
      + '<ul class="sh-caveats">' + caveatsShort().map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul><p class="sh-close">How any of this applies to a real family is a question for a tax professional and a lawyer.</p>'
      + '<div class="sh-foot"><p>' + esc(DESK_SITE.wordmark) + ' · <b>' + esc(addr) + '/tools/estate-freeze/</b> · Version ' + esc(DATA.version) + '</p>'
      + '<p>Sources (as of ' + esc(shortDate(DATA.asOf)) + '): Income Tax Act ss. ' + esc(acts.join(', ')) + '; ' + esc(pagesBy.join('; ')) + '. ' + esc(notes ? notes.textContent.replace(/\s+/g, ' ').trim() : '') + '</p></div>';
    drawBand($('sheet-chart'), S, { W: 680, H: 160, print: true, hatch: 'ef-sh-hatch' });
  }
  $('print').addEventListener('click', function () { buildSheet(); try { window.print(); } catch (e) { /* the sheet is ready for the browser’s own print */ } });
  addEventListener('beforeprint', buildSheet);

  // ---- Save my card: 1080x1350, the line naming the example, a small chart in income tax with two end readings, the stamp ----
  function tok(n) { return getComputedStyle(document.documentElement).getPropertyValue('--t-' + n).trim(); }
  function miniBand(x, full, C) {
    var rows = S.rows, a0 = S.inp.freezeAge, aD = S.inp.deathAge, d3 = tok('d3'), d4 = tok('d4'), tx = rows.map(taxAt);
    var lw = 380, box = { x: full.x, y: full.y, w: full.w - lw, h: full.h };
    var hi = 0; tx.forEach(function (t) { hi = Math.max(hi, t.no); }); hi = hi || 1;
    var X = function (a) { return box.x + (a - a0) / (aD - a0) * box.w; }, Y = function (v) { return box.y + box.h - v / hi * box.h; };
    function path(pts, close) { x.beginPath(); pts.forEach(function (p, k) { if (k) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); if (close) x.closePath(); }
    var edge = [[X(a0), Y(tx[0].death)]];
    for (var k = 1; k <= S.n; k++) { edge.push([X(rows[k].age), Y(tx[k - 1].death)]); edge.push([X(rows[k].age), Y(tx[k].death)]); }
    // the same stack as the page's chart, bottom to top: due at death, paid at the trust's anniversaries (solid), paid later
    // (hatched, up to the no-freeze line)
    var mid = [[X(a0), Y(tx[0].death + tx[0].early)]];
    for (var j = 1; j <= S.n; j++) { mid.push([X(rows[j].age), Y(tx[j - 1].death + tx[j - 1].early)]); mid.push([X(rows[j].age), Y(tx[j].death + tx[j].early)]); }
    var noLine = rows.map(function (r, k) { return [X(r.age), Y(tx[k].no)]; });
    x.save(); x.globalAlpha = 0.4; x.fillStyle = d4; path([[X(a0), Y(0)]].concat(edge).concat([[X(aD), Y(0)]]), true); x.fill();
    x.fillStyle = d3; path(noLine.concat(mid.slice().reverse()), true); x.fill();
    x.restore();
    if (S.deemedFirst) { x.save(); x.globalAlpha = 0.85; x.fillStyle = d3; path(mid.concat(edge.slice().reverse()), true); x.fill(); x.restore(); }
    x.save(); path(noLine.concat(mid.slice().reverse()), true);
    x.clip(); x.strokeStyle = d3; x.lineWidth = 3;
    for (var h = box.x - box.h; h < box.x + box.w; h += 18) { x.beginPath(); x.moveTo(h, box.y + box.h); x.lineTo(h + box.h, box.y); x.stroke(); }
    x.restore();
    x.strokeStyle = d4; x.lineWidth = 5; path(edge); x.stroke();
    x.strokeStyle = C.ink; x.lineWidth = 5; path(noLine); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.moveTo(X(aD), box.y); x.lineTo(X(aD), box.y + box.h); x.stroke();
    x.fillStyle = C.ink; x.fillRect(box.x, box.y + box.h, box.w, 2);
    // the two end readings: the tax due at death without a freeze, and with it
    var tx0 = box.x + box.w + 28, serif = '600 44px "Source Serif 4 Variable", Georgia, serif', sans = '400 32px "Source Sans 3 Variable", system-ui, sans-serif';
    x.textBaseline = 'alphabetic';
    x.font = serif; x.fillStyle = C.ink; x.fillText(T(TP.total), tx0, box.y + 44);
    x.font = sans; x.fillStyle = C.ink2; x.fillText('tax due at death', tx0, box.y + 82); x.fillText('without a freeze', tx0, box.y + 118);
    x.font = serif; x.fillStyle = C.ink; x.fillText(T(TP.death), tx0, box.y + box.h - 76);
    x.font = sans; x.fillStyle = C.ink2; x.fillText('tax due at death', tx0, box.y + box.h - 38); x.fillText('with the freeze', tx0, box.y + box.h - 2);
  }
  function cardLine() {
    return 'of income tax moved to the trust for a made-up retiree, ' + S.inp.freezeAge + ', with ' + F.fmtInput(S.inp.value) + (S.deemedFirst ? ': paid by the trust, not removed.' : ': deferred, not removed.');
  }
  deskSaveButton('#card', function () {
    return deskCard({
      question: $('question').textContent, bigValue: T(TP.moved), bigMax: 170,
      line: cardLine(), labels: [],
      draw: miniBand, stamp: STAMP,
    }).then(function (blob) { return { blob: blob, name: 'estate-freeze-card.png', title: $('question').textContent }; });
  });

  // ---- one render for every change ----
  var queued = false;
  function render(first, later) {
    S = F.freeze(R, st); T = F.taxScale(S); TP = F.taxParts(S);
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
