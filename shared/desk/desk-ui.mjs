// The shared layer for the Data desk tools (Mo; the editorial system of redesign v2, step 2, and the desk tool template
// of steps 4 to 6): the same type roles, rules, buttons, links, labels, container and readouts as the site
// (mo-portfolio-site src/styles/global.css), thin scrollbars, a reading-progress line, the chart frame and crosshair
// styles, the styles of the tool shell (tool bar with the theme button and the year chip, Up next card, notes; markup
// from desk-page.mjs), and the template helpers below. Each build inlines deskUICSS() after deskCSS() and before its own
// style.css (so a lab's own rule still wins until its agent deletes it), and deskUIJS() before its own script.
//
// Classes a tool uses (see the step 2 summary in HANDOFF.md):
//   type     .display (the H1 question) .section-hed .card-hed .lede (ink) .dek (ink2, only under a card hed)
//            .note/.fine (ink3, notes and sources) .label/.kicker (ink) .chip (ink2, ruled)
//   buttons  .btn (ink fill, primary) .btn-2 (ink outline, secondary) .btn-you (amber: only the one action that makes
//            the reader's own result)
//   rules    .sec-label (a label over a 2px ink rule; no numbers) .section-top (any block opening on the 2px ink rule)
//            .callout (2px ink rule on the left) .row-rule (1px rule)
//   charts   <figure class="chart"> <figcaption><p class="chart-title">takeaway</p><p class="chart-sub">units</p>
//            <span class="chip tag-example">Example data</span></figcaption> svg... </figure>; in the SVG: .grid
//            (1px rule, crispEdges) .zero (ink) .s-named (2.5px) .s-context (1.5px) .annot (600) .leader (1px ink)
//            .shade (40% of its fill)
//   .crosshair g in an SVG (a vertical line + a reading box) for hover/tap readings; see deskCrosshair() below.
//   any element with [data-flash] gets a short ink underline whenever its text changes.
//
// THE DESK TOOL TEMPLATE (redesign v2 section 5, in page order): tool bar; a question H1; one dominant control marked
// [data-first-move] (top <= 700px at 390); the big readout [data-answer]; at most one chart above the fold; one
// assumptions line [data-assumptions] by the first control; the closed Go deeper fold; Sources; the Up next card. The
// Playwright budget check is expectTemplate() in shell-test.mjs. The pieces:
//
// 1. Readout (the big answer, the one peak of the page):
//      <div class="readout" data-answer aria-live="polite">
//        <p class="readout-k">Label, 6 words or fewer</p>
//        <p class="readout-v big" data-readout-v>$1,234</p>
//        <p class="readout-t" data-readout-t>One line, 14 words or fewer.</p>
//        <details class="readout-how"><summary>How this is worked out</summary><p>...</p></details>
//      </div>
//    var r = deskReadout(el, { format: function (n) { return ... } });   el: the element or a selector
//    r.set({ n: 1234 })            a number: formatted with format; counts up over 300ms from the last number, only
//                                  when the visitor acted in the last 1.5s (deskActed()) and never under reduced motion
//    r.set({ text: 'Closed' })      a word answer: written at once
//    r.set({ n, line, label, animate: false })   line and label replace the one line and the label; animate:false
//                                  writes at once. The region is aria-live polite and aria-atomic; every set() marks it
//                                  aria-busy until 250ms after the last change (and the count-up's end), so a screen
//                                  reader hears the final answer once, not every step of a drag. Returns { set, el }.
//
// 2. Go deeper (closed): <details class="deeper"><summary>Go deeper</summary> <section class="deeper-sub"><h3>A</h3>
//    ...</section> ...</details>. With 2 or more .deeper-sub sections (or direct <section> children), deskDeeper() adds
//    <span class="fold-p deeper-in">A · B · C</span> inside the summary, a preview shown while the fold is closed (plain
//    text: no hash links, the address stays clean). Any fold (.deeper, .sources, .fold, .this-year) may set its own
//    preview in data-preview. It runs once on load; call deskDeeper() again after adding sections. deeperPreview(titles)
//    is the line. Every such fold shares one style and one gap (the CSS below).
//
// 3. Assumptions, said once: exactly one <p class="assume" data-assumptions>...</p> per tool, beside the first control
//    (the tool's assumptions in plain words, labelled as an example where the numbers are). deskPage() refuses a page
//    with two; expectTemplate() wants exactly one. Every chart with illustrative numbers carries the tag
//    <span class="chip tag-example">Example data</span> (set in capitals: EXAMPLE DATA) in its figcaption;
//    deskExampleTag(figure) adds it to a chart drawn at run time (once).
//
// 4. Save and share, made in the browser, nothing uploaded:
//    deskSaveFile({ blob, name, title }) -> Promise<{ via: 'share' | 'download' | 'cancelled', inApp, notice }>
//      navigator.share({ files }) when navigator.canShare says it can, else (or if share is refused) a download link.
//      inApp is 'Instagram', 'LinkedIn', 'Facebook' or null (inAppBrowser(navigator.userAgent)); notice is
//      IN_APP_NOTICE in those in-app browsers, else null.
//    deskSaveButton(button, make) wires a button: make() returns { blob, name, title } (or a promise of it); in an
//      in-app browser it shows <span class="save-note" role="note">Open this page in Safari or Chrome to save the
//      file.</span> right after the button.
//    deskCard({ question, bigValue, line, labels, draw }) -> Promise<Blob>: "Save my card", a 1080x1350 PNG drawn in a
//      canvas in the page's current theme: the question (serif), the big value (serif, shrunk to fit), the one line, up
//      to three labels as chips, an optional draw(ctx, { x, y, w, h }, colours) for a small chart, and the foot stamped
//      CARD_STAMP ("Example · Education, not advice") with the site address (site-nav.json origin, no https).
//    deskSaveCard(o) = deskCard(o) then deskSaveFile({ blob, name: o.name || 'my-card.png', title: o.question }).
//
// 5. Guess, then reveal (always skippable, shown only after the first result):
//      var g = deskGuess(host, { question, min, max, step, start, format, answer: function () { return n; },
//                                reveal: function (guess, answer) { return 'one line'; }, onDone: function (r) {} });
//    host is an empty element (or selector); it is filled with a kicker "Guess first", the question, a range slider
//    with its value in serif figures, Reveal (.btn) and Skip (.btn-2), and an aria-live line for the reveal. It stays
//    hidden until the tool calls g.show() after its first result; Reveal writes reveal(guess, answer()) and locks the
//    slider; Skip hides it and moves focus to [data-answer]. onDone gets { guess, answer, skipped }. Returns
//    { show, el }.
//
// 6. The tool-bar year chip (desk-page.mjs, on pages that carry <!--@@YEAR@@-->): "Born {year} · change · forget" when
//    sessionStorage mo.year holds a 4-digit year; "change" focuses the page's [data-year-control]; "forget" removes the
//    key and reloads to the example. A page that sets the year later calls deskYearChip() to show it. Never in the URL.
//
// 7. Motion: every transition and animation is instant under prefers-reduced-motion (one rule below); the count-up
//    runs only after the visitor acts. expectReducedMotion() in shell-test.mjs checks a tool.

