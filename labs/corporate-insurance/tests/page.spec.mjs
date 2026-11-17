import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes, expectTemplate, expectReducedMotion } from '../../../shared/desk/shell-test.mjs';
import { toolFor, questionOf } from '../../../shared/desk/desk-page.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXAMPLE, BOUNDS, insuranceRules, split, money, pct2, per100, cents } from '../model.mjs';
import { BANNED } from './words.mjs';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const R = insuranceRules(JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts);
const S = split(R, EXAMPLE);
const COMPARE = /var COMPARE = true;/.test(readFileSync(new URL('../app.js', import.meta.url), 'utf8'));

// set the payout with the stepper and the tax cost with the slider, as a visitor would
async function setState(page, payout, acb) {
  for (let i = 0; i < 60; i++) {
    const cur = Number((await page.locator('#st-payout').textContent()).replace(/\D/g, ''));
    if (cur === payout) break;
    await page.locator(`button[aria-label^="${cur < payout ? 'Increase' : 'Decrease'} the payout,"]`).click();
  }
  await page.locator('#acb').evaluate((r, v) => { r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, acb);
  await page.waitForTimeout(60);
}
async function openAll(page) {
  const closed = page.locator('details:not([open]) > summary');
  while (await closed.count()) await closed.first().click();
}
async function clashes(page) {
  const boxes = await page.locator('#chart text').evaluateAll((ts) => ts.filter((t) => t.textContent.trim() && !t.closest('.seg-read')).map((t) => { const b = t.getBBox(); return [b.x, b.y, b.width, b.height, t.textContent]; }));
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    if (a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1) out.push(`${a[4]} / ${b[4]}`);
  }
  const vb = await page.locator('#chart').evaluate((s) => [s.viewBox.baseVal.width, s.viewBox.baseVal.height]);
  for (const b of boxes) if (b[0] < -0.5 || b[0] + b[2] > vb[0] + 0.5 || b[1] < -0.5 || b[1] + b[3] > vb[1] + 0.5) out.push(`${b[4]} is clipped`);
  return out;
}
const lum = (rgb) => { const c = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { v = Number(v) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the tool shell, unlisted: tool bar, one Up next, noindex; nothing stored; no request after load', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expectShell(page, 'corporate-insurance');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      await expect(page.locator('a[data-next]')).toHaveAttribute('href', '/tools/tax-dates/');
      await page.locator('#acb').focus();
      await page.keyboard.press('ArrowRight');
      await page.locator('button[aria-label^="Increase the payout,"]').click();
      await page.locator('#chart').focus(); await page.keyboard.press('ArrowRight');
      for (const d of await page.locator('details summary').all()) await d.click();
      await expectStorageClean(page);
      expect(page.url()).toBe(url);
      expect(requests).toEqual([]);
      // no save, print or share in v1, and no amber action
      await expect(page.locator('#print, #card, .btn-you, .save-row')).toHaveCount(0);
    });

    test('the desk template budgets pass, and reduced motion makes every change instant', async ({ page }) => {
      await page.goto(url);
      const m = await expectTemplate(page);
      if (width === 390) {
        expect(m.deeperTop).toBeLessThanOrEqual(2800);
        // the big figure itself is on the first phone screen: its bottom by 700, with the 4-line H1
        const fig = await page.evaluate(() => { const r = document.querySelector('#answer-v').getBoundingClientRect(); return [r.top + scrollY, r.bottom + scrollY]; });
        expect(fig[1]).toBeLessThanOrEqual(700);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'no sideways scroll').toBeLessThanOrEqual(0);
      const now = await expectReducedMotion(page, async (p) => { await p.locator('#acb').focus(); await p.keyboard.press('ArrowRight'); });
      expect(now).toContain(money(split(R, { ...EXAMPLE, acb: EXAMPLE.acb + BOUNDS.acb.step }).capDiv));
    });

    test('opens on the labelled example with the sanity figures', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('h1')).toHaveText(questionOf(toolFor('corporate-insurance')));
      await expect(page.locator('.play .kicker')).toHaveText('Tool');
      await expect(page.locator('#lede')).toHaveText('A made-up owner dies, and the company receives $1,000,000.');
      await expect(page.locator('#acb-out')).toHaveText('$200,000');
      await expect(page.locator('#acb')).toHaveAttribute('aria-valuetext', '$200,000, an example');
      await expect(page.locator('#acb')).toHaveAttribute('max', String(EXAMPLE.payout));
      await expect(page.locator('#tick-hi')).toHaveText('$1,000,000');
      await expect(page.locator('#acb-label')).toHaveText('The policy’s cost base at death');
      await expect(page.locator('#acb-help')).toHaveText('The cost base is the policy’s adjusted cost basis under the Income Tax Act. The payout less it is what can go out as a capital dividend. Among other things, premiums raise it and the net cost of pure insurance lowers it.');
      await expect(page.locator('#answer-k')).toHaveText('Paid tax-free as a capital dividend');
      await expect(page.locator('#answer-v')).toHaveText('$800,000');
      await expect(page.locator('#answer-of')).toHaveText('of the $1,000,000 payout');
      await expect(page.locator('#answer-t')).toHaveText('If paid out now, the $200,000 cost base is a taxable dividend here.');
      await expect(page.locator('#sum')).toHaveText('$800,000as a capital dividend+$104,520after dividend tax=$904,520to the family in all$95,480income tax');
      await expect(page.locator('#sum-sr')).toHaveText('$800,000 tax-free as a capital dividend, plus $104,520 after dividend tax, makes $904,520 to the family in all; $95,480 of the $1,000,000 payout is income tax.');
      // no mini bars in the answer: the chart is the one picture of the split
      await expect(page.locator('#answer .split-bar, #split-cmp')).toHaveCount(0);
      await expect(page.locator('#assume')).toHaveText(`Hypothetical illustration · Education, not advice. A made-up Ontario owner; the family taxed at the ${R.rateYear} top rate; every figure an example.`);
      await expect(page.locator('#steps li')).toHaveCount(3);
      expect(await page.evaluate(() => document.querySelector('#steps').getBoundingClientRect().top < document.querySelector('#ins-chart').getBoundingClientRect().top)).toBe(true);
      await expect(page.locator('#chart-title')).toHaveText('Where the payout goes');
      await expect(page.locator('#ins-chart .tag-example')).toBeVisible();
      for (const v of ['$800,000', '$104,520', '$95,480', 'tax-free, capital dividend', 'The $200,000 cost base:', 'Through the capital dividend account']) await expect(page.locator('#chart')).toContainText(v);
      if (COMPARE) for (const v of [money(S.compare.family), money(S.compare.tax), 'For comparison only']) await expect(page.locator('#chart')).toContainText(v);
      else await expect(page.locator('#chart')).not.toContainText('comparison');
      await expect(page.locator('.chart-hint')).toHaveCount(0);
      await expect(page.locator('#year-line')).toContainText(`Rates for ${R.rateYear}: the latest year with every figure published.`);
      if (R.onDTCLater) {
        await expect(page.locator('#year-line')).toContainText(`The Ontario dividend credit is already set lower from ${R.onDTCLater.year}, so with other rates unchanged the tax on the taxable part would be higher then.`);
        await expect(page.locator(`#year-line [data-fact="${R.onDTCLater.id}"]`)).toBeVisible();
      }
      await expect(page.locator('#caveats .cv-group')).toHaveCount(3);
      await expect(page.locator('#caveats li')).toHaveCount(20);
      await expect(page.locator('#caveats')).not.toContainText('permanent');
      await expect(page.locator('#reset')).toBeHidden();
      await expect(page.locator('#echo')).toBeHidden();
      // How this is worked out: the steps, the rate in its facts, the one CDA in its abbr
      await page.locator('#answer .readout-how summary').click();
      await expect(page.locator('#how li')).toHaveText([
        'Into the capital dividend account (CDA): payout $1,000,000 − the policy’s cost base $200,000 = $800,000.',
        'Elected as a capital dividend: $800,000, not counted in the family’s income.',
        `The cost base part, $200,000, paid out now as a taxable dividend: income tax $200,000 × ${pct2(R.rate)} = $95,480 (to the dollar), leaving $104,520.`,
        'The family receives $800,000 + $104,520 = $904,520 of the $1,000,000.',
      ]);
      await expect(page.locator('#how abbr[title="capital dividend account"]')).toHaveText('CDA');
      for (const id of [R.ids.fedTop, R.ids.onDTC, R.ids.grossUp]) await expect(page.locator(`#how [data-fact~="${id}"]`)).toBeVisible();
    });

    test('the slider, the payout stepper, the clamp, the three states, the echo and Back to the example', async ({ page }) => {
      await page.goto(url);
      await page.locator('#acb').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#acb-out')).toHaveText('$210,000');
      await page.keyboard.press('PageUp');
      await expect(page.locator('#acb-out')).toHaveText('$310,000');
      await expect(page.locator('#reset')).toBeVisible();
      await expect(page.locator('#echo')).toHaveText('Now: a $1,000,000 payout, a $310,000 cost base.');
      await page.keyboard.press('Home');
      await expect(page.locator('#answer-v')).toHaveText('$1,000,000');
      await expect(page.locator('#answer-t')).toHaveText('No cost base at death: here, all of the payout can go out this way.');
      await expect(page.locator('#chart-title')).toHaveText('All of it through the account');
      await expect(page.locator('#chart')).not.toContainText('cost base:');
      await expect(page.locator('#sum')).toContainText('$0after dividend tax');
      await page.keyboard.press('End');
      await expect(page.locator('#answer-v')).toHaveText('$0');
      await expect(page.locator('#answer-t')).toHaveText('The cost base equals the payout, so none of it goes out this way.');
      await expect(page.locator('#chart-title')).toHaveText('None of it through the account');
      await expect(page.locator('#chart .seg.p-cap')).toHaveCount(0);
      // the payout down below the tax cost: the tax cost follows it, and says so
      const up = page.locator('button[aria-label="Increase the payout, now $1,000,000"]');
      const bb = await up.boundingBox(); expect(bb.height).toBeGreaterThanOrEqual(48); expect(bb.width).toBeGreaterThanOrEqual(44);
      await page.locator('button[aria-label^="Decrease the payout,"]').click();
      await expect(page.locator('#clamp')).toHaveText('Cost base lowered to $750,000: it can’t be more than the payout here.');
      await expect(page.locator('#acb-out')).toHaveText('$750,000');
      await expect(page.locator('#acb')).toHaveAttribute('max', '750000');
      for (let i = 0; i < 2; i++) await page.locator('button[aria-label^="Decrease the payout,"]').click();
      await expect(page.locator('#st-payout')).toHaveText('$250,000');
      await expect(page.locator('button[aria-label^="Decrease the payout,"]')).toBeDisabled();
      await page.locator('#reset').click();
      await expect(page.locator('#answer-v')).toHaveText('$800,000');
      await expect(page.locator('#acb-out')).toHaveText('$200,000');
      await expect(page.locator('#clamp')).toHaveText('');
      await expect(page.locator('#reset')).toBeHidden();
      await setState(page, BOUNDS.payout.max, 0);
      await expect(page.locator('button[aria-label^="Increase the payout,"]')).toBeDisabled();
      await expect(page.locator('#answer-v')).toHaveText('$10,000,000');
      await expectStorageClean(page);
    });

    test('no two chart labels overlap and none is clipped, at the thin-segment states', async ({ page }) => {
      await page.goto(url);
      expect(await clashes(page), 'example').toEqual([]);
      for (const [pay, acb] of [[1e6, 0], [1e6, 10000], [1e6, 500000], [1e6, 990000], [1e6, 1e6], [1e7, 0], [1e7, 10000], [250000, 240000]]) {
        await setState(page, pay, acb);
        expect(await clashes(page), `${pay}, ${acb}`).toEqual([]);
      }
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await setState(page, 1e7, 5e6);
      expect(await clashes(page), 'dark, $10M, $5M').toEqual([]);
    });

    test('no money figure wraps inside itself at the longest states', async ({ page }) => {
      await page.goto(url);
      for (const [pay, acb] of [[1e7, 0], [1e7, 5e6]]) {
        await setState(page, pay, acb);
        await openAll(page);
        const wrapped = await page.evaluate(() => [...document.querySelectorAll('#answer-v, .split-v b, .sum-v, #nums td, #nums th, #st-payout, #acb-out')]
          .filter((e) => e.checkVisibility() && e.getClientRects().length > 1).map((e) => e.textContent));
        expect(wrapped, `${pay}, ${acb}`).toEqual([]);
        const chartLines = await page.locator('#chart .rd-v').evaluateAll((ts) => ts.map((t) => t.getNumberOfChars() && t.getExtentOfChar(0).y === t.getExtentOfChar(t.getNumberOfChars() - 1).y));
        expect(chartLines.every(Boolean)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      }
    });

    test('the chart reads a part on hover and by keyboard; the readout matches the chart’s description', async ({ page }) => {
      await page.goto(url);
      await page.locator('#chart .seg.p-tax').first().hover();
      await expect(page.locator('#chart .seg-read')).toBeVisible();
      await expect(page.locator('#chart .seg-read')).toContainText('$95,480 · income tax on the taxable dividend');
      await page.mouse.move(2, 2);
      await expect(page.locator('#chart .seg-read')).toBeHidden();
      await page.locator('#chart').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#chart .seg-read')).toContainText('$800,000');
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#chart .seg-read')).toContainText('$104,520');
      await page.keyboard.press('End');
      await expect(page.locator('#chart .seg-read')).toContainText(money(COMPARE ? S.compare.tax : S.tax));
      const desc = await page.locator('#chart-desc').textContent();
      const said = await page.locator('#answer').evaluate((a) => a.textContent);
      for (const v of [S.capDiv, S.afterTax, S.tax, S.inp.payout, ...(COMPARE ? [S.compare.family, S.compare.tax] : [])]) {
        expect(desc).toContain(money(v)); expect(said).toContain(money(v));
      }
      await expect(page.locator('#chart-table-rows tr')).toHaveCount(COMPARE ? 5 : 3);
    });

    test('colour by data type: each part reaches 3:1 against the ground, in both schemes', async ({ page }) => {
      await page.goto(url);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        const c = await page.evaluate(() => {
          const g = getComputedStyle(document.body).backgroundColor, f = (s, p) => getComputedStyle(document.querySelector(s))[p];
          return { g, cap: f('#chart .seg.p-cap', 'fill'), tax: f('#chart .seg.p-tax', 'fill'), hatch: f('#chart .hatch-line', 'stroke'), edge: f('#chart .seg-edge', 'stroke') };
        });
        for (const k of ['cap', 'tax', 'hatch', 'edge']) expect(ratio(c[k], c.g), `${theme} ${k}`).toBeGreaterThanOrEqual(3);
        // the parts are separated by a gap of the ground, so each edge reads against the ground
        const gap = await page.evaluate(() => { const r = [...document.querySelectorAll('#chart .seg')].slice(0, 2).map((e) => e.getBBox()); return r[1].x - (r[0].x + r[0].width); });
        expect(gap).toBeGreaterThanOrEqual(1.5);
      }
    });

    test('Go deeper: the tax cost in the Act, the dividend tax per $100, the election, the numbers; the sources', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('#deeper')).not.toHaveAttribute('open', '');
      await expect(page.locator('#deeper .deeper-in')).toHaveText('The cost base, in the Act · The dividend tax on the taxable part · The election · The numbers behind the chart');
      await page.locator('#deeper > summary').click();
      await expect(page.locator('#acb-rule')).toContainText('this tool does not estimate it');
      const L = per100(R);
      await expect(page.locator('#div-total')).toHaveText(cents(L.total));
      const shown = (await page.locator('#div-lines li').last().textContent()).match(/\$[\d.]+/g).map((s) => Number(s.slice(1)));
      expect(Math.abs(shown[0] - shown[1] + shown[2] + shown[3] - shown[4] - shown[5])).toBeLessThanOrEqual(0.02);
      for (const id of [R.ids.grossUp, R.ids.fedDTC, R.ids.onDTC, R.ids.fedTop, R.ids.onTop, R.ids.surtax]) await expect(page.locator(`#div-lines [data-fact~="${id}"]`).first()).toBeVisible();
      await expect(page.locator('#div-lines')).toContainText(`in ${R.rateYear} is ${pct2(R.rate)}`);
      await expect(page.locator('#elect')).toContainText('An election larger than the account has consequences of its own');
      await expect(page.locator('#elect')).toContainText('are left out here');
      await expect(page.locator('#nums-head th')).toHaveText(['Cost base', 'Capital dividend, tax-free', 'To the family after dividend tax', 'Income tax', 'Family in all', ...(COMPARE ? ['As a taxable dividend: to the family', 'As a taxable dividend: income tax'] : [])]);
      await expect(page.locator('#nums-rows tr')).toHaveCount(6);
      await expect(page.locator('#nums-rows tr.now')).toContainText('$200,000');
      await expect(page.locator('#nums-rows tr.now')).toContainText('$904,520');
      // the swipe cue appears exactly when columns are cut off
      const cut = await page.locator('#nums-wrap').evaluate((w) => w.scrollWidth > w.clientWidth + 1);
      if (cut) await expect(page.locator('#nums-cap')).toContainText(/Swipe the table for \d more columns? →/);
      else await expect(page.locator('#nums-cap')).not.toContainText('Swipe');
      await page.locator('.sources-fold summary').click();
      for (const f of R.used) await expect(page.locator(`#sources a[href="${f.source_url}"]`).first()).toBeAttached();
      expect(await page.locator('#sources a').evaluateAll((as) => as.map((a) => new URL(a.href).host).filter((h) => !/(^|\.)(canada\.ca|ontario\.ca|gc\.ca)$/.test(h)))).toEqual([]);
      await expect(page.locator('#sources')).toContainText(/Version [0-9a-f]{8} · rates for \d{4} · made in this browser; nothing was sent\./);
      await expect(page.locator('#sources')).toContainText('reference data, verify at the source');
    });

    test('the page’s words at run time: no advice or sales words; "tax-free" only beside "capital dividend"', async ({ page }) => {
      await page.goto(url);
      for (const [pay, acb] of [[1e6, 2e5], [1e6, 0], [1e6, 1e6]]) {
        await setState(page, pay, acb);
        await openAll(page);
        const units = await page.evaluate(() => [...document.querySelectorAll('main p, main li, main th, main td, main summary, #chart text')]
          .filter((e) => e.checkVisibility() && !e.closest('.desk-next')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
        const all = units.join(' | ');
        expect(all).not.toMatch(BANNED);
        expect(units.flatMap((u) => u.split(/(?<=[.!?])\s+/)).filter((s) => /tax-free/i.test(s) && !/capital dividend/i.test(s))).toEqual([]);
        expect(all.match(/\bCDA\b/g) || []).toHaveLength(1);
      }
    });

    test('every piece of text renders at 17.5px or more, chart labels included, in both schemes', async ({ page }) => {
      await page.goto(url);
      await expectTextSizes(page);
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await setState(page, 1e6, 990000);
      for (const d of await page.locator('details summary').all()) await d.click();
      await expectTextSizes(page);
      await page.locator('#chart').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#chart .seg-read')).toBeVisible();
      await expectTextSizes(page);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await page.locator('#acb').focus(); await page.keyboard.press('ArrowRight');
        for (const d of await page.locator('details summary').all()) await d.click();
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
      });
    }
  });
}

// a tap on a part reads it on a phone, and the reading stays after the finger lifts, until a tap elsewhere
test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('touch reads a part of the chart', async ({ page }) => {
    await page.goto(url);
    await page.locator('#chart .seg.p-cap').first().tap();
    const read = page.locator('#chart .seg-read');
    await expect(read).toBeVisible();
    await expect(read).toContainText('$800,000');
    await page.waitForTimeout(400);
    await expect(read).toBeVisible();
    await page.locator('h1').tap();
    await expect(read).toBeHidden();
  });
});

test.describe('1440, the answer column', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('opening "How this is worked out" leaves the control where it was', async ({ page }) => {
    await page.goto(url);
    const top = () => page.evaluate(() => document.querySelector('#acb').getBoundingClientRect().top);
    const before = await top();
    await page.locator('#answer .readout-how summary').click();
    expect(Math.abs((await top()) - before)).toBeLessThanOrEqual(4);
  });
});
