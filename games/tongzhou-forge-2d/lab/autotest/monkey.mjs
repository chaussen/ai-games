// Spike 2 (autotest research): how fast is the bare sim, and what does a random "button-masher"
// (held stick for a random time, random JUMP / GRAB) find on every isle in a fixed budget?
// Oracles are game-agnostic invariants: no exception, no NaN, the player never inside rock or outside the map.
// Seeded RNG so a failure can be replayed. Usage: node monkey.mjs [episodes] [seconds] [seed]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { World } = require('../../sim.js');
const IS = require('../../isles.js');
const EP = +(process.argv[2] || 20), SECS = +(process.argv[3] || 60), SEED = +(process.argv[4] || 1);
const DT = 1 / 60;
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const n = IS.ISLES.length;
let steps = 0, t0 = performance.now();
const rows = [];
for (let i = 0; i < n; i++) {
  const ev = {}, cells = new Set(), bad = [];
  let wins = 0;
  for (let e = 0; e < EP; e++) {
    const r = rng(SEED * 1000 + i * 97 + e);
    const w = new World(); w.load(i); const p = w.addPlayer('me'); w.drain();
    let x = 0, hold = 0, jump = false;
    for (let f = 0; f < SECS * 60; f++) {
      if (hold-- <= 0) { x = [-1, -1, 0, 1, 1, 0.4, -0.4][Math.floor(r() * 7)]; hold = 10 + Math.floor(r() * 90); }
      if (r() < 0.03) { jump = true; w.press('me', 'jump'); } else if (r() < 0.08) jump = false;
      if (r() < 0.012) w.press('me', 'grab');
      try { w.setInput('me', x, jump); w.step(DT); } catch (err) { bad.push('throw: ' + err.message); break; }
      steps++;
      for (const k of w.drain()) ev[k.t] = (ev[k.t] || 0) + 1;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { bad.push('NaN at f' + f); break; }
      if (p.x < 0 || p.x > w.w || p.y < -2) { bad.push(`out of map x=${p.x.toFixed(2)} y=${p.y.toFixed(2)} ep${e} f${f}`); break; }
      if (w.solid(Math.floor(p.x), Math.floor(p.y + 0.6))) { bad.push(`inside rock x=${p.x.toFixed(2)} y=${p.y.toFixed(2)} ep${e} f${f}`); break; }
      cells.add(Math.floor(p.x) + ',' + Math.floor(p.y));
      if (w.phase === 'won') { wins++; break; }
    }
  }
  let open = 0; { const w = new World(); w.load(i); for (let cx = 0; cx < w.w; cx++) for (let cy = 0; cy < w.h; cy++) if (!w.solid(cx, cy)) open++; }
  rows.push({ isle: IS.ISLES[i].id, wins, cover: (100 * cells.size / open).toFixed(0) + '%', forge: ev.forge || 0, dud: ev.dud || 0, bad: bad.slice(0, 2).join(' | ') });
}
const secs = (performance.now() - t0) / 1000;
console.table(rows);
console.log(`${steps} sim steps in ${secs.toFixed(1)} s = ${(steps / secs / 60).toFixed(0)}x real time (${(steps / secs).toFixed(0)} steps/s, one core)`);
