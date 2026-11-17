// Builds labs/par-dividends/dist/index.html: one self-contained page (the Data desk look and fonts, the confirmed facts
// it reads, the long-bond snapshot from 1960, the engine and the script inlined), so it makes no request after it loads,
// and dist/poster.json for the site's poster. A missing required fact stops the build (model.mjs parRules names it); a
// missing year in the snapshot stops it too (run() names the year). Public slug: par-dividends (unlisted until
// shared/desk/next.json says "listed": true). Run: node labs/par-dividends/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deskCSS } from '../../shared/desk/desk.mjs';
import { deskUICSS, deskUIJS } from '../../shared/desk/desk-ui.mjs';
import { deskPage, toolFor, questionOf } from '../../shared/desk/desk-page.mjs';
import { writePoster, r as rnd } from '../../shared/desk/poster.mjs';
import { EXAMPLE, BOUNDS, yieldsFrom, run, summary, parRules, pts } from './model.mjs';

const LAB = 'par-dividends';
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const all = JSON.parse(read(join(root, 'shared', 'facts.json'))).facts;
const R = parRules(all);
const snapText = read(join(root, 'shared', 'data', 'long-bond-yield-yearly.json'));
const snap = JSON.parse(snapText);
const { Y } = yieldsFrom(snap);
const out = run(Y), S = summary(out);

const tool = toolFor(LAB), question = questionOf(tool);
if (/\d/.test(question) || question.split(/\s+/).length > 12 || question.length > 60) throw new Error(`the question "${question}" must be 12 words or fewer, 60 characters or fewer, with no digit`);

// the values the page needs: from the first year the longest ladder reaches back to, to the last December
const from = EXAMPLE.start - Math.max(...BOUNDS.L);
const values = snap.values.filter(([ym]) => Number(ym.slice(0, 4)) >= from);

// the version: the first 8 hex of sha256 over the engine, the facts it uses and the snapshot (deterministic)
const modelSrc = read(join(here, 'model.mjs'));
const version = createHash('sha256').update(modelSrc).update(JSON.stringify(R.used)).update(snapText).digest('hex').slice(0, 8);
const asOf = R.used.map((f) => f.as_of).sort().pop();

const css = [deskCSS(), deskUICSS(), read(join(here, 'style.css'))].join('\n');
// the engine runs in a closure, so its helpers never touch the page's globals; the page script reads PAR
const names = [...modelSrc.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
const engine = `var PAR = (function () {\n${modelSrc.replace(/^export /gm, '')}\nreturn { ${names.join(', ')} };\n})();`;
const js = [deskUIJS(), engine, read(join(here, 'app.js'))].join('\n');
const bond = {
  values, title: snap.title, source: snap.source, source_url: snap.source_url, licence: snap.licence, licence_url: snap.licence_url,
  terms_url: snap.terms_url, attribution: snap.attribution, changes: snap.changes, retrieved: snap.retrieved,
};
const data = JSON.stringify({ facts: R.used, bond, version, asOf }).replace(/</g, '\\u003c');

const years = (n) => `${n} year${n === 1 ? '' : 's'}`;
const src = read(join(here, 'index.src.html'))
  .replace('{{question}}', () => question)
  .replace('{{lede}}', () => 'Dividends typically use a smoothed credited rate. It moves in small steps while returns jump.')
  .replace('{{years}}', () => years(EXAMPLE.N))
  .replace('{{big}}', () => pts(S.maxMoveCredited))
  .replace('{{line}}', () => `The actual return changed by up to ${pts(S.maxMoveActual)} points in one year.`);
if (/\{\{\w+\}\}/.test(src)) throw new Error('index.src.html: an unfilled {{marker}}');
const html = deskPage(src, LAB).replace('/*@@CSS@@*/', () => css).replace('/*@@DATA@@*/', () => data).replace('/*@@JS@@*/', () => js);
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);

// the poster (dist/poster.json), kind "lines": the credited rate and the actual return at the example, x from the first
// year to the last, and the one reading. The figure uses the page's formatter (pts), so the poster and the page agree.
{
  const all3 = out.flatMap((r) => [r.actual, r.credited]);
  const p = writePoster(join(here, 'dist'), LAB, {
    kind: 'lines',
    example: 'A made-up account on real bond yields · Hypothetical illustration',
    x: { label: 'Year', min: S.first, max: S.last },
    y: { label: '% a year', min: Math.floor(Math.min(0, ...all3)), max: Math.ceil(Math.max(...all3)) },
    lines: [
      { label: 'Credited rate (made-up)', points: out.map((r) => [r.year, rnd(r.credited, 1)]) },
      { label: 'Actual return (made-up)', points: out.map((r) => [r.year, rnd(r.actual, 1)]) },
    ],
    readings: [{ label: 'credited rate’s biggest one-year change', value: `${pts(S.maxMoveCredited)} points` }],
    labels: [],
    source: 'Bank of Canada data via Statistics Canada',
    asOf: snap.retrieved,
  });
  console.log(`poster.json: ${p.kind}, ${p.readings.map((x) => x.value).join(' · ')}`);
}
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB): ${R.used.length} facts, bond yields ${values[0][0]} to ${values.at(-1)[0]}, version ${version}; biggest credited move ${pts(S.maxMoveCredited)} (actual ${pts(S.maxMoveActual)})`);
