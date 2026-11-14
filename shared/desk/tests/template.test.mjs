// The desk tool template's pure parts (desk-ui.mjs, desk-page.mjs; redesign v2 steps 4 to 6): in-app browser detection
// for the save notice, the card's stamp and address, the Go deeper line, the canvas word wrap, the year chip and the
// one-assumptions rule in the shell, the page script parses, and no figure or year from the facts is written into the
// shared template code. The browser parts are checked by each tool's page.spec.mjs with expectTemplate().
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  inAppBrowser, siteAddress, wordCount, deeperIntro, deeperPreview, wrapText, cardText,
  IN_APP_NOTICE, CARD_STAMP, EXAMPLE_TAG, deskUIJS, deskUICSS,
} from '../desk-ui.mjs';
import { SITE, deskPage, toolBar, toolFor } from '../desk-page.mjs';

const here = new URL('..', import.meta.url).pathname, root = new URL('../../../', import.meta.url).pathname;

test('in-app browsers: Instagram, LinkedIn and Facebook are told to open Safari or Chrome; ordinary browsers are not', () => {
  const ua = {
    instagramIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91 (iPhone15,2; iOS 17_5; en_CA; en; scale=3.00; 1179x2556; 613212044)',
    instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Instagram 339.0.0.37.94 Android (34/14; 420dpi; 1080x2400; Google; Pixel 8; shiba; shiba; en_CA; 615420081)',
    linkedinIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.29.8316',
    linkedinAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918W Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 [LinkedInApp]/4.1.959',
    facebookIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBBV/613155617;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]',
    facebookAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.44.109;]',
    messengerIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/465.0.0.38.109;FBBV/608813093;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5]',
  };
  assert.equal(inAppBrowser(ua.instagramIOS), 'Instagram');
  assert.equal(inAppBrowser(ua.instagramAndroid), 'Instagram');
  assert.equal(inAppBrowser(ua.linkedinIOS), 'LinkedIn');
  assert.equal(inAppBrowser(ua.linkedinAndroid), 'LinkedIn');
  assert.equal(inAppBrowser(ua.facebookIOS), 'Facebook');
  assert.equal(inAppBrowser(ua.facebookAndroid), 'Facebook');
  assert.equal(inAppBrowser(ua.messengerIOS), 'Facebook');
  for (const plain of [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
    '', undefined, null,
  ]) assert.equal(inAppBrowser(plain), null, String(plain));
  assert.equal(IN_APP_NOTICE, 'Open this page in Safari or Chrome to save the file.');
});

test('a saved card is stamped "Example · Education, not advice" with the site address, and says only what it is given', () => {
  assert.equal(CARD_STAMP, 'Example · Education, not advice');
  const host = SITE.origin.replace('https://', '');
  assert.equal(siteAddress(SITE.origin), host);
  assert.equal(siteAddress(SITE.origin + '/'), host);
  const t = cardText({ question: 'What opens, and when, for your year?', bigValue: '$1', line: 'One line.', labels: ['a', '', 'b', 'c', 'd'] }, SITE.origin);
  assert.equal(t.stamp, CARD_STAMP);
  assert.equal(t.address, host);
  assert.deepEqual(t.labels, ['a', 'b', 'c'], 'at most three labels, blanks dropped');
  assert.equal(cardText({}, SITE.origin).bigValue, '');
  // the page draws exactly these strings: the stamp, the origin and the wordmark are in the page script
  const js = deskUIJS();
  const lit = (v) => JSON.stringify(v).replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  assert.ok(js.includes(lit(CARD_STAMP)), 'the stamp, written as an ASCII-safe literal');
  assert.doesNotMatch(js.slice(js.indexOf('The desk tool template')), /[^\x00-\x7f]/, 'the template script is ASCII, whatever the page encoding');
  assert.ok(js.includes(JSON.stringify(SITE.origin)));
  assert.ok(js.includes('T.stamp') && js.includes('T.address'), 'the canvas draws the stamp and the address');
  assert.ok(js.includes('c.width = W; c.height = H') && /W = 1080, H = 1350/.test(js), 'the card is 1080x1350');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|new Image\(|navigator\.sendBeacon/.test(js), 'nothing is uploaded or requested');
});

test('the readout limits, the Go deeper line and the canvas wrap', () => {
  assert.equal(wordCount('  How much   by that age '), 5);
  assert.equal(wordCount(''), 0);
  assert.equal(deeperIntro(['One', 'Two']), '');
  assert.equal(deeperIntro(['One', ' Two  lanes ', '', 'Three']), 'In this section: One · Two lanes · Three');
  assert.equal(deeperPreview(['One']), '');
  assert.equal(deeperPreview(['One', ' Two  lanes ', '']), 'One · Two lanes');
  const m = (s) => s.length;
  assert.deepEqual(wrapText('aa bb cc dd', 5, m), ['aa bb', 'cc dd']);
  assert.deepEqual(wrapText('averyveryverylongword b', 5, m), ['averyveryverylongword', 'b']);
  const cut = wrapText('one two three four five six seven', 9, m, 2);
  assert.equal(cut.length, 2);
  assert.ok(cut[1].endsWith('…') && cut[1].length <= 9, cut[1]);
  assert.equal(EXAMPLE_TAG, 'Example data');
});

