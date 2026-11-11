// Builds labs/planning-calendar/dist/index.html: one self-contained page (styles, fonts, the shared P5 colour scale, the
// calendar computed from the confirmed facts, the script), so the page makes no request after it loads.
// Run: node labs/planning-calendar/build.mjs   (PREVIEW_FACTS=<file> OUT=<file> builds a look-ahead copy outside dist)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCalendar } from './engine.mjs';
import { heatCSS, HEAT_STEPS } from '../../shared/heat-scale.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const b64 = (p) => readFileSync(p).toString('base64');
const config = JSON.parse(read(join(here, 'calendar.json')));
const factsFile = JSON.parse(read(process.env.PREVIEW_FACTS ?? join(root, 'shared', 'facts.json')));
const cal = buildCalendar(config, factsFile);
const used = new Set([...cal.households.flatMap((h) => h.dates.flatMap((d) => d.facts)), ...cal.own.flatMap((o) => o.facts)]);
const facts = Object.fromEntries(factsFile.facts.filter((f) => f.status === 'confirmed' && used.has(f.id)).map((f) => [f.id, { title: f.title, value: f.value, unit: f.unit, source_url: f.source_url, as_of: f.as_of }]));
const fonts = `@font-face{font-family:"Archivo Variable";src:url(data:font/woff2;base64,${b64(join(here, 'fonts', 'archivo-latin-wght-normal.woff2'))}) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Instrument Serif";src:url(data:font/woff2;base64,${b64(join(here, 'fonts', 'instrument-serif-latin-400-normal.woff2'))}) format("woff2");font-weight:400;font-display:swap}`;
const css = [fonts, read(join(root, 'shared', 'tokens.css')), read(join(here, 'style.css')), heatCSS()].join('\n');
const html = read(join(here, 'index.src.html')).replace('/*@@CSS@@*/', () => css)
  .replace('/*@@DATA@@*/', () => JSON.stringify({ ...cal, facts, heatSteps: HEAT_STEPS }).replace(/</g, '\\u003c')).replace('/*@@JS@@*/', () => read(join(here, 'app.js')));
const out = process.env.OUT ?? join(here, 'dist', 'index.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`built ${out.replace(root + '/', '')} (${(html.length / 1024).toFixed(0)} KiB): ${cal.households.length} households, ${cal.households.reduce((k, h) => k + h.dates.length, 0)} dates placed, ${cal.households.reduce((k, h) => k + h.pending.length, 0)} pending`);
