// Nothing from the facts file or the bond snapshot may be written into the page's own code: the rules come from
// shared/facts.json, the yields from shared/data/long-bond-yield-yearly.json. The made-up settings live in model.mjs's
// ASSUMPTIONS block and display rounding in FORMAT; outside them model.mjs may type only 0, 1, 2 and 100.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAMPLE, BOUNDS, REQUIRED, OPTIONAL, parRules, yieldsFrom, run, summary, pts } from '../model.mjs';

const here = new URL('..', import.meta.url).pathname;
const all = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts;
const snap = JSON.parse(readFileSync(new URL('../../../shared/data/long-bond-yield-yearly.json', import.meta.url), 'utf8'));
const files = ['model.mjs', 'app.js', 'build.mjs', 'index.src.html', 'style.css'];
const sources = files.map((f) => [f, readFileSync(here + f, 'utf8')]);
const has = (text, v) => new RegExp(`(?<![\\w.])${String(v).replace(/[.]/g, '\\.')}(?![\\w.])`).test(text);
const R = parRules(all);
const norm = (s) => s.replace(/[’']/g, "'").replace(/\s+/g, ' ');

test('no fact text (nor any 40-character slice of it) is typed into the page source', () => {
  const texts = R.used.filter((f) => typeof f.value === 'string').map((f) => norm(f.value));
  assert.ok(texts.length >= 10);
  for (const [name, raw] of sources) {
    const src = norm(raw);
    for (const t of texts) for (let i = 0; i + 40 <= t.length; i += 5) assert.ok(!src.includes(t.slice(i, i + 40)), `${name} types "${t.slice(i, i + 40)}"`);
  }
  // the checker can fail
  const t = texts[0]; assert.ok(norm(`x ${t} y`).includes(t.slice(0, 40)));
});

test('the shareholder tiers are not typed', () => {
  const figs = ['2.5%', '7.5', '10%', '250000000', '500000000', '1000000000', '250_000_000', '1e9'];
  for (const [name, text] of sources) {
    if (name === 'style.css') { for (const v of ['250000000', '500000000', '1000000000']) assert.ok(!text.includes(v), `${name} ${v}`); continue; }
    for (const v of figs) assert.ok(!(v.endsWith('%') ? text.includes(v) : has(text, v)), `${name} contains ${v}`);
  }
  assert.ok(has('rate = 7.5;', '7.5') && !has('17.5px', '7.5'));
});

test('no bond yield is typed: every snapshot value with a non-zero hundredths digit appears in none of the sources', () => {
  const vals = [...new Set(snap.values.map(([, v]) => v).filter((v) => Math.round(v * 100) % 10 !== 0).map(String))];
  assert.ok(vals.length > 20, vals.length);
  for (const v of ['15.27', '12.67', '11.69']) assert.ok(vals.includes(v), v);
  for (const [name, text] of sources) for (const v of vals) assert.ok(!has(text, v), `${name} contains the yield ${v}`);
});

test('outside ASSUMPTIONS and FORMAT, model.mjs types only 0, 1, 2 and 100', () => {
  let src = readFileSync(here + 'model.mjs', 'utf8');
  src = src.replace(/\/\/ ASSUMPTIONS[\s\S]*?\/\/ end ASSUMPTIONS/, '').replace(/\/\/ FORMAT[\s\S]*?\/\/ end FORMAT/, '');
  assert.ok(!/export const (EXAMPLE|PAT|BOUNDS|pts) /.test(src), 'the blocks were cut');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    .replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, "''")
    .replace(/\/(?:\\.|\[[^\]]*\]|[^/\n\\])+\/[gimsuy]*/g, '/re/');
  const nums = [...code.matchAll(/(?<![\w.$])\d[\d_]*(?:\.\d+)?(?:e\d+)?(?![\w])/g)].map((m) => m[0]);
  assert.deepEqual(nums.filter((n) => ![0, 1, 2, 100].includes(Number(n))), []);
});

test('every fact id the page reads exists and is confirmed; the example is labelled', () => {
  const confirmed = all.filter((f) => f.status === 'confirmed');
  for (const id of [...Object.values(REQUIRED), ...Object.values(OPTIONAL)]) assert.ok(confirmed.find((f) => f.id === id), `${id} is missing or not confirmed`);
  assert.equal(EXAMPLE.label, 'Example assumptions, not facts');
});

test('the dist carries the data from 1960, and its first paint shows the computed figure', () => {
  const dist = readFileSync(here + 'dist/index.html', 'utf8');
  const data = JSON.parse(dist.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1]);
  const from = EXAMPLE.start - Math.max(...BOUNDS.L);
  assert.deepEqual(data.bond.values, snap.values.filter(([ym]) => Number(ym.slice(0, 4)) >= from));
  assert.equal(data.bond.values[0][0], `${from}-12`);
  const S = summary(run(yieldsFrom(snap).Y));
  assert.match(dist, new RegExp(`data-readout-v>${pts(S.maxMoveCredited).replace('.', '\\.')}</span>`));
  assert.deepEqual(data.facts.map((f) => f.id).sort(), R.used.map((f) => f.id).sort());
});
