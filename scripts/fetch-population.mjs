// P5a The retirement wave: a dated snapshot of Statistics Canada's population estimates on July 1, by single year of age,
// for Canada (all genders), ages 50 to 89, every year in the table. Never fetched at page load.
// Source: Table 17-10-0005-01 (full-table CSV through StatCan's Web Data Service). Needs the `unzip` command.
// Run: node scripts/fetch-population.mjs   Then commit shared/data/population-by-age.json (its "retrieved" date is today).
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PID = '17100005', AGE_MIN = 50, AGE_MAX = 89;
const today = new Date().toISOString().slice(0, 10);
const meta = (await (await fetch('https://www150.statcan.gc.ca/t1/wds/rest/getCubeMetadata', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ productId: Number(PID) }]) })).json())[0].object;
const zipUrl = (await (await fetch(`https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/${PID}/en`)).json()).object;
const dir = mkdtempSync(join(tmpdir(), 'statcan-'));
writeFileSync(join(dir, 't.zip'), Buffer.from(await (await fetch(zipUrl)).arrayBuffer()));
const csv = execFileSync('unzip', ['-p', join(dir, 't.zip'), `${PID}.csv`], { maxBuffer: 1 << 28 }).toString('utf8').replace(/^﻿/, '');
rmSync(dir, { recursive: true, force: true });

// A small CSV reader: StatCan quotes every field.
const lines = csv.split(/\r?\n/).filter(Boolean);
const parse = (l) => l.slice(1, -1).split('","');
const head = parse(lines[0]), col = (n) => head.indexOf(n);
const [cY, cG, cS, cA, cV, cSt] = ['REF_DATE', 'GEO', 'Gender', 'Age group', 'VALUE', 'STATUS'].map(col);
const values = {};
for (const l of lines.slice(1)) {
  const r = parse(l);
  if (r[cG] !== 'Canada' || r[cS] !== 'Total - gender') continue;
  const m = r[cA].match(/^(\d+) years?$/); if (!m) continue;
  const age = Number(m[1]); if (age < AGE_MIN || age > AGE_MAX) continue;
  if (r[cV] === '' || r[cSt] === '..') throw new Error(`no value for ${r[cY]}, age ${age}`);
  (values[r[cY]] ??= {})[age] = Number(r[cV]);
}
const years = Object.keys(values).map(Number).sort((a, b) => a - b);
mkdirSync('shared/data', { recursive: true });
writeFileSync('shared/data/population-by-age.json', JSON.stringify({
  title: 'Population estimates on July 1, by single year of age, Canada, all genders',
  source: 'Statistics Canada, Table 17-10-0005-01, Population estimates on July 1, by age and gender',
  source_url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000501',
  doi: 'https://doi.org/10.25318/1710000501-eng',
  licence: 'Statistics Canada Open Licence', licence_url: 'https://www.statcan.gc.ca/en/reference/licence',
  // The licence's notice for an adapted product (Acknowledgment of Source), with the product's name and reference dates.
  attribution: `Adapted from Statistics Canada, Population estimates on July 1, by age and gender, Table 17-10-0005-01, ${years[0]} to ${years.at(-1)}. This does not constitute an endorsement by Statistics Canada of this product.`,
  citation: 'Statistics Canada. Table 17-10-0005-01 Population estimates on July 1, by age and gender. DOI: https://doi.org/10.25318/1710000501-eng',
  released: meta.releaseTime.slice(0, 10), retrieved: today,
  notes: {
    age: 'Age at last birthday in years.',
    revisions: 'Estimates are final intercensal up to 2020, final postcensal for 2021, 2022 and 2023, updated postcensal for 2024 and 2025, and preliminary postcensal for 2026.',
    gender: 'Prior to 2021, the demographic estimates are based on the concept of sex at birth. Although gender and sex at birth are two different concepts, this change does not cause a significant break in the trend because the two concepts produce very similar distributions.',
  },
  ages: [AGE_MIN, AGE_MAX], years: [years[0], years.at(-1)],
  // values[year] is a list of counts for ages AGE_MIN..AGE_MAX in order.
  values: Object.fromEntries(years.map((y) => [y, Array.from({ length: AGE_MAX - AGE_MIN + 1 }, (_, i) => values[y][AGE_MIN + i])])),
}) + '\n');
console.log(`population-by-age.json: ${years[0]} to ${years.at(-1)}, ages ${AGE_MIN} to ${AGE_MAX}, released ${meta.releaseTime.slice(0, 10)}, retrieved ${today}`);
