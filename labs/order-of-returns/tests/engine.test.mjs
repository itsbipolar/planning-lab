import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulate, average, rrifFactorsByYear, largestLastingWithdrawal } from '../engine.mjs';
import { enumerateOrders, summarize, orderAt, rankOutcome, factorial, distribution, yearsLasted, atLeastAsLong, stripBar } from '../enumerate.mjs';

const story = JSON.parse(readFileSync(new URL('../story.json', import.meta.url)));
const golden = JSON.parse(readFileSync(new URL('../fixtures/golden.json', import.meta.url)));
const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url))).facts.filter((f) => f.status === 'confirmed');
const fact = (id) => facts.find((f) => f.id === id).value;
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

// ---------- the RRIF lane ----------
const rrifRows = fact('rrif_minimum_factors'), maturity = Number(fact('rrsp_maturity_age'));

test('RRIF factors by year: nothing before the maturity age, then the facts\' factor for the age at the start of each year', () => {
  const f = rrifFactorsByYear({ startAge: story.startAge, maturityAge: maturity, rows: rrifRows, years: story.horizon });
  assert.equal(f.length, story.horizon);
  f.forEach((v, t) => {
    const age = story.startAge + t;
    if (age < maturity) assert.equal(v, 0);
    else assert.equal(v, Number(rrifRows.find((r) => r.age === age).factor));
  });
  assert.ok(f.some((v) => v > 0), 'the story reaches the RRIF years');
  // an age missing from the table is never guessed
  assert.throws(() => rrifFactorsByYear({ startAge: maturity, maturityAge: maturity, rows: rrifRows.slice(1), years: 1 }), RangeError);
});

test('a minimum raises the withdrawal to factor x the start-of-year balance, never lowers it, and all-zero factors change nothing', () => {
  const r = rng(11);
  for (let k = 0; k < 500; k++) {
    const n = 1 + Math.floor(r() * 30), rets = Array.from({ length: n }, () => r() * 0.6 - 0.3);
    const base = { start: 1e5 + r() * 1e6, withdrawal: r() * 6e4, indexation: 0.02, returns: rets };
    const fs = rets.map(() => (r() < 0.6 ? r() * 0.2 : 0));
    const plain = simulate(base), zero = simulate({ ...base, minimumFactors: rets.map(() => 0) }), min = simulate({ ...base, minimumFactors: fs });
    assert.deepEqual(zero.balances, plain.balances);
    let bal = base.start;
    min.planned.forEach((w, t) => {
      const plan = base.withdrawal * Math.pow(1 + base.indexation, t);
      assert.ok(close(w, Math.max(plan, fs[t] * bal)), `trial ${k} year ${t + 1}`);
      assert.ok(close(min.forced[t], w - plan) && min.forced[t] >= 0);
      bal = min.balances[t];
    });
  }
});

// ---------- the rescue solver ----------
test('the solver finds the largest first-year withdrawal that lasts: one dollar more runs out', () => {
  const tail = Array(story.horizon - story.cards.length).fill(average(story.cards));
  const returns = story.cards.slice().sort((a, b) => a - b).concat(tail);
  const p = { start: story.start, indexation: story.indexation, returns };
  const w = largestLastingWithdrawal(p);
  assert.ok(w > 0 && w < story.withdrawal);
  assert.equal(simulate({ ...p, withdrawal: w }).depletionYear, null);
  assert.notEqual(simulate({ ...p, withdrawal: w + 1 }).depletionYear, null);
});

// ---------- every order ----------
const tail = Array(story.horizon - story.cards.length).fill(average(story.cards));
const P = { start: story.start, withdrawal: story.withdrawal, indexation: story.indexation, cards: story.cards, tail };
const ALL = enumerateOrders(P);
const run = (order, extra = {}) => simulate({ start: story.start, withdrawal: story.withdrawal, indexation: story.indexation, returns: order.concat(tail), ...extra });
const outcomeOf = (res) => ({ dep: res.depletionYear || 0, value: res.depletionYear ? res.paid.reduce((a, b) => a + b, 0) : res.endBalance });

