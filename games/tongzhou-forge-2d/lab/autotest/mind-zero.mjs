// Session 3, acceptance 1: the search mind (mind.mjs) plays every isle with no script and no noise.
// Usage: node mind-zero.mjs [isle-id] [-v]     (-v prints the mind's plan log)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { World } = require('../../sim.js');
const IS = require('../../isles.js');
import { play } from './mind.mjs';

const args = process.argv.slice(2), V = args.includes('-v'), ONLY = args.find((a) => !a.startsWith('-'));
let won = 0, n = 0;
const t0 = Date.now();
for (let i = 0; i < IS.ISLES.length; i++) {
  const L = IS.ISLES[i];
  if (ONLY && L.id !== ONLY) continue;
  const w = new World(); w.load(i); w.addPlayer('me'); w.drain();
  const t1 = Date.now();
  const r = play(w, 'me', { max: 60 * 180 });
  n++; if (r.won) won++;
  const s = r.nav.stats;
  console.log(`${L.id.padEnd(14)} ${L.want} ${r.won ? 'WON ' + String(r.time).padStart(5) + ' s' : 'lost: ' + r.plan}  ` +
    `[${((Date.now() - t1) / 1000).toFixed(1)} s cpu, ${s.graphs} maps, ${s.rollouts} edge rollouts]`);
  if (V || !r.won) console.log('   ' + r.log.slice(-40).join('\n   '));
}
console.log(`\n${won} / ${n} isles won at zero noise, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
