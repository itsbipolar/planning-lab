// Participating policy dividends: the page. The engine is PAR (model.mjs, inlined by build.mjs). Every run is computed
// here from the inlined long-bond snapshot (real: Bank of Canada data via Statistics Canada) and the made-up settings in
// PAR.EXAMPLE; every rule comes from the confirmed facts in the page's data block. Inputs live in memory only: nothing in
// the address, nothing stored. The page makes no request after it loads. Education only: a made-up account, no insurer,
// no product, no dollar figure, no call to act. Every figure goes through PAR.pts / PAR.pct, so a value always reads the
// same in the answer, the chart, the table and the poster.
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('data').textContent);
  var F = PAR, B = F.BOUNDS, E = F.EXAMPLE, pts = F.pts, pct = F.pct;
  var R = F.parRules(DATA.facts);
  var Y = F.yieldsFrom(DATA.bond).Y;
  var NS = 'http://www.w3.org/2000/svg';
  var SANS = '"Source Sans 3 Variable", system-ui, sans-serif', SERIF = '"Source Serif 4 Variable", Georgia, serif';
  var FS = 17.5, VF = 19, LH = Math.round(FS * 1.3);   // every chart label 17.5px or more; figures 19px in the serif
  var $ = function (id) { return document.getElementById(id); };
  var st = { N: E.N, w: E.w, L: E.L, steady: false }, OUT = null, S = null;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(d) { var p = String(d).split('-').map(Number); return MONTHS[p[1] - 1] + ' ' + p[2] + ', ' + p[0]; }
  function fact(id, html) { return '<span data-fact="' + esc(id) + '">' + html + '</span>'; }
  function years(n) { return n + (n === 1 ? ' year' : ' years'); }
  function share(x) { return Math.round(x * 100) + '%'; }
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
  var fSans = '400 ' + FS + 'px ' + SANS, fSans6 = '600 ' + FS + 'px ' + SANS, fVal = '600 ' + VF + 'px ' + SERIF;

  function stateOf() { return st.steady ? 'steady' : st.N === 1 ? 'n1' : 'normal'; }
  var TITLES = {
    normal: 'The credited rate moves slowly; the actual return jumps',
    n1: 'Even unspread, the credited rate lags: bonds count at the yield they were bought at',
    steady: 'With steady stocks, only the bonds keep the credited rate behind',
  };
  function settings() { return { N: st.N, w: st.w, L: st.L, pattern: st.steady ? F.STEADY : F.PAT }; }
  function changed() { return st.w !== E.w || st.L !== E.L; }

  // ---- the chart: actual return as bars, the credited rate as a thick line, the real bond yield dashed ----
  function niceStep(range, n) {
    var raw = range / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function Placer() {
    var boxes = [];
    function hit(b) { return boxes.some(function (o) { return b.x < o.x + o.w + 4 && o.x < b.x + b.w + 4 && b.y < o.y + o.h + 2 && o.y < b.y + b.h + 2; }); }
    return { hit: hit, add: function (b) { boxes.push(b); } };
  }
  var chart = $('chart'), frame = $('chart-frame'), dropCross = null, scales = null, kbYear = null;

  function drawChart() {
    var W = Math.max(300, Math.floor(frame.clientWidth)), narrow = W < 640;
    if (dropCross) { dropCross(); dropCross = null; }
    clear(chart);
    var rows = OUT, n = rows.length, first = rows[0].year, last = rows[n - 1].year;
    var vals = [];
    rows.forEach(function (r) { vals.push(r.actual, r.credited, r.bond); });
    var lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max.apply(null, vals);
    var step = niceStep(hi - lo, 6), yMin = Math.floor(lo / step) * step, yMax = Math.ceil(hi / step) * step;
    if (yMin > lo - step * 0.15 && lo < 0) yMin -= step;
    var ticks = []; for (var t = yMin; t <= yMax + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
    var tickTxt = function (v) { return (v < 0 ? '−' : '') + Math.abs(v) + '%'; };
    var lgut = Math.ceil(Math.max.apply(null, ticks.map(function (v) { return measure(tickTxt(v), fSans); }))) + 8;
    var gut = narrow ? 0 : Math.max(120, Math.round(W * 0.14)) + 70;
    var x0 = lgut, x1 = W - 2 - gut, padT = FS + 10;
    var H = narrow ? 320 : W < 1000 ? 400 : 440, y0 = H - (FS + 16);
    var band = (x1 - x0) / n, gap = narrow ? 2 : Math.max(2, band * 0.3), bw = Math.max(1, band - gap);
    var X = function (yr) { return x0 + (yr - first + 0.5) * band; };
    var Yv = function (v) { return padT + (yMax - v) / (yMax - yMin) * (y0 - padT); };
    var P = Placer(), obstacles = [];

    // the grid: a rule per tick, its label left-aligned just above it; the zero line in ink
    var gGrid = el('g', { 'class': 'grid-g' }, chart), gText = el('g', { 'class': 'labels' }, chart);
    ticks.forEach(function (v) {
      var y = Math.round(Yv(v)) + 0.5;
      el('line', { x1: 0, x2: x1.toFixed(1), y1: y, y2: y, 'class': v === 0 ? 'zero' : 'grid' }, gGrid);
      var tw = measure(tickTxt(v), fSans), b = { x: 0, y: y - 5 - FS, w: tw, h: FS * 1.3 };
      if (y - 5 - FS < 0) return;
      el('text', { x: 0, y: (y - 5).toFixed(1), 'class': 'tick' }, gText, tickTxt(v));
      P.add(b);
    });
    // the years under the plot: the first, then every 5 years and the last (from 640px), or every 20 years on phones,
    // where the last year is named in the key under the chart instead
    var every = narrow ? 20 : 5, xt = [first];
    for (var yr = Math.ceil((first + 1) / every) * every; yr < last; yr += every) xt.push(yr);
    if (!narrow || (last - first) % every === 0) xt.push(last);
    var placedX = [];
    xt.forEach(function (yr, i) {
      var s = String(yr), w = measure(s, fSans), cx = X(yr), anchor = 'middle', bx = cx - w / 2;
      if (i === xt.length - 1 && bx + w > W) { anchor = 'end'; bx = cx - w; }
      var b = { x: bx, y: y0 + 8 + FS * 0.82 - FS, w: w, h: FS * 1.3 };
      if (placedX.some(function (o) { return b.x < o.x + o.w + 10 && o.x < b.x + b.w + 10; })) {
        if (i !== xt.length - 1) return;
        // the last year always shows: drop the tick before it instead
        var prev = placedX.pop(); if (prev && prev.el) prev.el.remove();
      }
      var te = el('text', { x: cx.toFixed(1), y: (y0 + 8 + FS * 0.82).toFixed(1), 'text-anchor': anchor, 'class': 'tick' }, gText, s);
      b.el = te; placedX.push(b); P.add(b);
    });

    // the marks
    var gMarks = el('g', { 'class': 'marks' }, chart);
    gMarks.parentNode.insertBefore(gMarks, gText);
    var edges = '';
    rows.forEach(function (r) {
      var a = Yv(Math.max(0, r.actual)), z = Yv(Math.min(0, r.actual)), bx = X(r.year) - bw / 2;
      el('rect', { x: bx.toFixed(2), y: a.toFixed(2), width: bw.toFixed(2), height: Math.max(0.5, z - a).toFixed(2), 'class': 'bar' }, gMarks);
      var ey = r.actual >= 0 ? a : z;
      edges += 'M' + bx.toFixed(2) + ' ' + ey.toFixed(2) + 'h' + bw.toFixed(2);
      obstacles.push({ x: bx, y: a, w: bw, h: Math.max(0.5, z - a) });
    });
    el('path', { d: edges, 'class': 'bar-edge' }, gMarks);
    function path(k) { return rows.map(function (r, i) { return (i ? 'L' : 'M') + X(r.year).toFixed(1) + ' ' + Yv(r[k]).toFixed(1); }).join(''); }
    el('path', { d: path('bond'), 'class': 's-context bond' }, gMarks);
    el('path', { d: path('credited'), 'class': 'halo' }, gMarks);
    el('path', { d: path('credited'), 'class': 's-named credited' }, gMarks);
    function crossesLines(b) {
      return rows.some(function (r) {
        var x = X(r.year);
        if (x < b.x - 6 || x > b.x + b.w + 6) return false;
        return ['credited', 'bond'].some(function (k) { var y = Yv(r[k]); return y > b.y - 6 && y < b.y + b.h + 6; });
      });
    }
    function onBars(b) { return obstacles.some(function (o) { return b.x < o.x + o.w + 3 && o.x < b.x + b.w + 3 && b.y < o.y + o.h + 3 && o.y < b.y + b.h + 3; }); }

    // end readings: in the right gutter from 640px (each with a leader to the last year), else a stacked key under the chart
    var lastRow = rows[n - 1];
    var ends = [
      { key: 'credited', v: lastRow.credited, words: narrow ? 'credited rate in ' + last : 'credited' },
      { key: 'actual', v: lastRow.actual, words: narrow ? 'actual return in ' + last : 'actual' },
      { key: 'bond', v: lastRow.bond, words: narrow ? 'bond yield in ' + last + ' (real)' : 'bond yield (real)' },
    ];
    var gRead = el('g', { 'class': 'readings' }, chart), keyH = 0;
    if (!narrow) {
      var gx = x1 + 22, avail = W - gx - 2;
      ends.forEach(function (e) {
        var fig = pct(e.v), wf = measure(fig, fVal), ww = measure(' ' + e.words, fSans);
        e.lines = wf + ww <= avail ? 1 : 2;
        e.w = e.lines === 1 ? wf + ww : Math.max(wf, measure(e.words, fSans));
        e.h = e.lines === 1 ? VF * 1.3 : VF * 1.3 + LH;
        e.ty = Yv(e.v);
      });
      var order = ends.slice().sort(function (p, q) { return p.ty - q.ty; });
      order.forEach(function (e, i) { e.top = Math.max(padT, e.ty - VF * 0.65); if (i) e.top = Math.max(e.top, order[i - 1].top + order[i - 1].h + 6); });
      var over = order.length ? order[order.length - 1].top + order[order.length - 1].h - y0 : 0;
      if (over > 0) order.forEach(function (e) { e.top -= over; });
      order.forEach(function (e) {
        var t = el('text', { x: gx.toFixed(1), y: (e.top + VF).toFixed(1), 'class': 'rd end-' + e.key }, gRead);
        el('tspan', { 'class': 'rd-v v-' + e.key }, t, pct(e.v));
        if (e.lines === 1) el('tspan', { 'class': 'rd-w' }, t, ' ' + e.words);
        else el('tspan', { 'class': 'rd-w', x: gx.toFixed(1), dy: LH }, t, e.words);
        var lx = X(last) + (e.key === 'actual' ? bw / 2 : 0) + 3, ly = e.ty, mid = e.top + VF * 0.65;
        el('path', { d: 'M' + lx.toFixed(1) + ' ' + ly.toFixed(1) + 'L' + (gx - 6).toFixed(1) + ' ' + mid.toFixed(1), 'class': 'leader' }, gRead);
        P.add({ x: gx, y: e.top, w: e.w, h: e.h });
      });
    }

    // the two point readings: the made-up account's worst and best years, each with a leader to its bar
    var reads = [{ r: S.low, kind: 'low' }, { r: S.high, kind: 'high' }];
    var zone = { x0: 0, x1: narrow ? W : x1, y0: padT - 4, y1: y0 };
    reads.forEach(function (rd) {
      var r = rd.r, px = X(r.year), py = Yv(r.actual);
      var head = r.year + ': earned ', mid = ', credited ';
      var one = measure(head, fSans) + measure(pct(r.actual), fVal) + measure(mid, fSans) + measure(pct(r.credited), fVal);
      var two = Math.max(measure(head, fSans) + measure(pct(r.actual) + ',', fVal), measure('credited ', fSans) + measure(pct(r.credited), fVal));
      var forms = one <= zone.x1 - zone.x0 - 4 ? [{ lines: 1, w: one }, { lines: 2, w: two }] : [{ lines: 2, w: two }];
      var best = null;
      for (var pass = 0; pass < 3 && !best; pass++) {
        forms.forEach(function (f) {
          var h = f.lines === 1 ? VF * 1.3 : VF * 1.3 + LH;
          for (var ty = zone.y0; ty + h <= zone.y1; ty += 4) {
            for (var tx = zone.x0; tx + f.w <= zone.x1; tx += 6) {
              var b = { x: tx, y: ty, w: f.w, h: h };
              if (P.hit(b)) continue;
              if (pass < 2 && crossesLines(b)) continue;
              if (pass < 1 && onBars(b)) continue;
              var nx = Math.max(b.x, Math.min(px, b.x + b.w)), ny = Math.max(b.y, Math.min(py, b.y + b.h));
              var d = Math.hypot(nx - px, ny - py) + f.lines * 12;
              if (d < 10) continue;
              if (!best || d < best.d) best = { b: b, f: f, d: d };
            }
          }
        });
      }
      if (!best) return;
      var b = best.b; P.add(b);
      var tline = b.y + VF;
      var t = el('text', { x: b.x.toFixed(1), y: tline.toFixed(1), 'class': 'rd pt-' + rd.kind }, gRead);
      el('tspan', { 'class': 'rd-w' }, t, head);
      el('tspan', { 'class': 'rd-v' }, t, pct(r.actual) + (best.f.lines === 2 ? ',' : ''));
      if (best.f.lines === 1) { el('tspan', { 'class': 'rd-w' }, t, mid); el('tspan', { 'class': 'rd-v' }, t, pct(r.credited)); }
      else { el('tspan', { 'class': 'rd-w', x: b.x.toFixed(1), dy: LH }, t, 'credited '); el('tspan', { 'class': 'rd-v' }, t, pct(r.credited)); }
      // the leader: from the box's nearest edge to the bar's end
      var ax = Math.max(b.x, Math.min(px, b.x + b.w)), ay = py < b.y ? b.y - 2 : py > b.y + b.h ? b.y + b.h + 2 : (py < b.y + b.h / 2 ? b.y - 2 : b.y + b.h + 2);
      if (px < b.x) { ax = b.x - 3; ay = Math.max(b.y + 4, Math.min(b.y + b.h - 4, py)); } else if (px > b.x + b.w) { ax = b.x + b.w + 3; ay = Math.max(b.y + 4, Math.min(b.y + b.h - 4, py)); }
      el('path', { d: 'M' + ax.toFixed(1) + ' ' + ay.toFixed(1) + 'L' + px.toFixed(1) + ' ' + py.toFixed(1), 'class': 'leader' }, gRead);
      el('circle', { cx: px.toFixed(1), cy: py.toFixed(1), r: 2.5, 'class': 'dot' }, gRead);
    });

    // phones: the stacked key under the years, one row per series (swatch in its mark, the latest value, the words)
    if (narrow) {
      var ky = y0 + FS + 30, sw = 18;
      ends.forEach(function (e) {
        var cy = ky + VF / 2;
        if (e.key === 'actual') el('rect', { x: 0.5, y: (cy - sw / 2 + 0.5).toFixed(1), width: sw - 1, height: sw - 1, 'class': 'bar key-sw' }, gRead);
        else el('path', { d: 'M0 ' + cy.toFixed(1) + 'h' + sw, 'class': e.key === 'credited' ? 's-named credited' : 's-context bond' }, gRead);
        var t = el('text', { x: sw + 10, y: (cy + VF * 0.34).toFixed(1), 'class': 'rd key-' + e.key }, gRead);
        el('tspan', { 'class': 'rd-v v-' + e.key }, t, pct(e.v));
        el('tspan', { 'class': 'rd-w' }, t, ' ' + e.words);
        ky += Math.max(LH, VF) + 8;
      });
      keyH = ky - (y0 + FS + 30) + 4;
    }
    var Htot = narrow ? Math.ceil(y0 + FS + 30 + keyH) : H;
    chart.setAttribute('viewBox', '0 0 ' + W + ' ' + Htot);
    chart.setAttribute('width', W); chart.setAttribute('height', Htot);
    scales = { W: W, x0: x0, x1: x1, padT: padT, y0: y0, X: X, band: band, first: first, last: last };

    dropCross = deskCrosshair(chart, { x0: x0, x1: W - 2, y0: padT, y1: y0, read: function (px) {
      var yr = Math.max(first, Math.min(last, first + Math.floor((px - x0) / band)));
      var r = rows[yr - first];
      return { x: X(yr), y: padT, lines: [String(yr), 'Actual ' + pct(r.actual), 'Credited ' + pct(r.credited), 'Bond yield ' + pct(r.bond) + ' (real)'] };
    } });
  }
  // the arrow keys step the reading one year at a time when the chart has focus; Home and End go to the ends
  chart.addEventListener('keydown', function (e) {
    var k = e.key;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(k) < 0 || !scales) return;
    e.preventDefault();
    if (kbYear == null) kbYear = k === 'ArrowLeft' || k === 'End' ? scales.last : scales.first;
    else kbYear += k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
    if (k === 'Home') kbYear = scales.first; if (k === 'End') kbYear = scales.last;
    kbYear = Math.max(scales.first, Math.min(scales.last, kbYear));
    var rc = chart.getBoundingClientRect(), x = rc.left + scales.X(kbYear) * rc.width / scales.W;
    chart.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: rc.top + rc.height / 2 }));
  });
  chart.addEventListener('blur', function () { kbYear = null; chart.dispatchEvent(new PointerEvent('pointerleave')); });
  // touch: a finger lifting fires pointerleave, which would hide the reading at once. On touch the reading stays until a
  // tap outside the chart (this capture listener runs before the shared crosshair's own).
  chart.addEventListener('pointerleave', function (e) { if (e.pointerType === 'touch') e.stopImmediatePropagation(); }, true);
  document.addEventListener('pointerdown', function (e) {
    if (chart.contains(e.target)) return;
    var g = chart.querySelector('.crosshair'); if (g) g.style.display = 'none';
  });

  // ---- the first move: spread gains and losses over 1 to 10 years ----
  var range = $('n'), bubble = $('n-out');
  range.min = B.N.min; range.max = B.N.max; range.step = B.N.step; range.value = st.N;
  $('tick-lo').textContent = years(B.N.min); $('tick-hi').textContent = years(B.N.max);
  function paintSlider() {
    var f = (st.N - B.N.min) / (B.N.max - B.N.min), w = range.clientWidth, thumb = 28;
    range.value = st.N;
    bubble.textContent = years(st.N);
    range.setAttribute('aria-valuetext', years(st.N) + ', a setting to explore');
    range.disabled = st.steady;
    $('slide').classList.toggle('off', st.steady);
    var half = bubble.offsetWidth / 2, x = f * (w - thumb) + thumb / 2;
    bubble.style.left = Math.max(half, Math.min(w - half, x)) + 'px';
    range.style.setProperty('--fill', (f * 100).toFixed(2) + '%');
  }
  range.addEventListener('input', function () { st.N = Number(range.value); paintSlider(); render(false, true); });

  // ---- Go deeper: the account's mix, the ladder and the swings ----
  var wr = $('w'), wOut = $('w-out');
  wr.min = B.w.min * 100; wr.max = B.w.max * 100; wr.step = B.w.step * 100; wr.value = st.w * 100;
  function paintW() {
    var f = (st.w - B.w.min) / (B.w.max - B.w.min), w = wr.clientWidth, thumb = 28;
    wr.value = Math.round(st.w * 100);
    wOut.textContent = share(st.w);
    wr.setAttribute('aria-valuetext', share(st.w) + ' bonds and loans, ' + share(1 - st.w) + ' stocks and property');
    $('w-rest').textContent = 'The rest, ' + share(1 - st.w) + ', is in stocks and property.';
    var half = wOut.offsetWidth / 2, x = f * (w - thumb) + thumb / 2;
    if (w > 0) wOut.style.left = Math.max(half, Math.min(w - half, x)) + 'px';
    wr.style.setProperty('--fill', (f * 100).toFixed(2) + '%');
  }
  wr.addEventListener('input', function () { st.w = Math.round(Number(wr.value)) / 100; paintW(); render(false, true); });
  B.L.forEach(function (L) {
    var lab = document.createElement('label'); lab.className = 'radio';
    lab.innerHTML = '<input type="radio" name="ladder" value="' + L + '"' + (L === st.L ? ' checked' : '') + '> <span>' + L + ' years</span>';
    $('ladder-row').appendChild(lab);
  });
  [].forEach.call(document.querySelectorAll('input[name="ladder"]'), function (r) { r.addEventListener('change', function () { if (r.checked) { st.L = Number(r.value); render(); } }); });
  [].forEach.call(document.querySelectorAll('input[name="swing"]'), function (r) { r.addEventListener('change', function () { if (r.checked) { st.steady = r.value === 'steady'; paintSlider(); render(); } }); });
  function paintControls() {
    [].forEach.call(document.querySelectorAll('input[name="ladder"]'), function (r) { r.checked = Number(r.value) === st.L; });
    $('swing-on').checked = !st.steady; $('swing-off').checked = st.steady;
    paintW(); paintSlider();
  }
  function reset(focus) {
    st.w = E.w; st.L = E.L; st.steady = false;
    paintControls(); render();
    if (focus) focus.focus();
  }
  $('reset').addEventListener('click', function () { reset(wr); });
  $('reset-top').addEventListener('click', function () { reset(range); });

  // ---- the words that follow the state ----
  var readout = deskReadout('#answer', { format: pts });
  function paintWords(first) {
    var state = stateOf();
    readout.set({ n: S.maxMoveCredited, line: st.steady ? 'With steady stocks, the actual return still changed by up to ' + pts(S.maxMoveActual) + ' points in one year, mostly from bond prices.' : 'The actual return changed by up to ' + pts(S.maxMoveActual) + ' points in one year.', animate: first ? false : undefined });
    // the help line: steady mode has nothing to spread; a figure higher than one year fewer gives the reason
    var prev = !st.steady && st.N > B.N.min ? F.summary(F.run(Y, { N: st.N - 1, w: st.w, L: st.L, pattern: F.PAT })) : null;
    $('n-help').textContent = st.steady ? 'With steady stocks and property there is nothing to spread: only the bonds hold the credited rate back.'
      : prev && Number(pts(S.maxMoveCredited)) > Number(pts(prev.maxMoveCredited)) ? 'Higher than at ' + years(st.N - 1) + ': the made-up swings repeat every ' + F.PAT.length + ' years, and some settings line up with them.'
      : 'A setting to explore, not any insurer’s.';
    $('chart-title').textContent = TITLES[state];
    $('chart-svg-title').textContent = TITLES[state];
    $('chart-sub').textContent = 'Made-up account, % a year, ' + S.first + '–' + S.last + '. The bond yield is real.';
    var lowT = S.low.year + ': earned ' + pct(S.low.actual) + ', credited ' + pct(S.low.credited);
    var highT = S.high.year + ': earned ' + pct(S.high.actual) + ', credited ' + pct(S.high.credited);
    $('chart-desc').textContent = 'Bars: the made-up account’s actual return each year, ' + S.first + ' to ' + S.last + '. A thick line: the credited rate. A dashed line: the real long-term Government of Canada bond yield. '
      + 'The credited rate’s biggest one-year change is ' + pts(S.maxMoveCredited) + ' points (into ' + S.maxMoveCreditedYear + '); the actual return’s is ' + pts(S.maxMoveActual) + ' points (into ' + S.maxMoveActualYear + '). '
      + 'Lowest year ' + lowT + '. Highest year ' + highT + '.';
    $('chart-table-rows').innerHTML = [
      ['Credited rate’s biggest one-year change', pts(S.maxMoveCredited) + ' points, into ' + S.maxMoveCreditedYear],
      ['Actual return’s biggest one-year change', pts(S.maxMoveActual) + ' points, into ' + S.maxMoveActualYear],
      ['Lowest year', lowT], ['Highest year', highT],
    ].map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('');
    // under the chart: the averages, and why the 1980s are high
    var same = Math.abs(Number(pts(S.meanActual).replace('−', '-')) - Number(pts(S.meanCredited).replace('−', '-'))) < 0.3;
    $('avg-line').innerHTML = 'Over ' + S.first + '–' + S.last + ' the simple averages are <b>' + esc(pct(S.meanActual)) + '</b> a year for the actual return and <b>' + esc(pct(S.meanCredited)) + '</b> for the credited rate. '
      + (same ? 'In this model, smoothing mostly changes when results are credited, not how much. ' : 'The gap is the part of earlier gains and losses not yet credited. ')
      + 'Neither line is what a policy earns: a real account also pays costs and keeps some earnings as surplus.';
    var e80 = []; for (var y = S.first; y < S.first + 10 && y <= S.last; y++) e80.push(Y[y] * 100);
    $('eighties-line').innerHTML = 'Rates in the ' + S.first + 's are high because year-end long bond yields were <b>' + esc(pct(Math.min.apply(null, e80))) + '</b> to <b>' + esc(pct(Math.max.apply(null, e80))) + '</b> in that decade.';
    // How this is worked out (filled live)
    var w = share(st.w), g = share(1 - st.w), sp = pts(E.spread * 100), pr = pts(E.prem * 100);
    var how = [
      'Each year the made-up account holds ' + w + ' in bonds and loans on a ' + st.L + '-year ladder, and ' + g + ' in stocks and property.',
      '<b>Actual return:</b> the bonds at market value (their prices rise when yields fall, and fall when yields rise), plus ' + sp + ' point; and the stocks and property at the long bond yield plus ' + pr + ' points'
        + (st.steady ? '.' : ', plus that year’s made-up swing.'),
      '<b>Credited rate:</b> the bonds at the average yield they were bought at, plus ' + sp + ' point; and the stocks and property at their expected return'
        + (st.steady ? '.' : ', plus each swing spread evenly over the ' + years(st.N) + ' set above.')
        + (state === 'n1' ? ' Even with no spreading, bonds held to maturity count at the yield they were bought at.' : ''),
      '<b>The figure:</b> the credited rate’s biggest change from one year to the next, ' + S.first + '–' + S.last + ', is <b>' + pts(S.maxMoveCredited) + '</b> points (into ' + S.maxMoveCreditedYear + '). The actual return’s is ' + pts(S.maxMoveActual)
        + ' (into ' + S.maxMoveActualYear + '). In a typical year the credited rate moved ' + pts(S.medianMoveCredited) + ' points and the actual return ' + pts(S.medianMoveActual) + '.',
    ];
    if (!st.steady) how.push('Because the made-up swings repeat every ' + F.PAT.length + ' years, some spreads line up with them better than others, so the figure doesn’t always fall as the years go up.');
    $('how').innerHTML = '<ol>' + how.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
    // the echo line, when a Go deeper setting differs from the example
    var ch = changed();
    $('echo').textContent = ch ? 'Account changed below: ' + share(st.w) + ' bonds and loans, ' + st.L + '-year ladder.' : '';
    $('echo-row').hidden = !ch;
    $('reset').hidden = !ch;
    paintCaveats();
  }

  // ---- static words: the not-guaranteed line, What happens, the rules, the caveats, the sources ----
  $('not-g').innerHTML = fact(R.notGuaranteed.id, 'Dividends are not guaranteed') + ': ' + fact(R.board.id, 'a life insurer’s board declares them') + ', typically once a year, and they can go down.';
  $('def').innerHTML = 'The credited rate feeds a dividend formula; it is not what a policy earns. '
    + fact(R.actualVsAssumed.id, 'A dividend’s interest part depends on how far that rate is above the rate assumed when the policy was priced') + '.';
  (function steps() {
    var s = [
      '<b>The accounts.</b> A life insurer keeps '
        + (R.separate ? fact(R.separate.id, 'separate accounts for its participating (“par”) policies') : 'accounts for its participating (“par”) policies') + '. In this example, the account invests mostly in bonds and loans, with some stocks and property.',
      '<b>The results.</b> Each year the account earns what its investments earn at market value: the actual return. '
        + fact(R.actualVsAssumed.id, 'Dividends come from how far results such as investment income, deaths and expenses differ from what was assumed when the policies were priced') + '.',
      '<b>The smoothing.</b> Good and bad years are spread out, so dividends move gradually. The result is the credited rate (formally, the dividend scale interest rate). '
        + fact(R.smoothingPurpose.id, 'OSFI expects smoothing only to avoid undue yearly swings') + '. In this example, bonds count at the yield they were bought at, and stock and property gains and losses are spread over the years set above. That period is our assumption, not any insurer’s, and methods differ.',
      '<b>The dividend.</b> ' + (R.actuary ? fact(R.actuary.id, 'Before a dividend is declared, the company’s actuary reports to the board on its fairness') + '. ' : '')
        + fact(R.board.id, 'The board then declares it, at its discretion') + '.',
    ];
    $('steps').innerHTML = s.map(function (x) { return '<li>' + x + '</li>'; }).join('');
  })();
  function label(f) {
    if (f.authority === 'statute') return /Regulations/.test(f.title) ? 'Policyholders Disclosure Regulations' : 'Insurance Companies Act';
    return 'OSFI Guideline E-16. OSFI expects; a guideline, not law.';
  }
  function src(f, words) { return esc(words) + ' · <a href="' + esc(f.source_url) + '">source</a> · as of ' + esc(longDate(f.as_of)); }
  (function rules() {
    var order = ['separate', 'actualVsAssumed', 'smoothingAllowed', 'smoothingPurpose', 'returnUnsmoothed', 'actuary', 'board', 'notGuaranteed', 'capRange'];
    var html = order.filter(function (k) { return R[k] && (k !== 'capRange' || R.shareholderRange); }).map(function (k) {
      var f = R[k], extra = '';
      if (k === 'capRange') {
        var lo = R.shareholderRange.min, hi = R.shareholderRange.max;
        extra = '<p>For a company with shareholders, at most ' + fact(R.capTiers.id, esc(pct(lo).replace('.0%', '%'))) + ' to ' + fact(R.capTiers.id, esc(pct(hi).replace('.0%', '%')))
          + ' of the profit set for distribution in a year can go to shareholders, depending on the accounts’ size. A company without shareholders has no such transfer.</p>';
      }
      // the shareholder ceiling is set by statute (the tiers' own section); the line quoted is OSFI's summary of it
      var where = k === 'capRange' ? src(R.capTiers, 'Insurance Companies Act, section 461: the ceiling is law') + '. The line above is ' + src(f, 'OSFI Guideline E-16’s summary of it')
        : src(f, label(f));
      // a line that starts mid-sentence (the Regulations' list item) gets a leading ellipsis, drawn in CSS so the text stays the fact's own
      return '<div class="rule" data-rule="' + esc(f.id) + '"><blockquote data-fact="' + esc(f.id) + '"' + (/^[a-z]/.test(f.value) ? ' class="frag"' : '') + '>' + esc(f.value) + '</blockquote>'
        + '<p class="rule-src">' + where + '</p>' + extra + '</div>';
    });
    $('rules').innerHTML = html.join('');
  })();
  (function where() {
    var p = [];
    if (R.onRequest) p.push('<p>' + fact(R.onRequest.id, 'A participating policyholder can ask the company for its dividend policy and its par account management policy, at no charge') + '.</p>');
    if (R.returnUnsmoothed) p.push('<p>' + fact(R.returnUnsmoothed.id, 'OSFI expects a yearly statement that shows the credited rate beside the account’s unsmoothed return') + '.</p>');
    if (!p.length) $('read-h').parentNode.remove(); else $('where').innerHTML = p.join('');
  })();
  function paintCaveats() {
    var pat = F.PAT.map(function (v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v); }).join(', ');
    var groups = [
      ['The account', ['One made-up par account, ' + S.first + ' to ' + S.last + '.', share(st.w) + ' bonds and loans; the rest stocks and property.', 'Bonds on a ' + st.L + '-year ladder, held to maturity; one rung matures each year.', 'Every bond priced on one flat curve at the long bond yield.']],
      ['The returns', ['Bonds and loans earn ' + pts(E.spread * 100) + ' point over government yields.', 'Stocks and property are expected to earn ' + pts(E.prem * 100) + ' points over the long bond yield.',
        'Their surprises follow an invented ' + F.PAT.length + '-year pattern that follows no real market.', 'The pattern: ' + pat + ' points, from ' + E.start + '.']
        .concat(st.steady ? ['Switched off above: steady stocks, no surprises.'] : [])],
      ['The smoothing', ['Bonds count at the yield they were bought at.', 'In this example, stock and property surprises are spread evenly over ' + years(st.N) + '.', 'Each year’s credited rate here uses that year’s own results. A real dividend scale is typically set in advance, so it would trail by about a year more.', 'The smoothing period is our assumption, not any insurer’s, and methods differ.']],
      ['Left out', ['Deaths, lapses, expenses and taxes; only investments move here.', 'Investment costs, surplus and the shareholder share.', 'How a dividend is shared among policies.', 'Any policy’s values or dividends.']],
    ];
    $('caveats').innerHTML = groups.map(function (g) { return '<div class="cv-group"><h3 class="cv-h">' + g[0] + '</h3><ul>' + g[1].map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>'; }).join('');
  }
  (function sources() {
    var b = DATA.bond;
    var items = R.used.map(function (f) { return '<li><a class="fact-title" href="' + esc(f.source_url) + '">' + esc(f.title) + '</a> · as of ' + esc(longDate(f.as_of)) + '</li>'; });
    var attr = b.attribution.split(/\s(?=Source: Bank of Canada)/);
    var ver = 'Version ' + DATA.version + ' · data retrieved ' + longDate(b.retrieved) + ' · made in this browser; nothing was sent.';
    $('sources').innerHTML = '<p>The rules on this page are read from these official sources (confirmed values only). Lines marked as general practice are not rules and cite no source.</p><ul>' + items.join('') + '</ul>'
      + '<p>These rules were checked against the Insurance Companies Act, the Policyholders Disclosure Regulations and OSFI Guideline E-16 on ' + esc(longDate(DATA.asOf)) + '; reference data, verify at the source.</p>'
      + '<p>The bond yield: <a href="' + esc(b.source_url) + '">' + esc(b.source) + '</a>. ' + esc(b.title) + '.</p>'
      + attr.map(function (s) { return '<p class="attr">' + esc(s) + '</p>'; }).join('')
      + '<p>' + esc(b.changes) + (/\.$/.test(b.changes) ? '' : '.') + ' Retrieved ' + esc(longDate(b.retrieved)) + '. <a href="' + esc(b.licence_url) + '">' + esc(b.licence) + '</a> · <a href="' + esc(b.terms_url) + '">Bank of Canada terms of use</a>.</p>'
      + '<p>How it’s made: the model was written from scratch for this site and runs in this browser. The account, its mix, its ladder, its swings and its smoothing are made up: example assumptions, not facts, and not any insurer’s. Only the bond yields are real. ' + esc(ver) + '</p>';
    $('foot-version').textContent = ver;
  })();

  // ---- Go deeper: the numbers behind the chart (filled when open) ----
  var deeper = $('deeper');
  function drawTable() {
    if (!deeper.open) return;
    $('nums-rows').innerHTML = OUT.map(function (r) {
      return '<tr><th scope="row">' + r.year + '</th><td>' + esc(pct(r.actual)) + '</td><td>' + esc(pct(r.credited)) + '</td><td>' + esc(pct(r.bond)) + '</td></tr>';
    }).join('');
    var wrap = $('nums-wrap'), wrc = wrap.getBoundingClientRect(), hidden = 0;
    [].forEach.call(document.querySelectorAll('#nums thead th'), function (th) { if (th.getBoundingClientRect().right - wrc.left + wrap.scrollLeft > wrap.clientWidth + 1) hidden++; });
    $('nums-cap').textContent = 'In a typical year the actual return moved ' + pts(S.medianMoveActual) + ' points from the year before; the credited rate ' + pts(S.medianMoveCredited) + '.'
      + (hidden ? ' Swipe the table for ' + hidden + ' more column' + (hidden === 1 ? '' : 's') + ' →' : '');
  }
  deeper.addEventListener('toggle', function () { if (deeper.open) paintW(); drawTable(); });

  // ---- one render for every change ----
  var queued = false;
  function render(first, later) {
    OUT = F.run(Y, settings()); S = F.summary(OUT);
    paintWords(first === true);
    drawTable();
    if (!later) { drawChart(); return; }
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; drawChart(); });
  }
  render(true);
  paintSlider();
  paintControls();
  var lastW = frame.clientWidth;
  new ResizeObserver(function () { if (frame.clientWidth !== lastW) { lastW = frame.clientWidth; drawChart(); paintSlider(); } }).observe(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { drawChart(); paintSlider(); });
})();