test('the page script parses, carries every helper, and keeps data-next for the one Up next card', () => {
  const js = deskUIJS();
  assert.doesNotThrow(() => new Function(js));
  for (const f of ['deskReadout', 'deskDeeper', 'deskExampleTag', 'deskSaveFile', 'deskSaveButton', 'deskCard', 'deskSaveCard', 'deskGuess', 'inAppBrowser', 'deskCrosshair']) {
    assert.match(js, new RegExp(`function ${f}\\(`), f);
  }
  assert.doesNotMatch(js, /data-next/, 'deskPage reserves data-next');
  assert.match(js, /navigator\.share\(data\)/);
  assert.match(js, /navigator\.canShare\(data\)/);
  // the count-up is 300ms, only after the visitor acted, never under reduced motion; live regions settle after 250ms
  assert.match(js, /\(now - t0\) \/ 300/);
  assert.match(js, /!deskActed\(\) \|\| deskStill\(\)/);
  assert.match(js, /removeAttribute\('aria-busy'\); \}, 250\)/);
  // one CSS rule makes every transition and animation instant under reduced motion
  assert.match(deskUICSS(), /@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{transition-duration:0s!important/);
  // no storage is touched by the template script (the year chip's sessionStorage use is in the tool bar)
  assert.doesNotMatch(js, /localStorage|sessionStorage|document\.cookie/);
});

test('every size the template CSS sets is 17.5px or more (Mo: never smaller)', () => {
  const css = deskUICSS();
  const block = css.slice(css.indexOf('/* ---- The desk tool template'));
  for (const m of block.matchAll(/(?:font-size:|font:\s*\d{3}\s+)([\d.]+)px/g)) assert.ok(parseFloat(m[1]) >= 17.5, `a ${m[1]}px size in the template CSS`);
});

test('the year chip is in the tool bar only on pages with the year marker, hidden until mo.year holds a year', () => {
  const ok = '<head><meta name="description" content="d"></head><!--@@TOOLBAR@@--><!--@@NEXT@@--><!--@@NOTES@@-->';
  const withYear = deskPage(ok.replace('</head>', '<!--@@YEAR@@--></head>'), 'planning-timeline');
  const without = deskPage(ok, 'planning-timeline');
  assert.match(withYear, /<p class="desk-year" data-year-chip hidden>/);
  assert.doesNotMatch(without, /data-year-chip/);
  const bar = toolBar(toolFor('planning-timeline'), { year: true });
  assert.match(bar, /Born <b data-year-chip-y><\/b>/);
  assert.match(bar, />change<\/button>/);
  assert.match(bar, />forget<\/button>/);
  assert.match(bar, /sessionStorage\.removeItem\(K\)\}catch\(e\)\{\}location\.reload\(\)/, 'forget removes the key and reloads');
  assert.match(bar, /\[data-year-control\]/, 'change focuses the page year control');
  assert.match(bar, /\/\^\\d\{4\}\$\//, 'only a 4-digit year shows');
  assert.doesNotMatch(bar, /location\.(hash|search|href)\s*=|history\.(push|replace)State/, 'the year never reaches the address');
});

test('the shell refuses two assumptions blocks', () => {
  const ok = '<head><meta name="description" content="d"></head><!--@@TOOLBAR@@--><p class="assume" data-assumptions>a</p><!--@@NEXT@@--><!--@@NOTES@@-->';
  assert.doesNotThrow(() => deskPage(ok, 'planning-timeline'));
  assert.throws(() => deskPage(ok.replace('<!--@@NEXT@@-->', '<p data-assumptions>b</p><!--@@NEXT@@-->'), 'planning-timeline'), /data-assumptions/);
});

test('no figure or year from the facts file is written into the shared template code', () => {
  const facts = JSON.parse(readFileSync(`${root}shared/facts.json`, 'utf8')).facts.filter((f) => f.status === 'confirmed');
  const ages = ['tfsa_minimum_age', 'cpp_earliest_start_age', 'cpp_standard_start_age', 'cpp_latest_start_age', 'oas_start_age', 'oas_deferral_max_age', 'rrsp_maturity_age'];
  const figs = new Set(ages.map((id) => String(facts.find((f) => f.id === id).value)));
  facts.find((f) => f.id === 'rrif_minimum_factors').value.forEach((r) => figs.add(String(r.factor)));
  // and every dollar amount or other number of 1,000 or more in the facts (limits, thresholds, maximums)
  for (const f of facts) {
    const vals = Array.isArray(f.value) ? f.value.flatMap((r) => (r && typeof r === 'object' ? Object.values(r) : [r])) : [f.value];
    for (const v of vals) if (typeof v === 'number' && Math.abs(v) >= 1000) figs.add(String(v));
  }
  const sources = [
    ...['desk-ui.mjs', 'desk-page.mjs', 'shell-test.mjs', 'tests/template.test.mjs'].map((f) => [f, readFileSync(here + f, 'utf8')]),
    ['deskUIJS()', deskUIJS()], ['deskUICSS()', deskUICSS()],
  ];
  for (const [name, raw] of sources) {
    // the SVG namespace and the sample user-agent strings above are not figures
    const t = raw.replace(/http:\/\/www\.w3\.org\/\d{4}\/svg/g, '').replace(/'Mozilla\/5\.0[^']*'/g, "''");
    for (const v of figs) assert.ok(!new RegExp(`(?<![\\w.#-])${v.replace('.', '\\.')}(?![\\w.%])`).test(t), `${name} contains ${v}`);
    assert.ok(!/(?<![\w.#-])(19|20)\d\d(?![\w.])/.test(t), `${name} contains a year`);
  }
});

test('no advice words in the template\'s own copy', () => {
  const ADVICE = /\b(should|recommend\w*)\b|\bbest for you\b/i;
  const words = [IN_APP_NOTICE, CARD_STAMP, EXAMPLE_TAG, 'Guess first', 'Reveal', 'Skip', 'How this is worked out', 'Go deeper', 'In this section'];
  for (const w of words) assert.doesNotMatch(w, ADVICE, w);
  const bar = toolBar(toolFor('planning-timeline'), { year: true }).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(bar, ADVICE);
});
