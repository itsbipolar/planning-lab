# Company life insurance: build spec

Public slug `company-life-insurance`; lab `labs/corporate-insurance`. Built on the desk template (shared/desk; redesign
v2 sections 3, 5 and 6), the same way `labs/estate-freeze` was. The page goes live **unlisted**: it is at
`/tools/company-life-insurance/`, carries noindex, is nobody's Up next and is linked from nowhere, until one flag,
`"listed": false` in `shared/desk/next.json`, is flipped. Two gates come before the flip, in this order: Mo reviews the
facts that were Claude-checked under his standing OK, and his firm's compliance approves the unlisted URL.

Education only. A made-up owner. Only rules from confirmed facts, and no figure typed in. The safer route (Mo,
2026-11-17) governs every choice below. The page names no insurer, product, kind of policy, premium amount, cash value, quote or illustration. It has no sales path, contact prompt or call to act. It
never says "should", "best", "recommend" or "consider", and it does not mention LLQP.

**Review round, 2026-11-17 (this spec now matches the built page).** The comparison bar is off (`COMPARE = false`;
section 8.2): beside the account it read as what company-owned insurance gains, and the facts can't carry a fair
comparison (premiums from after-tax company dollars; a personally owned payout). The control is named "the policy's
cost base" ("tax cost" read as tax owed). The answer card has no mini bars: the chart is the one picture. Income tax is
rounded to the dollar, not to $1,000. Phones get a stacked key under the bar; one bracket spans the whole cost base. The
2027 Ontario credit (already confirmed, lower) gets one line in Change the example. Two Left out items were added
(the estate as first shareholder; borrowing-linked and older policies), and "permanent life insurance" was dropped.
Go deeper quotes 148(9) and 83(2) from the facts instead of paraphrasing them. The insurer par-fund comparison
is on hold and nothing here touches it.

---

## 0. The choice: scores and what was grafted

Each concept was scored 1 to 5 on six criteria. "Compliance" means how far the concept stays from a sales page under
the safer route.

| Concept | Journey | Clarity at 390 | Credibility | Compliance | Desk fit | Buildability | Total |
|---|---|---|---|---|---|---|---|
| **1. One payout, followed to the family (winner)** | 4 | 5 | 5 | 4 | 5 | 5 | **28** |
| 2. "The Split" (two-stage Sankey) | 4 | 3 | 4 | 4 | 3 | 2 | 20 |
| 3. The payout split, company or personal | 4 | 4 | 3 | 3 | 4 | 3 | 21 |

