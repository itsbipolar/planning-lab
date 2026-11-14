// The retirement wave: the snapshot is whole and dated, shares add up, the diagonal and the headline are computed, a missing
// fact stops the build (or leaves its line out), and no rule age, count or year is typed into the page's code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModel, view, value, sumAges, finding, question, diagonal, bornRange, big, RULES } from '../model.mjs';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const snap = json('../../../shared/data/population-by-age-places.json');
const canada = json('../../../shared/data/population-by-age.json');
const facts = json('../../../shared/facts.json');
const M = buildModel(facts, snap);
const confirmed = new Map(facts.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));
const [y0, y1] = snap.years, [a0, a1] = snap.ages;

test('the snapshot is whole, dated and attributed, and Canada matches the first snapshot exactly', () => {
  assert.equal(snap.places.length, 12);
  for (const p of snap.places) for (const g of snap.genders) for (let y = y0; y <= y1; y++) {
    assert.equal(snap.counts[p.id][g][y].length, a1 - a0 + 1);
    assert.ok(snap.counts[p.id][g][y].every((v) => Number.isInteger(v) && v >= 0));
    assert.ok(Number.isInteger(snap.totals[p.id][g][y]) && snap.totals[p.id][g][y] > 0);
  }
  assert.match(snap.retrieved, /^\d{4}-\d{2}-\d{2}$/); assert.match(snap.released, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(snap.attribution, /^Adapted from Statistics Canada, .*Table 17-10-0005-01.*This does not constitute an endorsement by Statistics Canada of this product\.$/);
  assert.match(snap.source_url, /^https:\/\/www150\.statcan\.gc\.ca\//);
  assert.equal(snap.doi, 'https://doi.org/10.25318/1710000501-eng');
  const V = view(M, 'CA', 'all');
  for (let y = y0; y <= y1; y++) assert.deepEqual(V.counts[y], canada.values[y]);
});

test('the provinces and territories add up to Canada, and shares add up sensibly', () => {
  for (let y = y0; y <= y1; y++) {
    const parts = snap.places.filter((p) => p.id !== 'CA').map((p) => view(M, p.id, 'all'));
    const all = view(M, 'CA', 'all');
    assert.equal(parts.reduce((s, V) => s + V.totals[y], 0), all.totals[y]);
    for (let a = a0; a <= a1; a++) assert.equal(parts.reduce((s, V) => s + V.counts[y][a - a0], 0), all.counts[y][a - a0]);
  }
  for (const p of snap.places) for (const g of ['all', ...snap.genders]) {
    const V = view(M, p.id, g);
    for (let y = y0; y <= y1; y++) {
      let s = 0; for (let a = a0; a <= a1; a++) s += value(M, V, 'share', y, a);
      assert.ok(s > 0 && s < 1, `${p.id} ${g} ${y}: ages ${a0} to ${a1} are part of the population, not more`);
      assert.ok(Math.abs(s - sumAges(M, V, y, a0, a1) / V.totals[y]) < 1e-12);
    }
  }
  // all genders is Men+ plus Women+, and its share is their counts over their totals
  const m = view(M, 'ON', 'Men+'), w = view(M, 'ON', 'Women+'), t = view(M, 'ON', 'all');
  assert.equal(value(M, t, 'share', y1, a0), (m.counts[y1][0] + w.counts[y1][0]) / (m.totals[y1] + w.totals[y1]));
});

test('the rule ages come from confirmed facts; rules that share an age share a line; the age-75 increase reads its age from the title', () => {
  const ages = new Set(RULES.map(([id]) => confirmed.get(id)).filter(Boolean)
    .map((f) => (f.id === 'oas_age75_increase' ? Number(f.title.match(/at age (\d+)/)[1]) : Number(f.value))));
  assert.deepEqual(M.rules.map((r) => r.age), [...ages].sort((p, q) => p - q));
  assert.equal(M.rules.reduce((k, r) => k + r.facts.length, 0), RULES.filter(([id]) => confirmed.has(id)).length);
  assert.ok(M.rules.some((r) => r.facts.some((f) => f.id === 'oas_age75_increase')));
});

test('a diagonal goes up one age a year, and its readings are the snapshot\'s cells at each rule age', () => {
  const V = view(M, 'CA', 'all'), [lo, hi] = bornRange(M);
  for (const b of [lo, 1930, 1950, 1965, hi]) {
    const d = diagonal(M, V, 'count', b);
    assert.ok(d.cells.length >= 1);
    for (const [y, a, v] of d.cells) { assert.equal(a, y - b); assert.equal(v, canada.values[y][a - a0]); }
    for (let i = 1; i < d.cells.length; i++) { assert.equal(d.cells[i][0] - d.cells[i - 1][0], 1); assert.equal(d.cells[i][1] - d.cells[i - 1][1], 1); }
    for (const c of d.crossings) {
      assert.equal(c.year, b + c.age);
      if (c.when === 'in') assert.equal(c.value, canada.values[c.year][c.age - a0]); else assert.equal(c.value, null);
    }
  }
  assert.equal(diagonal(M, V, 'count', lo).cells.length, 1);
  assert.equal(diagonal(M, V, 'count', hi).cells.length, 1);
  assert.equal(diagonal(M, V, 'count', lo - 1).cells.length, 0);
  const s = diagonal(M, V, 'share', 1950).crossings.find((c) => c.when === 'in');
  assert.equal(s.value, canada.values[s.year][s.age - a0] / V.totals[s.year]);
});

test('the headline is computed from the latest year and the confirmed ages, for every place and gender', () => {
  const lo = Number(confirmed.get('cpp_earliest_start_age').value), oas = Number(confirmed.get('oas_start_age').value);
  for (const p of snap.places) for (const g of ['all', ...snap.genders]) {
    const V = view(M, p.id, g), f = finding(M, V);
    let now = 0, then = 0; for (let a = lo; a < oas; a++) { now += V.counts[y1][a - a0]; then += V.counts[y0][a - a0]; }
    assert.equal(f.now, now); assert.equal(f.then, then);
    assert.ok(f.lede.startsWith(big(now) + ' ')); assert.ok(f.lede.includes(`${lo} to ${oas - 1} on July 1, ${y1}`));
    assert.match(f.lede, new RegExp(`as many as in ${y0}\\.$`));
    assert.ok(f.lede.length <= 140, `the answer under the question is a dek: ${f.lede}`);
    assert.ok(f.more.includes(`People ${oas} to ${a1} were `));
  }
  assert.match(finding(M, view(M, 'CA', 'all')).lede, /^\d+\.\d\d million Canadians were /);
  assert.match(finding(M, view(M, 'QC', 'Women+')).lede, /people in Quebec \(Women\+\)/);
});

test('the question is short, computed from the OAS age, and asks rather than tells', () => {
  const q = question(M), oas = Number(confirmed.get('oas_start_age').value);
  assert.equal(q, `How many Canadians are about to turn ${oas}?`);
  assert.ok(q.length <= 60 && q.split(/\s+/).length <= 12);
  for (const s of [q, finding(M, view(M, 'CA', 'all')).lede, finding(M, view(M, 'CA', 'all')).more]) assert.doesNotMatch(s, /\bshould\b|best for you|recommend/i);
});

test('a missing headline fact stops the build; any other missing rule is left off the chart', () => {
  for (const id of ['cpp_earliest_start_age', 'oas_start_age']) assert.throws(() => buildModel({ facts: facts.facts.filter((f) => f.id !== id) }, snap), /not confirmed/);
  const m = buildModel({ facts: facts.facts.filter((f) => f.id !== 'rrsp_maturity_age') }, snap);
  assert.ok(!m.rules.some((r) => r.facts.some((f) => f.id === 'rrsp_maturity_age')));
  const unconfirmed = facts.facts.map((f) => (f.id === 'oas_age75_increase' ? { ...f, status: 'unverified' } : f));
  assert.ok(!buildModel({ facts: unconfirmed }, snap).rules.some((r) => r.facts.some((f) => f.id === 'oas_age75_increase')));
});

const ids = ['cpp_earliest_start_age', 'cpp_standard_start_age', 'cpp_latest_start_age', 'cpp_early_start_reduction', 'cpp_late_start_increase',
  'oas_start_age', 'oas_deferral_max_age', 'oas_deferral_increase', 'oas_age75_increase', 'rrsp_maturity_age', 'tfsa_minimum_age'];
const V0 = view(M, 'CA', 'all'), F0 = finding(M, V0);
const figures = new Set([...ids.filter((id) => confirmed.has(id)).map((id) => String(confirmed.get(id).value)), ...M.rules.map((r) => String(r.age)),
  '36', '42', String(y0), String(y1), String(a0), String(a1), String(F0.now), String(F0.then), ...canada.values[y1].map(String)]);
const hit = (t, v) => new RegExp(`(?<![\\w.-])${v.replace('.', '\\.')}(?![\\w.])`).test(t);

test('no rule age, rate, count or data year is written into the page code', () => {
  const here = new URL('..', import.meta.url).pathname;
  for (const f of ['app.js', 'model.mjs', 'scale.mjs', 'index.src.html', 'style.css']) {
    const t = readFileSync(here + f, 'utf8');
    for (const v of figures) assert.ok(!hit(t, v), `${f} contains ${v}`);
  }
});

test('the check above can fail', () => {
  assert.ok(hit(`const age = ${M.rules[0].age};`, String(M.rules[0].age)));
  assert.ok(hit(`x = ${confirmed.get('cpp_early_start_reduction').value} * 2`, String(confirmed.get('cpp_early_start_reduction').value)));
  assert.ok(!hit('padding:10px', '10'));
});
