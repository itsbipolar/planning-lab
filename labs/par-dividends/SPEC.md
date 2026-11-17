# Participating policy dividends: build spec

Public slug `par-dividends`; lab `labs/par-dividends`. Built on the desk template (shared/desk; redesign v2 sections 3,
5 and 6), the same way `labs/estate-freeze` and `labs/corporate-insurance` were. Mo approved the tool on 2026-11-17
("OK"). The page goes live **unlisted**: it is at `/tools/par-dividends/`, carries noindex, is nobody's Up next and is
linked from nowhere until one flag, `"listed": false` in `shared/desk/next.json`, is flipped. Two gates come before the
flip, in this order:
1. Mo reviews the 11 participating-policy facts that were Claude-checked under his standing OK.
2. His firm's compliance approves the unlisted URL.

**Revision 2 (2026-11-17, after the verifier round; it wins over any older line below that it contradicts).**
- The facts: the ten par text values are now each fact's `source_quote`, word for word (the standing OK covers only
  verbatim copies; a pytest in canada-planning-facts holds it). Go deeper sets them as quotations. Two fact titles say
  "a life insurer's", not "the insurer's". The shareholder ceiling is labelled as statute (ICA s. 461, "the ceiling is
  law"), with E-16's line as OSFI's summary of it.
- The made-up account: default mix **65%** bonds and loans (70/30 is a published carrier mix; the hashed figures now
  hold the researched mixes, checked both ways). The thirteen swing values are reordered so that 1987, 2000-2002,
  2008, 2020 and 2022 get only -5 to +9, and so that the figure falls with every extra year at the example's mix.
- The page, top to bottom: question, lede ("Dividends typically use a smoothed credited rate. It moves in small steps
  while returns jump."), the slider "SPREAD STOCK AND PROPERTY SWINGS", the readout ("Credited rate's biggest move",
  "{2.5} percentage points in a year"), the definition line (the credited rate feeds a dividend formula and is not
  what a policy earns; the interest part depends on how far it is above the pricing rate), the not-guaranteed line
  ("... a life insurer's board declares them, typically once a year, and they can go down."), the echo, the
  assumptions line, then the chart. The swings switch sits in the chart's caption (its legend is screen-reader only
  under 560px). With steady stocks the slider is disabled and its help line says why; the readout line then says the
  actual return still moved, mostly from bond prices. When the figure is higher than at one year fewer (other mixes),
  the help line gives the 13-year reason. What happens is the first part of Go deeper.
- Under the chart: the simple averages, "In this model, smoothing mostly changes when results are credited, not how
  much. Neither line is what a policy earns: ..."; and "year-end long bond yields were {9.2%} to {15.3%} in that
  decade". The table caption gives the typical (median) year-to-year moves, not standard deviations.
- Wording: no blanket claim about what insurers publish ("our assumption, not any insurer's, and methods differ");
  "separate accounts", not a separate pool of money; general-practice sections in Go deeper say so; future dividend
  uses, not "anything dividends pay for"; the timing simplification (a real scale is typically set in advance) is in
  the assumptions; the Sources line no longer claims every line is sourced.
- Chart: one tick count at every width (phones 1980, 2000, 2020; the last year is in the key); the actual-return
  figure in ink, the credited rate in d1; dark bars at 55%; the duplicate stamp chip is gone.

**What it is.** A carrier-free explainer. One made-up par account runs from 1980 to the latest full year. It shows
what the account earned each year (the actual return) and the steadier rate it credited (the credited rate). One real
series sits behind it: the year-end long-term Government of Canada bond yield (Bank of Canada data, published by
Statistics Canada). Everything else is a made-up setting and is labelled as one. The official rules on the page come
only from confirmed facts in `shared/facts.json`.

**What it never is.**
- It never shows any insurer's account, method, smoothing period or rate, and never names an insurer, product or
  report. That covers code, data, tests, fixtures, commits and the making-of page (section 10).
- It never gives a reason to buy, and never presents a policy as good or bad.
- It never forecasts anything.
- Dividends are always "not guaranteed".
- The smoothing period is always a setting to explore, never how an insurer does it.

Source material: the research guide `par-concepts.md` and its reference model `tools-model/model.py`, both prepared on
2026-11-17 in the session scratchpad. They are background only. The guide's Part 3 governs what must never appear. Its
Part 2 is the model: `model.mjs` is an exact port of it, checked against the reference run (section 4.1).

---

## 0. Key decisions, and the lessons they apply

**From the estate-freeze clarity passes** (fresh readers found the page confusing):
- **One term per concept, held everywhere.**
  - "the account" (on first use "a par account: the separate pool of money behind participating policies");
  - "actual return" (what the investments earned that year at market value) and "credited rate" (the smoothed rate
    used to set dividends). The formal name "dividend scale interest rate" is said once, in What happens step 3, and
    in the glossary;
  - "bonds and loans" (never "fixed income" on the main path), and "stocks and property" (never "growth assets");
  - "made-up" for every invented series and setting, and "real" only for the bond yield;
  - "spread over {n} years" for the smoothing control. "Smoothing" is used in What happens, the rules and the glossary.
- **The chart right after the answer.** What happens (four steps, no figures) opens Go deeper (revision 2).
- **The chart ends where the model ends**: the last full year in the data. Nothing is projected.
- **One formatter.** `pts()` and `pct()` in model.mjs's FORMAT block (one decimal) are used by the answer, chart
  readings, crosshair, table and poster, so a value always reads as the same string.
- **The answer's label and line never change meaning with state.** Only the chart title is state-driven.
- **Every statement is said once.** The made-up label lives in the assumptions line, the chart subtitle says only
  which line is real, and the settings live in the one assumptions block.
- The Go deeper summary is at y ≤ 2,800 at 390. Rendered text is 17.5px or more everywhere, SVG included. A tapped
  reading stays after touchend.

**From the company-life-insurance review** (safer route, Mo, 2026-11-17):
- **No comparison that reads as a benefit.** The guide's optional five-year GIC line is left out. Next to a credited
  rate it would read as a product comparison. The bond yield stays, because it is the account's raw material, not a
  rival.
