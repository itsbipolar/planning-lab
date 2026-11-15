// Save as one page: the sheet is built in the browser from the current state; in print only the sheet shows, all of its
// text at 17.5px or more, and it fits one Letter page and one A4 page, at the example and at the longest-text state.
import { test, expect } from '@playwright/test';
import { textSizeOffenders } from '../../../shared/desk/shell-test.mjs';
import { fileURLToPath } from 'node:url';

const url = 'file://' + fileURLToPath(new URL('../dist/index.html', import.meta.url));

async function step(page, name, dir, times) {
  for (let i = 0; i < times; i++) {
    const b = page.locator(`button[aria-label^="${dir === 1 ? 'Increase' : 'Decrease'} ${name},"]`);
    if (await b.isDisabled()) return;
    await b.click();
  }
}
const pages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page(?![a-z])/g) || []).length;

test.use({ viewport: { width: 1440, height: 900 } });

test('Save as one page builds the sheet and calls print; in print only the sheet shows', async ({ page }) => {
  await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.goto(url);
  await page.click('#print');
  expect(await page.evaluate(() => window.__printed)).toBe(1);
  const sheet = page.locator('#sheet');
  await expect(sheet).toBeHidden(); // on screen the sheet stays out of sight
  await page.emulateMedia({ media: 'print' });
  await expect(sheet).toBeVisible();
  for (const sel of ['.desk-top', 'main', '#value', '#steppers', '#print', 'a[data-next]']) await expect(page.locator(sel).first()).toBeHidden();
  await expect(sheet.locator('.sh-top')).toContainText('Hypothetical illustration · Education, not advice');
  await expect(sheet.locator('.sh-top')).toContainText('Printed');
  await expect(sheet.locator('.sh-title')).toHaveText('How much tax does an estate freeze push past death?');
  await expect(sheet.locator('.sh-inputs')).toContainText('A made-up retiree, 70: portfolio $7.5M, tax cost $2.5M');
  await expect(sheet.locator('.sh-ledger')).toContainText('Its income tax at today’s rate, deferred');
  await expect(sheet.locator('svg text', { hasText: 'Death at 87 (example)' })).toBeVisible();
  for (const v of ['$12.11M', '$3.20M', '$3.24M', '$0.86M', '$8.91M', '$2.38M', 'not payable (assumed)', 'Taxed later']) await expect(sheet.locator('.sh-ledger')).toContainText(v);
  await expect(sheet.locator('.sh-caveats li')).toHaveCount(6);
  await expect(sheet.locator('.sh-foot')).toContainText(/Version [0-9a-f]{8}/);
  await expect(sheet.locator('.sh-foot')).toContainText('Made with an interactive tool by Mohammed El Chayeb');
  await expect(sheet.locator('.sh-foot')).toContainText('Education only, not advice.');
  expect(await sheet.innerHTML()).not.toMatch(/https?:\/\/[^\s"<]*[?#]/); // no address carrying inputs
  expect(await textSizeOffenders(page)).toEqual([]);
});

test('Ctrl/Cmd+P prints the sheet too (built before print)', async ({ page }) => {
  await page.goto(url);
  await page.evaluate(() => { document.getElementById('sheet').innerHTML = ''; dispatchEvent(new Event('beforeprint')); });
  await expect(page.locator('#sheet .sh-ledger')).toHaveCount(1);
});

for (const state of ['example', 'longest']) {
  test(`the sheet fits one page on Letter and on A4: ${state}`, async ({ page }) => {
    await page.addInitScript(() => { window.print = () => {}; });
    await page.goto(url);
    if (state === 'longest') {
      await page.locator('#value').focus(); await page.keyboard.press('End');
      await step(page, 'tax cost', -1, 200);
      await step(page, 'growth', 1, 8);
      await step(page, 'age at the freeze', -1, 15);
      await step(page, 'age at death', 1, 20);
      await page.locator('#deeper > summary').click();
      await step(page, 'investment income', 1, 50);
      await expect(page.locator('#answer-k')).toHaveText('Income tax moved to the trust');
    }
    await page.click('#print');
    for (const format of ['Letter', 'A4']) {
      const pdf = await page.pdf({ format, printBackground: false, margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' } });
      expect(pages(pdf), `${format}, ${state}`).toBe(1);
    }
  });
}
