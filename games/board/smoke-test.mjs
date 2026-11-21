// The board launcher, for real: board.sh starts each game on a test port (3488, never 3000) without opening a
// window, the board page and the phone page answer, switching game stops the last one, stop frees the port,
// and a port held by something else is never killed. Run: node smoke-test.mjs
import { spawnSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';
import net from 'net';
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3488;
const env = { ...process.env, PORT: String(PORT), BOARD_OPEN: '0', XDG_STATE_HOME: path.join(process.env.TMPDIR || '/tmp', 'board-smoke-' + process.pid) };
let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log('  FAIL ' + what); } };
const board = (...a) => spawnSync('bash', [path.join(here, 'board.sh'), ...a], { env, encoding: 'utf8', timeout: 20000 });
const get = (p) => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => r({ code: res.statusCode, body: b })); }).on('error', () => r({ code: 0, body: '' })));
const free = () => new Promise(r => { const s = net.createServer().once('error', () => r(false)).once('listening', () => s.close(() => r(true))).listen(PORT, '127.0.0.1'); });

ok(await free(), `port ${PORT} is free before the test`);

// the 2D game: its own board page with a QR code, look and profile in the phone link
let r = board('2d', 'cut', 'relaxed');
ok(r.status === 0, '2d cut relaxed starts (' + (r.stderr || '').trim() + ')');
ok(/Board:\s+http:\/\/localhost:3488\/board\?art=cut&profile=relaxed/.test(r.stdout), 'it prints the board address');
ok(/Phones:\s+http:\/\/[\d.]+:3488\/\?art=cut&profile=relaxed/.test(r.stdout) || /Phones:\s+http:\/\/localhost/.test(r.stdout), 'it prints the phone address');
let b = await get('/board');
ok(b.code === 200 && /同舟/.test(b.body) && /qrcode\.js/.test(b.body), '/board is the board page');
ok((await get('/board.js')).code === 200 && (await get('/vendor/qrcode.js')).code === 200, 'the board script and the QR library are served');
let c = await get('/config.js');
ok(c.code === 200 && /F2D_CONFIG/.test(c.body) && c.body.includes('"port":3488'), '/config.js tells the board its address and port');
ok((await get('/')).code === 200, 'the game itself answers');

// switching to another game stops the 2D one first
for (const [g, check] of [['3d', /Forge|同舟|board/i], ['conjure', /./], ['isles', /./]]) {
  r = board(g);
  ok(r.status === 0, g + ' starts after the last game (' + (r.stderr || '').trim() + ')');
  const home = await get('/');
  ok(home.code === 200 && check.test(home.body), g + ': the page answers');
  ok((await get('/board.js')).code !== 200, g + ': the 2D server is gone');
}
r = board('3d', 'relaxed');
ok(r.status === 0 && /\?board=1&strict=relaxed/.test(r.stdout), '3d relaxed opens the board with the profile');

r = board('status');
ok(r.status === 0 && /Port 3488: pid \d+/.test(r.stdout) && /Started as: board.sh 3d relaxed/.test(r.stdout), 'status says what runs');
r = board('stop');
ok(r.status === 0 && await free(), 'stop frees the port');
ok(/Nothing is running/.test(board('stop').stdout), 'stop again: nothing to stop');

// bad arguments are refused before anything starts
ok(board('2d', 'neon').status !== 0 && await free(), 'an unknown look is refused');
ok(board('2d', 'ink', 'hard').status !== 0 && await free(), 'an unknown profile is refused');
ok(board('pong').status !== 0, 'an unknown game is refused');

// a port held by something that is not one of our games is never killed
const other = spawn(process.execPath, ['-e', `require('http').createServer((q, s) => s.end('other')).listen(${PORT}, '127.0.0.1')`], { stdio: 'ignore' });
await new Promise(res => setTimeout(res, 400));
r = board('2d');
ok(r.status !== 0 && /not a game from this repo/.test(r.stderr), 'a foreign server on the port is left alone, with a message');
ok((await get('/')).body === 'other', 'and it still runs');
other.kill();

console.log(fail ? `BOARD TESTS: ${pass} passed, ${fail} FAILED` : `ALL ${pass} BOARD TESTS PASSED`);
process.exit(fail ? 1 : 0);
