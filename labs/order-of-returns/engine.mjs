// The Order of Returns: the withdrawal engine (SPEC.md section 3). Pure: no DOM, no randomness, no I/O.
// One step per year: the year's withdrawal is taken at the start of the year, then what is invested earns that year's return.
//
// simulate({ start, withdrawal, indexation, returns, flexRule, cashBuffer }) -> {
//   balances[t]   total balance at the end of year t (invested + cash), t = 0..n-1
//   planned[t]    the withdrawal planned for year t (indexed, then trimmed by the flex rule)
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
export function simulate({ start, withdrawal, indexation = 0, returns, flexRule = null, cashBuffer = null }) {
  check(Number.isFinite(start) && start >= 0, 'start must be a number >= 0');
  check(Number.isFinite(withdrawal) && withdrawal >= 0, 'withdrawal must be a number >= 0');
  check(Number.isFinite(indexation) && indexation >= -1, 'indexation must be a number >= -1');
  check(Array.isArray(returns) && returns.every((r) => Number.isFinite(r) && r > -1), 'returns must be numbers > -1');
  if (flexRule) check(Number.isFinite(flexRule.trim) && flexRule.trim >= 0 && flexRule.trim <= 1, 'flexRule.trim must be 0..1');
  if (cashBuffer) check(Number.isFinite(cashBuffer.years) && cashBuffer.years >= 0, 'cashBuffer.years must be >= 0');

  const target = (w) => (cashBuffer ? cashBuffer.years * w : 0);
  let cash = Math.min(start, target(withdrawal));
  let invested = start - cash;
  const balances = [], planned = [], paid = [];
  let depletionYear = null;

  for (let t = 0; t < returns.length; t++) {
    const prevDown = t > 0 && returns[t - 1] < 0;
    let w = withdrawal * Math.pow(1 + indexation, t);
    if (flexRule && prevDown) w *= 1 - flexRule.trim;
    planned.push(w);

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
  return { balances, planned, paid, depletionYear, endBalance: balances.length ? balances[balances.length - 1] : start };
}

function check(ok, msg) { if (!ok) throw new RangeError(msg); }

/** The arithmetic mean of the returns (what "the same average return" means on the page). */
export const average = (returns) => returns.reduce((a, b) => a + b, 0) / returns.length;
