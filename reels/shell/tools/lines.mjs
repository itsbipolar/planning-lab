// Prints {card id: spoken line, as words} for a reel, the input align.py checks the clips against.
import { loadFacts, loadReel, resolve, spoken, loadDataModel } from '../lib.mjs';
const reel = loadReel(process.argv[2]), facts = loadFacts();
const m = resolve(reel, facts, await loadDataModel(reel, facts));
console.log(JSON.stringify(Object.fromEntries(m.cards.filter(c => c.say).map(c => [c.id, spoken(c)])), null, 1));
