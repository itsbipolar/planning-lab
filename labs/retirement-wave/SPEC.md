# The retirement wave (P5a): spec

Rebuilt 2026-11-13 in the Data desk look (shared/desk). A heatmap of how many people were each age from the snapshot's
first to last age, on July 1 of every year in Statistics Canada's table 17-10-0005-01, with the rule ages from the verified
facts file (CPP earliest, standard and latest start, OAS start and deferral end, RRSP maturity, the OAS increase at the age
in that fact's title) as dashed lines. Education only.

- Data: `shared/data/population-by-age-places.json`, a dated snapshot made by `npm run fetch-population` (never at load):
  Canada, each province and the three territories summed (NWT and Nunavut split in 1991), Men+ and Women+, ages 50 to 89,
  and each year's population of all ages (for shares). All genders = Men+ plus Women+ (the script checks it equals StatCan's
  Total - gender). Ages 90 and over are left out: single years start in 2001.
- `model.mjs` computes everything shown: the rule ages (confirmed only; the two the headline needs stop the build, any other
  missing one is left off), views by place and gender, counts or shares, the headline, a birth year's diagonal and its
  readings. `scale.mjs` writes one-hue colour steps (d1 blue, OKLab) for both schemes. No rule age, count or data year is
  typed into the code (a test checks, and proves it can fail).
- Page (redesign v2 step 2): the question H1 and the answer under it are computed from the model and written in at build
  (the OAS age in the question; the counts and years in the answer), one assumptions line above the controls, the amber
  button only for drawing the reader's own diagonal, the heatmap in the desk chart frame, every text 16.5px or more.
- Page: computed headline (people between the earliest CPP age and the OAS age on the latest July 1: counted, not projected),
  place, gender and number/share controls, the heatmap with a legend of real values, rule labels that never overlap, a
  birth-year diagonal (example 1965) with readings where it crosses each rule age, the table, sources and notes, image save.
- History only: no forecast. Later rule ages for a diagonal are named "after the data ends", without counts.