test('orderAt numbers every order once, in the order the enumeration visits them', () => {
  const seen = new Set();
  for (let i = 0; i < factorial(5); i++) { const o = orderAt(i, 5); assert.equal(new Set(o).size, 5); seen.add(o.join()); }
  assert.equal(seen.size, factorial(5));
  assert.deepEqual(orderAt(0, 4), [0, 1, 2, 3]); assert.deepEqual(orderAt(23, 4), [3, 2, 1, 0]);
});

test('every one of the 10! orders is run, and each gives exactly what simulate gives', () => {
  assert.equal(ALL.total, 3628800); assert.equal(ALL.total, factorial(story.cards.length));
  const r = rng(5);
  for (let k = 0; k < 400; k++) {
    const i = Math.floor(r() * ALL.total), o = outcomeOf(run(orderAt(i, 10).map((j) => story.cards[j])));
    assert.equal(ALL.dep[i], o.dep, `order ${i}`);
    assert.ok(close(ALL.value[i], o.value, 1e-12), `order ${i}`);
  }
});

test('the counts sum to 10!, the groups by first five years cover every order, and Ruth and Sam are the two extremes', () => {
  const s = summarize(ALL, story.cards);
  const byYear = s.byYear.reduce((a, b) => a + b, 0), left = s.left.counts.reduce((a, b) => a + b, 0);
  assert.equal(byYear + s.lasts, ALL.total);
  assert.equal(left, s.lasts);
  assert.equal(s.groups.reduce((a, g) => a + g.n, 0), ALL.total);
  for (const g of s.groups) assert.equal(g.n % (factorial(5) * factorial(5)), 0, 'each set of five first years appears in 5! x 5! orders');
  assert.equal(s.groups.length <= 252, true);
  const good = story.cards.slice().sort((a, b) => b - a), bad = story.cards.slice().sort((a, b) => a - b);
  const ruth = rankOutcome(ALL, ...Object.values(outcomeOf(run(good)))), sam = rankOutcome(ALL, ...Object.values(outcomeOf(run(bad))));
  assert.deepEqual([ruth.better, ruth.same], [0, 1], 'best years first is the best order');
  assert.deepEqual([sam.worse, sam.same], [0, 1], 'worst years first is the worst order');
  assert.equal(ruth.better + ruth.same + ruth.worse, ALL.total);
});

test('without withdrawals every order ends with the same balance', () => {
  const Z = enumerateOrders({ ...P, withdrawal: 0 });
  const end = run(story.cards, { withdrawal: 0 }).endBalance;
  assert.equal(Z.total, 3628800);
  for (let i = 0; i < Z.total; i++) { assert.equal(Z.dep[i], 0); if (!close(Z.value[i], end)) assert.fail(`order ${i}: ${Z.value[i]} vs ${end}`); }
  const s = summarize(Z, story.cards);
  assert.equal(s.lasts, Z.total);
});

test('with the RRIF minimums the enumeration still matches simulate, and no order does better than without them', () => {
  const f = rrifFactorsByYear({ startAge: story.startAge, maturityAge: maturity, rows: rrifRows, years: story.horizon });
  const R = enumerateOrders({ ...P, minimumFactors: f });
  const r = rng(9);
  for (let k = 0; k < 300; k++) {
    const i = Math.floor(r() * R.total), o = outcomeOf(run(orderAt(i, 10).map((j) => story.cards[j]), { minimumFactors: f }));
    assert.equal(R.dep[i], o.dep); assert.ok(close(R.value[i], o.value, 1e-12));
  }
  // taking out at least as much each year: the RRIF never lasts longer and never ends with more
  const last = (d) => d || Infinity;
  for (let i = 0; i < R.total; i++) {
    if (last(R.dep[i]) > last(ALL.dep[i])) assert.fail(`order ${i} lasts longer with the minimums`);
    if (!R.dep[i] && R.value[i] > ALL.value[i] + 1e-6) assert.fail(`order ${i} ends with more with the minimums`);
  }
});

// ---------- the precomputed distribution the deal reads (redesign v2, step 4) ----------
const DIST = distribution(ALL, story.cards);
// straight from the full engine: how many of all 10! orders last no longer than `years` whole years
const direct = (years) => { let n = 0; for (let i = 0; i < ALL.total; i++) if (yearsLasted(ALL.dep[i], ALL.horizon) <= years) n++; return n; };