import { SITE } from './desk-page.mjs';

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
.desk-nav a{position:relative;display:inline-block;padding:.35rem 0;font-size:17.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--t-ink);text-decoration:none;white-space:nowrap;border-bottom:2px solid transparent}
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
.desk-next{display:grid;grid-template-columns:1fr auto;align-items:end;gap:.35rem 1.5rem;margin:2.5rem 0 0;padding:1.4rem 1.5rem 1.5rem;border:1px solid var(--t-rule);border-top:2px solid var(--t-ink);background:var(--t-raised);color:var(--t-ink);text-decoration:none}
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
   renders at 17.5px or more (shell-test.mjs expectTextSizes). */
figure.chart{margin:2rem 0 0;border-top:2px solid var(--t-ink);padding-top:.6rem}
figure.chart>figcaption,.chart-head{margin:0 0 .6rem}
.chart-title{margin:0;font:700 1.15rem/1.35 var(--font-ui);color:var(--t-ink)}
.chart-sub{margin:.15rem 0 0;font-size:1.03rem;line-height:1.45;color:var(--t-ink2)}
/* the example tag is a quiet label, not a box: nothing about it looks tappable */
.chip.tag-example{display:block;margin-top:.35rem;padding:0;border:0;border-radius:0;background:none;color:var(--t-ink2)}
.chart svg .grid{stroke:var(--t-rule);stroke-width:1;shape-rendering:crispEdges}
.chart svg .zero{stroke:var(--t-ink);stroke-width:1;shape-rendering:crispEdges}
.chart svg .s-named{stroke-width:2.5;fill:none}
.chart svg .s-context{stroke-width:1.5;fill:none}
.chart svg .annot{font-weight:600}
.chart svg .leader{stroke:var(--t-ink);stroke-width:1}
.chart svg .shade{fill-opacity:.4}

