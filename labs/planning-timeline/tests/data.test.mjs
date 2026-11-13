// Your planning timeline: the numbers follow the facts, a missing fact stops the build, and no rule is typed into the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModel, person, finding, cppShare, oasShare, breakEven, rrifLeft } from '../model.mjs';

const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8'));
const pop = JSON.parse(readFileSync(new URL('../../../shared/data/population-by-age.json', import.meta.url), 'utf8'));
const F = new Map(facts.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f.value]));
const n = (id) => Number(F.get(id));
const M = buildModel(facts, pop);

test('TFSA room starts no earlier than the year the TFSA began, and adds up the confirmed limits', () => {
  const first = n('tfsa_first_year'), minAge = n('tfsa_minimum_age');
  const old = person(M, first - minAge - 20, 2026), young = person(M, 2026 - minAge - 3, 2026);
  assert.equal(old.lanes[0].startYear, first);
  assert.equal(young.lanes[0].startYear, 2026 - 3);
  let sum = 0; for (let y = first; y <= 2026; y++) sum += n(`tfsa_annual_limit.${y}`);
  assert.equal(old.lanes[0].room, sum);
  assert.deepEqual(old.lanes[0].missing, []);
});

test('CPP and OAS shares follow the per-month rates; the break-even arithmetic is consistent', () => {
  const std = n('cpp_standard_start_age'), lo = n('cpp_earliest_start_age'), hi = n('cpp_latest_start_age');
  assert.equal(cppShare(M, std), 1);
  assert.ok(Math.abs(cppShare(M, lo) - (1 - (std - lo) * 12 * n('cpp_early_start_reduction') / 100)) < 1e-12);
  assert.ok(Math.abs(cppShare(M, hi) - (1 + (hi - std) * 12 * n('cpp_late_start_increase') / 100)) < 1e-12);
  assert.ok(Math.abs(oasShare(M, n('oas_deferral_max_age')) - (1 + (n('oas_deferral_max_age') - n('oas_start_age')) * 12 * n('oas_deferral_increase') / 100)) < 1e-12);
  for (const a of [lo, hi]) {
    const s = cppShare(M, a), x = breakEven(s, a, std);
    assert.ok(Math.abs(s * (x - a) - (x - std)) < 1e-9, 'totals are equal at the break-even age');
  }
  assert.equal(breakEven(1, std, std), null);
});

test('RRIF: the share left only falls, and the OAS boost age comes from the fact', () => {
  assert.ok(rrifLeft(M, 0, 200) > 0 && rrifLeft(M, 0, 200) < 1);
  assert.equal(rrifLeft(M, 0, 0), 1);
  assert.ok(/at age (\d+)/.test(facts.facts.find((f) => f.id === 'oas_age75_increase').title));
  assert.ok(M.oasBoostAge > n('oas_deferral_max_age'));
});

test('the headline is one sentence for each kind of person', () => {
  for (const b of [1930, 1950, 1965, 1985, 2005]) { const s = finding(M, person(M, b, 2026)); assert.match(s, /^At \d+, .+\.$/); }
});

test('a missing fact stops the build instead of drawing a guess', () => {
  assert.throws(() => buildModel({ facts: facts.facts.filter((f) => f.id !== 'cpp_late_start_increase') }, pop), /not confirmed/);
});

test('no age, rate, factor or limit from the facts file is written into the page code', () => {
  const here = new URL('..', import.meta.url).pathname;
  const ids = ['tfsa_minimum_age', 'tfsa_first_year', 'cpp_earliest_start_age', 'cpp_standard_start_age', 'cpp_latest_start_age', 'cpp_early_start_reduction', 'cpp_late_start_increase',
    'oas_start_age', 'oas_deferral_max_age', 'oas_deferral_increase', 'oas_recovery_rate', 'rrsp_maturity_age', 'oas_recovery_threshold.2026'];
  const figures = new Set([...ids.map((id) => String(F.get(id))), ...F.get('rrif_minimum_factors').map((r) => r.factor), '42', '36', '7000', '109000']);
  for (const f of ['app.js', 'model.mjs', 'index.src.html', 'style.css']) {
    const t = readFileSync(here + f, 'utf8');
    for (const v of figures) assert.ok(!new RegExp(`(?<![\\w.-])${v.replace('.', '\\.')}(?![\\w.])`).test(t), `${f} contains ${v}`);
  }
});
