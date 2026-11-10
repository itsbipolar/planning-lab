// Code-made sound for a reel: a soft paper flick on each page turn and a tick as the page lands,
// built with ZzFX (MIT, Frank Force) and written as one WAV the length of the reel. Deterministic:
// ZzFX's own randomness is off and its noise uses a seeded generator.
import { writeFileSync } from 'node:fs';

const RATE = 44100;
let ZZFX;
async function zz() {
  if (ZZFX) return ZZFX;
  globalThis.AudioContext ??= class { constructor() { this.sampleRate = RATE; } }; // ZzFX makes a context on import; Node has none
  ({ ZZFX } = await import('zzfx'));
  ZZFX.sampleRate = RATE;
  return ZZFX;
}
function seeded(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ZzFX parameter lists: [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, ...]
const FLICK = [0.5, 0, 260, 0.01, 0.04, 0.16, 4, 1.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.02];
const TICK = [0.7, 0, 1500, 0, 0.004, 0.035, 1, 1.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0];

export async function buildTicks(turnTimes, total, landing, out) {
  const Z = await zz();
  const rnd = Math.random; Math.random = seeded(7);
  const flick = Z.buildSamples(...FLICK), tick = Z.buildSamples(...TICK);
  Math.random = rnd;
  const mix = new Float32Array(Math.ceil(total * RATE));
  const add = (s, at, gain) => { const o = Math.round(at * RATE); for (let i = 0; i < s.length && o + i < mix.length; i++) mix[o + i] += s[i] * gain; };
  for (const t of turnTimes) { add(flick, t, 0.55); add(tick, t + landing, 0.6); }
  let peak = 0; for (const v of mix) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? 0.5 / peak : 1; // peak at about -6 dBFS
  const pcm = Buffer.alloc(44 + mix.length * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + mix.length * 2, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(RATE, 24);
  pcm.writeUInt32LE(RATE * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(mix.length * 2, 40);
  mix.forEach((v, i) => pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * g * 32767))), 44 + i * 2));
  writeFileSync(out, pcm);
  return { peak, samples: mix.length };
}