/* Folds: "Go deeper" and the sources, closed by default. */
details.deeper{margin-top:2.5rem;border-top:2px solid var(--t-ink);padding-top:.5rem}
/* Every fold shows that it opens: a chevron before its summary (a lab's display:flex summary hides the browser marker). */
details>summary{list-style:none}
details>summary::-webkit-details-marker{display:none}
details>summary::before{content:"";display:inline-block;flex:none;width:.45em;height:.45em;margin:0 .7em 0 .1em;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-.15em) rotate(-45deg)}
details[open]>summary::before{transform:translateY(-.3em) rotate(45deg)}
@media (prefers-reduced-motion:no-preference){details>summary::before{transition:transform .15s ease}}
details.deeper>summary{display:flex;align-items:center;min-height:44px;cursor:pointer;font-family:var(--type-label-font);font-weight:var(--type-label-weight);font-size:var(--type-label-size);letter-spacing:var(--type-label-tracking);text-transform:uppercase}
/* One fold style for every tool (Go deeper, a tool's own fold, Sources): a 2px ink rule, the name in sentence case and,
   under it, a one-line preview of what is inside (.fold-p: written by deskDeeper() from the fold's sub-sections, or from
   the fold's data-preview). Folds in a run stack with no gap; the run sits one fixed gap under what comes before it.
   Scoped under the page so a lab's own fold rules cannot drift from it. */
body>.page details:is(.deeper,.sources,.fold,.this-year){margin:2.5rem 0 0;padding:0;border:0;border-top:2px solid var(--t-ink)}
body>.page details:is(.deeper,.sources,.fold,.this-year)+details:is(.deeper,.sources,.fold,.this-year){margin-top:0}
body>.page details:is(.deeper,.sources,.fold,.this-year)>summary{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:baseline;min-height:56px;padding:.75rem 0;cursor:pointer;font:700 1.2rem/1.3 var(--font-ui);letter-spacing:0;text-transform:none;color:var(--t-ink)}
body>.page details:is(.deeper,.sources,.fold,.this-year)>summary::before{align-self:center;grid-row:1}
body>.page details:is(.deeper,.sources,.fold,.this-year)>summary>.fold-p{grid-column:2;display:block;margin:.2rem 0 0;font:400 var(--type-small-size)/1.45 var(--font-ui);color:var(--t-ink2);text-transform:none;letter-spacing:0}
body>.page details:is(.deeper,.sources,.fold,.this-year)[open]>summary>.fold-p{display:none}
body>.page details:is(.deeper,.sources,.fold,.this-year)>summary:hover{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:.2em;text-decoration-color:var(--t-point)}

