// The engine against a hand calculation (fixtures/example-sanity.json), its invariants over the whole input grid, the
// states, the missing-fact behaviour and the move to the next rate year without a code change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAMPLE, BOUNDS, REQUIRED, OPTIONAL, RATE_SERIES, insuranceRules, split, tableRows, per100, money, pct2, factPct } from '../model.mjs';

const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts;
const fx = JSON.parse(readFileSync(new URL('../fixtures/example-sanity.json', import.meta.url), 'utf8'));
const R = insuranceRules(facts);
const near = (v, [want, tol], what) => assert.ok(Math.abs(v - want) <= tol, `${what}: ${v} vs ${want} ± ${tol}`);

test('the example matches the hand calculation', () => {
  const S = split(R, fx.inputs), e = fx.expect;
  assert.equal(R.rateYear, e.rateYear);
  near(R.rate * 100, e.ratePercent, 'rate'); near(R.fed, e.fed, 'fed'); near(R.on, e.on, 'on');
  assert.equal(S.capDiv, e.capDiv); assert.equal(S.tax, e.tax); assert.equal(S.afterTax, e.afterTax); assert.equal(S.family, e.family);
  assert.equal(S.compare.tax, e.compareTax); assert.equal(S.compare.family, e.compareFamily);
  assert.equal(S.state, 'normal');
  assert.deepEqual({ payout: EXAMPLE.payout, acb: EXAMPLE.acb }, fx.inputs);
  assert.equal(pct2(R.rate), fx.display.rate);
});

test('the Ontario credit comes off after the surtax; before it would give a different rate', () => {
  const before = (1 + R.grossUp) * R.fedTop - R.grossUp * R.fedDTC + ((1 + R.grossUp) * R.onTop - R.grossUp * R.onDTC) * (1 + R.surtax);
  assert.ok(Math.abs(before - R.rate) > 0.005, `${before} vs ${R.rate}`);
  assert.ok(R.used.some((f) => f.id === 'ontario_surtax_base'));
});

test('every sum is exact over the whole grid, and the money to the family never rises with the tax cost', () => {
  let n = 0;
  for (let payout = BOUNDS.payout.min; payout <= BOUNDS.payout.max; payout += BOUNDS.payout.step) {
    let last = null;
    for (let acb = 0; acb <= payout; acb += BOUNDS.acb.step) {
      const S = split(R, { payout, acb });
      assert.equal(S.capDiv + S.afterTax + S.tax, payout);
      assert.equal(S.compare.family + S.compare.tax, payout);
      assert.ok(S.tax >= 0 && S.afterTax >= 0 && Number.isInteger(S.tax) && Math.abs(S.tax - S.taxable * R.rate) <= 0.5);
      if (last) { assert.ok(S.capDiv <= last.capDiv); assert.ok(S.family <= last.family, `${payout} ${acb}`); }
      last = S; n++;
    }
  }
  assert.ok(n > 20000, `${n} states`);
});

test('the states: no tax cost, all tax cost, clamped; the longest figure', () => {
  assert.equal(split(R, { payout: 1e6, acb: 0 }).state, 'noCost');
  assert.equal(split(R, { payout: 1e6, acb: 1e6 }).state, 'allCost');
  const c = split(R, { payout: 250000, acb: 400000 });
  assert.equal(c.clamped, true); assert.equal(c.inp.acb, 250000); assert.equal(c.state, 'allCost'); assert.equal(c.capDiv, 0);
  assert.equal(split(R, EXAMPLE).clamped, false);
  const L = split(R, { payout: BOUNDS.payout.max, acb: 0 });
  assert.equal(money(L.capDiv), fx.display.max); assert.equal(L.tax, 0);
});

