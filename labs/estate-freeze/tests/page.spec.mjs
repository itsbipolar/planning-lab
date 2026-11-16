import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes, expectTemplate, expectReducedMotion } from '../../../shared/desk/shell-test.mjs';
import { toolFor, questionOf } from '../../../shared/desk/desk-page.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXAMPLE, BOUNDS, freezeRules, defaultDeathAge, freeze, fmtBig, fmtM2, taxScale, taxParts } from '../model.mjs';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const R = freezeRules(JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts);
const S = freeze(R, { ...EXAMPLE, deathAge: defaultDeathAge(R, EXAMPLE.freezeAge) });
const D = freeze(R, { ...EXAMPLE, freezeAge: EXAMPLE.freezeAge - 10, deathAge: defaultDeathAge(R, EXAMPLE.freezeAge) }); // the anniversary first
const TS = taxScale(S), TD = taxScale(D), PD = taxParts(D);
// the main path (outside Go deeper, the folds and Sources) keeps to the plain terms (clarity pass, 2026-11-16)
const MAIN_BANNED = /\bredemption(?! value)|\bredeemed\b|\bdeemed\b|preferred left|paid-up capital|\bif not frozen\b|\bowed at death\b|\bpayable at death\b/i;
// a piece of text with a dollar figure must say whether it is tax or gain (the noun, not "taxed"), or that it is the portfolio's value
const SAYS = /\b(tax|gain|portfolio)\b/i;
// every text unit on the page with a dollar figure, with every fold open; units in ALLOW are inputs, cash or a chart
// whose subtitle names the unit
async function dollarUnits(page) {
  return page.evaluate(() => {
    const ALLOW = '#answer-v, #value-out, .slide-ticks, .stepper, #bars, #cash-line, #chart, .split-row, .desk-sr, .desk-next, .sources-fold';
    const out = [];
    for (const e of document.querySelectorAll('main p, main li, main td, main th[scope=row]')) {
      if (!e.checkVisibility() || e.closest(ALLOW)) continue;
      let text = e.innerText.replace(/\s+/g, ' ').trim();
      if (!/\$\d/.test(text)) continue;
      if (e.matches('td, th')) {
        const table = e.closest('table'), row = e.closest('tr'), i = [...row.children].indexOf(e);
        const head = table.querySelector('thead tr'), col = head && head.children[i] ? head.children[i].innerText : '';
        if (/^(Portfolio|Bought back)/.test(col)) continue;
        text = [head && head.children[0] ? head.children[0].innerText : '', row.children[0].innerText, col, text].join(' | ').replace(/\s+/g, ' ');
      }
      out.push(text);
    }
    return out;
  });
}
const BANNED = /\bshould\b|recommend|best for you|right for you|\bsaved\b|\bsavings?\b|tax-free|eliminat|avoids? tax|\byour (portfolio|estate)\b|prepared for/i;

