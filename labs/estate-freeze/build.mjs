// Builds labs/estate-freeze/dist/index.html: one self-contained page (the Data desk look and fonts, the confirmed facts,
// the engine and the script inlined), so it makes no request after it loads, and dist/poster.json for the site's poster.
// A missing required fact stops the build (model.mjs freezeRules names it). Run: node labs/estate-freeze/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deskCSS } from '../../shared/desk/desk.mjs';
import { deskUICSS, deskUIJS } from '../../shared/desk/desk-ui.mjs';
import { deskPage, toolFor, questionOf } from '../../shared/desk/desk-page.mjs';
import { writePoster, r as rnd } from '../../shared/desk/poster.mjs';
import { EXAMPLE, freezeRules, defaultDeathAge, freeze, fmtBig, fmtM1, fmtInput } from './model.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const ordinal = (n) => { const t = n % 100, o = n % 10; return n + (t >= 11 && t <= 13 ? 'th' : o === 1 ? 'st' : o === 2 ? 'nd' : o === 3 ? 'rd' : 'th'); };
const all = JSON.parse(read(join(root, 'shared', 'facts.json'))).facts;
const confirmed = all.filter((f) => f.status === 'confirmed');
const R = freezeRules(all);
// the example opens at the life table's age, so its age at death can be read from the life-expectancy facts
if (EXAMPLE.freezeAge !== R.lifeTable.age) throw new Error(`EXAMPLE.freezeAge (${EXAMPLE.freezeAge}) differs from the life table's age (${R.lifeTable.age})`);
const S = freeze(R, { ...EXAMPLE, deathAge: defaultDeathAge(R, EXAMPLE.freezeAge) });

const tool = toolFor('estate-freeze'), question = questionOf(tool);
if (/\d/.test(question) || question.split(/\s+/).length > 12) throw new Error(`the question "${question}" must be 12 words or fewer with no digit`);

// the version: the first 8 hex of sha256 over the engine and the facts it uses (deterministic; no build date)
const modelSrc = read(join(here, 'model.mjs'));
const version = createHash('sha256').update(modelSrc).update(JSON.stringify(R.used)).digest('hex').slice(0, 8);
const asOf = R.used.map((f) => f.as_of).sort().pop();

const css = [deskCSS(), deskUICSS(), read(join(here, 'style.css'))].join('\n');
// the engine runs in a closure, so its helpers never touch the page's globals; the page script reads FREEZE
const names = [...modelSrc.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
const engine = `var FREEZE = (function () {\n${modelSrc.replace(/^export /gm, '')}\nreturn { ${names.join(', ')} };\n})();`;
const js = [deskUIJS(), engine, read(join(here, 'app.js'))].join('\n');
const data = JSON.stringify({ facts: confirmed, version, asOf }).replace(/</g, '\\u003c');

const src = read(join(here, 'index.src.html'))
  .replace('{{question}}', () => question)
  .replace('{{lede}}', () => `A made-up retiree, ${EXAMPLE.freezeAge}, moves a portfolio into a company and freezes its value.`)
  .replace('{{value}}', () => fmtInput(EXAMPLE.value))
  .replace('{{pushed}}', () => fmtBig(S.pushed));
if (/\{\{\w+\}\}/.test(src)) throw new Error('index.src.html: an unfilled {{marker}}');
const html = deskPage(src, 'estate-freeze').replace('/*@@CSS@@*/', () => css).replace('/*@@DATA@@*/', () => data).replace('/*@@JS@@*/', () => js);
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'index.html'), html);

// the poster (dist/poster.json): the two bands by age from the freeze to death (low: the gain taxed at death with the
// freeze; top: the whole gain, taxed at death without one), the death and the trust's 21st year, and the one reading
{
  const p = writePoster(join(here, 'dist'), 'estate-freeze', {
    kind: 'band',
    example: 'A made-up retiree · Hypothetical illustration',
    x: { label: 'Age', min: EXAMPLE.freezeAge, max: S.xMax },
    y: { label: 'Gain not yet taxed, $ millions', min: 0, max: rnd(S.gainNo / 1e6, 1) },
    band: S.rows.map((r) => [r.age, rnd(r.gainWith / 1e6, 1), rnd(r.gainNo / 1e6, 1)]),
    deathAge: S.inp.deathAge, deemedAge: S.deemedAge, trustAtDeath: rnd(S.trust / 1e6, 1),
    readings: [{ label: 'gain taxed at death', value: `${fmtM1(S.gainNo)} → ${fmtM1(S.gainWith)}`, text: `Income tax pushed past death: ${fmtBig(S.pushed)}, deferred, not removed.` }],
    labels: [{ text: `Trust’s ${ordinal(R.trustYears)} year`, at: S.deemedAge }],
    source: `Income Tax Act, CRA and Ontario rates (${R.rateYear}); Statistics Canada life table`,
    asOf,
  });
  console.log(`poster.json: ${p.kind}, ${p.readings.map((x) => x.value).join(' · ')}`);
}
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KiB): rates ${R.rateYear}, ${R.used.length} facts, version ${version}; pushed ${fmtBig(S.pushed)}`);
