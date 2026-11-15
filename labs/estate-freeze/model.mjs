// Estate freeze: the engine. Pure functions (no DOM, no I/O), written from scratch for this tool: it takes the facts
// list and the inputs and returns everything the page shows. build.mjs inlines it into the page (export stripped) and
// the tests import it. Every rate comes from shared/facts.json (confirmed values only); the only numbers typed here are
// the example's assumptions (EXAMPLE), the controls' ranges (BOUNDS) and the display rounding (the formatters).

// @@EXAMPLE: the made-up retiree the page opens on. Example assumptions, not facts.
export const EXAMPLE = {
  label: 'Example assumptions, not facts',
  value: 7_500_000, cost: 2_500_000, growth: 0.04, freezeAge: 70,
  income: 100_000, eligibleShare: 0.5, incomeGrowth: 0.02,
  // deathAge is not typed: defaultDeathAge(R, freezeAge) reads it from the life-expectancy facts
};
// @@END

// @@BOUNDS: the controls' ranges and steps. UI bounds, not facts.
export const BOUNDS = {
  label: 'UI bounds, not facts',
  value: { min: 1_000_000, max: 25_000_000, step: 250_000, page: 1_000_000, midTick: 10_000_000 },
  cost: { min: 0, step: 250_000 },                       // max: the current value
  growth: { min: 0, max: 0.08, step: 0.005 },
  freezeAge: { min: 55, max: 85, step: 1 },
  deathAge: { max: 100, step: 1 },                       // min: the freeze age + 1
  income: { min: 0, max: 500_000, step: 10_000 },
  eligibleShare: { min: 0, max: 1, step: 0.1 },
  incomeGrowth: { min: 0, max: 0.04, step: 0.005 },
};
// @@END

const fail = (id) => { throw new Error(`estate-freeze: the confirmed fact ${id} is missing (no fallback value is used)`); };
const confirmed = (facts) => (Array.isArray(facts) ? facts : facts.facts).filter((f) => f.status === 'confirmed' && f.value != null);
const find = (F, id) => F.find((f) => f.id === id) || null;
const need = (F, id) => find(F, id) || fail(id);
const pct = (f) => Number(f.value) / 100;
const topRate = (f) => { const row = f.value.find((r) => r.to == null); if (!row) fail(f.id); return Number(row.rate) / 100; };
const yearsOf = (F, series) => F.filter((f) => f.series === series && f.tax_year != null).map((f) => f.tax_year);

export const RATE_SERIES = ['federal_brackets', 'ontario_brackets', 'ontario_surtax'];
export const REQUIRED = ['capital_gains_inclusion_rate', 'refundable_investment_income_rate', 'part_iv_tax_rate',
  'dividend_refund_rate', 'trust_deemed_disposition_years', 'life_expectancy_age70_male', 'life_expectancy_age70_female'];
export const EAT_IDS = ['ontario_estate_admin_tax_rate', 'ontario_estate_admin_tax_exemption'];
export const CORP_IDS = ['federal_corporate_basic_rate', 'federal_corporate_abatement', 'ccpc_additional_refundable_tax_rate', 'ontario_corporate_general_rate'];

/** The rules the tool needs, read from the confirmed facts. Throws, naming the id, if a required fact is missing; the
 *  estate administration tax (eat) and the corporate rates (corpInvest) are optional and come back null when missing. */