test('the distribution: sorted shortest to longest, counts sum to 10!, and the shipped distribution.json is the fresh one', () => {
  const ys = DIST.lasted.map((o) => o.years);
  assert.deepEqual(ys, ys.slice().sort((a, b) => a - b));
  assert.equal(DIST.lasted.reduce((a, o) => a + o.count, 0), ALL.total);
  assert.equal(DIST.lasted[DIST.lasted.length - 1].years, story.horizon);
  assert.equal(DIST.lasted[DIST.lasted.length - 1].count, DIST.lasts);
  const bars = DIST.strip.byYear.concat(DIST.strip.left.counts);
  assert.equal(bars.reduce((a, b) => a + b, 0), ALL.total, 'the strip covers every order once');
  assert.equal(DIST.groups.reduce((a, g) => a + g.n, 0), ALL.total);
  const shipped = JSON.parse(readFileSync(new URL('../distribution.json', import.meta.url)));
  const { _note, params, ...rest } = shipped;
  assert.deepEqual(rest, JSON.parse(JSON.stringify(DIST)), 'distribution.json is stale: run node labs/order-of-returns/build.mjs');
  assert.deepEqual(params, { start: story.start, withdrawal: story.withdrawal, indexation: story.indexation, cards: story.cards, horizon: story.horizon });
});

test("Ruth's and Sam's ranks from the distribution equal the full engine's, and so do 300 random orders'", () => {
  const good = story.cards.slice().sort((a, b) => b - a), bad = story.cards.slice().sort((a, b) => a - b);
  const r = rng(11), orders = [good, bad, ...Array.from({ length: 300 }, () => shuffle(story.cards, r))];
  for (const o of orders) {
    const res = run(o), y = yearsLasted(res.depletionYear || 0, story.horizon);
    assert.equal(atLeastAsLong(DIST, y), direct(y), o.join());
  }
  // Ruth lasts the whole horizon: at least as long as every order; Sam ties only with the orders that run out when he does
  const ruthY = yearsLasted(run(good).depletionYear || 0, story.horizon), samY = yearsLasted(run(bad).depletionYear || 0, story.horizon);
  assert.equal(atLeastAsLong(DIST, ruthY), ALL.total);
  assert.equal(atLeastAsLong(DIST, samY), DIST.lasted[0].count);
  assert.equal(samY, DIST.lasted[0].years, "Sam's order is in the shortest group");
  // the strip bar an order falls in is the bar summarize() counts it in
  for (const o of orders.slice(0, 60)) {
    const out = outcomeOf(run(o)), b = stripBar(DIST, out.dep, out.value), bars = DIST.strip.byYear.concat(DIST.strip.left.counts);
    assert.ok(b >= 0 && b < bars.length && bars[b] > 0);
  }
});

test('the page code types none of the story figures: they come from story.json, the engine and distribution.json', () => {
  const here = new URL('..', import.meta.url).pathname;
  const intF = new Intl.NumberFormat('en-CA');
  const sam = run(story.cards.slice().sort((a, b) => a - b)).depletionYear;
  const bad = [intF.format(ALL.total), String(ALL.total), intF.format(story.start), intF.format(story.withdrawal), `year ${sam}`, `${story.horizon} years`, `${sam - 1} years`];
  for (const f of ['app.js', 'index.src.html']) {
    const t = readFileSync(here + f, 'utf8');
    for (const v of bad) assert.ok(!t.includes(v), `${f} contains ${v}`);
  }
});

// ---------- no figure from the facts in the page code ----------
test('no age or factor from the facts file is written into the page code', () => {
  const here = new URL('..', import.meta.url).pathname;
  const figures = new Set([String(maturity), String(maturity + 1), ...rrifRows.map((r) => r.factor), ...rrifRows.map((r) => String(Number(r.factor)))]);
  for (const f of ['app.js', 'engine.mjs', 'enumerate.mjs', 'worker.js', 'index.src.html', 'style.css']) {
    const t = readFileSync(here + f, 'utf8');
    for (const v of figures) assert.ok(!new RegExp(`(?<![\\w.#-])${v.replace('.', '\\.')}(?![\\w.%])`).test(t), `${f} contains ${v}`);
  }
  assert.ok(/(?<![\w.#-])71(?![\w.%])/.test('age 71 here'), 'the checker can fail');
});
