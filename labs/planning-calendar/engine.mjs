// The planning calendar: the dated rules a household meets in the twelve months from a given day, from confirmed facts
// only. A date whose fact the file holds but has not confirmed is pending (never guessed); one the file lacks is left out.
// The same code runs in the build's tests and, inlined, in the page (the page passes in its own date). No date, day count,
// month count, age or amount is written here: every one is read from the facts file.

const DAY = 864e5;
export const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8));
export const iso = (t) => new Date(t).toISOString().split('T')[0];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const longDate = (d) => new Date(ms(d)).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const monthDay = (d) => new Date(ms(d)).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', timeZone: 'UTC' });

export const factIndex = (file) => new Map(file.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));
export const ids = (item, year) => item.facts.map((id) => id.replace('{prev}', String(year - 1)).replace('{year}', String(year)));
// Fill {name} from the context, then from a confirmed fact of that id; an unknown name is left for the caller to see.
export const fill = (tpl, ctx, F) => tpl.replace(/\{([\w.]+)\}/g, (m, k) => (ctx[k] ?? F?.get(k)?.value ?? m));

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

// One rule in one calendar year: its dates (every rule here places its dates inside that year), any period around them,
// or why it has none. `pending` lists the facts held but not confirmed; `absent` the facts the file does not hold.
// `m` is the month (1-12) the tax year ends in: 12 for every rule except a corporation's, whose year-end month the
// visitor may change (calendar.json marks those rules "yearEnd": "corporation").
export function ruleYear(rule, F, year, held, m = 12) {
  const want = ids(rule, year), missing = want.filter((id) => !F.has(id));
  if (missing.length) return missing.some((id) => held.has(id)) ? { pending: missing } : { absent: missing };
  const f = want.map((id) => F.get(id)), dates = [], windows = [];
  switch (rule.rule) {
    case 'fact_date': dates.push(String(f[0].value)); break;
    case 'fact_dates_in_year': dates.push(...monthDays(f[0], year)); break;
    case 'year_end': dates.push(lastDayOfMonth(year, m)); break;
    case 'days_after_prev_year_end': dates.push(iso(ms(lastDayOfMonth(year - 1, m)) + countIn(f[0], 'days') * DAY)); break;
    case 'months_after_prev_year_end': dates.push(lastDayOfMonth(year - 1, m + countIn(f[0], 'months'))); break; // a month-end year-end
    case 'window_around_year_end': {
      // The superficial-loss period around a sale on the last day of the year: the facts file's day count either side.
      const n = countIn(f[0], 'days'), sale = yearEnd(year);
      windows.push({ from: iso(ms(sale) - n * DAY), to: iso(ms(sale) + n * DAY), sale });
      dates.push(sale);
      break;
    }
    default: throw new Error(`unknown rule ${rule.rule}`);
  }
  return { dates, windows, facts: want };
}

export const MONTH_NAMES = MONTHS.map((x) => x[0].toUpperCase() + x.slice(1));

// The rules a set of situations brings, each once, in the config's order.
export const rulesFor = (config, picked) => {
  const want = new Set(config.situations.filter((s) => picked.includes(s.id)).flatMap((s) => s.rules));
  return Object.keys(config.rules).filter((id) => want.has(id));
};

