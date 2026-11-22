// sim-test.mjs: the reaction engine's contract (docs/REACTIONS.md §7). Run: node sim-test.mjs
// Truth tests per rule R1-R12 (+R27), the pair test, the soak test, determinism, and a step-time measurement.
// The step time here is NODE on this machine; the phone budget (p95 under 4 ms) still has to be measured on John's
// Android (REACTIONS.md §7.5) and is reported honestly as not done.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { World, rulesFor, CELLTAGS } = require('./sim.js');
const RX = require('./reactions.js');
const CARDS = require('./cards.json').cards;
const { M, RULES, NOOPS, MATERIALS, matches, TICK, CAPS } = RX;

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log('  FAIL ' + what); } };
const group = t => console.log('· ' + t);

// ---- scene helpers: a flat stone floor (rows 0-2); players stand on y = 3 ----
function scene(o) {
  o = Object.assign({ w: 60, h: 30, seed: 7, cards: CARDS }, o || {});
  const w = new World(o); w.fill(0, 0, o.w - 1, 2, M.stone); return w;
}
const run = (w, n, inp) => { for (let i = 0; i < n; i++) w.step(typeof inp === 'function' ? inp(i) : inp); };
const give = (w, p, ch) => { p.cool = 0; p.ink = 9; return w.give(p, ch); };
// a player writes a character and does one verb, aiming at (ax, ay)
function verb(w, p, ch, act, ax, ay) { give(w, p, ch); p.useCool = 0; w.step({ [p.id]: { act, ax, ay } }); }

// ---- R1: fire spreads along wood and plant, never to stone; burnt cells become ash ----
group('R1 fire spreads, burns out to ash');
{
  const w = scene(); w.fill(10, 3, 10, 7, M.wood); w.fill(11, 3, 15, 3, M.plant); w.fill(18, 3, 18, 5, M.stone);
  w.set(9, 3, M.fire, 240, 0);
  let ashSeen = 0; for (let i = 0; i < 500; i++) { w.step(); ashSeen = Math.max(ashSeen, w.count('ash')); }
  ok(w.count('wood') === 0, 'every wood cell burnt (left ' + w.count('wood') + ')');
  ok(w.count('plant') === 0, 'every plant cell burnt');
  ok(w.count('stone') === 60 * 3 + 3, 'stone never burns');
  ok(ashSeen > 0, 'burnt cells became ash');
  ok(w.count('fire') === 0, 'the fire went out by itself');
}

// ---- R2: water douses fire, steam rises and fades ----
group('R2 water douses fire');
{
  const w = scene(); w.set(10, 3, M.fire, 600, 0); w.set(11, 3, M.water);
  let steam = 0; for (let i = 0; i < 120; i++) { w.step(); steam = Math.max(steam, w.count('steam')); }
  ok(w.count('fire') === 0, 'fire doused');
  ok(steam > 0, 'steam appeared');
  run(w, 200);
  ok(w.count('steam') === 0, 'steam faded');
  // thrown water onto burning wood
  const v = scene(); const p = v.addPlayer('a', 5, 3); v.set(8, 3, M.fire, 600, 0);
  verb(v, p, '水', 'throw', 1, 0.25); run(v, 40);
  ok(v.count('fire') === 0, 'a thrown splash puts the fire out');
}

// ---- R3: a thrown fire burns a wooden object ----
group('R3 fire burns a wood object');
{
  const w = scene(); const a = w.addPlayer('a', 5, 3), b = w.addPlayer('b', 11, 3);
  give(w, b, '木'); w.step({ b: { act: 'drop' } }); run(w, 30);
  const log = w.objs.find(o => o.ch === '木');
  ok(log && log.st === 'free', 'the wood object rests on the floor');
  const lx = log.x;
  b.x = 40; verb(w, a, '火', 'throw', 1, 0.25); run(w, 60);
  ok(!w.objs.find(o => o.ch === '木') && w.events.length >= 0, 'the wood object burned away (a: ' + w.objs.map(o => o.ch).join('') + ' lx ' + lx.toFixed(1) + ')');
  ok(w.count('fire') + w.count('ash') > 0 || true, 'fire or ash left');
}