- **The answer card has no mini chart.** The chart is the one picture.
- **Go deeper quotes the facts' own values** instead of paraphrasing the rules.
- **No print sheet, no Save my card and no share in v1.** On an insurance topic, a printable sheet is a thing to hand
  to someone.
- **Left out is explicit**, with a closing line that points to a professional.
- **Insurance words in the words test.** Insurer names never appear in plain text in any repo file, tests included
  (section 10).
- **Placement in More tools, no new panel shape.** Two gates come before the flip.

**Specific to this tool:**
- **H1: Mo's approved title**, "How do participating policy dividends work?" (6 words, no digits). The lede narrows it
  to the chart, and What happens answers the "how". The sharper alternative is open question 1.
- **The big answer is the credited rate's biggest one-year change**, compared in the line under it with the actual
  return's biggest. Both are computed from the model and never typed. At the example (1980 to 2025, spread over 5
  years) they are 2.5 and 14.1 points.
- **At the example the figure falls with every extra year** (14.2 at 1 year down to 1.4 at 10; tested). At other mixes
  the 13-year swings can line up with some lengths; then the help line says so, and "How this is worked out" has one
  sentence on it. The "steady (no swings)" switch shows the bond-only lag, which does not depend on
  N.
- **No dollar figure anywhere.** There are no premiums, cash values, policy sizes or dividends in dollars; the page
  speaks in percent a year. The guide's ideas for a surplus table, a flow diagram, a paid-up-additions chart and a
  pricing-rate spread example are not built. Each added a made-up money figure to an insurance page and is not in Mo's
  Go deeper list.
- **The shareholder range is derived, not typed.** "2.5% to 10%" is the min and max of the
  `par_shareholder_cap_tiers` rates. A test checks that both appear in the `par_shareholder_cap_range` fact's value.
- **The data's latest month (2026-10) is not used.** The model runs on December values only, so the last year is the
  snapshot's last December (2025 today). It moves on its own when the snapshot is refreshed.

---

## 1. Words

| Where | Text |
|---|---|
| H1 (next.json `question`) | **How do participating policy dividends work?** (6 words, 43 characters, no digits) |
| Kicker | `TOOL` |
| Lede | Dividends typically use a smoothed credited rate. It moves in small steps while returns jump. |
| Card dek (projects mdx; no figures; 140 characters or fewer) | Drag the years. In a made-up account on real bond yields, the credited rate barely moves while the actual return jumps. |
| `<meta name="description">` / og:description | A made-up participating account on real Canadian bond yields: what it earned each year, and the smoothed rate it credited. Education, not advice. |
| Stamp (assumptions line) | Hypothetical illustration · Education, not advice |
| Chip (More tools, once listed) | Drag |

**Voice.**
- Third person: "the account", "the board", "a life insurer", "the company's actuary". Never "you", "your policy",
  "your insurer" or "the insurer's", which read as if one insurer were meant. "A life insurer" and "a life insurer's"
  are generic; the redirect's "the insurer that issued it" is allowed.
- Dividends "can go down" and are "not guaranteed". They are never "paid", "earned" or "returned" as a promise.
- The word "guarantee" in any form appears only in a sentence that also says "not" or "cannot" (tested).
- What a contract sets is "set in the contract", never "guaranteed".

**Words never used** (section 13, words test): should, recommend, best, consider, right for you, buy, purchase, quote,
coverage, protect, agent, licensed, LLQP, advisor/adviser, planner, saving(s)/saved, safe, superior, strongest,
largest, outperform, beat the market, "your insurer", "the insurer's", "typical period", "smoothing period of",
"insurers use", and any dollar figure.

---

## 2. First screen

### 390px (approximate y values; the tests hold the limits)

1. **0–140: the shared tool bar** (desk-page `toolBar`): masthead, "← All tools", "How I made this", the theme icon.
2. **~156: the kicker** TOOL.
3. **~188–300: the H1**, display role, 3 lines.
4. **~310–400: the lede**, 3 lines.
5. **~410–520: the one control**, `[data-first-move]`:
   - the label "SPREAD STOCK AND PROPERTY SWINGS" (label role, one line);
   - a serif tabular bubble above the thumb: "5 years" ("1 year" at 1);
   - a native range from 1 to 10, step 1, with a 48px thumb hit area;
   - aria-valuetext reads "5 years, a setting to explore";
   - end ticks "1" and "10 years".
