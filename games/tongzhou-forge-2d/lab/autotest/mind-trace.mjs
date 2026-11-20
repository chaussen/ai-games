// Session 3: one run of the search mind through the motor channel, with its plan log, the isle's events
// and where everything ended. For "why did this persona not win this isle?".
// Usage: node mind-trace.mjs <isle-id> <persona> [seed=1000] [seconds=180]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { World } = require('../../sim.js');
const IS = require('../../isles.js');
import { play, handsOf } from './mind.mjs';
import { humanize, PERSONAS } from './human.mjs';

const [id, pn = 'ideal', seed = '1000', secs = '180'] = process.argv.slice(2);
const w = new World(); w.load(IS.ISLES.findIndex((L) => L.id === id)); w.addPlayer('me'); w.drain();
const hw = humanize(w, 'me', PERSONAS[pn], +seed);
const quiet = new Set(['jump', 'leap', 'refill', 'land', 'thud', 'nudge', 'cloud', 'gem', 'start', 'near']);
const lines = [];
const r = play(w, 'me', { hw, hands: handsOf(PERSONAS[pn]), max: 60 * +secs, onEvent: (e, f) => { if (!quiet.has(e.t)) lines.push([f / 60, 'ev  ' + JSON.stringify(e)]); } });
for (const l of r.log) { const sp = l.indexOf(' '); lines.push([+l.slice(0, sp), 'mind ' + l.slice(sp + 1)]); }
lines.sort((a, b) => a[0] - b[0]);
for (const [t, s] of lines.slice(0, 200)) console.log(t.toFixed(2).padStart(7), s);
if (lines.length > 200) console.log(`  ... ${lines.length - 200} more`);
const p = w.players.get('me');
console.log(`\n${r.won ? 'WON in ' + r.time + ' s' : 'not won: ' + r.plan}; hero at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) holding ${p.hold ? p.hold.ch : 'nothing'}`);
console.log('stones: ' + w.stones.map((s) => `${s.ch}@${s.x.toFixed(2)},${s.y.toFixed(2)} ${s.state}${s.grounded ? '' : ' (air)'}`).join('; '));
console.log('restarts: ' + (r.restarts.length ? JSON.stringify(r.restarts) : 'none'));
console.log('motor channel: ' + JSON.stringify(hw.human ? hw.human.stats : null));
