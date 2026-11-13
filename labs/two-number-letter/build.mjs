// Builds labs/two-number-letter/dist/index.html: one self-contained page (the Data desk look and fonts, the calc module,
// the drag-number component, the confirmed facts and the story inlined), so it makes no request after it loads.
// A missing confirmed fact stops the build. Run: node labs/two-number-letter/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rules } from './calc.mjs';
import { deskCSS } from '../../shared/desk/desk.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const all = JSON.parse(read(join(root, 'shared', 'facts.json'))).facts;
const r = rules(all); // throws if a rule the letter needs is not confirmed
const css = [deskCSS(), read(join(here, 'style.css'))].join('\n');
const strip = (p) => read(p).replace(/^export /gm, '');
const js = [strip(join(root, 'shared', 'drag-number.js')), strip(join(here, 'calc.mjs')), read(join(here, 'app.js'))].join('\n');
const facts = JSON.stringify({ facts: all.filter((f) => f.status === 'confirmed') }).replace(/</g, '\\u003c');
const story = JSON.stringify(JSON.parse(read(join(here, 'story.json')))).replace(/</g, '\\u003c');
const html = read(join(here, 'index.src.html')).replace('/*@@CSS@@*/', () => css).replace('/*@@FACTS@@*/', () => facts)
  .replace('/*@@STORY@@*/', () => story).replace('/*@@JS@@*/', () => js);
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB): ${r.sources.length} sources, threshold year ${r.recovery.year}`);
