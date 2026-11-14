// Your year, the core (redesign v2, step 3): every number the site's "Born in" lead and the Your year tool show for a
// birth year, from the confirmed facts and the Statistics Canada price snapshot. Pure: no DOM, no I/O, no node import,
// so the site can copy it (sync-labs) and run it at build and in the browser, and planning-timeline inlines it.
// No age, limit, rate or year from the rules is written here: a missing fact throws instead of drawing a guess.
//
//   yourYearRules(factsFile)                -> the rules (confirmed facts only)
//   annualPrices(cpiFile)                   -> { first, last, avg: { year: average index } } (complete years only)
//   yourYear(rules, prices, birthYear, thisYear) -> everything for one birth year (see the end of this file)
//   dollars(v)                              -> "$382", "$1,890": the rounding Money, then and now uses

const CORE_NEED = ['tfsa_minimum_age', 'tfsa_first_year', 'cpp_earliest_start_age', 'cpp_standard_start_age', 'cpp_latest_start_age',
  'cpp_early_start_reduction', 'cpp_late_start_increase', 'oas_start_age', 'oas_deferral_max_age', 'oas_deferral_increase',
  'oas_age75_increase', 'rrsp_maturity_age'];

/** The amount the price line starts from (an illustration, the same one Money, then and now opens on). */
export const BASE_AMOUNT = 100;
/** The labelled example the home lead and the posters open on (an illustration, never the visitor's year). */
export const EXAMPLE_BIRTH_YEAR = 1980;

const CORE_TEN = 1e1;

/** The rules, from the confirmed facts only. Throws if one the lead needs is not confirmed. */
export function yourYearRules(factsFile) {
  const F = new Map((factsFile.facts || factsFile).filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));
  for (const id of CORE_NEED) if (!F.has(id)) throw new Error(`${id} is not confirmed`);
  const n = (id) => Number(F.get(id).value);
  // TFSA dollar limits by year, as far as they are confirmed
  const tfsa = {};
  for (const [id, f] of F) { const m = id.match(/^tfsa_annual_limit\.(\d{4})$/); if (m) tfsa[m[1]] = Number(f.value); }
  // the age of the OAS increase is in that fact's own title ("... at age NN"): read it there so it is not typed here
  const boost = String(F.get('oas_age75_increase').title).match(/\bage (\d+)\b/);
  if (!boost) throw new Error('the age of the OAS increase is not in its fact title');
  return {
    tfsaAge: n('tfsa_minimum_age'), tfsaYear: n('tfsa_first_year'), tfsa,
    cppLo: n('cpp_earliest_start_age'), cppStd: n('cpp_standard_start_age'), cppHi: n('cpp_latest_start_age'),
    cppRed: n('cpp_early_start_reduction'), cppInc: n('cpp_late_start_increase'),
    oasLo: n('oas_start_age'), oasHi: n('oas_deferral_max_age'), oasInc: n('oas_deferral_increase'),
    oasBoost: n('oas_age75_increase'), oasBoostAge: Number(boost[1]),
    rrsp: n('rrsp_maturity_age'),
  };
}

/** Yearly average price levels from the monthly CPI snapshot: the mean of a year's twelve monthly values, complete years
 *  only, from the first year whose year before is also complete (the years Money, then and now offers) to the last. */
export function annualPrices(cpiFile) {
  const months = {};
  for (const [ym, v] of cpiFile.months) (months[Number(ym.slice(0, 4))] ||= []).push(v);
  const avg = {};
  for (const [y, v] of Object.entries(months)) if (v.length === 12) avg[y] = v.reduce((a, b) => a + b, 0) / v.length;
  const years = Object.keys(avg).map(Number).filter((y) => avg[y - 1] !== undefined).sort((a, b) => a - b);
  if (!years.length) throw new Error('the price snapshot has no complete years');
  years.forEach((y, i) => { if (i && y !== years[i - 1] + 1) throw new Error(`price years jump from ${years[i - 1]} to ${y}`); });
  const out = {};
  for (const y of years) out[y] = avg[y];
  return {
    first: years[0], last: years.at(-1), avg: out,
    source: { title: cpiFile.title, source_url: cpiFile.source_url, attribution: cpiFile.attribution, retrieved: cpiFile.retrieved },
  };
}

/** A dollar amount, rounded as Money, then and now rounds it: cents under $100, whole dollars to $999, then three
 *  significant figures. */
