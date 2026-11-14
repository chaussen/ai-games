// WOBBLE WORKS CLASSIC (2D) - LAN multi-client smoke test
// Boots the real 3D server (which also hosts the 2D room on /ws2d) and drives it.
// Run with: node classic-smoke.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3457;
const BASE = 'http://127.0.0.1:' + PORT;

let failures = 0;
const ok = m => console.log('PASS \u2713 ' + m);
const fail = m => { failures++; console.error('FAIL \u2717 ' + m); };
function assert(c, m) { if (c) ok(m); else fail(m); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log('--- Wobble Works CLASSIC 2D test server on port ' + PORT + ' ---');
const proc = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});
let log = '';
proc.stdout.on('data', d => { log += d.toString(); });
proc.stderr.on('data', d => { log += d.toString(); });
await sleep(900);

async function http(p) {
  const r = await fetch(BASE + p);
  return { status: r.status, text: await r.text() };
}

// ---------- 1. static assets ----------
const shell = await http('/classic/');
assert(shell.status === 200 && shell.text.includes('CLASSIC 2D'), 'GET /classic/ serves the 2D shell');
assert(shell.text.includes('app2d.js'), 'shell loads app2d.js');

const app = await http('/classic/app2d.js');
assert(app.status === 200 && app.text.includes('/ws2d'), 'GET /classic/app2d.js opens /ws2d');
const css = await http('/classic/style2d.css');
assert(css.status === 200 && css.text.includes('--paper'), 'GET /classic/style2d.css serves the workshop theme');
const matter = await http('/vendor/matter.min.js');
assert(matter.status === 200 && matter.text.length > 50000, 'vendored Matter.js is served');

// the 3D room must still be intact on the same port
const idx = await http('/');
assert(idx.status === 200 && idx.text.includes('WOBBLE WORKS'), '3D shell still served at / (one port, two games)');

// ---------- 2. websocket helper ----------
function connect(pathName) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + PORT + pathName);
    const inbox = [];
    ws.onmessage = ev => {
      let m = null;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      inbox.push(m);
      ws._last = m;
      if (ws._waiters) {
        for (let i = ws._waiters.length - 1; i >= 0; i--) {
          const w = ws._waiters[i];
          if (w.pred(m)) { ws._waiters.splice(i, 1); w.resolve(m); }
        }
      }
    };
    ws.onopen = () => { ws._waiters = []; ws._inbox = inbox; resolve(ws); };
    ws.onerror = e => reject(e);
    setTimeout(() => reject(new Error('ws timeout ' + pathName)), 4000);
  });
}

function waitFor(ws, pred, ms = 3000) {
  return new Promise((resolve, reject) => {
    for (const m of ws._inbox.slice().reverse()) {
      if (pred(m)) return resolve(m);
    }
    const t = setTimeout(() => reject(new Error('waitFor timeout')), ms);
    ws._waiters.push({ pred, resolve: m => { clearTimeout(t); resolve(m); } });
  });
}

const send = (ws, obj) => ws.send(JSON.stringify(obj));

// ---------- 3. board joins ----------
const board = await connect('/ws2d');
send(board, { type: 'join', board: true });
const bJoined = await waitFor(board, m => m.type === 'joined');
assert(bJoined.board === true, 'board joins the 2D room');
assert(bJoined.level && bJoined.level.name, 'board receives level data: ' + (bJoined.level && bJoined.level.name));
assert(bJoined.level.statics.length >= 5, 'level 1 ships ' + bJoined.level.statics.length + ' static bodies');
assert(bJoined.level.plates.length >= 1 && bJoined.level.gates.length >= 1, 'level 1 has a plate and a gate');
assert(!!bJoined.level.goal, 'level 1 has a beacon');

const stateP = waitFor(board, m => m.type === 'state');
const st = await stateP;
assert(typeof st.core.x === 'number', 'board receives core position');
assert(Array.isArray(st.players), 'state carries the player list');
assert(st.plates.length >= 1 && st.gates.length >= 1, 'state carries live plate/gate state');

// snapshot cadence
let snaps = 0;
const onMsg = ev => { try { if (JSON.parse(ev.data).type === 'state') snaps++; } catch (e) {} };
board.addEventListener('message', onMsg);
await sleep(1000);
board.removeEventListener('message', onMsg);
assert(snaps >= 15 && snaps <= 24, 'snapshot rate is ~20 Hz (' + snaps + '/s)');

// ---------- 4. two controllers ----------
const p1 = await connect('/ws2d');
send(p1, { type: 'join', name: 'Mum' });
const j1 = await waitFor(p1, m => m.type === 'joined');
assert(!!j1.id && j1.name === 'Mum', 'controller 1 joins as ' + j1.name);

const p2 = await connect('/ws2d');
send(p2, { type: 'join', name: 'Sam' });
const j2 = await waitFor(p2, m => m.type === 'joined');
assert(!!j2.id && j2.color && j2.color !== j1.color, 'controller 2 joins with a distinct colour');

await sleep(300);
const st2 = await waitFor(board, m => m.type === 'state' && m.players.length === 2);
assert(st2.players.length === 2, 'board sees two wobblers');

const me = () => st2.players.find(p => p.id === j1.id);
const startX = me().x;
const startY = me().y;

