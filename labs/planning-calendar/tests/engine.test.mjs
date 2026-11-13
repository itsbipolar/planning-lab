// The planning calendar: the twelve months from a given day run across the year boundary, dates come from confirmed
// facts only (a held but unconfirmed fact makes a date pending, an absent one leaves it out), situations combine without
// duplicates, the calendar file is valid iCalendar, and no fact value is typed into the code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rolling, finding, toICS, icsEscape, icsFold, factIndex, rulesFor, ms, iso } from '../engine.mjs';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const config = json('../calendar.json');
const real = json('../../../shared/facts.json');
const F = factIndex(real), v = (id) => F.get(id).value;
const ALL = config.situations.map((s) => s.id);
const TODAY = '2026-11-13', DAY = 864e5;
const day = (t) => new Date(t).toISOString().slice(0, 10);
const withStatus = (id, status) => ({ facts: real.facts.map((f) => (f.id === id ? { ...f, status, value: null } : f)) });
const without = (id) => ({ facts: real.facts.filter((f) => f.id !== id) });

test('the twelve months run from today across the year boundary, and every date in them is inside', () => {
  const c = rolling(config, real, TODAY, ALL), y = +TODAY.slice(0, 4);
  assert.equal(c.end, day(Date.UTC(y + 1, 10, 13) - DAY));
  assert.ok(c.events.length > 0);
  for (const e of c.events) assert.ok(e.date >= TODAY && e.date <= c.end, e.key);
  assert.ok(c.events.some((e) => e.date.startsWith(String(y))) && c.events.some((e) => e.date.startsWith(String(y + 1))), 'dates from both years');
  assert.deepEqual(c.events.map((e) => e.date), c.events.map((e) => e.date).slice().sort());
  assert.equal(c.events[0].days, (ms(c.events[0].date) - ms(TODAY)) / DAY);
  // the weeks are Mondays, cover the window and hold every date once
  assert.equal(new Date(ms(c.weeks[0].monday)).getUTCDay(), 1);
  assert.equal(c.weeks[0].from, TODAY); assert.equal(c.weeks.at(-1).to, c.end);
  assert.equal(c.weeks.reduce((k, w) => k + w.events.length, 0), c.events.length);
  for (const w of c.weeks) for (const e of w.events) assert.ok(e.date >= w.from && e.date <= w.to);
});

test('each rule lands where its fact says: balance and self-employed dates, instalments, T2 and T3 from the year-end before', () => {
  const c = rolling(config, real, TODAY, ALL), y = +TODAY.slice(0, 4), on = (rule) => c.events.filter((e) => e.rule === rule).map((e) => e.date);
  assert.deepEqual(on('balance'), [v(`t1_balance_due_date.${y}`)]);
  assert.deepEqual(on('se_return'), [v(`t1_self_employed_filing_deadline.${y}`)]);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const inst = [y, y + 1].flatMap((yy) => [...v('individual_instalment_due_dates').matchAll(/([A-Z][a-z]+) (\d{1,2})/g)].map((m) => day(Date.UTC(yy, months.indexOf(m[1]), +m[2]))));
  assert.deepEqual(on('inst'), inst.filter((d) => d >= TODAY && d <= c.end));
  const t3days = Number(String(v('t3_filing_deadline_rule')).match(/(\d+) days/)[1]);
  assert.deepEqual(on('t3'), [day(Date.UTC(y, 11, 31) + t3days * DAY)]);
  const t2 = on('t2')[0];
  assert.equal(day(Date.UTC(+t2.slice(0, 4), +t2.slice(5, 7), 0)), t2, 'a month-end');
  assert.ok(t2 > `${y + 1}-01-01` && t2 < `${y + 1}-12-31`);
  for (const r of ['corp_ye', 'trust_ye', 'mature', 'rrif_min', 'fhsa', 'resp', 'gifts', 'losses']) assert.deepEqual(on(r), [`${y}-12-31`], r);
});

