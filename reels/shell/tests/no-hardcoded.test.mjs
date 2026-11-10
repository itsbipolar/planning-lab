// No year or other fact value is written into the shell's code or the reel's JSON; they come from facts.json.
// The check is proven able to fail on a planted value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadFacts } from '../lib.mjs';

const facts = loadFacts().facts.filter(f => f.status === 'confirmed');
// The reel's figures are years: every four-digit year in any confirmed fact value.
const values = [...new Set(facts.flatMap(f => typeof f.value === 'string' || typeof f.value === 'number' ? [String(f.value)] : [])
  .flatMap(v => v.match(/\b(?:1[89]|20)\d\d\b/g) ?? []))];
const files = [join(ROOT, 'reels', 'history-45', 'reel.json'),
  ...readdirSync(join(ROOT, 'reels', 'shell')).filter(f => f.endsWith('.mjs')).map(f => join(ROOT, 'reels', 'shell', f))];
const found = src => values.filter(v => new RegExp(`(?<![\\w.#-])${v}(?![\\w%])`).test(src));

test('values are found', () => assert.ok(values.length >= 5, values.join(',')));
test('no fact year appears in the reel shell or reel.json', () => {
  for (const f of files) assert.deepEqual(found(readFileSync(f, 'utf8')), [], f);
});
test('the check catches a planted year', () => {
  const y = facts.find(f => f.id === 'cpp_start_year').value;
  assert.deepEqual(found(`const year = ${y};`), [String(y)]);
});
