// The money-year model (kept here after the lab was archived: the money-year reel's data model, reels/money-year/reel.json,
// and Money, then and now's #this-year section both use it). Its numbers come from the snapshot and the confirmed facts;
// none is typed into its code. The old page's tests are in labs/_archive/money-year/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModel, changes } from '../model.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const snap = JSON.parse(read('../../../shared/data/money-year-2026.json'));
const facts = JSON.parse(read('../../../shared/facts.json'));
const m = buildModel(snap, facts);

test('the policy-rate decisions are exactly the days the target changed', () => {
  const pts = snap.series.V39079.points;
  const expected = pts.filter((p, i) => i > 0 && p[1] !== pts[i - 1][1] && p[0] >= '2026-01-01');
  assert.deepEqual(m.panels[0].decisions.map((d) => [d.d, d.to]), expected);
  assert.deepEqual(changes([['a', 1], ['b', 1], ['c', 2], ['d', 1]]).map((c) => c.d), ['c', 'd']);
});

test('the high and low callouts are the true extremes of the year', () => {
  const fx = snap.series.FXUSDCAD.points.filter(([d]) => d >= '2026-01-01').map((p) => p[1]);
  const loonie = m.panels.find((p) => p.id === 'loonie');
  assert.equal(loonie.callouts[0].v, Math.max(...fx));
  assert.equal(loonie.callouts[1].v, Math.min(...fx));
});

test('every proposal comes from confirmed budget facts, and an unconfirmed one is left out', () => {
  for (const p of m.proposals) for (const id of p.facts) assert.equal(facts.facts.find((f) => f.id === id)?.status, 'confirmed', id);
  const less = { facts: facts.facts.map((f) => (f.id === 'budget2026_t1135_threshold' ? { ...f, status: 'unverified' } : f)) };
  assert.ok(!buildModel(snap, less).proposals.some((p) => p.id === 't1135'));
  assert.ok(m.proposals.some((p) => p.id === 't1135'));
});

test('no figure from the facts or the data is written into the model', () => {
  const src = ['model.mjs'].map((f) => [f, read(`../${f}`)]);
  assert.ok(src.every(([, text]) => text.length > 1000), 'every source file is read whole');
  const budget = facts.facts.filter((f) => f.id.startsWith('budget2026_') && f.status === 'confirmed').map((f) => String(f.value)).filter((v) => /\d{3,}/.test(v));
  const rates = [...new Set(Object.values(snap.series).flatMap((s) => s.points.map((p) => String(p[1]))))].filter((v) => /\.\d/.test(v));
  assert.ok(budget.length >= 5 && rates.length > 20);
  for (const [name, text] of src) for (const v of [...budget, ...rates]) {
    const re = new RegExp(`(?<![\\w.])${v.replace('.', '\\.')}(?![\\w.])`);
    assert.ok(!re.test(text), `${name} contains ${v}: it must come from the data or the facts`);
  }
});

test('the check can fail: a planted rate is caught', () => {
  assert.ok(/(?<![\w.])2\.25(?![\w.])/.test('const held = 2.25;'));
});