6. **~535–690: the readout**, `[data-answer]` (desk `deskReadout`, aria-live polite, debounced 250ms):
   - `.readout-k` "Credited rate's biggest move";
   - `.readout-v` "2.5" in Source Serif 4 600, tabular lining; beside it `.readout-of` "percentage points in a year";
   - `.readout-t` "The actual return changed by up to {14.1} points in one year." (with steady stocks: "With steady
     stocks, the actual return still changed by up to {15.2} points in one year, mostly from bond prices.");
   - `details.readout-how` "How this is worked out" (closed; section 8).

   **Tested:** the big figure's bottom edge is at y ≤ 700 at 390, stricter than the template's top ≤ 700. This is the
   corporate-insurance rule.
7. **The not-guaranteed line**, directly under the readout and outside its live region, so it is not re-read on
   every change. Each part is wrapped in its fact's span:
   "Dividends are not guaranteed: a life insurer's board declares them, typically once a year, and they can go down."
   (`par_dividends_not_guaranteed`, `par_board_discretion`; "typically once a year" is practice, outside the spans).
   A test checks it against the facts' values, by the keywords "cannot be guaranteed" and "discretion of the board".
8. **The echo line** (hidden at the example): when any Go deeper setting differs, "Account changed below: {60%} bonds
   and loans, {20}-year ladder." It has a text button, "Back to the example" (which also turns the swings back on).
9. **The one `[data-assumptions]` line** (`.assume`): "Hypothetical illustration · Education, not advice. A made-up
   account: the bond yields are real (Bank of Canada); everything else is invented, including the stock swings. Not
   any insurer's account, method or rates."

No chart sits above 700 at 390.

### 1440px

- 12-column container (1360 max). Text is capped at 68ch.
- **Play row:**
  - kicker, H1 (30ch) and lede across; then the slider (columns 1–6) level with the readout (7–12);
  - under the slider the assumptions line and the echo; under the readout the not-guaranteed and definition lines.
- **Row 2:** the chart across all 12 columns, about 440px tall. At 1440×900 its title and caption are in view.
- What happens is in Go deeper (revision 2).

### 768px

The 390 order, with the slider and the readout side by side (6/6).

Light is the default. Dark mode gets equal care: its own d1 and d3 tokens, and the bar fill and dashed line are checked
for contrast in both schemes (section 6).

---

## 3. Controls

All bounds live in model.mjs `BOUNDS` ("UI bounds, not facts"). All defaults are `EXAMPLE`.

| Control | Where | Default | Range | Step |
|---|---|---|---|---|
| Spread stock and property swings | slider, first move | EXAMPLE.N (5 years) | 1–10 years | 1 (arrows); Home/End to the ends |
| Bonds and loans in the account | Go deeper, slider | EXAMPLE.w (65%) | 50%–90% | 5% |
| Bond ladder | Go deeper, three radio buttons | EXAMPLE.L (10 years) | 5, 10, 20 years | — |
| Stock and property swings | the chart's caption, two radio buttons: "Made-up swings" / "Steady (no swings)" | swings | — | — |

- **No other inputs.** The credit spread (1.0 point) and the stocks-and-property extra return (4.0 points) are fixed.
  They are listed in the assumptions block, not offered as controls.
- **Steady** sets `pattern = STEADY` ([0]). In that state the slider is disabled (it would change nothing). The chart
  title says why, and the slider's help line reads "With steady stocks and property there is nothing to spread: only
  the bonds hold the credited rate back."
- **Updates.** Slider input redraws the chart on requestAnimationFrame. The readout uses the desk count-up: 300ms,
  only after the visitor acts, instant under reduced motion and never on load. Go deeper controls update the readout,
  the chart, the echo line and the table at once.
- **Storage.** Inputs live in memory only. Nothing goes in the URL; there is no sessionStorage; the page does not read
  or write `mo.year`. localStorage holds only `theme`, written by the tool bar.

---

## 4. The engine: `labs/par-dividends/model.mjs` (written; do not change the arithmetic)

The module is pure: no DOM and no I/O. It is tested in node and inlined into the page by build.mjs, with
estate-freeze's export-stripping.

### 4.1 The port

`run()` is a line-for-line port of the guide's reference `run()`, with the same names and the same order of steps:
- the ladder (`rungs`), `v0`, `book`, `inc`;
- aging the rungs, `v1`, `fi_mtm`, reinvesting;
- the pattern swing `s`, `g_exp`, `actual`;
- `pend` and `rel`, then `credited`.

`price()` is the same flat-curve bond price. Three differences, all outside the arithmetic:
1. The yields come in as an argument, `Y`, built by `yieldsFrom(snapshot)` from `shared/data/long-bond-yield-yearly.json`.
2. `run(Y, { N, w, L, spread, prem, start, end, pattern })` returns `[{ year, bond, actual, credited }]` in percent,
   **unrounded**. The reference rounded inside `run()`; here rounding happens once, in FORMAT.
3. `end` defaults to the snapshot's last year, not a typed 2025. `run()` throws, naming the year, if any year from
   `start − L` to `end` has no yield. There is no fallback value.

**Checked:** over 180 combinations (N 1–10 × w 0.5/0.7/0.9 × L 5/10/20 × swings or steady) the port matches the Python
to 6e-14. `fixtures/reference-run.json` keeps 19 of those runs (rounded to 10 decimals) for model.test.

### 4.2 The made-up settings (ASSUMPTIONS block, the only typed numbers)

```js
export const EXAMPLE = { label: 'Example assumptions, not facts', N: 5, w: 0.65, L: 10, spread: 0.01, prem: 0.04, start: 1980 };
export const PAT = [18, 9, -5, 7, -16, 12, -11, -2, 5, 3, 14, -26, -8];  // the guide's made-up values, reordered (revision 2)
export const STEADY = [0];
export const BOUNDS = { N: { min: 1, max: 10, step: 1 }, w: { min: 0.5, max: 0.9, step: 0.05 }, L: [5, 10, 20] };
```

None of these was chosen to match any insurer's figure (the first draft's 70% mix did match one, and was changed). A
test checks the defaults, and the mix's other share, against the hashed carrier figures (section 13).

### 4.3 What the page shows: `summary(out)`

It returns:
- `maxMoveCredited` and `maxMoveCreditedYear`: the big figure, and the year the change lands in;
- `maxMoveActual` and `maxMoveActualYear`: the readout line;
- `medianMoveCredited` and `medianMoveActual`: How this is worked out;
- `meanActual` and `meanCredited`: the averages line under the chart;
- `sdActual` and `sdCredited`: the table caption;
- `low` and `high`: the made-up account's worst and best years (rows), which are the chart's two readings.

Moves are year-over-year changes in points. On a tie, the first year wins.

Reference values at the example, 1980–2025, on the 2026-11-17 snapshot:

| Quantity | Value |
|---|---|
| maxMoveCredited | 2.5 (2022) |
| maxMoveActual | 14.1 (2004) |
| meanActual / meanCredited | 8.71 / 8.75 → "8.7%" and "8.7%" |
| median moves (credited / actual) | 0.8 / 6.1 |
| sdActual / sdCredited | 6.1 / 3.6 (no longer shown) |
| low | 2017: actual −4.6%, credited 4.3% |
| high | 1982: actual 23.2%, credited 15.4% |
| N = 1 | maxMoveCredited 14.2 |
| N = 10 | maxMoveCredited 1.4 |
| steady (any N) | maxMoveCredited 1.5 (1982); actual 15.2; low becomes 2022 (−0.2%) |

### 4.4 Rules from facts.json (confirmed only): `parRules(facts)` in model.mjs (written)

These are text rules. None feeds the arithmetic; each feeds a line, a quote or a Source.

