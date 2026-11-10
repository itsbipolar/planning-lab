// The Order of Returns: the scenes. The engine (engine.mjs) is inlined above this script at build time.
// Nothing the reader does is stored, put in the address or sent anywhere.
(function () {
  'use strict';
  var S = JSON.parse(document.getElementById('story').textContent);
  var money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
  function card(v) { var p = Math.round(v * 100); return (p < 0 ? '−' : '+') + Math.abs(p) + '%'; }
  function pct(v) { return (Math.round(v * 1000) / 10).toFixed(1) + '%'; }
  var AVG = average(S.cards);
  var TAIL = []; for (var i = S.cards.length; i < S.horizon; i++) TAIL.push(AVG);
  var GOOD = S.cards.slice().sort(function (a, b) { return b - a; });
  var BAD = S.cards.slice().sort(function (a, b) { return a - b; });
  function run(order, w, lv) {
    return simulate({ start: S.start, withdrawal: w, indexation: S.indexation, returns: order.concat(TAIL.slice(0, Math.max(0, S.horizon - order.length))),
      flexRule: lv && lv.flex ? { trim: S.flexTrim } : null, cashBuffer: lv && lv.buffer ? { years: S.bufferYears } : null });
  }
  function words(n) { return ['zero', 'one', 'two', 'three', 'four', 'five'][n] || String(n); }
  document.querySelectorAll('[data-v]').forEach(function (el) {
    el.textContent = { start: money.format(S.start), withdrawal: money.format(S.withdrawal), avg: pct(AVG), trim: Math.round(S.flexTrim * 100) + '%', buffer: words(S.bufferYears) }[el.dataset.v];
  });

  // ---------- the chart: lines from year 0 to the horizon, labelled directly; an amber dot where money runs out ----------
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) { var e = document.createElementNS(NS, name); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function chart(id, series) {
    var svg = document.getElementById(id); svg.replaceChildren();
    // size the drawing to the page so text stays readable on a phone (one unit is about one pixel)
    var W = Math.round(Math.min(640, Math.max(320, document.querySelector('main').clientWidth))), H = W < 480 ? 260 : 300;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var L = W < 480 ? 50 : 64, R = W < 480 ? 104 : 128, T = 14, B = 34, n = S.horizon;
    var max = 0; series.forEach(function (s) { s.pts = [S.start].concat(s.res.balances); s.pts.forEach(function (v) { if (v > max) max = v; }); });
    var step = max > 1500000 ? 500000 : max > 600000 ? 200000 : 100000; max = Math.ceil(max / step) * step;
    var x = function (t) { return L + t / n * (W - L - R); }, y = function (v) { return T + (1 - v / max) * (H - T - B); };
    for (var g = 0; g <= max; g += step) { el('line', { x1: L, x2: W - R, y1: y(g), y2: y(g), class: 'grid' }, svg); var tx = el('text', { x: L - 8, y: y(g) + 4, 'text-anchor': 'end', class: 'axis' }, svg); tx.textContent = g === 0 ? '$0' : '$' + (g / 1000) + 'k'; }
    [0, 5, 10, 15, 20, 25].filter(function (t) { return t <= n; }).forEach(function (t) { var tx = el('text', { x: x(t), y: H - 12, 'text-anchor': 'middle', class: 'axis' }, svg); tx.textContent = t; });
    var yl = el('text', { x: W - R, y: H - 12, 'text-anchor': 'end', class: 'axis', dx: 0 }, svg); yl.textContent = '';
    var labels = [];
    series.forEach(function (s) {
      var upto = s.upto === undefined ? s.pts.length : s.upto + 1;
      var d = s.pts.slice(0, upto).map(function (v, t) { return (t ? 'L' : 'M') + x(t).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
      el('path', { d: d, fill: 'none', 'stroke-width': s.key === 'sam' || s.key === 'you' ? 3 : 2, class: 'l-' + s.key }, svg);
      var dep = s.res.depletionYear;
      if (dep && (s.upto === undefined || dep <= s.upto)) el('circle', { cx: x(dep), cy: y(0), r: 6, class: 'dot' }, svg);
      var lastT = upto - 1; labels.push({ y: y(s.pts[lastT]), x: x(lastT), text: s.label, key: s.key });
    });
    // labels never drop below the zero line and never overlap: push them apart upwards from the bottom
    labels.sort(function (a, b) { return a.y - b.y; });
    var floor = y(0);
    for (var k = labels.length - 1; k >= 0; k--) { var lim = k === labels.length - 1 ? floor : labels[k + 1].y - 17; if (labels[k].y > lim) labels[k].y = lim; }
    labels.forEach(function (lb) { var tx = el('text', { x: lb.x + 8, y: lb.y + 5, class: 'lab lab-' + lb.key }, svg); tx.textContent = lb.text; });
    var cap = el('text', { x: L, y: H - 12, class: 'axis', 'text-anchor': 'start', dy: 0 }, svg); cap.textContent = '';
  }
  function outcome(name, res) {
    return res.depletionYear ? name + ' runs out of money in year ' + res.depletionYear : name + ' still has ' + money.format(res.endBalance) + ' after ' + S.horizon + ' years';
  }

  // ---------- scene 1: the ten cards ----------
  var c1 = document.getElementById('cards-1');
  S.cards.forEach(function (v) { var li = document.createElement('li'); li.textContent = card(v); if (v < 0) li.className = 'down'; c1.appendChild(li); });

  // ---------- scene 2: shuffle with no withdrawals ----------
  var samOrder = BAD.slice();
  function scene2() {
    var r = run(GOOD, 0), s = run(samOrder, 0);
    chart('c2', [{ key: 'ruth', label: 'Ruth', res: r }, { key: 'sam', label: 'Sam', res: s }]);
    document.getElementById('t2').textContent = 'With nothing taken out, both end with ' + money.format(s.endBalance);
    document.getElementById('s2').textContent = 'Ruth ends with ' + money.format(r.endBalance) + '. Sam, with his years in the order ' + samOrder.map(card).join(', ') + ', ends with ' + money.format(s.endBalance) + '.';
  }
  document.getElementById('shuffle').addEventListener('click', function () {
    for (var i = samOrder.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = samOrder[i]; samOrder[i] = samOrder[j]; samOrder[j] = t; }
    scene2();
  });

  // ---------- scene 3: withdrawals split the paths ----------
  var RUTH = run(GOOD, S.withdrawal), SAM = run(BAD, S.withdrawal);
  chart('c3', [{ key: 'ruth', label: 'Ruth', res: RUTH }, { key: 'sam', label: 'Sam', res: SAM }]);
  document.getElementById('t3').textContent = 'Same years, same average: ' + outcome('Ruth', RUTH) + '; ' + outcome('Sam', SAM);
  document.getElementById('s3').textContent = 'Both take out ' + money.format(S.withdrawal) + ' in the first year, rising each year. ' + outcome('Ruth', RUTH) + '. ' + outcome('Sam', SAM) + '.';

  // ---------- scene 4: deal the years ----------
  var hand, dealt;
  var handEl = document.getElementById('hand'), dealtEl = document.getElementById('dealt');
  function scene4(focusNext) {
    handEl.replaceChildren(); dealtEl.replaceChildren();
    dealt.forEach(function (v) { var li = document.createElement('li'); li.textContent = card(v); if (v < 0) li.className = 'down'; dealtEl.appendChild(li); });
    hand.forEach(function (v, i) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = card(v); if (v < 0) b.className = 'down';
      b.setAttribute('aria-label', 'Deal the year ' + card(v));
      b.addEventListener('click', function () { dealt.push(v); hand.splice(i, 1); scene4(true); });
      handEl.appendChild(b);
    });
    var full = dealt.length === S.cards.length;
    var you = run(full ? dealt : dealt.concat([]), S.withdrawal);
    var series = [{ key: 'ruth', label: 'Ruth', res: RUTH }, { key: 'sam', label: 'Sam', res: SAM }];
    if (dealt.length) series.push({ key: 'you', label: 'Your order', res: run(dealt.concat(hand.slice().fill(AVG)), S.withdrawal), upto: full ? undefined : dealt.length });
    chart('c4', series);
    document.getElementById('t4').textContent = full ? (you.depletionYear ? 'In your order, the money runs out in year ' + you.depletionYear : 'In your order, ' + money.format(you.endBalance) + ' is left after ' + S.horizon + ' years') : 'Deal a card to see your path';
    document.getElementById('s4').textContent = full
      ? 'In your order (' + dealt.map(card).join(', ') + ') ' + (you.depletionYear ? 'the money runs out in year ' + you.depletionYear : 'there is ' + money.format(you.endBalance) + ' left after ' + S.horizon + ' years') + '. Ruth: ' + (RUTH.depletionYear ? 'runs out in year ' + RUTH.depletionYear : money.format(RUTH.endBalance) + ' left') + '. Sam: ' + (SAM.depletionYear ? 'runs out in year ' + SAM.depletionYear : money.format(SAM.endBalance) + ' left') + '.'
      : dealt.length ? dealt.length + ' of ' + S.cards.length + ' years dealt: ' + money.format(you.balances[dealt.length - 1]) + ' after year ' + dealt.length + '.' : '';
    if (focusNext) { var nb = handEl.querySelector('button'); (nb || document.getElementById('s4')).focus({ preventScroll: false }); }
  }
  document.getElementById('s4').tabIndex = -1;
  function reset4() { hand = S.cards.slice().sort(function (a, b) { return b - a; }); dealt = []; scene4(false); }
  document.getElementById('reset').addEventListener('click', reset4);
  document.getElementById('random').addEventListener('click', function () {
    while (hand.length) { var j = Math.floor(Math.random() * hand.length); dealt.push(hand.splice(j, 1)[0]); }
    scene4(false);
  });

  // ---------- scene 5: the sandbox on Sam's order ----------
  var w = document.getElementById('w'), wout = document.getElementById('wout'), flex = document.getElementById('flex'), buffer = document.getElementById('buffer');
  w.min = String(Math.round(S.withdrawal * 0.6 / 1000) * 1000); w.max = String(Math.round(S.withdrawal * 1.6 / 1000) * 1000); w.value = String(S.withdrawal);
  function total(res) { return res.paid.reduce(function (a, b) { return a + b; }, 0); }
  function scene5() {
    var lv = { flex: flex.checked, buffer: buffer.checked }, wv = Number(w.value);
    wout.textContent = money.format(wv); w.setAttribute('aria-valuetext', money.format(wv));
    var res = run(BAD, wv, lv);
    chart('c5', [{ key: 'base', label: 'Before', res: SAM }, { key: 'sam', label: 'With changes', res: res }]);
    document.getElementById('t5').textContent = 'With these choices, ' + outcome('Sam', res);
    document.getElementById('s5').textContent = outcome('With these choices, Sam', res) + ', and takes out ' + money.format(total(res)) + ' in total (' + money.format(total(SAM)) + ' as before). ' + outcome('As before, Sam', SAM) + '.';
  }
  [w, flex, buffer].forEach(function (e) { e.addEventListener('input', scene5); e.addEventListener('change', scene5); });

  // ---------- the stepper ----------
  var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene')), cur = 1;
  var prev = document.getElementById('prev'), next = document.getElementById('next'), progress = document.getElementById('progress');
  function show(n, focus) {
    cur = n;
    scenes.forEach(function (s) { s.hidden = Number(s.dataset.scene) !== n; });
    progress.textContent = 'Scene ' + n + ' of ' + scenes.length;
    prev.disabled = n === 1;
    next.textContent = n === scenes.length ? 'Start again' : 'Next';
    if (focus) document.getElementById('h' + n + 's').focus();
  }
  prev.addEventListener('click', function () { if (cur > 1) show(cur - 1, true); });
  next.addEventListener('click', function () { show(cur === scenes.length ? 1 : cur + 1, true); });

  scene2(); reset4(); scene5(); show(1, false);
  var redraw; window.addEventListener('resize', function () { clearTimeout(redraw); redraw = setTimeout(function () {
    scene2(); chart('c3', [{ key: 'ruth', label: 'Ruth', res: RUTH }, { key: 'sam', label: 'Sam', res: SAM }]); scene4(false); scene5();
  }, 150); });
})();