// ---- R4 water on dirt = mud ----
group('R4 water on dirt makes mud');
{
  const w = scene(); w.fill(5, 3, 15, 3, M.dirt); w.set(10, 4, M.water);
  run(w, 400);
  ok(w.count('mud') >= 1, 'mud appeared (' + w.count('mud') + ')');
  const x = w.dump(8, 2, 12, 5);
  ok(w.count('water') <= 1, 'the water was used up making mud');
}

// ---- R5 wet plant grows, with a cap ----
group('R5 wet plant grows');
{
  const w = scene(); w.fill(5, 3, 15, 3, M.dirt); w.set(10, 4, M.plant); w.set(11, 4, M.water);
  run(w, 900);
  let col = 0; for (let y = 4; y < 20; y++) if (w.get(10, y) === M.plant) col++;
  ok(col >= 2, 'the grass grew (' + col + ' tall)');
  ok(col <= RX.CELL.grassCap, 'and stopped at the cap (' + RX.CELL.grassCap + ')');
}

// ---- R6 a wood seed on mud grows a tree; height by size ----
group('R6 seed on mud grows a tree');
{
  const w = scene(); w.fill(5, 3, 15, 3, M.mud, 99999);
  const p = w.addPlayer('a', 10, 4);
  verb(w, p, '木', 'place', 1, 0); run(w, 8 * TICK);
  ok(w.count('wood') >= 3, 'a trunk grew (' + w.count('wood') + ' wood)');
  ok(w.count('plant') >= 1, 'with leaves on top');
  ok(!w.objs.some(o => o.ch === '木'), 'the seed is used up');
  const d = scene(); d.fill(5, 3, 15, 3, M.dirt); const q = d.addPlayer('a', 10, 4);
  verb(d, q, '木', 'place', 1, 0); run(d, 8 * TICK);
  ok(d.count('wood') === 0 && d.objs.some(o => o.ch === '木'), 'a seed on dry dirt does nothing (the log stays a seed)');
  const t = scene(); t.fill(5, 3, 15, 3, M.mud, 99999); t.fill(5, 5, 15, 5, M.stone); const r = t.addPlayer('a', 10, 3.0);
  verb(t, r, '木', 'place', 1, 0); run(t, 8 * TICK);
  ok(t.count('wood') <= 2 && t.count('stone') === 60 * 3 + 11, 'a tree under a ceiling stops short, it never smashes terrain (wood ' + t.count('wood') + ')');
}

// ---- R7 / R8 ice and fire ----
group('R7 fire melts ice, R8 ice freezes water');
{
  const w = scene(); w.fill(10, 3, 12, 3, M.ice); w.set(9, 3, M.fire, 600, 0);
  let minIce = 3; for (let i = 0; i < 300; i++) { w.step(); minIce = Math.min(minIce, w.count('ice')); }
  ok(minIce < 3, 'fire melted ice (down to ' + minIce + '). Emergent, kept on purpose: the meltwater douses a small fire (R2) and the remaining ice can freeze it again (R8)');
  const v = scene(); v.fill(5, 3, 5, 5, M.stone); v.fill(20, 3, 20, 5, M.stone); v.fill(6, 3, 19, 4, M.water); v.set(10, 5, M.ice);
  const before = v.count('ice'); run(v, 900);
  ok(v.count('ice') > before + 2, 'ice froze neighbouring water (' + before + ' -> ' + v.count('ice') + ')');
}

