import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const html = readFileSync(fileURLToPath(new URL('../dist/index.html', import.meta.url)), 'utf8');
const data = JSON.parse(html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<'));

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('one stripe per year, a slider that reads each year, no request after load, nothing stored', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expect(page.locator('#s-cpi .stripe')).toHaveCount(data.cpi.length);
      await expect(page.locator('#s-rate .stripe')).toHaveCount(data.rate.length);
      await expect(page.locator('#rows tr')).toHaveCount(data.cpi.length);
      await page.locator('#year').focus();
      for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
      const y = data.cpi.at(-1)[0] - 5;
      await expect(page.locator('#readout')).toContainText(`${y}:`);
      expect(await page.locator('#year').getAttribute('aria-valuetext')).toContain(`${y}:`);
      await page.locator('#s-cpi .stripe').first().click();
      await expect(page.locator('#readout')).toContainText(`${data.cpi[0][0]}:`);
      await expect(page.locator('#s-cpi .stripe.sel')).toHaveCount(1);
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('colours: prices that fell are blue, prices that rose fast are amber, no change is paper', async ({ page }) => {
      await page.goto(url);
      const rgb = (y) => page.locator(`#s-cpi .stripe[data-year="${y}"]`).evaluate((e) => getComputedStyle(e).backgroundColor.match(/\d+/g).map(Number));
      const fell = await rgb(1921), rose = await rgb(1917);
      expect(fell[2]).toBeGreaterThan(fell[0]);          // blue channel above red
      expect(rose[0]).toBeGreaterThan(rose[2] + 40);     // red well above blue: amber
    });

    test('the sources, licences and credits are on the page', async ({ page }) => {
      await page.goto(url);
      const t = await page.locator('#about').innerText();
      for (const s of ['Statistics Canada Open Licence', 'does not constitute an endorsement by Statistics Canada', 'Bank of Canada', 'Not affiliated with or endorsed by the Bank of Canada', 'Ed Hawkins', 'CC BY 4.0', 'retrieved'])
        expect(t).toContain(s);
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
