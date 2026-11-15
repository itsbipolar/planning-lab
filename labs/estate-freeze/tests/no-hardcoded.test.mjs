// No rule or figure from the facts file may be written into the page's own code: every rate, threshold and age comes
// from shared/facts.json. The example's inputs live in model.mjs's one labelled EXAMPLE object; the controls' ranges in
// BOUNDS; display rounding in the formatters. Outside those three blocks model.mjs may type only 0, 1, 2 and 100.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAMPLE, REQUIRED, EAT_IDS, CORP_IDS, RATE_SERIES } from '../model.mjs';

const here = new URL('..', import.meta.url).pathname;
const all = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts;
const facts = all.filter((f) => f.status === 'confirmed');
const files = ['model.mjs', 'app.js', 'build.mjs', 'index.src.html', 'style.css'];
const sources = files.map((f) => [f, readFileSync(here + f, 'utf8')]);
const has = (text, v) => new RegExp(`(?<![\\w.])${String(v).replace(/[.]/g, '\\.')}(?![\\w.])`).test(text);
const top = (id) => facts.find((f) => f.id === id).value.find((r) => r.to == null).rate;
const year = Math.max(...facts.filter((f) => f.series === 'ontario_surtax').map((f) => f.tax_year));

// the figures this tool reads, as the facts file writes them
const figures = [
  top(`federal_brackets.${year}`), top(`ontario_brackets.${year}`),
  ...facts.find((f) => f.id === `ontario_surtax.${year}`).value.map((r) => r.from),
  ...['life_expectancy_age70_male', 'life_expectancy_age70_female', 'dividend_refund_rate', 'part_iv_tax_rate', 'refundable_investment_income_rate',
    'ccpc_additional_refundable_tax_rate', 'ontario_corporate_general_rate', 'ontario_estate_admin_tax_exemption'].map((id) => facts.find((f) => f.id === id).value),
];
// and the shortened forms a hand might type, and the derived top rate on gains
const derived = ['38.33', '30.67', '30.66', '10.67', '10.66', '0.3833', '0.3067', '26.76', '26.77', '0.2676', '0.2677', '53.53', '50.17'];

test('no rate, threshold or life-table figure from the facts file is typed into the page source', () => {
  assert.ok(figures.length >= 12, figures.join(', '));
  for (const [name, text] of sources) for (const v of [...figures, ...derived]) assert.ok(!has(text, v), `${name} contains ${v}: it must come from facts.json`);
});

test('the default ages (death, the trust\'s 21st year) and the 21 itself are never typed', () => {
  const trust = facts.find((f) => f.id === 'trust_deemed_disposition_years').value;
  for (const [name, text] of sources) {
    const code = name === 'style.css' ? '' : text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
    for (const v of [trust, String(EXAMPLE.freezeAge + 17), String(EXAMPLE.freezeAge + Number(trust))]) assert.ok(!has(code, v), `${name} contains ${v}`);
    assert.doesNotMatch(code, /\b21(st)?\b/, `${name} types the 21`);
  }
});

test('outside EXAMPLE, BOUNDS and the formatters, model.mjs types only 0, 1, 2 and 100', () => {
  let src = readFileSync(here + 'model.mjs', 'utf8');
  src = src.replace(/\/\/ @@(EXAMPLE|BOUNDS|FORMAT)[\s\S]*?\/\/ @@END/g, '');
  assert.ok(!/@@EXAMPLE|@@BOUNDS|@@FORMAT/.test(src));
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    .replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, "''")
    .replace(/\/(?:\\.|\[[^\]]*\]|[^/\n\\])+\/[gimsuy]*/g, '/re/');
  const nums = [...code.matchAll(/(?<![\w.$])\d[\d_]*(?:\.\d+)?(?:e\d+)?(?![\w])/g)].map((m) => m[0]);
  const bad = nums.filter((n) => !['0', '1', '2', '100'].includes(n));
  assert.deepEqual(bad, []);
  // the checker can fail
  assert.ok(has('const r = 0.2676;', '0.2676'));
  assert.ok(!has('step * 100;', '10'));
});

test('every id the tool reads exists and is confirmed; the example is labelled as one', () => {
  const ids = [...REQUIRED, ...EAT_IDS, ...CORP_IDS];
  for (const id of ids) assert.ok(facts.some((f) => f.id === id), `${id} is missing or not confirmed`);
  for (const s of RATE_SERIES) assert.ok(facts.some((f) => f.series === s && f.value != null), `${s} has no confirmed year`);
  assert.equal(EXAMPLE.label, 'Example assumptions, not facts');
  const model = readFileSync(here + 'model.mjs', 'utf8');
  assert.equal((model.match(/export const EXAMPLE = \{/g) || []).length, 1, 'one EXAMPLE object');
  for (const [name, text] of sources.filter(([n]) => n !== 'model.mjs')) {
    // the example's dollar amounts are not scattered through the page
    for (const v of [EXAMPLE.value, EXAMPLE.cost, EXAMPLE.income]) assert.ok(!has(text.replace(/_/g, ''), v), `${name} types the example amount ${v}`);
  }
});
