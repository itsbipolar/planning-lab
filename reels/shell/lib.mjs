// The reel shell's core: read a reel.json, check every card against shared/facts.json (preflight),
// and resolve each card's facts into the values a card shows. Every year and figure on a card comes
// from facts.json; reel.json holds only words, timings and the card order.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CARD_TYPES = ['hook', 'date', 'stat', 'chart', 'sources', 'end'];
// The end card carries only the fixed education and AI lines, so it is the one type without a fact.
const NEEDS_FACT = new Set(['hook', 'date', 'stat', 'chart', 'sources']);
const STATS = new Set(['span_years']);
const ART = new Set(['cheque', 'form', 'paystub', 'passbook', 'key']); // the drawings in art.mjs
const TEXT_FIELDS = ['text', 'beat', 'today', 'name', 'short', 'ai', 'say', 'voice_note'];
const SLOTS = { date: ['year', 'Year'], stat: ['value', 'Value'] }; // the only placeholders a spoken line may hold

export const readJSON = p => JSON.parse(readFileSync(p, 'utf8'));
export const loadFacts = (p = join(ROOT, 'shared', 'facts.json')) => readJSON(p);
export const loadReel = dir => readJSON(join(dir, 'reel.json'));

// The first four-digit year in a fact's value, e.g. "after March <year>" gives that year.
export function yearOf(fact) {
  const m = String(fact.value ?? '').match(/\b(1[89]\d\d|20\d\d)\b/);
  return m ? Number(m[1]) : null;
}

// Returns a list of problems; an empty list means the reel may render.
export function preflight(reel, facts) {
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
    for (const m of String(c.say ?? '').matchAll(/\{(\w+)\}/g)) {
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
    if (c.type === 'stat' && !STATS.has(c.stat)) errors.push(`${where}: unknown stat "${c.stat}"`);
  });
  for (const id of reel.carousel ?? []) if (!ids.has(id)) errors.push(`carousel: no card "${id}"`);
  return errors;
}

const HOSTS = {
  'laws-lois.justice.gc.ca': 'Justice Laws Website',
  'www.osfi-bsif.gc.ca': 'Office of the Chief Actuary, OSFI',
  'www150.statcan.gc.ca': 'Statistics Canada',
  'www.canada.ca': 'Government of Canada',
};
export const sourceName = url => { const h = new URL(url).host; return HOSTS[h] ?? h; };

// Card values resolved from the facts: years, the timeline range, stats and source lines.
export function resolve(reel, facts) {
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
    if (c.type === 'hook') { r.from = Math.min(...ys); r.to = Math.max(...ys); }
    if (c.type === 'stat' && c.stat === 'span_years') r.value = Math.max(...ys) - Math.min(...ys);
    if (c.type === 'sources') r.lines = fs.map(f => {
      const d = dates.find(x => x.fact.id === f.id);
      return { short: d?.short ?? f.id, year: yearOf(f), source: sourceName(f.source_url), url: f.source_url, read: f.as_of };
    });
    return r;
  });
  let t = 0;
  for (const c of cards) { c.start = t; t += c.duration; }
  const endText = reel.cards.find(c => c.type === 'end')?.text ?? '';
  return { reel, cards, dates, range, total: t, endText };
}

// The words a card puts on screen, in reading order (used for captions and the alt text).
export function screenText(c) {
  switch (c.type) {
    case 'hook': return [c.text, `${c.from} to ${c.to}`];
    case 'date': return [`${c.short}, ${c.year}`, c.name, ...(c.qualifier ? [`In law: ${c.qualifier}`] : []), c.beat, c.today];
    case 'chart': return [c.text];
    case 'stat': return [`${c.value} ${c.text}`];
    case 'sources': return [c.text, ...c.lines.map(l => `${l.short} ${l.year}: ${l.source}`)];
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
export function spoken(c, { numerals = false } = {}) {
  if (!c.say) return null;
  const v = c.type === 'date' ? c.year : c.value;
  const w = numerals ? String(v) : c.type === 'date' ? yearWords(v) : under100(v);
  return c.say.replace(/\{(year|value)\}/g, w).replace(/\{(Year|Value)\}/g, cap(w));
}
