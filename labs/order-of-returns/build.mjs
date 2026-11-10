// Builds labs/order-of-returns/dist/index.html: one self-contained page (styles, engine, scenes, fonts and the story
// inlined), so it makes no request after it loads. Run: node labs/order-of-returns/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8'), b64 = (p) => readFileSync(p).toString('base64');
const fonts = `@font-face{font-family:"Archivo Variable";src:url(data:font/woff2;base64,${b64(join(here, 'fonts', 'archivo-latin-wght-normal.woff2'))}) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Instrument Serif";src:url(data:font/woff2;base64,${b64(join(here, 'fonts', 'instrument-serif-latin-400-normal.woff2'))}) format("woff2");font-weight:400;font-display:swap}`;
const css = [fonts, read(join(root, 'shared', 'tokens.css')), read(join(here, 'style.css'))].join('\n');
const engine = read(join(here, 'engine.mjs')).replace(/^export /gm, '');
const js = engine + '\n' + read(join(here, 'app.js'));
const story = JSON.stringify(JSON.parse(read(join(here, 'story.json')))).replace(/</g, '\\u003c');
const html = read(join(here, 'index.src.html')).replace('/*@@CSS@@*/', () => css).replace('/*@@STORY@@*/', () => story).replace('/*@@JS@@*/', () => js);
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB)`);
