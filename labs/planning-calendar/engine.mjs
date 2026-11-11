// The Planning Calendar (P5b): the plan year's dated rules for each kind of household, from confirmed facts only. A date
// whose fact is not confirmed is pending and is not placed. No date, day count or month count is written here.

const DAY = 864e5;
const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const iso = (t) => new Date(t).toISOString().slice(0, 10);
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

export const factIndex = (file) => new Map(file.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));
export const ids = (item, year) => item.facts.map((id) => id.replace('{prev}', String(year - 1)).replace('{year}', String(year)));

// Readers for values as the facts file states them; each throws if the wording changes, so a test notices.
function countIn(f, unit) {
  const m = String(f.value).toLowerCase().match(new RegExp(`(\\d+|${WORDS.join('|')})\\s+(?:calendar\\s+)?${unit}`));
  if (!m) throw new Error(`${f.id}: no "${unit}" count in "${f.value}"`);
  return /\d/.test(m[1]) ? Number(m[1]) : WORDS.indexOf(m[1]);
}
function monthDays(f, year) {
  const out = [...String(f.value).toLowerCase().matchAll(new RegExp(`(${MONTHS.join('|')})\\s+(\\d{1,2})`, 'g'))]
    .map((m) => `${year}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`);
  if (!out.length) throw new Error(`${f.id}: no dates in "${f.value}"`);
  return out;
}
const lastDayOfMonth = (y, m) => iso(Date.UTC(y, m, 0)); // m 1-12, may run past 12
const yearEnd = (y) => lastDayOfMonth(y, 12);

// The dates (and windows) one kind of household meets in the plan year. Each comes with the facts it rests on.
export function householdDates(h, F, year) {
  const dates = [], windows = [], pending = [];
  for (const d of h.dates) {
    const want = ids(d, year), missing = want.filter((id) => !F.has(id));
    if (missing.length) { pending.push({ id: d.id, label: d.label, missing }); continue; }
    const f = want.map((id) => F.get(id));
    const put = (date) => dates.push({ id: d.id, label: d.label, date, facts: want });
    switch (d.rule) {
      case 'fact_date': put(String(f[0].value)); break;
      case 'fact_dates_in_year': for (const x of monthDays(f[0], year)) put(x); break;
      case 'year_end': put(yearEnd(year)); break;
      case 'days_after_prev_year_end': put(iso(ms(yearEnd(year - 1)) + countIn(f[0], 'days') * DAY)); break;
      case 'months_after_prev_year_end': put(lastDayOfMonth(year - 1, 12 + countIn(f[0], 'months'))); break; // a month-end year-end
      case 'window_around_year_end': {
        // The superficial-loss period around a sale on the last day of the year before and of this year, inside this year.
        const n = countIn(f[0], 'days');
        for (const y of [year - 1, year]) {
          const a = Math.max(ms(yearEnd(y)) - n * DAY, Date.UTC(year, 0, 1)), b = Math.min(ms(yearEnd(y)) + n * DAY, ms(yearEnd(year)));
          if (a <= b) windows.push({ id: d.id, label: d.label, from: iso(a), to: iso(b), sale: yearEnd(y), facts: want });
        }
        put(yearEnd(year));
        break;
      }
      default: throw new Error(`unknown rule ${d.rule}`);
    }
  }
  dates.sort((a, b) => a.date.localeCompare(b.date));
  return { dates, windows, pending };
}

// Days from each day of the plan year to the household's next date (0 on the date itself; Infinity after the last).
export function countdown(dates, year) {
  const start = Date.UTC(year, 0, 1), n = (Date.UTC(year + 1, 0, 1) - start) / DAY, at = [...new Set(dates.map((d) => ms(d.date)))].sort((a, b) => a - b);
  const out = new Array(n);
  let j = 0;
  for (let k = 0; k < n; k++) { const t = start + k * DAY; while (j < at.length && at[j] < t) j++; out[k] = j < at.length ? (at[j] - t) / DAY : Infinity; }
  return out;
}

// A shade step (0..steps-1) from days-to-next-date: the last step on the date, nothing beyond the horizon.
export const step = (days, horizon, steps) => (days > horizon ? 0 : Math.max(1, Math.round((steps - 1) * (1 - days / horizon))));

export function buildCalendar(config, factsFile) {
  const F = factIndex(factsFile), Y = config.year;
  const households = config.households.map((h) => {
    const { dates, windows, pending } = householdDates(h, F, Y);
    const label = h.label.replace('the RRSP maturity age', F.has('rrsp_maturity_age') ? `${F.get('rrsp_maturity_age').value}` : 'the RRSP maturity age');
    return { id: h.id, label, dates, windows, pending, countdown: countdown(dates, Y) };
  });
  const own = config.ownDates.map((o) => ({ label: o.label, facts: ids(o, Y), values: ids(o, Y).map((id) => F.get(id)?.value ?? null) }));
  const notPlaced = config.notPlaced.map((o) => ({ label: o.label, facts: ids(o, Y), confirmed: ids(o, Y).every((id) => F.has(id)) }));
  const used = new Set([...config.households.flatMap((h) => h.dates.flatMap((d) => ids(d, Y))), ...own.flatMap((o) => o.facts)]);
  const sources = [...used].filter((id) => F.has(id)).map((id) => { const f = F.get(id); return { id, title: f.title, source_url: f.source_url, as_of: f.as_of, authority: f.authority }; });
  return { year: Y, horizon: config.horizonDays, households, own, notPlaced, sources };
}