async function step(page, name, dir, times = 1) {
  for (let i = 0; i < times; i++) {
    const b = page.locator(`button[aria-label^="${dir === 1 ? 'Increase' : 'Decrease'} ${name},"]`);
    if (await b.isDisabled()) return;
    await b.click();
  }
}
async function openDeeper(page) { if (!(await page.locator('#deeper').evaluate((d) => d.open))) await page.locator('#deeper > summary').click(); }
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

    test('the tool shell, listed: tool bar, one Up next, no unlisted noindex; nothing stored; no request after load', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expectShell(page, 'estate-freeze');
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0); // listed since 2026-11-15
      await expect(page.locator('a[data-next]')).toHaveAttribute('href', '/tools/tax-dates/');
      await page.locator('#value').focus();
      await page.keyboard.press('ArrowRight');
      await page.locator('#card').click();
      await expectStorageClean(page);
      expect(requests.filter((u) => !u.startsWith('blob:'))).toEqual([]);
    });

    test('the desk template budgets pass, and reduced motion makes every change instant', async ({ page }) => {
      await page.goto(url);
      const m = await expectTemplate(page);
      if (width === 390) {
        expect(m.deeperTop).toBeLessThanOrEqual(2800);
        expect(await page.evaluate(() => document.querySelector('#answer-v').getBoundingClientRect().bottom + scrollY)).toBeLessThanOrEqual(760);
      }
      const now = await expectReducedMotion(page, async (p) => { await p.locator('#value').focus(); await p.keyboard.press('ArrowRight'); });
      expect(now).not.toContain(fmtBig(S.pushed));
    });

    test('opens on the labelled example with the sanity figures', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('h1')).toHaveText(questionOf(toolFor('estate-freeze')));
      await expect(page.locator('.play .kicker')).toHaveText('Tool');
      await expect(page.locator('#lede')).toHaveText(`A made-up retiree, ${EXAMPLE.freezeAge}, moves a portfolio into a company and freezes its value.`);
      await expect(page.locator('#value-out')).toHaveText('$7.5M');
      await expect(page.locator('#value')).toHaveAttribute('aria-valuetext', '$7.5M');
      await expect(page.locator('#answer-k')).toHaveText('Income tax moved to the trust');
      await expect(page.locator('#answer-v')).toHaveText('$2.38M');
      await expect(page.locator('#answer-t')).toHaveText('Deferred, not removed: the family trust pays it later, when it sells its shares.');
      // the split says the sum: the same income tax, without a freeze all due at death
      await expect(page.locator('#split-no')).toHaveText('Without a freeze $3.24M, all due at death');
      await expect(page.locator('#split-with')).toHaveText('With the freeze $0.86M due at death + $2.38M paid later, by the trust');
      await expect(page.locator('#split-sr')).toHaveText('$0.86M + $2.38M = $3.24M: the same income tax at today’s rates, paid at different times. Yearly tax on income and buy-backs is left out of both.');
      await expect(page.locator('#split-sr')).toBeVisible();
      // the without-freeze bar is filled in the due-at-death colour, like the with-freeze part it matches
      const noFill = await page.locator('#split .seg-no').evaluate((e) => getComputedStyle(e).backgroundColor);
      expect(noFill).not.toBe('rgba(0, 0, 0, 0)');
      const bars = await page.locator('#split .seg').evaluateAll((s) => Object.fromEntries(s.map((e) => [e.className.replace('seg ', ''), e.getBoundingClientRect().width])));
      expect(Math.abs(bars['seg-death'] + bars['seg-early'] + bars['seg-later'] - bars['seg-no'])).toBeLessThanOrEqual(1);
      await expect(page.locator('#assume')).toContainText('Hypothetical illustration · Education, not advice.');
      await expect(page.locator('#assume')).toContainText(`${R.rateYear} top rates`);
      await expect(page.locator('#assume')).not.toContainText('deferred');
      // What happens: four steps before the chart, naming the section 85 election and the fixed redemption value, with who
      // gets what: the IOU for the original cost and the fixed shares for the rest (together, today's value)
      await expect(page.locator('#steps li')).toHaveCount(4);
      await expect(page.locator('#steps')).toContainText('section 85 election');
      await expect(page.locator('#steps li').nth(1)).toContainText('The retiree gets back an IOU for what they first paid for the investments (the original cost, $2.5M) and preferred shares with a fixed redemption value for the rest ($5M, today’s gain): together, today’s $7.5M portfolio.');
      await expect(page.locator('#steps li').nth(2)).toContainText('A family trust for the retiree’s family');
      await expect(page.locator('#steps li').nth(3)).toContainText('that value moves to the trust’s shares');
      expect(await page.evaluate(() => document.querySelector('#steps').getBoundingClientRect().top < document.querySelector('#freeze-chart').getBoundingClientRect().top)).toBe(true);
      // the chart, in income tax, ending at death
      await expect(page.locator('#chart-title')).toHaveText('The longer the retiree lives, the more of the tax the trust carries');
      await expect(page.locator('#chart-sub')).toContainText('Income tax if death came at each age');
      await expect(page.locator('#freeze-chart .tag-example')).toBeVisible();
      await expect(page.locator('#freeze-chart')).not.toContainText('Hypothetical illustration');
      await expect(page.locator('#freeze-chart .chart-hint')).toHaveText('Touch or hover the chart to read any age.');
      await expect(page.locator('#chart')).toContainText('Death at 87 (example)');
      for (const v of ['$3.24M', '$2.38M', '$0.86M', 'Yearly buy-backs', 'paid later, by']) await expect(page.locator('#chart')).toContainText(v);
      for (const v of ['$12.1M', '$8.9M', '$3.2M ', 'anniversary', 'if not frozen', 'Taxed']) await expect(page.locator('#chart')).not.toContainText(v);
      for (const t of ['$0', '$1M', '$2M', '$3M']) await expect(page.locator('#chart .ylab', { hasText: new RegExp('^\\' + t + '$') })).toHaveCount(1);
      await expect(page.locator('#chart-after')).toContainText('the trust’s $2.38M of tax waits until it sells its shares, or until its 21st anniversary, 4 years after death');
      // the ledger: in Go deeper (its figures are the answer's), income tax only, with "In all"
      expect(await page.locator('#deeper #ledger').count()).toBe(1);
      const ledger = await page.locator('#ledger').textContent();
      for (const v of ['$3.24M', '$0.86M', '$2.38M', 'In all, at today’s rates', 'left out of both', 'none', 'Due at death', 'Paid later, by the trust', '21st anniversary, 4 years after death']) expect(ledger).toContain(v);
      for (const v of ['$3.46M', '$12.11M', 'Gain', '(91)']) expect(ledger).not.toContain(v);
      await expect(page.locator('#ledger tr[hidden]')).toHaveCount(1); // the row for the trust's tax in life shows only when its anniversary comes first
      await expect(page.locator('#ledger tr.total td')).toHaveText(['$3.24M', '$3.24M']);
      expect(await page.locator('#ledger-fold, #flow').count()).toBe(0); // one place for the gains (How this is worked out), one telling of the moves
      // the caveats: three groups, eight items
      await expect(page.locator('#caveats .cv-group')).toHaveCount(3);
      await expect(page.locator('#caveats li')).toHaveCount(8);
      await expect(page.locator('#caveats')).toContainText('How a trust may plan for its 21st anniversary');
      for (const t of ['section 85 election', 'surviving spouse', '70(6)', 'not submitted for probate', 'not from the freeze', 'company’s own unrealized gain']) await expect(page.locator('#caveats')).toContainText(t);
      await expect(page.locator('#caveats a')).toHaveAttribute('href', '/watch/double-tax-at-death/');
      await expect(page.locator('#reset')).toBeHidden();
      await expect(page.locator('#echo')).toBeHidden();
      await expect(page.locator('#death-hint')).toHaveText('Death at 87 is an example: on average a person of 70 has about 16 to 18 more years (Statistics Canada, 2022 to 2024). Not a prediction.');
      await expect(page.locator('#cue')).toHaveText('Original cost: what the retiree first paid for the investments. Gain = portfolio − original cost, so the cost changes the tax due at death.');
      // How this is worked out: plain steps, every rate wrapped in its fact
      await page.locator('#answer .readout-how summary').click();
      for (const id of ['capital_gains_inclusion_rate', 'life_expectancy_age70_male', 'ontario_estate_admin_tax_rate']) await expect(page.locator(`#how [data-fact~="${id}"]`).first()).toBeVisible();
      for (const t of ['$14.61M at 87', '$2.5M original cost = $12.11M, all taxed at death: $3.24M of tax', 'today’s $5M gain', '$3.20M of gain is taxed at death: $0.86M of tax', 'Growth after death is not shown.', 'left out, without and with the freeze', '26.76%']) await expect(page.locator('#how')).toContainText(t);
      // the trust's gain reconciles: growth since the freeze plus the fixed shares bought back, and why
      await expect(page.locator('#how')).toContainText('The trust’s shares hold the rest, $8.91M of gain: $7.11M of growth since 70, plus the $1.80M of fixed shares bought back. The buy-backs are paid from the company’s yearly income, not from the portfolio');
      // probate: credited to the holding company shares, not the freeze
      await expect(page.locator('#how')).toContainText('$0.22M of tax without a freeze. With it, assumed not payable');
      await expect(page.locator('#how')).toContainText('That comes from holding company shares, not from the freeze.');
      expect(await page.locator('body').innerText()).not.toMatch(BANNED);
      // the main path keeps to the plain terms; the folds may name the technical ones
      const main = await page.evaluate(() => { const c = document.querySelector('main').cloneNode(true); c.querySelectorAll('details, .sources-fold, .desk-sr').forEach((d) => d.remove()); return c.innerText; });
      expect(main).not.toMatch(MAIN_BANNED);
    });

    test('the slider, the original-cost clamp, the steppers, the cue, the echo and Back to the example', async ({ page }) => {
      await page.goto(url);
      const range = page.locator('#value');
      await range.focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#value-out')).toHaveText('$7.75M');
      await page.keyboard.press('PageUp');
      await expect(page.locator('#value-out')).toHaveText('$8.75M');
      await expect(page.locator('#reset')).toBeVisible();
      await expect(page.locator('#echo')).toContainText('Now, income tax:');
      await page.keyboard.press('Home');
      await expect(page.locator('#value-out')).toHaveText('$1M');
      await expect(page.locator('#clamp')).toHaveText('What the retiree first paid for the investments (the original cost) is set to $1M here: it can’t be more than the portfolio. It goes back to $2.5M once the portfolio is $2.5M or more.');
      await expect(page.locator('#st-cost')).toHaveText('$1M');
      await expect(page.locator('#answer-extra')).toHaveText('Here the original cost equals the portfolio, so there is no gain to freeze and no buy-backs: all growth is the trust’s.');
      await expect(page.locator('#split-with')).toContainText('$0 due at death');
      await expect(page.locator('#steps li').nth(3)).toHaveText('Buy back. With no fixed shares, there is nothing to buy back.');
      await expect(page.locator('button[aria-label^="Increase original cost,"]')).toBeDisabled();
      await page.keyboard.press('End');
      await expect(page.locator('#value-out')).toHaveText('$25M');
      // back above the chosen amount, it comes back and the note goes
      await expect(page.locator('#st-cost')).toHaveText('$2.5M');
      await expect(page.locator('#clamp')).toHaveText('');
      // steppers: named, 48px, disabled at a bound; the cue names what the last one touched changes
      const up = page.locator('button[aria-label="Increase growth, now 4.0%"]');
      await expect(up).toHaveCount(1);
      const bb = await up.boundingBox(); expect(bb.height).toBeGreaterThanOrEqual(48); expect(bb.width).toBeGreaterThanOrEqual(44);
      await step(page, 'growth', -1, 20);
      await expect(page.locator('#cue')).toHaveText('More growth means more gain, and all of it after the freeze is the trust’s.');
      await expect(page.locator('#st-growth')).toHaveText('0.0%');
      await expect(page.locator('button[aria-label^="Decrease growth,"]')).toBeDisabled();
      await expect(page.locator('#answer-t')).toHaveText('With no growth, the trust’s tax comes only from the buy-backs.');
      await page.locator('#reset').click();
      await expect(page.locator('#answer-v')).toHaveText('$2.38M');
      await expect(page.locator('#value-out')).toHaveText('$7.5M');
      await expect(page.locator('#reset')).toBeHidden();
      await expect(page.locator('#echo')).toBeHidden();
      // the trust's 21st anniversary before death
      await step(page, 'age at the freeze', -1, 10);
      await expect(page.locator('#cue')).toHaveText('The trust’s 21st anniversary is 21 years after the freeze, here at 81.');
      await expect(page.locator('#answer-k')).toHaveText('Income tax moved to the trust');
      await expect(page.locator('#answer-v')).toHaveText(TD(PD.moved));
      await expect(page.locator('#answer-t')).toHaveText(`The trust pays ${TD(PD.early)} of tax at 81, its 21st anniversary, and ${TD(PD.later)} later.`);
      await expect(page.locator('#split-with')).toHaveText(`With the freeze ${TD(PD.death)} due at death + ${TD(PD.early)} paid by the trust at 81 + ${TD(PD.later)} paid later`);
      await expect(page.locator('#chart-title')).toHaveText('At 81, the trust’s 21st anniversary, the trust pays its share');
      await expect(page.locator('#chart')).toContainText(`trust pays ${TD(D.taxTrustEarly)} tax`);
      await expect(page.locator('#chart')).toContainText(/paid by the trust\s*at 81/);
      await expect(page.locator('#echo')).toContainText(`${TD(PD.early)} paid by the trust at 81 and ${TD(PD.later)} paid later.`);
      const led = await page.locator('#ledger').textContent();
      for (const v of ['Paid by the trust at 81, before death', TD(PD.early), TD(PD.later), '42nd anniversary']) expect(led).toContain(v);
      await expect(page.locator('#ledger tr.total td')).toHaveText([TD(PD.total), TD(PD.total)]);
      await expect(page.locator('#chart-after')).toContainText(`${TD(PD.later)} of tax on growth since 81`);
      await page.locator('#answer .readout-how summary').click();
      await expect(page.locator('#how')).toContainText(`${TD(PD.early)} of tax, before death`);
      await expect(page.locator('#death-hint')).toBeHidden(); // only at the life table's age
      // death follows the freeze age, never before it
      await step(page, 'age at the freeze', 1, 40);
      await expect(page.locator('#st-freezeAge')).toHaveText('85');
      await step(page, 'age at death', -1, 40);
      await expect(page.locator('#st-deathAge')).toHaveText('86');
      await expect(page.locator('button[aria-label^="Decrease age at death,"]')).toBeDisabled();
      await expectStorageClean(page);
      expect(page.url()).toBe(url);
    });

    test('the death-age line matches the age', async ({ page }) => {
      await page.goto(url);
      await step(page, 'age at death', 1, 6);
      await expect(page.locator('#st-deathAge')).toHaveText('93');
      await expect(page.locator('#death-hint')).toContainText('Death at 93 is an example, 23 years after the freeze.');
      await expect(page.locator('#death-hint')).not.toContainText('about 17');
      await expect(page.locator('#cue')).toContainText('the trust pays then, before death.');
    });

    test('death in the trust’s anniversary year: the answer holds, the words say "the same year"', async ({ page }) => {
      await page.goto(url);
      const before = await (async () => { await step(page, 'age at death', 1, 3); return page.locator('#answer-v').textContent(); })();
      await step(page, 'age at death', 1, 1);
      await expect(page.locator('#st-deathAge')).toHaveText('91');
      const W = freeze(R, { ...EXAMPLE, deathAge: 91 }), TW = taxScale(W), PW = taxParts(W);
      await expect(page.locator('#answer-v')).toHaveText(TW(PW.moved));
      expect(PW.moved).toBeGreaterThanOrEqual(taxParts(freeze(R, { ...EXAMPLE, deathAge: 90 })).moved); // no cliff at the anniversary
      expect(before).not.toBe('$0');
      await expect(page.locator('#answer-t')).toHaveText('The trust pays it at 91, its 21st anniversary, the year of death.');
      await expect(page.locator('#cue')).toHaveText('Here death and the trust’s 21st anniversary fall in the same year, 91: the trust pays its tax then.');
      await expect(page.locator('#split-with')).not.toContainText('paid later');
      await page.locator('#answer .readout-how summary').click();
      await expect(page.locator('#how')).not.toContainText('Its gain after that');
    });

    test('every visible dollar figure says whether it is tax or gain, at the example and with the anniversary first', async ({ page }) => {
      await page.goto(url);
      for (const d of await page.locator('details summary').all()) await d.click();
      let units = await dollarUnits(page);
      expect(units.length).toBeGreaterThan(10);
      expect(units.filter((t) => !SAYS.test(t))).toEqual([]);
      await step(page, 'age at the freeze', -1, 10);
      await step(page, 'growth', 1, 2);
      units = await dollarUnits(page);
      expect(units.filter((t) => !SAYS.test(t))).toEqual([]);
      // the checker can fail
      expect(SAYS.test('Taxed at 87: $3.2M, not $12.1M')).toBe(false);
    });

    test('one figure, one string: the answer, the split, the chart, the ledger, the sheet and the card agree', async ({ page }) => {
      await page.addInitScript(() => { window.print = () => {}; });
      for (const death of [0, 6]) {
        await page.goto(url);
        await page.evaluate(() => { const orig = window.deskCard; window.deskCard = (o) => { window.__big = o.bigValue; return orig(o); }; });
        await step(page, 'age at death', 1, death);
        const want = death ? taxScale(freeze(R, { ...EXAMPLE, deathAge: defaultDeathAge(R, EXAMPLE.freezeAge) + death })) : TS;
        const W = death ? freeze(R, { ...EXAMPLE, deathAge: defaultDeathAge(R, EXAMPLE.freezeAge) + death }) : S;
        const PW = taxParts(W), big = want(PW.moved), later = want(PW.later);
        await expect(page.locator('#answer-v')).toHaveText(big);
        await expect(page.locator('#split-with')).toContainText(later + ' paid later');
        await expect(page.locator('#chart .rd-v.r-later')).toHaveText(later);
        await expect(page.locator('#chart .rd-v.r-nofreeze')).toHaveText(want(PW.total)); // the no-freeze reading stays, even with four
        await expect(page.locator('#ledger tbody tr').nth(2).locator('td').nth(1)).toHaveText(later);
        await page.click('#print');
        await expect(page.locator('#sheet .sh-big')).toHaveText(big);
        await Promise.all([page.waitForEvent('download'), page.click('#card')]);
        expect(await page.evaluate(() => window.__big)).toBe(big);
      }
    });

    test('the ledger fits the phone at the longest states', async ({ page }) => {
      await page.goto(url);
      await openDeeper(page);
      await page.locator('#value').focus(); await page.keyboard.press('End');
      for (const freezeSteps of [-15, 15]) {
        await step(page, 'age at the freeze', freezeSteps > 0 ? 1 : -1, Math.abs(freezeSteps) + 15);
        await step(page, 'age at death', 1, 40);
        const fit = await page.evaluate(() => { const t = document.querySelector('#ledger'); return [t.scrollWidth, t.parentElement.clientWidth, document.documentElement.scrollWidth, innerWidth]; });
        expect(fit[0], `ledger width, freeze ${freezeSteps}`).toBeLessThanOrEqual(fit[1]);
        expect(fit[2], 'no sideways page scroll').toBeLessThanOrEqual(fit[3]);
      }
    });

    test('no two chart labels overlap and none is clipped, at the extremes', async ({ page }) => {
      await page.goto(url);
      expect(await clashes(page, '#chart'), 'example').toEqual([]);
      await page.locator('#value').focus();
      await page.keyboard.press('Home'); // the smallest wedge: $1M, cost clamped to it
      expect(await clashes(page, '#chart'), 'smallest').toEqual([]);
      await step(page, 'original cost', -1, 2);
      expect(await clashes(page, '#chart'), 'small wedge').toEqual([]);
      await page.locator('#value').focus();
      await page.keyboard.press('End');
      await step(page, 'growth', 1, 8);
      expect(await clashes(page, '#chart'), 'largest').toEqual([]);
      await step(page, 'age at the freeze', -1, 10);
      expect(await clashes(page, '#chart'), 'deemed first').toEqual([]);
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await step(page, 'age at death', 1, 20);
      expect(await clashes(page, '#chart'), 'longest, dark').toEqual([]);
      await step(page, 'age at the freeze', -1, 30);
      expect(await clashes(page, '#chart'), 'two anniversaries before death').toEqual([]);
      // the crosshair, by keyboard
      await page.locator('#chart').focus();
      await page.keyboard.press('ArrowLeft');
      await expect(page.locator('#chart .crosshair text')).toContainText('With the freeze, due at death');
    });

    test('Go deeper: the moves, the buy-backs, more assumptions, year by year; the sources', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('#deeper')).not.toHaveAttribute('open', '');
      await expect(page.locator('#deeper .deeper-in')).toHaveText('Income tax, and when it is paid · Buy-backs, year by year · More assumptions · The numbers behind the chart');
      await openDeeper(page);
      await expect(page.locator('#ledger')).toBeVisible();
      await expect(page.locator('#mechanism')).toContainText('paid-up capital');
      for (const id of ['refundable_investment_income_rate', 'part_iv_tax_rate', 'dividend_refund_rate']) await expect(page.locator(`#mechanism [data-fact~="${id}"]`)).toBeVisible();
      await expect(page.locator('#buy-open')).toContainText(/Each year the company pays the retiree about \$90,000 to \$\d{3},000 to buy back fixed shares\./);
      await expect(page.locator('#years-head th')).toHaveText(['If death came at', 'Tax due at death, without a freeze', 'Tax due at death, with the freeze', 'Tax paid later, by the trust', 'Portfolio', 'Bought back that year']);
      if (width === 390) await expect(page.locator('#years-cap')).toContainText(/swipe the table for \d more columns? →/);
      else await expect(page.locator('#years-cap')).not.toContainText('swipe');
      await expect(page.locator('#bars')).toContainText('Year 1: about $90,000');
      await expect(page.locator('#bars')).toContainText(/Year 17: about \$\d{3},000/);
      await expect(page.locator('#cash-line')).toContainText('In year one the company earns $100,000');
      await expect(page.locator('#years-rows tr')).toHaveCount(S.n + 1);
      await expect(page.locator('#years-rows tr.death')).toContainText(TS(S.taxNo));
      await expect(page.locator('#years-rows tr.death')).toContainText(TS(S.deferred));
      await step(page, 'investment income', 1, 40);
      await expect(page.locator('#st-income')).toHaveText('$500K');
      await expect(page.locator('#bars')).toContainText('Year 1: about $450,000');
      await page.locator('.sources-fold summary').click();
      for (const f of R.used) await expect(page.locator(`#sources a[href="${f.source_url}"]`).first()).toBeAttached();
      await expect(page.locator('#sources')).toContainText('Statistics Canada table 13-10-0114-01');
      for (const sec of ['70(5)', '70(6)', '74.4', '84(3)', '85', '104(4)']) await expect(page.locator('#sources')).toContainText('Income Tax Act ' + sec);
      await expect(page.locator('#sources')).toContainText(/Version [0-9a-f]{8} · rates as of/);
      await expectTextSizes(page);
    });

    test('Save my card: a 1080x1350 PNG made in the browser, stamped as a hypothetical illustration', async ({ page }) => {
      await page.goto(url);
      await page.evaluate(() => { const orig = window.deskCard; window.deskCard = (o) => { window.__card = { stamp: o.stamp, bigValue: o.bigValue, labels: o.labels, line: o.line }; return orig(o); }; });
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#card')]);
      expect(dl.suggestedFilename()).toBe('estate-freeze-card.png');
      const buf = readFileSync(await dl.path());
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([1080, 1350]);
      const card = await page.evaluate(() => window.__card);
      expect(card.stamp).toBe('Hypothetical illustration · Education, not advice');
      expect(card.bigValue).toBe(TS(S.deferred));
      expect(card.bigValue).toBe('$2.38M');
      expect(card.line).toContain('deferred, not removed');
      expect(card.line).toContain('made-up retiree, 70, with $7.5M');
      expect(card.labels).toEqual([]);
    });

    test('every piece of text renders at 17.5px or more, chart labels included, in both schemes', async ({ page }) => {
      await page.goto(url);
      await expectTextSizes(page);
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await step(page, 'age at the freeze', -1, 10);
      for (const d of await page.locator('details summary').all()) await d.click();
      await expectTextSizes(page);
      await page.locator('#chart').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#chart .crosshair')).toBeVisible();
      await expectTextSizes(page);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await page.locator('#value').focus(); await page.keyboard.press('ArrowRight');
        for (const d of await page.locator('details summary').all()) await d.click();
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
      });
    }
  });
}

