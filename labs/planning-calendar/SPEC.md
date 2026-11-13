# The planning calendar (P5b): spec

Canada's tax and savings dates for the next twelve months, for a household the visitor builds from situations, worked out
from the verified facts file. Rebuilt in the Data desk look on 2026-11-13 from the site's assessment (the owner approved
the brief); it replaces the 2027 heatmap version (households x weeks and a GitHub-style daily grid).

- `calendar.json`: the dated `rules` (each with the facts it cites, its kind: money due, a return due or a cut-off, and its
  wording with placeholders filled from the facts), the `situations` a household ticks (each brings rules), the quick
  picks (`presets`, examples; `example` is the one the page opens on) and the rules on each person's own date.
- `engine.mjs`: the twelve months from a given day (the page passes its own date from the browser clock), across the year
  boundary; each rule worked out for the year before, this year and next. A fact the file holds but has not confirmed makes
  that year's date "not confirmed yet" (listed, never guessed); a fact the file lacks leaves the date out. Situations
  combine with each rule once. Monday weeks for the strip; the headline sentence; the .ics file (RFC 5545: escaped text,
  75-octet folding, CRLF, all-day events, UIDs from rule and date). No fact value is written in code.
- Page: the computed finding as the H1; build your household (quick picks and checkboxes); the pile-up strip (one column
  per week, one block per date coloured by kind, the superficial-loss period hatched, readings on the busiest weeks and the
  next date); Add to my calendar (a Blob download, pending dates left out and said so); each date with its rule in words
  and its source; not-confirmed dates; own-date rules; sources and assumptions; footer.
- Limits stated on the page: December year-ends for corporations and trusts; when a year-end share sale counts (trade or
  settlement date) is not in the facts file; weekend and holiday moves are not applied.
