// The Planning Year: the synthetic book, the trigger rules, the load and the CSV. Rule tests use a fixture holding the
// confirmed facts plus the six P5 drafts as if confirmed; the pending tests use the real shared/facts.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBook } from '../book.mjs';
import { buildTriggers, load, metrics, compare, toCSV, safeCell, segmentOf, factIndex, factIds } from '../engine.mjs';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const config = json('../triggers.json');
const fixture = json('../fixtures/facts-with-drafts.json');
const real = json('../../../shared/facts.json');
const F = factIndex(fixture);
const v = (id) => F.get(id).value;
const book = makeBook({ seed: config.seed, n: config.households, year: config.year });
const Y = config.year;
const one = (h) => ({ ...book, households: [h] });
const hh = (over) => ({ id: 'T-1', members: [{ birth: '1980-06-10', rrsp: true }], selfEmployed: false, instalments: false, holdco: null, trust: null, reviewQuarter: 2, ...over });

test('same seed, same book; another seed, another book', () => {
  assert.deepEqual(makeBook({ seed: config.seed }), makeBook({ seed: config.seed }));
  assert.notDeepEqual(makeBook({ seed: config.seed }).households, makeBook({ seed: config.seed + 1 }).households);
});

test('the book is synthetic, the right size, and holds IDs only (no names)', () => {
  assert.equal(book.synthetic, true);
  assert.equal(book.households.length, config.households);
  const keys = new Set(book.households.flatMap((h) => [...Object.keys(h), ...h.members.flatMap(Object.keys)]));
  for (const k of keys) assert.ok(!/name|email|phone|address|sin/i.test(k), `field ${k}`);
  assert.ok(book.households.every((h) => /^H-\d{4}$/.test(h.id)));
});

test('the book holds every kind of household a trigger needs', () => {
  const H = book.households;
  assert.ok(H.some((h) => h.selfEmployed) && H.some((h) => h.holdco) && H.some((h) => h.trust) && H.some((h) => h.instalments));
  const items = buildTriggers(book, fixture, config).items;
  for (const t of config.types) assert.ok(items.some((i) => i.type === t.id) || t.facts.some((id) => !F.has(factIds(t, Y)[0])), `no ${t.id} triggers`);
});

test('RRIF trigger: at the end of the year the member reaches the maturity age, and not the year before', () => {
  const age = Number(v('rrsp_maturity_age'));
  const turns = buildTriggers(one(hh({ members: [{ birth: `${Y - age}-03-04`, rrsp: true }] })), fixture, config).items.filter((i) => i.type === 'rrif_conversion');
  assert.deepEqual(turns.map((i) => i.deadline), [`${Y}-12-31`]);
  const older = buildTriggers(one(hh({ members: [{ birth: `${Y - age - 1}-03-04`, rrsp: true }] })), fixture, config).items.filter((i) => i.type === 'rrif_conversion');
  assert.equal(older.length, 0);
  const noRrsp = buildTriggers(one(hh({ members: [{ birth: `${Y - age}-03-04`, rrsp: false }] })), fixture, config).items.filter((i) => i.type === 'rrif_conversion');
  assert.equal(noRrsp.length, 0);
});

test('trust deemed-disposition date = settlement + the facts file\'s number of years', () => {
  const years = Number(v('trust_deemed_disposition_years'));
  const items = buildTriggers(one(hh({ trust: { settled: `${Y - years}-08-19`, yearEnd: '12-31' } })), fixture, config).items.filter((i) => i.type === 'trust_21');
  assert.deepEqual(items.map((i) => i.deadline), [`${Y}-08-19`]);
  const twice = buildTriggers(one(hh({ trust: { settled: `${Y - 2 * years}-02-03`, yearEnd: '12-31' } })), fixture, config).items.filter((i) => i.type === 'trust_21');
  assert.deepEqual(twice.map((i) => i.deadline), [`${Y}-02-03`], 'repeats every period');
  const notYet = buildTriggers(one(hh({ trust: { settled: `${Y - years + 3}-08-19`, yearEnd: '12-31' } })), fixture, config).items.filter((i) => i.type === 'trust_21');
  assert.equal(notYet.length, 0);
});

test('T3: the day count after a December 31 year-end; T2: the last day of the month that many months after a month-end year-end', () => {
  const t3 = buildTriggers(one(hh({ trust: { settled: '2010-05-05', yearEnd: '12-31' } })), fixture, config).items.filter((i) => i.type === 't3_return');
  const days = Number(String(v('t3_filing_deadline_rule')).match(/\d+/)[0]);
  assert.deepEqual(t3.map((i) => i.deadline), [new Date(Date.UTC(Y - 1, 11, 31) + days * 86400000).toISOString().slice(0, 10)]);
  // The CRA guide's own examples: March 31 -> September 30, August 31 -> February 28.
  const due = (m) => buildTriggers(one(hh({ holdco: { yearEndMonth: m } })), fixture, config).items.filter((i) => i.type === 't2_return').map((i) => i.deadline);
  assert.ok(due(3).includes(`${Y}-09-30`), due(3).join());
  assert.ok(due(8).includes(`${Y}-02-28`), due(8).join());
});