/* Video tiles: the 56px ink play badge and the duration chip (as on the site). */
.play-badge{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:rgb(16 22 28 / .88);color:#fff;border:0}
.dur-chip{display:inline-block;padding:.15em .5em;font:700 17.5px/1.3 var(--font-display);font-variant-numeric:tabular-nums lining-nums;color:#fff;background:rgb(0 0 0 / .72)}

.crosshair{pointer-events:none}
.crosshair line{stroke:var(--t-ink);stroke-width:1;stroke-dasharray:3 3}
.crosshair rect{fill:var(--t-raised);stroke:var(--t-rule)}
.crosshair text{fill:var(--t-ink);font-family:var(--font-display);font-variant-numeric:tabular-nums lining-nums}

/* ---- The desk tool template (steps 4 to 6; markup and APIs in the header comment). Generic names sit in :where() so a
   lab's own rule still wins. Every size here is 17.5px or more (Mo: never smaller). ---- */
/* 1. The big readout: "How this is worked out" is a closed fold under the one line. */
.readout-how{margin:.5rem 0 0}
.readout-how>summary{display:flex;align-items:center;min-height:44px;cursor:pointer;font:600 17.5px/1.35 var(--font-ui);color:var(--t-ink)}
.readout-how>:not(summary){margin:.35rem 0 .5rem;font-size:var(--type-small-size);line-height:1.5;color:var(--t-ink2)}
.readout[aria-busy="true"]{cursor:inherit}
/* 2. Go deeper: the optional "In this section:" line and the sub-sections. */
.deeper-in{margin:.5rem 0 1rem;font-size:var(--type-small-size);line-height:1.5;color:var(--t-ink2)}
:where(details.deeper) :where(.deeper-sub){margin-top:2rem}
/* 3. The one assumptions line, beside the first control. */
:where(.assume){margin:.6rem 0 0;font-size:var(--type-small-size);line-height:1.5;color:var(--t-ink2);max-width:52ch}
/* 4. Save and share: the in-app browser notice sits right after its button. */
.save-note{display:block;margin:.5rem 0 0;padding-left:.75rem;border-left:2px solid var(--t-ink);font-size:var(--type-small-size);line-height:1.45;color:var(--t-ink);max-width:40ch}
/* 5. Guess, then reveal: a ruled panel; the slider is a 44px target, its value in serif figures. */
.guess{margin:1.5rem 0;padding:1rem 1.25rem 1.25rem;border:1px solid var(--t-rule);border-top:2px solid var(--t-ink);background:var(--t-raised);max-width:46rem}
.guess[hidden]{display:none}
.guess-q{margin:.25rem 0 .5rem;font-family:var(--type-card-font);font-weight:var(--type-card-weight);font-size:var(--type-card-size);line-height:var(--type-card-line);text-wrap:balance}
.guess-row{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
.guess-row input[type=range]{flex:1 1 9rem;min-width:0;height:44px;margin:0;accent-color:var(--t-ink);cursor:pointer}
.guess-v{min-width:5ch;font-family:var(--type-readout-font);font-weight:600;font-size:clamp(1.6rem,1.2vw + 1.1rem,2.2rem);line-height:1.1;font-variant-numeric:tabular-nums lining-nums;color:var(--t-ink)}
.guess-actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:.75rem}
.guess-actions[hidden],.guess-out[hidden]{display:none}
.guess-out{margin:.75rem 0 0;font-size:1.05rem;line-height:1.5;color:var(--t-ink)}
/* 6. The tool-bar year chip ("Born {year} · change · forget"): text buttons with 44px targets, scoped to the tool bar
   so a lab's own button{} rule cannot restyle them. On phones it takes its own line under the two links. */
.desk-toolnav .desk-year{display:inline-flex;flex-wrap:wrap;align-items:center;gap:0 .45rem;margin:0;min-height:2.5rem;font-size:17.5px;line-height:1.35;color:var(--t-ink)}
.desk-toolnav .desk-year[hidden]{display:none}
.desk-toolnav .desk-year b{font-family:var(--font-display);font-weight:600;font-variant-numeric:tabular-nums lining-nums}
.desk-toolnav .desk-year button{position:relative;box-sizing:content-box;width:auto;height:auto;min-width:0;min-height:0;margin:0;padding:0;border:0;border-radius:0;box-shadow:none;background:transparent;color:var(--t-ink);font:inherit;font-weight:600;text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--t-ink) 35%,transparent);text-underline-offset:.2em;cursor:pointer}
.desk-toolnav .desk-year button::after{content:"";position:absolute;left:-.3rem;right:-.3rem;top:50%;height:44px;transform:translateY(-50%)}
.desk-toolnav .desk-year button:hover{text-decoration-color:var(--t-point);text-decoration-thickness:2px}
@media (max-width:560px){.desk-toolnav .desk-year{order:3;flex-basis:100%}}
.desk-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* 7. Motion only after a user action, and instant under reduced motion: one rule for every tool. */
@media (prefers-reduced-motion:reduce){*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}
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
` + templateJS();
}

// ---- The template's pure parts: plain functions, tested in node (tests/template.test.mjs) and written into the page
// with Function.prototype.toString, so the page runs the very code that was tested. No backticks inside them. ----

/** The notice shown next to a save button in an in-app browser, where downloads and the share sheet often fail. */
export const IN_APP_NOTICE = 'Open this page in Safari or Chrome to save the file.';
/** The stamp on every saved card. */
export const CARD_STAMP = 'Example · Education, not advice';
/** The chart tag for illustrative numbers (set in capitals by .chip). */
export const EXAMPLE_TAG = 'Example data';

/** Which social app's in-app browser a user agent string belongs to: 'Instagram', 'LinkedIn', 'Facebook' or null. */
export function inAppBrowser(ua) {
  ua = String(ua || '');
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/LinkedInApp|LinkedIn\//i.test(ua)) return 'LinkedIn';
  if (/FBAN\/|FBAV\/|FB_IAB|FBIOS|FB4A|FBSV\/|\[FB/i.test(ua)) return 'Facebook';
  return null;
}

/** The site address as printed on a card: the origin without its scheme or a trailing slash. */
export function siteAddress(origin) {
  return String(origin || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

/** The number of words in a piece of text (for the readout's 6-word label and 14-word line). */
export function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/** The preview under a closed Go deeper summary: its sub-sections' names joined by " · ", or '' with fewer than two. */
export function deeperPreview(titles) {
  var t = (titles || []).map(function (x) { return String(x || '').replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  return t.length >= 2 ? t.join(' · ') : '';
}

/** The "In this section:" line of a Go deeper fold, or '' with fewer than three sub-sections. */
export function deeperIntro(titles) {
  var t = (titles || []).map(function (x) { return String(x || '').replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  return t.length >= 3 ? 'In this section: ' + t.join(' · ') : '';
}

/** Greedy word wrap for canvas text: lines no wider than max by measure(text) (one long word keeps its own line); at
 *  most maxLines lines, the last ending in an ellipsis when text is cut. */
export function wrapText(text, max, measure, maxLines) {
  var words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean), lines = [], cur = '';
  for (var i = 0; i < words.length; i++) {
    var next = cur ? cur + ' ' + words[i] : words[i];
    if (cur && measure(next) > max) { lines.push(cur); cur = words[i]; } else cur = next;
  }
  if (cur) lines.push(cur);
  if (maxLines && lines.length > maxLines) {
    var keep = lines.slice(0, maxLines), last = keep[maxLines - 1];
    while (last.indexOf(' ') > 0 && measure(last + '…') > max) last = last.slice(0, last.lastIndexOf(' '));
    keep[maxLines - 1] = last + '…';
    return keep;
  }
  return lines;
}

/** What a saved card says, in drawing order (the canvas draws exactly these strings). */
export function cardText(o, origin) {
  o = o || {};
  return {
    head: String(o.head || ''),
    question: String(o.question || ''),
    bigValue: String(o.bigValue == null ? '' : o.bigValue),
    line: String(o.line || ''),
    labels: (o.labels || []).map(String).filter(Boolean).slice(0, 3),
    stamp: CARD_STAMP,
    address: siteAddress(origin),
  };
}

// Non-ASCII characters (the middle dot, the ellipsis) are written as \u escapes, so the script reads the same in any
// page encoding.
const ascii = (s) => s.replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

function templateJS() {
  const site = { origin: SITE.origin, wordmark: SITE.wordmark };
  return ascii(`
