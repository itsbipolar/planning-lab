import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test('banned phrases are nowhere on the page', () => {
  const text = readFileSync(file, 'utf8').replace(/data:[^"')]+/g, '');
  for (const re of [/safe withdrawal/i, /withdrawal rate/i, /you should/i, /\brecommend(s|ed)?\b/i, /guarantee/i, /\b(ETF|mutual fund|index fund|S&P|TSX)\b/])
    expect(text, String(re)).not.toMatch(re);
});

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('a keyboard-only playthrough reaches the end, every chart is labelled synthetic, nothing is stored or sent', async ({ page }) => {
      const requests = []; const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expect(page.locator('#progress')).toHaveText('Scene 1 of 6');
      const next = async () => { await page.locator('#next').focus(); await page.keyboard.press('Enter'); };

      await next(); // scene 2
      await expect(page.locator('#h2s')).toBeFocused();
      const end2 = await page.locator('#t2').innerText();
      await page.locator('#shuffle').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      expect(await page.locator('#t2').innerText(), 'shuffling with no withdrawals changes nothing').toBe(end2);

      await next(); // scene 3
      await expect(page.locator('#t3')).toContainText('Sam runs out of money in year 20');
      await expect(page.locator('#t3')).toContainText('Ruth still has');
      const ruthLeft = (await page.locator('#t3').innerText()).match(/Ruth still has (\$[\d,]+)/)[1];

      await next(); // scene 4: deal all ten by keyboard
      for (let i = 0; i < 10; i++) { await page.locator('#hand button').first().focus(); await page.keyboard.press('Enter'); }
      await expect(page.locator('#dealt li')).toHaveCount(10);
      await expect(page.locator('#t4')).toContainText('In your order');
      // the hand is sorted best first, so dealing the first card each time is Ruth's order: same result to the dollar
      await expect(page.locator('#s4')).toContainText(`there is ${ruthLeft} left`);

      await next(); // scene 5
      await page.locator('#w').focus();
      for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft');
      await page.locator('#flex').focus(); await page.keyboard.press('Space');
      await page.locator('#buffer').focus(); await page.keyboard.press('Space');
      await expect(page.locator('#t5')).toContainText('With these choices');
      expect(await page.locator('#w').getAttribute('aria-valuetext')).toMatch(/^\$\d/);

      await next(); // scene 6
      await expect(page.locator('#progress')).toHaveText('Scene 6 of 6');
      await expect(page.locator('.qs li')).toHaveCount(6);
      await expect(page.locator('#next')).toHaveText('Start again');

      for (const id of ['c2', 'c3', 'c4', 'c5']) await expect(page.locator(`#${id} + figcaption.syn`)).toHaveText('Synthetic sequence: not historical, not a forecast.');
      expect(errors).toEqual([]);
      expect(requests).toEqual([]);
      expect(page.url()).toBe(url);
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe on every scene, ${theme}`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        for (let s = 1; s <= 6; s++) {
          if (s === 4) await page.click('#random');
          const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
          expect(r.violations.map((v) => `scene ${s} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
          await page.click('#next');
        }
      });
    }
  });
}

test('with reduced motion nothing animates', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage(); await page.goto(url);
  for (let s = 1; s < 6; s++) await page.click('#next');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await ctx.close();
});
