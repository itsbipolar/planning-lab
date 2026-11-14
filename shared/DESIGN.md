# Design: direction B, "Documentary on the web"

Mo's words (2026-11-06, `mo-sample-portfolio/design/README.md`): picked B, first with changes (light by default), then "I like the dark look you have so let's do that like you sent in the pics. With the option to toggle a light mode later." Then: "Everything should follow the toggle."

## Rules
- **Scheme.** Dark by default; light is the alternative. The whole page switches as one (`data-theme` on `<html>`). Until the toggle ships at launch (Dec 6), the page is always dark. Picture bands stay dark in both. Tokens: `shared/tokens.json`, generated to `src/styles/tokens.css` by `npm run tokens`, which also fails on any text contrast under 4.5:1 or a light background within 0.02 (OKLab) of the cream defaults.
- **Type.** Instrument Serif (Mo's choice, V-108) for H1 and H2 only, never beside a numeral (headings with numbers use Archivo). Archivo for everything else, with tabular figures in tables and changing numbers. Body 18px (19px from 1100px), line height 1.55, reading column 66ch at most. Fonts are self-hosted through Fontsource.
- **Amber** (#F0A93E) has one job: a `<mark>` fill under the ground colour, once per screen at most, never in a heading, the marked words at weight 600. On dark it may also be link text. Chart turn marks: amber on dark, point-deep on light.
- **Layout.** Left-aligned, one text link in the hero, rows not cards, no rules except inside tables, meta as sentences, no arrows on links.
- **Motion.** CSS only: a 150-200 ms page crossfade and one scroll moment on the stripes (now `/tools/money-then-now/`), both inside `prefers-reduced-motion: no-preference`.

## Exceptions on the record (plan/06 section 3)
- T2: Instrument Serif is on the common-default font lists; allowed because Mo chose it (V-108).
- C6: dark by default instead of light by default; both schemes must pass every contrast check.
- Dark ground #15120E is a tinted near-black (look-1), kept as Mo's pick.

## Known quirk
Schibsted Grotesk's tabular-figures feature widens commas and colons. Archivo is the figure face here, so it does not apply; keep it in mind if Schibsted is ever used.
