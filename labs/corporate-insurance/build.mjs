// Builds labs/corporate-insurance/dist/index.html: one self-contained page (the Data desk look and fonts, the confirmed
// facts, the engine and the script inlined), so it makes no request after it loads, and dist/poster.json for the site's
// poster. A missing required fact stops the build (model.mjs insuranceRules names it). Public slug: company-life-insurance
// (unlisted until shared/desk/next.json says "listed": true). Run: node labs/corporate-insurance/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deskCSS } from '../../shared/desk/desk.mjs';
import { deskUICSS, deskUIJS } from '../../shared/desk/desk-ui.mjs';
import { deskPage, toolFor, questionOf } from '../../shared/desk/desk-page.mjs';
import { writePoster, r as rnd } from '../../shared/desk/poster.mjs';
import { EXAMPLE, insuranceRules, split, money } from './model.mjs';

const LAB = 'corporate-insurance';
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const all = JSON.parse(read(join(root, 'shared', 'facts.json'))).facts;
const confirmed = all.filter((f) => f.status === 'confirmed');
const R = insuranceRules(all);
const S = split(R, EXAMPLE);

const tool = toolFor(LAB), question = questionOf(tool);
if (/\d/.test(question) || question.split(/\s+/).length > 12 || question.length > 60) throw new Error(`the question "${question}" must be 12 words or fewer, 60 characters or fewer, with no digit`);

// the version: the first 8 hex of sha256 over the engine and the facts it uses (deterministic; no build date)
const modelSrc = read(join(here, 'model.mjs'));
const version = createHash('sha256').update(modelSrc).update(JSON.stringify(R.used)).digest('hex').slice(0, 8);
const asOf = R.used.map((f) => f.as_of).sort().pop();

const css = [deskCSS(), deskUICSS(), read(join(here, 'style.css'))].join('\n');
// the engine runs in a closure, so its helpers never touch the page's globals; the page script reads INSURANCE
const names = [...modelSrc.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
const engine = `var INSURANCE = (function () {\n${modelSrc.replace(/^export /gm, '')}\nreturn { ${names.join(', ')} };\n})();`;
const js = [deskUIJS(), engine, read(join(here, 'app.js'))].join('\n');
const data = JSON.stringify({ facts: confirmed, version, asOf }).replace(/</g, '\\u003c');

const src = read(join(here, 'index.src.html'))
  .replace('{{question}}', () => question)
  .replace('{{lede}}', () => `A made-up owner dies; the company receives ${money(EXAMPLE.payout)}.`)
  .replace('{{family}}', () => money(S.family));
if (/\{\{\w+\}\}/.test(src)) throw new Error('index.src.html: an unfilled {{marker}}');
const html = deskPage(src, LAB).replace('/*@@CSS@@*/', () => css).replace('/*@@DATA@@*/', () => data).replace('/*@@JS@@*/', () => js);
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);

// the poster (dist/poster.json), kind "split": the bar as shares of the payout (through the account: capital dividend,
// to the family after dividend tax, income tax) and the one reading: the page's big answer, what reaches the family. The comparison bar goes on the poster only when
// app.js turns it on (COMPARE; off under the safer route). Every figure uses the page's formatter (money), so the poster
// and the page agree.
const COMPARE = /var COMPARE = true;/.test(read(join(here, 'app.js')));
{
  const f = (v) => rnd(v / S.inp.payout, 4);
  const cmp = { label: 'For comparison: as a taxable dividend', parts: [f(S.compare.family), f(S.compare.tax)], keys: ['after-tax', 'income-tax'] };
  const p = writePoster(join(here, 'dist'), LAB, {
    kind: 'split',
    example: 'A made-up owner · Hypothetical illustration',
    bars: [
      { label: 'Through the capital dividend account', parts: [f(S.capDiv), f(S.afterTax), f(S.tax)], keys: ['capital-dividend', 'after-tax', 'income-tax'] },
      ...(COMPARE ? [cmp] : []),
    ],
    readings: [{ label: 'reaches the family', value: money(S.family), text: `of a ${money(S.inp.payout)} example payout` }],
    labels: COMPARE ? [{ text: cmp.label }] : [],
    source: `Income Tax Act 83(2) and 89(1); CRA and Ontario rates (${R.rateYear})`,
    asOf,
  });
  console.log(`poster.json: ${p.kind}, ${p.readings.map((x) => x.value).join(' · ')}`);
}
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB): rates ${R.rateYear}, ${R.used.length} facts, version ${version}; to the family ${money(S.family)} (capital dividend ${money(S.capDiv)}), income tax ${money(S.tax)}`);