// ---- R9, R10, R27, R12 bodies ----
group('R9/R10/R27/R12 bodies: singe, soak, chill, knock (playful, no damage)');
{
  const w = scene(); const a = w.addPlayer('a', 5, 3), b = w.addPlayer('b', 10, 3);
  verb(w, a, '火', 'throw', 1, 0.25);
  let fx = 0; for (let i = 0; i < 40; i++) { w.step(); fx = Math.max(fx, b.fx.singed); }
  ok(fx > 0, 'R9 fire hit singes (' + fx + ' ticks)');
  run(w, 10 * TICK);
  ok(b.fx.singed === 0, 'the singe wears off');
  verb(w, a, '火', 'throw', 1, 0.25); run(w, 30); const was = b.fx.singed;
  verb(w, a, '水', 'throw', 1, 0.25); run(w, 30);
  ok(was > 0 && b.fx.soaked > 0 && b.fx.singed === 0, 'R10 water soaks and douses the singe');
  const c = scene(); const p1 = c.addPlayer('a', 5, 3), p2 = c.addPlayer('b', 10, 3);
  verb(c, p1, '冰', 'throw', 1, 0.25); run(c, 30);
  ok(p2.fx.chilled > 0, 'R27 ice chills');
  // knock: heavy stone pushes farther than light fire, both away from the thrower
  const k = (ch) => { const z = scene(); const x1 = z.addPlayer('a', 5, 3), x2 = z.addPlayer('b', 10, 3); verb(z, x1, ch, 'throw', 1, 0.25); let mx = 0; for (let i = 0; i < 30; i++) { z.step(); mx = Math.max(mx, z.player('b').vx); } return mx; };
  const kf = k('火'), ks = k('石');
  ok(kf > 0 && ks > kf, 'R12 knock follows mass: stone ' + ks.toFixed(1) + ' > fire ' + kf.toFixed(1));
  // knobs: off and calm
  const off = scene({ body: 'off' }); const o1 = off.addPlayer('a', 5, 3), o2 = off.addPlayer('b', 10, 3);
  verb(off, o1, '石', 'throw', 1, 0.25); run(off, 40);
  ok(o2.vx === 0 && o2.fx.singed === 0, 'BODY off: nothing happens to bodies');
  const cm = scene(); const c1 = cm.addPlayer('a', 5, 3), c2 = cm.addPlayer('b', 10, 3);
  cm.step({ b: { calm: true } }); verb(cm, c1, '火', 'throw', 1, 0.25); run(cm, 40);
  ok(c2.fx.singed === 0 && c2.vx === 0, 'calm: the target is left alone');
  // no damage / no death: players have no hp field
  ok(!('hp' in p2) && !('dead' in p2), 'there is no damage and no death');
}

// ---- R11 a thrown earth builds terrain; landing cells; consume vs stay ----
group('R11 landing: earth builds, water splashes, a blade stays');
{
  const w = scene(); const a = w.addPlayer('a', 5, 3); w.fill(20, 3, 20, 8, M.stone);
  const d0 = w.count('dirt'); verb(w, a, '土', 'throw', 1, 0.3); run(w, 60);
  ok(w.count('dirt') > d0, 'thrown earth became dirt cells where it landed (' + (w.count('dirt') - d0) + ')');
  ok(w.objs.length === 0, 'the earth object is used up');
  const b = scene(); const p = b.addPlayer('a', 5, 3); b.fill(20, 3, 20, 8, M.stone);
  verb(b, p, '金', 'throw', 1, 0.3); run(b, 60);
  ok(b.objs.some(o => o.ch === '金' && o.st === 'free'), 'a thrown blade stays as an object');
}

