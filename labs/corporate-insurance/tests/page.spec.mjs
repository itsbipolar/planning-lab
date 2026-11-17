import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes, expectTemplate, expectReducedMotion } from '../../../shared/desk/shell-test.mjs';
import { toolFor, questionOf } from '../../../shared/desk/desk-page.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXAMPLE, BOUNDS, insuranceRules, split, money, pct2, per100, cents } from '../model.mjs';
import { BANNED } from './words.mjs';

// The read-left-to-right pass (SPEC.md, "Read left to right (2026-11-17)"): one picture that is also the control, one
// answer, at most 60 words above Go deeper, the four readings fixed at the bar's ends, everything else inside Go deeper.
const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const R = insuranceRules(JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts);
const S = split(R, EXAMPLE);
const PAY = EXAMPLE.payout, STEP = BOUNDS.acb.step;
// the states the picture is checked at: $0, one step, the example, half, one step short of the payout, the payout
const STATES = [0, STEP, EXAMPLE.acb, PAY / 2, PAY - STEP, PAY];

// set the cost base on the range, as a key or a tap would (the page eases it over 160ms; wait for it to settle)
async function setAcb(page, acb) {
  await page.locator('#acb').evaluate((r, v) => { r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, acb);
  await page.waitForTimeout(260);
}
async function openAll(page) {
  const closed = page.locator('details:not([open]) > summary');
  while (await closed.count()) await closed.first().click();
}
// every visible label in a picture, as page boxes; no two may overlap or leave the page
async function clashes(page, sel = '#chart') {
  const boxes = await page.evaluate((sel) => {
    const out = [];
    for (const t of document.querySelectorAll(sel + ' text')) if (t.textContent.trim() && t.checkVisibility()) { const b = t.getBoundingClientRect(); out.push([b.left, b.top, b.width, b.height, t.textContent]); }
    return out;
  }, sel);
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    if (a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1) out.push(`${a[4]} / ${b[4]}`);
  }
  const vw = page.viewportSize().width;
  for (const b of boxes) if (b[0] < -0.5 || b[0] + b[2] > vw + 0.5) out.push(`${b[4]} is off the page`);
  return out;
}
// the picture's geometry in page pixels: the bar (income tax, hatched part, solid capital dividend), the four spans,
// the four readings, the handle's rule and the range's thumb centre
async function geometry(page) {
  return page.evaluate(() => {
    const box = (s) => { const e = document.querySelector(s); if (!e || !e.checkVisibility() || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top + scrollY, b: r.bottom + scrollY, w: r.width }; };
    const svg = document.querySelector('#chart').getBoundingClientRect();
    const rng = document.querySelector('#acb'), ri = rng.getBoundingClientRect();
    const f = (Number(rng.value) - Number(rng.min)) / (Number(rng.max) - Number(rng.min));
    const rule = box('#chart .handle-rule');
    return {
      svgL: svg.left, svgR: svg.right, svgH: svg.height, cap: box('#chart .seg.p-cap'), after: box('#chart .seg.p-after'), tax: box('#chart .seg.p-tax'),
      bAcb: box('#chart .b-acb'), bCap: box('#chart .b-cap'), bTax: box('#chart .b-tax'), bFam: box('#chart .b-fam'),
      reads: Object.fromEntries(['acb', 'cap', 'tax', 'fam'].map((k) => { const r = document.querySelector(`#chart .rd[data-key="${k}"]`).getBoundingClientRect(); return [k, { l: r.left, r: r.right, t: r.top + scrollY, b: r.bottom + scrollY }]; })),
      thumb: ri.left + 14 + f * (ri.width - 28), handle: rule ? (rule.l + rule.r) / 2 : null,
    };
  });
}
const lum = (rgb) => { const c = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { v = Number(v) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const wordsOf = (s) => String(s).split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t));

