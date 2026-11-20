// Replays monkey.mjs seed 1, isle 2 (dawn), episode 19 and prints the last frames before the "inside rock" flag.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { World } = require('../../sim.js');
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const i = 2, e = 19, r = rng(1 * 1000 + i * 97 + e);
const w = new World(); w.load(i); const p = w.addPlayer('me'); w.drain();
let x = 0, hold = 0, jump = false; const hist = [];
for (let f = 0; f < 3600; f++) {
  if (hold-- <= 0) { x = [-1, -1, 0, 1, 1, 0.4, -0.4][Math.floor(r() * 7)]; hold = 10 + Math.floor(r() * 90); }
  if (r() < 0.03) { jump = true; w.press('me', 'jump'); } else if (r() < 0.08) jump = false;
  const g = r() < 0.012; if (g) w.press('me', 'grab');
  w.setInput('me', x, jump); w.step(1 / 60);
  const evs = w.drain().map(k => k.t + (k.ch ? ':' + k.ch : ''));
  hist.push(`f${f} x=${p.x.toFixed(2)} y=${p.y.toFixed(2)} vy=${p.vy.toFixed(1)} g=${p.grounded} hold=${p.hold ? p.hold.ch : '-'} in=${x}${jump ? ' J' : ''}${g ? ' GRAB' : ''} ${evs.join(',')}`);
  if (w.solid(Math.floor(p.x), Math.floor(p.y + 0.6))) {
    console.log(hist.slice(-25).join('\n'));
    console.log('cell', Math.floor(p.x), Math.floor(p.y + 0.6), JSON.stringify(w.cell(Math.floor(p.x), Math.floor(p.y + 0.6))));
    for (let cy = 4; cy >= 0; cy--) { let row = ''; for (let cx = 10; cx < 20; cx++) row += w.cell(cx, cy) || '?'; console.log(cy, row); }
    console.log('stones near:', w.stones.filter(k => Math.abs(k.x - p.x) < 3).map(k => `${k.ch} ${k.state} x=${k.x.toFixed(2)} y=${k.y.toFixed(2)}`));
    // what happens next: the same inputs keep coming for two more seconds, then try to walk out each way
    for (const [label, ix, frames] of [['same inputs', null, 120], ['hold right', 1, 120], ['hold left + jump', -1, 120]]) {
      const ys = [];
      for (let k = 0; k < frames; k++) {
        let xi = ix, jj = false;
        if (ix === null) { if (hold-- <= 0) { x = [-1, -1, 0, 1, 1, 0.4, -0.4][Math.floor(r() * 7)]; hold = 10 + Math.floor(r() * 90); } if (r() < 0.03) { jump = true; w.press('me', 'jump'); } else if (r() < 0.08) jump = false; r(); xi = x; jj = jump; }
        else if (label.includes('jump') && k % 30 === 0) { w.press('me', 'jump'); jj = true; }
        w.setInput('me', xi, jj); w.step(1 / 60); w.drain();
        if (k % 20 === 19) ys.push(`(${p.x.toFixed(2)},${p.y.toFixed(2)}${w.solid(Math.floor(p.x), Math.floor(p.y + 0.6)) ? ' IN' : ''})`);
      }
      console.log(label + ':', ys.join(' '));
    }
    break;
  }
}
