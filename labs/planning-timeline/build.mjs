// Builds labs/planning-timeline/dist/index.html: one self-contained page (the Data desk look and fonts, the model built
// from the confirmed facts and the population snapshot, the calculations and the script), so it makes no request after
// it loads. Run: node labs/planning-timeline/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildModel } from './model.mjs';
import { deskCSS } from '../../shared/desk/desk.mjs';
import { deskUICSS, deskUIJS } from '../../shared/desk/desk-ui.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const model = buildModel(JSON.parse(read(join(root, 'shared', 'facts.json'))), JSON.parse(read(join(root, 'shared', 'data', 'population-by-age.json'))));
const css = [deskCSS(), deskUICSS(), read(join(here, 'style.css'))].join('\n');
const js = deskUIJS() + '\n' + read(join(here, 'model.mjs')).replace(/^export /gm, '') + '\n' + read(join(here, 'app.js'));
const html = read(join(here, 'index.src.html')).replace('/*@@CSS@@*/', () => css)
  .replace('/*@@DATA@@*/', () => JSON.stringify({ model }).replace(/</g, '\\u003c')).replace('/*@@JS@@*/', () => js);
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB): ${Object.keys(model.tfsa).length} TFSA years, ${model.rrif.length} RRIF ages, ${model.sources.length} sources`);
