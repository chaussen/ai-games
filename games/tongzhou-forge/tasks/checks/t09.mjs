// Check for the element effects on the board: light dispels shade (early-light), earth raises a
// mound (fruit-field). Run: node tasks/checks/t09.mjs   (about 30 seconds)
// Real server on test port 3476, real board page (tasks/checks/t04_board.py), wire bots.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';
import { connect, Bot, sleep } from '../../tools/wire.mjs';

const PORT = 3476;
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ✓ ' : 'FAIL ✗ ') + m); if (!c) ok = false; };
const order = JSON.parse(fs.readFileSync('content/order.json', 'utf8'));
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), FIREWALL_CHECK: '0' }, stdio: 'ignore' });
let page = null;
try {
  await sleep(800);
  page = spawn('python3', ['tasks/checks/t04_board.py', String(PORT), 'x=1'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = readline.createInterface({ input: page.stdout })[Symbol.asyncIterator]();
  const next = async () => { const r = await Promise.race([lines.next(), sleep(20000).then(() => ({ value: 'TIMEOUT' }))]); return r.value || ''; };
  const ask = async (cmd, want) => { page.stdin.write(cmd + '\n'); for (;;) { const l = await next(); if (l === 'TIMEOUT') throw new Error('the board page did not answer ' + cmd); if (l.startsWith(want)) return l.slice(want.length).trim(); } };
  check((await next()) === 'READY', 'the board page opens');
  const day = new Date().toISOString().slice(0, 10);
  fs.mkdirSync('screenshots/forge', { recursive: true });

  const watch = await connect(PORT, { board: true });
  const mia = new Bot(await connect(PORT, { name: 'Mia', playerId: 'p-t09-mia' }));
  const stone = ch => watch.snap.k.find(k => k[1] === ch && k[2] === 'l');

  // 1. early-light: carry 日 to the shade wall
  watch.send({ type: 'admin', cmd: 'goto', i: order.indexOf('early-light') });
  await sleep(3600);
  const sun = stone('日');
  await mia.go(sun[3] + 0.7, sun[5]); await mia.grab();
  check(mia.pos.carrying, 'Mia takes 日 on early-light');
  await mia.go(5.5, 2.5); await mia.go(4.6, 2.5);
  await sleep(500);
  check(watch.events.some(e => e.t === 'dispel' && e.ch === '日'), '日 carried up to the shade dispels it');
  await sleep(250);
  await ask(`SHOT screenshots/forge/E-${day}-dispel.png`, 'OK');

  // 2. fruit-field: throw 田 into the gap
  watch.send({ type: 'admin', cmd: 'goto', i: order.indexOf('fruit-field') });
  await sleep(3600);
  const field = stone('田');
  await mia.go(field[3] + 0.7, field[5]); await mia.grab();
  await mia.go(5.5, 6.5);
  await mia.toss(0, -1);
  await sleep(800);
  check(watch.events.some(e => e.t === 'bridge' && e.ch === '田'), '田 thrown into the gap raises a field across it');
  await sleep(600);
  await ask(`SHOT screenshots/forge/E-${day}-field.png`, 'OK');

  const errors = JSON.parse(await ask('ERRORS', 'ERRORS'));
  check(errors.length === 0, 'no page errors or console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  page.stdin.write('QUIT\n');
  watch.close(); mia.c.close();
} catch (e) {
  check(false, 'the check ran to the end: ' + e.message);
} finally {
  if (page) page.kill();
  server.kill();
}
console.log(ok ? '--- CHECK 09 DONE ---' : '--- CHECK 09 NOT DONE ---'); process.exit(ok ? 0 : 1);
