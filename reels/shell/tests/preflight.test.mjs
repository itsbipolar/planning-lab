// The preflight is the reel's evidence gate: a card whose fact is missing, unconfirmed or empty stops the render.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { ROOT, loadFacts, loadReel, preflight, resolve, captionsVTT, yearOf } from '../lib.mjs';

const facts = loadFacts();
const reel = loadReel(join(ROOT, 'reels', 'history-45'));
const clone = x => JSON.parse(JSON.stringify(x));

test('the history reel passes preflight', () => {
  assert.deepEqual(preflight(reel, facts), []);
});

test('a fact_id missing from facts.json fails', () => {
  const r = clone(reel); r.cards[1].fact_ids = ['no_such_fact'];
  assert.match(preflight(r, facts).join('\n'), /fact_id "no_such_fact" is missing from facts.json/);
});

test('a card with no fact_id fails (every type but the end card)', () => {
  for (const type of ['hook', 'date', 'stat', 'chart', 'sources']) {
    const r = clone(reel); const c = r.cards.find(x => x.type === type); c.fact_ids = [];
    assert.ok(preflight(r, facts).some(e => e.includes('needs at least one fact_id')), type);
  }
});

test('an unconfirmed fact fails', () => {
  const f = clone(facts); f.facts.find(x => x.id === 'cpp_start_year').status = 'unverified';
  assert.match(preflight(reel, f).join('\n'), /cpp_start_year" is unverified, not confirmed/);
});

test('a digit typed into reel.json text fails: figures come only from facts.json', () => {
  const r = clone(reel); r.cards[1].beat = 'Paid from age 70.';
  assert.match(preflight(r, facts).join('\n'), /has a digit/);
});

test('an unknown card type fails', () => {
  const r = clone(reel); r.cards[0].type = 'banner';
  assert.match(preflight(r, facts).join('\n'), /unknown card type/);
});

test('the render command refuses to render when preflight fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reel-'));
  const r = clone(reel); r.cards[2].fact_ids = ['rrsp_made_up_year'];
  writeFileSync(join(dir, 'reel.json'), JSON.stringify(r));
  const p = spawnSync(process.execPath, [join(ROOT, 'reels', 'shell', 'render.mjs'), dir], { encoding: 'utf8' });
  assert.equal(p.status, 1);
  assert.match(p.stderr, /PREFLIGHT FAILED/);
  assert.match(p.stderr, /rrsp_made_up_year/);
});

test('every year on screen equals a confirmed fact', () => {
  const m = resolve(reel, facts);
  const dated = m.cards.filter(c => c.type === 'date');
  assert.equal(dated.length, 5);
  for (const c of dated) assert.equal(c.year, yearOf(facts.facts.find(f => f.id === c.fact_ids[0])));
  const vtt = captionsVTT(m);
  for (const y of vtt.match(/\b(19|20)\d\d\b/g)) {
    assert.ok(facts.facts.some(f => f.status === 'confirmed' && String(f.value).includes(y)) || /\d\d:\d\d/.test(y), `${y} is not in the facts`);
  }
});

test('the reel runs about 45 seconds', () => {
  const m = resolve(reel, facts);
  assert.ok(m.total >= 40 && m.total <= 50, `total ${m.total}`);
});
