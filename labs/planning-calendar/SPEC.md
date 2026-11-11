# The planning calendar (P5b): spec

The year's tax and savings dates for different kinds of households (no practice, no hours, no "you"), shaded by how close
each household's next date is, in the shared P5 colour scale. Replaces the practice-workload version (deleted, never published;
unpublished), at Mo's request (2026-11-11); Mo approved the sketch and asked for year-end items such as tax-loss selling.

- `calendar.json`: the households and, for each, its dates as rules with the facts they cite; the shading horizon (eight
  weeks, a display choice); rules on each person's own date (CPP, OAS ages; a trust's deemed-disposition years); dates not
  placed until CRA publishes them.
- `engine.mjs`: dates from confirmed facts only (a missing fact makes the date pending); countdown per day; the
  superficial-loss period around a sale on the last day of the year, clipped to the plan year. No fact value in code.
- Page: overview (households x weeks; two halves on phones), one household by weekday (GitHub style) with each date's rule
  in words and its sources, own-date rules, not-placed list, sources. Amber marks the household picked.
- Limits stated on the page: when a year-end share sale counts (trade or settlement date) is not in the facts file, so only
  the superficial-loss period is shown; weekend and holiday moves are not applied.
