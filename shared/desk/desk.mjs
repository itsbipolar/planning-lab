// The "Data desk" look shared by the rebuilt labs (2026-11-13), matching the portfolio site: the site's tokens
// (copied from mo-portfolio-site/shared/tokens.json) and its two typefaces (Source Serif 4, Source Sans 3), inlined so a page makes no request.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const b64 = (f) => readFileSync(join(here, 'fonts', f)).toString('base64');
const T = JSON.parse(readFileSync(join(here, 'tokens.json'), 'utf8'));
const vars = (p) => Object.entries(p).map(([k, v]) => `--t-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}:${v};`).join('');

export function deskCSS() {
  return `@font-face{font-family:"Source Serif 4 Variable";src:url(data:font/woff2;base64,${b64('source-serif-4-latin-opsz-normal.woff2')}) format("woff2");font-weight:200 900;font-display:swap}
@font-face{font-family:"Source Sans 3 Variable";src:url(data:font/woff2;base64,${b64('source-sans-3-latin-wght-normal.woff2')}) format("woff2");font-weight:200 900;font-display:swap}
:root,:root[data-theme="dark"]{color-scheme:dark;${vars(T.dark)}}
:root[data-theme="light"]{color-scheme:light;${vars(T.light)}}
:root{--font-display:${T.fonts.display};--font-ui:${T.fonts.ui};--font-mono:${T.fonts.ui}} /* labels use the text face too (Mo, 2026-11-13: no mono labels) */`;
}
