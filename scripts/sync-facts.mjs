// Copies the exported facts from the canada-planning-facts repo (a sibling checkout) into shared/facts.json.
import { copyFileSync, existsSync } from 'node:fs';
const src = '../canada-planning-facts/shared/facts.json';
if (!existsSync(src)) { console.error(`${src} not found: clone canada-planning-facts next to this repo`); process.exit(1); }
copyFileSync(src, 'shared/facts.json'); console.log('shared/facts.json updated');
