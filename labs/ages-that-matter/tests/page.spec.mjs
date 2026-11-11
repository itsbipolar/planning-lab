import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('three grids, pickers that read each square aloud, the example fund; no request, nothing stored, no sideways scroll', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      expect(await page.locator('#cpp rect.cell').count()).toBeGreaterThan(100);
      expect(await page.locator('#oas rect.cell').count()).toBeGreaterThan(50);
      expect(await page.locator('#rrif rect.cell').count()).toBeGreaterThan(20);
      await page.locator('#cpp-pick').focus(); await page.keyboard.press('Home');
      await expect(page.locator('#cpp-read')).toContainText('less than at');
      await page.keyboard.press('End');
      await expect(page.locator('#cpp-read')).toContainText('more than at');
      expect(await page.locator('#cpp-pick').getAttribute('aria-valuetext')).toContain('Starting at');
      await expect(page.locator('#rrif-read')).toContainText('example fund of $100,000');
      await page.locator('#rrif-pick').focus(); await page.keyboard.press('End');
      await expect(page.locator('#rrif-read')).toContainText('or older');
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('sources, the example label, the education and AI lines', async ({ page }) => {
      await page.goto(url);
      const t = await page.locator('body').innerText();
      for (const s of ['not anyone\'s amount', 'Education only', 'Made with AI assistance', 'Income Tax Regulations']) expect(t).toContain(s);
      expect(t).not.toMatch(/\byou should\b/i);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        for (const d of await page.locator('details summary').all()) await d.click();
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
      });
    }
  });
}
