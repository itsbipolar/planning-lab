// The letter page: fills every number and source from facts.json (inlined at build) and the synthetic story.
(() => {
  const facts = JSON.parse(document.getElementById('facts').textContent).facts;
  const story = JSON.parse(document.getElementById('story').textContent);
  const r = rules(facts);
  const byId = Object.fromEntries(facts.map((f) => [f.id, f]));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = (n) => '$' + Math.round(n).toLocaleString('en-CA');
  const pct = (x) => `${Number((Math.abs(x) * 100).toFixed(1))}%`;
  const fact = (id) => byId[id].value;

  const state = {
    cppAge: r.cpp.standard, oasAge: r.oas.start,
    cppAt65: story.cppAt65.value, oasAt65: story.oasAt65.value, other: story.other.value,
  };
  const spec = {
    cppAge: { min: r.cpp.earliest, max: r.cpp.latest, step: 1, pxPerStep: 24, format: String, label: 'CPP start age' },
    oasAge: { min: r.oas.start, max: r.oas.latest, step: 1, pxPerStep: 24, format: String, label: 'OAS start age' },
    cppAt65: { ...story.cppAt65, pxPerStep: 4, format: money, label: 'Illustrative CPP at the standard age, per month' },
    oasAt65: { ...story.oasAt65, pxPerStep: 4, format: money, label: 'Illustrative OAS at the start age, per month' },
    other: { ...story.other, pxPerStep: 3, format: money, label: 'Other retirement income, per year' },
  };

  $$('[data-name]').forEach((el) => { el.textContent = story.names[el.dataset.name]; });
  const fixed = {
    cppEarliest: r.cpp.earliest, cppLatest: r.cpp.latest, cppStandard: r.cpp.standard,
    oasStart: r.oas.start, oasLatest: r.oas.latest, oasUp: `${fact('oas_deferral_increase')}%`,
    thrYear: r.threshold.year, thrValue: money(r.threshold.value),
  };

  // Sidenotes: each names its source, its tax year where it has one, and the date it was read.
  $$('.sn[data-fact]').forEach((el) => {
    const f = el.dataset.fact === 'oas_recovery_threshold' ? byId[r.threshold.id] : byId[el.dataset.fact];
    const host = new URL(f.source_url).hostname.replace(/^www\./, '');
    const year = f.tax_year ? `Tax year ${f.tax_year}. ` : '';
    el.insertAdjacentHTML('beforeend', ` ${year}Source: <a href="${f.source_url}">${host}</a>, read ${f.as_of}.`);
  });

  const controls = {};
  const sliders = $('#sliders');
  for (const [key, s] of Object.entries(spec)) {
    const id = `s-${key}`;
    sliders.insertAdjacentHTML('beforeend', `<div class="slider"><label for="${id}">${s.label}: <output id="${id}-o"></output></label><div class="row"><button type="button" class="step" data-dir="-1" aria-label="Less: ${s.label}">−</button><input type="range" id="${id}" min="${s.min}" max="${s.max}" step="${s.step}" value="${state[key]}"><button type="button" class="step" data-dir="1" aria-label="More: ${s.label}">+</button></div></div>`);
    const input = $(`#${id}`);
    input.parentElement.querySelectorAll('.step').forEach((b) => b.addEventListener('click', () => {
      state[key] = Math.min(s.max, Math.max(s.min, state[key] + Number(b.dataset.dir) * s.step)); render();
    }));
    input.addEventListener('input', () => { state[key] = Number(input.value); render(); });
    controls[key] = { input, out: $(`#${id}-o`), drags: [] };
  }
  $$('[data-drag]').forEach((el) => {
    const key = el.dataset.drag;
    controls[key].drags.push(dragNumber(el, { ...spec[key], value: state[key], onChange: (v) => { state[key] = v; render(); } }));
  });

  function ageText(x) {
    let y = Math.floor(x), m = Math.round((x - y) * 12);
    if (m === 12) { y += 1; m = 0; }
    return m ? `about age ${y} and ${m} month${m === 1 ? '' : 's'}` : `about age ${y}`;
  }

  function render() {
    const out = letter(r, state);
    for (const [key, c] of Object.entries(controls)) {
      c.input.value = state[key];
      c.out.textContent = spec[key].format(state[key]);
      c.drags.forEach((d) => d.set(state[key]));
    }
    const std = r.cpp.standard, age = state.cppAge;
    const text = {
      ...fixed,
      cppMonthly: money(out.cppMonthly),
      cppWhy: age < std
        ? `That is ${pct(out.cppChange)} less than at ${std}: the pension is reduced by ${fact('cpp_early_start_reduction')}% for each month it starts before ${std}.`
        : age > std
          ? `That is ${pct(out.cppChange)} more than at ${std}: it rises by ${fact('cpp_late_start_increase')}% for each month it starts after ${std}.`
          : 'That is the standard start, with no reduction and no increase.',
      crossing: out.cppCrossing === null
        ? `there is nothing to compare at the standard start. Drag her CPP start age to see where the totals cross.`
        : `starting at ${age} instead of ${std}, the two totals cross at ${ageText(out.cppCrossing)}. Until then the earlier start, ${Math.min(age, std)}, has paid more in total; after it, the later start, ${Math.max(age, std)}, has.`,
      oasMonthly: money(out.oasMonthly),
      oasWhy: state.oasAge === r.oas.start ? '' : `, ${pct(out.oasChange)} more than at ${r.oas.start}`,
      income: money(out.incomeBothPaid),
      thrSide: out.aboveThreshold ? 'above' : 'below',
      thrWhy: out.aboveThreshold ? 'Above it, the OAS recovery tax applies; how it is worked out is on the Government of Canada page in the margin note.' : '',
    };
    $$('[data-out]').forEach((el) => { el.textContent = text[el.dataset.out]; });
    chart(out);
  }

  function chart(out) {
    const holder = $('#chart-svg');
    const w = Math.max(260, Math.min(440, holder.clientWidth || 320)), h = Math.round(w * 0.8);
    const pad = { l: 46, r: 64, t: 12, b: 28 };
    const std = r.cpp.standard, age = state.cppAge, from = r.cpp.earliest, to = story.chart.toAge;
    const lines = [{ start: std, m: state.cppAt65, you: false, label: `From ${std}` }];
    if (age !== std) lines.unshift({ start: age, m: out.cppMonthly, you: true, label: `From ${age}` });
    const maxY = Math.max(...lines.map((l) => total(l.start, l.m, to)), 1);
    const X = (a) => pad.l + ((a - from) / (to - from)) * (w - pad.l - pad.r);
    const Y = (v) => h - pad.b - (v / maxY) * (h - pad.t - pad.b);
    const short = (v) => (v === 0 ? "$0" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}k`);
    let svg = '';
    for (let i = 0; i <= 2; i++) {
      const v = (maxY * i) / 2;
      svg += `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end">${short(v)}</text>`;
    }
    for (let a = from; a <= to; a += 5) svg += `<text class="axis" x="${X(a)}" y="${h - 8}" text-anchor="middle">${a}</text>`;
    const ends = [];
    for (const l of lines) {
      svg += `<polyline ${l.you ? 'class="l-you"' : 'class="l-std"'} fill="none" stroke-width="2" points="${X(from)},${Y(0)} ${X(l.start)},${Y(0)} ${X(to)},${Y(total(l.start, l.m, to))}"/>`;
      ends.push({ y: Y(total(l.start, l.m, to)), l });
    }
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
    for (const e of ends) svg += `<text ${e.l.you ? 'class="lab lab-you"' : 'class="lab lab-std"'} x="${w - pad.r + 6}" y="${e.y + 4}">${e.l.label}</text>`;
    if (out.cppCrossing !== null && out.cppCrossing <= to) {
      svg += `<circle class="dot" cx="${X(out.cppCrossing)}" cy="${Y(total(std, state.cppAt65, out.cppCrossing))}" r="5"/>`;
    }
    const summary = out.cppCrossing === null
      ? `Total CPP received by each age, starting at ${std}.`
      : `Total CPP received by each age, starting at ${age} and at ${std}; the totals cross at ${ageText(out.cppCrossing)}.`;
    $('#chart-cap').textContent = 'Total CPP received by each age';
    holder.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${summary}">${svg}</svg>`;
  }

  render();
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => chart(letter(r, state)), 100); });
})();
