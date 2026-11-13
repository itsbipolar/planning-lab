// Playwright checks for the tool shell (desk-page.mjs), shared by every public tool's tests/page.spec.mjs.
import { expect } from '@playwright/test';
import { SITE, NEXT, toolFor } from './desk-page.mjs';

/** The tool bar, the one Up next card, the notes, the head tags, no rail and nothing sticky. */
export async function expectShell(page, labSlug) {
  const tool = toolFor(labSlug), next = NEXT.tools.find((t) => t.slug === tool.next);
  const width = page.viewportSize().width;

  // the tool bar: the wordmark home, the site's four nav items (each fully on screen), All tools and How I made this
  const head = page.locator('header.desk-head');
  await expect(head).toHaveCount(1);
  await expect(head.locator('a.desk-brand')).toHaveAttribute('href', '/');
  await expect(head.locator('a.desk-brand')).toHaveText(SITE.wordmark);
  const items = head.locator('nav.desk-nav a');
  expect(await items.evaluateAll((as) => as.map((a) => [a.textContent, a.getAttribute('href')]))).toEqual(SITE.nav.map((n) => [n.label, n.href]));
  for (const a of await items.all()) {
    const b = await a.boundingBox();
    expect(b.x, `${await a.textContent()} starts on screen`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `${await a.textContent()} ends on screen`).toBeLessThanOrEqual(width);
    expect(await a.evaluate((e) => [getComputedStyle(e).textTransform, parseFloat(getComputedStyle(e).fontSize) >= 16.5])).toEqual(['uppercase', true]);
  }
  expect((await head.boundingBox()).height, 'the masthead is 96px or less').toBeLessThanOrEqual(96);
  const bar = page.locator('nav.desk-toolnav');
  await expect(bar.getByRole('link', { name: 'All tools' })).toHaveAttribute('href', '/tools/');
  await expect(bar.getByRole('link', { name: 'How I made this' })).toHaveAttribute('href', `/tools/${tool.slug}/how-i-made-it/`);
  // the bar comes first on the page, in the site's container, outside the tool's own .page
  expect(await page.evaluate(() => { const top = document.querySelector('.desk-top'); return [top.parentElement.tagName, top.firstElementChild.className, top.nextElementSibling.className]; })).toEqual(['BODY', 'desk-head', 'page']);
  // every nav link and bar link is a 44px target
  for (const a of [...await items.all(), ...await bar.locator('a').all()]) {
    const h = await a.evaluate((e) => Math.max(e.getBoundingClientRect().height, parseFloat(getComputedStyle(e, '::after').height) || 0));
    expect(h, `${await a.textContent()} is a 44px target`).toBeGreaterThanOrEqual(44);
  }

  // exactly one Up next card, to the next tool in the chain, with its question
  await expect(page.locator('[data-next]')).toHaveCount(1);
  const card = page.locator('a[data-next]');
  await expect(card).toHaveAttribute('href', `/tools/${next.slug}/`);
  await expect(card).toContainText('Up next');
  await expect(card).toContainText(next.question);

  // the education line and the AI note, in the body
  const body = await page.locator('body').innerText();
  expect(body).toContain(SITE.footerNote);
  expect(body).toContain(SITE.aiNote);

  // share card and canonical, absolute
  const url = `${SITE.origin}/tools/${tool.slug}/`;
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', url);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', tool.question);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /\S/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${SITE.origin}/og/tools/${tool.slug}.png`);

  // no chapter rail, and nothing sticky or fixed on the page except the thin reading-progress line
  await expect(page.locator('nav.rail')).toHaveCount(0);
  const pinned = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter((e) => /sticky|fixed/.test(getComputedStyle(e).position) && !e.closest('.read-progress, table'))
    .map((e) => e.tagName + '.' + e.className));
  expect(pinned).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'no sideways scroll').toBeLessThanOrEqual(0);
}

/** Storage and address rules (redesign v2, Navigation rules 8): the page writes nothing to localStorage or cookies;
 *  sessionStorage holds nothing or only mo.year as a 4-digit year; no query string; the hash is empty or #this-year. */
export async function expectStorageClean(page) {
  const s = await page.evaluate(() => ({
    local: Object.keys(localStorage), session: Object.keys(sessionStorage), year: sessionStorage.getItem('mo.year'),
    cookie: document.cookie, search: location.search, hash: location.hash,
  }));
  expect(s.local).toEqual([]);
  expect(s.session.filter((k) => k !== 'mo.year')).toEqual([]);
  if (s.session.includes('mo.year')) expect(s.year).toMatch(/^\d{4}$/);
  expect(s.cookie).toBe('');
  expect(s.search).toBe('');
  expect(['', '#this-year']).toContain(s.hash);
}
