// Check for the G1 playtest fixes (2026-11-18, FG-D017). Run: node tasks/checks/t10.mjs  (about 40 s)
// Real server on test port 3480, the real board page (t04_board.py) and a real portrait phone page
// (t10_phone.py), wire bots. Saves screenshots of the running build to screenshots/forge/.
//   1. a placement draws a frame (BESIDE / ON TOP) round the two stones
//   2. a dud names the arrangement and says honestly that the pair works another way
//   3. a near miss is not silent
//   4. the writing pad opens blank, with ideas to try; tapping one shows it to copy
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';
import { connect, Bot, sleep } from '../../tools/wire.mjs';

const PORT = 3480;
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ✓ ' : 'FAIL ✗ ') + m); if (!c) ok = false; };
const S = Math.SQRT1_2, R = [S, -S], D = [S, S];
const at = (k, r, q) => [k[3] + r * R[0] + q * D[0], k[5] + r * R[1] + q * D[1]];
const driver = (script, args) => {
  const proc = spawn('python3', [script, ...args], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = readline.createInterface({ input: proc.stdout })[Symbol.asyncIterator]();
  const next = async () => { const r = await Promise.race([lines.next(), sleep(25000).then(() => ({ value: 'TIMEOUT' }))]); return r.value || ''; };
  const ask = async (cmd, want) => { proc.stdin.write(cmd + '\n'); for (;;) { const l = await next(); if (l === 'TIMEOUT') throw new Error(script + ' did not answer ' + cmd); if (l.startsWith(want)) return l.slice(want.length).trim(); } };
  return { proc, next, ask };
};

const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), FIREWALL_CHECK: '0' }, stdio: 'ignore' });
let board = null, phone = null;
try {
  await sleep(800);
  board = driver('tasks/checks/t04_board.py', [String(PORT), 'x=1']);
  check((await board.next()) === 'READY', 'the board page opens');
  const day = new Date().toISOString().slice(0, 10);
  const shot = f => `screenshots/forge/G1fix-${day}-${f}.png`;
  fs.mkdirSync('screenshots/forge', { recursive: true });

  const watch = await connect(PORT, { board: true });
  const mia = new Bot(await connect(PORT, { name: 'Mia', playerId: 'p-t10-mia' }));
  watch.send({ type: 'admin', cmd: 'goto', i: 3 });   // dawn: 日 and 木
  await sleep(3600);
  const stone = ch => watch.snap.k.find(k => k[1] === ch && k[2] === 'l');
  const frames = async () => JSON.parse(await board.ask('FRAMES', 'FRAMES'));
  const feed = async () => JSON.parse(await board.ask('FEED', 'FEED'));

  // 1 + 2. 日 set on the screen-right of 木: 木 ⿰ 日 makes nothing, but 日 and 木 do stack (杲 / 杳)
  const wood = stone('木');
  await mia.go(wood[3] + 0.6, wood[5] - 2.0); await mia.go(stone('日')[3] + 0.6, stone('日')[5]); await mia.grab();
  const [rx, rz] = at(wood, 0.95, 0), [px, pz] = at(wood, 1.3, 0);
  await mia.go(px, pz); await mia.go(rx, rz); await sleep(150);
  await mia.grab(); await sleep(900);
  const dud = watch.events.find(e => e.t === 'dud');
  check(dud && dud.op === '⿰' && dud.other === true, 'the dud reaches the board with other: true (日 and 木 do go together, stacked)');
  check(dud && !('why' in dud && dud.why !== undefined), 'the dud still carries no why (the log keeps that)');
  let fr = await frames();
  check(fr.some(f => /\bside\b/.test(f.cls) && /\bno\b/.test(f.cls) && f.label.includes('BESIDE')), 'right after the dud, a red BESIDE frame is drawn round the two stones: ' + JSON.stringify(fr));
  let text = await feed();
  check(/木 on the left, 日 on the right: makes nothing/.test(text), 'the message names the arrangement (木 on the left, 日 on the right)');
  check(/do go together, another way/.test(text), 'and says honestly that the two do go together another way');
  await board.ask(`SHOT ${shot('dud')}`, 'OK');
  await sleep(2600);
  fr = await frames();
  check(fr.some(f => f.cls === 'pframe side' && f.label === 'BESIDE'), 'once the dud has been shown, the frame stays as a neutral BESIDE frame while the stones rest there');
  await board.ask(`SHOT ${shot('beside')}`, 'OK');

  // 3. a near miss: 日 thrown so it lands close to 木 but out of line. A stone set down facing 木
  //    always lands on the ideal spot (the aim), so near misses come from throws, pushes and lifts.
  const sunNow = stone('日');
  await mia.go(sunNow[3] + 0.6, sunNow[5] - 1.6); await mia.go(sunNow[3] + 0.6, sunNow[5]); await mia.grab();
  const w2 = stone('木'), [mx, mz] = at(w2, 3.9, 0.5);
  await mia.go(mx, mz); await sleep(150);
  const before = watch.events.length;
  await mia.toss(-R[0], -R[1]); await sleep(600);
  const near = watch.events.slice(before).find(e => e.t === 'near');
  { const s2 = stone('日'), dx = s2[3] - w2[3], dz = s2[5] - w2[5]; console.log('   (日 landed at r ' + (dx * R[0] + dz * R[1]).toFixed(2) + ', q ' + (dx * D[0] + dz * D[1]).toFixed(2) + ' from 木; events ' + watch.events.slice(before).map(e => e.t).join(',') + ')'); }
  check(!!near, 'a thrown 日 landing close to 木 but out of line sends a near event (was silent before)');
  fr = await frames();
  check(!near || fr.some(f => /\bnear\b/.test(f.cls) && f.label === 'NOT QUITE'), 'and the board draws a dashed NOT QUITE frame');
  check(!near || /not quite/.test(await feed()), 'and says the stones are close but not quite in place');
  if (near) await board.ask(`SHOT ${shot('near')}`, 'OK');

  // 4. the phone: portrait follow camera and the writing pad
  phone = driver('tasks/checks/t10_phone.py', [String(PORT), 'Lena']);
  check((await phone.next()) === 'READY', 'the phone page opens in portrait and joins');
  await sleep(1500);
  await phone.ask(`SHOT ${shot('phone-portrait')}`, 'OK');
  const pad = JSON.parse(await phone.ask('DRAW', 'DRAW'));
  check(pad.open, 'DRAW opens the writing pad');
  check(pad.guide === null, 'the pad opens blank: no character is shown in the square (was 木)');
  check(!pad.modeBtn, 'there is no Trace / Free switch any more');
  check(pad.useBtn === null, '"Use … without drawing" is hidden until a character is chosen');
  check(/Ideas to try/.test(pad.head) && pad.ideas.length >= 2 && !/Practice next/.test(pad.head), 'the bottom row is "Ideas to try" with the isle\'s characters: ' + pad.ideas.join(' '));
  check(/Write any character you know/.test(pad.status), 'the status invites writing anything: ' + pad.status);
  await phone.ask(`SHOT ${shot('pad-blank')}`, 'OK');
  const one = JSON.parse(await phone.ask('IDEA 0', 'IDEA'));
  check(one.guide === pad.ideas[0] && one.selected[0] === pad.ideas[0], 'tapping an idea shows it in the square to copy');
  check(one.useBtn && one.useBtn.includes(pad.ideas[0]) && /Copy/.test(one.status), 'and offers to copy it, or use it without drawing');
  await phone.ask(`SHOT ${shot('pad-copy')}`, 'OK');
  const off = JSON.parse(await phone.ask('IDEA 0', 'IDEA'));
  check(off.guide === null && off.selected.length === 0, 'tapping it again hides the model (write from memory)');

  const errs = [...JSON.parse(await board.ask('ERRORS', 'ERRORS')), ...JSON.parse(await phone.ask('ERRORS', 'ERRORS'))];
  check(errs.length === 0, 'no page errors or console errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  board.proc.stdin.write('QUIT\n'); phone.proc.stdin.write('QUIT\n');
  watch.close(); mia.c.close();
} catch (e) {
  check(false, 'the check ran to the end: ' + e.message);
} finally {
  if (board) board.proc.kill();
  if (phone) phone.proc.kill();
  server.kill();
}
console.log(ok ? '--- CHECK 10 DONE ---' : '--- CHECK 10 NOT DONE ---');
process.exit(ok ? 0 : 1);
