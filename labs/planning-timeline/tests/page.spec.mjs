import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes } from '../../../shared/desk/shell-test.mjs';
import { fileURLToPath } from 'node:url';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the tool shell: tool bar, one Up next card, notes, share tags; no rail, nothing sticky, nothing stored', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectShell(page, 'planning-timeline');
      await expectStorageClean(page);
    });

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
      await expectStorageClean(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('each result is a readout right under its control, and it changes with the control', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      const under = async (control, readout) => {
        const c = await page.locator(control).boundingBox(), r = await page.locator(readout).boundingBox();
        expect(r.y - (c.y + c.height), `${readout} sits under ${control}`).toBeGreaterThanOrEqual(-1);
        expect(r.y - (c.y + c.height), `${readout} sits under ${control}`).toBeLessThan(48);
      };
      await under('#cpp-range', '#cpp-readout'); await under('#oas-range', '#oas-readout');
      await under('#income', '#rec-readout'); await under('#fund', '#fund-readout');
      for (const [range, big] of [['#cpp-range', '#cpp-big'], ['#oas-range', '#oas-big']]) {
        const before = await page.locator(big).textContent();
        await page.locator(range).focus(); await page.keyboard.press('Home');
        await expect(page.locator(big)).not.toHaveText(before);
        await expect(page.locator(big)).toHaveClass(/flash/);
      }
      await expect(page.locator('#cpp-text b')).toContainText('age ');
      for (const [input, big, v] of [['#income', '#rec-big', '150000'], ['#fund', '#fund-big', '250000']]) {
        const before = await page.locator(big).textContent();
        await page.fill(input, v);
        await expect(page.locator(big)).not.toHaveText(before);
        await expect(page.locator(big)).toHaveText(/^\$[\d,]+$/);
      }
      await expect(page.locator('#fund-text')).toContainText('on January 1');
      await expect(page.locator('#people-big')).toContainText('About');
    });

    test('no chapter rail; each totals chart reads out under the pointer', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expect(page.locator('section[data-chapter]')).toHaveCount(5);
      await expect(page.locator('.sec-label')).toHaveCount(5);
      await expect(page.locator('nav.rail')).toHaveCount(0); // the numbered rail is gone (redesign v2)
      for (const id of ['#cpp-chart', '#oas-chart']) {
        const svg = page.locator(id); await svg.scrollIntoViewIfNeeded();
        const b = await svg.boundingBox();
        await page.mouse.move(b.x + b.width * 0.6, b.y + b.height / 2);
        await expect(page.locator(`${id} .crosshair`)).toBeVisible();
        await expect(page.locator(`${id} .crosshair text`)).toContainText('At age');
        await expect(page.locator(`${id} .crosshair text`)).toContainText('years');
      }
      // a redraw leaves one crosshair, not two
      await page.locator('#cpp-range').focus(); await page.keyboard.press('End');
      await expect(page.locator('#cpp-chart .crosshair')).toHaveCount(1);
    });

    test('words: the question as the H1, the finding under it, one-word kicker, no section numbers, one amber action', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      const h1 = (await page.locator('h1').textContent()).trim();
      expect(h1).toBe('What opens, and when, for your year?');
      expect(h1.length).toBeLessThanOrEqual(60);
      expect(h1.split(/\s+/).length).toBeLessThanOrEqual(12);
      expect(h1).not.toMatch(/\d/);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1 + #finding')).toContainText('At ');
      await expect(page.locator('.kicker')).toHaveText('Tool');
      expect(await page.locator('.sec-label').evaluateAll((ls) => ls.filter((l) => /\d/.test(l.textContent)).length)).toBe(0);
      await expect(page.locator('.btn-you')).toHaveCount(1);
      await expect(page.locator('.legend')).toHaveCount(0);
      // every chart is framed, with a plain-words title
      for (const f of await page.locator('figure.chart').all()) await expect(f.locator('.chart-title')).not.toBeEmpty();
      await expect(page.locator('figure.chart')).toHaveCount(4);
      // the one assumptions line sits beside the first control
      await expect(page.locator('#example-note')).toContainText('rules as of');
      const c = await page.locator('#year').boundingBox(), n = await page.locator('#example-note').boundingBox();
      expect(n.y - (c.y + c.height)).toBeLessThan(120);
      const body = await page.locator('main').innerText();
      expect(body).not.toMatch(/\b(should|recommend)\b|best for you/i);
    });

    test('every rendered text is 16.5px or more, chart labels included, in each state', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectTextSizes(page);
      for (const y of ['1950', '1990', '2008']) { await page.fill('#year', y); await page.click('button[type=submit]'); await expectTextSizes(page); }
      for (const d of await page.locator('details summary').all()) await d.click();
      await expectTextSizes(page);
      for (const r of ['#cpp-range', '#oas-range']) { await page.locator(r).focus(); await page.keyboard.press('Home'); }
      await expectTextSizes(page);
      // the crosshair reading too, and its box stays inside the chart
      for (const id of ['#cpp-chart', '#oas-chart']) {
        const svg = page.locator(id); await svg.scrollIntoViewIfNeeded();
        const b = await svg.boundingBox();
        for (const f of [0.2, 0.45, 0.6]) {
          await page.mouse.move(b.x + b.width * f, b.y + b.height / 2);
          await expect(page.locator(`${id} .crosshair`)).toBeVisible();
          await expectTextSizes(page);
          const r = await page.locator(`${id} .crosshair rect`).boundingBox();
          expect(r.x, 'the reading box starts inside the chart').toBeGreaterThanOrEqual(b.x - 1);
          expect(r.x + r.width, 'the reading box ends inside the chart').toBeLessThanOrEqual(b.x + b.width + 1);
        }
      }
    });

    test('labels on the totals and RRIF charts do not overlap', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      const clashes = (id) => page.locator(`${id} > text`).evaluateAll((ts) => {
        const b = ts.filter((t) => t.textContent.trim()).map((t) => { const r = t.getBBox(); return [r.x, r.y, r.width, r.height, t.textContent]; }), out = [];
        for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
          const [p, q] = [b[i], b[j]];
          if (p[0] < q[0] + q[2] - 1 && q[0] < p[0] + p[2] - 1 && p[1] < q[1] + q[3] - 1 && q[1] < p[1] + p[3] - 1) out.push(`${p[4]} / ${q[4]}`);
        }
        return out;
      });
      for (const [range, id] of [['#cpp-range', '#cpp-chart'], ['#oas-range', '#oas-chart']]) {
        await page.locator(range).focus();
        for (const key of ['End', 'Home', 'ArrowRight', 'PageUp', 'PageUp']) { await page.keyboard.press(key); expect(await clashes(id), `${id} after ${key}`).toEqual([]); }
      }
      expect(await clashes('#rrif-chart')).toEqual([]);
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
