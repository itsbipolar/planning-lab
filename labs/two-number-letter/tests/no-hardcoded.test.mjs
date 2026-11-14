// No rule or figure from the facts file may be written into the page's own code: every one comes from shared/facts.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const here = new URL('..', import.meta.url).pathname;
const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts.filter((f) => f.status === 'confirmed');
const files = ['app.js', 'calc.mjs', 'build.mjs', 'index.src.html', 'style.css', 'story.json', '../../shared/drag-number.js'];
// The shared drag-number component steps ten at a time on Page Up/Down (a keyboard convention, not the OAS rise); that
// one figure is allowed there and nowhere else. The component is shared with other labs and is not this page's to change.
const allow = { '../../shared/drag-number.js': ['10'] };
const sources = files.map((f) => [f, readFileSync(here + f, 'utf8')]);
const used = ['cpp_standard_start_age', 'cpp_earliest_start_age', 'cpp_latest_start_age', 'cpp_early_start_reduction',
  'cpp_late_start_increase', 'oas_start_age', 'oas_deferral_max_age', 'oas_deferral_increase', 'oas_age75_increase',
  'oas_recovery_rate'];
const figures = [...new Set(facts.filter((f) => used.includes(f.id) || f.series === 'oas_recovery_threshold').map((f) => String(f.value)))];
// The age of the OAS rise is read from its fact's title; it must not be typed either.
const boostAge = String(facts.find((f) => f.id === 'oas_age75_increase').title).match(/\bage (\d+)\b/)[1];
const has = (text, v) => new RegExp(`(?<![\\w.])${v.replace('.', '\\.')}(?![\\w.])`).test(text);

test('no CPP or OAS figure from the facts file is written into the page source', () => {
  assert.ok(figures.length >= 9, figures.join(', '));
  for (const [name, text] of sources) for (const v of [...figures, boostAge]) {
    if ((allow[name] || []).includes(v)) continue;
    assert.ok(!has(text, v), `${name} contains the figure ${v}: it must come from facts.json`);
  }
});

test('the checker can fail: a planted figure is caught', () => {
  assert.ok(has('const age = 65;', '65'));
  assert.ok(has('rate * 0.6;', '0.6'));
  assert.ok(!has('step * 100;', '10'));
});

test('every fact the page reads exists and is confirmed', () => {
  const text = sources.map(([, t]) => t).join('\n');
  const ids = [...text.matchAll(/'((?:cpp|oas)_[a-z0-9_]+)'/g)].map((m) => m[1]);
  assert.ok(ids.length >= 10);
  for (const id of new Set(ids)) assert.ok(facts.some((f) => f.id === id || f.series === id), `fact ${id} is missing or not confirmed`);
});

test('the tool\'s slider ranges and comparison ages are read from the rules, and its chart amount is an example', () => {
  const app = readFileSync(here + 'app.js', 'utf8');
  for (const want of ['lo: r.cpp.earliest, hi: r.cpp.latest, base: std', 'lo: r.oas.start, hi: r.oas.latest, base: r.oas.start'])
    assert.ok(app.includes(want), `app.js reads ${want}`);
  const story = JSON.parse(readFileSync(here + 'story.json', 'utf8'));
  assert.equal(story.synthetic, true);
  assert.ok(Number.isFinite(story.tool.monthly) && story.tool.monthly > 0);
  assert.ok(!figures.includes(String(story.tool.monthly)), 'the example amount is not a fact figure');
  assert.ok(['earliest', 'standard', 'latest'].includes(story.tool.startsAt.from));
});