export function freezeRules(facts) {
  const F = confirmed(facts), used = [];
  const take = (id) => { const f = need(F, id); used.push(f); return f; };

  // the rate year: the latest year in which all three rate tables are confirmed
  const sets = RATE_SERIES.map((s) => new Set(yearsOf(F, s)));
  const common = [...sets[0]].filter((y) => sets.every((s) => s.has(y)));
  if (!common.length) {
    const latest = Math.max(...sets.flatMap((s) => [...s]));
    fail(RATE_SERIES.filter((s, i) => !sets[i].has(latest)).map((s) => `${s}.${Number.isFinite(latest) ? latest : 'Y'}`).join(', ') || RATE_SERIES.join(', '));
  }
  const rateYear = Math.max(...common);
  const fedTop = topRate(take(`federal_brackets.${rateYear}`));
  const onTop = topRate(take(`ontario_brackets.${rateYear}`));
  const surtaxRows = take(`ontario_surtax.${rateYear}`).value;
  // the surtax rows add together (they are not brackets); at the top rate basic Ontario tax is above every row's from
  const surtax = surtaxRows.reduce((s, r) => s + Number(r.rate) / 100, 0);

  const [incl, refI, p4, refund, trustF, male, female] = REQUIRED.map(take);
  const inclusion = pct(incl), topOrdinary = fedTop + onTop * (1 + surtax);
  const ageRe = new RegExp('at age (\\d+)'), periodRe = new RegExp('(\\d{4}) to (\\d{4})');
  const age = Number((male.title.match(ageRe) || female.title.match(ageRe) || fail('life_expectancy_age70_male (age in title)'))[1]);
  const period = male.title.match(periodRe) || fail('life_expectancy_age70_male (period in title)');

  let eat = null;
  if (EAT_IDS.every((id) => find(F, id))) {
    const rate = take(EAT_IDS[0]), ex = take(EAT_IDS[1]);
    const per = rate.title.match(new RegExp('per \\$([\\d,]+)'));
    if (!per) throw new Error(`estate-freeze: ${EAT_IDS[0]}'s title does not say "per $<amount>"`);
    eat = { rate: Number(rate.value), exemption: Number(ex.value), per: Number(per[1].replace(/,/g, '')) };
  }
  let corpInvest = null;
  if (CORP_IDS.every((id) => find(F, id))) {
    const [basic, abate, addl, ont] = CORP_IDS.map(take);
    corpInvest = pct(basic) - pct(abate) + pct(addl) + pct(ont);
  }
  return {
    rateYear, fedTop, onTop, surtax, inclusion, topOrdinary, cgRate: inclusion * topOrdinary,
    refInvest: pct(refI), partIV: pct(p4), refundRate: pct(refund), trustYears: Number(trustF.value),
    lifeTable: { male: Number(male.value), female: Number(female.value), age, from: Number(period[1]), to: Number(period[2]), url: male.source_url },
    eat, corpInvest, used,
  };
}

/** The example's age at death: the freeze age plus the average of the men's and women's life expectancy at the table's
 *  age, rounded. An example age at death, not a life expectancy for anyone. */
export function defaultDeathAge(R, freezeAge) {
  return freezeAge + Math.round((R.lifeTable.male + R.lifeTable.female) / 2);
}

/** Estate administration tax on an estate value (null when the facts are missing). */
export function eatOn(R, estate) {
  if (!R.eat) return null;
  const { rate, exemption, per } = R.eat;
  return estate <= exemption ? 0 : Math.ceil((estate - exemption) / per) * rate;
}

/** The inputs, clamped to what the model allows: the cost to the value, the death age past the freeze age. */
export function normalise(R, inp) {
  const value = Math.max(0, inp.value), cost = Math.max(0, Math.min(inp.cost, value));
  const deathAge = Math.max(inp.freezeAge + 1, inp.deathAge);
  return { ...inp, value, cost, deathAge, costClamped: cost !== inp.cost, deathClamped: deathAge !== inp.deathAge };
}

/** The year loop and everything at death. inp: { value, cost, growth, freezeAge, deathAge, income, eligibleShare,
 *  incomeGrowth }. Amounts in dollars, rates as fractions. */
