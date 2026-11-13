// Dated snapshots of Statistics Canada's population estimates on July 1, by single year of age. Never fetched at page load.
// Source: Table 17-10-0005-01 (full-table CSV through StatCan's Web Data Service). Needs the `unzip` command.
// Writes two files (pass `canada` or `places` to write only one):
// - shared/data/population-by-age.json: Canada, all genders, ages 50 to 89 (P5a's first snapshot; planning-timeline uses it).
// - shared/data/population-by-age-places.json: Canada, each province and the three territories combined, Men+ and Women+,
//   ages 50 to 89, plus each year's population of all ages (so a page can show a share). Total - gender is checked to be
//   exactly Men+ plus Women+ for every cell kept, so the totals are not stored twice.
// Run: npm run fetch-population   Then commit the file(s) written (their "retrieved" date is today).
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PID = '17100005', AGE_MIN = 50, AGE_MAX = 89;
const only = process.argv[2];
if (only && !['canada', 'places'].includes(only)) throw new Error('usage: fetch-population.mjs [canada|places]');
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

// The places kept. The three territories are summed into one place: Statistics Canada shows the Northwest Territories and
// Nunavut separately only from 1991 (before that, combined), so the sum of all three is the one series that runs unbroken.
const PLACES = [
  ['CA', 'Canada', ['Canada']], ['NL', 'Newfoundland and Labrador', ['Newfoundland and Labrador']],
  ['PE', 'Prince Edward Island', ['Prince Edward Island']], ['NS', 'Nova Scotia', ['Nova Scotia']],
  ['NB', 'New Brunswick', ['New Brunswick']], ['QC', 'Quebec', ['Quebec']], ['ON', 'Ontario', ['Ontario']],
  ['MB', 'Manitoba', ['Manitoba']], ['SK', 'Saskatchewan', ['Saskatchewan']], ['AB', 'Alberta', ['Alberta']],
  ['BC', 'British Columbia', ['British Columbia']],
  ['TR', 'The territories (Yukon, Northwest Territories and Nunavut together)', ['Yukon', 'Northwest Territories including Nunavut', 'Northwest Territories', 'Nunavut']],
];
const placeOf = new Map(PLACES.flatMap(([id, , geos]) => geos.map((g) => [g, id])));
const GENDERS = ['Total - gender', 'Men+', 'Women+'];

// raw[place][gender][year][age or 'all'] = count
const raw = {};
for (const l of lines.slice(1)) {
  const r = parse(l);
  const place = placeOf.get(r[cG]); if (!place || !GENDERS.includes(r[cS])) continue;
  let age;
  if (r[cA] === 'All ages') age = 'all';
  else { const m = r[cA].match(/^(\d+) years?$/); if (!m) continue; age = Number(m[1]); if (age < AGE_MIN || age > AGE_MAX) continue; }
  if (r[cV] === '' || r[cSt] === '..') throw new Error(`no value for ${r[cG]}, ${r[cS]}, ${r[cY]}, age ${age}`);
  const g = ((raw[place] ??= {})[r[cS]] ??= {});
  const y = (g[r[cY]] ??= {});
  y[age] = (y[age] ?? 0) + Number(r[cV]);
}
const years = Object.keys(raw.CA['Total - gender']).map(Number).sort((a, b) => a - b);
const ages = Array.from({ length: AGE_MAX - AGE_MIN + 1 }, (_, i) => AGE_MIN + i);
for (const [id] of PLACES) for (const y of years) for (const a of [...ages, 'all']) {
  const t = raw[id]?.['Total - gender']?.[y]?.[a], m = raw[id]?.['Men+']?.[y]?.[a], w = raw[id]?.['Women+']?.[y]?.[a];
  if (![t, m, w].every((v) => Number.isInteger(v) && v >= 0)) throw new Error(`missing ${id}, ${y}, age ${a}`);
  if (m + w !== t) throw new Error(`${id}, ${y}, age ${a}: Men+ and Women+ do not add up to the total`);
}

