// The crew (docs/CO-OP.md): boots the real server on test port 3489 (never 3000) and plays it with WebSocket
// clients the way phones do: join, hands, bodies that shove, a write whose strokes every phone sees, isle and
// knock changes by anyone, a fifth phone turned away, a lost connection that comes back to its own place.
// Each client mirrors the isle with sim.js restore() from the snapshots, as the page does.
// Run: node crew-test.mjs
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { World, consts } = require('./sim.js');
const PORT = 3489, base = 'http://127.0.0.1:' + PORT;
let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log('  FAIL ' + what); } };
const wait = ms => new Promise(r => setTimeout(r, ms));

// a phone: a socket, a mirrored world, the events and messages it got
function phone(id) {
  const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
  const ph = { ws, world: new World(), id: null, slot: 0, msgs: [], events: [], snaps: 0, cellsSnaps: 0, bytes: 0, open: false };
  ws.onopen = () => { ph.open = true; ws.send(JSON.stringify({ t: 'join', id })); };
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    ph.bytes += ev.data.length;
    if (m.t === 'joined') { ph.id = m.id; ph.slot = m.slot; }
    if (m.t === 'snap') { ph.world.restore(m.s); ph.snaps++; if (m.s.cells) ph.cellsSnaps++; ph.events.push(...m.e); }
    else ph.msgs.push(m);
  };
  ws.onclose = () => { ph.open = false; };
  ph.send = m => ws.send(JSON.stringify(m));
  ph.me = () => ph.world.players.get(ph.id);
  ph.until = async (fn, ms = 3000) => { for (let t = 0; t < ms; t += 20) { if (fn()) return true; await wait(20); } return false; };
  return ph;
}

