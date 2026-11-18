// Check for card F4.3 (body forging on the board). Run: node tasks/checks/t08.mjs   (about 30 seconds)
// Boots the real server on test port 3475, opens the real board (tasks/checks/t04_board.py) and plays
// on-my-shoulders with two wire bots: both take a 火, Mia climbs onto Leo's head, Leo presses GRAB.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';
import { connect, Bot, sleep } from '../../tools/wire.mjs';

const PORT = 3475;
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ✓ ' : 'FAIL ✗ ') + m); if (!c) ok = false; };
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), FIREWALL_CHECK: '0' }, stdio: 'ignore' });
let page = null;
try {
  await sleep(800);
  page = spawn('python3', ['tasks/checks/t04_board.py', String(PORT), 'x=1'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = readline.createInterface({ input: page.stdout })[Symbol.asyncIterator]();
  const next = async () => { const r = await Promise.race([lines.next(), sleep(20000).then(() => ({ value: 'TIMEOUT' }))]); return r.value || ''; };
  const ask = async (cmd, want) => { page.stdin.write(cmd + '\n'); for (;;) { const l = await next(); if (l === 'TIMEOUT') throw new Error('the board page did not answer ' + cmd); if (l.startsWith(want)) return l.slice(want.length).trim(); } };
  const state = async () => JSON.parse(await ask('STATE', 'STATE'));
  check((await next()) === 'READY', 'the board page opens');

  const watch = await connect(PORT, { board: true });
  const mia = new Bot(await connect(PORT, { name: 'Mia', playerId: 'p-t08-mia' }));
  const leo = new Bot(await connect(PORT, { name: 'Leo', playerId: 'p-t08-leo' }));
  const STAGE = JSON.parse(fs.readFileSync('content/order.json', 'utf8')).indexOf('on-my-shoulders');
  watch.send({ type: 'admin', cmd: 'goto', i: STAGE });
  await sleep(3600);
  check(watch.snap.st === STAGE && watch.snap.k.filter(k => k[1] === '火').length === 2, 'on-my-shoulders is loaded (two 火)');
  const fires = watch.snap.k.filter(k => k[1] === '火').sort((a, b) => a[5] - b[5]);
  await mia.go(fires[0][3] + 0.7, fires[0][5]); await mia.grab();
  await leo.go(fires[1][3] + 0.7, fires[1][5]); await leo.grab();
  check(mia.pos.carrying && leo.pos.carrying, 'Mia and Leo each hold a 火');
  await leo.go(11.5, 2.5); await mia.go(11.5, 1.4);
  await sleep(300);
  mia.act('jump'); await sleep(60);
  const lp = leo.pos;
  await mia.go(lp.x, lp.z, 2500).catch(() => {});
  await sleep(500);
  const m = mia.pos;
  check(m.y > lp.y + 0.9, `Mia stands on Leo's head (Mia y ${m.y}, Leo y ${lp.y})`);
  const leoStone = watch.snap.k.find(k => k[6] === leo.id);
  check(leoStone && leoStone[9] === 1, 'Leo\'s 火 is in the arm hold (low 1 in the snapshot)');
  check(watch.snap.aim[mia.id] && watch.snap.aim[mia.id][3] === 'forge' && watch.snap.aim[leo.id] && watch.snap.aim[leo.id][3] === 'forge', 'both see FORGE');
  let st = await state();
  check(st.ticks >= 1, `the board draws the placement mark between the held stones (ticks ${st.ticks})`);
  fs.mkdirSync('screenshots/forge', { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  await ask(`SHOT screenshots/forge/G2-${day}-formation.png`, 'OK');
  await leo.grab(); await sleep(700);
  const f = watch.events.find(e => e.t === 'forge');
  check(f && f.ch === '炎' && f.held === true, 'Leo (at the bottom) presses GRAB: 火 on 火 forges 炎 in hand');
  const yan = watch.snap.k.find(k => k[1] === '炎');
  check(yan && yan[6] === leo.id, 'the 炎 is in Leo\'s hands');
  st = await state();
  check(st.bursts >= 1, 'the board plays the forge burst');
  await sleep(300);
  await ask(`SHOT screenshots/forge/G2-${day}-blaze.png`, 'OK');
  const errors = JSON.parse(await ask('ERRORS', 'ERRORS'));
  check(errors.length === 0, 'no page errors or console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  page.stdin.write('QUIT\n');
  watch.close(); mia.c.close(); leo.c.close();
} catch (e) {
  check(false, 'the check ran to the end: ' + e.message);
} finally {
  if (page) page.kill();
  server.kill();
}
console.log(ok ? '--- CHECK 08 DONE ---' : '--- CHECK 08 NOT DONE ---'); process.exit(ok ? 0 : 1);
