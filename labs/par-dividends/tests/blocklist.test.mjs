// No insurer, product or report name and no carrier wording anywhere (SPEC.md section 10). The names live only as salted
// SHA-256 hashes in blocklist.sha256.json (see its _note), so none is typed into this repo. Every run of 1 to maxN
// normalized words in each file is hashed and looked up. The made-up defaults must not land on a carrier figure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { EXAMPLE } from '../model.mjs';

const here = new URL('..', import.meta.url).pathname, root = new URL('../../../', import.meta.url).pathname;
const B = JSON.parse(readFileSync(new URL('./blocklist.sha256.json', import.meta.url), 'utf8'));
const NAMES = new Set(B.names), FIGS = new Set(B.figures);
const norm = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const h = (s) => createHash('sha256').update('par-dividends:' + s).digest('hex');
/** The blocked runs found in a text (as hashes, so a failure never prints a name: it prints the word position). */
function hits(text) {
  const w = norm(text).split(' ').filter(Boolean), out = [];
  for (let i = 0; i < w.length; i++) for (let n = 1; n <= B.maxN && i + n <= w.length; n++) if (NAMES.has(h(w.slice(i, i + n).join(' ')))) out.push(`word ${i}, ${n} words`);
  return out;
}
function walk(dir) {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

test('self-check: the matcher finds the canary and passes ordinary words', () => {
  assert.ok(hits(`Some text with the ${B.canary} in the middle.`).length >= 1);
  assert.deepEqual(hits('A method that is fair and equitable.'), []);
  assert.deepEqual(hits('Canada’s long bond yield, Bank of Canada data.'), []);
});

test('no blocked term in any file of the lab, its dist, the chain file or the site pages', () => {
  const files = walk(here).filter((p) => !p.endsWith('blocklist.sha256.json'));
  files.push(join(root, 'shared/desk/next.json'));
  const site = new URL('../../../../mo-portfolio-site/', import.meta.url).pathname;
  for (const p of ['src/content/projects/par-dividends.mdx', 'src/components/posters/par-dividends.astro', 'src/data/posters/par-dividends.json', 'src/data/og-posters.json', 'src/data/next.json', 'public/media/sources.json', 'scripts/covers.mjs']) if (existsSync(site + p)) files.push(site + p);
  if (existsSync(site + 'public/tools/par-dividends')) files.push(...walk(site + 'public/tools/par-dividends'));
  assert.ok(files.some((f) => f.endsWith('dist/index.html')) && files.some((f) => f.endsWith('SPEC.md')));
  for (const f of files) {
    if (/\.(png|jpe?g|woff2?)$/.test(f)) continue;
    assert.deepEqual(hits(readFileSync(f, 'utf8')), [], f);
  }
});

test('no blocked term in the commit messages that touch the lab or its data', (t) => {
  let log;
  try { log = execFileSync('git', ['log', '--format=%B', '--', 'labs/par-dividends', 'shared/data/long-bond-yield-yearly.json'], { cwd: root, encoding: 'utf8' }); } catch (e) { t.skip('git history is unavailable'); return; }
  assert.deepEqual(hits(log), []);
});

test('no made-up default lands on a listed carrier figure', () => {
  const defaults = [EXAMPLE.N, EXAMPLE.w * 100, (1 - EXAMPLE.w) * 100, EXAMPLE.L, EXAMPLE.spread * 100, EXAMPLE.prem * 100].map((v) => (Math.round(v * 100) / 100).toFixed(2));
  for (const v of defaults) assert.ok(!FIGS.has(h(v)), `the default ${v} is a carrier figure`);
  assert.ok(FIGS.size >= 30);
  // the checker can fail: the research's 70/30 mix is on the list
  assert.ok(FIGS.has(h('70.00')) && FIGS.has(h('30.00')));
});
