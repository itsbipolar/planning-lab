# planning-lab

Small browser builds on Canadian planning rules. Read HANDOFF.md first. End each session with a 10-line HANDOFF.md, commit, push.

## Rules (lightened 2026-11-13, Mo: "OK to all"; see the site's assessment)
- Rules and official figures come from shared/facts.json (confirmed values only), never typed into a build; the no-hardcoded tests check it. A missing rule is left out, never filled in from memory.
- Pages make no request after load and keep nothing on a server. Inputs stay out of the address. Files the visitor saves (an image, a calendar) are made in the browser.
- Illustrations and example projections are fine when they state their assumptions and are labelled as examples. Never a recommendation for a person.
- No "CFP" as a title, no "Financial Planner"/"Financial Advisor" as Mo's title, nothing about hiring. No model names in files or commits. No firm or employer details. Never any real person's data.
- Design: the Data desk look in shared/desk/ (desk.mjs: the site's tokens and fonts). Older labs move to it as they are rebuilt. Lead with the finding; charts full width; readings on the chart; colour by data type.
- Each build is one self-contained file in labs/<name>/dist/ so the portfolio site can copy it in.

## Checks
npm run check (build, no-hard-coded-figures test, Playwright at 390 and 1440 px, axe in both schemes).
