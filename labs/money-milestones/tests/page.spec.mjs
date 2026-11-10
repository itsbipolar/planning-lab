import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const url = 'file://' + dist;
const facts = Object.fromEntries(JSON.parse(readFileSync(fileURLToPath(new URL('../../../shared/facts.json', import.meta.url)), 'utf8')).facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));
const num = (id) => Number(facts[id].value);
const BIRTH = 1985;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('a birth year lights up the weeks and the four rules, with no request after load and nothing stored', async ({ page }) => {
      const requests = [];
      await page.goto(url);
      await page.waitForLoadState('load');
      page.on('request', (r) => requests.push(r.url()));
      const before = page.url();
      await page.fill('#year', String(BIRTH));
      await page.click('button[type=submit]');
      await expect(page.locator('#grid .c')).toHaveCount(95 * 52);
      await expect(page.locator('#list li')).toHaveCount(4);
      const text = await page.locator('#list').innerText();
      expect(text).toContain(String(BIRTH + num('rrsp_maturity_age')));
      expect(text).toContain(String(BIRTH + num('oas_start_age')));
      expect(text).toContain(`${facts.oas_deferral_increase.value}%`);
      for (const href of await page.locator('#list a').evaluateAll((as) => as.map((a) => a.href))) expect(href).toMatch(/^https:\/\/(www\.)?(canada\.ca|laws-lois\.justice\.gc\.ca)/);
      expect(await page.locator('#list .meta').first().innerText()).toMatch(/Read on \d{4}-\d{2}-\d{2}/);
      expect(requests, 'no network request after load').toEqual([]);
      expect(page.url()).toBe(before);
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('bad input is refused with a clear message', async ({ page }) => {
      await page.goto(url);
      for (const bad of ['', '85', '1850', String(new Date().getFullYear() + 1)]) {
        await page.fill('#year', bad);
        await page.click('button[type=submit]');
        await expect(page.locator('#error')).toBeVisible();
        await expect(page.locator('#result')).toBeHidden();
      }
    });

    for (const theme of ['dark', 'light']) {
      test(`axe, ${theme}, before and after entering a year`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        for (const step of ['empty', 'result']) {
          if (step === 'result') { await page.fill('#year', String(BIRTH)); await page.click('button[type=submit]'); }
          const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
          expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join('; ')}`), step).toEqual([]);
        }
      });
    }

    test('the very old and the very young are handled', async ({ page }) => {
      await page.goto(url);
      await page.fill('#year', '1900'); await page.click('button[type=submit]');
      await expect(page.locator('#grid .c.lived')).toHaveCount(95 * 52);
      await page.fill('#year', String(new Date().getFullYear())); await page.click('button[type=submit]');
      await expect(page.locator('#grid .c')).toHaveCount(95 * 52);
    });
  });
}

test('a rule that is missing from the facts is left out, never filled in', async ({ page }) => {
  const html = readFileSync(dist, 'utf8');
  const m = html.match(/<script type="application\/json" id="facts">([\s\S]*?)<\/script>/);
  const data = JSON.parse(m[1].replace(/\\u003c/g, '<'));
  data.facts = data.facts.filter((f) => f.id !== 'rrsp_maturity_age');
  const file = join(mkdtempSync(join(tmpdir(), 'mm-')), 'index.html');
  writeFileSync(file, html.replace(m[1], () => JSON.stringify(data).replace(/</g, '\\u003c')));
  await page.goto('file://' + file);
  await page.fill('#year', String(BIRTH)); await page.click('button[type=submit]');
  await expect(page.locator('#list li')).toHaveCount(3);
  expect(await page.locator('#list').innerText()).not.toContain('RRSP');
});

test('with reduced motion nothing animates', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.fill('#year', String(BIRTH)); await page.click('button[type=submit]');
  const anim = await page.evaluate(() => document.getAnimations().length);
  expect(anim).toBe(0);
  await ctx.close();
});
