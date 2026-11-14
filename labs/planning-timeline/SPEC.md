# Your year (public slug your-year; redesign v2, step 5, 2026-11-14)

The question: "What opens, and when, for your year?" A birth year (the labelled example, 1980, until the visitor picks
one) gives, in page order (the desk tool template, shared/desk/desk-ui.mjs):
- One control, `data-first-move`: a year stepper (−, the field marked `data-year-control`, +) and the chips 1960 · 1970 ·
  1980 · 1990 · 2000. Live, no submit button. Bounds: 1930 to the last confirmed TFSA limit year minus the TFSA age.
  The year is kept for this visit only in sessionStorage mo.year (the tool-bar chip offers change and forget).
- The one assumptions line, `data-assumptions`, under the chips.
- One big answer, `data-answer`: "$100 → $N", what $100 from that year cost in the latest complete price year
  (shared/desk/your-year-core.mjs, the site's home lead's module), with "How this is worked out" closed.
- The box score (model.mjs `boxScore`), in the tense for the visitor's year (ahead: "Can start A to B"; open: "Can start
  any month until B"; passed: "Could start from A (that window has passed)"): TFSA limits added up to the last confirmed
  year ("opens in Y" when 0), CPP "if you qualify", OAS "if you meet the residence rules" with the confirmed increase at
  the later age, the RRSP wind-up "(most become a RRIF)" with the RRIF convention line, and Canadians of that age only
  where the Statistics Canada snapshot covers it (50 to 89; absent otherwise). Acronyms spelled out once in <abbr>.
- One life line chart by age, today marked, the CPP gradient labelled on the chart; then Save my card (a 1080x1350
  PNG drawn in the page, shared or downloaded, nothing sent).
- Go deeper (closed): the RRIF minimum curve with an example fund, CPP and OAS start ages in total (sliders, totals
  charts, the OAS recovery on an example income; a link to When to start CPP). Then Sources (with the January-1 factor
  detail), the Up next card and the notes.
Rules come only from shared/facts.json (confirmed); tests check the arithmetic, the tenses (1950, 1962, 1980), the
cohort range, the template budgets and that no rule value is typed in. No request after load; inputs stay out of the URL.
