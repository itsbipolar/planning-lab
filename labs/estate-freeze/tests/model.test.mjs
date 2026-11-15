// The estate-freeze engine (model.mjs) against the example-sanity fixture and the confirmed facts, plus its behaviour at
// the edges: monotonic in the inputs, the cost clamp, zero growth, no income, the preferred shares bought back in full,
// the trust's 21st year before death, the shortest life, and missing facts (optional ones drop their lines, required
// ones stop the build, naming the id).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EXAMPLE, BOUNDS, freezeRules, defaultDeathAge, freeze, eatOn, RATE_SERIES, REQUIRED, EAT_IDS, CORP_IDS,
  fmtBig, fmtM2, fmtM1, fmtInput, fmtDollars, fmtRate, fmtPct,
} from '../model.mjs';

const ALL = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts;
const FX = JSON.parse(readFileSync(new URL('../fixtures/example-sanity.json', import.meta.url), 'utf8'));
const R = freezeRules(ALL);
const ex = (over = {}) => ({ ...EXAMPLE, deathAge: defaultDeathAge(R, EXAMPLE.freezeAge), ...over });
const run = (over) => freeze(R, ex(over));
const near = (got, [want, tol], what) => assert.ok(Math.abs(got - want) <= tol + 1e-9, `${what}: ${got} is not within ${tol} of ${want}`);
const without = (...ids) => ALL.filter((f) => !ids.some((id) => f.id === id));

test('the example matches the illustration it is checked against, using only confirmed facts', () => {
  const E = FX.expect, S = freeze(R, { ...FX.inputs, deathAge: defaultDeathAge(R, FX.inputs.freezeAge) });
  assert.deepEqual({ ...FX.inputs }, Object.fromEntries(Object.keys(FX.inputs).map((k) => [k, EXAMPLE[k]])), 'the page opens on the fixture inputs');
  assert.equal(defaultDeathAge(R, FX.inputs.freezeAge), E.deathAge);
  assert.equal(S.deemedAge, E.deemedAge);
  near(S.gainNo, E.gainNo, 'gain without a freeze');
  near(S.gainWith, E.gainWith, 'gain with the freeze');
  near(S.trust, E.trust, 'the trust\'s gain');
  near(S.taxNo, E.taxNo, 'tax at death without');
  near(S.taxWith, E.taxWith, 'tax at death with');
  near(S.pushed, E.pushed, 'tax pushed past death');
  near(S.eatNo, E.eatNo, 'estate administration tax without');
  near(S.eatWith, E.eatWith, 'estate administration tax with');
  near(S.payableNo - S.payableWith, E.difference, 'difference payable at death');
  near(S.rows[1].R, E.firstRedemption, 'first-year redemption');
  near(R.cgRate * 100, E.cgRatePercent, 'top rate on capital gains');
  // the trust's gain is its growth plus the redeemed shares, and the band always adds up to the no-freeze gain
  near(S.trustSplit.growth + S.trustSplit.redemptions, [S.trust, 1], 'trust split');
  for (const r of S.rows) near(r.gainWith + r.trust, [r.gainNo, 1e-3], `band at ${r.age}`);
  near(S.pushed, [S.trust * R.cgRate, 1e-3], 'pushed = trust × cgRate');
  // the company's leftover cash is ignored: under 1% of the redemptions
  assert.ok(S.leftoverTotal >= 0 && S.leftoverTotal < 0.01 * S.redeemed, `leftover ${S.leftoverTotal} vs ${S.redeemed}`);
  // display strings
  for (const [k, want] of Object.entries(FX.display)) assert.equal(k === 'pushed' ? fmtBig(S[k]) : fmtM2(S[k]), want, k);
  assert.equal(S.state, 'normal');
  assert.equal(S.deemedFirst, false);
});