test('the superficial-loss period: the fact\'s day count either side of a sale on the year\'s last day, clipped to the window', () => {
  const n = Number(String(v('superficial_loss_period')).match(/(\d+) calendar days before/)[1]), y = +TODAY.slice(0, 4);
  const c = rolling(config, real, TODAY, ['losses']), sale = Date.UTC(y, 11, 31);
  assert.deepEqual(c.windows, [{ rule: 'losses', from: day(sale - n * DAY), to: day(sale + n * DAY), sale: `${y}-12-31` }]);
  // in early January the period around the sale before is cut at today
  const jan = rolling(config, real, `${y + 1}-01-05`, ['losses']);
  assert.equal(jan.windows[0].from, `${y + 1}-01-05`); assert.equal(jan.windows[0].to, day(sale + n * DAY));
  assert.match(c.events[0].text, /that period runs from .+ to .+\.$/);
});

test('pending: a fact held but not confirmed makes its date pending and keeps it off the calendar; an absent fact leaves it out', () => {
  const y = +TODAY.slice(0, 4);
  // the real file: these are pending for next year
  const c = rolling(config, real, TODAY, ALL);
  for (const p of c.pending) {
    assert.ok(p.facts.every((id) => !F.has(id)), p.label);
    assert.ok(!c.events.some((e) => e.rule === p.rule && e.date.startsWith(String(p.year))));
  }
  for (const id of [`t1_filing_deadline.${y}`, `rrsp_contribution_deadline.${y}`]) if (!F.has(id)) assert.ok(c.pending.some((p) => p.facts.includes(id)), id);
  // unconfirm one: its date leaves the calendar and is listed as pending, once
  const u = rolling(config, withStatus(`t1_balance_due_date.${y}`, 'unverified'), TODAY, ['personal', 'self_employed']);
  assert.ok(!u.events.some((e) => e.rule === 'balance'));
  assert.equal(u.pending.filter((p) => p.rule === 'balance').length, 1);
  assert.equal(u.pending.find((p) => p.rule === 'balance').year, y + 1);
  // remove one: left out, not pending
  const a = rolling(config, without(`t1_balance_due_date.${y}`), TODAY, ['personal']);
  assert.ok(!a.events.some((e) => e.rule === 'balance') && !a.pending.some((p) => p.rule === 'balance'));
  // a rule fact for every year, unconfirmed: one pending line, not one per year
  const r = rolling(config, withStatus('rrif_minimum_payment_timing', 'pending'), TODAY, ['rrif']);
  assert.equal(r.events.length, 0); assert.equal(r.pending.length, 1);
  // nothing pending is reported for a year that ended before the window
  assert.ok(c.pending.every((p) => p.year >= y));
});

