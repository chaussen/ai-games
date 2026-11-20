// can the World be deep-copied (for a search mind)? copy keeps prototypes, Maps, Sets; check the copy and the
// original then run the same inputs to the same state.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { World } = require('../../sim.js'); const IS = require('../../isles.js');
export function clone(o, seen = new Map()) {
  if (o === null || typeof o !== 'object') return o;
  if (seen.has(o)) return seen.get(o);
  let c;
  if (Array.isArray(o)) { c = []; seen.set(o, c); for (const v of o) c.push(clone(v, seen)); return c; }
  if (o instanceof Map) { c = new Map(); seen.set(o, c); for (const [k, v] of o) c.set(clone(k, seen), clone(v, seen)); return c; }
  if (o instanceof Set) { c = new Set(); seen.set(o, c); for (const v of o) c.add(clone(v, seen)); return c; }
  c = Object.create(Object.getPrototypeOf(o)); seen.set(o, c);
  for (const k of Object.keys(o)) c[k] = clone(o[k], seen);
  return c;
}
const fns = []; const w = new World(); w.load(IS.ISLES.findIndex(L => L.id === 'friends')); w.addPlayer('me'); w.drain();
(function walk(o, path, seen = new Set()) { if (!o || typeof o !== 'object' || seen.has(o)) return; seen.add(o); for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'function') fns.push(path + '.' + k); else walk(v, path + '.' + k, seen); } })(w, 'w');
console.log('function-valued fields (closures would be shared by a copy):', fns.slice(0, 10), fns.length);
const drive = (x, f) => { for (let i = 0; i < 240; i++) { x.setInput('me', Math.sin(i / 20 + f), i % 50 < 8); if (i % 50 === 0) x.press('me', 'jump'); x.step(1 / 60); x.drain(); } };
drive(w, 0);
const sig = (x) => JSON.stringify([x.time, [...x.players.values()].map(p => [p.x, p.y, p.vx, p.vy]), x.stones.map(s => [s.ch, s.x, s.y, s.state])]);
let t = performance.now(); const c = clone(w); const ms = performance.now() - t;
drive(w, 1); drive(c, 1);
console.log('copy took', ms.toFixed(2), 'ms; same future after copy:', sig(w) === sig(c));
t = performance.now(); for (let i = 0; i < 1000; i++) clone(w); console.log('1000 copies', (performance.now() - t).toFixed(0), 'ms');
