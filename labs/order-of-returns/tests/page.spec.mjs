import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes, expectTemplate, expectReducedMotion } from '../../../shared/desk/shell-test.mjs';
import { simulate, average } from '../engine.mjs';
import { yearsLasted, atLeastAsLong } from '../enumerate.mjs';
import { toolFor } from '../../../shared/desk/desk-page.mjs';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// the one assumptions line (redesign v2: said once, near the top); every chart carries an "Example data" tag instead of
// repeating it
const ASSUME = 'Made-up returns, not history or a forecast. No taxes, fees or benefits. Education, not advice.';
const ready = (page) => page.waitForFunction(() => document.body.dataset.enumMs, null, { timeout: 30000 });
const network = (u) => !/^(data|blob):/.test(u);

// every pair of text labels inside every chart: none may overlap
async function overlaps(page) {
  return page.evaluate(() => {
    const out = [];
    for (const svg of document.querySelectorAll('figure svg')) {
      const boxes = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim() && !t.closest('.crosshair')).map((t) => ({ t: t.textContent, r: t.getBoundingClientRect() }));
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r, b = boxes[j].r;
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`${svg.id}: "${boxes[i].t}" / "${boxes[j].t}"`);
      }
    }
    return out;
  });
}

test('banned phrases are nowhere on the page', () => {
  const text = readFileSync(file, 'utf8').replace(/data:[^"')]+/g, '');
  for (const re of [/safe withdrawal/i, /withdrawal rate/i, /you should/i, /\brecommend(s|ed)?\b/i, /guarantee/i, /\b(ETF|mutual fund|index fund|S&P|TSX)\b/, /\bCFP\b/, /financial (planner|advisor)/i])
    expect(text, String(re)).not.toMatch(re);
});

// the deal's answer, worked out here from the engine and the shipped distribution, to check the page against
const story = JSON.parse(readFileSync(new URL('../story.json', import.meta.url)));
const DIST = JSON.parse(readFileSync(new URL('../distribution.json', import.meta.url)));
const AVG = average(story.cards), TAIL = Array(story.horizon - story.cards.length).fill(AVG);
const intF = new Intl.NumberFormat('en-CA');
const share = (n, d) => { const p = n / d * 100; if (p > 0 && p < 0.1) return 'under 0.1%'; if (p < 100 && p > 99.9) return 'over 99.9%'; return (Math.round(p * 10) / 10).toFixed(p >= 10 ? 0 : 1) + '%'; };
async function dealtOrder(page) {
  const faces = await page.locator('#deck-cards .card-face').allTextContents();
  return faces.map((t) => { const p = Number(t.replace('−', '-').replace('%', '').replace('+', '')); return story.cards.find((c) => Math.round(c * 100) === p); });
}
// guessOpen: the guess is still waiting, so a full-length deal does not give its share away
function expected(order, guessOpen = false) {
  const r = simulate({ start: story.start, withdrawal: story.withdrawal, indexation: story.indexation, returns: order.concat(TAIL) });
  const y = yearsLasted(r.depletionYear || 0, story.horizon);
  const full = `Like ${share(DIST.lasts, DIST.total)} of all ${intF.format(DIST.total)} orders, it lasts the full ${story.horizon} years.`;
  const line = r.depletionYear ? `It lasts at least as long as ${share(atLeastAsLong(DIST, y), DIST.total)} of all ${intF.format(DIST.total)} orders.`
    : guessOpen ? `It lasts the full ${story.horizon} years. What share of orders do? Guess below.` : full;
  return { value: `${y} ${y === 1 ? 'year' : 'years'}`, line, y, after: r.depletionYear ? line : full };
}
const pngSize = (p) => { const b = readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the tool shell and the desk template budgets: one first move, one answer, one assumptions line, Go deeper closed', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectShell(page, 'order-of-returns');
      const m = await expectTemplate(page);
      if (width === 390) {
        expect(m.firstTop).toBeLessThanOrEqual(700);
        expect(m.answerTop).toBeLessThanOrEqual(700);
        expect(m.deeperTop).toBeLessThanOrEqual(2800);
      }
      await expect(page.locator('[data-first-move] #deal')).toHaveText('Deal my ten years');
      await expect(page.locator('[data-first-move] #one')).toHaveText('Deal one at a time');
      await expect(page.locator('#deck-cards .card')).toHaveCount(10);
      await expect(page.locator('#deck-cards .card.up')).toHaveCount(0);
      await expectStorageClean(page);
    });

    test('deal-first: the answer, the tie-aware share from the distribution, the tally, the guess and Save my card', async ({ page }) => {
      const requests = [], errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => { if (network(r.url())) requests.push(r.url()); });

      // the question leads; before a deal the answer is face down and the line holds the finding
      await expect(page.locator('h1')).toHaveText(toolFor('order-of-returns').question);
      await expect(page.locator('#answer-v')).toHaveText('?');
      await expect(page.locator('#answer-t')).toHaveText('Ruth’s order lasts all 25 years. Sam’s lasts 19 years.');
      await expect(page.locator('#guess')).toBeHidden();
      await expect(page.locator('#save-row')).toBeHidden();
      await expect(page.locator('#tally')).toBeHidden();

      // deal: every card turns, the answer and its share match the engine and the distribution
      await page.locator('#deal').focus(); await page.keyboard.press('Enter');
      await expect(page.locator('#deck-cards .card.up')).toHaveCount(10);
      const e1 = expected(await dealtOrder(page), true);
      await expect(page.locator('#answer-v')).toHaveText(e1.value);
      await expect(page.locator('#answer-t')).toHaveText(e1.line);
      await expect(page.locator('#deal')).toHaveText('Deal again');
      await expect(page.locator('#tally')).toHaveText(`Deals 1 · Longest ${e1.value} · Shortest ${e1.value}`);
      await expect(page.locator('#c-deal path.s-you')).toHaveCount(1);
      await expect(page.locator('#c-strip rect.f-you')).toHaveCount(1);
      await expect(page.locator('#c-why text', { hasText: 'This order' })).toHaveCount(1);

      // the bridge: a guess after the first deal, then the share of all orders that last
      await expect(page.locator('#guess')).toBeVisible();
      await expect(page.locator('#guess .guess-q')).toHaveText('What share of all orders last the full 25 years?');
      await page.locator('#guess button', { hasText: 'Reveal' }).click();
      await expect(page.locator('#guess .guess-out')).toHaveText(`${share(DIST.lasts, DIST.total)}. You guessed 50%.`);
      await expect(page.locator('#answer-t')).toHaveText(e1.after);

      // deal again: the tally counts deals and keeps the longest and shortest, in memory only
      await page.click('#deal');
      const e2 = expected(await dealtOrder(page));
      await expect(page.locator('#answer-v')).toHaveText(e2.value);
      const big = Math.max(e1.y, e2.y), small = Math.min(e1.y, e2.y);
      await expect(page.locator('#tally')).toHaveText(`Deals 2 · Longest ${big} years · Shortest ${small} years`);

      // one at a time: a card per press, the path drawn so far, the answer once all ten are down
      await page.locator('#one').focus(); await page.keyboard.press('Enter');
      await expect(page.locator('#deck-cards .card.up')).toHaveCount(1);
      await expect(page.locator('#answer-t')).toContainText('1 of 10 dealt');
      await expect(page.locator('#answer-v')).toHaveText('?');
      for (let i = 0; i < 9; i++) await page.keyboard.press('Enter');
      await expect(page.locator('#deck-cards .card.up')).toHaveCount(10);
      const e3 = expected(await dealtOrder(page));
      await expect(page.locator('#answer-v')).toHaveText(e3.value);
      await expect(page.locator('#tally')).toContainText('Deals 3');

      // Save my card: a 1080x1350 PNG made in this browser
      const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#save').click()]);
      expect(dl.suggestedFilename()).toBe('order-of-returns-my-card.png');
      expect(pngSize(await dl.path())).toEqual([1080, 1350]);

      expect(errors).toEqual([]);
      expect(requests).toEqual([]);
      expect(page.url()).toBe(url);
      await expectStorageClean(page);
    });

    test('Go deeper: no withdrawals, every order, the rescue and the RRIF lane, with nothing stored or sent', async ({ page }) => {
      const requests = [], errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => { if (network(r.url())) requests.push(r.url()); });
      await ready(page);
      await expect(page.locator('#deeper')).not.toHaveAttribute('open', '');
      await expect(page.locator('#deeper .deeper-in')).toHaveText('No withdrawals · Rescuing Sam · Every possible order · A Canadian lane: RRIF minimums · Taking it further');
      await page.locator('#deeper > summary').click();

      // no withdrawals: shuffling changes nothing
      const h = await page.locator('#h-shuffle').innerText();
      const end = h.match(/(\$[\d,]+)$/)[1];
      await page.locator('#shuffle').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      await expect(page.locator('#rv-shuffle')).toHaveText(end);
      await expect(page.locator('#s-shuffle')).toHaveText('Same ending as Ruth: with nothing taken out, the order of the years doesn’t matter.');

      // every order: 10! orders, Ruth best, Sam worst; the method lines live on the making-of page now
      await expect(page.locator('#run-text')).toContainText('All 3,628,800 orders worked out in this browser');
      await expect(page.locator('#s-all')).toContainText('Ruth has the best order; Sam has the worst.');
      expect((await page.locator('#h-all').textContent()).split(/\s+/).length).toBeLessThanOrEqual(12);
      expect(await page.locator('body').innerText()).not.toContain('Better means');
      await page.click('#deal');
      await expect(page.locator('#c-all text', { hasText: 'This order' })).toHaveCount(1);
      await expect(page.locator('#s-early')).toContainText('This order’s first five average');

      // the rescue: the solver headline, three small multiples, Mix your own; no share of all orders here
      await expect(page.locator('#h-rescue')).toHaveText(/^Sam’s money lasts if his first withdrawal is \$[\d,]+ or less$/);
      await expect(page.locator('#p-solver')).not.toContainText('until the largest');
      await expect(page.locator('#levers figure')).toHaveCount(3);
      await page.locator('#flex').focus(); await page.keyboard.press('Space');
      const mix = await page.locator('#s-mix').innerText();
      expect(mix).toContain('still runs out in year 20, the same year as before');
      expect(mix.match(/year 20/g).length, 'the sentence does not repeat itself').toBe(1);
      await page.locator('#flex').focus(); await page.keyboard.press('Space');
      await page.locator('#buffer').focus(); await page.keyboard.press('Space');
      await expect(page.locator('#s-mix')).toContainText('runs out in year 18, two years sooner than before (year 20)');
      expect(await page.locator('section[data-chapter="Rescuing Sam"]').innerText()).not.toMatch(/at least as long as|of all 3,628,800 orders/);
      await page.locator('#w').focus();
      for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
      expect(await page.locator('#w').getAttribute('aria-valuetext')).toBe('$24,500');

      // the RRIF lane: off by default; on, it runs every order again; its sources are in the one Sources fold
      await expect(page.locator('#rrif')).not.toBeChecked();
      await page.locator('#rrif').focus(); await page.keyboard.press('Space');
      await expect(page.locator('#s-rrif')).toContainText('Across all 3,628,800 orders, the RRIF is empty before the end of year 25', { timeout: 30000 });
      await expect(page.locator('#s-rr-ruth')).toContainText('the minimum takes out');
      await expect(page.locator('#s-rr-sam')).toContainText('no change');
      await expect(page.locator('#src-list a')).toHaveCount(2);

      // honest labels: one assumptions line, said once; every chart tagged as example data; no overlaps; full-size text
      await expect(page.locator('#assume')).toHaveText(ASSUME);
      expect(await page.locator('body').innerText()).not.toContain('Synthetic sequence');
      for (const svg of await page.locator('figure svg').all()) await expect(svg.locator('xpath=ancestor::figure[contains(@class,"chart")][1]//span[contains(@class,"tag-example")]')).toHaveText('Example data');
      expect(await overlaps(page)).toEqual([]);
      await page.locator('details.table summary').click();
      await page.locator('#sources > summary').click();
      await expectTextSizes(page);
      await expect(page.locator('footer.foot p')).toHaveCount(3);
      expect(errors).toEqual([]);
      expect(requests).toEqual([]);
      expect(page.url()).toBe(url);
      await expectStorageClean(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}, with a deal, the guess, Go deeper open and the RRIF lane on`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
        await ready(page);
        await page.click('#deal');
        await page.locator('#deeper > summary').click();
        await page.check('#rrif');
        await expect(page.locator('#s-rrif')).toContainText('Across all', { timeout: 30000 });
        await page.locator('details.table summary').click();
        await page.locator('#sources > summary').click();
        await page.locator('.readout-how > summary').click();
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join('; ')}`)).toEqual([]);
        expect(await overlaps(page)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      });
    }
  });
}

