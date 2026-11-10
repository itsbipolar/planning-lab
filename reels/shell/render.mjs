// The reel command. Preflight first: if any card's facts are missing or unconfirmed, nothing renders.
//   node reels/shell/render.mjs reels/history-45                 full reel, carousel, captions, contact sheet
//   node reels/shell/render.mjs reels/history-45 --strip 10      a 10-second test strip of each look
//   node reels/shell/render.mjs reels/history-45 --look paper    choose the look (paper or sheet)
//   node reels/shell/render.mjs reels/history-45 --preflight     check only
// Renders locally with the HyperFrames CLI (no telemetry, no publishing) and FFmpeg.
import { mkdirSync, statSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve as res } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, loadFacts, loadReel, preflight, resolve } from './lib.mjs';
import { buildProject, buildCarousel, writeCaptions, slots } from './build.mjs';
import { FORMATS, LOOKS } from './cards.mjs';

const args = process.argv.slice(2);
const flag = k => args.includes(`--${k}`);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const reelDir = res(args.find(a => !a.startsWith('--') && !Object.keys(LOOKS).includes(a) && !/^\d+$/.test(a)) ?? 'reels/history-45');
const MAX_BYTES = 25 * 1024 * 1024;

const reel = loadReel(reelDir), facts = loadFacts();
const problems = preflight(reel, facts);
if (problems.length) {
  console.error(`PREFLIGHT FAILED for ${reel.id}: nothing was rendered.`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`preflight passed: ${reel.cards.length} cards, every fact confirmed in shared/facts.json`);
if (flag('preflight')) process.exit(0);

const model = resolve(reel, facts);
const out = join(reelDir, 'out'), work = join(reelDir, '.build');
mkdirSync(out, { recursive: true });
const HEADLESS = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1',
  ...(existsSync(HEADLESS) && !process.env.PRODUCER_HEADLESS_SHELL_PATH ? { PRODUCER_HEADLESS_SHELL_PATH: HEADLESS } : {}) };