// ---- The desk tool template (redesign v2, steps 4 to 6): readout, Go deeper, example tag, save and share, Save my
// card, guess then reveal, the year chip. APIs in the header comment of shared/desk/desk-ui.mjs. ----
var DESK_SITE = ${JSON.stringify(site)};
var IN_APP_NOTICE = ${JSON.stringify(IN_APP_NOTICE)}, CARD_STAMP = ${JSON.stringify(CARD_STAMP)}, EXAMPLE_TAG = ${JSON.stringify(EXAMPLE_TAG)};
${inAppBrowser.toString()}
${siteAddress.toString()}
${wordCount.toString()}
${deeperIntro.toString()}
${deeperPreview.toString()}
${wrapText.toString()}
${cardText.toString()}

// Has the visitor acted? A trusted pointer, key or input event in the last 1.5s (count-ups run only then).
var deskActedAt = 0;
['pointerdown', 'keydown', 'input', 'change'].forEach(function (t) { addEventListener(t, function (e) { if (e.isTrusted) deskActedAt = Date.now(); }, { capture: true, passive: true }); });
function deskActed() { return deskActedAt > 0 && Date.now() - deskActedAt < 1500; }
function deskStill() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
function deskEl(x) { return typeof x === 'string' ? document.querySelector(x) : x; }

