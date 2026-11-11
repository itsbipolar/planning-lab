// The preflight is the reel's evidence gate: a card whose fact is missing, unconfirmed or empty stops the render.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { ROOT, loadFacts, loadReel, preflight, resolve, captionsVTT, yearOf, yearWords, under100, spoken } from '../lib.mjs';

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

test('years and numbers are spoken as words', () => {
  assert.equal(yearWords(1952), 'nineteen fifty-two');
  assert.equal(yearWords(2009), 'two thousand nine');
  assert.equal(yearWords(2023), 'twenty twenty-three');
  assert.equal(yearWords(1905), 'nineteen oh five');
  assert.equal(under100(71), 'seventy-one');
});

test('every spoken year is the confirmed fact, said as words, and the captions show the same year', () => {
  const m = resolve(reel, facts);
  for (const c of m.cards.filter(x => x.type === 'date')) {
    const y = yearOf(facts.facts.find(f => f.id === c.fact_ids[0]));
    assert.ok(spoken(c).toLowerCase().includes(yearWords(y)), `${c.id}: "${spoken(c)}"`);
    assert.ok(spoken(c, { numerals: true }).includes(String(y)), c.id);
    assert.ok(!/\d/.test(spoken(c)), `${c.id}: the voice text has digits`);
  }
});

test('an unknown placeholder in a spoken line fails', () => {
  const r = clone(reel); r.cards[1].say = 'In {amount}, something happened.';
  assert.match(preflight(r, facts).join('\n'), /unknown placeholder \{amount\}/);
});

test('the end card discloses the AI voice', () => {
  const end = reel.cards.find(c => c.type === 'end');
  assert.ok(reel.voice && /AI-generated/.test(end.voice_note ?? ''));
});

test('speech recognition heard every spoken year in its clip, and nothing stray is kept', async () => {
  const { readFileSync } = await import('node:fs');
  const cuts = JSON.parse(readFileSync(join(ROOT, 'reels', 'history-45', 'voice', 'cuts.json'), 'utf8'));
  const m = resolve(reel, facts);
  const words = s => s.toLowerCase().replace(/-/g, ' ').replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
  for (const c of m.cards.filter(x => x.say)) {
    assert.ok(cuts[c.id], `${c.id}: no speech window`);
    assert.ok(cuts[c.id].end > cuts[c.id].start, c.id);
    if (c.type === 'date') {
      const heard = ` ${words(cuts[c.id].heard).join(' ')} `;
      // "two thousand nine" may be heard as "two thousand and nine"; every word of the year must be there in order.
      const yw = words(yearWords(c.year));
      assert.ok(new RegExp(yw.join(' (?:and )?')).test(heard), `${c.id}: heard "${cuts[c.id].heard}"`);
    }
  }
});

test('a data reel: a series card for a measure the data lacks fails, and so does a year with no confirmed proposals', async () => {
  const { loadDataModel } = await import('../lib.mjs');
  const r = loadReel(join(ROOT, 'reels', 'money-year'));
  const dm = await loadDataModel(r, facts);
  assert.deepEqual(preflight(r, facts, dm), []);
  const bad = clone(r); bad.cards.find(c => c.type === 'series').panel = 'gold-price';
  assert.match(preflight(bad, facts, dm).join('\n'), /no measure "gold-price"/);
  const far = clone(r); far.cards.find(c => c.type === 'proposals').offset = 9;
  assert.match(preflight(far, facts, dm).join('\n'), /no confirmed proposals starting in year \+9/);
  const noData = clone(r); delete noData.data;
  assert.match(preflight(noData, facts, null).join('\n'), /needs the reel's data model/);
});
