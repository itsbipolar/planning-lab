import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rules, cppFactor, oasFactor, breakEven, cppCrossing, oasCrossing, cppTotal, oasTotal, recovery, spouse, couple, headline } from '../calc.mjs';

const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts;
const golden = JSON.parse(readFileSync(new URL('../fixtures/golden.json', import.meta.url), 'utf8'));
const story = JSON.parse(readFileSync(new URL('../story.json', import.meta.url), 'utf8'));
const r = rules(facts);
const close = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);
const maybe = (a, b, what) => (b === null ? assert.equal(a, null, what) : close(a, b, what));

test('cases computed independently (tests/golden.py) match', () => {
  assert.equal(golden.threshold, r.recovery.id);
  assert.ok(golden.cases.length >= 5);
  for (const g of golden.cases) {
    const out = spouse(r, g.input);
    close(out.cppMonthly, g.cppMonthly, 'CPP monthly');
    close(out.oasMonthly, g.oasMonthly, 'OAS monthly');
    maybe(out.cppCrossing, g.cppCrossing, 'CPP crossing');
    maybe(out.oasCrossing, g.oasCrossing, 'OAS crossing');
    close(out.net, g.net, 'net income');
    close(out.recovery, g.recovery, 'recovery');
    assert.equal(out.recoveryCapped, g.capped);
  }
});

test('the threshold is the latest confirmed year, and the rate and boost come from the facts', () => {
  const years = facts.filter((f) => f.series === 'oas_recovery_threshold' && f.status === 'confirmed').map((f) => f.tax_year);
  assert.equal(r.recovery.year, Math.max(...years));
  assert.ok(r.oas.boostAge > r.oas.latest, 'the OAS rise comes after the latest start age');
  assert.ok(r.sources.every((s) => s.source_url.startsWith('https://')));
});

test('the standard ages change nothing', () => {
  assert.equal(cppFactor(r, r.cpp.standard), 1);
  assert.equal(oasFactor(r, r.oas.start), 1);
  assert.equal(cppCrossing(r, r.cpp.standard), null);
  assert.equal(oasCrossing(r, r.oas.start), null);
});

test('CPP: at the crossing age the two lifetime totals are equal, for every start age', () => {
  for (let age = r.cpp.earliest; age <= r.cpp.latest; age++) {
    if (age === r.cpp.standard) continue;
    const m = 1000 * cppFactor(r, age), x = cppCrossing(r, age);
    close(cppTotal(age, m, x), cppTotal(r.cpp.standard, 1000, x), `age ${age}`);
    close(x, breakEven(cppFactor(r, age), age, r.cpp.standard), 'same as the planning-timeline break-even');
    assert.ok(x > Math.max(age, r.cpp.standard));
  }
});

test('CPP: the headline crossing (standard against latest) is about 82 with these facts, and is not typed', () => {
  const h = headline(r, r.cpp.latest);
  assert.equal(h.kind, 'later'); assert.equal(h.from, r.cpp.standard); assert.equal(h.to, r.cpp.latest);
  const share = 1 + (r.cpp.latest - r.cpp.standard) * 12 * r.cpp.increasePerMonth;
  close(h.at, (share * r.cpp.latest - r.cpp.standard) / (share - 1), 'years-of-pension arithmetic');
  assert.deepEqual(headline(r, r.cpp.standard), { kind: 'standard', from: r.cpp.standard, to: r.cpp.latest, at: h.at });
  assert.equal(headline(r, r.cpp.earliest).kind, 'earlier');
  assert.ok(headline(r, r.cpp.earliest).at > r.cpp.standard);
});

test('OAS: at the crossing age the totals are equal, counting the rise at the boost age', () => {
  for (let age = r.oas.start + 1; age <= r.oas.latest; age++) {
    const m = 700 * oasFactor(r, age), x = oasCrossing(r, age);
    close(oasTotal(r, age, m, x), oasTotal(r, r.oas.start, 700, x), `age ${age}`);
    assert.ok(x > age);
  }
  // the rise applies to both starts, so it moves the latest-start crossing earlier than the straight-line one
  const s = oasFactor(r, r.oas.latest);
  assert.ok(oasCrossing(r, r.oas.latest) < breakEven(s, r.oas.latest, r.oas.start));
});

test('the crossing age does not depend on the amount', () => {
  const age = r.cpp.earliest;
  const a = breakEven(cppFactor(r, age), age, r.cpp.standard);
  const x1 = (500 * r.cpp.standard - 500 * cppFactor(r, age) * age) / (500 - 500 * cppFactor(r, age));
  const x2 = (1800 * r.cpp.standard - 1800 * cppFactor(r, age) * age) / (1800 - 1800 * cppFactor(r, age));
  close(a, x1, 'small'); close(a, x2, 'large');
});