// 1. The big readout.
function deskReadout(el, o) {
  el = deskEl(el); o = o || {};
  var v = el.querySelector('[data-readout-v]') || el.querySelector('.readout-v'), t = el.querySelector('[data-readout-t]') || el.querySelector('.readout-t'), k = el.querySelector('.readout-k');
  if (!el.hasAttribute('aria-live')) el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  var cur = null, raf = 0, quiet = 0;
  function busy() { el.setAttribute('aria-busy', 'true'); clearTimeout(quiet); quiet = setTimeout(function () { el.removeAttribute('aria-busy'); }, 250); }
  function set(s) {
    s = s || {}; busy(); cancelAnimationFrame(raf);
    if (s.label != null && k) k.textContent = s.label;
    if (s.line != null && t) t.textContent = s.line;
    var fmt = s.format || o.format || String;
    if (typeof s.n === 'number' && isFinite(s.n)) {
      var from = cur, to = s.n; cur = to;
      if (from == null || from === to || s.animate === false || !deskActed() || deskStill()) { v.textContent = fmt(to); return; }
      var t0 = performance.now();
      var step = function (now) {
        var p = Math.min(1, (now - t0) / 300), e = 1 - Math.pow(1 - p, 3);
        v.textContent = fmt(p < 1 ? from + (to - from) * e : to);
        if (p < 1) raf = requestAnimationFrame(step); else busy();
      };
      raf = requestAnimationFrame(step);
    } else { cur = null; v.textContent = s.text != null ? String(s.text) : ''; }
  }
  return { set: set, el: el };
}

// 2. Folds: the one-line preview under each summary, so a closed fold says what it holds. A Go deeper fold with two or
//    more sub-sections lists them ("A · B · C", deeperPreview); any fold may give its own in data-preview instead.
function deskDeeper() {
  [].forEach.call(document.querySelectorAll('details.deeper, details.sources, details.fold, details.this-year'), function (d) {
    var s = d.querySelector(':scope > summary'); if (!s) return;
    var line = d.getAttribute('data-preview') || '';
    if (!line && d.matches('.deeper')) {
      var subs = [].filter.call(d.children, function (c) { return c.matches('.deeper-sub, section'); });
      line = deeperPreview(subs.map(function (c) { var h = c.getAttribute('data-title') ? null : c.querySelector('h2, h3, h4, .card-hed, .sec-label'); return c.getAttribute('data-title') || (h ? h.textContent : ''); }));
    }
    var p = s.querySelector(':scope > .fold-p');
    if (!line) { if (p && p.hasAttribute('data-auto')) p.remove(); return; }
    if (p && !p.hasAttribute('data-auto')) return;
    if (!p) { p = document.createElement('span'); p.className = 'fold-p' + (d.matches('.deeper') ? ' deeper-in' : ''); p.setAttribute('data-auto', ''); s.appendChild(p); }
    p.textContent = line;
  });
}
deskDeeper();

// 3. The EXAMPLE DATA tag on a chart drawn at run time (once per chart).
function deskExampleTag(fig) {
  fig = deskEl(fig); if (!fig || fig.querySelector('.tag-example')) return;
  var cap = fig.querySelector(':scope > figcaption'); if (!cap) { cap = document.createElement('figcaption'); fig.prepend(cap); }
  var tag = document.createElement('span'); tag.className = 'chip tag-example'; tag.textContent = EXAMPLE_TAG; cap.appendChild(tag);
}

