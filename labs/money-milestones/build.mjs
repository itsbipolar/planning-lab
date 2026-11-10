// Builds labs/money-milestones/dist/index.html: one self-contained page (styles, script, fonts and the facts inlined),
// so it makes no request after it loads and can be copied anywhere. Run: node labs/money-milestones/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const b64 = (p) => readFileSync(p).toString('base64');

const facts = JSON.parse(read(join(root, 'shared', 'facts.json')));
// only confirmed and pending facts are ever in the page; the page itself uses only confirmed ones
facts.facts = facts.facts.filter((f) => f.status === 'confirmed' || f.status === 'pending');
const factsJson = JSON.stringify(facts).replace(/</g, '\\u003c');

const fonts = `@font-face{font-family:"Archivo Variable";src:url(data:font/woff2;base64,${b64(join(here, 'fonts', 'archivo-latin-wght-normal.woff2'))}) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Instrument Serif";src:url(data:font/woff2;base64,${b64(join(here, 'fonts', 'instrument-serif-latin-400-normal.woff2'))}) format("woff2");font-weight:400;font-display:swap}`;
const css = [fonts, read(join(root, 'shared', 'tokens.css')), read(join(here, 'style.css'))].join('\n');

const html = read(join(here, 'index.src.html'))
  .replace('/*@@CSS@@*/', () => css)
  .replace('/*@@FACTS@@*/', () => factsJson)
  .replace('/*@@JS@@*/', () => read(join(here, 'app.js')));
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB, ${facts.facts.length} facts)`);
