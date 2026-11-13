// Builds labs/planning-calendar/dist/index.html: one self-contained page (the Data desk look and fonts, the calendar's
// rules, the facts they cite, the engine and the script), so it makes no request after it loads. The page works out the
// twelve months from its own date, so the dates move with the visitor's clock; the rules do not.
// Run: node labs/planning-calendar/build.mjs   (PREVIEW_FACTS=<file> OUT=<file> builds a look-ahead copy outside dist)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { factIndex } from './engine.mjs';
import { deskCSS } from '../../shared/desk/desk.mjs';
import { deskUICSS, deskUIJS } from '../../shared/desk/desk-ui.mjs';
import { deskPage } from '../../shared/desk/desk-page.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');
const config = JSON.parse(read(join(here, 'calendar.json')));
const factsFile = JSON.parse(read(process.env.PREVIEW_FACTS ?? join(root, 'shared', 'facts.json')));
const F = factIndex(factsFile);

// The facts the page may need, for any year: each rule's fact ids with the year left open, and the own-date rules.
const templates = [...Object.values(config.rules).flatMap((r) => r.facts), ...config.ownDates.flatMap((o) => o.facts)]
  .map((t) => new RegExp(`^${t.replace(/[.]/g, '\\.').replace(/\{(prev|year)\}/g, '\\d{4}')}$`));
const facts = factsFile.facts.filter((f) => templates.some((re) => re.test(f.id)))
  .map((f) => ({ id: f.id, title: f.title, value: f.status === 'confirmed' ? f.value : null, unit: f.unit, source_url: f.source_url, as_of: f.as_of, authority: f.authority, status: f.status }));
const own = config.ownDates.filter((o) => o.facts.every((id) => F.has(id))).map((o) => { const f = F.get(o.facts[0]); return { label: o.label, value: f.value, unit: f.unit, url: f.source_url }; });
const situationLabel = (s) => s.label.replace(/\{([\w.]+)\}/g, (m, id) => (F.has(id) ? String(F.get(id).value) : 'the age in the rule'));
const data = { config: { ...config, situations: config.situations.map((s) => ({ ...s, label: situationLabel(s) })) }, facts: { facts }, own };

const css = [deskCSS(), deskUICSS(), read(join(here, 'style.css'))].join('\n');
const js = deskUIJS() + '\n' + read(join(here, 'engine.mjs')).replace(/^export /gm, '') + '\n' + read(join(here, 'app.js'));
const html = deskPage(read(join(here, 'index.src.html')), 'planning-calendar').replace('/*@@CSS@@*/', () => css)
  .replace('/*@@DATA@@*/', () => JSON.stringify(data).replace(/</g, '\\u003c')).replace('/*@@JS@@*/', () => js);
const out = process.env.OUT ?? join(here, 'dist', 'index.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
const confirmed = facts.filter((f) => f.status === 'confirmed').length;
console.log(`built ${out.replace(root + '/', '')} (${(html.length / 1024).toFixed(0)} KiB): ${Object.keys(config.rules).length} rules, ${config.situations.length} situations, ${facts.length} facts (${confirmed} confirmed, ${facts.length - confirmed} not yet)`);
