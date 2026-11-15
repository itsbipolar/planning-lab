// The listed flag (next.json "listed": false): an unlisted tool is built and live, keeps its own Up next and a normal tool
// bar, but is nobody's Up next and carries noindex; the doors to it follow its own next. One resolver (resolvedNext)
// writes listed and to for the site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { NEXT, effectiveNext, resolvedNext, isListed, toolFor } from '../desk-page.mjs';

const root = new URL('../../../', import.meta.url).pathname;
const flipped = () => ({ ...NEXT, tools: NEXT.tools.map((t) => (t.slug === 'estate-freeze' ? { ...t, listed: true } : t)) });
// Listed since 2026-11-15 (Mo: "Assume you are the only compliance checked and that the firm approved it, then list the freeze"); the unlisted case is kept as a test on a copy.
const unlisted = () => ({ ...NEXT, tools: NEXT.tools.map((t) => (t.slug === 'estate-freeze' ? { ...t, listed: false } : t)) });

test('while estate-freeze is unlisted, its doors lead past it to its own next', () => {
  const d = unlisted();
  const ef = d.tools.find((t) => t.slug === 'estate-freeze');
  assert.equal(isListed(ef), false);
  assert.equal(effectiveNext('estate-freeze', d).slug, 'tax-dates');
  assert.equal(effectiveNext(d.tools.find((t) => t.slug === 'money-then-now').next, d).slug, 'tax-dates');
  assert.equal(effectiveNext(d.films['double-tax-at-death'].next, d).slug, 'tax-dates');
  const r = resolvedNext(d);
  assert.equal(r.tools.find((t) => t.slug === 'money-then-now').to, 'tax-dates');
  assert.equal(r.films['double-tax-at-death'].to, 'tax-dates');
  assert.equal(r.tools.find((t) => t.slug === 'estate-freeze').listed, false);
  assert.equal(r.tools.find((t) => t.slug === 'estate-freeze').to, 'tax-dates', 'it keeps its own Up next');
});

test('estate-freeze is listed (Mo, 2026-11-15)', () => {
  assert.equal(isListed(NEXT.tools.find((t) => t.slug === 'estate-freeze')), true);
});

test('flipping the one flag makes it the next of Money, then and now and of the double-tax film', () => {
  const d = flipped();
  assert.equal(effectiveNext('money-then-now', d).slug, 'money-then-now');
  assert.equal(effectiveNext(d.tools.find((t) => t.slug === 'money-then-now').next, d).slug, 'estate-freeze');
  assert.equal(effectiveNext(d.films['double-tax-at-death'].next, d).slug, 'estate-freeze');
  const r = resolvedNext(d);
  assert.equal(r.tools.find((t) => t.slug === 'money-then-now').to, 'estate-freeze');
  assert.equal(r.films['double-tax-at-death'].to, 'estate-freeze');
  assert.ok(r.tools.every((t) => t.listed === true));
});

test('the resolver guards against a loop and an unknown slug', () => {
  const loop = { tools: [{ slug: 'a', next: 'b', listed: false }, { slug: 'b', next: 'a', listed: false }], films: {} };
  assert.throws(() => effectiveNext('a', loop), /loop/);
  assert.throws(() => effectiveNext('nope'), /not a tool/);
});

test('resolvedNext writes listed and to on every tool and to on every film, each a listed tool', () => {
  const r = resolvedNext(), listed = new Set(r.tools.filter((t) => t.listed).map((t) => t.slug));
  for (const t of r.tools) { assert.equal(typeof t.listed, 'boolean'); assert.ok(listed.has(t.to), `${t.slug} -> ${t.to}`); }
  for (const [k, f] of Object.entries(r.films)) assert.ok(listed.has(f.to), `${k} -> ${f.to}`);
});

test('no other lab links to an unlisted tool, and the unlisted tool carries noindex', () => {
  for (const t of NEXT.tools.filter((x) => !isListed(x))) {
    const own = readFileSync(`${root}labs/${t.labSlug}/dist/index.html`, 'utf8');
    assert.match(own, /<meta name="robots" content="noindex">/);
    for (const lab of readdirSync(`${root}labs`)) {
      if (lab === t.labSlug || lab.startsWith('_')) continue;
      const f = `${root}labs/${lab}/dist/index.html`;
      if (!existsSync(f)) continue;
      assert.ok(!readFileSync(f, 'utf8').includes(`href="/tools/${t.slug}/"`), `${lab} links to the unlisted ${t.slug}`);
    }
  }
  // a listed tool's page has no added noindex from the flag (its own page may already carry one)
  assert.ok(toolFor('two-number-letter') && !readFileSync(`${root}labs/two-number-letter/dist/index.html`, 'utf8').includes('<meta name="robots" content="noindex">'));
});
