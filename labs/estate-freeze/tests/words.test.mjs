// The page's words, education only: no advice words, income tax is "deferred" (never "saved"), no "your portfolio", no
// "prepared for", and the stamp and the short question. Run over the built page's text (scripts and styles removed) and
// every string the page script writes (the readout, the chart, the ledger, the print sheet and the card).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toolFor, questionOf } from '../../../shared/desk/desk-page.mjs';

const here = new URL('..', import.meta.url).pathname;
const dist = readFileSync(here + 'dist/index.html', 'utf8');
const app = readFileSync(here + 'app.js', 'utf8');
const BANNED = /\bshould\b|recommend|best for you|right for you|\bsaved\b|\bsavings?\b|tax-free|eliminat|avoids? tax|\byour (portfolio|estate)\b|prepared for/i;
const STAMP = 'Hypothetical illustration · Education, not advice';
const visible = dist.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');
// every string literal in the page script (what it writes on the page, the sheet and the card)
const strings = [...app.replace(/^\s*\/\/.*$/gm, '').matchAll(/'((?:\\.|[^'\\])*)'/g)].map((m) => m[1].replace(/\\u2019/g, '’').replace(/\\u00b7/g, '·'));

test('no advice words, no "saved", no "your portfolio", no "prepared for"', () => {
  assert.doesNotMatch(visible, BANNED);
  for (const s of strings) assert.doesNotMatch(s, BANNED, s);
  // the checker can fail
  assert.match('this is how tax is saved', BANNED);
  assert.match('Prepared for the Smith family', BANNED);
});

test('"deferred" and the stamp are on the page, in the sheet and on the card', () => {
  assert.match(visible, /deferred/i);
  assert.ok(visible.includes(STAMP), 'the stamp on the page');
  assert.ok(app.includes(`STAMP = '${STAMP}'`) || app.includes("STAMP = 'Hypothetical illustration \\u00b7 Education, not advice'"), 'one stamp constant');
  assert.match(app, /draw: miniBand, stamp: STAMP/, 'the card carries the stamp');
  assert.match(app, /sh-top"><span>' \+ esc\(STAMP\)/, 'the sheet carries the stamp');
  assert.ok(strings.some((s) => /deferred, not removed/.test(s)), 'the card and sheet say deferred, not removed');
});

test('the question is 12 words or fewer with no digit, and it is the H1', () => {
  const q = questionOf(toolFor('estate-freeze'));
  assert.ok(q.split(/\s+/).length <= 12);
  assert.doesNotMatch(q, /\d/);
  assert.ok(dist.includes(`<h1 id="question">${q}</h1>`));
});

test('no firm, title or hiring words; the retiree is made up', () => {
  assert.doesNotMatch(visible, /\bCFP\b|Financial (Planner|Advisor)|hire|hiring|book a call|contact me/i);
  for (const s of strings) assert.doesNotMatch(s, /\bCFP\b|Financial (Planner|Advisor)|book a call/i, s);
  assert.match(visible, /made-up retiree/);
});
