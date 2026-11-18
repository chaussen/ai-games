// 同舟 · Glyph Isles — plays every stage to the shrine with scripted wobblers, directly
// against the simulation (no server, no sockets), so it runs in well under a second.
// This is the proof that each stage can be finished by one player alone.
// Run with: node sim-test.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Game } = require('./sim.js');
const { checkRecipes, pairs } = await import('./tools/recipes.mjs');

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
  // running toss, then let the stone settle
  function toss(id, ix, iz) { g.setInput(id, ix, iz); tick(5); g.act(id, 'grab'); tick(1); stop(id); wait(1.1); }
  // running jump: take off once `edge()` is true, keep going until `landed()`
  function leap(id, ix, iz, edge, landed) {
    hold(id, ix, iz, edge, 5);
    g.setInput(id, ix, iz); g.act(id, 'jump');
    hold(id, ix, iz, () => landed() && P(id).grounded, 3);
  }
  // Set the held stone against stone k: side 'left' / 'right' of it on screen (⿰), or 'top' (⿱).
  // Stands 0.95 from k along screen-left/-right, or in front of it, turns to face it and presses GRAB.
  const R = [Math.SQRT1_2, -Math.SQRT1_2], D = [Math.SQRT1_2, Math.SQRT1_2];
  function set(id, k, side) {
    const [u, w] = side === 'left' ? [-1, 0] : side === 'right' ? [1, 0] : [0, 1];
    const x = k.x + 0.95 * (u * R[0] + w * D[0]), z = k.z + 0.95 * (u * R[1] + w * D[1]);
    go(id, x, z);
    const dx = k.x - P(id).x, dz = k.z - P(id).z, l = Math.hypot(dx, dz);
    g.setInput(id, dx / l * 0.2, dz / l * 0.2); tick(1); stop(id); tick(8);   // turn to face k
    g.act(id, 'grab'); tick(1); wait(1);
  }
  return { P, tick, wait, stop, go, hop, grab, hold, toss, leap, set };
}

function solo(stage, name, script) {
  const g = new Game();
  g.addPlayer('a', 'Solo');
  g.loadStage(stage);
  const d = driver(g);
  try {
    d.wait(2.8);   // the boat sails in
    script(g, d);
    d.wait(0.2);
    check(g.phase === 'won', `stage ${stage + 1} "${name}" solved solo in ${g.time.toFixed(1)}s game time (par ${g.L.par}s)`);
  } catch (e) {
    check(false, `stage ${stage + 1} "${name}" solo: ${e.message}`);
  }
  return g;
}

// pick up a freshly fused stone, unless it already popped into our hands
const take = (g, d, k) => { d.go('a', k.x + 0.6, k.z); d.grab('a'); if (d.P('a').hold !== k) throw new Error('could not pick up ' + k.ch); };
// JUDGE-style trace for a failing script: DBG=1 node sim-test.mjs
const dump = (g, tag) => { if (process.env.DBG) console.log('DBG', tag, g.stones.filter(k => k.state !== 'gone').map(k => k.ch + k.state[0] + ' ' + [k.x, k.y, k.z].map(v => v.toFixed(2)).join(',')).join(' | '), [...g.players.values()].map(p => p.id + '@' + [p.x, p.z].map(v => v.toFixed(2)).join(',') + (p.hold ? p.hold.ch : '')).join(' ')); };
const stone = (g, ch) => g.stones.find(k => k.ch === ch && k.state !== 'gone');
const evs = [];
const seen = (g, t) => { evs.push(...g.drainEvents()); return evs.filter(e => e.t === t); };

