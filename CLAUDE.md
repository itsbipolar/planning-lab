# planning-lab

Small browser builds on Canadian planning rules. Read HANDOFF.md first. End each session with a 10-line HANDOFF.md, commit, push.

## Rules
- Every rule and figure on a page comes from shared/facts.json (confirmed values only). Never write a figure or rule into a build's code; a test checks it. A rule missing from the facts is left out, never filled in.
- Pages store nothing, send nothing, make no request after load. The birth year (or any input) is never put in the address or in storage.
- General rules only. No projections, no "you should". Every page carries the education-only line and the AI line.
- No "CFP" anywhere. No "Financial Planner" or "Financial Advisor" titles. Nothing about hiring or a job search.
- No model names in files or commits. No firm or employer details. Never any real person's data.
- Design: shared/DESIGN.md (dark by default, Instrument Serif for H1/H2 only, Archivo for the rest, amber only as a mark).
- Each build is one self-contained file in labs/<name>/dist/ so the portfolio site can copy it in.

## Checks
npm run check (build, no-hard-coded-figures test, Playwright at 390 and 1440 px, axe in both schemes).
