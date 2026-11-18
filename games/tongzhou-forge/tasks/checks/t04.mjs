// Check for task 04 (the forge on the board). Run: node tasks/checks/t04.mjs   (about 40 seconds)
// Boots the real server on test port 3474, opens the real board page in headless chromium
// (tasks/checks/t04_board.py, ?strict=relaxed) and plays the dawn isle over the real protocol.
// Needs playwright for Python and /usr/bin/chromium, like tools/capture.py.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';
import { connect, Bot, sleep } from '../../tools/wire.mjs';

const PORT = 3474;
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ✓ ' : 'FAIL ✗ ') + m); if (!c) ok = false; };
const S = Math.SQRT1_2, R = [S, -S], D = [S, S];
const at = (k, r, q) => [k[3] + r * R[0] + q * D[0], k[5] + r * R[1] + q * D[1]];

try { execFileSync('node', ['tools/pack.mjs', '--check'], { stdio: 'pipe' }); check(true, 'content.js is up to date'); } catch (e) { check(false, 'content.js is up to date (run: node tools/pack.mjs)'); }
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), FIREWALL_CHECK: '0' }, stdio: 'ignore' });
let page = null;
try {
  await sleep(800);
  page = spawn('python3', ['tasks/checks/t04_board.py', String(PORT), 'strict=relaxed'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = readline.createInterface({ input: page.stdout })[Symbol.asyncIterator]();
  const next = async () => { const r = await Promise.race([lines.next(), sleep(20000).then(() => ({ value: 'TIMEOUT' }))]); return r.value || ''; };
  const ask = async (cmd, want) => { page.stdin.write(cmd + '\n'); for (;;) { const l = await next(); if (l === 'TIMEOUT') throw new Error('the board page did not answer ' + cmd); if (l.startsWith(want)) return l.slice(want.length).trim(); } };
  const state = async () => JSON.parse(await ask('STATE', 'STATE'));
  check((await next()) === 'READY', 'the board page opens (python3 + playwright + chromium)');

  const watch = await connect(PORT, { board: true });
  const mia = new Bot(await connect(PORT, { name: 'Mia', playerId: 'p-t04-mia' }));
  watch.send({ type: 'admin', cmd: 'goto', i: 3 });
  await sleep(3600);
  check(watch.snap.st === 3 && watch.snap.k.length === 2, 'the dawn isle is loaded (one 日, one 木)');

  const labels = JSON.parse(await ask('LABELS', 'LABELS'));
  check(labels && labels.join === 'BESIDE' && labels.stack === 'ON TOP' && labels.forge === 'FORGE', 'WForgeUI.AIM_LABEL names placements: join BESIDE, stack ON TOP, forge FORGE');
  check(labels && labels.pass === 'PASS' && labels.dunk === 'OFFER' && labels.toss === 'THROW' && labels.place === 'SET DOWN', 'and keeps PASS, OFFER, THROW and SET DOWN');

  let st = await state();
  check(!st.missing, 'window.WForgeUI.state() exists on the board');
  check(st.profile === 'relaxed', '?strict=relaxed on the board page reaches the server (state().profile is "relaxed")');
  check(st.gemSlots === 4, 'the gem counter has a slot for every gem and glow-gem (3 + 1 on dawn)');
  check(st.glowShown === 0 && st.dusk === false, 'in daylight the glow-gem is hidden');

  // 1. 日 set on the screen-right of 木: a dud that stays, so both stones show their placement
  const stone = ch => watch.snap.k.find(k => k[1] === ch && k[2] === 'l');
  let wood = stone('木');
  await mia.go(wood[3] + 0.6, wood[5] - 2.0); await mia.go(stone('日')[3] + 0.6, stone('日')[5]); await mia.grab();
  const [rx, rz] = at(wood, 0.95, 0), [px, pz] = at(wood, 1.3, 0);
  await mia.go(px, pz); await mia.go(rx, rz); await sleep(150);
  check(watch.snap.aim && watch.snap.aim[mia.id] && watch.snap.aim[mia.id][3] === 'join', 'screen-right of 木 holding 日, the aim is join (BESIDE)');
  await mia.grab(); await sleep(1200);
  st = await state();
  check(watch.events.some(e => e.t === 'dud'), '日 beside 木 makes nothing (dud)');
  check(st.ticks >= 1, `a placement tick is drawn between the two resting stones (ticks ${st.ticks})`);

  // 2. 木 set on top of 日: 杳, the isle dims, the glow-gem shows
  wood = stone('木');
  await mia.go(wood[3] - 0.6, wood[5]); await mia.grab();
  const sun = stone('日'), [fx, fz] = at(sun, 0, 0.95), [gx, gz] = at(sun, 0, 1.2);
  await mia.go(gx, gz); await mia.go(fx, fz); await sleep(150);
  check(watch.snap.aim[mia.id] && watch.snap.aim[mia.id][3] === 'stack', 'in front of 日 holding 木, the aim is stack (ON TOP)');
  await mia.grab(); await sleep(1500);
  st = await state();
  check(watch.events.some(e => e.t === 'forge' && e.ch === '杳'), '木 on top of 日 makes 杳');
  check(st.dusk === true && watch.snap.dk > 0, 'the board is in dusk while the snapshot says dk > 0');
  check(st.glowShown === 1, 'at dusk the glow-gem shows');
  check(st.bursts >= 1, `a forge burst played (${st.bursts})`);
  fs.mkdirSync('screenshots/forge', { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  await ask(`SHOT screenshots/forge/G1-${day}-dawn-dusk.png`, 'OK');

  // 3. carry 杳 away (nothing grows back within 1.4 of a stone), the stones grow back;
  //    日 set on top of 木: 杲, the light comes back
  const yao = stone('杳');
  await mia.go(yao[3] + 0.6, yao[5]); await mia.grab();
  await mia.go(12.0, 2.5); await mia.go(12.6, 2.5); await mia.grab(); await sleep(400);
  const grown = () => watch.snap.k.find(k => k[1] === '日' && k[2] === 'l' && Math.abs(k[3] - 10.5) < 0.05) && watch.snap.k.find(k => k[1] === '木' && k[2] === 'l' && Math.abs(k[3] - 9.5) < 0.05);
  for (let i = 0; i < 60 && !grown(); i++) await sleep(100);
  const sunNew = grown();
  check(!!sunNew, '日 and 木 grew back');
  if (sunNew) {
    await mia.go(11.1, 1.5); await mia.grab();
    wood = watch.snap.k.find(k => k[1] === '木' && k[2] === 'l' && Math.abs(k[3] - 9.5) < 0.05);
    const [bx, bz] = at(wood, 0, -0.95), [cx, cz] = at(wood, 0, -1.3);
    await mia.go(cx, cz); await mia.go(bx, bz); await sleep(150);
    await mia.grab(); await sleep(1500);
    st = await state();
    check(watch.events.some(e => e.t === 'forge' && e.ch === '杲'), '日 on top of 木 makes 杲');
    check(st.dusk === false && st.glowShown === 0, 'a light stone set down ends the dusk on the board too');
    check(st.bursts >= 2, `a second forge burst played (${st.bursts})`);
    await ask(`SHOT screenshots/forge/G1-${day}-dawn-sunrise.png`, 'OK');
  }

  // 4. variant forms: a piece in the left slot of ⿰ draws as its variant when the profile allows it
  const form = async (ch, op, slot) => JSON.parse(await ask(`FORM ${ch} ${op} ${slot}`, 'FORM'));
  check(await form('水', '⿰', 1) === '氵' && await form('水', '⿰', 2) === '水' && await form('木', '⿱', 1) === '木' && await form('心', '⿰', 1) === '忄',
    'WForgeUI.glyphFor draws 水 as 氵 (and 心 as 忄) only in the left slot of ⿰, while the profile shows forms');

  const errors = JSON.parse(await ask('ERRORS', 'ERRORS'));
  check(errors.length === 0, 'no page errors or console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  check(fs.existsSync(`screenshots/forge/G1-${day}-dawn-dusk.png`), 'a screenshot of the running board was saved in screenshots/forge/');
  page.stdin.write('QUIT\n');
  watch.close(); mia.c.close();
} catch (e) {
  check(false, 'the check ran to the end: ' + e.message);
} finally {
  if (page) page.kill();
  server.kill();
}
try { execFileSync('node', ['forge-test.mjs'], { stdio: 'pipe' }); check(true, 'node forge-test.mjs still passes'); } catch (e) { check(false, 'node forge-test.mjs still passes'); }
console.log(ok ? '--- TASK 04 DONE ---' : '--- TASK 04 NOT DONE ---'); process.exit(ok ? 0 : 1);
