// Four wobblers play real moments over the wire so tools/capture.py can
// photograph a running game. Prints "SHOT <name> [L] [P]", then holds the pose
// until capture.py answers with a line on stdin.
// Usage: node tools/puppets.mjs <port>
import readline from 'node:readline';
import { connect, Bot, sleep } from './wire.mjs';

process.on('uncaughtException', e => { console.log('ERR ' + e.message); process.exit(1); });
process.on('unhandledRejection', e => { console.log('ERR ' + (e && e.message)); process.exit(1); });
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
const stone = ch => board.snap.k.find(k => k[1] === ch && k[2] === 'l');
const has = ch => board.snap.k.some(k => k[1] === ch);
const take = async (b, ch) => { const k = stone(ch); if (!k) throw new Error('no loose ' + ch + ' to take'); await b.go(k[3] + 0.6, k[5]); await b.grab(); };
// a hop that tries again: over the wire a jump can leave a beat late and clip the ledge
const hop = async (b, x, z) => { for (let i = 0; ; i++) { try { b.act('jump'); await b.go(x, z, 1400); return; } catch (e) { if (i > 4) throw e; } } };
const say = (b, text) => b.c.send({ type: 'call', text });

// 1 — Two Trees: 木 becomes a bridge, 木 + 木 becomes 林, the shrine grows a forest
board.send({ type: 'admin', cmd: 'goto', i: 0 });
await sleep(1500);
await shot('00b-arriving-by-boat');
await sleep(1800);
await Promise.all([
  (async () => { await mia.go(10.3, 1.5); await mia.grab(); await mia.go(8.4, 2.5); })(),
  (async () => { await dad.go(11.5, 3.5); })(),
  (async () => { await nana.go(12.5, 1.2); })(),
  (async () => { await kai.go(13.0, 3.6); })()
]);
await shot('01-carry-a-character L');
await mia.go(7.6, 2.5);
await mia.toss(-1, 0);
await sleep(250);
await shot('02-wood-grows-a-bridge');
await sleep(3600);
await dad.go(10.4, 1.5); await dad.grab();
await dad.go(11, 3.5); await dad.go(10.5, 3.5);
await dad.grab();
for (let i = 0; i < 40 && !has('林'); i++) await sleep(50);
await sleep(900);
await shot('03-two-trees-make-a-grove P');
await sleep(1200);
await take(dad, '林');
await Promise.all([
  (async () => { await dad.go(7.5, 2.5); await dad.go(3.4, 2.5); })(),
  (async () => { await mia.go(3.0, 1.5); })(),
  (async () => { await sleep(900); await nana.go(8.5, 2.5); await nana.go(5.5, 2.5); })(),
  (async () => { await kai.go(8.5, 3.5); })()
]);
await shot('04-crossing-together');
await dad.go(1.6, 2.5);
await sleep(3200);
await shot('05-the-shrine-answers-forest');
// all aboard: three are on deck, the boat waits for Kai
await Promise.all([
  (async () => { await dad.go(7.5, 2.5); await dad.go(15.0, 2.5, 12000); })(),
  (async () => { await mia.go(3.5, 2.5); await mia.go(7.5, 2.5); await mia.go(15.8, 1.6, 12000); })(),
  (async () => { await nana.go(13.5, 2.5); await nana.go(15.6, 3.4); })()
]);
await sleep(300);
await shot('05b-all-aboard L');

