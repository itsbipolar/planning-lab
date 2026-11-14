import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes, expectTemplate, expectReducedMotion } from '../../../shared/desk/shell-test.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const facts = Object.fromEntries(JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts
  .filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));
const n = (id) => Number(facts[id].value);
const std = n('cpp_standard_start_age'), latest = n('cpp_latest_start_age'), earliest = n('cpp_earliest_start_age');
const oasStart = n('oas_start_age'), oasLatest = n('oas_deferral_max_age');
// The crossing for a CPP start (in whole months), worked out here the planning-timeline way, in years of the standard pension.
const cross = (age) => {
  const months = Math.round((age - std) * 12);
  const share = 1 + months * (months < 0 ? n('cpp_early_start_reduction') : n('cpp_late_start_increase')) / 100;
  return (share * age - std) / (share - 1);
};
const cppShare = (age) => { const m = Math.round((age - std) * 12); return 1 + m * (m < 0 ? n('cpp_early_start_reduction') : n('cpp_late_start_increase')) / 100; };
const pctText = (x) => `${Number((Math.abs(x) * 100).toFixed(1))}%`;
const story = JSON.parse(readFileSync(new URL('../story.json', import.meta.url), 'utf8'));
// The page's question is the one its Up next card and the site use (shared/desk/next.json).
const question = JSON.parse(readFileSync(new URL('../../../shared/desk/next.json', import.meta.url), 'utf8')).tools.find((t) => t.labSlug === 'two-number-letter').question;
const setStart = (page, months) => page.locator('#start').evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, months);
const openLetter = (page) => page.locator('#open-letter').click();
const openDeeper = async (page) => { await page.locator('#deeper > summary').click(); await expect(page.locator('#deeper')).toHaveAttribute('open', ''); };

// Every pair of text labels inside each chart: none may overlap, and none may leave the chart.
async function labelClashes(page) {
  return page.evaluate(() => {
    const bad = [];
    for (const svg of [...document.querySelectorAll('.plot svg')].filter((v) => v.checkVisibility())) {
      const box = svg.getBoundingClientRect();
      const t = [...svg.querySelectorAll('text')].filter((e) => !e.closest('.crosshair')).map((e) => ({ s: e.textContent, b: e.getBoundingClientRect() }));
      for (const a of t) {
        if (a.b.left < box.left - 1 || a.b.right > box.right + 1 || a.b.top < box.top - 1 || a.b.bottom > box.bottom + 1) bad.push(`outside: ${a.s}`);
      }
      for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
        const a = t[i].b, b = t[j].b;
        if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) bad.push(`${t[i].s} / ${t[j].s}`);
      }
    }
    return bad;
  });
}

