# Handoff (2026-11-10)

**Done:** `labs/money-milestones` (P7): single-file page built by `npm run build` into `labs/money-milestones/dist/index.html`
(styles, script, fonts and the facts inlined). Birth year in, 4,940 weeks out, four rules (TFSA from the minimum age,
CPP start window, OAS from the start age with deferral, RRSP maturity) placed beside the grid and listed as real text with
source, read-on date and authority. A rule missing from the facts is left out. 15 tests pass: no figure from the facts is
written in the code (and the check is proven able to fail), no request after load, nothing stored, nothing in the address,
bad input refused, very old and very young years, axe in both schemes at 390 and 1440, reduced motion.
**Next:** the site's case study and Home tile (in `mo-portfolio-site`); the page is copied into the site with
`npm run sync-labs` there. Update `shared/facts.json` with `npm run sync-facts` whenever `canada-planning-facts` changes.
**Mo:** push protection on for this repo (secret scanning).
**Later (stretch):** inflation tint from the P8 snapshot, a couple mode, a French version.

**P8 Money Stripes (labs/money-stripes):** single-file page like P7, built from dated snapshots in `shared/data/`
(`npm run fetch-data` refreshes them; the date inside each file is the retrieved date). Prices: annual change in the average
consumer price index, complete years 1915 to 2025. Second stripe: the Bank of Canada's weekly prime rate, annual average,
1975 to 2025. Note for Mo: the plan said "posted mortgage rate since 1975", but the Bank of Canada's mortgage and older
monthly prime series both stop in September 2019, so the current weekly prime series is used instead (it starts in 1975 and
continues). 8 data tests and 10 browser tests pass. Seeded covers and OG images from it are still to do (site v1).

**P2 The Order of Returns (labs/order-of-returns), Opus session 2026-11-10:** Mo asked for it to be built on Claude's
judgement, so there was no interview; the decisions are in `SPEC.md` section 2. Engine `engine.mjs` (plain JS, node:test):
8 tests (commutativity property, independent golden case from `tests/golden.py`, depletion years, 2,000 random runs with no
NaN or negatives, flex and buffer rules, input checks). Page: six scenes with Back and Next, deal-the-cards, sandbox; 8
browser tests (keyboard-only playthrough, banned phrases, axe on every scene in both schemes, reduced motion, no request,
nothing stored). Finding worth keeping: with both levers on, Sam runs out a year earlier, because cash earns nothing in the
model; the page says each lever has a cost. Not done: the P6 drag-number component (native sliders instead), the 9:16 capture.

**P6 A letter you can argue with (labs/two-number-letter), Opus 2026-11-10, built on Claude's judgement at Mo's request:**
`calc.mjs` reads every CPP/OAS rule from facts.json (start ages, 0.6/0.7 and OAS deferral per month, the latest OAS
threshold); 6 calc tests, including five cases computed independently in `tests/golden.py` (Claude, not Mo, computed them)
and 3 no-hard-coded-figure tests. `shared/drag-number.js` is the reusable drag-number (role=slider, arrows, Home/End,
pointer drag); every number also has a plain slider. Amounts (CPP $1,000, OAS $700, other $40,000) are illustrative, in
`story.json`. The OAS recovery tax itself is not computed (its rate is not in the facts), only the threshold flag.
6 browser tests at 2 widths: keyboard rewrite, pointer drag, axe both themes, sources, print to PDF, reduced motion.