// 4. Save and share: the share sheet when it takes files, else a download link; the in-app browser notice.
function deskInApp() { try { return inAppBrowser(navigator.userAgent); } catch (e) { return null; } }
function deskSaveFile(o) {
  var app = deskInApp(), notice = app ? IN_APP_NOTICE : null;
  function done(via) { return { via: via, inApp: app, notice: notice }; }
  function download() {
    var url = URL.createObjectURL(o.blob), a = document.createElement('a');
    a.href = url; a.download = o.name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 20000);
    return done('download');
  }
  var data = null;
  try { data = { files: [new File([o.blob], o.name, { type: o.blob.type || 'application/octet-stream' })], title: o.title || o.name }; } catch (e) { data = null; }
  var can = false;
  try { can = !!(data && navigator.share && navigator.canShare && navigator.canShare(data)); } catch (e) { can = false; }
  if (!can) return Promise.resolve(download());
  return navigator.share(data).then(function () { return done('share'); }, function (e) { return e && e.name === 'AbortError' ? done('cancelled') : download(); });
}
function deskSaveButton(button, make) {
  button = deskEl(button);
  if (deskInApp() && !(button.nextElementSibling && button.nextElementSibling.classList.contains('save-note'))) {
    var n = document.createElement('span'); n.className = 'save-note'; n.setAttribute('role', 'note'); n.textContent = IN_APP_NOTICE; button.after(n);
  }
  button.addEventListener('click', function () {
    if (button.getAttribute('aria-busy') === 'true') return;
    button.setAttribute('aria-busy', 'true');
    Promise.resolve().then(make).then(deskSaveFile).catch(function () { return null; }).then(function () { button.removeAttribute('aria-busy'); });
  });
}

// Save my card: a 1080x1350 PNG drawn in a canvas, in the page's current theme; nothing leaves the page.
function deskCard(o) {
  var W = 1080, H = 1350, P = 88, cs = getComputedStyle(document.documentElement);
  var col = function (n, d) { return (cs.getPropertyValue('--t-' + n) || '').trim() || d; };
  var C = { ground: col('ground', '#FCFDFD'), raised: col('raised', '#E8EEF3'), ink: col('ink', '#10161C'), ink2: col('ink2', '#36414C'), rule: col('rule', '#D3D8DD'), point: col('point', '#F2A93B') };
  var serif = '"Source Serif 4 Variable", Georgia, serif', sans = '"Source Sans 3 Variable", system-ui, sans-serif';
  var T = cardText({ head: DESK_SITE.wordmark, question: o.question, bigValue: o.bigValue, line: o.line, labels: o.labels }, DESK_SITE.origin);
  var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('600 72px ' + serif), document.fonts.load('400 50px ' + sans), document.fonts.load('700 40px ' + sans)]).catch(function () {}) : Promise.resolve();
  return fonts.then(function () {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d'), w = W - 2 * P, y = P;
    var track = function (px) { if ('letterSpacing' in x) x.letterSpacing = px; };
    var font = function (f) { x.font = f; track('0px'); };
    var m = function (s) { return x.measureText(s).width; };
    x.fillStyle = C.ground; x.fillRect(0, 0, W, H);
    x.textBaseline = 'alphabetic'; x.fillStyle = C.ink;
    // the wordmark over the site's double rule
    font('600 44px ' + serif); y += 44; x.fillText(T.head, P, y);
    y += 26; x.fillRect(P, y, w, 2); x.fillRect(P, y + 6, w, 2); y += 8;
    // the question
    font('600 72px ' + serif); y += 40;
    wrapText(T.question, w, m, 4).forEach(function (l) { y += 80; x.fillText(l, P, y); });
    // the big value, shrunk until it fits one line
    var size = 230; font('600 ' + size + 'px ' + serif);
    while (size > 96 && m(T.bigValue) > w) { size -= 6; font('600 ' + size + 'px ' + serif); }
    y += Math.round(size * 0.95) + 40; x.fillText(T.bigValue, P, y);
    // the one highlight: an amber rule under the figure, clear of its descenders
    y += Math.round(size * 0.3); x.fillStyle = C.point; x.fillRect(P, y, Math.min(w, Math.max(160, m(T.bigValue))), 8); x.fillStyle = C.ink; y += 16;
    // the one line
    font('400 50px ' + sans);
    wrapText(T.line, w, m, 3).forEach(function (l) { y += 66; x.fillText(l, P, y); });
    // the labels as ruled chips
    if (T.labels.length) {
      y += 40; font('700 40px ' + sans); track('2px');
      var cx = P, ch = 64;
      T.labels.forEach(function (l) {
        var s = l.toUpperCase(), lw = m(s) + 40;
        if (cx > P && cx + lw > P + w) { cx = P; y += ch + 16; }
        x.strokeStyle = C.rule; x.lineWidth = 2; x.strokeRect(cx + 1, y + 1, lw - 2, ch - 2);
        x.fillStyle = C.ink2; x.fillText(s, cx + 20, y + 46); x.fillStyle = C.ink; cx += lw + 16;
      });
      y += ch;
    }
    // an optional small chart in the room that is left
    var foot = H - P - 116;
    if (typeof o.draw === 'function' && foot - y > 140) { try { o.draw(x, { x: P, y: y + 40, w: w, h: foot - y - 80 }, C); } catch (e) { /* the card still saves */ } }
    // the foot: a 2px ink rule, the stamp and the site address
    x.fillStyle = C.ink; x.fillRect(P, foot, w, 2);
    font('700 40px ' + sans); x.fillText(T.stamp, P, foot + 56);
    font('400 40px ' + sans); x.fillStyle = C.ink2; x.fillText(T.address, P, foot + 108);
    return new Promise(function (res, rej) { c.toBlob(function (b) { if (b) res(b); else rej(new Error('the card could not be drawn')); }, 'image/png'); });
  });
}
function deskSaveCard(o) {
  return deskCard(o).then(function (blob) { return deskSaveFile({ blob: blob, name: o.name || 'my-card.png', title: o.question }); });
}

