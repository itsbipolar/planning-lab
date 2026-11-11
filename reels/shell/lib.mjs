// The reel shell's core: read a reel.json, check every card against shared/facts.json (preflight),
// and resolve each card's facts into the values a card shows. Every year and figure on a card comes
// from facts.json; reel.json holds only words, timings and the card order.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CARD_TYPES = ['hook', 'date', 'stat', 'chart', 'sources', 'end', 'series', 'section', 'proposals'];
// The end card carries only the fixed education and AI lines, so it is the one type without a fact.
// A series card's figures come from a dated data snapshot (its data model), not from facts.json.
const NEEDS_FACT = new Set(['hook', 'date', 'stat', 'chart', 'sources', 'section']);
const STATS = new Set(['span_years']);
const ART = new Set(['cheque', 'form', 'paystub', 'passbook', 'key']); // the drawings in art.mjs
const TEXT_FIELDS = ['text', 'beat', 'today', 'name', 'short', 'ai', 'say', 'voice_note'];
// The only placeholders a spoken line may hold, by card type. A series line may also hold {up:words|words}: the first
// words when the measure ended higher than it started, the second when lower.
const SLOTS = { date: ['year', 'Year'], stat: ['value', 'Value'], series: ['from', 'to', 'decision', 'From', 'To', 'Decision'],
  section: ['date', 'Date'], proposals: ['year', 'Year'] };

export const readJSON = p => JSON.parse(readFileSync(p, 'utf8'));
export const loadFacts = (p = join(ROOT, 'shared', 'facts.json')) => readJSON(p);
export const loadReel = dir => readJSON(join(dir, 'reel.json'));

// A data reel names its model (a module exporting buildModel) and its snapshot; "{year}" picks the newest matching file.
export async function loadDataModel(reel, facts) {
  if (!reel.data) return null;
  const { readdirSync } = await import('node:fs');
  const { basename } = await import('node:path');
  const pat = join(ROOT, reel.data.snapshot), dir = dirname(pat);
  const re = new RegExp('^' + basename(pat).replace('.', '\\.').replace('{year}', '(\\d{4})') + '$');
  const file = readdirSync(dir).filter(f => re.test(f)).sort().at(-1);
  if (!file) throw new Error(`no snapshot matching ${reel.data.snapshot}`);
  const { buildModel } = await import(join(ROOT, reel.data.model));
  return buildModel(readJSON(join(dir, file)), facts);
}

// The first four-digit year in a fact's value, e.g. "after March <year>" gives that year.
export function yearOf(fact) {
  const m = String(fact.value ?? '').match(/\b(1[89]\d\d|20\d\d)\b/);
  return m ? Number(m[1]) : null;
}

