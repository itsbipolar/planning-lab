// The page's words, education only (SPEC.md sections 1, 10 and 13): no advice, sales or product words, no dollar figure,
// never "the insurer's" or "your insurer"; "guarantee" only in a negative sentence; a smoothing period only as this
// example's setting; the stamp, the labels, the attribution and the closing line. Run over the built page's visible text,
// its head and aria strings, every string the page script writes, the poster and (when the site checkout is beside this
// one) the making-of page. The facts' own values, quoted verbatim in Go deeper, are official text and are checked
// against the facts file instead (page.spec.mjs). The rendered page at every state is checked in page.spec.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { toolFor, questionOf } from '../../../shared/desk/desk-page.mjs';
import { BANNED, STAMP, ASSUME, CLOSE, CONTROL_LABEL } from './words.mjs';

const here = new URL('..', import.meta.url).pathname;
const dist = readFileSync(here + 'dist/index.html', 'utf8');
const app = readFileSync(here + 'app.js', 'utf8');
const poster = readFileSync(here + 'dist/poster.json', 'utf8');
const snap = JSON.parse(readFileSync(new URL('../../../shared/data/long-bond-yield-yearly.json', import.meta.url), 'utf8'));
const site = (p) => new URL(`../../../../mo-portfolio-site/${p}`, import.meta.url).pathname;
const mdx = existsSync(site('src/content/projects/par-dividends.mdx')) ? readFileSync(site('src/content/projects/par-dividends.mdx'), 'utf8') : '';
const mainHtml = dist.slice(dist.indexOf('<main>'), dist.indexOf('</main>'));
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<\/(p|li|h\d|div|output|th|td|dt|dd|summary|label|legend|caption|figcaption)>/gi, '. ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');
const visible = strip(mainHtml);
const head = strip(dist.slice(0, dist.indexOf('<body')).replace(/<title>/, ' ')) + ' ' + [...dist.matchAll(/content="([^"]*)"/g)].map((m) => m[1]).join(' ');
const aria = [...dist.matchAll(/aria-(?:label|valuetext)="([^"]*)"/g)].map((m) => m[1]).join(' ');
const strings = [...app.replace(/^\s*\/\/.*$/gm, '').matchAll(/'((?:\\.|[^'\\])*)'/g)].map((m) => m[1]).filter((s) => /\s/.test(s));
const sentences = (t) => t.replace(/<[^>]+>/g, ' ').split(/(?<=[.!?])\s+/);
const own = strip(mainHtml.replace(/<a class="desk-next"[\s\S]*?<\/a>/, ''));

test('no advice, sales, product or dollar words anywhere the visitor reads', () => {
  for (const [what, t] of [['page', visible], ['head', head], ['aria', aria], ['poster', poster], ['making-of', mdx]]) assert.doesNotMatch(t, BANNED, what);
  for (const s of strings) assert.doesNotMatch(s, BANNED, s);
  // the checker can fail
  for (const bad of ['You should own one', 'the best policy', 'a $2,000 dividend', 'buy now', 'the insurer’s method', 'your insurer', 'a typical period', 'insurers use five years', 'licensed agent', 'LLQP', 'purchase yield']) assert.match(bad, BANNED, bad);
  for (const ok of ['the insurer that issued it', 'bonds they were bought at', 'fair and equitable', 'management policy']) assert.doesNotMatch(ok, BANNED, ok);
});

test('the titles of the facts the page lists in Sources pass the same word check', () => {
  const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts;
  const data = JSON.parse(dist.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1]);
  assert.ok(data.facts.length >= 10);
  for (const f of data.facts) assert.doesNotMatch(f.title, BANNED, f.id);
  assert.ok(facts.length > data.facts.length);
});

test('the voice: third person, no titles, no hiring', () => {
  assert.doesNotMatch(own + ' ' + strings.join(' '), /\bCFP\b|Financial (Planner|Advisor)|\bhir(e|ing)\b|\byou\b|\byour\b/i);
});

test('"guarantee" only in a sentence that also says "not" or "cannot"', () => {
  const bad = (t) => sentences(t).filter((s) => /guarantee/i.test(s) && !/\bnot\b|\bcannot\b/i.test(s));
  for (const t of [visible, head, poster, mdx]) assert.deepEqual(bad(t), []);
  for (const s of strings) assert.deepEqual(bad(s), [], s);
  assert.deepEqual(bad('Dividends are guaranteed.'), ['Dividends are guaranteed.']);
});

test('a smoothing period or a spread is always this example\'s setting', () => {
  const rule = /smoothing period|\bspread(s|ing)?\b[^.]*\bover\b/i, ok = /our assumption|set above|a setting|this example/i;
  const bad = (t) => sentences(t).filter((s) => rule.test(s) && !ok.test(s) && s.replace(/[.\s]+$/, '').trim().toLowerCase() !== CONTROL_LABEL.toLowerCase());
  for (const t of [visible, head, poster, mdx]) assert.deepEqual(bad(t), []);
  assert.deepEqual(bad('Insurers spread gains over five years.'), ['Insurers spread gains over five years.']);
});

test('the stamp, the assumptions line, the close, the attribution and the change made are all there', () => {
  assert.ok(visible.includes(STAMP), 'the stamp');
  assert.ok(visible.includes(ASSUME.replace(/’/g, '’')), 'the assumptions line');
  assert.ok(visible.includes(CLOSE), 'the closing professional line');
  assert.ok(strings.some((s) => s.includes('our assumption, not any insurer’s')));
  assert.ok(app.includes("'Dividends are not guaranteed'") && app.includes("'a life insurer’s board declares them'") && app.includes("typically once a year, and they can go down."));
  // the snapshot's own attribution and change, carried in the data block verbatim and written by the page
  const data = JSON.parse(dist.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.bond.attribution, snap.attribution); assert.equal(data.bond.changes, snap.changes);
  assert.match(snap.attribution, /^Adapted from Statistics Canada[^]*Source: Bank of Canada\. Not affiliated with or endorsed by the Bank of Canada\.$/);
  assert.ok(app.includes('b.attribution') && app.includes('b.changes'));
});

test('the question: 12 words or fewer, 60 characters or fewer, no digit, and the H1', () => {
  const q = questionOf(toolFor('par-dividends'));
  assert.equal(q, 'How do participating policy dividends work?');
  assert.ok(q.split(/\s+/).length <= 12 && q.length <= 60);
  assert.doesNotMatch(q, /\d/);
  assert.ok(dist.includes(`<h1 id="question">${q}</h1>`));
});
