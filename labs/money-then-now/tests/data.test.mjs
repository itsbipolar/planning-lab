// Money, then and now: the yearly series come from the dated snapshots, the arithmetic is consistent,
// the notable years are found in the data, and no rule or figure is typed into the page code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { annual } from '../build.mjs';
import { series } from '../series.mjs';
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

test('the price change agrees with series() and with the average price levels', () => {
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

// This year in money (#this-year; money-year merged here): money-year's model, unchanged, with the budget's name read
// from the confirmed facts' ids. Every proposal comes from confirmed facts, and no budget figure or Bank of Canada
// reading is typed into the page code.
import { thisYear } from '../build.mjs';
import { CHIP_YEARS, steepest, EXAMPLE } from '../model.mjs';
const snapText = rd('money-year-2026.json'), factsText = readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8');
const T = thisYear(snapText, factsText);

test('this year: four measures, the confirmed proposals, the budget named from its facts, the Bank attribution', () => {
  assert.equal(T.panels.length, 4);
  assert.deepEqual(T.panels.map((p) => p.id), ['policy', 'mortgage', 'inflation', 'loonie']);
  assert.ok(T.proposals.length >= 1);
  const all = JSON.parse(factsText).facts;
  for (const p of T.proposals) for (const id of p.facts) assert.equal(all.find((f) => f.id === id)?.status, 'confirmed', id);
  assert.match(T.budgetName, /^Budget \d{4}$/);
  assert.ok(T.proposals.every((p) => p.facts.every((id) => id.startsWith(T.budgetName.replace(' ', '').toLowerCase() + '_'))));
  assert.match(T.budgetUrl, /^https:\/\/([\w-]+\.)*canada\.ca\//);
  assert.match(T.source.attribution, /Not affiliated with or endorsed by the Bank of Canada/);
  // a proposal whose fact is not confirmed is left out
  const less = JSON.stringify({ facts: all.map((f) => (f.id === 'budget2026_t1135_threshold' ? { ...f, status: 'unverified' } : f)) });
  assert.ok(!thisYear(snapText, less).proposals.some((p) => p.id === 't1135'));
  // the built page carries it
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const D = JSON.parse(html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<'));
  assert.deepEqual(D.now.proposals.map((p) => p.id), T.proposals.map((p) => p.id));
  assert.ok(html.includes('id="this-year"'));
});

test('no budget figure and no Bank of Canada reading is written into the page code', () => {
  const here = new URL('..', import.meta.url).pathname, snap = JSON.parse(snapText);
  const budget = JSON.parse(factsText).facts.filter((f) => f.id.startsWith('budget') && f.status === 'confirmed').map((f) => String(f.value)).filter((v) => /\d{3,}/.test(v));
  const rates = [...new Set(Object.values(snap.series).flatMap((s) => s.points.map((p) => String(p[1]))))].filter((v) => /\.\d/.test(v));
  assert.ok(budget.length >= 5 && rates.length > 20);
  // the stylesheet holds sizes, not figures (as money-year's test): it is checked for budget figures only
  for (const f of ['app.js', 'model.mjs', 'index.src.html', 'style.css']) {
    const t = readFileSync(here + f, 'utf8');
    for (const v of f === 'style.css' ? budget : [...budget, ...rates]) assert.ok(!new RegExp(`(?<![\\w.])${v.replace(/\./g, '\\.')}(?![\\w.])`).test(t), `${f} contains ${v}`);
    assert.ok(!/Budget \d{4}/.test(t), `${f} names a budget year`);
  }
});

test('the year chips sit inside the data; the line chart’s annotation is the steepest later rise', () => {
  for (const y of CHIP_YEARS) assert.ok(y >= M.first && y <= M.last, `${y}`);
  assert.ok(CHIP_YEARS.includes(EXAMPLE.year));
  const s = steepest(M, EXAMPLE.year);
  assert.ok(s > EXAMPLE.year && s <= M.last);
  for (let y = EXAMPLE.year + 1; y <= M.last; y++) assert.ok(M.infl[y] <= M.infl[s]);
  assert.equal(steepest(M, M.last), null);
});
