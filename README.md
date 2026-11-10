# planning-lab

Small browser builds on Canadian planning rules, each a standalone static page. Education only, not advice. Made with AI assistance.

| Build | What it is | Status |
|---|---|---|
| [`labs/money-milestones`](labs/money-milestones) | Type a birth year: the rules for the TFSA, CPP, OAS and RRSP appear on the weeks of a life, each with its source and the date it was read. | demo |

## How the builds stay honest
- Every rule and figure comes from [`shared/facts.json`](shared/facts.json), exported from the hand-verified [canada-planning-facts](https://github.com/itsbipolar/canada-planning-facts) file. Nothing about the rules is written into a build's own code, and a test checks that.
- A rule missing from the facts is left out; it is never filled in from memory.
- The pages store nothing, send nothing and make no request after they load. Tests check that too.

## Run it
    npm install
    npm run check      # build, then the tests (needs a Chromium for Playwright)
    npm run sync-facts # copy the latest facts from a sibling canada-planning-facts checkout

`shared/tokens.css`, `shared/tokens.json` and `shared/DESIGN.md` are the design rules the builds follow (copied from the portfolio site until this repo becomes their home).

## Credits
Inspired by *Life in Weeks* by Gina Trapani (MIT licence); no code from it is used. Fonts: Archivo and Instrument Serif, SIL Open Font License 1.1, embedded in the built page.

Education only, not personal financial, tax, legal or investment advice. A personal project, not affiliated with or endorsed by any employer. MIT licence.