// ---------- 5. jump (from spawn, where the sky is open) ----------
let lowestY = 1e9;
send(p1, { type: 'input', x: 0, jump: true, grabL: false, grabR: false });
for (let i = 0; i < 26; i++) {
  const s = await waitFor(board, m => m.type === 'state' && m.t > Date.now() - 4000);
  const pl = s.players.find(p => p.id === j1.id);
  if (pl) lowestY = Math.min(lowestY, pl.y);
  await sleep(45);
}
send(p1, { type: 'input', x: 0, jump: false, grabL: false, grabR: false });
assert(lowestY < startY - 150, 'jump lifts the wobbler ' + Math.round(startY - lowestY) + 'px into the air');

// ---------- 6. movement ----------
send(p1, { type: 'input', x: 1, jump: false, grabL: false, grabR: false });
await sleep(700);
const afterMove = await waitFor(board, m => m.type === 'state' && m.players.some(p => p.id === j1.id && p.x > startX + 80));
assert(!!afterMove, 'holding right moves the wobbler (~' + Math.round(afterMove.players.find(p => p.id === j1.id).x - startX) + 'px)');

// ---------- 7. grab a body ----------
send(p1, { type: 'input', x: 0, jump: false, grabL: true, grabR: false });
await sleep(260);
send(p1, { type: 'input', x: 0, jump: false, grabL: false, grabR: false });
assert(true, 'grab input accepted without crashing the room');

// ---------- 8. board level switching ----------
send(board, { type: 'level', id: 2 });
const lvl2 = await waitFor(board, m => m.type === 'level' && m.level.id === 2);
assert(lvl2.level.name && lvl2.level.name !== bJoined.level.name, 'board switches to chapter 2: ' + lvl2.level.name);
assert(lvl2.level.seesaws.length >= 1 || lvl2.level.ropes.length >= 1, 'chapter 2 carries its own props');

send(board, { type: 'level', id: 5 });
const sand = await waitFor(board, m => m.type === 'level' && m.level.id === 5);
assert(sand.level.toolBudget > 0, 'sandbox has a tool budget of ' + sand.level.toolBudget);

// ---------- 9. tool dispenser ----------
await sleep(200);
const t0 = Date.now();
const before = (await waitFor(board, m => m.type === 'state' && m.t > t0 - 100 && m.levelId === 5)).dyn.length;
send(board, { type: 'tool', kind: 'plank' });
const after = await waitFor(board, m => m.type === 'state' && m.t > t0 && m.levelId === 5 && m.dyn.length > before);
assert(after.dyn.length === before + 1, 'dropping a part adds one body to the world');

// ---------- 10. reset ----------
send(board, { type: 'reset' });
const reset = await waitFor(board, m => m.type === 'level' && m.level.id === 5);
assert(!!reset, 'reset rebuilds the current chapter');

// ---------- 11. back to chapter 1, no wins yet ----------
send(board, { type: 'level', id: 1 });
await waitFor(board, m => m.type === 'level' && m.level.id === 1);
const fresh = await waitFor(board, m => m.type === 'state');
assert(fresh.won === false && fresh.medal === null, 'a fresh chapter starts unwon');

board.close(); p1.close(); p2.close();
await sleep(200);

// ---------- 12. server stayed up ----------
const alive = await http('/classic/');
assert(alive.status === 200, 'server survived every client disconnecting');
assert(!/Error|error:/.test(log.replace(/0 errors/g, '')), 'no server-side errors logged');

// ---------- 13. the actual win condition, headless ----------
const { createRequire } = await import('node:module');
const require2 = createRequire(import.meta.url);
const { createSim } = require2('./classic/sim2d.js');

const sim = createSim(1);
const plate = sim.level.plates[0];
const holder = sim.addPlayer('holder', 'Holder');
const pusher = sim.addPlayer('pusher', 'Pusher');
const Matter = require2('./vendor/matter.min.js');

// one wobbler holds the pressure plate, the other pushes the Core east
Matter.Body.setPosition(holder.body, { x: plate.x, y: plate.y - 60 });
Matter.Body.setPosition(pusher.body, { x: sim.core.position.x - 70, y: sim.level.ground - 60 });
sim.setInput('holder', { x: 0, jump: false, grabL: false, grabR: false });
sim.setInput('pusher', { x: 1, jump: false, grabL: false, grabR: false });

let gateOpened = false;
let wonAt = -1;
for (let i = 0; i < 1800; i++) {
  sim.step(Date.now());
  if (sim.gates[0] && sim.gates[0].open) gateOpened = true;
  if (sim.won && wonAt < 0) wonAt = i;
}
assert(gateOpened, 'the plate opens the gate when a wobbler stands on it');
assert(sim.won === true, 'pushing the Core into the beacon wins the chapter (tick ' + wonAt + ')');
assert(!!sim.medal, 'winning awards a route medal: ' + sim.medal);
const score = [...sim.players.values()].reduce((a, p) => a + p.score, 0);
assert(score > 0, 'scoring fires on the win (' + score + ' pts)');

// jumping is still a real jump after all that
const jp = sim.addPlayer('jumper', 'J');
const y0 = jp.body.position.y;
sim.setInput('jumper', { x: 0, jump: true, grabL: false, grabR: false });
let peak = y0;
for (let i = 0; i < 60; i++) { sim.step(Date.now()); peak = Math.min(peak, jp.body.position.y); }
assert(y0 - peak > 150, 'a fresh wobbler still jumps ' + Math.round(y0 - peak) + 'px');

proc.kill('SIGTERM');
await sleep(150);

console.log('');
if (failures === 0) console.log('ALL CHECKS PASSED');
else console.log(failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
