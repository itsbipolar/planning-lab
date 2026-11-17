// Company life insurance: the page. The engine is INSURANCE (model.mjs, inlined by build.mjs); every rate and rule comes
// from the confirmed facts in the page's data block. Inputs live in memory only: nothing in the address, nothing stored.
// The page makes no request after it loads. Education only: a made-up owner, no product, no policy, no premium figure,
// no call to act. Every dollar figure goes through INSURANCE.money (full dollars), so the parts always add to the payout.
//
// The read-left-to-right pass (SPEC.md, "Read left to right (2026-11-17)"): one picture is the explanation and the
// control. The example payout is one bar: the income tax (d4), the taxable dividend after tax (d1, hatched) and the
// capital dividend (d1, solid). Over the bar, two spans split the payout at the handle: the policy's cost base and the
// tax-free capital dividend. Under it, two spans: the family's income tax and what reaches the family. The four readings
// sit at the bar's two ends and never move; only the spans and the handle do.
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('data').textContent);
  var F = INSURANCE, B = F.BOUNDS, E = F.EXAMPLE;
  var R = F.insuranceRules(DATA.facts);
  // the comparison bar (the same payout as a taxable dividend): off under the safer route (Mo, 2026-11-17). Next to the
  // account it read as what company-owned insurance gains, and the page can't state the rules a fair comparison needs
  // (SPEC.md section 8.2). build.mjs reads this line for the poster; the page no longer draws a second bar.
  var COMPARE = false;
  var STAMP = 'Hypothetical illustration · Education, not advice';
  var NS = 'http://www.w3.org/2000/svg';
  var SANS = '"Source Sans 3 Variable", system-ui, sans-serif', SERIF = '"Source Serif 4 Variable", Georgia, serif';
  var FS = 17.5, VF = 19;                          // every picture label 17.5px or more; figures 19px in the serif
  var $ = function (id) { return document.getElementById(id); };
  var m = F.money;
  // the payout is fixed at the example's; only the cost base moves
  var st = { payout: E.payout, acb: E.acb }, S = null;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(d) { var p = String(d).split('-').map(Number); return MONTHS[p[1] - 1] + ' ' + p[2] + ', ' + p[0]; }
  function fact(ids, text) { return '<span data-fact="' + esc(ids) + '">' + esc(text) + '</span>'; }
  // a rule in the Act's own words: the fact's value as a quotation (it is the official line, word for word, so nothing
  // is added to or taken from it), with its source under it
  function quote(f, where) {
    return '<blockquote class="rule-text" data-fact="' + esc(f.id) + '" cite="' + esc(f.source_url) + '">' + esc(f.value) + '</blockquote>'
      + '<p class="rule-src">' + esc(where) + ' · <a href="' + esc(f.source_url) + '">source</a></p>';
  }
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
  var fSans = '400 ' + FS + 'px ' + SANS, fVal = '600 ' + VF + 'px ' + SERIF;
  var still = function () { return matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var LH = Math.round(FS * 1.25);                  // the line step of a two-line reading (phones)

  // ---- the parts of the payout (the hidden table and the description) ----
  function parts(S) {
    return [
      { key: 'cap', v: S.capDiv, words: 'tax-free capital dividend' },
      { key: 'after', v: S.afterTax, words: 'taxable dividend, after tax' },
      { key: 'tax', v: S.tax, words: 'income tax' },
    ];
  }
  // the four readings, at the bar's ends: over it, the payout split at the handle; under it, where the money goes
  function readingsOf(S) {
    return {
      acb: { v: S.inp.acb, words: 'cost base', cls: 'r-acb', end: false, top: true },
      cap: { v: S.capDiv, words: 'tax-free capital dividend', cls: 'r-cap', end: true, top: true },
      tax: { v: S.tax, words: 'the family’s income tax', cls: 'r-tax', end: false, top: false },
      fam: { v: S.family, words: 'to the family', cls: 'r-fam', end: true, top: false },
    };
  }

  // ---- the picture: built once per width, then moved on every change ----
  var pic = $('pic'), svg = $('chart'), move = $('move'), range = $('acb');
  var G = null;                                    // the geometry and the shapes of the current build
  var GAP = 2, GRIP = 14, TICK = 6;               // the ground gap between parts; the grip's radius; a bracket's tick
  function build() {
    clear(svg);
    var W = Math.max(280, Math.floor(pic.clientWidth)), wide = W >= 640;
    var BARH = matchMedia('(min-width: 960px)').matches ? 72 : 56;
    var defs = el('defs', {}, svg);
    var pat = el('pattern', { id: 'ins-hatch', patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' }, defs);
    el('rect', { x: 0, y: 0, width: 6, height: 6, 'class': 'hatch-bg' }, pat);
    el('line', { x1: 1, y1: 0, x2: 1, y2: 6, 'class': 'hatch-line' }, pat);
    // a reading is one line from 640px (figure, then words) and two lines under it (figure over words); the rows
    // never change height, so nothing under the picture moves while the handle does
    var labH = wide ? VF + 6 : VF + LH + 3;
    // the gaps between a reading and its span, and a span and the bar: closer on phones, so the bar is higher up
    var LG = wide ? 8 : 5, BG = wide ? 6 : 4;
    var topBr = labH + LG, barTop = topBr + TICK + BG, barBot = barTop + BARH, botBr = barBot + BG + TICK, botLab = botBr + LG;
    var H = botLab + labH + 4;
    G = { W: W, wide: wide, BARH: BARH, barTop: barTop, barBot: barBot, topBr: topBr, botBr: botBr, botLab: botLab, labH: labH, H: H };
    G.tax = el('rect', { 'class': 'seg p-tax', 'data-key': 'tax', y: barTop, height: BARH }, svg);
    G.after = el('rect', { 'class': 'seg p-after', 'data-key': 'after', y: barTop, height: BARH }, svg);
    G.afterEdge = el('rect', { 'class': 'seg-edge', y: barTop + 1, height: BARH - 2 }, svg);
    G.cap = el('rect', { 'class': 'seg p-cap', 'data-key': 'cap', y: barTop, height: BARH }, svg);
    G.brackets = el('g', { 'class': 'brackets' }, svg);
    G.labels = el('g', { 'class': 'labels' }, svg);
    // the four readings: fixed places at the bar's two ends
    var R4 = readingsOf(S);
    G.read = {};
    Object.keys(R4).forEach(function (k) {
      var r = R4[k], x = r.end ? W : 0, y0 = r.top ? 0 : botLab;
      var t = el('text', { x: x, y: (y0 + VF * 0.85).toFixed(1), 'class': 'rd ' + r.cls, 'data-key': k, 'text-anchor': r.end ? 'end' : 'start' }, G.labels);
      var v = el('tspan', { 'class': 'rd-v' }, t, '');
      var w = wide ? el('tspan', { 'class': 'rd-w' }, t, ' ' + r.words) : el('tspan', { 'class': 'rd-w', x: x, dy: LH }, t, r.words);
      G.read[k] = { t: t, v: v, w: w };
    });
    G.handle = el('g', { 'class': 'handle', 'aria-hidden': 'true' }, svg);
    el('rect', { 'class': 'handle-rule', x: -2, y: topBr, width: 4, height: barBot + 3 - topBr }, G.handle);
    var cy = barTop + BARH / 2;
    el('circle', { 'class': 'grip', cx: 0, cy: cy, r: GRIP }, G.handle);
    el('path', { 'class': 'chev', d: 'M-3 ' + (cy - 4) + 'L-7 ' + cy + 'L-3 ' + (cy + 4) + 'M3 ' + (cy - 4) + 'L7 ' + cy + 'L3 ' + (cy + 4) }, G.handle);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    // the range lies over the bar (half a thumb past each end, so the thumb's centre lands on the boundary)
    move.style.top = barTop + 'px';
    move.style.height = BARH + 'px';
    place(false);
  }

  // move the shapes, the spans and the figures for the current state
  function place(ease) {
    if (!G) return;
    var W = G.W, pay = S.inp.payout, X = function (v) { return v / pay * W; };
    var xTax = X(S.tax), xAcb = X(S.inp.acb);
    pic.classList.toggle('ease', !!ease && !still());
    function box(r, a, z, show) {
      r.style.display = show ? '' : 'none';
      r.style.x = a.toFixed(1) + 'px';
      r.style.width = Math.max(0, z - a).toFixed(1) + 'px';
    }
    var hasTax = S.tax > 0, hasAfter = S.afterTax > 0, hasCap = S.capDiv > 0;
    // the tax, the hatched part after tax, the solid capital dividend, with 2px ground gaps
    var tz = hasTax ? Math.max(xTax, GAP) : 0;
    box(G.tax, 0, Math.max(GAP / 2, tz - GAP / 2), hasTax);
    var aa = hasTax ? tz + GAP / 2 : 0, az = hasCap ? xAcb - GAP / 2 : W;
    box(G.after, aa, Math.max(aa + 1, az), hasAfter);
    box(G.afterEdge, aa + 1, Math.max(aa + 1, az - 1), hasAfter);
    var ca = hasAfter || hasTax ? xAcb + GAP / 2 : 0;
    box(G.cap, ca, W, hasCap);
    G.handle.style.transform = 'translateX(' + xAcb.toFixed(1) + 'px)';
    // the spans: over the bar the cost base and the capital dividend meet at the handle; under it the tax and the
    // family's money meet where the tax ends
    var g = G.brackets;
    while (g.firstChild) g.removeChild(g.firstChild);
    function span(a, z, y, down, cls) {
      if (z - a < 1) return;
      var t = down ? y + TICK : y - TICK;
      el('path', { d: 'M' + a.toFixed(1) + ' ' + t + 'V' + y + 'H' + z.toFixed(1) + 'V' + t, 'class': 'bracket ' + cls, fill: 'none' }, g);
    }
    span(1, xAcb - 3, G.topBr, true, 'b-acb');
    span(xAcb + 3, W - 1, G.topBr, true, 'b-cap');
    span(1, tz - GAP / 2 - 1, G.botBr, false, 'b-tax');
    span(aa + 1, W - 1, G.botBr, false, 'b-fam');
    var R4 = readingsOf(S);
    Object.keys(R4).forEach(function (k) { G.read[k].v.textContent = m(R4[k].v); });
  }

  // ---- the first move: the cost base, from $0 to the payout, on the bar itself ----
  range.min = B.acb.min; range.max = st.payout; range.step = B.acb.step;
  function paintControl() {
    range.value = st.acb;
    range.setAttribute('aria-valuetext', m(st.acb) + ', an example');
  }
  var pressed = false, pressMoves = 0;
  range.addEventListener('pointerdown', function () { pressed = true; pressMoves = 0; });
  addEventListener('pointerup', function () { pressed = false; });
  addEventListener('pointercancel', function () { pressed = false; });
  function setAcb(v, ease) {
    st.acb = Math.max(B.acb.min, Math.min(st.payout, v));
    render(ease);
  }
  // a drag follows the thumb on the same frame; a key, a page step or a tap eases over 160ms
  range.addEventListener('input', function () {
    var ease = !pressed || pressMoves === 0;
    if (pressed) pressMoves++;
    setAcb(Number(range.value), ease);
  });
  range.addEventListener('keydown', function (e) {
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
    e.preventDefault();
    setAcb(st.acb + (e.key === 'PageUp' ? 1 : -1) * B.acb.page, true);
  });

  // ---- the words that follow the state ----
  var readout = deskReadout('#answer', { format: m });
  function lineFor(S) {
    return {
      normal: 'Paid out now, the ' + m(S.inp.acb) + ' cost base is a taxable dividend.',
      noCost: 'No cost base: all of it can be a capital dividend.',
      allCost: 'Paid out now, the whole payout is a taxable dividend.',
    }[S.state];
  }
  function stepsHtml() {
    return [
      '<b>The payout.</b> When the owner dies, the company receives the policy’s death benefit.',
      '<b>The account.</b> The payout, less the policy’s cost base just before the death, is added to a running tax tally the company keeps (the capital dividend account). No money moves.',
      '<b>The election.</b> The company elects, on the prescribed form and on time, to pay that much as a capital dividend. It is not counted in the family’s income. Here, the cost base part is paid out now as an ordinary taxable dividend.',
    ];
  }
  $('steps').innerHTML = stepsHtml().map(function (s) { return '<li>' + s + '</li>'; }).join('');
  var rid = [R.ids.fedTop, R.ids.onTop, R.ids.surtax, R.ids.grossUp, R.ids.fedDTC, R.ids.onDTC].join(' ');
  function paintWords(first) {
    var i = S.inp;
    readout.set({ n: S.family, line: lineFor(S), animate: first ? false : undefined });
    $('chart-desc').textContent = 'One bar: the example payout of ' + m(i.payout) + '. On the left, the policy’s cost base of ' + m(i.acb)
      + '; to its right, ' + m(S.capDiv) + ' as a tax-free capital dividend. Paid out now, the cost base part loses ' + m(S.tax)
      + ' to the family’s income tax and leaves ' + m(S.afterTax) + ', so ' + m(S.family) + ' reaches the family.';
    $('chart-table-rows').innerHTML = parts(S).map(function (p) { return '<tr><td>' + esc(p.words) + '</td><td>' + esc(m(p.v)) + '</td></tr>'; }).join('');
    // In this example's numbers: plain steps, every rate wrapped in its fact
    var how = [
      'Into the capital dividend account (<abbr title="capital dividend account">CDA</abbr>): payout ' + esc(m(i.payout)) + ' − the policy’s cost base ' + esc(m(i.acb)) + ' = ' + esc(m(S.cda)) + '.',
      'Elected as a capital dividend: ' + esc(m(S.capDiv)) + ', not counted in the family’s income.',
      i.acb > 0
        ? 'The cost base part, ' + esc(m(i.acb)) + ', paid out now as a taxable dividend: income tax ' + esc(m(i.acb)) + ' × ' + fact(rid, F.pct2(R.rate)) + ' = ' + esc(m(S.tax)) + ' (to the dollar), leaving ' + esc(m(S.afterTax)) + '.'
        : 'With no cost base, nothing is paid as a taxable dividend, so there is no income tax.',
      'The family receives ' + esc(m(S.capDiv)) + ' + ' + esc(m(S.afterTax)) + ' = ' + esc(m(S.family)) + ' of the ' + esc(m(i.payout)) + '.',
    ];
    $('how').innerHTML = '<ol class="fold-list">' + how.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol><p>The rate is the ' + R.rateYear + ' top federal and Ontario rate on a non-eligible dividend, worked out below.</p>';
  }

  // ---- static words: the assumptions, the hint, Go deeper's rules and the year, the caveats, the sources ----
  $('assume-text').textContent = 'Ontario, ' + R.rateYear + ' top rates.';
  // the one line that says what the handle is and what moves it (the second sentence only with the 148(9) fact)
  $('hint').textContent = R.acbRule ? 'Drag the cost base. Premiums raise it; the insurance’s cost lowers it.' : 'Drag the policy’s cost base.';
  // the year, and (when a later year's Ontario credit is already confirmed and lower) what that does to the taxable part
  $('year-line').innerHTML = esc('Rates for ' + R.rateYear + ': the latest year with every figure published.')
    + (R.onDTCLater ? ' ' + fact(R.onDTCLater.id, 'The Ontario dividend credit is already set lower from ' + R.onDTCLater.year) + esc(', so with other rates unchanged the tax on the taxable part would be higher then.') : '');
  // without the 148(9) fact, "The cost base, in the Act" keeps only the line that names the cost base
  if (!R.acbRule) {
    $('acb-h').textContent = 'The cost base';
    $('acb-help').textContent = 'The cost base is the policy’s adjusted cost basis under the Income Tax Act. The payout less it is what can go out as a capital dividend.';
    $('acb-rule').remove();
  } else {
    $('acb-rule').innerHTML = '<p>In plain words: section 148(9) of the Act builds the cost base from a formula, with amounts that raise it and amounts that lower it. The definition opens:</p>'
      + quote(R.text.acbRule, 'Income Tax Act, subsection 148(9)')
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
  $('elect').innerHTML = '<p>In plain words: when the company makes the election on time, for the full dividend, the dividend is a capital dividend up to the account’s balance, and none of it counts as the family’s income. Section 83(2) of the Act ends with rule (b):</p>'
    + quote(R.text.election, 'Income Tax Act, paragraph 83(2)(b)')
    + '<p>An election larger than the account has consequences of its own; those, and the anti-avoidance rules around the election, are left out here.</p>';
  $('caveats').innerHTML = [
    ['The set-up', ['A made-up owner of an Ontario private company.', 'The company owns the policy and is its beneficiary.', 'The account holds only this payout, with nothing else added or taken off.', 'The owner’s family are the company’s shareholders after the death.']],
    ['Paying it out', ['The election is made on time, for the full dividend.', 'The cost base part is paid out now, as a non-eligible dividend.', 'The family is taxed at the ' + R.rateYear + ' top Ontario rate.']],
    ['Left out', ['Premiums, and how they are paid.', 'Which kind of policy.', 'Policies tied to borrowing arrangements, and some older policies.', 'The estate as the first shareholder after the death.', 'Any tax the company may pay on the payout.', 'How the cost base changes over the years.', 'Holding the policy personally.',
      'Tax on the owner’s shares at death, and the payout’s effect on their value.', 'Probate; creditors’ claims on company assets.', 'The dividend refund and other company tax accounts.', 'Keeping the money in the company.', 'Family members outside Ontario or Canada.', 'Lower brackets.']],
  ].map(function (g) { return '<div class="cv-group"><h4 class="cv-h">' + g[0] + '</h4><ul>' + g[1].map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>'; }).join('');
  (function sources() {
    // one line per source page: two facts read from the same page (a rate for two years) share it
    var seen = {}, items = [];
    R.used.forEach(function (f) {
      var k = f.source_url + '|' + f.title;
      if (seen[k]) return;
      seen[k] = true;
      items.push('<li><a href="' + esc(f.source_url) + '">' + esc(f.title) + '</a> · as of ' + esc(longDate(f.as_of)) + '</li>');
    });
    var ver = 'Version ' + DATA.version + ' · rates for ' + R.rateYear + ' · made in this browser; nothing was sent.';
    $('sources').innerHTML = '<p>Every rate and rule on this page is read from these official sources (confirmed values only):</p><ul>' + items.join('') + '</ul>'
      + '<p>These rules were checked against the statutes and the government’s pages on ' + esc(longDate(DATA.asOf)) + '; reference data, verify at the source.</p>'
      + '<p>How it’s made: the calculation was written from scratch for this site, from the statute text, and runs in this browser. The owner, the company and the figures are made up: example assumptions, not facts, and not anyone’s situation. ' + esc(ver) + '</p>';
  })();

  // ---- Go deeper: the cost base from $0 to the payout, as a picture and a table (drawn when open) ----
  var deeper = $('deeper'), tsvg = $('trend');
  function drawTrend() {
    if (!deeper.open) return;
    clear(tsvg);
    var W = Math.max(280, Math.floor($('trend-fig').clientWidth)), pay = S.inp.payout;
    var top = 8, PH = W >= 640 ? 220 : 180, axisY = top + PH, H = axisY + 10 + VF + 6;
    var X = function (v) { return v / pay * W; }, Y = function (v) { return top + PH - v / pay * PH; };
    var lo = F.split(R, { payout: pay, acb: 0 }), hi = F.split(R, { payout: pay, acb: pay });
    var y0 = Y(lo.family), y1 = Y(hi.family);
    // what reaches the family (d1 tint) under the line; the income tax (d4 tint) between it and the payout
    el('path', { d: 'M0 ' + y0.toFixed(1) + 'L' + W + ' ' + y1.toFixed(1) + 'V' + axisY + 'H0Z', 'class': 'ar-fam' }, tsvg);
    el('path', { d: 'M0 ' + y0.toFixed(1) + 'L' + W + ' ' + y1.toFixed(1) + 'V' + top + 'Z', 'class': 'ar-tax' }, tsvg);
    el('line', { x1: 0, y1: y0.toFixed(1), x2: W, y2: y1.toFixed(1), 'class': 'ln-fam' }, tsvg);
    el('line', { x1: 0, y1: axisY, x2: W, y2: axisY, 'class': 'ln-axis' }, tsvg);
    var Pl = [], hit = function (b) { return Pl.some(function (o) { return b.x < o.x + o.w + 8 && o.x < b.x + b.w + 8 && b.y < o.y + o.h && o.y < b.y + b.h; }); };
    function label(x, y, parts, anchor, need) {
      var w = parts.reduce(function (s, p) { return s + measure(p[0], p[1] === 'rd-v' ? fVal : fSans); }, 0);
      var bx = { x: anchor === 'end' ? x - w : x, y: y - VF, w: w, h: VF + 6 };
      if (!need && hit(bx)) return;
      Pl.push(bx);
      var t = el('text', { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': anchor }, tsvg);
      parts.forEach(function (p) { el('tspan', { 'class': p[1] }, t, p[0]); });
    }
    // the current cost base: a rule down to the axis and a dot on the line, its reading beside the dot
    var xa = X(S.inp.acb), ya = Y(S.family), right = xa < W / 2;
    el('line', { x1: xa.toFixed(1), y1: ya.toFixed(1), x2: xa.toFixed(1), y2: axisY, 'class': 'ln-now' }, tsvg);
    el('circle', { cx: xa.toFixed(1), cy: ya.toFixed(1), r: 6, 'class': 'dot-now' }, tsvg);
    Pl.push({ x: xa - 8, y: ya - 8, w: 16, h: 16 });
    // under the line all along the reading (the line falls to the right, so a reading to the right sits lower)
    var nowW = measure(m(S.family), fVal) + measure(' now', fSans), slope = (y1 - y0) / W;
    label(right ? xa + 12 : xa - 12, ya + VF + 14 + (right ? Math.max(0, slope * (12 + nowW)) : 0), [[m(S.family), 'rd-v t-fam'], [' now', 'rd-w']], right ? 'start' : 'end', true);
    // the area names on the side away from the current cost base, then the line's right end where there is room
    label(right ? W - 4 : 4, axisY - 12, [['Reaches the family', 'rd-w']], right ? 'end' : 'start', false);
    label(W - 4, top + VF + 4, [['Income tax', 'rd-w']], 'end', false);
    label(W - 4, y1 + VF + 14, [[m(hi.family), 'rd-v t-fam']], 'end', false);
    // the cost base along the bottom
    label(0, axisY + 10 + VF, [[m(0), 'rd-v'], [' cost base', 'rd-w']], 'start', true);
    label(W, axisY + 10 + VF, [[m(pay), 'rd-v'], [' cost base', 'rd-w']], 'end', true);
    tsvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    tsvg.setAttribute('width', W); tsvg.setAttribute('height', H);
    $('trend-desc').textContent = 'As the cost base grows from $0 to the ' + m(pay) + ' payout, what reaches the family falls in a straight line from '
      + m(lo.family) + ' to ' + m(hi.family) + '. At the ' + m(S.inp.acb) + ' cost base now, ' + m(S.family) + ' reaches the family.';
    // the numbers behind it: three columns, so nothing is cut off on a phone
    var cols = ['Cost base', 'Income tax', 'Reaches the family'];
    $('nums-head').innerHTML = cols.map(function (c) { return '<th scope="col">' + c + '</th>'; }).join('');
    $('nums-rows').innerHTML = F.tableRows(R, pay, S.inp.acb).map(function (r) {
      var cells = [m(r.tax), m(r.family)];
      return '<tr' + (r.now ? ' class="now"' : '') + '><th scope="row">' + esc(m(r.acb)) + (r.now ? ' <span class="now-tag">now</span>' : '') + '</th><td>' + cells.map(esc).join('</td><td>') + '</td></tr>';
    }).join('');
    var wrap = $('nums-wrap'), cut = wrap.scrollWidth > wrap.clientWidth + 1;
    $('nums-cap').textContent = 'The cost base at 0, a quarter, half, three quarters and all of the ' + m(pay) + ' payout, and now.' + (cut ? ' Swipe the table for more →' : '');
  }
  deeper.addEventListener('toggle', drawTrend);

  // ---- one render for every change: the words at once, the picture on the next frame ----
  var queued = false, queuedEase = false;
  function render(ease, first) {
    S = F.split(R, st); st.acb = S.inp.acb;
    paintControl();
    paintWords(first === true);
    drawTrend();
    if (first) { build(); return; }
    queuedEase = queuedEase || !!ease;
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; var e = queuedEase; queuedEase = false; place(e); });
  }
  render(false, true);
  var lastW = pic.clientWidth;
  new ResizeObserver(function () { if (pic.clientWidth !== lastW) { lastW = pic.clientWidth; build(); drawTrend(); } }).observe(pic);
  addEventListener('resize', function () { build(); drawTrend(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { build(); drawTrend(); });
})();