test('every rate is read from the facts: the rate year is the latest complete one, and changing a fact changes the answer', () => {
  const years = RATE_SERIES.map((s) => ALL.filter((f) => f.series === s && f.status === 'confirmed' && f.value != null).map((f) => f.tax_year));
  const latest = Math.max(...years[0].filter((y) => years.every((ys) => ys.includes(y))));
  assert.equal(R.rateYear, latest);
  const top = (id) => Number(ALL.find((f) => f.id === id).value.find((r) => r.to == null).rate) / 100;
  const sur = ALL.find((f) => f.id === `ontario_surtax.${latest}`).value.reduce((s, r) => s + Number(r.rate) / 100, 0);
  const inc = Number(ALL.find((f) => f.id === 'capital_gains_inclusion_rate').value) / 100;
  assert.equal(R.cgRate, inc * (top(`federal_brackets.${latest}`) + top(`ontario_brackets.${latest}`) * (1 + sur)));
  for (const [k, id] of [['refInvest', 'refundable_investment_income_rate'], ['partIV', 'part_iv_tax_rate'], ['refundRate', 'dividend_refund_rate']])
    assert.equal(R[k], Number(ALL.find((f) => f.id === id).value) / 100, k);
  assert.equal(R.trustYears, Number(ALL.find((f) => f.id === 'trust_deemed_disposition_years').value));
  // a planted change to one fact moves the result (nothing is cached or typed)
  const bump = ALL.map((f) => (f.id === 'capital_gains_inclusion_rate' ? { ...f, value: String(Number(f.value) * 2) } : f));
  assert.ok(Math.abs(freeze(freezeRules(bump), ex()).taxNo - 2 * run().taxNo) < 1);
  const yrs = ALL.map((f) => (f.id === 'trust_deemed_disposition_years' ? { ...f, value: '10' } : f));
  assert.equal(freeze(freezeRules(yrs), ex()).deemedAge, EXAMPLE.freezeAge + 10);
  // the example's freeze age is the life table's age (the build asserts it too)
  assert.equal(EXAMPLE.freezeAge, R.lifeTable.age);
  assert.match(String(R.lifeTable.from), /^\d{4}$/);
  assert.equal(EXAMPLE.label, 'Example assumptions, not facts');
  assert.equal(BOUNDS.label, 'UI bounds, not facts');
});

test('monotonic: more value, more growth or a later death means more gain; more income means more redeemed', () => {
  let last = null;
  for (let v = BOUNDS.value.min; v <= BOUNDS.value.max; v += BOUNDS.value.page) {
    const S = run({ value: v });
    if (last) { assert.ok(S.gainNo > last.gainNo); assert.ok(S.pushed >= last.pushed - 1e-6, `pushed at ${v}`); }
    last = S;
  }
  last = null;
  for (let g = BOUNDS.growth.min; g <= BOUNDS.growth.max + 1e-9; g += BOUNDS.growth.step) {
    const S = run({ growth: g });
    if (last) { assert.ok(S.gainNo > last.gainNo); assert.ok(S.trust > last.trust); near(S.gainWith, [last.gainWith, 1e-6], 'growth does not change the frozen shares'); }
    last = S;
  }
  last = null;
  for (let d = EXAMPLE.freezeAge + 1; d <= BOUNDS.deathAge.max; d++) {
    const S = run({ deathAge: d });
    if (last) { assert.ok(S.gainNo > last.gainNo); assert.ok(S.gainWith <= last.gainWith + 1e-6); assert.ok(S.redeemed >= last.redeemed - 1e-6); }
    last = S;
  }
  last = null;
  for (let i = BOUNDS.income.min; i <= BOUNDS.income.max; i += BOUNDS.income.step * 5) {
    const S = run({ income: i });
    if (last) { assert.ok(S.redeemed >= last.redeemed - 1e-6); assert.ok(S.gainWith <= last.gainWith + 1e-6); near(S.gainNo, [last.gainNo, 1e-6], 'income does not change the gain'); }
    last = S;
  }
  last = null;
  for (let c = 0; c <= EXAMPLE.value; c += BOUNDS.cost.step * 4) {
    const S = run({ cost: c });
    if (last) { assert.ok(S.gainNo < last.gainNo); assert.ok(S.taxNo < last.taxNo); }
    last = S;
  }
});