test('situations combine into one calendar without duplicates', () => {
  const both = rolling(config, real, TODAY, ['personal', 'self_employed', 'instalments', 'corporation']);
  const keys = both.events.map((e) => e.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(both.events.filter((e) => e.rule === 'balance').length, 1, 'the balance owing once, though two situations bring it');
  const sep = ['personal', 'self_employed', 'instalments', 'corporation'].map((s) => rolling(config, real, TODAY, [s]).events.map((e) => e.key));
  assert.deepEqual([...new Set(sep.flat())].sort(), [...keys].sort());
  assert.deepEqual(rulesFor(config, ['personal', 'self_employed']), ['file', 'balance', 'se_return']);
  for (const p of config.presets) for (const s of p.situations) assert.ok(config.situations.some((x) => x.id === s), `${p.id}: ${s}`);
  for (const s of config.situations) for (const r of s.rules) assert.ok(config.rules[r], `${s.id}: ${r}`);
});

test('the headline sentence', () => {
  const ex = config.presets.find((p) => p.id === config.example);
  const c = rolling(config, real, TODAY, ex.situations), s = finding(c, ex.noun);
  assert.match(s, new RegExp(`^For ${ex.noun}, the next confirmed date is .+, on .+, in ${c.events[0].days} days; ${c.events.length} dates fall in the next twelve months`));
  assert.match(finding(rolling(config, real, TODAY, []), null), /^Tick at least one situation/);
  assert.match(finding(rolling(config, real, c.events[0].date, ex.situations), null), /, today;/);
  assert.match(finding(rolling(config, withStatus('rrif_minimum_payment_timing', 'pending'), TODAY, ['rrif']), null), /no confirmed date falls .+ 1 more is not confirmed yet\.$/);
});

test('the calendar file: valid iCalendar with all-day events, stable UIDs, escaped text, folded lines and CRLF', () => {
  const c = rolling(config, real, TODAY, ALL), ics = toICS(c);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'every line ends in CRLF');
  const lines = ics.split('\r\n').slice(0, -1);
  for (const l of lines) assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `too long: ${l}`);
  assert.equal(lines.filter((l) => l === 'BEGIN:VEVENT').length, c.events.length);
  assert.equal(lines.filter((l) => l === 'END:VEVENT').length, c.events.length);
  const unfolded = ics.replace(/\r\n /g, '').split('\r\n');
  const starts = unfolded.filter((l) => l.startsWith('DTSTART')), ends = unfolded.filter((l) => l.startsWith('DTEND'));
  assert.deepEqual(starts, c.events.map((e) => `DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`));
  ends.forEach((l, k) => assert.equal(l, `DTEND;VALUE=DATE:${iso(ms(c.events[k].date) + DAY).replace(/-/g, '')}`));
  const descs = unfolded.filter((l) => l.startsWith('DESCRIPTION:'));
  for (const d of descs) { assert.match(d, /\\nSource: https:\/\/.+\\nEducation only\\, not advice\.$/); assert.ok(!/[^\\][,;]/.test(d.slice('DESCRIPTION:'.length)), d); }
  // stable: the same event has the same UID when the file is made on another day
  const uid = (x) => x.replace(/\r\n /g, '').split('\r\n').filter((l) => l.startsWith('UID:'));
  const later = uid(toICS(rolling(config, real, '2026-12-01', ALL)));
  assert.ok(uid(ics).filter((u) => later.includes(u)).length >= later.length - 1);
  assert.equal(new Set(uid(ics)).size, c.events.length);
  // escaping and folding on their own
  assert.equal(icsEscape('a\\b;c,d\ne'), String.raw`a\\b\;c\,d\ne`);
  const long = 'DESCRIPTION:' + 'é'.repeat(80) + 'x'.repeat(100);
  const folded = icsFold(long);
  for (const l of folded.split('\r\n')) assert.ok(Buffer.byteLength(l, 'utf8') <= 75);
  assert.equal(folded.replace(/\r\n /g, ''), long);
  assert.ok(!folded.includes('�'));
});

test('every date cites facts with an official government source', () => {
  for (const e of rolling(config, real, TODAY, ALL).events) for (const s of e.sources) assert.match(s.url, /^https:\/\/([a-z0-9-]+\.)*(canada\.ca|gc\.ca)\//, s.id);
});

test('no figure from the facts file is written into the code, the config or the styles', () => {
  const here = new URL('..', import.meta.url).pathname;
  const figure = (x) => new RegExp(`(?<![\\w.-])${x.replace(/[.-]/g, '\\$&')}(?!\\w|\\.\\d)`);
  const files = ['engine.mjs', 'calendar.json', 'app.js', 'index.src.html', 'style.css', 'build.mjs'].map((f) => [f, readFileSync(here + f, 'utf8')]);
  const figures = new Set(['60', '65', '70', '71', '0.6', '0.7', '36', '42', '10', '15', '18', '21', '30', '90', '20']);
  for (const f of real.facts.filter((x) => x.status === 'confirmed')) {
    const s = typeof f.value === 'string' ? f.value : '';
    if (/^\d+(\.\d+)?$/.test(s) && Number(s) < 1000) figures.add(s);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { figures.add(s); figures.add(s.slice(5)); }
    for (const m of s.matchAll(/(\d+) (?:calendar )?days/g)) figures.add(m[1]);
    for (const m of s.matchAll(/(\d+)%/g)) figures.add(m[1]);
    for (const m of s.matchAll(/[A-Z][a-z]+ \d{1,2}\b/g)) figures.add(m[0]);
  }
  for (const [name, t] of files) for (const x of figures) assert.ok(!figure(x).test(t), `${name} contains ${x}`);
  // the check can fail
  assert.ok(figure('71').test('turns 71.') && figure('0.6').test('x = 0.6;') && !figure('71').test('a71 71px 7.71'));
});