// ---------- stage 1: 木 becomes a bridge, 木 + 木 becomes 林 ----------
solo(0, 'Two Trees', (g, d) => {
  evs.length = 0;
  d.wait(1);
  check(g.stones.length === 2, 'two 木 that merely grew near each other do not fuse by themselves');
  d.go('a', 10.3, 1.5); d.grab('a');
  check(d.P('a').hold && d.P('a').hold.ch === '木', 'GRAB next to 木 picks it up');
  { g.act('a', 'jump'); let top = 0; for (let i = 0; i < 40; i++) { d.tick(); top = Math.max(top, d.P('a').y - 1); }
    check(top > 1.1 && top < 1.3 && d.P('a').grounded && d.P('a').hold, 'a carrier jumps as high as anyone (apex 1.2)'); }
  d.go('a', 7.6, 2.5);
  d.toss('a', -1, 0);
  const br = g.bridges[0];
  check(br && br.x0 === 4 && br.x1 === 7 && br.z0 === 2 && br.top === 1, '木 thrown into the 3-wide gap grows into a bridge across it');
  check(seen(g, 'bridge').length === 1 && !stone(g, '木').from, 'the 木 was used up (the other one is untouched)');
  d.wait(4);
  check(g.stones.filter(k => k.ch === '木').length === 1 && !seen(g, 'regrow').length && seen(g, 'spent').some(e => e.ch === '木' && !e.back), 'a used-up stone is gone for good: nothing grows back');
  // the only way to get it back is to conjure it: walk up beside the other 木 and write one
  // stand so the stone appearing 0.9 ahead (facing -x) lands 0.62 screen-right of the other 木
  const other = stone(g, '木'), cx = other.x + 0.62 * Math.SQRT1_2 + 0.9, cz = other.z - 0.62 * Math.SQRT1_2;
  d.go('a', cx + 0.6, cz); d.go('a', cx, cz);
  const inkBefore = g.ink;
  check(g.conjure('a', '木').ok && g.ink === inkBefore - 1, 'conjuring 木 brings one back and spends one drop of the crew ink');
  d.wait(1.5);
  const lin = stone(g, '林');
  check(lin && seen(g, 'fuse')[0].ch === '林', 'the conjured 木 lands beside the other 木 and the two become 林');
  check(g.found.has('林') && g.found.has('木'), 'both characters are noted as found');
  d.wait(5);
  check(stone(g, '林') && !stone(g, '森') && g.stones.length === 1, 'nothing grows back underneath the new 林 (it would turn it into 森 unasked)');
  take(g, d, lin);
  d.go('a', 7.5, 2.5); d.go('a', 3.5, 2.5);
  check(Math.abs(d.P('a').y - 1) < 0.01 && d.P('a').x < 4, 'the bridge carries a wobbler with a stone');
  d.go('a', 1.6, 2.5);
});

// a stage can opt back into regrowing stones with "regrow": true
{
  const L = JSON.parse(JSON.stringify(require('./levels.js').LEVELS[0])); L.regrow = true;
  const g = new Game([L]); g.addPlayer('a', 'A'); g.loadStage(0);
  const d = driver(g); d.wait(2.8);
  d.go('a', 10.3, 1.5); d.grab('a'); d.go('a', 7.6, 2.5); d.toss('a', -1, 0);
  d.wait(4);
  check(g.bridges.length === 1 && g.stones.filter(k => k.ch === '木').length === 2 && seen(g, 'regrow').length === 1, 'with "regrow": true a used-up stone grows back where it started');
}

// a stone that is not wood just falls and floats back; a too-wide gap grows nothing
{
  const g = new Game(); g.addPlayer('a', 'A'); g.loadStage(1);
  const d = driver(g);
  d.go('a', 13.3, 1.5); d.grab('a');
  d.go('a', 10.6, 0.9); d.toss('a', 0, -1); d.wait(1.5);
  check(g.bridges.length === 0 && stone(g, '火').y === 1, '火 thrown off the island grows no bridge and floats back');
  check(g.gapRun(4, 2, 3) && !g.gapRun(4, 2, 2) && !g.gapRun(11, 0, 7), 'a gap is bridged only when it is short enough and has floor on both sides');
}

