import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes, expectTemplate, expectReducedMotion } from '../../../shared/desk/shell-test.mjs';
import { toolFor, questionOf } from '../../../shared/desk/desk-page.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXAMPLE, BOUNDS, PAT, STEADY, yieldsFrom, run, summary, parRules, pts, pct } from '../model.mjs';
import { BANNED, STAMP, NOT_G, ASSUME, CLOSE, CONTROL_LABEL } from './words.mjs';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts;
const R = parRules(facts);
const { Y } = yieldsFrom(JSON.parse(readFileSync(new URL('../../../shared/data/long-bond-yield-yearly.json', import.meta.url), 'utf8')));
const sum = (o = {}) => summary(run(Y, o));
const S = sum();

async function setN(page, n) { await page.locator('#n').evaluate((r, v) => { r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, n); await page.waitForTimeout(60); }
async function openDeeper(page) { if (!(await page.locator('#deeper').evaluate((d) => d.open))) await page.locator('#deeper > summary').click(); }
async function setW(page, w) { await openDeeper(page); await page.locator('#w').evaluate((r, v) => { r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, Math.round(w * 100)); await page.waitForTimeout(60); }
async function setL(page, L) { await openDeeper(page); await page.locator(`input[name="ladder"][value="${L}"]`).check(); await page.waitForTimeout(40); }
async function setSteady(page, on) { await page.locator(on ? '#swing-off' : '#swing-on').check(); await page.waitForTimeout(40); }
async function clashes(page) {
  const boxes = await page.locator('#chart text').evaluateAll((ts) => ts.filter((t) => t.textContent.trim() && !t.closest('.crosshair')).map((t) => { const b = t.getBBox(); return [b.x, b.y, b.width, b.height, t.textContent]; }));
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    if (a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1) out.push(`${a[4]} / ${b[4]}`);
  }
  const vb = await page.locator('#chart').evaluate((s) => [s.viewBox.baseVal.width, s.viewBox.baseVal.height]);
  for (const b of boxes) if (b[0] < -0.5 || b[0] + b[2] > vb[0] + 0.5 || b[1] < -0.5 || b[1] + b[3] > vb[1] + 0.5) out.push(`${b[4]} is clipped`);
  return out;
}
const sentences = (t) => t.split(/(?<=[.!?])\s+/);
// what the visitor reads, without the facts' own words (quoted verbatim in Go deeper, and their titles in Sources) and the
// shared Up next card
const readable = (page) => page.evaluate(() => { const m = document.querySelector('main').cloneNode(true); m.querySelectorAll('blockquote, .fact-title, .desk-next, script').forEach((e) => e.remove()); return m.innerText; });
async function wordsOk(page) {
  const t = (await readable(page)) + ' ' + (await page.locator('#chart-desc').textContent()) + ' ' + (await page.locator('#n').getAttribute('aria-valuetext'));
  expect(t).not.toMatch(BANNED);
  expect(sentences(t).filter((s) => /guarantee/i.test(s) && !/\bnot\b|\bcannot\b/i.test(s))).toEqual([]);
  const rule = /smoothing period|\bspread(s|ing)?\b[^.]*\bover\b/i, ok = /our assumption|set above|a setting|this example/i;
  const lines = t.split('\n').flatMap(sentences).map((s) => s.trim()).filter(Boolean);
  expect(lines.filter((s) => rule.test(s) && !ok.test(s) && s.toLowerCase() !== CONTROL_LABEL.toLowerCase())).toEqual([]);
}
const lum = (rgb) => { const c = rgb.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the tool shell, unlisted: tool bar, one Up next, noindex; nothing stored; no request after load', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      await expectShell(page, 'par-dividends');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      await expect(page.locator('a[data-next]')).toHaveAttribute('href', '/tools/tax-dates/');
      await page.locator('#n').focus(); await page.keyboard.press('ArrowRight');
      await page.locator('#chart').focus(); await page.keyboard.press('ArrowRight');
      for (const d of await page.locator('details summary').all()) await d.click();
      await page.locator('#swing-off').check(); await page.locator('input[name="ladder"][value="20"]').check();
      await expectStorageClean(page);
      expect(page.url()).toBe(url);
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => [sessionStorage.length, Object.keys(localStorage).filter((k) => k !== 'theme').length])).toEqual([0, 0]);
      await expect(page.locator('#print, #card, .btn-you, .save-row')).toHaveCount(0);
    });

    test('the desk template budgets, no sideways scroll, and reduced motion makes the change instant', async ({ page }) => {
      await page.goto(url);
      const m = await expectTemplate(page);
      if (width === 390) {
        expect(m.deeperTop).toBeLessThanOrEqual(2800);
        const fig = await page.evaluate(() => document.querySelector('#answer-v').getBoundingClientRect().bottom + scrollY);
        expect(fig, 'the big figure ends by y = 700').toBeLessThanOrEqual(700);
      }
      for (const w of [390, 768, 1440]) {
        await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(80);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `no sideways scroll at ${w}`).toBeLessThanOrEqual(0);
      }
      await page.setViewportSize({ width, height: 900 });
      const now = await expectReducedMotion(page, async (p) => { await p.locator('#n').focus(); await p.keyboard.press('ArrowRight'); });
      expect(now).toContain(pts(sum({ N: EXAMPLE.N + 1 }).maxMoveCredited));
    });

    test('opens on the labelled example', async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('h1')).toHaveText(questionOf(toolFor('par-dividends')));
      await expect(page.locator('.play .kicker')).toHaveText('Tool');
      await expect(page.locator('#lede')).toHaveText('Dividends typically use a smoothed credited rate. It moves in small steps while returns jump.');
      await expect(page.locator('#answer-of')).toHaveText('percentage points in a year');
      await expect(page.locator('#def')).toContainText('it is not what a policy earns');
      await expect(page.locator('#def [data-fact="par_actual_vs_assumed"]')).toContainText('the rate assumed when the policy was priced');
      await expect(page.locator('#n-label')).toHaveText(CONTROL_LABEL);
      await expect(page.locator('#n-out')).toHaveText('5 years');
      await expect(page.locator('#n')).toHaveAttribute('aria-valuetext', '5 years, a setting to explore');
      await expect(page.locator('#n')).toHaveAttribute('min', String(BOUNDS.N.min));
      await expect(page.locator('#n')).toHaveAttribute('max', String(BOUNDS.N.max));
      await expect(page.locator('#answer-v')).toHaveText(pts(S.maxMoveCredited));
      await expect(page.locator('#answer-t')).toHaveText(`The actual return changed by up to ${pts(S.maxMoveActual)} points in one year.`);
      await expect(page.locator('#not-g')).toHaveText(NOT_G);
      await expect(page.locator('#assume')).toHaveText(`${STAMP}. ${ASSUME}`);
      await expect(page.locator('#echo-row')).toBeHidden();
      await expect(page.locator('#steps li')).toHaveCount(4);
      // the chart follows the answer; What happens is the first part of Go deeper
      await expect(page.locator('#deeper > .deeper-sub').first()).toHaveAttribute('aria-labelledby', 'moves-h');
      expect(await page.evaluate(() => document.querySelector('#side').lastElementChild.getBoundingClientRect().bottom <= document.querySelector('#par-chart').getBoundingClientRect().top)).toBe(true);
      await expect(page.locator('#par-chart #swings input')).toHaveCount(2);
      await expect(page.locator('#par-chart .tag-stamp')).toHaveCount(0);
      await expect(page.locator('#chart-title')).toHaveText('The credited rate moves slowly; the actual return jumps');
      await expect(page.locator('#chart-sub')).toHaveText(`Made-up account, % a year, ${S.first}–${S.last}. The bond yield is real.`);
      await expect(page.locator('#par-chart .tag-example')).toBeVisible();
      await expect(page.locator('.chart-hint')).toHaveText('Tap or use the arrow keys to read a year.');
      for (const v of [`${S.low.year}: earned `, pct(S.low.actual), `${S.high.year}: earned `, pct(S.high.actual), pct(S.high.credited)]) await expect(page.locator('#chart')).toContainText(v);
      await expect(page.locator('.caveats-close')).toHaveText(CLOSE);
      await expect(page.locator('#caveats .cv-group')).toHaveCount(4);
      await expect(page.locator('#caveats')).toContainText('The smoothing period is our assumption, not any insurer’s, and methods differ.');
      await expect(page.locator('#caveats')).toContainText('A real dividend scale is typically set in advance');
      await expect(page.locator('#caveats')).toContainText(`The pattern: ${PAT.map((v) => (v > 0 ? '+' : '−') + Math.abs(v)).join(', ')} points, from ${EXAMPLE.start}.`);
      await expect(page.locator('#avg-line')).toHaveText(`Over ${S.first}–${S.last} the simple averages are ${pct(S.meanActual)} a year for the actual return and ${pct(S.meanCredited)} for the credited rate. In this model, smoothing mostly changes when results are credited, not how much. Neither line is what a policy earns: a real account also pays costs and keeps some earnings as surplus.`);
      await expect(page.locator('#eighties-line')).toContainText('because year-end long bond yields were');
      // How this is worked out
      await page.locator('#how-fold summary').click();
      await expect(page.locator('#how li')).toHaveCount(5);
      await expect(page.locator('#how')).toContainText(`is ${pts(S.maxMoveCredited)} points (into ${S.maxMoveCreditedYear})`);
      await expect(page.locator('#how')).toContainText(`In a typical year the credited rate moved ${pts(S.medianMoveCredited)} points and the actual return ${pts(S.medianMoveActual)}.`);
      await wordsOk(page);
    });

    test('the not-guaranteed line and What happens say what the facts say; Go deeper quotes them verbatim', async ({ page }) => {
      await page.goto(url);
      const v = (id) => facts.find((f) => f.id === id).value;
      expect(v('par_dividends_not_guaranteed')).toMatch(/cannot be guaranteed/);
      expect(v('par_board_discretion')).toMatch(/discretion of the board of directors/);
      await expect(page.locator('#not-g [data-fact="par_dividends_not_guaranteed"]').first()).toHaveText('Dividends are not guaranteed');
      await expect(page.locator('#not-g [data-fact="par_board_discretion"]')).toHaveText('a life insurer’s board declares them');
      const step = (id) => page.locator(`#steps [data-fact="${id}"]`).first();
      expect(v('par_separate_account')).toMatch(/separately/); await expect(step('par_separate_account')).toContainText('separate');
      expect(v('par_actual_vs_assumed')).toMatch(/differences between actual levels of experience/); await expect(step('par_actual_vs_assumed')).toContainText('differ from what was assumed');
      expect(v('par_smoothing_purpose')).toMatch(/undue yearly fluctuations/); await expect(step('par_smoothing_purpose')).toContainText('undue yearly swings');
      expect(v('par_actuary_report')).toMatch(/fairness/); expect(v('par_actuary_report')).toMatch(/directors/); await expect(step('par_actuary_report')).toContainText('fairness');
      await expect(step('par_board_discretion')).toContainText('discretion');
      await page.locator('#deeper > summary').click();
      const quotes = await page.locator('#rules blockquote').evaluateAll((bs) => bs.map((b) => [b.getAttribute('data-fact'), b.textContent]));
      expect(quotes.length).toBe(9);
      for (const [id, text] of quotes) expect(text).toBe(v(id));
      await expect(page.locator('#rules')).toContainText(`at most ${R.shareholderRange.min}% to ${R.shareholderRange.max}% of the profit set for distribution`);
      for (const [id] of quotes) {
        const f = facts.find((x) => x.id === id), where = page.locator(`[data-rule="${id}"] .rule-src`);
        // the shareholder ceiling is statute (section 461); the line shown is OSFI's summary of it
        if (id === 'par_shareholder_cap_range') { await expect(where).toContainText('Insurance Companies Act, section 461: the ceiling is law'); await expect(where).not.toContainText('not law'); continue; }
        await expect(where).toContainText(f.authority === 'statute' ? /Insurance Companies Act|Policyholders Disclosure Regulations/ : 'OSFI expects; a guideline, not law.');
      }
      await expect(page.locator('#rules')).not.toContainText('par_');
      await expect(page.locator('#where')).toContainText('at no charge');
      await expect(page.locator('.gloss dt')).toHaveCount(8);
    });

    test('every visible text is 17.5px or more, in every fold and state', async ({ page }) => {
      await page.goto(url);
      await expectTextSizes(page, 17.5, 17.5);
      for (const d of await page.locator('details > summary').all()) await d.click();
      await page.locator('#nums-wrap').evaluate((w) => { w.scrollLeft = w.scrollWidth; });
      await expectTextSizes(page, 17.5, 17.5);
      await page.locator('#chart').focus(); await page.keyboard.press('Home');
      await expectTextSizes(page, 17.5, 17.5);
      await setN(page, 1); await setSteady(page, true);
      await expectTextSizes(page, 17.5, 17.5);
    });

    test('no label collisions on the chart across the settings', async ({ page }) => {
      await page.goto(url);
      const bad = [];
      for (let n = BOUNDS.N.min; n <= BOUNDS.N.max; n++) { await setN(page, n); bad.push(...(await clashes(page)).map((c) => `N${n}: ${c}`)); }
      await setN(page, EXAMPLE.N);
      await setSteady(page, true); bad.push(...(await clashes(page)).map((c) => `steady: ${c}`)); await setSteady(page, false);
      for (const w of [BOUNDS.w.min, BOUNDS.w.max]) { await setW(page, w); bad.push(...(await clashes(page)).map((c) => `w${w}: ${c}`)); }
      await setW(page, EXAMPLE.w);
      for (const L of [BOUNDS.L[0], BOUNDS.L.at(-1)]) { await setL(page, L); bad.push(...(await clashes(page)).map((c) => `L${L}: ${c}`)); }
      expect(bad).toEqual([]);
      // both point readings are on the chart in every case above (they move with the settings)
      await setL(page, EXAMPLE.L);
      await expect(page.locator('#chart .pt-low')).toHaveCount(1); await expect(page.locator('#chart .pt-high')).toHaveCount(1);
    });

    test('the averages line, the titles and the readout follow every N, with and without swings', async ({ page }) => {
      await page.goto(url);
      for (let n = BOUNDS.N.min; n <= BOUNDS.N.max; n++) {
        await setN(page, n);
        const s = sum({ N: n });
        await expect(page.locator('#answer-v')).toHaveText(pts(s.maxMoveCredited));
        await expect(page.locator('#chart-title')).toHaveText(n === 1 ? 'Even unspread, the credited rate lags: bonds count at the yield they were bought at' : 'The credited rate moves slowly; the actual return jumps');
        await expect(page.locator('#avg-line')).toContainText('smoothing mostly changes when results are credited, not how much.');
        // at the example's mix the figure falls with every extra year, so the help line keeps its default
        await expect(page.locator('#n-help')).toHaveText('A setting to explore, not any insurer’s.');
        await expect(page.locator('#answer-t')).toHaveText(`The actual return changed by up to ${pts(s.maxMoveActual)} points in one year.`);
        // the aria-live readout and the chart's description state the same figures
        const desc = await page.locator('#chart-desc').textContent();
        expect(desc).toContain(`biggest one-year change is ${pts(s.maxMoveCredited)} points`);
        expect(desc).toContain(`the actual return’s is ${pts(s.maxMoveActual)} points`);
        expect(desc).toContain(`Lowest year ${s.low.year}: earned ${pct(s.low.actual)}, credited ${pct(s.low.credited)}`);
      }
      // steady stocks: nothing to spread, so the slider is off and says why; the switch sits with the chart
      await setN(page, EXAMPLE.N);
      await setSteady(page, true);
      const st = sum({ pattern: STEADY });
      await expect(page.locator('#n')).toBeDisabled();
      await expect(page.locator('#answer-v')).toHaveText(pts(st.maxMoveCredited));
      await expect(page.locator('#answer-t')).toHaveText(`With steady stocks, the actual return still changed by up to ${pts(st.maxMoveActual)} points in one year, mostly from bond prices.`);
      await expect(page.locator('#n-help')).toHaveText('With steady stocks and property there is nothing to spread: only the bonds hold the credited rate back.');
      await expect(page.locator('#chart-title')).toHaveText('With steady stocks, only the bonds keep the credited rate behind');
      await expect(page.locator('#avg-line')).toContainText('smoothing mostly changes when results are credited, not how much.');
      await wordsOk(page);
      await setSteady(page, false);
      await expect(page.locator('#n')).toBeEnabled();
      // a figure higher than one year fewer gives the reason in the help line (a mix where that happens)
      await setW(page, BOUNDS.w.min);
      for (let n = BOUNDS.N.min + 1; n <= BOUNDS.N.max; n++) {
        const a = Number(pts(sum({ N: n, w: BOUNDS.w.min }).maxMoveCredited)), b = Number(pts(sum({ N: n - 1, w: BOUNDS.w.min }).maxMoveCredited));
        await setN(page, n);
        await expect(page.locator('#n-help')).toHaveText(a > b ? `Higher than at ${n - 1} year${n - 1 === 1 ? '' : 's'}: the made-up swings repeat every ${PAT.length} years, and some settings line up with them.` : 'A setting to explore, not any insurer’s.');
      }
      await wordsOk(page);
    });

    test('a Go deeper control changes the answer and the chart, shows the echo, and Back to the example restores the first paint', async ({ page }) => {
      await page.goto(url);
      const first = await page.locator('main').innerText();
      const chart0 = await page.locator('#chart').innerHTML();
      await setW(page, 0.6);
      const s = sum({ w: 0.6 });
      await expect(page.locator('#answer-v')).toHaveText(pts(s.maxMoveCredited));
      expect(await page.locator('#chart').innerHTML()).not.toBe(chart0);
      await expect(page.locator('#echo')).toHaveText('Account changed below: 60% bonds and loans, 10-year ladder.');
      await expect(page.locator('#w-rest')).toHaveText('The rest, 40%, is in stocks and property.');
      await setL(page, 20); await setSteady(page, true);
      await expect(page.locator('#echo')).toHaveText('Account changed below: 60% bonds and loans, 20-year ladder.');
      await expect(page.locator('#answer-v')).toHaveText(pts(sum({ w: 0.6, L: 20, pattern: STEADY }).maxMoveCredited));
      await page.locator('#reset').click();
      await expect(page.locator('#echo-row')).toBeHidden();
      await page.locator('#deeper > summary').click();
      await page.waitForTimeout(500);
      expect(await page.locator('main').innerText()).toBe(first);
      // and from the top
      await setL(page, 5); await page.locator('#deeper > summary').click();
      await page.locator('#reset-top').click();
      await page.waitForTimeout(500);
      expect(await page.locator('main').innerText()).toBe(first);
      await expect(page.locator('#n')).toBeFocused();
    });

    test('the chart reads a year by keyboard; the table holds every year', async ({ page }) => {
      await page.goto(url);
      await page.locator('#chart').focus();
      await page.keyboard.press('Home');
      const r0 = run(Y)[0];
      await expect(page.locator('#chart .crosshair')).toBeVisible();
      await expect(page.locator('#chart .crosshair text')).toHaveText(`${r0.year}Actual ${pct(r0.actual)}Credited ${pct(r0.credited)}Bond yield ${pct(r0.bond)} (real)`);
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#chart .crosshair text')).toContainText(String(r0.year + 1));
      await page.locator('#deeper > summary').click();
      await expect(page.locator('#nums-rows tr')).toHaveCount(run(Y).length);
      await expect(page.locator('#nums-cap')).toContainText(`In a typical year the actual return moved ${pts(S.medianMoveActual)} points from the year before; the credited rate ${pts(S.medianMoveCredited)}.`);
    });

    for (const scheme of ['light', 'dark']) {
      test(`axe and the chart's non-text contrast, ${scheme}`, async ({ page }) => {
        await page.addInitScript((s) => { try { localStorage.setItem('theme', s); } catch (e) {} }, scheme);
        await page.goto(url);
        expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(scheme);
        for (const d of await page.locator('details > summary').all()) await d.click();
        const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(res.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
        const c = await page.evaluate(() => {
          const rgb = (s) => s.match(/[\d.]+/g).map(Number);
          const ground = rgb(getComputedStyle(document.body).backgroundColor);
          const cs = (sel) => getComputedStyle(document.querySelector(sel));
          const bar = cs('#chart .bar'), fill = rgb(bar.fill), a = Number(bar.fillOpacity);
          return { ground, edge: rgb(cs('#chart .bar-edge').stroke), credited: rgb(cs('#chart .credited').stroke), bond: rgb(cs('#chart .bond').stroke), halo: rgb(cs('#chart .halo').stroke), barFill: fill.map((v, i) => v * a + ground[i] * (1 - a)) };
        });
        expect(ratio(c.edge, c.ground)).toBeGreaterThanOrEqual(3);
        expect(ratio(c.credited, c.ground)).toBeGreaterThanOrEqual(3);
        expect(ratio(c.bond, c.ground)).toBeGreaterThanOrEqual(3);
        // the bars are told apart by their full-strength edge; the credited line crosses them on a halo of the ground
        expect(c.halo).toEqual(c.ground);
        expect(ratio(c.barFill, c.ground), 'the bar fill is visible').toBeGreaterThanOrEqual(1.8);
      });
    }
  });
}

test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('a tapped year\'s reading stays after the finger lifts, until a tap elsewhere', async ({ page }) => {
    await page.goto(url);
    const box = await page.locator('#chart').boundingBox();
    await page.locator('#chart').scrollIntoViewIfNeeded();
    const b = await page.locator('#chart').boundingBox();
    await page.touchscreen.tap(b.x + b.width * 0.6, b.y + 80);
    await page.waitForTimeout(300);
    await expect(page.locator('#chart .crosshair')).toBeVisible();
    expect(box.width).toBeGreaterThan(300);
    const o = await page.locator('#avg-line').boundingBox();
    await page.touchscreen.tap(o.x + 10, o.y + 10);
    await page.waitForTimeout(100);
    await expect(page.locator('#chart .crosshair')).toBeHidden();
  });
});