export function dollars(v) {
  if (v < 100) return '$' + v.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v < 1000) return '$' + Math.round(v).toLocaleString('en-CA');
  const k = Math.pow(CORE_TEN, Math.floor(Math.log(v) / Math.LN10) - 2);
  return '$' + (Math.round(v / k) * k).toLocaleString('en-CA', { maximumFractionDigits: 0 });
}
/** The number dollars() shows, as a number. */
export function rounded(v) {
  if (v < 100) return Math.round(v * 100) / 100;
  if (v < 1000) return Math.round(v);
  const k = Math.pow(CORE_TEN, Math.floor(Math.log(v) / Math.LN10) - 2);
  return Math.round(v / k) * k;
}
const wholeDollars = (v) => '$' + Math.round(v).toLocaleString('en-CA');

/** Where a window of ages stands for someone this age: 'ahead', 'open' (now inside it) or 'past'. */
export const tense = (age, lo, hi) => (age < lo ? 'ahead' : age > hi ? 'past' : 'open');

/**
 * Everything for one birth year, `thisYear` being the visitor's calendar year (or the build year at build time):
 * {
 *   birthYear, thisYear, age,
 *   cpiNow          what BASE_AMOUNT from the birth year costs in cpiLatestYear, rounded as dollars() rounds it (null
 *                   when the birth year is outside the price data); cpiNowText the same as text ("$382");
 *                   cpiNowExact unrounded; cpiLatestYear the latest complete price year; cpiFrom the birth year
 *   tfsaSum         the confirmed TFSA limits added up from tfsaStart to tfsaSumTo (0 if it has not opened);
 *   tfsaStart       the later of the year they turn the minimum age and the year the TFSA began; tfsaOpen;
 *   tfsaSumTo       the last year added (thisYear or the latest confirmed limit, whichever is earlier); tfsaMissing
 *                   years in that span with no confirmed limit; y18 the year they turn the TFSA minimum age
 *   y60, y65, y70   CPP: earliest, standard and latest start years; cppTense 'ahead' | 'open' | 'past'
 *   oasFrom, oasTo  OAS: first and latest start years; oasBoostYear the year of the increase; oasTense
 *   y71             the year the RRSP must wind up by the end of; rrspTense 'ahead' | 'past'
 *   text            { cpi, tfsa, cpp }: the lead's lines in plain words, in the tense for that year
 * }
 */
export function yourYear(R, P, birthYear, thisYear) {
  const age = thisYear - birthYear;
  // prices
  const covered = !!P && birthYear >= P.first && birthYear <= P.last;
  const cpiNowExact = covered ? BASE_AMOUNT * (P.avg[P.last] / P.avg[birthYear]) : null;
  const cpiNow = covered ? rounded(cpiNowExact) : null, cpiNowText = covered ? dollars(cpiNowExact) : null;
  // TFSA: room starts in the later of the year you turn the minimum age and the year the TFSA began
  const y18 = birthYear + R.tfsaAge, tfsaStart = Math.max(y18, R.tfsaYear);
  const known = Object.keys(R.tfsa).map(Number), lastKnown = Math.max(...known), tfsaSumTo = Math.min(thisYear, lastKnown);
  let tfsaSum = 0; const tfsaMissing = [];
  for (let y = tfsaStart; y <= tfsaSumTo; y++) { if (y in R.tfsa) tfsaSum += R.tfsa[y]; else tfsaMissing.push(y); }
  const tfsaOpen = tfsaStart <= thisYear;
  // CPP, OAS, RRSP windows as calendar years
  const y60 = birthYear + R.cppLo, y65 = birthYear + R.cppStd, y70 = birthYear + R.cppHi;
  const cppTense = tense(age, R.cppLo, R.cppHi);
  const oasFrom = birthYear + R.oasLo, oasTo = birthYear + R.oasHi, oasBoostYear = birthYear + R.oasBoostAge;
  const oasTense = tense(age, R.oasLo, R.oasHi);
  const y71 = birthYear + R.rrsp, rrspTense = age > R.rrsp ? 'past' : 'ahead';
  const text = {
    cpi: covered ? `What ${wholeDollars(BASE_AMOUNT)} bought in ${birthYear} cost about ${cpiNowText} in ${P.last}.` : null,
    tfsa: tfsaSum > 0 ? `TFSA limits added up: ${wholeDollars(tfsaSum)}` : `TFSA opens in ${tfsaStart}`,
    cpp: cppTense === 'ahead' ? `CPP can start ${y60} to ${y70}, if you qualify`
      : cppTense === 'open' ? `CPP can start any month until ${y70}, if you qualify`
        : `CPP could start from ${y60} (that window has passed)`,
  };
  return {
    birthYear, thisYear, age,
    cpiFrom: birthYear, cpiLatestYear: P ? P.last : null, cpiNow, cpiNowText, cpiNowExact,
    tfsaSum, tfsaStart, tfsaOpen, tfsaSumTo, tfsaMissing, y18,
    y60, y65, y70, cppTense,
    oasFrom, oasTo, oasBoostYear, oasTense,
    y71, rrspTense,
    text,
  };
}
