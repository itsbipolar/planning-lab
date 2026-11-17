// Company life insurance: the engine. Pure functions (no DOM, no I/O), written from scratch for this tool: it takes the
// facts list and the two inputs (the payout and the policy's tax cost at death) and returns where each dollar of the
// payout goes. build.mjs inlines it into the page (export stripped) and the tests import it. Every rate and rule comes
// from shared/facts.json (confirmed values only); the only numbers typed here are the example's assumptions (EXAMPLE),
// the controls' ranges (BOUNDS) and the display rounding (FORMAT). It does not estimate any policy's tax cost, project
// it over time, add premiums or tax the company (SPEC.md section 4.4).

// @@EXAMPLE: the made-up owner's company the page opens on. Example assumptions, not facts.
export const EXAMPLE = { label: 'Example assumptions, not facts', payout: 1_000_000, acb: 200_000 };
// @@END

// @@BOUNDS: the controls' ranges and steps, and the shares of the payout the table shows. UI bounds, not facts.
export const BOUNDS = {
  label: 'UI bounds, not facts',
  payout: { min: 250_000, max: 10_000_000, step: 250_000 },
  acb: { min: 0, step: 10_000, page: 100_000 },          // max: the payout
  tableShares: [0, 0.25, 0.5, 0.75, 1],
};
// @@END

// @@FORMAT: display rounding only (the page, the chart, the hidden table and the poster use these and nothing else).
/** Income tax is rounded once, to the dollar; every other part is found by subtraction, so every sum is exact and the
 *  tax never departs from the stated rate by more than half a dollar. */
export const ROUND = 1;
const grp = (n, dp = 0) => n.toLocaleString('en-CA', { minimumFractionDigits: dp, maximumFractionDigits: dp });
/** Every dollar figure: full dollars, never K or M ("$95,000", "$1,000,000", "$0"). */
export const money = (n) => '$' + grp(Math.round(Math.max(0, n)) || 0);
/** Cents, for the per-$100 working ("$37.95"). */
export const cents = (n) => '$' + grp(n, 2);
/** Rounds a dollar amount to the cent. */
export const toCents = (n) => Math.round(n * 100) / 100;
/** A rate (a fraction) to 2 decimals ("12.34%"). */
export const pct2 = (r) => grp(r * 100, 2) + '%';
/** A fact's own percent as the statute writes it (up to 3 decimals), else to 2. */
export function factPct(v) {
  const s = String(Number(v)), dp = (s.split('.')[1] || '').length;
  return (dp <= 3 ? s : grp(Number(v), 2)) + '%';
}
// @@END

const fail = (id) => { throw new Error(`corporate-insurance: the confirmed fact ${id} is missing (no fallback value is used)`); };
const confirmed = (facts) => (Array.isArray(facts) ? facts : facts.facts).filter((f) => f.status === 'confirmed' && f.value != null);
const find = (F, id) => F.find((f) => f.id === id) || null;
const need = (F, id) => find(F, id) || fail(id);
const pct = (f) => Number(f.value) / 100;
const topRate = (f) => { const row = f.value.find((r) => r.to == null); if (!row) fail(f.id); return Number(row.rate) / 100; };
const yearsOf = (F, series) => F.filter((f) => f.series === series && f.tax_year != null).map((f) => f.tax_year);

/** The four yearly series that must share one confirmed year (the rate year). */
export const RATE_SERIES = ['federal_brackets', 'ontario_brackets', 'ontario_surtax', 'ontario_dividend_tax_credit_non_eligible'];
/** The fixed facts the page cannot do without (the build stops and names the id). */
export const REQUIRED = ['dividend_gross_up_non_eligible', 'federal_dividend_tax_credit_non_eligible', 'ontario_surtax_base',
  'cda_life_insurance_proceeds', 'cda_life_insurance_acb_deduction', 'capital_dividend_election'];
/** Optional: without it the help line and Go deeper's "The tax cost, in the Act" are left out. */
export const OPTIONAL = ['life_insurance_policy_acb_definition'];

/** The rules the tool needs, read from the confirmed facts. Throws, naming the id, if a required fact is missing;
 *  acbRule comes back null when its fact is missing. */
