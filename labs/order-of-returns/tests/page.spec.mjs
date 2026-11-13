import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell } from '../../../shared/desk/shell-test.mjs';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SYN = 'Synthetic sequence: not historical, not a forecast.';
const ready = (page) => page.waitForFunction(() => document.body.dataset.enumMs, null, { timeout: 30000 });
const network = (u) => !/^(data|blob):/.test(u);

// every pair of text labels inside every chart: none may overlap
async function overlaps(page) {
  return page.evaluate(() => {
    const out = [];
    for (const svg of document.querySelectorAll('figure svg')) {
      const boxes = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim() && !t.closest('.crosshair')).map((t) => ({ t: t.textContent, r: t.getBoundingClientRect() }));
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r, b = boxes[j].r;
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`${svg.id}: "${boxes[i].t}" / "${boxes[j].t}"`);
      }
    }
    return out;
  });
}

test('banned phrases are nowhere on the page', () => {
  const text = readFileSync(file, 'utf8').replace(/data:[^"')]+/g, '');
  for (const re of [/safe withdrawal/i, /withdrawal rate/i, /you should/i, /\brecommend(s|ed)?\b/i, /guarantee/i, /\b(ETF|mutual fund|index fund|S&P|TSX)\b/, /\bCFP\b/, /financial (planner|advisor)/i])
    expect(text, String(re)).not.toMatch(re);
});

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the tool shell: tool bar, one Up next card, notes, share tags; no rail, nothing sticky, nothing stored', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectShell(page, 'order-of-returns');
      await expectStorageClean(page);
    });

    test('a keyboard playthrough: the finding, every order, the rescue and the RRIF lane, with nothing stored or sent', async ({ page }) => {
      const requests = [], errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => { if (network(r.url())) requests.push(r.url()); });
      await ready(page);

      // the finding leads, computed from the engine
      await expect(page.locator('h1')).toHaveText(/^Same ten years, same average return\. In one order the savings last all 25 years; in the other they run out in year 20\.$/);
      await expect(page.locator('#s-lead')).toContainText('Ruth still has');

      // no withdrawals: shuffling changes nothing
      const h = await page.locator('#h-shuffle').innerText();
      const end = h.match(/(\$[\d,]+)$/)[1];
      await page.locator('#shuffle').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      await expect(page.locator('#rv-shuffle')).toHaveText(end);
      await expect(page.locator('#s-shuffle')).toHaveText('Same ending as Ruth: with nothing taken out, the order of the years doesn’t matter.');
      await expect(page.locator('#sam-order li')).toHaveCount(10);

      // every order: 10! orders, Ruth best, Sam worst
      await expect(page.locator('#run-text')).toContainText('All 3,628,800 orders worked out in this browser');
      await expect(page.locator('#h-all')).toContainText('Ruth has the best; Sam has the worst.');
      await expect(page.locator('#s-rank')).toContainText('Deal all ten cards');

      // deal all ten by keyboard; the hand is sorted best first, so this is Ruth's order: the best of all
      for (let i = 0; i < 10; i++) { await page.locator('#hand button').first().focus(); await page.keyboard.press('Enter'); }
      await expect(page.locator('#dealt li')).toHaveCount(10);
      await expect(page.locator('#t-deal')).toContainText('Your order: the money lasts');
      await expect(page.locator('#s-rank')).toHaveText('Your order is the best of all 3,628,800 orders.');
      await expect(page.locator('#c-all text', { hasText: 'Your order' })).toHaveCount(1);
      await expect(page.locator('#s-early')).toContainText('Yours average');

      // the rescue: the solver headline, three small multiples, and scene 5's old bugs
      await expect(page.locator('#h-rescue')).toHaveText(/^Sam’s money lasts all 25 years if his first-year withdrawal is \$[\d,]+ or less$/);
      await expect(page.locator('#levers figure')).toHaveCount(3);
      await page.locator('#flex').focus(); await page.keyboard.press('Space');
      const mix = await page.locator('#s-mix').innerText();
      expect(mix).toContain('still runs out in year 20, the same year as before');
      expect(mix).toMatch(/pays out \$[\d,]+ in total, \$[\d,]+ more than before\./);
      expect(mix.match(/year 20/g).length, 'the sentence does not repeat itself').toBe(1);
      await page.locator('#flex').focus(); await page.keyboard.press('Space');
      await page.locator('#buffer').focus(); await page.keyboard.press('Space');
      await expect(page.locator('#s-mix')).toContainText('runs out in year 18, two years sooner than before (year 20)');
      await page.locator('#w').focus();
      for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
      expect(await page.locator('#w').getAttribute('aria-valuetext')).toBe('$24,500');

      // the RRIF lane: off by default; on, it states its sources and runs every order again
      await expect(page.locator('#rrif')).not.toBeChecked();
      await page.locator('#rrif').focus(); await page.keyboard.press('Space');
      await expect(page.locator('#s-rrif')).toContainText('Across all 3,628,800 orders, the RRIF is empty before the end of year 25', { timeout: 30000 });
      await expect(page.locator('#s-rr-ruth')).toContainText('the minimum takes out');
      await expect(page.locator('#s-rr-sam')).toContainText('no change');
      await expect(page.locator('#p-rrif-src a')).toHaveCount(2);

      // save the chart as an image, made in the browser
      const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#save').click()]);
      expect(dl.suggestedFilename()).toBe('order-of-returns-your-order.png');
      expect(statSync(await dl.path()).size).toBeGreaterThan(20000);

      // honest labels, no overlaps, nothing stored or sent
      for (const svg of await page.locator('figure svg').all()) await expect(svg.locator('xpath=following-sibling::figcaption')).toHaveText(SYN);
      expect(await overlaps(page)).toEqual([]);
      await expect(page.locator('footer.foot p')).toHaveCount(3);
      expect(errors).toEqual([]);
      expect(requests).toEqual([]);
      expect(page.url()).toBe(url);
      await expectStorageClean(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}, with every chart drawn and the RRIF lane on`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
        await ready(page);
        await page.click('#random');
        await page.check('#rrif');
        await expect(page.locator('#s-rrif')).toContainText('Across all', { timeout: 30000 });
        await page.locator('details.table summary').click();
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join('; ')}`)).toEqual([]);
        expect(await overlaps(page)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      });
    }
  });
}

