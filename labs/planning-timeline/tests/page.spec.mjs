// Your year (redesign v2, step 5): the desk template (one live year control, one big answer, one assumptions line, one
// chart above the fold at most, a closed Go deeper), the box score in the tense for the visitor's year (tested for
// 1950, 1962 and 1980), the cohort row only for ages the snapshot covers, Save my card, the year chip, text sizes,
// overlap checks and axe in both schemes. Every expected figure is worked out here from the facts and the shared core.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes, expectTemplate, expectReducedMotion } from '../../../shared/desk/shell-test.mjs';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { yourYearRules, annualPrices, yourYear } from '../../../shared/desk/your-year-core.mjs';
import { buildModel, person, boxScore } from '../model.mjs';

const shared = (p) => JSON.parse(readFileSync(new URL(`../../../shared/${p}`, import.meta.url), 'utf8'));
const facts = shared('facts.json'), pop = shared('data/population-by-age.json'), cpi = shared('data/cpi-monthly.json');
const CORE = { R: yourYearRules(facts), P: annualPrices(cpi) };
const M = buildModel(facts, pop, cpi);
const lastLimit = Math.max(...Object.keys(CORE.R.tfsa).map(Number));

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const setYear = async (page, y) => { await page.fill('#year', String(y)); await expect(page.locator('#box-h')).toContainText(String(y)); };
const rows = (page) => page.locator('#box .box-row').evaluateAll((rs) => rs.map((r) => ({
  key: r.dataset.row, label: r.querySelector('dt').textContent, value: r.querySelector('.box-v').textContent, line: r.querySelector('.box-t').textContent })));

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the tool shell and the desk template budgets; nothing stored on load', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectShell(page, 'planning-timeline');
      await expectStorageClean(page);
      const m = await expectTemplate(page);
      if (width === 390) {
        expect(m.firstTop).toBeLessThanOrEqual(700);
        expect(m.answerTop).toBeLessThanOrEqual(700);
        // the big figure itself is on the first phone screen, not only the readout's top
        const big = await page.locator('#cpi-now').boundingBox();
        expect(big.y + big.height, 'the big figure is inside the first 700px').toBeLessThanOrEqual(700);
      }
      await expect(page.locator('[data-year-control]')).toHaveCount(1);
      await expect(page.locator('[data-first-move] [data-year-control]')).toHaveCount(1);
      await expect(page.locator('button[type=submit], form')).toHaveCount(0); // live: no submit button
    });

    test('reduced motion: a year move writes the answer at once, nothing animates', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      const before = await page.locator('#cpi-now').textContent();
      const now = await expectReducedMotion(page, async (p) => { await p.click('.yy-chip[data-chip="1960"]'); });
      expect(now).not.toContain(before);
      const Y = yourYear(CORE.R, CORE.P, 1960, new Date().getFullYear());
      await expect(page.locator('#cpi-now')).toHaveText(Y.cpiNowText);
    });

    test('opens on the labelled 1980 example; the stepper, chips and field update live, keep the year for this visit, no request', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expect(page.locator('#example-note')).toContainText('Example: born 1980');
      await expect(page.locator('#year')).toHaveValue('1980');
      await expect(page.locator('.yy-chip[aria-pressed="true"]')).toHaveText('1980');
      await expect(page.locator('[data-year-chip]')).toBeHidden(); // nothing stored yet
      await page.click('[data-step="1"]');
      await expect(page.locator('#year')).toHaveValue('1981');
      await expect(page.locator('#example-note')).toContainText('born in 1981');
      expect(await page.evaluate(() => sessionStorage.getItem('mo.year'))).toBe('1981');
      await expect(page.locator('[data-year-chip]')).toBeVisible();
      await expect(page.locator('[data-year-chip-y]')).toHaveText('1981');
      await page.click('[data-step="-1"]'); await page.click('[data-step="-1"]');
      await expect(page.locator('#year')).toHaveValue('1979');
      await page.click('.yy-chip[data-chip="1990"]');
      await expect(page.locator('#year')).toHaveValue('1990');
      await expect(page.locator('.yy-chip[aria-pressed="true"]')).toHaveText('1990');
      await setYear(page, 1955);
      expect(await page.evaluate(() => sessionStorage.getItem('mo.year'))).toBe('1955');
      // a year outside the control's bounds is clamped when the field is left
      await page.fill('#year', '1800'); await page.locator('#year').blur();
      const min = Number(await page.locator('#year').getAttribute('min'));
      await expect(page.locator('#year')).toHaveValue(String(min));
      await expect(page.locator('[data-step="-1"]')).toBeDisabled();
      expect(Number(await page.locator('#year').getAttribute('max'))).toBe(lastLimit - CORE.R.tfsaAge);
      // the chip's "change" focuses the year control; nothing reaches the address
      await page.click('[data-year-change]');
      await expect(page.locator('#year')).toBeFocused();
      expect(requests).toEqual([]);
      await expectStorageClean(page);
      expect(await page.evaluate(() => [location.search, location.hash])).toEqual(['', '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      // "forget" goes back to the example
      await page.click('[data-year-forget]');
      await expect(page.locator('#example-note')).toContainText('Example: born 1980');
      expect(await page.evaluate(() => sessionStorage.getItem('mo.year'))).toBe(null);
    });

    test('the big answer is the shared core’s (the home lead’s) for 1960, 1980 and 2000', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      const thisYear = await page.evaluate(() => new Date().getFullYear());
      for (const b of [1960, 1980, 2000]) {
        const Y = yourYear(CORE.R, CORE.P, b, thisYear);
        await setYear(page, b);
        await expect(page.locator('#cpi-now')).toHaveText(Y.cpiNowText);
        await expect(page.locator('#answer .readout-k')).toHaveText(`Prices since ${b}`);
        await expect(page.locator('#answer-t')).toHaveText(`What $100 bought in ${b} cost this much in ${Y.cpiLatestYear}.`);
        const tfsa = (await rows(page)).find((r) => r.key === 'tfsa');
        expect(tfsa.value).toBe('$' + Y.tfsaSum.toLocaleString('en-CA'));
        // the sum stops at the last confirmed limit
        expect(tfsa.line).toContain(`${Y.tfsaStart} to ${lastLimit},`);
        expect(tfsa.line).toContain('before any contributions or withdrawals');
        await expect(page.locator('#tl-text')).toContainText(`(${Y.y60} to ${Y.y70} for you)`);
      }
      await expect(page.locator('#answer .readout-how')).not.toHaveAttribute('open', '');
    });

    test('the box score follows the tense: passed (1950), open now (1962), ahead (1980)', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      const thisYear = await page.evaluate(() => new Date().getFullYear());
      for (const b of [1950, 1962, 1980]) {
        await setYear(page, b);
        const got = await rows(page), want = boxScore(M, person(M, b, thisYear)), Y = yourYear(CORE.R, CORE.P, b, thisYear);
        expect(got.map((r) => [r.key, r.label, r.value, r.line])).toEqual(want.map((r) => [r.key, r.label, r.value, r.line]));
        const cpp = got.find((r) => r.key === 'cpp').value, oas = got.find((r) => r.key === 'oas').value, rrsp = got.find((r) => r.key === 'rrsp').value;
        const exp = (t, a, z) => (t === 'ahead' ? `Can start ${a} to ${z}` : t === 'open' ? `Can start any month until ${z}` : `Could start from ${a} (that window has passed)`);
        expect(cpp).toBe(exp(Y.cppTense, Y.y60, Y.y70));
        expect(oas).toBe(exp(Y.oasTense, Y.oasFrom, Y.oasTo));
        expect(rrsp).toBe(`${Y.rrspTense === 'past' ? 'Had to' : 'Must'} wind up by the end of ${Y.y71} (most become a RRIF)`);
        expect(got.find((r) => r.key === 'cpp').label).toBe('CPP, if you qualify');
        expect(got.find((r) => r.key === 'oas').label).toBe('OAS, if you meet the residence rules');
      }
      // in 2026 the three years are one of each tense
      if (thisYear === 2026) {
        await setYear(page, 1950); await expect(page.locator('[data-row=cpp] .box-v')).toContainText('that window has passed');
        await setYear(page, 1962); await expect(page.locator('[data-row=cpp] .box-v')).toContainText('any month until');
        await setYear(page, 1980); await expect(page.locator('[data-row=cpp] .box-v')).toHaveText(/^Can start \d{4} to \d{4}$/);
      }
      // the confirmed OAS increase at the later age, and the RRIF convention line
      const boost = facts.facts.find((f) => f.id === 'oas_age75_increase');
      await expect(page.locator('[data-row=oas] .box-t')).toContainText(`${boost.value}% more from ${M.oasBoostAge}`);
      await expect(page.locator('[data-row=rrsp] .box-t')).toHaveText(/^At least [\d.]+% must come out the year you turn \d+, rising to [\d.]+% from the year you turn \d+\.$/);
      // acronyms are spelled out once, on first use
      for (const a of ['TFSA', 'CPP', 'OAS', 'RRSP', 'RRIF']) await expect(page.locator(`#box abbr[title]`, { hasText: a })).toHaveCount(1);
    });

    test('the cohort row shows only for ages 50 to 89, and is absent otherwise', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      const thisYear = await page.evaluate(() => new Date().getFullYear());
      const [a0, a1] = pop.ages;
      await expect(page.locator('[data-row=cohort]')).toHaveCount(thisYear - 1980 >= a0 && thisYear - 1980 <= a1 ? 1 : 0); // the example
      for (const age of [a0 - 1, a0, a1, a1 + 1]) {
        const b = thisYear - age;
        await setYear(page, b);
        if (age < a0 || age > a1) { await expect(page.locator('[data-row=cohort]')).toHaveCount(0); continue; }
        const n = pop.values[String(pop.years[1])][age - a0];
        await expect(page.locator('[data-row=cohort] dt')).toHaveText(`Canadians aged ${age}`);
        await expect(page.locator('[data-row=cohort] .box-v')).toHaveText(n.toLocaleString('en-CA'));
        await expect(page.locator('[data-row=cohort] .box-t')).toContainText(`July 1, ${pop.years[1]}`);
      }
      await expect(page.locator('main')).not.toContainText(/not in (this|the) (snapshot|data)/i);
    });

    test('one life line chart with today marked and the gradient labelled; Go deeper holds the rest, closed', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      const thisYear = await page.evaluate(() => new Date().getFullYear());
      await expect(page.locator('#tl text.today')).toHaveText(`Today, age ${thisYear - 1980}`);
      await expect(page.locator('#tl text.grad-l')).toContainText(/Early: smaller|Start early: smaller cheque/);
      await expect(page.locator('#tl text.grad-r')).toHaveText('Wait: bigger');
      await expect(page.locator('#tl-example')).toBeVisible();
      await expect(page.locator('figure.chart:not(details figure)')).toHaveCount(1);
      const deeper = page.locator('details.deeper');
      await expect(deeper).not.toHaveAttribute('open', '');
      await expect(deeper.locator('summary > .deeper-in')).toContainText(' · ');
      for (const id of ['#rrif-chart', '#cpp-chart', '#oas-chart']) await expect(deeper.locator(id)).toHaveCount(1);
      await expect(deeper.locator('a[href="/tools/when-to-start-cpp/"]')).toHaveCount(1);
      await page.click('details.deeper > summary');
      // drawn at the fold's width once open
      const fw = await deeper.locator('#rrif-chart').evaluate((s) => [Number(s.getAttribute('width')), s.parentNode.clientWidth]);
      expect(fw[0]).toBeGreaterThanOrEqual(Math.min(fw[1], 280) - 1);
      const slider = await page.locator('#oas-range').evaluate((r) => Number(r.min) / 12);
      expect(slider, 'the OAS slider never goes below the earliest OAS age').toBe(CORE.R.oasLo);
    });

    test('in Go deeper, each result is a readout under its control and changes with it; each totals chart reads out under the pointer', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await page.click('details.deeper > summary');
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
      }
      await expect(page.locator('#cpp-text')).toContainText('less every month');
      await page.locator('#cpp-range').focus(); await page.keyboard.press('End');
      await expect(page.locator('#cpp-text')).toContainText('catches up');
      for (const [input, big, v] of [['#income', '#rec-big', '150000'], ['#fund', '#fund-big', '250000']]) {
        const before = await page.locator(big).textContent();
        await page.fill(input, v);
        await expect(page.locator(big)).not.toHaveText(before);
        await expect(page.locator(big)).toHaveText(/^\$[\d,]+$/);
      }
      for (const id of ['#cpp-chart', '#oas-chart']) {
        const svg = page.locator(id); await svg.scrollIntoViewIfNeeded();
        const b = await svg.boundingBox();
        await page.mouse.move(b.x + b.width * 0.6, b.y + b.height / 2);
        await expect(page.locator(`${id} .crosshair`)).toBeVisible();
        await expect(page.locator(`${id} .crosshair text`)).toContainText('At age');
      }
      await page.locator('#cpp-range').focus(); await page.keyboard.press('Home');
      await expect(page.locator('#cpp-chart .crosshair')).toHaveCount(1);
    });

    test('Save my card: a 1080x1350 PNG made in the page, downloaded when the share sheet cannot take it', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await page.evaluate(() => { try { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); } catch (e) {} });
      await setYear(page, 1966);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
      expect(dl.suggestedFilename()).toBe('your-year-1966.png');
      const buf = readFileSync(await dl.path());
      expect(buf.subarray(1, 4).toString()).toBe('PNG');
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([1080, 1350]);
      await expect(page.locator('.save-note')).toHaveCount(0); // not an in-app browser
      await expectStorageClean(page);
    });

    test('words: the question as the H1, one-word kicker, no advice words, one assumptions line by the control', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      const h1 = (await page.locator('h1').textContent()).trim();
      expect(h1).toBe('What opens, and when, for your year?');
      expect(h1.split(/\s+/).length).toBeLessThanOrEqual(12);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.kicker')).toHaveText('Tool');
      await expect(page.locator('.btn-you')).toHaveCount(0);
      await expect(page.locator('#example-note')).toContainText('rules as of');
      const c = await page.locator('.yy-chips').boundingBox(), n = await page.locator('#example-note').boundingBox();
      expect(n.y - (c.y + c.height)).toBeLessThan(40);
      for (const f of await page.locator('figure.chart').all()) await expect(f.locator('.chart-title')).not.toBeEmpty();
      await page.click('details.deeper > summary');
      for (const d of await page.locator('details.sources').all()) await d.locator('summary').click();
      const body = await page.locator('main').innerText();
      expect(body).not.toMatch(/\b(should|recommend\w*)\b|best for you|best age/i);
      expect(body).not.toMatch(/must become a RRIF/i);
      await expect(page.locator('#rrif-convention')).toContainText('January 1');
    });

    test('every rendered text is 17.5px or more (labels too), chart labels included, in each state', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectTextSizes(page);
      for (const y of [1950, 1962, 1990, 2008]) { await setYear(page, y); await expectTextSizes(page); }
      // the chart and template labels this page draws are 17.5px or more (the shared nav is checked by expectShell)
      const small = await page.locator('main svg text, main .readout-k, main .chip, main .sec-label, main .box-row dt').evaluateAll((ts) => ts.filter((t) => t.textContent.trim() && t.getBoundingClientRect().width > 0)
        .map((t) => [t.textContent.slice(0, 30), parseFloat(getComputedStyle(t).fontSize) * (t.ownerSVGElement ? t.ownerSVGElement.getScreenCTM().a : 1)]).filter((x) => x[1] < 17.49));
      expect(small).toEqual([]);
      for (const d of await page.locator('details summary').all()) await d.click();
      await expectTextSizes(page);
      for (const r of ['#cpp-range', '#oas-range']) { await page.locator(r).focus(); await page.keyboard.press('Home'); }
      await expectTextSizes(page);
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

    test('labels on the life line, the totals and the RRIF charts do not overlap', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      const clashes = (sel) => page.locator(sel).evaluateAll((ts) => {
        const b = ts.filter((t) => t.textContent.trim()).map((t) => { const r = t.getBBox(); return [r.x, r.y, r.width, r.height, t.textContent]; }), out = [];
        for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
          const [p, q] = [b[i], b[j]];
          if (p[0] < q[0] + q[2] - 1 && q[0] < p[0] + p[2] - 1 && p[1] < q[1] + q[3] - 1 && q[1] < p[1] + p[3] - 1) out.push(`${p[4]} / ${q[4]}`);
        }
        return out;
      });
      for (const y of [1930, 1950, 1962, 1980, 1990, 2008]) { await setYear(page, y); expect(await clashes('#tl text'), `born ${y}`).toEqual([]); }
      // the life line's text stays inside the chart
      const out = await page.locator('#tl text').evaluateAll((ts) => { const W = Number(ts[0].ownerSVGElement.getAttribute('width')); return ts.map((t) => t.getBBox()).filter((b) => b.x < -1 || b.x + b.width > W + 1).length; });
      expect(out).toBe(0);
      await page.click('details.deeper > summary');
      for (const [range, id] of [['#cpp-range', '#cpp-chart'], ['#oas-range', '#oas-chart']]) {
        await page.locator(range).focus();
        for (const key of ['End', 'Home', 'ArrowRight', 'PageUp', 'PageUp']) { await page.keyboard.press(key); expect(await clashes(`${id} > text`), `${id} after ${key}`).toEqual([]); }
      }
      expect(await clashes('#rrif-chart > text')).toEqual([]);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await setYear(page, 1962);
        for (const d of await page.locator('details summary').all()) await d.click();
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
      });
    }
  });
}