export function insuranceRules(facts) {
  const F = confirmed(facts), used = [];
  const take = (id) => { const f = need(F, id); used.push(f); return f; };

  // the rate year: the latest year in which all four yearly series are confirmed
  const sets = RATE_SERIES.map((s) => new Set(yearsOf(F, s)));
  const common = [...sets[0]].filter((y) => sets.every((s) => s.has(y)));
  if (!common.length) {
    // name what is missing in the year closest to complete (the latest such year)
    const years = [...new Set(sets.flatMap((s) => [...s]))];
    const have = (y) => sets.filter((s) => s.has(y)).length;
    const best = years.sort((a, b) => have(b) - have(a) || b - a)[0];
    fail(best == null ? RATE_SERIES.map((s) => `${s}.Y`).join(', ') : RATE_SERIES.filter((s, i) => !sets[i].has(best)).map((s) => `${s}.${best}`).join(', '));
  }
  const rateYear = Math.max(...common);
  const fedTop = topRate(take(`federal_brackets.${rateYear}`));
  const onTop = topRate(take(`ontario_brackets.${rateYear}`));
  const surtaxF = take(`ontario_surtax.${rateYear}`);
  // the surtax rows add together (they are not brackets); at the top rate basic Ontario tax is above every row's from
  const surtaxRows = surtaxF.value.map((r) => Number(r.rate) / 100);
  const surtax = surtaxRows.reduce((s, r) => s + r, 0);
  const onDTC = pct(take(`ontario_dividend_tax_credit_non_eligible.${rateYear}`));
  const [gu, fdtc, base, add, less, elect] = REQUIRED.map(take);
  const grossUp = pct(gu), fedDTC = pct(fdtc);
  const acbF = find(F, OPTIONAL[0]);
  if (acbF) used.push(acbF);
  // a later year whose Ontario credit is already confirmed and lower than the rate year's (the page says so: the tax on
  // the taxable part would be higher then, other rates unchanged)
  const laterF = F.filter((f) => f.series === 'ontario_dividend_tax_credit_non_eligible' && f.tax_year > rateYear && pct(f) < onDTC).sort((a, b) => a.tax_year - b.tax_year)[0] || null;
  if (laterF) used.push(laterF);

  // the top rate on a non-eligible dividend, per $1 of dividend: the federal credit is a share of the gross-up (121(a));
  // the Ontario credit is a share of the federal gross-up (19.1) and comes off after the surtax (16(2))
  const fed = (1 + grossUp) * fedTop - grossUp * fedDTC;
  const on = (1 + grossUp) * onTop * (1 + surtax) - grossUp * onDTC;
  return {
    rateYear, grossUp, fedDTC, onDTC, fedTop, onTop, surtax, surtaxRows, fed, on, rate: fed + on,
    text: { cdaAdd: add, cdaLess: less, election: elect, surtaxBase: base, acbRule: acbF },
    acbRule: acbF ? acbF.value : null,
    onDTCLater: laterF ? { year: laterF.tax_year, id: laterF.id } : null,
    ids: {
      grossUp: gu.id, fedDTC: fdtc.id, onDTC: `ontario_dividend_tax_credit_non_eligible.${rateYear}`,
      fedTop: `federal_brackets.${rateYear}`, onTop: `ontario_brackets.${rateYear}`, surtax: surtaxF.id, surtaxBase: base.id,
      cdaAdd: add.id, cdaLess: less.id, election: elect.id, acbRule: acbF ? acbF.id : null,
    },
    used,
  };
}

/** Income tax on a taxable (non-eligible) dividend at the top rate, rounded once to the dollar, never more than the
 *  dividend. */
export function taxOn(R, amount) {
  return Math.min(amount, Math.round(amount * R.rate / ROUND) * ROUND);
}

/** Where the payout goes. inp: { payout, acb } in dollars. The tax cost is clamped to the payout. */
export function split(R, inp) {
  const payout = Math.max(0, inp.payout), acb = Math.max(0, Math.min(inp.acb, payout));
  const cda = payout - acb;                 // 89(1) CDA (d): the proceeds less the tax cost just before the death
  const capDiv = cda;                       // elected in full, on time (83(2)): not in the family's income
  const taxable = acb;                      // paid out now as a taxable (non-eligible) dividend
  const tax = taxOn(R, taxable);
  const afterTax = taxable - tax;
  const cTax = taxOn(R, payout);
  const state = acb === 0 ? 'noCost' : acb === payout ? 'allCost' : 'normal';
  return {
    inp: { payout, acb }, clamped: acb !== inp.acb,
    cda, capDiv, taxable, tax, afterTax, family: capDiv + afterTax,
    compare: { tax: cTax, family: payout - cTax },
    state,
  };
}

/** The numbers behind the chart: the tax cost at each share of the payout (snapped to the slider's grid), each row with
 *  its split. acbNow marks the current state's row (added when it is not one of them). */
export function tableRows(R, payout, acbNow) {
  const step = BOUNDS.acb.step;
  const acbs = BOUNDS.tableShares.map((s) => Math.round(payout * s / step) * step);
  if (acbNow != null && !acbs.includes(acbNow)) acbs.push(acbNow);
  return [...new Set(acbs)].sort((a, b) => a - b).map((acb) => ({ acb, now: acb === acbNow, ...split(R, { payout, acb }) }));
}

/** The dividend tax on $100 of non-eligible dividend, line by line, each line rounded to the cent (Go deeper). The
 *  Ontario surtax is figured on the shown Ontario tax, so the lines add to the shown total. */
export function per100(R) {
  const d = 100, grossed = toCents(d * (1 + R.grossUp)), gross = toCents(d * R.grossUp);
  const fedTax = toCents(grossed * R.fedTop), fedCredit = toCents(gross * R.fedDTC);
  const onTax = toCents(grossed * R.onTop), surtax = toCents(onTax * R.surtax), onCredit = toCents(gross * R.onDTC);
  const total = toCents(fedTax - fedCredit + onTax + surtax - onCredit);
  return { dividend: d, grossed, gross, fedTax, fedCredit, onTax, surtax, onCredit, total, exact: toCents(d * R.rate) };
}
