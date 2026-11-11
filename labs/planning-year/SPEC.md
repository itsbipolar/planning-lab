# The Planning Year (P5): spec

A GitHub-contribution-style heatmap of one year's workload for a fictional planning practice of 400 households. Every
dated trigger comes from a rule in `shared/facts.json` (confirmed values only); the households, hours and lead times are
synthetic or user assumptions, and say so. Education only: it shows how rules land on a calendar, not what anyone should do.

## Parts
- `book.mjs`: a seeded synthetic book (`synthetic: true`, IDs only: no names). Same seed, same book.
- `triggers.json`: the plan year, the team-capacity assumption and the trigger types. Each type names the facts it cites,
  its date rule, who it applies to, and two assumptions: hours per task and lead weeks (the work is spread over the
  weekdays from the lead start to the deadline). Annual reviews are the one service item: their dates come from the
  scheduling policy, not from a rule, and they cite no fact.
- `engine.mjs`: dates every trigger for the plan year (and the next year's deadlines whose lead work falls in the plan
  year), sums hours per day and per week, and compares three review policies: reviews clustered in Q1, spread by the
  primary member's birth month, spread by a client-chosen quarter. Measures: peak week, average week, peak-to-average,
  weeks over capacity. CSV export of the trigger list, safe from formula injection.
- `app.js` + `index.src.html` (next session): the heatmap (7 weekday rows x weeks), segment filter, capacity line,
  policy comparison, assumptions panel with editable hours, synthetic-data banner, CSV download.

## Rules
- A trigger type whose fact is not confirmed in facts.json is listed as **pending** with no date and is not counted.
  The RRSP deadline for the year's contributions and the general filing date stay pending until CRA publishes them.
- No fact value is typed into code (a test checks). Segments come from the CPP start-age facts.
- Hours and lead weeks are inputs labelled "assumption, not an industry benchmark". No real firm, client, employer
  workflow, segment or service tier. Nothing stored or sent; no request after load.
- Left out (no confirmed rule): the year-end tax-loss selling window, RRIF minimum-payment timing.
