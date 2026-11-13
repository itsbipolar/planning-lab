import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
// The headline's crossing, worked out here the planning-timeline way, in years of the standard pension.
const cross = (age) => {
  const share = 1 + (age - std) * 12 * (age < std ? n('cpp_early_start_reduction') : n('cpp_late_start_increase')) / 100;
  return (share * age - std) / (share - 1);
};
const story = JSON.parse(readFileSync(new URL('../story.json', import.meta.url), 'utf8'));

// Every pair of text labels inside each chart: none may overlap, and none may leave the chart.
async function labelClashes(page) {
  return page.evaluate(() => {
    const bad = [];
    for (const svg of document.querySelectorAll('.plot svg')) {
      const box = svg.getBoundingClientRect();
      const t = [...svg.querySelectorAll('text')].map((e) => ({ s: e.textContent, b: e.getBoundingClientRect() }));
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
  for (const re of [/you should/i, /\brecommend(s|ed)?\b/i, /guarantee/i, /best age/i, /financial (planner|advisor|adviser)/i, /\bCFP\b/])
    expect(text, String(re)).not.toMatch(re);
});

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the example opens with its computed finding, and arrow keys rewrite the headline, letter and chart; nothing is stored or sent', async ({ page }) => {
      const requests = [], errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url); await page.waitForLoadState('load');
      const start = page.url();
      page.on('request', (rq) => requests.push(rq.url()));
      const h1 = page.locator('h1');
      await expect(h1).toHaveText(`Waiting from ${std} to ${latest} pays off for CPP if you live past about ${Math.round(cross(latest))}.`);
      await expect(h1).toHaveAttribute('aria-live', 'polite');
      await expect(page.locator('[data-who="a"]')).toHaveAttribute('aria-pressed', 'true');
      const age = page.locator('[data-drag="a.cppAge"]');
      await expect(age).toHaveAttribute('role', 'slider');
      await expect(age).toHaveText(String(latest));
      const path = await page.locator('#plot-cpp path.ln-pick').getAttribute('d');
      await age.focus();
      await expect(age).toBeFocused();
      expect(await age.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
      await page.keyboard.press('ArrowLeft');
      await expect(age).toHaveAttribute('aria-valuenow', String(latest - 1));
      await expect(h1).toHaveText(`Waiting from ${std} to ${latest - 1} pays off for CPP if you live past about ${Math.round(cross(latest - 1))}.`);
      await expect(page.locator('[data-out="a.cppCross"]')).toContainText(`start at ${latest - 1} catches up`);
      await expect(page.locator('#s-a-cppAge')).toHaveValue(String(latest - 1));
      expect(await page.locator('#plot-cpp path.ln-pick').getAttribute('d')).not.toBe(path);
      await expect(page.locator('#plot-cpp path.ln')).toHaveCount(3);
      await page.keyboard.press('Home');
      await expect(h1).toHaveText(`Starting CPP at ${earliest} instead of ${std} pays more in total unless you live past about ${Math.round(cross(earliest))}.`);
      await expect(page.locator('[data-out="a.cppWhy"]')).toContainText(`less than at ${std}`);
      // Tom's number moves the charts and the headline to Tom
      const tom = page.locator('[data-drag="b.cppAge"]');
      await tom.focus(); await page.keyboard.press('End');
      await expect(page.locator('[data-who="b"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#cpp-h')).toContainText(story.people.b.name);
      await expect(h1).toHaveText(`Waiting from ${std} to ${latest} pays off for CPP if you live past about ${Math.round(cross(latest))}.`);
      // the plain slider and its buttons drive the same numbers
      await page.locator('#s-b-cppAge').fill(String(std));
      await expect(tom).toHaveText(String(std));
      await expect(h1).toContainText(`would pay off for CPP`);
      await page.getByRole('button', { name: `More: ${story.people.b.name}'s CPP start age` }).click();
      await expect(tom).toHaveText(String(std + 1));
      await expect(page.locator('#status')).not.toBeEmpty();
      expect(await page.evaluate(() => localStorage.length + sessionStorage.length + document.cookie.length)).toBe(0);
      expect(page.url()).toBe(start);
      expect(requests).toEqual([]); expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('the OAS recovery is worked out for each spouse, capped at the OAS', async ({ page }) => {
      await page.goto(url);
      const thr = Object.values(facts).filter((f) => f.series === 'oas_recovery_threshold').sort((a, b) => b.tax_year - a.tax_year)[0];
      await expect(page.locator('[data-out="thrYear"]')).toHaveText(String(thr.tax_year));
      await expect(page.locator('[data-out="a.recWhy"]')).toContainText('above the threshold, so about $');
      await expect(page.locator('[data-out="b.recWhy"]')).toContainText('below the threshold');
      await page.locator('#s-a-other').fill('200000');
      await expect(page.locator('[data-out="a.recWhy"]')).toContainText('take back all of her OAS');
      await expect(page.locator('[data-out="b.recWhy"]')).toContainText('below the threshold');
      await page.locator('#s-a-other').fill('0');
      await expect(page.locator('[data-out="a.recWhy"]')).toContainText('none of her OAS');
      await page.locator('[data-drag="b.other"]').focus(); await page.keyboard.press('End');
      await expect(page.locator('[data-out="b.recWhy"]')).toContainText('all of his OAS');
      await expect(page.locator('#dek')).toContainText(`${thr.tax_year} recovery tax`);
    });

    test('dragging a number with the pointer changes it', async ({ page }) => {
      await page.goto(url);
      const age = page.locator('[data-drag="b.cppAge"]');
      await age.scrollIntoViewIfNeeded();
      const before = Number(await age.textContent());
      const box = await age.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 24 * 3, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
      await expect(age).toHaveText(String(Math.min(latest, before + 3)));
      await expect(page.locator('h1')).toContainText(`to ${Math.min(latest, before + 3)}`);
    });

    test('chart labels never overlap or leave the chart', async ({ page }) => {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      expect(await labelClashes(page)).toEqual([]);
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

    for (const theme of ['dark', 'light']) test(`axe passes (${theme})`, async ({ page }) => {
      await page.goto(url);
      if (theme === 'light') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.locator('#s-a-other').fill('200000');
      await page.locator('[data-drag="a.cppAge"]').focus();
      await page.evaluate(() => document.fonts.ready);
      const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join('; ')}`)).toEqual([]);
    });
  });
}

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
  await expect(page.locator('.foot')).toContainText('Education only, not advice. Made with AI assistance; every rule is checked at its official source.');
  await expect(page.locator('.brand')).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'About this build' })).toHaveAttribute('href', '/builds/two-number-letter/');
});

test('print layout keeps the letter and charts and drops the controls', async ({ page }) => {
  await page.goto(url);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.controls')).toBeHidden();
  await expect(page.locator('.letter')).toBeVisible();
  await expect(page.locator('#plot-cpp svg')).toBeVisible();
  const pdf = await page.pdf({ format: 'Letter' });
  expect(pdf.length).toBeGreaterThan(10000);
});

test('reduced motion: nothing animates', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});
