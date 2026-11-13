import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell } from '../../../shared/desk/shell-test.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const html = readFileSync(file, 'utf8');
const M = JSON.parse(html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<'));

async function choose(page, year, amount) {
  await page.fill('#year', String(year));
  if (amount != null) await page.fill('#amount', String(amount));
  await page.press('#year', 'Enter');
}
async function clashes(page) {
  const boxes = await page.locator('#chart text').evaluateAll((ts) => ts.filter((t) => t.textContent.trim() && !t.closest('.crosshair')).map((t) => { const b = t.getBBox(); return [b.x, b.y, b.width, b.height, t.textContent]; }));
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    if (a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1) out.push(`${a[4]} / ${b[4]}`);
  }
  const W = await page.locator('#chart').evaluate((s) => s.viewBox.baseVal.width);
  for (const b of boxes) if (b[0] < -0.5 || b[0] + b[2] > W + 0.5) out.push(`${b[4]} is clipped`);
  return out;
}

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the tool shell: tool bar, one Up next card, notes, share tags; no rail, nothing sticky, nothing stored', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectShell(page, 'money-then-now');
      await expectStorageClean(page);
    });

    test('opens on a labelled example; a typed year and amount update the headline and the chart; no request, nothing stored', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      const start = page.url();
      await expect(page.locator('#example-note')).toContainText('example');
      await expect(page.locator('#finding')).toContainText(/^What cost \$100 in 1990 cost about \$[\d,]+ in \d{4}\.$/);
      await expect(page.locator('#kicker')).toHaveText(`Data story · Statistics Canada and Bank of Canada data to ${M.last}`);
      await expect(page.locator('#chart .stripe')).toHaveCount(M.last - M.first + 1);
      await expect(page.locator('#chart .sel-line').first()).toHaveAttribute('data-year', '1990');

      await choose(page, 1950, 250);
      const expected = 250 * (M.avg[M.last] / M.avg[1950]);
      const shown = Number((await page.locator('#finding .hl').textContent()).replace(/[$,]/g, ''));
      expect(Math.abs(shown - expected) / expected).toBeLessThan(0.01);
      await expect(page.locator('#finding')).toContainText('What cost $250 in 1950');
      await expect(page.locator('#chart .sel-line').first()).toHaveAttribute('data-year', '1950');
      await expect(page.locator('#chart')).toContainText('$250 in 1950');
      await expect(page.locator('#example-note')).not.toContainText('example');
      await expect(page.locator('#rows tr.sel')).toHaveAttribute('data-year', '1950');

      await choose(page, 1800);
      await expect(page.locator('#error')).toBeVisible();
      await expect(page.locator('#error')).toContainText(`${M.first} to ${M.last}`);
      await expect(page.locator('#chart .sel-line').first()).toHaveAttribute('data-year', '1950');
      await expect(page.locator('#finding')).toContainText('1950');
      await choose(page, 1990, 0);
      await expect(page.locator('#error')).toContainText('amount');
      await choose(page, 1990, 100);
      await expect(page.locator('#error')).toBeHidden();

      expect(requests).toEqual([]);
      expect(page.url()).toBe(start);
      await expectStorageClean(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('the sources carry the attributions; the table has every year', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('#sources')).toContainText(M.meta.cpi.attribution);
      await expect(page.locator('#sources')).toContainText(M.meta.rate.attribution);
      await expect(page.locator('#sources')).toContainText('#ShowYourStripes warming stripes by Professor Ed Hawkins');
      await expect(page.locator('#rows tr')).toHaveCount(M.last - M.first + 1);
      await expect(page.locator('#chart')).toHaveAttribute('role', 'img');
      expect((await page.locator('#chart-text li').allTextContents()).length).toBe(3);
    });

    test('no two labels on the chart overlap, and none is clipped', async ({ page }) => {
      await page.goto(url);
      for (const y of [M.first, 1950, 1990, M.last]) {
        await choose(page, y);
        await expect(page.locator('#chart .sel-line').first()).toHaveAttribute('data-year', String(y));
        expect(await clashes(page), `year ${y}`).toEqual([]);
      }
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      await choose(page, 1990, 1234567);
      expect(await clashes(page), 'a large amount, light').toEqual([]);
    });

    test('the chart saves as an image made in the browser', async ({ page }) => {
      await page.goto(url);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
      expect(dl.suggestedFilename()).toBe('money-then-now-1990.png');
    });

    test('the year readout sits under the form and changes with the year; no rail; the crosshair', async ({ page }) => {
      await page.goto(url);
      const f = await page.locator('#form').boundingBox(), r = await page.locator('#year-readout').boundingBox();
      expect(r.y).toBeGreaterThanOrEqual(f.y + f.height - 1);
      expect(r.y - (f.y + f.height)).toBeLessThan(64);
      expect(Math.abs(r.x - f.x)).toBeLessThan(24);
      await expect(page.locator('#rk-year')).toHaveText('The example year, 1990');
      const infl = await page.locator('#rv-infl').innerText(), prime = await page.locator('#rv-prime').innerText();
      expect(prime).toMatch(/%$/);
      await choose(page, 1950, 250);
      await expect(page.locator('#rk-year')).toHaveText('The year you picked, 1950');
      await expect(page.locator('#rv-infl')).not.toHaveText(infl);
      await expect(page.locator('#rv-prime')).toHaveText('No data');
      await expect(page.locator('#rt-year')).toContainText(`The prime-rate series here starts in ${M.primeFirst}`);
      await choose(page, 1990, 250);
      await expect(page.locator('#rv-prime')).toHaveText(prime);
      await expect(page.locator('#rt-year')).toContainText('points');
      // the value is the largest text in the readout; the note is readable
      const sizes = await page.evaluate(() => ['#rv-infl', '#rt-year', '#year-readout .readout-fine'].map((s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize)));
      expect(sizes[0]).toBeGreaterThan(sizes[1]);
      expect(sizes[2]).toBeGreaterThanOrEqual(15);

      await expect(page.locator('section[data-chapter]')).toHaveCount(3); // the This year section comes back in step 6, with its data
      await expect(page.locator('nav.rail')).toHaveCount(0); // the numbered rail is gone (redesign v2)

      const svg = page.locator('#chart'); await svg.scrollIntoViewIfNeeded();
      const b = await svg.boundingBox();
      await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.5);
      await expect(svg.locator('.crosshair')).toBeVisible();
      await expect(svg.locator('.crosshair text')).toContainText(/^\d{4}Prices [+−]?[\d.]+%Prime [\d.]+%Real rate [+−]?[\d.]+%\$250 from 1990: \$[\d,.]+$/);
      await page.mouse.move(b.x + 2, b.y + b.height * 0.5);
      await expect(svg.locator('.crosshair text')).toContainText(`${M.first}Prices`);
      await expect(svg.locator('.crosshair text')).toContainText('No prime-rate data');
      expect(await clashes(page)).toEqual([]);
      await choose(page, 1950);
      await expect(svg.locator('.crosshair')).toHaveCount(1); // the old one was removed before the redraw
      await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
      await expect(svg.locator('.crosshair text')).toContainText('$250 from 1950: ');
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
