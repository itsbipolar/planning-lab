// Money milestones in weeks. Every rule and figure comes from the facts file embedded in the page (#facts):
// nothing about the rules is written in this script. The birth year is used in memory only: it is not stored,
// not put in the address and not sent anywhere. There are no network requests after the page has loaded.
(function () {
  'use strict';
  var FACTS = JSON.parse(document.getElementById('facts').textContent).facts;
  var byId = {};
  FACTS.forEach(function (f) { if (f.status === 'confirmed') byId[f.id] = f; });
  var WEEKS = 52, ROWS = 95; // the shape of the grid: a year of weeks, to age ninety-five

  function val(id) { return byId[id] ? byId[id].value : null; }
  function have(ids) { return ids.every(function (id) { return val(id) !== null; }); }
  function n(id) { return Number(val(id)); }

  // The four milestones. A milestone with any missing fact is left out: nothing is ever filled in from memory.
  var MILESTONES = [
    { key: 'tfsa', name: 'Tax-Free Savings Account', ids: ['tfsa_minimum_age'],
      from: function () { return n('tfsa_minimum_age'); }, to: function () { return ROWS - 1; },
      text: function (b) { return 'TFSA contribution room starts in the calendar year you turn ' + n('tfsa_minimum_age') + ', if you live in Canada (' + (b + n('tfsa_minimum_age')) + ' for you).'; } },
    { key: 'cpp', name: 'Canada Pension Plan retirement pension', ids: ['cpp_earliest_start_age', 'cpp_standard_start_age', 'cpp_latest_start_age', 'cpp_early_start_reduction', 'cpp_late_start_increase'],
      from: function () { return n('cpp_earliest_start_age'); }, to: function () { return n('cpp_latest_start_age'); },
      text: function (b) { return 'The CPP retirement pension can start from age ' + n('cpp_earliest_start_age') + ' to age ' + n('cpp_latest_start_age') + ' (' + (b + n('cpp_earliest_start_age')) + ' to ' + (b + n('cpp_latest_start_age')) + ' for you); the standard age is ' + n('cpp_standard_start_age') + ', each month earlier reduces it by ' + val('cpp_early_start_reduction') + '% and each month later raises it by ' + val('cpp_late_start_increase') + '%.'; } },
    { key: 'oas', name: 'Old Age Security pension', ids: ['oas_start_age', 'oas_deferral_max_age', 'oas_deferral_increase'],
      from: function () { return n('oas_start_age'); }, to: function () { return n('oas_deferral_max_age'); },
      text: function (b) { return 'Old Age Security can start from age ' + n('oas_start_age') + ' (' + (b + n('oas_start_age')) + ' for you), subject to residence rules; each month you wait, up to age ' + n('oas_deferral_max_age') + ', raises it by ' + val('oas_deferral_increase') + '%.'; } },
    { key: 'rrsp', name: 'RRSP maturity', ids: ['rrsp_maturity_age'],
      from: function () { return n('rrsp_maturity_age'); }, to: function () { return n('rrsp_maturity_age'); },
      text: function (b) { return 'An RRSP must mature by the end of the year you turn ' + n('rrsp_maturity_age') + ' (' + (b + n('rrsp_maturity_age')) + ' for you).'; } }
  ].filter(function (m) { return have(m.ids); });

  var form = document.getElementById('form'), input = document.getElementById('year'), err = document.getElementById('error');
  var summary = document.getElementById('summary'), result = document.getElementById('result'), grid = document.getElementById('grid'), list = document.getElementById('list');
  var now = new Date(), thisYear = now.getFullYear();
  input.min = '1900'; input.max = String(thisYear);

  function weekOfYear(d) { var start = new Date(d.getFullYear(), 0, 1); return Math.min(WEEKS, Math.floor((d - start) / 604800000)); }

  function fail(msg) { err.textContent = msg; err.hidden = false; result.hidden = true; summary.textContent = ''; }

  function render(b) {
    err.hidden = true;
    var age = thisYear - b, passedRows = Math.min(ROWS, age), partial = age < ROWS ? weekOfYear(now) : 0;
    // rows where two or more milestones (other than the open-ended TFSA) land together
    var win = {};
    MILESTONES.forEach(function (m) { if (m.key !== 'tfsa') for (var r = m.from(); r <= m.to(); r++) win[r] = (win[r] || 0) + 1; });
    var rrsp = MILESTONES.filter(function (x) { return x.key === 'rrsp'; })[0], deadlineRow = rrsp ? rrsp.from() : -1;
    var frag = document.createDocumentFragment();
    for (var r = 0; r < ROWS; r++) {
      var lab = document.createElement('div'); lab.className = 'age'; lab.textContent = (r % 10 === 0 || r === ROWS - 1) ? String(r) : ''; frag.appendChild(lab);
      for (var w = 0; w < WEEKS; w++) {
        var c = document.createElement('div'); var lived = r < passedRows || (r === passedRows && w < partial);
        c.className = 'c' + (lived ? ' lived' : '') + (win[r] >= 2 ? ' win' : '') + (r === deadlineRow ? ' dl' : ''); frag.appendChild(c);
      }
    }
    grid.replaceChildren(frag);
    // draw each bar as one tall grid item in its own rail column
    var railStart = 1 + 1 + WEEKS + 1 + 1; // age column, 52 weeks, spacer, then rail columns (1-based)
    ['tfsa', 'cpp', 'oas', 'rrsp'].forEach(function (key, i) {
      var m = MILESTONES.filter(function (x) { return x.key === key; })[0]; if (!m) return;
      var bar = document.createElement('div'); bar.className = 'bar ' + key;
      bar.style.gridColumn = String(railStart + i); bar.style.gridRow = (m.from() + 1) + ' / ' + (m.to() + 2);
      grid.appendChild(bar);
    });
    // the milestones, as real text: the accessible version of the picture
    list.replaceChildren();
    MILESTONES.forEach(function (m) {
      var li = document.createElement('li'), h = document.createElement('h3'), p = document.createElement('p'), meta = document.createElement('p');
      var chip = document.createElement('span'); chip.className = 'chip ' + m.key; chip.setAttribute('aria-hidden', 'true');
      h.appendChild(chip); h.appendChild(document.createTextNode(m.name));
      p.textContent = m.text(b); meta.className = 'meta';
      var seen = {}, asOf = '', auth = {};
      m.ids.forEach(function (id) { var f = byId[id]; seen[f.source_url] = seen[f.source_url] || f.title; if (f.as_of > asOf) asOf = f.as_of; auth[f.authority] = true; });
      meta.appendChild(document.createTextNode('Source: '));
      Object.keys(seen).forEach(function (u, i) { if (i) meta.appendChild(document.createTextNode('; ')); var a = document.createElement('a'); a.href = u; a.textContent = seen[u]; a.rel = 'noopener'; meta.appendChild(a); });
      meta.appendChild(document.createTextNode('. Read on ' + asOf + '. Authority: ' + Object.keys(auth).map(function (k) { return k === 'statute' ? 'statute' : k === 'official_publication' ? 'official publication' : "CRA's position"; }).join(', ') + '.'));
      li.appendChild(h); li.appendChild(p); li.appendChild(meta); list.appendChild(li);
    });
    var cells = ROWS * WEEKS;
    summary.textContent = age > ROWS ? 'Born in ' + b + ': the grid shows the first ' + ROWS + ' years of age, ' + cells + ' weeks.' : 'Born in ' + b + ': ' + cells + ' weeks to age ' + ROWS + ', with the rules below placed on them.';
    result.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = input.value.trim(), b = Number(raw);
    if (!/^\d{4}$/.test(raw) || b < 1900 || b > thisYear) { fail('Enter a four-digit birth year from 1900 to ' + thisYear + '.'); return; }
    render(b);
  });
})();
