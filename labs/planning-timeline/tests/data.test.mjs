// Your planning timeline: the numbers follow the facts, a missing fact stops the build, and no rule is typed into the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModel, person, finding, cppShare, oasShare, breakEven, rrifLeft, boxScore, windowText, rrifRule } from '../model.mjs';

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

// ---------- the box score (redesign v2, step 5) ----------
const row = (b, key, now = 2026) => boxScore(M, person(M, b, now)).find((r) => r.key === key);

test('the box score tense: 1950 has every window passed, 1962 has CPP open now, 1980 has every window ahead (in 2026)', () => {
  const lo = n('cpp_earliest_start_age'), hi = n('cpp_latest_start_age'), oLo = n('oas_start_age'), oHi = n('oas_deferral_max_age'), rr = n('rrsp_maturity_age');
  assert.equal(row(1950, 'cpp').value, `Could start from ${1950 + lo} (that window has passed)`);
  assert.equal(row(1950, 'oas').value, `Could start from ${1950 + oLo} (that window has passed)`);
  assert.equal(row(1950, 'rrsp').value, `Had to wind up by the end of ${1950 + rr} (most become a RRIF)`);
  assert.equal(row(1962, 'cpp').value, `Can start any month until ${1962 + hi}`);
  assert.equal(row(1962, 'rrsp').value, `Must wind up by the end of ${1962 + rr} (most become a RRIF)`);
  assert.equal(row(1980, 'cpp').value, `Can start ${1980 + lo} to ${1980 + hi}`);
  assert.equal(row(1980, 'oas').value, `Can start ${1980 + oLo} to ${1980 + oHi}`);
  assert.equal(windowText('open', 1, 2), 'Can start any month until 2');
  // the qualifiers
  assert.equal(row(1980, 'cpp').label, 'CPP, if you qualify');
  assert.equal(row(1980, 'oas').label, 'OAS, if you meet the residence rules');
});

test('the box score figures come from the facts: CPP at each end, OAS deferral and the confirmed increase at the later age, the RRIF line', () => {
  const std = n('cpp_standard_start_age'), lo = n('cpp_earliest_start_age'), hi = n('cpp_latest_start_age');
  const early = Math.round((std - lo) * 12 * n('cpp_early_start_reduction') * 100) / 100, late = Math.round((hi - std) * 12 * n('cpp_late_start_increase') * 100) / 100;
  assert.equal(row(1980, 'cpp').line, `At ${lo} a ${early}% smaller cheque, for life; at ${hi}, ${late}% bigger.`);
  const oasLate = Math.round((n('oas_deferral_max_age') - n('oas_start_age')) * 12 * n('oas_deferral_increase') * 100) / 100;
  assert.match(row(1980, 'oas').line, new RegExp(`up to ${oasLate}% more a month; ${n('oas_age75_increase')}% more from ${M.oasBoostAge} \\(in ${1980 + M.oasBoostAge}\\)\\.$`));
  // once the increase's age is reached, no start year is claimed for it (the facts hold none), and a passed window says
  // its figures are today's rules
  for (const b of [1930, 1936, 1937, 1940, 1950]) {
    assert.doesNotMatch(row(b, 'oas').line, /\(since|\(in \d/, `born ${b}`);
    assert.ok(row(b, 'oas').line.endsWith(`${n('oas_age75_increase')}% more from ${M.oasBoostAge}.`), `born ${b}`);
  }
  assert.ok(row(1950, 'oas').line.startsWith('Under today’s rules, from '), row(1950, 'oas').line);
  assert.equal(row(1950, 'cpp').line, `Under today’s rules, at ${lo} a ${early}% smaller cheque, for life; at ${hi}, ${late}% bigger.`);
  assert.ok(!row(1962, 'cpp').line.startsWith('Under'), 'an open window reads plainly');
  const f = F.get('rrif_minimum_factors'), first = f.find((r) => r.age >= n('rrsp_maturity_age')), last = f.at(-1);
  assert.equal(rrifRule(M), `At least ${first.factor * 100}% must come out the year you turn ${first.age + 1}, rising to ${last.factor * 100}% from the year you turn ${last.age + 1}.`);
  assert.equal(row(1980, 'rrsp').line, rrifRule(M));
});

test('the TFSA row: the sum stops at the last confirmed limit; with nothing to add yet it reads "opens in"', () => {
  const years = [...F.keys()].filter((id) => /^tfsa_annual_limit\.\d{4}$/.test(id)).map((id) => Number(id.slice(-4))), last = Math.max(...years);
  for (const now of [last, last + 3]) {
    const r = row(1980, 'tfsa', now);
    let sum = 0; for (const y of years) if (y >= n('tfsa_first_year')) sum += n(`tfsa_annual_limit.${y}`);
    assert.equal(r.value, '$' + sum.toLocaleString('en-CA'), `in ${now}`);
    assert.ok(r.line.startsWith(`${n('tfsa_first_year')} to ${last},`), r.line);
    assert.doesNotMatch(row(last - n('tfsa_minimum_age'), 'tfsa', last).line, /(\d{4}) to \1/, 'one year reads once');
    assert.match(r.line, /before any contributions or withdrawals; if \d+ or older and living in Canada each year\.$/);
  }
  const kid = last - n('tfsa_minimum_age') + 2;
  assert.equal(row(kid, 'tfsa', last).value, `opens in ${kid + n('tfsa_minimum_age')}`);
});

test('the cohort row is there only for ages the snapshot covers (50 to 89 in it), and absent otherwise', () => {
  const [a0, a1] = pop.ages, now = 2026;
  for (const age of [a0 - 1, a1 + 1, now - 1980]) if (age < a0 || age > a1) assert.equal(row(now - age, 'cohort', now), undefined, `age ${age}`);
  for (const age of [a0, a1]) {
    const r = row(now - age, 'cohort', now);
    assert.equal(r.label, `Canadians aged ${age}`);
    assert.equal(r.value, pop.values[String(pop.years[1])][age - a0].toLocaleString('en-CA'));
    assert.equal(r.line, `On July 1, ${pop.years[1]}, by Statistics Canada’s estimate.`);
  }
});

test('no advice words in the box score, for every year the control offers', () => {
  for (let b = 1930; b <= 2008; b++) for (const r of boxScore(M, person(M, b, 2026))) {
    assert.doesNotMatch(r.label + r.value + r.line, /\b(should|recommend\w*)\b|best for you|best age|must become a RRIF/i);
  }
});
