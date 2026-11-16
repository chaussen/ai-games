// Four wobblers play real co-op moments over the wire so tools/capture.py can
// photograph a running game. Prints "SHOT <name> [L] [P]", then holds the pose
// until capture.py answers with a line on stdin.
// Usage: node tools/puppets.mjs <port>
import readline from 'node:readline';
import { connect, Bot, sleep } from './wire.mjs';

const port = Number(process.argv[2] || 3472);
const board = await connect(port, { board: true });
const names = ['Mia', 'Dad', 'Nana', 'Kai'];
const bots = [];
for (const n of names) bots.push(new Bot(await connect(port, { name: n, playerId: 'p-shot-' + n.toLowerCase() })));
const [mia, dad, nana, kai] = bots;
const rl = readline.createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();
const shot = async tag => { console.log('SHOT ' + tag); await lines.next(); };
const stage = async i => { board.send({ type: 'admin', cmd: 'goto', i }); await sleep(3300); };
const crate = k => board.snap.cr[k];
const say = (b, text) => b.c.send({ type: 'call', text });

// 1 — First Light: carry up the steps, pass over the gap, deliver
await stage(0);
await Promise.all([
  (async () => { await mia.go(11.3, 2.5); await mia.grab(); await mia.go(8.4, 2.5); })(),
  (async () => { await dad.go(9.6, 3.5); await dad.go(7.4, 3.5); await dad.leap(-1, 0, () => dad.pos.x < 6.25, () => dad.pos.x < 3.9); await dad.go(3.0, 2.5); })(),
  (async () => { await nana.go(10.0, 4.5); })(),
  (async () => { await kai.go(12.5, 1.5); })()
]);
await shot('01-first-light');
await mia.go(6.6, 2.5);
say(dad, 'Here!');
await sleep(350);
await shot('02-pass-over-the-gap L');
await mia.grab();
await sleep(700);
await dad.go(1.5, 2.5);
await sleep(1100);
await shot('03-stage-clear');

// 2 — Hold the Door: one holds the plate, one carries through, then swap
await stage(1);
await Promise.all([
  (async () => { await dad.go(13.5, 2.6); await dad.go(13.5, 3.5); })(),
  (async () => { await mia.go(13.0, 1.5); await mia.grab(); })(),
  (async () => { await kai.go(15.5, 1.5); })()
]);
await sleep(900);
await mia.go(12.5, 2.5); await mia.go(11.6, 2.5);
say(mia, 'Go go!');
await shot('04-hold-the-door');
await mia.go(10.5, 2.5); await mia.go(10.5, 1.5); await mia.go(9.5, 1.5);
await dad.go(12.5, 2.5); await dad.go(10.5, 2.5); await dad.go(10.5, 3.5); await dad.go(8.5, 3.5);
await sleep(900);
await mia.go(8.5, 1.5); await mia.go(7.5, 2.5); await mia.go(5.2, 2.5);
await shot('05-bridge L');

// 3 — Going Up: the Core rides the lift while a friend holds the plate
await stage(2);
await Promise.all([
  (async () => { await mia.go(5.0, 6.5); await mia.go(4.3, 5.5); await mia.grab(); await mia.go(4.5, 5.0); await mia.go(4.6, 3.2); })(),
  (async () => { await kai.go(6.5, 4.5); await kai.hop(6.5, 3.5); })(),
  (async () => { await nana.go(9.5, 4.5); })()
]);
await dad.go(8.5, 5.5);
await sleep(1000);
await shot('06-going-up P');

// 4 — Bucket Brigade: pass the Core up a step
await stage(3);
await Promise.all([
  (async () => { await dad.go(12.5, 3.5); await dad.hop(11.2, 3.5); })(),
  (async () => { await nana.go(12.5, 5.5); await nana.hop(11.5, 5.5); await nana.go(8.6, 5.3); await nana.hop(7.4, 5.3); })(),
  (async () => { await mia.go(13.2, 4.2); await mia.grab(); await mia.go(13.4, 3.5); await mia.go(12.6, 3.5); })()
]);
say(dad, 'Here!');
await sleep(300);
await shot('07-pass-up-a-step P');

// 5 — The Works: crate on the gate plate, Core on the lift, friends on the steps
await stage(4);
await dad.go(13.5, 4.5); await dad.go(12.5, 4.5);
await dad.hold(0, 1, () => crate(0)[2] >= 6.45);
await mia.go(12.1, 4.5); await mia.grab();
await mia.go(11.5, 5.5); await mia.go(9.5, 5.5); await mia.go(7.6, 5.0); await mia.go(7.6, 3.2);
await Promise.all([
  (async () => { await nana.go(11.5, 5.5); await nana.go(9.5, 5.5); await nana.go(9.5, 4.5); await nana.hop(9.5, 3.5); await nana.hop(9.5, 2.5); await nana.go(8.5, 1.0); })(),
  (async () => { await kai.go(12.5, 4.5); await kai.go(11.5, 5.5); await kai.go(8.5, 5.5); await kai.go(7.5, 5.5); await kai.hold(-1, 0, () => crate(1)[0] <= 5.55); })()
]);
await sleep(700);
await shot('08-the-works');

for (const b of bots) b.c.close();
board.close();
rl.close();
console.log('DONE');
