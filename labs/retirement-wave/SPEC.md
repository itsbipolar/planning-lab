# The retirement wave (P5a): spec

A heatmap of how many Canadians were each age from 50 to 89 on July 1 of every year in Statistics Canada's table
17-10-0005-01, with the rule ages from the verified facts file (CPP start window, OAS start and deferral, RRSP maturity)
as dashed lines. Mo picked this direction on 2026-11-11, as one of three P5 subprojects. Education only.

- Data: `shared/data/population-by-age.json`, a dated snapshot made by `npm run fetch-population` (never at load). Ages
  90 and over are left out: single years start in 2001. Attribution, citation, DOI and StatCan's notes travel with it.
- `model.mjs` computes everything shown: rule ages (confirmed facts only; a missing one is left out), each rule age's
  series, first, last and peak, the colour range, and generations (diagonals: the people aged a on July 1 of y were born
  July 2, y-a-1 to July 1, y-a). No count, year or age is typed into code (a test checks).
- Page: heatmap (shade = count), rule lines, one callout (the youngest rule age's peak), "follow one generation" slider
  (amber outline, once), one-rule-age line chart with its peak, both as tables, sources and notes, education and AI lines.
- History only: no forecast. A generation's later rule ages are named with "after the data ends", without counts.