// 2 — Sun and Moon: 火 burns the thorns, 日 + 月 = 明, night turns to day
await stage(1);
await Promise.all([
  (async () => { await mia.go(13.3, 1.5); await mia.grab(); await mia.go(12.2, 2.5); })(),
  (async () => { await dad.go(13.3, 3.5); await dad.grab(); })(),
  (async () => { await nana.go(15.5, 1.6); })(),
  (async () => { await kai.go(14.5, 3.5); })()
]);
await shot('06-night-and-thorns L');
await mia.go(11.0, 2.5);
await sleep(450);
await shot('07-fire-burns-thorns');
await sleep(1200);
await mia.go(11.5, 1.5); await mia.grab(); await sleep(500);
await dad.go(11, 2.5); await dad.go(6.6, 2.5);
await dad.toss(-1, 0);
await nana.grab();
await nana.go(11, 2.5); await nana.go(8.2, 2.5); await nana.go(8.2, 1.5); await nana.go(7.5, 1.5);
await nana.grab();
for (let i = 0; i < 40 && !has('明'); i++) await sleep(50);
await sleep(800);
await shot('08-sun-and-moon-make-bright P');
await sleep(1500);
await take(nana, '明');
await Promise.all([
  (async () => { await nana.go(6.5, 2.5); await nana.go(1.7, 2.5); })(),
  (async () => { await mia.go(11, 2.5); await mia.go(7.5, 3.4); })(),
  (async () => { await kai.go(11, 2.5); await kai.go(8.4, 2.5); })()
]);
await sleep(3600);
await shot('09-the-shrine-answers-daybreak P');

// 3 — Lean on a Tree: 水 douses the flames, 人 + 木 = 休, the stone rides the lift
await stage(2);
await Promise.all([
  (async () => { await mia.go(8.5, 6.5); await mia.go(8.5, 4.5); await mia.go(4.4, 4.5); await mia.go(4.4, 5.5); await mia.grab(); await mia.go(4.4, 4.5); await mia.go(8.0, 4.5); })(),
  (async () => { await dad.go(9.3, 6.5); })(),
  (async () => { await nana.go(7.5, 6.5); })(),
  (async () => { await kai.go(7.6, 6.3); await kai.go(7.6, 4.5); await kai.go(6.5, 4.5); await hop(kai, 6.5, 3.5); })()
]);
await shot('10-a-wall-of-flames L');
await mia.go(9.2, 4.5);
await sleep(500);
await shot('11-water-puts-out-fire');
await sleep(1200);
await mia.go(9.0, 4.5);   // she keeps 水: a set-down here would be a pass to Kai on the step
await dad.go(11.7, 5.5); await dad.grab();
await dad.go(9.4, 6.5); await dad.go(5, 6.5); await dad.go(4.5, 6.5);
await dad.grab();
for (let i = 0; i < 40 && !has('休'); i++) await sleep(50);
await sleep(2200);
await take(dad, '休');
await dad.go(4.5, 5.0); await dad.go(4.5, 4.45); await dad.grab(); await sleep(700);
await dad.go(5.2, 4.6);
await Promise.all([
  (async () => { await nana.go(8.5, 5.5); })(),
  (async () => { await hop(kai, 6.5, 2.5); await hop(kai, 6.5, 1.5); await kai.go(6.2, 1.5); })()
]);
await sleep(1300);
await shot('12-a-friend-holds-the-lift P');
await sleep(1500);
await kai.go(4.6, 1.5); await kai.go(4.6, 2.5); await kai.grab();
await kai.go(3.5, 2.5); await kai.go(1.6, 2.5);
await sleep(2600);
await shot('13-the-shrine-answers-rest');

// 4 — other ways across: boost a friend over the gap, row the boat round the isle
await stage(0);
await Promise.all([
  (async () => { await nana.go(10.3, 1.5); await nana.grab(); await nana.go(7.4, 2.5); })(),
  (async () => { await dad.go(10.3, 3.5); await dad.grab(); await dad.go(12.5, 2.5); await dad.go(15.5, 3.2); })(),
  (async () => { await sleep(2500); await mia.go(9.2, 2.5); })()
]);
await mia.go(8.6, 2.5); await mia.go(8.1, 2.5);
mia.act('grab');
await sleep(60);
await shot('14-boost-a-friend-over-the-gap');
await sleep(900);
kai.input(0, -1); await sleep(2600);
kai.input(-1, 0); await sleep(2600);
await shot('15-rowing-round-the-isle');
kai.stop();

for (const b of bots) b.c.close();
board.close();
rl.close();
console.log('DONE');
