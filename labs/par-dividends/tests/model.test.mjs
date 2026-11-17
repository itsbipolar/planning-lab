// The engine (model.mjs): an exact port of the research guide's reference model, checked against its saved run; the
// real yields used as they are, never typed; the summary the page states; the invariants the page's words rely on; the
// rules read from the confirmed facts; and the one formatter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAMPLE, PAT, STEADY, BOUNDS, REQUIRED, OPTIONAL, yieldsFrom, run, summary, parRules, pts, pct } from '../model.mjs';

const snap = JSON.parse(readFileSync(new URL('../../../shared/data/long-bond-yield-yearly.json', import.meta.url), 'utf8'));
const ref = JSON.parse(readFileSync(new URL('../fixtures/reference-run.json', import.meta.url), 'utf8'));
const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts;
const { Y, first, last } = yieldsFrom(snap);

test('port parity: every saved reference case matches run() within 1e-8', () => {
  assert.equal(ref.cases.length, 19);
  for (const c of ref.cases) {
    const out = run(Y, { N: c.N, w: c.w, L: c.L, spread: ref.spread, prem: ref.prem, start: ref.start, end: ref.end, pattern: c.steady ? STEADY : PAT });
    assert.equal(out.length, c.rows.length);
    c.rows.forEach(([year, bond, actual, credited], i) => {
      const r = out[i], tag = `N${c.N} w${c.w} L${c.L}${c.steady ? ' steady' : ''} ${year}`;
      assert.equal(r.year, year, tag);
      assert.ok(Math.abs(r.bond - bond) < 1e-8, `${tag} bond`);
      assert.ok(Math.abs(r.actual - actual) < 1e-8, `${tag} actual ${r.actual} vs ${actual}`);
      assert.ok(Math.abs(r.credited - credited) < 1e-8, `${tag} credited ${r.credited} vs ${credited}`);
    });
  }
});

test('the data is used, not typed: one yield a year with no gap, each row\'s bond equals the December value', () => {
  for (let y = first; y <= last; y++) assert.ok(Number.isFinite(Y[y]), `${y}`);
  const dec = Object.fromEntries(snap.values);
  for (const r of run(Y)) assert.ok(Math.abs(r.bond - dec[`${r.year}-12`]) < 1e-12, `${r.year}`);
  assert.equal(run(Y).at(-1).year, last, 'the last year comes from the data');
  const gap = { ...Y }; delete gap[1993];
  assert.throws(() => run(gap), /1993/);
  const early = { ...Y }; delete early[EXAMPLE.start - BOUNDS.L.at(-1)];
  assert.throws(() => run(early, { L: BOUNDS.L.at(-1) }), new RegExp(String(EXAMPLE.start - BOUNDS.L.at(-1))));
});

test('the summary at the example (the reference run\'s years)', () => {
  const s = summary(run(Y, { end: ref.end }));
  assert.equal(pts(s.maxMoveCredited), '2.5'); assert.equal(s.maxMoveCreditedYear, 2022);
  assert.equal(pts(s.maxMoveActual), '14.1'); assert.equal(s.maxMoveActualYear, 2004);
  assert.ok(Math.abs(s.meanActual - 8.71) < 0.01 && Math.abs(s.meanCredited - 8.75) < 0.01);
  assert.equal(s.low.year, 2017); assert.equal(s.high.year, 1982);
  assert.equal(pts(summary(run(Y, { N: 1, end: ref.end })).maxMoveCredited), '14.2');
  assert.equal(pts(summary(run(Y, { N: 10, end: ref.end })).maxMoveCredited), '1.4');
  // at the example's mix the page's figure falls with every extra year of spreading, and never lands on the first move
  const figs = [];
  for (let N = BOUNDS.N.min; N <= BOUNDS.N.max; N++) {
    const t = summary(run(Y, { N, end: ref.end }));
    figs.push(Number(pts(t.maxMoveCredited)));
    if (N > 1) assert.notEqual(t.maxMoveCreditedYear, EXAMPLE.start + 1, `N${N}`);
  }
  figs.forEach((f, i) => i && assert.ok(f < figs[i - 1], `N${i + 1}: ${f} after ${figs[i - 1]}`));
});

