// Builds labs/order-of-returns/dist/index.html: one self-contained page (the Data desk styles and fonts, the engine, the
// enumeration and its worker, the story and the confirmed facts it uses, inlined), so it makes no request after it loads.
// Run: node labs/order-of-returns/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deskCSS } from '../../shared/desk/desk.mjs';
import { deskUICSS, deskUIJS } from '../../shared/desk/desk-ui.mjs';
import { deskPage, toolFor, questionOf } from '../../shared/desk/desk-page.mjs';
import { writePoster } from '../../shared/desk/poster.mjs';
import { simulate, average } from './engine.mjs';
import { enumerateOrders, summarize, factorial } from './enumerate.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const strip = (src) => src.replace(/^export /gm, '');

// the facts this page uses: confirmed only; a missing one stops the build instead of drawing a guess
const all = JSON.parse(read(join(root, 'shared', 'facts.json'))).facts;
const need = (id) => {
  const f = all.find((x) => x.id === id && x.status === 'confirmed');
  if (!f) throw new Error(`${id} is not confirmed in shared/facts.json`);
  return { id, title: f.title, value: f.value, unit: f.unit, source_url: f.source_url, as_of: f.as_of };
};
const facts = { rrif: need('rrif_minimum_factors'), maturity: need('rrsp_maturity_age') };

const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const css = [deskCSS(), deskUICSS(), read(join(here, 'style.css'))].join('\n');
const enumerate = strip(read(join(here, 'enumerate.mjs')));
const worker = enumerate + '\n' + read(join(here, 'worker.js'));
const js = deskUIJS() + '\n' + strip(read(join(here, 'engine.mjs'))) + '\n' + enumerate + '\n' + read(join(here, 'app.js'));
for (const [name, src] of [['worker', worker], ['script', js]]) if (/<\/script/i.test(src)) throw new Error(`${name} contains </script`);
// the question names the number of cards in words, counted from story.json; it must match the question the site and the
// Up next chain use (shared/desk/next.json), so the two can never drift apart
const story = JSON.parse(read(join(here, 'story.json')));
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const nWords = WORDS[story.cards.length] || String(story.cards.length);
const src = read(join(here, 'index.src.html')).replaceAll('@@N_WORDS@@', nWords);
const h1 = src.match(/<h1[^>]*>([^<]*)<\/h1>/)[1];
if (h1 !== questionOf(toolFor('order-of-returns'))) throw new Error(`the H1 "${h1}" differs from next.json's question`);
const html = deskPage(src, 'order-of-returns')
  .replace('/*@@CSS@@*/', () => css)
  .replace('/*@@STORY@@*/', () => json(story))
  .replace('/*@@FACTS@@*/', () => json(facts))
  .replace('/*@@WORKER@@*/', () => worker)
  .replace('/*@@JS@@*/', () => js);
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);
// the poster (dist/poster.json): the money left each year for the same cards in two orders (good years first, bad years
// first), and, over every order of the cards, the share that lasts the whole horizon (the page's own rounding)
{
  const N = story.cards.length, AVG = average(story.cards), tail = Array.from({ length: story.horizon - N }, () => AVG);
  const run = (cards) => simulate({ start: story.start, withdrawal: story.withdrawal, indexation: story.indexation, returns: [...cards, ...tail] });
  const good = run(story.cards.slice().sort((a, b) => b - a)), bad = run(story.cards.slice().sort((a, b) => a - b));
  const k = (v) => Math.round(v / 1000) * 1000;
  const s = summarize(enumerateOrders({ start: story.start, withdrawal: story.withdrawal, indexation: story.indexation, cards: story.cards, tail }), story.cards);
  const share = (s.lasts / s.total) * 100, shareText = (Math.round(share * 10) / 10).toFixed(share >= 10 ? 0 : 1);
  const p = writePoster(join(here, 'dist'), 'order-of-returns', {
    kind: 'lines',
    example: 'Synthetic example: not historical, not a forecast',
    x: { label: 'Year', min: 0, max: story.horizon },
    y: { label: 'Money left', min: 0, max: k(Math.max(...good.balances, story.start)) },
    lines: [
      { label: 'Good years first', points: [[0, story.start], ...good.balances.map((b, i) => [i + 1, k(b)])], runsOut: good.depletionYear },
      { label: 'Bad years first', points: [[0, story.start], ...bad.balances.map((b, i) => [i + 1, k(b)])], runsOut: bad.depletionYear },
    ],
    // how many orders run out in each year (index = year; 0 = lasts the whole horizon)
    outcomes: { lasts: s.lasts, total: s.total, byYear: s.byYear },
    readings: [
      { label: `Of the ${factorial(N).toLocaleString('en-CA')} orders, lasting ${story.horizon} years`, value: `${shareText}%` },
      ...(bad.depletionYear ? [{ label: 'Bad years first runs out in', value: `year ${bad.depletionYear}` }] : []),
    ],
    labels: [{ text: 'Same ten years, same average' }, { text: 'Only the order differs' }],
    source: story._note,
    asOf: 'story.json',
  });
  console.log(`poster.json: ${p.kind}, ${p.readings.map((x) => x.value).join(' · ')}`);
}
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB)`);
