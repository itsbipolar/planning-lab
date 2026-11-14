# Handoff (2026-11-14)
1. Redesign v2 steps 1-6 done: every public tool is built on the desk template (shared/desk: desk-ui.mjs, desk-page.mjs, shell-test.mjs expectTemplate).
2. Public tools: planning-timeline (your-year), order-of-returns, two-number-letter (when-to-start-cpp), money-then-now (with #this-year), planning-calendar (tax-dates), retirement-wave.
3. Archived: labs/_archive/ holds money-milestones, ages-that-matter, money-stripes, money-year; labs/money-year/model.mjs stays because the money-year reel reads it.
4. Shared: your-year-core.mjs (home lead and Your year), poster.mjs (dist/poster.json for the site's SVG posters), next.json and site-nav.json (checked by the site's sync).
5. Storage: localStorage theme only; sessionStorage mo.year only; nothing in the URL but #this-year.
6. Template budgets at 390: first move and answer <= 700px, Go deeper <= 2,800px, one assumptions block, one Up next.
7. Text floor: 17.5px rendered, SVG included (expectTextSizes).
8. Known gaps: Tax dates week strip sparse on phones; Retirement wave 70/71 labels tight at 390.
9. After a change: npm run check here, then npm run sync-labs and npm run check in mo-portfolio-site.
10. Never type a fact figure; the no-hardcoded tests check it.
