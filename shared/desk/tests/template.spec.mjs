// The desk tool template in a browser (desk-ui.mjs, desk-page.mjs, shell-test.mjs): a small fixture page made of the
// shared pieces only, served at a test origin (so storage works as on the site; nothing leaves the machine). It checks
// the readout's count-up and live region, Go deeper's line, the save helper (share sheet, download, in-app notice), the
// 1080x1350 card, the guess, the year chip, and that expectTemplate() and expectReducedMotion() pass a page that keeps
// the budgets and fail one that does not.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { deskCSS } from '../desk.mjs';
import { deskUICSS, deskUIJS, IN_APP_NOTICE } from '../desk-ui.mjs';
import { toolBar, upNext, notes, toolFor, YEAR_HEAD } from '../desk-page.mjs';
import { expectTemplate, expectReducedMotion, expectTextSizes, expectStorageClean } from '../shell-test.mjs';

const URL_ = 'https://desk.test/tools/fixture/';
const YEAR = String(new Date().getFullYear() - 46);
const tool = toolFor('planning-timeline');

// A page in the template's order. chartsUp: how many charts follow the readout; sparkTop adds a bare svg[data-chart]
// under the H1 (a second chart above the fold); tall pushes Go deeper down.
function fixture({ chartsUp = 1, tall = 0, subs = 3, sparkTop = false } = {}) {
  const chart = (i) => `<figure class="chart" id="c${i}"><figcaption><p class="chart-title">A chart</p><p class="chart-sub">Units</p><span class="chip tag-example">Example data</span></figcaption><svg data-chart viewBox="0 0 300 120" width="100%" height="120" role="img" aria-label="A chart"><line class="grid" x1="0" x2="300" y1="60" y2="60"/></svg></figure>`;
  const sections = Array.from({ length: subs }, (_, i) => `<section class="deeper-sub"><h3>Part ${i + 1}</h3><p>Text.</p></section>`).join('');
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">${YEAR_HEAD}
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Fixture</title>
<style>${deskCSS()}\n${deskUICSS()}\nbody{margin:0;background:var(--t-ground);color:var(--t-ink);font-family:var(--font-ui);font-size:19.5px}</style></head>
<body>${toolBar(tool, { year: true })}<div class="page"><main>
<h1 class="display">A short question?</h1>${sparkTop ? '<svg data-chart viewBox="0 0 100 10" width="100" height="10" aria-hidden="true"><line x1="0" x2="100" y1="5" y2="5" stroke="currentColor"/></svg>' : ''}
<form data-first-move onsubmit="return false"><label for="y">Born in</label> <input id="y" data-year-control type="number" value="1">
<button type="button" class="btn-you" id="go">Show mine</button></form>
<p class="assume" data-assumptions>Example: the rules as published; no inflation.</p>
<div class="readout" id="ans" data-answer aria-live="polite"><p class="readout-k">The answer</p><p class="readout-v big" data-readout-v></p>
<p class="readout-t" data-readout-t></p><details class="readout-how"><summary>How this is worked out</summary><p>Arithmetic.</p></details></div>
${Array.from({ length: chartsUp }, (_, i) => chart(i)).join('')}
<div style="height:${tall}px"></div>
<div id="guess"></div>
<p><button type="button" class="btn-2" id="save">Save the file</button></p>
<details class="deeper"><summary>Go deeper</summary>${sections}</details>
<details class="deeper sources"><summary>Sources</summary><p>Official pages.</p></details>
${upNext(tool)}<footer>${notes()}</footer></main></div>
<script>${deskUIJS()}
var R = deskReadout('#ans', { format: function (n) { return '$' + Math.round(n).toLocaleString('en-CA'); } });
R.set({ n: 1000, line: 'One plain line.' });
document.getElementById('go').addEventListener('click', function () { R.set({ n: 900000 }); });
var G = deskGuess('#guess', { question: 'What do you guess?', min: 0, max: 100, step: 5, start: 50, format: function (n) { return n + '%'; }, answer: function () { return 30; } });
deskSaveButton('#save', function () { return { blob: new Blob(['hello'], { type: 'text/plain' }), name: 'note.txt', title: 'A note' }; });
</script></body></html>`;
}

async function open(page, opts) {
  await page.route('https://desk.test/**', (r) => r.fulfill({ body: fixture(opts), contentType: 'text/html' }));
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(URL_);
  return requests;
}

test.describe('390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the readout: instant on load, a 300ms count-up after the visitor acts, aria-busy until it settles', async ({ page }) => {
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const requests = await open(page);
    const v = page.locator('[data-readout-v]');
    await expect(v).toHaveText('$1,000');
    await expect(page.locator('[data-readout-t]')).toHaveText('One plain line.');
    await expect(page.locator('#ans')).toHaveAttribute('aria-atomic', 'true');
    await expect(page.locator('#ans')).not.toHaveAttribute('aria-busy', 'true', { timeout: 1000 });
    // record every text the figure shows after a real click
    await page.evaluate(() => { window.__seen = []; new MutationObserver(() => window.__seen.push(document.querySelector('[data-readout-v]').textContent)).observe(document.querySelector('[data-readout-v]'), { childList: true, characterData: true, subtree: true }); });
    await page.click('#go');
    await expect(page.locator('#ans')).toHaveAttribute('aria-busy', 'true');
    await expect(v).toHaveText('$900,000');
    const seen = await page.evaluate(() => window.__seen);
    expect(seen.length, 'the figure counted up through steps').toBeGreaterThan(3);
    await expect(page.locator('#ans')).not.toHaveAttribute('aria-busy', 'true', { timeout: 1000 });
    expect(requests, 'no request after load').toEqual([URL_]);
    expect(errors).toEqual([]);
  });

  test('reduced motion: the count-up is instant and nothing transitions (expectReducedMotion)', async ({ page }) => {
    await open(page);
    const text = await expectReducedMotion(page, (p) => p.click('#go'));
    expect(text).toContain('$900,000');
  });

  test('a closed Go deeper says what it holds: its sub-sections in the summary, shown while closed; both folds start closed', async ({ page }) => {
    await open(page);
    const first = page.locator('details.deeper').first();
    await expect(first.locator('summary > .deeper-in')).toHaveText('Part 1 · Part 2 · Part 3');
    await expect(first.locator('summary > .deeper-in')).toBeVisible();
    await expect(page.locator('details.deeper[open]')).toHaveCount(0);
    // the summary is sentence case, not capitals
    expect(await first.locator('summary').evaluate((s) => getComputedStyle(s).textTransform)).toBe('none');
    const p2 = await page.context().newPage();
    await open(p2, { subs: 2 });
    await expect(p2.locator('details.deeper').first().locator('.deeper-in')).toHaveText('Part 1 · Part 2');
  });

  test('expectTemplate passes a page that keeps the budgets, and fails one with two charts above the fold or Go deeper too low', async ({ page }) => {
    await open(page);
    const m = await expectTemplate(page);
    expect(m.firstTop).toBeLessThanOrEqual(700);
    await expectTextSizes(page, 17, 16.5);
    await expectStorageClean(page);
    const two = await page.context().newPage(); await two.setViewportSize({ width: 390, height: 844 });
    await open(two, { sparkTop: true });
    await expect(expectTemplate(two)).rejects.toThrow(/at most one chart above/);
    const low = await page.context().newPage(); await low.setViewportSize({ width: 390, height: 844 });
    await open(low, { tall: 3000 });
    await expect(expectTemplate(low)).rejects.toThrow(/2800/);
    // an opt-out for the answer budget must name its reason
    await expect(expectTemplate(page, { answerOptOut: 'x' })).rejects.toThrow(/names its reason/);
  });

  test('the guess stays hidden until the first result; Reveal answers; Skip hides it and goes to the answer', async ({ page }) => {
    await open(page);
    const g = page.locator('[data-guess]');
    await expect(g).toBeHidden();
    await page.evaluate(() => G.show());
    await expect(g).toBeVisible();
    await expect(g.getByRole('slider', { name: 'What do you guess?' })).toBeVisible();
    await expect(g.locator('output')).toHaveText('50%');
    await expectTextSizes(page, 17, 16.5);
    const box = await g.locator('input[type=range]').boundingBox();
    expect(box.height, 'the slider is a 44px target').toBeGreaterThanOrEqual(44);
    await g.locator('input[type=range]').fill('70');
    await g.getByRole('button', { name: 'Reveal' }).click();
    await expect(g.locator('.guess-out')).toHaveText('Your guess: 70%. The answer: 30%.');
    await expect(g.locator('input[type=range]')).toBeDisabled();
    // a second page: skip
    const p2 = await page.context().newPage(); await open(p2);
    await p2.evaluate(() => G.show());
    await p2.getByRole('button', { name: 'Skip' }).click();
    await expect(p2.locator('[data-guess]')).toBeHidden();
    expect(await p2.evaluate(() => document.activeElement && document.activeElement.id)).toBe('ans');
  });

  test('save: the download link when the share sheet cannot take files', async ({ page }) => {
    await open(page);
    await expect(page.locator('.save-note')).toHaveCount(0);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
    expect(dl.suggestedFilename()).toBe('note.txt');
  });

  test('save: the share sheet with the file when it can take files', async ({ page }) => {
    await page.addInitScript(() => {
      window.__shared = null;
      navigator.canShare = (d) => !!(d && d.files && d.files.length);
      navigator.share = (d) => { window.__shared = { names: d.files.map((f) => f.name), type: d.files[0].type, title: d.title }; return Promise.resolve(); };
    });
    await open(page);
    let downloaded = false; page.on('download', () => { downloaded = true; });
    await page.click('#save');
    await expect.poll(() => page.evaluate(() => window.__shared)).toEqual({ names: ['note.txt'], type: 'text/plain', title: 'A note' });
    expect(downloaded).toBe(false);
  });

  test('Save my card: a 1080x1350 PNG drawn in the page, in both themes', async ({ page }) => {
    await open(page);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      const out = await page.evaluate(async () => {
        const blob = await deskCard({ question: 'What opens, and when, for your year?', bigValue: '$123,456', line: 'An example line that runs long enough to wrap onto a second line.', labels: ['Example', 'Born in the example year'] });
        const bmp = await createImageBitmap(blob);
        return { type: blob.type, w: bmp.width, h: bmp.height, size: blob.size };
      });
      expect(out).toMatchObject({ type: 'image/png', w: 1080, h: 1350 });
      expect(out.size).toBeGreaterThan(10000);
    }
  });

  test('the year chip: hidden with no year; "Born {year} · change · forget" with one; change focuses the year control; forget clears and reloads', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-year-chip]')).toBeHidden();
    await page.evaluate((y) => sessionStorage.setItem('mo.year', y), YEAR);
    await page.reload();
    const chip = page.locator('[data-year-chip]');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText(`Born ${YEAR}`);
    // the chip's words are small text: 17.5px or more
    expect(await chip.evaluate((c) => [c, ...c.querySelectorAll('*')].map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((px) => px < 17.5))).toEqual([]);
    await expectTextSizes(page, 17, 16.5);
    for (const b of await chip.locator('button').all()) {
      const h = await b.evaluate((e) => Math.max(e.getBoundingClientRect().height, parseFloat(getComputedStyle(e, '::after').height) || 0));
      expect(h, 'a 44px target').toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'no sideways scroll').toBeLessThanOrEqual(0);
    await chip.getByRole('button', { name: 'change the birth year' }).click();
    expect(await page.evaluate(() => document.activeElement.id)).toBe('y');
    await chip.getByRole('button', { name: 'forget the birth year' }).click();
    await page.waitForLoadState('load');
    await expect(page.locator('[data-year-chip]')).toBeHidden();
    expect(await page.evaluate(() => [sessionStorage.getItem('mo.year'), document.documentElement.hasAttribute('data-year'), location.href])).toEqual([null, false, URL_]);
    await expectStorageClean(page);
  });

  test('a page that sets the year later shows the chip with deskYearChip()', async ({ page }) => {
    await open(page);
    await page.evaluate((y) => { sessionStorage.setItem('mo.year', y); deskYearChip(); }, YEAR);
    await expect(page.locator('[data-year-chip]')).toContainText(`Born ${YEAR}`);
    await page.evaluate(() => { sessionStorage.setItem('mo.year', 'abcd'); deskYearChip(); });
    await expect(page.locator('[data-year-chip]')).toBeHidden();
  });

  for (const scheme of ['light', 'dark']) {
    test(`axe finds nothing on the template pieces (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await page.evaluate((s) => { document.documentElement.setAttribute('data-theme', s); sessionStorage.setItem('mo.year', String(new Date().getFullYear() - 46)); deskYearChip(); G.show(); }, scheme);
      await page.locator('.readout-how summary').click();
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
});

