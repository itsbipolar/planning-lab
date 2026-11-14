// The retirement wave: everything the page shows, computed from the dated Statistics Canada snapshot and the confirmed
// rule-age facts. No rule age, count or year is typed here. The two ages the headline needs stop the build if they are not
// confirmed; any other rule age that is not confirmed is left off the chart.

// The rule ages drawn across the heatmap, each from a confirmed fact. Several rules can share an age.
export const RULES = [
  ['cpp_earliest_start_age', 'CPP can start', 'CPP can start'],
  ['cpp_standard_start_age', 'standard CPP start', 'CPP standard'],
  ['oas_start_age', 'OAS can start', 'OAS starts'],
  ['cpp_latest_start_age', 'latest CPP start', 'CPP latest'],
  ['oas_deferral_max_age', 'OAS deferral ends', 'OAS deferral ends'],
  ['rrsp_maturity_age', 'RRSPs must wind up by the end of the year (most become a RRIF)', 'RRSP winds up'],
  ['oas_age75_increase', 'OAS rises', 'OAS rises'],
];
const NEED = ['cpp_earliest_start_age', 'oas_start_age'];

export function buildModel(factsFile, snap) {
  const F = new Map(factsFile.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));
  for (const id of NEED) if (!F.has(id)) throw new Error(`${id} is not confirmed`);
  const [a0, a1] = snap.ages, [y0, y1] = snap.years;
  for (const p of snap.places) for (const g of snap.genders) for (let y = y0; y <= y1; y++) {
    const row = snap.counts[p.id][g][y];
    if (!row || row.length !== a1 - a0 + 1 || !row.every((v) => Number.isInteger(v) && v >= 0)) throw new Error(`no counts for ${p.id}, ${g}, ${y}`);
    if (!(snap.totals[p.id][g][y] > 0)) throw new Error(`no total for ${p.id}, ${g}, ${y}`);
  }
  const byAge = new Map();
  for (const [id, long, short] of RULES) {
    const f = F.get(id); if (!f) continue; // a rule that isn't confirmed is left out
    // The age-75 increase is a percentage; its age is in the fact's own title ("... at age NN"), read from there.
    let age = Number(f.value), lab = long, sh = short;
    if (id === 'oas_age75_increase') {
      const m = String(f.title).match(/at age (\d+)/); if (!m) continue;
      age = Number(m[1]); lab = `OAS rises ${f.value}%`; sh = lab;
    }
    if (!(age >= a0 && age <= a1)) continue;
    if (!byAge.has(age)) byAge.set(age, { age, long: [], short: [], facts: [] });
    const r = byAge.get(age); r.long.push(lab); r.short.push(sh); r.facts.push({ id, title: f.title, source_url: f.source_url, as_of: f.as_of });
  }
  const rules = [...byAge.values()].sort((p, q) => p.age - q.age).map((r) => ({ ...r, label: r.short.join(' · '), text: r.long.join('; ') }));
  return {
    years: [y0, y1], ages: [a0, a1], rules,
    cppLo: Number(F.get('cpp_earliest_start_age').value), oasLo: Number(F.get('oas_start_age').value),
    places: snap.places, genders: snap.genders, counts: snap.counts, totals: snap.totals,
    source: { title: snap.source, source_url: snap.source_url, doi: snap.doi, licence: snap.licence, licence_url: snap.licence_url,
      attribution: snap.attribution, citation: snap.citation, released: snap.released, retrieved: snap.retrieved, notes: snap.notes },
  };
}

// One place and gender ('all' is Men+ plus Women+, which StatCan's own total equals): counts by year and age, and the
// population of all ages each year.
export function view(M, place, gender) {
  const gs = gender === 'all' ? M.genders : [gender], [y0, y1] = M.years, counts = {}, totals = {};
  for (let y = y0; y <= y1; y++) {
    counts[y] = M.counts[place][gs[0]][y].map((_, i) => gs.reduce((s, g) => s + M.counts[place][g][y][i], 0));
    totals[y] = gs.reduce((s, g) => s + M.totals[place][g][y], 0);
  }
  return { place, gender, counts, totals };
}