const hf = (cwd, ...a) => {
  const r = spawnSync(join(ROOT, 'node_modules', '.bin', 'hyperframes'), a, { cwd, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) { console.error(r.stdout?.slice(-4000), r.stderr?.slice(-4000)); throw new Error(`hyperframes ${a[0]} failed`); }
  return r.stdout;
};
const ff = (...a) => { const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...a], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`); };

async function renderLook(look, { duration, name }) {
  const dir = join(work, `${name}`);
  await buildProject(model, look, dir, { duration });
  hf(dir, 'lint', '.');
  const mp4 = join(out, `${name}.mp4`);
  hf(dir, 'render', '-o', mp4, '--quiet');
  const size = statSync(mp4).size;
  if (size > MAX_BYTES) throw new Error(`${mp4} is ${(size / 1048576).toFixed(1)} MiB, over 25 MiB`);
  console.log(`wrote ${mp4} (${(size / 1048576).toFixed(2)} MiB)`);
  return mp4;
}

// Settled frames: each card just before the next page starts to turn.
function settledTimes(limit) {
  return model.cards.filter(c => c.start < limit).map(c => Math.min(c.start + c.duration, limit) - 0.25);
}
function contactSheet(mp4, times, file, cols, cellW = 360) {
  const tmp = join(work, 'cs'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  times.forEach((t, i) => ff('-ss', t.toFixed(3), '-i', mp4, '-frames:v', '1', '-vf', `scale=${cellW}:-2`, join(tmp, `f${String(i).padStart(3, '0')}.png`)));
  const rows = Math.ceil(times.length / cols);
  ff('-pattern_type', 'glob', '-i', join(tmp, 'f*.png'), '-vf', `tile=${cols}x${rows}:padding=12:margin=12:color=0x15120E`, '-frames:v', '1', file);
  console.log(`wrote ${file}`);
}
// A transparent guide for editors, and a preview of it over one frame: the platform's top bar,
// the bottom caption area and the right-hand button rail, which must hold no words.
function safeZone(mp4, at, file) {
  const F = FORMATS.reel, R = F.w - F.right;
  const boxes = [`drawbox=x=0:y=0:w=${F.w}:h=${F.top}:color=red@0.28:t=fill`,
    `drawbox=x=0:y=${F.h - F.bottom}:w=${F.w}:h=${F.bottom}:color=red@0.28:t=fill`,
    `drawbox=x=${R}:y=${F.top}:w=${F.right}:h=${F.h - F.top - F.bottom}:color=orange@0.25:t=fill`,
    `drawbox=x=${F.left}:y=${F.top}:w=${R - F.left}:h=${F.h - F.top - F.bottom}:color=cyan@0.9:t=4`].join(',');
  ff('-f', 'lavfi', '-i', `color=c=black@0.0:s=${F.w}x${F.h},format=rgba`, '-frames:v', '1', '-vf', boxes, join(out, 'safe-zone-overlay.png'));
  ff('-ss', at.toFixed(3), '-i', mp4, '-frames:v', '1', '-vf', `${boxes},scale=540:-2`, file);
  console.log(`wrote ${file}`);
}

async function carousel(look) {
  const { chromium } = await import('playwright');
  const dir = join(work, 'carousel');
  const pages = buildCarousel(model, look, dir);
  const shots = join(out, 'carousel'); rmSync(shots, { recursive: true, force: true }); mkdirSync(shots, { recursive: true });
  const F = FORMATS.carousel;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: F.w, height: F.h }, deviceScaleFactor: 1 });
  const pngs = [];
  for (const p of pages) {
    await page.goto('file://' + join(dir, p)); await page.evaluate(() => document.fonts.ready);
    const png = join(shots, p.replace('.html', '.png')); await page.screenshot({ path: png }); pngs.push(png);
  }
  // LinkedIn document: one PDF page per slide, from the same PNGs.
  const html = `<!doctype html><html><head><style>@page{size:${F.w}px ${F.h}px;margin:0}body{margin:0}img{display:block;width:${F.w}px;height:${F.h}px;break-after:page}</style></head><body>${pngs.map(p => `<img src="file://${p}">`).join('')}</body></html>`;
  writeFileSync(join(dir, 'pdf.html'), html);
  await page.goto('file://' + join(dir, 'pdf.html')); await page.waitForLoadState('load');
  await page.pdf({ path: join(out, 'carousel.pdf'), width: `${F.w}px`, height: `${F.h}px`, printBackground: true });
  await browser.close();
  console.log(`wrote ${pngs.length} carousel slides and carousel.pdf`);
}

if (opt('strip')) {
  const sec = Number(opt('strip'));
  const looks = opt('look') ? [opt('look')] : Object.keys(LOOKS);
  const rows = [];
  for (const look of looks) {
    const mp4 = await renderLook(look, { duration: sec, name: `strip-${look}` });
    rows.push({ look, mp4 });
  }
  // One contact sheet for both strips: a row per look, frames every second.
  const times = Array.from({ length: Math.round(sec) }, (_, i) => i + 0.5);
  const parts = rows.map(r => { const f = join(work, `row-${r.look}.png`); contactSheet(r.mp4, times, f, times.length, 270); return f; });
  if (parts.length > 1) ff(...parts.flatMap(p => ['-i', p]), '-filter_complex', `vstack=inputs=${parts.length}`, join(out, 'strips-contact-sheet.png'));
  else ff('-i', parts[0], join(out, 'strips-contact-sheet.png'));
  console.log(`wrote ${join(out, 'strips-contact-sheet.png')}`);
} else {
  const look = opt('look', reel.look ?? 'paper');
  const mp4 = await renderLook(look, { name: reel.id });
  writeCaptions(model, join(out, `${reel.id}.vtt`));
  contactSheet(mp4, settledTimes(model.total), join(out, 'contact-sheet.png'), 5);
  safeZone(mp4, model.cards.find(c => c.type === 'date').start + 3, join(out, 'safe-zone-check.png'));
  await carousel(look);
  void slots;
}
