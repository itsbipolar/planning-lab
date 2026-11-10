import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + file;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const facts = Object.fromEntries(JSON.parse(readFileSync(new URL('../../../shared/facts.json', import.meta.url), 'utf8')).facts.map((f) => [f.id, f]));
const std = Number(facts.cpp_standard_start_age.value), latest = Number(facts.cpp_latest_start_age.value);
const earliest = Number(facts.cpp_earliest_start_age.value);

test('banned phrases are nowhere on the page', () => {
  const text = readFileSync(file, 'utf8').replace(/data:[^"')]+/g, '');
  for (const re of [/you should/i, /\brecommend(s|ed)?\b/i, /guarantee/i, /best age/i, /financial (planner|advisor|adviser)/i, /\bCFP\b/])
    expect(text, String(re)).not.toMatch(re);
});

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('keyboard on a number inside a sentence rewrites the letter; nothing is stored or sent', async ({ page }) => {
      const requests = [], errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url); await page.waitForLoadState('load');
      page.on('request', (rq) => requests.push(rq.url()));
      const age = page.locator('[data-drag="cppAge"]');
      await expect(age).toHaveAttribute('role', 'slider');
      await expect(age).toHaveText(String(std));
      await expect(page.locator('[data-out="crossing"]')).toContainText('nothing to compare');
      await age.focus(); await page.keyboard.press('End');
      await expect(age).toHaveAttribute('aria-valuenow', String(latest));
      await expect(page.locator('[data-out="crossing"]')).toContainText('the two totals cross at about age');
      await expect(page.locator('#s-cppAge')).toHaveValue(String(latest));
      await page.keyboard.press('Home');
      await expect(page.locator('[data-out="cppWhy"]')).toContainText(`less than at ${std}`);
      await expect(page.locator('#chart svg circle.dot')).toHaveCount(1);
      // the plain slider is the single-pointer alternative and drives the same numbers
      await page.locator('#s-cppAge').fill(String(std));
      await expect(age).toHaveText(String(std));
      await page.getByRole('button', { name: 'More: CPP start age' }).click();
      await expect(age).toHaveText(String(std + 1));
      expect(await page.evaluate(() => localStorage.length + sessionStorage.length + document.cookie.length)).toBe(0);
      expect(requests).toEqual([]); expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('dragging a number with the pointer changes it', async ({ page }) => {
      await page.goto(url);
      const age = page.locator('[data-drag="cppAge"]');
      await age.scrollIntoViewIfNeeded();
      const box = await age.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 24 * 3, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
      await expect(age).toHaveText(String(std + 3));
    });

    for (const theme of ['dark', 'light']) test(`axe passes (${theme}), with the threshold flag on`, async ({ page }) => {
      await page.goto(url);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.locator('#s-other').fill('200000');
      await expect(page.locator('[data-out="thrSide"]')).toHaveText('above');
      await page.evaluate(() => document.fonts.ready);
      const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join('; ')}`)).toEqual([]);
    });
  });
}

test('every sidenote names an allowlisted government source and a read date', async ({ page }) => {
  await page.goto(url);
  const notes = page.locator('.sn[data-fact]');
  expect(await notes.count()).toBeGreaterThanOrEqual(6);
  for (const href of await notes.locator('a').evaluateAll((as) => as.map((a) => a.href))) {
    expect(new URL(href).hostname).toMatch(/(^|\.)(canada\.ca|gc\.ca|ontario\.ca)$/);
  }
  for (const t of await notes.allInnerTexts()) expect(t).toMatch(/read \d{4}-\d\d-\d\d/);
  await expect(page.locator('.ignores')).toContainText('What this ignores');
});

test('print layout keeps the letter and drops the controls', async ({ page }) => {
  await page.goto(url);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.controls')).toBeHidden();
  await expect(page.locator('.letter')).toBeVisible();
  const pdf = await page.pdf({ format: 'Letter' });
  expect(pdf.length).toBeGreaterThan(10000);
});

test('reduced motion: nothing animates', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(earliest).toBeLessThan(std);
});
