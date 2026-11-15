import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes, expectTemplate, expectReducedMotion } from '../../../shared/desk/shell-test.mjs';
import { toolFor, questionOf } from '../../../shared/desk/desk-page.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXAMPLE, freezeRules, defaultDeathAge, freeze, fmtBig, fmtM2, fmtM1 } from '../model.mjs';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const R = freezeRules(JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts);
const S = freeze(R, { ...EXAMPLE, deathAge: defaultDeathAge(R, EXAMPLE.freezeAge) });
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

    test('the tool shell, unlisted: tool bar, one Up next past it, noindex; nothing stored; no request after load', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expectShell(page, 'estate-freeze');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
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
      await expect(page.locator('#answer-k')).toHaveText('Income tax pushed past death');
      await expect(page.locator('#answer-v')).toHaveText('$2.38M');
      await expect(page.locator('#answer-t')).toHaveText('Deferred, not removed: the trust’s shares are taxed when sold or deemed sold.');
      await expect(page.locator('#answer-sub')).toHaveText('Owed at death: $0.86M with the freeze, $3.24M without.');
      await expect(page.locator('#assume')).toContainText('Hypothetical illustration · Education, not advice.');
      await expect(page.locator('#assume')).toContainText(`${R.rateYear} top rates`);
      await expect(page.locator('#chart-title')).toHaveText('At 87: $3.2M taxed at death, not $12.1M. The trust’s $8.9M is taxed later.');
      await expect(page.locator('#freeze-chart .tag-example')).toBeVisible();
      await expect(page.locator('#freeze-chart')).toContainText('Hypothetical illustration · Education, not advice');
      await expect(page.locator('#chart')).toContainText('Death at 87 (example)');
      await expect(page.locator('#chart')).toContainText('Trust’s 21st year, age 91');
      await expect(page.locator('#chart')).toContainText('Each redemption');
      for (const v of ['$12.1M', '$8.9M', '$3.2M']) await expect(page.locator('#chart')).toContainText(v);
      const ledger = await page.locator('#ledger').innerText();
      for (const v of ['$12.11M', '$3.20M', '$3.24M', '$0.86M', '$0.22M', '$3.46M', '$8.91M', '$2.38M', 'not payable (assumed)', 'age 91', '26.76%']) expect(ledger).toContain(v);
      await expect(page.locator('#caveats li')).toHaveCount(6);
      await expect(page.locator('#caveats a')).toHaveAttribute('href', '/watch/double-tax-at-death/');
      await expect(page.locator('#reset')).toBeHidden();
      if (width >= 560) await expect(page.locator('#death-hint')).toContainText('Statistics Canada');
      // How this is worked out: every rate wrapped in its fact
      await page.locator('#answer .readout-how summary').click();
      for (const id of ['refundable_investment_income_rate', 'part_iv_tax_rate', 'dividend_refund_rate', 'capital_gains_inclusion_rate', 'ontario_estate_admin_tax_rate']) await expect(page.locator(`#how [data-fact~="${id}"]`).first()).toBeVisible();
      await expect(page.locator('#how')).toContainText('Growth after death is not modelled.');
      expect(await page.locator('body').innerText()).not.toMatch(BANNED);
    });

    test('the slider, the cost clamp, the steppers and Back to the example', async ({ page }) => {
      await page.goto(url);
      const range = page.locator('#value');
      await range.focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#value-out')).toHaveText('$7.75M');
      await page.keyboard.press('PageUp');
      await expect(page.locator('#value-out')).toHaveText('$8.75M');
      await expect(page.locator('#reset')).toBeVisible();
      await page.keyboard.press('Home');
      await expect(page.locator('#value-out')).toHaveText('$1M');
      await expect(page.locator('#clamp')).toHaveText('Tax cost lowered to $1M');
      await expect(page.locator('#st-cost')).toHaveText('$1M');
      await expect(page.locator('#answer-extra')).toHaveText('No gain at the freeze: all later growth goes to the trust.');
      await expect(page.locator('button[aria-label^="Increase tax cost,"]')).toBeDisabled();
      await page.keyboard.press('End');
      await expect(page.locator('#value-out')).toHaveText('$25M');
      // steppers: named, 48px, disabled at a bound
      const up = page.locator('button[aria-label="Increase growth, now 4.0%"]');
      await expect(up).toHaveCount(1);
      const bb = await up.boundingBox(); expect(bb.height).toBeGreaterThanOrEqual(48); expect(bb.width).toBeGreaterThanOrEqual(44);
      await step(page, 'growth', -1, 20);
      await expect(page.locator('#st-growth')).toHaveText('0.0%');
      await expect(page.locator('button[aria-label^="Decrease growth,"]')).toBeDisabled();
      await expect(page.locator('#answer-t')).toHaveText('With no growth, the trust’s gain comes only from redemptions.');
      await page.locator('#reset').click();
      await expect(page.locator('#answer-v')).toHaveText('$2.38M');
      await expect(page.locator('#value-out')).toHaveText('$7.5M');
      await expect(page.locator('#reset')).toBeHidden();
      // the trust's 21st year before death
      await step(page, 'age at the freeze', -1, 10);
      await expect(page.locator('#answer-k')).toHaveText('Income tax moved to the trust');
      await expect(page.locator('#answer-t')).toHaveText('Here the trust’s 21st year, age 81, comes before death.');
      await expect(page.locator('#chart-title')).toHaveText('The trust’s 21st year, at 81, comes before death at 87.');
      // death follows the freeze age, never before it
      await step(page, 'age at the freeze', 1, 40);
      await expect(page.locator('#st-freezeAge')).toHaveText('85');
      await step(page, 'age at death', -1, 40);
      await expect(page.locator('#st-deathAge')).toHaveText('86');
      await expect(page.locator('button[aria-label^="Decrease age at death,"]')).toBeDisabled();
      await expectStorageClean(page);
      expect(page.url()).toBe(url);
    });

    test('no two chart labels overlap and none is clipped, at the extremes', async ({ page }) => {
      await page.goto(url);
      expect(await clashes(page, '#chart'), 'example').toEqual([]);
      await page.locator('#value').focus();
      await page.keyboard.press('Home'); // the smallest wedge: $1M, cost clamped to it
      expect(await clashes(page, '#chart'), 'smallest').toEqual([]);
      await step(page, 'tax cost', -1, 2);
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
      // the crosshair, by keyboard
      await page.locator('#chart').focus();
      await page.keyboard.press('ArrowLeft');
      await expect(page.locator('#chart .crosshair text')).toContainText('Taxed at death');
    });

    test('Go deeper: the moves, the redemptions, more assumptions, year by year; the sources', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('#deeper')).not.toHaveAttribute('open', '');
      await expect(page.locator('#deeper .deeper-in')).toHaveText('The moves, in plain words · Redemptions, year by year · More assumptions · Year by year');
      await openDeeper(page);
      await expect(page.locator('#flow li')).toHaveCount(4);
      await expect(page.locator('#bars')).toContainText('Year 1: about $90,000');
      await expect(page.locator('#cash-line')).toContainText('In year one the company earns $100,000');
      await expect(page.locator('#years-rows tr')).toHaveCount(S.n + 1);
      await expect(page.locator('#years-rows tr.death')).toContainText(fmtM2(S.gainNo));
      await step(page, 'investment income', 1, 40);
      await expect(page.locator('#st-income')).toHaveText('$500K');
      await expect(page.locator('#bars')).toContainText('Year 1: about $450,000');
      await page.locator('.sources-fold summary').click();
      for (const f of R.used) await expect(page.locator(`#sources a[href="${f.source_url}"]`).first()).toBeAttached();
      await expect(page.locator('#sources')).toContainText('Statistics Canada table 13-10-0114-01');
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
      expect(card.bigValue).toBe('$2.38M');
      expect(card.line).toContain('deferred, not removed');
      expect(card.labels).toEqual([`Taxed at death: ${fmtM1(S.gainNo)} → ${fmtM1(S.gainWith)}`, 'Trust’s 21st year: age 91']);
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
