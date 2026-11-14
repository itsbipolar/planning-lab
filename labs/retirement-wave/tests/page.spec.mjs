import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes, expectTemplate, expectReducedMotion } from '../../../shared/desk/shell-test.mjs';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8'));
const oasAge = Number(facts.facts.find((f) => f.id === 'oas_start_age' && f.status === 'confirmed').value);
const snap = JSON.parse(readFileSync(new URL('../../../shared/data/population-by-age-places.json', import.meta.url), 'utf8'));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const [y0, y1] = snap.years, [a0, a1] = snap.ages;
const cells = (y1 - y0 + 1) * (a1 - a0 + 1);
const n = (v) => v.toLocaleString('en-CA');
const count = (a, place = 'CA', g = null) => (g ? snap.counts[place][g][y1][a - a0] : snap.genders.reduce((s, k) => s + snap.counts[place][k][y1][a - a0], 0));
const setAge = async (page, a) => { await page.fill('#age', String(a)); await page.locator('#age').dispatchEvent('change'); };
const openView = async (page) => { const d = page.locator('details.view'); if (!(await d.evaluate((e) => e.open))) await d.locator('summary').click(); };

// Every label with its backing (the diagonal's reading tags and the rule names are each one group), plus the axis and
// legend text: no two may touch. Adjacent crossings such as 70 and 71 must share a tag or sit apart, backings included.
async function clashes(page) {
  const boxes = await page.locator('#heat g.lbl, #heat text.lab, .legend text').evaluateAll((ts) => ts.filter((t) => t.textContent.trim()).map((t) => {
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

    test('the tool shell and the desk template budgets: one first move, one big answer, one assumptions line, Go deeper closed', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectShell(page, 'retirement-wave');
      const m = await expectTemplate(page);
      if (width === 390) {
        // the whole figure, not only the readout's top, sits in the first 700px on a phone
        const v = await page.locator('#answer .readout-v').boundingBox();
        expect(v.y + v.height).toBeLessThanOrEqual(700);
        expect(m.firstTop).toBeLessThan(m.answerTop);
      }
      await expect(page.locator('[data-first-move] #age')).toHaveCount(1);
      await expect(page.locator('[data-year-control]')).toHaveAttribute('id', 'age');
      await expectStorageClean(page);
      await expectTextSizes(page);
    });

    test('opens a year short of the OAS age with the latest July 1 count; the steps, a typed age and the view all redraw it; no request, nothing stored', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expect(page.locator('#heat rect.cell')).toHaveCount(cells);
      expect(await page.locator('#heat line.rule').count()).toBeGreaterThanOrEqual(3);
      await expect(page.locator('#heat polygon.diag')).toHaveCount(1);
      await expect(page.locator('#heat polygon.diag.drawn')).toHaveCount(0);
      await expect(page.locator('#finding')).toContainText('Canadians were');
      await expect(page.locator('#finding')).toContainText(`July 1, ${y1}`);
      const start = oasAge - 1;
      await expect(page.locator('#age')).toHaveValue(String(start));
      await expect(page.locator('#age-hint')).toHaveText(`Ages ${a0} to ${a1}.`);
      await expect(page.locator('#answer-k')).toHaveText(`Aged ${start} on July 1, ${y1}`);
      await expect(page.locator('#answer-v')).toHaveText(n(count(start)));
      await expect(page.locator('#answer-unit')).toHaveText('Canadians');
      await expect(page.locator('#answer-t')).toHaveText(`They all turn ${oasAge} by July 1, ${y1 + 1}.`);
      // a step older: the OAS age itself
      const pts = await page.locator('#heat polygon.diag').getAttribute('points');
      await page.click('#age-up');
      await expect(page.locator('#age')).toHaveValue(String(oasAge));
      await expect(page.locator('#answer-v')).toHaveText(n(count(oasAge)));
      await expect(page.locator('#answer-t')).toHaveText(`They turned ${oasAge} in the year to July 1, ${y1}.`);
      expect(await page.locator('#heat polygon.diag').getAttribute('points')).not.toBe(pts);
      // a typed age past the OAS age: how many there were when the group reached it
      const old = a1 - 2, y65 = y1 - old + oasAge;
      await setAge(page, old);
      await expect(page.locator('#answer-v')).toHaveText(n(count(old)));
      await expect(page.locator('#answer-t')).toHaveText(`At ${oasAge}, on July 1, ${y65}, the group numbered ${n(snap.genders.reduce((s, k) => s + snap.counts.CA[k][y65][oasAge - a0], 0))}.`);
      await expect(page.locator('#answer-how')).toContainText(`born from July 2, ${y1 - old - 1} to July 1, ${y1 - old}`);
      // the ends of the range: the steps stop there
      await setAge(page, a1); await expect(page.locator('#age-up')).toBeDisabled();
      await page.click('#age-down'); await expect(page.locator('#age')).toHaveValue(String(a1 - 1));
      await setAge(page, a0); await expect(page.locator('#age-down')).toBeDisabled();
      // ages the data does not cover are refused, and the answer stays
      for (const bad of [String(a0 - 1), String(a1 + 1), '62.5', '']) {
        await setAge(page, bad);
        await expect(page.locator('#error')).toBeVisible();
        await expect(page.locator('#error')).toContainText(`This data covers ages ${a0} to ${a1}`);
        await expect(page.locator('#age')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#answer-v')).toHaveText(n(count(a0)));
      }
      await setAge(page, start); await expect(page.locator('#error')).toBeHidden();
      // number of people, then share of the population (Change the view, closed until opened)
      await expect(page.locator('details.view')).not.toHaveAttribute('open', '');
      await openView(page);
      await page.check('input[name=mode][value=share]');
      await expect(page.locator('#chart-h')).toContainText('%');
      await expect(page.locator('.legend text').first()).toContainText('%');
      await expect(page.locator('#heat text.tag').first()).toContainText('%');
      await expect(page.locator('#answer-v')).toHaveText(n(count(start)));
      await expect(page.locator('#answer-how')).toContainText('%');
      // place and gender
      await page.selectOption('#place', 'ON');
      await expect(page.locator('#finding')).toContainText('people in Ontario');
      await expect(page.locator('#answer-unit')).toHaveText('people');
      await expect(page.locator('#answer-t')).toHaveText(new RegExp('^Ontario: they all turn'));
      await page.check('input[name=gender][value="Women+"]');
      await expect(page.locator('#finding')).toContainText('(Women+)');
      await expect(page.locator('#answer-v')).toHaveText(n(count(start, 'ON', 'Women+')));
      await expect(page.locator('#answer-t')).toContainText('Ontario (Women+): ');
      expect(requests).toEqual([]);
      await expectStorageClean(page);
      expect(await page.evaluate(() => [location.search, location.hash])).toEqual(['', '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('the band is drawn on only after the visitor changes the age, and the count-up ends on the answer', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('#heat polygon.drawn')).toHaveCount(0);
      await page.click('#age-up');
      await expect(page.locator('#heat polygon.diag.drawn')).toHaveCount(1);
      await expect(page.locator('#answer-v')).toHaveText(n(count(oasAge)));
      // a place change redraws without the draw-on
      await openView(page); await page.selectOption('#place', 'QC');
      await expect(page.locator('#heat polygon.drawn')).toHaveCount(0);
    });

    test('reduced motion: the step, the band and the readout are instant', async ({ page }) => {
      await page.goto(url);
      const text = await expectReducedMotion(page, async (p) => { await p.click('#age-up'); });
      expect(text).toContain(n(count(oasAge)));
    });

    test('a birth year carried this visit sets the age when the data covers it; otherwise the page says which ages it covers', async ({ page }) => {
      const inRange = y1 - (oasAge + 3);
      await page.addInitScript((y) => sessionStorage.setItem('mo.year', y), String(inRange));
      await page.goto(url);
      await expect(page.locator('#age')).toHaveValue(String(oasAge + 3));
      await expect(page.locator('#age-hint')).toHaveText(`From your birth year, ${inRange}.`);
      await expect(page.locator('#answer-v')).toHaveText(n(count(oasAge + 3)));
      await expect(page.locator('[data-year-chip]')).toBeVisible();
      await expect(page.locator('[data-year-chip-y]')).toHaveText(String(inRange));
      await page.click('[data-year-change]');
      await expect(page.locator('#age')).toBeFocused();
      await expectStorageClean(page);
      await expectTemplate(page);
      expect(await page.evaluate(() => location.href)).not.toContain(String(inRange));
    });

    test('a carried birth year outside the data: the opening age stays, with the plain range note', async ({ page }) => {
      const young = y1 - (a0 - 4);
      await page.addInitScript((y) => sessionStorage.setItem('mo.year', y), String(young));
      await page.goto(url);
      await expect(page.locator('#age')).toHaveValue(String(oasAge - 1));
      await expect(page.locator('#age-hint')).toHaveText(`This data covers ages ${a0} to ${a1}.`);
      await expect(page.locator('#error')).toBeHidden();
      await expect(page.locator('#answer-v')).toHaveText(n(count(oasAge - 1)));
      await expectTemplate(page);
    });

    test('with storage blocked the page opens on its starting age', async ({ page }) => {
      await page.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked'); } }); Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
      await page.goto(url);
      await expect(page.locator('#age')).toHaveValue(String(oasAge - 1));
      await expect(page.locator('#heat rect.cell')).toHaveCount(cells);
    });

    test('opens on a short question with the finding under it; one note on the chart; secondary blocks in closed folds', async ({ page }) => {
      await page.goto(url);
      const q = (await page.locator('h1').textContent()).trim();
      expect(q).toBe(`How many Canadians are about to turn ${oasAge}?`);
      expect(q.length).toBeLessThanOrEqual(60);
      expect(q.split(/\s+/).length).toBeLessThanOrEqual(12);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.kicker')).toHaveText('Data');
      await expect(page.locator('#finding')).toHaveClass(/\blede\b/);
      await expect(page.locator('#finding')).toContainText(`times as many as in ${y0}`);
      await expect(page.locator('[data-assumptions]')).toContainText('counted, not forecast');
      // the on-chart note names the shade the scheme really uses
      await expect(page.locator('#heat .heat-note:visible')).toHaveCount(1);
      await expect(page.locator('#heat .heat-note:visible')).toContainText('Darker = more people');
      await expect(page.locator('#heat .heat-note:visible')).toContainText('Each column is a year');
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await expect(page.locator('#heat .heat-note:visible')).toContainText('Brighter = more people');
      // no amber action on this page; the save button is secondary, in Go deeper with the table and the older share
      await expect(page.locator('.btn-you')).toHaveCount(0);
      await expect(page.locator('details.deeper #save')).toHaveClass(/\bbtn-2\b/);
      await expect(page.locator('details.deeper #grid-body tr')).toHaveCount(y1 - y0 + 1);
      await expect(page.locator('details.deeper summary > .deeper-in')).toContainText(' · ');
      await expect(page.locator('details.deeper #lede')).toContainText(`OAS can start at ${oasAge}`);
      await expect(page.locator('details.view #place')).toHaveCount(1);
      await expect(page.locator('#readings')).toHaveCount(0);
      expect(await page.locator('body').innerText()).not.toMatch(/\bNo\. \d/);
    });

    test('the chart reads the square under the pointer', async ({ page }) => {
      await page.goto(url);
      const heat = page.locator('#heat'); await heat.scrollIntoViewIfNeeded();
      const b = await heat.boundingBox();
      await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
      await expect(page.locator('#heat .crosshair')).toBeVisible();
      await expect(page.locator('#heat .crosshair text')).toContainText('Age ');
      await expect(page.locator('#heat .crosshair text')).toContainText('people');
      await expect(page.locator('#point')).toContainText('July 1, ');
      await expectTextSizes(page);
      await page.click('#age-down');
      await expect(page.locator('#heat .crosshair')).toHaveCount(1);
    });

    test('every piece of text renders at 17.5px or more, chart text included, in each state', async ({ page }) => {
      await page.goto(url);
      await expectTextSizes(page);
      await openView(page);
      await page.check('input[name=mode][value=share]');
      await setAge(page, a1);
      await expectTextSizes(page);
      for (const d of await page.locator('details summary').all()) { if (!(await d.evaluate((e) => e.parentElement.open))) await d.click(); }
      await expectTextSizes(page);
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await expectTextSizes(page);
    });

    test('no chart text overlaps, for several ages in both modes', async ({ page }) => {
      await page.goto(url);
      await openView(page);
      for (const mode of ['count', 'share']) {
        await page.check(`input[name=mode][value=${mode}]`);
        for (const a of [a0, a0 + 5, oasAge - 1, oasAge, oasAge + 5, a1 - 9, a1 - 3, a1]) {
          await setAge(page, a);
          expect(await clashes(page), `age ${a}, ${mode}`).toEqual([]);
          expect(await page.locator('#heat g.tag-g').count(), `age ${a}: a tag per reading or merged group`).toBeGreaterThan(0);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('saving the chart makes a PNG in the page (download where the share sheet takes no files)', async ({ page }) => {
      await page.goto(url);
      await page.locator('details.deeper > summary').click();
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
      expect(dl.suggestedFilename()).toBe(`retirement-wave-CA-age-${oasAge - 1}.png`);
      await expectStorageClean(page);
    });

    test('attribution, table number, dates, notes, the education and AI lines; no advice', async ({ page }) => {
      await page.goto(url);
      for (const d of await page.locator('details summary').all()) await d.click();
      const t = await page.locator('body').innerText();
      for (const s of [snap.attribution, 'Table 17-10-0005-01', snap.released, snap.retrieved, 'doi.org/10.25318/1710000501-eng', 'preliminary postcensal',
        'Education only, not advice.', 'Made with AI assistance; every figure is checked at its source.', 'Every figure here is computed from the dated public data named below.']) expect(t).toContain(s);
      expect(t).not.toMatch(/\byou should\b|\bshould\b|\bwe recommend\b|\brecommend\b|best for you/i);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        let r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
        for (const d of await page.locator('details summary').all()) await d.click();
        await setAge(page, a0 - 1);
        await setAge(page, a1); // the stepper's end, with a disabled step
        r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
      });
    }
  });
}
