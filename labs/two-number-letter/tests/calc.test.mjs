import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rules, cppFactor, oasFactor, crossingAge, total, letter } from '../calc.mjs';

const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts;
const golden = JSON.parse(readFileSync(new URL('../fixtures/golden.json', import.meta.url), 'utf8'));
const r = rules(facts);
const close = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);

test('five cases computed independently (tests/golden.py) match', () => {
  assert.equal(golden.threshold, r.threshold.id);
  for (const g of golden.cases) {
    const out = letter(r, g.input);
    close(out.cppMonthly, g.cppMonthly, 'CPP monthly');
    close(out.oasMonthly, g.oasMonthly, 'OAS monthly');
    close(out.incomeBothPaid, g.incomeBothPaid, 'income');
    assert.equal(out.aboveThreshold, g.aboveThreshold);
    if (g.cppCrossing === null) assert.equal(out.cppCrossing, null); else close(out.cppCrossing, g.cppCrossing, 'crossing');
  }
});

test('the standard ages change nothing', () => {
  assert.equal(cppFactor(r, r.cpp.standard), 1);
  assert.equal(oasFactor(r, r.oas.start), 1);
});

test('at the crossing age the two lifetime totals are equal', () => {
  for (let age = r.cpp.earliest; age <= r.cpp.latest; age++) {
    if (age === r.cpp.standard) continue;
    const m = 1000 * cppFactor(r, age);
    const x = crossingAge(age, m, r.cpp.standard, 1000);
    close(total(age, m, x), total(r.cpp.standard, 1000, x), `age ${age}`);
    assert.ok(x > Math.max(age, r.cpp.standard));
  }
});

test('the crossing age does not depend on the amount', () => {
  const age = r.cpp.earliest;
  const a = crossingAge(age, 500 * cppFactor(r, age), r.cpp.standard, 500);
  const b = crossingAge(age, 1800 * cppFactor(r, age), r.cpp.standard, 1800);
  close(a, b, 'crossing');
});

test('later starts pay more each month, across the whole range', () => {
  for (let age = r.cpp.earliest + 1; age <= r.cpp.latest; age++) assert.ok(cppFactor(r, age) > cppFactor(r, age - 1));
  for (let age = r.oas.start + 1; age <= r.oas.latest; age++) assert.ok(oasFactor(r, age) > oasFactor(r, age - 1));
});

test('bad inputs are refused', () => {
  assert.throws(() => cppFactor(r, r.cpp.earliest - 1), RangeError);
  assert.throws(() => cppFactor(r, r.cpp.latest + 1), RangeError);
  assert.throws(() => oasFactor(r, r.oas.start - 1), RangeError);
  assert.throws(() => cppFactor(r, r.cpp.standard + 0.5), RangeError);
  assert.throws(() => letter(r, { cppAge: r.cpp.standard, oasAge: r.oas.start, cppAt65: -1, oasAt65: 1, other: 0 }), RangeError);
  assert.throws(() => rules(facts.filter((f) => f.id !== 'cpp_late_start_increase')), /missing/);
});
