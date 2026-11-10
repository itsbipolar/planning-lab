// Narration: one clip per card in reels/<name>/voice/<card id>.wav. The shell trims each clip's leading and trailing
// silence and shortens any pause longer than PAUSE to PAUSE (it never changes the speed), times every card to its
// clip, mixes the voice over the page-turn ticks, and writes captions from what the voice says.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export const PAUSE = 0.45;     // the longest pause kept inside a line, in seconds
export const LEAD_FIRST = 0.2; // the first card's voice starts this soon, so the hook is spoken in the first second
export const LEAD = 0.45;      // later cards: the voice starts as the turned page lands
export const TAIL = 0.3;       // a breath after each line before the next page turns
export const SILENT_CARD = 2.6;

const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr?.slice(-800)}`); return r; };
const duration = f => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.trim());

export const hasVoice = (reel, reelDir) => Boolean(reel.voice) && existsSync(join(reelDir, reel.voice.dir ?? 'voice'));

// Clean mono 44.1 kHz copies in `out`; returns { cardId: seconds }. Each clip is first cut to its speech window from
// voice/cuts.json (made by tools/align.py: the first to the last recognised word of the line, so a stray sound the
// voice model added before or after the line is dropped). Inside the window, pauses longer than PAUSE are shortened
// to PAUSE; every cut gets a short fade so nothing clicks.
const FADE = 0.012;
export function prepareVoice(reel, reelDir, out) {
  mkdirSync(out, { recursive: true });
  const vdir = join(reelDir, reel.voice.dir ?? 'voice');
  const cutsFile = join(vdir, 'cuts.json');
  if (!existsSync(cutsFile)) throw new Error(`${cutsFile} is missing: run reels/shell/tools/align.py on the clips first`);
  const cuts = JSON.parse(readFileSync(cutsFile, 'utf8'));
  const durs = {};
  for (const c of reel.cards) {
    if (!c.say) continue;
    const src = join(vdir, `${c.id}.wav`);
    if (!existsSync(src)) throw new Error(`card "${c.id}" has a spoken line but no clip at ${src}`);
    if (!cuts[c.id]) throw new Error(`card "${c.id}" has no speech window in cuts.json`);
    // 1. The speech window, with a little air at each end.
    const from = Math.max(0, cuts[c.id].start - 0.06), to = cuts[c.id].end + 0.15;
    const win = join(out, `${c.id}.window.wav`);
    run('ffmpeg', ['-loglevel', 'error', '-y', '-ss', from.toFixed(3), '-to', to.toFixed(3), '-i', src,
      '-af', `afade=t=in:d=0.015,areverse,afade=t=in:d=0.06,areverse`, '-ac', '1', '-ar', '44100', win]);
    // 2. Shorten the long pauses inside it.
    const total = duration(win);
    const log = run('ffmpeg', ['-i', win, '-af', `silencedetect=noise=-40dB:d=${PAUSE / 2}`, '-f', 'null', '-']).stderr;
    const sil = []; let open = null;
    for (const m of log.matchAll(/silence_(start|end): ([\d.]+)/g)) {
      if (m[1] === 'start') open = Number(m[2]); else if (open !== null) { sil.push([open, Number(m[2])]); open = null; }
    }
    const keep = []; let at = 0;
    for (const [s0, s1] of sil) if (s1 - s0 > PAUSE) { keep.push([at, s0 + PAUSE / 2]); at = s1 - PAUSE / 2; }
    keep.push([at, total]);
    const parts = keep.map(([x, y], i) => `[0:a]atrim=${x.toFixed(3)}:${y.toFixed(3)},asetpts=PTS-STARTPTS,` +
      `afade=t=in:d=${FADE},afade=t=out:st=${Math.max(0, y - x - FADE).toFixed(3)}:d=${FADE}[p${i}]`);
    const dst = join(out, `${c.id}.wav`);
    run('ffmpeg', ['-loglevel', 'error', '-y', '-i', win, '-filter_complex',
      `${parts.join(';')};${keep.map((_, i) => `[p${i}]`).join('')}concat=n=${keep.length}:v=0:a=1[o]`, '-map', '[o]', dst]);
    durs[c.id] = duration(dst);
  }
  return durs;
}

// Each voiced card lasts as long as its line needs (and never less than its reel.json duration if that is longer
// for a silent card); returns the new durations and where each line starts, in card order.
export function timeToVoice(reel, durs) {
  const cards = reel.cards.map((c, i) => {
    if (!(c.id in durs)) return { ...c, duration: SILENT_CARD };
    const lead = i === 0 ? LEAD_FIRST : LEAD;
    return { ...c, duration: Math.round((lead + durs[c.id] + TAIL) * 100) / 100, voiceLead: lead };
  });
  return { ...reel, cards };
}

// The voice track: every clip at its card's start plus its lead; then the ticks underneath, quieter.
export function mixSound(model, voiceDir, ticks, out) {
  const voiced = model.cards.filter(c => c.voiceLead !== undefined);
  const inputs = voiced.flatMap(c => ['-i', join(voiceDir, `${c.id}.wav`)]);
  const delays = voiced.map((c, i) => `[${i}:a]adelay=${Math.round((c.start + c.voiceLead) * 1000)}:all=1[v${i}]`);
  const n = voiced.length;
  const graph = [...delays,
    `${voiced.map((_, i) => `[v${i}]`).join('')}amix=inputs=${n}:normalize=0:duration=longest[voice]`,
    `[${n}:a]volume=0.35[t]`,
    `[voice][t]amix=inputs=2:normalize=0:duration=longest,apad=whole_dur=${model.total.toFixed(3)},atrim=0:${model.total.toFixed(3)},alimiter=limit=0.89[out]`].join(';');
  run('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-i', ticks, '-filter_complex', graph, '-map', '[out]', '-ar', '44100', '-ac', '1', out]);
}
