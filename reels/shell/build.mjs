// Writes a HyperFrames project for one reel and one look: index.html mounts one scene per card from
// compositions/, each scene turns its page in over the one before, and assets/ holds the fonts, GSAP and
// the tick track. Also writes the carousel pages (same card markup at 1080x1350) and the captions.
import { mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, captionsVTT } from './lib.mjs';
import { FORMATS, LOOKS, cardCSS, cardHTML, cardTweens, fontFaces, esc } from './cards.mjs';
import { buildTicks } from './sound.mjs';
import { mixSound } from './voice.mjs';

const NM = join(ROOT, 'node_modules');
const FONT_FILES = [
  [join(ROOT, 'reels', 'shell', 'fonts', 'archivo-latin-wght-normal.woff2'), 'archivo-latin-wght-normal.woff2'],
  [join(NM, '@fontsource', 'source-serif-4', 'files', 'source-serif-4-latin-600-normal.woff2'), 'source-serif-4-latin-600-normal.woff2'],
  [join(NM, '@fontsource', 'source-serif-4', 'files', 'source-serif-4-latin-400-normal.woff2'), 'source-serif-4-latin-400-normal.woff2'],
];
export const LANDING = 0.45; // the tick sounds this long after a page starts to turn

export function copyFonts(dir) {
  mkdirSync(dir, { recursive: true });
  for (const [from, name] of FONT_FILES) copyFileSync(from, join(dir, name));
}

// Scene slots: each card after the first starts turning at its start time, over the previous page,
// so every slot but the last runs on for one page turn.
export function slots(model) {
  const turn = model.reel.turn;
  return model.cards.map((c, i) => ({ id: `c-${c.id}`, card: c, start: c.start,
    duration: c.duration + (i < model.cards.length - 1 ? turn : 0), turn: i === 0 ? 0 : turn }));
}

// `fmt` is the card layout and frame size: 'reel' (1080x1920, for the apps) or 'carousel' (1080x1350, the web cut).
export async function buildProject(model, look, dir, { duration, voiceDir, fmt = 'reel' } = {}) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'compositions'), { recursive: true });
  copyFonts(join(dir, 'assets', 'fonts'));
  copyFileSync(join(NM, 'gsap', 'dist', 'gsap.min.js'), join(dir, 'assets', 'gsap.min.js'));
  const F = FORMATS[fmt], L = LOOKS[look];
  const total = duration ?? model.total;
  const ss = slots(model).filter(s => s.start < total);
  await buildTicks(ss.filter(s => s.turn > 0).map(s => s.start), total, LANDING, join(dir, 'assets', 'ticks.wav'), { tickAt: [0] });
  // With a voice, the sound is the voice over the ticks; otherwise the ticks alone.
  const sound = voiceDir && !duration ? 'sound.wav' : 'ticks.wav';
  if (sound === 'sound.wav') mixSound(model, voiceDir, join(dir, 'assets', 'ticks.wav'), join(dir, 'assets', 'sound.wav'));

  for (const [i, s] of ss.entries()) {
    const sel = `#${s.id}-card`;
    writeFileSync(join(dir, 'compositions', `${s.id}.html`), `<template>
  <style>
${fontFaces()}
#root{position:absolute;inset:0}
${cardCSS(sel, look, fmt)}
  </style>
  <div id="root" data-composition-id="${s.id}" data-width="${F.w}" data-height="${F.h}">
    <div id="${s.id}-card">${cardHTML(s.card, model, fmt, s.id)}</div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${cardTweens(s.card, model, s.id, s.turn, sel, fmt)}
    tl.to({}, { duration: ${s.duration} }, 0);
    window.__timelines["${s.id}"] = tl;
  </script>
</template>
`);
    void i;
  }

  const hosts = ss.map((s, i) => `      <div id="${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html"
        data-start="${s.start.toFixed(3)}" data-duration="${Math.min(s.duration, total - s.start).toFixed(3)}" data-track-index="${i + 1}" data-track-kind="graphics"
        data-width="${F.w}" data-height="${F.h}" style="z-index:${i + 2}"></div>`).join('\n');
  writeFileSync(join(dir, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${F.w}, height=${F.h}" />
    <title>${esc(model.reel.title)}</title>
    <script src="assets/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${F.w}px; height: ${F.h}px; overflow: hidden; background: ${L.ground}; }
      #ground { position: absolute; inset: 0; background: ${L.ground}; z-index: 1; }
      #ground i { position: absolute; background: ${L.paper}; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total.toFixed(3)}" data-width="${F.w}" data-height="${F.h}">
      <div id="ground">${L.stack ? [10, 22].map((o, k) => `<i style="left:${L.inset + o}px;top:${L.inset - o / 2}px;right:${L.inset - o}px;bottom:${L.inset - o / 2}px;opacity:${0.5 - k * 0.22}"></i>`).reverse().join('') : ''}</div>
${hosts}
      <audio id="sound" class="clip" src="assets/${sound}" data-start="0" data-duration="${total.toFixed(3)}" data-track-index="0" data-volume="1"></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.to({}, { duration: ${total.toFixed(3)} }, 0);
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`);
  return { dir, total, scenes: ss.length };
}

// One standalone page per carousel slide, final state, 1080x1350. The last slide carries the end card's lines.
export function buildCarousel(model, look, dir) {
  rmSync(dir, { recursive: true, force: true });
  copyFonts(join(dir, 'fonts'));
  const F = FORMATS.carousel, L = LOOKS[look];
  const pages = [];
  for (const [i, id] of model.reel.carousel.entries()) {
    const c = model.cards.find(x => x.id === id);
    const last = i === model.reel.carousel.length - 1;
    const end = model.cards.find(x => x.type === 'end');
    const extra = last && end ? `<div class="ai r" style="margin-top:20px">${esc(end.ai)}</div>` : '';
    let html = cardHTML(c, model, 'carousel', 's', { showFoot: true });
    if (extra) html = html.replace('<div class="foot">', `${extra}<div class="foot">`);
    const name = `slide-${String(i + 1).padStart(2, '0')}-${id}.html`;
    writeFileSync(join(dir, name), `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>${esc(model.reel.title)} ${i + 1}</title>
<style>${fontFaces('fonts/')}*{margin:0;padding:0;box-sizing:border-box}html,body{width:${F.w}px;height:${F.h}px;overflow:hidden;background:${L.ground}}
${cardCSS('#s', look, 'carousel')}</style></head><body><div id="s">${html}</div></body></html>`);
    pages.push(name);
  }
  return pages;
}

export function writeCaptions(model, file) { writeFileSync(file, captionsVTT(model)); }