// A readout sits directly under the control that drives it (within a short gap, same left edge give or take its rule).
async function under(page, control, readout) {
  const c = await page.locator(control).boundingBox(), r = await page.locator(readout).boundingBox();
  expect(r.y, `${readout} starts below ${control}`).toBeGreaterThanOrEqual(c.y + c.height - 1);
  expect(r.y - (c.y + c.height), `${readout} is right under ${control}`).toBeLessThan(64);
  expect(Math.abs(r.x - c.x), `${readout} lines up with ${control}`).toBeLessThan(24);
}

for (const width of [390, 1440]) {
  test.describe(`${width}px, the premium layer`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('each readout sits under its control and its value changes when the control is used', async ({ page }) => {
      await page.goto(url); await ready(page);
      // shuffle: the ending stays (the point), the order shown changes
      await under(page, '#shuffle', '#r-shuffle');
      const end = await page.locator('#rv-shuffle').innerText(), order = await page.locator('#sam-order').innerText();
      await expect(page.locator('#rk-order')).toHaveText('Sam’s order: worst years first');
      await page.click('#shuffle');
      await expect(page.locator('#rk-order')).toContainText('Sam’s order this time');
      await expect(page.locator('#sam-order')).not.toHaveText(order);
      await expect(page.locator('#rv-shuffle')).toHaveText(end);
      await expect(page.locator('#r-shuffle .readout-fine')).toHaveText(SYN);
      // deal: nothing until a card is dealt, then where the order ends and its rank among every order
      await under(page, '.deal .row', '#s-deal');
      await expect(page.locator('#rv-deal')).toBeHidden();
      await page.click('#random');
      await expect(page.locator('#rv-deal')).toHaveText(/^(Runs out in year \d+|Lasts all 25 years, \$[\d,]+ left)$/);
      await expect(page.locator('#rt-deal')).toContainText(/of all 3,628,800 orders/);
      // the rescue levers: does Sam last, and what he is paid in total
      await under(page, '.levers', '#r-mix');
      const lasts = await page.locator('#rv-mix').innerText(), paid = await page.locator('#rv-paid').innerText();
      expect(lasts).toBe('Runs out in year 20');
      await page.check('#buffer');
      await expect(page.locator('#rv-mix')).toHaveText('Runs out in year 18');
      await expect(page.locator('#rv-paid')).not.toHaveText(paid);
      // the RRIF lane: the share of orders that run out, without and then with the minimums
      await under(page, 'label:has(#rrif)', '#r-rrif');
      await expect(page.locator('#rc-rrif-on')).toBeHidden();
      await expect(page.locator('#rv-rrif-off')).toHaveText(/%$/);
      await page.check('#rrif');
      await expect(page.locator('#rv-rrif-on')).toHaveText(/%$/, { timeout: 30000 });
      // readouts are not fine print: the value is the largest text in the box, the notes stay readable
      const sizes = await page.evaluate(() => ['#rv-deal', '#rt-deal', '#rf-deal'].map((s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize)));
      expect(sizes[0]).toBeGreaterThan(sizes[1]);
      expect(sizes[2]).toBeGreaterThanOrEqual(15);
      expect(await overlaps(page)).toEqual([]);
    });

    test('no chapter rail, and the crosshair reads the balance charts', async ({ page }) => {
      await page.goto(url); await ready(page);
      await expect(page.locator('section[data-chapter]')).toHaveCount(8);
      await expect(page.locator('.sec-label')).toHaveCount(7);
      await expect(page.locator('nav.rail')).toHaveCount(0); // the numbered rail is gone (redesign v2)
      for (const id of ['#c-lead', '#c-deal']) {
        const svg = page.locator(id); await svg.scrollIntoViewIfNeeded();
        const b = await svg.boundingBox();
        await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5);
        await expect(svg.locator('.crosshair')).toBeVisible();
        await expect(svg.locator('.crosshair text')).toContainText(/End of year \d+Ruth: \$[\d,]+Sam: /);
      }
      await page.click('#random');
      const b = await page.locator('#c-deal').boundingBox();
      await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5);
      await expect(page.locator('#c-deal .crosshair text')).toContainText('Your order: ');
      await expect(page.locator('#c-deal .crosshair')).toHaveCount(1); // the old one was removed before the redraw
      await page.mouse.move(0, 0);
      await expect(page.locator('#c-deal .crosshair')).toBeHidden();
    });
  });
}

test('with reduced motion nothing animates', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage(); await page.goto(url); await ready(page);
  await page.click('#random'); await page.click('#shuffle');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await page.locator('.flash').count()).toBe(0);
  await ctx.close();
});
