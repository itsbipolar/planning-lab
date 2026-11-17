// Fetches a dated snapshot of the long-term Government of Canada bond yield into shared/data/ (never at page load):
//  - Statistics Canada, Table 10-10-0122-01 Financial market statistics, last Wednesday unless otherwise stated, Bank of Canada,
//    "Government of Canada marketable bonds, average yield: over 10 years" (vector v122487), monthly.
// Kept: the December value of each year from 1950 (the year-end yield), plus the latest month published.
// Run: npm run fetch-data (or NODE_USE_ENV_PROXY=1 node scripts/fetch-bond-yield.mjs), then commit the changed file.
import { writeFileSync, mkdirSync } from 'node:fs';
const today = new Date().toISOString().slice(0, 10);
const FROM = 1950;
mkdirSync('shared/data', { recursive: true });

const res = await fetch('https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ vectorId: 122487, latestN: 1500 }]),
});
if (!res.ok) throw new Error(`Statistics Canada WDS answered ${res.status}`);
const [r] = await res.json();
if (r.status !== 'SUCCESS' || r.object.vectorId !== 122487) throw new Error('Statistics Canada WDS: no data for vector 122487');
const months = r.object.vectorDataPoint
  .filter((p) => p.value != null && p.statusCode === 0 && Number(p.refPer.slice(0, 4)) >= FROM)
  .map((p) => [p.refPer.slice(0, 7), Number(p.value)]);
const values = months.filter(([ym]) => ym.endsWith('-12'));
for (let y = FROM; y <= Number(values.at(-1)[0].slice(0, 4)); y++) {
  if (!values.some(([ym]) => ym === `${y}-12`)) throw new Error(`no December value for ${y}`);
}
writeFileSync('shared/data/long-bond-yield-yearly.json', JSON.stringify({
  title: 'Long-term Government of Canada bond yield, year-end (marketable bonds, average yield, over 10 years, % a year)',
  source: 'Statistics Canada, Table 10-10-0122-01, vector v122487 (Bank of Canada data)',
  source_url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1010012201',
  licence: 'Statistics Canada Open Licence', licence_url: 'https://www.statcan.gc.ca/en/reference/licence',
  terms_url: 'https://www.bankofcanada.ca/terms/',
  attribution: 'Adapted from Statistics Canada, Table 10-10-0122-01 (Bank of Canada data). This does not constitute an endorsement by Statistics Canada of this product. Source: Bank of Canada. Not affiliated with or endorsed by the Bank of Canada.',
  changes: 'Year-end values taken from the monthly series (December of each year).',
  unit: 'percent', retrieved: today,
  values,
  latest: months.at(-1),
}) + '\n');
console.log('long-bond-yield-yearly.json written', today, `${values[0][0]}..${values.at(-1)[0]}`, 'latest', months.at(-1).join(' '));
