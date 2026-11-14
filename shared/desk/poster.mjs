// Poster data (redesign v2, step 3, "Posters: drawn as SVG at build"): each public tool's build writes dist/poster.json,
// a small file the site draws its tile poster (and the OG image) from as SVG. Everything in it is computed from the
// tool's own data and the confirmed facts at build time; nothing is typed. The shape (version 1):
//
// {
//   "v": 1, "slug": "<site slug>", "lab": "<lab slug>", "question": "<the tool's question>",
//   "kind": "lanes" | "lines" | "line" | "dates" | "heat",     how the hero chart is drawn (see each build)
//   "example": "<a label saying what the example is>",           always shown on the poster (an illustration)
//   "x": { "label", "min", "max", "ticks"? }, "y": { "label", "min", "max" }?,
//   ...the series for that kind,
//   "readings": [{ "label", "value", "text"?, "at"? }],          at most two; value is short (set in serif at 64px)
//   "labels": [{ "text", "at"? }],                               at most two (17px or more on the poster)
//   "source": "<one short source line>", "asOf": "<YYYY-MM-DD or year the data runs to>"
// }
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { toolFor, questionOf } from './desk-page.mjs';

export const POSTER_MAX_BYTES = 8 * 1024;

export function writePoster(distDir, labSlug, body) {
  const tool = toolFor(labSlug);
  if (!tool) throw new Error(`${labSlug} is not a public tool`);
  const p = { v: 1, slug: tool.slug, lab: labSlug, question: questionOf(tool), ...body };
  if (!p.kind || !p.example) throw new Error(`${labSlug} poster: kind and example are required`);
  if (!Array.isArray(p.readings) || p.readings.length < 1 || p.readings.length > 2) throw new Error(`${labSlug} poster: one or two readings`);
  if (!Array.isArray(p.labels) || p.labels.length > 2) throw new Error(`${labSlug} poster: at most two labels`);
  for (const r of p.readings) if (!r.label || r.value == null || String(r.value).length > 16) throw new Error(`${labSlug} poster: a reading needs a label and a short value (${r.value})`);
  const text = JSON.stringify(p);
  if (/NaN|null,null|undefined/.test(text)) throw new Error(`${labSlug} poster: a value is missing`);
  if (text.length > POSTER_MAX_BYTES) throw new Error(`${labSlug} poster: ${text.length} bytes, over ${POSTER_MAX_BYTES}`);
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, 'poster.json'), text + '\n');
  return p;
}

/** Rounds to a fixed number of decimals, for small files. */
export const r = (v, dp = 0) => { const k = 10 ** dp; return Math.round(v * k) / k; };
