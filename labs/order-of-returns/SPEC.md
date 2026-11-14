# SPEC: The Order of Returns (P2, rebuilt 2026-11-13)

*First written 2026-11-10; rebuilt 2026-11-13 in the Data desk look after a review. Synthetic throughout: not historical,
not a forecast. Education only; never a recommendation.*

## 1. What it is
A data-desk explainer of sequence-of-returns risk. Two fictional retirees, Ruth and Sam, get the same ten market years in
a different order. The page leads with the finding, then runs **every possible order** of the ten years (10! = 3,628,800)
in the browser and shows where Ruth, Sam and the reader's own deal land. It shows that the first five years drive the
result, solves for the withdrawal that rescues Sam, compares three levers side by side, and adds a Canadian lane: RRIF
minimum withdrawals from the confirmed facts. It ends with questions for a qualified professional, never a verdict.

## 2. Decisions
| Item | Decision |
|---|---|
| Look | The shared Data desk look: `deskCSS()` from `shared/desk/desk.mjs` before `style.css`. Dark by default, light via `data-theme="light"` (a header button, nothing stored). Source Serif 4 headlines, Libre Franklin text and figures (tabular), IBM Plex Mono small labels only |
| Layout | One scrolling page (it was six stepped scenes). Redesign v2 step 2 (2026-11-13): the H1 is the short question shared with the site (`Same {ten} years. Why does one retiree run out?`, the count filled from story.json at build and checked against shared/desk/next.json), the finding under it as the lede, one assumptions line, kicker GAME. Each section: an uppercase label on a 2px ink rule (no numbers), a serif headline that states the finding, then the chart in the shared frame (plain-words title, units line, an Example data tag) at the full content width. Chart text is drawn at real pixel size, 17px or more (`TXT` in app.js); labels thin or wrap rather than shrink |
| Colour by data type | Ruth `--t-d1` (blue), Sam `--t-d4` (rose), your order `--t-d2` (amber), counts of orders `--t-d3` (teal), "before" `--t-ink3` (grey). In light mode the amber label text uses `--t-ink` (contrast) |
| Numbers | Every number on the page is computed from `story.json`, the engine and the confirmed facts at load; none is typed in. The headline, section headlines and summaries are built from engine results |
| Story numbers | `story.json`: $500,000, $25,000 in the first year rising 2% a year, 25 years, ten cards averaging 4%, every later year at that average. `startAge` 65 is illustrative and used only by the RRIF lane |
| Every order | Exact enumeration (`enumerate.mjs`), depth first so orders share their common first years, with the same arithmetic as `simulate()` (tested). It runs in a Web Worker started from a `blob:` URL (no request), with progress; if no worker can start, it runs on the page. Measured: about 0.55 s in Node, 0.65 to 0.8 s in headless Chromium, so no sampling fallback is needed. The page shows its own timing |
| Ranking | Better = lasts longer; if both last, more left; if both run out the same year, more paid out before. "Your order does worse than X% and better than Y%", ties counted |
| Early years | A binned heat strip: columns = average of the first five years (bins from `niceStep`), rows = lasts / runs out in year N, shading = share of that column's orders; share that last printed above each column; a rule marks where every order to the left runs out |
| Rescue | `largestLastingWithdrawal` (binary search on the engine, whole dollars) for Sam's order. Small multiples: flex rule, cash buffer, and the solved withdrawal, each against Sam before. Then "Mix your own" |
| RRIF lane | Off by default. Facts: `rrif_minimum_factors`, `rrsp_maturity_age` (confirmed; the build fails without them; source links and as-of dates shown). Assumptions stated on the page: all savings in a RRIF; age `startAge` at the start of year 1; RRIF from the end of the year they turn the maturity age; from the next year, the withdrawal is at least start-of-year balance x the factor for the age at the start of that year. The extra that leaves the RRIF is not tracked; tax is left out (said on the page) |
| Labels | A 1-D label-avoidance helper (`spread` in `app.js`): colliding labels merge into blocks centred on their wishes, clamped to bounds. Used for line-end labels (a gutter; words wrap on narrow and small charts), year-10 readings, and histogram and heat-strip markers (with leaders) |
| Save image | "Save this chart as an image": the "your order" chart is redrawn at 1200 px, its computed styles inlined, the page's fonts embedded, then drawn to a canvas and saved as PNG with the title, the synthetic line and a credit with the date. Made in the browser, no network |

## 3. Engine
`simulate({ start, withdrawal, indexation, returns, flexRule, cashBuffer, minimumFactors })` in `engine.mjs`: one step a
year; the withdrawal is taken at the start of the year, then the invested money earns that year's return. Flex: after a
negative year, the next withdrawal is cut by `trim`. Buffer: hold `years` of withdrawals in cash at 0%; after a down year
draw from cash first; after an up year top it back up. Minimum (RRIF lane): the withdrawal is at least
`minimumFactors[t]` x the start-of-year balance; `forced[t]` is what the minimum added. Returns balances, planned, paid
and forced withdrawals, the depletion year and the end balance. `rrifFactorsByYear` builds the factors from the facts
(a missing age throws). `largestLastingWithdrawal` is the solver. `enumerate.mjs`: `enumerateOrders`, `orderAt`,
`rankOutcome`, `summarize`.

**Tests (`tests/engine.test.mjs`, 17):** the original properties (order irrelevant without withdrawals, golden case, story
depletion years, no NaN or negative values, levers, bad inputs); the minimum raises the withdrawal exactly as written and
zero factors change nothing; RRIF factors follow the facts; the solver's amount lasts and one dollar more does not;
`orderAt` numbers every order once; all 10! orders run and each matches `simulate` (sampled, with and without
minimums); counts sum to 10!, groups cover every order (each first-five set in 5! x 5! orders); Ruth's order is the best
and Sam's the worst; without withdrawals every order ends with the same balance; with minimums no order lasts longer or
ends with more; no age or factor from the facts is written into the page code.

## 4. Sections
1. The question, the finding under it, and the lead chart: Ruth and Sam, the dealt years shaded, readings at year 10 and at the end.
2. No withdrawals: shuffle Sam's years; every order ends with the same amount.
3. Deal the ten years yourself (buttons, keyboard), with the save-as-image button.
4. Every possible order: progress, histogram of how the orders end, Ruth/Sam/your order marked, your rank, a table.
5. The first five years: the heat strip.
6. Rescuing Sam: the solver headline, three small multiples, "Mix your own" (the old scene 5, fixed: the sentence says
   when the year does not move and what changes instead, never repeats itself, and the labels never collide).
7. The RRIF lane.
8. Questions worth asking, and what this leaves out (taxes, fees, pensions and benefits, real history, and more).
Footer: one education line, one AI line.

## 5. Banned
"safe withdrawal rate", any withdrawal *rate* framing, "you should", "recommend", named securities, funds or products,
"guaranteed", "CFP", "Financial Planner/Advisor". The page spec greps the built page.

## 6. Done when
Engine tests green; `tests/page.spec.mjs` green at 390 and 1440: a keyboard playthrough (finding, every order, rank,
rescue sentences, RRIF lane, image download), no text overlapping in any chart, every text at 16.5px or more (SVG scale included), every chart tagged Example data and one assumptions line, no
request after load, nothing stored, no horizontal scroll, axe clean in dark and light with every chart drawn, nothing
animated under reduced motion.
