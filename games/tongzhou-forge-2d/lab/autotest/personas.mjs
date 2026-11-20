// Session 2 spike: every isle's scripted routes, played through the human motor channel (human.mjs) by
// each persona, N seeds each. Prints a win-rate table: where does a less exact thumb stop winning?
// Usage: node personas.mjs [seeds=20] [isle-id]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { World } = require('../../sim.js');
const IS = require('../../isles.js');
import { run } from '../../bot.mjs';
import { ROUTES } from '../../routes.mjs';
import { humanize, PERSONAS } from './human.mjs';

const N = +(process.argv[2] || 20), ONLY = process.argv[3];
const isles = IS.ISLES;
const idx = (id) => isles.findIndex((L) => L.id === id);
const names = Object.keys(PERSONAS);
const t0 = Date.now(), stuck = {};
console.log('isle / route'.padEnd(40) + names.map((n) => n.padStart(9)).join(''));
const tot = Object.fromEntries(names.map((n) => [n, [0, 0]]));
for (const [id, make] of Object.entries(ROUTES)) {
  if (ONLY && id !== ONLY) continue;
  for (const route of Object.keys(make({}))) {
    const cells = [];
    for (const pn of names) {
      let won = 0, secs = 0;
      const runs = PERSONAS[pn] ? N : 1;
      for (let s = 0; s < runs; s++) {
        const w = new World(); w.load(idx(id)); w.addPlayer('me'); w.drain();
        const hw = humanize(w, 'me', PERSONAS[pn], 1000 + s);
        const plan = make({ w })[route].map((st) => ({ ...st, timeout: (st.timeout || 8) * 2 }));
        let r; try { r = run(hw, 'me', plan, { max: 60 * 240 }); } catch (e) { r = { ok: false, at: 'threw: ' + e.message.slice(0, 60) }; }
        if (r.ok && w.phase === 'won') { won++; secs += w.result.time; }
        else { const k = `${id}/${route}/${pn}: ${r.at}`; stuck[k] = (stuck[k] || 0) + 1; }
      }
      tot[pn][0] += won / runs; tot[pn][1]++;
      cells.push(((100 * won / runs).toFixed(0) + '%' + (won ? ' ' + (secs / won).toFixed(0) + 's' : '')).padStart(9));
    }
    console.log((id + ' / ' + route).padEnd(40) + cells.join(''));
  }
}
console.log('mean win rate'.padEnd(40) + names.map((n) => ((100 * tot[n][0] / tot[n][1]).toFixed(0) + '%').padStart(9)).join(''));
console.log('\nwhere runs got stuck (count):');
for (const [k, v] of Object.entries(stuck).sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(String(v).padStart(4), k);
console.log('\n' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
