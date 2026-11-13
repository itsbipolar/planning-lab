// The heatmap's colour steps: one hue (the desk's d1 blue), sequential, mixed in OKLab from the page's ground. Dark: few
// people is close to the ground, many is pale blue. Light: few is a pale tint, many is deep blue. Written at build as
// classes .q0 to .q{n-1} for both schemes, so switching data-theme recolours the chart without redrawing it.
import { readFileSync } from 'node:fs';

const T = JSON.parse(readFileSync(new URL('../../shared/desk/tokens.json', import.meta.url), 'utf8'));
export const STEPS = 24;
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function toLab(h) {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function toHex([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, gam(c))) * 255).toString(16).padStart(2, '0')).join('');
}
export const mix = (a, b, t) => { const p = toLab(a), q = toLab(b); return toHex(p.map((v, k) => v + (q[k] - v) * t)); };
export const STOPS = {
  dark: [mix(T.dark.ground, T.dark.d1, 0.16), mix(T.dark.ground, T.dark.d1, 0.55), T.dark.d1, mix(T.dark.d1, '#FFFFFF', 0.62)],
  light: [mix(T.light.ground, T.light.d1, 0.08), mix(T.light.ground, T.light.d1, 0.45), T.light.d1, mix(T.light.d1, T.light.ink, 0.55)],
};
export function colour(t, scheme) {
  const s = STOPS[scheme], x = Math.min(1, Math.max(0, t)) * (s.length - 1), i = Math.min(s.length - 2, Math.floor(x));
  return mix(s[i], s[i + 1], x - i);
}
export function scaleCSS(n = STEPS) {
  const out = [];
  for (const [scheme, sel] of [['dark', ':root'], ['light', ':root[data-theme="light"]']]) {
    for (let k = 0; k < n; k++) { const c = colour(k / (n - 1), scheme); out.push(`${sel} .q${k}{fill:${c};background:${c}}`); }
  }
  return out.join('\n');
}
