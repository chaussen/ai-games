/**
 * Automated multi-client LAN smoke test.
 * Boots the real server, connects one board + several phone/PC controllers,
 * plays a full round with simulated taps, and verifies the protocol.
 *   node smoke-test.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 3399;
const ROUND_MS = 16000;
const dir = import.meta.dirname;
const proc = spawn(process.execPath, ['server.js'], {
  cwd: dir,
  env: { ...process.env, PORT: String(PORT), ROUND_MS: String(ROUND_MS) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
proc.stdout.on('data', d => { log += d.toString(); });
proc.stderr.on('data', d => { log += d.toString(); });

let shuttingDown = false;
function die(msg) { console.error('FAIL:', msg); console.error(log); proc.kill(); process.exit(1); }

let ready = false;
for (let i = 0; i < 50; i++) {
  try { const r = await fetch('http://127.0.0.1:' + PORT + '/config.js'); if (r.ok) { ready = true; break; } } catch (e) {}
  await sleep(120);
}
if (!ready) die('server never came up');

const configText = await (await fetch('http://127.0.0.1:' + PORT + '/config.js')).text();
const idx = await fetch('http://127.0.0.1:' + PORT + '/');
const wf = await fetch('http://127.0.0.1:' + PORT + '/wireframe.html');
console.log('HTTP  config.js:', configText.trim());
console.log('HTTP  index.html:', idx.status, ' wireframe.html:', wf.status);
if (idx.status !== 200) die('index.html not served');
if (!configText.includes('lanIPs')) die('config.js missing LAN IPs');

function makeClient(label) {
  const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
  const c = { label, ws, events: [], state: null, me: null, offset: 0,
              turnsSeen: new Set(), taps: 0, opened: false };
  ws.onopen = () => { c.opened = true; };
  ws.onerror = e => { if (!shuttingDown) console.error('ws error', label, e.message || e); };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    c.events.push(m);
    if (m.t === 'pong') c.offset = ((m.s1 - m.c0) + (m.s2 - Date.now())) / 2;
    if (m.t === 'welcome') { c.me = m.you; c.state = m.state; }
    if (m.t === 'state') {
      c.state = m;
      const t = m.turn;
      if (m.phase === 'playing' && t && !t.resolved && c.me != null &&
          t.targets.includes(c.me) && !t.hits.includes(c.me) && !c.turnsSeen.has(t.startAt)) {
        c.turnsSeen.add(t.startAt);
        const delay = Math.min(170, t.windowMs * 0.35);
        setTimeout(() => {
          if (ws.readyState === 1) { ws.send(JSON.stringify({ t: 'tap', sentAt: Date.now() + c.offset })); c.taps++; }
        }, delay);
      }
    }
  };
  return c;
}

const board = makeClient('BOARD');
const players = [makeClient('Mia'), makeClient('Dad'), makeClient('Nana')];
const all = [board, ...players];
for (let i = 0; i < 60 && !all.every(c => c.opened); i++) await sleep(50);
if (!all.every(c => c.opened)) die('some clients did not connect');

// clock sync + join
for (const c of all) c.ws.send(JSON.stringify({ t: 'ping', c0: Date.now() }));
await sleep(120);
board.ws.send(JSON.stringify({ t: 'hello', role: 'board' }));
players.forEach((c, i) => c.ws.send(JSON.stringify({ t: 'hello', role: 'controller', name: c.label, emoji: '🦊' })));
for (let i = 0; i < 80 && !(board.state && board.state.players.length === 3); i++) await sleep(50);
if (!board.state || board.state.players.length !== 3) die('players did not join');
console.log('JOIN  players:', board.state.players.map(p => p.name + '(' + p.color + ')').join(', '));

board.ws.send(JSON.stringify({ t: 'addBot' }));
await sleep(120);
console.log('JOIN  + demo firefly ->', board.state.players.length, 'lanterns');

board.ws.send(JSON.stringify({ t: 'start' }));
let ended = null;
for (let i = 0; i < (ROUND_MS / 100 + 80); i++) {
  ended = board.events.find(e => e.t === 'roundEnd');
  if (ended) break;
  await sleep(100);
}
if (!ended) die('round did not end');

const results = board.events.filter(e => e.t === 'turnResult');
const hits = results.filter(e => e.ok);
const misses = results.filter(e => !e.ok);
const chorus = results.filter(e => e.ok && e.type === 'chorus');
const counts = board.events.filter(e => e.t === 'countdown');
const maxCombo = Math.max(0, ...results.map(e => e.combo));
console.log('PLAY  countdown msgs:', counts.length, ' passes:', hits.length,
            ' misses:', misses.length, ' harmony events:', chorus.length);
console.log('PLAY  final score:', ended.score, ' best chain:', ended.bestCombo,
            ' level reached:', board.state.level, ' taps sent:', players.reduce((s, c) => s + c.taps, 0));
console.log('PLAY  per-player passes:', ended.stats.map(s => s.name + '=' + s.hits).join(', '));
console.log('SKY   rounds:', ended.sky.rounds, ' stars:', ended.sky.stars, ' best:', ended.sky.bestScore);

let problems = [];
if (hits.length < 5) problems.push('too few successful passes');
if (chorus.length < 1) problems.push('no HARMONY event fired');
if (counts.length < 4) problems.push('countdown incomplete');
if (ended.sky.stars < 1) problems.push('family sky did not persist a star');
if (players.some(c => c.taps === 0)) problems.push('a controller never got a turn');
if (wf.status !== 200) problems.push('wireframe.html not served (create it)');

shuttingDown = true;
proc.kill();
if (problems.length) { console.log('\nFAIL:', problems.join('; ')); process.exit(1); }
console.log('\nPASS ✔  full LAN round completed with board + 3 controllers + a demo bot');
