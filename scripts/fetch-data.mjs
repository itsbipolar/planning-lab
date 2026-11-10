// Fetches dated snapshots of the public data the builds use into shared/data/ (never at page load):
//  - Statistics Canada, Table 18-10-0004-01 Consumer Price Index, monthly, Canada, all-items (vector v41690973)
//  - Bank of Canada Valet, V80691311 Prime rate (weekly, from 1975; the older monthly prime and 5-year mortgage series stop in 2019)
// Run: node scripts/fetch-data.mjs   Then commit the changed files: the date inside each file is the "retrieved" date.
import { writeFileSync, mkdirSync } from 'node:fs';
const today = new Date().toISOString().slice(0, 10);
mkdirSync('shared/data', { recursive: true });

const sc = await fetch('https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ vectorId: 41690973, latestN: 1600 }]) });
const scj = (await sc.json())[0].object.vectorDataPoint;
writeFileSync('shared/data/cpi-monthly.json', JSON.stringify({
  title: 'Consumer Price Index, monthly, Canada, all-items (2002=100)',
  source: 'Statistics Canada, Table 18-10-0004-01, vector v41690973', source_url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401',
  licence: 'Statistics Canada Open Licence', attribution: 'Adapted from Statistics Canada, Consumer Price Index, monthly, Table 18-10-0004-01. This does not constitute an endorsement by Statistics Canada of this product.',
  retrieved: today, months: scj.map((p) => [p.refPer.slice(0, 7), p.value]),
}) + '\n');

const bc = await fetch('https://www.bankofcanada.ca/valet/observations/V80691311/json?start_date=1975-01-01');
const bcj = await bc.json();
writeFileSync('shared/data/prime-rate-weekly.json', JSON.stringify({
  title: 'Prime rate, weekly (the rate a financial institution uses as a base for loan products)', source: 'Bank of Canada Valet API, series V80691311', source_url: 'https://www.bankofcanada.ca/valet/observations/V80691311/json',
  terms_url: 'https://www.bankofcanada.ca/terms/', attribution: 'Source: Bank of Canada. Not affiliated with or endorsed by the Bank of Canada.',
  retrieved: today, weeks: bcj.observations.filter((o) => o.V80691311?.v).map((o) => [o.d, Number(o.V80691311.v)]),
}) + '\n');
console.log('snapshots written', today);
