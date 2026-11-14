// The letter's arithmetic. Every rule comes from the confirmed facts passed in (shared/facts.json); nothing is written here.
// Start ages are whole months (an age like 67 and 4 months is 67 + 4/12), counted in months as the rules count them. Amounts are nominal dollars: no inflation
// indexing, tax, survivor benefits or investment return.

const NEED = ['cpp_standard_start_age', 'cpp_earliest_start_age', 'cpp_latest_start_age', 'cpp_early_start_reduction',
  'cpp_late_start_increase', 'oas_start_age', 'oas_deferral_max_age', 'oas_deferral_increase', 'oas_age75_increase',
  'oas_recovery_rate'];

export function rules(facts) {
  const confirmed = facts.filter((f) => f.status === 'confirmed');
  const get = (id) => {
    const f = confirmed.find((x) => x.id === id);
    if (!f) throw new Error(`missing confirmed fact ${id}`);
    return f;
  };
  const n = (id) => Number(get(id).value);
  for (const id of NEED) get(id);
  // The latest year with a confirmed recovery threshold (a pending year has no value and is never used).
  const threshold = confirmed.filter((f) => f.series === 'oas_recovery_threshold').sort((a, b) => b.tax_year - a.tax_year)[0];
  if (!threshold) throw new Error('missing confirmed fact oas_recovery_threshold');
  // The age of the OAS increase is in that fact's own title ("... at age NN"): read it there so it is not typed here.
  const boostAge = String(get('oas_age75_increase').title).match(/\bage (\d+)\b/);
  if (!boostAge) throw new Error('the age of the OAS increase is not in its fact title');
  const sources = [...NEED, threshold.id].map((id) => {
    const f = confirmed.find((x) => x.id === id);
    return { id, title: f.title, source_url: f.source_url, as_of: f.as_of, tax_year: f.tax_year, authority: f.authority };
  });
  return {
    cpp: {
      standard: n('cpp_standard_start_age'),
      earliest: n('cpp_earliest_start_age'),
      latest: n('cpp_latest_start_age'),
      reductionPerMonth: n('cpp_early_start_reduction') / 100,
      increasePerMonth: n('cpp_late_start_increase') / 100,
    },
    oas: {
      start: n('oas_start_age'),
      latest: n('oas_deferral_max_age'),
      increasePerMonth: n('oas_deferral_increase') / 100,
      boost: n('oas_age75_increase') / 100,
      boostAge: Number(boostAge[1]),
    },
    recovery: { rate: n('oas_recovery_rate') / 100, threshold: Number(threshold.value), year: threshold.tax_year, id: threshold.id },
    sources,
  };
}

// An age is accepted when it is a whole number of months inside the range (the slider steps a month at a time).
export function monthsOf(age) {
  const m = Math.round(age * 12);
  return Number.isFinite(age) && Math.abs(age * 12 - m) < 1e-6 ? m : null;
}
function wholeAge(age, lo, hi, what) {
  const m = monthsOf(age);
  if (m === null || m < lo * 12 || m > hi * 12) throw new RangeError(`${what} must be an age in whole months from ${lo} to ${hi}`);
}

// The monthly pension as a share of the amount at the standard age (CPP) or the start age (OAS).
export function cppFactor(r, age) {
  wholeAge(age, r.cpp.earliest, r.cpp.latest, 'CPP start age');
  const months = monthsOf(age) - r.cpp.standard * 12;
  return months < 0 ? 1 + months * r.cpp.reductionPerMonth : 1 + months * r.cpp.increasePerMonth;
}

export function oasFactor(r, age) {
  wholeAge(age, r.oas.start, r.oas.latest, 'OAS start age');
  return 1 + (monthsOf(age) - r.oas.start * 12) * r.oas.increasePerMonth;
}

// The planning-timeline break-even, in "years of the standard pension": a start at `a` paying `share` of the standard
// amount has paid as much in total as a start at `std` by this age. It does not depend on the size of the pension.
export function breakEven(share, a, std) {
  if (a === std) return null;
  return (share * a - std) / (share - 1);
}

export function cppCrossing(r, age) {
  return monthsOf(age) === r.cpp.standard * 12 ? null : breakEven(cppFactor(r, age), age, r.cpp.standard);
}

// OAS against a start at the earliest age, counting the rise at the boost age for both starts.
export function oasCrossing(r, age) {
  const a0 = r.oas.start;
  if (monthsOf(age) === a0 * 12) return null;
  const s = oasFactor(r, age), B = r.oas.boostAge, b = r.oas.boost;
  const before = breakEven(s, age, a0);
  if (before <= B) return before;
  // After the boost age each total grows by (1 + b) years of its own pension a year:
  // s * ((1 + b) x - age - bB) = (1 + b) x - a0 - bB
  return (s * (age + b * B) - (a0 + b * B)) / ((1 + b) * (s - 1));
}

// Dollars received by age x.
export function cppTotal(startAge, monthly, x) {
  return monthly * 12 * Math.max(0, x - startAge);
}
export function oasTotal(r, startAge, monthly, x) {
  return monthly * 12 * (Math.max(0, x - startAge) + r.oas.boost * Math.max(0, x - Math.max(startAge, r.oas.boostAge)));
}

// The OAS recovery tax for one person, on that person's own net income: a share of the income above the threshold,
// never more than the OAS paid that year.
export function recovery(r, netIncome, oasYearly) {
  return Math.min(oasYearly, Math.max(0, netIncome - r.recovery.threshold) * r.recovery.rate);
}

// One spouse: start ages, illustrative amounts at the standard age and other income for a year.
export function spouse(r, { cppAge, oasAge, cppAt65, oasAt65, other }) {
  for (const [k, v] of Object.entries({ cppAt65, oasAt65, other })) {
    if (!Number.isFinite(v) || v < 0) throw new RangeError(`${k} must be a number of zero or more`);
  }
  const cppMonthly = cppAt65 * cppFactor(r, cppAge);
  const oasMonthly = oasAt65 * oasFactor(r, oasAge);
  // Net income in a year when both pensions are paid (before the boost age): other income plus both pensions.
  const net = other + 12 * (cppMonthly + oasMonthly);
  const recovered = recovery(r, net, 12 * oasMonthly);
  return {
    cppMonthly,
    oasMonthly,
    cppChange: cppFactor(r, cppAge) - 1,
    oasChange: oasFactor(r, oasAge) - 1,
    cppCrossing: cppCrossing(r, cppAge),
    oasCrossing: oasCrossing(r, oasAge),
    net,
    overThreshold: Math.max(0, net - r.recovery.threshold),
    recovery: recovered,
    recoveryCapped: recovered > 0 && recovered >= 12 * oasMonthly,
  };
}

export function couple(r, a, b) {
  return { a: spouse(r, a), b: spouse(r, b) };
}

// The headline comparison for a CPP start age: a later start against the standard one, an earlier start against it,
// or, at the standard age, the latest start against it.
export function headline(r, cppAge) {
  const std = r.cpp.standard;
  if (cppAge > std) return { kind: 'later', from: std, to: cppAge, at: cppCrossing(r, cppAge) };
  if (cppAge < std) return { kind: 'earlier', from: cppAge, to: std, at: cppCrossing(r, cppAge) };
  return { kind: 'standard', from: std, to: r.cpp.latest, at: cppCrossing(r, r.cpp.latest) };
}
