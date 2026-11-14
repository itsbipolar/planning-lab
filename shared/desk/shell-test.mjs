// Playwright checks for the tool shell (desk-page.mjs), shared by every public tool's tests/page.spec.mjs.
import { expect } from '@playwright/test';
import { SITE, NEXT, toolFor, questionOf } from './desk-page.mjs';

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
  // the theme button: one, in the masthead, named, pressed = dark, drawn at 36px in a 44px target; it switches the page
  // and keeps the choice in localStorage 'theme' (Mo's call); two presses leave the page as it was
  const theme = head.locator('button[data-theme-toggle]');
  await expect(theme).toHaveCount(1);
  await expect(theme).toBeVisible();
  await expect(theme).toHaveAccessibleName('Dark theme');
  const was = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await expect(theme).toHaveAttribute('aria-pressed', String(was === 'dark'));
  const tb = await theme.evaluate((b) => { const r = b.getBoundingClientRect(), a = getComputedStyle(b, '::after'); return [r.width, r.height, Math.min(parseFloat(a.width), parseFloat(a.height))]; });
  expect(tb[0], 'the theme button is drawn at 36px').toBe(36);
  expect(tb[1]).toBe(36);
  expect(tb[2], 'the theme button is a 44px target').toBeGreaterThanOrEqual(44);
  await theme.click();
  const flipped = was === 'dark' ? 'light' : 'dark';
  expect(await page.evaluate(() => [document.documentElement.getAttribute('data-theme'), localStorage.getItem('theme')])).toEqual([flipped, flipped]);
  await expect(theme).toHaveAttribute('aria-pressed', String(flipped === 'dark'));
  await theme.click();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(was);

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
  await expect(card).toContainText(questionOf(next));

  // the education line and the AI note, in the body
  const body = await page.locator('body').innerText();
  expect(body).toContain(SITE.footerNote);
  expect(body).toContain(SITE.aiNote);

  // share card and canonical, absolute
  const url = `${SITE.origin}/tools/${tool.slug}/`;
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', url);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', questionOf(tool));
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

/** Storage and address rules (redesign v2, Navigation rules 8; the theme key approved by Mo): localStorage
 *  holds nothing or only 'theme' as "light" or "dark"; no cookies; sessionStorage holds nothing or only mo.year as a
 *  4-digit year; no query string; the hash is empty or #this-year. */
export async function expectStorageClean(page) {
  const s = await page.evaluate(() => ({
    local: Object.keys(localStorage), theme: localStorage.getItem('theme'), session: Object.keys(sessionStorage), year: sessionStorage.getItem('mo.year'),
    cookie: document.cookie, search: location.search, hash: location.hash,
  }));
  expect(s.local.filter((k) => k !== 'theme')).toEqual([]);
  if (s.local.includes('theme')) expect(['light', 'dark']).toContain(s.theme);
  expect(s.session.filter((k) => k !== 'mo.year')).toEqual([]);
  if (s.session.includes('mo.year')) expect(s.year).toMatch(/^\d{4}$/);
  expect(s.cookie).toBe('');
  expect(s.search).toBe('');
  expect(['', '#this-year']).toContain(s.hash);
}

/** The rendered size of every visible piece of text (redesign v2, "One size rule"; Mo: small text 17px or more): 17px for
 *  text, 16.5px for a label set in capitals or an SVG chart label. The size is the computed font-size, times the
 *  SVG's getScreenCTM() scale for text inside an SVG, so a chart label drawn small and scaled down is caught. Skips text
 *  that is not drawn (closed folds, display:none, visibility:hidden, opacity 0) and screen-reader-only text (a box of 1px
 *  or less). Returns the offenders as { text, px, at }, smallest first. */
export async function textSizeOffenders(page, min = 17, labelMin = 16.5) {
  return page.evaluate(([min, labelMin]) => {
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const text = n.textContent.replace(/\s+/g, ' ').trim();
      const el = n.parentElement;
      if (!text || !el || el.closest('script, style, noscript, template, title, desc')) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
      if (!rects.length) continue;
      const box = el.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) continue;
      let px = parseFloat(getComputedStyle(el).fontSize);
      if (el instanceof SVGElement && typeof el.getScreenCTM === 'function') {
        const m = el.getScreenCTM();
        if (m) px *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
      }
      const floor = el instanceof SVGElement || getComputedStyle(el).textTransform === 'uppercase' ? labelMin : min;
      if (px + 0.01 < floor) out.push({ text: text.slice(0, 40), px: Math.round(px * 10) / 10, at: el.tagName.toLowerCase() + (el.getAttribute('class') ? '.' + el.getAttribute('class').trim().split(/\s+/).join('.') : '') });
    }
    return out.sort((a, b) => a.px - b.px);
  }, [min, labelMin]);
}

/** Asserts that every visible piece of text renders at min px or more (17 by default; labels and SVG labels 16.5), SVG
 *  scale included; returns the
 *  offenders it found (an empty list when it passes). Call it at 390 and 1440, in each state that shows new text. */
export async function expectTextSizes(page, min = 17, labelMin = 16.5) {
  const bad = await textSizeOffenders(page, min, labelMin);
  expect(bad, `text rendered under ${min}px`).toEqual([]);
  return bad;
}
