// The shared core (shared/desk/your-year-core.mjs) gives the numbers the tool showed before it existed, for 1960, 1980 and
// 2000; its prices equal Money, then and now's; and it holds no figure from the facts file. The site's home lead runs the
// same module, so these are the home page's numbers too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { yourYearRules, annualPrices, yourYear, dollars, rounded, BASE_AMOUNT } from '../../../shared/desk/your-year-core.mjs';
import { buildModel, person } from '../model.mjs';
import { annual } from '../../money-then-now/build.mjs';
import { worth } from '../../money-then-now/model.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const facts = JSON.parse(read('../../../shared/facts.json'));
const pop = JSON.parse(read('../../../shared/data/population-by-age.json'));
const cpiText = read('../../../shared/data/cpi-monthly.json'), cpi = JSON.parse(cpiText);
const M = buildModel(facts, pop, cpi);
const R = yourYearRules(facts), P = annualPrices(cpi);
const YEARS = [1960, 1980, 2000];
const NOWS = [2026, new Date().getFullYear()];

// The tool's person() as it was before the core (copied from model.mjs at commit time), as the independent reference.
function legacyPerson(M, birthYear, thisYear) {
  const R = M.r, age = thisYear - birthYear;
  const tStart = Math.max(birthYear + R.tfsaAge, R.tfsaYear);
  const known = Object.keys(M.tfsa).map(Number);
  const lastKnown = Math.max(...known);
  let room = 0; for (let y = tStart; y <= Math.min(thisYear, lastKnown); y++) room += M.tfsa[y] ?? 0;
  const missing = []; for (let y = tStart; y <= Math.min(thisYear, lastKnown); y++) if (!(y in M.tfsa)) missing.push(y);
  const where = (lo, hi) => (age < lo ? 'ahead' : age > hi ? 'past' : 'open');
  return {
    tfsa: { from: tStart - birthYear, startYear: tStart, room, roomTo: Math.min(thisYear, lastKnown), missing, open: tStart <= thisYear },
    cpp: { state: where(R.cppLo, R.cppHi), opens: birthYear + R.cppLo, closes: birthYear + R.cppHi },
    oas: { state: where(R.oasLo, R.oasHi), opens: birthYear + R.oasLo, closes: birthYear + R.oasHi, boostYear: birthYear + M.oasBoostAge },
    rrsp: { matures: birthYear + R.rrsp, state: age > R.rrsp ? 'past' : 'ahead' },
  };
}

test('the core gives the tool’s earlier numbers for 1960, 1980 and 2000, and the tool now reads them from the core', () => {
  for (const now of NOWS) for (const b of YEARS) {
    const old = legacyPerson(M, b, now), Y = yourYear(R, P, b, now), p = person(M, b, now);
    assert.equal(Y.tfsaSum, old.tfsa.room, `${b}: TFSA sum`);
    assert.equal(Y.tfsaStart, old.tfsa.startYear); assert.equal(Y.tfsaOpen, old.tfsa.open); assert.equal(Y.tfsaSumTo, old.tfsa.roomTo);
    assert.deepEqual(Y.tfsaMissing, old.tfsa.missing);
    assert.deepEqual([Y.y60, Y.y70, Y.cppTense], [old.cpp.opens, old.cpp.closes, old.cpp.state], `${b}: CPP window`);
    assert.deepEqual([Y.oasFrom, Y.oasTo, Y.oasBoostYear, Y.oasTense], [old.oas.opens, old.oas.closes, old.oas.boostYear, old.oas.state]);
    assert.deepEqual([Y.y71, Y.rrspTense], [old.rrsp.matures, old.rrsp.state]);
    // the tool's own outputs (what the page draws) are the core's
    assert.equal(p.lanes[0].room, Y.tfsaSum); assert.equal(p.lanes[0].startYear, Y.tfsaStart);
    assert.deepEqual([p.cpp.opens, p.cpp.closes, p.cpp.state], [Y.y60, Y.y70, Y.cppTense]);
    assert.deepEqual(p.core, Y);
  }
});

test('prices since the birth year equal Money, then and now’s, for 1960, 1980 and 2000', () => {
  const MT = annual(cpiText, read('../../../shared/data/prime-rate-weekly.json'));
  assert.equal(P.first, MT.first); assert.equal(P.last, MT.last);
  for (const b of YEARS) {
    const Y = yourYear(R, P, b, 2026), w = worth(MT, BASE_AMOUNT, b, MT.last);
    assert.equal(Y.cpiNowExact, w, `${b}: same arithmetic`);
    assert.equal(Y.cpiNow, rounded(w)); assert.equal(Y.cpiNowText, dollars(w));
    assert.equal(Y.cpiLatestYear, MT.last);
    assert.equal(Y.text.cpi, `What $${BASE_AMOUNT} bought in ${b} cost about ${Y.cpiNowText} in ${MT.last}.`);
  }
  assert.equal(yourYear(R, P, P.first - 1, 2026).cpiNow, null, 'outside the price data: no number');
});

test('the CPP line follows the tense for that year; the TFSA line says when it opens when the sum is 0', () => {
  const now = 2026;
  assert.match(yourYear(R, P, now - R.cppLo + 1, now).text.cpp, /^CPP can start \d{4} to \d{4}, if you qualify$/);
  assert.match(yourYear(R, P, now - R.cppStd, now).text.cpp, /^CPP can start any month until \d{4}, if you qualify$/);
  assert.match(yourYear(R, P, now - R.cppHi - 1, now).text.cpp, /^CPP could start from \d{4} \(that window has passed\)$/);
  const young = yourYear(R, P, now - R.tfsaAge + 2, now);
  assert.equal(young.tfsaSum, 0); assert.equal(young.text.tfsa, `TFSA opens in ${now + 2}`);
  assert.match(yourYear(R, P, 1980, now).text.tfsa, /^TFSA limits added up: \$[\d,]+$/);
});

test('a missing fact stops the core instead of drawing a guess', () => {
  assert.throws(() => yourYearRules({ facts: facts.facts.filter((f) => f.id !== 'cpp_latest_start_age') }), /not confirmed/);
});

test('no age, rate, limit or year from the facts file is written into the shared core', () => {
  const F = new Map(facts.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f.value]));
  const ids = [...F.keys()].filter((id) => /^(tfsa_|cpp_|oas_|rrsp_)/.test(id) && typeof F.get(id) !== 'object');
  const t = read('../../../shared/desk/your-year-core.mjs');
  for (const v of new Set(ids.map((id) => String(F.get(id))))) {
    assert.ok(!new RegExp(`(?<![\\w.-])${v.replace('.', '\\.')}(?![\\w.])`).test(t), `your-year-core.mjs contains ${v}`);
  }
  assert.ok(!/\b(document|window|globalThis|sessionStorage|localStorage)\.|^\s*import\s/m.test(t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'pure: no DOM and no import');
});
