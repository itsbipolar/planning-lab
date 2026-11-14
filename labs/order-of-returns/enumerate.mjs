// The Order of Returns: every order of the ten cards, run exactly (SPEC.md section 3). Pure: no DOM, no I/O. It runs in a
// Web Worker on the page (worker.js), in the page itself if a worker cannot start, and in the tests.
//
// enumerateOrders({ start, withdrawal, indexation, cards, tail, minimumFactors }, onProgress) visits all n! orders of
// `cards` depth first, sharing the years each order has in common with the one before, and runs each through the same
// arithmetic as simulate() in engine.mjs (no levers; the RRIF minimum when minimumFactors is given). The tests check that
// every order gives what simulate gives. Returns, for order number i (orders numbered as orderAt below):
//   dep[i]    the year the money runs out (1-based), or 0 if it lasts
//   value[i]  the money left at the end if it lasts, otherwise the total paid out (how far it got)
//   first[i]  the cards in years 1..5, as a bit mask of card positions (to group orders by their first five years)
export function enumerateOrders({ start, withdrawal, indexation, cards, tail, minimumFactors = null }, onProgress) {
  const n = cards.length, H = n + tail.length, total = factorial(n), K = Math.min(5, n);
  const W = new Float64Array(H), F = new Float64Array(H), G = new Float64Array(H);
  for (let t = 0; t < H; t++) { W[t] = withdrawal * Math.pow(1 + indexation, t); F[t] = minimumFactors ? minimumFactors[t] || 0 : 0; }
  for (let i = 0; i < n; i++) G[i] = 1 + cards[i];
  const dep = new Uint8Array(total), value = new Float64Array(total), first = new Uint16Array(total);
  const bal = new Float64Array(n + 1), paid = new Float64Array(n + 1), dp = new Int32Array(n + 1);
  bal[0] = start;
  let leaf = 0, branches = 0;
  const branchTotal = n > 1 ? n * (n - 1) : 1;

  // one year, exactly as simulate() does it with no cash buffer and no flex rule
  function year(t, b, g, out) {
    let w = W[t];
    if (F[t] > 0) w = Math.max(w, F[t] * (b + 0));
    let need = w; const x = Math.min(need, b); need -= x; b -= x;
    out[0] = Math.max(0, b * g); out[1] = w - need; out[2] = need > 1e-9 ? 1 : 0;
  }
  const o = new Float64Array(3);
  const tailG = tail.map((r) => 1 + r);

  function visit(k, used) {
    if (k === n) {
      let b = bal[n], p = paid[n], d = dp[n];
      for (let t = n; t < H; t++) { year(t, b, tailG[t - n], o); b = o[0]; p += o[1]; if (o[2] && !d) d = t + 1; }
      dep[leaf] = d; value[leaf] = d ? p : b; first[leaf] = firstMask; leaf++;
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used & (1 << i)) continue;
      year(k, bal[k], G[i], o);
      bal[k + 1] = o[0]; paid[k + 1] = paid[k] + o[1]; dp[k + 1] = dp[k] || (o[2] ? k + 1 : 0);
      if (k + 1 === K) firstMask = used | (1 << i);
      visit(k + 1, used | (1 << i));
      if (k === 1 || n === 1) { branches++; if (onProgress) onProgress(branches / branchTotal); }
    }
  }
  let firstMask = 0;
  visit(0, 0);
  return { n, horizon: H, total, dep, value, first };
}

export function factorial(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }

/** The order number i (0-based) as card positions, in the order enumerateOrders visits them (lexicographic). */
export function orderAt(i, n) {
  const left = Array.from({ length: n }, (_, k) => k), out = [];
  for (let k = n; k >= 1; k--) { const f = factorial(k - 1), j = Math.floor(i / f); i -= j * f; out.push(left.splice(j, 1)[0]); }
  return out;
}

/** "Better" for the ranking: lasting beats running out; lasting longer beats running out sooner; then more money left
 *  (or, for two orders that run out in the same year, more paid out before it did). Returns -1, 0 or 1. */
export function compareOutcome(depA, valueA, depB, valueB) {
  const a = depA || Infinity, b = depB || Infinity;
  if (a !== b) return a < b ? -1 : 1;
  const d = valueA - valueB;
  return Math.abs(d) <= 1e-6 * Math.max(1, Math.abs(valueA)) ? 0 : d < 0 ? -1 : 1;
}

/** How many orders do better than, the same as, and worse than the outcome (dep, value). */
export function rankOutcome(res, dep, value) {
  let better = 0, same = 0;
  for (let i = 0; i < res.total; i++) { const c = compareOutcome(res.dep[i], res.value[i], dep, value); if (c > 0) better++; else if (c === 0) same++; }
  return { better, same, worse: res.total - better - same, total: res.total };
}

