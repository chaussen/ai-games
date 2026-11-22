// smoke-test.mjs: boots the real server on test port 3501 (never 3000) and checks what a phone gets and what
// the crew does: the page and every script, only local files, the stroke data for the recogniser, the board,
// the room knobs, and the WebSocket crew the way phones play it — join, snapshots (grid once, entities after),
// a write that puts 火 in your hand, an unknown character refused, a throw, a fifth phone turned away.
// Run: node smoke-test.mjs
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { World } = require('./sim.js');
const { M } = require('./reactions.js');
const CARDS = require('./content.js').cards;
const PORT = 3501, base = 'http://127.0.0.1:' + PORT;
let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log('  FAIL ' + what); } };
const wait = ms => new Promise(r => setTimeout(r, ms));

// a phone: a socket, a mirrored world (applyWire() only, as the page does), the messages it got
function phone(id) {
  const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
  const ph = { ws, world: null, id: null, slot: -1, msgs: [], events: [], snaps: 0, cellsSnaps: 0, bytes: 0, open: false };
  ws.onopen = () => { ph.open = true; ws.send(JSON.stringify({ t: 'join', id })); };
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    ph.bytes += ev.data.length;
    if (m.t === 'joined') {
      ph.id = m.id; ph.slot = m.slot | 0;
      ph.world = new World({ w: m.w, h: m.h, cards: CARDS });
    } else if (m.t === 'snap') {
      if (!ph.world) ph.world = new World({ w: 160, h: 90, cards: CARDS });
      ph.world.applyWire(m.s);
      ph.snaps++; if (m.s.rows) ph.cellsSnaps++;
      ph.events.push(...(m.e || []));
    } else ph.msgs.push(m);
  };
  ws.onclose = () => { ph.open = false; };
  ph.send = m => ws.send(JSON.stringify(m));
  ph.me = () => ph.world && ph.world.player(ph.id);
  ph.until = async (fn, ms = 3000) => { for (let t = 0; t < ms; t += 20) { if (fn()) return true; await wait(20); } return false; };
  return ph;
}

