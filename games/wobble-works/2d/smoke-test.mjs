// WOBBLE WORKS - automated LAN round test. Run with: node smoke-test.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 3431;
import { dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = dirname(fileURLToPath(import.meta.url));
const SAVE = path.join(ROOT, '.wobble-save.json');
const BASE = 'http://127.0.0.1:' + PORT;
let shuttingDown = false;
const fail = function (msg) { console.error('FAIL ✗ ' + msg); process.exitCode = 1; };
const ok = function (msg) { console.log('PASS ✓ ' + msg); };
function assert(cond, msg) { if (cond) ok(msg); else fail(msg); }

try { fs.unlinkSync(SAVE); } catch (e) {}
const proc = spawn(process.execPath, ['../server.js', '--mode=2d'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), WOBBLE_TEST: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
proc.stdout.on('data', function (d) { serverLog += d.toString(); });
proc.stderr.on('data', function (d) { serverLog += d.toString(); });
await new Promise(function (r) { setTimeout(r, 700); });

async function http(p) {
  const r = await fetch(BASE + p);
  return { status: r.status, text: await r.text() };
}
const cfg = await http('/config.js');
assert(cfg.status === 200 && cfg.text.indexOf('window.WOBBLE_CONFIG') === 0, 'GET /config.js serves LAN IPs (' + cfg.text.trim().slice(0, 76) + ')');
const idx = await http('/');
assert(idx.status === 200 && idx.text.indexOf('WOBBLE WORKS') >= 0, 'GET / serves the board / controller shell');
const wf = await http('/wireframe.html');
assert(wf.status === 200 && wf.text.indexOf('THE DOOR') >= 0, 'GET /wireframe.html serves the design spec');
const appjs = await http('/app.js');
assert(appjs.status === 200 && appjs.text.length > 10000, 'GET /app.js serves the client');
const qr = await http('/vendor/qrcode.js');
assert(qr.status === 200 && qr.text.length > 10000, 'GET /vendor/qrcode.js serves the offline QR library');

function client(name, emoji, board) {
  return new Promise(function (resolve, reject) {
    const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
    const c = { name: name, ws: ws, last: null, wins: [], states: 0, welcome: null, errors: [] };
    ws.onopen = function () { ws.send(JSON.stringify({ type: 'join', name: name, emoji: emoji, board: !!board })); };
    ws.onerror = function (e) { if (!shuttingDown) c.errors.push(String(e)); };
    ws.onmessage = function (ev) {
      const m = JSON.parse(ev.data);
      if (m.type === 'state') { c.last = m; c.states++; }
      else if (m.type === 'win') c.wins.push(m.win);
      else if (m.type === 'welcome') { c.welcome = m; resolve(c); }
      else if (m.type === 'pong') c.rtt = Date.now() - Number(m.c0);
    };
    setTimeout(function () { reject(new Error('join timeout: ' + name)); }, 4000);
  });
}
const board = await client('TV', '📺', true);
const mia = await client('Mia', '🦊', false);
const dad = await client('Dad', '🐻', false);
const nana = await client('Nana', '🐱', false);
const ctrls = [mia, dad, nana];
assert(ctrls.every(function (c) { return c.welcome && c.welcome.id; }), 'JOIN 3 phone controllers + 1 board (all welcomed)');
console.log('     players: ' + ctrls.map(function (c) { return c.welcome.name + '(' + c.welcome.emoji + ')'; }).join(', '));

board.ws.send(JSON.stringify({ type: 'ping', c0: Date.now() }));
await new Promise(function (r) { setTimeout(r, 200); });
assert(typeof board.rtt === 'number' && board.rtt < 300, 'PING/PONG round trip measured on LAN (' + board.rtt + ' ms)');

board.ws.send(JSON.stringify({ type: 'addBot' }));
board.ws.send(JSON.stringify({ type: 'addBot' }));
board.ws.send(JSON.stringify({ type: 'call', text: '💪 PUSH' }));
board.ws.send(JSON.stringify({ type: 'hint' }));
board.ws.send(JSON.stringify({ type: 'start' }));
await new Promise(function (r) { setTimeout(r, 350); });
assert(board.last.players.length === 6, 'ADD BOT: 2 demo wobblers join the room (6 players total)');

// Feedback driver: stay behind the Core and keep leaning into it.
const pushMsg = function (s, c) {
  const core = s.bodies.find(function (b) { return b.kind === 'core'; });
  const me = s.players.find(function (p) { return p.name === c.name; });
  if (!core || !me) return null;
  const ahead = me.x > core.x + 25;
  return JSON.stringify({ type: 'input', left: false, right: ahead ? true : me.x < core.x - 20, jump: false, grabL: false, grabR: false });
};
const drive = setInterval(function () {
  const s = board.last; if (!s) return;
  ctrls.forEach(function (c) { const m = pushMsg(s, c); if (m) c.ws.send(m); });
}, 45);

let hopped = false, pushedTo = 0, plateSeen = false, gateSeen = false, maxPush = 0, startX = 470, won = null, elapsed = 0;
for (let i = 0; i < 32; i++) {
  await new Promise(function (r) { setTimeout(r, 1000); });
  const s = board.last;
  const core = s.bodies.find(function (b) { return b.kind === 'core'; });
  const plate = s.bodies.find(function (b) { return b.kind === 'plate'; });
  const gate = s.bodies.find(function (b) { return b.kind === 'gate'; });
  if (plate && plate.pressed) plateSeen = true;
  if (gate && gate.open) gateSeen = true;
  maxPush = Math.max(maxPush, s.pushCount);
  // Stage 1 now has a wall that needs a hoist (see hoist-test.mjs). Bots cannot climb, so once
  // the plate and gate have been done by pushing, hop the Core over the wall to the beacon.
  if (gateSeen && !hopped && core.x > 900) { hopped = true; pushedTo = core.x; board.ws.send(JSON.stringify({ type: 'testCore', x: 1290, y: 726 })); }
  elapsed = i + 1;
  if (s.phase === 'won') { won = s.win; break; }
}
clearInterval(drive);
const s = board.last;
const core = s.bodies.find(function (b) { return b.kind === 'core'; });
console.log('     core travelled ' + Math.round(core.x - startX) + 'px · max team push ' + maxPush + ' · elapsed ' + elapsed + 's');
assert(pushedTo - startX > 200, 'PHYSICS: the Core is pushed across the workshop to the plate (' + Math.round(pushedTo - startX) + ' px)');
assert(maxPush >= 3, 'INTERDEPENDENCE: 3+ wobblers push together (peak ' + maxPush + ')');
assert(plateSeen, 'PUZZLE: the pressure plate is pressed by the heavy Core');
assert(gateSeen, 'PUZZLE: the gate opens (latched)');
assert(s.phase === 'won' && !!won, 'WIN: the beacon lights and the round ends');
assert(board.wins.length >= 1 && !!won.medal.name, 'ROUTE MEDAL awarded: ' + (won ? won.medal.name : 'none'));
assert(fs.existsSync(SAVE) && JSON.parse(fs.readFileSync(SAVE, 'utf8')).stamps.length === 1, 'PERSISTENCE: Family Scrapbook stamp saved to .wobble-save.json');

// Post-win exercises: next chapter, sandbox, tool dispenser, quick call.
board.ws.send(JSON.stringify({ type: 'next' }));
await new Promise(function (r) { setTimeout(r, 450); });
assert(board.last && board.last.level.id === 2, 'NEXT CHAPTER advances to CH.2 THE SEE-SAW');
board.ws.send(JSON.stringify({ type: 'setLevel', id: 5 }));
await new Promise(function (r) { setTimeout(r, 450); });
assert(board.last.level.key === 'sandbox' && board.last.goal === null, 'SANDBOX loads with no beacon and no clock');
const before = board.last.toolsUsed;
board.ws.send(JSON.stringify({ type: 'spawnTool', kind: 'plank' }));
board.ws.send(JSON.stringify({ type: 'spawnTool', kind: 'crate' }));
await new Promise(function (r) { setTimeout(r, 450); });
assert(board.last.toolsUsed === before + 2, 'TOOL DISPENSER spawns parts into the physics world');
board.ws.send(JSON.stringify({ type: 'call', text: '📍 HERE' }));
await new Promise(function (r) { setTimeout(r, 350); });
assert(s.fx !== undefined, 'QUICK CALL / FX events are broadcast in snapshots');
assert(board.states > 100, 'SNAPSHOTS streamed continuously (' + board.states + ' states)');
assert(ctrls.every(function (c) { return c.errors.length === 0; }) && board.errors.length === 0, 'No WebSocket errors on any client');

shuttingDown = true;
for (const c of [board, mia, dad, nana]) { try { c.ws.close(); } catch (e) {} }
proc.kill();
await new Promise(function (r) { setTimeout(r, 200); });
console.log('');
console.log(process.exitCode ? 'RESULT: FAILURES ABOVE' : 'RESULT: PASS ✔ full physics round completed with board + 3 controllers + 2 demo bots');
console.log('SERVER BANNER: ' + serverLog.split('\n').filter(function (l) { return l.indexOf('Board (TV') >= 0 || l.indexOf('Physics') >= 0; }).join(' | ').trim());
