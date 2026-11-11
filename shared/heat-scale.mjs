// The P5 heatmaps' shared colour scale (Mo, 2026-11-11: "C: Blue into green", one scale for P5a, P5b and P5c).
// Fewer is deep blue, more is pale green in dark mode; light mode runs the other way in lightness (pale green to deep blue),
// so "more" is always the stronger contrast with the page. Both ends are house colours (the Money Stripes blue and the
// "money" green); the steps are mixed in OKLab. heatCSS(n) writes classes .h0 to .h{n-1} for both schemes.
export const HEAT_STOPS = {
  dark: ['#1B2A3A', '#1F689D', '#3E9A8C', '#9CCB8A', '#E8F5D8'],
  light: ['#EEF5F2', '#9CCB8A', '#3E9A8C', '#1F689D', '#0E3A5C'],
};
export const HEAT_STEPS = 24;

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
export function heatColour(t, scheme = 'dark') {
  const labs = HEAT_STOPS[scheme].map(toLab), x = Math.min(1, Math.max(0, t)) * (labs.length - 1), i = Math.min(labs.length - 2, Math.floor(x)), f = x - i;
  return toHex(labs[i].map((v, k) => v + (labs[i + 1][k] - v) * f));
}
export function heatCSS(n = HEAT_STEPS) {
  const rows = [];
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    rows.push(`.h${k}{fill:${heatColour(t, 'dark')}}`, `:root[data-theme="light"] .h${k}{fill:${heatColour(t, 'light')}}`);
  }
  return rows.join('\n');
}
