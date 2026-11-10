# Reel shell

Turns one `reel.json` into a 1080x1920 reel (H.264 MP4 under 25 MiB, with WebVTT captions of the on-screen text),
1080x1350 carousel slides and a LinkedIn PDF from the same cards, a contact sheet and a safe-zone overlay.
Rendered locally with HyperFrames (pinned, core CLI only, telemetry off, never `publish`) and FFmpeg.

## Make the next reel by writing a new JSON file
1. Copy `history-45/` to `reels/<name>/` and edit `reel.json`: the card order, the words and each card's `fact_ids`.
2. Card types: `hook`, `date`, `stat`, `chart`, `sources`, `end`. Words only in the JSON: a digit in any text field
   fails preflight. Every year and figure on a card comes from `shared/facts.json`.
3. `npm run reel -- reels/<name> --preflight`, then `npm run reel -- reels/<name> --strip 10` for test strips,
   then `npm run reel -- reels/<name> --look paper` for the full reel. Output lands in `reels/<name>/out/`.

## The evidence gate
Preflight runs before anything renders. It fails if a card (other than the end card) has no `fact_id`, if a
`fact_id` is missing from `facts.json`, or if the fact is not `confirmed`. `reels/shell/tests/` proves each case fails.

## Sources and licences
Look and method remixed from Win-Hao/code-video's "History explainer" (MIT), commit 6e806a5a14d7270f5e726cd07d16b4ef7fb4d2c9.
HyperFrames 0.8.217 (Apache-2.0). ZzFX 1.4.0 (MIT, Frank Force) for the ticks. GSAP 3.14.2 (standard no-charge licence).
Source Serif 4 and Archivo (SIL OFL 1.1). No voice, archive images or banknotes.

Education only, not advice. Made with AI assistance.