const srv = spawn(process.execPath, [path.join(here, 'server.js')], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'inherit'] });
let out = '';
srv.stdout.on('data', d => { out += d; });
const phones = [];
try {
  for (let i = 0; i < 50 && !out.includes('localhost:' + PORT); i++) await wait(100);
  ok(out.includes('localhost:' + PORT), 'the server starts');
  const info0 = await (await fetch(base + '/crew.json')).json();
  ok(info0.players.length === 0 && info0.id === 'two-trees' && info0.knock === 'off', '/crew.json: nobody yet, the first isle, knock off');

  // ---- join
  const A = phone(), B = phone();
  phones.push(A, B);
  ok(await A.until(() => A.id && A.snaps > 2) && await B.until(() => B.id && B.snaps > 2), 'two phones join and get snapshots');
  ok(A.id !== B.id && A.slot !== B.slot && [A.slot, B.slot].every(s => s >= 1 && s <= 4), 'each has their own id and colour (' + A.slot + ', ' + B.slot + ')');
  ok(await A.until(() => A.world.players.size === 2 && A.me() && A.world.players.get(B.id)), 'each phone mirrors both players');
  ok(A.cellsSnaps === 1, 'the map comes once, with the first snapshot (' + A.cellsSnaps + ')');
  ok(A.msgs.some(m => m.t === 'roster' && m.players.length === 2), 'a roster lists the crew');

  // ---- hands: walk, and a friend's body in the way
  // both stand at the spawn, 0.7 apart; A walks toward B and keeps going: B is shoved, nobody overlaps
  const a0 = A.me(), b0 = A.world.players.get(B.id);
  const dir = Math.sign(b0.x - a0.x) || 1, bx0 = b0.x;
  A.send({ t: 'in', x: dir, j: false });
  await wait(900);
  A.send({ t: 'in', x: 0, j: false });
  await wait(150);
  const a1 = A.me(), b1 = A.world.players.get(B.id);
  ok(Math.abs(b1.x - bx0) > 0.3 && Math.sign(b1.x - bx0) === dir, 'walking into a friend shoves them (' + (b1.x - bx0).toFixed(2) + ')');
  ok(Math.abs(a1.x - b1.x) >= 2 * consts.PW - 0.01, 'the two never overlap');
  ok(A.events.some(e => e.t === 'bump' && e.id === A.id && e.other === B.id), 'the bump reaches the phones as an event');
  ok(Math.abs(B.world.players.get(A.id).x - a1.x) < 0.2, 'the other phone sees the same place');

  // ---- write: the stone in the writer's hands, the strokes for everyone
  const strokes = [[[0.1, 0.4], [0.9, 0.4]], [[0.5, 0.1], [0.5, 0.95]], [[0.5, 0.4], [0.15, 0.85]], [[0.5, 0.4], [0.85, 0.85]]];
  B.send({ t: 'write', ch: '木', strokes, n: 1 });
  ok(await B.until(() => B.msgs.some(m => m.t === 'wrote' && m.n === 1)), 'the writer gets an answer');
  const yes = B.msgs.find(m => m.t === 'wrote');
  ok(yes && yes.ok && yes.s, 'writing 木 on Two Trees works');
  ok(await A.until(() => A.events.some(e => e.t === 'write' && e.id === B.id)), 'the other phone hears of the write');
  const we = A.events.find(e => e.t === 'write' && e.id === B.id);
  ok(we && Array.isArray(we.strokes) && we.strokes.length === 4 && we.strokes[1][1][1] === 0.95, 'the write carries the strokes, for everyone to replay');
  ok(await A.until(() => { const p = A.world.players.get(B.id); return p && p.hold && p.hold.ch === '木' && p.hold.by === B.id; }), 'every phone sees the stone in the writer\'s hands, marked as theirs');
  B.send({ t: 'write', ch: '林', strokes, n: 2 });
  ok(await B.until(() => B.msgs.some(m => m.t === 'wrote' && m.n === 2)) && B.msgs.find(m => m.n === 2).why === 'want', 'writing the goal is refused, with the reason');
  await wait(1100);   // the write cooldown (CONJURE.cooldown, standard 1 s)
  B.send({ t: 'write', ch: '木', strokes: [[['x', 1]]], n: 3 });
  ok(await B.until(() => B.msgs.some(m => m.t === 'wrote' && m.n === 3)), 'bad strokes: still an answer');
  await A.until(() => A.events.filter(e => e.t === 'write' && e.id === B.id).length === 2);
  const bad = A.events.filter(e => e.t === 'write' && e.id === B.id).pop();
  ok(B.msgs.find(m => m.n === 3).ok && bad && Array.isArray(bad.strokes) && bad.strokes.length === 0, 'bad strokes are dropped, never passed on (the write still works)');

  // ---- anyone changes the isle; the map comes again
  const cells0 = A.cellsSnaps;
  B.send({ t: 'isle', i: 3 });
  ok(await A.until(() => A.world.index === 3 && A.events.some(e => e.t === 'isle' && e.i === 3)), 'anyone changes the isle: every phone follows');
  ok(A.cellsSnaps === cells0 + 1, 'the new isle\'s map comes once');
  { const w3 = new World(); w3.load(3); ok(A.world.cells.map(r => r.join('')).join() === w3.cells.map(r => r.join('')).join(), 'the phone\'s map is the new isle\'s'); }
  A.send({ t: 'knock', mode: 'push' });
  ok(await B.until(() => B.world.bd.knock === 'push'), 'anyone sets the knock: every phone knows');
  A.send({ t: 'knock', mode: 'off' });
  A.send({ t: 'profile', name: 'relaxed' });
  ok(await B.until(() => B.world.k.profile === 'relaxed'), 'anyone sets the profile');

  // ---- the board sets the crew's profile and knock
  const posted = await (await fetch(base + '/crew', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: 'strict', knock: 'loose' }) })).json();
  ok(posted.profile === 'strict' && posted.knock === 'loose', 'POST /crew sets the profile and knock');
  ok(await A.until(() => A.world.k.profile === 'strict' && A.world.bd.knock === 'loose'), 'and the phones follow');
  const junk = await fetch(base + '/crew', { method: 'POST', body: 'not json' });
  ok(junk.status === 200 && (await junk.json()).profile === 'strict', 'junk to POST /crew changes nothing');
  await fetch(base + '/crew', { method: 'POST', body: JSON.stringify({ profile: 'standard', knock: 'off' }) });

  // ---- four at most
  const C = phone(); phones.push(C); await C.until(() => C.id);
  const D = phone(); phones.push(D); await D.until(() => D.id);
  const E = phone(); phones.push(E);
  ok(await E.until(() => E.msgs.some(m => m.t === 'full')), 'a fifth phone is told the crew is full');
  ok(E.id === null, 'and is not given a player');
  const info = await (await fetch(base + '/crew.json')).json();
  ok(info.players.length === 4 && new Set(info.players.map(p => p.slot)).size === 4, '/crew.json lists four players in four colours');

  // ---- a lost connection keeps its place, and comes back to it
  const lost = C.id, slot = C.slot;
  C.ws.close();
  await C.until(() => !C.open);
  await wait(200);
  ok(A.world.players.has(lost), 'a phone that lost the connection keeps its place for a while');
  const C2 = phone(lost);
  phones.push(C2);
  ok(await C2.until(() => C2.id && C2.snaps > 1), 'it comes back');
  ok(C2.id === lost && C2.slot === slot, 'with the same player and colour');
  ok(C2.cellsSnaps === 1, 'and gets the map again');

  // ---- the same id twice (a duplicated tab) is a new player, not a takeover
  const F = phone(A.id);
  phones.push(F);
  ok(await F.until(() => F.msgs.some(m => m.t === 'full' || m.t === 'joined')), 'a duplicate id gets an answer');
  ok(F.id !== A.id, 'a duplicate id never takes over a connected player');

  // ---- the wire
  const per = A.bytes / Math.max(1, A.snaps);
  ok(per < 6000, 'a snapshot is small enough for Wi-Fi (' + Math.round(per) + ' bytes with four players)');
} catch (e) {
  fail++; console.log('  FAIL threw: ' + (e && e.stack || e));
} finally {
  for (const p of phones) try { p.ws.close(); } catch (e) {}
  srv.kill();
}
console.log(fail ? `CREW TESTS: ${pass} passed, ${fail} FAILED` : `ALL ${pass} CREW TESTS PASSED`);
process.exit(fail ? 1 : 0);
