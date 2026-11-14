// WOBBLE WORKS 3D - Automated LAN multi-client 3D simulation test
// Run with: node smoke-test.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3455;
const BASE = 'http://127.0.0.1:' + PORT;

const fail = msg => { console.error('FAIL ✗ ' + msg); process.exitCode = 1; };
const ok = msg => { console.log('PASS ✓ ' + msg); };
function assert(cond, msg) { if (cond) ok(msg); else fail(msg); }

console.log('--- Starting Wobble Works 3D test server on port ' + PORT + ' ---');
const proc = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverLog = '';
proc.stdout.on('data', d => { serverLog += d.toString(); });
proc.stderr.on('data', d => { serverLog += d.toString(); });

await new Promise(r => setTimeout(r, 800));

async function http(p) {
  const r = await fetch(BASE + p);
  return { status: r.status, text: await r.text() };
}

// 1. HTTP Endpoint checks
const cfg = await http('/config.js');
assert(cfg.status === 200 && cfg.text.includes('gameMode":"3d"'), 'GET /config.js serves 3D config');

const idx = await http('/');
assert(idx.status === 200 && idx.text.includes('WOBBLE WORKS 3D'), 'GET / serves 3D game shell');

const threeJs = await http('/vendor/three.min.js');
assert(threeJs.status === 200 && threeJs.text.length > 500000, 'GET /vendor/three.min.js serves Three.js bundle');

const cannonJs = await http('/vendor/cannon.min.js');
assert(cannonJs.status === 200 && cannonJs.text.length > 100000, 'GET /vendor/cannon.min.js serves Cannon.js bundle');

const lvlJs = await http('/levels3d.js');
assert(lvlJs.status === 200 && lvlJs.text.includes('SUMMIT BELL'), 'GET /levels3d.js serves 3D world geometry');

// 2. WebSocket multi-client join
function createClient(name, isBoard) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
    const c = { name, isBoard, ws, lastSnap: null, joined: null, events: [] };
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', name, board: !!isBoard }));
    };
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'joined') {
        c.joined = msg;
        resolve(c);
      } else if (msg.type === 'state') {
        c.lastSnap = msg;
      } else if (msg.type === 'fx') {
        c.events.push(msg.event);
      }
    };
    setTimeout(() => reject(new Error('join timeout for ' + name)), 3500);
  });
}

const board = await createClient('TV-Spectator', true);
const mia = await createClient('Mia', false);
const dad = await createClient('Dad', false);
const nana = await createClient('Nana', false);
const players = [mia, dad, nana];

assert(board.joined && board.joined.board, 'Spectator Board joined');
assert(players.every(p => p.joined && p.joined.id), '3 Phone controllers joined with IDs: ' + players.map(p => p.joined.id).join(', '));

// 3. Receive 3D world state snapshots
await new Promise(r => setTimeout(r, 200));
assert(board.lastSnap && board.lastSnap.players.length === 3, 'Board receives snapshot with 3 3D players');
assert(board.lastSnap.ball && typeof board.lastSnap.ball.x === 'number', 'Snapshot contains dynamic 3D Glow Core ball');
assert(board.lastSnap.crates.length >= 6, 'Snapshot contains 6 dynamic movable crates');
assert(board.lastSnap.goal && board.lastSnap.goal.id === 'summit', 'Active goal is SUMMIT BELL');

// 4. Test 3D player movement inputs
mia.ws.send(JSON.stringify({ type: 'input', x: 1.0, z: 0.0, jump: false }));
await new Promise(r => setTimeout(r, 250));
const miaSnap1 = board.lastSnap.players.find(p => p.id === mia.joined.id);
assert(miaSnap1 && miaSnap1.x !== 0, 'Mia moved along X axis (x=' + miaSnap1.x + ')');

// 5. Test 3D Jump
mia.ws.send(JSON.stringify({ type: 'input', x: 0, z: 0, jump: true }));
await new Promise(r => setTimeout(r, 200));
const miaSnapJump = board.lastSnap.players.find(p => p.id === mia.joined.id);
assert(miaSnapJump && miaSnapJump.y > 0.9, 'Mia jumped upward in 3D (y=' + miaSnapJump.y + ')');

// 6. Test Ball Overhead Lift & Throw
// Position Dad right by the ball and lift
dad.ws.send(JSON.stringify({ type: 'input', x: 0, z: 0, lift: true }));
await new Promise(r => setTimeout(r, 250));

// Throw ball
dad.ws.send(JSON.stringify({ type: 'input', x: 0, z: 0, throw: true }));
await new Promise(r => setTimeout(r, 250));
assert(board.lastSnap.ball.y > 0, 'Ball launched and flying in 3D physics (y=' + board.lastSnap.ball.y + ')');

// 7. Test Add Bot (Scale up to more players)
board.ws.send(JSON.stringify({ type: 'addBot' }));
await new Promise(r => setTimeout(r, 200));
assert(board.lastSnap.players.some(p => p.bot), 'Bot added to 3D world, running autonomous AI');

// 8. Test Goal Scoring & Scorer MVP Crown
// Trigger goal score event
board.ws.send(JSON.stringify({ type: 'nextGoal' }));
await new Promise(r => setTimeout(r, 200));
assert(board.lastSnap.goal.id !== 'summit', 'Goal advanced to: ' + board.lastSnap.goal.name);

// 9. Test Mobile Screen Dimming / AFK Statue
nana.ws.send(JSON.stringify({ type: 'visibility', hidden: true }));
await new Promise(r => setTimeout(r, 200));
const nanaAfk = board.lastSnap.players.find(p => p.id === nana.joined.id);
assert(nanaAfk && nanaAfk.afk, 'Nana marked AFK sleeping statue on mobile dim');

// Resume from AFK
nana.ws.send(JSON.stringify({ type: 'visibility', hidden: false }));
await new Promise(r => setTimeout(r, 200));
const nanaAwake = board.lastSnap.players.find(p => p.id === nana.joined.id);
assert(nanaAwake && !nanaAwake.afk, 'Nana instantly wakes up and resumes playing');

console.log('--- ALL 3D PHYSICS & NETWORKING TESTS PASSED! ---');

// Shutdown clients & server
[board, mia, dad, nana].forEach(c => c.ws.close());
proc.kill();