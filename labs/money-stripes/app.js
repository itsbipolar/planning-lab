// Money stripes. The data is embedded in the page (#data), computed at build time from dated snapshots of public
// series; nothing is fetched, stored or sent. Colours are made here from the values, by mixing in OKLab.
(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('data').textContent);
  var cpi = D.cpi, rate = D.rate;                   // [[year, value], ...]
  var byYearC = {}, byYearR = {}; cpi.forEach(function (r) { byYearC[r[0]] = r[1]; }); rate.forEach(function (r) { byYearR[r[0]] = r[1]; });

  // OKLab mixing between the house colours (plan/06): blue below zero, paper at zero, deep amber above.
  function hex2lab(h) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    var l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]), m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]), s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function lab2hex(L) {
    var l = Math.pow(L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], 3), m = Math.pow(L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], 3), s = Math.pow(L[0] - 0.0894841775 * L[1] - 1.291485548 * L[2], 3);
    var rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    return '#' + rgb.map(function (v) { v = Math.max(0, Math.min(1, v)); v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return ('0' + Math.round(v * 255).toString(16)).slice(-2); }).join('');
  }
  var BLUE = hex2lab('#1F689D'), PAPER = hex2lab('#FDFDFD'), AMBER = hex2lab('#AD720D');
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return a[i] + (b[i] - a[i]) * t; }); }
  // Presentational ranges: prices fell down to this many percent and rose up to this many; beyond them the colour stops.
  var INF_MIN = -10, INF_MAX = 12, RATE_MAX = 20;
  function infColour(v) { return lab2hex(v < 0 ? mix(PAPER, BLUE, Math.min(1, v / INF_MIN)) : mix(PAPER, AMBER, Math.min(1, v / INF_MAX))); }
  function rateColour(v) { return lab2hex(mix(PAPER, AMBER, Math.min(1, v / RATE_MAX))); }

  function fmt(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  var yearsC = cpi.map(function (r) { return r[0]; }), yearsR = rate.map(function (r) { return r[0]; });
  var slider = document.getElementById('year'), readout = document.getElementById('readout');
  var first = yearsC[0], last = yearsC[yearsC.length - 1];

  function build(containerId, decId, years, value, colour, label) {
    var el = document.getElementById(containerId), dec = document.getElementById(decId), frag = document.createDocumentFragment();
    years.forEach(function (y) { var d = document.createElement('div'); d.className = 'stripe'; d.dataset.year = y; d.style.background = colour(value(y)); d.title = y + ': ' + label(value(y)); frag.appendChild(d); });
    el.appendChild(frag);
    years.forEach(function (y, i) { if (y % 10 === 0) { var s = document.createElement('span'); s.textContent = y; s.style.left = ((i + 0.5) / years.length * 100) + '%'; dec.appendChild(s); } });
    el.addEventListener('click', function (e) { var t = e.target.closest('.stripe'); if (t) { slider.value = t.dataset.year; show(Number(t.dataset.year)); } });
  }
  function legend(id, grad, lo, hi, loText, hiText) {
    var el = document.getElementById(id);
    el.innerHTML = '<span>' + loText + '</span><span class="bar" style="background:linear-gradient(to right,' + grad + ')"></span><span>' + hiText + '</span>';
  }
  function gradient(fn, a, b, n) { var s = []; for (var i = 0; i <= n; i++) s.push(fn(a + (b - a) * i / n)); return s.join(','); }

  build('s-cpi', 'd-cpi', yearsC, function (y) { return byYearC[y]; }, infColour, function (v) { return 'prices rose by ' + fmt(v) + '%'; });
  build('s-rate', 'd-rate', yearsR, function (y) { return byYearR[y]; }, rateColour, function (v) { return 'prime rate averaged ' + fmt(v) + '%'; });
  legend('legend-cpi', gradient(infColour, INF_MIN, INF_MAX, 24), 0, 0, 'Prices fell, ' + INF_MIN + '% or more', 'Prices rose, ' + INF_MAX + '% or more');
  legend('legend-rate', gradient(rateColour, 0, RATE_MAX, 24), 0, 0, 'Prime rate low', 'Prime rate, ' + RATE_MAX + '% or more');
  document.getElementById('note-cpi').textContent = 'Each stripe is the change in the average consumer price index over one calendar year compared with the year before, ' + first + ' to ' + last + '. Years with a complete twelve months only.';
  document.getElementById('note-rate').textContent = 'Each stripe is the average of the weekly prime rate over one calendar year, ' + yearsR[0] + ' to ' + yearsR[yearsR.length - 1] + '.';

  function sentence(y) {
    var s = y + ': prices rose by ' + fmt(byYearC[y]) + '% over the year' + (byYearC[y] < 0 ? ' (they fell)' : '');
    if (byYearR[y] !== undefined) s += '; the prime rate averaged ' + fmt(byYearR[y]) + '%.'; else s += '. The prime rate series starts in ' + yearsR[0] + '.';
    return s.replace('rose by -', 'changed by -');
  }
  function show(y) {
    var t = sentence(y); readout.textContent = t; slider.setAttribute('aria-valuetext', t);
    document.querySelectorAll('.stripe.sel').forEach(function (e) { e.classList.remove('sel'); });
    document.querySelectorAll('.stripe[data-year="' + y + '"]').forEach(function (e) { e.classList.add('sel'); });
  }
  slider.min = first; slider.max = last; slider.value = last;
  slider.addEventListener('input', function () { show(Number(slider.value)); });
  show(last);

  var rows = document.getElementById('rows'), tf = document.createDocumentFragment();
  yearsC.forEach(function (y) { var tr = document.createElement('tr'); tr.innerHTML = '<th scope="row">' + y + '</th><td>' + fmt(byYearC[y]) + '%</td><td>' + (byYearR[y] !== undefined ? fmt(byYearR[y]) + '%' : 'not in this data') + '</td>'; tf.appendChild(tr); });
  rows.appendChild(tf);

  var m = D.meta, about = document.getElementById('about');
  about.innerHTML =
    '<p><strong>Prices.</strong> ' + m.cpi.attribution + ' Table <a href="' + m.cpi.source_url + '" rel="noopener">18-10-0004-01</a>, all-items, Canada; retrieved ' + m.cpi.retrieved + '. Used under the Statistics Canada Open Licence.</p>' +
    '<p><strong>Prime rate.</strong> ' + m.rate.attribution + ' Series <a href="https://www.bankofcanada.ca/valet/series/V80691311/json" rel="noopener">V80691311</a> (<a href="' + m.rate.terms_url + '" rel="noopener">terms</a>); retrieved ' + m.rate.retrieved + '. The Bank of Canada\'s older monthly prime series stops in 2019, so this build uses its current weekly series, which starts in 1975.</p>' +
    '<p><strong>The idea.</strong> Stripes with one colour for each year come from the #ShowYourStripes warming stripes by Professor Ed Hawkins, University of Reading (<a href="https://showyourstripes.info" rel="noopener">showyourstripes.info</a>, CC BY 4.0). This page uses the same visual idea for prices and has nothing to do with climate data. The colours: blue where prices fell, white at no change, deep amber where they rose faster.</p>' +
    '<p>These are past figures only: no projections and no advice.</p>';
})();
