import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('opens on a labelled example, redraws for a typed year and for each slider; no request, nothing stored', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expect(page.locator('#example-note')).toContainText('example');
      await expect(page.locator('#finding')).toContainText('At ');
      await page.fill('#year', '1950'); await page.click('button[type=submit]');
      await expect(page.locator('#finding')).toContainText('At ');
      await expect(page.locator('#example-note')).toContainText('born in 1950');
      await expect(page.locator('#tl-text')).toContainText('TFSA');
      await page.locator('#cpp-range').focus(); await page.keyboard.press('Home');
      await expect(page.locator('#cpp-text')).toContainText('less every month');
      await page.keyboard.press('End');
      await expect(page.locator('#cpp-text')).toContainText('catches up');
      await page.fill('#year', '1800'); await page.click('button[type=submit]');
      await expect(page.locator('#error')).toBeVisible();
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie, location.search, location.hash])).toEqual([0, 0, '', '', '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('labels on the timeline do not overlap', async ({ page }) => {
      await page.goto(url);
      for (const y of ['1965', '1950', '1990', '2008']) {
        await page.fill('#year', y); await page.click('button[type=submit]');
        const boxes = await page.locator('#tl text').evaluateAll((ts) => ts.filter((t) => t.textContent.trim()).map((t) => { const b = t.getBBox(); return [b.x, b.y, b.width, b.height, t.textContent]; }));
        const clash = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const [a, b] = [boxes[i], boxes[j]];
          if (a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1) clash.push(`${a[4]} / ${b[4]}`);
        }
        expect(clash, `born ${y}`).toEqual([]);
      }
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
