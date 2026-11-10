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
