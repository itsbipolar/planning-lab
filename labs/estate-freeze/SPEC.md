# Estate freeze: build spec

Public slug `estate-freeze`; lab `labs/estate-freeze`. It is built on the desk template (shared/desk; redesign v2
sections 3, 5 and 6). The page is **unlisted** until Mo's firm compliance approves it: it is live at
`/tools/estate-freeze/`, but nothing on the site links to it until one flag, `"listed": false` in
`shared/desk/next.json`, is flipped. Education only. A made-up person. Written from scratch: none of the source
illustration's layout, wording, colours or branding is used, and no firm is named anywhere (this includes code,
tests, fixtures, commits and the making-of page).

## Second clarity pass (2026-11-16, after fresh readers and a rules review; wins over everything below)

- **The answer** is "Income tax moved to the trust": the trust's whole share (paid at its anniversaries in life plus
  paid later), `taxParts(S).moved`. The old "pushed past death" figure fell to $0 when death reached the trust's 21st
  anniversary; this one does not. The line under it says when the trust pays ("Deferred, not removed: the family trust
  pays it later, when it sells its shares", or the anniversary split). The H1 question is unchanged.
- **One rounding**: `taxParts(S, ref)` (model.mjs) rounds the parts once on `taxScale`'s grid, and "paid later" is the
  remainder, so every shown sum adds up (answer, split, the visible sum line, chart readings, crosshair, both tables,
  sheet, card). Tested over 840 input combinations.
- **The split** shows its sum as a visible line and says that yearly tax on income and buy-backs is left out of both
  sides; the without-freeze bar is filled in the due-at-death colour.
- **What happens** has four steps with the example's figures: Move; Freeze (an IOU for what the retiree first paid,
  "the original cost", and preferred shares with a fixed redemption value for the rest, together today's value); Trust
  (a family trust for the retiree's family); Buy back (the value bought back stays in the portfolio and moves to the
  trust's shares). Go deeper's "The moves, in detail" is gone (one telling).
- **"Original cost"** replaces "amount paid (tax cost)" everywhere; the slider's clamp note says what it is.
- **The chart** stacks, bottom to top: due at death, paid by the trust at its anniversaries (solid), paid later
  (hatched, up to the no-freeze line), the same order as its readings. On screen the plot grows until all four
  readings fit, so the no-freeze reading never drops. The tap read-out lists without-a-freeze first, and the gutter
  readings fade under it.
- **The ledger** moved into Go deeper (first sub-section); its fold is gone. "How this is worked out" is the one place
  for the gains: it reconciles the trust's gain (growth since the freeze + fixed shares bought back, and why) and says
  probate's saving comes from holding company shares, not from the freeze. The sheet labels probate "Not income tax".
- **Anniversary words**: counted from death ("4 years after death"), never as the dead retiree's age; death in the
  anniversary year reads "the year of death"; "Left out" adds that planning for the trust's 21st anniversary is not
  shown (no rule is stated).

## Clarity pass (2026-11-16; wins over every section below where they differ, sections 1, 2, 5, 6, 7 and 8 included)

Mo found the page confusing to read and use. Three cold reads (a family owner at 390, a planner at 1440, a skimmer
at 390) traced it to seven causes. Two kinds of dollars (tax and gain) sat under one verb, "Taxed". The sum was never
stated. The moves were explained last. The chart drew an after-death block that the model doesn't calculate. The
headline dropped when the anniversary came first. Some edge text was stale or broken. Some lines were repeated or
too long. The fix: **the main path speaks only in income tax, states the sum, explains the three moves before the
chart, and ends the chart at death.** Gains live in folds and are always called "gain". The engine's figures are
unchanged.

- **One term per concept.**
  - Tax figures are "due at death", "paid later, by the trust" or "paid by the trust at {age}, before death". "Pushed
    past death" stays only in the H1 and the answer label.
  - "Amount paid (tax cost)" replaces "tax cost" alone. "An IOU (the note)" replaces "the note".
  - "Preferred shares fixed at today's gain (a fixed redemption value)" and later "the fixed shares" replace "frozen"
    and "preferred left".
  - "Growth shares" replaces "common shares". "Buys back (redeems)" and "buy-backs" replace "redemption".
  - "21st anniversary" replaces "deemed sold" on the main path. "Without a freeze" / "with the freeze" replace "no
    freeze" and "if not frozen".
  - "Taxed" never sits next to a dollar figure unless the sentence is about a gain (words.test and page.spec check it).
- **One formatter for income tax:** `taxScale(S)` (model.mjs, FORMAT block) picks $X.XXM when the no-freeze tax is $1M
  or more, else $XXXK. The answer, split, chart, crosshair, ledger, echo, sheet, card and poster all use it, so one
  figure always reads as the same string.
- **The answer:** the big figure, then "Deferred, not removed: the trust pays it later, when it sells its shares." Below
  it, a two-row **split** replaces the old sub-line, with bars on one scale in the chart's colours:
  - "Without a freeze {$3.24M}, all due at death"
  - "With the freeze {$0.86M} due at death + {$2.38M} paid later, by the trust"

  A hidden sentence states the sum for screen readers. When the anniversary comes first, the line says what the trust
  pays then, and the split has three parts (d4, solid d3, hatched d3), so a lower big figure never reads as a better
  result. With two or more anniversaries before death, the line reads "From {76}, at each 21-year anniversary...".
- **What happens** (new, before the chart, no figures): three numbered steps, Move, Freeze and Buy back, set as text
  over one rule. They name the section 85 election and the fixed redemption value. At 960 and wider they read across
  under both columns.
- **The chart, in income tax, ends at death** (`S.xMax = deathAge`):
  - The d4 band is due at death with the freeze. The hatched d3 band is paid later. A solid d3 band, from the first
    anniversary before death, is what the trust paid then. The ink line is due at death without a freeze. All three
    bands add up to the line at every age (model.test checks the invariant).
  - The title is state-driven and has no figures. The subtitle is "Income tax if death came at each age, $ millions".
  - End readings sit in the right gutter. Each band's reading has a 2px bracket in its colour spanning the band at
    death, so the bracket's height is the value.
  - The anniversary marker reads "21st anniversary, {81}: trust pays {$3.19M} tax". Later anniversaries get a line
    only.
  - The annotation reads "Yearly buy-backs shrink this".
  - One line under the chart says what happens after death, which is not drawn.
  - The crosshair reads in tax, pinned to the top of the plot. On touch the reading stays after the finger lifts, until
    a tap elsewhere. This is a capture listener in app.js, not a change to shared/desk.
- **The ledger moved up** (between the chart and Change the example; side by side with it from 960):
  - Rows: income tax due at death, paid by the trust at {age} (only when that comes first), paid later, and **"In all,
    at today's rates"**. "In all" is a sum of income tax only. Probate stays out of it.
  - A closed fold, "Probate, and the gains behind this tax", holds the probate figure (not payable with the freeze,
    assumed), the gain taxed at death, the trust's gain (growth + buy-backs, and in deemedFirst the part taxed at the
    anniversary) and the rate, Tax = gain × {26.76%}.
  - Money columns don't wrap. The ledger fits 358px at death 100, $25M (tested).
- **Change the example:** "Amount paid (tax cost)", then one cue line that names what the last-touched stepper changes.
  - The death-age line is correct at every age: "Death at {93} is an example, {23} years after the freeze." The 16 to
    18 years are rounded from the facts. At 390 the line is shown only inside How this is worked out (the 2,800px
    budget).
  - An echo line (when changed) repeats the figures next to the controls.
  - The clamp note reads "Amount paid set to {$1M} here: it can't be more than the portfolio...".
- **How this is worked out:** plain steps in tax, with "gain" said wherever a gain is meant. Every rate is wrapped in its
  fact. The buy-back formula moved to Go deeper.
- **Go deeper:**
  - Sections: "The moves, in detail" (two columns at 1440); "Buy-backs, year by year" (an opening line on the yearly
    payment to the retiree, bars in ink-3 because this is cash, not tax, and the mechanism with the deemed dividend
    above paid-up capital, every rate in a fact span); More assumptions; "The numbers behind the chart".
  - The table puts the tax columns first ("Tax due at death, without a freeze", "...with the freeze", "Tax paid by the
    trust at its anniversaries" in deemedFirst only, "Tax paid later, by the trust"), then Portfolio and "Bought back
    that year". On a phone its caption counts the columns off-screen.
- **This example assumes:** the same seven caveats in three groups (The family and the set-up; At and after death;
  Left out). They come after Go deeper, three columns wide from 960. The first names 70(6).
- **Sources** add Income Tax Act 104(4) (a trust's deemed disposition every {21} years; the 21 is read from the facts).
- **Save as one page:**
  - The answer with the split as one sentence, then the three steps as one paragraph.
  - The chart in tax, with "Death at {87}" (the inputs line says it is an example) and one caption that holds the units,
    the rate year and the after-death line.
  - The ledger as on the page, plus probate as a plain row, and the seven short caveats.
  - It fits one page on Letter and A4 at the example and the longest state.
- **Save my card:** the big figure in taxScale, and the small chart in tax with "tax due at death without a freeze" and
  "...with the freeze".
- **poster.json:** y in income tax ($ millions, 2 decimals); x from the freeze to death; the reading reads "Income tax
  due at death, without and with a freeze: {$3.24M} → {$0.86M}"; the anniversary label appears only when it comes
  before death.
- **Layout:** at 960 and wider, the answer spans the play row's rows above the steps, so opening How this is worked out
  grows only the right column (tested: the slider moves by no more than 4px). Go deeper's summary sits at about 2,770px
  at 390 (budget 2,800).
- **Not done here (outside this lab):**
  - The site's dek and headlines keys (`freezeTaxBefore` / `freezeTaxAfter`) and the og:description.
  - The shared crosshair touch fix in desk-ui.mjs, for every tool. This tool handles touch itself.
- **Open question for Mo (does not block):** the "In all, at today's rates" row, against the earlier note of no
  total-of-everything figure. It adds income tax only, to show "deferred, not removed" as arithmetic.

## Changes after the independent review (2026-11-15; these win over the sections below where they differ)

- **The trust's anniversary before death (deemedFirst).** The gain the trust holds at each anniversary before death is
  deemed realized and taxed then, in life (104(4)(b)). The engine now returns `trustHeld` (the growth since the last
  anniversary, still untaxed at death), `trustTaxedEarly` and `taxTrustEarly` (the gain and its tax at today's top rate
  on gains), `deferred` (= trustHeld × the rate: the big answer in every state) and `nextDeemedAge`. The label stays
  "Income tax pushed past death"; the line says the anniversary comes first and what is taxed then. The ledger shows
  the trust's growth since then, its deferred tax and a row for the tax in life; the chart reading uses trustHeld, so
  the number and the drawn band agree. Several anniversaries before death restart the drawn gain at each one.
- **Wording.** "21st year" is now "21st anniversary". The flow names the section 85 election (tax-deferred move) and
  says the preferred shares have a fixed redemption value of the rest, equal to today's gain because the note takes
  the tax cost. The redemption text says the deemed dividend is the amount above paid-up capital (nil here).
- **Caveats (seven).** No surviving spouse or the second death (70(6)); section 85 and no corporate attribution;
  post-death planning keeps the gain from being taxed twice; the note unpaid until death; the secondary-will
  assumption (a result of holding company shares, not of the freeze); the company's own unrealized gain not shown;
  yearly tax, fees and technical rules left out. The sheet carries shorter versions.
- **Exhausted or no preferred shares:** the extra line says the example then stops paying the retiree and the
  company's kept income is not counted.
- **Sources:** Income Tax Act 70(5), 70(6), 74.4, 84(3) and 85 are linked as qualitative sources (no figure read).
- **Own wording and layout:** the ledger leads with "Due at death", then its parts and the gain it is worked out on,
  then "In the trust"; the chart readings say "if not frozen" and "held by the trust, taxed later".
- **Chart:** y labels in a left gutter with $0; marker labels set in age order and never across an earlier marker's
  line; after death the trust's block stays stacked where it was at death; leaders are dotted with a dot at the band.
  The stamp is said once (by the first control); the chart has a one-line hint about the crosshair.
- **Tax cost clamp:** a portfolio below the chosen cost lowers it only while it is below, with a note; it comes back.
- **Numbers in a sentence share one scale** (fmtScale); zero reads "nothing" or "$0".
- **Save as one page:** leads with the answer, a taller chart with all three readings on one line each, the tool's
  address, one page on Letter and A4. **Save my card:** no chips; the line names the example; a small band chart with
  the two gains (deskCard takes `bigMax` to leave it room).
- **Go deeper** comes before the ledger and caveats (the template's 2,800px budget at 390, with the caveats and the
  death-age hint now shown on phones); its last section is "The numbers behind the chart", with its first column held.

---

## 0. The choice: scores and what was grafted

Each concept was scored 1 to 5 on five criteria.

| Concept | Journey | Clarity at 390 | Credibility | Desk fit | Buildability | Total |
|---|---|---|---|---|---|---|
| The Switch | 5 | 4 | 3 | 3 | 2 | 17 |
| **The Long Fuse (winner)** | 4 | 4 | 4 | 5 | 4 | 21 |
| The Deferred Ledger | 3 | 4 | 5 | 5 | 4 | 21 |

**Winner: The Long Fuse.** Its idea answers the H1 directly. A freeze changes *when* the gain is taxed, so the chart
keeps going past death to the trust's 21st year. Its first move, a portfolio-value slider, is the desk's existing
control pattern, and its chart reuses the crosshair.

**Grafted from The Deferred Ledger:**
- One stacked band whose top edge is always the no-freeze gain. The freeze visibly *splits* the gain; it does not
  shrink it.
- The ledger and the caveats are visible beside each other, not folded.
- Probate is kept out of the big number.
- Third person throughout. No name field and no "Prepared for".
- A version stamp on the printed sheet.
- The zero-growth note.
- The default age at death comes from the life-expectancy facts.
- The correction to "at the latest" (section 9, item 1).
- The inline link from the "taxed once" caveat to the Taxed twice at death film.

**Grafted from The Switch:**
- The chain slot (Money, then and now → Estate freeze → Tax dates) and the film door.
- A distinct wide panel on /tools/ once listed.
- Hatching, so the trust's share reads in print and for colour-blind readers.
- The edge-state lines and the cost clamp.
- "Each redemption trims this".
- The fixture name `example-sanity.json`.

**Not taken, and why:**
- **The binary switch as the first move.** It hides the inputs the brief asks for. A count-up to a big tax figure
  after one tap reads as a pitch. The morph, the play scrubber and the guess would triple the build.
- **The guess card.** The 21-year marker is visible from the first paint (compliance wants the deferral seen at
  first glance, not after an interaction). `deskGuess` stays available for a later round.
- **The fill-in sentence with tappable values.** It is a new component, and 44px targets inside wrapping prose break
  at 390. The steppers are the desk pattern.
- **Three ownership small multiples.** Three SVGs at 17.5px or more at 390 cost too much. One vertical flow goes in
  Go deeper instead.
- **A compressed after-death axis.** It is a broken scale. The x axis is linear in age everywhere.
- **A "draft" chip on the page.** Compliance reviews exactly what will go public.
- **A fourth home rail item.** It breaks the 1-of-3 swipe and the balance of the lead.

---

## 1. Words

| Where | Text |
|---|---|
| H1 (next.json `question`) | **How much tax does an estate freeze push past death?** (10 words, 51 characters, no digits) |
| Kicker | `TOOL` |
| Lede (one sentence, filled from state) | A made-up retiree, {freezeAge}, moves a portfolio into a company and freezes its value. |
| Card dek (projects/estate-freeze.mdx, 140 characters or fewer once filled) | Drag the portfolio. In a made-up example, {{freezeGainBefore}} of gain taxed at death becomes {{freezeGainAfter}}; the rest is taxed later. |
| `<meta name="description">` / og:description | A made-up retiree freezes a portfolio in a company. See how much gain is taxed at death, and how much moves to a trust to be taxed later. Education, not advice. |
| Stamp (assumptions line, chart, card, print) | Hypothetical illustration · Education, not advice |
| Chip on the /tools/ panel | Drag |

Voice: "the retiree", "the portfolio", "the trust". Never "you", "your portfolio" or "your estate". Income tax is
"deferred" or "pushed past death", never "saved". Probate is "not payable (assumed)".

---

## 2. First screen

### 390px (y values approximate; tested limits: `[data-first-move]` top ≤ 700, `[data-answer]` top ≤ 700)

1. **0–140: the shared tool bar** (desk-page `toolBar`): masthead, "← All tools", "How I made this", theme button.
2. **~156: the kicker** TOOL.
3. **~188–315: the H1**, display role, 3 lines.
4. **~325–390: the lede**, 2 lines.
5. **~405–515: the one control**, `[data-first-move]`:
   - label PORTFOLIO VALUE;
   - a serif tabular bubble "$7.5M" above the thumb;
   - a native range of $1M–$25M, step $250K, with a 44px hit area;
   - end ticks "$1M" and "$25M", plus "$10M" in the middle;
   - the range and step come from `BOUNDS`.
6. **~530–725: the readout**, `[data-answer]` (desk readout, aria-live polite):
   - `.readout-k` "Income tax pushed past death" (5 words);
   - `.readout-v` "$2.38M";
   - `.readout-t` "Deferred, not removed: the trust's shares are taxed when sold or deemed sold." (13 words);
   - `.readout-sub` "Owed at death: $0.86M with the freeze, $3.24M without.";
   - `details.readout-how` "How this is worked out" (closed).
7. **~740: the one `[data-assumptions]` line** (`.assume`): "Hypothetical illustration · Education, not advice. One made-up
   Ontario owner, {rateYear} top rates, every figure an example. Tax moved to the trust is deferred, not removed."
8. **Then the chart**, full width, starting below 700. No chart sits above the fold at 390.

### 1440px

- 12-column container (1360 max).
- **Play row:**
  - columns 1–7: kicker, H1 (display, 16ch), lede, slider, assumptions line;
  - columns 8–12: the readout, top-aligned to the H1, figure at the readout role's maximum.
- **Row 2:** the chart across all 12 columns, about 440px tall. At 1440×900 the chart's title and upper half are
  visible without scrolling.

### 768px

The 390 order, with the slider and the readout side by side (6/6).

The light scheme is the default. Dark mode uses its own d3 and d4 tokens; the hatch stroke is `currentColor` set to
the scheme's d3.

---

## 3. Controls

All bounds live in one exported `BOUNDS` object ("UI bounds, not facts"). All defaults are the example.

| Control | Where | Default | Range | Step |
|---|---|---|---|---|
| Portfolio value | slider, first move | EXAMPLE.value ($7.5M) | $1M–$25M | $250K (arrows); PageUp/PageDown ±$1M |
| Tax cost | "Change the example" stepper | EXAMPLE.cost ($2.5M) | $0 to the current value | $250K |
| Growth a year | stepper | EXAMPLE.growth (4%) | 0–8% | 0.5% |
| Age at the freeze | stepper | EXAMPLE.freezeAge (70) | 55–85 | 1 |
| Age at death | stepper | derived (87, section 4.4) | freezeAge + 1 to 100 | 1 |
| Investment income a year | Go deeper "More assumptions" | EXAMPLE.income ($100K) | $0–$500K | $10K |
| Share that is eligible dividends | Go deeper | EXAMPLE.eligibleShare (50%) | 0–100% | 10% |
| Income growth a year | Go deeper | EXAMPLE.incomeGrowth (2%) | 0–4% | 0.5% |

**Stepper.** Each stepper is a label (≥ 17.5px), a − button, an `<output>` in serif tabular, and a + button. The
buttons are 48px. At a bound the button is disabled; values never wrap. aria-label reads like "Increase growth, now
4.0%". There is no typed field.

**"Change the example".** At 390 it is a 2×2 grid; at 1440 it is one row of four. It sits directly under the chart.
- Under Age at death, while freezeAge equals the life-table age (section 4.4), a hint reads: "About {n} more years:
  between men's {m} and women's {w} at {age} (Statistics Canada, {period}). An example, not a prediction." At any other
  freeze age the line hides.
- A text button, "Back to the example", shows only when any input differs from the example.

**Clamping.** If the value drops below the cost, the cost is clamped to the value. A separate polite status line says
"Tax cost lowered to {value}". Age at death is clamped to freezeAge + 1 or more.

**Updates.**
- Slider input redraws the chart on requestAnimationFrame.
- The readout uses `deskReadout`: a 300ms count-up after the visitor acts, instant under reduced motion, and never on
  load.
- `[data-flash]` goes on the ledger's figures.

**Storage.** Inputs live in memory only: nothing in the URL, no sessionStorage, and the page does not read or write
`mo.year`. localStorage holds only `theme`, written by the tool bar.

---

## 4. The engine: `labs/estate-freeze/model.mjs`

The module is pure: no DOM, no I/O. It is tested in node and inlined into the page by build.mjs (the same
`export`-stripping as money-then-now). It takes the facts list and the inputs and returns everything shown.

### 4.1 Example and bounds (the only typed numbers)

```js
export const EXAMPLE = {
  label: 'Example assumptions, not facts',
  value: 7_500_000, cost: 2_500_000, growth: 0.04, freezeAge: 70,
  income: 100_000, eligibleShare: 0.5, incomeGrowth: 0.02,
  // deathAge is not typed: defaultDeathAge(R, freezeAge), section 4.4
};
export const BOUNDS = { /* the table in section 3 */ };
```

### 4.2 Rules from facts.json (confirmed only): `freezeRules(facts)`

| Rule | Fact ids | How |
|---|---|---|
| rateYear | `federal_brackets.Y`, `ontario_brackets.Y`, `ontario_surtax.Y` | The latest Y where all three are confirmed with values (2026 today; 2027 is pending). Never typed. |
| fedTop | `federal_brackets.{rateYear}` | The rate of the row with no `to`, ÷ 100 |
| onTop | `ontario_brackets.{rateYear}` | The rate of the row with no `to`, ÷ 100 |
| surtax | `ontario_surtax.{rateYear}` | The **sum** of the row rates ÷ 100. The rows add together; they are not brackets. Top-rate assumption: basic Ontario tax is above the highest `from`. |
| inclusion | `capital_gains_inclusion_rate` | ÷ 100 |
| topOrdinary | (derived) | fedTop + onTop × (1 + surtax) |
| cgRate | (derived) | inclusion × topOrdinary (26.76% today, shown to 2 decimals and computed, never typed) |
| refInvest | `refundable_investment_income_rate` | ÷ 100 |
| partIV | `part_iv_tax_rate` | ÷ 100 |
| refundRate | `dividend_refund_rate` | ÷ 100 |
| trustYears | `trust_deemed_disposition_years` | integer |
| lifeTable | `life_expectancy_age70_male`, `_female` | values, plus the age (`/at age (\d+)/`) and period (`/(\d{4}) to (\d{4})/`) read from the fact title |
| eat (optional) | `ontario_estate_admin_tax_rate`, `ontario_estate_admin_tax_exemption` | the rate, the exemption, and the per-unit amount read from the rate's title (`/per \$([\d,]+)/`); the build stops if the title does not parse |
| corp (optional) | `federal_corporate_basic_rate`, `federal_corporate_abatement`, `ccpc_additional_refundable_tax_rate`, `ontario_corporate_general_rate` | corpInvest = basic − abatement + additional refundable + Ontario general (÷ 100) |

### 4.3 Missing facts: how the tool behaves

- **Required** (the build stops and names the id; there is no fallback value, ever): the three rate tables for one
  common year, `capital_gains_inclusion_rate`, `refundable_investment_income_rate`, `part_iv_tax_rate`,
  `dividend_refund_rate`, `trust_deemed_disposition_years`, and both life-expectancy facts. The example's age at
  death cannot be set without the life-expectancy facts, and the honesty of the page depends on the 21-year fact.
- **Estate administration tax missing:** the probate rows in the ledger, the print sheet, "How this is worked out" and
  the caveat about the secondary will are left out. Everything else is unchanged; the big answer never includes
  probate.
- **Corporate rates missing:** only the cash line in Go deeper "Redemptions, year by year" is left out. The redemption
  itself needs only refInvest, partIV and refundRate.

All of these are confirmed today (facts.yaml, 2026-11-15, under Mo's standing OK).

### 4.4 Default age at death

```
defaultDeathAge(R, freezeAge) = freezeAge + round((male + female) / 2)
```

This holds only when freezeAge equals lifeTable.age. The build asserts that EXAMPLE.freezeAge equals lifeTable.age,
so the example opens at 70 + round(16.825) = 87. It is labelled everywhere as "an example age at death, not a life
expectancy for anyone".

### 4.5 Inputs, then the year loop: `freeze(R, inp)`

```
n      = deathAge − freezeAge                            (≥ 1)
cost   = min(cost, value)
note   = cost                       the note takes the tax cost, so it carries no gain
pref0  = value − cost               fixed-value preferred shares; their tax cost is nil (all of it went to the note)
prefLeft = pref0; redeemed = 0
t = 0:  V0 = value; gainNo0 = value − cost; gainWith0 = pref0; trust0 = 0

for t = 1..n (the end of each year; age = freezeAge + t):
  income_t   = income × (1 + incomeGrowth)^(t − 1)
  div_t      = income_t × eligibleShare                   eligible dividends from the portfolio
  int_t      = income_t − div_t                           interest
  refundable_t = int_t × refInvest + div_t × partIV       refundable tax on the year's investment income
  R_t        = min(refundable_t / refundRate, prefLeft)   the redemption that recovers it
  prefLeft  −= R_t; redeemed += R_t
  V_t        = value × (1 + growth)^t                     price growth only; the income is paid out each year
  gainNo_t   = V_t − cost                                 no freeze: the whole gain, taxed at death
  gainWith_t = prefLeft                                   freeze: the unredeemed preferred shares' gain
  trust_t    = V_t − note − prefLeft                      the trust's common shares (bought at a nominal price)
  [corp] corpTax_t = int_t × corpInvest + div_t × partIV; cash_t = income_t − corpTax_t + R_t × refundRate
         leftover_t = cash_t − R_t                        shown in Go deeper only; ignored in the model
  exhaustedAge = the first age at which prefLeft reaches 0 (or null)
```

### 4.6 At death (t = n) and after

```
taxNo      = gainNo_n × cgRate
taxWith    = gainWith_n × cgRate
pushed     = taxNo − taxWith  (= trust_n × cgRate)        THE BIG ANSWER: income tax pushed past death, at today's rate
trustSplit = { growth: V_n − value, redemptions: redeemed }   (they add to trust_n)
estateNo   = V_n                                          (only this portfolio; other assets ignored)
[eat] eatNo = estateNo ≤ exemption ? 0 : ceil((estateNo − exemption) / per) × rate
      eatWith = 0, labelled "not payable (assumed)": the note and preferred shares pass under a secondary will
      (an assumption, not a rule); the trust's shares are not in the estate
payableNo = taxNo + eatNo; payableWith = taxWith
deemedAge = freezeAge + trustYears                         the trust is assumed to be set up at the freeze
deemedFirst = deemedAge ≤ deathAge
```

- The model shows **no tax amount at the 21st year**. Trust rates and allocation rules are not in the facts file,
  so the year-21 point gets a date only.
- The **company's leftover cash** each year is ignored. The test asserts it is under 1% of total redemptions in the
  example.
- **Left out of both columns:** the yearly personal tax on the redemption dividends (with a freeze) and on the
  investment income (without a freeze).

### 4.7 States the model reports (the page writes the words)

| State | When | Readout label | `.readout-t` (14 words or fewer) |
|---|---|---|---|
| normal | default | Income tax pushed past death | Deferred, not removed: the trust's shares are taxed when sold or deemed sold. |
| deemedFirst | deemedAge ≤ deathAge | Income tax moved to the trust | Here the trust's 21st year, age {deemedAge}, comes before death. |
| noGrowth | growth = 0, pushed > 0 | Income tax pushed past death | With no growth, the trust's gain comes only from redemptions. |
| nothing | pushed = 0 | Income tax pushed past death | Nothing moves to the trust without growth or redemptions. |

Two more states add a line under the readout:
- `exhausted` adds "The preferred shares are all bought back by age {exhaustedAge}."
- `noGainAtFreeze` (cost = value) adds "No gain at the freeze: all later growth goes to the trust."

### 4.8 Format

- Readout: ≥ $1M → `$X.XXM`; below that → `$XXXK`; zero → `$0`.
- Ledger: `$X.XXM`.
- Chart readings: `$X.XM`.
- Redemptions: `$XX,XXX`.
- Percentages: rates to 2 decimals, inputs to 1.

The formatters live in model.mjs, so headlines.mjs and poster.json use the same rounding.

---

## 5. The chart (one, full width, desk chart frame)

`<figure class="chart" id="freeze-chart">`.

**Caption:**
- Title (the takeaway; it updates): "At {deathAge}: {gainWith} taxed at death, not {gainNo}. The trust's {trust} is taxed
  later." In the deemedFirst state: "The trust's 21st year, at {deemedAge}, comes before death at {deathAge}."
- Subtitle: "Gain not yet taxed, by age, $ millions".
- Chips: the desk `tag-example` (EXAMPLE DATA) and the stamp.

**Axes:**
- x: linear in age, from freezeAge to max(deathAge, deemedAge).
  - At 390: three ticks (freeze, death, year 21).
  - At 1440: every 5 years, plus death and year 21.
- y: $M, labels left-aligned above crispEdges gridlines, an ink zero line, and a nice max above gainNo_n.

**Marks, coloured by data type** (the same in the ledger swatches, the card and print):
- **Taxed at death:** d4 fill at 40%, from 0 to gainWith, drawn as a step line (1px notches at each redemption), with
  a 2.5px d4 top edge.
- **To the trust, taxed later:** d3 fill at 40% plus a 45° d3 hatch, between gainWith and gainNo.
- **No freeze:** an ink line, 2.5px, on the band's own top (gainNo). The whole area under it would be taxed at death
  without a freeze.
- **Death:** a 1px ink vertical labelled "Death at {deathAge} (example)". Past it, the d4 band ends: that gain is
  taxed.
- **After death:** the trust band continues to deemedAge as hatch only, with a dashed 1.5px d3 outline, flat at
  trust_n. The growth after death is not modelled; a sentence in "How this is worked out" says so.
- **Year 21:** a dashed d3 vertical labelled "Trust's 21st year, age {deemedAge}". In the deemedFirst state it sits
  inside the lifetime, the after-death zone disappears, and the hatch to the right of the marker restarts from zero (a
  new tax cost after the deemed sale; drawn only as the restart, with no amount).
- **The one annotation** (600 weight, 1px leader), inside the d4 band: "Each redemption trims this".

**Readings on the chart, no legend.** End labels sit in a right gutter (max(112px, 14% of the width)), each with a
1px leader to its band at the death age. The value is serif 600 tabular; the words are 17.5px sans:
- "{gainNo} / no freeze"
- "{trust} / to the trust, taxed later"
- "{gainWith} / taxed at death"

Collisions are checked against the bounding boxes. When labels collide, the "no freeze" reading is dropped first
(its value is in the title), then the remaining two are nudged apart along their leaders.

**Sizes.** The SVG is drawn at the container's measured pixel width (ResizeObserver; 1 unit = 1px), so text renders
at its CSS size: 358×340 at 390, 1360×440 at 1440. All text is ≥ 17.5px, checked with getScreenCTM.

**Crosshair.** `deskCrosshair` reads "Age {a}" / "Taxed at death {x}" / "To the trust {y}" / "No freeze {z}". The
chart is focusable (tabindex 0) and the arrow keys step one year. No pulsing and no draw-on animation on load.

**Accessibility.** role="img" with a generated summary sentence. The full numbers are in Go deeper's year-by-year
table.

---

## 6. Below the chart, in order

1. **"Change the example"**: the steppers (section 3).
2. **Ledger and caveats.** At 390 they stack; at 1440 the ledger takes 7 columns and the caveats 5. Both are visible.

   **Ledger** (`<table>`, figures serif tabular, swatches d4 and d3):

   | At death, age {deathAge} | No freeze | With the freeze |
   |---|---|---|
   | Gain taxed at death | $12.11M | $3.20M |
   | Income tax on it ({cgRate}% top rate on gains, {rateYear}) | $3.24M | $0.86M |
   | Ontario estate administration tax [eat] | $0.22M | not payable (assumed) |
   | Payable at death | $3.46M | $0.86M |

   Then a group headed **Taxed later** (2px rule above):

   | | | |
   |---|---|---|
   | Gain held by the trust ({growth} growth + {redeemed} redeemed) | none | $8.91M |
   | Its income tax at today's rate, deferred | none | $2.38M |
   | Taxed when the trust sells, or is deemed to sell at its 21st year | | age {deemedAge} |

   There is no "difference" column, no total-of-everything figure and no dark box.

3. **"This example assumes"**: a `.callout` list, each item 16 words or fewer:
   - One spouse owns everything. Gifts to a surviving spouse are not shown.
   - The freeze is set up so corporate attribution does not apply.
   - Post-mortem planning is in place, so the gain is taxed once, at capital-gains rates. ("taxed once" links inline
     to `/watch/double-tax-at-death/`.)
   - The note stays unpaid until death.
   - [eat] The note and frozen shares pass under a secondary will that probate does not reach: an assumption, not a
     rule.
   - Yearly tax on income and redemptions, fees, corporate costs and many technical rules are left out.

   Closing line: "How any of this applies to a real family is a question for a tax professional and a lawyer."
4. **The save row:**
   - **Save as one page**: `.btn-you`, the page's one amber action, because it makes the visitor's own sheet.
   - **Save my card**: `.btn-2`.
   - The in-app notice from `deskSaveButton` appears beside them when needed.
5. **Go deeper** (`details.deeper`, closed; the summary must be at y ≤ 2,800 at 390, which is tested; the caveat word
   caps above exist for this budget). `deskDeeper` writes the "In this section" preview. Its sub-sections:
   1. **The moves, in plain words.** One vertical flow (HTML boxes and 1px ink connectors, not three columns):
      - "The retiree moves the portfolio into a new company."
      - "Back come a note for its tax cost ({cost}) and preferred shares fixed at today's gain ({pref0})."
      - "A family trust buys the company's common shares for a nominal amount; growth from here lands on them."
      - "Each year the company buys back some preferred shares."
   2. **Redemptions, year by year.**
      - Bars of R_t (d4, 40%), with a reading on the first bar ("Year 1: about {R_1}") and the last.
      - [corp] One cash line: "In year one the company earns {income_1}, pays {corpTax_1} in tax, gets {R_1 ×
        refundRate} back and buys back {R_1} of shares."
      - The mechanism in plain words: the company recovers its refundable tax on investment income by paying
        dividends. The redemption is that tax ÷ the dividend refund rate.
   3. **More assumptions.** The three steppers from section 3.
   4. **Year by year.** A scrollable table: age, portfolio, redeemed that year, preferred left, trust's shares, gain
      taxed at death (no freeze / with). It doubles as "the numbers behind the chart".
6. **Sources** fold (desk). For every fact used: its title, source link and as_of, plus Statistics Canada table
   13-10-0114-01 for the life table. Version line: "Version {hash} · rates as of {latest as_of} · made in this
   browser; nothing was sent."
   - `{hash}` is the first 8 hex of sha256 over model.mjs and the used facts, computed at build. It is deterministic;
     there is no build date.
7. **Up next**: one `a[data-next]`, "What's your next tax date?" (tax-dates). It is resolved through the flag rule
   (section 10).

### "How this is worked out" (inside the readout, closed; filled live, each rate wrapped in `<span data-fact="id">`)

1. Portfolio at {deathAge} = {value} × (1 + {growth})^{n} = {V_n}.
2. No freeze: gain = {V_n} − tax cost {cost} = {gainNo}.
3. Freeze: the note takes the {cost} tax cost, so the preferred shares ({pref0}) carry the whole gain. Each year's
   redemption = (interest × {refInvest}% + eligible dividends × {partIV}%) ÷ {refundRate}%, so {redeemed} is bought back
   by {deathAge}, leaving {gainWith}.
4. Tax at death = gain × {inclusion}% × {topOrdinary}% (the {rateYear} top federal and Ontario rates with the Ontario
   surtax) = gain × {cgRate}%.
5. [eat] Estate administration tax = {rate} per {per} (or part) of the estate over {exemption}, on {V_n}.

Closing sentence: "The big figure is the trust's {trust} gain at death times today's {cgRate}%. The real tax comes
when the trust sells or is deemed to sell, at the rates of that day. Growth after death is not modelled."

---

## 7. Save as one page (print), made in the browser

The button builds `<section class="sheet" aria-hidden="true">` from the current state, then calls `window.print()`.
A `beforeprint` listener rebuilds it, so Ctrl/Cmd+P prints the sheet and not the screen.

**`@media print`:**
- Everything except `.sheet` is hidden.
- The light tokens are forced.
- `@page { size: auto; margin: 0.5in }`: one Letter or A4 portrait page.
- `break-inside: avoid` on every block.
- All text is ≥ 17.5 CSS px.

**The sheet, top to bottom** (our arrangement: rules, no dark boxes, no logo, saves toner):
1. A 3px double ink rule. Left: "HYPOTHETICAL ILLUSTRATION · EDUCATION, NOT ADVICE". Right: the site address and
   "Printed {local date}".
2. The H1 as the title (serif, 2 lines at most).
3. One inputs line: "A made-up retiree, {freezeAge}: portfolio {value}, tax cost {cost}, growth {g} a year, income
   {income} ({share} eligible dividends, growing {ig}), death at {deathAge} (example). Ontario, {rateYear} top rates."
4. The chart redrawn for paper, about 260px tall:
   - the taxed-at-death band is grey (ink3 at 35%);
   - the trust band is an ink hatch;
   - the no-freeze line is ink 2.5px;
   - the death line is ink, and the marker is a dashed ink line;
   - the readings sit on the chart.
5. The ledger, both groups, with its "Taxed later" rows.
6. The caveats in two columns (the same six, same words).
7. The foot: one sources line (the fact titles, shortened to statute and page names); the version line;
   "Made with an interactive tool by Mohammed El Chayeb" and the site address; footerNote and aiNote.
   - Only the wordmark name appears: no title for Mo, no employer, no firm, and no URL carrying inputs.

---

## 8. Save my card

```js
deskSaveCard({
  question, bigValue: '$2.38M', line: 'income tax pushed past death: deferred, not removed',
  labels: ['Taxed at death: $12.1M → $3.2M', "Trust's 21st year: age 91"],
  draw: miniBand, stamp: 'Hypothetical illustration · Education, not advice', name: 'estate-freeze-card.png',
})
```

- The card is 1080×1350. Every value comes from the current state.
- `miniBand` draws the two bands, the no-freeze edge, the death line and the year-21 marker, with no axis text.
- **Shared change:** `deskCard` accepts an optional `stamp` that defaults to `CARD_STAMP`. Other tools are unchanged;
  template.test.mjs gets a case for it.
- The save flow tries `navigator.share({files})` first, then a download, then the in-app notice.

---

## 9. Honesty and compliance

1. **"At the latest" is not used.** A distribution of the shares to beneficiaries can carry the tax further, and that
   rule is not in the facts file. The copy says "taxed when sold or deemed sold", and the marker reads "Trust's 21st
   year" (the fact). This departs from the brief's "at the latest" wording on purpose. Mo can confirm.
2. Probate is never in the big number. It is always "(assumed)" and always tied to the secondary-will assumption.
3. There is no contact or booking prompt, no insurance or product line, and no urgency inside the tool.
4. The source illustration's phrases are not used, and neither are its life-expectancy figures (ours come from facts:
   2022 to 2024).
5. **Firm name.** It goes only into the private denylist that the site's `check:dist` already reads
   (`DENYLIST` / `../mo-sample-portfolio/private/denylist.txt`). It is never typed into any repo file, including
   tests.

---

## 10. Placement behind the flag

### planning-lab

- **`shared/desk/next.json`**: add the tool after money-then-now, and point two doors at it.
  ```json
  { "slug": "estate-freeze", "labSlug": "estate-freeze", "question": "How much tax does an estate freeze push past death?", "next": "tax-dates", "listed": false }
  ```
  - `money-then-now.next` becomes `"estate-freeze"`.
  - `films["double-tax-at-death"].next` becomes `"estate-freeze"`.
  - Extend `_note`: a missing `listed` means true. A door to an unlisted tool follows that tool's own `next`.
- **`shared/desk/desk-page.mjs`**:
  - `isListed(t) = t.listed !== false`.
  - `effectiveNext(slug)` follows `next` past unlisted tools. It has a loop guard and throws if it never reaches a
    listed tool.
  - `upNext(tool)` links `effectiveNext(tool.next)`.
  - `headTags` adds `<meta name="robots" content="noindex">` when the tool is unlisted.
  - `resolvedNext()` writes `listed` and `to` (the effective target) for every tool, and `to` for every film. This is
    the **one resolver**: the site only reads `to`.
- **`package.json`**: add `node labs/estate-freeze/build.mjs` to `build`, and the lab's node tests and
  `shared/desk/tests/listed.test.mjs` to `test`.
- **The lab files:**
  - `build.mjs`, `model.mjs`, `index.src.html`, `app.js`, `style.css` (including `@media print`);
  - `tests/` (section 11).
  - The build writes `dist/index.html` (self-contained, fonts inlined, no request after load) and `dist/poster.json`.
  - **poster.json:** kind `band`; x from freezeAge to deemedAge; the series top and low are rounded to 1 decimal;
    death and deemed ages; reading `{label: 'gain taxed at death', value: '$12.1M → $3.2M'}`; label "Trust's 21st
    year"; example "A made-up retiree · Hypothetical illustration". It stays at 8 KB or less.

**While unlisted:** Money, then and now still leads to Tax dates, and the double-tax film still leads to Tax dates,
exactly as today.

### mo-portfolio-site (exact files)

1. **`src/lib/tools.ts`**:
   - `allTools` = every tool; `tools` = listed only.
   - `tool(slug)` searches listed only, so any stray reference to an unlisted tool fails the build.
   - `anyTool(slug)` searches allTools.
   - `projectOf` and `toolSlug` are built from listed tools; `projectOfAll` and `toolSlugAll` from all.
   - `filmNext` returns `tool(f.to)`.
2. **`scripts/sync-labs.mjs`**:
   - Copies dists and posters for every tool in the file (all tools, listed or not).
   - Fails if any tool's or film's `to` is not a listed tool.
3. **`src/layouts/Base.astro`**: a `noindex?: boolean` prop that emits `<meta name="robots" content="noindex">`
   alongside the existing `site.indexable` rule.
4. **`src/pages/tools/[slug]/how-i-made-it.astro`**:
   - `getStaticPaths` uses `toolSlugAll`.
   - It passes `noindex` when the tool is unlisted.
   - The "How I made this" link in the tool bar stays (it links within the tool's own pages).
5. **`src/content/projects/estate-freeze.mdx`** (new):
   - `hed` is the question; the `dek` is from section 1; `asOf` is set.
   - The write-up angle: "Rebuilding a printed one-page illustration as a tool, and drawing what the page stops short
     of: the trust's 21st year."
   - The source is never named or linked.
6. **`src/lib/copy.ts`**:
   - Delete `checkNext`; next.json is the one source.
   - The hed check in `words()` looks the tool up in allTools.
7. **`src/content.config.ts`**: remove `nextSlug` from the projects and explainers schemas. Delete the `nextSlug`
   line from the 6 project mdx files and the 5 explainer mdx files. Without this, the flip would need more than one
   edit.
8. **`src/pages/watch/[slug].astro`**: no change beyond `filmNext` now returning `to`.
9. **`src/pages/contact.astro`, `how-i-build.astro`, `404.astro`, `index.astro`**: no code change. They already use
   `tools`, `toolSlug` or `tool()`, which become listed-only.
10. **`src/pages/tools/index.astro`**: a fourth panel, shape `wide`, rendered only when `estate-freeze` is listed. It
    goes after the three flagships and before More tools; the existing three keep their order and shapes. Layout:
    - a full-width poster at 21:9;
    - below it, the question on columns 1–7 (card hed);
    - the dek and the chip "Drag" on columns 8–12;
    - stacked at phone widths.
11. **`src/lib/posters/draw.mjs`**: a new kind `band` (the two bands, the no-freeze edge, the death rule and the
    year-21 marker; one serif reading of 64px; at most two labels of 17px or more). Plus
    **`src/components/posters/estate-freeze.astro`**.
12. **`scripts/headlines.mjs`**: a block that runs `labs/estate-freeze/model.mjs` on the confirmed facts with EXAMPLE
    and writes `freezeGainBefore` ($12.1M), `freezeGainAfter` ($3.2M) and `freezePushed` ($2.38M), using the model's
    own formatters.
13. **OG:** `npm run og` renders `public/og/tools/estate-freeze.png` and records it in `src/data/og-posters.json`. It
    is needed even while unlisted, because the dist check requires og:image.
14. **Home (`src/data/front.json`)**: unchanged. The rail stays at 1 of 3. The home reaches the tool through the films
    strip: the double-tax film's page carries the tool as its Up next once listed. For a LinkedIn week, Mo can swap
    the tax-dates rail item for:
    `{ "slug": "estate-freeze", "poster": true, "dek": "Drag the portfolio. In a made-up example, {{freezeGainBefore}} of gain taxed at death becomes {{freezeGainAfter}}.", "chip": "Drag" }`
    The poster is already built.
15. **Tests:** `tests/unlisted.test.mjs` (new, added to `npm test`) and `tests/e2e/indexes.spec.ts` (section 11).

### Once `"listed": true`

The flip is that one edit, then `npm run check` here, `npm run sync-labs`, and `npm run check` in the site.

- **The chain:** Your year → CPP → Order of Returns → Money, then and now → **Estate freeze** → Tax dates → Retirement
  wave → Your year.
- **The film:** "Taxed twice at death" leads to the Estate freeze.
- **/tools/** gains the wide panel; **/how-i-build/** lists the making-of.
- noindex goes, the making-of page is indexable, and the tests flip their expectations from the flag.

---

## 11. Tests

### planning-lab

- **`labs/estate-freeze/tests/model.test.mjs`**, against the fixture **`example-sanity.json`**. Each case is checked
  against confirmed facts:

  | Quantity | Expected | Tolerance |
  |---|---|---|
  | gainNo | 12.11M | ±0.01M |
  | gainWith | 3.20M | ±0.01M |
  | trust | 8.91M | ±0.01M |
  | taxNo | 3.24M | ±0.01M |
  | taxWith | 0.86M | ±0.01M |
  | pushed | 2.38M | ±0.01M |
  | eatNo | 0.22M | ±0.005M |
  | eatWith | 0 | exact |
  | payableNo − payableWith | 2.60M | ±0.01M |
  | R_1 | 90,000 | ±1,000 |
  | cgRate | 26.76% | ±0.01 pt |
  | defaultDeathAge | 87 | exact |
  | deemedAge | 91 | exact |
  | rateYear | the latest complete year (2026 today) | exact |

  Also: the leftover company cash over all years is under 1% of `redeemed`. Display strings: "$2.38M", "$12.11M",
  "$3.20M", "$3.24M", "$0.86M", "$0.22M", "$3.46M".

  Edge cases:
  - cost = value;
  - growth 0 (pushed = redeemed × cgRate; state noGrowth);
  - income 0;
  - preferred shares exhausted (value $1M, cost 0, income $500K; exhaustedAge set, gainWith 0);
  - deemedFirst (freeze 60, death 87 → 81);
  - death = freeze + 1;
  - EAT facts removed → no eat fields and no throw;
  - corporate facts removed → no cash line;
  - each required fact removed → throws naming the id.
- **`tests/no-hardcoded.test.mjs`** (the pattern of the two-number-letter test, with a planted-figure self-check):
  - None of the used facts' values appear in model.mjs, app.js, build.mjs, index.src.html or style.css: 33, 13.16,
    5818, 7446, 15.63, 18.02, the 38.33…/30.66…/10.66… strings, 11.5, 50000. 26.76 and 0.2676 are banned too.
  - In model.mjs, outside the `EXAMPLE`, `BOUNDS` and formatter blocks, the only numeric literals allowed are 0, 1, 2
    and 100.
  - The ages 87 and 91 and the 21 are never typed in copy.
  - Every `'id'` the page reads exists and is confirmed.
  - EXAMPLE carries the label "Example assumptions, not facts".
- **`tests/words.test.mjs`** runs over the dist's visible text, the print sheet template and the card strings:
  - It fails on `\bshould\b|recommend|best for you|right for you|\bsaved\b|\bsavings?\b|tax-free|eliminat|avoids? tax|\byour (portfolio|estate)\b|prepared for`.
  - It requires "deferred" and the stamp, and that the H1 is 12 words or fewer with no digit.
- **`tests/page.spec.mjs`**, at 390 and 1440, light and dark:
  - expectShell(page, 'estate-freeze'), expectTemplate, expectStorageClean, expectTextSizes(page, 17.5, 17.5), and
    axe (wcag2a/aa, 21, 22aa);
  - expectReducedMotion with the slider's ArrowRight as the act;
  - label clashes are zero on the chart at the stepper extremes (the smallest wedge, the largest value,
    deemedFirst);
  - the Go deeper summary is at y ≤ 2,800 at 390;
  - the noindex meta is present while unlisted;
  - no request is made after load (`page.on('request')` after the load event is empty).
- **`tests/print.spec.mjs`**:
  - Under `emulateMedia({media:'print'})`, only `.sheet` is visible and its text is ≥ 17.5px.
  - `page.pdf` at Letter and at A4 gives exactly one page each, at the example and at the longest-text state.
- **`shared/desk/tests/listed.test.mjs`**:
  - effectiveNext on next.json, and on a fixture copy with `listed: true`. Unlisted gives money-then-now → tax-dates
    and the film → tax-dates; listed gives → estate-freeze.
  - Loop guard.
  - While the tool is unlisted, no other lab's dist contains `href="/tools/estate-freeze/"`.
  - resolvedNext writes `listed` and `to`.

### mo-portfolio-site

- **`tests/unlisted.test.mjs`**, over dist/, for every tool with `listed: false` in src/data/next.json:
  - No HTML outside `dist/tools/<slug>/` (which covers the tool and its how-i-made-it page) contains
    `href="/tools/<slug>/`.
  - Both of its pages carry noindex.
  - With the flag true, the same test asserts that the link exists on /tools/ and /watch/double-tax-at-death/.
- **`tests/e2e/indexes.spec.ts`**: the /tools/ flagship-panel count is 3, plus 1 when estate-freeze is listed.
- **The existing checks:** check:dist (compliance, one Up next, og:image present, denylist) and sizes.spec.ts (text
  ≥ 17.5px on the new panel once listed).

---

## 12. Open questions for Mo (none block the build)

1. The copy drops "at the latest" for the 21-year rule (section 9, item 1).
2. "One spouse owns everything": spousal rollover is not modelled and is not in the facts file. The caveat says gifts
   to a surviving spouse are not shown.
3. The default example matches the source illustration's numbers, because the sanity test needs them. Once the test
   passes, Mo may want a different default (for example $8M); the fixture keeps the reference inputs either way.
4. The 13 new facts were confirmed under Mo's standing OK (2026-11-15) and noted "Mo to review before the site is
   advertised". He needs to review them before the flag is flipped.
5. The firm's compliance review of the unlisted URL comes before `listed: true`.