// a tap on the chart reads an age on a phone and the reading stays until a tap elsewhere (the finger lifting fires
// pointerleave, which used to hide it at once)
test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('touch reads the chart', async ({ page }) => {
    await page.goto(url);
    const box = await page.locator('#chart').boundingBox();
    await page.locator('#chart').tap({ position: { x: box.width * 0.4, y: box.height * 0.6 } });
    const cross = page.locator('#chart .crosshair');
    await expect(cross).toBeVisible();
    await expect(cross).toContainText('If death came at');
    // the same order as the answer: without a freeze first
    expect((await cross.textContent()).indexOf('Without a freeze')).toBeLessThan((await cross.textContent()).indexOf('With the freeze'));
    // the gutter readings step back under the reading box
    expect(Number(await page.locator('#chart .rd').first().evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(0.5);
    await page.waitForTimeout(400);
    await expect(cross).toBeVisible();
    await page.locator('h1').tap();
    await expect(cross).toBeHidden();
  });
});

test.describe('1440, the answer column', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('opening "How this is worked out" leaves no blank under the H1', async ({ page }) => {
    await page.goto(url);
    const top = () => page.evaluate(() => document.querySelector('#value').getBoundingClientRect().top);
    const before = await top();
    await page.locator('#answer .readout-how summary').click();
    expect(Math.abs((await top()) - before)).toBeLessThanOrEqual(4);
  });
});