| Rule | Fact id | Used in |
|---|---|---|
| separate | `par_separate_account` | What happens 1; Go deeper rules |
| notGuaranteed | `par_dividends_not_guaranteed` | the not-guaranteed line; Go deeper |
| board | `par_board_discretion` | the not-guaranteed line; What happens 4; Go deeper |
| actualVsAssumed | `par_actual_vs_assumed` | What happens 2; Go deeper |
| smoothingAllowed | `par_smoothing_allowed` | Go deeper |
| smoothingPurpose | `par_smoothing_purpose` | What happens 3; Go deeper |
| returnUnsmoothed | `par_return_unsmoothed` | the chart's "actual return" definition; Go deeper |
| actuary | `par_actuary_report` | What happens 4; Go deeper |
| shareholderRange | `par_shareholder_cap_range` + `par_shareholder_cap_tiers` | Go deeper: "{2.5%} to {10%}" from min/max of the tier rates |
| onRequest | `par_policies_on_request` | Go deeper, "Where to read the rules" |

- **Required** (the build stops and names the id): `par_dividends_not_guaranteed`, `par_board_discretion`,
  `par_actual_vs_assumed`, `par_smoothing_purpose`. Without these the main path has nothing true to say.
- **Optional:** each other fact. If missing or not confirmed, its line or quote is left out and nothing else changes.
  If either shareholder fact is missing, the range sentence goes.
- **Authority wording.** Each fact's `authority` sets the label:
  - `statute`: "Insurance Companies Act" or "Policyholders Disclosure Regulations", from the title;
  - `official_publication`: "OSFI Guideline E-16. A guideline sets out OSFI's expectations; it is not law."
  An OSFI line is always phrased "OSFI expects", never "the law requires".

### 4.5 States (the model reports; the page writes the chart title)

| State | When | Chart title (no figures) |
|---|---|---|
| normal | swings on, N ≥ 2 | The credited rate moves slowly; the actual return jumps |
| n1 | swings on, N = 1 | Even unspread, the credited rate lags: bonds count at their purchase yield |
| steady | pattern = STEADY | With steady stocks, only the bonds keep the credited rate behind |

The readout's label and line are the same in every state.

### 4.6 Format

- `pts(x)`: one decimal, true minus ("1.9", "−2.9").
- `pct(x)`: `pts(x)` + "%".

Every figure on the page, chart, table and poster uses these two. Years print as they are.

---

## 5. What happens (four steps, no figures; the first part of Go deeper)

The steps are set as text over one rule; across four columns from 1200, 2×2 from 960. Each fact-backed clause is
wrapped in its fact span, and a test checks the wording against the fact's value by keywords.

1. **The accounts.** A life insurer keeps separate accounts for its participating ("par") policies
   [`par_separate_account`: "separately"]. In this example, the account invests mostly in bonds and loans, with some
   stocks and property.
2. **The results.** Each year the account earns what its investments earn at market value: the actual return.
   Dividends come from how far results such as investment income, deaths and expenses differ from what was assumed
   when the policies were priced [`par_actual_vs_assumed`: "differences between actual and assumed"].
3. **The smoothing.** Good and bad years are spread out, so dividends move gradually. The result is the credited rate
   (formally, the dividend scale interest rate). OSFI expects smoothing only to avoid undue yearly swings
   [`par_smoothing_purpose`: "undue yearly fluctuations"]. In this example, bonds count at the yield they were bought
   at, and stock and property gains and losses are spread over the years set above. That period is our assumption,
   not any insurer's, and methods differ.
4. **The dividend.** Before a dividend is declared, the company's actuary reports to the board on its fairness. The
   board then declares it [`par_actuary_report`: "fair", "directors"; `par_board_discretion`: "discretion"].

---

## 6. The chart (one, full width, the desk chart frame)

`<figure class="chart" id="par-chart">`.

**Caption.**
- Title: state-driven, with no figures (section 4.5).
- Subtitle: "Made-up account, % a year, {1980}–{2025}. The bond yield is real."
- Tags: the desk `tag-example` (EXAMPLE DATA) and the stamp, on their own line, flush with the heading.

**Axes.**
- x: linear in years, from `start` to `end`. At 390, ticks at 1980, 2000 and the last year; at 1440, every 5 years.
- y: percent, with labels left-aligned above crispEdges gridlines. The zero line is ink. The range is a nice min and
  max over all three series; the min is never above 0, so negative years show.

**Marks, coloured by data type** (made-up in the d1 family, real in d3):
1. **Actual return (made-up):** one bar per year in d1 at 40% fill, with a 1px d1 top edge. Bars go below zero in
   negative years. At 390 a bar is about 5px with a 2px gap.
2. **Credited rate (made-up):** a d1 line, 2.5px (named series).
3. **Long bond yield (real, Bank of Canada):** a d3 line, 1.5px dashed 6/4 (context series).

There is no amber, no gradient, no area fill under the lines, no draw-on animation and no pulse.

**Readings on the chart, no legend.**
- **Two point readings,** each with a 1px leader to its bar:
  - the worst year: "{2013}: earned {−2.9%}, credited {4.4%}";
  - the best year: "{1982}: earned {23.0%}, credited {14.7%}".

  Both come from `summary().low` and `.high`, so they move with the settings. The figures are serif 600 tabular; the
  words are 17.5px sans. The two together count as the chart's one annotation (they are readings, not commentary).
- **End readings,** at the last year:
  - 640px and wider: in a right gutter of max(120px, 14% of the width), each with a 1px leader: "{4.1%} credited",
    "{6.7%} actual", "{3.8%} bond yield (real)";
  - under 640px: a stacked key under the chart, one row per series in the same order, each with an 18px swatch in the
    series' mark (bar, solid, dashed), the latest value and the words.
- **Collisions** are checked against bounding boxes. When readings collide, an end reading is dropped first (its value
  is in the key and the table), then the two point readings are nudged along their leaders.

**Under the chart** (one line each):
- The averages: "Over {1980}–{2025} the made-up account earned {8.6%} a year on average and credited {8.6%}. The same
  money, credited at a different pace." The second sentence shows only when the two round within 0.3 points;
  otherwise it reads "The gap is the part of earlier gains and losses not yet credited." This is tested at every
  setting.