test.describe('in an Instagram in-app browser', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91' });
  test('the save button carries the "open in Safari or Chrome" notice', async ({ page }) => {
    await open(page);
    const note = page.locator('#save + .save-note');
    await expect(note).toHaveText(IN_APP_NOTICE);
    await expect(note).toHaveAttribute('role', 'note');
    await expectTextSizes(page, 17, 16.5);
    const res = await page.evaluate(() => deskSaveFile({ blob: new Blob(['x'], { type: 'text/plain' }), name: 'x.txt', title: 'x' }));
    expect(res).toEqual({ via: 'download', inApp: 'Instagram', notice: IN_APP_NOTICE });
  });
});

test.describe('1440px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('the year chip sits between the two tool-bar links; the structural template checks pass', async ({ page }) => {
    await open(page);
    await page.evaluate((y) => { sessionStorage.setItem('mo.year', y); deskYearChip(); }, YEAR);
    const [a, c, b] = await Promise.all(['.desk-toolnav > a:first-child', '[data-year-chip]', '.desk-toolnav > a:last-of-type'].map((s) => page.locator(s).boundingBox()));
    expect(a.x + a.width).toBeLessThan(c.x);
    expect(c.x + c.width).toBeLessThan(b.x);
    expect(Math.abs((a.y + a.height / 2) - (c.y + c.height / 2))).toBeLessThan(8);
    await expectTemplate(page);
    await expectTextSizes(page, 17, 16.5);
  });
});