test('recovery: zero below the threshold, the rate above it, never more than the OAS', () => {
  const T = r.recovery.threshold, rate = r.recovery.rate;
  assert.equal(recovery(r, T - 1, 9000), 0);
  assert.equal(recovery(r, T, 9000), 0);
  close(recovery(r, T + 1000, 9000), 1000 * rate, 'rate above the threshold');
  assert.equal(recovery(r, T + 1e7, 9000), 9000, 'capped at the OAS paid');
  const capped = spouse(r, { cppAge: r.cpp.standard, oasAge: r.oas.start, cppAt65: 1000, oasAt65: 700, other: 500000 });
  assert.equal(capped.recovery, 12 * capped.oasMonthly); assert.equal(capped.recoveryCapped, true);
  const none = spouse(r, { cppAge: r.cpp.standard, oasAge: r.oas.start, cppAt65: 1000, oasAt65: 700, other: 0 });
  assert.equal(none.recovery, 0); assert.equal(none.recoveryCapped, false);
});

test('both spouses: each is worked out on their own income, not the two combined', () => {
  const [A, B] = ['a', 'b'].map((w) => story.people[w]);
  const ages = (p) => ({
    cppAge: { earliest: r.cpp.earliest, standard: r.cpp.standard, latest: r.cpp.latest }[p.cppAge.from] + (p.cppAge.years || 0),
    oasAge: { earliest: r.oas.start, standard: r.oas.start, latest: r.oas.latest }[p.oasAge.from] + (p.oasAge.years || 0),
  });
  const a = { ...ages(A), cppAt65: A.cppAt65, oasAt65: A.oasAt65, other: A.other };
  const b = { ...ages(B), cppAt65: B.cppAt65, oasAt65: B.oasAt65, other: B.other };
  const out = couple(r, a, b);
  assert.ok(out.a.recovery > 0, 'the example has one spouse above the threshold');
  assert.equal(out.b.recovery, 0, 'and one below it');
  // moving one spouse's income never changes the other's recovery
  const richer = couple(r, a, { ...b, other: b.other * 2 });
  assert.equal(richer.a.recovery, out.a.recovery);
  // the combined income would give a different (wrong) answer, which the letter does not use
  const combined = recovery(r, out.a.net + out.b.net, 12 * (out.a.oasMonthly + out.b.oasMonthly));
  assert.notEqual(combined, out.a.recovery + out.b.recovery);
  // the example's headline is the standard-against-latest crossing
  assert.equal(a.cppAge, r.cpp.latest);
});

test('later starts pay more each month, across the whole range', () => {
  for (let age = r.cpp.earliest + 1; age <= r.cpp.latest; age++) assert.ok(cppFactor(r, age) > cppFactor(r, age - 1));
  for (let age = r.oas.start + 1; age <= r.oas.latest; age++) assert.ok(oasFactor(r, age) > oasFactor(r, age - 1));
});

test('bad inputs are refused, and a missing confirmed fact stops the rules', () => {
  assert.throws(() => cppFactor(r, r.cpp.earliest - 1), RangeError);
  assert.throws(() => cppFactor(r, r.cpp.latest + 1), RangeError);
  assert.throws(() => oasFactor(r, r.oas.start - 1), RangeError);
  assert.throws(() => cppFactor(r, r.cpp.standard + 0.3), RangeError);
  assert.throws(() => oasFactor(r, r.oas.start + 0.05), RangeError);
  assert.throws(() => spouse(r, { cppAge: r.cpp.standard, oasAge: r.oas.start, cppAt65: -1, oasAt65: 1, other: 0 }), RangeError);
  for (const id of ['cpp_late_start_increase', 'oas_age75_increase', 'oas_recovery_rate']) {
    assert.throws(() => rules(facts.filter((f) => f.id !== id)), /missing/, id);
  }
  assert.throws(() => rules(facts.filter((f) => f.series !== 'oas_recovery_threshold')), /missing/);
  assert.throws(() => rules(facts.map((f) => (f.id === 'oas_recovery_rate' ? { ...f, status: 'unverified' } : f))), /missing/);
});

test('start ages step a month at a time, as the rules count them', () => {
  const m = 1 / 12;
  close(cppFactor(r, r.cpp.standard + m), 1 + r.cpp.increasePerMonth, 'one month late');
  close(cppFactor(r, r.cpp.standard - m), 1 - r.cpp.reductionPerMonth, 'one month early');
  close(oasFactor(r, r.oas.start + 4 * m), 1 + 4 * r.oas.increasePerMonth, 'four months of OAS deferral');
  // every month of the range rises, and each later CPP start catches up with the standard one later in life
  let prev = -Infinity, prevCross = -Infinity;
  for (let k = r.cpp.earliest * 12; k <= r.cpp.latest * 12; k++) {
    const f = cppFactor(r, k / 12);
    assert.ok(f > prev, `month ${k}`); prev = f;
    if (k > r.cpp.standard * 12) { const c = cppCrossing(r, k / 12); assert.ok(c > prevCross && c > k / 12); prevCross = c; }
  }
  for (let k = r.oas.start * 12 + 1; k <= r.oas.latest * 12; k++) assert.ok(oasCrossing(r, k / 12) > k / 12, `OAS month ${k}`);
  assert.equal(cppCrossing(r, (r.cpp.standard * 12) / 12), null);
});
