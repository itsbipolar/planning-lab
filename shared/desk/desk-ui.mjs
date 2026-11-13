// The shared "premium" layer for the Data desk pieces (Mo, 2026-11-13): thin scrollbars, a reading-progress line,
// smooth jumps, the readout pattern for the result of an interaction, the chart crosshair styles, and the styles of the
// tool shell (tool bar, Up next card, notes; markup from desk-page.mjs). Each build inlines deskUICSS() after deskCSS()
// and deskUIJS() before its own script. The numbered chapter rail is gone (redesign v2: nothing sticky, no unlabelled
// side rail); <section data-chapter> stays as a plain marker.
//
// Markup each page provides:
//   <div class="readout" data-readout> <p class="readout-k">label</p> <p class="readout-v">big value</p>
//     <p class="readout-t">one sentence on what it means</p> </div>   the answer next to the control that made it;
//     any element inside with [data-flash] gets a short amber underline whenever its text changes
//   <p class="sec-label"><b>01</b>Section name</p>   the numbered signpost above a section's headline (as on the site)
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
.read-progress span{display:block;height:100%;background:var(--t-point);transform-origin:0 50%;transform:scaleX(0)}
/* The tool bar mirrors the site's masthead (Base.astro): the same container (80rem, 20px gutters, 40px from 1100px),
   the same padding, type and rule, so going from a site page to a tool nothing jumps. Each nav link's hit area is
   stretched to a 44px target without moving its underline. */
.desk-top{max-width:80rem;margin:0 auto;padding:0 20px}
@media (min-width:1100px){.desk-top{padding:0 40px}}
.desk-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.75rem 2rem;padding:1.4rem 0 1.2rem;line-height:1.6;border-bottom:1px solid var(--t-rule)}
.desk-brand{margin-right:auto;font-family:var(--font-display);font-weight:600;font-size:1.35rem;letter-spacing:-.01em;color:var(--t-ink);text-decoration:none;white-space:nowrap}
.desk-nav ul{display:flex;flex-wrap:wrap;gap:.25rem 1.6rem;list-style:none;margin:0;padding:0}
.desk-nav a{position:relative;display:inline-block;padding:.35rem 0;font-size:16.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--t-ink);text-decoration:none;white-space:nowrap;border-bottom:2px solid transparent}
.desk-nav a::after{content:"";position:absolute;left:0;right:0;top:50%;height:44px;transform:translateY(-50%)}
.desk-nav a:hover{border-bottom-color:var(--t-rule)}
.desk-nav a[aria-current="true"]{border-bottom-color:var(--t-point)}
@media (max-width:959px){.desk-head{column-gap:.75rem;row-gap:.2rem;padding:.5rem 0 .2rem;align-items:center}.desk-nav{width:100%}.desk-nav ul{flex-wrap:nowrap;gap:.5rem 1.6rem}.desk-nav a{padding:.15rem 0}}
@media (max-width:560px){.desk-nav ul{justify-content:space-between;gap:.5rem}.desk-nav a{letter-spacing:.02em}}
@media (max-width:420px){.desk-head{column-gap:.5rem}.desk-brand{font-size:1.1rem}}
.desk-toolnav{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0 1.5rem;padding:.2rem 0;font-size:17px;border-bottom:1px solid var(--t-rule)}
.desk-toolnav a{display:inline-flex;align-items:center;gap:.35rem;min-height:2.5rem;color:var(--t-ink);text-decoration:none;white-space:nowrap}
.desk-toolnav a:hover{text-decoration:underline}
.desk-toolnav .desk-made{color:var(--t-ink2)}
.desk-next{display:grid;grid-template-columns:1fr auto;align-items:end;gap:.35rem 1.5rem;margin:4rem 0 0;padding:1.4rem 1.5rem 1.5rem;border:1px solid var(--t-rule);border-top:3px solid var(--t-point);background:var(--t-raised);color:var(--t-ink);text-decoration:none}
.desk-next-k{grid-column:1/-1;font-size:17px;font-weight:650;letter-spacing:.05em;text-transform:uppercase;color:var(--t-ink2)}
.desk-next-q{font-family:var(--font-display);font-weight:600;font-size:clamp(1.55rem,1.4vw + 1.1rem,2.3rem);line-height:1.15;letter-spacing:-.01em;text-wrap:balance}
.desk-next-go{font-family:var(--font-display);font-size:2rem;line-height:1}
.desk-next:hover,.desk-next:focus-visible{outline:2px solid var(--t-ink);outline-offset:4px}
.desk-next:hover .desk-next-q{text-decoration:underline;text-underline-offset:5px;text-decoration-thickness:2px}
.desk-notes{margin:0}
.sec-label{position:relative;margin:0 0 .5rem;padding-top:.9rem;font-size:1.05rem;font-weight:650;color:var(--t-ink2);font-variant-numeric:tabular-nums}
.sec-label::before{content:"";position:absolute;top:0;left:0;width:3rem;height:3px;background:var(--t-point)}
.sec-label b{color:var(--t-ink);margin-right:.5rem;letter-spacing:.04em}
.readout{border-left:3px solid var(--t-point);padding:.35rem 0 .35rem 1rem;margin:1rem 0;max-width:46rem}
.readout-k{margin:0;font-size:17px;font-weight:650;color:var(--t-ink3)}
.readout-v{margin:.15rem 0 .1rem;font-family:var(--font-display);font-weight:600;font-size:clamp(1.6rem,1.2vw + 1.1rem,2.2rem);line-height:1.1;font-variant-numeric:tabular-nums;color:var(--t-ink)}
.readout-t{margin:0;font-size:1.05rem;line-height:1.5;color:var(--t-ink)}
.readout-fine{margin:.35rem 0 0;font-size:17px;color:var(--t-ink3)}
[data-flash]{transition:box-shadow .25s ease}
[data-flash].flash{box-shadow:inset 0 -3px 0 var(--t-point)}
@media (prefers-reduced-motion:reduce){[data-flash]{transition:none}}
.crosshair{pointer-events:none}
.crosshair line{stroke:var(--t-ink);stroke-width:1;stroke-dasharray:3 3}
.crosshair rect{fill:var(--t-raised);stroke:var(--t-rule)}
.crosshair text{fill:var(--t-ink);font-variant-numeric:tabular-nums}
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

  // a short amber underline on any [data-flash] element whose text changes
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
    var bb = txt.getBBox(), pad = 6, w = bb.width + pad * 2, h = bb.height + pad * 2, bx = r.x + 10; if (bx + w > o.x1) bx = r.x - 10 - w;
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
