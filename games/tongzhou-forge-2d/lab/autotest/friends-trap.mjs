// Session 3 finding check: on Friends, once you are on the LEFT of the pillar without the pillar's 月,
// can you get back up? The search mind (mind.mjs) finds no way and restarts the isle; this asks a player
// that knows nothing: a seeded random thumb (biased toward the pillar, leaping whenever it has a charge,
// GRAB now and then) dropped there with the left 月 lying anywhere on the left. It records the highest the
// feet ever get and how often it stands on the pillar top (y 9). Independent of mind.mjs's map.
// Answer (200 episodes x 60 s): yes, rarely: 2 times, by a chain of four leaps: brush the 月 in the air
// (a refill), the pillar wall (a refill), then the high gem at (10.5, 11) (a refill).
// Usage: node friends-trap.mjs [episodes=200]      WHY=1 prints how each success went
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { World } = require('../../sim.js');
const IS = require('../../isles.js');
import { rng } from './human.mjs';

const N = +(process.argv[2] || 200), DT = 1 / 60, WHY = !!process.env.WHY;
const SHOW = new Set(['refill', 'leap', 'grab', 'place', 'gem', 'nudge']);
let best = 0, onTop = 0;
for (let e = 0; e < N; e++) {
  const R = rng(7000 + e);
  const w = new World(); w.load(IS.ISLES.findIndex((L) => L.id === 'friends')); w.addPlayer('me'); w.drain();
  const p = w.players.get('me');
  Object.assign(p, { x: 9 + R() * 2, y: 2, vx: 0, vy: 0, grounded: true }); p.safe = [p.x, 2];
  const m = w.stones.find((s) => s.x < 10); m.x = 5 + R() * 6.5;              // the left 月, anywhere on the left
  let x = 0, jump = false;
  const log = [];
  for (let f = 0; f < 60 * 60; f++) {
    if (R() < 0.08) x = [-1, -0.5, 0, 0.5, 1, 1, 1][Math.floor(R() * 7)];  // biased toward the pillar
    if (R() < 0.06) { jump = true; w.press('me', 'jump'); } else if (R() < 0.05) jump = false;
    if (!p.grounded && p.qi > 0 && R() < 0.15) w.press('me', 'jump');      // leap whenever a charge is there
    if (R() < 0.01) w.press('me', 'grab');
    w.setInput('me', x, jump); w.step(DT);
    for (const ev of w.drain()) if (WHY && SHOW.has(ev.t)) log.push(`${(f / 60).toFixed(2)} ${ev.t} ${ev.src || ev.chain || ev.mode || ''} at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
    best = Math.max(best, p.y);
    if (p.grounded && p.y >= 8.9 && p.x > 12 && p.x < 15) {
      onTop++;
      if (WHY) console.log(`episode ${e}:\n  ` + log.slice(-14).join('\n  '));
      break;
    }
  }
}
console.log(`${N} episodes x 60 s from the left of the pillar: highest feet ${best.toFixed(2)}, on the pillar top ${onTop} times (top is y 9)`);
