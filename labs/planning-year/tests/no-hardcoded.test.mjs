// No age, date, day count or year count from the facts file may be written into The Planning Year's code or config:
// each one is read from facts.json. (The fixture holds the drafted P5 values so this test covers them before they are confirmed.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const here = new URL('..', import.meta.url).pathname;
const facts = JSON.parse(readFileSync(new URL('../fixtures/facts-with-drafts.json', import.meta.url), 'utf8')).facts;
const files = ['engine.mjs', 'book.mjs', 'triggers.json', 'app.js', 'index.src.html'].filter((f) => existsSync(here + f));
const sources = files.map((f) => [f, readFileSync(here + f, 'utf8')]);

// The figures: numbers as written (71, 21 ...), the day count inside the T3 rule, the dated deadlines in full and as
// month-day, and the instalment dates.
const figures = new Set();
for (const f of facts) {
  const s = String(f.value);
  if (/^\d+$/.test(s)) figures.add(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { figures.add(s); figures.add(s.slice(5)); }
  for (const m of s.matchAll(/(\d+) days/g)) figures.add(m[1]);
  for (const m of s.matchAll(/[A-Z][a-z]+ \d{1,2}/g)) figures.add(m[0]);
}

test('no figure from the facts file is written into the code or the config', () => {
  assert.ok(figures.size >= 12, [...figures].join(', '));
  for (const [name, text] of sources) for (const v of figures) {
    const re = new RegExp(`(?<![\\w.-])${v.replace(/[.-]/g, '\\$&')}(?![\\w.])`);
    assert.ok(!re.test(text), `${name} contains ${v}: it must come from facts.json`);
  }
});

test('the checker can fail: a planted figure is caught', () => {
  assert.ok(new RegExp('(?<![\\w.-])71(?![\\w.])').test('if (age === 71)'));
});
