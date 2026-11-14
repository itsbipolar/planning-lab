# planning-lab

Small browser builds on Canadian planning rules, each a standalone static page. Education only, not advice. Made with AI assistance.

| Build | What it is | Status |
|---|---|---|
| [`labs/order-of-returns`](labs/order-of-returns) | Order of Returns (/tools/order-of-returns/): deal ten market years and see how long that order lasts; same years, a different order. Two fictional retirees and synthetic market years. A tested withdrawal engine. | demo |
| [`labs/planning-timeline`](labs/planning-timeline) | Your year (/tools/your-year/): a birth year in, what $100 from that year costs now and when the TFSA, CPP, OAS and RRSP rules apply. | demo |
| [`labs/two-number-letter`](labs/two-number-letter) | When to start CPP (/tools/when-to-start-cpp/): the trade-offs of an earlier or later CPP or OAS start. | demo |
| [`labs/money-then-now`](labs/money-then-now) | Money, then and now (/tools/money-then-now/): a century of Canadian prices as stripes, with This year in money (#this-year). Data snapshots from Statistics Canada and the Bank of Canada, dated and credited. | demo |
| [`labs/planning-calendar`](labs/planning-calendar) | Tax dates (/tools/tax-dates/): the next confirmed dates for a household, saved as a calendar file made in the browser. | demo |
| [`labs/retirement-wave`](labs/retirement-wave) | Retirement wave (/tools/retirement-wave/): how many Canadians are about to turn 65 (Statistics Canada population estimates). | demo |

Superseded labs are in [`labs/_archive/`](labs/_archive) (not built or tested).

## How the builds stay honest
- Every rule and figure comes from [`shared/facts.json`](shared/facts.json), exported from the hand-verified [canada-planning-facts](https://github.com/itsbipolar/canada-planning-facts) file. Nothing about the rules is written into a build's own code, and a test checks that.
- A rule missing from the facts is left out; it is never filled in from memory.
- The pages store nothing, send nothing and make no request after they load. Tests check that too.

## Run it
    npm install
    npm run check      # build, then the tests (needs a Chromium for Playwright)
    npm run sync-facts # copy the latest facts from a sibling canada-planning-facts checkout
    npm run fetch-data # refresh the dated data snapshots in shared/data (Statistics Canada, Bank of Canada)

`shared/tokens.css`, `shared/tokens.json` and `shared/DESIGN.md` are the design rules the builds follow (copied from the portfolio site until this repo becomes their home).

## Credits
The Order of Returns follows the scene-by-scene format of Nicky Case's *The Evolution of Trust* (CC0); its engine, words and numbers are new. Inspired by *Life in Weeks* by Gina Trapani (MIT licence); no code from it is used. Money, then and now borrows the visual idea of the #ShowYourStripes warming stripes by Professor Ed Hawkins, University of Reading (CC BY 4.0, showyourstripes.info); it has nothing to do with climate data. Price data: adapted from Statistics Canada, Consumer Price Index, Table 18-10-0004-01 (Statistics Canada Open Licence; this does not constitute an endorsement by Statistics Canada). Prime rate: Bank of Canada Valet API (terms at bankofcanada.ca/terms; not affiliated with or endorsed by the Bank of Canada). Fonts: Source Serif 4 and Source Sans 3 in the tools, Archivo and Source Serif 4 in the reels, SIL Open Font License 1.1, embedded in each built file.

Education only, not personal financial, tax, legal or investment advice. A personal project, not affiliated with or endorsed by any employer. MIT licence.