// Returns a list of problems; an empty list means the reel may render.
export function preflight(reel, facts, dm = null) {
  const errors = [];
  const byId = new Map(facts.facts.map(f => [f.id, f]));
  if (!Array.isArray(reel.cards) || reel.cards.length === 0) return ['reel.json has no cards'];
  const ids = new Set();
  reel.cards.forEach((c, i) => {
    const where = `card ${i + 1} (${c.id ?? 'no id'})`;
    if (!c.id) errors.push(`${where}: no id`);
    if (ids.has(c.id)) errors.push(`${where}: duplicate id`);
    ids.add(c.id);
    if (!CARD_TYPES.includes(c.type)) errors.push(`${where}: unknown card type "${c.type}"`);
    if (!(c.duration > 0)) errors.push(`${where}: duration must be a positive number of seconds`);
    for (const k of TEXT_FIELDS) {
      if (c[k] !== undefined && /\d/.test(c[k])) errors.push(`${where}: "${k}" has a digit; figures come only from facts.json`);
    }
    for (const m of String(c.say ?? '').matchAll(/\{([^}]*)\}/g)) {
      if (c.type === 'series' && /^up:[^|]+\|[^|]+$/.test(m[1])) continue;
      if (!(SLOTS[c.type] ?? []).includes(m[1])) errors.push(`${where}: "say" has an unknown placeholder {${m[1]}}`);
    }
    const fids = c.fact_ids ?? [];
    if (NEEDS_FACT.has(c.type) && fids.length === 0) errors.push(`${where}: a ${c.type} card needs at least one fact_id`);
    if (c.type === 'end' && fids.length) errors.push(`${where}: the end card shows no facts`);
    for (const id of fids) {
      const f = byId.get(id);
      if (!f) { errors.push(`${where}: fact_id "${id}" is missing from facts.json`); continue; }
      if (f.status !== 'confirmed') errors.push(`${where}: fact "${id}" is ${f.status}, not confirmed`);
      if (f.value === null || f.value === undefined) errors.push(`${where}: fact "${id}" has no value`);
      if (!f.source_url) errors.push(`${where}: fact "${id}" has no source`);
      if (['date', 'chart', 'stat', 'hook'].includes(c.type) && yearOf(f) === null) errors.push(`${where}: fact "${id}" has no year in its value`);
    }
    if (c.type === 'date' && fids.length !== 1) errors.push(`${where}: a date card shows exactly one fact`);
    if (c.art !== undefined && !ART.has(c.art)) errors.push(`${where}: no drawing called "${c.art}"`);
    if (c.type === 'series') {
      if (!dm) errors.push(`${where}: a series card needs the reel's data model`);
      else if (!dm.panels.some(p => p.id === c.panel)) errors.push(`${where}: no measure "${c.panel}" in the data model`);
    }
    if (c.type === 'proposals') {
      // `offset` is years after the data's year (0, 1, 2…), so no year is typed into reel.json.
      const yr = dm ? String(dm.year + (c.offset ?? 0)) : null;
      if (!dm) errors.push(`${where}: a proposals card needs the reel's data model`);
      else if (!dm.proposals.some(p => (p.at ?? String(dm.year)).slice(0, 4) === yr)) errors.push(`${where}: no confirmed proposals starting in year +${c.offset ?? 0}`);
    }
    if (c.type === 'stat' && !STATS.has(c.stat)) errors.push(`${where}: unknown stat "${c.stat}"`);
  });
  for (const id of reel.carousel ?? []) if (!ids.has(id)) errors.push(`carousel: no card "${id}"`);
  return errors;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const longDate = d => { const [y, m, day] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${day}, ${y}`; };

const HOSTS = {
  'laws-lois.justice.gc.ca': 'Justice Laws Website',
  'www.osfi-bsif.gc.ca': 'Office of the Chief Actuary, OSFI',
  'www150.statcan.gc.ca': 'Statistics Canada',
  'www.canada.ca': 'Government of Canada',
  'budget.canada.ca': 'Department of Finance Canada, federal budget',
};
export const sourceName = url => { const h = new URL(url).host; return HOSTS[h] ?? h; };

// Card values resolved from the facts: years, the timeline range, stats and source lines.
export function resolve(reel, facts, dm = null) {
  const byId = new Map(facts.facts.map(f => [f.id, f]));
  const dates = reel.cards.filter(c => c.type === 'date').map(c => {
    const f = byId.get(c.fact_ids[0]);
    return { card: c.id, short: c.short, year: yearOf(f), value: String(f.value), fact: f };
  });
  const years = dates.map(d => d.year);
  const range = { from: Math.min(...years), to: Math.max(...years) };
  const cards = reel.cards.map(c => {
    const fs = (c.fact_ids ?? []).map(id => byId.get(id));
    const ys = fs.map(yearOf);
    const r = { ...c, facts: fs };
    if (c.type === 'date') {
      r.year = ys[0];
      r.qualifier = String(fs[0].value) === String(ys[0]) ? null : String(fs[0].value);
      r.source = sourceName(fs[0].source_url);
      r.index = dates.findIndex(d => d.card === c.id);
    }
    if (c.type === 'hook') { r.from = ys.length && !dm ? Math.min(...ys) : null; r.to = ys.length && !dm ? Math.max(...ys) : null; } // a data reel's hook shows the data's year
    if (c.type === 'series') r.panel = dm.panels.find(p => p.id === c.panel);
    if (c.type === 'proposals') { r.year = dm.year + (c.offset ?? 0); r.items = dm.proposals.filter(p => (p.at ?? String(dm.year)).slice(0, 4) === String(r.year)); }
    if (c.type === 'section') r.when = longDate(String(fs[0].value));
    if (c.type === 'stat' && c.stat === 'span_years') r.value = Math.max(...ys) - Math.min(...ys);
    if (c.type === 'sources' && dates.length) r.lines = fs.map(f => {
      const d = dates.find(x => x.fact.id === f.id);
      return { short: d?.short ?? f.id, year: yearOf(f), source: sourceName(f.source_url), url: f.source_url, read: f.as_of };
    });
    // A data reel's sources: the snapshot's own attribution, then each distinct page the facts come from.
    if (c.type === 'sources' && !dates.length) r.lines = [
      ...(dm ? [{ short: 'Data', source: dm.source.attribution.replace(/\.$/, ''), read: dm.source.retrieved }] : []),
      ...[...new Map(fs.map(f => [sourceName(f.source_url), f])).values()].map(f => ({ short: f.authority === 'budget_proposal' ? 'Proposals' : 'Facts', source: sourceName(f.source_url), url: f.source_url, read: f.as_of })),
    ];
    return r;
  });
  let t = 0;
  for (const c of cards) { c.start = t; t += c.duration; }
  const endText = reel.cards.find(c => c.type === 'end')?.text ?? '';
  return { reel, cards, dates, range, total: t, endText, data: dm };
}

// The words a card puts on screen, in reading order (used for captions and the alt text).
export function screenText(c) {
  switch (c.type) {
    case 'hook': return c.from !== null ? [c.text, `${c.from} to ${c.to}`] : [c.text];
    case 'series': return [c.panel.title, `${c.panel.summary.from} to ${c.panel.summary.to}`, c.panel.note];
    case 'section': return [c.text, c.when, ...(c.sub ? [c.sub] : [])];
    case 'proposals': return [String(c.year), ...c.items.flatMap(i => [i.when, i.title, i.value]), 'Proposed, not law'];
    case 'date': return [`${c.short}, ${c.year}`, c.name, ...(c.qualifier ? [`In law: ${c.qualifier}`] : []), c.beat, c.today];
    case 'chart': return [c.text];
    case 'stat': return [`${c.value} ${c.text}`];
    case 'sources': return [c.text, ...c.lines.map(l => `${l.short}${l.year ? ' ' + l.year : ''}: ${l.source}`)];
    case 'end': return [c.text, c.ai, ...(c.voice_note ? [c.voice_note] : [])];
    default: return [];
  }
}

const vttTime = s => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`; };
// With a voice, a voiced card's cue is what the voice says, from when it starts; other cards show their words.
export function captionsVTT(model) {
  const cues = model.cards.map((c, i) => {
    const voiced = c.voiceLead !== undefined && c.say;
    const from = voiced ? c.start + c.voiceLead : c.start;
    const words = voiced ? [spoken(c, { numerals: true })] : screenText(c);
    return `${i + 1}\n${vttTime(from)} --> ${vttTime(c.start + c.duration)}\n${words.join('\n')}`;
  });
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

// Numbers as a narrator says them, so the voice never reads digits: 1987 -> "nineteen eighty-seven",
// 2004 -> "two thousand four", 2031 -> "twenty thirty-one", 45 -> "forty-five".
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function under100(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''); }
export function yearWords(y) {
  const hi = Math.floor(y / 100), lo = y % 100;
  if (y >= 2000 && y < 2010) return lo ? `two thousand ${ONES[lo]}` : 'two thousand';
  return `${under100(hi)} ${lo === 0 ? 'hundred' : lo < 10 ? 'oh ' + ONES[lo] : under100(lo)}`;
}
const cap = s => s[0].toUpperCase() + s.slice(1);
// A card's spoken line, filled from the facts: as words for the voice, or with numerals for the captions.
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
  'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