// ---------- stage 2: 火 burns the hedge, 木 bridges, 日 + 月 = 明 ----------
solo(1, 'Sun and Moon', (g, d) => {
  evs.length = 0;
  const hedge = g.movers[0];
  d.go('a', 10.5, 2.5);
  check(hedge.top === 3.6 && d.P('a').x > 10.2, 'the thorn hedge blocks the way');
  d.go('a', 13.3, 1.5); d.grab('a');
  d.go('a', 11.0, 2.5); d.wait(1.2);
  check(hedge.done && hedge.top === 1 && seen(g, 'burn').length === 1, 'carrying 火 up to the hedge burns it down');
  // set 火 down facing away from 木 (facing 木 from the front would stack 火 on top of it)
  d.go('a', 12, 2.5); d.go('a', 11.5, 2.5); d.grab('a'); d.wait(0.6);
  d.go('a', 13.3, 3.5); d.grab('a');
  check(d.P('a').hold.ch === '木', 'the nearest stone is the one picked up');
  d.go('a', 11, 2.5); d.go('a', 6.6, 2.5);
  d.toss('a', -1, 0);
  check(g.bridges.length === 1 && g.bridges[0].x0 === 3 && g.bridges[0].x1 === 6, 'a second 木 bridges the gap to the shrine');
  d.go('a', 11, 2.5); d.go('a', 15.5, 1.6); d.grab('a');
  check(d.P('a').hold && d.P('a').hold.ch === '日', '日 can be lifted down from its ledge');
  // 月 sits on the island's left edge, so 日 cannot go on its left: set 日 down, then bring 月 to 日's right
  d.go('a', 11, 2.5); d.go('a', 8.6, 2.9); d.go('a', 8.13, 2.9);   // facing -x, 月 out of reach: SET DOWN
  d.grab('a'); d.wait(1);
  dump(g, 'sun down');
  const sun = stone(g, '日'), moon = stone(g, '月');
  d.go('a', 6.5, 2.0); d.grab('a');
  dump(g, 'moon up');
  check(d.P('a').hold === moon, 'picked up 月');
  d.set('a', sun, 'right');
  const ming = stone(g, '明');
  check(ming && !stone(g, '日') && !stone(g, '月') && seen(g, 'forge').some(e => e.op === '⿰' && e.a === '日' && e.b === '月'), '月 set on the screen-right of 日 makes 明 (日 ⿰ 月)');
  take(g, d, ming);
  d.go('a', 6.5, 2.5); d.go('a', 1.6, 2.5);
});

// ---------- stage 3: 水 douses the flames, 人 + 木 = 休, the stone rides the lift ----------
solo(2, 'Lean on a Tree', (g, d) => {
  evs.length = 0;
  const flames = g.movers[1];
  d.go('a', 8.5, 4.5); d.go('a', 4.4, 4.5); d.go('a', 4.4, 5.5); d.grab('a');
  check(d.P('a').hold.ch === '水', 'picked up 水');
  d.go('a', 4.4, 4.5); d.go('a', 9.2, 4.5); d.wait(1.2);
  check(flames.done && flames.top === 1 && seen(g, 'douse').length === 1, '水 douses the wall of flames');
  d.go('a', 9.4, 6.5); d.go('a', 11.7, 5.5);
  check(d.P('a').x > 11 && d.P('a').hold.ch === '水', 'the way through is open, still carrying 水');
  d.go('a', 12.5, 4.6); d.go('a', 13.2, 4.6); d.grab('a'); d.wait(0.6);
  d.go('a', 11.7, 5.5); d.grab('a');
  check(d.P('a').hold.ch === '人', 'picked up 人 from behind the flames');
  // 木 sits at the island's edge (nothing on its screen-left): set 人 down, then bring 木 to 人's right
  d.go('a', 9.4, 6.5); d.go('a', 7.5, 4.5); d.go('a', 5.0, 4.4); d.go('a', 5.0, 4.76);   // facing +z: SET DOWN, clear of the crate and the 2-high block
  d.grab('a'); d.wait(1);
  const ren = stone(g, '人');
  d.go('a', 4.3, 6.5); d.grab('a');
  check(d.P('a').hold && d.P('a').hold.ch === '木', 'picked up 木');
  d.set('a', ren, 'right');
  dump(g, 'xiu');
  const xiu = stone(g, '休');
  check(!!xiu && seen(g, 'forge').some(e => e.a === '人' && e.b === '木'), '木 set on the screen-right of 人 makes 休 (人 ⿰ 木)');
  check(xiu.state === 'loose', 'a new character pops up and lands; nobody catches it by accident');
  take(g, d, xiu);
  d.go('a', 4.5, 5.0); d.go('a', 4.5, 4.45);
  d.grab('a'); d.wait(0.8);
  check(xiu.state === 'loose' && xiu.z < 4 && xiu.z > 2, 'standing still, the button sets the stone down just ahead, on the lift');
  d.go('a', 4.5, 5.5); d.go('a', 5.5, 5.5);
  d.hold('a', 1, 0, () => g.crates[0].x >= 8.45);
  d.wait(2.4);
  check(g.movers[0].top === 4 && Math.abs(xiu.y - 4) < 0.01, 'the lift carries the stone up to height 4');
  d.go('a', 6.5, 4.5);
  d.hop('a', 6.5, 3.5); d.hop('a', 6.5, 2.5); d.hop('a', 6.5, 1.5);
  d.go('a', 4.6, 1.5); d.go('a', 4.6, 2.5); d.grab('a');
  d.go('a', 3.5, 2.5); d.go('a', 1.6, 2.5);
});

