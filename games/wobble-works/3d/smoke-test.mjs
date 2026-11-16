// Wobble Works 3D — the contract. Boots the real server (through the shared launcher)
// on a test port, checks what it serves, then plays stage 1 to the beacon over the
// real WebSocket protocol, in real time, the way a phone would.
// Run with: node smoke-test.mjs      (takes about 25 seconds)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, Bot, sleep } from './tools/wire.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3455;
const BASE = 'http://127.0.0.1:' + PORT;
let failed = 0;
const check = (cond, msg) => { console.log((cond ? 'PASS ✓ ' : 'FAIL ✗ ') + msg); if (!cond) { failed++; process.exitCode = 1; } };

const proc = spawn(process.execPath, ['../server.js', '--mode=3d'], {
  cwd: __dirname, env: { ...process.env, PORT: String(PORT), FIREWALL_CHECK: '0' }, stdio: ['ignore', 'pipe', 'pipe']
});
let log = '';
proc.stdout.on('data', d => { log += d; });
proc.stderr.on('data', d => { log += d; });
const get = async p => { const r = await fetch(BASE + p); return { status: r.status, text: await r.text() }; };

try {
  for (let i = 0; i < 40 && !log.includes('Bound to'); i++) await sleep(100);
  check(log.includes('WOBBLE WORKS 3D'), 'server starts through ../server.js --mode=3d');

  // ---- static files ----
  const cfg = await get('/config.js');
  check(cfg.status === 200 && cfg.text.includes('"gameMode":"3d"') && cfg.text.includes('"port":' + PORT), 'GET /config.js carries mode and port');
  const idx = await get('/');
  check(idx.status === 200 && idx.text.includes('Wobble Works 3D'), 'GET / serves the game page');
  for (const f of ['/app.js', '/style.css', '/levels.js']) check((await get(f)).status === 200, 'GET ' + f);
  const three = await get('/vendor/three.min.js');
  check(three.status === 200 && three.text.length > 500000, 'GET /vendor/three.min.js serves the vendored renderer (no CDN)');
  check((await get('/vendor/qrcode.js')).status === 200, 'GET /vendor/qrcode.js');
  check((await get('/server.js')).status === 404 && (await get('/sim.js')).status === 404, 'server source is not served');
  check((await get('/vendor/..%2f..%2f2d%2fserver.js')).status === 404, 'path traversal is refused');
  check(!/https?:\/\/(?!www\.w3\.org)/.test(idx.text), 'the page loads nothing from the internet');

  // ---- join ----
  const board = await connect(PORT, { board: true });
  const mia = await connect(PORT, { name: 'Mia', playerId: 'p-smoke-mia' });
  const dad = await connect(PORT, { name: 'Dad' });
  check(board.joined.board === true, 'the board joins as a spectator');
  check(mia.joined.id === 'p-smoke-mia' && dad.joined.id && mia.joined.ci !== dad.joined.ci, 'two phones join with their own ids and colours');
  await sleep(300);
  check(board.roster.length === 2 && board.roster.some(p => p.name === 'Mia'), 'the roster lists both wobblers by name');
  const s0 = board.snap;
  check(s0 && s0.st === 0 && s0.ph === 'play' && s0.p.length === 2, 'snapshots arrive: stage 1, two wobblers');
  check(s0.c[0] === 'l' && s0.g.length === 3 && s0.t === 0, 'snapshot carries the Core, three gems and a clock stopped at 0:00');
  const n0 = board.snaps; await sleep(1000);
  check(board.snaps - n0 >= 25 && board.snaps - n0 <= 35, `about 30 snapshots a second (${board.snaps - n0})`);

  // ---- quick calls, AFK ----
  mia.send({ type: 'call', text: 'Here!' });
  dad.send({ type: 'visibility', hidden: true });
  await sleep(200);
  check(board.calls.some(c => c.id === mia.joined.id && c.text === 'Here!'), 'a quick call reaches every screen');
  check(board.snap.p.find(p => p[0] === dad.joined.id)[5] & 4, 'a dimmed phone becomes a napping wobbler');
  dad.send({ type: 'visibility', hidden: false });
  await sleep(150);
  check(!(board.snap.p.find(p => p[0] === dad.joined.id)[5] & 4), 'and wakes when the screen comes back');

  // ---- play stage 1 for real ----
  const bot = new Bot(mia);
  const coreX = () => mia.snap.c[1];
  await bot.go(11.3, 2.5); await bot.grab();
  check(mia.snap.c[4] === bot.id, 'Mia picks up the Core');
  check(Array.isArray(mia.snap.aim), 'the snapshot carries an aim marker while she holds it');
  await bot.go(6.8, 2.5);
  await bot.toss(-1, 0);
  check(mia.snap.c[0] === 'l' && coreX() < 4, `she tosses it over the gap (x=${coreX()})`);
  await bot.go(7.5, 2.5);
  await bot.leap(-1, 0, () => bot.pos.x < 6.25, () => bot.pos.x < 3.9);
  check(bot.pos.x < 4 && bot.pos.y === 3, 'and jumps after it');
  await bot.go(Math.min(3.7, coreX() + 0.5), 2.5); await bot.grab();
  await bot.go(1.5, 2.5);
  await sleep(250);
  const res = board.snap.res;
  check(board.snap.ph === 'won' && res && res.by === bot.id, 'delivering the Core to the beacon wins the stage');
  check(res && res.stars >= 1 && res.stars <= 3 && res.time > 3 && res.total === 3, `result: ${res && res.time}s, ${res && res.gems}/${res && res.total} gems, ${res && res.stars} star(s)`);
  check(board.events.some(e => e.t === 'win') && board.events.some(e => e.t === 'jump') && board.events.some(e => e.t === 'throw'), 'win, jump and throw events were broadcast');

  // ---- stage controls ----
  board.send({ type: 'admin', cmd: 'next' });
  await sleep(200);
  check(board.snap.st === 1 && board.snap.ph === 'play' && board.snap.m.length === 2 && board.snap.pl.length === 4, 'the board skips to stage 2 (2 pillars, 4 plates)');
  board.send({ type: 'admin', cmd: 'goto', i: 4 });
  await sleep(200);
  check(board.snap.st === 4, 'and can jump to any stage');
  board.send({ type: 'admin', cmd: 'restart' });
  await sleep(200);
  check(board.snap.st === 4 && board.snap.t === 0, 'restart reloads the current stage');

  // ---- reconnect keeps your wobbler ----
  mia.close();
  await sleep(250);
  check(board.snap.p.length === 2 && (board.snap.p.find(p => p[0] === 'p-smoke-mia')[5] & 4), 'a dropped phone naps instead of vanishing');
  const mia2 = await connect(PORT, { name: 'Mia', playerId: 'p-smoke-mia' });
  await sleep(250);
  check(mia2.joined.id === 'p-smoke-mia' && mia2.joined.ci === mia.joined.ci && board.snap.p.length === 2, 'reconnecting with the same id resumes the same wobbler');

  // ---- garbage does not hurt ----
  dad.ws.send('not json');
  dad.send({ type: 'input', x: 'NaN', z: 1e99 });
  dad.send({ type: 'act', a: 'explode' });
  dad.send({ type: 'admin', cmd: 'goto', i: 'banana' });
  await sleep(250);
  check(board.snap && board.snap.p.every(p => Number.isFinite(p[1]) && Number.isFinite(p[3])), 'malformed messages are ignored');

  for (const c of [board, mia2, dad]) c.close();
} catch (e) {
  check(false, 'smoke test aborted: ' + e.message);
} finally {
  proc.kill();
}
console.log(failed ? `--- ${failed} CHECK(S) FAILED ---` : '--- ALL 3D SMOKE CHECKS PASSED ---');
