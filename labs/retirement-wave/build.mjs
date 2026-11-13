// Builds labs/retirement-wave/dist/index.html: one self-contained page (the Data desk look and fonts, the colour steps, the
// model built from the dated Statistics Canada snapshot and the confirmed rule-age facts, the calculations and the script),
// so it makes no request after it loads. Run: node labs/retirement-wave/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildModel } from './model.mjs';
import { scaleCSS, STEPS } from './scale.mjs';
import { deskCSS } from '../../shared/desk/desk.mjs';
import { deskUICSS, deskUIJS } from '../../shared/desk/desk-ui.mjs';
import { deskPage } from '../../shared/desk/desk-page.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const model = buildModel(JSON.parse(read(join(root, 'shared', 'facts.json'))), JSON.parse(read(join(root, 'shared', 'data', 'population-by-age-places.json'))));
const css = [deskCSS(), deskUICSS(), read(join(here, 'style.css')), scaleCSS()].join('\n');
const js = deskUIJS() + '\n' + read(join(here, 'model.mjs')).replace(/^export /gm, '') + '\n' + read(join(here, 'app.js'));
const html = deskPage(read(join(here, 'index.src.html')), 'retirement-wave').replace('/*@@CSS@@*/', () => css)
  .replace('/*@@DATA@@*/', () => JSON.stringify({ model, steps: STEPS }).replace(/</g, '\\u003c')).replace('/*@@JS@@*/', () => js);
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);
console.log(`built dist/index.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KiB): ${model.places.length} places, ${model.years.join(' to ')}, ages ${model.ages.join(' to ')}, ${model.rules.length} rule ages (${model.rules.map((r) => r.age).join(', ')}), data released ${model.source.released}`);