// the words above Go deeper (SPEC.md §3): every visible text node in <main> above the Go deeper summary, plus the
// summary itself; not the picture (SVG), not .desk-sr, not the inside of a closed fold
function countAbove() {
  const main = document.querySelector('main'), sum = document.querySelector('details.deeper > summary');
  const top = sum.getBoundingClientRect().top;
  let n = 0; const w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const e = t.parentElement; if (!e || e.closest('svg, .pic, .desk-sr, script')) continue;
    const d = e.closest('details'); if (d && !d.open && !e.closest('summary')) continue;
    if (!e.checkVisibility()) continue;
    const r = document.createRange(); r.selectNodeContents(t); const rc = r.getBoundingClientRect(); if (!rc.height) continue;
    if (rc.top > top + 1 && !sum.contains(e)) continue;
    n += t.textContent.split(/\s+/).filter((x) => /[\p{L}\p{N}]/u.test(x)).length;
  }
  return n;
}

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 900 } });

    test('the tool shell, unlisted: tool bar, one Up next, noindex; nothing stored; no request after load', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expectShell(page, 'corporate-insurance');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      await expect(page.locator('a[data-next]')).toHaveAttribute('href', '/tools/tax-dates/');
      await page.locator('#acb').focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('PageUp');
      for (const d of await page.locator('details summary').all()) await d.click();
      await expectStorageClean(page);
      expect(page.url()).toBe(url);
      expect(requests).toEqual([]);
      // no save, print or share, and no amber action
      await expect(page.locator('#print, #card, .btn-you, .save-row')).toHaveCount(0);
    });

    test('the desk template budgets pass, and reduced motion makes every change instant', async ({ page }) => {
      await page.goto(url);
      const m = await expectTemplate(page);
      if (width === 390) expect(m.deeperTop).toBeLessThanOrEqual(1200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'no sideways scroll').toBeLessThanOrEqual(0);
      const now = await expectReducedMotion(page, async (p) => { await p.locator('#acb').focus(); await p.keyboard.press('ArrowRight'); });
      expect(now).toContain(money(split(R, { ...EXAMPLE, acb: EXAMPLE.acb + STEP }).family));
    });

    test('opens on the labelled example: the question, the answer, the picture and its four readings', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('h1')).toHaveText(questionOf(toolFor('corporate-insurance')));
      await expect(page.locator('.play .kicker')).toHaveText('Tool');
      await expect(page.locator('#lede')).toHaveText('A made-up owner dies; the company receives $1,000,000.');
      await expect(page.locator('#acb')).toHaveAttribute('aria-valuetext', '$200,000, an example');
      await expect(page.locator('#acb')).toHaveAttribute('aria-label', 'The policy’s cost base');
      await expect(page.locator('#acb')).toHaveAttribute('max', String(PAY));
      await expect(page.locator('#acb-sr')).toHaveText('The policy’s adjusted cost basis under the Income Tax Act; the payout less it can go out as a capital dividend.');
      await expect(page.locator('#answer-k')).toHaveText('Reaches the family');
      await expect(page.locator('#answer-v')).toHaveText(money(S.family));
      await expect(page.locator('#answer-v')).toHaveText('$904,520');
      await expect(page.locator('#answer-t')).toHaveText('Paid out now, the $200,000 cost base is a taxable dividend.');
      await expect(page.locator('#answer details')).toHaveCount(0);
      await expect(page.locator('#assume')).toHaveText(`Hypothetical illustration · Education, not advice. Ontario, ${R.rateYear} top rates.`);
      await expect(page.locator('#ins-chart .tag-example')).toBeVisible();
      // what the handle is and what moves it, in plain words, under the picture
      await expect(page.locator('#hint')).toHaveText(R.acbRule ? 'Drag the cost base. Premiums raise it; the insurance’s cost lowers it.' : 'Drag the policy’s cost base.');
      // over the bar, the payout split at the handle; under it, where the money goes
      const read = (k) => page.locator(`#chart .rd[data-key="${k}"]`);
      await expect(read('acb')).toHaveText(/^\$200,000\s?cost base$/);
      await expect(read('cap')).toHaveText(/^\$800,000\s?tax-free capital dividend$/);
      await expect(read('tax')).toHaveText(/^\$95,480\s?the family’s income tax$/);
      await expect(read('fam')).toHaveText(/^\$904,520\s?to the family$/);
      await expect(page.locator('#chart')).not.toContainText('comparison');
      await expect(page.locator('#chart-table-rows tr')).toHaveCount(3);
      for (const v of ['$800,000', '$104,520', '$95,480']) await expect(page.locator('#chart-table-rows')).toContainText(v);
    });

    test('word budget: 60 words or fewer above Go deeper; the picture says 16 words or fewer', async ({ page }) => {
      await page.goto(url);
      if (width === 390) {
        const n = await page.evaluate(countAbove);
        expect(n, 'words above the Go deeper summary').toBeLessThanOrEqual(60);
        // the counter can fail: a planted paragraph above the fold breaks the budget
        await page.evaluate(() => { const p = document.createElement('p'); p.id = 'planted'; p.textContent = 'one two three four five six seven eight nine ten eleven twelve'; document.querySelector('#lede').after(p); });
        expect(await page.evaluate(countAbove)).toBeGreaterThan(60);
        await page.evaluate(() => document.querySelector('#planted').remove());
      }
      // the picture's four readings: 16 words or fewer, figures not counted
      for (const acb of STATES) {
        await setAcb(page, acb);
        const text = await page.evaluate(() => [...document.querySelectorAll('#chart text')].map((t) => t.textContent).join(' '));
        expect(wordsOf(text).filter((w) => /\p{L}/u.test(w)).length, `${acb}: ${text}`).toBeLessThanOrEqual(16);
      }
    });

    test('above Go deeper: only the kicker, the question, the lede, the answer, the picture and the assumptions', async ({ page }) => {
      await page.goto(url);
      const blocks = await page.evaluate(() => {
        const deeper = document.querySelector('details.deeper'), out = [];
        for (const e of document.querySelectorAll('main *')) {
          if (!(e.compareDocumentPosition(deeper) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
          if (e.closest('.readout, figure, .assume, h1')) continue;
          if (e.matches('.play, .stage')) continue;
          out.push(e.matches('.kicker') ? 'kicker' : e.matches('#lede') ? 'lede' : e.tagName.toLowerCase() + (e.id ? '#' + e.id : ''));
        }
        const named = ['.kicker', 'h1', '#lede', '[data-answer]', 'figure#ins-chart', '[data-assumptions]'].map((s) => document.querySelector(s));
        const inOrder = named.every((e, i) => i === 0 || (named[i - 1].compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING));
        return { out, inOrder };
      });
      expect(blocks.out).toEqual(['kicker', 'lede']);
      expect(blocks.inOrder).toBe(true);
      // gone: the ledger, the stepper, the echo, Back to the example, the clamp note, the help line, the tooltip
      await expect(page.locator('#sum, #sum-sr, #steppers, #echo, #reset, #clamp, .help, #chart .seg-read, #chart-title, #chart-sub, #acb-out, #chart .slot, #chart .bite')).toHaveCount(0);
      await expect(page.locator('#chart')).not.toHaveAttribute('tabindex', /.*/);
    });

    test('the geometry of the first screen', async ({ page }) => {
      await page.goto(url);
      const y = (s, k) => page.evaluate(([s, k]) => document.querySelector(s).getBoundingClientRect()[k] + scrollY, [s, k]);
      const g = await geometry(page);
      const labelsBottom = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#chart text')].map((t) => t.getBoundingClientRect().bottom + scrollY)));
      if (width === 390) {
        expect(await y('#answer-v', 'bottom'), 'the big figure').toBeLessThanOrEqual(620);
        expect(await y('[data-first-move]', 'top'), 'the control').toBeLessThanOrEqual(700);
        // the site's link walk (tests/e2e/indexes.spec.ts) wants 48px of the control above y = 700 on the site's copy;
        // this keeps 15px or more in hand, so a small change to the tool bar or the fonts does not tip it over
        const fm = await page.evaluate(() => { const r = document.querySelector('[data-first-move]').getBoundingClientRect(); return r.top + scrollY + Math.min(r.height, 48); });
        expect(fm, 'the control: its first 48px above y = 685').toBeLessThanOrEqual(685);
        expect(g.cap.t, 'the bar').toBeLessThanOrEqual(720);
        expect(labelsBottom, 'the last reading').toBeLessThanOrEqual(844);
      } else {
        // the whole picture, readings included, in the first screen, in the right-hand columns beside the question
        expect(await y('#chart', 'bottom')).toBeLessThanOrEqual(900);
        expect(labelsBottom).toBeLessThanOrEqual(900);
        const h1 = await page.locator('h1').boundingBox(), fig = await page.locator('#ins-chart').boundingBox(), ans = await page.locator('#answer').boundingBox();
        expect(fig.x).toBeGreaterThanOrEqual(h1.x + h1.width - 1);
        expect(ans.x).toBeGreaterThanOrEqual(h1.x + h1.width - 1);
        expect(ans.y).toBeLessThan(h1.y + h1.height);
        expect(fig.y).toBeGreaterThan(ans.y);
      }
    });

    test('the handle sits on the boundary; the spans show the cost base, the capital dividend, the tax and the family', async ({ page }) => {
      await page.goto(url);
      for (const acb of STATES) {
        await setAcb(page, acb);
        const s = split(R, { payout: PAY, acb }), g = await geometry(page), W = g.svgR - g.svgL, X = (v) => g.svgL + v / PAY * W;
        // the boundary: the left edge of the solid part (less half the 2px gap), or the bar's ends
        const edge = s.state === 'noCost' ? g.svgL : s.state === 'allCost' ? g.svgR : g.cap.l - 1;
        expect(Math.abs(g.thumb - edge), `${acb}: the thumb's centre`).toBeLessThanOrEqual(1);
        expect(Math.abs(g.handle - edge), `${acb}: the drawn handle`).toBeLessThanOrEqual(1);
        // the income tax is the bar's left part, its width the tax; the family's money runs from it to the end
        if (s.tax > 0) {
          expect(Math.abs((g.tax.w + 1) - s.tax / PAY * W), `${acb}: the tax part's width is the tax`).toBeLessThanOrEqual(1.5);
          expect(Math.abs(g.tax.l - g.svgL)).toBeLessThanOrEqual(1);
          const runL = s.afterTax > 0 ? g.after.l : g.cap.l;
          expect(runL - g.tax.r, `${acb}: the family's money starts at the tax`).toBeGreaterThanOrEqual(1);
          expect(runL - g.tax.r).toBeLessThanOrEqual(2.5);
          // the spans under the bar: the tax under the tax, the family from there to the end
          // (a tax a few pixels wide has no room for a span of its own; its reading still says it)
          if (s.tax / PAY * W >= 6) {
            expect(Math.abs(g.bTax.l - g.svgL)).toBeLessThanOrEqual(2);
            expect(Math.abs(g.bTax.r - X(s.tax))).toBeLessThanOrEqual(3);
          }
          expect(Math.abs(g.bFam.l - runL)).toBeLessThanOrEqual(2);
        } else {
          expect(g.tax, `${acb}: no tax part with no tax`).toBeNull();
          expect(g.bTax).toBeNull();
        }
        expect(Math.abs(g.bFam.r - g.svgR)).toBeLessThanOrEqual(2);
        // the spans over the bar: the cost base from the bar's start to the handle, the capital dividend from it to the end
        // (a span a few pixels wide is left out; the reading over it still says the figure)
        if (acb / PAY * W >= 8) { expect(Math.abs(g.bAcb.l - g.svgL)).toBeLessThanOrEqual(2); expect(Math.abs(g.bAcb.r - X(acb))).toBeLessThanOrEqual(4); }
        if (acb === 0) expect(g.bAcb).toBeNull();
        if (s.capDiv / PAY * W >= 8) { expect(Math.abs(g.bCap.l - X(acb))).toBeLessThanOrEqual(4); expect(Math.abs(g.bCap.r - g.svgR)).toBeLessThanOrEqual(2); }
        if (s.capDiv === 0) expect(g.bCap).toBeNull();
        if (s.state === 'allCost') expect(g.cap).toBeNull();
        if (s.state === 'noCost') { expect(g.after).toBeNull(); expect(g.cap.w).toBeGreaterThanOrEqual(W - 1); }
        // the readings say the state
        for (const [k, v] of [['acb', acb], ['cap', s.capDiv], ['tax', s.tax], ['fam', s.family]]) await expect(page.locator(`#chart .rd[data-key="${k}"] .rd-v`)).toHaveText(money(v));
      }
    });

    test('nothing jumps while the handle moves: the readings, the picture and the answer keep their places', async ({ page }) => {
      await page.goto(url);
      const where = () => page.evaluate(() => ({
        reads: [...document.querySelectorAll('#chart .rd')].map((t) => { const r = t.getBoundingClientRect(); return [Math.round(r.top + scrollY), t.getAttribute('text-anchor') === 'end' ? Math.round(r.right) : Math.round(r.left)]; }),
        svgH: document.querySelector('#chart').getBoundingClientRect().height,
        bar: Math.round(document.querySelector('#acb').getBoundingClientRect().top + scrollY),
        deeper: Math.round(document.querySelector('#deeper > summary').getBoundingClientRect().top + scrollY),
      }));
      const first = await where();
      for (const acb of STATES) {
        await setAcb(page, acb);
        const now = await where();
        expect(now.svgH, `${acb}: the picture's height`).toBe(first.svgH);
        expect(now.bar, `${acb}: the control`).toBe(first.bar);
        expect(now.deeper, `${acb}: Go deeper`).toBe(first.deeper);
        for (let i = 0; i < first.reads.length; i++) {
          expect(Math.abs(now.reads[i][0] - first.reads[i][0]), `${acb}: reading ${i} top`).toBeLessThanOrEqual(1);
          expect(Math.abs(now.reads[i][1] - first.reads[i][1]), `${acb}: reading ${i} pinned end`).toBeLessThanOrEqual(1);
        }
      }
    });

    test('the three states, by keyboard and page steps', async ({ page }) => {
      await page.goto(url);
      await page.locator('#acb').focus();
      const acbRead = page.locator('#chart .rd[data-key="acb"] .rd-v');
      await page.keyboard.press('ArrowRight');
      await expect(acbRead).toHaveText('$210,000');
      await page.keyboard.press('PageUp');
      await expect(acbRead).toHaveText('$310,000');
      await expect(page.locator('#answer-v')).toHaveText(money(split(R, { payout: PAY, acb: 310000 }).family));
      await page.keyboard.press('Home');
      await expect(page.locator('#answer-v')).toHaveText('$1,000,000');
      await expect(page.locator('#answer-t')).toHaveText('No cost base: all of it can be a capital dividend.');
      await page.keyboard.press('End');
      await expect(page.locator('#answer-v')).toHaveText(money(split(R, { payout: PAY, acb: PAY }).family));
      await expect(page.locator('#answer-t')).toHaveText('Paid out now, the whole payout is a taxable dividend.');
      for (const t of ['No cost base: all of it can be a capital dividend.', 'Paid out now, the whole payout is a taxable dividend.', 'Paid out now, the $200,000 cost base is a taxable dividend.']) expect(wordsOf(t).length).toBeLessThanOrEqual(12);
      await expectStorageClean(page);
    });

    test('a drag moves the answer, the cost base reading and the description together', async ({ page }) => {
      await page.goto(url);
      const g = await geometry(page), box = await page.locator('#acb').boundingBox();
      const cy = box.y + box.height / 2, x1 = g.svgL + (g.svgR - g.svgL) * 0.6;
      await page.mouse.move(g.thumb, cy);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(g.thumb + (x1 - g.thumb) * i / 8, cy);
      await page.mouse.up();
      await page.waitForTimeout(260);
      const v = Number(await page.locator('#acb').inputValue());
      expect(Math.abs(v - PAY * 0.6)).toBeLessThanOrEqual(STEP * 2);
      const s = split(R, { payout: PAY, acb: v });
      await expect(page.locator('#answer-v')).toHaveText(money(s.family));
      await expect(page.locator('#chart .rd[data-key="acb"] .rd-v')).toHaveText(money(v));
      const desc = await page.locator('#chart-desc').textContent();
      for (const x of [s.capDiv, s.afterTax, s.tax, s.family, v]) expect(desc).toContain(money(x));
      const after = await geometry(page);
      expect(Math.abs(after.thumb - (after.cap.l - 1))).toBeLessThanOrEqual(1);
    });

    test('no two labels in the picture overlap and none leaves the page, in both schemes', async ({ page }) => {
      await page.goto(url);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        for (const acb of STATES) {
          await setAcb(page, acb);
          expect(await clashes(page), `${theme}, ${acb}`).toEqual([]);
        }
      }
    });

    test('no money figure wraps inside itself', async ({ page }) => {
      await page.goto(url);
      for (const acb of [0, PAY / 2, PAY]) {
        await setAcb(page, acb);
        await openAll(page);
        const wrapped = await page.evaluate(() => [...document.querySelectorAll('#answer-v, #nums td, #nums th')]
          .filter((e) => e.checkVisibility() && e.getClientRects().length > 1).map((e) => e.textContent));
        expect(wrapped, String(acb)).toEqual([]);
        const chartLines = await page.locator('#chart .rd-v, #trend .rd-v').evaluateAll((ts) => ts.map((t) => t.getNumberOfChars() && t.getExtentOfChar(0).y === t.getExtentOfChar(t.getNumberOfChars() - 1).y));
        expect(chartLines.every(Boolean)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      }
    });

    test('the answer says what the picture’s description says', async ({ page }) => {
      await page.goto(url);
      const desc = await page.locator('#chart-desc').textContent();
      const said = await page.locator('#answer').evaluate((a) => a.textContent);
      for (const v of [S.capDiv, S.afterTax, S.tax, S.family, S.inp.payout, S.inp.acb]) expect(desc).toContain(money(v));
      for (const v of [S.family, S.inp.acb]) expect(said).toContain(money(v));
      await expect(page.locator('#answer')).toHaveAttribute('aria-live', 'polite');
    });

    test('colour by data type: each part, the handle and the cost base span reach 3:1 against the ground, in both schemes', async ({ page }) => {
      await page.goto(url);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        const c = await page.evaluate(() => {
          const g = getComputedStyle(document.body).backgroundColor, f = (s, p) => getComputedStyle(document.querySelector(s))[p];
          return { g, cap: f('#chart .seg.p-cap', 'fill'), tax: f('#chart .seg.p-tax', 'fill'), hatch: f('#chart .hatch-line', 'stroke'), edge: f('#chart .seg-edge', 'stroke'), handle: f('#chart .handle-rule', 'fill'), acbSpan: f('#chart .b-acb', 'stroke') };
        });
        for (const k of ['cap', 'tax', 'hatch', 'edge', 'handle', 'acbSpan']) expect(ratio(c[k], c.g), `${theme} ${k}`).toBeGreaterThanOrEqual(3);
        // the parts are separated by a gap of the ground, so each edge reads against the ground
        const gap = await page.evaluate(() => { const a = document.querySelector('#chart .seg.p-after').getBoundingClientRect(), b = document.querySelector('#chart .seg.p-cap').getBoundingClientRect(); return b.left - a.right; });
        expect(gap).toBeGreaterThanOrEqual(1.5);
      }
    });

    test('Go deeper holds the rest: the trend picture, steps, rates, the 2027 note, the Act, the numbers, every assumption', async ({ page }) => {
      await page.goto(url);
      const deeper = page.locator('#deeper');
      await expect(deeper).not.toHaveAttribute('open', '');
      await expect(page.locator('#deeper .deeper-in')).toHaveText('Chart, steps, assumptions');
      // while closed, all of it is inside the fold and nothing of it is drawn
      for (const s of ['#trend', '#steps', '#how', '#div-lines', '#year-line', '#acb-rule', '#acb-help', '#elect', '#nums', '#caveats']) {
        expect(await page.locator(s).evaluate((e) => !!e.closest('details.deeper')), s).toBe(true);
        await expect(page.locator(s)).toBeHidden();
      }
      await expect(page.locator('#steps li')).toHaveCount(3);
      await expect(page.locator('#caveats .cv-group')).toHaveCount(3);
      await expect(page.locator('#caveats li')).toHaveCount(20);
      await expect(page.locator('#caveats')).not.toContainText('permanent');
      // the professional pointer stays outside every fold
      await expect(page.locator('#close-line')).toBeVisible();
      await expect(page.locator('#close-line')).toHaveText('How any of this applies to a real company is a question for a tax professional and a lawyer.');
      expect(await page.locator('#close-line').evaluate((e) => !e.closest('details') && !!(document.querySelector('#deeper').compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);

      await page.locator('#deeper > summary').click();
      // first, a picture: what reaches the family as the cost base runs from $0 to the payout, with the state now on it
      await expect(page.locator('#trend-h')).toHaveText('A bigger cost base, less to the family');
      await expect(page.locator('#trend')).toContainText(`${money(S.family)} now`);
      await expect(page.locator('#trend')).toContainText(money(PAY));
      expect(await clashes(page, '#trend')).toEqual([]);
      for (const acb of [0, PAY / 2, PAY]) { await setAcb(page, acb); expect(await clashes(page, '#trend'), String(acb)).toEqual([]); }
      await setAcb(page, EXAMPLE.acb);
      await expect(page.locator('#trend-desc')).toContainText(money(split(R, { payout: PAY, acb: PAY }).family));
      await expect(page.locator('#steps-h')).toHaveText('Step by step');
      await expect(page.locator('#steps li').first()).toContainText('The payout.');
      // In this example's numbers: the steps, the rate in its facts, the one CDA in its abbr
      await expect(page.locator('#how li')).toHaveText([
        'Into the capital dividend account (CDA): payout $1,000,000 − the policy’s cost base $200,000 = $800,000.',
        'Elected as a capital dividend: $800,000, not counted in the family’s income.',
        `The cost base part, $200,000, paid out now as a taxable dividend: income tax $200,000 × ${pct2(R.rate)} = $95,480 (to the dollar), leaving $104,520.`,
        'The family receives $800,000 + $104,520 = $904,520 of the $1,000,000.',
      ]);
      await expect(page.locator('#how abbr[title="capital dividend account"]')).toHaveText('CDA');
      for (const id of [R.ids.fedTop, R.ids.onDTC, R.ids.grossUp]) await expect(page.locator(`#how [data-fact~="${id}"]`)).toBeVisible();
      const L = per100(R);
      await expect(page.locator('#div-total')).toHaveText(cents(L.total));
      const shown = (await page.locator('#div-lines li').last().textContent()).match(/\$[\d.]+/g).map((s) => Number(s.slice(1)));
      expect(Math.abs(shown[0] - shown[1] + shown[2] + shown[3] - shown[4] - shown[5])).toBeLessThanOrEqual(0.02);
      for (const id of [R.ids.grossUp, R.ids.fedDTC, R.ids.onDTC, R.ids.fedTop, R.ids.onTop, R.ids.surtax]) await expect(page.locator(`#div-lines [data-fact~="${id}"]`).first()).toBeVisible();
      await expect(page.locator('#div-lines')).toContainText(`in ${R.rateYear} is ${pct2(R.rate)}`);
      await expect(page.locator('#year-line')).toContainText(`Rates for ${R.rateYear}: the latest year with every figure published.`);
      if (R.onDTCLater) {
        await expect(page.locator('#year-line')).toContainText(`The Ontario dividend credit is already set lower from ${R.onDTCLater.year}, so with other rates unchanged the tax on the taxable part would be higher then.`);
        await expect(page.locator(`#year-line [data-fact="${R.onDTCLater.id}"]`)).toBeVisible();
      }
      await expect(page.locator('#acb-help')).toHaveText('The cost base is the policy’s adjusted cost basis under the Income Tax Act. The payout less it is what can go out as a capital dividend. Among other things, premiums raise it and the net cost of pure insurance lowers it.');
      await expect(page.locator('#acb-rule')).toContainText('section 148(9)');
      await expect(page.locator('#acb-rule')).toContainText('this tool does not estimate it');
      // the rules in the Act's own words: a plain-words line, then the fact's value as a quotation, then its source
      if (R.acbRule) {
        await expect(page.locator('#acb-rule > p').first()).toHaveText(/^In plain words: /);
        await expect(page.locator(`#acb-rule blockquote[data-fact="${R.ids.acbRule}"]`)).toHaveText(R.text.acbRule.value);
      }
      await expect(page.locator('#elect > p').first()).toHaveText(/^In plain words: /);
      await expect(page.locator(`#elect blockquote[data-fact="${R.ids.election}"]`)).toHaveText(R.text.election.value);
      await expect(page.locator('#elect .rule-src a')).toHaveAttribute('href', R.text.election.source_url);
      await expect(page.locator('#elect')).toContainText('Section 83(2)');
      await expect(page.locator('#elect')).toContainText('An election larger than the account has consequences of its own');
      await expect(page.locator('#elect')).toContainText('are left out here');
      await expect(page.locator('#nums-head th')).toHaveText(['Cost base', 'Income tax', 'Reaches the family']);
      await expect(page.locator('#nums-rows tr')).toHaveCount(6);
      await expect(page.locator('#nums-rows tr.now')).toContainText('$200,000');
      await expect(page.locator('#nums-rows tr.now')).toContainText('$904,520');
      // three columns: nothing to swipe, even on a phone
      expect(await page.locator('#nums-wrap').evaluate((w) => w.scrollWidth > w.clientWidth + 1)).toBe(false);
      await expect(page.locator('#nums-cap')).not.toContainText('Swipe');
      await expect(page.locator('#caveats')).toBeVisible();

      await page.locator('.sources-fold summary').click();
      for (const f of R.used) await expect(page.locator(`#sources a[href="${f.source_url}"]`).first()).toBeAttached();
      // each source line once
      const lines = await page.locator('#sources li').allTextContents();
      expect(new Set(lines).size, lines.join(' | ')).toBe(lines.length);
      // the version is said once, in Sources (not again in the footer)
      expect(await page.evaluate(() => (document.body.innerText.match(/Version [0-9a-f]{8}/g) || []).length)).toBe(1);
      expect(await page.locator('#sources a').evaluateAll((as) => as.map((a) => new URL(a.href).host).filter((h) => !/(^|\.)(canada\.ca|ontario\.ca|gc\.ca)$/.test(h)))).toEqual([]);
      await expect(page.locator('#sources')).toContainText(/Version [0-9a-f]{8} · rates for \d{4} · made in this browser; nothing was sent\./);
      await expect(page.locator('#sources')).toContainText('reference data, verify at the source');
    });

    test('the page’s words at run time: no advice or sales words; "tax-free" only beside "capital dividend"', async ({ page }) => {
      await page.goto(url);
      for (const acb of [EXAMPLE.acb, 0, PAY]) {
        await setAcb(page, acb);
        await openAll(page);
        const units = await page.evaluate(() => [...document.querySelectorAll('main p, main li, main th, main td, main summary, main output, #chart text')]
          .filter((e) => e.checkVisibility() && !e.closest('.desk-next')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
        const all = units.join(' | ');
        expect(all).not.toMatch(BANNED);
        expect(units.flatMap((u) => u.split(/(?<=[.!?])\s+/)).filter((s) => /tax-free/i.test(s) && !/capital dividend/i.test(s))).toEqual([]);
        expect(all.match(/\bCDA\b/g) || []).toHaveLength(1);
      }
    });

    test('every piece of text renders at 17.5px or more, both pictures included, in both schemes', async ({ page }) => {
      await page.goto(url);
      await expectTextSizes(page);
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      for (const acb of [STEP, PAY - STEP, PAY]) { await setAcb(page, acb); await expectTextSizes(page); }
      for (const d of await page.locator('details summary').all()) await d.click();
      await expectTextSizes(page);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await page.locator('#acb').focus(); await page.keyboard.press('ArrowRight');
        for (const d of await page.locator('details summary').all()) await d.click();
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
      });
    }
  });
}

// on a phone the whole bar is the control: a tap moves the boundary there
test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('a tap on the bar moves the boundary there', async ({ page }) => {
    await page.goto(url);
    const box = await page.locator('#acb').boundingBox(), g = await geometry(page);
    await page.touchscreen.tap(g.svgL + (g.svgR - g.svgL) * 0.7, box.y + box.height / 2);
    await page.waitForTimeout(260);
    const v = Number(await page.locator('#acb').inputValue());
    expect(Math.abs(v - PAY * 0.7)).toBeLessThanOrEqual(STEP * 2);
    await expect(page.locator('#answer-v')).toHaveText(money(split(R, { payout: PAY, acb: v }).family));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
});