**Winner: concept 1.** One payout, one control (the policy's cost base at death), and one kind of number on the main path:
dollars of this one payout, each tagged with who ends up with it. Two bars on one scale are the desk's existing
chart vocabulary. Every rule it needs is already confirmed in facts.yaml.

**Grafted from concept 2:**
- The owner is never named: "a made-up owner" everywhere, like estate-freeze's "the retiree". No invented name to check
  against real people.
- The control says plainly that the tool does not estimate anyone's policy.
- A size-aware SVG at the container's pixel width, so no label is scaled below 17.5px.
- Playwright overlap checks at named thin-segment states.
- A visually hidden table carrying the same figures as the chart.
- Insurance-specific words added to the words test.
- The standing-OK note in Sources.

**Grafted from concept 3:**
- No Save my card, no print sheet and no shareable poster in v1. There is nothing to hand to anyone.
- The comparison bar is labelled "for comparison only".
- The example inputs live in one labelled `EXAMPLE` block.
- The numbers behind the chart are shown at 0, 25, 50, 75 and 100% of the payout.
- Honest edge-state lines at $0 and at the full payout.
- Every "Left out" group closes on a pointer to a tax professional and a lawyer.
- Mo's facts review and firm compliance are two separate gates.

**Not taken, and why:**
- **The Sankey (concept 2).** Ribbons thinner than a label at 17.5px collide at 390. Sankeys pull toward the AI look
  (gradients, liquid curves). It also needs a second layout for 1440 and costs about three times the build of two bars.
  Its Up next to estate-freeze would also make a self-door while it is unlisted: estate-freeze's own door would follow
  it back to estate-freeze.
- **The company-or-personal table (concept 3).** It needs two rules that are not in the facts: how a personally owned
  payout on death is taxed (148(9) "disposition"), and how premiums are taxed and paid either way. Without them the table
  is half "not covered here", and a half-empty comparison of ownership reads like the start of a sales conversation.
  The safer route leaves it out. The table is not drafted now.
- **The secondary line chart over every cost base (concept 3).** The two bars and the slider already show it; the table at
  0 to 100% covers the rest.
- **The H1 "Why do business owners hold life insurance in a company?"** (all three concepts). A "why" invites a reason to
  own a policy, and the page would answer it with a benefit. See section 1.
- **"The tax cost usually shrinks as a policy ages."** No confirmed fact says which way it moves. 148(9) gives only what
  raises it and what lowers it, and the net-cost-of-pure-insurance tables are not in the facts file. The page says what
  the Act says and names the rest under "Left out" (section 4.4).
- **The form number T2054.** It is only in a fact's notes, and facts.json carries no notes. The page says "the prescribed
  form" from the fact's value (section 4.3).
- **A count-up to a dollar figure on load, a "draft" chip, and a fourth panel on /tools/.** These follow estate-freeze's
  reasons: the count-up runs only after the visitor acts, compliance reviews exactly what will go public, and the
  tool goes into "More tools" instead (section 10).

---

## 1. Words

| Where | Text |
|---|---|
| H1 (next.json `question`) | **Where does a company's life insurance payout go?** (8 words, 48 characters, no digits) |
| Kicker | `TOOL` |
| Lede (one sentence, filled from state) | A made-up owner dies, and the company receives {$1,000,000}. |
| Card dek (projects mdx; no figures, 140 characters or fewer) | Drag the policy's cost base. In a made-up example, most of the payout can leave the company as a tax-free capital dividend. One part can't. |
| `<meta name="description">` / og:description | A made-up owner's company receives a life insurance payout. See how much can go to the family as a tax-free capital dividend, and the part that can't. Education, not advice. |
| Stamp (assumptions line, chart tag) | Hypothetical illustration · Education, not advice |
| Chip (More tools, once listed) | Drag |

**Why this H1.** It asks about the mechanism (where the money goes), not the motive. The finding goes in the dek and the
answer, as the redesign rule asks. It matches the chart's title. Mo may prefer the "Why do business owners..." wording;
that is open question 1, and it changes one string in next.json.

**Voice.** Use "the owner", "the company", "the family" and "the payout". Never "you" or "your company/policy/family".
A tax figure is "income tax". "Tax-free" appears only in the same sentence as "capital dividend" (83(2): "not included
in computing the income of any shareholder"). It is never said of the whole payout and never as a promise. Never use
"saves", "savings", "protect", "coverage", "need" or "afford".

**One term per concept, held across the page:**
- "a tax account the company keeps (the capital dividend account)" on first use, then "the capital dividend account" or
  "the account". The acronym appears only once, as `<abbr title="capital dividend account">CDA</abbr>` in How this is
  worked out.
- "the policy's cost base" (the help line names it once as the adjusted cost basis under the Income Tax Act), then
  "the cost base". Never "tax cost" (it reads as tax owed), never "ACB" on the page and never "cost" alone. Estate-freeze's "original cost" is not reused.
- "capital dividend" is always the tax-free part; "taxable dividend" is always the rest. Every "taxable dividend" on the
  page is a non-eligible one, and the assumptions say so once.
- "the payout" means the death benefit the company receives. "Death benefit" appears once, in What happens.
- No kind of policy is named: Left out says only "Which kind of policy.".

---

## 2. First screen

### 390px (approximate y values; the tests hold the limits)

1. **0–140: the shared tool bar** (desk-page `toolBar`): masthead, "← All tools", "How I made this", the theme icon.
2. **~156: the kicker** TOOL.
3. **~188–300: the H1**, display role, 3 lines.
4. **~310–370: the lede**, 2 lines.
5. **~385–500: the one control**, `[data-first-move]`:
   - the label "THE POLICY'S COST BASE AT DEATH" (label role, one line);
   - a serif tabular bubble "$200,000" above the thumb;
   - a native range from $0 to the payout, step $10,000, with a 48px thumb hit area;
     - aria-valuetext reads "$200,000, an example";
     - end ticks read "$0" and the payout;
   - the help (`#acb-help`, the slider's description) sits under the answer and the assumptions on phones, under the
     slider from 960px: "The cost base is the policy's adjusted cost basis under the Income Tax Act. The payout less it
     is what can go out as a capital dividend. Among other things, premiums raise it and the net cost of pure insurance
     lowers it." (the last sentence only when the 148(9) fact is confirmed);
6. **~515–700: the readout**, `[data-answer]` (desk `deskReadout`, aria-live polite, debounced 250ms):
   - `.readout-k` "Paid tax-free as a capital dividend" (6 words);
   - `.readout-v` "$800,000" in Source Serif 4 600, tabular lining, with `.readout-of` "of the $1,000,000 payout" beside it
     (sans, 17.5px or more; it wraps under the figure when there is no room);
   - `.readout-t` (14 words or fewer, by state, section 4.6): "If paid out now, the $200,000 cost base is a
     taxable dividend here.";
   - `details.readout-how` "How this is worked out" (closed; section 6).

   **Tested:** the big figure's bottom edge is at y ≤ 700 at 390, which is stricter than the template's top ≤ 700.
7. **The sum** (no bars here; the chart below is the one picture), a four-row ledger with a right-aligned money column:
     $800,000 as a capital dividend / + $104,520 after dividend tax / (rule) = $904,520 to the family in all (a size up,
     bold words) / $95,480 income tax. A hidden sentence states it for screen readers.
8. **The one `[data-assumptions]` line** (`.assume`, in the answer's column from 960px): "Hypothetical illustration · Education, not advice. A made-up
   Ontario owner; the family taxed at the {2026} top rate; every figure an example."

No chart sits above 700 at 390.

### 1440px

- 12-column container (1360 max). Text is capped at 68ch.
- **Play row:**
  - columns 1–7: kicker, H1 (display, 16ch), lede, slider and help line, the assumptions line;
  - columns 8–12: the readout, top-aligned to the H1, then the split.
- **Row 2:** What happens, three steps across all 12 columns.
- **Row 3:** the chart across all 12 columns, about 300px tall. At 1440×900 the chart's title is in view without
  scrolling.

### 768px

The 390 order, with the slider and the readout side by side (6/6).

Light is the default. Dark mode gets equal care through its own d1 and d4 tokens and the hatch stroke (section 5).

---

## 3. Controls

All bounds live in one exported `BOUNDS` object, labelled "UI bounds, not facts". The defaults are the example.

| Control | Where | Default | Range | Step |
|---|---|---|---|---|
| The policy's cost base at death | slider, first move | EXAMPLE.acb ($200,000) | $0 to the payout | $10,000 (arrows); PageUp/PageDown ±$100,000 |
| The payout | "Change the example" stepper | EXAMPLE.payout ($1,000,000) | $250,000 to $10,000,000 | $250,000 |

- **No other inputs:** no province, no dividend type, no tax year, no number of shareholders, no years held. The tax year
  is the latest year with a full set of confirmed facts (2026 today, because the 2027 brackets are pending). One line in
  Change the example says so.
- **Stepper:** desk pattern. The label is 17.5px or more; the − and + buttons are 48px; the `<output>` is serif tabular;
  a button is disabled at a bound and values never wrap. aria-label reads like "Increase the payout, now $1,000,000".
- **Clamp:** if the payout drops below the cost base, the cost base is clamped to the payout. A polite status line says
  "Cost base lowered to {payout}: it can't be more than the payout here." The slider's max always equals the payout.
- **Change the example** (open, under the chart):
  - the payout stepper;
  - one cue line naming what the control changes: "The payout changes the whole bar; the cost base moves the line between its
    parts";
  - an echo line when anything differs from the example: "Now: a {$2,500,000} payout, a {$400,000} cost base";
  - "Back to the example" (a text button, shown only when something differs);
  - "Rates for {2026}: the latest year with every figure published. Then, when a later year's Ontario non-eligible credit is
    already confirmed and lower (2027 today), in that fact's span: "The Ontario dividend credit is already set lower
    from {2027}, so with other rates unchanged the tax on the taxable part would be higher then."
- **Updates:** slider input redraws the chart on requestAnimationFrame. The readout uses the desk count-up: 300ms, only
  after the visitor acts, instant under reduced motion, never on load.
- **Storage:** inputs live in memory only. Nothing goes in the URL; no sessionStorage; the page does not read or write
  `mo.year`. localStorage holds only `theme`, written by the tool bar.

---

## 4. The engine: `labs/corporate-insurance/model.mjs`

The module is pure: no DOM and no I/O. It is tested in node and inlined into the page by build.mjs, with the same
`export`-stripping as estate-freeze.

### 4.1 Example, bounds and format (the only typed numbers)

```js
export const EXAMPLE = { label: 'Example assumptions, not facts', payout: 1_000_000, acb: 200_000 };
export const BOUNDS = { /* the table in section 3: UI bounds, not facts */ };
// FORMAT
export const ROUND = 1;            // income tax is rounded once, to the dollar
export const money = (n) => ...;   // "$95,480", "$1,000,000"; zero is "$0"; never K or M
```

**One formatter, full dollars.** Every dollar figure on the page, chart, hidden table and poster comes from `money()`.
No K/M scale switch is used: the inputs are on a $10,000 grid and the tax is rounded once to the dollar, so every part is
exact in whole dollars and every sum adds up. The longest string is "$10,000,000".

### 4.2 Rules from facts.json (confirmed only): `insuranceRules(facts)`

| Rule | Fact ids | How |
|---|---|---|
| rateYear | `federal_brackets.Y`, `ontario_brackets.Y`, `ontario_surtax.Y`, `ontario_dividend_tax_credit_non_eligible.Y` | The latest Y where all four are confirmed with values. That is 2026 today; 2027 is pending because its brackets are null. Never typed. |
| grossUp | `dividend_gross_up_non_eligible` | ÷ 100 |
| fedDTC | `federal_dividend_tax_credit_non_eligible` | ÷ 100, a share of the gross-up amount (121(a)) |
| onDTC | `ontario_dividend_tax_credit_non_eligible.{rateYear}` | ÷ 100, a share of the federal gross-up amount (19.1) |
| fedTop | `federal_brackets.{rateYear}` | the rate of the row with no `to`, ÷ 100 |
| onTop | `ontario_brackets.{rateYear}` | the rate of the row with no `to`, ÷ 100 |
| surtax | `ontario_surtax.{rateYear}` | the **sum** of the row rates ÷ 100 (the rows add; top-bracket assumption: basic Ontario tax is above the highest `from`) |
| creditAfterSurtax | `ontario_surtax_base` | a text rule: required to be confirmed; it fixes the order below |
| cdaAdd, cdaLess, election | `cda_life_insurance_proceeds`, `cda_life_insurance_acb_deduction`, `capital_dividend_election` | text rules; required; their titles and values feed What happens, How this is worked out and Sources |
| acbRule (optional) | `life_insurance_policy_acb_definition` | a text rule; feeds the help line and Go deeper "The cost base, in the Act" |

**The top rate on a non-eligible dividend, per $1 of dividend** (computed at build and in the page, never typed or
stored):

```
fed  = (1 + grossUp) × fedTop − grossUp × fedDTC
on   = (1 + grossUp) × onTop × (1 + surtax) − grossUp × onDTC     the Ontario credit comes off after the surtax (16(2))
rate = fed + on                                                   47.74% for 2026 (shown to 2 decimals, computed)
```

### 4.3 Missing facts: how the tool behaves

- **Required** (the build stops and names the id; there is no fallback value, ever): the four rate facts for one common
  year, `dividend_gross_up_non_eligible`, `federal_dividend_tax_credit_non_eligible`, `ontario_surtax_base`,
  `cda_life_insurance_proceeds`, `cda_life_insurance_acb_deduction` and `capital_dividend_election`. Without the three
  text rules the page has nothing true to say; without the rate facts it cannot compute the tax.
- **`life_insurance_policy_acb_definition` missing or not confirmed:** the help line under the slider and Go deeper's
  "The cost base, in the Act" are left out. The slider label and "an example" stay. Nothing else changes.
- **Rules that are not in the facts file at all.** The page states none of them and names them under "Left out"
  (section 7):
  - whether the company pays tax on receiving the payout;
  - how the cost base moves as a policy ages (the net-cost-of-pure-insurance tables are in the Regulations);
  - how a personally owned policy's payout is taxed;
  - how premiums are taxed or paid;
  - the tax on an election larger than the account, and the 83(2.1) anti-avoidance rules;
  - the tax on the owner's shares at death, and the payout's effect on their value;
  - the dividend refund, and the company's other tax accounts;
  - capital dividends paid to non-residents.

  If one of these is confirmed later, it is a new build decision, never a silent addition.
- **The form's name.** The page says "on the prescribed form, on time", from the election fact's value. T2054 is not
  typed. If Mo wants the form named, a text fact `capital_dividend_election_form` (source: the canada.ca forms page) is
  drafted under the standing OK; the page then shows its value. Without it, nothing changes.
- **2027.** When the 2027 brackets and surtax are confirmed, rateYear moves on its own and every figure follows. The
  2027 Ontario dividend credit (15.2283%) is already confirmed, so the rate for 2027 will be higher. A model test runs
  the rules on a copy with 2027 set to confirmed fixture values, to prove the year moves without a code change.

### 4.4 The split: `split(R, { payout, acb })`

```
acb       = min(acb, payout)                      clamped; the state notes it
cda       = payout − acb                          89(1) CDA (d)(ii) less (d)(iii): added to the account
capDiv    = cda                                   elected in full, on time (83(2)): not in the family's income
taxable   = acb                                   paid out as a taxable (non-eligible) dividend
tax       = round(taxable × rate / ROUND) × ROUND income tax, rounded once
afterTax  = taxable − tax                         reaches the family after dividend tax
family    = capDiv + afterTax                     everything that reaches the family
compare   = { tax: round(payout × rate / ROUND) × ROUND, family: payout − compare.tax }   the same payout as a taxable dividend
```

**Invariants (model.test):** capDiv + afterTax + tax = payout, and compare.family + compare.tax = payout, exactly, over
the whole grid (payout $250,000 to $10,000,000 by $250,000 × cost base $0 to the payout by $10,000).

**What it does not do:**
- It does not project the cost base over time.
- It does not estimate any policy's cost base.
- It does not add premiums.
- It does not tax the company.
- It does not choose between paying out now and keeping the money. The cost base part is assumed paid out now, so every
  dollar of the payout lands somewhere and the sum is the payout.

### 4.5 `tableRows(R, payout)`

Rows at cost base 0, 25, 50, 75 and 100% of the payout, each snapped to the $10,000 grid, plus the current state. Each row
holds: capDiv, afterTax, tax, family, compare.family and compare.tax.

### 4.6 States (the model reports; the page writes the words)

| State | When | `.readout-t` (14 words or fewer) |
|---|---|---|
| normal | 0 < acb < payout | If paid out now, the {$200,000} cost base is a taxable dividend here. |
| noCost | acb = 0 | No cost base at death: here, all of the payout can go out this way. |
| allCost | acb = payout | The cost base equals the payout, so none of it goes out this way. |

`clamped` adds the status line from section 3. In allCost the big figure reads "$0", and the first bar is d1-hatch and d4
only. The figure never hides.

---

## 5. The chart (one, full width, the desk chart frame)

`<figure class="chart" id="ins-chart">`.

**Caption.**
- Title (state-driven, no figures): "Where the payout goes" (normal); "All of it through the account" (noCost); "None of
  it through the account" (allCost).
- Subtitle: "Dollars of one example payout, by who ends up with them".
- Tags: the desk `tag-example` (EXAMPLE DATA) and the stamp, on their own line, flush with the heading.

**Marks.** One horizontal stacked bar (a second, for comparison, only when `COMPARE` is on; it is off, section 8.2). The
bar is as long as the payout. The x scale runs $0 to the payout, with no ticks (the readings carry the figures).

1. **"Through the capital dividend account"** (bar 1, 40px tall), left to right:
   - capital dividend, tax-free: **d1, solid**;
   - to the family after dividend tax: **d1 with a 45° hatch** (the same data type, the family's money, taxed
     differently);
   - income tax: **d4, solid** (estate-freeze's tax colour).
2. **"For comparison only: the same payout as a taxable dividend"** (bar 2, 28px tall, 24px below bar 1), left to right:
   to the family after dividend tax (d1 hatch), then income tax (d4).

There is no amber, no gradient, no rounded ends and no shadow. A 1px `--t-rule` seam separates segments. A segment of
$0 is not drawn.

**Readings on the chart, no legend.**
- **Under 640px (phones):** a stacked key under the bar, one row per part in bar order: an 18px swatch in the part's fill,
  the figure (serif 600 tabular) and the words (sans, 17.5px or more): "$800,000 · tax-free, capital dividend",
  "$104,520 · to the family, after dividend tax", "$95,480 · income tax". A $0 part has no row; its $0 still shows in
  the sum.
- **640px and wider:** readings in rows under the bar, each with a 2px bracket in its part's colour spanning the part.

**The one annotation** (600 weight, 17.5px): a 1.5px ink bracket over the whole cost base span (the hatched part and the
income tax), labelled once above it, right-aligned: "The $200,000 cost base: a taxable dividend here". It moves with the
slider. It is hidden in noCost and allCost, where the title says it.

**Interaction.**
- A tap or hover on a segment shows "{figure} · {who gets it}" pinned above the bars. No line invites it (every part is
  already labelled).
- On touch the reading stays after the finger lifts, until a tap elsewhere. This is a capture listener in app.js, as in
  estate-freeze, not a change to shared/desk.
- The chart is focusable; Left and Right step through the segments.
- There is no draw-on animation and no pulse. The boundary moves only with input.

**Sizes.** The SVG is drawn at the container's measured width (ResizeObserver; 1 unit = 1px), so text renders at its
CSS size: about 358×250 at 390 and 1360×200 at 1440. All text is 17.5px or more, measured as font-size ×
getScreenCTM.

**Colour and contrast.** d1 and d4 come from the desk tokens in both schemes. In both schemes the d1 hatch (2px strokes,
6px apart) and the solid fills must reach 3:1 against the ground, and d1 against d4 must also reach 3:1 (WCAG 1.4.11).
This is checked in page.spec by computed style and in `npm run tokens` on the site.

**Accessibility.**
- role="img" with a `<title>` and a generated `<desc>` that states the three amounts.
- A visually hidden `<table>` carries the same figures.
- The aria-live readout repeats them in words.

---

## 6. The page below the first screen, in order

1. **The sum and the help**, as in section 2.
2. **What happens** (three numbered steps set as text over one rule, no figures; across three columns from 960):
   1. **The payout.** When the owner dies, the company receives the policy's death benefit.
   2. **The account.** The payout, less the policy's cost base just before the death, is added to a running tax tally
      the company keeps (the capital dividend account). No money moves.
   3. **The election.** The company elects, on the prescribed form and on time, to pay that much as a capital dividend.
      It is not counted in the family's income. Here, the cost base part is paid out now as an ordinary taxable dividend.

   Each step's wording is checked against its fact's value by a test (keywords: "less", "immediately before the
   death"/"just before", "elects", "no part ... included").
3. **The chart** (section 5).
4. **Change the example** (section 3).
5. **Go deeper** (`details.deeper`, closed). Its summary is at y ≤ 2,800 at 390 (tested). `deskDeeper` writes the "In
   this section:" line. It has four parts:
   1. **"The cost base, in the Act"** [acbRule]: "Section 148(9) of the Act builds the cost base from a formula. In the
      words of the facts this page reads:", then the fact's value itself (no paraphrase of the rule). Then one line:
      "Which way it moves over a policy's life depends on the policy; this tool does not estimate it." No figures, no
      curve, no policy types.
   2. **"The dividend tax on the taxable part"**: per $100 of dividend, every rate in a `<span data-fact="id">`:
      - $100 is taxed as $115 of income (gross-up {15%});
      - federal: $115 × {33%} = $37.95, less a credit of {9/13 shown as 69.23%} of the $15 gross-up = $10.38;
      - Ontario: $115 × {13.16%} = $15.13, plus the surtax ({20% + 36%} of it) = $8.47;
      - then the Ontario credit of {22.895%} of the $15 gross-up = $3.43, taken off after the surtax (16(2));
      - total ≈ $47.74, so the top rate on this dividend in {2026} is {47.74%}.

      Each line is rounded to the cent. A test checks that the shown lines add to the shown total within $0.02. The
      bracket in the text above names the fact; every figure on the page is computed.
   3. **"The election"**: "Section 83(2) of the Act, in the words of the facts this page reads:", then the fact's value.
      Then one line: "An election larger than the account has consequences of its own; those, and the anti-avoidance
      rules around the election, are left out here."
   4. **"The numbers behind the chart"**: the table from `tableRows`. The money columns come first ("Capital dividend,
      tax-free", "To the family after dividend tax", "Income tax", "Family in all"), after "Cost base". The current
      state's row is marked "now". When columns are cut off, its caption counts them. The first column is held.
6. **This example assumes** (one `.callout` block in three groups; three columns from 960; each item 16 words or fewer):
   - **The set-up:**
     - A made-up owner of an Ontario private company.
     - The company owns the policy and is its beneficiary.
     - The account holds only this payout, with nothing else added or taken off.
     - The owner's family are the company's shareholders after the death.
   - **Paying it out:**
     - The election is made on time, for the full dividend.
     - The cost base part is paid out now, as a non-eligible dividend.
     - The family is taxed at the {2026} top Ontario rate.
   - **Left out:**
     - Premiums, and how they are paid.
     - Which kind of policy.
     - Policies tied to borrowing arrangements, and some older policies.
     - The estate as the first shareholder after the death.
     - Any tax the company may pay on the payout.
     - How the cost base changes over the years.
     - Holding the policy personally.
     - Tax on the owner's shares at death, and the payout's effect on their value.
     - Probate; creditors' claims on company assets.
     - The dividend refund and other company tax accounts.
     - Keeping the money in the company.
     - Family members outside Ontario or Canada.
     - Lower brackets.

   Closing line: "How any of this applies to a real company is a question for a tax professional and a lawyer."
7. **Sources** (desk fold). For every fact used: its title (which carries the section, for example "Income Tax Act 89(1),
   capital dividend account, paragraph (d)"), its source link and its as_of. All links are on laws-lois.justice.gc.ca,
   ontario.ca and canada.ca. Then the note: "These rules were checked against the statutes and the government's pages
   on {as_of}; reference data, verify at the source." Then the version line: "Version {hash} · rates for {rateYear} ·
   made in this browser; nothing was sent." The `{hash}` is the first 8 hex of sha256 over model.mjs and the used facts.
8. **Up next:** one `a[data-next]`, "What's your next tax date?" (tax-dates), through the flag rule (section 10).

### "How this is worked out" (inside the readout, closed; filled live; each rate in a fact span)

1. Into the capital dividend account <abbr title="capital dividend account">CDA</abbr>: payout {$1,000,000} − the policy's
   cost base {$200,000} = {$800,000}.
2. Elected as a capital dividend: {$800,000}, not counted in the family's income.
3. The cost base part, {$200,000}, paid out now as a taxable dividend: income tax {$200,000} × {47.74%} = {$95,480} (to
   the dollar), leaving {$104,520}.
4. The family receives {$800,000} + {$104,520} = {$904,520} of the {$1,000,000}.

Closing sentence: "The rate is the {2026} top federal and Ontario rate on a non-eligible dividend, worked out in Go deeper."

---

## 7. No print sheet, no card, no share in v1

There is no Save as one page, no Save my card and no `navigator.share`. On a sales-adjacent topic a printable sheet or
card is a thing to hand to someone. The page has no amber action, so `.btn-you` is not used. Revisit only after firm
compliance approves the page.

---

## 8. Honesty and compliance

1. **Words test** (section 11). The page never names an insurer, product, policy illustration, premium figure, quote or
   "agent", and has no contact or booking path. It never mentions LLQP. Insurer names go only into the private
   denylist that the site's `check:dist` already reads (`DENYLIST` / the private denylist file), never into any repo
   file, test included. The same applies to the firm's name.
2. **The comparison bar is off** (`COMPARE = false` in app.js; the review round of 2026-11-17, under Mo's safer
   route). Beside the account it read as what company-owned insurance gains ($904,520 against $522,598), but nobody
   pays a payout out as a taxable dividend instead of using the account, and a fair comparison needs rules the facts
   don't hold (premiums come from after-tax company dollars; a personally owned policy's payout). The flag also drops
   the poster's second bar (build.mjs reads it) and the table's comparison columns; the tests read it. Turning it back
   on needs those facts and a line saying the gap is not a saving against other ways to hold a policy.
3. **"Tax-free"** appears only beside "capital dividend" (tested sentence by sentence) and is backed by the 83(2) fact.
4. **Unlisted until two gates pass:** Mo's facts review, then firm compliance on the unlisted URL. The making-of page is
   scrubbed the same way. It describes building from statute text and leaving the product side out on purpose. It never
   names the employer, an insurer or LLQP.
5. **Facts are Claude-checked under the standing OK of 2026-11-12** and marked "Mo to review before the site is
   advertised" in facts.yaml. The page's Sources note claims only that the rules were checked against the source, never
   that Mo or a professional reviewed them.

---

## 9. Build files

- `labs/corporate-insurance/build.mjs`, `model.mjs`, `index.src.html`, `app.js`, `style.css`;
  `fixtures/example-sanity.json`; `tests/` (section 11).
- The build writes `dist/index.html` (self-contained, fonts inlined, no request after load, noindex while unlisted) and
  `dist/poster.json`.
- **poster.json:** a new kind `split` (add it to the kinds list in shared/desk/poster.mjs's header comment). It carries:
  - two bars as fractions of the payout ([capDiv, afterTax, tax] and [compare.family, compare.tax]);
  - one reading, `{ label: 'paid tax-free as a capital dividend', value: '$800,000' }`;
  - the label "For comparison: as a taxable dividend";
  - example "A made-up owner · Hypothetical illustration";
  - 8 KB or less.
- **package.json:** add `node labs/corporate-insurance/build.mjs` to `build`, and `labs/corporate-insurance/tests/model.test.mjs`,
  `no-hardcoded.test.mjs` and `words.test.mjs` to `test`. Playwright picks up `tests/page.spec.mjs`.

---

## 10. Placement behind the flag

### planning-lab: `shared/desk/next.json`

Insert the tool between estate-freeze and tax-dates, and point estate-freeze's door at it:

```json
{ "slug": "estate-freeze", "labSlug": "estate-freeze", "question": "How much tax does an estate freeze push past death?", "next": "company-life-insurance", "listed": true },
{ "slug": "company-life-insurance", "labSlug": "corporate-insurance", "question": "Where does a company's life insurance payout go?", "next": "tax-dates", "listed": false },
```

- **While unlisted:** `resolvedNext` writes estate-freeze's `to` as `tax-dates` (it follows the unlisted tool's own
  next). Estate-freeze's dist still shows "What's your next tax date?", exactly as today. The new tool's own Up next is
  Tax dates. No film points to it.
- **No code change** in desk-page.mjs: `isListed`, `effectiveNext`, `resolvedNext` and the noindex in `headTags`
  already exist.
- **`shared/desk/tests/listed.test.mjs`** gains:
  - while company-life-insurance is unlisted, estate-freeze resolves to tax-dates and its dist links
    `/tools/tax-dates/`;
  - on a copy with the flag true, estate-freeze resolves to company-life-insurance;
  - no other lab's dist contains `href="/tools/company-life-insurance/"`;
  - its dist carries noindex.

  The existing generic checks already loop over every unlisted tool.

### mo-portfolio-site (exact files)

1. **`src/lib/placement.mjs`:** `MORE` becomes `['money-then-now', 'company-life-insurance', 'tax-dates',
   'retirement-wave']`. `toolsPage` already filters MORE by listed, so this is safe while unlisted and needs no second
   edit at the flip. No new panel shape and no change to FLAGSHIPS or WIDE.
2. **`src/content/projects/corporate-insurance.mdx`** (new; the project id is the lab's name, as with
   `two-number-letter`):
   - `hed` is the question; `dek` is from section 1; `kind` "Tool"; `verb` "Drag"; `asOf` 2026-11-17.
   - `posterAlt`: "Two bars of one made-up company's life insurance payout: the part paid tax-free as a capital
     dividend, the part paid as a taxable dividend and its income tax, and the same payout as a taxable dividend for
     comparison."
   - The write-up angle: "Building an insurance topic from the statute alone: what the page leaves out on purpose, and
     why."
3. **`src/lib/posters/draw.mjs`:** a new kind `split` (two stacked bars, one serif reading of 64px, at most two labels
   of 17px or more), plus **`src/components/posters/company-life-insurance.astro`**.
4. **`scripts/covers.mjs`** (keyed by the lab's name): an entry `['corporate-insurance', '#ins-chart', null, 480]`, and
   a `FIRST['corporate-insurance']` licence and credit line in the estate-freeze pattern (the credit names a made-up
   owner and "hypothetical illustration, education only"). Then **`npm run og`** renders `public/og/tools/company-life-insurance.png` and
   records it in `src/data/og-posters.json`. This is needed while unlisted, because the dist check requires og:image.
5. **`scripts/headlines.mjs`:** no change. The dek has no figures.
6. **`npm run sync-labs`** copies the dist and poster, and writes src/data/next.json with `listed` and `to`.
7. **`npm run build`** runs `scripts/csp.mjs`, which regenerates the inline-script hashes in `worker/csp.json` for the
   new dist. `tests/csp.test.mjs` and `tests/e2e/csp.spec.ts` must pass on it.
8. **Tests:**
   - `tests/unlisted.test.mjs` and `tests/e2e/unlisted.spec.ts` already cover every tool with `listed: false`, so the
     new slug is checked automatically: no page links to it but its own two, both carry noindex, and its making-of page
     leads only to listed tools.
   - Add to `tests/unlisted.test.mjs`: with the flag flipped on a copy, `toolsPage().more` contains it after
     money-then-now, and estate-freeze's `to` is company-life-insurance.
   - `tests/e2e/indexes.spec.ts`: the More tools count is 3, plus 1 when the tool is listed.
9. **Unchanged:** home (`src/data/front.json`), the films, Base.astro, tools.ts, copy.ts and the how-i-made-it route.
   They already handle unlisted tools.

### Once `"listed": true`

The flip is one edit. Then run `npm run check` here, `npm run sync-labs`, and `npm run check` in the site.

- **The chain:** … → Money, then and now → Estate freeze → **Company life insurance** → Tax dates → Retirement wave →
  Your year.
- **/tools/:** the tool appears in More tools.
- **/how-i-build/:** it lists the making-of page.
- noindex goes.
- The tests flip their expectations from the flag.

---

## 11. Tests

### planning-lab

- **`labs/corporate-insurance/tests/model.test.mjs`**, against `fixtures/example-sanity.json`. The fixture holds a hand
  calculation of the rate, step by step.

  | Quantity | Expected | Tolerance |
  |---|---|---|
  | rate (2026, non-eligible, top) | 47.74% | ±0.005 pt |
  | fed part per $1 | 0.27565 | ±0.00001 |
  | on part per $1 | 0.20175 | ±0.00001 |
  | capDiv | 800,000 | exact |
  | tax | 95,480 | exact |
  | afterTax | 104,520 | exact |
  | family | 904,520 | exact |
  | compare.tax / compare.family | 477,000 / 523,000 | exact |
  | rateYear | 2026 today | exact |

  Also:
  - The Ontario credit applied before the surtax gives a different rate, and the model does not use it.
  - The sums are exact over the full grid (section 4.4).
  - capDiv and family never rise as the cost base rises.
  - States: noCost at 0, allCost at the payout, and clamped when the payout is set below the cost base.
  - The longest state is $10,000,000 with $0 cost base.
  - Each required fact removed, or set to unverified, throws an error naming its id.
  - With `life_insurance_policy_acb_definition` removed there is no throw, and `acbRule` is null.
  - On a copy with every 2027 fact confirmed, rateYear is 2027, using the 2027 Ontario credit.
  - Display strings: "$800,000", "$95,480", "$1,000,000", "$10,000,000" and "$0".
- **`tests/no-hardcoded.test.mjs`** (the estate-freeze pattern, with a planted-figure self-check):
  - The values of every fact used, read from facts.json at test time, appear in none of model.mjs, app.js, build.mjs,
    index.src.html or style.css. That covers 15, 69.23…, 22.895, 15.2283, 33, 13.16, 5818, 7446, 20 and 36 as rates.
  - Neither do the derived 47.74 / 0.4774 / 47.7, "9/13" or "T2054".
  - In model.mjs, outside the `EXAMPLE`, `BOUNDS` and FORMAT blocks, the only numeric literals are 0, 1 and 100.
  - Every fact id the page reads exists and is confirmed.
  - EXAMPLE carries "Example assumptions, not facts".
- **`tests/words.test.mjs`**, over the dist's visible text, aria strings, the poster and the making-of mdx:
  - It fails on `\bshould\b|recommend|\bbest\b|consider|right for you|\bbuy|purchas|\bquote|illustration of a policy|premium[^.]{0,20}\$|\$[^.]{0,20}premium|coverage|protect|agent|licen[cs]ed|LLQP|advis[eo]r|planner|savings?|\bsaved?\b|guarantee|\byour (company|policy|family|payout|business)\b|call us|book|contact`.
    Exception: "Contact" in the shared footer, which is outside the tool's main.
  - It also fails on "ACB" outside the single `<abbr>`, and on "CDA" outside its `<abbr>`.
  - Every sentence with "tax-free" also contains "capital dividend".
  - It requires the stamp and the closing professional line, and that the H1 is 12 words or fewer, 60 characters or
    fewer, with no digit.
  - The private denylist (insurers, firm) is checked by the site's `check:dist` on the copied dist.
- **`tests/page.spec.mjs`**, at 390 and 1440, light and dark:
  - expectShell(page, 'corporate-insurance'); expectTemplate; expectStorageClean; expectTextSizes(page, 17.5, 17.5);
    axe (wcag2a/aa, 21, 22aa); expectReducedMotion, with the slider's ArrowRight as the act.
  - At 390, the big figure's bottom is ≤ 700, and the Go deeper summary is at y ≤ 2,800.
  - No horizontal page scroll.
  - Zero label collisions on the chart at these states: ($1M, $0), ($1M, $10,000), ($1M, $500,000), ($1M, $990,000),
    ($1M, $1M), ($10M, $0), ($10M, $10,000), ($250,000, $240,000).
  - At ($10M, $0) and ($10M, $5M) at 390, no money cell or reading wraps inside a figure.
  - A tapped segment's reading stays after touchend.
  - The non-text contrast in section 5 holds in both schemes.
  - The noindex meta is present while unlisted.
  - No request is made after the load event.
  - The aria-live readout's text matches the chart's `<desc>` figures.
- **`shared/desk/tests/listed.test.mjs`:** the additions in section 10.

### mo-portfolio-site

- The unlisted tests run over the new slug automatically, plus the additions in section 10.
- check:dist runs compliance, the denylist, one Up next and og:image.
- sizes.spec.ts checks text at 17.5px or more on the More tools tile once listed.
- The csp tests run on the regenerated hashes.

### Before Mo sees it

Run three cold reads on the built page: an owner at 390, a planner at 1440 and a skimmer at 390. Fix what they trip
on, with at most two rounds. Then send Mo the screenshots at 390/768/1440 in both schemes.

---

## 12. Open questions for Mo (none block the build)

1. **The H1.** "Where does a company's life insurance payout go?" (built) or "Why do business owners hold life insurance
   in a company?" The first asks about the mechanism; the second asks for a reason to own a policy, which sits closer
   to sales. It is one string in next.json.
2. **The comparison bar** is off (section 8.2). Bringing it back needs the facts named there and the firm's OK.
3. **The facts review.** The 12 entries added on 2026-11-17 under the standing OK are marked "Mo to review before the
   site is advertised". They come before the flip, together with the firm's compliance OK.
4. **Naming the form (T2054).** It needs one more text fact. The page reads fine without it.
