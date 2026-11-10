// Prints {card id: spoken line, as words} for a reel, the input align.py checks the clips against.
import { loadFacts, loadReel, resolve, spoken } from '../lib.mjs';
const m = resolve(loadReel(process.argv[2]), loadFacts());
console.log(JSON.stringify(Object.fromEntries(m.cards.filter(c => c.say).map(c => [c.id, spoken(c)]))));