// 5. Guess, then reveal: skippable, and shown only when the tool calls show() after its first result.
var deskGuessN = 0;
function deskGuess(host, o) {
  host = deskEl(host); o = o || {};
  var id = 'desk-guess-' + (++deskGuessN), fmt = o.format || String, shown = false, done = false;
  var mk = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  host.textContent = ''; host.classList.add('guess'); host.setAttribute('data-guess', ''); host.hidden = true;
  var k = mk('p', 'kicker', 'Guess first'), q = mk('p', 'guess-q', o.question || ''); q.id = id + '-q';
  var row = mk('div', 'guess-row'), r = document.createElement('input'), out = mk('output', 'guess-v');
  r.type = 'range'; r.id = id; r.min = o.min; r.max = o.max; r.step = o.step || 1; r.value = o.start != null ? o.start : o.min;
  r.setAttribute('aria-labelledby', id + '-q'); out.setAttribute('for', id);
  var paint = function () { out.textContent = fmt(Number(r.value)); r.setAttribute('aria-valuetext', out.textContent); };
  r.addEventListener('input', paint); paint();
  row.appendChild(out); row.appendChild(r);
  var acts = mk('div', 'guess-actions'), go = mk('button', 'btn', 'Reveal'), skip = mk('button', 'btn-2', 'Skip');
  go.type = 'button'; skip.type = 'button'; acts.appendChild(go); acts.appendChild(skip);
  var said = mk('p', 'guess-out'); said.setAttribute('aria-live', 'polite'); said.hidden = true;
  [k, q, row, acts, said].forEach(function (e) { host.appendChild(e); });
  go.addEventListener('click', function () {
    if (done) return; done = true;
    var g = Number(r.value), a = typeof o.answer === 'function' ? o.answer() : o.answer;
    said.textContent = o.reveal ? o.reveal(g, a) : 'Your guess: ' + fmt(g) + '. The answer: ' + fmt(a) + '.';
    said.hidden = false; r.disabled = true; acts.hidden = true; said.setAttribute('tabindex', '-1'); said.focus();
    if (o.onDone) o.onDone({ guess: g, answer: a, skipped: false });
  });
  skip.addEventListener('click', function () {
    if (done) return; done = true; host.hidden = true;
    var a = document.querySelector('[data-answer]'); if (a) { if (!a.hasAttribute('tabindex')) a.setAttribute('tabindex', '-1'); a.focus(); }
    if (o.onDone) o.onDone({ skipped: true });
  });
  return { show: function () { if (shown || done) return; shown = true; host.hidden = false; }, el: host };
}
`);
}