test('banned phrases are nowhere on the page', () => {
  const text = readFileSync(file, 'utf8').replace(/data:[^"')]+/g, '');
  for (const re of [/\bshould\b/i, /best for you/i, /\brecommend(s|ed)?\b/i, /guarantee/i, /best age/i, /financial (planner|advisor|adviser)/i, /\bCFP\b/])
    expect(text, String(re)).not.toMatch(re);
});

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the tool shell: tool bar, one Up next card, notes, share tags; no rail, nothing sticky, nothing stored', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectShell(page, 'two-number-letter');
      await expectStorageClean(page);
    });

    test('the desk template: the question, one slider first, one big answer, one assumptions line, Go deeper closed', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await page.evaluate(() => document.fonts.ready);
      const m = await expectTemplate(page);
      if (width === 390) {
        expect(m.firstTop).toBeLessThanOrEqual(700);
        expect(m.answerTop).toBeLessThanOrEqual(700);
        expect(m.deeperTop).toBeLessThanOrEqual(2800);
        // the figure itself is on the first phone screen, not only the readout's top
        const fig = await page.locator('#answer-v').boundingBox();
        expect(fig.y + fig.height).toBeLessThanOrEqual(700);
      }
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(question);
      expect(question.split(/\s+/).length).toBeLessThanOrEqual(12);
      expect((await page.locator('main .play-head > .kicker').textContent()).trim()).toMatch(/^[A-Za-z]+$/);
      await expect(page.locator('[data-first-move] input[type=range]#start')).toHaveCount(1);
      await expect(page.locator('[data-assumptions]')).toHaveText('Totals in today’s dollars, before tax. No investment return, and no odds of living to each age. Education, not advice.');
      // the slider's thumb is 48px
      const thumb = await page.evaluate(() => [...document.styleSheets].flatMap((sh) => [...sh.cssRules])
        .filter((r) => r.selectorText && /#?start.*::-webkit-slider-thumb|\.start input\[type="?range"?\]::-webkit-slider-thumb/.test(r.selectorText)).map((r) => [r.style.width, r.style.height]));
      expect(thumb).toContainEqual(['48px', '48px']);
      expect((await page.locator('#start').boundingBox()).height).toBeGreaterThanOrEqual(48);
      // one chart in the main view, framed, with the example tag; the letter's charts wait in the closed fold
      await expect(page.locator('figure.chart:visible')).toHaveCount(1);
      await expect(page.locator('#fig-main .tag-example')).toHaveText(/example data/i);
      await expect(page.locator('#letter-view')).toBeHidden();
      await expect(page.locator('#deeper #sliders input[type=range]')).toHaveCount(10);
      await expect(page.locator('#deeper #plot-cpp')).toHaveCount(1);
    });

    test('the example opens on CPP at the latest age against the standard: the crossing and the bigger cheque', async ({ page }) => {
      await page.goto(url);
      const range = page.locator('#start');
      await expect(range).toHaveAttribute('min', String(earliest * 12));
      await expect(range).toHaveAttribute('max', String(latest * 12));
      await expect(range).toHaveAttribute('step', '1');
      await expect(range).toHaveValue(String(latest * 12));
      await expect(range).toHaveAttribute('aria-valuetext', `CPP from ${latest}`);
      await expect(page.locator('#answer-k')).toHaveText('Waiting catches up at about');
      await expect(page.locator('#answer-v')).toHaveText(`Age ${Math.round(cross(latest))}`);
      await expect(page.locator('#answer-t')).toHaveText('From then on, the later start stays ahead in total.');
      await expect(page.locator('#answer-pct')).toHaveText(`+${pctText(cppShare(latest) - 1)}`);
      await expect(page.locator('#answer-pct-t')).toContainText(`against a start at ${std}`);
      await expect(page.locator('#main-h')).toHaveText(`Starting at ${latest}, not ${std}, pays more in total past about age ${Math.round(cross(latest))}`);
      await expect(page.locator('#plot-main')).toContainText('They cross here');
      await expect(page.locator('#plot-main path.ln')).toHaveCount(2);
      await expect(page.locator('.bubble')).toHaveText(String(latest));
      // How this is worked out: closed, and it gives the crossing in years and months
      await expect(page.locator('.readout-how')).not.toHaveAttribute('open', '');
      await page.locator('.readout-how summary').click();
      await expect(page.locator('#how')).toContainText(`${n('cpp_late_start_increase')}%`);
      await expect(page.locator('#how')).toContainText('does not change that age');
    });

    test('the slider steps a month at a time, earlier and standard starts read as trade-offs, and nothing is stored or sent', async ({ page }) => {
      const requests = [], errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url); await page.waitForLoadState('load');
      const start = page.url();
      page.on('request', (rq) => requests.push(rq.url()));
      const range = page.locator('#start');
      const dot = () => page.locator('#plot-main circle.dot-pick').getAttribute('cx');
      const before = await dot();
      await range.focus();
      await page.keyboard.press('ArrowLeft');
      await expect(range).toHaveValue(String(latest * 12 - 1));
      await expect(range).toHaveAttribute('aria-valuetext', `CPP from ${latest - 1} and 11 months`);
      await expect(page.locator('.bubble')).toHaveText(`${latest - 1} and 11 months`);
      await expect(page.locator('#answer-pct')).toHaveText(`+${pctText(cppShare(latest - 1 / 12) - 1)}`);
      expect(await dot()).not.toBe(before);
      await page.keyboard.press('Home');
      await expect(range).toHaveValue(String(earliest * 12));
      await expect(page.locator('#answer-k')).toHaveText('Starting early leads until about');
      await expect(page.locator('#answer-v')).toHaveText(`Age ${Math.round(cross(earliest))}`);
      await expect(page.locator('#answer-t')).toHaveText(`After that, the start at ${std} is ahead in total.`);
      await expect(page.locator('#answer-pct')).toHaveText(`−${pctText(1 - cppShare(earliest))}`);
      await expect(page.locator('#main-h')).toHaveText(`Starting at ${earliest} instead of ${std} stays ahead in total until about age ${Math.round(cross(earliest))}`);
      await setStart(page, std * 12);
      await expect(page.locator('#answer-v')).toHaveText('No change');
      await expect(page.locator('#answer-sub')).toBeHidden();
      await expect(page.locator('#plot-main path.ln')).toHaveCount(1);
      await expect(page.locator('#plot-main')).not.toContainText('They cross here');
      // the readout words stay within the template's limits in every state
      for (const v of [earliest * 12, std * 12, std * 12 + 1, latest * 12]) {
        await setStart(page, v);
        expect((await page.locator('#answer-k').textContent()).trim().split(/\s+/).length).toBeLessThanOrEqual(6);
        expect((await page.locator('#answer-t').textContent()).trim().split(/\s+/).length).toBeLessThanOrEqual(14);
      }
      await expectStorageClean(page);
      expect(page.url()).toBe(start);
      expect(requests).toEqual([]); expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('the CPP | OAS switch: OAS runs from its first age to its latest, never lower, and the thumb is clamped', async ({ page }) => {
      await page.goto(url);
      const range = page.locator('#start');
      await setStart(page, (earliest + 2) * 12);
      await page.locator('[data-plan="oas"]').click();
      await expect(page.locator('[data-plan="oas"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(range).toHaveAttribute('min', String(oasStart * 12));
      await expect(range).toHaveAttribute('max', String(oasLatest * 12));
      await expect(range).toHaveValue(String(oasStart * 12));
      await expect(page.locator('#answer-v')).toHaveText('No wait');
      await expect(page.locator('#ticks span').first()).toHaveText(String(oasStart));
      // the browser itself refuses a value under the OAS range
      await setStart(page, (oasStart - 1) * 12);
      await expect(range).toHaveValue(String(oasStart * 12));
      await range.focus(); await page.keyboard.press('Home');
      await expect(range).toHaveValue(String(oasStart * 12));
      await page.keyboard.press('End');
      await expect(range).toHaveValue(String(oasLatest * 12));
      await expect(page.locator('#answer-k')).toHaveText('Waiting catches up at about');
      await expect(page.locator('#answer-pct')).toHaveText(`+${pctText(oasLatest * 12 - oasStart * 12 === 0 ? 0 : (oasLatest - oasStart) * 12 * n('oas_deferral_increase') / 100)}`);
      await expect(page.locator('#main-sub')).toContainText(`${n('oas_age75_increase')}% rise`);
      await expect(page.locator('#plot-main')).toContainText('They cross here');
      // back to CPP: the value is kept, inside the CPP range
      await page.locator('[data-plan="cpp"]').click();
      await expect(range).toHaveAttribute('min', String(earliest * 12));
      await expect(range).toHaveValue(String(oasLatest * 12));
    });

    test('every word on the page renders at 17.5px or more, chart words included, in each view', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await page.evaluate(() => document.fonts.ready);
      await expectTextSizes(page);
      // small text and labels at 17.5px or more (Mo), chart words included
      expect(await page.evaluate(() => [...document.querySelectorAll('#plot-main text, #ticks span, [data-assumptions], .readout-k, .bubble span')]
        .map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((px) => px < 17.5))).toEqual([]);
      await page.locator('[data-plan="oas"]').click();
      await expectTextSizes(page);
      const svg = page.locator('#plot-main svg'); await svg.scrollIntoViewIfNeeded();
      const b = await svg.boundingBox();
      await page.mouse.move(b.x + b.width * 0.6, b.y + b.height / 2);
      await expect(page.locator('#plot-main .crosshair')).toBeVisible();
      await expectTextSizes(page);
      await page.locator('.readout-how summary').click();
      await openLetter(page);
      await expectTextSizes(page);
      await page.locator('#letter-view [data-who="b"]').click();
      await openDeeper(page);
      await expectTextSizes(page);
      await page.locator('.sources summary').click();
      await expectTextSizes(page);
    });

    test('Read it as a planning letter opens the Lena and Tom letter in place; its amber numbers rewrite it', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      const btn = page.getByRole('button', { name: 'Read it as a planning letter' });
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await expect(btn).toHaveAttribute('aria-controls', 'letter-view');
      await btn.click();
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#letter-view')).toBeVisible();
      await expect(page.locator('.letter-lede')).toHaveText(`${story.people.a.name} and ${story.people.b.name} are made up. Drag any amber number and the letter rewrites itself.`);
      await expect(page.locator('#rd-cpp-k')).toHaveText('CPP: waiting catches up at');
      await expect(page.locator('#rd-oas-k')).toHaveText('OAS: waiting catches up at');
      const thr = Object.values(facts).filter((f) => f.series === 'oas_recovery_threshold').sort((a, b) => b.tax_year - a.tax_year)[0];
      await expect(page.locator('#rd-rec-k')).toHaveText(`OAS taken back from ${story.people.a.name} in ${thr.tax_year}`);
      await expect(page.locator('#letter-view .note')).toContainText('Recovery tax');
      await expect(page.locator('#rd-cpp-v')).toHaveText(/^\d+( and \d+ months?)?$/);
      await expect(page.locator('#status')).toHaveAttribute('aria-live', 'polite');
      const age = page.locator('[data-drag="a.cppAge"]');
      await expect(age).toHaveAttribute('role', 'slider');
      await expect(age).toHaveText(String(latest));
      const before = await page.locator('#rd-cpp-v').textContent();
      await age.focus();
      await page.keyboard.press('ArrowLeft');
      expect(await age.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
      await expect(age).toHaveAttribute('aria-valuenow', String(latest - 1));
      await expect(page.locator('[data-out="a.cppCross"]')).toContainText(`start at ${latest - 1} catches up`);
      await expect(page.locator('#rd-cpp-v')).not.toHaveText(before);
      await expect(page.locator('#rd-cpp-v')).toHaveClass(/flash/);
      await page.keyboard.press('Home');
      await expect(page.locator('[data-out="a.cppWhy"]')).toContainText(`less than at ${std}`);
      await expect(page.locator('#rd-cpp-k')).toHaveText('CPP: starting early leads until');
      // Tom's number moves the readings to Tom
      const tom = page.locator('[data-drag="b.cppAge"]');
      await tom.focus(); await page.keyboard.press('End');
      await expect(page.locator('#letter-view [data-who="b"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#rd-rec-k')).toContainText(story.people.b.name);
      await expect(page.locator('#rd-rec-t')).toContainText('below the threshold');
      await expect(page.locator('#rd-oas-v')).toHaveText('No crossing');
      await expect(page.locator('#status')).not.toBeEmpty();
      // the tool's own answer is not moved by the letter
      await expect(page.locator('#answer-v')).toHaveText(`Age ${Math.round(cross(latest))}`);
      await btn.click();
      await expect(page.locator('#letter-view')).toBeHidden();
      await expectStorageClean(page);
    });

    test('Go deeper keeps the letter\'s two charts and its ten sliders; they drive the letter and read out under the pointer', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await openDeeper(page);
      await expect(page.locator('#deeper figure.chart')).toHaveCount(2);
      await expect(page.locator('#deeper .tag-example')).toHaveCount(2);
      await expect(page.locator('#cpp-h')).toHaveText(`Waiting to ${latest} catches up with ${std} at about age ${Math.round(cross(latest))}`);
      for (const id of ['#plot-cpp', '#plot-oas']) {
        const svg = page.locator(`${id} svg`); await svg.scrollIntoViewIfNeeded();
        expect(await page.locator(`${id} path.ln`).count()).toBeGreaterThanOrEqual(2);
        const b = await svg.boundingBox();
        await page.mouse.move(b.x + b.width * 0.55, b.y + b.height / 2);
        await expect(page.locator(`${id} .crosshair text`)).toContainText('At age');
        await expect(page.locator(`${id} .crosshair text`)).toContainText('$');
      }
      const path = await page.locator('#plot-cpp path.ln-pick').getAttribute('d');
      await page.locator('#s-a-cppAge').fill(String(std + 1));
      expect(await page.locator('#plot-cpp path.ln-pick').getAttribute('d')).not.toBe(path);
      await expect(page.locator('[data-drag="a.cppAge"]')).toHaveText(String(std + 1));
      await page.getByRole('button', { name: `More: ${story.people.b.name}'s CPP start age` }).click();
      await expect(page.locator('#cpp-sub')).toContainText(story.people.b.name);
      await page.locator('#deeper [data-who="a"]').click();
      await expect(page.locator('#cpp-sub')).toContainText(story.people.a.name);
      await expect(page.locator('#deeper summary > .deeper-in')).toContainText(' · ');
      await expect(page.locator('nav.rail')).toHaveCount(0);
    });

    test('the OAS recovery is worked out for each spouse, capped at the OAS', async ({ page }) => {
      await page.goto(url);
      await openLetter(page); await openDeeper(page);
      const thr = Object.values(facts).filter((f) => f.series === 'oas_recovery_threshold').sort((a, b) => b.tax_year - a.tax_year)[0];
      await expect(page.locator('[data-out="thrYear"]')).toHaveText(String(thr.tax_year));
      await expect(page.locator('[data-out="a.recWhy"]')).toContainText('above the threshold, so about $');
      await expect(page.locator('[data-out="b.recWhy"]')).toContainText('below the threshold');
      await page.locator('#s-a-other').fill('200000');
      await expect(page.locator('[data-out="a.recWhy"]')).toContainText('take back all of her OAS');
      await page.locator('#s-a-other').fill('0');
      await expect(page.locator('[data-out="a.recWhy"]')).toContainText('none of her OAS');
      await page.locator('[data-drag="b.other"]').focus(); await page.keyboard.press('End');
      await expect(page.locator('[data-out="b.recWhy"]')).toContainText('all of his OAS');
    });

    test('dragging a number in the letter with the pointer changes it', async ({ page }) => {
      await page.goto(url);
      await openLetter(page);
      const age = page.locator('[data-drag="b.cppAge"]');
      await age.scrollIntoViewIfNeeded();
      const before = Number(await age.textContent());
      const box = await age.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 24 * 3, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
      await expect(age).toHaveText(String(Math.min(latest, before + 3)));
      await expect(page.locator('[data-out="b.cppMonthly"]')).not.toBeEmpty();
    });

    test('chart labels never overlap or leave the chart, for every start on the slider', async ({ page }) => {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      expect(await labelClashes(page)).toEqual([]);
      for (let m = earliest * 12; m <= latest * 12; m += 1) {
        await setStart(page, m);
        expect(await labelClashes(page), `CPP month ${m}`).toEqual([]);
      }
      await page.locator('[data-plan="oas"]').click();
      for (let m = oasStart * 12; m <= oasLatest * 12; m += 1) {
        await setStart(page, m);
        expect(await labelClashes(page), `OAS month ${m}`).toEqual([]);
      }
      // and the letter's two charts in Go deeper
      await openDeeper(page);
      for (const w of ['a', 'b']) {
        for (let a = earliest; a <= latest; a++) {
          await page.locator(`#s-${w}-cppAge`).fill(String(a));
          await page.locator(`#s-${w}-oasAge`).fill(String(Math.min(oasLatest, Math.max(oasStart, a))));
          expect(await labelClashes(page), `${w} at ${a}`).toEqual([]);
        }
      }
      for (const [k, v] of [['cppAt65', '100'], ['cppAt65', '2000'], ['oasAt65', '1000'], ['oasAt65', '100']]) {
        await page.locator(`#s-a-${k}`).fill(v);
        expect(await labelClashes(page), `${k} ${v}`).toEqual([]);
      }
    });

    test('Save my card: a 1080x1350 PNG made in the page, downloaded when the browser cannot share files', async ({ page }) => {
      const requests = [];
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (rq) => { if (!rq.url().startsWith('blob:')) requests.push(rq.url()); });
      await page.evaluate(() => { try { Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true }); } catch (e) { /* none */ } });
      const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#save').click()]);
      expect(dl.suggestedFilename()).toBe('when-to-start-cpp-my-card.png');
      const buf = readFileSync(await dl.path());
      expect(buf.subarray(1, 4).toString()).toBe('PNG');
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([1080, 1350]);
      expect(requests).toEqual([]);
      await expect(page.locator('.save-note')).toHaveCount(0);
    });

    test('reduced motion: the answer is final at once and nothing moves', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectReducedMotion(page, async (p) => { await p.locator('#start').focus(); await p.keyboard.press('Home'); });
      await expect(page.locator('#answer-v')).toHaveText(`Age ${Math.round(cross(earliest))}`);
      expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
    });

    for (const theme of ['dark', 'light']) test(`axe passes (${theme})`, async ({ page }) => {
      await page.goto(url);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.evaluate(() => document.fonts.ready);
      let res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join('; ')}`)).toEqual([]);
      await page.locator('[data-plan="oas"]').click();
      await openLetter(page); await openDeeper(page);
      await page.locator('#s-a-other').fill('200000');
      await page.locator('[data-drag="a.cppAge"]').focus();
      res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join('; ')}`)).toEqual([]);
    });
  });
}