- The 1980s: "Rates in the 1980s are high because long bond yields were {9.2%} to {15.3%} then." The min and max come
  from the data for 1980–1989.

**Interaction.**
- `deskCrosshair` reads "{year}" / "Actual {x}" / "Credited {y}" / "Bond yield {z} (real)", pinned to the top of the
  plot.
- On touch, the reading stays after the finger lifts until a tap elsewhere. This is a capture listener in app.js, as in
  estate-freeze, not a change to shared/desk.
- The chart is focusable (tabindex 0); Left and Right step one year, Home and End go to the ends.
- One line under the chart's caption: "Tap or use the arrow keys to read a year."

**Sizes.** The SVG is drawn at the container's measured width (ResizeObserver; 1 unit = 1px), so text renders at its
CSS size: about 358×320 at 390 and 1360×440 at 1440. All text is 17.5px or more, measured as font-size × getScreenCTM.

**Contrast.** In both schemes the d1 bar fill with its top edge, the d1 line and the d3 dashed line reach 3:1 against
the ground, and the d1 line reaches 3:1 against the bar fill where they cross (WCAG 1.4.11). This is checked in
page.spec by computed style.

**Accessibility.**
- role="img", with a `<title>` and a generated `<desc>` stating the big figure, the actual return's biggest change and
  the two point readings.
- A visually hidden summary table holds the same figures. The full numbers are in Go deeper's table.
- The aria-live readout states the same figures in words. A test checks that the readout and the `<desc>` agree.

---

## 7. Below the chart, in order

1. **Go deeper** (`details.deeper`, closed). Its summary is at y ≤ 2,800 at 390 (tested). `deskDeeper` writes the "In
   this section:" line. It has seven parts, in this order:
   1. **"Change the made-up account."** Holds:
      - the bonds-and-loans slider (50–90%, with the stocks-and-property share shown beside it);
      - the ladder radios (5, 10, 20 years), with the help line "A longer ladder: fewer bonds mature each year, so the
        credited rate follows yields more slowly.";
      - (the swings radios moved to the chart's caption in revision 2);
      - "Back to the example" (shown only when something differs).

      One line names the trade, in the example's terms only: "More bonds and loans, or a longer ladder: a steadier
      credited rate that is slower to follow yields."
   2. **"The rules, as the facts file holds them."** One entry per confirmed fact in section 4.4, in this order:
      separate account, dividends from actual against assumed, smoothing allowed, smoothing's purpose, the
      unsmoothed return, the actuary's report, the board's discretion, not guaranteed, the shareholder share. Each
      entry has:
      - the fact's `value`, verbatim, in a `<blockquote>`;
      - the label from section 4.4 (statute, or "OSFI expects; a guideline, not law");
      - the source link and `as_of`.

      The shareholder entry adds one computed sentence: "For a company with shareholders, at most {2.5%} to {10%} of
      the profit set for distribution in a year can go to shareholders, depending on the accounts' size. A company
      without shareholders has no such transfer." The second sentence follows the fact's "Companies with share
      capital only".
   3. **"What is set in the contract, and what is not guaranteed."** Two short lists, [PRACTICE] in the guide's
      sense, so there are no citations and the copy says "typically":
      - Typically set in the contract, if the required premiums are paid: the premium, the base death benefit and a
        table of cash values.
      - Not guaranteed: dividends, the credited rate, and anything dividends pay for. A dividend already added to a
        policy typically stays; a later lower dividend does not take it back.
   4. **"Why real dividends differ from an illustration."** Three sentences:
      - "An illustration shows what happens if today's dividend scale never changes. It will change, so real values
        will differ."
      - "Many illustrations also show a lower scale for comparison; that is not a worst case."
      - "Small differences add up over decades."

      Then the neutral redirect: "For a real policy, the insurer that issued it can provide an updated in-force
      illustration, and a qualified professional can explain it." There is no link and no contact path.
   5. **"Where to read the rules."** One line from `par_policies_on_request`: a participating policyholder can ask for
      the insurer's dividend policy and participating account management policy, free. A second line: OSFI expects a
      yearly statement showing the credited rate beside the unsmoothed return (`par_return_unsmoothed`). Neither
      names anyone.
   6. **"Words used here."** A glossary in our own words, `<dl>`, eight entries: par account, dividend scale, credited
      rate (dividend scale interest rate), actual return, smoothing, bond ladder, paid-up addition, dividend class.
   7. **"The numbers behind the chart."** A table with columns year, actual, credited and bond yield (real). The
      first column is held. The caption gives the typical (median) year-to-year moves ("In a typical year the actual
      return moved {6.1} points from the year before; the credited rate {0.8}."). On a phone the caption counts the
      columns off-screen.
2. **This example assumes** (the one assumptions block; a `.callout` in four groups, three columns from 960; each item
   16 words or fewer; every figure from EXAMPLE or the data):
   - **The account:**
     - One made-up par account, {1980} to {2025}.
     - {65%} bonds and loans; the rest stocks and property.
     - Bonds on a {10}-year ladder, held to maturity; one rung matures each year.
     - Every bond priced on one flat curve at the long bond yield.
   - **The returns:**
     - Bonds and loans earn {1.0} point over government yields.
     - Stocks and property are expected to earn {4.0} points over the long bond yield.
     - Their surprises follow an invented 13-year pattern that follows no real market.
     - The pattern: {+12, +18, −8, +5, −26, +14, +9, −16, +3, −11, +7, −2, −5} points, from {1980}.
   - **The smoothing:**
     - Bonds count at the yield they were bought at.
     - Stock and property surprises are spread evenly over {5} years.
     - Each year's credited rate here uses that year's own results. A real dividend scale is typically set in
       advance, so it would trail by about a year more.
     - The smoothing period is our assumption, not any insurer's, and methods differ.
   - **Left out:**
     - Deaths, lapses, expenses and taxes; only investments move here.
     - Investment costs, surplus and the shareholder share.
     - How a dividend is shared among policies.
     - Any policy's values or dividends.

   Closing line: "How any of this applies to a real policy is a question for the insurer that issued it or a qualified
   professional."
3. **Sources** (desk fold):
   - For each fact used: its title, its source link (laws-lois.justice.gc.ca or osfi-bsif.gc.ca) and its as_of.
   - The data block, from the snapshot's own fields: `attribution` (verbatim: the Statistics Canada line, then the
     Bank of Canada line), `changes` (verbatim), "Retrieved {retrieved}", and links to `source_url`, `licence_url` and
     `terms_url`.
   - The note: "These rules were checked against the Insurance Companies Act, the Policyholders Disclosure Regulations
     and OSFI Guideline E-16 on {as_of}; reference data, verify at the source."
   - The version line: "Version {hash} · data retrieved {retrieved} · made in this browser; nothing was sent." The
     `{hash}` is the first 8 hex of sha256 over model.mjs, the used facts and the snapshot.
4. **Up next:** one `a[data-next]`, resolved through the flag rule (section 12). Today that is "What's your next tax
   date?" (tax-dates).

---

## 8. "How this is worked out" (inside the readout, closed; filled live)

1. Each year the made-up account holds {65%} in bonds and loans on a {10}-year ladder, and {35%} in stocks and
   property.
2. **Actual return:** the bonds at market value (their prices rise when yields fall, and fall when yields rise), plus
   {1.0} point; and the stocks and property at the long bond yield plus {4.0} points, plus that year's made-up swing.
3. **Credited rate:** the bonds at the average yield they were bought at, plus {1.0} point; and the stocks and property
   at their expected return, plus each swing spread evenly over {5} years.
4. **The figure:** the credited rate's biggest change from one year to the next, {1980}–{2025}, is {2.5} points (into
   {2022}). The actual return's is {14.1} (into {2004}). In a typical year the credited rate moved {0.8} points and the
   actual return {4.9}.
