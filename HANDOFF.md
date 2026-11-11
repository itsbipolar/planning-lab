# Handoff (2026-11-10)

**P3 reel shell and history reel (reels/), 2026-11-10, done:** `reels/history-45/out/`: history-45.mp4 (45.5 s, 1080x1920,
H.264+AAC, 13.9 MiB), history-45.vtt, contact-sheet.png, safe-zone-overlay.png and safe-zone-check.png, 7 carousel PNGs, carousel.pdf.
Mo's calls: dates confirmed (OAS 1952, RRSP 1957, CPP 1966 drafted here), beats approved, code-drawn print pictures (no photos
or stock, `shell/art.mjs`), look A "Paper" (`reel.json` "look"). Two render rounds: round 2 fixed the chart (vertical, labels never
collide) and put the drawings on the end card. 14 reel tests: preflight (missing, unconfirmed or absent fact; digit in text; the
render refuses), no fact year in code, every word inside the phone-app safe band, every carousel slide fits. All 39+42 checks pass.
Pinned: code-video 6e806a5 (read only), hyperframes 0.8.217 (lint and render, telemetry off), zzfx 1.4.0, gsap 3.14.2.
**Voice (Mo, 2026-11-10):** Archie (Higgsfield preset, seed_audio), one clip per card in `reels/history-45/voice/` (job ids in
SOURCE.md); the script was tightened with the vox repo's virality playbook and approved by Mo. Years are filled from the facts
and spoken as words (`spoken()`, tested). `shell/voice.mjs` trims silence, caps pauses at 0.45 s (never changes speed), times
each card to its line and mixes the voice over the ticks; captions follow the voice. Reel now 61.9 s, 17.6 MiB, -17.9 LUFS.
Spend: 9 clips, 4.70 Higgsfield credits.
**Voice fix (Mo: "moaning between transitions"):** the voice model had added stray sounds before or after four lines (OAS, span,
closing line, hook); silence trimming kept them. `shell/tools/align.py` (Vosk speech recognition, offline) now finds each line's
first and last real word and writes `voice/cuts.json`; the shell keeps only that window, with 12 ms fades at every cut. A test
checks every spoken year was heard. The finished mix transcribes as the nine lines and nothing else. Reel 59.4 s, 16.9 MiB. End card: "This voice is AI-generated." 17 reel tests pass.
**Web copies:** `--web` makes history-45.webm, a poster, contact-sheet.webp and the carousel as WebP slides with slides.json (descriptions) for the site (`npm run sync-labs` there).
**Next:** case-study MDX at /builds/reel-shell in the site (contact sheet + a failing-preflight demo), native video with the .vtt
on /explainers. Firm approval before any social posting. Stretch: one rights-checked archive photo beat, a French cut.

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

