// The shared "premium" layer for the Data desk pieces (Mo, 2026-11-13): thin scrollbars, a reading-progress line,
// a chapter rail on long pages, smooth jumps, the readout pattern for the result of an interaction, and the chart
// crosshair styles. Each build inlines deskUICSS() after deskCSS() and deskUIJS() before its own script.
//
// Markup each page provides:
//   <section data-chapter="Short name"> ... </section>   chapters for the rail (shown when a page has 3 or more)
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
.rail{display:none}
@media (min-width:1360px){
  .rail{display:block;position:fixed;left:12px;top:50%;transform:translateY(-50%);width:2.6rem;z-index:40}
  .rail ol{list-style:none;margin:0;padding:0;display:grid;gap:.15rem}
  .rail a{display:block;padding:.3rem 0;color:var(--t-ink3);text-decoration:none;font-size:16px;line-height:1.25}
  .rail a b{font-weight:650;font-variant-numeric:tabular-nums}
  .rail a span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .rail a:hover,.rail a[aria-current="true"]{color:var(--t-ink)}
  .rail a[aria-current="true"] b{box-shadow:inset 0 -2px 0 var(--t-point)}
}
@media (min-width:1700px){
  .rail{left:max(12px,calc((100vw - 1280px)/2 - 170px));width:150px}
  .rail a{display:grid;grid-template-columns:1.6rem 1fr;align-items:baseline;gap:.25rem}
  .rail a span{position:static;width:auto;height:auto;overflow:visible;clip:auto;white-space:normal}
}
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

  // the chapter rail, from <section data-chapter="...">, when there are three or more
  var chapters = [].slice.call(document.querySelectorAll('[data-chapter]'));
  if (chapters.length >= 3) {
    var nav = document.createElement('nav'); nav.className = 'rail'; nav.setAttribute('aria-label', 'Chapters on this page');
    var ol = document.createElement('ol'); var links = [];
    chapters.forEach(function (c, i) {
      if (!c.id) c.id = 'chapter-' + (i + 1);
      var li = document.createElement('li'), a = document.createElement('a'), b = document.createElement('b');
      a.href = '#' + c.id; b.textContent = String(i + 1).padStart(2, '0'); var sp = document.createElement('span'); sp.textContent = c.getAttribute('data-chapter'); a.title = sp.textContent; a.appendChild(b); a.appendChild(sp);
      li.appendChild(a); ol.appendChild(li); links.push(a);
    });
    nav.appendChild(ol); document.body.appendChild(nav);
    var mark = function () { var at = 0; chapters.forEach(function (c, i) { if (c.getBoundingClientRect().top < innerHeight * 0.35) at = i; }); links.forEach(function (a, i) { a.setAttribute('aria-current', String(i === at)); }); };
    addEventListener('scroll', function () { requestAnimationFrame(mark); }, { passive: true }); mark();
  }

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