// A readout sits directly under the control that drives it (within a short gap, same left edge give or take its rule).
async function under(page, control, readout) {
  const c = await page.locator(control).boundingBox(), r = await page.locator(readout).boundingBox();
  expect(r.y, `${readout} starts below ${control}`).toBeGreaterThanOrEqual(c.y + c.height - 1);
  expect(r.y - (c.y + c.height), `${readout} is right under ${control}`).toBeLessThan(64);
  expect(Math.abs(r.x - c.x), `${readout} lines up with ${control}`).toBeLessThan(24);
}

for (const width of [390, 1440]) {
  test.describe(`${width}px, the premium layer`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the answer sits top-right beside the headline (under the cards on a phone); each Go deeper readout sits under its control', async ({ page }) => {
      await page.goto(url); await ready(page);
      const cards = await page.locator('[data-first-move]').boundingBox(), ans = await page.locator('[data-answer]').boundingBox();
      if (width >= 900) {
        const head = await page.locator('.deal-head').boundingBox();
        expect(ans.x, 'the answer is to the right of the cards').toBeGreaterThan(cards.x + cards.width);
        expect(Math.abs(ans.y - head.y), 'level with the top of the question (no empty top-right)').toBeLessThan(24);
        const ys = await page.locator('#deck-cards .card').evaluateAll((cs) => cs.map((c) => Math.round(c.getBoundingClientRect().top)));
        expect(new Set(ys).size, 'one row of ten').toBe(1);
      } else {
        expect(ans.y).toBeGreaterThanOrEqual(cards.y + cards.height - 1);
        expect(ans.y - (cards.y + cards.height)).toBeLessThan(40);
        const ys = await page.locator('#deck-cards .card').evaluateAll((cs) => cs.map((c) => Math.round(c.getBoundingClientRect().top)));
        expect(new Set(ys).size, 'two rows of five').toBe(2);
      }
      await page.locator('#deeper > summary').click();
      await under(page, '#shuffle', '#r-shuffle');
      const end = await page.locator('#rv-shuffle').innerText(), order = await page.locator('#sam-order').innerText();
      await page.click('#shuffle');
      await expect(page.locator('#rk-order')).toContainText('Sam’s order this time');
      await expect(page.locator('#sam-order')).not.toHaveText(order);
      await expect(page.locator('#rv-shuffle')).toHaveText(end);
      await under(page, '.levers', '#r-mix');
      expect(await page.locator('#rv-mix').innerText()).toBe('Runs out in year 20');
      const paid = await page.locator('#rv-paid').innerText();
      await page.check('#buffer');
      await expect(page.locator('#rv-mix')).toHaveText('Runs out in year 18');
      await expect(page.locator('#rv-paid')).not.toHaveText(paid);
      await under(page, 'label:has(#rrif)', '#r-rrif');
      await expect(page.locator('#rc-rrif-on')).toBeHidden();
      await page.check('#rrif');
      await expect(page.locator('#rv-rrif-on')).toHaveText(/%$/, { timeout: 30000 });
      expect(await overlaps(page)).toEqual([]);
    });

    test('the crosshair reads the deal chart, this order included', async ({ page }) => {
      await page.goto(url); await ready(page);
      const svg = page.locator('#c-deal'); await svg.scrollIntoViewIfNeeded();
      let b = await svg.boundingBox();
      await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5);
      await expect(svg.locator('.crosshair text')).toContainText(/End of year \d+Ruth: \$[\d,]+Sam: /);
      await page.click('#deal');
      await svg.scrollIntoViewIfNeeded(); b = await svg.boundingBox();
      await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5);
      await expect(svg.locator('.crosshair text')).toContainText('This order: ');
      await expect(svg.locator('.crosshair')).toHaveCount(1);
      await page.mouse.move(0, 0);
      await expect(svg.locator('.crosshair')).toBeHidden();
    });
  });
}