const ordinal = n => n <= 20 ? ORD[n] : n % 10 === 0 ? TENS[n / 10].replace(/y$/, 'ieth') : `${TENS[Math.floor(n / 10)]}-${ORD[n % 10]}`;
// "October 29" said as "October twenty-ninth".
export function dayWords(d, { numerals = false } = {}) {
  const [, m, day] = d.split('-').map(Number);
  return `${MONTHS[m - 1]} ${numerals ? day : ordinal(day)}`;
}
// A rate or price as a narrator says it: "2.25%" -> "two and a quarter percent", "2.7%" -> "two point seven percent",
// "1.4181" -> "one point four two" (prices to two places).
export function amountWords(str) {
  const pct = str.endsWith('%'), n = parseFloat(str);
  const whole = Math.floor(n), frac = Math.round((n - whole) * 100);
  const unit = pct ? ' percent' : '';
  if (pct && [0, 25, 50, 75].includes(frac) && /\.\d\d%$/.test(str)) return `${under100(whole)}${['', ' and a quarter', ' and a half', ' and three quarters'][frac / 25]}${unit}`;
  const digits = pct ? str.replace('%', '').split('.')[1] ?? '' : (Math.round(n * 100) / 100).toFixed(2).split('.')[1];
  return `${under100(whole)}${digits ? ' point ' + [...digits].map(d => ONES[Number(d)]).join(' ') : ''}${unit}`;
}
export function spoken(c, { numerals = false } = {}) {
  if (!c.say) return null;
  const fill = (s, key, val) => s.replace(new RegExp(`\\{${key}\\}`, 'g'), val).replace(new RegExp(`\\{${cap(key)}\\}`, 'g'), cap(val));
  let s = c.say;
  if (c.type === 'series') {
    const { from, to } = c.panel.summary;
    s = s.replace(/\{up:([^|}]+)\|([^}]+)\}/g, (_, up, down) => (parseFloat(to) > parseFloat(from) ? up : down));
    s = fill(s, 'from', numerals ? from : amountWords(from));
    s = fill(s, 'to', numerals ? to : amountWords(to));
    if (c.panel.decisions?.length) s = fill(s, 'decision', dayWords(c.panel.decisions[0].d, { numerals }));
    return s;
  }
  if (c.type === 'section') return fill(s, 'date', dayWords(String(c.facts[0].value), { numerals }));
  if (c.type === 'proposals') return fill(s, 'year', numerals ? String(c.year) : yearWords(c.year));
  const v = c.type === 'date' ? c.year : c.value;
  const w = numerals ? String(v) : c.type === 'date' ? yearWords(v) : under100(v);
  return s.replace(/\{(year|value)\}/g, w).replace(/\{(Year|Value)\}/g, cap(w));
}
