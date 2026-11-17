// Company life insurance: the page. The engine is INSURANCE (model.mjs, inlined by build.mjs); every rate and rule comes
// from the confirmed facts in the page's data block. Inputs live in memory only: nothing in the address, nothing stored.
// The page makes no request after it loads. Education only: a made-up owner, no product, no policy, no premium figure,
// no call to act. Every dollar figure goes through INSURANCE.money (full dollars), so the parts always add to the payout.
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('data').textContent);
  var F = INSURANCE, B = F.BOUNDS, E = F.EXAMPLE;
  var R = F.insuranceRules(DATA.facts);
  // the comparison bar (the same payout as a taxable dividend). If the firm's compliance prefers, false removes the bar,
  // the split's second row and the table's comparison columns (SPEC.md section 8.2).
  var COMPARE = true;
  var STAMP = 'Hypothetical illustration · Education, not advice';
  var NS = 'http://www.w3.org/2000/svg';
  var SANS = '"Source Sans 3 Variable", system-ui, sans-serif', SERIF = '"Source Serif 4 Variable", Georgia, serif';
  var FS = 17.5, VF = 19;                          // every chart label 17.5px or more; figures 19px in the serif
  var $ = function (id) { return document.getElementById(id); };
  var m = F.money;
  var st = { payout: E.payout, acb: E.acb }, S = null;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(d) { var p = String(d).split('-').map(Number); return MONTHS[p[1] - 1] + ' ' + p[2] + ', ' + p[0]; }
  function fact(ids, text) { return '<span data-fact="' + esc(ids) + '">' + esc(text) + '</span>'; }
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

  // ---- the parts of the payout: one list, in bar order, with who ends up with each (the chart, the hidden table, the
  // readings and the sum all read it) ----
  function parts(S) {
    var p = [
      { key: 'cap', bar: 0, v: S.capDiv, words: 'tax-free, capital dividend', who: 'to the family, tax-free, as a capital dividend', cls: 'p-cap' },
      { key: 'after', bar: 0, v: S.afterTax, words: 'to the family, after dividend tax', who: 'to the family, after dividend tax', cls: 'p-after' },
      { key: 'tax', bar: 0, v: S.tax, words: 'income tax', who: 'income tax on the taxable dividend', cls: 'p-tax' },
    ];
    if (COMPARE) p.push(
      { key: 'cafter', bar: 1, v: S.compare.family, words: 'to the family, after dividend tax', who: 'to the family, after dividend tax, if all of it were a taxable dividend', cls: 'p-after' },
      { key: 'ctax', bar: 1, v: S.compare.tax, words: 'income tax', who: 'income tax, if all of it were a taxable dividend', cls: 'p-tax' }
    );
    return p;
  }
  var BAR_TITLES = ['Through the capital dividend account', 'For comparison only: the same payout as a taxable dividend'];

  // ---- the chart: two stacked bars on one dollar scale, readings under each bar (no legend) ----
  function Placer(W) {
    var boxes = [];
    function hit(b) { return b.x < -0.5 || b.x + b.w > W + 0.5 || boxes.some(function (o) { return b.x < o.x + o.w + 8 && o.x < b.x + b.w + 8 && b.y < o.y + o.h && o.y < b.y + b.h; }); }
    return { hit: hit, add: function (b) { boxes.push(b); } };
  }
  var LH = Math.round(FS * 1.35), segRects = [];
  function drawChart() {
    var svg = $('chart'), frame = $('chart-frame');
    var W = Math.max(300, Math.floor(frame.clientWidth)), narrow = W < 640;
    clear(svg); segRects = [];
    var defs = el('defs', {}, svg);
    var pat = el('pattern', { id: 'ins-hatch', patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' }, defs);
    el('rect', { x: 0, y: 0, width: 6, height: 6, 'class': 'hatch-bg' }, pat);
    el('line', { x1: 1, y1: 0, x2: 1, y2: 6, 'class': 'hatch-line' }, pat);
    var P = parts(S), pay = S.inp.payout, X = function (v) { return v / pay * W; };
    var gText = el('g', { 'class': 'labels' }, svg), y = 4;
    var BARH = [40, 28], GAP = 2;

    // one bar: its title, (bar 1) the annotation and its leader, the segments, then the readings in rows under the bar
    function drawBar(b) {
      var list = P.filter(function (p) { return p.bar === b; });
      if (!list.length) return;
      if (b > 0) y += 24;
      // the bar's title (wrapped to the width)
      wrapText(BAR_TITLES[b], W - 2, function (s) { return measure(s, fSans6); }).forEach(function (s) {
        y += LH; el('text', { x: 0, y: (y - LH * 0.28).toFixed(1), 'class': 'bar-t' }, gText, s);
      });
      y += 6;
      // the one annotation, above bar 1, at the line between the tax-free part and the tax cost part (normal state only)
      var bx = X(S.capDiv);
      if (b === 0 && S.state === 'normal') {
        var one = 'The policy’s tax cost: this part pays dividend tax';
        var mw = function (s) { return measure(s, fSans6); }, full = mw(one);
        var lines = full + bx + 8 <= W - 4 ? [one] : wrapText(one, Math.min(W - 2, Math.max(W - bx - 8, W * 0.62)), mw);
        // balanced: no line of one word
        if (lines.length > 1) { var bal = wrapText(one, Math.ceil(full / lines.length) + 24, mw); if (bal.length === lines.length) lines = bal; }
        var w = Math.max.apply(null, lines.map(function (s) { return measure(s, fSans6); }));
        var tx = bx + 8 + w <= W - 4 ? bx + 8 : Math.max(0, W - w - 4), t0 = y;
        var at = el('text', { x: tx.toFixed(1), y: (y + FS).toFixed(1), 'class': 'annot' }, gText);
        lines.forEach(function (s, i) { el('tspan', { x: tx.toFixed(1), dy: i ? LH : 0 }, at, s); });
        y += lines.length * LH + 6;
        // the leader: from beside the text (or under it, when the text covers the line) down to the bar
        var covers = tx <= bx + 1;
        var ly0 = covers ? y - 4 : t0 + FS * 0.4;
        el('path', { d: 'M' + bx.toFixed(1) + ' ' + ly0.toFixed(1) + 'V' + (y + 4).toFixed(1), 'class': 'leader' }, svg);
        if (!covers) el('path', { d: 'M' + bx.toFixed(1) + ' ' + ly0.toFixed(1) + 'H' + (tx - 3).toFixed(1), 'class': 'leader' }, svg);
      }
      y += 4;
      var h = BARH[b], x0 = 0, top = y;
      list.forEach(function (p) {
        var x1 = x0 + X(p.v);
        p.x0 = x0; p.x1 = x1;
        if (p.v > 0) {
          // a 2px gap of the ground between parts, so each part reads against the ground (non-text contrast)
          var a = x0 + (x0 > 0 ? GAP / 2 : 0), z = x1 - (x1 < W - 0.5 ? GAP / 2 : 0);
          var r = el('rect', { x: a.toFixed(1), y: top, width: Math.max(1, z - a).toFixed(1), height: h, 'class': 'seg ' + p.cls, 'data-key': p.key }, svg);
          if (p.cls === 'p-after') el('rect', { x: (a + 1).toFixed(1), y: top + 1, width: Math.max(0, z - a - 2).toFixed(1), height: h - 2, 'class': 'seg-edge', 'pointer-events': 'none' }, svg);
          segRects.push({ p: p, el: r, x: a, w: z - a, y: top, h: h });
        }
        x0 = x1;
      });
      y += h;
      // the readings: each a 2px bracket spanning its part, then its figure and words; packed into rows under the bar
      var Pl = Placer(W), rows = [];
      list.filter(function (p) { return p.v > 0; }).forEach(function (p) {
        var fig = m(p.v), sep = ' · ', wf = measure(fig, fVal), ws = measure(sep, fSans), ww = measure(p.words, fSans);
        var one = wf + ws + ww, two = Math.max(wf, ww);
        var forms = one <= W - 2 ? [{ lines: 1, w: one }, { lines: 2, w: two }] : [{ lines: 2, w: two }];
        if (narrow) forms = forms.slice(0, 1);
        for (var r = 0; r < 6; r++) {
          for (var k = 0; k < forms.length; k++) {
            var f = forms[k], tx = Math.max(0, Math.min(p.x0, W - f.w));
            // a reading under a thin part sits at the part's right edge when it can, so it stays near its bracket
            if (p.x1 - p.x0 < f.w && p.x1 - f.w >= 0 && p.x0 > W / 2) tx = Math.max(0, Math.min(W - f.w, p.x1 - f.w));
            var box = { x: tx, y: r * 1000, w: f.w, h: 1 };
            if (Pl.hit(box)) continue;
            Pl.add(box); (rows[r] = rows[r] || []).push({ p: p, x: tx, f: f });
            r = 99; break;
          }
        }
      });
      rows.forEach(function (row) {
        var lines = Math.max.apply(null, row.map(function (it) { return it.f.lines; }));
        var by = y + 10;
        row.forEach(function (it) {
          var p = it.p, a = p.x0 + 1, z = p.x1 - 1;
          if (z - a < 6) { a = (p.x0 + p.x1) / 2 - 3; z = a + 6; }
          el('path', { d: 'M' + a.toFixed(1) + ' ' + (by - 5).toFixed(1) + 'V' + by.toFixed(1) + 'H' + z.toFixed(1) + 'V' + (by - 5).toFixed(1), 'class': 'bracket b-' + p.key + ' ' + p.cls, fill: 'none' }, svg);
          var t = el('text', { x: it.x.toFixed(1), y: (by + VF + 2).toFixed(1), 'class': 'rd', 'data-key': p.key }, gText);
          el('tspan', { 'class': 'rd-v ' + p.cls }, t, m(p.v));
          if (it.f.lines === 1) el('tspan', { 'class': 'rd-w' }, t, ' · ' + p.words);
          else el('tspan', { 'class': 'rd-w', x: it.x.toFixed(1), dy: LH }, t, p.words);
        });
        y = by + VF + 2 + (lines - 1) * LH + 8;
      });
    }
    drawBar(0);
    if (COMPARE) drawBar(1);
    y += 4;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Math.ceil(y));
    svg.setAttribute('width', W); svg.setAttribute('height', Math.ceil(y));
    // the reading box for a tapped or hovered part, pinned above the bars (drawn last, over the titles)
    readG = el('g', { 'class': 'crosshair seg-read' }, svg); readG.style.display = 'none';
    readBox = el('rect', { x: 0, y: 0, rx: 2 }, readG); readTxt = el('text', { x: 0, y: 0 }, readG);
    if (kbIndex != null) showRead(kbIndex);
  }

  // ---- reading a part: hover or tap (it stays on touch until a tap elsewhere), or Left and Right on the focused chart ----
  var readG = null, readBox = null, readTxt = null, kbIndex = null;
  function showRead(i) {
    var sr = segRects[i]; if (!sr || !readG) return;
    readG.style.display = '';
    while (readTxt.firstChild) readTxt.removeChild(readTxt.firstChild);
    el('tspan', { 'class': 'rv' }, readTxt, m(sr.p.v));
    el('tspan', {}, readTxt, ' · ' + sr.p.who);
    var W = Number($('chart').getAttribute('width')), pad = 6;
    var bb = readTxt.getBBox(), w = bb.width + pad * 2, h = bb.height + pad * 2;
    if (w > W) {
      // too long for one line on a phone: the figure, then who gets it
      while (readTxt.firstChild) readTxt.removeChild(readTxt.firstChild);
      el('tspan', { 'class': 'rv', x: 0, dy: '1em' }, readTxt, m(sr.p.v));
      wrapText(sr.p.who, W - pad * 2, function (s) { return measure(s, fSans); }).forEach(function (s) { el('tspan', { x: 0, dy: '1.3em' }, readTxt, s); });
      bb = readTxt.getBBox(); w = bb.width + pad * 2; h = bb.height + pad * 2;
    }
    var cx = sr.x + sr.w / 2, bx = Math.max(0, Math.min(W - w, cx - w / 2)), by = Math.max(0, sr.y - h - 6);
    readBox.setAttribute('x', bx); readBox.setAttribute('y', by); readBox.setAttribute('width', w); readBox.setAttribute('height', h);
    readTxt.setAttribute('transform', 'translate(' + (bx + pad - bb.x) + ',' + (by + pad - bb.y) + ')');
    segRects.forEach(function (s, k) { s.el.classList.toggle('on', k === i); });
  }
  function hideRead() { if (readG) readG.style.display = 'none'; segRects.forEach(function (s) { s.el.classList.remove('on'); }); }
  var chart = $('chart');
  function segAt(e) { var k = e.target && e.target.getAttribute && e.target.getAttribute('data-key'); if (!k) return -1; for (var i = 0; i < segRects.length; i++) if (segRects[i].p.key === k) return i; return -1; }
  chart.addEventListener('pointermove', function (e) { var i = segAt(e); if (i >= 0) showRead(i); else if (e.pointerType !== 'touch') hideRead(); });
  chart.addEventListener('pointerdown', function (e) { var i = segAt(e); if (i >= 0) showRead(i); });
  chart.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') hideRead(); });
  document.addEventListener('pointerdown', function (e) { if (!chart.contains(e.target)) hideRead(); });
  chart.addEventListener('keydown', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
    e.preventDefault();
    var n = segRects.length;
    if (kbIndex == null) kbIndex = 0;
    else if (e.key === 'ArrowRight') kbIndex = Math.min(n - 1, kbIndex + 1);
    else if (e.key === 'ArrowLeft') kbIndex = Math.max(0, kbIndex - 1);
    if (e.key === 'Home') kbIndex = 0; if (e.key === 'End') kbIndex = n - 1;
    showRead(kbIndex);
  });
  chart.addEventListener('blur', function () { kbIndex = null; hideRead(); });

  // ---- the first move: the tax cost slider (from $0 to the payout) ----
  var range = $('acb'), bubble = $('acb-out');
  range.min = B.acb.min; range.step = B.acb.step;
  function paintSlider() {
    range.max = st.payout; range.value = st.acb;
    var f = st.payout > 0 ? (st.acb - B.acb.min) / (st.payout - B.acb.min) : 0, w = range.clientWidth, thumb = 28;
    bubble.textContent = m(st.acb);
    range.setAttribute('aria-valuetext', m(st.acb) + ', an example');
    $('tick-lo').textContent = m(B.acb.min); $('tick-hi').textContent = m(st.payout);
    var half = bubble.offsetWidth / 2, x = f * (w - thumb) + thumb / 2;
    bubble.style.left = Math.max(half, Math.min(w - half, x)) + 'px';
    range.style.setProperty('--fill', (f * 100).toFixed(2) + '%');
  }
  var clampNote = '';
  function setAcb(v) { st.acb = Math.max(B.acb.min, Math.min(st.payout, v)); clampNote = ''; paintSlider(); render(false, true); }
  range.addEventListener('input', function () { setAcb(Number(range.value)); });
  range.addEventListener('keydown', function (e) {
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
    e.preventDefault();
    setAcb(st.acb + (e.key === 'PageUp' ? 1 : -1) * B.acb.page);
  });

  // ---- the payout stepper: label, minus, the value, plus; 48px buttons, disabled at a bound, never wrapping ----
  var STEP = { key: 'payout', label: 'The payout', name: 'the payout', min: B.payout.min, max: B.payout.max, step: B.payout.step };
  (function makeStepper(host, c) {
    var box = document.createElement('div'); box.className = 'stepper';
    var id = 'st-' + c.key, lab = document.createElement('span'); lab.className = 'stepper-l'; lab.id = id + '-l'; lab.textContent = c.label;
    var row = document.createElement('div'); row.className = 'stepper-row'; row.setAttribute('role', 'group'); row.setAttribute('aria-labelledby', id + '-l');
    var dn = document.createElement('button'), up = document.createElement('button'), out = document.createElement('output');
    dn.type = up.type = 'button'; dn.textContent = '−'; up.textContent = '+'; out.id = id; out.setAttribute('data-flash', '');
    row.appendChild(dn); row.appendChild(out); row.appendChild(up); box.appendChild(lab); box.appendChild(row); host.appendChild(box);
    function go(dir) {
      var v = Math.max(c.min, Math.min(c.max, Math.round((st.payout + dir * c.step) / c.step) * c.step));
      if (v === st.payout) return;
      st.payout = v;
      if (st.acb > v) { st.acb = v; clampNote = 'Tax cost lowered to ' + m(v) + ': it can’t be more than the payout here.'; } else clampNote = '';
      paintSlider(); render();
    }
    dn.addEventListener('click', function () { go(-1); }); up.addEventListener('click', function () { go(1); });
    c.paint = function () {
      var txt = m(st.payout);
      out.textContent = txt;
      dn.disabled = st.payout <= c.min; up.disabled = st.payout >= c.max;
      dn.setAttribute('aria-label', 'Decrease ' + c.name + ', now ' + txt);
      up.setAttribute('aria-label', 'Increase ' + c.name + ', now ' + txt);
    };
    c.out = out;
  })($('steppers'), STEP);
  $('reset').addEventListener('click', function () { st = { payout: E.payout, acb: E.acb }; clampNote = ''; paintSlider(); render(); range.focus(); });

  // ---- the words that follow the state ----
  var readout = deskReadout('#answer', { format: m });
  function lineFor(S) {
    return {
      normal: 'The ' + m(S.inp.acb) + ' tax cost can’t go out that way: it’s a taxable dividend.',
      noCost: 'No tax cost at death: all of the payout can go out this way.',
      allCost: 'The tax cost equals the payout, so none of it goes out this way.',
    }[S.state];
  }
  function figB(v) { return '<b>' + esc(v) + '</b>'; }
  function pc(v) { return S.inp.payout > 0 ? Math.max(0, Math.min(100, v / S.inp.payout * 100)).toFixed(3) + '%' : '0%'; }
  function paintSplit() {
    $('split-cda-t').innerHTML = figB(m(S.family)) + ' to the family + ' + figB(m(S.tax)) + ' income tax';
    $('split-cmp-t').innerHTML = figB(m(S.compare.family)) + ' to the family + ' + figB(m(S.compare.tax)) + ' income tax';
    var q = function (c) { return document.querySelector('#split .' + c); };
    q('seg-cap').style.width = pc(S.capDiv); q('seg-after').style.width = pc(S.afterTax); q('seg-tax').style.width = pc(S.tax);
    q('seg-cafter').style.width = pc(S.compare.family); q('seg-ctax').style.width = pc(S.compare.tax);
    [['seg-cap', S.capDiv], ['seg-after', S.afterTax], ['seg-tax', S.tax]].forEach(function (s) { q(s[0]).hidden = !(s[1] > 0); });
    $('split-cmp').hidden = !COMPARE;
    // the sum, as a small ledger: every part in full dollars, adding to the payout exactly
    var rows = [[m(S.capDiv), 'tax-free (capital dividend)', ''], [m(S.afterTax), 'to the family after dividend tax', '+'], [m(S.tax), 'income tax', '+']];
    $('sum').innerHTML = rows.map(function (r) { return '<span class="sum-row"><span class="sum-op">' + r[2] + '</span><b class="sum-v">' + esc(r[0]) + '</b><span class="sum-w">' + esc(r[1]) + '</span></span>'; }).join('')
      + '<span class="sum-row total"><span class="sum-op">=</span><b class="sum-v">' + esc(m(S.inp.payout)) + '</b><span class="sum-w">the payout</span></span>';
    $('sum-sr').textContent = m(S.capDiv) + ' tax-free as a capital dividend, plus ' + m(S.afterTax) + ' to the family after dividend tax, plus ' + m(S.tax) + ' income tax, make the ' + m(S.inp.payout) + ' payout.';
  }
  function stepsHtml() {
    return [
      '<b>The payout.</b> When the owner dies, the company receives the policy’s death benefit.',
      '<b>The account.</b> The payout, less the policy’s tax cost just before the death, goes into a tax account the company keeps (the capital dividend account).',
      '<b>The election.</b> The company elects, on the prescribed form and on time, to pay that much as a capital dividend. It is not counted in the family’s income. The tax cost part comes out as an ordinary taxable dividend.',
    ];
  }
  var rid = [R.ids.fedTop, R.ids.onTop, R.ids.surtax, R.ids.grossUp, R.ids.fedDTC, R.ids.onDTC].join(' ');
  function paintWords(first) {
    var i = S.inp;
    readout.set({ n: S.capDiv, line: lineFor(S), animate: first ? false : undefined });
    $('answer-of').textContent = 'of the ' + m(i.payout) + ' payout';
    paintSplit();
    $('lede').textContent = 'A made-up owner dies, and the company receives ' + m(i.payout) + '.';
    $('clamp').textContent = clampNote;
    $('chart-title').textContent = S.state === 'noCost' ? 'All of it through the account' : S.state === 'allCost' ? 'None of it through the account' : 'Where the payout goes';
    $('chart-svg-title').textContent = $('chart-title').textContent;
    $('chart-desc').textContent = 'Two bars of one example payout of ' + m(i.payout) + '. Through the capital dividend account: ' + m(S.capDiv) + ' tax-free as a capital dividend, '
      + m(S.afterTax) + ' to the family after dividend tax and ' + m(S.tax) + ' income tax.'
      + (COMPARE ? ' For comparison, the same payout as a taxable dividend: ' + m(S.compare.family) + ' to the family and ' + m(S.compare.tax) + ' income tax.' : '');
    $('chart-table-rows').innerHTML = parts(S).map(function (p) { return '<tr><td>' + esc(p.bar ? 'For comparison: as a taxable dividend' : BAR_TITLES[0]) + '</td><td>' + esc(p.words) + '</td><td>' + esc(m(p.v)) + '</td></tr>'; }).join('');
    // How this is worked out: plain steps, every rate wrapped in its fact
    var how = [
      'Into the capital dividend account (<abbr title="capital dividend account">CDA</abbr>): payout ' + esc(m(i.payout)) + ' − the policy’s tax cost ' + esc(m(i.acb)) + ' = ' + esc(m(S.cda)) + '.',
      'Elected as a capital dividend: ' + esc(m(S.capDiv)) + ', not counted in the family’s income.',
      i.acb > 0
        ? 'The tax cost part, ' + esc(m(i.acb)) + ', as a taxable dividend: income tax ' + esc(m(i.acb)) + ' × ' + fact(rid, F.pct2(R.rate)) + ' = ' + esc(m(S.tax)) + ' (rounded to the nearest ' + esc(m(F.ROUND)) + '), leaving ' + esc(m(S.afterTax)) + '.'
        : 'With no tax cost, nothing is paid as a taxable dividend, so there is no income tax.',
      'The family receives ' + esc(m(S.capDiv)) + ' + ' + esc(m(S.afterTax)) + ' = ' + esc(m(S.family)) + ' of the ' + esc(m(i.payout)) + '.',
    ];
    $('how').innerHTML = '<ol>' + how.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol><p>The rate is the ' + R.rateYear + ' top federal and Ontario rate on a non-eligible dividend, worked out in Go deeper.</p>';
    var li = $('steps').children, stp = stepsHtml();
    if (li.length !== stp.length) $('steps').innerHTML = stp.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    var changed = i.payout !== E.payout || i.acb !== E.acb;
    $('reset').hidden = !changed;
    var echo = $('echo');
    echo.textContent = changed ? 'Now: a ' + m(i.payout) + ' payout, a ' + m(i.acb) + ' tax cost.' : '';
    echo.hidden = !changed;
  }

  // ---- static words: the assumptions, the year, Go deeper's rules, the caveats, the sources ----
  $('assume-text').textContent = 'A made-up Ontario owner; the family taxed at the ' + R.rateYear + ' top rate; every figure an example.';
  $('year-line').textContent = 'Rates for ' + R.rateYear + ': the latest year with every figure published.';
  if (!R.acbRule) { $('acb-help').remove(); $('acb').removeAttribute('aria-describedby'); $('acb-sec').remove(); }
  else {
    $('acb-rule').innerHTML = '<p>The Act (section 148(9)) builds the tax cost from a formula. Amounts that raise it include the cost of acquiring an interest in the policy and the premiums paid. Amounts that lower it include proceeds of disposition and the net cost of pure insurance, which the insurer works out under the regulations.</p>'
      + '<p class="rule-text">' + fact(R.ids.acbRule, R.acbRule) + '</p>'
      + '<p>Which way it moves over a policy’s life depends on the policy; this tool does not estimate it.</p>';
  }
  (function dividendLines() {
    var L = F.per100(R), c = F.cents, sur = R.surtaxRows.map(function (r) { return F.factPct(r * 100); });
    var rows = [
      '$' + L.dividend + ' of dividend is taxed as ' + c(L.grossed) + ' of income (gross-up ' + fact(R.ids.grossUp, F.factPct(R.grossUp * 100)) + ').',
      'Federal: ' + c(L.grossed) + ' × ' + fact(R.ids.fedTop, F.factPct(R.fedTop * 100)) + ' = ' + c(L.fedTax) + ', less a credit of ' + fact(R.ids.fedDTC, F.factPct(R.fedDTC * 100)) + ' of the ' + c(L.gross) + ' gross-up = ' + c(L.fedCredit) + '.',
      'Ontario: ' + c(L.grossed) + ' × ' + fact(R.ids.onTop, F.factPct(R.onTop * 100)) + ' = ' + c(L.onTax) + ', plus the surtax (' + fact(R.ids.surtax, sur.join(' + ')) + ' of it) = ' + c(L.surtax) + '.',
      'Then the Ontario credit of ' + fact(R.ids.onDTC, F.factPct(R.onDTC * 100)) + ' of the ' + c(L.gross) + ' gross-up = ' + c(L.onCredit) + ', taken off after the surtax (' + fact(R.ids.surtaxBase, 'Taxation Act, 2007, 16(2)') + ').',
      'In all: ' + c(L.fedTax) + ' − ' + c(L.fedCredit) + ' + ' + c(L.onTax) + ' + ' + c(L.surtax) + ' − ' + c(L.onCredit) + ' = <b id="div-total">' + c(L.total) + '</b>, so the top rate on this dividend in ' + R.rateYear + ' is ' + fact(rid, F.pct2(R.rate)) + '.',
    ];
    $('div-lines').innerHTML = '<p>Per $' + L.dividend + ' of non-eligible dividend, at the ' + R.rateYear + ' top rates; each line is rounded to the cent.</p><ol class="fold-list">' + rows.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
  })();
  $('elect').innerHTML = '<p>The company elects for the full amount of the dividend, in the prescribed manner and form and on time. The dividend is a capital dividend only up to the account’s balance just before it becomes payable, and no part of it is counted in any shareholder’s income (section 83(2)).</p>'
    + '<p class="rule-text">' + fact(R.ids.election, R.text.election.value) + '</p>'
    + '<p>Rules on an election larger than the account, and the anti-avoidance rules around it, are left out here.</p>';
  $('caveats').innerHTML = [
    ['The set-up', ['A made-up owner of an Ontario private company.', 'The company owns the policy and is its beneficiary.', 'The account holds only this payout.', 'The owner’s family are the company’s shareholders after the death.']],
    ['Paying it out', ['The election is made on time, for the full dividend.', 'The tax cost part is paid now, as a non-eligible dividend.', 'The family is taxed at the ' + R.rateYear + ' top Ontario rate.']],
    ['Left out', ['Premiums, and how they are paid.', 'Which kind of policy (for example, permanent life insurance).', 'Any tax the company may pay on the payout.', 'How the tax cost changes over the years.', 'Holding the policy personally.',
      'Tax on the owner’s shares at death, and the payout’s effect on their value.', 'Probate; creditors’ claims on company assets.', 'The dividend refund and other company tax accounts.', 'Keeping the money in the company.', 'Family members outside Ontario or Canada.', 'Lower brackets.']],
  ].map(function (g) { return '<div class="cv-group"><h3 class="cv-h">' + g[0] + '</h3><ul>' + g[1].map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>'; }).join('');
  (function sources() {
    var items = R.used.map(function (f) { return '<li><a href="' + esc(f.source_url) + '">' + esc(f.title) + '</a> · as of ' + esc(longDate(f.as_of)) + '</li>'; });
    var ver = 'Version ' + DATA.version + ' · rates for ' + R.rateYear + ' · made in this browser; nothing was sent.';
    $('sources').innerHTML = '<p>Every rate and rule on this page is read from these official sources (confirmed values only):</p><ul>' + items.join('') + '</ul>'
      + '<p>These rules were checked against the statutes and the government’s pages on ' + esc(longDate(DATA.asOf)) + '; reference data, verify at the source.</p>'
      + '<p>How it’s made: the calculation was written from scratch for this site, from the statute text, and runs in this browser. The owner, the company and the figures are made up: example assumptions, not facts, and not anyone’s situation. ' + esc(ver) + '</p>';
    $('foot-version').textContent = ver;
  })();

  // ---- Go deeper: the numbers behind the chart (filled when open) ----
  var deeper = $('deeper');
  function drawTable() {
    if (!deeper.open) return;
    var cols = ['Tax cost', 'Capital dividend, tax-free', 'To the family after dividend tax', 'Income tax', 'Family in all'];
    if (COMPARE) cols.push('As a taxable dividend: to the family', 'As a taxable dividend: income tax');
    $('nums-head').innerHTML = cols.map(function (c) { return '<th scope="col">' + c + '</th>'; }).join('');
    $('nums-rows').innerHTML = F.tableRows(R, S.inp.payout, S.inp.acb).map(function (r) {
      var cells = [m(r.capDiv), m(r.afterTax), m(r.tax), m(r.family)];
      if (COMPARE) cells.push(m(r.compare.family), m(r.compare.tax));
      return '<tr' + (r.now ? ' class="now"' : '') + '><th scope="row">' + esc(m(r.acb)) + (r.now ? ' <span class="now-tag">now</span>' : '') + '</th><td>' + cells.map(esc).join('</td><td>') + '</td></tr>';
    }).join('');
    var wrap = $('nums-wrap'), wr = wrap.getBoundingClientRect(), hidden = 0;
    [].forEach.call(document.querySelectorAll('#nums-head th'), function (th) { if (th.getBoundingClientRect().right - wr.left + wrap.scrollLeft > wrap.clientWidth + 1) hidden++; });
    $('nums-cap').textContent = 'The tax cost at 0, a quarter, half, three quarters and all of the ' + m(S.inp.payout) + ' payout, and now.' + (hidden ? ' Swipe the table for ' + hidden + ' more column' + (hidden === 1 ? '' : 's') + ' →' : '');
  }
  deeper.addEventListener('toggle', drawTable);

  // ---- one render for every change ----
  var queued = false;
  function render(first, later) {
    S = F.split(R, st); st.acb = S.inp.acb;
    paintWords(first === true);
    STEP.paint();
    drawTable();
    if (!later) { drawChart(); return; }
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; drawChart(); });
  }
  render(true);
  paintSlider();
  deskWatchFlash(STEP.out);
  var frame = $('chart-frame'), lastW = frame.clientWidth;
  new ResizeObserver(function () { if (frame.clientWidth !== lastW) { lastW = frame.clientWidth; drawChart(); paintSlider(); } }).observe(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { drawChart(); paintSlider(); });
})();