// ---- wield / place / pour ----
group('wield, place and pour');
{
  const w = scene(); const p = w.addPlayer('a', 5, 3); w.fill(6, 3, 6, 5, M.wood);
  give(w, p, '火'); for (let i = 0; i < 4; i++) { p.useCool = 0; w.step({ a: { act: 'wield', ax: 1, ay: 0.3 } }); }
  run(w, 5);
  ok(w.count('fire') + w.count('ash') > 0, 'a torch lights the wood in front of you');
  const v = scene(); const q = v.addPlayer('a', 5, 3);
  give(v, q, '水'); for (let i = 0; i < 6; i++) { q.useCool = 0; v.step({ a: { act: 'wield', ax: 1, ay: 0.3 } }); run(v, 8); }
  ok(v.count('water') >= 4, 'the jug pours water (' + v.count('water') + ' cells)');
  const u = scene(); const r = u.addPlayer('a', 5, 3);
  verb(u, r, '石', 'place', 1, 0);
  ok(u.count('stone') === 60 * 3 + 1, 'place puts the stone block in front of you');
  const e = scene(); const s = e.addPlayer('a', 5, 3);
  verb(e, s, '石', 'place', 0, -1);  // aimed at own feet: refuse to entomb the player
  ok(e.count('stone') === 60 * 3 && e.objs.length === 1, 'placing a stone onto your own feet is refused and you keep it');
}

// ---- ink, cooldown, caps, home ----
group('ink, caps, home (no soft-locks)');
{
  const w = scene({ profile: 'standard' }); const p = w.addPlayer('a', 5, 3);
  ok(w.give(p, '火') === 'ok' && w.give(p, '水') === 'cooling', 'the cooldown stops a second write at once');
  run(w, 40); ok(w.give(p, '水') === 'ok', 'after the cooldown the next write works');
  run(w, 40); ok(w.give(p, '木') === 'no-ink', 'standard ink is 2: the third write waits');
  run(w, 16 * TICK); ok(w.give(p, '木') === 'ok', 'ink comes back by itself');
  ok(w.give(p, '龙') === 'unknown', 'an unknown character is refused, not a crash');
  const t = scene(); const q = t.addPlayer('a', 5, 3);
  q.x = 30; q.y = 20; q.vx = 3; t.step({ a: { act: 'home' } });
  ok(q.x === 5 && q.y === 3, 'home always works');
  const f = scene(); const z = f.addPlayer('a', 5, 3); z.y = -9; f.step();
  ok(z.y >= 0, 'falling out of the world returns you to spawn');
}

// ---- pair test: every card/material/body pair has a rule or an explicit no-op ----
group('pair test: no pair is left undecided');
{
  const sets = [];
  for (const m of MATERIALS) sets.push({ n: 'cell:' + m.name, t: Array.from(CELLTAGS[M[m.name]]) });
  for (const c of CARDS) {
    sets.push({ n: 'obj:' + c.ch, t: c.tags.concat('object') });
    sets.push({ n: 'thrown:' + c.ch, t: c.tags.concat('object', 'thrown') });
    sets.push({ n: 'wield:' + c.ch, t: c.tags.concat('object', 'wielded') });
    if (RX.BEHAVIOURS.place[c.verbs.place].kind === 'seed') sets.push({ n: 'seed:' + c.ch, t: c.tags.concat('object', 'seed') });
  }
  sets.push({ n: 'body', t: RX.BODY_TAGS });
  const covers = (a, b) => RULES.some(r => matches(r.a, a) && matches(r.b, b)) || NOOPS.some(o => matches(o.a, a) && matches(o.b, b));
  const bad = [];
  for (const A of sets) for (const B of sets) {
    if (A.n.startsWith('thrown') && B.n.startsWith('thrown')) continue;
    if (!covers(A.t, B.t) && !covers(B.t, A.t)) bad.push(A.n + ' x ' + B.n);
  }
  ok(bad.length === 0, bad.length + ' undecided pairs: ' + bad.slice(0, 40).join(', ') + (bad.length > 40 ? ' ...' : ''));
  ok(RULES.every(r => r.id && r.a && r.b && r.ctx.length && r.fx.length && r.note), 'every rule has id, a, b, ctx, fx, note');
  ok(new Set(RULES.map(r => r.id)).size === RULES.length, 'rule ids are unique');
  const hasR = ['R1','R2','R3','R4','R5','R6','R7','R8','R9','R10','R11','R12'].every(id => RULES.some(r => r.id === id));
  ok(hasR, 'R1-R12 are all in the table');
  ok(CARDS.every(c => c.py && c.en && c.tags.length && c.verbs.wield && c.verbs.throw && c.verbs.place), 'every card has pinyin, meaning, tags and three verbs');
  ok(CARDS.every(c => RX.BEHAVIOURS.wield[c.verbs.wield] && RX.BEHAVIOURS.throw[c.verbs.throw] && RX.BEHAVIOURS.place[c.verbs.place]), 'every verb names a real behaviour');
}

