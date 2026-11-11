// The Planning Year's rules engine. It dates every trigger for the plan year from the confirmed facts only, spreads each
// task's hours over the weekdays before its deadline, and compares review policies. No fact value is written here: each
// age, date, day count and month count is read from facts.json, and a trigger type whose fact is not confirmed is pending.

const DAY = 86400000;
const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const iso = (t) => new Date(t).toISOString().slice(0, 10);
const monthEnd = (y, m) => iso(Date.UTC(y, m, 0)); // m is 1-12 and may run past 12; Date carries it into the next year
const weekday = (t) => { const d = new Date(t).getUTCDay(); return d !== 0 && d !== 6; };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

// Confirmed facts by id. `{prev}` and `{year}` in a type's fact ids stand for the year before the plan year and the plan year.
export function factIndex(file) {
  return new Map(file.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));
}
export const factIds = (type, year) => type.facts.map((id) => id.replace('{prev}', String(year - 1)).replace('{year}', String(year)));

// Readers for the values as the facts file states them. Each throws if the wording changes, so a test notices.
const num = (f) => { const v = Number(f.value); if (!Number.isFinite(v)) throw new Error(`${f.id}: not a number: ${f.value}`); return v; };
function countIn(f, unit) {
  const m = String(f.value).toLowerCase().match(new RegExp(`(\\d+|${WORDS.join('|')})\\s+${unit}`));
  if (!m) throw new Error(`${f.id}: no "${unit}" count in "${f.value}"`);
  return /\d/.test(m[1]) ? Number(m[1]) : WORDS.indexOf(m[1]);
}
function monthDays(f, year) {
  const out = [...String(f.value).toLowerCase().matchAll(new RegExp(`(${MONTHS.join('|')})\\s+(\\d{1,2})`, 'g'))]
    .map((m) => `${year}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`);
  if (!out.length) throw new Error(`${f.id}: no dates in "${f.value}"`);
  return out;
}

const birthYear = (m) => Number(m.birth.slice(0, 4));
const ageAtEnd = (m, y) => y - birthYear(m);

// Life stage from the CPP start-age facts: before the window opens, inside it, or past it (oldest member, end of plan year).
export function segmentOf(h, F, year) {
  const lo = F.get('cpp_earliest_start_age'), hi = F.get('cpp_latest_start_age');
  if (!lo || !hi) return null;
  const age = Math.max(...h.members.map((m) => ageAtEnd(m, year)));
  return age < num(lo) ? 'before' : age <= num(hi) ? 'window' : 'after';
}
export function matches(h, filter, F, year) {
  if (!filter) return true;
  if (filter.segment && segmentOf(h, F, year) !== filter.segment) return false;
  if (filter.business && !(h.holdco || h.selfEmployed)) return false;
  if (filter.trust && !h.trust) return false;
  return true;
}

// Weekdays of a span, inclusive.
function weekdaysBetween(a, b) { const out = []; for (let t = ms(a); t <= ms(b); t += DAY) if (weekday(t)) out.push(t); return out; }

// Review dates set by a policy. `i` is the household's position in the whole book, so a filter never moves a review.
function reviewDate(h, i, policy, year) {
  const span = policy === 'q1' ? [1, 3]
    : policy === 'birthMonth' ? [+h.members[0].birth.slice(5, 7), +h.members[0].birth.slice(5, 7)]
    : [h.reviewQuarter * 3 - 2, h.reviewQuarter * 3];
  const days = weekdaysBetween(`${year}-${String(span[0]).padStart(2, '0')}-01`, monthEnd(year, span[1]));
  return iso(days[i % days.length]);
}

