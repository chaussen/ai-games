// Wobble Works 3D — plays every stage to the beacon with scripted wobblers, directly
// against the simulation (no server, no sockets), so it runs in well under a second.
// This is the proof that each stage can be finished by one player alone.
// Run with: node sim-test.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Game } = require('./sim.js');

const DT = 1 / 60;
let failed = 0;
const check = (cond, msg) => { console.log((cond ? 'PASS ✓ ' : 'FAIL ✗ ') + msg); if (!cond) { failed++; process.exitCode = 1; } };

function driver(g) {
  const P = id => g.players.get(id);
  const tick = (n = 1) => { for (let i = 0; i < n; i++) g.step(DT); };
  const wait = s => tick(Math.round(s * 60));
  const stop = id => g.setInput(id, 0, 0);
  // walk straight to a point; returns false on timeout
  function go(id, x, z, timeout = 9) {
    for (let i = 0; i < timeout * 60; i++) {
      const p = P(id), dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { stop(id); tick(4); return true; }
      const m = Math.max(0.3, Math.min(1, d / 0.35));
      g.setInput(id, dx / d * m, dz / d * m);
      tick();
    }
    stop(id);
    throw new Error(`${id} could not reach ${x},${z} (stuck at ${P(id).x.toFixed(2)},${P(id).y.toFixed(2)},${P(id).z.toFixed(2)})`);
  }
  const hop = (id, x, z) => { g.act(id, 'jump'); return go(id, x, z, 4); };
  const grab = id => { g.act(id, 'grab'); tick(2); };
  // hold a direction until a condition is true
  function hold(id, ix, iz, until, timeout = 8) {
    g.setInput(id, ix, iz);
    for (let i = 0; i < timeout * 60; i++) { if (until()) { stop(id); tick(3); return true; } tick(); }
    stop(id);
    throw new Error(`${id} hold(${ix},${iz}) timed out at ${P(id).x.toFixed(2)},${P(id).z.toFixed(2)}`);
  }
  // running toss, then let the Core settle
  function toss(id, ix, iz) { g.setInput(id, ix, iz); tick(5); g.act(id, 'grab'); tick(1); stop(id); wait(0.8); }
  // running jump: take off once `edge()` is true, keep going until `landed()`
  function leap(id, ix, iz, edge, landed) {
    hold(id, ix, iz, edge, 5);
    g.setInput(id, ix, iz); g.act(id, 'jump');
    hold(id, ix, iz, () => landed() && P(id).grounded, 3);
  }
  return { P, tick, wait, stop, go, hop, grab, hold, toss, leap };
}

function solo(stage, name, script) {
  const g = new Game();
  g.addPlayer('a', 'Solo');
  g.loadStage(stage);
  const d = driver(g);
  try {
    script(g, d);
    d.wait(0.2);
    check(g.phase === 'won', `stage ${stage + 1} "${name}" solved solo in ${g.time.toFixed(1)}s game time (par ${g.L.par}s)`);
  } catch (e) {
    check(false, `stage ${stage + 1} "${name}" solo: ${e.message}`);
  }
  return g;
}

// ---------- stage 1: ramp, toss over a 2-gap, jump after it ----------
solo(0, 'First Light', (g, d) => {
  d.go('a', 11.3, 2.5); d.grab('a');
  check(g.core.holder === g.players.get('a'), 'GRAB next to the Core picks it up');
  g.act('a', 'jump'); d.tick(5);
  check(d.P('a').grounded, 'a carrier cannot jump (the Core is heavy)');
  d.go('a', 6.7, 2.5);
  check(Math.abs(d.P('a').y - 3) < 0.01, 'a carrier walks up the ramp to height 3');
  d.toss('a', -1, 0);
  check(g.core.x < 4 && Math.abs(g.core.y - 3) < 0.01, `a running toss clears the 2-wide gap (Core landed at x=${g.core.x.toFixed(2)})`);
  d.go('a', 7.4, 2.5);
  d.leap('a', -1, 0, () => d.P('a').x < 6.1, () => d.P('a').x < 3.9);
  check(d.P('a').y === 3 && d.P('a').x < 4, 'a free wobbler jumps the 2-wide gap');
  d.go('a', Math.min(3.7, g.core.x + 0.5), 2.5); d.grab('a');
  d.go('a', 1.5, 2.5);
});

