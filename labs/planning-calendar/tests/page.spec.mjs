import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const config = JSON.parse(readFileSync(new URL('../calendar.json', import.meta.url), 'utf8'));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('every household row, one household by weekday, its dates in words; no request, nothing stored, no sideways scroll', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      for (const h of config.households.slice(0, 3)) await expect(page.locator('#overview')).toContainText(h.label.split(',')[0]);
      await expect(page.locator('#overview .pick-row')).toHaveCount(width < 700 ? 2 : 1);   // amber: the household picked, once per half
      expect(await page.locator('#daily rect.cell').count()).toBeGreaterThan(250);
      const first = await page.locator('#dates').innerText();
      expect(first.length).toBeGreaterThan(20);
      await page.locator('#pick').selectOption('self_employed');
      await expect(page.locator('#dates')).not.toHaveText(first);
      await expect(page.locator('#dates li').first()).toContainText(', 2027');
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('the own-date rules, what is not placed yet, the sources, the education and AI lines', async ({ page }) => {
      await page.goto(url);
      const t = await page.locator('body').innerText();
      for (const s of ['CPP can start: age', 'Not on the calendar yet', 'settlement date', 'Education only', 'Made with AI assistance']) expect(t).toContain(s);
      expect(t).not.toMatch(/\byou should\b/i);
      expect(await page.locator('#sources li').count()).toBeGreaterThan(5);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
      });
    }
  });
}
