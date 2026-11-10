// Builds labs/money-stripes/dist/index.html: one self-contained page. The yearly series are computed here from the dated
// snapshots in shared/data/ and embedded, so the page makes no request after it loads. Run: node labs/money-stripes/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const b64 = (p) => readFileSync(p).toString('base64');

export function series(cpiFile, rateFile) {
  const cpi = JSON.parse(cpiFile), rate = JSON.parse(rateFile);
  const sums = {};
  for (const [ym, v] of cpi.months) { const y = Number(ym.slice(0, 4)); (sums[y] ||= []).push(v); }
  const avg = {}; for (const [y, v] of Object.entries(sums)) if (v.length === 12) avg[y] = v.reduce((a, b) => a + b, 0) / 12;   // complete years only
  const infl = Object.keys(avg).map(Number).filter((y) => avg[y - 1] !== undefined).sort((a, b) => a - b).map((y) => [y, (avg[y] / avg[y - 1] - 1) * 100]);
  const wk = {}; for (const [d, v] of rate.weeks) (wk[Number(d.slice(0, 4))] ||= []).push(v);
  const lastCpi = infl[infl.length - 1][0];
  const primes = Object.keys(wk).map(Number).filter((y) => y <= lastCpi && wk[y].length >= 50) /* complete years only */.sort((a, b) => a - b).map((y) => [y, wk[y].reduce((a, b) => a + b, 0) / wk[y].length]);
  return { cpi: infl, rate: primes, meta: { cpi: { attribution: cpi.attribution, source_url: cpi.source_url, retrieved: cpi.retrieved }, rate: { attribution: rate.attribution, terms_url: rate.terms_url, retrieved: rate.retrieved } } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = series(read(join(root, 'shared', 'data', 'cpi-monthly.json')), read(join(root, 'shared', 'data', 'prime-rate-weekly.json')));
  const fonts = `@font-face{font-family:"Archivo Variable";src:url(data:font/woff2;base64,${b64(join(here, 'fonts', 'archivo-latin-wght-normal.woff2'))}) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Instrument Serif";src:url(data:font/woff2;base64,${b64(join(here, 'fonts', 'instrument-serif-latin-400-normal.woff2'))}) format("woff2");font-weight:400;font-display:swap}`;
  const css = [fonts, read(join(root, 'shared', 'tokens.css')), read(join(here, 'style.css'))].join('\n');
  const html = read(join(here, 'index.src.html')).replace('/*@@CSS@@*/', () => css).replace('/*@@DATA@@*/', () => JSON.stringify(data).replace(/</g, '\\u003c')).replace('/*@@JS@@*/', () => read(join(here, 'app.js')));
  mkdirSync(join(here, 'dist'), { recursive: true });
  writeFileSync(join(here, 'dist', 'index.html'), html);
  console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB): ${data.cpi.length} price years ${data.cpi[0][0]}-${data.cpi.at(-1)[0]}, ${data.rate.length} prime years ${data.rate[0][0]}-${data.rate.at(-1)[0]}`);
}
