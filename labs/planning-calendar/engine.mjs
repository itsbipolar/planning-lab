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
export function ruleYear(rule, F, year, held) {
  const want = ids(rule, year), missing = want.filter((id) => !F.has(id));
  if (missing.length) return missing.some((id) => held.has(id)) ? { pending: missing } : { absent: missing };
  const f = want.map((id) => F.get(id)), dates = [], windows = [];
  switch (rule.rule) {
    case 'fact_date': dates.push(String(f[0].value)); break;
    case 'fact_dates_in_year': dates.push(...monthDays(f[0], year)); break;
    case 'year_end': dates.push(yearEnd(year)); break;
    case 'days_after_prev_year_end': dates.push(iso(ms(yearEnd(year - 1)) + countIn(f[0], 'days') * DAY)); break;
    case 'months_after_prev_year_end': dates.push(lastDayOfMonth(year - 1, 12 + countIn(f[0], 'months'))); break; // a month-end year-end
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

// The rules a set of situations brings, each once, in the config's order.
export const rulesFor = (config, picked) => {
  const want = new Set(config.situations.filter((s) => picked.includes(s.id)).flatMap((s) => s.rules));
  return Object.keys(config.rules).filter((id) => want.has(id));
};

// Everything the page shows for one household from `today` (YYYY-MM-DD) for twelve months (the end is exclusive).
export function rolling(config, factsFile, today, picked) {
  const F = factIndex(factsFile), held = new Set(factsFile.facts.map((f) => f.id));
  const y0 = +today.slice(0, 4), start = ms(today), end = Date.UTC(y0 + 1, +today.slice(5, 7) - 1, +today.slice(8));
  const events = [], windows = [], pending = [], seen = new Set();
  const src = (id) => { const f = F.get(id); return { id, title: f.title, url: f.source_url, authority: f.authority, as_of: f.as_of }; };
  for (const rid of rulesFor(config, picked)) {
    const r = config.rules[rid];
    // The year before only matters for a period that runs into this one; its dates are all before today.
    for (const y of [y0 - 1, y0, y0 + 1]) {
      const out = ruleYear(r, F, y, held), ctx = { prev: String(y - 1), year: String(y) };
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
        const c = { ...ctx, value: String(F.get(out.facts[0]).value), date: longDate(date), prevEnd: longDate(yearEnd(y - 1)), ...(w ? { from: longDate(w.from), to: longDate(w.to) } : {}) };
        events.push({ key, rule: rid, kind: r.kind, date, days: (t - start) / DAY, label: fill(r.label, c, F), what: r.what, text: fill(r.text, c, F), sources: out.facts.map(src) });
      }
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || Object.keys(config.rules).indexOf(a.rule) - Object.keys(config.rules).indexOf(b.rule));
  return { today, end: iso(end - DAY), situations: [...picked], events, windows, pending, weeks: weeks(start, end, events) };
}

// Monday-to-Sunday weeks covering the twelve months; each holds the dates that fall in it (the first and last are partial).
export function weeks(start, end, events) {
  const mon = start - ((new Date(start).getUTCDay() + 6) % 7) * DAY, out = [];
  for (let t = mon; t < end; t += 7 * DAY) out.push({ monday: iso(t), from: iso(Math.max(t, start)), to: iso(Math.min(t + 6 * DAY, end - DAY)), events: [] });
  for (const e of events) out[Math.floor((ms(e.date) - mon) / (7 * DAY))].events.push(e);
  return out;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The page's headline: the household's next confirmed date and how many fall in the twelve months.
export function finding(cal, noun) {
  const who = noun ?? 'this household';
  if (!cal.situations.length) return 'Tick at least one situation to build a household’s calendar.';
  const p = cal.pending.length, more = p ? `, and ${plural(p, 'more is', 'more are')} not confirmed yet` : '';
  if (!cal.events.length) return `For ${who}, no confirmed date falls in the next twelve months${more}.`;
  const first = cal.events[0], same = cal.events.filter((e) => e.date === first.date).length;
  const when = first.days === 0 ? 'today' : first.days === 1 ? 'tomorrow' : `in ${first.days} days`;
  const on = first.date.slice(0, 4) === cal.today.slice(0, 4) ? monthDay(first.date) : longDate(first.date);
  const what = same > 1 ? `${first.what} and ${plural(same - 1, 'other', 'others')}` : first.what;
  return `For ${who}, the next confirmed date is ${what}, on ${on}, ${when}; ${plural(cal.events.length, 'date falls', 'dates fall')} in the next twelve months${more}.`;
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