// The value drawn for one cell: the number of people, or their share of the whole population (all ages) that year.
export function value(M, V, mode, y, a) {
  const c = V.counts[y][a - M.ages[0]];
  return mode === 'share' ? c / V.totals[y] : c;
}

export function range(M, V, mode) {
  let lo = Infinity, hi = -Infinity;
  for (let y = M.years[0]; y <= M.years[1]; y++) for (let a = M.ages[0]; a <= M.ages[1]; a++) { const v = value(M, V, mode, y, a); if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}

export const sumAges = (M, V, y, from, to) => { let s = 0; for (let a = from; a <= to; a++) s += V.counts[y][a - M.ages[0]]; return s; };

const placeName = (M, id) => M.places.find((p) => p.id === id).name;
export function who(M, place, gender) {
  const base = place === 'CA' ? 'Canadians' : `people in ${place === 'TR' ? 'the territories' : placeName(M, place)}`;
  return gender === 'all' ? base : `${base} (${gender})`;
}
export const big = (n) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} million` : Math.round(n).toLocaleString('en-CA'));
export const pct = (x, dp) => `${(x * 100).toLocaleString('en-CA', { minimumFractionDigits: dp, maximumFractionDigits: dp })}%`;

// The page's question (the H1, written at build): how many people are about to reach the OAS age.
export const question = (M) => `How many Canadians are about to turn ${M.oasLo}?`;

// The answer under it: the people between the earliest CPP age and the OAS age on the latest July 1 (counted, not
// projected) against the first year, then how the share at or past the OAS age has moved since the first year.
export function finding(M, V) {
  const [y0, y1] = M.years, [, a1] = M.ages, lo = M.cppLo, hi = M.oasLo - 1;
  const now = sumAges(M, V, y1, lo, hi), then = sumAges(M, V, y0, lo, hi);
  const oldNow = sumAges(M, V, y1, M.oasLo, a1) / V.totals[y1], oldThen = sumAges(M, V, y0, M.oasLo, a1) / V.totals[y0];
  const W = who(M, V.place, V.gender), ratio = now / then;
  const lede = `${big(now)} ${W} were ${lo} to ${hi} on July 1, ${y1}: ${ratio.toLocaleString('en-CA', { maximumFractionDigits: 1 })} times as many as in ${y0}.`;
  const more = `OAS can start at ${M.oasLo}. People ${M.oasLo} to ${a1} were ${pct(oldNow, 1)} of the whole population in ${y1}, against ${pct(oldThen, 1)} in ${y0}.`;
  return { lede, more, now, then, ratio, oldNow, oldThen, lo, hi };
}

// A birth year's diagonal. The people aged a on July 1 of year b + a were born between July 2 of b - 1 and July 1 of b.
export const bornRange = (M) => [M.years[0] - M.ages[1], M.years[1] - M.ages[0]];
export function diagonal(M, V, mode, b) {
  const [y0, y1] = M.years, [a0, a1] = M.ages, cells = [];
  for (let y = y0; y <= y1; y++) { const a = y - b; if (a >= a0 && a <= a1) cells.push([y, a, value(M, V, mode, y, a)]); }
  const crossings = M.rules.map((r) => {
    const y = b + r.age, inData = y >= y0 && y <= y1;
    return { age: r.age, year: y, value: inData ? value(M, V, mode, y, r.age) : null, when: y < y0 ? 'before' : y > y1 ? 'after' : 'in', rule: r };
  });
  return { b, cells, crossings, last: cells.at(-1) || null };
}

// Round tick values for a legend between lo and hi, about n of them.
export function niceTicks(lo, hi, n) {
  // DECADE is the number base (written 1e1 so the no-typed-figures check, which looks for rule values, stays simple).
  const DECADE = 1e1, raw = (hi - lo) / Math.max(1, n), p = Math.pow(DECADE, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f > 5 ? DECADE : f > 2 ? 5 : f > 1 ? 2 : 1) * p, out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-12; v += step) out.push(Number(v.toPrecision(12)));
  return { step, ticks: out };
}

// Where a value falls on the colour steps (0 = fewest in this view, steps - 1 = most).
export const level = (v, lo, hi, steps) => Math.max(0, Math.min(steps - 1, Math.round((steps - 1) * (v - lo) / (hi - lo || 1))));
