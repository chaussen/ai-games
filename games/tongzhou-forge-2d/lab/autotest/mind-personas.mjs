// Session 3, acceptance 2: the search mind (mind.mjs) through the human motor channel (human.mjs), every
// isle x persona x N seeds. One worker process per isle (each keeps its own map cache), 7 at a time.
// Prints win rate and median time-to-win per isle and persona, and what the mind was doing when a run
// ran out of time. Writes the raw runs to mind-personas.json (next to this file) for ablation and traces.
// Usage: node mind-personas.mjs [seeds=5] [isle-id ...]   (env MAX=seconds per run, default 180)
import { createRequire } from 'module';
import { fork } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { World } = require('../../sim.js');
const IS = require('../../isles.js');
import { play, handsOf } from './mind.mjs';
import { humanize, PERSONAS } from './human.mjs';

const NAMES = ['ideal', 'steady', 'rusher', 'kid'];
const MAX = +(process.env.MAX || 180);

export function runIsle(id, seeds, names = NAMES, H = PERSONAS) {
  const i = IS.ISLES.findIndex((L) => L.id === id), out = [];
  let nav = null;
  for (const pn of names) {
    for (let s = 0; s < (H[pn] ? seeds : 1); s++) {
      const w = new World(); w.load(i); w.addPlayer('me'); w.drain();
      const hw = humanize(w, 'me', H[pn], 1000 + s);
      // the mind allows for its own median latency (a person learns their own timing); see rollout()
      const r = play(w, 'me', { hw, nav, hands: handsOf(H[pn]), max: 60 * MAX });
      nav = r.nav;
      const count = (t) => r.ev.filter((e) => e.t === t && (e.id === undefined || e.id === 'me')).length;
      out.push({ isle: id, persona: pn, seed: 1000 + s, won: r.won, time: r.time, plan: r.plan,
        splash: count('splash'), ouch: count('ouch'), dud: count('dud'), forge: count('forge'), wrong: r.ev.filter((e) => e.t === 'forge' && e.wrong).length,
        restarts: r.restarts, human: hw.human ? hw.human.stats : null, log: r.won ? undefined : r.log.slice(-8) });
    }
  }
  return out;
}

const me = fileURLToPath(import.meta.url);
if (process.argv[1] === me && process.env.MIND_WORKER) {
  process.on('message', ({ id, seeds }) => { process.send(runIsle(id, seeds)); process.exit(0); });
} else if (process.argv[1] === me) {
  const seeds = +(process.argv[2] || 5), only = process.argv.slice(3);
  const ids = IS.ISLES.filter((L) => only.length || !L.write).map((L) => L.id).filter((id) => !only.length || only.includes(id));   // the mind cannot write yet: writing isles (L.write, docs/CONJURE.md 7a) are left out of 'all'
  const t0 = Date.now(), all = {}, queue = ids.slice();
  await new Promise((done) => {
    let running = 0;
    const next = () => {
      if (!queue.length && !running) return done();
      while (running < 7 && queue.length) {
        const id = queue.shift(); running++;
        const c = fork(me, [], { env: { ...process.env, MIND_WORKER: '1' } });
        c.on('message', (r) => { all[id] = r; process.stderr.write(`${id} (${((Date.now() - t0) / 1000).toFixed(0)} s) `); });
        c.on('exit', () => { running--; next(); });
        c.send({ id, seeds });
      }
    };
    next();
  });
  process.stderr.write('\n');
  const med = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  console.log('isle'.padEnd(14) + NAMES.map((n) => n.padStart(13)).join('') + '    (win rate, median seconds to win)');
  const tot = Object.fromEntries(NAMES.map((n) => [n, []]));
  const stuck = {};
  for (const id of ids) {
    const runs = all[id] || [];
    const cells = NAMES.map((pn) => {
      const rs = runs.filter((r) => r.persona === pn), w = rs.filter((r) => r.won);
      tot[pn].push(...rs);
      for (const r of rs) if (!r.won) { const k = `${id}/${pn}: ${r.plan}`; stuck[k] = (stuck[k] || 0) + 1; }
      return rs.length ? `${(100 * w.length / rs.length).toFixed(0)}% ${w.length ? med(w.map((r) => r.time)).toFixed(0) + 's' : '  -'}`.padStart(13) : ''.padStart(13);
    });
    console.log(id.padEnd(14) + cells.join(''));
  }
  console.log('all'.padEnd(14) + NAMES.map((pn) => { const rs = tot[pn], w = rs.filter((r) => r.won); return `${(100 * w.length / Math.max(1, rs.length)).toFixed(0)}% ${w.length ? med(w.map((r) => r.time)).toFixed(0) + 's' : ''}`.padStart(13); }).join(''));
  const sum = (pn, k) => tot[pn].reduce((a, r) => a + (r[k] || 0), 0);
  console.log('\nper run (mean): ' + NAMES.map((pn) => `${pn}: ${(sum(pn, 'splash') / tot[pn].length).toFixed(1)} falls, ${(sum(pn, 'ouch') / tot[pn].length).toFixed(1)} ouch, ${(sum(pn, 'wrong') / tot[pn].length).toFixed(1)} wrong forges`).join('; '));
  console.log('\nrestarts (no way on for 15 s, the same step for 40 s, or nothing made for 75 s: the isle restarted, as from the menu):');
  for (const id of ids) for (const pn of NAMES) {
    const rs = (all[id] || []).filter((r) => r.persona === pn), n = rs.reduce((a, r) => a + r.restarts.length, 0);
    if (n) console.log(`  ${id}/${pn}: ${n} in ${rs.length} runs; ` + rs.flatMap((r) => r.restarts).map((x) => `${x.why} at (${x.at}) holding ${x.hold || 'nothing'}`).slice(0, 3).join(' | '));
  }
  console.log('\nnot won in ' + MAX + ' s (what the mind was doing):');
  for (const [k, v] of Object.entries(stuck).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(4), k);
  writeFileSync(new URL('./mind-personas.json', import.meta.url), JSON.stringify(all, null, 0));
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s wall`);
}
