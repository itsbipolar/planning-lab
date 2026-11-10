# SPEC: The Order of Returns (P2)

*Written 2026-11-10 (Opus session). Mo asked for the build to go ahead on Claude's judgement, so the interview the plan
called for was skipped; the decisions below are Claude's and are marked as such. Synthetic throughout: not historical,
not a forecast.*

## 1. What it is
A playable explainer in the format of Nicky Case's *The Evolution of Trust* (CC0): two fictional retirees get the same
average return in a different order. The reader shuffles years, adds withdrawals, deals the market years themselves, then
tries to rescue the plan in a sandbox. It ends with questions for a qualified professional, never a verdict.

## 2. Decisions (Claude's, 2026-11-10)
| Item | Decision |
|---|---|
| Language and tests | Plain JavaScript ES module and `node:test` (not TypeScript and Vitest): the engine runs unchanged in the browser and the tests, with no build tools, like the other labs. The guarantees are the same |
| Format | One self-contained page (like the other labs): scenes are steps with Back and Next buttons, keyboard playable, nothing stored |
| Story numbers | `story.json`: $500,000 at the start, $25,000 in the first year, raised 2% a year, 25 years. Ten cards averaging 4%; every later year earns that average. Good years first: money left at year 25. Bad years first: runs dry in year 20. No withdrawals: identical end |
| Personas | Ruth (good years first) and Sam (bad years first), both `synthetic: true`, named in type, no faces |
| Golden case | Computed independently of the engine, step by step in `tests/golden.py`, with the year table written into `fixtures/golden.json` (Mo did not compute it by hand: the case study says so) |
| Sandbox levers | First-year withdrawal (amount), "spend 10% less after a down year", "keep two years of withdrawals in cash". Framed as "what planners look at", never as a recommendation |
| Drag numbers | Native sliders and number inputs instead of P6's drag component (P6 is not built yet) |

## 3. Engine
`simulate({ start, withdrawal, indexation, returns, flexRule, cashBuffer })` in `engine.mjs`: one step a year; the year's
withdrawal is taken at the start of the year, then the invested money earns that year's return. Flex: after a negative
year, the next withdrawal is cut by `trim`. Buffer: hold `years` of withdrawals in cash at 0%; after a down year draw from
cash first; after an up year top the cash back up from the invested money. Returns balances, planned and paid withdrawals,
the depletion year (first year a withdrawal could not be paid in full) and the end balance. Inputs are validated.

**Tests (`tests/engine.test.mjs`):** reversed and shuffled returns with zero withdrawals give the same end value (property,
seeded); the golden case; the story's depletion years; no NaN and no negative balance under random inputs, with and without
the levers; paid never above planned; the flex and buffer rules behave as written; bad inputs throw.

## 4. Scenes
1. Meet Ruth and Sam: same savings, same yearly draw, same ten years of returns with the same average. Synthetic.
2. Shuffle with no withdrawals: a Shuffle button; both always end with the same amount.
3. Add withdrawals: the two paths split; Sam runs dry years earlier. Chart title states the finding.
4. Your turn: deal the ten cards in any order (buttons, not drag), watch the balance; Reset and Deal at random.
5. Sandbox: the three levers on Sam's order; the chart and a sentence update.
6. Questions to discuss with a qualified professional.

Every chart: "Synthetic sequence: not historical, not a forecast." Each chart has a text summary for screen readers.

## 5. Banned
"safe withdrawal rate", any withdrawal *rate* framing, "you should", "recommend", named securities, funds or products,
"guaranteed". A test greps the built page.

## 6. Done when
Engine tests green; Playwright at 390 and 1440 plays every scene by keyboard, with reduced motion, no request after load,
nothing stored, axe clean in both schemes; the banned-phrase test passes; the page and case study are on the site.
