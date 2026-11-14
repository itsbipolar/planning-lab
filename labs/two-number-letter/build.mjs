// Builds labs/two-number-letter/dist/index.html: one self-contained page (the Data desk look and fonts, the calc module,
// the drag-number component, the confirmed facts and the story inlined), so it makes no request after it loads.
// A missing confirmed fact stops the build. Run: node labs/two-number-letter/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rules, headline, cppFactor } from './calc.mjs';
import { writePoster, r as rnd } from '../../shared/desk/poster.mjs';
import { deskCSS } from '../../shared/desk/desk.mjs';
import { deskUICSS, deskUIJS } from '../../shared/desk/desk-ui.mjs';
import { deskPage } from '../../shared/desk/desk-page.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const all = JSON.parse(read(join(root, 'shared', 'facts.json'))).facts;
const r = rules(all); // throws if a rule the letter needs is not confirmed
const css = [deskCSS(), deskUICSS(), read(join(here, 'style.css'))].join('\n');
const strip = (p) => read(p).replace(/^export /gm, '');
const js = [deskUIJS(), strip(join(root, 'shared', 'drag-number.js')), strip(join(here, 'calc.mjs')), read(join(here, 'app.js'))].join('\n');
const facts = JSON.stringify({ facts: all.filter((f) => f.status === 'confirmed') }).replace(/</g, '\\u003c');
const story = JSON.stringify(JSON.parse(read(join(here, 'story.json')))).replace(/</g, '\\u003c');
const html = deskPage(read(join(here, 'index.src.html')), 'two-number-letter').replace('/*@@CSS@@*/', () => css).replace('/*@@FACTS@@*/', () => facts)
  .replace('/*@@STORY@@*/', () => story).replace('/*@@JS@@*/', () => js);
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);
// the poster (dist/poster.json): total CPP paid by each age for a start at the standard age and at the latest age, in
// years of the standard pension (so no amount is assumed), and the age where the later start catches up
{
  const h = headline(r, r.cpp.standard), early = h.from, late = h.to, cross = Math.round(h.at), s = cppFactor(r, late);
  const x1 = Math.ceil((h.at + (late - early)) / 5) * 5, total = (start, share, x) => share * Math.max(0, x - start);
  const lines = [early, late].map((start) => {
    const share = cppFactor(r, start), pts = [];
    for (let x = early; x <= x1; x++) pts.push([x, rnd(total(start, share, x), 2)]);
    return { label: `Start at ${start}`, start, points: pts };
  });
  const p = writePoster(join(here, 'dist'), 'two-number-letter', {
    kind: 'lines',
    example: 'Totals before tax, in years of the pension at ' + early + '; no investment return',
    x: { label: 'Age', min: early, max: x1 },
    y: { label: `Years of the pension at ${early}`, min: 0, max: rnd(total(late, s, x1), 2) },
    lines,
    cross: { age: rnd(h.at, 1), total: rnd(total(late, s, h.at), 2) },
    // the poster prints the first reading (each cheque's size); the age where the totals cross is drawn on the chart and
    // said in the card's dek, so the tile never says the same figure twice
    readings: [
      { label: `Each cheque, starting at ${late} instead of ${early}`, value: `+${rnd((s - 1) * 100, 0)}%` },
      { label: `Break-even age, ${late} against ${early}`, value: `age ${cross}` },
    ],
    labels: [{ text: 'They cross here', at: rnd(h.at, 1) }],
    source: 'CPP rules from canada.ca (confirmed facts)',
    asOf: r.sources.map((x) => x.as_of).sort().pop(),
  });
  console.log(`poster.json: ${p.kind}, ${p.readings.map((x) => x.value).join(' · ')}`);
}
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB): ${r.sources.length} sources, threshold year ${r.recovery.year}`);