for (const width of [390, 1440]) {
  test.describe(`${width}px, the editorial system`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('a one-word kicker, the question, one assumptions line, one Why chart, amber for the deal only', async ({ page }) => {
      await page.goto(url); await ready(page);
      await expect(page.locator('.opening .deal-head > .kicker')).toHaveCount(1);
      await expect(page.locator('.opening .deal-head > .kicker')).toHaveText('Game');
      await expect(page.locator('.kicker:not(.guess .kicker)')).toHaveCount(1);
      const q = toolFor('order-of-returns').question;
      expect(q.split(/\s+/).length).toBeLessThanOrEqual(12);
      expect(q.length).toBeLessThanOrEqual(60);
      await expect(page.locator('h1.display')).toHaveText(q);
      await expect(page.locator('.assume')).toHaveCount(1);
      await expect(page.locator('[data-assumptions]')).toHaveText(ASSUME);
      // charts outside Go deeper: the deal's path and the one Why chart
      expect(await page.locator('figure.chart:not(details.deeper figure)').evaluateAll((fs) => fs.map((f) => f.id))).toEqual(['fig-deal', 'fig-why']);
      await expect(page.locator('#fig-why .chart-title')).toHaveText('The first five years decide most of it');
      for (const t of await page.locator('.sec-label').allInnerTexts()) expect(t, 'no section number').not.toMatch(/^\s*\d/);
      await expect(page.locator('.btn-you')).toHaveCount(1);
      await expect(page.locator('#deal')).toHaveClass(/btn-you/);
      await expect(page.locator('.readout-v.big')).toHaveCount(1);
      for (const f of await page.locator('figure.chart').all()) await expect(f.locator(':scope > figcaption .chart-title')).toHaveText(/\S/);
      expect(await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).fontVariantCaps !== 'normal').length)).toBe(0);
    });

    test('every text renders at 17.5px or more, chart text included: on load, mid-deal, dealt, and with Go deeper open', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectTextSizes(page);
      for (let i = 0; i < 3; i++) await page.click('#one'); // a partly dealt order labels its path's end
      await expectTextSizes(page);
      expect(await overlaps(page)).toEqual([]);
      await page.click('#deal');
      await page.locator('.readout-how > summary').click();
      await expectTextSizes(page);
      await ready(page);
      await page.locator('#deeper > summary').click();
      await page.check('#rrif');
      await expect(page.locator('#s-rrif')).toContainText('Across all', { timeout: 30000 });
      await page.check('#flex'); await page.check('#buffer');
      await expectTextSizes(page);
      expect(await overlaps(page)).toEqual([]);
    });

    test('reduced motion: the cards turn and the answer lands at once', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectReducedMotion(page, async (p) => { await p.click('#deal'); });
      await page.click('#deal');
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    });
  });
}
