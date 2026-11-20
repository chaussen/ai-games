// which part of the motor model breaks a route? one noise source at a time (steady values, others ideal)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { World } = require('../../sim.js'); const IS = require('../../isles.js');
import { run } from '../../bot.mjs'; import { ROUTES } from '../../routes.mjs'; import { humanize, PERSONAS } from './human.mjs';
const [id, route, N = 10] = process.argv.slice(2);
const Z = { retap: 0, t: 0, tS: 0, servo: 0, stick: 0, levels: null, aim: 0, notice: 0.45, hold: 0 };
const st = PERSONAS.steady;
const V = { zero: {}, retap: { retap: 0.07 }, frame1: { t: 0.001, servo: 0.001 }, lag: { t: st.t, tS: st.tS }, servo: { servo: st.servo }, stick: { stick: st.stick }, levels: { levels: st.levels }, aim: { aim: st.aim }, hold: { hold: st.hold }, steady: st };
for (const [n, v] of Object.entries(V)) {
  const H = { ...Z, ...v }; if (!H.levels) H.levels = Array.from({ length: 101 }, (_, i) => i / 100);
  let won = 0; const at = {};
  for (let s = 0; s < N; s++) {
    const w = new World(); w.load(IS.ISLES.findIndex(L => L.id === id)); w.addPlayer('me'); w.drain();
    const plan = ROUTES[id]({ w })[route].map(x => ({ ...x, timeout: (x.timeout || 8) * 2 }));
    let r; try { r = run(humanize(w, 'me', H, 1000 + s), 'me', plan, { max: 60 * 240 }); } catch (e) { r = { at: 'threw ' + e.message.slice(0, 50) }; }
    if (r.ok && w.phase === 'won') won++; else at[r.at] = (at[r.at] || 0) + 1;
  }
  console.log(n.padEnd(8), won + '/' + N, JSON.stringify(at));
}
