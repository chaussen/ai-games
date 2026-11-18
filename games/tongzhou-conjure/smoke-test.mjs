// 同舟 · Glyph Isles — the contract. Boots the real server on a test port, checks
// what it serves, then plays stage 1 to the shrine over the
// real WebSocket protocol, in real time, the way a phone would.
// Run with: node smoke-test.mjs      (takes about 25 seconds)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, Bot, sleep } from './tools/wire.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3456;
const BASE = 'http://127.0.0.1:' + PORT;
let failed = 0;
const check = (cond, msg) => { console.log((cond ? 'PASS ✓ ' : 'FAIL ✗ ') + msg); if (!cond) { failed++; process.exitCode = 1; } };

const proc = spawn(process.execPath, ['server.js'], {
  cwd: __dirname, env: { ...process.env, PORT: String(PORT), FIREWALL_CHECK: '0' }, stdio: ['ignore', 'pipe', 'pipe']
});
let log = '';
proc.stdout.on('data', d => { log += d; });
proc.stderr.on('data', d => { log += d; });
const get = async p => { const r = await fetch(BASE + p); return { status: r.status, text: await r.text() }; };

try {
  for (let i = 0; i < 40 && !log.includes('Bound to'); i++) await sleep(100);
  check(log.includes('GLYPH ISLES'), 'server starts with node server.js');

  // ---- static files ----
  const cfg = await get('/config.js');
  check(cfg.status === 200 && cfg.text.includes('"game":"tongzhou-conjure"') && cfg.text.includes('"port":' + PORT), 'GET /config.js carries the game id and port');
  const idx = await get('/');
  check(idx.status === 200 && idx.text.includes('Glyph Isles'), 'GET / serves the game page');
  for (const f of ['/app.js', '/style.css', '/levels.js', '/content.js']) check((await get(f)).status === 200, 'GET ' + f);
  const three = await get('/vendor/three.min.js');
  check(three.status === 200 && three.text.length > 500000, 'GET /vendor/three.min.js serves the vendored renderer (no CDN)');
  check((await get('/vendor/qrcode.js')).status === 200, 'GET /vendor/qrcode.js');
  { const r = await fetch(BASE + '/vendor/MaShanZheng-subset.woff2'); check(r.status === 200 && r.headers.get('content-type') === 'font/woff2', 'GET the bundled brush font (no system font needed)'); }
  check((await get('/server.js')).status === 404 && (await get('/sim.js')).status === 404, 'server source is not served');
  check((await get('/vendor/..%2fserver.js')).status === 404, 'path traversal is refused');
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
  check(s0.k.length === 2 && s0.k.every(k => k[1] === '木' && k[2] === 'l') && s0.g.length === 3 && s0.t === 0, 'snapshot carries two 木 stones, three gems and a clock stopped at 0:00');
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
  const has = ch => mia.snap.k.some(k => k[1] === ch);
  const loose = ch => mia.snap.k.find(k => k[1] === ch && k[2] === 'l');
  await bot.go(10.3, 1.5); await bot.grab();
  check(mia.snap.k.some(k => k[6] === bot.id && k[1] === '木'), 'Mia picks up 木');
  check(mia.snap.aim && Array.isArray(mia.snap.aim[bot.id]), 'the snapshot carries her aim marker while she holds it');
  await bot.go(7.6, 2.5);
  await bot.toss(-1, 0);
  check(mia.snap.br.length === 1 && mia.snap.br[0][0] === 4 && mia.snap.br[0][2] === 3 && mia.snap.br[0][5] === '木', '木 thrown into the gap grows a 3-long bridge');
  await sleep(3900);
  check(mia.snap.k.filter(k => k[1] === '木').length === 1, 'the used-up 木 is gone for good (stones do not grow back)');
  check(mia.snap.ink === 4 && mia.snap.inkMax === 4, 'the snapshot carries the crew ink pool (4 drops for a crew of two)');
  await bot.go(10.3, 1.5);
  mia.send({ type: 'conjure', ch: '木', strokes: [[[0.15, 0.4], [0.85, 0.4]], [[0.5, 0.1], [0.5, 0.9]], [[0.5, 0.45], [0.18, 0.82]], [[0.5, 0.45], [0.82, 0.82]]] });
  for (let i = 0; i < 30 && mia.snap.k.filter(k => k[1] === '木').length < 2; i++) await sleep(50);
  check(mia.snap.k.filter(k => k[1] === '木').length === 2 && mia.snap.ink < 4, 'Mia writes 木 on her phone: a new one appears and the crew spends a drop');
  await sleep(800);
  await bot.grab();
  await bot.go(11, 3.5); await bot.go(10.5, 3.5);
  await sleep(120);
  check(mia.snap.aim[bot.id][3] === 'join', 'facing the other 木, the button offers to join them');
  await bot.grab();
  for (let i = 0; i < 40 && !has('林'); i++) await sleep(50);
  check(has('林') && !has('木'), '木 + 木 becomes 林');
  await sleep(700);
  const lin = loose('林');
  await bot.go(lin[3] + 0.6, lin[5]); await bot.grab();
  await bot.go(7.5, 2.5); await bot.go(3.5, 2.5); await bot.go(1.6, 2.5);
  await sleep(250);
  const res = board.snap.res;
  check(board.snap.ph === 'won' && res && res.by === bot.id && res.ch === '林', 'carrying 林 over the bridge to the shrine wins the stage');
  check(res && res.stars >= 1 && res.stars <= 3 && res.time > 3 && res.total === 3, `result: ${res && res.time}s, ${res && res.gems}/${res && res.total} gems, ${res && res.stars} star(s)`);
  const evt = t => board.events.some(e => e.t === t);
  check(evt('win') && evt('bridge') && evt('fuse') && evt('spent') && evt('conjure') && evt('found'), 'win, bridge, fuse, spent, conjure and found events were broadcast');

  // ---- 轻功, then all aboard: the boat takes everyone to the next isle ----
  check(board.snap.b && board.snap.b[2] === 'm' && board.snap.b[0] === 15.5, 'the snapshot carries the moored boat');
  bot.act('jump'); await sleep(160); bot.act('jump'); await sleep(900);
  check(evt('leap') && !(board.snap.p.find(p => p[0] === bot.id)[5] & 8), 'a second jump in mid-air is a 轻功 leap, and it spends the 气');
  const dadBot = new Bot(dad);
  await Promise.all([(async () => { await bot.go(7.5, 2.5); await bot.go(15.5, 2.5, 12000); })(), dadBot.go(15.5, 3.3, 12000)]);
  for (let i = 0; i < 200 && board.snap.st === 0; i++) await sleep(50);
  check(evt('board') && evt('sail') && board.snap.st === 1 && board.snap.ph === 'play', 'with everyone aboard the boat sails to stage 2');
  await sleep(300);
  const onBoat = id => { const q = board.snap.p.find(p => p[0] === id), b = board.snap.b; return Math.abs(q[1] - b[0]) < 1.5 && Math.abs(q[3] - b[1]) < 1.5; };
  check(onBoat(bot.id) && onBoat(dad.joined.id) && board.snap.m.length === 1 && board.snap.k.length === 4, 'and they arrive on its deck (a hedge, four stones ahead)');

  // ---- stage controls ----
  board.send({ type: 'admin', cmd: 'next' });
  await sleep(200);
  check(board.snap.st === 2 && board.snap.ph === 'play', 'the board skips to the next stage');
  board.send({ type: 'admin', cmd: 'goto', i: 0 });
  await sleep(200);
  check(board.snap.st === 0, 'and can jump to any stage');
  board.send({ type: 'admin', cmd: 'restart' });
  await sleep(200);
  check(board.snap.st === 0 && board.snap.t === 0, 'restart reloads the current stage');

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
console.log(failed ? `--- ${failed} CHECK(S) FAILED ---` : '--- ALL SMOKE CHECKS PASSED ---');
