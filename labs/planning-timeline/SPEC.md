# Your planning timeline (Phase 2 flagship, 2026-11-13)

Merges Money milestones and The ages that matter. A birth year (an example, 1965, until the visitor types one) gives:
- A headline sentence for that person (model.mjs `finding`).
- A full-width timeline from the TFSA minimum age to the last RRIF factor age: TFSA room built up since the later of
  age 18 and 2009 (sum of confirmed yearly limits), the CPP and OAS start windows with their monthly change at each end,
  the OAS increase from 75, the RRSP maturity year and the RRIF minimum staircase; a "you are here" line, the past muted.
- Three cards: when to start CPP and when to start OAS (sliders by month, the share of the standard amount, the age at
  which totals cross, a totals chart in "years of the standard pension"; pure arithmetic, said so), the OAS recovery tax
  on an example income for the latest confirmed threshold year, and the RRIF minimums with the share of a fund left at 90
  if only minimums come out and it earns nothing, on an example fund.
- People your age (Statistics Canada, ages 50 to 89 in the snapshot).
- Save the timeline as an image (made in the browser). No request after load; nothing stored; inputs stay out of the URL.
Rules come only from shared/facts.json (confirmed); tests check the arithmetic and that no rule value is typed in.
