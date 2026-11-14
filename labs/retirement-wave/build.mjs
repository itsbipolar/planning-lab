// Builds labs/retirement-wave/dist/index.html: one self-contained page (the Data desk look and fonts, the colour steps, the
// model built from the dated Statistics Canada snapshot and the confirmed rule-age facts, the calculations and the script),
// so it makes no request after it loads. Run: node labs/retirement-wave/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildModel, question, finding, view, range, level, big, ageAnswer, defaultAge, num } from './model.mjs';
import { scaleCSS, STEPS } from './scale.mjs';
import { deskCSS } from '../../shared/desk/desk.mjs';
import { deskUICSS, deskUIJS } from '../../shared/desk/desk-ui.mjs';
import { deskPage, toolFor, questionOf } from '../../shared/desk/desk-page.mjs';
import { writePoster } from '../../shared/desk/poster.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const model = buildModel(JSON.parse(read(join(root, 'shared', 'facts.json'))), JSON.parse(read(join(root, 'shared', 'data', 'population-by-age-places.json'))));
const css = [deskCSS(), deskUICSS(), read(join(here, 'style.css')), scaleCSS()].join('\n');
const js = deskUIJS() + '\n' + read(join(here, 'model.mjs')).replace(/^export /gm, '') + '\n' + read(join(here, 'app.js'));
// The words the page opens on, computed from the model (Canada, all genders) and written in at build, so the first paint
// already reads right; the script rewrites the answer when the place or gender changes.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f = finding(model, view(model, 'CA', 'all')), A = ageAnswer(model, view(model, 'CA', 'all'), defaultAge(model));
const words = {
  question: question(model), lede: f.lede, more: f.more,
  age: A.age, hint: `Ages ${model.ages.join(' to ')}.`, label: A.label, count: num(A.count), unit: A.unit, line: A.line, how: A.how,
  assume: `Statistics Canada's estimates for July 1 of each year, ${model.years.join(' to ')}, ages ${model.ages.join(' to ')}: counted, not forecast. Education, not advice.`,
};
const src = read(join(here, 'index.src.html')).replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in words)) throw new Error(`index.src.html: no value for ${m}`); return esc(words[k]); });
// the question must be the one the site and the Up next chain use (shared/desk/next.json), so they never drift apart
if (question(model) !== questionOf(toolFor('retirement-wave'))) throw new Error(`the question "${question(model)}" differs from next.json's`);
const html = deskPage(src, 'retirement-wave').replace('/*@@CSS@@*/', () => css)
  .replace('/*@@DATA@@*/', () => JSON.stringify({ model, steps: STEPS }).replace(/</g, '\\u003c')).replace('/*@@JS@@*/', () => js);
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);
// the poster (dist/poster.json): the heatmap in ten shades (one string per age, one digit per year, 0 = fewest), the rule
// ages drawn across it, and the answer's two readings
{
  const V = view(model, 'CA', 'all'), [lo, hi] = range(model, V, 'count'), [y0, y1] = model.years, [a0, a1] = model.ages, SHADES = 10;
  const rows = [];
  for (let a = a0; a <= a1; a++) { let s = ''; for (let y = y0; y <= y1; y++) s += level(V.counts[y][a - a0], lo, hi, SHADES); rows.push(s); }
  const p = writePoster(join(here, 'dist'), 'retirement-wave', {
    kind: 'heat',
    example: `Canada, all genders, July 1, ${y0} to ${y1}`,
    x: { label: 'Year', min: y0, max: y1 },
    y: { label: 'Age', min: a0, max: a1 },
    shades: SHADES, rows,
    rules: model.rules.filter((r) => r.age === model.cppLo || r.age === model.oasLo).map((r) => ({ age: r.age, label: r.label })),
    readings: [
      { label: `Aged ${f.lo} to ${f.hi}, July 1, ${y1}`, value: big(f.now), text: f.lede },
      { label: `Times as many as in ${y0}`, value: f.ratio.toLocaleString('en-CA', { maximumFractionDigits: 1 }) + '×' },
    ],
    labels: [{ text: 'Darker = more people' }, { text: 'Each column is a year' }],
    source: model.source.attribution,
    asOf: String(y1),
  });
  console.log(`poster.json: ${p.kind}, ${p.readings.map((x) => x.value).join(' · ')}`);
}
console.log(`built dist/index.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KiB): ${model.places.length} places, ${model.years.join(' to ')}, ages ${model.ages.join(' to ')}, ${model.rules.length} rule ages (${model.rules.map((r) => r.age).join(', ')}), data released ${model.source.released}`);
