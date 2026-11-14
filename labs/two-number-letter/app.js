// When does waiting for CPP pay off? One start-age slider with a CPP | OAS switch, one answer and one chart; the Lena and
// Tom letter as the second view; the letter's charts and ten sliders in Go deeper. Every rule comes from the confirmed
// facts inlined at build (shared/facts.json) through calc.mjs; the couple and every amount are invented examples
// (story.json). Nothing is stored, sent or put in the address.
(() => {
  const facts = JSON.parse(document.getElementById('facts').textContent).facts;
  const story = JSON.parse(document.getElementById('story').textContent);
  const r = rules(facts);
  const byId = Object.fromEntries(facts.map((f) => [f.id, f]));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = (n) => '$' + Math.round(n).toLocaleString('en-CA');
  const pct = (x) => `${Number((Math.abs(x) * 100).toFixed(1))}%`;
  const plainPct = (id) => `${byId[id].value}%`;
  const ageText = (x) => {
    let y = Math.floor(x + 1e-9), m = Math.round((x - y) * 12);
    if (m === 12) { y += 1; m = 0; }
    return m ? `${y} and ${m} month${m === 1 ? '' : 's'}` : `${y}`;
  };
  const ageShort = (x) => {
    let y = Math.floor(x + 1e-9), m = Math.round((x - y) * 12);
    if (m === 12) { y += 1; m = 0; }
    return m ? `${y} y ${m} m` : `${y}`;
  };
  const std = r.cpp.standard;
  const people = story.people;
  const W = ['a', 'b'];
  const name = (w) => people[w].name;

  // Start ages in story.json are named by a rule (earliest, standard, latest) plus whole years.
  const startAge = (spec, lo, mid, hi) => Math.min(hi, Math.max(lo, ({ earliest: lo, standard: mid, latest: hi })[spec.from] + (spec.years || 0)));
  const state = { who: 'a' };
  for (const w of W) {
    const p = people[w];
    state[w] = {
      cppAge: startAge(p.cppAge, r.cpp.earliest, std, r.cpp.latest),
      oasAge: startAge(p.oasAge, r.oas.start, r.oas.start, r.oas.latest),
      cppAt65: p.cppAt65, oasAt65: p.oasAt65, other: p.other,
    };
  }
  const specFor = (w) => ({
    cppAt65: { ...story.ranges.cppAt65, pxPerStep: 4, format: money, label: `${name(w)}'s illustrative CPP at ${std}, per month`, short: `CPP at ${std}, per month` },
    cppAge: { min: r.cpp.earliest, max: r.cpp.latest, step: 1, pxPerStep: 24, format: String, label: `${name(w)}'s CPP start age`, short: 'CPP start age' },
    oasAt65: { ...story.ranges.oasAt65, pxPerStep: 4, format: money, label: `${name(w)}'s illustrative OAS at ${r.oas.start}, per month`, short: `OAS at ${r.oas.start}, per month` },
    oasAge: { min: r.oas.start, max: r.oas.latest, step: 1, pxPerStep: 24, format: String, label: `${name(w)}'s OAS start age`, short: 'OAS start age' },
    other: { ...story.ranges.other, pxPerStep: 3, format: money, label: `${name(w)}'s other income, per year`, short: 'Other income, per year' },
  });
  const spec = { a: specFor('a'), b: specFor('b') };
  const deeper = $('#deeper');

  $$('[data-name]').forEach((el) => { el.textContent = name(el.dataset.name); });
  $$('[data-pron]').forEach((el) => { const [w, k] = el.dataset.pron.split('.'); el.textContent = people[w][k]; });
  $$('[data-who]').forEach((b) => { b.textContent = name(b.dataset.who); });
  const fixed = {
    cppEarliest: r.cpp.earliest, cppLatest: r.cpp.latest, cppStandard: std,
    cppDown: plainPct('cpp_early_start_reduction'), cppUp: plainPct('cpp_late_start_increase'),
    oasStart: r.oas.start, oasLatest: r.oas.latest, oasUp: plainPct('oas_deferral_increase'),
    oasBoost: plainPct('oas_age75_increase'), oasBoostAge: r.oas.boostAge,
    thrYear: r.recovery.year, thrValue: money(r.recovery.threshold), recRate: plainPct('oas_recovery_rate'),
  };

  // Margin notes: each names its source, its tax year where it has one, and the date it was read.
  $$('.sn[data-fact]').forEach((el) => {
    const f = el.dataset.fact === 'oas_recovery_threshold' ? byId[r.recovery.id] : byId[el.dataset.fact];
    const host = new URL(f.source_url).hostname.replace(/^www\./, '');
    const year = f.tax_year ? `Tax year ${f.tax_year}. ` : '';
    el.insertAdjacentHTML('beforeend', ` ${year}Source: <a href="${f.source_url}">${host}</a>, read ${f.as_of}.`);
  });
  // The sources list: every rule the letter uses, with its official page.
  const src = $('#sources');
  for (const s of r.sources) {
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = s.source_url; a.textContent = s.title;
    li.append(a, document.createTextNode(`${s.tax_year ? `, tax year ${s.tax_year}` : ''}. ${s.authority ? s.authority + ', ' : ''}read ${s.as_of}.`));
    src.append(li);
  }
  const asOf = r.sources.map((s) => s.as_of).sort().pop();
  const month = new Date(`${asOf}T12:00:00`).toLocaleString('en-CA', { month: 'long', year: 'numeric' });
  $('#letter-date').textContent = month;
  $('#rules-asof').textContent = `rules as of ${month}`;

  // ---------- the tool: one start-age slider (whole months), a CPP | OAS switch, one answer and one chart ----------
  // The comparison is always against the standard CPP age or the first OAS age; the crossing ages do not depend on the
  // size of the pension, so the chart's amount a month (story.json tool.monthly) only puts dollars on its scale.
  const plans = {
    cpp: { key: 'cpp', name: 'CPP', long: 'Canada Pension Plan', lo: r.cpp.earliest, hi: r.cpp.latest, base: std,
      factor: (s) => cppFactor(r, s), cross: (s) => cppCrossing(r, s), total: (s, x, amt) => cppTotal(s, amt * cppFactor(r, s), x) },
    oas: { key: 'oas', name: 'OAS', long: 'Old Age Security', lo: r.oas.start, hi: r.oas.latest, base: r.oas.start,
      factor: (s) => oasFactor(r, s), cross: (s) => oasCrossing(r, s), total: (s, x, amt) => oasTotal(r, s, amt * oasFactor(r, s), x) },
  };
  const AMT = story.tool.monthly;
  const tool = { plan: 'cpp', m: 12 * startAge(story.tool.startsAt, r.cpp.earliest, std, r.cpp.latest) };
  const range = $('#start'), bubble = $('#bubble'), ticks = $('#ticks');
  const answer = deskReadout('#answer', { format: (n) => `Age ${Math.round(n)}` });
  const P = () => plans[tool.plan];
  const signed = (x) => (x > 0 ? '+' : '−') + pct(x);

  function setPlan(key) {
    tool.plan = key;
    const p = P();
    tool.m = Math.min(p.hi * 12, Math.max(p.lo * 12, tool.m)); // the thumb is clamped to the new range
    range.min = p.lo * 12; range.max = p.hi * 12; range.value = tool.m;
    range.setAttribute('aria-label', `${p.name} start age`);
    $$('[data-plan]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.plan === key)));
    ticks.textContent = '';
    for (let y = p.lo; y <= p.hi; y++) {
      const t = document.createElement('span');
      t.textContent = y; if (y === p.base) t.className = 'base';
      t.style.setProperty('--at', (y - p.lo) / (p.hi - p.lo));
      ticks.append(t);
    }
    drawTool();
  }

  function thumb() {
    const p = P(), span = (p.hi - p.lo) * 12, at = (tool.m - p.lo * 12) / span, b = (p.base - p.lo) * 12 / span;
    const box = $('#start-box');
    box.style.setProperty('--at', at);
    box.style.setProperty('--wa', Math.min(at, b)); box.style.setProperty('--wb', Math.max(at, b));
    const [yrs, rest] = ageText(tool.m / 12).split(/ (?=and )/);
    bubble.textContent = '';
    const big = document.createElement('b'); big.textContent = yrs; bubble.append(big);
    if (rest) { const sm = document.createElement('span'); sm.textContent = ' ' + rest; bubble.append(sm); }
    range.setAttribute('aria-valuetext', `${p.name} from ${ageText(tool.m / 12)}`);
  }

  // the answer, in plain words, for the start on the slider against the standard (CPP) or first (OAS) age
  function toolText() {
    const p = P(), s = tool.m / 12, c = p.cross(s), f = p.factor(s) - 1, S = ageText(s), gap = ageText(Math.abs(s - p.base));
    const steps = p.key === 'cpp'
      ? `Each month before ${std} takes ${plainPct('cpp_early_start_reduction')} off every cheque, for life; each month after it adds ${plainPct('cpp_late_start_increase')}.`
      : `Each month OAS is put off after ${r.oas.start} adds ${plainPct('oas_deferral_increase')} to every cheque, for life. From age ${r.oas.boostAge} every cheque rises a further ${plainPct('oas_age75_increase')}, whatever the start, and both totals count it.`;
    if (c === null) return {
      label: p.key === 'cpp' ? 'The standard CPP start' : 'The earliest OAS start',
      text: p.key === 'cpp' ? 'No change' : 'No wait',
      line: p.key === 'cpp' ? `Slide either way to compare another start with ${p.base}.` : 'Slide right to see when a later start catches up.',
      title: `${p.name} from ${p.base}: the total received by each age`,
      card: `${p.name} from ${p.base}, the ${p.key === 'cpp' ? 'standard' : 'earliest'} start.`,
      how: `${steps} A start at ${p.base} is the one every other start is compared with here.`,
    };
    const later = s > p.base, at = Math.round(c);
    return {
      label: later ? 'Waiting catches up at about' : 'Starting early leads until about',
      n: c,
      line: later ? 'From then on, the later start stays ahead in total.' : `After that, the start at ${p.base} is ahead in total.`,
      pct: signed(f), pctLine: `each cheque, for life, against a start at ${p.base}`,
      title: later ? `Starting at ${S}, not ${p.base}, pays more in total past about age ${at}`
        : `Starting at ${S} instead of ${p.base} stays ahead in total until about age ${at}`,
      card: later ? `Starting at ${S}, not ${p.base}, pays more in total past about age ${at}.`
        : `Starting at ${S} instead of ${p.base} stays ahead in total until about age ${at}.`,
      how: `${steps} So a start at ${S} pays ${pct(f)} ${later ? 'more' : 'less'} each month than one at ${p.base}. Counting only the dollars received, the totals cross at ${ageText(c)}: `
        + (later ? `by then the bigger cheques have made up for the ${gap} without one.` : `by then the ${gap} of extra cheques have been outrun by the bigger ones from ${p.base}.`)
        + ' The size of the pension does not change that age.',
    };
  }

  function drawTool() {
    const p = P(), t = toolText();
    thumb();
    if (t.n != null) answer.set({ n: t.n, label: t.label, line: t.line });
    else answer.set({ text: t.text, label: t.label, line: t.line });
    $('#answer-sub').hidden = t.pct == null;
    $('#answer-pct').textContent = t.pct || ''; $('#answer-pct-t').textContent = t.pctLine || '';
    $('#how').textContent = t.how;
    $('#main-h').textContent = t.title;
    $('#main-sub').textContent = `Total ${p.long} received by each age, for every ${money(AMT)} a month it pays from ${p.base}, in today’s dollars`
      + (p.key === 'oas' ? `; every start gets the ${plainPct('oas_age75_increase')} rise from age ${r.oas.boostAge}.` : '.');
    mainChart();
  }

  range.addEventListener('input', () => { tool.m = Number(range.value); drawTool(); });
  $$('[data-plan]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.plan !== tool.plan) setPlan(b.dataset.plan); }));

  // Save my card: this answer as a 1080x1350 PNG drawn in this browser (deskCard), shared or downloaded; nothing is sent
  deskSaveButton($('#save'), () => {
    const p = P(), t = toolText(), s = tool.m / 12, cs = getComputedStyle(document.documentElement);
    return deskCard({
      question: `When does waiting for ${p.name} pay off?`,
      bigValue: $('#answer-v').textContent, line: t.card,
      labels: [`${p.name} from ${ageText(s)}`, `Against ${p.base}`, 'Before tax'],
      draw: (ctx, box, C) => {
        const from = p.lo, to = story.chart.toAge, starts = s === p.base ? [p.base] : [p.base, s];
        const top = Math.max(...starts.map((a) => p.total(a, to, AMT)));
        const X = (a) => box.x + (a - from) / (to - from) * box.w, Y = (v) => box.y + box.h - v / top * box.h;
        ctx.fillStyle = C.ink; ctx.fillRect(box.x, box.y + box.h, box.w, 2);
        for (const a of starts) {
          ctx.strokeStyle = a === s ? C.point : cs.getPropertyValue('--t-d1').trim(); ctx.lineWidth = a === s ? 9 : 5;
          ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X(a), Y(0));
          for (let x = a; x <= to + 1e-9; x += 0.25) ctx.lineTo(X(x), Y(p.total(a, x, AMT)));
          ctx.stroke();
        }
        const c = p.cross(s);
        if (c !== null && c <= to) { ctx.fillStyle = C.ground; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X(c), Y(p.total(p.base, c, AMT)), 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      },
    }).then((blob) => ({ blob, name: 'when-to-start-cpp-my-card.png', title: `When does waiting for ${p.name} pay off?` }));
  });

  // the second view: the Lena and Tom letter, opened in place
  const openLetter = $('#open-letter'), letterView = $('#letter-view');
  openLetter.addEventListener('click', () => {
    const open = letterView.hidden;
    letterView.hidden = !open; openLetter.setAttribute('aria-expanded', String(open));
  });

  // The plain sliders: the single-pointer alternative to dragging, and the same numbers.
  const controls = { a: {}, b: {} };
  const sliders = $('#sliders');
  for (const w of W) {
    sliders.insertAdjacentHTML('beforeend', `<fieldset class="who-set" id="set-${w}"><legend>${name(w)}</legend></fieldset>`);
    const set = $(`#set-${w}`);
    for (const [key, s] of Object.entries(spec[w])) {
      const id = `s-${w}-${key}`;
      set.insertAdjacentHTML('beforeend', `<div class="slider"><label for="${id}">${s.short}: <output id="${id}-o"></output></label><div class="row"><button type="button" class="step" data-dir="-1" aria-label="Less: ${s.label}">−</button><input type="range" id="${id}" min="${s.min}" max="${s.max}" step="${s.step}" value="${state[w][key]}" aria-label="${s.label}"><button type="button" class="step" data-dir="1" aria-label="More: ${s.label}">+</button></div></div>`);
      const input = $(`#${id}`);
      input.parentElement.querySelectorAll('.step').forEach((b) => b.addEventListener('click', () => {
        change(w, key, Math.min(s.max, Math.max(s.min, state[w][key] + Number(b.dataset.dir) * s.step)));
      }));
      input.addEventListener('input', () => change(w, key, Number(input.value)));
      controls[w][key] = { input, out: $(`#${id}-o`), drags: [] };
    }
  }
  $$('[data-drag]').forEach((el) => {
    const [w, key] = el.dataset.drag.split('.');
    controls[w][key].drags.push(dragNumber(el, { ...spec[w][key], value: state[w][key], onChange: (v) => change(w, key, v) }));
  });
  $$('[data-who]').forEach((b) => b.addEventListener('click', () => { state.who = b.dataset.who; render(); }));

  // The charts follow the person whose number was moved last.
  let said;
  function change(w, key, v) {
    state[w][key] = v; state.who = w; render();
    clearTimeout(said);
    said = setTimeout(() => { $('#status').textContent = statusText(w, key); }, 450);
  }

  function cppCross(w, s) {
    const age = state[w].cppAge, n = name(w);
    if (s.cppCrossing === null) return `${n}'s start at ${std} is the standard, so there is nothing to compare; a start at ${r.cpp.latest} would catch up with it at about age ${ageText(cppCrossing(r, r.cpp.latest))}.`;
    if (age > std) return `${n}'s start at ${age} catches up with a start at ${std} at about age ${ageText(s.cppCrossing)}; after that, the later start is ahead.`;
    return `${n}'s start at ${age} stays ahead of a start at ${std} until about age ${ageText(s.cppCrossing)}; after that, ${std} is ahead.`;
  }

  function recWhy(w, s) {
    const her = people[w].possessive;
    if (s.recovery <= 0) return `That is below the threshold, so none of ${her} OAS would be recovered.`;
    if (s.recoveryCapped) return `That is ${money(s.overThreshold)} above the threshold, enough for the recovery tax to take back all of ${her} OAS, about ${money(s.recovery)} that year.`;
    return `That is ${money(s.overThreshold)} above the threshold, so about ${money(s.recovery)} of ${her} OAS would be recovered that year.`;
  }

  function statusText(w, key) {
    const s = spouse(r, state[w]), n = name(w);
    if (key === 'cppAge' || key === 'cppAt65') return `${n}: CPP from ${state[w].cppAge}, about ${money(s.cppMonthly)} a month.`;
    if (key === 'oasAge' || key === 'oasAt65') return `${n}: OAS from ${state[w].oasAge}, about ${money(s.oasMonthly)} a month.`;
    return `${n}: net income about ${money(s.net)}; OAS recovered about ${money(s.recovery)} a year.`;
  }

  function render() {
    const out = couple(r, state.a, state.b);
    for (const w of W) for (const [key, c] of Object.entries(controls[w])) {
      c.input.value = state[w][key];
      c.out.textContent = spec[w][key].format(state[w][key]);
      c.drags.forEach((d) => d.set(state[w][key]));
    }
    const text = { ...fixed, 'who.name': name(state.who) };
    for (const w of W) {
      const s = out[w], st = state[w];
      text[`${w}.cppMonthly`] = money(s.cppMonthly);
      text[`${w}.cppWhy`] = st.cppAge < std ? `That is ${pct(s.cppChange)} less than at ${std}, for life.`
        : st.cppAge > std ? `That is ${pct(s.cppChange)} more than at ${std}, for life.`
          : 'That is the standard start, with no reduction and no increase.';
      text[`${w}.cppCross`] = cppCross(w, s);
      text[`${w}.oasMonthly`] = money(s.oasMonthly);
      text[`${w}.oasWhy`] = st.oasAge === r.oas.start ? '' : `, ${pct(s.oasChange)} more than at ${r.oas.start}`;
      text[`${w}.net`] = money(s.net);
      text[`${w}.recWhy`] = recWhy(w, s);
    }
    const later = W.filter((w) => out[w].oasCrossing !== null);
    text.oasCross = later.length
      ? later.map((w) => `Counting the rise at ${r.oas.boostAge}, ${name(w)}'s later start catches up with a start at ${r.oas.start} at about age ${ageText(out[w].oasCrossing)}.`).join(' ')
      : `Counting the rise at ${r.oas.boostAge}, a start at ${r.oas.latest} would catch up with one at ${r.oas.start} at about age ${ageText(oasCrossing(r, r.oas.latest))}.`;
    $$('[data-out]').forEach((el) => { el.textContent = text[el.dataset.out]; });
    $$('[data-who]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.who === state.who)));
    readouts(state.who, out[state.who]);
    if (deeper.open) charts();
  }

  // The readings beside the charts, for the person they show: both crossing ages and the OAS recovered.
  function readouts(w, s) {
    const n = name(w), st = state[w];
    if (s.cppCrossing === null) {
      $('#rd-cpp-k').textContent = 'CPP: the standard start';
      age($('#rd-cpp-v'), null);
      $('#rd-cpp-t').textContent = `${n} starts at the standard age, ${std}: about ${money(s.cppMonthly)} a month.`;
    } else {
      $('#rd-cpp-k').textContent = st.cppAge > std ? 'CPP: waiting catches up at' : 'CPP: starting early leads until';
      age($('#rd-cpp-v'), s.cppCrossing);
      $('#rd-cpp-t').textContent = st.cppAge > std
        ? `${n}'s start at ${st.cppAge}, about ${money(s.cppMonthly)} a month, against one at ${std}.`
        : `${n}'s start at ${st.cppAge}, about ${money(s.cppMonthly)} a month, against one at ${std}.`;
    }
    if (s.oasCrossing === null) {
      $('#rd-oas-k').textContent = 'OAS: the earliest start';
      age($('#rd-oas-v'), null);
      $('#rd-oas-t').textContent = `${n} starts at ${r.oas.start}, the earliest age: about ${money(s.oasMonthly)} a month.`;
    } else {
      $('#rd-oas-k').textContent = 'OAS: waiting catches up at';
      age($('#rd-oas-v'), s.oasCrossing);
      $('#rd-oas-t').textContent = `${n}'s start at ${st.oasAge}, about ${money(s.oasMonthly)} a month, against one at ${r.oas.start}.`;
    }
    $('#rd-rec-k').textContent = `OAS taken back from ${n} in ${r.recovery.year}`;
    $('#rd-rec-v').textContent = `${money(Math.max(0, s.recovery))} a year`;
    const her = people[w].possessive, Her = her[0].toUpperCase() + her.slice(1);
    $('#rd-rec-t').textContent = s.recovery <= 0
      ? `${Her} example net income of about ${money(s.net)} is below the threshold.`
      : `${Her} example net income of about ${money(s.net)} is ${money(s.overThreshold)} above the threshold${s.recoveryCapped ? `, so all of ${her} OAS goes back` : ''}.`;
  }
  // a crossing age as a big whole number of years, with the months set small beside it; or "No crossing"
  function age(el, x) {
    el.textContent = '';
    if (x === null) { el.textContent = 'No crossing'; return; }
    const [yrs, rest] = ageText(x).split(/ (?=and )/);
    el.append(yrs);
    if (rest) { const m = document.createElement('span'); m.className = 'readout-unit'; m.textContent = ' ' + rest; el.append(m); }
  }

  // ---------- the two charts ----------
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const shortMoney = (v) => (v === 0 ? '$0' : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}k`);
  const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  function charts() {
    const w = state.who, st = state[w], n = name(w);
    const cppAmt = (s) => st.cppAt65 * cppFactor(r, s);
    const oasAmt = (s) => st.oasAt65 * oasFactor(r, s);
    // each chart's title states its takeaway in plain words: the crossing it draws, to the nearest year
    const title = (chosen, base, late, cross) => chosen > base ? `Waiting to ${chosen} catches up with ${base} at about age ${Math.round(cross(chosen))}`
      : chosen < base ? `Starting at ${chosen} leads ${base} until about age ${Math.round(cross(chosen))}`
        : `A start at ${late} would catch up with ${base} at about age ${Math.round(cross(late))}`;
    $('#cpp-h').textContent = title(st.cppAge, std, r.cpp.latest, (a) => cppCrossing(r, a));
    $('#oas-h').textContent = title(st.oasAge, r.oas.start, r.oas.latest, (a) => oasCrossing(r, a));
    panel($('#plot-cpp'), {
      what: 'CPP', name: n, base: std, late: r.cpp.latest, chosen: st.cppAge,
      total: (s, x) => cppTotal(s, cppAmt(s), x), cross: (s) => cppCrossing(r, s),
    });
    panel($('#plot-oas'), {
      what: 'OAS', name: n, base: r.oas.start, late: r.oas.latest, chosen: st.oasAge,
      total: (s, x) => oasTotal(r, s, oasAmt(s), x), cross: (s) => oasCrossing(r, s),
    });
  }

  function panel(holder, o) {
    if (holder.unhair) holder.unhair();
    holder.textContent = '';
    const from = r.cpp.earliest, to = story.chart.toAge;
    // drawn at the container's own width (one SVG unit is one CSS pixel), so every word renders at the size the CSS
    // gives it (17px, never under 16.5px); the right margin is as wide as the longest line label measured in that face
    const Wd = Math.max(280, Math.floor(holder.getBoundingClientRect().width || 320)), narrow = Wd < 520;
    const H = narrow ? 300 : 360;
    const starts = [...new Set([o.base, o.late, o.chosen])].sort((x, y) => x - y);
    const svg = el('svg', { viewBox: `0 0 ${Wd} ${H}`, width: Wd, height: H, role: 'img' }, holder);
    const lineLabel = (s) => (s === o.chosen ? `${o.name} · ${s}` : `start ${s}`);
    const labW = Math.max(...starts.map((s) => { const t = el('text', { class: 'lab lab-base', x: 0, y: 0 }, svg, lineLabel(s)); const w = t.getBBox().width; t.remove(); return w; }));
    const pad = { l: 14, r: Math.ceil(labW) + 12, t: 28, b: 34 };
    const top = Math.max(...starts.map((s) => o.total(s, to)), 1);
    // the tightest round scale with two to four steps
    const step = [1e3, 2e3, 5e3, 1e4, 2e4, 25e3, 5e4, 1e5, 2e5, 25e4, 5e5, 1e6]
      .filter((s) => Math.ceil(top / s) <= 4 && Math.ceil(top / s) >= 2)
      .sort((p, q) => Math.ceil(top / p) * p - Math.ceil(top / q) * q || p - q)[0] || 1e6;
    const maxY = Math.max(step, Math.ceil(top / step) * step);
    const X = (a) => pad.l + ((a - from) / (to - from)) * (Wd - pad.l - pad.r);
    const Y = (v) => H - pad.b - (v / maxY) * (H - pad.t - pad.b);
    const c1 = o.cross(o.late);
    const c2 = starts.length === 3 ? o.cross(o.chosen) : null;
    const summary = `${o.what} received by each age with ${o.name}'s example amounts: totals for starts at ${o.base} and ${o.late} cross at about age ${ageText(c1)}`
      + (c2 !== null ? `; ${o.name}'s start at ${o.chosen} crosses a start at ${o.base} at about age ${ageText(c2)}.` : `; ${o.name} starts at ${o.chosen}.`);
    svg.setAttribute('aria-label', summary);
    const placed = [];
    const keep = (t) => { placed.push(t.getBBox()); return t; };

    // grid and axes
    for (let v = 0; v <= maxY + 1e-6; v += step) {
      el('line', { class: v === 0 ? 'zero' : 'grid', x1: pad.l, x2: Wd - pad.r, y1: Y(v), y2: Y(v) }, svg);
      // the dollar scale sits just above each grid line, inside the plot; the zero is left out when a line starts under it
      if (v === 0 && starts[0] === from) continue;
      keep(el('text', { class: 'tick', x: pad.l, y: Y(v) - 6 }, svg, shortMoney(v)));
    }
    // age ticks every five years, or every ten when five would crowd the words at this width
    const every = (X(from + 5) - X(from)) < 34 ? 5 * 2 : 5;
    for (let a = Math.ceil(from / every) * every; a <= to; a += every) {
      el('line', { class: 'axis-line', x1: X(a), x2: X(a), y1: H - pad.b, y2: H - pad.b + 4 }, svg);
      keep(el('text', { class: 'tick', x: X(a), y: H - pad.b + 21, 'text-anchor': 'middle' }, svg, String(a)));
    }
    keep(el('text', { class: 'tick', x: Wd - pad.r + 14, y: H - pad.b + 21 }, svg, 'age'));

    // the lines: the standard (or earliest) start, the latest start, and the letter's start in amber, drawn last
    const cls = (s) => (s === o.chosen ? 'pick' : s === o.base ? 'base' : 'late');
    const order = [...starts].sort((x, y) => (x === o.chosen) - (y === o.chosen));
    const pts = []; // every line, sampled finely, so a reading can be kept off the lines as well as off other words
    for (const s of order) {
      let d = `M${X(s).toFixed(1)} ${Y(0).toFixed(1)}`, px = X(s), py = Y(0);
      for (let x = s; x <= to + 1e-9; x += 0.25) {
        const nx = X(x), ny = Y(o.total(s, x));
        d += ` L${nx.toFixed(1)} ${ny.toFixed(1)}`;
        for (let k = 1; k <= 6; k++) pts.push([px + (nx - px) * k / 6, py + (ny - py) * k / 6]);
        px = nx; py = ny;
      }
      el('path', { class: `ln ln-${cls(s)} ${s === o.chosen ? 's-named' : 's-context'}`, d }, svg);
    }
    el('circle', { class: 'start-pick', cx: X(o.chosen), cy: Y(0), r: 5 }, svg);
    placed.push({ x: X(o.chosen) - 6, y: Y(0) - 6, width: 12, height: 12 });
    const onLine = (b) => pts.some(([px, py]) => px > b.x - 3 && px < b.x + b.width + 3 && py > b.y - 3 && py < b.y + b.height + 3);
    const gridYs = []; for (let v = step; v <= maxY + 1e-6; v += step) gridYs.push(Y(v));
    const onGrid = (b) => gridYs.some((g) => g > b.y - 1 && g < b.y + b.height + 1);

    // labels at the right-hand end of each line, kept apart
    // spaced by the label's real box in the face the page draws (measured here), with a pixel of air between boxes;
    // each baseline sits so the box is centred on its line's end
    const probe = el('text', { class: 'lab lab-base', x: 0, y: 0 }, svg, 'Hg'), pb = probe.getBBox(); probe.remove();
    const pitch = pb.height + 1, mid = (-pb.y - (pb.height + pb.y)) / 2;
    const ends = starts.map((s) => ({ s, y: Y(o.total(s, to)) + mid })).sort((p, q) => p.y - q.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < pitch) ends[i].y = ends[i - 1].y + pitch;
    const over = ends.length ? ends[ends.length - 1].y - (H - pad.b - mid) : 0;
    if (over > 0) ends.forEach((e) => { e.y -= over; });
    for (const e of ends) {
      keep(el('text', { class: `lab lab-${cls(e.s)}`, x: Wd - pad.r + 7, y: e.y }, svg, lineLabel(e.s)));
    }

    // the crossing points, with their ages written beside them
    const crossings = [{ at: c1, pick: o.chosen === o.late, pair: [o.base, o.late] }];
    if (c2 !== null) crossings.push({ at: c2, pick: true, pair: [Math.min(o.chosen, o.base), Math.max(o.chosen, o.base)] });
    for (const c of crossings) {
      if (c.at === null || c.at > to) continue;
      const cx = X(c.at), cy = Y(o.total(o.base, c.at));
      el('circle', { class: c.pick ? 'dot dot-pick' : 'dot', cx, cy, r: 5 }, svg);
      placed.push({ x: cx - 6, y: cy - 6, width: 12, height: 12 });
      const t = el('text', { class: 'reading annot' }, svg, narrow ? `cross ${ageShort(c.at)}` : `${c.pair[0]} and ${c.pair[1]} cross at ${ageShort(c.at)}`);
      // above-left (clear of the lines, which climb to the right), then below-right, then further out; the first spot
      // that touches no line, no dot and no word wins, or else the one that touches least
      const tries = [[-8, -9, 'end'], [-14, -22, 'end'], [9, 20, 'start'], [14, 32, 'start'], [-9, 4, 'end'], [9, 4, 'start'],
        [0, -14, 'middle'], [0, 22, 'middle'], [-24, -36, 'end'], [20, 46, 'start'], [0, -30, 'middle'], [0, 40, 'middle'], [0, -48, 'middle']];
      let best = null;
      for (const [dx, dy, anchor] of tries) {
        t.setAttribute('x', cx + dx); t.setAttribute('y', cy + dy); t.setAttribute('text-anchor', anchor);
        const b = t.getBBox();
        const cost = (b.x >= 2 && b.x + b.width <= Wd - 2 && b.y >= 0 && b.y + b.height <= H - pad.b ? 0 : 4)
          + (placed.some((p) => overlaps(p, b)) ? 2 : 0) + (onLine(b) ? 1 : 0) + (onGrid(b) ? 0.5 : 0);
        if (!best || cost < best.cost) best = { cost, dx, dy, anchor };
        if (cost === 0) break;
      }
      t.setAttribute('x', cx + best.dx); t.setAttribute('y', cy + best.dy); t.setAttribute('text-anchor', best.anchor);
      placed.push(t.getBBox());
    }

    // the reading under the pointer: the age and each line's total at that age, the largest first
    holder.unhair = deskCrosshair(svg, { x0: X(from), x1: X(to), y0: pad.t, y1: H - pad.b, read: (px) => {
      const a = Math.round(from + ((px - pad.l) / (Wd - pad.l - pad.r)) * (to - from));
      const rows = starts.map((s) => ({ s, v: o.total(s, a) })).sort((p, q) => q.v - p.v);
      return { x: X(a), y: Y(rows[0].v), lines: [`At age ${a}`, ...rows.map((q) => `${q.s === o.chosen ? `${o.name} · ${q.s}` : `start ${q.s}`}: ${money(q.v)}`)] };
    } });
  }


  // ---------- the tool's one chart: total received by each age, for the start on the slider and the comparison ----------
  function mainChart() {
    const holder = $('#plot-main'), p = P(), s = tool.m / 12, base = p.base;
    if (holder.unhair) holder.unhair();
    holder.textContent = '';
    const from = p.lo, to = story.chart.toAge;
    // drawn at the container's own width (one SVG unit is one CSS pixel), so every word renders at its CSS size
    const Wd = Math.max(280, Math.floor(holder.getBoundingClientRect().width || 320)), narrow = Wd < 520, H = narrow ? 320 : 400;
    const starts = s === base ? [base] : [base, s].sort((x, y) => x - y);
    const total = (a, x) => p.total(a, x, AMT);
    const svg = el('svg', { viewBox: `0 0 ${Wd} ${H}`, width: Wd, height: H, role: 'img' }, holder);
    const lineLabel = (a) => `start ${ageShort(a)}`;
    const labW = Math.max(...starts.map((a) => { const t = el('text', { class: 'lab lab-base', x: 0, y: 0 }, svg, lineLabel(a)); const w = t.getBBox().width; t.remove(); return w; }));
    const pad = { l: 14, r: Math.ceil(labW) + 12, t: 28, b: 36 };
    const top = Math.max(...starts.map((a) => total(a, to)), 1);
    const step = [1e4, 2e4, 25e3, 5e4, 1e5, 2e5, 25e4, 5e5, 1e6]
      .filter((v) => Math.ceil(top / v) <= 4 && Math.ceil(top / v) >= 2)
      .sort((x, y) => Math.ceil(top / x) * x - Math.ceil(top / y) * y || x - y)[0] || 1e6;
    const maxY = Math.max(step, Math.ceil(top / step) * step);
    const X = (a) => pad.l + ((a - from) / (to - from)) * (Wd - pad.l - pad.r);
    const Y = (v) => H - pad.b - (v / maxY) * (H - pad.t - pad.b);
    const c = p.cross(s);
    svg.setAttribute('aria-label', `${p.name} received by each age for every ${money(AMT)} a month from ${base}: ` + (c === null
      ? `one start at ${base}.` : `starts at ${base} and ${ageText(s)} cross at about age ${ageText(c)}.`));
    const placed = [], keep = (t) => { placed.push(t.getBBox()); return t; };

    for (let v = 0; v <= maxY + 1e-6; v += step) {
      el('line', { class: v === 0 ? 'zero' : 'grid', x1: pad.l, x2: Wd - pad.r, y1: Y(v), y2: Y(v) }, svg);
      if (v === 0) continue;
      keep(el('text', { class: 'tick', x: pad.l, y: Y(v) - 6 }, svg, shortMoney(v)));
    }
    const every = (X(from + 5) - X(from)) < 40 ? 5 * 2 : 5;
    for (let a = Math.ceil(from / every) * every; a <= to; a += every) {
      el('line', { class: 'axis-line', x1: X(a), x2: X(a), y1: H - pad.b, y2: H - pad.b + 4 }, svg);
      keep(el('text', { class: 'tick', x: X(a), y: H - pad.b + 22, 'text-anchor': 'middle' }, svg, String(a)));
    }
    keep(el('text', { class: 'tick', x: Wd - pad.r + 14, y: H - pad.b + 22 }, svg, 'age'));

    // the comparison in blue, the start on the slider in amber, drawn last
    const cls = (a) => (a === s && a !== base ? 'pick' : 'base');
    for (const a of [...starts].sort((x, y) => (x === s) - (y === s))) {
      let d = `M${X(a).toFixed(1)} ${Y(0).toFixed(1)}`;
      for (let x = a; x <= to + 1e-9; x += 0.25) d += ` L${X(x).toFixed(1)} ${Y(total(a, x)).toFixed(1)}`;
      d += ` L${X(to).toFixed(1)} ${Y(total(a, to)).toFixed(1)}`;
      el('path', { class: `ln ln-${cls(a)} ${a === s ? 's-named' : 's-context'}`, d }, svg);
    }
    el('circle', { class: s === base ? 'start-base' : 'start-pick', cx: X(s), cy: Y(0), r: 6 }, svg);

    const probe = el('text', { class: 'lab lab-base', x: 0, y: 0 }, svg, 'Hg'), pb = probe.getBBox(); probe.remove();
    const pitch = pb.height + 2, mid = (-pb.y - (pb.height + pb.y)) / 2;
    const ends = starts.map((a) => ({ a, y: Y(total(a, to)) + mid })).sort((x, y) => x.y - y.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < pitch) ends[i].y = ends[i - 1].y + pitch;
    for (const e of ends) keep(el('text', { class: `lab lab-${cls(e.a)}`, x: Wd - pad.r + 7, y: e.y }, svg, lineLabel(e.a)));

    // the crossing, with one plain-words annotation on a 1px leader, above and to the left (the lines climb to the right)
    if (c !== null && c <= to) {
      const cx = X(c), cy = Y(total(base, c));
      const t = el('text', { class: 'reading annot', 'text-anchor': 'end' }, svg, 'They cross here');
      let tx = cx - 16, ty = cy - 38;
      t.setAttribute('x', tx); t.setAttribute('y', ty);
      let b = t.getBBox();
      if (b.x < pad.l || placed.some((q) => overlaps(q, b))) { tx = cx + 16; ty = cy + 46; t.setAttribute('text-anchor', 'start'); t.setAttribute('x', tx); t.setAttribute('y', ty); b = t.getBBox(); }
      const up = ty < cy;
      el('line', { class: 'leader', x1: cx + (up ? -4 : 4), y1: cy + (up ? -4 : 4), x2: up ? b.x + b.width : b.x, y2: up ? b.y + b.height + 2 : b.y - 2 }, svg, null);
      svg.append(t);
      el('circle', { class: 'dot dot-pick', cx, cy, r: 6 }, svg);
    }

    holder.unhair = deskCrosshair(svg, { x0: X(from), x1: X(to), y0: pad.t, y1: H - pad.b, read: (px) => {
      const a = Math.round(from + ((px - pad.l) / (Wd - pad.l - pad.r)) * (to - from));
      const rows = starts.map((q) => ({ q, v: total(q, a) })).sort((x, y) => y.v - x.v);
      return { x: X(a), y: Y(rows[0].v), lines: [`At age ${a}`, ...rows.map((z) => `${lineLabel(z.q)}: ${money(z.v)}`)] };
    } });
  }

  // a printed letter carries its sources list open
  const details = $('.sources');
  addEventListener('beforeprint', () => { details.dataset.was = details.open; details.open = true; });
  addEventListener('afterprint', () => { details.open = details.dataset.was === 'true'; });

  // the letter's charts are drawn when Go deeper opens (a closed fold has no width to draw at)
  deeper.addEventListener('toggle', () => { if (deeper.open) charts(); });

  setPlan(tool.plan);
  render();
  // the first fill is not a change: no underline on load
  requestAnimationFrame(() => document.querySelectorAll('.flash').forEach((e) => e.classList.remove('flash')));
  let t, lastW = innerWidth;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => { if (innerWidth === lastW) return; lastW = innerWidth; mainChart(); if (deeper.open) charts(); }, 120);
  });
})();
