// Your planning timeline: everything the page shows for a birth year, computed from the confirmed facts and the dated
// Statistics Canada snapshot. No age, rate, limit or year from the rules is written here; a missing fact stops the build.

const NEED = ['tfsa_minimum_age', 'tfsa_first_year', 'cpp_earliest_start_age', 'cpp_standard_start_age', 'cpp_latest_start_age',
  'cpp_early_start_reduction', 'cpp_late_start_increase', 'oas_start_age', 'oas_deferral_max_age', 'oas_deferral_increase',
  'oas_age75_increase', 'oas_recovery_rate', 'rrsp_maturity_age', 'rrif_minimum_factors'];

export function buildModel(factsFile, pop) {
  const F = new Map(factsFile.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));
  for (const id of NEED) if (!F.has(id)) throw new Error(`${id} is not confirmed`);
  const n = (id) => Number(F.get(id).value);
  // TFSA dollar limits by year, as far as they are confirmed.
  const tfsa = {};
  for (const [id, f] of F) { const m = id.match(/^tfsa_annual_limit\.(\d{4})$/); if (m) tfsa[m[1]] = Number(f.value); }
  const thresholds = {};
  for (const [id, f] of F) { const m = id.match(/^oas_recovery_threshold\.(\d{4})$/); if (m) thresholds[m[1]] = Number(f.value); }
  const used = [...NEED, ...[...F.keys()].filter((id) => /^tfsa_annual_limit\.\d{4}$/.test(id) || /^oas_recovery_threshold\.\d{4}$/.test(id))];
  const sources = used.map((id) => { const f = F.get(id); return { id, title: f.title, source_url: f.source_url, as_of: f.as_of, authority: f.authority }; })
    .filter((s, i, a) => a.findIndex((x) => x.source_url === s.source_url && x.title === s.title) === i);
  return {
    r: {
      tfsaAge: n('tfsa_minimum_age'), tfsaYear: n('tfsa_first_year'),
      cppLo: n('cpp_earliest_start_age'), cppStd: n('cpp_standard_start_age'), cppHi: n('cpp_latest_start_age'),
      cppRed: n('cpp_early_start_reduction'), cppInc: n('cpp_late_start_increase'),
      oasLo: n('oas_start_age'), oasHi: n('oas_deferral_max_age'), oasInc: n('oas_deferral_increase'),
      oasBoost: n('oas_age75_increase'), oasRecovery: n('oas_recovery_rate'), rrsp: n('rrsp_maturity_age'),
    },
    // The boost age is in the fact's own title ("... at age NN"); read it from there so it is not typed here.
    oasBoostAge: Number(String(F.get('oas_age75_increase').title).match(/age (\d+)/)[1]),
    tfsa, thresholds,
    rrif: F.get('rrif_minimum_factors').value.map((x) => ({ age: Number(x.age), factor: Number(x.factor) })),
    pop: pop ? { year: pop.years[1], a0: pop.ages[0], a1: pop.ages[1], counts: pop.values[String(pop.years[1])], attribution: pop.attribution, source_url: pop.source_url } : null,
    sources,
  };
}

// Monthly amount as a share of the standard-age amount, for a start at a whole age.
export const cppShare = (M, a) => 1 + (a < M.r.cppStd ? -(M.r.cppStd - a) * 12 * M.r.cppRed : (a - M.r.cppStd) * 12 * M.r.cppInc) / 100;
export const oasShare = (M, a) => 1 + (a - M.r.oasLo) * 12 * M.r.oasInc / 100;

// Pure arithmetic: the age at which starting at `a` has paid as much in total as starting at the standard age.
// No indexation, tax, survivor rules or the time value of money.
export function breakEven(share, a, std) {
  if (a === std) return null;
  return (share * a - std) / (share - 1);
}

// Totals received by age x, in "years of the standard pension", for a start at `a`.
export const totalBy = (share, a, x) => Math.max(0, x - a) * share;

// The share of a RRIF left after taking only the minimum each year from `from` up to (not including) `to`, if it earns nothing.
export function rrifLeft(M, from, to) {
  let left = 1;
  for (const row of M.rrif) if (row.age >= from && row.age < to) left *= 1 - row.factor;
  return left;
}

export function person(M, birthYear, thisYear) {
  const R = M.r, age = thisYear - birthYear;
  const lanes = [];
  // TFSA: room starts in the later of the year you turn the minimum age and the year the TFSA began.
  const tStart = Math.max(birthYear + R.tfsaAge, R.tfsaYear);
  const known = Object.keys(M.tfsa).map(Number);
  const lastKnown = Math.max(...known);
  let room = 0; for (let y = tStart; y <= Math.min(thisYear, lastKnown); y++) room += M.tfsa[y] ?? 0;
  const missing = []; for (let y = tStart; y <= Math.min(thisYear, lastKnown); y++) if (!(y in M.tfsa)) missing.push(y);
  lanes.push({ key: 'tfsa', from: tStart - birthYear, to: null, startYear: tStart, room, roomTo: Math.min(thisYear, lastKnown), missing, open: tStart <= thisYear });
  lanes.push({ key: 'cpp', from: R.cppLo, to: R.cppHi, std: R.cppStd });
  lanes.push({ key: 'oas', from: R.oasLo, to: R.oasHi, std: R.oasLo, boost: M.oasBoostAge });
  lanes.push({ key: 'rrsp', from: null, to: R.rrsp, rrifFrom: R.rrsp + 1 });
  const where = (lo, hi) => (age < lo ? 'ahead' : age > hi ? 'past' : 'open');
  const popCount = M.pop && age >= M.pop.a0 && age <= M.pop.a1 ? M.pop.counts[age - M.pop.a0] : null;
  return {
    age, birthYear, thisYear, lanes, popCount,
    cpp: { state: where(R.cppLo, R.cppHi), opens: birthYear + R.cppLo, closes: birthYear + R.cppHi },
    oas: { state: where(R.oasLo, R.oasHi), opens: birthYear + R.oasLo, closes: birthYear + R.oasHi, boostYear: birthYear + M.oasBoostAge },
    rrsp: { matures: birthYear + R.rrsp, state: age > R.rrsp ? 'past' : 'ahead' },
  };
}

// The headline: one sentence for this person, in plain words.
export function finding(M, p) {
  const bits = [];
  const yrs = (y) => (y === 1 ? 'next year' : `in ${y} years`);
  if (p.cpp.state === 'ahead') bits.push(`CPP can start ${yrs(p.cpp.opens - p.thisYear)}`);
  else if (p.cpp.state === 'open') bits.push(`your CPP window is open until ${p.cpp.closes}`);
  if (p.oas.state === 'ahead') bits.push(`OAS opens ${yrs(p.oas.opens - p.thisYear)}`);
  else if (p.oas.state === 'open') bits.push(`you can still defer OAS until ${p.oas.closes}`);
  if (p.rrsp.state === 'ahead') bits.push(`your RRSP must become a RRIF by the end of ${p.rrsp.matures}`);
  else bits.push(`RRIF minimums apply each year`);
  const t = p.lanes[0];
  // TFSA leads only when there is room for it: the pension and RRSP dates come first.
  if (bits.length < 3) bits.unshift(t.open ? `TFSA room has built up since ${t.startYear}` : `TFSA room starts in ${t.startYear}`);
  const list = bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits.at(-1) : bits[0];
  return `At ${p.age}, ${list}.`;
}
