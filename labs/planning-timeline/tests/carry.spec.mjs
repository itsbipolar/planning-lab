// The birth-year carry (redesign v2; Mo approved it): a year set in Your year is kept for this visit in sessionStorage
// 'mo.year' only, and Money, then and now and Retirement wave (where its data covers that age) open on it in the same
// tab. It never reaches the address. With storage blocked, or no key, every page shows its labelled example.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expectStorageClean } from '../../../shared/desk/shell-test.mjs';

const dist = (lab) => 'file://' + fileURLToPath(new URL(`../../${lab}/dist/index.html`, import.meta.url));
const YY = dist('planning-timeline'), MTN = dist('money-then-now'), RW = dist('retirement-wave');
const snap = JSON.parse(readFileSync(new URL('../../../shared/data/population-by-age-places.json', import.meta.url), 'utf8'));
const [, y1] = snap.years, [a0, a1] = snap.ages;
const IN = y1 - Math.round((a0 + a1) / 2);   // an age the population data covers on its latest July 1
const OUT = y1 - a0 + 10;                     // younger than the data's first age

// the first text each answer line shows, so a page that drew the example first and the carried year after is caught
const FIRST = () => {
  window.__first = {};
  new MutationObserver(() => {
    for (const id of ['example-note', 'finding']) {
      const e = document.getElementById(id);
      if (e && e.textContent.trim() && !(id in window.__first)) window.__first[id] = e.textContent;
    }
  }).observe(document, { subtree: true, childList: true, characterData: true });
};
const first = (page, id) => page.evaluate((i) => window.__first[i], id);
const address = (page) => page.evaluate(() => [location.search, location.hash, location.href.includes(document.documentElement.getAttribute('data-year') || '\u0000')]);

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('a year set in Your year opens Money, then and now and Retirement wave in the same tab; never in the address', async ({ page }) => {
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(FIRST);
      await page.goto(YY);
      await expect(page.locator('#example-note')).toContainText(/example/i);
      await page.fill('#year', String(IN));
      await expect(page.locator('#example-note')).toContainText(`born in ${IN}`);
      expect(await page.evaluate(() => sessionStorage.getItem('mo.year'))).toBe(String(IN));
      await expectStorageClean(page);

      // Money, then and now: opens on the year, with no example drawn first
      await page.goto(MTN);
      await expect(page.locator('#year')).toHaveValue(String(IN));
      await expect(page.locator('#example-note')).not.toContainText('example');
      await expect(page.locator('#finding')).toContainText(String(IN));
      expect(await first(page, 'example-note')).not.toContain('example');
      expect(await first(page, 'finding')).toContain(String(IN));
      expect(await address(page)).toEqual(['', '', false]);
      await expectStorageClean(page);

      // Retirement wave: the data covers that age, so it opens on the age that year gives on the data's latest July 1
      await page.goto(RW);
      await expect(page.locator('#age')).toHaveValue(String(y1 - IN));
      await expect(page.locator('#age-hint')).toHaveText(`From your birth year, ${IN}.`);
      expect(await address(page)).toEqual(['', '', false]);
      await expectStorageClean(page);

      // back in Your year, the year is kept
      await page.goto(YY);
      await expect(page.locator('#year')).toHaveValue(String(IN));
      expect(await first(page, 'example-note')).toContain(`born in ${IN}`);

      // a year outside the population data: Money, then and now follows it, Retirement wave keeps its opening age and
      // says plainly which ages its data covers (nothing looks broken)
      await page.fill('#year', String(OUT));
      await page.goto(MTN);
      await expect(page.locator('#year')).toHaveValue(String(OUT));
      await page.goto(RW);
      await expect(page.locator('#age-hint')).toHaveText(`This data covers ages ${a0} to ${a1}.`);
      await expect(page.locator('#age')).not.toHaveValue(String(y1 - OUT));
      await expectStorageClean(page);
      expect(errors).toEqual([]);
    });

    test('with storage blocked, every page renders its labelled example and Your year still works', async ({ page }) => {
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(() => {
        for (const k of ['sessionStorage', 'localStorage']) Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
      });
      await page.goto(YY);
      expect(await page.evaluate(() => { try { return sessionStorage.length < 0; } catch (e) { return 'blocked'; } }), 'storage is really blocked').toBe('blocked');
      await expect(page.locator('#example-note')).toContainText(/example/i);
      await expect(page.locator('#cpi-now')).toHaveText(/^\$[\d,.]+$/);
      await page.fill('#year', String(IN));
      await expect(page.locator('#example-note')).toContainText(`born in ${IN}`);
      await page.goto(MTN);
      await expect(page.locator('#example-note')).toContainText('example');
      await page.goto(RW);
      await expect(page.locator('#age')).toHaveValue(/^\d+$/);
      await expect(page.locator('#age-hint')).not.toContainText('From your birth year');
      expect(errors).toEqual([]);
    });

    test('a key that is not a 4-digit year is ignored', async ({ page }) => {
      await page.goto(YY);
      await page.evaluate(() => sessionStorage.setItem('mo.year', '19555'));
      await page.goto(MTN);
      await expect(page.locator('#example-note')).toContainText('example');
      expect(await page.evaluate(() => document.documentElement.hasAttribute('data-year'))).toBe(false);
    });
  });
}