// Every dated trigger for the plan year, plus the next year's deadlines (their lead work can fall in the plan year).
export function buildTriggers(book, factsFile, config, { policy = 'q1', filter = null } = {}) {
  const F = factIndex(factsFile), year = config.year, years = [year, year + 1];
  const items = [], pending = [];
  const add = (h, type, deadline, member = null) => items.push({ household: h.id, type: type.id, member, deadline, facts: factIds(type, year) });
  for (const type of config.types) {
    const ids = factIds(type, year);
    const missing = ids.filter((id) => !F.has(id));
    if (missing.length) { pending.push({ type: type.id, label: type.label, missing }); continue; }
    const f = ids.map((id) => F.get(id));
    book.households.forEach((h, i) => {
      if (!matches(h, filter, F, year)) return;
      switch (type.rule) {
        case 'policy': add(h, type, reviewDate(h, i, policy, year)); break;
        case 'fact_date': {
          if (type.who === 'not_self_employed' && h.selfEmployed) return;
          if (type.who === 'self_employed' && !h.selfEmployed) return;
          if (type.who === 'rrsp_contributors') {
            const max = F.get('rrsp_maturity_age');
            if (!h.members.some((m) => m.rrsp && (!max || ageAtEnd(m, year - 1) <= num(max)))) return;
          }
          add(h, type, String(f[0].value)); break;
        }
        case 'fact_dates_in_year': if (h.instalments) for (const d of monthDays(f[0], year)) add(h, type, d); break;
        case 'days_after_trust_year_end': if (h.trust) for (const y of [year - 1, year]) add(h, type, iso(ms(`${y}-${h.trust.yearEnd}`) + countIn(f[0], 'days') * DAY)); break;
        case 'corp_year_end': if (h.holdco) for (const y of years) add(h, type, monthEnd(y, h.holdco.yearEndMonth)); break;
        case 'months_after_corp_year_end':
          // The holdco year-ends in this book fall on a month's last day, so the return is due on the last day of the month that many months on.
          if (h.holdco) for (const y of [year - 1, year]) add(h, type, monthEnd(y, h.holdco.yearEndMonth + countIn(f[0], 'months'))); break;
        case 'end_of_year_at_age':
          h.members.forEach((m, k) => { for (const y of years) if (m.rrsp && ageAtEnd(m, y) === num(f[0])) add(h, type, `${y}-12-31`, k); }); break;
        case 'birthday_at_age': {
          const ages = [...new Set(f.map(num))];
          h.members.forEach((m, k) => { for (const y of years) if (ages.includes(ageAtEnd(m, y))) add(h, type, `${y}${m.birth.slice(4)}`, k); }); break;
        }
        case 'trust_anniversary':
          if (h.trust) { const step = num(f[0]); for (const y of years) if ((y - Number(h.trust.settled.slice(0, 4))) % step === 0 && y > Number(h.trust.settled.slice(0, 4))) add(h, type, `${y}${h.trust.settled.slice(4)}`); }
          break;
        default: throw new Error(`unknown rule ${type.rule}`);
      }
    });
  }
  // Keep only deadlines whose lead work touches the plan year.
  const typeOf = new Map(config.types.map((t) => [t.id, t]));
  const kept = items.filter((it) => {
    const lead = ms(it.deadline) - (typeOf.get(it.type).leadWeeks * 7 - 1) * DAY;
    return ms(it.deadline) >= Date.UTC(year, 0, 1) && lead <= Date.UTC(year, 11, 31);
  });
  return { items: kept, pending };
}

// Hours per day and per week of the plan year. Each task's hours are spread evenly over the weekdays from its lead start
// to its deadline; only the days inside the plan year count. Weeks start on Monday; week 0 holds January 1.
export function load(items, config, hours = {}) {
  const year = config.year, start = Date.UTC(year, 0, 1), days = (Date.UTC(year + 1, 0, 1) - start) / DAY;
  const daily = new Array(days).fill(0);
  const typeOf = new Map(config.types.map((t) => [t.id, t]));
  for (const it of items) {
    const t = typeOf.get(it.type), h = hours[it.type] ?? t.hours;
    const end = ms(it.deadline), from = end - (t.leadWeeks * 7 - 1) * DAY;
    const work = []; for (let d = from; d <= end; d += DAY) if (weekday(d)) work.push(d);
    if (!work.length) work.push(end);
    for (const d of work) { const k = (d - start) / DAY; if (k >= 0 && k < days) daily[k] += h / work.length; }
  }
  const offset = (new Date(start).getUTCDay() + 6) % 7; // days from that week's Monday to January 1
  const weeks = Math.ceil((days + offset) / 7), weekly = new Array(weeks).fill(0);
  daily.forEach((v, k) => { weekly[Math.floor((k + offset) / 7)] += v; });
  return { daily, weekly, offset };
}

export function metrics(weekly, capacity) {
  const total = weekly.reduce((a, b) => a + b, 0), average = total / weekly.length, peak = Math.max(...weekly);
  return { total, average, peak, peakToAverage: average ? peak / average : 0, weeksOver: weekly.filter((w) => w > capacity).length };
}

export function compare(book, factsFile, config, { filter = null, hours = {}, capacity = config.capacity.hoursPerWeek } = {}) {
  return config.policies.map((p) => {
    const { items } = buildTriggers(book, factsFile, config, { policy: p.id, filter });
    return { policy: p.id, label: p.label, ...metrics(load(items, config, hours).weekly, capacity) };
  });
}

// CSV of the trigger list. A cell that starts with = + - @ or a control character gets a leading apostrophe, so a
// spreadsheet shows it as text instead of running it as a formula; every cell is quoted.
export function safeCell(v) {
  const s = String(v ?? '');
  const t = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${t.replace(/"/g, '""')}"`;
}
export function toCSV(items, config, hours = {}) {
  const typeOf = new Map(config.types.map((t) => [t.id, t]));
  const rows = [['household', 'trigger', 'member', 'deadline', `hours (${config.assumptionLabel})`, 'facts cited']];
  for (const it of items) rows.push([it.household, typeOf.get(it.type).label, it.member === null ? '' : it.member + 1, it.deadline, hours[it.type] ?? typeOf.get(it.type).hours, it.facts.join(' ')]);
  return rows.map((r) => r.map(safeCell).join(',')).join('\r\n') + '\r\n';
}
