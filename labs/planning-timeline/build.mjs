// Builds labs/planning-timeline/dist/index.html: one self-contained page (the Data desk look and fonts, the model built
// from the confirmed facts and the population snapshot, the calculations and the script), so it makes no request after
// it loads. Run: node labs/planning-timeline/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildModel } from './model.mjs';
import { deskCSS } from '../../shared/desk/desk.mjs';
import { deskUICSS, deskUIJS } from '../../shared/desk/desk-ui.mjs';
import { deskPage } from '../../shared/desk/desk-page.mjs';
import { writePoster, r as rnd } from '../../shared/desk/poster.mjs';
import { yourYear, EXAMPLE_BIRTH_YEAR } from '../../shared/desk/your-year-core.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const data = (f) => JSON.parse(read(join(root, 'shared', 'data', f)));
const model = buildModel(JSON.parse(read(join(root, 'shared', 'facts.json'))), data('population-by-age.json'), data('cpi-monthly.json'));
const css = [deskCSS(), deskUICSS(), read(join(here, 'style.css'))].join('\n');
// the shared core first, then the model (its import line dropped: the core is already in the script), then the page
const strip = (src) => src.replace(/^import .*$/gm, '').replace(/^export /gm, '');
const js = [deskUIJS(), strip(read(join(root, 'shared', 'desk', 'your-year-core.mjs'))), strip(read(join(here, 'model.mjs'))), read(join(here, 'app.js'))].join('\n');
if (/<\/script/i.test(js)) throw new Error('the script contains </script');
const html = deskPage(read(join(here, 'index.src.html')), 'planning-timeline').replace('/*@@CSS@@*/', () => css)
  .replace('/*@@DATA@@*/', () => JSON.stringify({ model }).replace(/</g, '\\u003c')).replace('/*@@JS@@*/', () => js);
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);

// the poster (dist/poster.json): the life line by age for the labelled example year, with its two readings from the core
{
  const thisYear = new Date().getFullYear(), b = EXAMPLE_BIRTH_YEAR, Y = yourYear(model.core, model.prices, b, thisYear), R = model.r;
  const lastRrif = model.rrif[model.rrif.length - 1].age, lo = R.tfsaAge, hi = lastRrif + 1;
  const p = writePoster(join(here, 'dist'), 'planning-timeline', {
    kind: 'lanes',
    example: `Example: born ${b}`,
    birthYear: b, thisYear, today: Y.age,
    x: { label: 'Age', min: lo, max: hi },
    lanes: [
      { key: 'tfsa', label: 'TFSA', from: Y.tfsaStart - b, to: hi, series: 'save' },
      { key: 'cpp', label: 'CPP', from: R.cppLo, to: R.cppHi + 1, std: R.cppStd, series: 'pension' },
      { key: 'oas', label: 'OAS', from: R.oasLo, to: R.oasHi + 1, boostFrom: model.oasBoostAge, series: 'pension' },
      { key: 'rrsp', label: 'RRSP, then RRIF', from: lo, to: R.rrsp + 1, series: 'save' },
    ],
    // the RRIF minimum as a staircase: [age it applies in (the year you turn), factor in %]
    rrif: model.rrif.filter((x) => x.age >= R.rrsp && x.age + 1 < hi).map((x) => [x.age + 1, rnd(x.factor * 100, 2)]),
    // one reading, the one the lanes show: the CPP window in calendar years (the bars run by age, the axis under them in
    // years); the prices figure is the home lead's, so the poster does not repeat it
    readings: [
      { label: 'CPP can start, if you qualify', value: `${Y.y60} to ${Y.y70}`, text: Y.text.cpp },
      { label: 'TFSA limits added up', value: Y.tfsaSum > 0 ? '$' + Y.tfsaSum.toLocaleString('en-CA') : `opens ${Y.tfsaStart}`, text: Y.text.tfsa },
    ],
    labels: [{ text: `Today, age ${Y.age}`, at: Y.age }],
    source: 'Canadian rules from official government pages; prices: Statistics Canada CPI',
    asOf: String(model.prices.last),
  });
  console.log(`poster.json: ${p.kind}, ${p.readings.map((x) => x.value).join(' · ')}`);
}
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB): ${Object.keys(model.tfsa).length} TFSA years, ${model.rrif.length} RRIF ages, ${model.sources.length} sources`);
