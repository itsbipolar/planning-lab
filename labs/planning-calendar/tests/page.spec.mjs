import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes } from '../../../shared/desk/shell-test.mjs';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { rolling, finding } from '../engine.mjs';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));
const config = JSON.parse(readFileSync(new URL('../calendar.json', import.meta.url), 'utf8'));
const facts = JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8'));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const TODAY = '2026-11-13';
const example = config.presets.find((p) => p.id === config.example);
const expected = (picked) => rolling(config, facts, TODAY, picked);

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

    test('opens on the example with the computed finding; ticking situations updates the strip and the list', async ({ page }) => {
      await open(page);
      const ex = expected(example.situations);
      // the H1 is the short question; the computed finding is the lede under it; the example and the assumptions on one line
      await expect(page.locator('h1')).toHaveText('What’s your next tax date?');
      expect((await page.locator('h1').textContent()).split(/\s+/).length).toBeLessThanOrEqual(12);
      await expect(page.locator('.kicker')).toHaveText('Tool');
      await expect(page.locator('#finding')).toHaveText(finding(ex, example.noun));
      await expect(page.locator('#assume')).toContainText('An example to start');
      await expect(page.locator('#assume')).toContainText('Assumes');
      await expect(page.locator('#ics')).toHaveText(`Add these ${ex.events.length} dates to my calendar`);
      await expect(page.locator('#ics')).toHaveClass(/btn-you/);
      await expect(page.locator(`#picks button[data-preset=${example.id}]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#strip rect[class^="k-"]')).toHaveCount(ex.events.length);
      await expect(page.locator('#dates > li')).toHaveCount(ex.events.length);
      await expect(page.locator('#pending li')).toHaveCount(ex.pending.length);
      // add two situations: a custom household, more blocks and dates
      await page.locator('#sits input[value=fhsa]').check();
      await page.locator('#sits input[value=trust]').check();
      const more = expected(config.situations.map((s) => s.id).filter((id) => [...example.situations, 'fhsa', 'trust'].includes(id)));
      await expect(page.locator('#finding')).toHaveText(finding(more, null));
      await expect(page.locator('#strip rect[class^="k-"]')).toHaveCount(more.events.length);
      await expect(page.locator('#dates > li')).toHaveCount(more.events.length);
      await expect(page.locator('#picks button[aria-pressed=true]')).toHaveCount(0);
      // a quick pick replaces the ticks
      await page.locator('#picks button[data-preset=retiree]').click();
      const ret = config.presets.find((p) => p.id === 'retiree');
      await expect(page.locator('#finding')).toHaveText(finding(expected(ret.situations), ret.noun));
      expect(await page.locator('#sits input:checked').evaluateAll((xs) => xs.map((x) => x.value).sort())).toEqual([...ret.situations].sort());
      // nothing ticked
      for (const id of ret.situations) await page.locator(`#sits input[value=${id}]`).uncheck();
      await expect(page.locator('#finding')).toContainText('Tick at least one situation');
      await expect(page.locator('#ics')).toBeDisabled();
    });

    test('the household\'s answer is a readout under the quick picks; no rail; the strip readings', async ({ page }) => {
      await open(page);
      const ex = expected(example.situations);
      const picks = await page.locator('#picks').boundingBox(), ro = await page.locator('#readouts').boundingBox();
      expect(ro.y - (picks.y + picks.height)).toBeGreaterThanOrEqual(-1);
      expect(ro.y - (picks.y + picks.height)).toBeLessThan(48);
      await expect(page.locator('#rd-count-v')).toHaveText(`${ex.events.length} date${ex.events.length === 1 ? '' : 's'}`);
      await expect(page.locator('#rd-next-t')).toContainText(ex.events[0].label);
      await expect(page.locator('#rd-next-v')).toHaveText(`In ${ex.events[0].days} days`);
      await expect(page.locator('#chart-title')).toContainText(`${ex.events.length} date`);
      const before = await page.locator('#rd-count-v').textContent();
      const other = config.presets.find((p) => expected(p.situations).events.length !== ex.events.length);
      await page.locator(`#picks button[data-preset=${other.id}]`).click();
      await expect(page.locator('#rd-count-v')).not.toHaveText(before);
      await expect(page.locator('#rd-count-v')).toHaveClass(/flash/);
      await expect(page.locator('#rd-count-v')).toHaveText(new RegExp(`^${expected(other.situations).events.length} dates?$`));
      for (const id of other.situations) await page.locator(`#sits input[value=${id}]`).uncheck();
      await expect(page.locator('#rd-next-v')).toHaveText('None');
      await page.locator(`#picks button[data-preset=${example.id}]`).click();
      await expect(page.locator('section[data-chapter]')).toHaveCount(3);
      await expect(page.locator('.sec-label')).toHaveCount(3);
      await expect(page.locator('.sec-label b')).toHaveCount(0); // no section numbers (redesign v2, step 2)
      await expect(page.locator('nav.rail')).toHaveCount(0); // the numbered rail is gone (redesign v2)
      // the week of the next date, read under the pointer
      const strip = page.locator('#strip'); await strip.scrollIntoViewIfNeeded();
      const k = await page.locator('#strip rect[class^="k-"]').first().boundingBox();
      await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
      await expect(page.locator('#strip .crosshair')).toBeVisible();
      await expect(page.locator('#strip .crosshair text')).toContainText('Week of');
      await expect(page.locator('#strip .crosshair text')).toContainText(ex.events[0].what);
      await page.locator('#sits input[value=fhsa]').check();
      await expect(page.locator('#strip .crosshair')).toHaveCount(1);
    });

    test('Add to my calendar: an .ics made in the page with the household\'s confirmed dates; nothing sent, stored or put in the address', async ({ page }) => {
      const requests = [];
      await open(page);
      page.on('request', (r) => { if (!/^(blob|data):/.test(r.url())) requests.push(r.url()); });
      const before = page.url();
      await page.locator('#sits input[value=losses]').check();
      const picked = config.situations.map((s) => s.id).filter((id) => [...example.situations, 'losses'].includes(id));
      const cal = expected(picked);
      await expect(page.locator('#ics-note')).toContainText('not confirmed yet');
      const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#ics').click()]);
      expect(dl.suggestedFilename()).toBe(`planning-dates-${TODAY}.ics`);
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

    test('rules in words with sources, own-date rules, footer; no sideways scroll; strip labels never overlap', async ({ page }) => {
      await open(page);
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
      for (const s of config.situations) await page.locator(`#sits input[value=${s.id}]`).check();
      expect(await textClashes(page), 'all').toEqual([]);
      await expect(page.locator('#strip text.read', { hasText: 'dates' }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('every piece of text renders at 16.5px or more, chart labels and the week reading included', async ({ page }) => {
      await open(page);
      await expectTextSizes(page);
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
      // every situation at once, and the folds open
      for (const s of config.situations) await page.locator(`#sits input[value=${s.id}]`).check();
      for (const d of await page.locator('details summary').all()) await d.click();
      await expectTextSizes(page);
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