// Everything the page shows for one household from `today` (YYYY-MM-DD) for twelve months (the end is exclusive).
// opts.corpYearEnd: the month (1-12) a corporation's tax year ends in (December when not given).
export function rolling(config, factsFile, today, picked, opts = {}) {
  const corpM = Number.isInteger(opts.corpYearEnd) && opts.corpYearEnd >= 1 && opts.corpYearEnd <= 12 ? opts.corpYearEnd : 12;
  const F = factIndex(factsFile), held = new Set(factsFile.facts.map((f) => f.id));
  const y0 = +today.slice(0, 4), start = ms(today), end = Date.UTC(y0 + 1, +today.slice(5, 7) - 1, +today.slice(8));
  const events = [], windows = [], pending = [], seen = new Set();
  const src = (id) => { const f = F.get(id); return { id, title: f.title, url: f.source_url, authority: f.authority, as_of: f.as_of }; };
  for (const rid of rulesFor(config, picked)) {
    const r = config.rules[rid], m = r.yearEnd === 'corporation' ? corpM : 12;
    // The year before only matters for a period that runs into this one; its dates are all before today. A rule whose
    // facts carry no year (a corporation's) also reads the year after next: with a year-end early in the year, its
    // return can fall two calendar years on.
    const years = r.facts.some((id) => id.includes('{')) ? [y0 - 1, y0, y0 + 1] : [y0 - 1, y0, y0 + 1, y0 + 2];
    for (const y of years) {
      const out = ruleYear(r, F, y, held, m), ctx = { prev: String(y - 1), year: String(y), endMonth: MONTH_NAMES[m - 1] };
      if (out.pending) {
        const key = `${rid}|${out.pending.join()}`;
        if (y >= y0 && !seen.has(key)) { seen.add(key); pending.push({ rule: rid, year: y, kind: r.kind, label: fill(r.label, ctx, F), facts: out.pending, sources: out.pending.map((id) => factsFile.facts.find((f) => f.id === id)).filter(Boolean).map((f) => ({ id: f.id, title: f.title, url: f.source_url })) }); }
        continue;
      }
      if (out.absent) continue;
      for (const w of out.windows) {
        const a = Math.max(ms(w.from), start), b = Math.min(ms(w.to), end - DAY);
        if (a <= b) windows.push({ rule: rid, from: iso(a), to: iso(b), sale: w.sale });
      }
      for (const date of out.dates) {
        const t = ms(date), key = `${rid}|${date}`;
        if (t < start || t >= end || seen.has(key)) continue;
        seen.add(key);
        const w = out.windows.find((x) => x.sale === date);
        const c = { ...ctx, value: String(F.get(out.facts[0]).value), date: longDate(date), prevEnd: longDate(lastDayOfMonth(y - 1, m)), ...(w ? { from: longDate(w.from), to: longDate(w.to) } : {}) };
        events.push({ key, rule: rid, kind: r.kind, date, days: (t - start) / DAY, label: fill(r.label, c, F), what: r.what, text: fill(r.text, c, F), sources: out.facts.map(src) });
      }
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || Object.keys(config.rules).indexOf(a.rule) - Object.keys(config.rules).indexOf(b.rule));
  return { today, end: iso(end - DAY), situations: [...picked], corpYearEnd: corpM, events, windows, pending, weeks: weeks(start, end, events) };
}

// Monday-to-Sunday weeks covering the twelve months; each holds the dates that fall in it (the first and last are partial).
export function weeks(start, end, events) {
  const mon = start - ((new Date(start).getUTCDay() + 6) % 7) * DAY, out = [];
  for (let t = mon; t < end; t += 7 * DAY) out.push({ monday: iso(t), from: iso(Math.max(t, start)), to: iso(Math.min(t + 6 * DAY, end - DAY)), events: [] });
  for (const e of events) out[Math.floor((ms(e.date) - mon) / (7 * DAY))].events.push(e);
  return out;
}


const wordsIn = (t) => t.trim().split(/\s+/).filter(Boolean).length;

// The big answer: the household's next confirmed date as a countdown (n days, or a word for today and tomorrow), and
// one line of 14 words or fewer: the date and what falls on it. Pending dates never count as next.
export function nextUp(cal) {
  if (!cal.situations.length) return { text: 'None', line: 'Pick a household, or tick a situation under Fine-tune.' };
  if (!cal.events.length) return { text: 'None', line: 'No confirmed date falls in the next twelve months.' };
  const e = cal.events[0], same = cal.events.filter((x) => x.date === e.date).length - 1;
  const head = `${longDate(e.date)} · ${e.what}`;
  let line = same ? `${head}, and ${same} more that day` : head;
  if (wordsIn(line) > 14) line = `${head}, and ${same} more`;
  return { ...(e.days === 0 ? { text: 'Today' } : e.days === 1 ? { text: 'Tomorrow' } : { n: e.days }), line, event: e, same };
}

// iCalendar (RFC 5545): text escaped, lines folded at 75 octets without splitting a character, CRLF line ends.
export const icsEscape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
export function icsFold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = [];
  let cur = '', n = 0, room = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (n + b > room) { parts.push(cur); cur = ''; n = 0; room = 74; } // a continuation line starts with one space
    cur += ch; n += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}
export const EDU = 'Education only, not advice.';
export function toICS(cal) {
  const compact = (d) => d.replace(/-/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mohammed El Chayeb//The planning calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Planning dates'];
  for (const e of cal.events) {
    const urls = [...new Set(e.sources.map((s) => s.url))];
    lines.push('BEGIN:VEVENT', `UID:${e.rule}-${compact(e.date)}@planning-calendar`, `DTSTAMP:${compact(cal.today)}T000000Z`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(iso(ms(e.date) + DAY))}`,
      `SUMMARY:${icsEscape(e.label)}`, `DESCRIPTION:${icsEscape(`${e.text}\nSource: ${urls.join(' ')}\n${EDU}`)}`,
      `URL:${urls[0]}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