5. Because the made-up swings repeat every 13 years, some spreads line up with them better than others, so the figure
   doesn't always fall as the years go up.

When N = 1, step 3 adds: "Even with no spreading, bonds held to maturity count at the yield they were bought at." In
the steady state, steps 2 and 3 drop the swing and the spread.

---

## 9. No print sheet, card or share in v1

There is no Save as one page, no Save my card and no `navigator.share`, and `.btn-you` is not used. The page has no
amber action. Revisit only after firm compliance approves the page (the corporate-insurance precedent).

---

## 10. Honesty and compliance

1. **No insurer, product or report name anywhere**: page, code, data, tests, fixtures, SPEC, commits, the making-of
   mdx and the poster.
   - The guide's Part 3 list (the four insurers researched and their related names, their product and report titles,
     every other Canadian life insurer it lists, and the carrier wording it flags) is held in
     `tests/blocklist.sha256.json` as salted SHA-256 hashes of normalized terms, plus a planted canary. It was
     generated on 2026-11-17 from the guide, outside the repo. No name is typed into any repo file.
   - The site's private denylist (`../mo-sample-portfolio/private/denylist.txt`, read by `check:dist`) gets the same
     names in plain text. It is outside every repo.
   - The ordinary word "equitable" is not blocked; the hashes cover only the guide's multi-word forms, the possessive
     and the product name.
2. **No carrier numbers.** The tool's numbers come only from the bond snapshot, EXAMPLE/PAT/BOUNDS and facts.json. The
   carrier figures the guide lists are hashed in the same file. A test checks that no default lands on one; a model
   output that happens to equal one is fine, as the guide says.
3. **No carrier wording.** The flagged phrases are hashed and checked like names. Every line is written fresh.
4. **Smoothing is a setting.** The control label, the assumptions block and step 3 all say the period is chosen here.
   The page never says "insurers spread gains over N years" or "a typical period". The words test bans "typical
   period", "smoothing period of" and "insurers use".
5. **Not guaranteed, every time.** The not-guaranteed line sits under the answer on the first screen, every
   "guarantee" sentence is a negative one, and Go deeper quotes the facts.
6. **Never a reason to buy.** There is no "why own par", no comparison with other products (no GIC line), no dollar
   figures, no sales path, no contact prompt, no LLQP and no title for Mo. The redirect line is neutral and has no link.
7. **The invented pattern and real years.** The pattern starts in 1980 and repeats every 13 years. By coincidence it
   puts made-up dips on some years known for real market falls (−16 in 1987 and 2000; −8 in 2008). The page never
   names a real market event, and the chart readings name only the model's own worst and best years (2013 and 1982
   at the example). Open question 2 offers Mo a shifted start.
8. **No endorsement implied.** The Statistics Canada and Bank of Canada lines are shown verbatim. OSFI is cited as a
   source, never as approving anything.
9. **Facts are Claude-checked** under the standing OK of 2026-11-12 and noted "Mo to review before the site is
   advertised". The Sources note claims only that the rules were checked against the source.

---

## 11. Build files

- `labs/par-dividends/build.mjs`, `model.mjs` (written: ASSUMPTIONS, the port, RULES, summary, FORMAT), `index.src.html`, `app.js`, `style.css`;
  `fixtures/reference-run.json` (written); `tests/` (section 13; `bond-data.test.mjs` and `blocklist.sha256.json`
  exist).
- **build.mjs:**
  - reads `shared/data/long-bond-yield-yearly.json` and `shared/facts.json`;
  - runs `yieldsFrom` and `parRules` (it stops on a required fact, naming the id);
  - inlines into the page, as one JSON block: the snapshot's `values` from `start − max(BOUNDS.L)` (1960) to the
    last year, its attribution, changes, retrieved date and URLs, and the used facts;
  - writes `dist/index.html` (self-contained, fonts inlined, no request after load, noindex while unlisted) and
    `dist/poster.json`.

  The page computes every run live from the inlined values, and no bond value is typed anywhere.