// ---------- stage 2: crates on plates open the gate and raise the bridge ----------
solo(1, 'Hold the Door', (g, d) => {
  const [c1, c2] = g.crates;
  d.go('a', 14.5, 1.5);
  d.hold('a', 0, 1, () => c1.z >= 3.45);
  d.go('a', 15.5, 2.5); d.go('a', 15.5, 3.5);
  d.hold('a', -1, 0, () => c1.x <= 13.55);
  d.wait(1);
  check(g.plates[0].on && g.movers[0].top === 2, 'a crate parked on plate A holds the gate open');
  d.go('a', 13.3, 1.5); d.grab('a');
  d.go('a', 12.5, 2.5); d.go('a', 10.5, 2.5);
  d.go('a', 10.5, 1.5); d.go('a', 9.5, 1.5);
  d.hold('a', 0, 1, () => c2.z >= 3.45);
  d.go('a', 10.5, 2.5); d.go('a', 10.5, 3.5);
  d.hold('a', -1, 0, () => c2.x <= 8.55);
  d.wait(1.2);
  check(g.movers[1].top === 2, 'a crate parked on plate B raises the bridge');
  d.go('a', 9.5, 2.5); d.go('a', 2.5, 2.5); d.go('a', 1.5, 2.5);
});

// ---------- stage 3: Core rides the lift, wobbler takes the steps ----------
solo(2, 'Going Up', (g, d) => {
  d.go('a', 5.0, 6.5); d.go('a', 4.3, 5.5); d.grab('a');
  d.go('a', 4.5, 5.0); d.go('a', 4.5, 4.45);
  d.grab('a'); d.wait(0.8);
  check(g.core.state === 'loose' && g.core.z < 4 && g.core.z > 2, `standing still, THROW sets the Core down just ahead (z=${g.core.z.toFixed(2)}, on the lift)`);
  d.go('a', 5.5, 5.5);
  d.hold('a', 1, 0, () => g.crates[0].x >= 8.45);
  d.wait(2.4);
  check(g.movers[0].top === 4 && Math.abs(g.core.y - 4) < 0.01, 'the lift carries the Core up to height 4');
  d.go('a', 6.5, 4.5);
  d.hop('a', 6.5, 3.5); d.hop('a', 6.5, 2.5); d.hop('a', 6.5, 1.5);
  check(d.P('a').y === 4, 'a free wobbler hops up the 1-high steps');
  d.go('a', 4.6, 1.5); d.go('a', 4.6, 2.5); d.grab('a');
  d.go('a', 3.5, 2.5); d.go('a', 1.5, 2.5);
});

// ---------- stage 4: the long way round (two crates, bridge, three ramps) ----------
solo(3, 'Bucket Brigade', (g, d) => {
  const [cp, cq] = g.crates;
  d.go('a', 12.5, 3.5); d.hop('a', 11.5, 3.5);
  d.hold('a', 0, 1, () => cq.z >= 5.45);
  check(g.movers[0].a === 0, 'the bridge needs BOTH plates: one crate is not enough');
  d.go('a', 10.5, 3.5); d.go('a', 9.5, 3.5);
  d.hold('a', 0, 1, () => cp.z >= 5.45);
  d.wait(1.2);
  check(g.movers[0].top === 2, 'two crates on two plates raise the bridge');
  d.go('a', 11.5, 3.5); d.go('a', 12.5, 3.5); d.go('a', 13.0, 3.5); d.grab('a');
  d.go('a', 14.5, 2.5); d.go('a', 14.5, 0.5); d.go('a', 10.5, 0.5);
  d.go('a', 5.5, 0.5); d.go('a', 2.5, 0.5); d.go('a', 0.5, 0.5);
  d.go('a', 0.5, 3.5); d.go('a', 1.5, 4.5);
});

// ---------- stage 5: gate, lift, gap ----------
solo(4, 'The Works', (g, d) => {
  const [c1, c2] = g.crates;
  d.go('a', 13.5, 4.5); d.go('a', 12.5, 4.5);
  d.hold('a', 0, 1, () => c1.z >= 6.45);
  d.go('a', 12.1, 4.5); d.grab('a');
  d.go('a', 11.5, 5.5); d.go('a', 9.5, 5.5);
  d.go('a', 7.5, 5.0); d.go('a', 7.5, 4.45);
  d.grab('a'); d.wait(0.8);
  d.go('a', 7.5, 5.5);
  d.hold('a', -1, 0, () => c2.x <= 5.55);
  d.wait(1.8);
  d.go('a', 9.5, 4.5); d.hop('a', 9.5, 3.5); d.hop('a', 9.5, 2.5);
  d.go('a', 8.0, 3.0); d.grab('a');
  d.go('a', 8.5, 1.5); d.go('a', 6.5, 1.0); d.go('a', 5.7, 1.0);
  d.toss('a', -1, 0);
  d.go('a', 6.4, 1.0);
  d.leap('a', -1, 0, () => d.P('a').x < 5.1, () => d.P('a').x < 2.9);
  d.go('a', Math.min(2.7, g.core.x + 0.5), g.core.z); d.grab('a');
  d.go('a', 1.5, 1.5);
});