**P4 Money Year 2026, step 0 (2026-11-10):** Mo chose: the budget as P4's last chapter, public measures only. `npm run fetch-data`
now also writes `shared/data/money-year-2026.json` (Valet V39079, V80691335, FXUSDCAD, CPI_TRIM, CPI_MEDIAN from 2025-12-01;
refresh around Dec 1). 11 Budget 2026 proposals drafted in canada-planning-facts (unverified, `budget_proposal`); they reach
`shared/facts.json` only once Mo confirms. Budget Day's date: no quotable line on budget.canada.ca yet. Next: the graphed page.
**P4 page (labs/money-year):** Mo confirmed all 11 budget entries. `model.mjs` computes everything from the snapshot and the confirmed
facts (rate decisions, highs and lows, notes; proposals only from confirmed `budget2026_*`); `app.js` draws four small panels on one
shared time axis (no dual axis), callouts, a crosshair driven by pointer or slider, the proposals as a dated timeline stamped
"Proposed, not law", and a numbers table. 5 data tests (incl. no typed figures, proven able to fail) and 8 browser tests.
Budget Day stays unconfirmed (only the page's "Date modified" line), so the Growth Incentive reads "From Budget Day".
**Bolder (Mo):** the policy rate is the hero chart (area fill, heavier line, big callout), each chart shows start "to" now large,
a dashed Budget 2026 line (Budget Day confirmed by Mo) runs through every chart, and the proposals sit in 2026/2027/2028 columns.
**P4 reel (reels/money-year):** the shell now takes a data model (`reel.json` "data": the lab's model.mjs and the snapshot,
"{year}" = newest) and three card types: `series` (a measure: start to now, the chart drawing in, callouts landing), `section`
(Budget Day from the facts), `proposals` (one year's confirmed proposals by `offset` from the data year, stamps landing). 52.5 s,
14.6 MiB, 10-slide carousel + PDF, web copies. Preflight fails on an unknown measure, an empty proposals year or a missing model.
Safe-band and carousel-fit tests cover both reels. **Voice (Mo, 2026-11-11):** Archie narrates P4 from a script Mo approved; `say` lines fill figures, dates, years and
direction words ({up:edged up|eased}) from the data and facts (`spoken()`, `amountWords`, `dayWords`). 10 clips (about 5.7 credits;
rate-limited submissions charged nothing), align.py now needs two expected words in a row to start (a garble before the loonie
line contained "the") and accepts partial words ("posed" for "proposed"); history cuts unchanged. Reel 68.3 s, 19.4 MiB; the mix
transcribes as the ten lines only. **Web cut:** `--web45` renders the reel at 1080x1350 in the carousel layout (no empty band for
app buttons) for the site, for both reels; data cards are larger in that layout. Next: site page + case study; refresh ~Dec 1.
**Posters (2026-11-11):** a reel's poster is now its opening card once settled (drawings complete), not frame 0; `--posters` rewrites
the posters from videos already rendered. Both reels' posters redone. Site: P4's page, 4:5 reel, slides and case study synced (mo-portfolio-site HANDOFF).
**Fix (2026-11-11, Mo heard mistakes in the P4 voice):** T1135 applies to tax years that END AFTER the fact's year, so it now sits in the
next year's column (it was wrongly in this year's); the RRSP-for-life consultation (open from Budget Day) moved to this year; instalments
read "Tax years starting on or after". Page rebuilt and synced. Reel and carousel NOT yet re-rendered: they still say T1135 "from this
year" and need a revised script (Mo to approve) and new clips for next0/next1/next2 (clip faults: "posed", stretched "twenty-eight").
`tools/lines.mjs` now works for data reels.
**Re-voiced (Mo approved the corrected lines, 2026-11-11):** loonie "slipped", next0 "From Budget Day: … consultation on an RRSP for
life", next1 "From the {year} tax year: … foreign-property form", next2 "And from the {year} tax year". 5 new clips (one retake of next0),
3.70 credits (72.92 to 69.22); every new clip and the final mix transcribe as the approved lines only. Reel 66.0 s; carousel, web and 4:5 cuts redone.
**Cut-off words (Mo, 2026-11-11: "the federal budget…" was cut off):** the voice model had ended four files mid-word (P4 budget, next1,
sources; history rrsp). Re-recorded (budget at speech_rate 10: at normal pace the model stopped mid-word twice); align.py now records
`cut_off`/`tail_db`, the render refuses a cut-off clip, and a test checks both reels. Both reels re-rendered (P4 66.2 s, history 60.0 s);
the P4 slides carry the "Consultation" stamp. Spend this round: see the session report.
**P5 The Planning Year, session 1 (2026-11-11):** `labs/planning-year/`: SPEC.md, a seeded synthetic book (400 households, IDs only),
`triggers.json` (12 trigger types: each cites its facts; hours and lead weeks are assumptions; reviews are the one service item),
`engine.mjs` (dates from confirmed facts only, a type with an unconfirmed fact is pending; hours spread over weekdays; Q1 / birth-month /
client-quarter policies; CSV safe from formula injection). 16 tests (RRIF year, 21-year date, same seed, facts cited, pending, CSV,
no figures in code); rule tests use `fixtures/facts-with-drafts.json` (the six drafts as if confirmed; never read by a build). With the
drafts, Q1 reviews: peak 220 h/wk, 17 weeks over an 80 h assumption; by birth month: 158, 6 weeks. **Waiting on Mo** to confirm the six
facts (canada-planning-facts branch `p5-facts-draft`). Next: the page (heatmap drawn in SVG, filters, capacity line, policy panel,
assumptions, CSV download), then the site case study.
**P5 page (2026-11-11):** `labs/planning-year/dist/index.html` (181 KiB, self-contained): heatmap drawn in SVG (weekdays x weeks;
two halves on phones), weekly bars with the capacity line, week slider with a breakdown, review-policy radios, life-stage filter
from the CPP start-age facts, business/trust filters, comparison table, rules table with editable hours (assumption labels),
pending list, CSV download, sources. 12 Playwright tests (390/1440, axe both schemes). With today's facts 8 of 12 task types are
pending (the six drafts); `PREVIEW_FACTS=labs/planning-year/fixtures/facts-with-drafts.json OUT=<file> node labs/planning-year/build.mjs`
builds a look-ahead copy outside dist. Site case study waits for Mo's confirmations.
**P5 split (Mo, 2026-11-11):** the practice-workload heatmap read as too close to a firm's own operations; Mo kept the heatmap idea
and asked for three P5 subprojects, each treated as its own project: P5a The retirement wave, P5b The planning calendar by
household (replaces the practice version; needs the six facts), P5c The ages that matter. `labs/planning-year` stays unpublished.
**P5a The retirement wave (Mo approved the sketch):** `labs/retirement-wave/` + `scripts/fetch-population.mjs` (StatCan 17-10-0005-01,
1971-2026, ages 50-89, released 2026-09-23). Heatmap with rule-age lines from facts, a generation slider, one-age line chart, tables,
StatCan attribution/citation/notes. 6 data tests + 8 browser tests. Next: site case study on a branch, Mo looks before it goes live.
**P5 heatmap colours (Mo, 2026-11-11: "C: Blue into green", one shared scale):** `shared/heat-scale.mjs` (Money Stripes blue into the
"money" green, mixed in OKLab; light mode reversed in lightness), written as .h0-.h23 classes at build. P5a uses it; P5b and P5c will.
Rule lines carry a ground-colour edge so they show on every shade. P5b facts confirmed by Mo and synced.
**P5b The planning calendar (2026-11-11):** `labs/planning-calendar/` (Mo approved the sketch; asked for year-end items like
tax-loss selling). 11 households incl. RRIF, FHSA, RESP, donations and the superficial-loss period; 8 engine + 8 browser tests.
Five new facts are drafted (canada-planning-facts branch `p5b-facts-draft`): until Mo confirms them those rows show as pending.
Look-ahead preview: PREVIEW_FACTS=labs/planning-calendar/fixtures/facts-with-drafts.json OUT=<file> node labs/planning-calendar/build.mjs
**P5c The ages that matter (2026-11-11):** `labs/ages-that-matter/` (Mo approved the sketch and the RRIF example fund). CPP start
months, OAS deferral months, RRIF minimum by age; pickers with readouts; 5 data + 8 browser tests. Next: site branch, Mo's go.
**Removed (Mo, 2026-11-11: "if we're not using it, don't keep it"):** labs/planning-year, the unpublished practice-workload heatmap that P5b replaced.