test('edge: cost at or above the value is clamped; there is no gain at the freeze and all growth goes to the trust', () => {
  const S = run({ cost: EXAMPLE.value * 2 });
  assert.equal(S.inp.cost, EXAMPLE.value);
  assert.equal(S.inp.costClamped, true);
  assert.equal(S.pref0, 0);
  assert.equal(S.noGainAtFreeze, true);
  assert.equal(S.redeemed, 0);
  assert.equal(S.gainWith, 0);
  near(S.trust, [S.Vn - EXAMPLE.value, 1e-6], 'trust = growth');
  near(S.pushed, [S.gainNo * R.cgRate, 1e-6], 'all of the gain is pushed');
  assert.equal(S.exhaustedAge, null);
  assert.equal(run({ cost: EXAMPLE.value }).inp.costClamped, false);
});

test('edge: zero growth: the trust holds only the redeemed shares, and the state says so', () => {
  const S = run({ growth: 0 });
  near(S.Vn, [EXAMPLE.value, 1e-6], 'no growth');
  near(S.trust, [S.redeemed, 1e-6], 'trust = redemptions');
  near(S.pushed, [S.redeemed * R.cgRate, 1e-6], 'pushed = redeemed × cgRate');
  assert.equal(S.state, 'noGrowth');
  const Z = run({ growth: 0, income: 0 });
  assert.equal(Z.pushed, 0);
  assert.equal(Z.state, 'nothing');
});

test('edge: no income: nothing is redeemed, the frozen gain stays whole', () => {
  const S = run({ income: 0 });
  assert.equal(S.redeemed, 0);
  assert.equal(S.gainWith, S.pref0);
  for (const r of S.rows.slice(1)) assert.equal(r.R, 0);
});

test('edge: the preferred shares are bought back in full: the gain taxed at death is nil', () => {
  const S = run({ value: 1_000_000, cost: 0, income: 500_000 });
  assert.ok(S.exhaustedAge != null && S.exhaustedAge > EXAMPLE.freezeAge && S.exhaustedAge <= S.inp.deathAge, String(S.exhaustedAge));
  assert.equal(S.exhausted, true);
  assert.equal(S.gainWith, 0);
  assert.equal(S.taxWith, 0);
  near(S.redeemed, [S.pref0, 1e-6], 'redeemed all');
  for (const r of S.rows) assert.ok(r.prefLeft >= 0);
});

test('edge: the trust\'s 21st year before death, and the shortest life', () => {
  const S = run({ freezeAge: 60, deathAge: 87 });
  assert.equal(S.deemedAge, 60 + R.trustYears);
  assert.equal(S.deemedFirst, true);
  assert.equal(S.state, 'deemedFirst');
  assert.equal(S.xMax, 87);
  const after = S.rows.find((r) => r.age === S.deemedAge);
  assert.equal(after.trustDrawn, 0, 'the drawn trust gain restarts from zero at the deemed sale');
  assert.ok(S.rows.at(-1).trustDrawn > 0 && S.rows.at(-1).trustDrawn < S.trust);
  const one = run({ deathAge: EXAMPLE.freezeAge + 1 });
  assert.equal(one.n, 1);
  assert.equal(one.rows.length, 2);
  near(one.redeemed, FX.expect.firstRedemption, 'one year of redemption');
  const clamp = run({ deathAge: EXAMPLE.freezeAge });
  assert.equal(clamp.inp.deathAge, EXAMPLE.freezeAge + 1);
  assert.equal(clamp.inp.deathClamped, true);
  // the ends of every range run without NaN
  for (const over of [{ value: BOUNDS.value.min, cost: 0 }, { value: BOUNDS.value.max, growth: BOUNDS.growth.max, deathAge: BOUNDS.deathAge.max },
    { freezeAge: BOUNDS.freezeAge.min, deathAge: BOUNDS.deathAge.max, income: BOUNDS.income.max, eligibleShare: 1, incomeGrowth: BOUNDS.incomeGrowth.max },
    { freezeAge: BOUNDS.freezeAge.max, deathAge: BOUNDS.freezeAge.max + 1, eligibleShare: 0 }]) {
    const T = run(over);
    for (const k of ['gainNo', 'gainWith', 'trust', 'taxNo', 'taxWith', 'pushed', 'eatNo', 'redeemed']) assert.ok(Number.isFinite(T[k]) && T[k] >= 0, `${k} at ${JSON.stringify(over)}`);
  }
});

