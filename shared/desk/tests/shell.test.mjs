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
  // the money-year reel goes to Money, then and now's This year in money (plan section 2); #this-year is the one hash allowed
  assert.equal(NEXT.films['money-year'].hash, 'this-year');
  for (const f of Object.values(NEXT.films)) if (f.hash) assert.equal(f.hash, 'this-year');
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

test('no sans tabular counters: every rule that asks for tabular figures sets them in the serif (redesign v2, step 2)', async () => {
  // the Source Sans 3 subset has no tnum, so a changing number in sans would jitter; Source Serif 4 has it
  const { deskUICSS } = await import('../desk-ui.mjs');
  const sheets = [['desk-ui.mjs', deskUICSS()], ...NEXT.tools.map((t) => [`${t.labSlug}/style.css`, readFileSync(`${root}labs/${t.labSlug}/style.css`, 'utf8')])];
  for (const [name, raw] of sheets) {
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/tabular-nums/.test(m[2])) continue;
      assert.match(m[2], /var\(--font-display\)|var\(--type-readout-font\)/, `${name}: "${m[1].trim()}" has tabular figures in the sans`);
    }
    assert.doesNotMatch(css, /font-variant-caps/, `${name} uses font-variant-caps`);
  }
});

test('the tools\' own words: heds of 12 words or fewer and no advice words in the source copy', () => {
  // the rendered H1 must equal next.json (each build checks it); here the source of every public tool: h1, h2, the lede
  // and dek, the readout labels and the assumptions line carry no "should", "best for you" or "recommend", and a typed
  // hed or section hed stays within 12 words
  const ADVICE = /\b(should|recommend\w*)\b|\bbest for you\b/i;
  const plain = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  for (const t of NEXT.tools) {
    const src = readFileSync(`${root}labs/${t.labSlug}/index.src.html`, 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '');
    const parts = [
      ...[...src.matchAll(/<(h1|h2)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => ({ hed: true, text: plain(m[2]) })),
      ...[...src.matchAll(/<(\w+)\b[^>]*class="[^"]*\b(lede|dek|readout-k|readout-t|assume)\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => ({ hed: false, text: plain(m[3]) })),
    ];
    for (const p of parts) {
      assert.doesNotMatch(p.text, ADVICE, `${t.labSlug}: advice words in "${p.text}"`);
      if (p.hed) assert.ok(p.text.split(/\s+/).filter(Boolean).length <= 12, `${t.labSlug}: the hed "${p.text}" is over 12 words`);
    }
  }
});
