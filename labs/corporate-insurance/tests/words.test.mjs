// The page's words, education only (the safer route, Mo, 2026-11-17): no advice or sales words, no insurer, product,
// quote, premium figure, agent or LLQP; "tax-free" only beside "capital dividend"; the acronyms said once in an <abbr>;
// the stamp, the closing line and the short question. Run over the built page's visible text, its aria strings, every
// string the page script writes, the poster and (when the site checkout is beside this one) the making-of page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { toolFor, questionOf } from '../../../shared/desk/desk-page.mjs';
import { insuranceRules } from '../model.mjs';

const here = new URL('..', import.meta.url).pathname;
const dist = readFileSync(here + 'dist/index.html', 'utf8');
const app = readFileSync(here + 'app.js', 'utf8');
const poster = readFileSync(here + 'dist/poster.json', 'utf8');
const mdxPath = new URL('../../../../mo-portfolio-site/src/content/projects/corporate-insurance.mdx', import.meta.url).pathname;
const mdx = existsSync(mdxPath) ? readFileSync(mdxPath, 'utf8') : '';
import { BANNED } from './words.mjs';
const STAMP = 'Hypothetical illustration · Education, not advice';
const CLOSE = 'How any of this applies to a real company is a question for a tax professional and a lawyer.';
// the tool's own page: <main> only (the shared footer outside it carries the site's Contact link)
const mainHtml = dist.slice(dist.indexOf('<main>'), dist.indexOf('</main>'));
// a block's end is a sentence end, so words from two blocks never read as one phrase
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<\/(p|li|h\d|div|output|th|td|summary|label|caption|figcaption)>/gi, '. ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');
const visible = strip(mainHtml);
const head = strip(dist.slice(0, dist.indexOf('<body')).replace(/<title>/, ' ')) + ' ' + [...dist.matchAll(/content="([^"]*)"/g)].map((m) => m[1]).join(' ');
const aria = [...dist.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]).join(' ');
const strings = [...app.replace(/^\s*\/\/.*$/gm, '').matchAll(/'((?:\\.|[^'\\])*)'/g)].map((m) => m[1].replace(/\\u2019/g, '’').replace(/\\u00b7/g, '·'));
const sentences = (t) => t.replace(/<[^>]+>/g, ' ').split(/(?<=[.!?])\s+/);

test('no advice, sales or product words anywhere the visitor reads', () => {
  for (const [what, t] of [['page', visible], ['head', head], ['aria', aria], ['poster', poster], ['making-of', mdx]]) assert.doesNotMatch(t, BANNED, what);
  for (const s of strings) assert.doesNotMatch(s, BANNED, s);
  // the checker can fail
  for (const bad = ['You should buy this', 'a $2,000 premium', 'premium of $500', 'licensed agent', 'contact me', 'your policy']; bad.length;) assert.match(bad.pop(), BANNED);
  assert.doesNotMatch('Premiums raise it; the net cost of pure insurance lowers it.', BANNED);
});

test('"tax-free" only in a sentence that also says "capital dividend"', () => {
  const bad = (t) => sentences(t).filter((s) => /tax-free/i.test(s) && !/capital dividend/i.test(s));
  assert.deepEqual(bad(visible), []); assert.deepEqual(bad(head), []); assert.deepEqual(bad(poster), []);
  for (const s of strings) assert.deepEqual(bad(s), [], s);
  assert.deepEqual(bad('The whole payout is tax-free.'), ['The whole payout is tax-free.']);
});

test('ACB never appears; CDA only once, in its <abbr>', () => {
  for (const t of [visible, head, aria, poster, ...strings]) assert.doesNotMatch(t, /\bACB\b/);
  const cda = strings.join('\n').match(/\bCDA\b/g) || [];
  assert.equal(cda.length, 1);
  assert.ok(app.includes('<abbr title="capital dividend account">CDA</abbr>'));
  assert.doesNotMatch(visible, /\bCDA\b/);
});

test('the stamp, the closing line, the made-up owner, and the question', () => {
  assert.ok(visible.includes(STAMP), 'the stamp on the page');
  assert.ok(visible.includes(CLOSE.replace(/’/g, '’')), 'the closing professional line');
  assert.match(visible, /made-up owner/);
  assert.ok(app.includes(`STAMP = '${STAMP}'`));
  const q = questionOf(toolFor('corporate-insurance'));
  assert.ok(q.split(/\s+/).length <= 12 && q.length <= 60);
  assert.doesNotMatch(q, /\d/);
  assert.ok(dist.includes(`<h1 id="question">${q}</h1>`));
  // the voice: never "you" or "your" (the shared Up next card names the next tool's own question)
  const own = strip(mainHtml.replace(/<a class="desk-next"[\s\S]*?<\/a>/, ''));
  assert.doesNotMatch(own + ' ' + strings.join(' '), /\bCFP\b|Financial (Planner|Advisor)|hire|hiring|\byou\b|\byour\b/i);
});

test('What happens says what the facts say', () => {
  const R = insuranceRules(JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts);
  const steps = strings.filter((s) => /^<b>The (payout|account|election)\.<\/b>/.test(s));
  assert.equal(steps.length, 3);
  // the values are the Act's own lines, word for word (the facts repo's tests hold each to its source_quote); the step
  // words are the plain-words reading of them
  assert.match(R.text.cdaAdd.value, /proceeds of a life insurance policy/); assert.match(R.text.cdaAdd.value, /in consequence of the death/); assert.match(steps[0], /When the owner dies/);
  assert.match(R.text.cdaLess.value, /^\(iii\) the adjusted cost basis/); assert.match(steps[1], /\bless the policy’s cost base\b/);
  assert.match(R.text.cdaLess.value, /immediately before the death/); assert.match(steps[1], /just before the death/);
  assert.match(R.text.election.title, /elects to be a capital dividend/); assert.match(steps[2], /elects/);
  assert.match(R.text.election.value, /no part of the dividend shall be included in computing the income/); assert.match(steps[2], /not counted in the family’s income/);
});