test('the in-app browser notice sits beside Save my card', async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0', viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(url);
  await expect(page.locator('#save + .save-note')).toHaveText('Open this page in Safari or Chrome to save the file.');
  await ctx.close();
});

test('every margin note and source names an allowlisted government page and a read date', async ({ page }) => {
  await page.goto(url);
  const notes = page.locator('.sn[data-fact]');
  expect(await notes.count()).toBeGreaterThanOrEqual(8);
  const hrefs = [...await notes.locator('a').evaluateAll((as) => as.map((a) => a.href)),
    ...await page.locator('#sources a').evaluateAll((as) => as.map((a) => a.href))];
  expect(await page.locator('#sources li').count()).toBeGreaterThanOrEqual(10);
  for (const href of hrefs) expect(new URL(href).hostname).toMatch(/(^|\.)(canada\.ca|gc\.ca|ontario\.ca|bankofcanada\.ca)$/);
  for (const t of await notes.allInnerTexts()) expect(t).toMatch(/read \d{4}-\d\d-\d\d/);
  await expect(page.locator('.ignores')).toContainText('What this ignores');
  await expect(page.locator('.foot')).toContainText('Education only, not advice. Made with AI assistance; every figure is checked at its source.');
  await expect(page.locator('.desk-brand')).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'How I made this' })).toHaveAttribute('href', '/tools/when-to-start-cpp/how-i-made-it/');
});

test('print layout keeps the answer, the chart and the letter, and drops the controls', async ({ page }) => {
  await page.goto(url);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.controls')).toBeHidden();
  await expect(page.locator('.mover')).toBeHidden();
  await expect(page.locator('#answer')).toBeVisible();
  await expect(page.locator('.letter')).toBeVisible();
  await expect(page.locator('#plot-main svg')).toBeVisible();
  const pdf = await page.pdf({ format: 'Letter' });
  expect(pdf.length).toBeGreaterThan(10000);
});
