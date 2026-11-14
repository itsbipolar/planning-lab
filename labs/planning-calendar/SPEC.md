# The planning calendar (P5b): spec

Canada's tax and savings dates for the next twelve months, for a household the visitor builds from situations, worked out
from the verified facts file. Rebuilt in the Data desk look on 2026-11-13 from the site's assessment (the owner approved
the brief); it replaces the 2027 heatmap version (households x weeks and a GitHub-style daily grid).

- `calendar.json`: the dated `rules` (each with the facts it cites, its kind: money due, a return due or a cut-off, and its
  wording with placeholders filled from the facts), the `situations` a household ticks (each brings rules), the quick
  picks (`presets`, examples; `example` is the one the page opens on) and the rules on each person's own date.
- `engine.mjs`: the twelve months from a given day (a corporation's rules, marked `"yearEnd": "corporation"`, follow
  the year-end month the visitor picks) (the page passes its own date from the browser clock), across the year
  boundary; each rule worked out for the year before, this year and next. A fact the file holds but has not confirmed makes
  that year's date "not confirmed yet" (listed, never guessed); a fact the file lacks leaves the date out. Situations
  combine with each rule once. Monday weeks for the strip; the big answer (`nextUp`); the .ics file (RFC 5545: escaped text,
  75-octet folding, CRLF, all-day events, UIDs from rule and date). No fact value is written in code.
- Page (redesign v2 steps 4 to 6, the desk tool template; public name Tax dates): the question "What’s your next tax date?"
  as the H1; the household chips in one row (the first move, `data-first-move`; the row scrolls sideways on a phone,
  never the page, and opens with the example's chip in view); the one assumptions line under them; the big readout
  (`data-answer`): "Next confirmed date", the countdown ("In N days", counted up only after the visitor acts, instant under
  reduced motion), one line of 14 words or fewer (the date and what falls on it, `nextUp()` in the engine) and "How this is
  worked out"; directly under it the one amber action, Add these N dates to my calendar (the .ics made in the page and
  saved through the shared deskSaveFile: the share sheet when it takes files, else a download; the in-app browser notice),
  the confirmed and unconfirmed counts on the line below and one lock-icon privacy line. On a wide screen the answer and
  the action sit side by side. Then "Fine-tune your household" (closed): the twelve situation checkboxes and the
  corporation's year-end month (December unless changed; the T2 date and the year-end follow it). Then the one chart, the
  pile-up strip (one column per week, one block per date coloured by kind, the superficial-loss period hatched, readings
  on the busiest weeks and the next date, labels at 17.5px drawn at the frame's width, tagged "Example household"). Then
  Go deeper (closed): each date with its rule in words and its source, the not-confirmed dates (never counted as next),
  and the own-date rules. Sources and assumptions; the Up next card; footer.
- Limits stated on the page: a December year-end for trusts, and for corporations unless the visitor picks another month (a year-end is the last day of a month); when a year-end share sale counts (trade or
  settlement date) is not in the facts file; weekend and holiday moves are not applied.