test('no large made-up swing lands on a well-known market fall', () => {
  for (const y of [1987, 2000, 2001, 2002, 2008, 2020, 2022]) {
    const s = PAT[(y - EXAMPLE.start) % PAT.length];
    assert.ok(s >= -5 && s <= 9, `${y}: ${s}`);
  }
});

test('invariants the page\'s words rely on', () => {
  assert.equal(PAT.reduce((a, b) => a + b, 0), 0, 'the made-up swings sum to zero');
  const steady1 = run(Y, { N: 1, pattern: STEADY }).map((r) => r.credited);
  for (let N = BOUNDS.N.min; N <= BOUNDS.N.max; N++) assert.deepEqual(run(Y, { N, pattern: STEADY }).map((r) => r.credited), steady1, `steady, N ${N}`);
  // with no spreading, the gap between the lines is only the bonds counted at purchase yield
  const a = run(Y, { N: 1 }), b = run(Y, { N: 1, pattern: STEADY });
  a.forEach((r, i) => assert.ok(Math.abs((r.credited - r.actual) - (b[i].credited - b[i].actual)) < 1e-9, `${r.year}`));
  // the averages stay within 0.3 points at every setting (the page then says "the same money")
  for (let N = BOUNDS.N.min; N <= BOUNDS.N.max; N++) for (const L of BOUNDS.L) for (const pattern of [PAT, STEADY])
    for (let w = BOUNDS.w.min; w <= BOUNDS.w.max + 1e-9; w += BOUNDS.w.step) {
      const out = run(Y, { N, L, w: Math.round(w * 100) / 100, pattern }), s = summary(out);
      assert.ok(Math.abs(s.meanActual - s.meanCredited) < 0.3, `N${N} L${L} w${w}`);
      for (const r of out) assert.ok(Number.isFinite(r.actual) && Number.isFinite(r.credited));
    }
  const base = run(Y);
  for (const o of [{ w: BOUNDS.w.min }, { L: BOUNDS.L[0] }]) {
    const c = run(Y, o);
    assert.ok(c.some((r, i) => r.actual !== base[i].actual) && c.some((r, i) => r.credited !== base[i].credited), JSON.stringify(o));
  }
});

test('the rules: required facts stop the build by name; optional ones drop out; the shareholder range from the tiers', () => {
  const R = parRules(facts);
  for (const id of Object.values(REQUIRED)) {
    assert.throws(() => parRules(facts.filter((f) => f.id !== id)), new RegExp(id));
    assert.throws(() => parRules(facts.map((f) => (f.id === id ? { ...f, status: 'unverified' } : f))), new RegExp(id));
  }
  for (const [k, id] of Object.entries(OPTIONAL)) {
    const r = parRules(facts.filter((f) => f.id !== id));
    assert.equal(r[k], null, k);
  }
  assert.equal(parRules(facts.filter((f) => f.id !== OPTIONAL.capTiers)).shareholderRange, null);
  assert.deepEqual(R.shareholderRange, { min: 2.5, max: 10 });
  for (const v of [R.shareholderRange.min, R.shareholderRange.max]) assert.ok(R.capRange.value.includes(`${v}%`), `${v}% in the range fact`);
  assert.equal(R.used.length, Object.keys(REQUIRED).length + Object.keys(OPTIONAL).length);
  // the text rules are the official lines word for word (the page sets them as quotations): checked where the quotes
  // live, in canada-planning-facts (tests/test_facts_file.py), since facts.json carries no source_quote
});

test('one formatter: one decimal, a true minus, no negative zero', () => {
  assert.equal(pts(1.8826), '1.9'); assert.equal(pts(-2.884), '−2.9'); assert.equal(pts(14.509), '14.5');
  assert.equal(pct(8.6458), '8.6%'); assert.equal(pts(-0.01), '0.0'); assert.equal(pts(-0), '0.0');
  assert.equal(EXAMPLE.label, 'Example assumptions, not facts');
});
