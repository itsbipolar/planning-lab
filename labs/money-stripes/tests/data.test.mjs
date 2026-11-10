// The yearly series are computed from the dated snapshots. These checks catch arithmetic or data mistakes
// (sanity ranges are wide on purpose: they guard against a bug, not against the economy).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { series } from '../build.mjs';

const rd = (f) => readFileSync(new URL(`../../../shared/data/${f}`, import.meta.url), 'utf8');
const s = series(rd('cpi-monthly.json'), rd('prime-rate-weekly.json'));
const infl = Object.fromEntries(s.cpi), prime = Object.fromEntries(s.rate);

test('price years run without a gap, only complete years, none is NaN', () => {
  assert.equal(s.cpi[0][0], 1915);
  for (let i = 1; i < s.cpi.length; i++) assert.equal(s.cpi[i][0], s.cpi[i - 1][0] + 1);
  assert.ok(s.cpi.every(([, v]) => Number.isFinite(v)));
  assert.ok(s.cpi.at(-1)[0] >= 2025, 'the last complete year should be reached');
});
test('known shapes are present: the 1920s deflation, the 2022 spike', () => {
  assert.ok(infl[1921] < -5, 'prices fell sharply in 1921');
  assert.ok(infl[2022] > 5 && infl[2022] < 9, 'about seven per cent in 2022');
  assert.ok(Math.max(...Object.values(infl)) > 10);
});
test('prime rate: complete years from the first full year, believable range, 1981 high', () => {
  assert.equal(s.rate[0][0], 1975);
  assert.ok(s.rate.every(([, v]) => Number.isFinite(v) && v >= 0 && v < 25));
  assert.ok(prime[1981] > 15, 'the early-1980s peak');
});
test('every source carries its attribution and retrieval date', () => {
  assert.match(s.meta.cpi.attribution, /does not constitute an endorsement by Statistics Canada/);
  assert.match(s.meta.rate.attribution, /Not affiliated with or endorsed by the Bank of Canada/);
  assert.match(s.meta.cpi.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(s.meta.rate.retrieved, /^\d{4}-\d{2}-\d{2}$/);
});
test('the check can fail: a gap is caught', () => {
  const broken = JSON.parse(rd('cpi-monthly.json')); broken.months = broken.months.filter(([m]) => m !== '1950-06');
  const t = series(JSON.stringify(broken), rd('prime-rate-weekly.json'));
  assert.ok(!t.cpi.some(([y]) => y === 1950), '1950 is incomplete, so it must not appear');
});
