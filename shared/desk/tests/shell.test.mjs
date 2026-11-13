// The tool shell (desk-page.mjs): the chain in next.json is one loop through every public tool, films point at tools,
// the nav matches the site's four items, every public lab builds with the shell, and no age, rate or year from the facts
// is written into the shared shell code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SITE, NEXT, deskPage, toolFor } from '../desk-page.mjs';

const here = new URL('..', import.meta.url).pathname, root = new URL('../../../', import.meta.url).pathname;

test('the site nav is the four task labels, root-relative, and the origin is absolute https', () => {
  assert.deepEqual(SITE.nav.map((n) => n.label), ['Tools', 'Watch', 'How I build', 'About']);
  for (const n of SITE.nav) assert.match(n.href, /^\/[a-z-]+\/$/);
  assert.match(SITE.origin, /^https:\/\/[^/]+$/);
  assert.equal(SITE.footerNote, 'Education only, not advice.');
  assert.equal(SITE.aiNote, 'Made with AI assistance; every figure is checked at its source.');
});

test('Up next is one loop through all six tools; each question is short; films point at tools', () => {
  const slugs = NEXT.tools.map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  let at = 'your-year'; const seen = [];
  for (let i = 0; i < slugs.length; i++) { seen.push(at); at = NEXT.tools.find((t) => t.slug === at).next; }
  assert.equal(at, 'your-year'); assert.deepEqual([...seen].sort(), [...slugs].sort());
  assert.deepEqual(seen, ['your-year', 'when-to-start-cpp', 'order-of-returns', 'money-then-now', 'tax-dates', 'retirement-wave']);
  for (const t of NEXT.tools) {
    assert.ok(t.question.split(/\s+/).length <= 12, `${t.slug}: question of 12 words or fewer`);
    assert.ok(existsSync(`${root}labs/${t.labSlug}/build.mjs`), `${t.labSlug} is a lab`);
    assert.ok(readFileSync(`${root}labs/${t.labSlug}/dist/index.html`, 'utf8').includes(`href="/tools/${t.next}/"`), `${t.labSlug} dist links to ${t.next}`);
  }
  for (const [film, f] of Object.entries(NEXT.films)) assert.ok(slugs.includes(f.next), `${film} points at a tool`);
  assert.equal(toolFor('money-year'), null, 'money-year is not a public tool');
});

test('the shell refuses a page with a missing marker or a second data-next', () => {
  const ok = '<head><meta name="description" content="d"></head><!--@@TOOLBAR@@--><!--@@NEXT@@--><!--@@NOTES@@-->';
  assert.equal((deskPage(ok, 'planning-timeline').match(/data-next/g) || []).length, 1);
  assert.throws(() => deskPage(ok.replace('<!--@@NEXT@@-->', ''), 'planning-timeline'));
  assert.throws(() => deskPage(ok + '<a data-next>', 'planning-timeline'));
  assert.throws(() => deskPage(ok, 'money-year'));
});

test('no age, rate or year from the facts file is written into the shell code', () => {
  const facts = JSON.parse(readFileSync(`${root}shared/facts.json`, 'utf8')).facts.filter((f) => f.status === 'confirmed');
  const ids = ['tfsa_minimum_age', 'cpp_earliest_start_age', 'cpp_standard_start_age', 'cpp_latest_start_age', 'oas_start_age', 'oas_deferral_max_age', 'rrsp_maturity_age'];
  const figs = new Set(ids.map((id) => String(facts.find((f) => f.id === id).value)));
  facts.find((f) => f.id === 'rrif_minimum_factors').value.forEach((r) => figs.add(String(r.factor)));
  for (const f of ['desk-page.mjs', 'site-nav.json', 'next.json', 'shell-test.mjs']) {
    const t = readFileSync(here + f, 'utf8');
    for (const v of figs) assert.ok(!new RegExp(`(?<![\\w.#-])${v.replace('.', '\\.')}(?![\\w.%])`).test(t), `${f} contains ${v}`);
    assert.ok(!/(?<![\w.#-])(19|20)\d\d(?![\w.])/.test(t), `${f} contains a year`);
  }
});
