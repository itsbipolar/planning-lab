import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectStorageClean, expectShell, expectTextSizes } from '../../../shared/desk/shell-test.mjs';
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
// The page's question is the one its Up next card and the site use (shared/desk/next.json).
const question = JSON.parse(readFileSync(new URL('../../../shared/desk/next.json', import.meta.url), 'utf8')).tools.find((t) => t.labSlug === 'two-number-letter').question;
const later = (from, to) => `Starting CPP at ${to} instead of ${from} pays more in total for anyone who lives past about age ${Math.round(cross(to))}.`;

// Every pair of text labels inside each chart: none may overlap, and none may leave the chart.
async function labelClashes(page) {
  return page.evaluate(() => {
    const bad = [];
    for (const svg of document.querySelectorAll('.plot svg')) {
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
  for (const re of [/you should/i, /\brecommend(s|ed)?\b/i, /guarantee/i, /best age/i, /financial (planner|advisor|adviser)/i, /\bCFP\b/])
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

    test('the question, one kicker word, the answer under it and one assumptions line; no section numbers', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(question);
      expect(question.length).toBeLessThanOrEqual(60);
      expect(question.split(/\s+/).length).toBeLessThanOrEqual(12);
      expect((await page.locator('main > .kicker').textContent()).trim()).toMatch(/^[A-Za-z]+$/);
      await expect(page.locator('#finding')).toHaveText(later(std, latest));
      await expect(page.locator('.assume')).toHaveCount(1);
      await expect(page.locator('.assume')).toContainText('Education, not advice');
      for (const t of await page.locator('.sec-label, .kicker').allInnerTexts()) expect(t).not.toMatch(/\d|No\./);
      // the one big answer is the CPP crossing, in the serif with tabular lining figures
      const big = page.locator('.readout-v.big');
      await expect(big).toHaveCount(1);
      await expect(big).toHaveAttribute('id', 'rd-cpp-v');
      expect(await big.evaluate((e) => getComputedStyle(e).fontVariantNumeric)).toContain('tabular-nums');
      // every chart is a framed figure with a plain-words title and the example tag
      await expect(page.locator('figure.chart')).toHaveCount(2);
      await expect(page.locator('figure.chart .tag-example')).toHaveCount(2);
      await expect(page.locator('#cpp-h')).toHaveText(`Waiting to ${latest} catches up with ${std} at about age ${Math.round(cross(latest))}`);
    });

    test('every word on the page renders at 16.5px or more, chart words included, in each view', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await page.evaluate(() => document.fonts.ready);
      await expectTextSizes(page);
      await page.locator('[data-who="b"]').click();
      await expectTextSizes(page);
      // the reading under the pointer too
      const svg = page.locator('#plot-cpp svg'); await svg.scrollIntoViewIfNeeded();
      const b = await svg.boundingBox();
      await page.mouse.move(b.x + b.width * 0.6, b.y + b.height / 2);
      await expect(page.locator('#plot-cpp .crosshair')).toBeVisible();
      await expectTextSizes(page);
      await page.locator('.sources summary').click();
      await expectTextSizes(page);
    });

    test('the example opens with its computed finding, and arrow keys rewrite the answer, letter and chart; nothing is stored or sent', async ({ page }) => {
      const requests = [], errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url); await page.waitForLoadState('load');
      const start = page.url();
      page.on('request', (rq) => requests.push(rq.url()));
      const h1 = page.locator('#finding');
      await expect(page.locator('h1')).toHaveText(question);
      await expect(h1).toHaveText(later(std, latest));
      await expect(page.locator('#status')).toHaveAttribute('aria-live', 'polite');
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
      await expect(h1).toHaveText(later(std, latest - 1));
      await expect(page.locator('[data-out="a.cppCross"]')).toContainText(`start at ${latest - 1} catches up`);
      await expect(page.locator('#s-a-cppAge')).toHaveValue(String(latest - 1));
      expect(await page.locator('#plot-cpp path.ln-pick').getAttribute('d')).not.toBe(path);
      await expect(page.locator('#plot-cpp path.ln')).toHaveCount(3);
      await page.keyboard.press('Home');
      await expect(h1).toHaveText(`Starting CPP at ${earliest} instead of ${std} pays more in total until about age ${Math.round(cross(earliest))}. After that, the start at ${std} is ahead.`);
      await expect(page.locator('[data-out="a.cppWhy"]')).toContainText(`less than at ${std}`);
      // Tom's number moves the charts and the headline to Tom
      const tom = page.locator('[data-drag="b.cppAge"]');
      await tom.focus(); await page.keyboard.press('End');
      await expect(page.locator('[data-who="b"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#cpp-sub')).toContainText(story.people.b.name);
      await expect(h1).toHaveText(later(std, latest));
      // the plain slider and its buttons drive the same numbers
      await page.locator('#s-b-cppAge').fill(String(std));
      await expect(tom).toHaveText(String(std));
      await expect(h1).toContainText(`would pay more in total for anyone who lives past`);
      await page.getByRole('button', { name: `More: ${story.people.b.name}'s CPP start age` }).click();
      await expect(tom).toHaveText(String(std + 1));
      await expect(page.locator('#status')).not.toBeEmpty();
      await expectStorageClean(page);
      expect(page.url()).toBe(start);
      expect(requests).toEqual([]); expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('the readouts beside the charts follow the person shown and every number moved', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      const head = await page.locator('.charts-head').boundingBox(), ro = await page.locator('#readouts').boundingBox();
      expect(ro.y - (head.y + head.height)).toBeGreaterThanOrEqual(-1);
      expect(ro.y - (head.y + head.height)).toBeLessThan(40);
      await expect(page.locator('#rd-cpp-k')).toContainText(story.people.a.name);
      await expect(page.locator('#rd-cpp-v')).toHaveText(/^\d+( and \d+ months?)?$/);
      const before = await page.locator('#rd-cpp-v').textContent();
      await page.locator('[data-drag="a.cppAge"]').focus(); await page.keyboard.press('ArrowLeft');
      await expect(page.locator('#rd-cpp-v')).not.toHaveText(before);
      await expect(page.locator('#rd-cpp-v')).toHaveClass(/flash/);
      const rec = await page.locator('#rd-rec-v').textContent();
      await page.locator('#s-a-other').fill('150000');
      await expect(page.locator('#rd-rec-v')).not.toHaveText(rec);
      await page.locator('[data-who="b"]').click();
      await expect(page.locator('#rd-rec-k')).toContainText(story.people.b.name);
      await expect(page.locator('#rd-rec-t')).toContainText('below the threshold');
      await expect(page.locator('#rd-oas-v')).toHaveText('No crossing');
    });

    test('no chapter rail; the charts read out under the pointer', async ({ page }) => {
      await page.goto(url); await page.waitForLoadState('load');
      await expect(page.locator('section[data-chapter]')).toHaveCount(3);
      await expect(page.locator('.sec-label')).toHaveCount(3);
      await expect(page.locator('nav.rail')).toHaveCount(0); // the numbered rail is gone (redesign v2)
      for (const id of ['#plot-cpp', '#plot-oas']) {
        const svg = page.locator(`${id} svg`); await svg.scrollIntoViewIfNeeded();
        const b = await svg.boundingBox();
        await page.mouse.move(b.x + b.width * 0.55, b.y + b.height / 2);
        await expect(page.locator(`${id} .crosshair`)).toBeVisible();
        await expect(page.locator(`${id} .crosshair text`)).toContainText('At age');
        await expect(page.locator(`${id} .crosshair text`)).toContainText('$');
      }
      await page.locator('#s-a-cppAge').fill(String(std));
      await expect(page.locator('#plot-cpp .crosshair')).toHaveCount(1);
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
      await expect(page.locator('#rd-rec-t')).toContainText(`${thr.tax_year} recovery tax`);
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
      await expect(page.locator('#finding')).toContainText(`Starting CPP at ${Math.min(latest, before + 3)} instead of`);
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
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
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
  await expect(page.locator('.foot')).toContainText('Education only, not advice. Made with AI assistance; every figure is checked at its source.');
  await expect(page.locator('.desk-brand')).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'How I made this' })).toHaveAttribute('href', '/tools/when-to-start-cpp/how-i-made-it/');
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
