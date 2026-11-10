import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('four panels, the slider reads a day across all of them, no request after load, nothing stored', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expect(page.locator('.panel')).toHaveCount(4);
      await expect(page.locator('#lane li')).toHaveCount(6);
      await expect(page.locator('#lane .stamp').first()).toHaveText('Proposed, not law');
      await page.locator('#when').focus();
      await page.keyboard.press('Home');
      await expect(page.locator('#readout')).toContainText('January 1, 2026');
      for (let i = 0; i < 31; i++) await page.keyboard.press('ArrowRight');
      await expect(page.locator('#readout')).toContainText('February 1, 2026');
      expect(await page.locator('#when').getAttribute('aria-valuetext')).toContain('February 1, 2026');
      await expect(page.locator('.mark')).toHaveCount(1);              // amber, once: the rate decision
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('the sources and the education and AI lines are on the page', async ({ page }) => {
      await page.goto(url);
      const t = await page.locator('body').innerText();
      for (const s of ['Not affiliated with or endorsed by the Bank of Canada', 'Budget 2026', 'not law', 'Education only', 'Made with AI assistance']) expect(t).toContain(s);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await page.locator('details summary').click();
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
      });
    }
  });
}