test('display strings, full dollars, never K or M', () => {
  assert.equal(money(800000), fx.display.capDiv); assert.equal(money(95480), fx.display.tax);
  assert.equal(money(1e6), fx.display.payout); assert.equal(money(1e7), fx.display.max); assert.equal(money(0), fx.display.zero);
  assert.deepEqual(['15', '69.2307692308', '22.895', '13.16', '33'].map(factPct), ['15%', '69.23%', '22.895%', '13.16%', '33%']);
});

test('the table: 0, 25, 50, 75 and 100% of the payout on the $10,000 grid, plus now', () => {
  const rows = tableRows(R, 1e6, EXAMPLE.acb);
  assert.deepEqual(rows.map((r) => r.acb), [0, 200000, 250000, 500000, 750000, 1000000]);
  assert.deepEqual(rows.filter((r) => r.now).map((r) => r.acb), [EXAMPLE.acb]);
  assert.deepEqual(tableRows(R, 250000, 250000).map((r) => r.acb), [0, 60000, 130000, 190000, 250000]);
});

test('the per-$100 lines add to the shown total within $0.02, and the total is the rate', () => {
  const L = per100(R);
  assert.ok(Math.abs(L.fedTax - L.fedCredit + L.onTax + L.surtax - L.onCredit - L.total) <= 0.02);
  assert.ok(Math.abs(L.total - R.rate * 100) <= 0.02);
});

test('a required fact missing or unverified stops it, naming the id; the optional one only drops its text', () => {
  for (const id of [...REQUIRED, 'federal_brackets.2026']) {
    assert.throws(() => insuranceRules(facts.filter((f) => f.id !== id)), new RegExp(id.replace('.', '\\.')), id);
    assert.throws(() => insuranceRules(facts.map((f) => (f.id === id ? { ...f, status: 'unverified' } : f))), new RegExp(id.split('.')[0]), id);
  }
  const R2 = insuranceRules(facts.filter((f) => f.id !== OPTIONAL[0]));
  assert.equal(R2.acbRule, null); assert.equal(R2.ids.acbRule, null);
  assert.equal(R2.rate, R.rate);
});

test('the rate year moves to 2027 by itself once its facts are confirmed, with the 2027 Ontario credit', () => {
  const fixture = {
    federal_brackets: [{ from: '0', to: '60000', rate: '14' }, { from: '60000.01', rate: '33' }],
    ontario_brackets: [{ from: '0', to: '55000', rate: '5.05' }, { from: '220000.01', rate: '13.16' }],
    ontario_surtax: [{ from: '6000', rate: '20' }, { from: '7600', rate: '36' }],
  };
  const copy = facts.map((f) => (f.tax_year === 2027 && fixture[f.series] ? { ...f, status: 'confirmed', value: fixture[f.series] } : f));
  const R7 = insuranceRules(copy);
  assert.equal(R7.rateYear, 2027);
  const on27 = Number(facts.find((f) => f.id === 'ontario_dividend_tax_credit_non_eligible.2027').value) / 100;
  assert.equal(R7.onDTC, on27);
  assert.ok(R7.rate > R.rate, 'a smaller Ontario credit gives a higher rate');
  for (const s of RATE_SERIES) assert.ok(R7.used.some((f) => f.id === `${s}.2027`), s);
  assert.equal(R7.onDTCLater, null, 'no later lower credit once 2027 is the rate year');
});

test('a later year with a confirmed, lower Ontario credit is named (the page says the tax would be higher then)', () => {
  const later = facts.filter((f) => f.series === 'ontario_dividend_tax_credit_non_eligible' && f.status === 'confirmed' && f.tax_year > R.rateYear && Number(f.value) / 100 < R.onDTC);
  if (!later.length) { assert.equal(R.onDTCLater, null); return; }
  assert.equal(R.onDTCLater.year, Math.min(...later.map((f) => f.tax_year)));
  assert.ok(R.used.some((f) => f.id === R.onDTCLater.id));
  const R2 = insuranceRules(facts.filter((f) => !later.includes(f)));
  assert.equal(R2.onDTCLater, null); assert.equal(R2.rate, R.rate);
});
