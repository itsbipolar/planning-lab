import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes, expectTemplate, expectReducedMotion } from '../../../shared/desk/shell-test.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const html = readFileSync(file, 'utf8');
const M = JSON.parse(html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<'));
const N = M.now;

// types a year (and an amount): the page follows as the visitor types, with no button
async function choose(page, year, amount) {
  if (amount != null) await page.fill('#amount', String(amount));
  await page.fill('#year', String(year));
}
async function openDeeper(page) {
  if (!(await page.locator('#deeper').evaluate((d) => d.open))) await page.locator('#deeper > summary').click();
  await expect(page.locator('#rates .sel-line')).toHaveCount(1);
}
async function clashes(page, sel) {
  const boxes = await page.locator(`${sel} text`).evaluateAll((ts) => ts.filter((t) => t.textContent.trim() && !t.closest('.crosshair')).map((t) => { const b = t.getBBox(); return [b.x, b.y, b.width, b.height, t.textContent]; }));
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    if (a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1) out.push(`${a[4]} / ${b[4]}`);
  }
  const vb = await page.locator(sel).evaluate((s) => [s.viewBox.baseVal.width, s.viewBox.baseVal.height]);
  for (const b of boxes) if (b[0] < -0.5 || b[0] + b[2] > vb[0] + 0.5 || b[1] < -0.5 || b[1] + b[3] > vb[1] + 0.5) out.push(`${b[4]} is clipped`);
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

    test('the desk template budgets pass, and reduced motion makes every change instant', async ({ page }) => {
      await page.goto(url);
      const m = await expectTemplate(page);
      if (width === 390) {
        expect(m.firstTop).toBeLessThanOrEqual(700);
        expect(m.answerTop).toBeLessThanOrEqual(700);
        // the big answer's figure ends inside the first phone screen too
        expect(await page.evaluate(() => document.querySelector('#answer-v').getBoundingClientRect().bottom + scrollY)).toBeLessThanOrEqual(700);
        // the way to This year in money is in the first screen
        expect(await page.evaluate(() => document.querySelector('#ty-link').getBoundingClientRect().bottom + scrollY)).toBeLessThanOrEqual(700);
      }
      await expect(page.locator('#example-note')).toHaveAttribute('data-assumptions', '');
      await expect(page.locator('#example-note')).toContainText('consumer prices');
      await expect(page.locator('details.deeper > summary')).toHaveText(/^Go deeper/);
      await expect(page.locator('details.deeper .deeper-in')).toHaveText('What about interest rates? · What the years say · Every year as a table');
      const was = await page.locator('#answer-v').textContent();
      const now = await expectReducedMotion(page, (p) => p.locator('#ychips button', { hasText: '1970' }).click());
      expect(now).toContain('$100 in 1970');
      expect(await page.locator('#answer-v').textContent()).not.toBe(was);
    });

    test('opens on a labelled example; typing a year or an amount updates the answer at once; no request, nothing stored', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      const start = page.url();
      await expect(page.locator('h1')).toHaveText('What did $100 buy the year you were born?');
      await expect(page.locator('.kicker-row .kicker')).toHaveText('Data');
      await expect(page.locator('#form button:not(.ychip)')).toHaveCount(0); // no Show it button: the inputs are live
      await expect(page.locator('#example-note')).toContainText('example');
      await expect(page.locator('#answer-k')).toHaveText(`$100 in 1990, in ${M.last} dollars`);
      await expect(page.locator('#answer-v')).toHaveText(/^about \$[\d,]+$/);
      await expect(page.locator('#finding')).toHaveText(/^What cost \$100 in 1990 cost about \$[\d,]+ in \d{4}\.$/);
      await expect(page.locator('#tag-example')).toBeVisible();
      await expect(page.locator('#answer .readout-how')).not.toHaveAttribute('open', '');
      await page.locator('#answer .readout-how summary').click();
      await expect(page.locator('#how')).toContainText('consumer price index');

      await choose(page, 1950, 250);
      const expected = 250 * (M.avg[M.last] / M.avg[1950]);
      await expect(page.locator('#finding')).toContainText('What cost $250 in 1950');
      // the figure counts up after a change (300ms), then rests on the answer
      await expect.poll(async () => Math.abs(Number((await page.locator('#answer-v').textContent()).replace(/[^\d.]/g, '')) - expected) / expected).toBeLessThan(0.01);
      await expect(page.locator('#q-amount')).toHaveText('$250'); // the question follows the amount typed
      await expect(page.locator('#chart')).toContainText('$250 in 1950');
      await expect(page.locator('#example-note')).not.toContainText('example');
      await expect(page.locator('#tag-example')).toBeHidden();
      await expect(page.locator('#rows tr.sel')).toHaveAttribute('data-year', '1950');

      await page.fill('#year', '1800');
      await expect(page.locator('#error')).toBeVisible();
      await expect(page.locator('#error')).toContainText(`${M.first} to ${M.last}`);
      await expect(page.locator('#finding')).toContainText('1950');
      await page.fill('#year', '19'); // a year still being typed is not an error yet... but the old one stays
      await expect(page.locator('#finding')).toContainText('1950');
      await choose(page, 1990, 0);
      await page.press('#amount', 'Enter');
      await expect(page.locator('#error')).toContainText('amount');
      await choose(page, 1990, 100);
      await expect(page.locator('#error')).toBeHidden();
      await choose(page, M.last);
      await expect(page.locator('#answer-v')).toHaveText('$100');
      await expect(page.locator('#chart')).toContainText('Pick an earlier year');

      expect(requests).toEqual([]);
      expect(page.url()).toBe(start);
      await expectStorageClean(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('the year chips and the stripes set the page’s year; the stripes read a year aloud', async ({ page }) => {
      await page.goto(url);
      const chips = page.locator('#ychips button');
      await expect(chips).toHaveText(['1970', '1990', '2000', '2010']);
      await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true');
      for (const c of await chips.all()) expect((await c.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await chips.nth(2).click();
      await expect(page.locator('#year')).toHaveValue('2000');
      await expect(page.locator('#finding')).toContainText('in 2000');
      await expect(chips.nth(2)).toHaveAttribute('aria-pressed', 'true');

      const band = page.locator('#stripes');
      await expect(band).toHaveAttribute('role', 'slider');
      await expect(page.locator('#stripes .stripe')).toHaveCount(M.last - M.first + 1);
      await expect(band).toHaveAttribute('aria-valuenow', '2000');
      await expect(page.locator('#stripes .stripe.you')).toHaveAttribute('data-year', '2000');
      await band.focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#year')).toHaveValue('2001');
      await expect(page.locator('#stripe-read')).toHaveText(/^2001: prices (rose|fell) [\d.]+%$|^2001: prices were flat$/);
      await expect(band).toHaveAttribute('aria-valuetext', await page.locator('#stripe-read').textContent());
      await page.keyboard.press('Home');
      await expect(page.locator('#year')).toHaveValue(String(M.first));
      await page.keyboard.press('End');
      await expect(page.locator('#finding')).toContainText(`${M.last} is the latest full year`);
      await page.keyboard.press('PageDown');
      await expect(page.locator('#year')).toHaveValue(String(M.last - 10));
      // a tap on the band picks the year under it
      await band.scrollIntoViewIfNeeded();
      const b = await band.boundingBox(), n = M.last - M.first + 1, target = 1950;
      await page.mouse.click(b.x + (target - M.first + 0.5) * b.width / n, b.y + b.height / 2);
      await expect(page.locator('#year')).toHaveValue(String(target));
      await expect(page.locator('#finding')).toContainText('in 1950');
      await expect(page.locator('#stripe-read')).toContainText('1950: prices');
      // the band is one 44px-plus target
      expect(b.height).toBeGreaterThanOrEqual(44);
      await expectStorageClean(page);
    });

    test('guess, then reveal: hidden until the first result, then revealed or skipped', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('#guess')).toBeHidden();
      await page.locator('#ychips button', { hasText: '1970' }).click();
      await expect(page.locator('#guess')).toBeVisible();
      await expect(page.locator('#guess .guess-q')).toHaveText(`Now guess: what did $100 from ${M.first} cost in ${M.last}?`);
      await page.locator('#guess button', { hasText: 'Reveal' }).click();
      await expect(page.locator('#guess .guess-out')).toContainText(/^About \$[\d,]+\. You guessed \$[\d,]+/);
      await page.reload();
      await page.locator('#ychips button', { hasText: '2000' }).click();
      await page.locator('#guess button', { hasText: 'Skip' }).click();
      await expect(page.locator('#guess')).toBeHidden();
      await expect(page.locator('#answer')).toBeFocused();
    });

    test('This year in money: closed, opened by its link or by #this-year; the proposals first, labelled as proposals', async ({ page }) => {
      await page.goto(url);
      const ty = page.locator('#this-year');
      await expect(ty).not.toHaveAttribute('open', '');
      await page.locator('#ty-link').click();
      await expect(ty).toHaveAttribute('open', '');
      expect(new URL(page.url()).hash).toBe('#this-year');
      await expectStorageClean(page);
      // the budget's proposals come first, each stamped as not yet law, with the source linked
      const first = await page.evaluate(() => [...document.querySelectorAll('#this-year section')].map((s) => s.className));
      expect(first[0]).toBe('ty-budget');
      await expect(page.locator('#h-budget')).toHaveText(`What ${N.budgetName} proposes`);
      await expect(page.locator('#proposals .card')).toHaveCount(N.proposals.length);
      for (const s of await page.locator('#proposals .stamp').allTextContents()) expect(s).toMatch(/not yet law$/);
      await expect(page.locator('#proposals .stamp').first()).toHaveText('Proposed, not yet law');
      await expect(page.locator('#budget-lede a')).toHaveAttribute('href', N.budgetUrl);
      for (const p of N.proposals) await expect(page.locator('#proposals')).toContainText(p.value);
      // then the four measures, start to now, with sparklines and the Bank's attribution
      await expect(page.locator('#pairs .pair')).toHaveCount(4);
      await expect(page.locator('#pairs .pair-k')).toHaveText(['Bank of Canada rate', 'Posted 5-year mortgage', 'Core inflation (CPI-trim)', 'US$1 in C$']);
      for (const p of N.panels) await expect(page.locator('#pairs')).toContainText(`${p.summary.from} → ${p.summary.to}`);
      await expect(page.locator('#pairs svg.spark')).toHaveCount(4);
      await expect(page.locator('#ty-attr')).toContainText('Not affiliated with or endorsed by the Bank of Canada');
      await expect(page.locator('#ty-attr a')).toHaveAttribute('href', N.source.terms_url);
      // what money-year said, kept in the merge: the year's finding, every callout, both inflation lines named, Budget
      // Day's line and date, and the numbers month by month
      await expect(page.locator('#ty-finding')).toContainText('The Bank of Canada');
      for (const p of N.panels) for (const c of p.callouts) await expect(page.locator('#pairs')).toContainText(c.text);
      for (const l of N.panels.find((p) => p.id === 'inflation').lines) await expect(page.locator('#pairs .pair-key')).toContainText(l.label);
      if (N.budgetDay) {
        expect(await page.locator('#pairs svg.spark .spark-budget').count()).toBeGreaterThan(0);
        await expect(page.locator('#ty-asof')).toContainText(`The dashed upright line marks ${N.budgetName}`);
      }
      await expect(page.locator('#ty-head th')).toHaveCount(1 + N.panels.reduce((n, p) => n + p.lines.length, 0));
      expect(await page.locator('#ty-rows tr').count()).toBeGreaterThan(0);
      // the address alone opens it
      await page.goto('about:blank');
      await page.goto(url + '#this-year');
      await expect(page.locator('#this-year')).toHaveAttribute('open', '');
      await expect.poll(() => page.evaluate(() => document.querySelector('#this-year').getBoundingClientRect().top)).toBeLessThan(300);
      await expectStorageClean(page);
    });

    test('Go deeper: interest rates, the readings and the table; the sources carry every attribution', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('#deeper')).not.toHaveAttribute('open', '');
      await openDeeper(page);
      await expect(page.locator('#rk-year')).toHaveText('The example year, 1990');
      await expect(page.locator('#rv-prime')).toHaveText(/%$/);
      await expect(page.locator('#rates-title')).toHaveText(/^Prime .* above prices$/);
      await expect(page.locator('#rates .sel-line')).toHaveAttribute('data-year', '1990');
      await choose(page, 1950, 250);
      await expect(page.locator('#rk-year')).toHaveText('The year you picked, 1950');
      await expect(page.locator('#rv-prime')).toHaveText('No data');
      await expect(page.locator('#rt-year')).toContainText(`The prime-rate series here starts in ${M.primeFirst}`);
      await expect(page.locator('#rates .sel-line')).toHaveAttribute('data-year', '1950');
      await expect(page.locator('#readings li').first()).toContainText(`Prices rose in`);
      await expect(page.locator('#rows tr')).toHaveCount(M.last - M.first + 1);
      expect((await page.locator('#rates-text li').allTextContents()).length).toBe(3);
      await page.locator('.sources-fold summary').click();
      await expect(page.locator('#sources')).toContainText(M.meta.cpi.attribution);
      await expect(page.locator('#sources')).toContainText(M.meta.rate.attribution);
      await expect(page.locator('#sources')).toContainText(N.source.attribution);
      await expect(page.locator(`#sources a[href="${N.budgetUrl}"]`)).toHaveCount(1);
      await expect(page.locator('#sources')).toContainText('#ShowYourStripes warming stripes by Professor Ed Hawkins');
      // the crosshair on the rates chart
      const svg = page.locator('#rates'); await svg.scrollIntoViewIfNeeded();
      const b = await svg.boundingBox();
      await page.mouse.move(b.x + 2, b.y + b.height * 0.5);
      await expect(svg.locator('.crosshair text')).toContainText(`${M.first}Prices`);
      await expect(svg.locator('.crosshair text')).toContainText('No prime-rate data');
    });

    test('no two labels on either chart overlap, and none is clipped', async ({ page }) => {
      await page.goto(url);
      await openDeeper(page);
      for (const y of [M.first, 1950, 1970, 1990, 2010, M.last - 1, M.last]) {
        await choose(page, y);
        await expect(page.locator('#rates .sel-line')).toHaveAttribute('data-year', String(y));
        await expect(page.locator('#chart .lbl').first()).toHaveText(`$100 in ${y}`); // the start reading is always placed
        if (y < M.last) await expect(page.locator('#chart')).toContainText(new RegExp(`\\$[\\d,]+ in ${M.last}`));
        expect(await clashes(page, '#chart'), `line chart, ${y}`).toEqual([]);
        expect(await clashes(page, '#rates'), `rates chart, ${y}`).toEqual([]);
      }
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await choose(page, 1990, 1234567);
      expect(await clashes(page, '#chart'), 'a large amount, dark').toEqual([]);
      // the line chart's crosshair reads any year
      const svg = page.locator('#chart'); await svg.scrollIntoViewIfNeeded();
      const b = await svg.boundingBox();
      await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
      await expect(svg.locator('.crosshair text')).toContainText(/^\d{4}\$1,234,567 from 1990: \$[\d,]+That year prices/);
    });

    test('the chart saves as an image made in the browser', async ({ page }) => {
      await page.goto(url);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
      expect(dl.suggestedFilename()).toBe('money-then-now-1990.png');
      await expect(page.locator('.save-note')).toHaveCount(0); // not an in-app browser
    });

    test('a birth year carried from Your year opens the page, adds its chip and the tool-bar chip', async ({ page }) => {
      await page.addInitScript(() => { try { sessionStorage.setItem('mo.year', '1980'); } catch (e) {} });
      await page.goto(url);
      await expect(page.locator('#year')).toHaveValue('1980');
      await expect(page.locator('#ychips button').first()).toHaveText('Your year: 1980');
      await expect(page.locator('#ychips button').first()).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-year-chip]')).toBeVisible();
      await expect(page.locator('[data-year-chip-y]')).toHaveText('1980');
      await page.locator('[data-year-change]').click();
      await expect(page.locator('#year')).toBeFocused();
      await expect(page.locator('#guess')).toBeHidden(); // the carried year is not the visitor's first move on this page
      await expectStorageClean(page);
    });

    test('every piece of text renders at 17.5px or more, chart labels included, in both schemes', async ({ page }) => {
      await page.goto(url);
      await expectTextSizes(page);
      await choose(page, M.first, 1234567);
      await expectTextSizes(page);
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await choose(page, M.last - 1, 250);
      for (const d of await page.locator('details summary').all()) await d.click();
      await expect(page.locator('#rates .sel-line')).toHaveCount(1);
      await expectTextSizes(page);
      const svg = page.locator('#chart'); await svg.scrollIntoViewIfNeeded();
      const b = await svg.boundingBox();
      await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5);
      await expect(svg.locator('.crosshair')).toBeVisible();
      await expectTextSizes(page);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await page.locator('#ychips button', { hasText: '1970' }).click(); // the guess shows
        for (const d of await page.locator('details summary').all()) await d.click();
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
      });
    }
  });
}
