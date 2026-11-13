// Builds labs/money-year/dist/index.html: one self-contained page (the Data desk look and fonts, the script and the model
// inlined). The model is computed here from the dated snapshot and the confirmed facts, so the page makes no request
// after it loads.
// Run: node labs/money-year/build.mjs   (MONEY_YEAR=<year> to build another year's snapshot)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildModel } from './model.mjs';
import { deskCSS } from '../../shared/desk/desk.mjs';
import { deskUICSS, deskUIJS } from '../../shared/desk/desk-ui.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const YEAR = process.env.MONEY_YEAR ?? '2026';
const model = buildModel(JSON.parse(read(join(root, 'shared', 'data', `money-year-${YEAR}.json`))), JSON.parse(read(join(root, 'shared', 'facts.json'))));
const css = [deskCSS(), deskUICSS(), read(join(here, 'style.css'))].join('\n');
const html = read(join(here, 'index.src.html')).replace('/*@@CSS@@*/', () => css).replace('/*@@DATA@@*/', () => JSON.stringify(model).replace(/</g, '\\u003c')).replace('/*@@JS@@*/', () => deskUIJS() + '\n' + read(join(here, 'app.js')));
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB): ${model.panels.length} panels, ${model.proposals.length} proposals, data to ${model.retrieved}`);
