// No rule or figure from the facts file may be written into the page's own code: every one comes from shared/facts.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const here = new URL('..', import.meta.url).pathname;
const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts.filter((f) => f.status === 'confirmed');
const files = ['app.js', 'calc.mjs', 'index.src.html', 'style.css', 'story.json', '../../shared/drag-number.js'];
const sources = files.map((f) => [f, readFileSync(here + f, 'utf8')]);
const used = ['cpp_standard_start_age', 'cpp_earliest_start_age', 'cpp_latest_start_age', 'cpp_early_start_reduction',
  'cpp_late_start_increase', 'oas_start_age', 'oas_deferral_max_age', 'oas_deferral_increase'];

test('no CPP or OAS figure from the facts file is written into the page source', () => {
  const figures = [...new Set(facts.filter((f) => used.includes(f.id) || f.series === 'oas_recovery_threshold').map((f) => String(f.value)))];
  assert.ok(figures.length >= 6, figures.join(', '));
  for (const [name, text] of sources) for (const v of figures) {
    const re = new RegExp(`(?<![\\w.])${v.replace('.', '\\.')}(?![\\w.])`);
    assert.ok(!re.test(text), `${name} contains the figure ${v}: it must come from facts.json`);
  }
});

test('the checker can fail: a planted figure is caught', () => {
  assert.ok(/(?<![\w.])65(?![\w.])/.test('const age = 65;'));
});

test('every fact the page reads exists and is confirmed', () => {
  const text = sources.map(([, t]) => t).join('\n');
  const ids = [...text.matchAll(/'((?:cpp|oas)_[a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(ids.length >= 8);
  for (const id of new Set(ids)) assert.ok(facts.some((f) => f.id === id || f.series === id), `fact ${id} is missing or not confirmed`);
});
