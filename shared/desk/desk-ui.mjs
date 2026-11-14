// The shared layer for the Data desk tools (Mo, 2026-11-13; the editorial system of redesign v2, step 2): the same
// type roles, rules, buttons, links, labels, container and readouts as the site (mo-portfolio-site src/styles/global.css),
// thin scrollbars, a reading-progress line, the chart frame and crosshair styles, and the styles of the tool shell (tool
// bar with the theme button, Up next card, notes; markup from desk-page.mjs). Each build inlines deskUICSS() after
// deskCSS() and before its own style.css (so a lab's own rule still wins until its agent deletes it), and deskUIJS()
// before its own script.
//
// Classes a tool uses (see the step 2 summary in HANDOFF.md):
//   type     .display (the H1 question) .section-hed .card-hed .lede (ink) .dek (ink2, only under a card hed)
//            .note/.fine (ink3, notes and sources) .label/.kicker (ink) .chip (ink2, ruled)
//   readout  <div class="readout" aria-live="polite"> <p class="readout-k">label</p>
//            <p class="readout-v big">figure</p> <p class="readout-t">one line</p> </div>
//            .readout-v is Source Serif 4 600 with tabular lining figures at the readout size (smaller only in a
//            .readout-row or .readouts grid, where .big keeps one figure large);
//            any element with [data-flash] gets a short ink underline whenever its text changes
//   buttons  .btn (ink fill, primary) .btn-2 (ink outline, secondary) .btn-you (amber: only the one action that makes
//            the reader's own result)
//   rules    .sec-label (a label over a 2px ink rule; no numbers) .section-top (any block opening on the 2px ink rule)
//            .callout (2px ink rule on the left) .row-rule (1px rule)
//   charts   <figure class="chart"> <figcaption><p class="chart-title">takeaway</p><p class="chart-sub">units</p>
//            <span class="chip tag-example">Example data</span></figcaption> svg... </figure>; in the SVG: .grid
//            (1px rule, crispEdges) .zero (ink) .s-named (2.5px) .s-context (1.5px) .annot (600) .leader (1px ink)
//            .shade (40% of its fill)
//   folds    <details class="deeper"><summary>Go deeper</summary>...</details>
//   .crosshair g in an SVG (a vertical line + a reading box) for hover/tap readings; see deskCrosshair() below.

