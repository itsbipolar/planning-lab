// Every word on every reel card stays inside the band the phone apps leave clear: below the top bar,
// above the caption area and left of the button rail (FORMATS.reel). Measured on the rendered text, in Chromium.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { ROOT, loadFacts, loadReel, resolve, loadDataModel } from '../lib.mjs';

const REELS = ['history-45', 'money-year'];
const modelOf = async (name) => { const r = loadReel(join(ROOT, 'reels', name)), f = loadFacts(); return resolve(r, f, await loadDataModel(r, f)); };
import { cardHTML, cardCSS, fontFaces, FORMATS } from '../cards.mjs';
import { copyFonts } from '../build.mjs';

for (const name of REELS) test(`no text on any card leaves the reel safe band: ${name}`, async () => {
  const F = FORMATS.reel;
  const m = await modelOf(name);
  const dir = mkdtempSync(join(tmpdir(), 'safe-')); copyFonts(join(dir, 'fonts'));
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: F.w, height: F.h } });
    for (const c of m.cards) {
      const f = join(dir, `${c.id}.html`);
      writeFileSync(f, `<!doctype html><meta charset="utf-8"><style>${fontFaces('fonts/')}*{margin:0;box-sizing:border-box}${cardCSS('#k', 'paper', 'reel')}</style><div id="k">${cardHTML(c, m, 'reel', 'k')}</div>`);
      await page.goto('file://' + f); await page.evaluate(() => document.fonts.ready);
      const box = await page.evaluate(() => {
        const w = document.createTreeWalker(document.querySelector('#k'), NodeFilter.SHOW_TEXT); let n, top = 1e9, bottom = 0, right = 0, left = 1e9;
        while ((n = w.nextNode())) { if (!n.textContent.trim() || n.parentElement.closest('svg')) continue;
          const r = document.createRange(); r.selectNodeContents(n);
          for (const x of r.getClientRects()) { top = Math.min(top, x.top); bottom = Math.max(bottom, x.bottom); right = Math.max(right, x.right); left = Math.min(left, x.left); } }
        return { top, bottom, right, left };
      });
      assert.ok(box.top >= F.top, `${c.id}: text starts at ${box.top}, above ${F.top}`);
      assert.ok(box.bottom <= F.h - F.bottom, `${c.id}: text reaches ${box.bottom}, into the caption area at ${F.h - F.bottom}`);
      assert.ok(box.right <= F.w - F.right, `${c.id}: text reaches x ${box.right}, under the button rail`);
      assert.ok(box.left >= F.left, `${c.id}: text starts at x ${box.left}`);
    }
  } finally { await b.close(); }
});

for (const name of REELS) test(`every carousel slide fits its 1080x1350 page: ${name}`, async () => {
  const F = FORMATS.carousel;
  const { buildCarousel } = await import('../build.mjs');
  const m = await modelOf(name);
  const dir = mkdtempSync(join(tmpdir(), 'car-'));
  const pages = buildCarousel(m, 'paper', dir);
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: F.w, height: F.h } });
    for (const p of pages) {
      await page.goto('file://' + join(dir, p)); await page.evaluate(() => document.fonts.ready);
      const bottom = await page.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n, m = 0;
        while ((n = w.nextNode())) { if (!n.textContent.trim() || n.parentElement.closest('svg')) continue; const r = document.createRange(); r.selectNodeContents(n);
          for (const x of r.getClientRects()) m = Math.max(m, x.bottom); } return m; });
      assert.ok(bottom <= F.h - F.bottom, `${p}: text reaches ${bottom}, past ${F.h - F.bottom}`);
    }
  } finally { await b.close(); }
});
