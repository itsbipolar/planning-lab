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