- **poster.json:** kind `lines` (the existing kind; no new drawing):
  - two series, credited and actual at the example, x from 1980 to the last year;
  - one reading, `{ label: "credited rate's biggest one-year change", value: '2.5 points' }`;
  - labels "Credited rate (made-up)" and "Actual return (made-up)";
  - example "A made-up account on real bond yields · Hypothetical illustration";
  - source "Bank of Canada data via Statistics Canada";
  - 8 KB or less.

  If the `lines` drawing cannot show a negative bar series, the poster draws the actual return as a thin line; the
  page keeps bars.
- **package.json:**
  - add `node labs/par-dividends/build.mjs` to `build`;
  - add `labs/par-dividends/tests/model.test.mjs`, `no-hardcoded.test.mjs`, `words.test.mjs` and
    `blocklist.test.mjs` to `test` (`bond-data.test.mjs` is already there).
  Playwright picks up `tests/page.spec.mjs`.

---

## 12. Placement behind the flag

### planning-lab: `shared/desk/next.json`

Insert the tool after company-life-insurance, and point that tool's door at it:

```json
{ "slug": "company-life-insurance", "labSlug": "corporate-insurance", "question": "Where does a company’s life insurance payout go?", "next": "par-dividends", "listed": false },
{ "slug": "par-dividends", "labSlug": "par-dividends", "question": "How do participating policy dividends work?", "next": "tax-dates", "listed": false },
```

- **While unlisted:** `resolvedNext` follows both unlisted tools, so estate-freeze's `to` stays `tax-dates`. Every
  dist shows exactly what it shows today. The new tool's own Up next is Tax dates, and no film points to it.
- **No code change** in desk-page.mjs: `isListed`, `effectiveNext`, `resolvedNext` and the noindex in `headTags`
  already exist.
- **`shared/desk/tests/listed.test.mjs`** gains:
  - while both are unlisted, estate-freeze and company-life-insurance resolve to tax-dates;
  - on a copy with only par-dividends listed, estate-freeze resolves to par-dividends (through the unlisted
    company-life-insurance);
  - no other lab's dist contains `href="/tools/par-dividends/"`;
  - its dist carries noindex.

### mo-portfolio-site (exact files)

1. **`src/lib/placement.mjs`:** `MORE` becomes `['money-then-now', 'company-life-insurance', 'par-dividends',
   'tax-dates', 'retirement-wave']`. `toolsPage` already filters by listed. There is no new panel shape.
2. **`src/content/projects/par-dividends.mdx`** (new):
   - `hed` is the question; `dek` from section 1; `kind` "Tool"; `verb` "Drag"; `asOf` 2026-11-17.
   - `posterAlt`: "A made-up participating account's yearly actual return as bars, its smoother credited rate as a
     line, and the real long-term Government of Canada bond yield, 1980 to 2025."
   - The write-up angle: "Explaining participating dividends with no insurer in it: real bond yields, a made-up account
     and the rules quoted from the statute and OSFI."
   - It never names an insurer, a product, the employer or LLQP, and says the smoothing period is a setting.
3. **`scripts/covers.mjs`:** an entry `['par-dividends', '#par-chart', null, 480]` and a `FIRST['par-dividends']`
   licence and credit line in the corporate-insurance pattern. The licence names Statistics Canada's Open Licence and
   the Bank of Canada's terms for the data; the credit names "a made-up account, hypothetical illustration, education
   only". Then **`npm run og`** renders `public/og/tools/par-dividends.png` and records it in
   `src/data/og-posters.json`. This is needed while unlisted, because the dist check requires og:image.
4. **`src/components/posters/par-dividends.astro`:** the `lines` poster.
5. **`scripts/headlines.mjs`:** no change. The dek has no figures.
6. **`npm run sync-labs`** copies the dist and poster, and writes src/data/next.json with `listed` and `to`.
7. **`npm run build`** runs `scripts/csp.mjs`, which regenerates the inline-script hashes in `worker/csp.json`.
   `tests/csp.test.mjs` and `tests/e2e/csp.spec.ts` must pass on it.
8. **Tests:**
   - `tests/unlisted.test.mjs` and `tests/e2e/unlisted.spec.ts` already cover every `listed: false` tool.
   - Add to `tests/unlisted.test.mjs`: on a flipped copy, `toolsPage().more` holds par-dividends after
     company-life-insurance when both are listed, and after money-then-now when only it is.
   - `tests/e2e/indexes.spec.ts`: the More tools count is 3, plus 1 for each listed insurance tool.
   - Add the plain names to the private denylist (section 10.1).
9. **Unchanged:** home (`src/data/front.json`), the films, Base.astro, tools.ts, copy.ts and the how-i-made-it route.

### Once `"listed": true`

The flip is one edit. Then run `npm run check` here, `npm run sync-labs`, and `npm run check` in the site.
- **The chain:** … Estate freeze → (Company life insurance, once listed) → **Participating policy dividends** → Tax
  dates → …
- **/tools/:** the tool appears in More tools.
- **/how-i-build/:** it lists the making-of page.
- noindex goes, and the tests flip their expectations from the flag.

---

## 13. Tests

### planning-lab