// ---------- co-op and safety rules ----------
{
  const g = new Game(); g.addPlayer('a', 'A'); g.addPlayer('b', 'B'); g.loadStage(0);
  const d = driver(g);
  d.go('a', 10.3, 1.5); d.grab('a');
  d.go('b', 12.5, 1.5);
  d.go('a', 10.5, 1.5); d.go('a', 10.8, 1.5);
  check(g.snapshot().aim.a[3] === 'pass', 'facing a friend, the throw becomes a pass');
  { const o = g.stones[1], p = d.P('a'); const keep = [o.x, o.z]; o.x = p.x + 1; o.z = p.z; check(g.snapshot().aim.a[3] === 'join', 'but a stone right in front wins: the button joins the two instead'); o.x = keep[0]; o.z = keep[1]; }
  d.grab('a'); d.wait(0.9);
  check(d.P('b').hold && d.P('b').hold.ch === '木', 'and the friend catches it');
  check(g.snapshot().k.length === 2 && g.snapshot().k.some(k => k[6] === 'b'), 'the snapshot lists every stone and who holds it');
  // the wrong character does not open the shrine
  const k = d.P('b').hold; g.dropStone(d.P('b')); k.x = 1.5; k.z = 2.5; k.y = 1; d.wait(0.5);
  check(g.phase === 'play', 'the shrine ignores a character it is not waiting for');
  g.removePlayer('a'); g.removePlayer('b'); d.wait(0.2);
  check(g.stones.every(s => !s.holder), 'a wobbler who leaves lets go of their stone');
}
// ---------- 轻功: one leap in mid-air, on a cooldown ----------
{
  const g = new Game(); g.addPlayer('a', 'A'); g.loadStage(0);
  const d = driver(g); d.wait(2.8);
  d.go('a', 8.5, 2.5);
  // a plain running jump does not clear the 3-wide gap
  d.hold('a', -1, 0, () => d.P('a').x < 7.25, 5); g.setInput('a', -1, 0); g.act('a', 'jump');
  let fell = false; for (let i = 0; i < 150; i++) { d.tick(); if (g.drainEvents().some(e => e.t === 'respawn')) fell = true; }
  d.stop('a');
  check(fell && d.P('a').x > 7, 'a plain jump does not cross a 3-wide gap');
  d.wait(0.3); d.go('a', 8.5, 2.5);
  d.hold('a', -1, 0, () => d.P('a').x < 7.25, 5); g.setInput('a', -1, 0); g.act('a', 'jump');
  d.tick(15); g.act('a', 'jump');
  let leapt = false, top = 0; fell = false;
  for (let i = 0; i < 150 && !(d.P('a').grounded && d.P('a').x < 4); i++) { d.tick(); top = Math.max(top, d.P('a').y); for (const e of g.drainEvents()) { if (e.t === 'leap') leapt = true; if (e.t === 'respawn') fell = true; } }
  d.stop('a');
  check(leapt && !fell && d.P('a').x < 4 && d.P('a').grounded, '轻功: a second jump in mid-air carries a wobbler over the 3-wide gap');
  check(top > 2.4 && top < 3.4, '轻功 lifts about one more step, not over a 3-high wall (peak ' + top.toFixed(2) + ')');
  check(!(g.snapshot().p[0][5] & 8), 'the 气 is spent: the snapshot says so');
  g.act('a', 'jump'); d.tick(12); g.act('a', 'jump'); d.tick(3);
  check(d.P('a').vy < 2, 'no second 轻功 while the 气 gathers');
  d.wait(4.2);
  check(g.snapshot().p[0][5] & 8, 'the 气 is back after four seconds');
  // empty hands only
  const k = g.stones[0]; k.x = d.P('a').x + 0.5; k.z = d.P('a').z; d.wait(0.1); d.grab('a');
  g.act('a', 'jump'); d.tick(12); g.act('a', 'jump'); d.tick(3);
  check(d.P('a').hold && d.P('a').vy < 2 && g.snapshot().p[0][5] & 8, 'a carrier jumps but cannot use 轻功 (no double jump with a stone)');
}
// thorns and flames cannot be leapt over
{
  const g = new Game(); g.addPlayer('a', 'A'); g.loadStage(1);
  const d = driver(g); d.wait(2.8);
  d.go('a', 11.2, 2.5);
  g.setInput('a', -1, 0); g.act('a', 'jump'); d.tick(15); g.act('a', 'jump'); d.tick(120); d.stop('a');
  check(d.P('a').x > 10 && !g.movers[0].done, 'no leap clears a thorn hedge: it wants 火');
}
// ---------- many ways through: row, boost, spring, climb ----------
{
  // stage 1 with no bridge at all: make 林, carry it aboard, row round to the pavilion's isle
  const g = new Game(); g.addPlayer('a', 'A'); g.loadStage(0);
  const d = driver(g); d.wait(2.8);
  const b = g.boat;
  d.go('a', 10.3, 1.5); d.grab('a'); d.set('a', g.stones.find(k => k.ch === '木' && k.state === 'loose'), 'right');
  take(g, d, stone(g, '林'));
  d.go('a', 12.5, 2.5); d.go('a', 15.5, 2.5);
  check(g.onDeck(d.P('a')) && d.P('a').hold.ch === '林', 'a carrier walks back onto the moored boat');
  d.hold('a', 1, 0, () => b.x0 > 14.3, 4);
  check(g.onDeck(d.P('a')) && d.P('a').grounded && b.x0 > 14.2, 'walking into the rail does not walk overboard: it pushes the boat');
  d.hold('a', 0, -1, () => b.z0 < -2.2, 12);
  d.hold('a', -1, 0, () => b.x0 < 3.4, 20);
  d.wait(1.2);
  const xs = b.x0;
  d.hold('a', 0, 1, () => b.vz === 0 && d.P('a').z > b.z1 - 0.3 && b.z0 > -2.2, 12);
    check(b.z1 <= 1.03 && b.z1 > 0.9 && b.x0 < 4, 'rowed round the isle, the boat stops against the rock (at ' + b.x0.toFixed(1) + ', ' + b.z0.toFixed(1) + ')');
  check(g.bridges.length === 0 && d.P('a').hold && d.P('a').y === 1, 'the stone came along, the carrier steps ashore where deck meets land, and no bridge was grown');
  d.go('a', Math.min(3.5, d.P('a').x), 1.6); d.go('a', 1.6, 2.5); d.wait(0.2);
  check(g.phase === 'won', 'stage 1 solved by boat alone: 林 delivered without 木 ever touching the gap');
  check(seen(g, 'row').length > 2, 'rowing is announced');
}
{
  // the boat parked in the gap is a bridge
  const g = new Game(); g.addPlayer('a', 'A'); g.loadStage(0);
  const d = driver(g); d.wait(2.8);
  const b = g.boat;
  check(!g.boatFits(13.5, 1) && !g.boatFits(3.5, 1) && g.boatFits(4, 1) && g.boatFits(4, -2), 'the boat fits only in open water (it does fit the 3-wide gap)');
  b.x0 = 4; b.x1 = 7; b.z0 = 1; b.z1 = 4; d.wait(0.1);
  d.go('a', 8.5, 2.5); d.go('a', 2.5, 2.5);
  check(d.P('a').x < 3 && d.P('a').y === 1, 'parked in the gap, its deck is walked straight across');
}
{
  // BOOST: empty hands fling a friend, stone and all, over the 3-wide gap
  const g = new Game(); g.addPlayer('a', 'A'); g.addPlayer('b', 'B'); g.loadStage(0);
  const d = driver(g); d.wait(2.8);
  d.go('b', 10.3, 1.5); d.grab('b');
  d.go('b', 7.35, 2.5); d.go('a', 8.6, 2.5); d.go('a', 8.1, 2.5);
  check(g.snapshot().p[0][5] & 16, 'facing a friend with empty hands, the snapshot offers BOOST');
  evs.length = 0; g.drainEvents();
  d.grab('a'); d.wait(1.2);
  check(seen(g, 'boost').length === 1 && d.P('b').x < 4 && d.P('b').grounded && d.P('b').hold && d.P('b').y === 1, 'BOOST throws a carrier across the gap with the stone still in hand (landed at x ' + d.P('b').x.toFixed(2) + ')');
  check(g.bridges.length === 0, 'so the gap is crossed with no bridge');
}
{
  // thorns are a real wall now: too tall alone, not too tall off a friend's head
  const g = new Game(); g.addPlayer('a', 'A'); g.addPlayer('b', 'B'); g.loadStage(1);
  const d = driver(g); d.wait(2.8);
  const hedge = g.movers[0];
  d.go('b', 11.0, 2.5);
  d.go('a', 12.2, 2.5); d.hold('a', -1, 0, () => d.P('a').x < 11.75, 3);
  g.setInput('a', -1, 0); g.act('a', 'jump'); d.tick(4); d.hold('a', -1, 0, () => d.P('a').grounded, 2);
  check(d.P('a').support === d.P('b') && Math.abs(d.P('a').y - 2) < 0.01, 'a friend\'s head is a step');
  evs.length = 0; g.drainEvents();
  g.setInput('a', -1, 0); g.act('a', 'jump'); d.tick(14); g.act('a', 'jump');
  let over = false; for (let i = 0; i < 200 && !over; i++) { d.tick(); over = d.P('a').grounded && d.P('a').x < 9; }
  d.stop('a');
  check(over && !hedge.done, 'from a friend\'s head, jump + leap clears the thorn hedge without 火 (x ' + d.P('a').x.toFixed(2) + ')');
  // and jumping with a rider on your head springs them
  d.go('a', 7.5, 2.5); g.addPlayer('c', 'C');
  const c = d.P('c'); c.x = d.P('a').x; c.z = d.P('a').z; c.y = d.P('a').y + 1.05; c.grounded = false; d.wait(0.3);
  check(c.support === d.P('a'), 'a third wobbler stands on the first');
  g.act('a', 'jump'); let top = 0; for (let i = 0; i < 60; i++) { d.tick(); top = Math.max(top, c.y); }
  check(top > 3.3 && seen(g, 'spring').length === 1, 'jumping springs whoever is on your head (peak ' + top.toFixed(2) + ')');
}
// ---------- 同舟: arrive by boat, and leave by boat once the shrine has answered ----------
{
  const g = new Game(); g.addPlayer('a', 'A'); g.addPlayer('b', 'B'); g.loadStage(0);
  const d = driver(g);
  const b = g.boat;
  check(b.st === 'in' && g.onDeck(d.P('a')) && g.onDeck(d.P('b')) && b.z0 > 8, 'a stage starts with everyone on the boat, out on the river');
  d.wait(2.8);
  check(b.st === 'moored' && b.z0 === 1 && g.onDeck(d.P('a')) && g.onDeck(d.P('b')), 'the boat carries them in and moors at the landing');
  d.go('a', 12.5, 2.5);
  check(d.P('a').y === 1 && !g.onDeck(d.P('a')) && d.P('a').safe[0] < 14, 'they step straight off the deck onto the isle');
  // hand the shrine its 林
  g.dropStone(d.P('a')); const k = g.stones[0]; k.ch = '林'; k.x = 1.5; k.z = 2.5; k.y = 1; d.wait(0.3);
  check(g.phase === 'won', 'the shrine answers');
  d.wait(5);
  check(g.phase === 'won' && g.stage === 0 && g.snapshot().res.on === 1 && g.snapshot().res.need === 2, 'the boat waits while someone is still ashore');
  // a stone set on the deck rides along
  const cargo = g.stones.find(s => s.ch === '木'); cargo.x = 15; cargo.z = 3.9; cargo.y = 1; cargo.grounded = true;
  d.go('a', 13.5, 2.5); d.go('a', 15, 2.5); d.tick(3);
  check(g.phase === 'sail' && b.st === 'out', 'everyone aboard: the boat casts off');
  d.wait(1.5);
  check(g.onDeck(d.P('a')) && g.onDeck(d.P('b')) && b.z0 < -1 && Math.abs(cargo.z - b.z0 - 2.9) < 0.05, 'it carries the crew (and a stone left on deck) away');
  d.wait(2.2);
  check(g.stage === 1 && g.phase === 'play' && g.boat.st === 'in' && g.onDeck(d.P('a')), 'and sails them into the next stage');
}
{
  // nobody is made to wait for a straggler for ever
  const g = new Game(); g.addPlayer('a', 'A'); g.addPlayer('b', 'B'); g.loadStage(0);
  const d = driver(g); d.wait(2.8);
  d.go('b', 12.5, 2.5);
  const k = g.stones[0]; k.ch = '林'; k.x = 1.5; k.z = 2.5; k.y = 1; d.wait(0.3);
  d.wait(11); check(g.phase === 'won' && g.snapshot().res.go <= 2, 'once one is aboard the others get a countdown');
  d.wait(1.5); check(g.phase === 'sail', 'then the boat leaves without the straggler');
  d.wait(3.6); check(g.stage === 1 && g.onDeck(d.P('b')), 'who is on the boat again at the next isle anyway');
  g.removePlayer('a'); g.removePlayer('b'); g.loadStage(0); d.wait(0.1);
  check(g.boat.st === 'moored', 'with nobody playing the boat just lies moored');
}
{
  // every recipe produces a character that exists
  const LV = require('./levels.js');
  const bad = LV.RECIPE_LIST.filter(r => !LV.OPS.includes(r[0]) || ![r[1], ...(r[0] === '⿱⿰' ? [...r[2]] : [r[2]]), r[3]].every(c => LV.GLYPHS[c]));
  check(bad.length === 0 && LV.RECIPE_LIST.length >= 14, 'every recipe is [op, first, second, result] over known characters');
  check(LV.fuse('⿰', '日', '月') === '明' && LV.fuse('⿰', '月', '日') === null && LV.fuse('⿱', '日', '月') === null, 'order and op matter: 日 left of 月 is 明; 月 left of 日 and 日 on 月 are nothing');
  check(LV.fuse('⿱', '林', '火') === '焚' && LV.fuse('⿱', '火', '林') === null, '焚 is 林 on top of 火, not the other way');
  let threw = false; try { LV.fuse('日', '月'); } catch (e) { threw = true; }
  check(threw, 'the old two-argument fuse is gone: calling it throws');
  check(LV.mirrors('月', '日').length === 1 && LV.mirrors('日', '日')[0][3] === '昌' && LV.mirrors('日', '木').map(r => r[3]).sort().join('') === '杲杳' && LV.mirrors('女', '木').length === 0, 'mirrors() finds a pair in any order and op (日 木: 杲 and 杳)');
  check(LV.form('水', '⿰', 1) === '氵' && LV.form('水', '⿰', 2) === '水' && LV.form('水', '⿱', 1) === '水' && LV.form('木', '⿰', 1) === '木', 'variant forms: 水 draws as 氵 only on the left of ⿰');
  check(LV.LEVELS.every(L => LV.GLYPHS[L.want]), 'every shrine waits for a known character');
  check(checkRecipes(LV.RECIPE_LIST).length === 0, 'every recipe matches its MMAH dictionary IDS (variants and aliases normalised)');
  const wrong = checkRecipes([['⿰', '月', '日', '明'], ['⿱', '木', '木', '林']]);
  check(wrong.length === 2 && wrong[0].includes('⿰日月'), 'a wrong order or op is caught, and the message gives the dictionary IDS');
  check(pairs('日木').some(([k, l]) => k === '日木' && l.map(e => e.ch).sort().join('') === '杲杳'), '--pairs finds the minimal pair 杲 / 杳 from 日 and 木');
}
console.log(failed ? `--- ${failed} CHECK(S) FAILED ---` : '--- ALL SIM CHECKS PASSED ---');
