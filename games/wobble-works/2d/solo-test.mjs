// WOBBLE WORKS 2D - one wobbler alone: slow hoist over the wall, and the unlatched plate/door.
// Run with: node solo-test.mjs   (real server on :3433 with WOBBLE_TEST=1)
import { spawn } from 'node:child_process';
import { dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const PORT = 3433, ROOT = dirname(fileURLToPath(import.meta.url));
const proc = spawn(process.execPath, ['../server.js', '--mode=2d'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), WOBBLE_TEST: '1', PLATE_GRACE_MS: '3000' }, stdio: process.env.WOBBLE_DEBUG ? 'inherit' : 'ignore' });
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
const tv = await client('TV', true), A = await client('Solo', false);
const me = () => tv.last.players.find((p) => p.name === 'Solo');
const core = () => tv.last.bodies.find((b) => b.kind === 'core');
const gate = () => tv.last.bodies.find((b) => b.kind === 'gate');
const inp = (o) => send(A, { type: 'input', left: false, right: false, jump: false, grabL: false, grabR: false, ...o });
await sleep(400);

// PLATE: Core parked on the plate opens the door; once it is removed the door closes after the grace period
send(tv, { type: 'testCore', x: 720, y: 726 }); await sleep(800);
check(gate().open, 'PLATE: the door opens while the Core sits on it');
send(tv, { type: 'testCore', x: 400, y: 726 }); await sleep(1000);
check(gate().open, 'PLATE: the door stays open for a grace period after release');
await sleep(3200);
check(!gate().open, 'PLATE: the door closes once nothing is on the plate (needs holding, not latched)');
// a wobbler standing on the plate holds it (Core moved out of the way first)
send(tv, { type: 'testCore', x: 1044, y: 726 });
for (let i = 0; i < 400 && !(me().x > 670 && me().x < 770); i++) { inp({ right: me().x < 700 }); await sleep(30); }
inp({}); await sleep(800); console.log('     solo at', Math.round(me().x), Math.round(me().y), 'gate', gate().open);
check(gate().open, 'PLATE: a single wobbler standing on it opens the door');
// run straight through the door within the grace period, Core parked at the wall foot
send(tv, { type: 'testCore', x: 1044, y: 726 });

// SOLO WALL: jump on the wall, grab the Core below, winch it up slowly
for (let i = 0; i < 400 && !(me().x > 1000); i++) { inp({ right: true }); await sleep(30); }
let on = false;
for (let i = 0; i < 100 && !on; i++) { const p = me(); inp({ right: true, jump: p.x > 960 && i % 4 < 2 }); await sleep(30); on = me().y < 665 && me().x > 1085 && me().grounded; }
check(on, 'SOLO: wobbler is on top of the wall');
for (let i = 0; i < 90; i++) { inp({ left: me().x > 1095 }); await sleep(30); }
console.log('     grab before', JSON.stringify(me().grab), 'hands', JSON.stringify(me().hx), JSON.stringify(me().hy), 'core', Math.round(core().x), Math.round(core().y));
const y0 = core().y; let minY = y0;
for (let i = 0; i < 220; i++) { inp({ grabL: true, grabR: true, jump: true }); await sleep(30); minY = Math.min(minY, core().y); if (i == 20) console.log('     grab at 20', JSON.stringify(me().grab), Math.round(core().y)); }
console.log('     core y ' + Math.round(y0) + ' -> min ' + Math.round(minY) + ' · solo x ' + Math.round(me().x) + ' y ' + Math.round(me().y));
check(minY < y0 - 60, 'SOLO HOIST: one wobbler alone lifts the Core (slowly)');
for (let i = 0; i < 400 && core().x < 1250; i++) { inp({ right: true, grabL: true, grabR: true, jump: core().y > 600 || core().x < 1090 }); await sleep(30); if (i % 25 == 0) console.log('     t', i, 'core', Math.round(core().x), Math.round(core().y), 'solo', Math.round(me().x), Math.round(me().y)); }
console.log('     core at x ' + Math.round(core().x) + ', y ' + Math.round(core().y));
check(core().x > 1200, 'SOLO OVER THE WALL: Core hauled past the wall by one player (x ' + Math.round(core().x) + ')');
inp({}); proc.kill(); process.exit(bad);
