// The Planning Calendar: dates come from confirmed facts, a missing fact makes its date pending, the countdown and the
// superficial-loss window are computed correctly, and no fact value is typed into the code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCalendar, householdDates, countdown, step, factIndex, ids } from '../engine.mjs';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const config = json('../calendar.json');
const fixture = json('../fixtures/facts-with-drafts.json');
const real = json('../../../shared/facts.json');
const Y = config.year, F = factIndex(fixture), v = (id) => F.get(id).value;
const H = (id) => config.households.find((h) => h.id === id);
const C = buildCalendar(config, fixture);
const row = (id) => C.households.find((h) => h.id === id);

test('self-employed: the four instalments, the balance due and the return, in date order', () => {
  const d = row('self_employed').dates.map((x) => x.date);
  assert.deepEqual([...d].sort(), d);
  assert.ok(d.includes(v(`t1_balance_due_date.${Y - 1}`)) && d.includes(v(`t1_self_employed_filing_deadline.${Y - 1}`)));
  assert.equal(row('self_employed').dates.filter((x) => x.id === 'inst').length, 4);
});

test('T3: the day count after the year-end before; T2: the last day of the month that many months after it', () => {
  const days = Number(String(v('t3_filing_deadline_rule')).match(/\d+/)[0]);
  assert.equal(row('trust').dates.find((x) => x.id === 't3').date, new Date(Date.UTC(Y - 1, 11, 31) + days * 864e5).toISOString().slice(0, 10));
  const t2 = row('corporation').dates.find((x) => x.id === 't2').date;
  assert.equal(t2.slice(0, 4), String(Y)); assert.equal(new Date(Date.UTC(+t2.slice(0, 4), +t2.slice(5, 7), 0)).toISOString().slice(0, 10), t2, 'a month-end');
});

test('year-end rules land on the last day of the plan year', () => {
  for (const id of ['turning_maturity', 'rrif', 'fhsa', 'resp', 'donor']) assert.ok(row(id).dates.some((x) => x.date === `${Y}-12-31`), id);
  assert.match(row('turning_maturity').label, new RegExp(`Turning ${v('rrsp_maturity_age')} this year`));
});

test('superficial-loss window: the facts file\'s day count either side of a sale on the last day of each year, clipped to the plan year', () => {
  const n = Number(String(v('superficial_loss_period')).match(/(\d+) calendar days before/)[1]);
  const w = row('losses').windows;
  assert.equal(w.length, 2);
  assert.equal(w[0].from, `${Y}-01-01`); assert.equal(w[0].to, new Date(Date.UTC(Y - 1, 11, 31) + n * 864e5).toISOString().slice(0, 10));
  assert.equal(w[1].from, new Date(Date.UTC(Y, 11, 31) - n * 864e5).toISOString().slice(0, 10)); assert.equal(w[1].to, `${Y}-12-31`);
});

test('countdown: zero on a date, counting down before it, Infinity after the last; the shade step peaks on the date', () => {
  const c = countdown([{ date: `${Y}-03-15` }, { date: `${Y}-04-30` }], Y);
  assert.equal(c[73], 0); assert.equal(c[72], 1); assert.equal(c[74], 45); assert.equal(c[364], Infinity);
  assert.equal(step(0, 56, 24), 23); assert.equal(step(57, 56, 24), 0); assert.ok(step(28, 56, 24) > 1 && step(28, 56, 24) < 23);
});

test('with the real facts file, a date whose fact is not confirmed is pending and not placed', () => {
  const R = factIndex(real);
  for (const h of config.households) {
    const { dates, pending } = householdDates(h, R, Y);
    for (const d of h.dates) {
      const missing = ids(d, Y).some((id) => !R.has(id));
      assert.equal(pending.some((p) => p.id === d.id), missing, `${h.id}/${d.id}`);
      if (missing) assert.ok(!dates.some((x) => x.id === d.id));
    }
  }
});

test('every date cites facts with an official government source', () => {
  for (const h of C.households) for (const d of h.dates) for (const id of d.facts) assert.match(F.get(id).source_url, /^https:\/\/([a-z0-9-]+\.)*(canada\.ca|gc\.ca)\//, id);
});

test('no figure from the facts file is written into the code or the config', () => {
  const here = new URL('..', import.meta.url).pathname;
  const files = ['engine.mjs', 'calendar.json', 'app.js', 'index.src.html'].flatMap((f) => { try { return [[f, readFileSync(here + f, 'utf8')]]; } catch { return []; } });
  const figures = new Set();
  for (const f of fixture.facts) {
    const s = String(f.value);
    if (/^\d+$/.test(s) && Number(s) < 1000) figures.add(s);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { figures.add(s); figures.add(s.slice(5)); }
    for (const m of s.matchAll(/(\d+) (?:calendar )?days/g)) figures.add(m[1]);
    for (const m of s.matchAll(/[A-Z][a-z]+ \d{1,2}\b/g)) figures.add(m[0]);
  }
  for (const [name, t] of files) for (const x of figures) assert.ok(!new RegExp(`(?<![\\w.-])${x.replace(/[.-]/g, '\\$&')}(?![\\w.])`).test(t), `${name} contains ${x}`);
});
