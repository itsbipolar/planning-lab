// The long-bond snapshot: whole, dated and attributed, one December value per year from 1950 without a gap,
// the latest month kept separately, and two spot values checked against the published table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const snap = JSON.parse(readFileSync(new URL('../../../shared/data/long-bond-yield-yearly.json', import.meta.url), 'utf8'));

test('the snapshot is dated, sourced and carries both attribution lines and the change made', () => {
  assert.match(snap.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(snap.source, /Table 10-10-0122-01, vector v122487/);
  assert.equal(snap.source_url, 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1010012201');
  assert.equal(snap.terms_url, 'https://www.bankofcanada.ca/terms/');
  assert.match(snap.attribution, /^Adapted from Statistics Canada, Table 10-10-0122-01 \(Bank of Canada data\)\. This does not constitute an endorsement by Statistics Canada of this product\./);
  assert.match(snap.attribution, /Source: Bank of Canada\. Not affiliated with or endorsed by the Bank of Canada\.$/);
  assert.match(snap.changes, /Year-end values taken from the monthly series/);
});

test('one December value per year from 1950, no gap, plausible percentages', () => {
  assert.equal(snap.values[0][0], '1950-12');
  const last = Number(snap.values.at(-1)[0].slice(0, 4));
  assert.ok(last >= 2025);
  assert.equal(snap.values.length, last - 1950 + 1);
  snap.values.forEach(([ym, v], i) => {
    assert.equal(ym, `${1950 + i}-12`);
    assert.ok(Number.isFinite(v) && v > 0 && v < 20, `${ym} ${v}`);
  });
});

test('the latest month is the newest observation, at or after the last December', () => {
  const [ym, v] = snap.latest;
  assert.match(ym, /^\d{4}-(0[1-9]|1[0-2])$/);
  assert.ok(ym >= snap.values.at(-1)[0]);
  assert.ok(Number.isFinite(v) && v > 0 && v < 20);
});

test('spot values match the published series', () => {
  const m = Object.fromEntries(snap.values);
  assert.equal(m['2020-12'], 1.13);
  assert.equal(m['2025-12'], 3.8);
});
