import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
      const boxes = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim()).map((t) => ({ t: t.textContent, r: t.getBoundingClientRect() }));
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
      await expect(page.locator('#s-shuffle')).toContainText(`Ruth ends with ${end}`);
      expect((await page.locator('#s-shuffle').innerText()).match(/ends with (\$[\d,]+)\.$/)[1]).toBe(end);

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
      await expect(page.locator('footer p')).toHaveCount(2);
      expect(errors).toEqual([]);
      expect(requests).toEqual([]);
      expect(page.url()).toBe(url);
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
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

test('with reduced motion nothing animates', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage(); await page.goto(url); await ready(page);
  await page.click('#random');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await ctx.close();
});
