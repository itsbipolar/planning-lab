// Builds labs/order-of-returns/dist/index.html: one self-contained page (the Data desk styles and fonts, the engine, the
// enumeration and its worker, the story and the confirmed facts it uses, inlined), so it makes no request after it loads.
// Run: node labs/order-of-returns/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deskCSS } from '../../shared/desk/desk.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const strip = (src) => src.replace(/^export /gm, '');

// the facts this page uses: confirmed only; a missing one stops the build instead of drawing a guess
const all = JSON.parse(read(join(root, 'shared', 'facts.json'))).facts;
const need = (id) => {
  const f = all.find((x) => x.id === id && x.status === 'confirmed');
  if (!f) throw new Error(`${id} is not confirmed in shared/facts.json`);
  return { id, title: f.title, value: f.value, unit: f.unit, source_url: f.source_url, as_of: f.as_of };
};
const facts = { rrif: need('rrif_minimum_factors'), maturity: need('rrsp_maturity_age') };

const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const css = [deskCSS(), read(join(here, 'style.css'))].join('\n');
const enumerate = strip(read(join(here, 'enumerate.mjs')));
const worker = enumerate + '\n' + read(join(here, 'worker.js'));
const js = strip(read(join(here, 'engine.mjs'))) + '\n' + enumerate + '\n' + read(join(here, 'app.js'));
for (const [name, src] of [['worker', worker], ['script', js]]) if (/<\/script/i.test(src)) throw new Error(`${name} contains </script`);
const html = read(join(here, 'index.src.html'))
  .replace('/*@@CSS@@*/', () => css)
  .replace('/*@@STORY@@*/', () => json(JSON.parse(read(join(here, 'story.json')))))
  .replace('/*@@FACTS@@*/', () => json(facts))
  .replace('/*@@WORKER@@*/', () => worker)
  .replace('/*@@JS@@*/', () => js);
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB)`);
