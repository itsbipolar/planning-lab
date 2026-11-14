// The yearly series from the dated snapshots in shared/data/: the annual change in the average consumer price index
// (complete years only) and the Bank of Canada's weekly prime rate as a yearly average (complete years only).
// Moved here from labs/money-stripes/build.mjs when that lab was archived (redesign v2, step 6); the site's stripes band
// (mo-portfolio-site scripts/stripes-lib.mjs) reads the same function.
export function series(cpiFile, rateFile) {
  const cpi = JSON.parse(cpiFile), rate = JSON.parse(rateFile);
  const sums = {};
  for (const [ym, v] of cpi.months) { const y = Number(ym.slice(0, 4)); (sums[y] ||= []).push(v); }
  const avg = {}; for (const [y, v] of Object.entries(sums)) if (v.length === 12) avg[y] = v.reduce((a, b) => a + b, 0) / 12;   // complete years only
  const infl = Object.keys(avg).map(Number).filter((y) => avg[y - 1] !== undefined).sort((a, b) => a - b).map((y) => [y, (avg[y] / avg[y - 1] - 1) * 100]);
  const wk = {}; for (const [d, v] of rate.weeks) (wk[Number(d.slice(0, 4))] ||= []).push(v);
  const lastCpi = infl[infl.length - 1][0];
  const primes = Object.keys(wk).map(Number).filter((y) => y <= lastCpi && wk[y].length >= 50) /* complete years only */.sort((a, b) => a - b).map((y) => [y, wk[y].reduce((a, b) => a + b, 0) / wk[y].length]);
  return { cpi: infl, rate: primes, meta: { cpi: { attribution: cpi.attribution, source_url: cpi.source_url, retrieved: cpi.retrieved }, rate: { attribution: rate.attribution, terms_url: rate.terms_url, retrieved: rate.retrieved } } };
}
