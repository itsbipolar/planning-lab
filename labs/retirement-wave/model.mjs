// The Retirement Wave (P5a): everything the page shows, computed from the dated StatCan snapshot and the confirmed rule-age
// facts. No count, year or age is typed here: the rule ages come from facts.json, the counts from the snapshot.

// The rule ages drawn across the heatmap, each from a confirmed fact. Several rules can share an age.
export const RULES = [
  ['cpp_earliest_start_age', 'CPP can start'],
  ['cpp_standard_start_age', 'standard CPP start'],
  ['oas_start_age', 'OAS starts'],
  ['cpp_latest_start_age', 'latest CPP start'],
  ['oas_deferral_max_age', 'OAS deferral ends'],
  ['rrsp_maturity_age', 'RRSPs must mature'],
];

export function buildModel(snap, factsFile) {
  const [a0, a1] = snap.ages, [y0, y1] = snap.years;
  const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i);
  const ages = Array.from({ length: a1 - a0 + 1 }, (_, i) => a0 + i);
  const count = (y, a) => snap.values[y][a - a0];
  for (const y of years) for (const a of ages) if (!(count(y, a) > 0)) throw new Error(`no count for ${y}, age ${a}`);

  const F = new Map(factsFile.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));
  const byAge = new Map();
  for (const [id, label] of RULES) {
    const f = F.get(id); if (!f) continue; // a rule that isn't confirmed is left out
    const age = Number(f.value);
    if (age < a0 || age > a1) continue;
    if (!byAge.has(age)) byAge.set(age, { age, labels: [], facts: [] });
    byAge.get(age).labels.push(label); byAge.get(age).facts.push({ id, title: f.title, source_url: f.source_url, as_of: f.as_of });
  }
  const rules = [...byAge.values()].sort((p, q) => p.age - q.age).map((r) => {
    const series = years.map((y) => [y, count(y, r.age)]);
    const peak = series.reduce((m, p) => (p[1] > m[1] ? p : m));
    return { ...r, label: r.labels.join('; '), series, first: series[0], last: series.at(-1), peak, peakIsLast: peak[0] === y1 };
  });

  let max = [y0, a0, 0], min = [y0, a0, Infinity];
  for (const y of years) for (const a of ages) { const v = count(y, a); if (v > max[2]) max = [y, a, v]; if (v < min[2]) min = [y, a, v]; }

  // A generation is a diagonal: the people aged a on July 1 of year y were born between July 2 of y-a-1 and July 1 of y-a.
  // It is named by the second of those years. The default is the generation at the peak of the youngest rule age.
  const born = { from: y0 - a1, to: y1 - a0 };
  const youngest = rules[0];
  const defaultBorn = youngest ? youngest.peak[0] - youngest.age : born.to;

  return {
    years: [y0, y1], ages: [a0, a1], values: snap.values, max, min, rules, born, defaultBorn,
    source: { title: snap.source, source_url: snap.source_url, doi: snap.doi, licence: snap.licence, licence_url: snap.licence_url,
      attribution: snap.attribution, citation: snap.citation, released: snap.released, retrieved: snap.retrieved, notes: snap.notes },
  };
}

// One generation's path through the grid: [year, age, count] for every year it is inside the age range.
export function cohort(model, b) {
  const [y0, y1] = model.years, [a0, a1] = model.ages, out = [];
  for (let y = y0; y <= y1; y++) { const a = y - b; if (a >= a0 && a <= a1) out.push([y, a, model.values[y][a - a0]]); }
  return out;
}

export const fmtCount = (n) => Math.round(n).toLocaleString('en-CA');
