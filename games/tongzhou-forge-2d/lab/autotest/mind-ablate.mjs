// Session 3: which part of a persona's motor channel costs it time (or the win) on an isle? The search
// mind plays the isle with the persona as is, then with one noise source switched off at a time.
// What is left when a source is off is what that source cost. A game reason reads like "the tower climb
// punishes JUMP timing", a mind reason like "loses a minute whatever the noise" (then: trace it).
// Usage: node mind-ablate.mjs <isle-id> [persona=kid] [seeds=8]
import { runIsle } from './mind-personas.mjs';
import { PERSONAS } from './human.mjs';

const [id, pn = 'kid', N = '8'] = process.argv.slice(2);
const H = PERSONAS[pn];
const variants = {
  [pn]: H,
  'no timing error': { ...H, t: 0, servo: 0 },
  'exact stick': { ...H, stick: 0, levels: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] },
  'no missed taps': { ...H, aim: 0 },
  'exact JUMP hold': { ...H, hold: 0 },
  'no noise': { t: 0, tS: 0, servo: 0, stick: 0, levels: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], aim: 0, notice: 0, hold: 0 },
};
const med = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
console.log(`${id}, ${pn}, ${N} seeds each`);
for (const [name, h] of Object.entries(variants)) {
  const runs = runIsle(id, +N, [name], { [name]: h });
  const won = runs.filter((r) => r.won);
  const times = won.map((r) => r.time);
  console.log(`${name.padEnd(18)} won ${String(won.length).padStart(2)}/${N}  median ${won.length ? med(times).toFixed(1).padStart(5) + ' s' : '    -  '}  ` +
    `worst ${won.length ? Math.max(...times).toFixed(0).padStart(4) + ' s' : '   -'}  falls ${(runs.reduce((a, r) => a + r.splash, 0) / runs.length).toFixed(1)}  ouch ${(runs.reduce((a, r) => a + r.ouch, 0) / runs.length).toFixed(1)}`);
}
