// The tool shell every public tool shares (redesign v2, step 1): the tool bar at the top (the site's wordmark and nav,
// "← All tools" and a quiet "How I made this"), exactly one Up next card near the foot, the education and AI notes, and
// the share-card and canonical tags in <head>. Run at build time: deskPage(html, labSlug) fills the three markers each
// tool's index.src.html carries and refuses to build if one is missing or doubled.
//
//   <!--@@TOOLBAR@@-->   where the tool bar goes (first thing in <body>, before .page: it keeps the site's container)
//   <!--@@NEXT@@-->      where the Up next card goes (just before the page foot)
//   <!--@@NOTES@@-->     the education line and the AI note (inside the foot)
//
// The nav, the origin and the notes come from site-nav.json; the chain and the questions from next.json. The styles are
// in deskUICSS() (desk-ui.mjs), which every build already inlines.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SITE = JSON.parse(readFileSync(join(here, 'site-nav.json'), 'utf8'));
const NEXT = JSON.parse(readFileSync(join(here, 'next.json'), 'utf8'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The public tool a lab builds, or null if the lab is not a public tool. */
export function toolFor(labSlug) {
  return NEXT.tools.find((t) => t.labSlug === labSlug) || null;
}

export function toolBar(tool) {
  const nav = SITE.nav.map((n) => `<li><a href="${esc(n.href)}"${n.href === '/tools/' ? ' aria-current="true"' : ''}>${esc(n.label)}</a></li>`).join('');
  return `<div class="desk-top">
  <header class="desk-head">
    <a class="desk-brand" href="/">${esc(SITE.wordmark)}</a>
    <nav class="desk-nav" aria-label="Main"><ul>${nav}</ul></nav>
  </header>
  <nav class="desk-toolnav" aria-label="This tool">
    <a href="/tools/"><span aria-hidden="true">←</span> All tools</a>
    <a class="desk-made" href="/tools/${esc(tool.slug)}/how-i-made-it/">How I made this</a>
  </nav>
  </div>`;
}

export function upNext(tool) {
  const next = NEXT.tools.find((t) => t.slug === tool.next);
  if (!next) throw new Error(`next.json: ${tool.slug} points to ${tool.next}, which is not a tool`);
  return `<a class="desk-next" data-next href="/tools/${esc(next.slug)}/"><span class="desk-next-k">Up next</span><span class="desk-next-q">${esc(next.question)}</span><span class="desk-next-go" aria-hidden="true">→</span></a>`;
}

export function notes() {
  return `<p class="desk-notes"><strong>${esc(SITE.footerNote)}</strong> ${esc(SITE.aiNote)}</p>`;
}

function headTags(html, tool) {
  const url = `${SITE.origin}/tools/${tool.slug}/`;
  const m = html.match(/<meta name="description" content="([^"]*)">/);
  if (!m) throw new Error(`${tool.labSlug}: index.src.html needs a <meta name="description">`);
  return [
    `<link rel="canonical" href="${esc(url)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:title" content="${esc(tool.question)}">`,
    `<meta property="og:description" content="${m[1]}">`,
    `<meta property="og:image" content="${esc(`${SITE.origin}/og/tools/${tool.slug}.png`)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n');
}

const once = (html, marker, what) => {
  const n = html.split(marker).length - 1;
  if (n !== 1) throw new Error(`${what}: expected one ${marker}, found ${n}`);
};

/** Fills the tool shell into a built page. */
export function deskPage(html, labSlug) {
  const tool = toolFor(labSlug);
  if (!tool) throw new Error(`${labSlug} is not a public tool in shared/desk/next.json`);
  for (const m of ['<!--@@TOOLBAR@@-->', '<!--@@NEXT@@-->', '<!--@@NOTES@@-->', '</head>']) once(html, m, labSlug);
  if (/data-next/.test(html)) throw new Error(`${labSlug}: data-next is reserved for the one Up next card`);
  const out = html
    .replace('</head>', () => headTags(html, tool) + '\n</head>')
    .replace('<!--@@TOOLBAR@@-->', () => toolBar(tool))
    .replace('<!--@@NEXT@@-->', () => upNext(tool))
    .replace('<!--@@NOTES@@-->', () => notes());
  if ((out.match(/data-next/g) || []).length !== 1) throw new Error(`${labSlug}: expected exactly one data-next`);
  return out;
}

export { SITE, NEXT };
