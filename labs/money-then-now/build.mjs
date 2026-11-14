// Builds labs/money-then-now/dist/index.html: one self-contained page (the Data desk look and fonts, the yearly series
// computed here from the dated snapshots in shared/data/, the arithmetic and the script), so it makes no request after
// it loads. Run: node labs/money-then-now/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { series } from '../money-stripes/build.mjs';
import { deskCSS } from '../../shared/desk/desk.mjs';
import { deskUICSS, deskUIJS } from '../../shared/desk/desk-ui.mjs';
import { deskPage, toolFor, questionOf } from '../../shared/desk/desk-page.mjs';
import { EXAMPLE } from './model.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');

// The yearly series: price change and prime rate from money-stripes' series(), plus the yearly average price level
// (the mean of a year's twelve monthly CPI values; complete years only), which the purchasing-power line needs.
export function annual(cpiText, rateText) {
  const s = series(cpiText, rateText), cpi = JSON.parse(cpiText), rate = JSON.parse(rateText);
  const months = {};
  for (const [ym, v] of cpi.months) (months[Number(ym.slice(0, 4))] ||= []).push(v);
  const years = s.cpi.map(([y]) => y);
  years.forEach((y, i) => { if (i && y !== years[i - 1] + 1) throw new Error(`price years jump from ${years[i - 1]} to ${y}`); });
  const avg = {};
  for (const y of years) {
    if (!months[y] || months[y].length !== 12) throw new Error(`price year ${y} is not complete`);
    avg[y] = months[y].reduce((a, b) => a + b, 0) / months[y].length;
  }
  return {
    first: years[0], last: years.at(-1), primeFirst: s.rate[0][0],
    avg, infl: Object.fromEntries(s.cpi), prime: Object.fromEntries(s.rate),
    meta: {
      cpi: { title: cpi.title, source: cpi.source, source_url: cpi.source_url, licence: cpi.licence, attribution: cpi.attribution, retrieved: cpi.retrieved },
      rate: { title: rate.title, source: rate.source, source_url: rate.source_url, terms_url: rate.terms_url, attribution: rate.attribution, retrieved: rate.retrieved },
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const M = annual(read(join(root, 'shared', 'data', 'cpi-monthly.json')), read(join(root, 'shared', 'data', 'prime-rate-weekly.json')));
  const css = [deskCSS(), deskUICSS(), read(join(here, 'style.css'))].join('\n');
  const js = deskUIJS() + '\n' + read(join(here, 'model.mjs')).replace(/^export /gm, '') + '\n' + read(join(here, 'app.js'));
  // The question's amount is the page's example amount (model.mjs), so no figure is typed into the page's words.
  const src = read(join(here, 'index.src.html')).replace('{{example_amount}}', () => '$' + EXAMPLE.amount.toLocaleString('en-CA'));
  // the question must be the one the site and the Up next chain use (shared/desk/next.json), so they never drift apart
  const h1 = src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, '');
  if (h1 !== questionOf(toolFor('money-then-now'))) throw new Error(`the H1 "${h1}" differs from next.json's question`);
  const html = deskPage(src, 'money-then-now').replace('/*@@CSS@@*/', () => css)
    .replace('/*@@DATA@@*/', () => JSON.stringify(M).replace(/</g, '\\u003c')).replace('/*@@JS@@*/', () => js);
  mkdirSync(join(here, 'dist'), { recursive: true });
  writeFileSync(join(here, 'dist', 'index.html'), html);
  console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB): price years ${M.first}-${M.last}, prime from ${M.primeFirst}`);
}