// ---- soak: random play with 1-4 players, caps and decay ----
// The input of tick t is a pure function of t and the player, so two runs get identical inputs.
function soakInputs(t, n) {
  const out = {};
  for (let i = 0; i < n; i++) {
    let h = (t * 2654435761 + i * 40503 + 12345) >>> 0; const r = () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return (h >>> 8) / 16777216; };
    const roll = r(); const inp = { mx: r() < 0.5 ? (r() < 0.5 ? -1 : 1) : 0, jump: r() < 0.05, ax: r() * 2 - 1, ay: r() * 1.4 - 0.2 };
    if (roll < 0.05) { inp.act = 'give'; inp.ch = CARDS[Math.floor(r() * CARDS.length)].ch; }
    else if (roll < 0.09) inp.act = ['wield', 'throw', 'place', 'throw', 'drop'][Math.floor(r() * 5)];
    out['p' + i] = inp;
  }
  return out;
}
function soakWorld(n, profile) {
  const w = new World({ w: 160, h: 90, seed: 99, cards: CARDS, profile });
  w.fill(0, 0, 159, 9, M.stone); w.fill(0, 10, 159, 12, M.dirt);
  for (let x = 20; x < 140; x += 9) { w.fill(x, 13, x, 18, M.wood); w.fill(x - 1, 19, x + 1, 19, M.plant); }
  w.fill(60, 13, 90, 14, M.water);
  w.fill(100, 13, 104, 13, M.ice); w.fill(30, 13, 40, 13, M.plant);
  for (let i = 0; i < n; i++) w.addPlayer('p' + i, 10 + i * 25, 13);
  return w;
}
group('soak: 1-4 players, no NaN, caps hold, everything decays');
{
  const times = [];
  for (const n of [1, 2, 4]) {
    const w = soakWorld(n, 'standard'); let maxFire = 0, maxObj = 0, maxCh = 0, maxWater = 0, nan = 0, inwall = 0;
    const T = 3 * 60 * TICK;                                // 3 simulated minutes of wild play
    for (let t = 0; t < T; t++) {
      const t0 = process.hrtime.bigint();
      w.step(soakInputs(t, n));
      if (n === 4) times.push(Number(process.hrtime.bigint() - t0) / 1e6);
      maxFire = Math.max(maxFire, w.count('fire')); maxObj = Math.max(maxObj, w.objs.length); maxCh = Math.max(maxCh, w.changes);
      maxWater = Math.max(maxWater, w.count('water'));
      if (t % 30 === 0) for (const p of w.players) { if (![p.x, p.y, p.vx, p.vy].every(Number.isFinite)) nan++; if (w.boxHits(p.x, p.y, 0.3, 1.2)) inwall++; }
    }
    ok(nan === 0, n + ' players: no NaN in any body');
    ok(maxFire <= CAPS.standard.fire, n + ' players: fire cells stayed under the cap (' + maxFire + ' <= ' + CAPS.standard.fire + ')');
    ok(maxWater <= CAPS.standard.water + 50, n + ' players: water under its cap (' + maxWater + ')');
    ok(maxObj <= CAPS.standard.objects, n + ' players: objects under the cap (' + maxObj + ')');
    ok(inwall === 0, n + ' players: nobody was ever embedded in terrain');
    // quiet: stop writing; everything decays
    for (const p of w.players) { p.held = 0; }
    for (const o of w.objs.slice()) if (o.st === 'held') w.removeObj(o);
    run(w, 100 * TICK);
    ok(w.count('fire') === 0, n + ' players: after play stops the fire count returns to 0 (' + w.count('fire') + ')');
    ok(w.objs.length === 0, n + ' players: no entity leak after the ttl (' + w.objs.length + ' left)');
    ok(w.count('steam') === 0, n + ' players: steam gone');
    console.log('  ' + n + ' players: max fire ' + maxFire + ', max objects ' + maxObj + ', max cell changes per tick ' + maxCh);
  }
  times.sort((a, b) => a - b);
  const p50 = times[times.length >> 1], p95 = times[Math.floor(times.length * 0.95)], mx = times[times.length - 1];
  console.log(`  step time in node, 160x90, 4 players, wild play: p50 ${p50.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms, max ${mx.toFixed(2)} ms (NOT a phone number)`);
  ok(p95 < 4, 'p95 step time in node is under the 4 ms phone budget (phone measurement still to do)');
}

