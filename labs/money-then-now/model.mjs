// Money, then and now: the arithmetic on the yearly series. Pure functions with no figure of their own;
// build.mjs inlines this file into the page and the tests import it.
// The example the page opens on (an illustration, labelled as one): an amount and a year it is shown from.
export const EXAMPLE = { year: 1990, amount: 100 };

export function yearsOf(M) { const out = []; for (let y = M.first; y <= M.last; y++) out.push(y); return out; }

// An amount from one year expressed in another year's dollars, by the ratio of the yearly average price levels.
export function worth(M, amount, from, to) { return amount * (M.avg[to] / M.avg[from]); }

// The simple after-the-fact real rate: the year's average prime rate minus that year's price rise.
export function realRate(M, y) { return M.prime[y] == null ? null : M.prime[y] - M.infl[y]; }

const RECENT_WINDOW = 30; // years counted as "recent" when looking for the latest jump in prices

export function extremes(M) {
  const ys = yearsOf(M);
  const rise = ys.reduce((a, y) => (M.infl[y] > M.infl[a] ? y : a));
  const fall = ys.reduce((a, y) => (M.infl[y] < M.infl[a] ? y : a));
  const recentYs = ys.filter((y) => y > M.last - RECENT_WINDOW);
  let recent = recentYs.reduce((a, y) => (M.infl[y] > M.infl[a] ? y : a));
  let since = null;
  for (let y = recent - 1; y >= M.first; y--) if (M.infl[y] >= M.infl[recent]) { since = y; break; }
  if (recent === rise || since == null || M.last - since < RECENT_WINDOW) recent = null;
  return { rise, fall, recent, since: recent == null ? null : since };
}

// Runs of years, from the first prime-rate year, when prime was below that year's price rise.
export function negSpans(M) {
  const out = []; let cur = null;
  for (let y = M.primeFirst; y <= M.last; y++) {
    const r = realRate(M, y);
    if (r != null && r < 0) { if (cur && cur[1] === y - 1) cur[1] = y; else out.push(cur = [y, y]); }
  }
  return out;
}

export function counts(M) {
  const ys = yearsOf(M), py = ys.filter((y) => M.prime[y] != null);
  return {
    years: ys.length, rose: ys.filter((y) => M.infl[y] > 0).length, fell: ys.filter((y) => M.infl[y] < 0).length,
    primeYears: py.length, below: py.filter((y) => realRate(M, y) < 0).length,
  };
}
