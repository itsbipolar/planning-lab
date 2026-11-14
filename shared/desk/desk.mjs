// The "Data desk" look shared by the rebuilt labs (2026-11-13), matching the portfolio site: the site's tokens and type
// roles (copied from mo-portfolio-site/shared/tokens.json) and its two typefaces (Source Serif 4, Source Sans 3), inlined so a page makes no request.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const b64 = (f) => readFileSync(join(here, 'fonts', f)).toString('base64');
const T = JSON.parse(readFileSync(join(here, 'tokens.json'), 'utf8'));
const vars = (p) => Object.entries(p).map(([k, v]) => `--t-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}:${v};`).join('');
// Type roles (redesign v2 section 6) -> --type-<role>-<prop>, the same names the site's tokens.css carries.
const fam = { display: 'var(--font-display)', ui: 'var(--font-ui)' };
const typeVars = () => Object.entries(T.type).filter(([k]) => !k.startsWith('_')).map(([role, r]) => [
  r.family && `--type-${role}-font:${fam[r.family]};`, r.weight && `--type-${role}-weight:${r.weight};`, r.size && `--type-${role}-size:${r.size};`,
  r.line && `--type-${role}-line:${r.line};`, r.tracking && `--type-${role}-tracking:${r.tracking};`, r.measure && `--type-${role}-measure:${r.measure};`,
  r.opsz && `--type-${role}-opsz:${r.opsz};`].filter(Boolean).join('')).join('');

// The price-stripes ramp (redesign v2, "Stripes ramp"): its six stops per scheme as --t-stripe-0..5 ("neutral" is the
// scheme's neutral token) and the yearly price changes they sit at as --stripe-at, so a tool draws the site's ramp.
const stripeVars = (scheme) => T.stripes[scheme].map((c, i) => `--t-stripe-${i}:${c === 'neutral' ? T[scheme].neutral : c};`).join('');

export function deskCSS() {
  return `@font-face{font-family:"Source Serif 4 Variable";src:url(data:font/woff2;base64,${b64('source-serif-4-latin-opsz-normal.woff2')}) format("woff2");font-weight:200 900;font-display:swap}
@font-face{font-family:"Source Sans 3 Variable";src:url(data:font/woff2;base64,${b64('source-sans-3-latin-wght-normal.woff2')}) format("woff2");font-weight:200 900;font-display:swap}
:root,:root[data-theme="dark"]{color-scheme:dark;${vars(T.dark)}${stripeVars('dark')}}
:root[data-theme="light"]{color-scheme:light;${vars(T.light)}${stripeVars('light')}}
:root{--font-display:${T.fonts.display};--font-ui:${T.fonts.ui};--font-mono:${T.fonts.ui};--stripe-at:${T.stripes.at.join(' ')};${typeVars()}} /* labels use the text face too (Mo, 2026-11-13: no mono labels) */`;
}