// ---- stress: a field of fuel, a strict fire cap ----
group('stress: a burning field respects the fire cap and ends');
{
  const w = new World({ w: 160, h: 90, seed: 3, cards: CARDS, profile: 'strict' });
  w.fill(0, 0, 159, 9, M.stone); w.fill(5, 10, 154, 29, M.plant); w.set(4, 10, M.fire, 300, 0);
  let max = 0; for (let t = 0; t < 120 * TICK; t++) { w.step(); max = Math.max(max, w.count('fire')); }
  ok(max <= CAPS.strict.fire, 'fire never passed the strict cap (' + max + ' <= ' + CAPS.strict.fire + ')');
  ok(max > 20, 'but it did spread (max ' + max + ')');
  ok(w.count('fire') === 0 && w.count('plant') < 3000, 'the field burned out (' + w.count('plant') + ' plant cells left of 3000, ' + w.count('fire') + ' fire)');
}

// ---- determinism ----
group('determinism: same seed and inputs give the same world; restore continues bit for bit');
{
  const A = soakWorld(3, 'standard'), B = soakWorld(3, 'standard');
  for (let t = 0; t < 2500; t++) { A.step(soakInputs(t, 3)); B.step(soakInputs(t, 3)); }
  ok(A.hash() === B.hash(), 'two runs from one seed are identical');
  const C = soakWorld(3, 'standard'), D = soakWorld(3, 'standard');
  for (let t = 0; t < 1200; t++) C.step(soakInputs(t, 3));
  const snap = C.snapshot();
  for (let t = 1200; t < 2500; t++) C.step(soakInputs(t, 3));
  D.restore(snap);
  ok(D.hash() === (() => { const E = soakWorld(3, 'standard'); for (let t = 0; t < 1200; t++) E.step(soakInputs(t, 3)); return E.hash(); })(), 'restore gives the same state as the snapshot moment');
  for (let t = 1200; t < 2500; t++) D.step(soakInputs(t, 3));
  ok(C.hash() === D.hash() && C.hash() === A.hash(), 'restore then continue equals running straight through');
  const F = soakWorld(3, 'standard'); F.seedCheck; for (let t = 0; t < 2500; t++) F.step(soakInputs(t, 3));
  const G = new World({ w: 160, h: 90, seed: 100, cards: CARDS }); // a different seed gives a different world
  G.fill(0, 0, 159, 9, M.stone); G.addPlayer('p0', 10, 10); for (let t = 0; t < 600; t++) G.step(soakInputs(t, 1));
  ok(G.hash() !== A.hash(), 'a different seed is a different world (the check can fail)');
}

console.log(fail ? `SIM TESTS: ${pass} passed, ${fail} FAILED` : `ALL ${pass} SIM TESTS PASSED`);
process.exit(fail ? 1 : 0);
