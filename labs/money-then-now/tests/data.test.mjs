// Money, then and now: the yearly series come from the dated snapshots, the arithmetic is consistent,
// the notable years are found in the data, and no rule or figure is typed into the page code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { annual } from '../build.mjs';
import { series } from '../../money-stripes/build.mjs';
import { yearsOf, worth, realRate, extremes, negSpans, counts } from '../model.mjs';

const rd = (f) => readFileSync(new URL(`../../../shared/data/${f}`, import.meta.url), 'utf8');
const cpiText = rd('cpi-monthly.json'), rateText = rd('prime-rate-weekly.json');
const M = annual(cpiText, rateText);
const Y = yearsOf(M);

test('the yearly series run without a gap and hold complete years only', () => {
  assert.equal(M.first, 1915);
  assert.ok(M.last >= 2025);
  assert.deepEqual(Object.keys(M.avg).map(Number), Y);
  assert.deepEqual(Object.keys(M.infl).map(Number), Y);
  const months = {};
  for (const [ym] of JSON.parse(cpiText).months) months[ym.slice(0, 4)] = (months[ym.slice(0, 4)] || 0) + 1;
  for (const y of Y) assert.equal(months[y], 12, `${y} has every month`);
  for (const y of Y) assert.ok(Number.isFinite(M.avg[y]) && M.avg[y] > 0 && Number.isFinite(M.infl[y]));
  assert.equal(M.primeFirst, 1975);
  for (let y = M.primeFirst; y <= M.last; y++) assert.ok(Number.isFinite(M.prime[y]), `prime for ${y}`);
  assert.ok(Object.keys(M.prime).map(Number).every((y) => y >= M.primeFirst && y <= M.last));
});

test('the price change agrees with money-stripes and with the average price levels', () => {
  const s = series(cpiText, rateText);
  assert.deepEqual(Object.fromEntries(s.cpi), M.infl);
  for (const y of Y.slice(1)) assert.ok(Math.abs((M.avg[y] / M.avg[y - 1] - 1) * 100 - M.infl[y]) < 1e-9);
});

test('purchasing power: unchanged within a year, follows the CPI ratio, and goes back and forth', () => {
  for (const y of Y) assert.equal(worth(M, 100, y, y), 100);
  const from = 1990;
  for (const a of Y) for (const b of Y) {
    const wa = worth(M, 250, from, a), wb = worth(M, 250, from, b);
    if (M.avg[a] < M.avg[b]) assert.ok(wa < wb); else if (M.avg[a] > M.avg[b]) assert.ok(wa > wb); else assert.equal(wa, wb);
  }
  for (const y of [1915, 1950, 1990]) assert.ok(Math.abs(worth(M, worth(M, 100, y, M.last), M.last, y) - 100) < 1e-9);
  assert.ok(Math.abs(worth(M, 100, 1990, M.last) - 100 * M.avg[M.last] / M.avg[1990]) < 1e-12);
});

test('real rate = prime minus price change, for every year from the first prime year', () => {
  for (const y of Y) {
    if (y < M.primeFirst) assert.equal(realRate(M, y), null);
    else assert.ok(Math.abs(realRate(M, y) - (M.prime[y] - M.infl[y])) < 1e-12);
  }
  for (const [a, b] of negSpans(M)) for (let y = a; y <= b; y++) assert.ok(realRate(M, y) < 0);
  const c = counts(M);
  assert.equal(c.below, negSpans(M).reduce((n, [a, b]) => n + b - a + 1, 0));
  assert.equal(c.rose + c.fell + Y.filter((y) => M.infl[y] === 0).length, c.years);
});

test('the notable years are found in the data', () => {
  const e = extremes(M);
  assert.equal(e.fall, 1921); assert.ok(M.infl[1921] < -5, 'a big fall in 1921');
  assert.equal(e.rise, Y.reduce((a, y) => (M.infl[y] > M.infl[a] ? y : a)));
  assert.equal(e.recent, 2022); assert.ok(M.infl[2022] > 5 && M.infl[2022] < 9, '2022 rose between 5 and 9 per cent');
  assert.ok(e.since < 2022 && M.infl[e.since] >= M.infl[2022]);
  for (let y = e.since + 1; y < 2022; y++) assert.ok(M.infl[y] < M.infl[2022]);
});

test('every source carries its attribution and retrieval date', () => {
  assert.match(M.meta.cpi.attribution, /does not constitute an endorsement by Statistics Canada/);
  assert.match(M.meta.rate.attribution, /Not affiliated with or endorsed by the Bank of Canada/);
  assert.match(M.meta.cpi.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(M.meta.rate.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('#ShowYourStripes warming stripes by Professor Ed Hawkins, University of Reading, CC BY 4.0; this page uses the idea for prices and has nothing to do with climate data.'));
  assert.ok(html.includes('Education only, not advice.</strong> Made with AI assistance; every figure is checked at its source.'));
  assert.ok(html.includes('Every figure here is computed from the dated public data named below.'));
});

test('an incomplete year is left out', () => {
  const broken = JSON.parse(cpiText); broken.months = broken.months.filter(([m]) => m !== '1950-06');
  assert.throws(() => annual(JSON.stringify(broken), rateText));
});

// Same approach as labs/planning-timeline/tests/data.test.mjs: no confirmed figure from shared/facts.json, and no year
// or value read from the data, is written into the page code.
const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts.filter((f) => f.status === 'confirmed');
const has = (t, v) => new RegExp(`(?<![\\w.-])${String(v).replace(/\./g, '\\.')}(?![\\w.])`).test(t);

test('no figure from the facts file, and no notable year from the data, is written into the page code', () => {
  const here = new URL('..', import.meta.url).pathname;
  const figures = new Set([
    ...facts.filter((f) => typeof f.value === 'string' && /^\d+(\.\d+)?$/.test(f.value)).map((f) => f.value),
    ...facts.find((f) => f.id === 'rrif_minimum_factors').value.map((r) => r.factor), '42', '36']);
  assert.ok(figures.size > 20);
  const e = extremes(M), found = [e.rise, e.fall, e.recent, e.since, M.primeFirst, M.last, ...negSpans(M).flat()];
  for (const f of ['app.js', 'model.mjs', 'index.src.html', 'style.css']) {
    const t = readFileSync(here + f, 'utf8');
    for (const v of figures) assert.ok(!has(t, v), `${f} contains ${v}`);
    for (const v of found) assert.ok(!has(t, v), `${f} contains the data year ${v}`);
  }
});

test('the check can fail: a planted figure is caught', () => {
  assert.ok(has('var age = 65; // the OAS age', '65'));
  assert.ok(has('if (y === 2022) label()', 2022));
  assert.ok(!has('font-size:15px', '15'));
});
