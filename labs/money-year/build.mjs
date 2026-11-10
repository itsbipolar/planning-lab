// Builds labs/money-year/dist/index.html: one self-contained page (styles, script, fonts, the model inlined). The model is
// computed here from the dated snapshot and the confirmed facts, so the page makes no request after it loads.
// Run: node labs/money-year/build.mjs   (MONEY_YEAR=<year> to build another year's snapshot)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildModel } from './model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const b64 = (p) => readFileSync(p).toString('base64');
const YEAR = process.env.MONEY_YEAR ?? '2026';
const model = buildModel(JSON.parse(read(join(root, 'shared', 'data', `money-year-${YEAR}.json`))), JSON.parse(read(join(root, 'shared', 'facts.json'))));
const fonts = `@font-face{font-family:"Archivo Variable";src:url(data:font/woff2;base64,${b64(join(here, 'fonts', 'archivo-latin-wght-normal.woff2'))}) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Instrument Serif";src:url(data:font/woff2;base64,${b64(join(here, 'fonts', 'instrument-serif-latin-400-normal.woff2'))}) format("woff2");font-weight:400;font-display:swap}`;
const css = [fonts, read(join(root, 'shared', 'tokens.css')), read(join(here, 'style.css'))].join('\n');
const html = read(join(here, 'index.src.html')).replace('/*@@CSS@@*/', () => css).replace('/*@@DATA@@*/', () => JSON.stringify(model).replace(/</g, '\\u003c')).replace('/*@@JS@@*/', () => read(join(here, 'app.js')));
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB): ${model.panels.length} panels, ${model.proposals.length} proposals, data to ${model.retrieved}`);