// ---------- co-op: pass the Core up a step ----------
{
  const g = new Game();
  g.addPlayer('a', 'Low'); g.addPlayer('b', 'High');
  g.loadStage(3);
  const d = driver(g);
  const a = d.P('a'), b = d.P('b');
  d.go('b', 12.5, 3.5); d.hop('b', 11.2, 3.5);
  d.go('a', 13.2, 4.2); d.grab('a');
  d.go('a', 13.4, 3.5); d.go('a', 12.6, 3.5);
  g.drainEvents();
  check(g.aim()[3] === 'pass', 'facing a friend one step up, the aim marker switches to PASS');
  d.grab('a'); d.wait(1);
  check(g.core.holder === b && b.y === 2 && a.y === 1, 'co-op: the Core is passed up a step and caught');
  check(g.drainEvents().some(e => e.t === 'catch' && e.id === 'b'), 'a catch event is emitted for the catcher');
}

// ---------- the rules that make co-op matter ----------
{
  const g = new Game();
  g.addPlayer('a', 'Solo');
  g.loadStage(3);
  const d = driver(g);
  d.go('a', 13.2, 4.2); d.grab('a');
  d.go('a', 13.4, 4.5); d.go('a', 12.8, 4.5);
  d.toss('a', -1, 0);
  check(g.core.state === 'loose' && g.core.y === 1, 'alone, a toss cannot put the Core up a step (it bounces back)');
}
{
  const g = new Game();
  g.addPlayer('a', 'Solo');
  g.loadStage(1);
  const d = driver(g);
  const a = d.P('a');
  d.go('a', 12.6, 2.5);
  d.hold('a', -1, 0, () => a.vx === 0 || a.x < 11.5, 3);
  check(a.x > 12, 'a closed gate stops a wobbler');
  g.act('a', 'jump'); g.setInput('a', -1, 0); d.wait(0.7); d.stop('a');
  check(a.x > 12, 'a 2-high gate cannot be jumped');
}
{
  const g = new Game();
  g.addPlayer('a', 'Solo');
  g.loadStage(0);
  const d = driver(g);
  const a = d.P('a');
  d.go('a', 11.3, 2.5); d.grab('a');
  d.go('a', 6.6, 2.5);
  g.setInput('a', -1, 0); d.wait(1.6); d.stop('a'); d.wait(0.3);
  check(a.x >= 6 && a.y === 3 && g.core.state === 'loose', 'walking off an edge with the Core respawns the wobbler at the last safe tile');
  check(g.core.x >= 6 && g.core.y === 3, 'and the Core comes back with them instead of being lost');
}
{
  const g = new Game();
  g.addPlayer('b', 'Base'); g.addPlayer('a', 'Tall');
  g.loadStage(1);
  const d = driver(g);
  const a = d.P('a'), b = d.P('b');
  // b stands against the 2-high gate wall; a climbs on b's head and over
  d.go('b', 12.4, 1.5);
  d.go('a', 13.6, 1.5);
  g.setInput('a', -1, 0); g.act('a', 'jump'); d.wait(0.45); d.stop('a'); d.wait(0.4);
  check(Math.abs(a.y - 3) < 0.01 && a.support === b, 'a wobbler can stand on a friend\'s head');
  g.setInput('a', -1, 0); g.act('a', 'jump'); d.wait(0.5); d.stop('a'); d.wait(0.4);
  check(a.y === 4 && a.x < 12, 'and from there jump onto a 2-high wall');
}
{
  // sixteen wobblers get sixteen distinct colours and none spawns in the void
  const g = new Game();
  for (let i = 0; i < 16; i++) g.addPlayer('p' + i, 'W' + i);
  let ok = new Set([...g.players.values()].map(p => p.ci)).size === 16;
  for (let s = 0; s < g.levels.length; s++) {
    g.loadStage(s);
    for (let i = 0; i < 120; i++) g.step(DT);
    for (const p of g.players.values()) if (!(p.y >= 1) || !p.grounded) ok = false;
  }
  check(ok, '16 wobblers spawn on solid ground on every stage');
  const snap = JSON.stringify(g.snapshot());
  check(snap.length < 1400, `a 16-player snapshot is ${snap.length} bytes`);
}
{
  // after the celebration the next stage loads by itself
  const g = new Game();
  g.addPlayer('a', 'Solo');
  const d = driver(g);
  d.go('a', 11.3, 2.5); d.grab('a'); d.go('a', 6.7, 2.5); d.toss('a', -1, 0);
  d.go('a', 7.4, 2.5); d.leap('a', -1, 0, () => d.P('a').x < 6.1, () => d.P('a').x < 3.9);
  d.go('a', Math.min(3.7, g.core.x + 0.5), 2.5); d.grab('a'); d.go('a', 1.5, 2.5);
  const res = g.result;
  check(res && res.stars >= 1 && res.total === 3, `a win reports time ${res && res.time}s, gems ${res && res.gems}/${res && res.total}, ${res && res.stars} star(s)`);
  d.wait(8.2);
  check(g.stage === 1 && g.phase === 'play', 'the next stage loads after the celebration');
}

console.log(failed ? `--- ${failed} CHECK(S) FAILED ---` : '--- ALL SIM CHECKS PASSED ---');
