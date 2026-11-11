import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const config = JSON.parse(readFileSync(new URL('../triggers.json', import.meta.url), 'utf8'));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('heatmap, bars and summary; policies and hours redraw it; no request, nothing stored, no sideways scroll', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => { if (!r.url().startsWith('blob:')) requests.push(r.url()); });
      expect(await page.locator('#heat rect.cell').count()).toBeGreaterThan(250);   // a square for each weekday
      await expect(page.locator('#summary mark')).toHaveCount(1);                    // amber, once
      await expect(page.locator('#compare tr')).toHaveCount(config.policies.length);
      const q1 = await page.locator('#summary').innerText();
      await page.getByLabel('Reviews spread by birth month').check();
      await expect(page.locator('#summary')).not.toHaveText(q1);
      await expect(page.locator('#summary')).toContainText('Reviews spread by birth month');
      // Editing an hours assumption changes the year.
      const before = await page.locator('#summary').innerText();
      await page.getByLabel(/Hours per task: Annual review/).fill('12');
      await expect(page.locator('#summary')).not.toHaveText(before);
      // The week slider reads a week aloud.
      await page.locator('#week').focus(); await page.keyboard.press('Home');
      await expect(page.locator('#readout')).toContainText(`first week of ${config.year}`);
      expect(await page.locator('#week').getAttribute('aria-valuetext')).toContain('hours');
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('filters narrow the households', async ({ page }) => {
      await page.goto(url);
      const all = Number((await page.locator('#summary').innerText()).match(/([\d,]+) households/)[1].replace(',', ''));
      await page.getByLabel('With a family trust only').check();
      const some = Number((await page.locator('#summary').innerText()).match(/([\d,]+) households/)[1].replace(',', ''));
      expect(some).toBeGreaterThan(0); expect(some).toBeLessThan(all);
    });

    test('the CSV downloads, every cell quoted, the assumption label in the header', async ({ page }) => {
      await page.goto(url);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#csv').click()]);
      expect(dl.suggestedFilename()).toMatch(/synthetic\.csv$/);
      const text = readFileSync(await dl.path(), 'utf8');
      const lines = text.trim().split('\r\n');
      expect(lines.length).toBeGreaterThan(100);
      expect(lines[0]).toContain(config.assumptionLabel);
      expect(lines.every((l) => l.startsWith('"'))).toBe(true);
    });

    test('the synthetic banner, the assumption labels, pending rules, the education and AI lines', async ({ page }) => {
      await page.goto(url);
      const t = await page.locator('body').innerText();
      for (const s of ['Synthetic data', 'not industry benchmarks', config.assumptionLabel, 'Education only', 'Made with AI assistance', 'not affiliated with or endorsed by my employer']) expect(t).toContain(s);
      expect(t).not.toMatch(/\byou should\b/i);
      // Every task type whose fact is not confirmed is listed as pending, and only those.
      const confirmed = new Set(JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts.filter((f) => f.status === 'confirmed').map((f) => f.id));
      const ids = (t) => t.facts.map((id) => id.replace('{prev}', String(config.year - 1)).replace('{year}', String(config.year)));
      const unconfirmed = config.types.filter((t) => ids(t).some((id) => !confirmed.has(id)));
      await expect(page.locator('#pending p')).toHaveCount(unconfirmed.length);
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
