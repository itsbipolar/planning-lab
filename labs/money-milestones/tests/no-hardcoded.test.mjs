// No rule or figure may be written into the page's own code: every one comes from shared/facts.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const here = new URL('..', import.meta.url).pathname;
const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts.filter((f) => f.status === 'confirmed');
const sources = ['app.js', 'index.src.html', 'style.css'].map((f) => [f, readFileSync(here + f, 'utf8')]);

test('no figure from the facts file is written into the page source', () => {
  const figures = [...new Set(facts.filter((f) => ['years', 'percent_per_month'].includes(f.unit)).map((f) => f.value))];
  assert.ok(figures.length >= 5, `expected the age and percent facts, got ${figures.join(', ')}`);
  for (const [name, text] of sources) for (const v of figures) {
    const re = new RegExp(`(?<![\\w.])${v.replace('.', '\\.')}(?![\\w.])`);
    assert.ok(!re.test(text), `${name} contains the figure ${v}: it must come from facts.json`);
  }
});

test('the checker can fail: a planted figure is caught', () => {
  const planted = "var age = 65; // the OAS age";
  const re = /(?<![\w.])65(?![\w.])/;
  assert.ok(re.test(planted));
});

test('every fact the page reads exists and is confirmed', () => {
  const ids = [...readFileSync(here + 'app.js', 'utf8').matchAll(/'((?:tfsa|cpp|oas|rrsp)_[a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(ids.length > 5);
  for (const id of new Set(ids)) assert.ok(facts.some((f) => f.id === id), `fact ${id} is missing or not confirmed`);
});
