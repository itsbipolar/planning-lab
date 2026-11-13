import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const M = JSON.parse(readFileSync(file, 'utf8').match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<'));
const policy = M.panels.find((p) => p.id === 'policy');

// Every text in every chart: no two overlap, and none runs outside its chart.
async function clashes(page) {
  return page.locator('.panel svg').evaluateAll((svgs) => {
    const out = [];
    svgs.forEach((svg, k) => {
      const W = svg.viewBox.baseVal.width, H = svg.viewBox.baseVal.height;
      const boxes = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim()).map((t) => { const b = t.getBBox(); return [b.x, b.y, b.width, b.height, t.textContent]; });
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        if (a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1) out.push(`chart ${k}: ${a[4]} / ${b[4]}`);
      }
      for (const b of boxes) if (b[0] < -0.5 || b[0] + b[2] > W + 0.5 || b[1] < -0.5 || b[1] + b[3] > H + 0.5) out.push(`chart ${k}: ${b[4]} is clipped`);
    });
    return out;
  });
}

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('leads with the computed finding; the slider reads a day across all four charts; no request, nothing stored, nothing in the address', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      const start = page.url();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('#finding')).toContainText(`The Bank of Canada`);
      await expect(page.locator('#finding .hl')).toHaveText(policy.summary.to);
      if (policy.decisions.length) await expect(page.locator('#finding')).toContainText(policy.summary.from);
      await expect(page.locator('#kicker')).toContainText('Bank of Canada data to');
      await expect(page.locator('#lede')).toContainText(M.panels.find((p) => p.id === 'mortgage').summary.to);
      await expect(page.locator('.panel')).toHaveCount(4);
      await expect(page.locator('#lane .card')).toHaveCount(6);
      await expect(page.locator('#lane .year')).toHaveText(['2026', '2027', '2028']);
      await expect(page.locator('#lane .stamp').first()).toHaveText('Proposed, not law');
      await expect(page.locator('#lane .card', { hasText: 'RRSP for life' }).locator('.stamp')).toHaveText('Consultation');
      await page.locator('#when').focus();
      await page.keyboard.press('Home');
      await expect(page.locator('#readout')).toContainText('January 1, 2026');
      for (let i = 0; i < 31; i++) await page.keyboard.press('ArrowRight');
      await expect(page.locator('#readout')).toContainText('February 1, 2026');
      for (const l of M.panels.flatMap((p) => p.lines)) await expect(page.locator('#readout')).toContainText(l.label);
      expect(await page.locator('#when').getAttribute('aria-valuetext')).toContain('February 1, 2026');
      await expect(page.locator('.panel .cross[visibility=visible]')).toHaveCount(4);
      await expect(page.locator('.panel .now').first()).toBeVisible(); // the day's value is written on the charts
      await expect(page.locator('.mark')).toHaveCount(policy.decisions.length); // amber, once per rate decision
      expect(requests).toEqual([]);
      expect(page.url()).toBe(start);
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie, location.search, location.hash])).toEqual([0, 0, '', '', '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('the header, the sources, the attribution and terms, and the education and AI lines', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('.bar a')).toHaveText(['Mohammed El Chayeb', '← Money, then and now', 'About this build']);
      expect(await page.locator('.bar a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['/', '/builds/money-then-now/app/', '/builds/money-then-now/']);
      await expect(page.locator('button, [aria-pressed]')).toHaveCount(0); // no theme switch
      await expect(page.locator('.foot')).toContainText('Education only, not advice. Made with AI assistance; every figure is computed from the dated public data named below.');
      await expect(page.locator('#foot-attr')).toContainText('Not affiliated with or endorsed by the Bank of Canada');
      await expect(page.locator('#foot-attr a')).toHaveAttribute('href', M.source.terms_url);
      await page.locator('#about summary').click();
      await expect(page.locator('#src')).toContainText(M.source.attribution);
      await expect(page.locator(`#src a[href="${M.source.terms_url}"]`)).toHaveCount(1);
      await expect(page.locator(`#src a[href="${M.source.source_url}"]`)).toHaveCount(1);
      await expect(page.locator(`#budget-src a[href="${M.budgetUrl}"]`)).toHaveCount(1);
      await expect(page.locator('#budget-link')).toHaveAttribute('href', M.budgetUrl);
      await expect(page.locator('#budget')).toContainText('These are proposals and a consultation: not law unless enacted.');
    });

    test('no two texts on a chart overlap and none is clipped, wherever the slider is, in both schemes', async ({ page }) => {
      await page.goto(url);
      expect(await clashes(page), 'latest day').toEqual([]);
      const days = Number(await page.locator('#when').getAttribute('max'));
      for (const theme of ['dark', 'light']) {
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        for (const f of [0, 0.1, 0.33, 0.5, 0.75, 0.9, 0.97]) {
          await page.locator('#when').fill(String(Math.round(days * f)));
          expect(await clashes(page), `${theme}, day ${Math.round(days * f)}`).toEqual([]);
        }
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
