// The letter's arithmetic. Every rule comes from the confirmed facts passed in (shared/facts.json); nothing is written here.
// Ages are whole years. Amounts are nominal dollars: no inflation indexing, tax or investment return.

export function rules(facts) {
  const confirmed = facts.filter((f) => f.status === 'confirmed');
  const get = (id) => {
    const f = confirmed.find((x) => x.id === id);
    if (!f) throw new Error(`missing confirmed fact ${id}`);
    return f;
  };
  const threshold = confirmed.filter((f) => f.series === 'oas_recovery_threshold').sort((a, b) => b.tax_year - a.tax_year)[0];
  if (!threshold) throw new Error('missing confirmed fact oas_recovery_threshold');
  return {
    cpp: {
      standard: Number(get('cpp_standard_start_age').value),
      earliest: Number(get('cpp_earliest_start_age').value),
      latest: Number(get('cpp_latest_start_age').value),
      reductionPerMonth: Number(get('cpp_early_start_reduction').value) / 100,
      increasePerMonth: Number(get('cpp_late_start_increase').value) / 100,
    },
    oas: {
      start: Number(get('oas_start_age').value),
      latest: Number(get('oas_deferral_max_age').value),
      increasePerMonth: Number(get('oas_deferral_increase').value) / 100,
    },
    threshold: { value: Number(threshold.value), year: threshold.tax_year, id: threshold.id },
  };
}

function wholeAge(age, lo, hi, what) {
  if (!Number.isInteger(age) || age < lo || age > hi) throw new RangeError(`${what} must be a whole age from ${lo} to ${hi}`);
}

export function cppFactor(r, age) {
  wholeAge(age, r.cpp.earliest, r.cpp.latest, 'CPP start age');
  const months = (age - r.cpp.standard) * 12;
  return months < 0 ? 1 + months * r.cpp.reductionPerMonth : 1 + months * r.cpp.increasePerMonth;
}

export function oasFactor(r, age) {
  wholeAge(age, r.oas.start, r.oas.latest, 'OAS start age');
  return 1 + (age - r.oas.start) * 12 * r.oas.increasePerMonth;
}

// The age at which two lifetime totals are equal: monthly amount a from age ageA, b from ageB (ageA < ageB, a < b).
export function crossingAge(ageA, a, ageB, b) {
  if (ageA === ageB) return null;
  if (ageA > ageB) return crossingAge(ageB, b, ageA, a);
  if (b <= a) return null;
  return (b * ageB - a * ageA) / (b - a);
}

export function total(startAge, monthly, atAge) {
  return atAge <= startAge ? 0 : monthly * 12 * (atAge - startAge);
}

export function letter(r, { cppAge, oasAge, cppAt65, oasAt65, other }) {
  for (const [k, v] of Object.entries({ cppAt65, oasAt65, other })) {
    if (!Number.isFinite(v) || v < 0) throw new RangeError(`${k} must be a number of zero or more`);
  }
  const cppMonthly = cppAt65 * cppFactor(r, cppAge);
  const oasMonthly = oasAt65 * oasFactor(r, oasAge);
  const incomeBothPaid = other + 12 * (cppMonthly + oasMonthly);
  return {
    cppMonthly,
    oasMonthly,
    cppChange: cppFactor(r, cppAge) - 1,
    oasChange: oasFactor(r, oasAge) - 1,
    cppCrossing: crossingAge(cppAge, cppMonthly, r.cpp.standard, cppAt65),
    incomeBothPaid,
    aboveThreshold: incomeBothPaid > r.threshold.value,
  };
}