export function deskUICSS() {
  return `
html{font-size:112.5%;scrollbar-width:thin;scrollbar-color:var(--t-neutral) transparent}
*::-webkit-scrollbar{width:10px;height:10px}*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{background:var(--t-neutral);border-radius:10px;border:3px solid var(--t-ground)}
*::-webkit-scrollbar-thumb:hover{background:var(--t-ink3)}*::-webkit-scrollbar-button{display:none;width:0;height:0}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
[data-chapter]{scroll-margin-top:1.25rem}
.read-progress{position:fixed;inset:0 0 auto 0;height:3px;z-index:50;pointer-events:none}
.read-progress span{display:block;height:100%;background:var(--t-ink);transform-origin:0 50%;transform:scaleX(0)}

/* One container for the site and the tools: 1360px, gutters clamp(16px,3vw,40px); text capped at 68ch, charts span. */
.desk-top,body>.page{max-width:1360px;margin-inline:auto;padding-inline:clamp(16px,3vw,40px)}
:where(body>.page) :where(p,li,dt,dd,blockquote,figcaption){max-width:68ch}

/* Type roles (tokens: --type-<role>-*, the same as the site). Sizes never go below the earlier ones (Mo). */
h1,.display{font-family:var(--type-display-font);font-weight:var(--type-display-weight);font-size:var(--type-display-size);line-height:var(--type-display-line);letter-spacing:var(--type-display-tracking);max-width:var(--type-display-measure);font-variation-settings:'opsz' var(--type-display-opsz);text-wrap:balance}
h2,.section-hed{font-family:var(--type-section-font);font-weight:var(--type-section-weight);font-size:var(--type-section-size);line-height:var(--type-section-line);letter-spacing:var(--type-section-tracking);font-variation-settings:'opsz' var(--type-section-opsz);text-wrap:balance}
.card-hed{margin:0;font-family:var(--type-card-font);font-weight:var(--type-card-weight);font-size:var(--type-card-size);line-height:var(--type-card-line);letter-spacing:var(--type-card-tracking);max-width:var(--type-card-measure);text-wrap:balance}
/* Ink, not grey: body and lede in ink; ink2 only for a dek under a card hed; ink3 only for notes and sources. */
.lede{font-family:var(--type-dek-font);font-weight:var(--type-dek-weight);font-size:var(--type-dek-size);line-height:var(--type-dek-line);color:var(--t-ink);max-width:var(--type-dek-measure)}
.dek{margin:0;font-family:var(--type-dek-font);font-weight:var(--type-dek-weight);font-size:var(--type-dek-size);line-height:var(--type-dek-line);color:var(--t-ink2);max-width:var(--type-dek-measure)}
.note,.fine{font-size:var(--type-small-size);line-height:1.5;color:var(--t-ink3)}
/* Labels (kicker, chip, nav, chart labels): Source Sans 3 700 in capitals, spaced, 17.5px or more; never faked small caps. */
.label,.kicker,.chip,.sec-label,.readout-k,.desk-next-k{font-family:var(--type-label-font);font-weight:var(--type-label-weight);font-size:var(--type-label-size);line-height:1.35;letter-spacing:var(--type-label-tracking);text-transform:uppercase}
.kicker,.label{color:var(--t-ink)}
.chip{display:inline-block;width:fit-content;padding:.2em .6em;border:1px solid var(--t-rule);border-radius:4px;color:var(--t-ink2)}

/* Links: ink with a quiet underline; on hover the highlight colour at 2px. */
a{color:inherit;text-decoration-color:color-mix(in srgb,var(--t-ink) 35%,transparent);text-decoration-thickness:1px;text-underline-offset:.2em}
a:hover{text-decoration-color:var(--t-point);text-decoration-thickness:2px}

/* Buttons (amber policy): primary ink fill, secondary ink outline; amber only for the reader's own result. */
.btn,.btn-2,.btn-you{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:48px;padding:.55rem 1.25rem;border-radius:0;font:700 1.1rem/1.2 var(--font-ui);text-decoration:none;cursor:pointer}
.btn{background:var(--t-ink);color:var(--t-ground);border:1.5px solid var(--t-ink)}
.btn-2{background:transparent;color:var(--t-ink);border:1.5px solid var(--t-ink)}
.btn-you{background:var(--t-point);color:#0e1318;border:1.5px solid var(--t-point)}
.btn:hover,.btn-2:hover,.btn-you:hover{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:.2em}
.btn:hover{text-decoration-color:var(--t-point)}

/* Rules replace ornament: sections open on a 2px ink rule (no numbers, no amber bars); rows are 1px rules. */
.sec-label{max-width:none;margin:0 0 .5rem;font-size:1.05rem;padding-top:.75rem;border-top:2px solid var(--t-ink);color:var(--t-ink)}
.sec-label>b:first-child{display:none}
.section-top{border-top:2px solid var(--t-ink);padding-top:.75rem}
.row-rule{border-top:1px solid var(--t-rule)}
.callout{border-left:2px solid var(--t-ink);padding-left:1rem}

/* The tool bar mirrors the site's masthead (Base.astro): the same container, type, 3px double ink rule and the 36px
   theme button, so going from a site page to a tool nothing jumps. Each nav link's hit area is stretched to 44px. */
.desk-head{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem 2rem;padding:1.2rem 0 1rem;line-height:1.6;border-bottom:3px double var(--t-ink)}
.desk-brand{margin-right:auto;font-family:var(--font-display);font-weight:600;font-size:1.5rem;letter-spacing:-.01em;color:var(--t-ink);text-decoration:none;white-space:nowrap}
.desk-nav ul{display:flex;flex-wrap:wrap;gap:.25rem 1.6rem;list-style:none;margin:0;padding:0}
.desk-nav a{position:relative;display:inline-block;padding:.35rem 0;font-size:16.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--t-ink);text-decoration:none;white-space:nowrap;border-bottom:2px solid transparent}
.desk-nav a::after{content:"";position:absolute;left:0;right:0;top:50%;height:44px;transform:translateY(-50%)}
.desk-nav a:hover{border-bottom-color:var(--t-rule)}
.desk-nav a[aria-current="true"]{border-bottom-color:var(--t-ink)}
/* scoped to the masthead, so a lab's own button{} rule cannot resize it */
.desk-head .desk-theme{position:relative;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:36px;height:36px;min-width:0;min-height:0;padding:0;border:1.5px solid var(--t-ink3);border-radius:50%;box-shadow:none;background:transparent;color:var(--t-ink);font:inherit;cursor:pointer}
.desk-head .desk-theme::after{content:"";position:absolute;left:50%;top:50%;width:44px;height:44px;transform:translate(-50%,-50%)}
.desk-head .desk-theme[hidden]{display:none}
.desk-head .desk-theme svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.desk-head .desk-theme:hover{border-color:var(--t-ink);background:transparent;color:var(--t-ink)}
.desk-head .desk-theme[aria-pressed="true"] .i-moon,.desk-head .desk-theme[aria-pressed="false"] .i-sun{display:none}
@media (max-width:959px){.desk-head{column-gap:.75rem;row-gap:.2rem;padding:.5rem 0 .2rem}.desk-head .desk-theme{order:2}.desk-nav{order:3;width:100%}.desk-nav ul{flex-wrap:nowrap;gap:.5rem 1.6rem}.desk-nav a{padding:.15rem 0}}
@media (max-width:560px){.desk-nav ul{justify-content:space-between;gap:.5rem}.desk-nav a{letter-spacing:.03em}}
@media (max-width:420px){.desk-head{column-gap:.5rem}.desk-brand{font-size:1.1rem}}
.desk-toolnav{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0 1.5rem;padding:.2rem 0;font-size:17.5px;border-bottom:1px solid var(--t-rule)}
.desk-toolnav a{display:inline-flex;align-items:center;gap:.35rem;min-height:2.5rem;color:var(--t-ink);text-decoration:none;white-space:nowrap}
.desk-toolnav a:hover{text-decoration:underline}
.desk-next{display:grid;grid-template-columns:1fr auto;align-items:end;gap:.35rem 1.5rem;margin:4rem 0 0;padding:1.4rem 1.5rem 1.5rem;border:1px solid var(--t-rule);border-top:2px solid var(--t-ink);background:var(--t-raised);color:var(--t-ink);text-decoration:none}
.desk-next-k{grid-column:1/-1;color:var(--t-ink)}
.desk-next-q{font-family:var(--font-display);font-weight:600;font-size:clamp(1.55rem,1.4vw + 1.1rem,2.3rem);line-height:1.15;letter-spacing:-.01em;text-wrap:balance}
.desk-next-go{font-family:var(--font-display);font-size:2rem;line-height:1}
.desk-next:hover,.desk-next:focus-visible{outline:2px solid var(--t-ink);outline-offset:4px}
.desk-next:hover .desk-next-q{text-decoration:underline;text-underline-offset:.2em;text-decoration-thickness:2px;text-decoration-color:var(--t-point)}
.desk-notes{margin:0}

/* Readouts: the answer next to the control that made it. A desk callout (2px ink rule), a label, the figure in Source
   Serif 4 600 with tabular lining figures (the sans has no tnum), one line under it. */
.readout{border-left:2px solid var(--t-ink);padding:.35rem 0 .35rem 1rem;margin:1rem 0;max-width:46rem}
.readout-k{margin:0;color:var(--t-ink)}
/* Every readout figure is the readout role (redesign v2 section 6), so the eye lands on the answer in every tool; only
   figures that share a row with others (.readout-row, a .readouts grid) stay at the smaller size, unless .big. */
.readout-v,.readout-big{margin:.15rem 0 .1rem;font-family:var(--type-readout-font);font-weight:var(--type-readout-weight);font-size:var(--type-readout-size);line-height:var(--type-readout-line);font-variant-numeric:tabular-nums lining-nums;color:var(--t-ink);overflow-wrap:anywhere}
.readout-row .readout-v:not(.big),.readouts .readout-v:not(.big){font-size:clamp(1.6rem,1.2vw + 1.1rem,2.2rem);line-height:1.1}
.readout-t{margin:0;font-size:1.05rem;line-height:1.5;color:var(--t-ink)}
.readout-fine{margin:.35rem 0 0;font-size:17.5px;color:var(--t-ink3)}
[data-flash]{transition:box-shadow .25s ease}
[data-flash].flash{box-shadow:inset 0 -2px 0 var(--t-ink)}
@media (prefers-reduced-motion:reduce){[data-flash]{transition:none}}

/* The chart frame: a 2px ink rule on top, a sans 700 title that states the takeaway, an ink2 subtitle with units, and
   an "Example data" chip where the numbers are illustrative. Inside the SVG: 1px gridlines, an ink zero line, named
   series 2.5px and context series 1.5px, one 600 annotation with a 1px leader, shaded regions at 40%. Every label
   renders at 16.5px or more (shell-test.mjs expectTextSizes). */
figure.chart{margin:2rem 0 0;border-top:2px solid var(--t-ink);padding-top:.6rem}
figure.chart>figcaption,.chart-head{margin:0 0 .6rem}
.chart-title{margin:0;font:700 1.15rem/1.35 var(--font-ui);color:var(--t-ink)}
.chart-sub{margin:.15rem 0 0;font-size:1.03rem;line-height:1.45;color:var(--t-ink2)}
.tag-example{margin-top:.4rem}
.chart svg .grid{stroke:var(--t-rule);stroke-width:1;shape-rendering:crispEdges}
.chart svg .zero{stroke:var(--t-ink);stroke-width:1;shape-rendering:crispEdges}
.chart svg .s-named{stroke-width:2.5;fill:none}
.chart svg .s-context{stroke-width:1.5;fill:none}
.chart svg .annot{font-weight:600}
.chart svg .leader{stroke:var(--t-ink);stroke-width:1}
.chart svg .shade{fill-opacity:.4}

/* Folds: "Go deeper" and the sources, closed by default. */
details.deeper{margin-top:3rem;border-top:2px solid var(--t-ink);padding-top:.5rem}
/* Every fold shows that it opens: a chevron before its summary (a lab's display:flex summary hides the browser marker). */
details>summary{list-style:none}
details>summary::-webkit-details-marker{display:none}
details>summary::before{content:"";display:inline-block;flex:none;width:.45em;height:.45em;margin:0 .7em 0 .1em;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-.15em) rotate(-45deg)}
details[open]>summary::before{transform:translateY(-.3em) rotate(45deg)}
@media (prefers-reduced-motion:no-preference){details>summary::before{transition:transform .15s ease}}
details.deeper>summary{display:flex;align-items:center;min-height:44px;cursor:pointer;font-family:var(--type-label-font);font-weight:var(--type-label-weight);font-size:var(--type-label-size);letter-spacing:var(--type-label-tracking);text-transform:uppercase}

/* Video tiles: the 56px ink play badge and the duration chip (as on the site). */
.play-badge{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:rgb(16 22 28 / .88);color:#fff;border:0}
.dur-chip{display:inline-block;padding:.15em .5em;font:700 17px/1.3 var(--font-display);font-variant-numeric:tabular-nums lining-nums;color:#fff;background:rgb(0 0 0 / .72)}

.crosshair{pointer-events:none}
.crosshair line{stroke:var(--t-ink);stroke-width:1;stroke-dasharray:3 3}
.crosshair rect{fill:var(--t-raised);stroke:var(--t-rule)}
.crosshair text{fill:var(--t-ink);font-family:var(--font-display);font-variant-numeric:tabular-nums lining-nums}
`;
}

