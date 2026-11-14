import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes, textSizeOffenders, expectTemplate, expectReducedMotion } from '../../../shared/desk/shell-test.mjs';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { rolling, nextUp } from '../engine.mjs';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const config = JSON.parse(readFileSync(new URL('../calendar.json', import.meta.url), 'utf8'));
const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8'));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const TODAY = '2026-11-13';
const example = config.presets.find((p) => p.id === config.example);
const expected = (picked, opts) => rolling(config, facts, TODAY, picked, opts);

async function open(page) {
  await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
  await page.goto(url); await page.waitForLoadState('load');
}
async function textClashes(page) {
  return page.locator('#strip text:not(.crosshair text)').evaluateAll((ts) => {
    const b = ts.filter((t) => t.textContent.trim()).map((t) => { const r = t.getBBox(); return [r.x, r.y, r.width, r.height, t.textContent]; });
    const out = [];
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
      const [p, q] = [b[i], b[j]];
      if (p[0] < q[0] + q[2] - 1 && q[0] < p[0] + p[2] - 1 && p[1] < q[1] + q[3] - 1 && q[1] < p[1] + p[3] - 1) out.push(`${p[4]} / ${q[4]}`);
    }
    const W = ts[0]?.ownerSVGElement.viewBox.baseVal.width;
    for (const x of b) if (x[0] < -1 || x[0] + x[2] > W + 1) out.push(`outside: ${x[4]}`);
    return out;
  });
}

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the tool shell: tool bar, one Up next card, notes, share tags; no rail, nothing sticky, nothing stored', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expectShell(page, 'planning-calendar');
      await expectStorageClean(page);
    });

    test('the template: the household chips first, the countdown, one assumptions line, the folds closed, one Up next', async ({ page }) => {
      await open(page);
      const m = await expectTemplate(page);
      if (width === 390) {
        expect(m.firstTop).toBeLessThanOrEqual(700);
        expect(m.answerTop).toBeLessThanOrEqual(700);
        // question, control, answer and the amber action all in the first phone screen
        const btn = await page.locator('#ics').boundingBox();
        expect(btn.y + btn.height, 'the amber action ends inside the first 900px').toBeLessThanOrEqual(900);
      }
      await expect(page.locator('[data-first-move] #picks button')).toHaveCount(config.presets.length);
      await expect(page.locator('details.deeper')).toHaveCount(2);
      await expect(page.locator('details#tune > summary')).toHaveText(/^Fine-tune your household/);
      await expect(page.locator('details#deeper > summary')).toHaveText(/^Go deeper/);
      await expect(page.locator('#sits input')).toHaveCount(config.situations.length);
      await expect(page.locator('details#tune #sits')).toHaveCount(1);
      await expect(page.locator('.btn-you')).toHaveCount(1);
      // the chips are one row: on a phone the row scrolls sideways, never the page, and the example's chip is in view
      const row = page.locator('#picks');
      const tops = await row.locator('button').evaluateAll((bs) => [...new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top)))]);
      expect(tops).toHaveLength(1);
      const r = await row.boundingBox(), on = await row.locator('[aria-pressed=true]').boundingBox();
      expect(on.x).toBeGreaterThanOrEqual(r.x - 1); expect(on.x + on.width).toBeLessThanOrEqual(r.x + r.width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('opens on the example: the next confirmed date counted down; a chip or a tick updates the answer, the strip and the list', async ({ page }) => {
      await open(page);
      const ex = expected(example.situations), a = nextUp(ex);
      await expect(page.locator('h1')).toHaveText('What’s your next tax date?');
      expect((await page.locator('h1').textContent()).split(/\s+/).length).toBeLessThanOrEqual(12);
      await expect(page.locator('.kicker')).toHaveText('Tool');
      await expect(page.locator('#answer-k')).toHaveText('Next confirmed date');
      await expect(page.locator('#answer-v')).toHaveText(`In ${a.n} days`);
      await expect(page.locator('#answer-t')).toHaveText(a.line);
      await expect(page.locator('#assume')).toContainText('An example to start');
      await expect(page.locator('#assume')).toContainText('Assumes');
      await expect(page.locator('#ics')).toHaveText(`Add these ${ex.events.length} dates to my calendar`);
      await expect(page.locator('#ics')).toHaveClass(/btn-you/);
      await expect(page.locator('#ics-count')).toContainText(`${ex.events.length} confirmed dates`);
      if (ex.pending.length) await expect(page.locator('#ics-count')).toContainText(`${ex.pending.length} more not confirmed yet`);
      await expect(page.locator('.lock svg')).toHaveCount(1);
      await expect(page.locator(`#picks button[data-preset=${example.id}]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#strip rect[class^="k-"]')).toHaveCount(ex.events.length);
      await expect(page.locator('#dates > li')).toHaveCount(ex.events.length);
      await expect(page.locator('#pending li')).toHaveCount(ex.pending.length);
      await expect(page.locator('#pile-tag')).toHaveText('Example household');
      // a chip replaces the household; the count-up lands on the final number
      const ret = config.presets.find((p) => p.id === 'retiree'), rc = expected(ret.situations);
      await page.locator('#picks button[data-preset=retiree]').click();
      const ra = nextUp(rc);
      await expect(page.locator('#answer-v')).toHaveText(ra.n != null ? `In ${ra.n} days` : ra.text);
      await expect(page.locator('#answer-t')).toHaveText(ra.line);
      await expect(page.locator('#assume')).not.toContainText('An example to start');
      await expect(page.locator('#dates > li')).toHaveCount(rc.events.length);
      // fine-tune: tick two more; a custom household, no chip pressed
      await page.locator('#tune > summary').click();
      await page.locator('#sits input[value=fhsa]').check();
      await page.locator('#sits input[value=trust]').check();
      const more = expected(config.situations.map((s) => s.id).filter((id) => [...ret.situations, 'fhsa', 'trust'].includes(id)));
      await expect(page.locator('#strip rect[class^="k-"]')).toHaveCount(more.events.length);
      await expect(page.locator('#dates > li')).toHaveCount(more.events.length);
      await expect(page.locator('#picks button[aria-pressed=true]')).toHaveCount(0);
      await expect(page.locator('#assume')).toContainText('Your own mix');
      // nothing ticked: no answer, nothing to save
      for (const id of await page.locator('#sits input:checked').evaluateAll((xs) => xs.map((x) => x.value))) await page.locator(`#sits input[value=${id}]`).uncheck();
      await expect(page.locator('#answer-v')).toHaveText('None');
      await expect(page.locator('#ics')).toBeDisabled();
    });

    test('a business owner can set the corporation\'s year-end month; its T2 date and year-end follow it', async ({ page }) => {
      await open(page);
      await page.locator('#tune > summary').click();
      await expect(page.locator('#ye')).toBeVisible();
      await expect(page.locator('#ye')).toHaveValue('12');
      await expect(page.locator('#ye option')).toHaveCount(12);
      await page.locator('#ye').selectOption('6');
      const c = rolling(config, facts, TODAY, example.situations, { corpYearEnd: 6 });
      const t2 = c.events.find((e) => e.rule === 't2'), ye = c.events.find((e) => e.rule === 'corp_ye');
      await page.locator('#deeper > summary').click();
      await expect(page.locator('#dates')).toContainText(t2.text);
      await expect(page.locator('#dates')).toContainText(ye.text);
      await expect(page.locator('#assume')).toContainText('June year-end for the corporation');
      await expect(page.locator('#answer-t')).toHaveText(nextUp(c).line);
      // no corporation, no month to set
      await page.locator('#sits input[value=corporation]').uncheck();
      await expect(page.locator('#ye')).toBeHidden();
      await expect(page.locator('#ye-note')).toContainText('Owns a corporation');
      expect(page.url()).toBe(url);
      await expectStorageClean(page);
    });

    test('reduced motion: a new household\'s answer is final at once, nothing moves', async ({ page }) => {
      await open(page);
      const now = await expectReducedMotion(page, async (p) => { await p.locator('#picks button[data-preset=self_employed]').click(); });
      const se = nextUp(expected(config.presets.find((p) => p.id === 'self_employed').situations));
      expect(now).toContain(se.n != null ? `In ${se.n} days` : se.text);
    });

    test('Add to my calendar: an .ics made in the page with the household\'s confirmed dates; nothing sent, stored or put in the address', async ({ page }) => {
      const requests = [];
      await open(page);
      page.on('request', (r) => { if (!/^(blob|data):/.test(r.url())) requests.push(r.url()); });
      const before = page.url();
      await page.locator('#tune > summary').click();
      await page.locator('#sits input[value=losses]').check();
      const picked = config.situations.map((s) => s.id).filter((id) => [...example.situations, 'losses'].includes(id));
      const cal = expected(picked);
      await expect(page.locator('#ics-count')).toContainText('not confirmed yet');
      await expect(page.locator('.save-note')).toHaveCount(0);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#ics').click()]);
      expect(dl.suggestedFilename()).toBe(`tax-dates-${TODAY}.ics`);
      const ics = readFileSync(await dl.path(), 'utf8');
      expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
      expect(ics.match(/^BEGIN:VEVENT\r$/gm)).toHaveLength(cal.events.length);
      const flat = ics.replace(/\r\n /g, '');
      for (const e of cal.events) {
        expect(flat).toContain(`UID:${e.rule}-${e.date.replace(/-/g, '')}@planning-calendar`);
        expect(flat).toContain(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`);
      }
      for (const p of cal.pending) expect(flat).not.toContain(`UID:${p.rule}-${p.year}`);
      expect(flat.match(/Education only\\, not advice\./g)).toHaveLength(cal.events.length);
      expect(requests).toEqual([]);
      expect(page.url()).toBe(before);
      await expectStorageClean(page);
    });

    test('where the share sheet takes files, the .ics goes to it (no download)', async ({ page }) => {
      await page.addInitScript(() => {
        window.__shared = [];
        navigator.canShare = (d) => !!(d && d.files && d.files.length);
        navigator.share = async (d) => { window.__shared.push(d.files.map((f) => [f.name, f.type, f.size])); };
      });
      await open(page);
      let downloads = 0; page.on('download', () => downloads++);
      await page.locator('#ics').click();
      await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
      const [[name, type, size]] = (await page.evaluate(() => window.__shared))[0];
      expect([name, type]).toEqual([`tax-dates-${TODAY}.ics`, 'text/calendar']);
      expect(size).toBeGreaterThan(100);
      expect(downloads).toBe(0);
    });

    test.describe('in an in-app browser', () => {
      test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0' });
      test('the save button says to open the page in Safari or Chrome', async ({ page }) => {
        await open(page);
        await expect(page.locator('#ics + .save-note')).toHaveText('Open this page in Safari or Chrome to save the file.');
        await expect(page.locator('.save-note')).toHaveCount(1);
      });
    });

    test('rules in words with sources, own-date rules, footer; no sideways scroll; strip labels never overlap', async ({ page }) => {
      await open(page);
      await expect(page.locator('#deeper')).not.toHaveAttribute('open');
      await page.locator('#deeper > summary').click();
      const t = await page.locator('body').innerText();
      for (const s of ['CPP can start: age', 'Not confirmed yet', 'Education only, not advice.', 'Made with AI assistance; every figure is checked at its source.']) expect(t).toContain(s);
      expect(t).not.toMatch(/\byou should\b/i);
      for (const a of await page.locator('#dates a').all()) expect(await a.getAttribute('href')).toMatch(/^https:\/\/([a-z0-9-]+\.)*(canada\.ca|gc\.ca)\//);
      await page.locator('details.sources summary').click();
      expect(await page.locator('#sources li').count()).toBeGreaterThan(5);
      for (const p of config.presets) {
        await page.locator(`#picks button[data-preset=${p.id}]`).click();
        expect(await textClashes(page), p.id).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      }
      await page.locator('#tune > summary').click();
      for (const s of config.situations) await page.locator(`#sits input[value=${s.id}]`).check();
      expect(await textClashes(page), 'all').toEqual([]);
      await expect(page.locator('#strip text.read', { hasText: 'dates' }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('every piece of text renders at 17.5px or more, chart labels and the week reading included', async ({ page }) => {
      await open(page);
      await expectTextSizes(page);
      // Mo: never smaller; this tool's own small text and labels (chart labels included) at 17.5px or more
      const own = () => page.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => !e.closest('.desk-next, .desk-notes, script, style, title')
        && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.checkVisibility() && e.getBoundingClientRect().width > 1)
        .map((e) => { let px = parseFloat(getComputedStyle(e).fontSize); if (e instanceof SVGElement) { const m = e.getScreenCTM(); if (m) px *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); } return [e.tagName + '.' + (e.getAttribute('class') || ''), e.textContent.trim().slice(0, 30), Math.round(px * 10) / 10]; })
        .filter((x) => x[2] + 0.01 < 17.5));
      expect(await own()).toEqual([]);
      // the week reading under the pointer, kept inside the chart
      const strip = page.locator('#strip'); await strip.scrollIntoViewIfNeeded();
      const k = await page.locator('#strip rect[class^="k-"]').first().boundingBox();
      await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
      await expect(page.locator('#strip .crosshair')).toBeVisible();
      await expectTextSizes(page);
      for (const x of [0.02, 0.5, 0.98]) {
        const b = await strip.boundingBox();
        await page.mouse.move(b.x + b.width * x, b.y + b.height * 0.6);
        const r = await page.locator('#strip .crosshair rect').boundingBox();
        expect(r.x, `reading box at ${x} starts inside the chart`).toBeGreaterThanOrEqual(b.x - 1);
        expect(r.x + r.width, `reading box at ${x} ends inside the chart`).toBeLessThanOrEqual(b.x + b.width + 1);
      }
      // the folds open, and every situation at once
      for (const d of await page.locator('details summary').all()) await d.click();
      for (const s of config.situations) await page.locator(`#sits input[value=${s.id}]`).check();
      await expectTextSizes(page);
      expect(await own()).toEqual([]);
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}`, async ({ page }) => {
        await open(page);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        for (const d of await page.locator('details summary').all()) await d.click();
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`)).toEqual([]);
      });
    }
  });
}
