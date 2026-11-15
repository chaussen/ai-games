// WOBBLE WORKS 2D - wall/hoist contract: can two wobblers haul the Core over the stage-1 wall?
// Run with: node hoist-test.mjs   (boots the real server on :3432 with WOBBLE_TEST=1)
import { spawn } from 'node:child_process';
import { dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const PORT = 3432, ROOT = dirname(fileURLToPath(import.meta.url));
const proc = spawn(process.execPath, ['../server.js', '--mode=2d'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), WOBBLE_TEST: '1', PLATE_GRACE_MS: '600000' }, stdio: 'ignore' });
let bad = 0;
const check = (c, m) => { console.log((c ? 'PASS ✓ ' : 'FAIL ✗ ') + m); if (!c) bad = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(700);
function client(name, board) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws'); const c = { name, ws, last: null };
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', name, emoji: '🙂', board: !!board }));
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.type === 'state') c.last = m; else if (m.type === 'welcome') resolve(c); };
    setTimeout(() => reject(new Error('join timeout')), 4000);
  });
}
const send = (c, o) => c.ws.send(JSON.stringify(o));
const tv = await client('TV', true), B = await client('Low', false), A = await client('Top', false);
const me = (c) => c.last.players.find((p) => p.name === c.name);
const core = () => tv.last.bodies.find((b) => b.kind === 'core');
const inp = (c, o) => send(c, { type: 'input', left: false, right: false, jump: false, grabL: false, grabR: false, ...o });
await sleep(400);

// 1. plate opens the gate with no START pressed (the round must begin by itself)
send(tv, { type: 'testCore', x: 720, y: 726 }); await sleep(1200);
const gate = tv.last.bodies.find((b) => b.kind === 'gate');
check(gate.open, 'GATE opens when the Core sits on the plate');
check(tv.last.phase === 'playing', 'ROUND auto-starts without pressing START (was: stuck in lobby)');
send(tv, { type: 'testCore', x: 1044, y: 726 });

// 2. both run to the wall foot
for (let i = 0; i < 400 && !(me(A).x >= 1000 && me(B).x >= 880); i++) {
  for (const c of [A, B]) { const p = me(c); inp(c, { right: p.x < (c === A ? 1005 : 885) }); }
  await sleep(30);
}
console.log('     after run-up: A x', Math.round(me(A).x), 'B x', Math.round(me(B).x), 'core', Math.round(core().x));
// 3. Top jumps onto the wall (from x~1000 with a run-up)
let topOnWall = false;
for (let i = 0; i < 80 && !topOnWall; i++) {
  const p = me(A); inp(A, { right: true, jump: p.x > 960 && i % 4 < 2 });
  inp(B, {});
  await sleep(30);
  topOnWall = me(A).y < 665 && me(A).x > 1085 && me(A).grounded;
}
check(topOnWall, 'JUMP: a wobbler can jump onto the wall (y ' + Math.round(me(A).y) + ')');
// settle at the left edge of the top
for (let i = 0; i < 90; i++) { const p = me(A); inp(A, { left: p.x > 1100 }); inp(B, {}); await sleep(30); }
check(me(A).y < 665, 'Top stays on the wall (x ' + Math.round(me(A).x) + ', y ' + Math.round(me(A).y) + ')');

for (let i = 0; i < 90 && me(B).x < 985; i++) { inp(A, {}); inp(B, { right: true }); await sleep(30); }
for (let i = 0; i < 20; i++) { inp(A, {}); inp(B, {}); await sleep(30); }
// 4. heave: Top grabs from above, Low grabs from below, both hold JUMP
const y0 = core().y;
let minY = y0;
for (let i = 0; i < 160; i++) {
  inp(A, { grabL: true, grabR: true, jump: true });
  inp(B, { grabR: true, jump: true });
  await sleep(30);
  minY = Math.min(minY, core().y);
}
const g = tv.last.players.filter((p) => p.grab[0] || p.grab[1]).length;
console.log('     core y ' + Math.round(y0) + ' -> min ' + Math.round(minY) + ' · grabbers ' + g);
check(minY < y0 - 50, 'HOIST: two wobblers lift the Core off the ground');
// 5. pull it across: Top walks right holding on, Low pushes right
for (let i = 0; i < 200; i++) {
  inp(A, { right: true, grabL: true, grabR: true, jump: i < 60 });
  inp(B, { right: true, grabR: true, jump: i < 60 });
  await sleep(30);
}
console.log('     core now at x ' + Math.round(core().x) + ', y ' + Math.round(core().y));
check(core().x > 1250, 'OVER THE WALL: the Core got past the wall (x ' + Math.round(core().x) + ')');
// 6. mechanic recorded
for (const c of [A, B]) inp(c, {});
proc.kill();
process.exit(bad);