export function freeze(R, raw) {
  const inp = normalise(R, raw);
  const { value, cost, growth, freezeAge, deathAge, income, eligibleShare, incomeGrowth } = inp;
  const n = deathAge - freezeAge;
  const note = cost;                 // the note takes the tax cost, so it carries no gain
  const pref0 = value - cost;        // fixed-value preferred shares: their tax cost is nil
  let prefLeft = pref0, redeemed = 0, exhaustedAge = null, leftoverTotal = 0;
  const rows = [{ t: 0, age: freezeAge, V: value, income: 0, R: 0, prefLeft, redeemed: 0, trust: 0, gainNo: value - cost, gainWith: pref0 }];
  for (let t = 1; t <= n; t++) {
    const inc = income * (1 + incomeGrowth) ** (t - 1);
    const div = inc * eligibleShare, int = inc - div;
    const refundable = int * R.refInvest + div * R.partIV;
    const Rt = Math.min(refundable / R.refundRate, prefLeft);
    prefLeft -= Rt; redeemed += Rt;
    if (exhaustedAge == null && pref0 > 0 && prefLeft <= 0) exhaustedAge = freezeAge + t;
    const V = value * (1 + growth) ** t;
    const row = { t, age: freezeAge + t, V, income: inc, div, int, refundable, R: Rt, prefLeft, redeemed, trust: V - note - prefLeft, gainNo: V - cost, gainWith: prefLeft };
    if (R.corpInvest != null) {
      row.corpTax = int * R.corpInvest + div * R.partIV;
      row.refund = Rt * R.refundRate;
      row.cash = inc - row.corpTax + row.refund;
      row.leftover = row.cash - Rt;
      leftoverTotal += row.leftover;
    }
    rows.push(row);
  }
  const end = rows[n], cg = R.cgRate;
  const gainNo = end.gainNo, gainWith = end.gainWith, trust = end.trust;
  const taxNo = gainNo * cg, taxWith = gainWith * cg, pushed = taxNo - taxWith;
  const eatNo = eatOn(R, end.V);
  const eatWith = R.eat ? 0 : null;  // not payable (assumed): the note and preferred shares pass under a secondary will
  const deemedAge = freezeAge + R.trustYears;   // the trust is assumed to be set up at the freeze
  const deemedFirst = deemedAge <= deathAge;
  // in the deemedFirst state the trust's gain after its deemed sale restarts from that year's value (a new tax cost)
  const atDeemed = deemedFirst ? rows[deemedAge - freezeAge].trust : null;
  for (const r of rows) r.trustDrawn = deemedFirst && r.age >= deemedAge ? r.trust - atDeemed : r.trust;
  const state = pushed <= 0 ? 'nothing' : deemedFirst ? 'deemedFirst' : growth === 0 ? 'noGrowth' : 'normal';
  return {
    inp, n, note, pref0, rows, redeemed, Vn: end.V, gainNo, gainWith, trust,
    trustSplit: { growth: end.V - value, redemptions: redeemed },
    taxNo, taxWith, pushed, eatNo, eatWith,
    payableNo: taxNo + (eatNo || 0), payableWith: taxWith,
    deemedAge, deemedFirst, exhaustedAge, state,
    exhausted: exhaustedAge != null, noGainAtFreeze: pref0 === 0,
    leftoverTotal: R.corpInvest != null ? leftoverTotal : null,
    xMax: Math.max(deathAge, deemedAge),
  };
}

// @@FORMAT: display rounding only (shared by the page, the poster and the site's headlines).
const M = 1e6, K = 1e3;
const grp = (n, dp = 0) => n.toLocaleString('en-CA', { minimumFractionDigits: dp, maximumFractionDigits: dp });
/** The big readout: $X.XXM from $1M, $XXXK below, $0 at zero. */
export function fmtBig(n) {
  const v = Math.max(0, n);
  if (v >= M - 5 * K) return '$' + grp(v / M, 2) + 'M';
  if (v >= K / 2) return '$' + grp(Math.round(v / K)) + 'K';
  return '$' + grp(Math.round(v));
}
/** The ledger: $X.XXM. */
export const fmtM2 = (n) => '$' + grp(Math.max(0, n) / M, 2) + 'M';
/** Chart readings: $X.XM. */
export const fmtM1 = (n) => '$' + grp(Math.max(0, n) / M, 1) + 'M';
/** Inputs (the slider bubble, the cost stepper): as many decimals as the step needs ($7.5M, $7.25M, $10M, $750K). */
export function fmtInput(n) {
  if (n === 0) return '$0';
  if (n < M) return '$' + grp(n / K) + 'K';
  return '$' + (n / M).toLocaleString('en-CA', { maximumFractionDigits: 2 }) + 'M';
}
/** Redemptions and other yearly amounts: $XX,XXX. */
export const fmtDollars = (n) => '$' + grp(Math.round(n));
/** Rates to 2 decimals, inputs to 1 (fractions in, per cent out). */
export const fmtRate = (r) => grp(r * 100, 2) + '%';
export const fmtPct = (r) => grp(r * 100, 1) + '%';
/** Axis labels on the chart: $4M, $12M, $0.5M. */
export const fmtAxis = (n) => '$' + (n / M).toLocaleString('en-CA', { maximumFractionDigits: 1 }) + 'M';
// @@END
