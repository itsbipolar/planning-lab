// The Ages That Matter: the grids follow the facts exactly, a missing fact stops the build, and no rate, age or factor is
// written into the page code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModel, EXAMPLE_FUND } from '../model.mjs';

const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8'));
const F = new Map(facts.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f.value]));
const n = (id) => Number(F.get(id));
const M = buildModel(facts);

test('CPP: every start month from the earliest to the latest age, the change per month from the facts', () => {
  const lo = n('cpp_earliest_start_age'), std = n('cpp_standard_start_age'), hi = n('cpp_latest_start_age');
  assert.equal(M.cpp.cells.length, (hi - lo) * 12 + 1);
  const at = (a, m) => M.cpp.cells.find((c) => c.age === a && c.month === m).pct;
  assert.equal(at(std, 0), 0);
  assert.ok(Math.abs(at(lo, 0) - -(std - lo) * 12 * n('cpp_early_start_reduction')) < 1e-9);
  assert.ok(Math.abs(at(hi, 0) - (hi - std) * 12 * n('cpp_late_start_increase')) < 1e-9);
  assert.ok(Math.abs(at(std - 1, 11) - -1 * n('cpp_early_start_reduction')) < 1e-9, 'one month early');
  assert.ok(!M.cpp.cells.some((c) => c.age === hi && c.month > 0), 'no start after the latest age');
});

test('OAS: no increase at the start age, the facts\' increase per month of deferral, up to the maximum age', () => {
  const o0 = n('oas_start_age'), oMax = n('oas_deferral_max_age');
  assert.equal(M.oas.cells.length, (oMax - o0) * 12 + 1);
  assert.equal(M.oas.cells[0].pct, 0);
  assert.ok(Math.abs(M.oas.cells.at(-1).pct - (oMax - o0) * 12 * n('oas_deferral_increase')) < 1e-9);
});

test('RRIF: one row per age in the factor table, rising; the example fund is an illustration', () => {
  const rows = F.get('rrif_minimum_factors');
  assert.equal(M.rrif.rows.length, rows.length);
  M.rrif.rows.forEach((r, i) => { assert.equal(r.age, rows[i].age); assert.equal(r.factor, Number(rows[i].factor)); if (i) assert.ok(r.factor >= M.rrif.rows[i - 1].factor); });
  assert.equal(M.rrif.fund, EXAMPLE_FUND);
});

test('a missing fact stops the build instead of drawing a guess', () => {
  assert.throws(() => buildModel({ facts: facts.facts.filter((f) => f.id !== 'cpp_late_start_increase') }), /not confirmed/);
});

test('no rate, age or factor from the facts file is written into the page code', () => {
  const here = new URL('..', import.meta.url).pathname;
  const ids = ['cpp_earliest_start_age', 'cpp_standard_start_age', 'cpp_latest_start_age', 'cpp_early_start_reduction', 'cpp_late_start_increase', 'oas_start_age', 'oas_deferral_max_age', 'oas_deferral_increase', 'rrsp_maturity_age'];
  const figures = new Set([...ids.map((id) => String(F.get(id))), ...F.get('rrif_minimum_factors').map((r) => r.factor), '42', '36']);
  for (const f of ['app.js', 'model.mjs', 'index.src.html', 'style.css']) {
    const t = readFileSync(here + f, 'utf8');
    for (const v of figures) assert.ok(!new RegExp(`(?<![\\w.-])${v.replace('.', '\\.')}(?![\\w.])`).test(t), `${f} contains ${v}`);
  }
});