test('CPP and OAS ages: a birthday trigger in the year a member reaches each age', () => {
  for (const [type, id] of [['cpp_opens', 'cpp_earliest_start_age'], ['standard_start', 'cpp_standard_start_age'], ['last_deferral', 'cpp_latest_start_age']]) {
    const age = Number(v(id));
    const items = buildTriggers(one(hh({ members: [{ birth: `${Y - age}-10-02`, rrsp: false }] })), fixture, config).items.filter((i) => i.type === type);
    assert.deepEqual(items.map((i) => i.deadline), [`${Y}-10-02`], type);
  }
});

test('fact dates: balance due for everyone not self-employed, the self-employed date for the self-employed, four instalments', () => {
  const emp = buildTriggers(one(hh({})), fixture, config).items;
  assert.ok(emp.some((i) => i.type === 't1_returns' && i.deadline === v(`t1_balance_due_date.${Y - 1}`)));
  assert.ok(!emp.some((i) => i.type === 't1_self_employed'));
  const se = buildTriggers(one(hh({ selfEmployed: true, instalments: true })), fixture, config).items;
  assert.ok(se.some((i) => i.type === 't1_self_employed' && i.deadline === v(`t1_self_employed_filing_deadline.${Y - 1}`)));
  assert.ok(!se.some((i) => i.type === 't1_returns'));
  assert.equal(se.filter((i) => i.type === 'instalments').length, 4);
});

test('every rule trigger cites facts with an official government source; reviews are the one service item', () => {
  for (const t of config.types) {
    if (t.kind === 'service') { assert.equal(t.id, 'review'); assert.equal(t.facts.length, 0); continue; }
    assert.ok(t.facts.length > 0, t.id);
    for (const id of factIds(t, Y)) {
      const f = F.get(id) ?? real.facts.find((x) => x.id === id);
      if (!f) continue; // not in either file: the engine marks it pending (next test)
      assert.match(f.source_url, /^https:\/\/([a-z0-9-]+\.)*(canada\.ca|gc\.ca)\//, `${t.id}: ${id}`);
      // The quoted line lives in canada-planning-facts' facts.yaml; the exported file carries the source URL.
    }
  }
});

test('with the real facts file, a type whose fact is not confirmed is pending and gets no dates', () => {
  const R = factIndex(real);
  const { items, pending } = buildTriggers(book, real, config);
  for (const t of config.types) {
    const missing = factIds(t, Y).filter((id) => !R.has(id));
    if (missing.length) {
      assert.ok(pending.some((p) => p.type === t.id), `${t.id} should be pending`);
      assert.ok(!items.some((i) => i.type === t.id), `${t.id} should have no dates`);
    }
  }
  assert.ok(pending.some((p) => p.type === 'rrsp_deadline'), 'the RRSP deadline for last year is not published yet');
});

test('load: hours are kept (inside the year) and spread over weekdays only', () => {
  const items = [{ household: 'T-1', type: 'review', member: null, deadline: `${Y}-06-18`, facts: [] }];
  const { daily, weekly } = load(items, config);
  const hours = config.types.find((t) => t.id === 'review').hours;
  assert.ok(Math.abs(daily.reduce((a, b) => a + b, 0) - hours) < 1e-9);
  assert.ok(Math.abs(weekly.reduce((a, b) => a + b, 0) - hours) < 1e-9);
  daily.forEach((x, k) => { if (x) assert.ok(![0, 6].includes(new Date(Date.UTC(Y, 0, 1 + k)).getUTCDay())); });
  const edited = load(items, config, { review: 10 });
  assert.ok(Math.abs(edited.weekly.reduce((a, b) => a + b, 0) - 10) < 1e-9, 'a user-edited hours value is used');
});

test('policies: reviews by birth month flatten the Q1 peak', () => {
  const [q1, birth, quarter] = compare(book, fixture, config);
  assert.equal(q1.policy, 'q1');
  assert.ok(birth.peakToAverage < q1.peakToAverage, `${birth.peakToAverage} vs ${q1.peakToAverage}`);
  assert.ok(birth.weeksOver <= q1.weeksOver);
  // The same reviews, moved in time (prep for an early-January review can fall in the December before, so totals differ a little).
  const reviews = (p) => buildTriggers(book, fixture, config, { policy: p }).items.filter((i) => i.type === 'review').length;
  assert.equal(reviews('q1'), config.households);
  assert.equal(reviews('birthMonth'), config.households);
  assert.equal(reviews('clientQuarter'), config.households);
  assert.equal(metrics([1, 3], 2).weeksOver, 1);
});

test('segments come from the CPP start-age facts', () => {
  const lo = Number(v('cpp_earliest_start_age')), hi = Number(v('cpp_latest_start_age'));
  assert.equal(segmentOf(hh({ members: [{ birth: `${Y - lo + 1}-01-01` }] }), F, Y), 'before');
  assert.equal(segmentOf(hh({ members: [{ birth: `${Y - lo}-01-01` }] }), F, Y), 'window');
  assert.equal(segmentOf(hh({ members: [{ birth: `${Y - hi - 1}-01-01` }] }), F, Y), 'after');
});

test('CSV: every cell quoted, formulas neutralised', () => {
  assert.equal(safeCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  for (const c of ['+1', '-1', '@SUM(A1)', '\tx', '\rx']) assert.ok(safeCell(c).startsWith(`"'`), JSON.stringify(c));
  assert.equal(safeCell('H-0001'), '"H-0001"');
  const csv = toCSV(buildTriggers(book, fixture, config).items.slice(0, 5), config);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 6);
  assert.ok(lines[0].includes(config.assumptionLabel));
  assert.ok(lines.every((l) => l.startsWith('"')));
});
