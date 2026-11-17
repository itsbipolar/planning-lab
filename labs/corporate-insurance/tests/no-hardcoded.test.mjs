// No rule or figure from the facts file may be written into the page's own code: every rate comes from
// shared/facts.json. The example's inputs live in model.mjs's one labelled EXAMPLE object; the controls' ranges in
// BOUNDS; display rounding in FORMAT. Outside those three blocks model.mjs may type only 0, 1 and 100.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAMPLE, REQUIRED, OPTIONAL, RATE_SERIES, insuranceRules } from '../model.mjs';

const here = new URL('..', import.meta.url).pathname;
const all = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts;
const facts = all.filter((f) => f.status === 'confirmed');
const files = ['model.mjs', 'app.js', 'build.mjs', 'index.src.html', 'style.css'];
const sources = files.map((f) => [f, readFileSync(here + f, 'utf8')]);
const has = (text, v) => new RegExp(`(?<![\\w.])${String(v).replace(/[.]/g, '\\.')}(?![\\w.])`).test(text);
const R = insuranceRules(all);
const fact = (id) => facts.find((f) => f.id === id);
const top = (id) => fact(id).value.find((r) => r.to == null).rate;

// the figures this tool reads, as the facts file writes them, plus the shortened forms a hand might type
const figures = [
  fact('dividend_gross_up_non_eligible').value, fact('federal_dividend_tax_credit_non_eligible').value, '69.23', '69.2308',
  ...facts.filter((f) => f.series === 'ontario_dividend_tax_credit_non_eligible').map((f) => f.value),
  top(`federal_brackets.${R.rateYear}`), top(`ontario_brackets.${R.rateYear}`),
  ...fact(`ontario_surtax.${R.rateYear}`).value.flatMap((r) => [r.from, r.rate]),
];
const derived = ['47.74', '0.4774', '47.7', '27.57', '20.17', '0.2757', '0.2017'];

test('no rate or threshold from the facts file is typed into the page source', () => {
  assert.ok(figures.length >= 11, figures.join(', '));
  for (const v of ['15', '22.895', '15.2283', '33', '13.16', '5818', '7446', '20', '36']) assert.ok(figures.includes(v), `${v} is checked`);
  for (const [name, text] of sources) for (const v of [...figures, ...derived]) assert.ok(!has(text, v), `${name} contains ${v}: it must come from facts.json`);
  for (const [name, text] of sources) { assert.ok(!text.includes('9/13'), `${name} types 9/13`); assert.ok(!/T2054/.test(text), `${name} names the form`); }
  // the checker can fail
  assert.ok(has('const r = 0.4774;', '0.4774'));
  assert.ok(has('x * 15 +', '15'));
  assert.ok(!has('padding: 15px', '15') && !has('1.5rem', '15'));
});

test('outside EXAMPLE, BOUNDS and FORMAT, model.mjs types only 0, 1 and 100', () => {
  let src = readFileSync(here + 'model.mjs', 'utf8');
  src = src.replace(/\/\/ @@(EXAMPLE|BOUNDS|FORMAT)[\s\S]*?\/\/ @@END/g, '');
  assert.ok(!/@@EXAMPLE|@@BOUNDS|@@FORMAT/.test(src));
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    .replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, "''")
    .replace(/\/(?:\\.|\[[^\]]*\]|[^/\n\\])+\/[gimsuy]*/g, '/re/');
  const nums = [...code.matchAll(/(?<![\w.$])\d[\d_]*(?:\.\d+)?(?:e\d+)?(?![\w])/g)].map((m) => m[0]);
  assert.deepEqual(nums.filter((n) => !['0', '1', '100'].includes(n)), []);
});

test('every id the tool reads exists and is confirmed; the example is labelled as one and typed once', () => {
  for (const id of [...REQUIRED, ...OPTIONAL]) assert.ok(fact(id), `${id} is missing or not confirmed`);
  for (const s of RATE_SERIES) assert.ok(fact(`${s}.${R.rateYear}`), `${s}.${R.rateYear}`);
  assert.equal(EXAMPLE.label, 'Example assumptions, not facts');
  const model = readFileSync(here + 'model.mjs', 'utf8');
  assert.equal((model.match(/export const EXAMPLE = \{/g) || []).length, 1, 'one EXAMPLE object');
  for (const [name, text] of sources.filter(([n]) => n !== 'model.mjs')) {
    for (const v of [EXAMPLE.payout, EXAMPLE.acb]) assert.ok(!has(text.replace(/_/g, ''), v), `${name} types the example amount ${v}`);
  }
});
