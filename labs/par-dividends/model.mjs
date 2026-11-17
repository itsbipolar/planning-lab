// Participating policy dividends: the made-up example account (SPEC.md section 4). Pure: no DOM, no I/O. Tested in
// node and inlined into the page by build.mjs (export-stripping, as in estate-freeze).
//
// A port of the research guide's reference implementation (Part 2.3), with the same names and the same order of steps.
// Three differences, all outside the arithmetic:
//   - The yields come in as an argument (Y), built from the dated snapshot by yieldsFrom(), instead of a file read.
//   - run() takes its settings as one object and returns unrounded percentages; rounding happens once, in FORMAT.
//   - `end` defaults to the snapshot's last full year instead of a typed year.
//
// Only one input is real: the year-end long-term Government of Canada bond yield (Statistics Canada table 10-10-0122-01,
// vector v122487, Bank of Canada data). Every other number here is a made-up setting, labelled as one on the page. Nothing
// here is any insurer's account, method, period or rate.

// ASSUMPTIONS (made-up settings, not facts; every one is listed in the page's assumptions block)
export const EXAMPLE = {
  label: 'Example assumptions, not facts',
  N: 5,          // spread growth-asset gains and losses over N years (the visitor's control)
  w: 0.7,        // fixed-income share of the made-up account
  L: 10,         // bond ladder length, years
  spread: 0.01,  // made-up credit spread over government yields, both lines
  prem: 0.04,    // made-up growth-asset premium over the long bond yield
  start: 1980,   // first year shown
};
// Made-up growth-asset surprises, percentage points, zero mean, repeating every 13 years from `start`. They follow no real
// market. 13 long so that no N from 1 to 10 cancels them exactly.
export const PAT = [12, 18, -8, 5, -26, 14, 9, -16, 3, -11, 7, -2, -5];
export const STEADY = [0]; // the "steady (no swings)" switch
// UI bounds, not facts
export const BOUNDS = {
  N: { min: 1, max: 10, step: 1 },
  w: { min: 0.5, max: 0.9, step: 0.05 },
  L: [5, 10, 20],
};
// end ASSUMPTIONS

/** Year-end yields as decimals, keyed by year, from the snapshot's ["YYYY-12", percent] pairs. */
export function yieldsFrom(snapshot) {
  const Y = {};
  for (const [ym, v] of snapshot.values) {
    const [yy, mm] = ym.split('-');
    if (mm !== '12' || !Number.isFinite(v)) throw new Error(`par-dividends: bad snapshot row ${ym}`);
    Y[Number(yy)] = v / 100;
  }
  const years = Object.keys(Y).map(Number);
  return { Y, first: Math.min(...years), last: Math.max(...years) };
}

/** Price of a par-100 annual-coupon bond with n years left, on a flat yield y. */
export function price(c, y, n) {
  if (n <= 0) return 100.0;
  let s = 0;
  for (let k = 1; k <= n; k++) s += (100 * c) / (1 + y) ** k;
  return s + 100 / (1 + y) ** n;
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/**
 * The two lines, year by year.
 * Ladder: L rungs, equal face 100; rung i bought at the end of year (start-1-i), maturing in L-i years; coupon = the
 * yield at purchase. Each year one rung matures and is reinvested at that year-end's yield.
 * Returns [{ year, bond, actual, credited }] in percent, unrounded.
 */
export function run(Y, {
  N = EXAMPLE.N, w = EXAMPLE.w, L = EXAMPLE.L, spread = EXAMPLE.spread, prem = EXAMPLE.prem,
  start = EXAMPLE.start, end = Math.max(...Object.keys(Y).map(Number)), pattern = PAT,
} = {}) {
  for (let t = start - L; t <= end; t++) {
    if (!Number.isFinite(Y[t])) throw new Error(`par-dividends: no year-end yield for ${t}`);
  }
  const t0 = start;
  let rungs = [];
  for (let i = 0; i < L; i++) rungs.push([Y[t0 - 1 - i], L - i]); // [coupon, years left at the end of year t0-1]
  let pend = [];
  const out = [];
  for (let t = start; t <= end; t++) {
    const y0 = Y[t - 1], y1 = Y[t];
    const v0 = sum(rungs.map(([c, n]) => price(c, y0, n)));
    const book = sum(rungs.map(([c]) => 100 * c)) / (100 * L); // income yield on face (book yield)
    const inc = sum(rungs.map(([c]) => 100 * c));
    rungs = rungs.map(([c, n]) => [c, n - 1]);
    const v1 = sum(rungs.map(([c, n]) => price(c, y1, n))); // the matured rung (n = 0) is worth 100
    const fi_mtm = (inc + v1 - v0) / v0;
    rungs = [...rungs.filter(([, n]) => n > 0), [y1, L]]; // reinvest the matured 100 at this year-end's yield
    const s = pattern[(t - start) % pattern.length] / 100;
    const g_exp = y0 + prem;
    const actual = w * (fi_mtm + spread) + (1 - w) * (g_exp + s);
    pend.push([s / N, N]);
    const rel = sum(pend.map(([a]) => a));
    pend = pend.filter(([, k]) => k > 1).map(([a, k]) => [a, k - 1]);
    const credited = w * (book + spread) + (1 - w) * (g_exp + rel);
    out.push({ year: t, bond: 100 * y1, actual: 100 * actual, credited: 100 * credited });
  }
  return out;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs) => sum(xs) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

/** What the page states, computed from a run (never typed). Moves are year-over-year changes, in points. */
export function summary(out) {
  const moves = (k) => out.slice(1).map((r, i) => r[k] - out[i][k]);
  const at = (k, pick) => out.reduce((a, r) => (pick(r[k], a[k]) ? r : a));
  const mA = moves('actual'), mC = moves('credited');
  const biggest = (m) => m.reduce((b, x, i) => (Math.abs(x) > Math.abs(m[b]) ? i : b), 0); // first one on a tie
  const iA = biggest(mA), iC = biggest(mC);
  return {
    first: out[0].year, last: out.at(-1).year,
    maxMoveActual: Math.abs(mA[iA]), maxMoveActualYear: out[iA + 1].year,       // the year the change lands in
    maxMoveCredited: Math.abs(mC[iC]), maxMoveCreditedYear: out[iC + 1].year,
    medianMoveActual: median(mA.map(Math.abs)),
    medianMoveCredited: median(mC.map(Math.abs)),
    meanActual: mean(out.map((r) => r.actual)),
    meanCredited: mean(out.map((r) => r.credited)),
    sdActual: sd(out.map((r) => r.actual)),
    sdCredited: sd(out.map((r) => r.credited)),
    low: at('actual', (a, b) => a < b),   // the made-up account's worst year: labelled on the chart
    high: at('actual', (a, b) => a > b),  // and its best year
  };
}

// FORMAT
/** Points and rates to one decimal ("1.9", "8.6%"); the minus is a true minus. */
export const pts = (x) => (Math.round(x * 10) / 10).toFixed(1).replace('-', '−');
export const pct = (x) => `${pts(x)}%`;
// end FORMAT
