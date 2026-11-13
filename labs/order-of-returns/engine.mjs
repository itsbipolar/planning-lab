// The Order of Returns: the withdrawal engine (SPEC.md section 3). Pure: no DOM, no randomness, no I/O.
// One step per year: the year's withdrawal is taken at the start of the year, then what is invested earns that year's return.
//
// simulate({ start, withdrawal, indexation, returns, flexRule, cashBuffer, minimumFactors }) -> {
//   balances[t]   total balance at the end of year t (invested + cash), t = 0..n-1
//   planned[t]    the withdrawal planned for year t (indexed, trimmed by the flex rule, raised to any minimum)
//   forced[t]     how much of planned[t] the minimum added (0 when there is no minimum or it is below the plan)
//   paid[t]       what was actually paid (less than planned once the money runs out)
//   depletionYear the first year (1-based) a planned withdrawal could not be paid in full, or null
//   endBalance    balances[n-1] (or start if there are no years)
// }
//   start       starting balance (>= 0)
//   withdrawal  first year's withdrawal (>= 0), as an amount, never a rate
//   indexation  yearly increase of the withdrawal, e.g. 0.02 (>= -1)
//   returns     yearly returns as fractions, e.g. [0.07, -0.12, ...] (each > -1)
//   flexRule    null, or { trim }: after a year with a negative return, the next withdrawal is cut by trim (0..1)
//   cashBuffer  null, or { years }: hold that many years of withdrawals in cash earning nothing; after a down year the
//               withdrawal comes from cash first; after an up year the cash is topped back up from the invested money
//   minimumFactors  null, or one factor per year (0 = no minimum): the year's withdrawal is at least that factor times
//               the balance at the start of the year (the RRIF lane; the factors come from rrifFactorsByYear below)
export function simulate({ start, withdrawal, indexation = 0, returns, flexRule = null, cashBuffer = null, minimumFactors = null }) {
  check(Number.isFinite(start) && start >= 0, 'start must be a number >= 0');
  check(Number.isFinite(withdrawal) && withdrawal >= 0, 'withdrawal must be a number >= 0');
  check(Number.isFinite(indexation) && indexation >= -1, 'indexation must be a number >= -1');
  check(Array.isArray(returns) && returns.every((r) => Number.isFinite(r) && r > -1), 'returns must be numbers > -1');
  if (flexRule) check(Number.isFinite(flexRule.trim) && flexRule.trim >= 0 && flexRule.trim <= 1, 'flexRule.trim must be 0..1');
  if (cashBuffer) check(Number.isFinite(cashBuffer.years) && cashBuffer.years >= 0, 'cashBuffer.years must be >= 0');
  if (minimumFactors) check(Array.isArray(minimumFactors) && minimumFactors.every((f) => Number.isFinite(f) && f >= 0 && f <= 1), 'minimumFactors must be numbers 0..1');

  const target = (w) => (cashBuffer ? cashBuffer.years * w : 0);
  let cash = Math.min(start, target(withdrawal));
  let invested = start - cash;
  const balances = [], planned = [], paid = [], forced = [];
  let depletionYear = null;

  for (let t = 0; t < returns.length; t++) {
    const prevDown = t > 0 && returns[t - 1] < 0;
    let w = withdrawal * Math.pow(1 + indexation, t);
    if (flexRule && prevDown) w *= 1 - flexRule.trim;
    const plan = w;
    if (minimumFactors && minimumFactors[t] > 0) w = Math.max(w, minimumFactors[t] * (invested + cash));
    planned.push(w); forced.push(w - plan);

    // take the withdrawal: from cash first after a down year, otherwise from the invested money; never below zero
    let need = w;
    const take = (from) => { const x = Math.min(need, from); need -= x; return x; };
    if (cashBuffer && prevDown) { cash -= take(cash); invested -= take(invested); }
    else { invested -= take(invested); cash -= take(cash); }
    const got = w - need;
    paid.push(got);
    if (need > 1e-9 && depletionYear === null) depletionYear = t + 1;

    invested *= 1 + returns[t];

    // after an up year, top the cash back up to its target from the invested money
    if (cashBuffer && returns[t] > 0) {
      const nextW = withdrawal * Math.pow(1 + indexation, t + 1);
      const move = Math.min(Math.max(0, target(nextW) - cash), invested);
      cash += move; invested -= move;
    }
    invested = Math.max(0, invested); cash = Math.max(0, cash);
    balances.push(invested + cash);
  }
  return { balances, planned, paid, forced, depletionYear, endBalance: balances.length ? balances[balances.length - 1] : start };
}

function check(ok, msg) { if (!ok) throw new RangeError(msg); }

/** The arithmetic mean of the returns (what "the same average return" means on the page). */
export const average = (returns) => returns.reduce((a, b) => a + b, 0) / returns.length;

/** The RRIF lane's yearly minimum factors (an illustration, SPEC.md section 3). The retiree is startAge at the start of
 *  year 1. In a year that starts at an age of maturityAge or more (the year after the RRSP has matured), the factor is the
 *  one the table lists for the age at the start of that year; before that it is 0. An age missing from the table throws:
 *  a missing rule is never guessed. rows: [{ age, factor }] from the confirmed facts. */
export function rrifFactorsByYear({ startAge, maturityAge, rows, years }) {
  check(Number.isInteger(startAge) && Number.isInteger(maturityAge) && Number.isInteger(years) && years >= 0, 'ages and years must be integers');
  const byAge = new Map(rows.map((r) => [Number(r.age), Number(r.factor)]));
  return Array.from({ length: years }, (_, t) => {
    const age = startAge + t;
    if (age < maturityAge) return 0;
    check(byAge.has(age), `no minimum factor for age ${age} in the facts`);
    return byAge.get(age);
  });
}

/** The largest first-year withdrawal, in whole multiples of `step`, at which the money lasts every year of `returns`
 *  (a binary search on simulate; the levers in `params` apply as given). Lasting falls as the withdrawal rises. */
export function largestLastingWithdrawal(params, step = 1) {
  const lasts = (w) => simulate({ ...params, withdrawal: w * step }).depletionYear === null;
  let lo = 0, hi = Math.max(1, Math.ceil(params.start / step));
  while (lasts(hi)) { lo = hi; hi *= 2; if (hi > 1e12) return Infinity; }
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (lasts(mid)) lo = mid; else hi = mid; }
  return lo * step;
}