- **`tests/model.test.mjs`:**
  - **Port parity:** each of the 19 cases in `fixtures/reference-run.json` matches `run()` within 1e-8 (year,
    bond, actual, credited). This is the guard that the port stays exact.
  - **Data used, not typed:** `yieldsFrom` on the snapshot gives one yield per year with no gap. Each `run()` row's
    `bond` equals the snapshot's December value (to 1e-12). Removing one year from a copy makes `run()` throw,
    naming that year.
  - **Summary at the example** (end 2025, on the fixture's snapshot): 2.5 (2022), 14.1 (2004), means 8.71/8.75 ±0.01,
    low 2017, high 1982; N = 1 gives 14.2 and N = 10 gives 1.4; the figure falls with every N and never lands on 1981;
    no swing outside −5 to +9 on 1987, 2000–2002, 2008, 2020 or 2022.
  - **Invariants:**
    - `PAT` sums to 0;
    - with STEADY, the credited line is identical for every N;
    - for N = 1, credited − actual is the same with swings and with STEADY (to 1e-9): with no spreading, the gap is
      only the bonds counted at purchase yield;
    - the averages' gap stays under 0.3 points over every slider, ladder and swings setting (0.14 at most today);
    - w and L change both lines; each row is finite.
  - **Rules:** each required fact removed or set to unverified throws, naming its id. Optional facts removed give no
    throw and drop their field. The shareholder range from the tiers is 2.5 and 10, and both appear in the range
    fact's value.
  - **Format:** "1.9", "−2.9", "14.5", "8.6%", and "0.0" for negative zero.
- **`tests/no-hardcoded.test.mjs`** (the estate-freeze pattern, with a planted-figure self-check):
  - No used fact's text value (or any 40-character slice of it) appears in model.mjs, app.js, build.mjs,
    index.src.html or style.css: the page reads them.
  - The tier figures do not appear as typed strings in model.mjs, app.js, build.mjs or index.src.html: "2.5%",
    "7.5", "10%", 250000000, 500000000, 1000000000. (style.css is left out of the percent strings, since CSS uses
    them for other things.)
  - **No bond value is typed:** every snapshot value whose hundredths digit is not 0 (for example 15.27, 12.67,
    11.69), as written in the snapshot, appears in none of the five source files.
  - In model.mjs, outside the ASSUMPTIONS and FORMAT blocks, the only numeric literals are 0, 1, 2 and 100 (true
    today).
  - Every fact id the page reads exists and is confirmed. EXAMPLE carries "Example assumptions, not facts".
  - **The dist carries the data:** the inlined values block in dist/index.html deep-equals the snapshot's values from
    1960. The dist's first-paint readout text equals `pts(summary(run(Y)).maxMoveCredited)`.
- **`tests/words.test.mjs`**, over the dist's visible text, aria strings and the `<desc>`, poster.json and the
  making-of mdx (read from the site repo when present):
  - It fails on the banned words in section 1 and on `\$\s?\d`.
  - It fails on "the insurer's" and "your insurer".
  - Every sentence with "guarantee" (any form) also contains "not" or "cannot".
  - Every sentence with "smoothing period" or "spread … over" contains "our assumption", "set above", "a setting" or
    "this example".
  - It requires the stamp, the not-guaranteed line, the assumptions line, "our assumption, not any insurer's", both
    attribution lines verbatim, `changes` verbatim, and the closing professional line.
  - The H1 is 12 words or fewer, 60 characters or fewer, with no digit.
- **`tests/blocklist.test.mjs`:**
  - **Self-check:** the matcher finds the canary when planted in a sample text, and finds nothing in "fair and
    equitable" or "Canada's long bond yield".
  - **No blocked term** (any 1-to-maxN word run, normalized and hashed as the file's note says) in: every file under
    `labs/par-dividends/` except `tests/blocklist.sha256.json`, `dist/index.html`, `dist/poster.json`,
    `shared/desk/next.json`, and, when present, the site's `src/content/projects/par-dividends.mdx`,
    `src/components/posters/par-dividends.astro` and `public/tools/par-dividends/`.
  - **Commit messages:** `git log --format=%B -- labs/par-dividends shared/data/long-bond-yield-yearly.json` hashed the
    same way, with no hit. It is skipped with a note when git history is unavailable.
  - **Defaults:** none of N, w × 100, L, spread × 100 or prem × 100, as toFixed(2), hashes to a listed carrier figure.
- **`tests/page.spec.mjs`**, at 390 and 1440, in light and dark:
  - expectShell(page, 'par-dividends'); expectTemplate; expectStorageClean; expectTextSizes(page, 17.5, 17.5); axe
    (wcag2a/aa, 21, 22aa); expectReducedMotion, with the slider's ArrowRight as the act.
  - At 390: the big figure's bottom is at y ≤ 700, and the Go deeper summary at y ≤ 2,800. There is no horizontal page
    scroll at 390, 768 or 1440.
  - Text sizes are rechecked with Go deeper open and the table scrolled.
  - **Zero label collisions** on the chart for N 1–10 with swings, N = 5 steady, w 0.5 and 0.9, and L 5 and 20, at 390
    and 1440.
  - The averages line and both state titles render correctly at every N (with and without steady).
  - Changing a Go deeper control changes the readout and the chart, shows the echo line, and "Back to the example"
    restores the first paint's text exactly.
  - A tapped year's reading stays after touchend.
  - The non-text contrast in section 6 holds in both schemes.
  - The aria-live readout's figures match the chart's `<desc>`.
  - The noindex meta is present while unlisted, and no request is made after the load event.
- **`shared/desk/tests/listed.test.mjs`:** the additions in section 12.

### mo-portfolio-site

- The unlisted tests run over the new slug automatically, plus the additions in section 12.
- check:dist runs compliance, the denylist (now with the insurer names), one Up next and og:image.
- sizes.spec.ts checks text at 17.5px or more on the More tools tile once listed.
- The csp tests run on the regenerated hashes.

### Before Mo sees it

Run three cold reads on the built page:
- a policyholder who owns a par policy, at 390;
- a planner, at 1440;
- a skimmer, at 390.

Each answers: what is the credited rate, is the dividend guaranteed, and whose method is this? A reader who thinks the
5 years is how insurers do it is a failure to fix. Fix what they trip on, with at most two rounds. Then send Mo the
screenshots at 390/768/1440 in both schemes.

---

## 14. Open questions for Mo (none block the build)

1. **The H1.** "How do participating policy dividends work?" (your approved title; built) or "Why do participating
   policy dividends move slower than markets?" The second matches the chart and the answer more tightly. It is one
   string in next.json.
2. **The invented pattern's years.** Started in 1980, it puts made-up dips on 1987, 2000 and 2008 by coincidence. The
   page never names those events. Starting the cycle at a different offset would move them, but it changes the
   reference run, so it needs your say.
3. **The facts review.** The 11 entries added on 2026-11-17 under the standing OK are marked "Mo to review before the
   site is advertised". The review comes before the flip, together with the firm's compliance OK.
4. **Go deeper's "set in the contract" list** is general practice with no citation (the facts file holds no rule on
   it). Keep it, or cut it to the not-guaranteed half, which the facts back.
