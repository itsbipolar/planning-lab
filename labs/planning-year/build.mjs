// Builds labs/planning-year/dist/index.html: one self-contained page (styles, fonts, the engine, the synthetic book, the
// trigger types and the confirmed facts it reads, inlined), so the page makes no request after it loads.
// Run: node labs/planning-year/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeBook } from './book.mjs';
import { factIds, buildTriggers } from './engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const b64 = (p) => readFileSync(p).toString('base64');
const config = JSON.parse(read(join(here, 'triggers.json')));
// PREVIEW_FACTS and OUT build a look-ahead copy outside dist (for example from the tests' fixture); the real page always uses shared/facts.json.
const allFacts = JSON.parse(read(process.env.PREVIEW_FACTS ?? join(root, 'shared', 'facts.json'))).facts;
// Only the confirmed facts the page reads: the ones the trigger types cite and the two that set the life-stage filter.
const want = new Set([...config.types.flatMap((t) => factIds(t, config.year)), 'cpp_earliest_start_age', 'cpp_latest_start_age', 'rrsp_maturity_age']);
const facts = allFacts.filter((f) => f.status === 'confirmed' && want.has(f.id)).map(({ id, title, value, unit, source_url, authority, as_of, status, tax_year }) => ({ id, title, value, unit, source_url, authority, as_of, status, tax_year }));
const book = makeBook({ seed: config.seed, n: config.households, year: config.year });
const engine = read(join(here, 'engine.mjs')).replace(/^export /gm, '');
const fonts = `@font-face{font-family:"Archivo Variable";src:url(data:font/woff2;base64,${b64(join(here, 'fonts', 'archivo-latin-wght-normal.woff2'))}) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Instrument Serif";src:url(data:font/woff2;base64,${b64(join(here, 'fonts', 'instrument-serif-latin-400-normal.woff2'))}) format("woff2");font-weight:400;font-display:swap}`;
const css = [fonts, read(join(root, 'shared', 'tokens.css')), read(join(here, 'style.css'))].join('\n');
const data = JSON.stringify({ config, book, facts }).replace(/</g, '\\u003c');
const html = read(join(here, 'index.src.html')).replace('/*@@CSS@@*/', () => css).replace('/*@@DATA@@*/', () => data)
  .replace('/*@@ENGINE@@*/', () => engine).replace('/*@@JS@@*/', () => read(join(here, 'app.js')));
const out = process.env.OUT ?? join(here, 'dist', 'index.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
const { items, pending } = buildTriggers(book, { facts }, config);
console.log(`built ${out} (${(html.length / 1024).toFixed(0)} KiB): ${book.households.length} synthetic households, ${items.length} dated tasks, ${pending.length} task types pending (${pending.map((p) => p.type).join(', ') || 'none'})`);
