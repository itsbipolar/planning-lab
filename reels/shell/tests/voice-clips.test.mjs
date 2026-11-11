// No narration clip may end mid-word: align.py marks a clip whose speech runs to the end of its file while still
// sounding there (the voice model cut the last word off), and the render refuses it. This checks both reels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib.mjs';

for (const reel of ['history-45', 'money-year']) {
  test(`every narration clip ends cleanly: ${reel}`, () => {
    const cuts = JSON.parse(readFileSync(join(ROOT, 'reels', reel, 'voice', 'cuts.json'), 'utf8'));
    for (const [card, c] of Object.entries(cuts)) assert.equal(c.cut_off, false, `${card}: cut off (${c.tail_db} dB at the end of the clip)`);
  });
}
