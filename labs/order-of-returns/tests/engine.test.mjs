import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulate, average } from '../engine.mjs';

const story = JSON.parse(readFileSync(new URL('../story.json', import.meta.url)));
const golden = JSON.parse(readFileSync(new URL('../fixtures/golden.json', import.meta.url)));
// a small seeded random generator so the property tests are repeatable
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const shuffle = (a, r) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

test('with no withdrawals, the order of the years changes nothing (multiplication commutes)', () => {
  const r = rng(7);
  for (let k = 0; k < 300; k++) {
    const n = 1 + Math.floor(r() * 30), start = 1000 + r() * 1e6;
    const rets = Array.from({ length: n }, () => r() * 0.6 - 0.3);
    const base = simulate({ start, withdrawal: 0, returns: rets });
    for (const order of [rets.slice().reverse(), shuffle(rets, r)])
      assert.ok(close(simulate({ start, withdrawal: 0, returns: order }).endBalance, base.endBalance), `trial ${k}`);
  }
  // and with withdrawals the order does matter (the check can fail)
  const w = simulate({ start: 1e5, withdrawal: 1e4, returns: [0.3, -0.3] }).endBalance;
  const wr = simulate({ start: 1e5, withdrawal: 1e4, returns: [-0.3, 0.3] }).endBalance;
  assert.ok(!close(w, wr));
});

test('the story: same cards, same average; no withdrawals gives the same end; with them one runs dry', () => {
  const good = story.cards.slice().sort((a, b) => b - a), bad = story.cards.slice().sort((a, b) => a - b);
  assert.ok(close(average(good), average(bad)));
  const tail = Array(story.horizon - story.cards.length).fill(average(story.cards));
  const run = (cards, w) => simulate({ start: story.start, withdrawal: w, indexation: story.indexation, returns: cards.concat(tail) });
  assert.ok(close(run(good, 0).endBalance, run(bad, 0).endBalance));
  const g = run(good, story.withdrawal), b = run(bad, story.withdrawal);
  assert.equal(g.depletionYear, null, 'good years first: the money lasts the whole horizon');
  assert.equal(b.depletionYear, 20, 'bad years first: runs dry in year 20');
  assert.ok(g.endBalance > 50000);
});

test('the golden case, computed independently, matches to the cent', () => {
  const r = simulate(golden.input);
  golden.expected.balances.forEach((v, i) => assert.ok(Math.abs(r.balances[i] - v) < 0.01, `year ${i + 1}: ${r.balances[i]} vs ${v}`));
  golden.expected.paid.forEach((v, i) => assert.ok(Math.abs(r.paid[i] - v) < 0.01));
  assert.equal(r.depletionYear, golden.expected.depletionYear);
});

test('no NaN, no negative balance, never paid more than planned, under random inputs and every lever', () => {
  const r = rng(42);
  for (let k = 0; k < 2000; k++) {
    const rets = Array.from({ length: Math.floor(r() * 40) }, () => r() * 1.2 - 0.6);
    const res = simulate({ start: r() * 2e6, withdrawal: r() * 2e5, indexation: r() * 0.08 - 0.02, returns: rets,
      flexRule: r() < 0.5 ? { trim: r() } : null, cashBuffer: r() < 0.5 ? { years: Math.floor(r() * 5) } : null });
    for (const v of [...res.balances, ...res.paid, ...res.planned]) assert.ok(Number.isFinite(v) && v >= 0, `trial ${k}`);
    res.paid.forEach((p, i) => assert.ok(p <= res.planned[i] + 1e-9));
    if (res.depletionYear) assert.ok(res.paid[res.depletionYear - 1] < res.planned[res.depletionYear - 1]);
  }
});

test('once the money runs out, the balance stays at zero', () => {
  const res = simulate({ start: 100, withdrawal: 60, returns: [0, 0, 0.5, 0.5] });
  assert.equal(res.depletionYear, 2);
  assert.deepEqual(res.balances.slice(1), [0, 0, 0]);
});

test('flex rule: after a down year the withdrawal is cut by the trim', () => {
  const res = simulate({ start: 1e6, withdrawal: 50000, returns: [-0.1, 0.05, 0.05], flexRule: { trim: 0.1 } });
  assert.ok(close(res.planned[0], 50000)); assert.ok(close(res.planned[1], 45000)); assert.ok(close(res.planned[2], 50000));
});

test('cash buffer: after a down year the withdrawal comes from cash, after an up year cash is refilled', () => {
  const res = simulate({ start: 1e6, withdrawal: 50000, returns: [-0.2, 0.1], cashBuffer: { years: 2 } });
  // year 1: 100k in cash, 900k invested; withdrawal from invested (no down year before) -> 850k * 0.8 = 680k; total 780k
  assert.ok(close(res.balances[0], 780000));
  // year 2: after a down year, 50k from cash -> cash 50k; invested 680k * 1.1 = 748k; refill cash to 100k -> total 798k
  assert.ok(close(res.balances[1], 798000));
});

test('bad inputs are refused', () => {
  for (const bad of [{ start: -1 }, { withdrawal: -1 }, { returns: [-1] }, { returns: [NaN] }, { flexRule: { trim: 2 } }, { cashBuffer: { years: -1 } }])
    assert.throws(() => simulate({ start: 1000, withdrawal: 10, returns: [0.1], ...bad }), RangeError);
});