export function deskUIJS() {
  return `
(function () {
  'use strict';
  // the reading-progress line, on pages at least two screens long
  var bar = document.createElement('div'); bar.className = 'read-progress'; bar.setAttribute('aria-hidden', 'true');
  bar.appendChild(document.createElement('span')); document.body.appendChild(bar);
  var queued = false;
  function progress() { queued = false; var room = document.documentElement.scrollHeight - innerHeight; bar.hidden = room < innerHeight; bar.firstChild.style.transform = 'scaleX(' + (room > 0 ? Math.min(1, scrollY / room) : 0) + ')'; }
  addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(progress); } }, { passive: true });
  addEventListener('resize', progress); addEventListener('load', progress); progress();

  // a short ink underline on any [data-flash] element whose text changes
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var watch = function (el) {
    var last = el.textContent;
    new MutationObserver(function () { if (el.textContent === last) return; last = el.textContent; if (still) return; el.classList.add('flash'); clearTimeout(el._f); el._f = setTimeout(function () { el.classList.remove('flash'); }, 1100); }).observe(el, { childList: true, characterData: true, subtree: true });
  };
  [].forEach.call(document.querySelectorAll('[data-flash]'), watch);
  window.deskWatchFlash = watch;
})();

// A chart crosshair: call deskCrosshair(svg, { x0, x1, y0, y1, read: function (px) { return { x: px, y: py, lines: ['...'] } } })
// with the plot area in SVG units; it draws a dashed line and a reading box that follow the pointer (and arrow keys when
// the SVG has focus). Returns a function that removes it (call before a redraw).
function deskCrosshair(svg, o) {
  var NS = 'http://www.w3.org/2000/svg', g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'crosshair'); g.style.display = 'none';
  var line = document.createElementNS(NS, 'line'), box = document.createElementNS(NS, 'rect'), txt = document.createElementNS(NS, 'text');
  g.appendChild(line); g.appendChild(box); g.appendChild(txt); svg.appendChild(g);
  function toSvg(e) { var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal; var sx = vb && vb.width ? vb.width / r.width : 1; return (e.clientX - r.left) * sx + (vb ? vb.x : 0); }
  function show(px) {
    px = Math.max(o.x0, Math.min(o.x1, px)); var r = o.read(px); if (!r) { g.style.display = 'none'; return; }
    g.style.display = ''; line.setAttribute('x1', r.x); line.setAttribute('x2', r.x); line.setAttribute('y1', o.y0); line.setAttribute('y2', o.y1);
    while (txt.firstChild) txt.removeChild(txt.firstChild);
    r.lines.forEach(function (s, i) { var t = document.createElementNS(NS, 'tspan'); t.setAttribute('x', 0); t.setAttribute('dy', i ? '1.25em' : '1em'); if (!i) t.setAttribute('font-weight', '650'); t.textContent = s; txt.appendChild(t); });
    var bb = txt.getBBox(), pad = 6, w = bb.width + pad * 2, h = bb.height + pad * 2, bx = r.x + 10; if (bx + w > o.x1) bx = r.x - 10 - w; if (bx < o.x0) bx = Math.min(o.x0, o.x1 - w);
    var by = Math.max(o.y0, Math.min(o.y1 - h, (r.y || o.y0) - h - 8));
    box.setAttribute('x', bx); box.setAttribute('y', by); box.setAttribute('width', w); box.setAttribute('height', h); box.setAttribute('rx', 2);
    txt.setAttribute('transform', 'translate(' + (bx + pad) + ',' + (by + pad) + ')'); [].forEach.call(txt.childNodes, function (t) { t.setAttribute('x', 0); });
  }
  function move(e) { show(toSvg(e)); } function hide() { g.style.display = 'none'; }
  svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move); svg.addEventListener('pointerleave', hide);
  return function () { svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerdown', move); svg.removeEventListener('pointerleave', hide); if (g.parentNode) g.parentNode.removeChild(g); };
}
`;
}