const srv = spawn(process.execPath, [path.join(here, 'server.js')], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'inherit'] });
let out = '';
srv.stdout.on('data', d => { out += d; });
try {
  for (let i = 0; i < 50 && !out.includes('localhost:' + PORT); i++) await wait(100);
  ok(out.includes('http://localhost:' + PORT + '/'), 'the server prints its address');
  const get = async (p) => { const r = await fetch(base + p); return { status: r.status, type: r.headers.get('content-type') || '', body: await r.text() }; };

  // ---- the page and what it loads
  const page = await get('/');
  ok(page.status === 200 && page.type.startsWith('text/html'), 'GET / is the page');
  ok(/神笔/.test(page.body) && /书/.test(page.body), 'the page is Shenbi with the pad');
  const refs = [...page.body.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  ok(refs.length >= 5 && refs.every(r => !/^(https?:)?\/\//.test(r)), 'the page loads only local files (' + refs.join(', ') + ')');
  for (const r of refs) {
    const g = await get('/' + r);
    ok(g.status === 200, 'GET /' + r + ' → ' + g.status);
    if (r.endsWith('.js')) ok(g.type.startsWith('text/javascript'), r + ' is served as JavaScript');
  }
  // only what the page needs is served (repo rule: tests, docs, tools stay off the wire)
  for (const p of ['/smoke-test.mjs', '/server.js', '/cards.json', '/docs/CHARTER.md', '/../CLAUDE.md', '/%2e%2e/CLAUDE.md', '/vendor/%2e%2e/server.js', '/vendor/../cards.json'])
    ok((await get(p)).status === 404, 'not served: ' + p);
  ok((await get('/favicon.ico')).status === 204, 'favicon: no content, no 404 in the console');

  // ---- the recogniser's stroke data (122 characters, write-test.mjs set)
  const sd = await fetch(base + '/vendor/strokes.json');
  const sj = sd.status === 200 ? await sd.json() : { chars: {} };
  ok(sd.status === 200 && (sd.headers.get('content-type') || '').startsWith('application/json'), 'the stroke data is served as JSON');
  ok(Object.keys(sj.chars).length >= 100, 'the stroke data has the whole 100-150 set (' + Object.keys(sj.chars).length + ')');

  // ---- the board (a QR code for phones)
  const bd = await get('/board');
  ok(bd.status === 200 && /神笔/.test(bd.body) && /vendor\/qrcode\.js/.test(bd.body) && /config\.js/.test(bd.body), '/board is the board page');
  ok((await get('/board.js')).status === 200 && (await get('/vendor/qrcode.js')).status === 200, 'the board script and its QR library are served');
  const cf = await get('/config.js');
  ok(/^window\.SB_CONFIG=\{"lanIPs":\[.*\],"port":\d+\};$/.test(cf.body.trim()), '/config.js gives the board the Wi-Fi addresses and port');

  // ---- the crew, the way phones play it
  const info0 = await (await fetch(base + '/crew.json')).json();
  ok(info0.players.length === 0 && info0.max === 4 && info0.profile === 'standard', '/crew.json: nobody yet, four seats, standard');
  const phones = [];
  const A = phone(), B = phone();
  phones.push(A, B);
  ok(await A.until(() => A.id && A.snaps > 2) && await B.until(() => B.id && B.snaps > 2), 'two phones join and get snapshots');
  ok(A.id !== B.id && A.slot !== B.slot && A.slot >= 0 && A.slot < 4, 'each has their own id and seat (' + A.slot + ', ' + B.slot + ')');
  ok(A.cellsSnaps >= 1, 'the grid comes with a snapshot (' + A.cellsSnaps + ')');
  ok(await A.until(() => A.world.players.length === 2 && A.me() && A.world.player(B.id)), 'each phone mirrors both players');
  const floor = A.world.get(10, 3);
  ok(floor === M.stone, 'the arena has its floor (stone under the spawn)');
  ok(A.world.count('water') > 0, 'the pond arrived with the grid (' + A.world.count('water') + ' water)');
  ok(A.msgs.some(m => m.t === 'roster' && m.players.length === 2), 'a roster lists the crew');
  // let the pond settle: after two idle seconds the snapshots are entity-only (the grid travels on change)
  await wait(2500);
  const c0 = A.cellsSnaps, s0 = A.snaps;
  await wait(1000);
  ok(A.cellsSnaps === c0 && A.snaps - s0 > 10, 'a settled world sends entity snapshots only (' + (A.snaps - s0) + ' snaps, no grids)');

  // ---- write: 火 in the writer's hand, seen by the other phone
  A.send({ t: 'write', ch: '火' });
  ok(await A.until(() => A.msgs.some(m => m.t === 'wrote')), 'the writer gets an answer');
  const yes = A.msgs.find(m => m.t === 'wrote');
  ok(yes && yes.ok, 'writing 火 works');
  ok(await A.until(() => { const p = A.me(); return p && p.held; }), 'the fire is in your hand (held)');
  ok(await B.until(() => { const o = B.world.objs.find(o => o.ch === '火' && o.st === 'held'); return o && o.owner === A.id; }), 'the other phone sees it too');
  // the cooldown is a knob: the immediate next write is refused politely (the brush rests)
  A.send({ t: 'write', ch: '水' });
  ok(await A.until(() => A.msgs.some(m => m.t === 'wrote' && m.ok === false && m.why === 'cooling')), 'the cooldown answers "the brush rests"');
  // an unknown character is refused, not a crash (wait out the cooldown first)
  await wait(1200);
  A.send({ t: 'write', ch: '龙' });
  ok(await A.until(() => A.msgs.some(m => m.t === 'wrote' && m.ok === false && m.why === 'unknown')), 'an unknown character is refused');
  ok(await A.until(() => A.events.some(e => e === 'give 火')), 'the write arrives as an event for the labels');

  // ---- act: throw the fire down at the dry dirt in front of you; it lands as a fire cell (R11)
  const before = A.world.count('fire');
  A.send({ t: 'aim', ax: 1, ay: -0.3 });
  A.send({ t: 'act', what: 'throw' });
  ok(await A.until(() => A.world.count('fire') > before, 8000), 'the thrown fire lands as a fire cell (' + (A.world.count('fire') - before) + ')');

  // ---- walk: the stick moves you, and the other phone agrees
  const x0 = A.me().x;
  A.send({ t: 'in', mx: 1 }); await wait(700); A.send({ t: 'in', mx: 0 }); await wait(120);
  ok(A.me().x > x0 + 0.5, 'walking works (' + (A.me().x - x0).toFixed(2) + ' cells)');
  ok(Math.abs(B.world.player(A.id).x - A.me().x) < 0.3, 'the other phone sees the same place');

  // ---- the living-room rule: anyone may set the room's knobs; phones follow on the next snapshot
  const crew = await (await fetch(base + '/crew', { method: 'POST', body: JSON.stringify({ profile: 'relaxed' }) })).json();
  ok(crew.profile === 'relaxed', 'POST /crew sets the profile');
  ok(await A.until(() => A.world.profile === 'relaxed', 1000), 'the profile change reaches the phones');

  // ---- a fifth phone is turned away
  const C1 = phone(), D1 = phone();
  phones.push(C1, D1);
  await wait(600);
  ok(phones.every(p => p.id), 'four phones hold the four seats');
  const E = phone();
  ok(await E.until(() => E.msgs.some(m => m.t === 'full'), 4000), 'a fifth phone is told the crew is full');

  // ---- a lost phone keeps its seat for a while (GONE_AFTER), then it goes
  B.ws.close();
  ok(await A.until(() => !A.world.player(B.id) === false, 200), 'the seat is not dropped at once');
  const back = phone(B.id);
  ok(await back.until(() => back.id === B.id, 4000), 'a phone coming back takes its own seat again');
} finally {
  srv.kill();
}
console.log(fail ? `SMOKE: ${pass} passed, ${fail} FAILED` : `ALL ${pass} SMOKE CHECKS PASSED`);
process.exit(fail ? 1 : 0);
