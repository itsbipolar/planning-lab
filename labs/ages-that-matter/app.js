// The Ages That Matter page: three rule grids in the shared P5 colour scale, a picker and a readout for each, and tables.
// Every number comes from the model, which reads the confirmed facts. Nothing is stored or sent.
(() => {
  const M = JSON.parse(document.getElementById('data').textContent);
  const N = M.heatSteps;
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, text) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const pct = (x, d = 1) => `${Math.abs(x).toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
  const money = (x) => x.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
  const stepOf = (v, [a, b]) => Math.round((N - 1) * (v - a) / (b - a));
  const months = (k) => (k === 1 ? '1 month' : `${k} months`);
  const C = M.cpp, O = M.oas, R = M.rrif;

  $('lede').textContent = `Three of Canada's retirement rules, square by square. In the first two, each square is a month someone could start the pension, shaded by how much the pension changes against the standard start. The third shows the RRIF minimum at each age. Deep blue is less, pale green is more; every value comes from the verified facts file.`;
  $('cpp-rule').textContent = `The CPP retirement pension can start from ${C.lo} to ${C.hi}. Against starting at ${C.std}, it is ${pct(C.red)} less for each month earlier and ${pct(C.inc)} more for each month later: from ${pct(C.range[0], 0)} less at ${C.lo} to ${pct(C.range[1], 0)} more at ${C.hi}.`;
  $('oas-rule').textContent = `OAS starts at ${O.start}. Each month of waiting adds ${pct(O.inc)}, up to ${O.max}: ${pct(O.range[1], 0)} more for the full wait.`;
  $('rrif-rule').textContent = `An RRSP must mature by the end of the year its holder turns ${R.maturity}, often into a RRIF. From then on, a minimum share of the fund at the start of each year has to be paid out: ${pct(R.range[0] * 100, 2)} at ${R.rows[0].age}, rising to ${pct(R.range[1] * 100, 0)} at ${R.rows.at(-1).age} or older.`;

  // A grid of start months: rows are ages, columns months after the birthday.
  function monthGrid(id, P, picked, onPick) {
    const box = $(id); box.textContent = '';
    const W = Math.min(box.clientWidth || 360, 832), left = 34, gap = 3, cell = Math.max(16, Math.min(40, Math.floor((W - left) / 12) - gap)), st = cell + gap;
    const ages = [...new Set(P.cells.map((c) => c.age))], H = 18 + ages.length * st + 4;
    const svg = s('svg', { width: left + 12 * st, height: H, role: 'img', 'aria-label': `${id === 'cpp' ? 'CPP' : 'OAS'} start months as a grid; the values are in the readout and the table below.` });
    for (const c of P.cells) {
      const x = left + c.month * st, y = 18 + (c.age - ages[0]) * st;
      const r = s('rect', { class: `cell h${stepOf(c.pct, P.range)}`, x, y, width: cell, height: cell });
      r.addEventListener('click', () => onPick(c));
      svg.append(r);
      if (c.k === 0) svg.append(s('rect', { class: 'std', x: x - 2, y: y - 2, width: cell + 4, height: cell + 4 }));
      if (c === picked) svg.append(s('rect', { class: 'pick', x: x - 2.5, y: y - 2.5, width: cell + 5, height: cell + 5 }));
    }
    const lastAge = ages.at(-1);
    for (let m = 1; m < 12; m++) svg.append(s('rect', { class: 'none', x: left + m * st, y: 18 + (lastAge - ages[0]) * st, width: cell, height: cell }));
    ages.forEach((a, i) => svg.append(s('text', { class: 'lab', x: 0, y: 18 + i * st + cell / 2 + 5 }, String(a))));
    for (let m = 0; m < 12; m += cell < 26 ? 2 : 1) svg.append(s('text', { class: 'lab', x: left + m * st + cell / 2, y: 13, 'text-anchor': 'middle' }, `+${m}`));
    box.append(svg, el('p', { class: 'note' }, 'Columns: months after the birthday. Dashed outline: the standard start. Dark grey: no start that late.'));
    const key = el('div', { class: 'key' }), k = s('svg', { width: 120, height: 14, 'aria-hidden': 'true' });
    for (let i = 0; i < 10; i++) k.append(s('rect', { class: `cell h${Math.round((N - 1) * i / 9)}`, x: i * 12, y: 0, width: 10, height: 14 }));
    key.append(document.createTextNode(P.range[0] < 0 ? `${pct(P.range[0], 0)} less` : 'no change'), k, document.createTextNode(`${pct(P.range[1], 0)} more`));
    box.append(key);
  }

  // CPP
  let cppPick = C.cells.find((c) => c.k === 0);
  const cppText = (c) => {
    const when = `Starting at ${c.age}${c.month ? ` and ${months(c.month)}` : ''}`;
    if (c.k === 0) return `${when}: the standard start, no change.`;
    return c.k < 0 ? `${when}: ${months(-c.k)} early, ${pct(C.red)} a month, ${pct(c.pct)} less than at ${C.std}.` : `${when}: ${months(c.k)} late, ${pct(C.inc)} a month, ${pct(c.pct)} more than at ${C.std}.`;
  };
  const cppSet = (c) => { cppPick = c; monthGrid('cpp', C, c, cppSet); const t = cppText(c); $('cpp-read').textContent = t; $('cpp-pick').value = C.cells.indexOf(c); $('cpp-pick').setAttribute('aria-valuetext', t); };
  $('cpp-pick').min = 0; $('cpp-pick').max = C.cells.length - 1;
  $('cpp-pick').addEventListener('input', (e) => cppSet(C.cells[Number(e.target.value)]));

  // OAS
  let oasPick = O.cells.at(-1);
  const oasText = (c) => { const when = `Starting at ${c.age}${c.month ? ` and ${months(c.month)}` : ''}`; return c.k === 0 ? `${when}: no deferral, no increase.` : `${when}: ${months(c.k)} of deferral, ${pct(O.inc)} a month, ${pct(c.pct)} more.`; };
  const oasSet = (c) => { oasPick = c; monthGrid('oas', O, c, oasSet); const t = oasText(c); $('oas-read').textContent = t; $('oas-pick').value = O.cells.indexOf(c); $('oas-pick').setAttribute('aria-valuetext', t); };
  $('oas-pick').min = 0; $('oas-pick').max = O.cells.length - 1;
  $('oas-pick').addEventListener('input', (e) => oasSet(O.cells[Number(e.target.value)]));

  // RRIF: rows by decade, columns by the age's last digit, the value written in each square.
  let rrifPick = R.rows.find((r) => r.age % 10 === 0) ?? R.rows[0];
  function drawRrif() {
    const box = $('rrif'); box.textContent = '';
    const W = Math.min(box.clientWidth || 360, 832), left = 44, gap = 3, cell = Math.max(28, Math.min(64, Math.floor((W - left) / 10) - gap)), st = cell + gap;
    const decades = [...new Set(R.rows.map((r) => Math.floor(r.age / 10)))], H = 18 + decades.length * st + 4;
    const svg = s('svg', { width: left + 10 * st, height: H, role: 'img', 'aria-label': 'RRIF minimum by age as a grid; the values are in the readout and the table below.' });
    for (const r of R.rows) {
      const x = left + (r.age % 10) * st, y = 18 + (Math.floor(r.age / 10) - decades[0]) * st, k = stepOf(r.factor, R.range);
      const rect = s('rect', { class: `cell h${k}`, x, y, width: cell, height: cell });
      rect.addEventListener('click', () => rrifSet(r));
      svg.append(rect, s('text', { class: `v ${k >= N / 2 ? 'hi' : 'lo'}`, x: x + cell / 2, y: y + cell / 2 + 4, 'text-anchor': 'middle', style: cell < 40 ? 'font-size:10px' : '' }, (r.factor * 100).toFixed(1)));
      if (r === rrifPick) svg.append(s('rect', { class: 'pick', x: x - 2.5, y: y - 2.5, width: cell + 5, height: cell + 5 }));
    }
    decades.forEach((d, i) => svg.append(s('text', { class: 'lab', x: 0, y: 18 + i * st + cell / 2 + 5 }, `${d * 10}s`)));
    for (let c = 0; c < 10; c++) svg.append(s('text', { class: 'lab', x: left + c * st + cell / 2, y: 13, 'text-anchor': 'middle' }, String(c)));
    box.append(svg, el('p', { class: 'note' }, `Columns: the age's last digit. Values are percentages. The last square is ${R.rows.at(-1).age} or older.`));
  }
  const rrifText = (r) => `At ${r.age}${r === R.rows.at(-1) ? ' or older' : ''} (age at the start of the year): the minimum is ${pct(r.factor * 100, 2)} of the fund at the start of the year. On an example fund of ${money(R.fund)}, that is ${money(R.fund * r.factor)} for the year.`;
  const rrifSet = (r) => { rrifPick = r; drawRrif(); const t = rrifText(r); $('rrif-read').textContent = t; $('rrif-pick').value = R.rows.indexOf(r); $('rrif-pick').setAttribute('aria-valuetext', t); };
  $('rrif-pick').min = 0; $('rrif-pick').max = R.rows.length - 1;
  $('rrif-pick').addEventListener('input', (e) => rrifSet(R.rows[Number(e.target.value)]));

  // Tables
  function monthTable(P, cap, head, body, sign) {
    $(cap).textContent = `${cap.startsWith('cpp') ? 'CPP' : 'OAS'}: change against the standard start, by start age (rows) and months after the birthday (columns)`;
    const hr = el('tr'); hr.append(el('th', { scope: 'col' }, 'Age')); for (let m = 0; m < 12; m++) hr.append(el('th', { scope: 'col' }, `+${m}`)); $(head).append(hr);
    for (const a of [...new Set(P.cells.map((c) => c.age))]) { const tr = el('tr'); tr.append(el('th', { scope: 'row' }, String(a))); for (let m = 0; m < 12; m++) { const c = P.cells.find((x) => x.age === a && x.month === m); tr.append(el('td', {}, c ? `${c.pct > 0 ? '+' : c.pct < 0 ? '−' : ''}${pct(c.pct)}` : '')); } $(body).append(tr); }
    void sign;
  }
  monthTable(C, 'cpp-cap', 'cpp-head', 'cpp-body'); monthTable(O, 'oas-cap', 'oas-head', 'oas-body');
  $('rrif-cap').textContent = `RRIF minimum by age at the start of the year, with an example fund of ${money(R.fund)}`;
  for (const r of R.rows) { const tr = el('tr'); tr.append(el('td', {}, r === R.rows.at(-1) ? `${r.age} or older` : String(r.age)), el('td', {}, pct(r.factor * 100, 2)), el('td', {}, money(R.fund * r.factor))); $('rrif-body').append(tr); }

  // Sources
  const seen = new Set();
  for (const f of [...C.sources, ...O.sources, ...R.sources]) { if (seen.has(f.id)) continue; seen.add(f.id); const li = el('li'); li.append(el('a', { href: f.source_url }, f.title), document.createTextNode(`, read ${f.as_of}.`)); $('sources').append(li); }

  cppSet(cppPick); oasSet(oasPick); rrifSet(rrifPick);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { cppSet(cppPick); oasSet(oasPick); rrifSet(rrifPick); }, 150); });
})();
