import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const snap = JSON.parse(readFileSync(new URL('../../../shared/data/population-by-age.json', import.meta.url), 'utf8'));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const cells = (snap.years[1] - snap.years[0] + 1) * (snap.ages[1] - snap.ages[0] + 1);

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the heatmap, the rule lines, a generation and one age; no request, nothing stored, no sideways scroll', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expect(page.locator('#heat rect.cell')).toHaveCount(cells);
      expect(await page.locator('#heat line.rule').count()).toBeGreaterThanOrEqual(3);
      await expect(page.locator('#heat .gen')).toHaveCount(1);                       // amber, once: the generation followed
      await expect(page.locator('#summary')).toContainText('peaked in');
      // Following another generation moves the diagonal and the readout.
      const before = await page.locator('#gen').innerText();
      await page.locator('#born').focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
      await expect(page.locator('#gen')).not.toHaveText(before);
      expect(await page.locator('#born').getAttribute('aria-valuetext')).toContain('Born between');
      // Picking another rule age redraws the line and its sentence.
      const s1 = await page.locator('#age-summary').innerText();
      await page.locator('#ages input').nth(1).check();
      await expect(page.locator('#age-summary')).not.toHaveText(s1);
      await expect(page.locator('#age-body tr')).toHaveCount(snap.years[1] - snap.years[0] + 1);
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('attribution, citation, notes, the education and AI lines; history only', async ({ page }) => {
      await page.goto(url);
      const t = await page.locator('body').innerText();
      for (const s of [snap.attribution, 'Table 17-10-0005-01', 'doi.org/10.25318/1710000501-eng', 'preliminary postcensal', 'Education only', 'Made with AI assistance', 'nothing here forecasts']) expect(t).toContain(s);
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
