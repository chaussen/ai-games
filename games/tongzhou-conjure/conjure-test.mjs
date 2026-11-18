// 同舟 · Glyph Isles — Conjure Prototype Tests
// Tests the conjure wire protocol and sim rules specified in docs/conjure/SPEC.md.
// Run with: node conjure-test.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { connect, sleep } from './tools/wire.mjs';

const require = createRequire(import.meta.url);
const { Game, CONJURE, STONES } = require('./sim.js');
const LV = require('./levels.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3457; // use 3457 to not conflict with smoke-test (3456)
let failed = 0;
const check = (cond, msg) => {
  console.log((cond ? 'PASS ✓ ' : 'FAIL ✗ ') + msg);
  if (!cond) { failed++; process.exitCode = 1; }
};

const DT = 1 / 60;

// =========================================================================
// 1. Sim: every refusal code is reachable, success works, ink regen, cap
// =========================================================================
console.log('\n--- Sim: Refusal codes, ink regen, per-player cap ---');
{
  const testStage = {
    id: 'test-isle', name: 'Test Isle', cn: '试', par: 45, pal: 'dawn', want: '水',
    hint: 'A testing isle for conjure mechanics.',
    map: [
      '1111111111',
      '1111111111',
      '1111111111'
    ],
    spawn: [5.5, 1.5],
    beacon: [1.5, 1.5],
    boat: { rect: [7, 0, 2, 3], from: [0, 5], to: [0, -5] },
    stones: [],
    conjure: ['水'] // 水 does not self-fuse
  };
  const g = new Game([testStage]);
  g.addPlayer('p1', 'Player 1');
  g.loadStage(0);

  // 1.1 phase refusal: set phase to 'won'
  g.phase = 'won';
  let r = g.conjure('p1', '水');
  check(r.ok === false && r.why === 'phase', 'refusal: phase !== "play" returns "phase"');
  g.phase = 'play';

  // 1.2 away refusal: unknown player or afk player
  r = g.conjure('ghost', '水');
  check(r.ok === false && r.why === 'away', 'refusal: unknown player returns "away"');
  g.setAfk('p1', true);
  r = g.conjure('p1', '水');
  check(r.ok === false && r.why === 'away', 'refusal: afk player returns "away"');
  g.setAfk('p1', false);

  // 1.3 unknown refusal: character not in allowed set
  r = g.conjure('p1', '日'); // '日' is not in stage's allowed set
  check(r.ok === false && r.why === 'unknown', 'refusal: character outside stage set returns "unknown"');

  // 1.4 success: conjuring '水'
  const p1 = g.players.get('p1');
  const inkBefore = g.ink;
  r = g.conjure('p1', '水');
  check(r.ok === true && r.stone && r.stone.ch === '水', 'success: conjuring 水 succeeds');
  check(g.ink === inkBefore - 1, 'success: the crew ink pool decreased by 1');
  check(r.stone.conj === true && r.stone.by === 'p1', 'success: stone marked with conj=true and by=p1');
  check(r.stone.pop === true && r.stone.vy === 5 && !r.stone.grounded, 'success: stone pops up with vy=5');
  check(Array.isArray(r.stone.from) && r.stone.from.length === 3, 'success: stone has from position set');
  check(p1.conjCd > 0, 'success: player enters cooldown');

  // 1.5 cooldown refusal: immediate second conjure
  r = g.conjure('p1', '水');
  check(r.ok === false && r.why === 'cooldown', 'refusal: during cooldown returns "cooldown"');

  // Clear cooldown, conjure remaining ink to trigger ink refusal
  p1.conjCd = 0;
  r = g.conjure('p1', '水'); // ink 2 -> 1
  check(r.ok === true, 'second conjure succeeds');
  p1.conjCd = 0;
  r = g.conjure('p1', '水'); // ink 1 -> 0
  check(r.ok === true, 'third conjure succeeds');
  p1.conjCd = 0;

  // 1.6 ink refusal: ink < 1
  r = g.conjure('p1', '水');
  check(r.ok === false && r.why === 'ink', 'refusal: ink < 1 returns "ink"');

  // 1.7 ink regeneration by dt
  const inkStart = g.ink;
  for (let i = 0; i < 60; i++) g.step(DT); // 1 second
  const regenerated = g.ink - inkStart;
  check(Math.abs(regenerated - 1 / CONJURE.regen) < 0.001, `ink regenerates by dt (1 / ${CONJURE.regen} per second)`);

  // 1.8 per-player cap
  g.ink = 3; // grant ink
  p1.conjCd = 0;
  // Currently p1 owns 3 conjured stones alive. Max perPlayer is 3.
  r = g.conjure('p1', '水');
  check(r.ok === false && r.why === 'cap', 'refusal: player at stone cap returns "cap"');

  // Consume one of p1's stones -> should allow conjuring again
  const conjStones = g.stones.filter(s => s.conj && s.by === 'p1');
  check(conjStones.length === 3, 'exactly 3 conjured stones owned by p1');
  g.consume(conjStones[0]);
  r = g.conjure('p1', '水');
  check(r.ok === true, 'after consuming a stone, conjuring is allowed again');
}

// =========================================================================
// 2. Sim: 女 conjured + 子 conjured next to each other fuse into 好
// =========================================================================
console.log('\n--- Sim: shared crew ink, used-up stones ---');
{
  const flat = {
    id: 'ink-isle', name: 'Ink Isle', cn: '墨', par: 45, pal: 'dawn', want: '林',
    hint: 'A testing isle for the shared ink pool.',
    map: ['1111111111', '1111111111', '1111111111'],
    spawn: [5.5, 1.5], beacon: [1.5, 1.5],
    boat: { rect: [7, 0, 2, 3], from: [0, 5], to: [0, -5] },
    stones: [['水', 8.5, 0.5]], conjure: ['水', '木']
  };
  check(STONES.regrow === false, 'stones are used up by default (STONES.regrow is false)');
  const g = new Game([flat]);
  g.addPlayer('a', 'A');
  check(g.inkMax() === CONJURE.ink0 && g.ink === CONJURE.ink0, 'a crew of one has ink0 drops');
  g.addPlayer('b', 'B'); g.addPlayer('c', 'C');
  const three = Math.min(CONJURE.inkCap, CONJURE.ink0 + 2 * CONJURE.inkPerFriend);
  check(g.inkMax() === three && g.ink === three, `the cap grows with the crew, and friends who join before anyone moves fill the pool (${three} for three)`);
  for (let i = 0; i < 20; i++) g.addPlayer('x' + i, 'X');
  check(g.inkMax() === CONJURE.inkCap, 'however big the crew, the cap stops at inkCap');
  for (let i = 0; i < 20; i++) g.removePlayer('x' + i);
  g.loadStage(0);
  check(g.ink === three, 'every stage starts with the pool full');
  // the pool is shared: what one player spends, nobody else has
  check(g.conjure('a', '水').ok && g.conjure('b', '水').ok, 'two players conjure from the same pool');
  check(Math.abs(g.ink - (three - 2)) < 1e-9, 'and both drops came out of it');
  g.ink = 0.5;
  check(g.conjure('c', '木').why === 'ink', 'an empty pool refuses everyone (ink)');
  // a late joiner after play has started does not mint ink
  g.started = true; g.ink = 1;
  g.addPlayer('late', 'Late');
  check(g.ink === 1 && g.inkMax() === Math.min(CONJURE.inkCap, three + CONJURE.inkPerFriend), 'a friend who joins mid-stage raises the cap but adds no ink');
  // the snapshot carries the pool
  const snap = g.snapshot();
  check(snap.ink === 1 && snap.inkMax === g.inkMax(), 'snapshot: ink is one number for the crew, plus inkMax');
  // used up for good
  const spring = g.stones.find(k => k.spring);
  g.consume(spring);
  for (let i = 0; i < 600; i++) g.step(DT);
  const evs = g.drainEvents();
  check(!g.stones.some(k => k.spring) && !evs.some(e => e.t === 'regrow'), 'a used-up stone does not grow back, even after 10 s');
  check(evs.some(e => e.t === 'spent' && e.ch === '水' && e.back === false), 'a "spent" event says it is gone for good (back: false)');
  // opt-in regrow
  const g2 = new Game([Object.assign({}, flat, { regrow: true })]); g2.addPlayer('a', 'A'); g2.loadStage(0);
  g2.consume(g2.stones[0]);
  for (let i = 0; i < 300; i++) g2.step(DT);
  check(g2.stones.some(k => k.spring && k.ch === '水') && g2.drainEvents().some(e => e.t === 'spent' && e.back === true), 'a stage with "regrow": true grows it back (spent says back: true)');
}

console.log('\n--- Sim: conjuring while facing a gap ---');
{
  const gap = {
    id: 'gap-isle', name: 'Gap Isle', cn: '隙', par: 45, pal: 'dawn', want: '林',
    hint: 'A testing isle with a gap to face.',
    map: ['111...1111', '111...1111', '111...1111'],
    spawn: [7.5, 1.5], beacon: [1.5, 1.5],
    boat: { rect: [10, 0, 2, 3], from: [0, 5], to: [0, -5] },
    stones: [], conjure: ['水']
  };
  const g = new Game([gap]); g.addPlayer('a', 'A'); g.loadStage(0);
  const p = g.players.get('a');
  for (let i = 0; i < 200; i++) g.step(DT);   // the boat sails in, the player lands
  p.x = 6.3; p.z = 1.5; p.rot = -Math.PI / 2;   // at the edge, facing -x over the gap
  for (let i = 0; i < 30; i++) g.step(DT);
  const r = g.conjure('a', '水');
  check(r.ok && Number.isFinite(r.stone.y) && r.stone.from.every(Number.isFinite), 'facing a gap, the stone appears where the player stands, never over the void');
  for (let i = 0; i < 120; i++) g.step(DT);
  const k = g.stones.find(s => s.id === r.stone.id);
  check(k && Number.isFinite(k.y) && k.y >= 0.9 && k.x >= 6, 'and it lands on the floor');
}

console.log('\n--- Sim: 女 + 子 conjured fuse into 好 ---');
{
  const g = new Game();
  // Setup custom stage that allows 女 and 子 in conjure list
  const customStage = {
    id: 'good-isle', name: 'Good Isle', cn: '好岛', par: 45, pal: 'dawn', want: '好',
    hint: 'Mist has closed the river. Draw what is missing.',
    map: [
      '11111111',
      '11111111',
      '11111111'
    ],
    spawn: [4.5, 1.5],
    beacon: [1.5, 1.5],
    boat: { rect: [6, 0, 2, 3], from: [0, 5], to: [0, -5] },
    stones: [],
    conjure: ['女', '子', '好']
  };
  const customLevels = [customStage];
  const g2 = new Game(customLevels);
  g2.loadStage(0);
  const pA = g2.addPlayer('pa', 'Alice');
  const pB = g2.addPlayer('pb', 'Bob');

  // Place players next to each other, facing the same direction
  pA.x = 3.0; pA.y = 1.0; pA.z = 1.5; pA.rot = Math.PI * 0.5; // facing +X
  pB.x = 3.0; pB.y = 1.0; pB.z = 1.7; pB.rot = Math.PI * 0.5; // facing +X

  const rA = g2.conjure('pa', '女');
  check(rA.ok === true, 'Alice conjures 女');

  // Clear cooldown and conjure 子 close by
  const rB = g2.conjure('pb', '子');
  check(rB.ok === true, 'Bob conjures 子');

  // Step simulation for stones to land and fuse
  let fusedHao = false;
  for (let i = 0; i < 120; i++) {
    g2.step(DT);
    const evs = g2.drainEvents();
    if (evs.some(e => e.t === 'fuse' && e.ch === '好')) {
      fusedHao = true;
      break;
    }
  }
  check(fusedHao, '女 and 子 conjured nearby land and fuse into 好');
  check(g2.found.has('好'), '好 is recorded in found characters');
}

// =========================================================================
// 3. Sim: Deterministic run with no conjure matches identical state
// =========================================================================
console.log('\n--- Sim: Deterministic regression check ---');
{
  const runSim = () => {
    const g = new Game();
    g.addPlayer('p1', 'Runner');
    g.loadStage(0);
    // Execute a series of deterministic moves
    for (let i = 0; i < 60; i++) { g.setInput('p1', 0.5, 0.5); g.step(DT); }
    g.act('p1', 'jump');
    for (let i = 0; i < 40; i++) { g.setInput('p1', 0.5, 0.0); g.step(DT); }
    g.act('p1', 'grab');
    for (let i = 0; i < 60; i++) { g.step(DT); }
    return g.snapshot();
  };

  const snap1 = runSim();
  const snap2 = runSim();
  const same = JSON.stringify(snap1) === JSON.stringify(snap2);
  check(same, 'two identical sim runs produce bit-identical snapshots (deterministic)');
}

// =========================================================================
// 4. Wire: Server message handling, conjure broadcast, refusals
// =========================================================================
console.log('\n--- Wire: Server conjure handling ---');
const proc = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(PORT), FIREWALL_CHECK: '0' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverLog = '';
proc.stdout.on('data', d => { serverLog += d; });
proc.stderr.on('data', d => { serverLog += d; });

try {
  for (let i = 0; i < 40 && !serverLog.includes('Bound to'); i++) await sleep(100);
  check(serverLog.includes('Bound to'), 'test server bound to port ' + PORT);

  const board = await connect(PORT, { board: true });
  const mia = await connect(PORT, { name: 'Mia', playerId: 'p-conj-mia' });
  const bob = await connect(PORT, { name: 'Bob', playerId: 'p-conj-bob' });
  await sleep(200);

  check(mia.joined.ink === CONJURE.ink0 && mia.joined.inkMax === CONJURE.ink0, 'joined message carries the crew ink pool and its cap');
  check(Array.isArray(mia.joined.conjure) && mia.joined.conjure.length > 0, 'joined message carries conjure allowed set');
  check(mia.joined.conjure[0].ch && mia.joined.conjure[0].py && mia.joined.conjure[0].en, 'conjure list items have ch, py, en');

  // Valid strokes for 木
  const validStrokes = [
    [[0.15, 0.5], [0.85, 0.5]],
    [[0.5, 0.15], [0.5, 0.85]],
    [[0.5, 0.5], [0.2, 0.8]],
    [[0.5, 0.5], [0.8, 0.8]]
  ];

  // 4.1 Valid conjure broadcast
  let conjuredEv = null;
  board.ws.addEventListener('message', ev => {
    try {
      const m = JSON.parse(ev.data);
      if (m.type === 'conjured') conjuredEv = m;
    } catch (e) {}
  });

  let bobReceived = null;
  bob.ws.addEventListener('message', ev => {
    try {
      const m = JSON.parse(ev.data);
      if (m.type === 'conjured') bobReceived = m;
    } catch (e) {}
  });

  mia.send({ type: 'conjure', ch: '木', strokes: validStrokes });
  for (let i = 0; i < 20 && !conjuredEv; i++) await sleep(50);

  check(conjuredEv && conjuredEv.ch === '木' && conjuredEv.id === 'p-conj-mia', 'board received conjured broadcast with id and ch');
  check(bobReceived && bobReceived.ch === '木', 'other player received conjured broadcast');
  check(Array.isArray(conjuredEv.strokes) && conjuredEv.strokes.length === 4, 'conjured broadcast includes clean strokes');

  // 4.2 Unknown character refusal
  let refuseUnknown = null;
  mia.ws.addEventListener('message', ev => {
    try {
      const m = JSON.parse(ev.data);
      if (m.type === 'conjureNo') refuseUnknown = m;
    } catch (e) {}
  });
  mia.send({ type: 'conjure', ch: '龍', strokes: validStrokes });
  for (let i = 0; i < 20 && !refuseUnknown; i++) await sleep(50);
  check(refuseUnknown && refuseUnknown.why === 'unknown', 'character outside allowed set receives conjureNo unknown');

  // 4.3 Malformed / oversize messages are refused with why 'strokes', never silence (D5)
  const strokeNos = [];
  mia.ws.addEventListener('message', ev => {
    try {
      const m = JSON.parse(ev.data);
      if (m.type === 'conjureNo' && m.why === 'strokes') strokeNos.push(m);
    } catch (e) {}
  });
  let beforeSnaps = board.snaps;
  // Oversize: > 12 strokes
  mia.send({ type: 'conjure', ch: '木', strokes: Array(15).fill([[0.1, 0.1], [0.2, 0.2]]) });
  // Malformed: not an array
  mia.send({ type: 'conjure', ch: '木', strokes: 'bad' });
  // Stroke with > 40 points
  mia.send({ type: 'conjure', ch: '木', strokes: [Array(50).fill([0.5, 0.5])] });
  await sleep(200);
  check(board.snaps > beforeSnaps, 'server continues processing normally after malformed conjure messages');
  check(strokeNos.length === 3, 'each malformed conjure gets conjureNo strokes (D5), got ' + strokeNos.length);

  // 4.4 A pick (empty strokes, "Use without drawing", CJ-08) is a real conjure, not a stroke error
  let bobAnswer = null;
  bob.ws.addEventListener('message', ev => {
    try {
      const m = JSON.parse(ev.data);
      if ((m.type === 'conjured' && m.id === 'p-conj-bob') || m.type === 'conjureNo') bobAnswer = m;
    } catch (e) {}
  });
  bob.send({ type: 'conjure', ch: '木', strokes: [] });
  for (let i = 0; i < 20 && !bobAnswer; i++) await sleep(50);
  check(bobAnswer && bobAnswer.type === 'conjured' && Array.isArray(bobAnswer.strokes) && bobAnswer.strokes.length === 0,
    'empty-stroke pick is conjured with no strokes to replay, got ' + JSON.stringify(bobAnswer && { type: bobAnswer.type, why: bobAnswer.why }));

  for (const c of [board, mia, bob]) c.close();
} catch (e) {
  check(false, 'wire test failed: ' + e.message);
} finally {
  proc.kill();
}

console.log(failed ? `\n--- ${failed} CHECK(S) FAILED ---` : '\n--- ALL CONJURE CHECKS PASSED ---');
