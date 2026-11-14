// Poster data (dist/poster.json, written by each public tool's build; shared/desk/poster.mjs): one per public tool, small,
// at most two readings and two labels, and its readings are the tools' own numbers (the Your year poster's are the core's).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { NEXT, questionOf } from '../desk-page.mjs';
import { POSTER_MAX_BYTES } from '../poster.mjs';
import { yourYearRules, annualPrices, yourYear, EXAMPLE_BIRTH_YEAR } from '../your-year-core.mjs';

const root = new URL('../../../', import.meta.url).pathname;
const json = (p) => JSON.parse(readFileSync(root + p, 'utf8'));
const KINDS = ['lanes', 'lines', 'line', 'dates', 'heat'];

test('every public tool writes a small poster.json with its question, one or two readings and at most two labels', () => {
  for (const t of NEXT.tools) {
    const f = `labs/${t.labSlug}/dist/poster.json`;
    assert.ok(existsSync(root + f), `${f} exists`);
    const text = readFileSync(root + f, 'utf8'), p = JSON.parse(text);
    assert.ok(text.length <= POSTER_MAX_BYTES, `${f}: ${text.length} bytes`);
    assert.equal(p.v, 1); assert.equal(p.slug, t.slug); assert.equal(p.lab, t.labSlug); assert.equal(p.question, questionOf(t));
    assert.ok(KINDS.includes(p.kind), `${f}: kind ${p.kind}`);
    assert.match(p.example, /\S/);
    assert.ok(p.readings.length >= 1 && p.readings.length <= 2);
    for (const r of p.readings) { assert.match(r.label, /\S/); assert.ok(String(r.value).length <= 16); }
    assert.ok(p.labels.length <= 2);
    assert.ok(!/\b(should|recommend)\b|best for you/i.test(text), `${f}: no advice words`);
  }
});

test('the Your year poster carries the core’s numbers for the labelled example year', () => {
  const p = json('labs/planning-timeline/dist/poster.json');
  const Y = yourYear(yourYearRules(json('shared/facts.json')), annualPrices(json('shared/data/cpi-monthly.json')), EXAMPLE_BIRTH_YEAR, p.thisYear);
  assert.equal(p.birthYear, EXAMPLE_BIRTH_YEAR);
  assert.equal(p.readings[0].value, `${Y.y60} to ${Y.y70}`); assert.equal(p.readings[0].text, Y.text.cpp);
  assert.equal(p.readings[1].text, Y.text.tfsa);
  assert.equal(p.labels[0].text, `Today, age ${Y.age}`); assert.equal(p.labels[0].at, Y.age);
});

test('the lines, line and heat posters hold well-formed series', () => {
  const cpp = json('labs/two-number-letter/dist/poster.json');
  assert.equal(cpp.lines.length, 2);
  for (const l of cpp.lines) for (const [x, y] of l.points) assert.ok(Number.isFinite(x) && Number.isFinite(y) && y >= 0);
  assert.ok(cpp.cross.age > cpp.x.min && cpp.cross.age < cpp.x.max);
  const ord = json('labs/order-of-returns/dist/poster.json');
  assert.equal(ord.outcomes.byYear.reduce((a, b) => a + b, 0) + ord.outcomes.lasts, ord.outcomes.total);
  const money = json('labs/money-then-now/dist/poster.json');
  assert.equal(money.line[0][0], money.x.min); assert.equal(money.line.at(-1)[0], money.x.max);
  assert.equal(money.stripes.change.length, money.stripes.to - money.stripes.from + 1);
  const heat = json('labs/retirement-wave/dist/poster.json');
  assert.equal(heat.rows.length, heat.y.max - heat.y.min + 1);
  for (const row of heat.rows) assert.match(row, new RegExp(`^[0-9]{${heat.x.max - heat.x.min + 1}}$`));
  const dates = json('labs/planning-calendar/dist/poster.json');
  assert.equal(dates.months.length, 12); assert.equal(dates.months.reduce((a, b) => a + b, 0), dates.dates.length);
});