const released = meta.releaseTime.slice(0, 10);
const common = {
  source: 'Statistics Canada, Table 17-10-0005-01, Population estimates on July 1, by age and gender',
  source_url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000501',
  doi: 'https://doi.org/10.25318/1710000501-eng',
  licence: 'Statistics Canada Open Licence', licence_url: 'https://www.statcan.gc.ca/en/reference/licence',
  // The licence's notice for an adapted product (Acknowledgment of Source), with the product's name and reference dates.
  attribution: `Adapted from Statistics Canada, Population estimates on July 1, by age and gender, Table 17-10-0005-01, ${years[0]} to ${years.at(-1)}. This does not constitute an endorsement by Statistics Canada of this product.`,
  citation: 'Statistics Canada. Table 17-10-0005-01 Population estimates on July 1, by age and gender. DOI: https://doi.org/10.25318/1710000501-eng',
  released, retrieved: today,
};
const notes = {
  age: 'Age at last birthday in years.',
  revisions: 'Estimates are final intercensal up to 2020, final postcensal for 2021, 2022 and 2023, updated postcensal for 2024 and 2025, and preliminary postcensal for 2026.',
  gender: 'Prior to 2021, the demographic estimates are based on the concept of sex at birth. Although gender and sex at birth are two different concepts, this change does not cause a significant break in the trend because the two concepts produce very similar distributions.',
};
const row = (id, g, y) => ages.map((a) => raw[id][g][y][a]);
mkdirSync('shared/data', { recursive: true });

if (only !== 'places') {
  writeFileSync('shared/data/population-by-age.json', JSON.stringify({
    title: 'Population estimates on July 1, by single year of age, Canada, all genders', ...common, notes,
    ages: [AGE_MIN, AGE_MAX], years: [years[0], years.at(-1)],
    // values[year] is a list of counts for ages AGE_MIN..AGE_MAX in order.
    values: Object.fromEntries(years.map((y) => [y, row('CA', 'Total - gender', y)])),
  }) + '\n');
  console.log(`population-by-age.json: ${years[0]} to ${years.at(-1)}, ages ${AGE_MIN} to ${AGE_MAX}, released ${released}, retrieved ${today}`);
}

if (only !== 'canada') {
  writeFileSync('shared/data/population-by-age-places.json', JSON.stringify({
    title: 'Population estimates on July 1, by single year of age, Canada, the provinces and the territories, Men+ and Women+', ...common,
    notes: {
      ...notes,
      genders: 'Men+ includes men (and/or boys), as well as some non-binary persons; Women+ includes women (and/or girls), as well as some non-binary persons.',
      territories: 'Population estimates for Northwest Territories and Nunavut are presented separately from 1991. Prior to 1991, only estimates of population for Northwest Territories and Nunavut combined are available.',
      ninety: 'Data for persons aged 90 to 100 years and older will be available from 2001.',
      adapted: 'The territories are summed here into one place (Yukon, Northwest Territories and Nunavut), so the series runs unbroken from the first year. All genders is the sum of Men+ and Women+, which equals Statistics Canada\'s Total - gender in every cell.',
    },
    ages: [AGE_MIN, AGE_MAX], years: [years[0], years.at(-1)],
    places: PLACES.map(([id, name]) => ({ id, name })), genders: ['Men+', 'Women+'],
    // counts[place][gender][year] lists the counts for ages AGE_MIN..AGE_MAX in order; totals[place][gender][year] is all ages.
    counts: Object.fromEntries(PLACES.map(([id]) => [id, { 'Men+': Object.fromEntries(years.map((y) => [y, row(id, 'Men+', y)])), 'Women+': Object.fromEntries(years.map((y) => [y, row(id, 'Women+', y)])) }])),
    totals: Object.fromEntries(PLACES.map(([id]) => [id, { 'Men+': Object.fromEntries(years.map((y) => [y, raw[id]['Men+'][y].all])), 'Women+': Object.fromEntries(years.map((y) => [y, raw[id]['Women+'][y].all])) }])),
  }) + '\n');
  console.log(`population-by-age-places.json: ${PLACES.length} places, Men+ and Women+, ${years[0]} to ${years.at(-1)}, ages ${AGE_MIN} to ${AGE_MAX}, released ${released}, retrieved ${today}`);
}
