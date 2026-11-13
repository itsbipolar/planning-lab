import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const snap = JSON.parse(readFileSync(new URL('../../../shared/data/population-by-age-places.json', import.meta.url), 'utf8'));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const [y0, y1] = snap.years, [a0, a1] = snap.ages;
const cells = (y1 - y0 + 1) * (a1 - a0 + 1);
const born = async (page, y) => { await page.fill('#born', String(y)); await page.click('button[type=submit]'); };

async function clashes(page) {
  const boxes = await page.locator('#heat text, .legend text').evaluateAll((ts) => ts.filter((t) => t.textContent.trim()).map((t) => {
    const b = t.getBoundingClientRect(); return [b.x, b.y, b.width, b.height, t.textContent];
  }));
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    if (a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1) out.push(`${a[4]} / ${b[4]}`);
  }
  return out;
}

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('opens on a labelled example; the birth year, toggle, place and gender redraw it; bad years are refused; no request, nothing stored', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expect(page.locator('#heat rect.cell')).toHaveCount(cells);
      expect(await page.locator('#heat line.rule').count()).toBeGreaterThanOrEqual(3);
      await expect(page.locator('#heat polygon.diag')).toHaveCount(1);
      await expect(page.locator('#finding')).toContainText(`Canadians were`);
      await expect(page.locator('#finding')).toContainText(`July 1, ${y1}`);
      await expect(page.locator('#born-note')).toContainText('example');
      await expect(page.locator('#readings-h')).toContainText('Example diagonal');
      // a typed birth year moves the diagonal and its readings
      const pts = await page.locator('#heat polygon.diag').getAttribute('points'), list = await page.locator('#readings').innerText();
      await born(page, 1946);
      await expect(page.locator('#readings-h')).toContainText('Your diagonal: born July 2, 1945 to July 1, 1946');
      expect(await page.locator('#heat polygon.diag').getAttribute('points')).not.toBe(pts);
      expect(await page.locator('#readings').innerText()).not.toBe(list);
      expect(await page.locator('#heat circle.dot').count()).toBeGreaterThanOrEqual(4);
      await expect(page.locator('#heat text.tag').first()).toContainText(' in ');
      // number of people, then share of the population
      await expect(page.locator('#grid-body tr').first().locator('td').first()).not.toContainText('%');
      await page.check('input[name=mode][value=share]');
      await expect(page.locator('#chart-h')).toContainText('%');
      await expect(page.locator('.legend text').first()).toContainText('%');
      await expect(page.locator('#heat text.tag').first()).toContainText('%');
      await expect(page.locator('#grid-body tr').first().locator('td').first()).toContainText('%');
      await expect(page.locator('#grid-body tr')).toHaveCount(y1 - y0 + 1);
      // place and gender
      await page.selectOption('#place', 'ON');
      await expect(page.locator('#finding')).toContainText('people in Ontario');
      await page.check('input[name=gender][value="Women+"]');
      await expect(page.locator('#finding')).toContainText('(Women+)');
      // bad years
      for (const bad of ['1800', String(y1), '1950.5', '']) {
        await page.fill('#born', bad); await page.click('button[type=submit]');
        await expect(page.locator('#error')).toBeVisible();
      }
      await born(page, 1960); await expect(page.locator('#error')).toBeHidden();
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie, location.search, location.hash])).toEqual([0, 0, '', '', '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('no chart text overlaps, for several birth years in both modes', async ({ page }) => {
      await page.goto(url);
      for (const mode of ['count', 'share']) {
        await page.check(`input[name=mode][value=${mode}]`);
        for (const y of [1965, 1950, 1946, 1940, 1930, 1910, 1882, 1976]) {
          await born(page, y);
          expect(await clashes(page), `born ${y}, ${mode}`).toEqual([]);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('attribution, table number, dates, notes, the education and AI lines; no advice', async ({ page }) => {
      await page.goto(url);
      for (const d of await page.locator('details summary').all()) await d.click();
      const t = await page.locator('body').innerText();
      for (const s of [snap.attribution, 'Table 17-10-0005-01', snap.released, snap.retrieved, 'doi.org/10.25318/1710000501-eng', 'preliminary postcensal',
        'Education only, not advice.', 'Made with AI assistance; every figure is computed from the dated public data named below.']) expect(t).toContain(s);
      expect(t).not.toMatch(/\byou should\b|\bwe recommend\b/i);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        for (const d of await page.locator('details summary').all()) await d.click();
        await page.fill('#born', '1800'); await page.click('button[type=submit]');
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
      });
    }
  });
}