/** What the charts draw, from an enumeration: the count for each year the money runs out, the money left by bins of
 *  `step` for orders that last, and, for each average of the first five years, how its orders end. */
export function summarize(res, cards) {
  const H = res.horizon, byYear = new Array(H + 1).fill(0);
  let lasts = 0, maxLeft = 0;
  for (let i = 0; i < res.total; i++) { if (res.dep[i]) byYear[res.dep[i]]++; else { lasts++; if (res.value[i] > maxLeft) maxLeft = res.value[i]; } }
  const step = niceStep(maxLeft / 5), left = new Array(Math.max(1, Math.ceil(maxLeft / step + 1e-9))).fill(0);
  // group by the first five years: the mask's card sum is the key (summed in a fixed order so equal sets give equal keys)
  const K = Math.min(5, cards.length), masks = new Map();
  for (let i = 0; i < res.total; i++) {
    if (!res.dep[i]) left[Math.min(left.length - 1, Math.floor(res.value[i] / step))]++;
    let m = masks.get(res.first[i]); if (!m) masks.set(res.first[i], (m = new Array(H + 1).fill(0))); m[res.dep[i]]++;
  }
  const groups = new Map();
  for (const [mask, counts] of masks) {
    let sum = 0; for (let k = 0; k < cards.length; k++) if (mask & (1 << k)) sum += cards[k];
    const avg = Math.round(sum / K * 1e9) / 1e9, g = groups.get(avg) || { avg, n: 0, counts: new Array(H + 1).fill(0) };
    counts.forEach((c, d) => { g.counts[d] += c; g.n += c; }); groups.set(avg, g);
  }
  return { total: res.total, horizon: H, lasts, byYear, left: { step, counts: left }, groups: [...groups.values()].sort((a, b) => a.avg - b.avg) };
}

export function niceStep(x) {
  if (!(x > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/** The sorted-outcome distribution the page ships with (redesign v2, step 4): written by build.mjs for the story in
 *  story.json only, so the deal at the top of the page answers at once, before (and without) the full count in the
 *  worker. Years lasted are whole years paid in full, capped at the horizon (an order that runs out in year d lasted
 *  d - 1), so many orders tie; `lasted` is sorted from the shortest to the longest. `strip` holds the bars of how the
 *  orders end (by run-out year, then by money left in bins of `left.step`), and `groups` the share that last for each
 *  set of first five years (by its average). */
export function distribution(res, cards) {
  const s = summarize(res, cards), H = res.horizon, lasted = new Map();
  for (let d = 1; d <= H; d++) if (s.byYear[d]) lasted.set(d - 1, s.byYear[d]);
  if (s.lasts) lasted.set(H, s.lasts);
  let y0 = H; for (let d = 1; d <= H; d++) if (s.byYear[d]) { y0 = d; break; }
  // the strip's money-left bins are finer than the histogram's (about ten of them), so it reads as a strip of bars
  let maxLeft = 0; for (let i = 0; i < res.total; i++) if (!res.dep[i] && res.value[i] > maxLeft) maxLeft = res.value[i];
  const step = niceStep(maxLeft / 10), left = new Array(Math.max(1, Math.ceil(maxLeft / step + 1e-9))).fill(0);
  for (let i = 0; i < res.total; i++) if (!res.dep[i]) left[Math.min(left.length - 1, Math.floor(res.value[i] / step))]++;
  return {
    total: s.total, horizon: H, lasts: s.lasts,
    lasted: [...lasted.entries()].sort((a, b) => a[0] - b[0]).map(([years, count]) => ({ years, count })),
    strip: { firstYear: y0, byYear: s.byYear.slice(y0), left: { step, counts: left } },
    groups: s.groups.map((g) => ({ avg: g.avg, n: g.n, lasts: g.counts[0] })),
  };
}

/** Whole years an outcome lasted: the depletion year minus one, or the horizon when the money lasts (dep 0). */
export function yearsLasted(dep, horizon) { return dep ? dep - 1 : horizon; }

/** How many orders last no longer than `years` (ties counted: "at least as long as" this many). */
export function atLeastAsLong(dist, years) {
  let n = 0; for (const o of dist.lasted) if (o.years <= years) n += o.count;
  return n;
}

/** The strip bar an outcome falls in: by run-out year, or for an order that lasts, by money left. */
export function stripBar(dist, dep, value) {
  const st = dist.strip, nDep = st.byYear.length;
  return dep ? Math.max(0, dep - st.firstYear) : nDep + Math.min(st.left.counts.length - 1, Math.floor(value / st.left.step));
}
