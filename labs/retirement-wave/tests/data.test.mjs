// The Retirement Wave: the snapshot is whole and dated, the model computes what the page says, and no rule age or count
// is written into the page's code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModel, cohort, RULES } from '../model.mjs';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const snap = json('../../../shared/data/population-by-age.json');
const facts = json('../../../shared/facts.json');
const M = buildModel(snap, facts);
const confirmed = new Map(facts.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));

test('the snapshot is whole: every year, every age, a positive count; dated and attributed', () => {
  const [y0, y1] = snap.years, [a0, a1] = snap.ages;
  assert.equal(Object.keys(snap.values).length, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) { assert.equal(snap.values[y].length, a1 - a0 + 1); assert.ok(snap.values[y].every((v) => Number.isInteger(v) && v > 0)); }
  assert.match(snap.retrieved, /^\d{4}-\d{2}-\d{2}$/); assert.match(snap.released, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(snap.attribution, /^Adapted from Statistics Canada, .*This does not constitute an endorsement by Statistics Canada of this product\.$/);
  assert.match(snap.source_url, /^https:\/\/www150\.statcan\.gc\.ca\//);
  assert.match(snap.doi, /^https:\/\/doi\.org\/10\.25318\/1710000501-eng$/);
});

test('the rule ages come from confirmed facts, grouped when two rules share an age', () => {
  const ages = new Set(RULES.map(([id]) => confirmed.get(id)).filter(Boolean).map((f) => Number(f.value)));
  assert.deepEqual(M.rules.map((r) => r.age), [...ages].sort((a, b) => a - b));
  for (const r of M.rules) for (const f of r.facts) assert.equal(Number(confirmed.get(f.id).value), r.age);
  assert.equal(M.rules.reduce((k, r) => k + r.facts.length, 0), RULES.filter(([id]) => confirmed.has(id)).length);
});

test('each rule age series, its first, last and peak are read from the snapshot', () => {
  const [a0] = snap.ages;
  for (const r of M.rules) {
    assert.equal(r.series.length, snap.years[1] - snap.years[0] + 1);
    for (const [y, v] of r.series) assert.equal(v, snap.values[y][r.age - a0]);
    assert.equal(r.peak[1], Math.max(...r.series.map((p) => p[1])));
    assert.equal(r.peakIsLast, r.peak[0] === snap.years[1]);
  }
});

test('a generation is a diagonal: age goes up one a year, and the default is the one at the youngest rule age\'s peak', () => {
  const path = cohort(M, M.defaultBorn);
  assert.ok(path.length > 5);
  for (let i = 1; i < path.length; i++) { assert.equal(path[i][0] - path[i - 1][0], 1); assert.equal(path[i][1] - path[i - 1][1], 1); }
  const y = M.rules[0].peak[0];
  assert.ok(path.some(([yy, a]) => yy === y && a === M.rules[0].age));
  assert.deepEqual(cohort(M, M.born.to).length, 1);
  assert.deepEqual(cohort(M, M.born.from).length, 1);
});

test('a rule that is not confirmed is left out', () => {
  const without = { facts: facts.facts.filter((f) => f.id !== 'rrsp_maturity_age') };
  const m = buildModel(snap, without);
  assert.ok(!m.rules.some((r) => r.facts.some((f) => f.id === 'rrsp_maturity_age')));
});

test('no rule age or count is written into the page code', () => {
  const here = new URL('..', import.meta.url).pathname;
  const text = ['app.js', 'model.mjs', 'index.src.html', 'style.css'].map((f) => [f, readFileSync(here + f, 'utf8')]);
  const figures = new Set([...M.rules.map((r) => String(r.age)), ...M.rules.flatMap((r) => [r.peak[1], r.first[1], r.last[1]].map(String)), String(M.max[2]), String(M.min[2])]);
  for (const [name, t] of text) {
    for (const v of figures) assert.ok(!new RegExp(`(?<![\\w.-])${v}(?![\\w.])`).test(t), `${name} contains ${v}`);
  }
});
