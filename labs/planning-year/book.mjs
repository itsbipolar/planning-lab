// A seeded synthetic book of households for The Planning Year. IDs only: no names, no real people. The same seed always
// gives the same book. Ages are drawn for the end of the plan year; everything here is invented and says so.

// mulberry32: a small seeded generator, so the book is reproducible without a dependency.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, '0');
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12

// Age bands at the end of the plan year and their shares: a book that leans toward people near or in retirement.
// The third and fourth bands are the retired part of the book (bands are synthetic choices, not rules).
const BANDS = [[30, 48, 0.25], [49, 63, 0.35], [64, 78, 0.3], [79, 92, 0.1]];

export function makeBook({ seed = 2027, n = 400, year = 2027 } = {}) {
  const r = rng(seed);
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = (weights) => { let x = r(); for (const [v, w] of weights) { if ((x -= w) < 0) return v; } return weights.at(-1)[0]; };
  const birth = (age) => `${year - age}-${pad(int(1, 12))}-${pad(int(1, 28))}`;
  const households = [];
  for (let i = 1; i <= n; i++) {
    const b = pick(BANDS.map((x, k) => [k, x[2]]));
    const age = int(BANDS[b][0], BANDS[b][1]);
    const retired = b >= 2;
    const members = [{ birth: birth(age), rrsp: r() < 0.85 }];
    if (r() < 0.62) members.push({ birth: birth(Math.max(25, age + int(-6, 6))), rrsp: r() < 0.85 });
    const selfEmployed = r() < (retired ? 0.04 : 0.18);
    const holdco = r() < (selfEmployed ? 0.55 : 0.04) ? { yearEndMonth: r() < 0.5 ? 12 : int(1, 11) } : null;
    if (holdco) holdco.yearEnd = `${pad(holdco.yearEndMonth)}-${pad(lastDay(year, holdco.yearEndMonth))}`;
    // Some trusts were settled in the mid-2000s, so the book holds a few that reach their deemed-disposition date soon.
    const trust = r() < (holdco ? 0.3 : 0.015) ? { settled: `${r() < 0.3 ? int(2005, 2008) : int(1995, 2022)}-${pad(int(1, 12))}-${pad(int(1, 28))}`, yearEnd: '12-31' } : null;
    households.push({
      id: `H-${String(i).padStart(4, '0')}`,
      members,
      selfEmployed,
      instalments: selfEmployed || (retired && r() < 0.45),
      holdco,
      trust,
      reviewQuarter: int(1, 4),
    });
  }
  return { synthetic: true, seed, n, year, note: 'Synthetic book: invented households with IDs only. Not a real practice or real clients.', households };
}