test('missing facts: estate administration tax and corporate rates drop their lines; every required fact stops the build by name', () => {
  const noEat = freezeRules(without(...EAT_IDS));
  assert.equal(noEat.eat, null);
  const S = freeze(noEat, ex());
  assert.equal(S.eatNo, null); assert.equal(S.eatWith, null);
  near(S.pushed, [run().pushed, 1e-6], 'the big answer never includes probate');
  assert.equal(eatOn(noEat, 1e7), null);
  const noCorp = freezeRules(without(CORP_IDS[0]));
  assert.equal(noCorp.corpInvest, null);
  const C = freeze(noCorp, ex());
  assert.equal(C.rows[1].cash, undefined); assert.equal(C.leftoverTotal, null);
  near(C.rows[1].R, FX.expect.firstRedemption, 'the redemption needs no corporate rate');
  for (const id of [...REQUIRED, `federal_brackets.${R.rateYear}`, `ontario_brackets.${R.rateYear}`, `ontario_surtax.${R.rateYear}`]) {
    // today no earlier year has all three rate tables, so removing one of the rate year's tables stops the build too
    assert.throws(() => freezeRules(without(id)), new RegExp(id.replace(/[.]/g, '\\.')), `removing ${id}`);
  }
  // a rate year is only one in which all three tables are confirmed (never a mix of years)
  const mixed = without(`ontario_surtax.${R.rateYear}`).concat([{ ...ALL.find((f) => f.id === `ontario_surtax.${R.rateYear}`), id: `ontario_surtax.${R.rateYear - 1}`, tax_year: R.rateYear - 1 }]);
  assert.equal(freezeRules(mixed).rateYear, R.rateYear - 1);
});

test('formatters', () => {
  assert.equal(fmtBig(2_384_834), '$2.38M');
  assert.equal(fmtBig(450_400), '$450K');
  assert.equal(fmtBig(999_700), '$1.00M');
  assert.equal(fmtBig(0), '$0');
  assert.equal(fmtM2(12_109_253), '$12.11M');
  assert.equal(fmtM1(12_109_253), '$12.1M');
  assert.equal(fmtInput(7_500_000), '$7.5M');
  assert.equal(fmtInput(7_250_000), '$7.25M');
  assert.equal(fmtInput(10_000_000), '$10M');
  assert.equal(fmtInput(750_000), '$750K');
  assert.equal(fmtInput(0), '$0');
  assert.equal(fmtDollars(90_000.0000001), '$90,000');
  assert.equal(fmtRate(R.cgRate), '26.76%');
  assert.equal(fmtPct(0.04), '4.0%');
});

test('the trust\'s anniversary before death: its gain then is taxed in life; only the growth since is deferred past death', () => {
  const S = run({ freezeAge: EXAMPLE.freezeAge - 10 });
  assert.equal(S.state, 'deemedFirst');
  near(S.trustTaxedEarly, [11_910_000, 10_000], 'gain deemed realized at the anniversary');
  near(S.trustHeld, [5_390_000, 10_000], 'growth since, held at death');
  near(S.trustHeld + S.trustTaxedEarly, [S.trust, 1e-3], 'the two parts add up to the trust\'s shares');
  near(S.deferred, [S.trustHeld * R.cgRate, 1e-3], 'deferred = held × cgRate');
  near(S.taxTrustEarly, [S.trustTaxedEarly * R.cgRate, 1e-3], 'taxed in life');
  assert.ok(S.deferred < S.pushed);
  assert.equal(S.nextDeemedAge, S.deemedAge + R.trustYears);
  // the normal state defers all of it
  const N = run();
  assert.equal(N.trustHeld, N.trust); assert.equal(N.trustTaxedEarly, 0); assert.equal(N.deferred, N.pushed); assert.equal(N.nextDeemedAge, N.deemedAge);
  // two anniversaries before death: the drawn gain restarts at each
  const T = run({ freezeAge: BOUNDS.freezeAge.min, deathAge: BOUNDS.deathAge.max });
  const k2 = 2 * R.trustYears;
  assert.ok(k2 <= T.n);
  assert.equal(T.rows[k2].trustDrawn, 0);
  near(T.trustTaxedEarly, [T.rows[k2].trust, 1e-3], 'taxed in life up to the last anniversary');
  assert.equal(T.nextDeemedAge, T.inp.freezeAge + 3 * R.trustYears);
});
