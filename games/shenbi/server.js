// 神笔 Shenbi — zero-install server. Copied from games/tongzhou-forge-2d/server.js (never imported) and adapted:
// the Shenbi sim steps at 30 Hz on a step(inputs) contract, writing happens out-of-band (sim.give), and the grid
// travels only when cellsV moves. It runs ONE flat arena for a crew of up to four phones (docs/CHARTER §2:
// co-op a must; solo = a crew of one). A phone only restores() snapshots and draws; it never steps.
//   node server.js              port 3500
//   PORT=3501 node server.js    any port (tests use 3500+, never 3000)
//   /board                      the board page: a QR code for phones
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { World } = require('./sim.js');
const { M } = require('./reactions.js');
const CARDS = require('./content.js').cards;

const PORT = Number(process.env.PORT || 3500);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8',
};
// only what the page needs is served; tests, docs and tools stay on the computer
const PUBLIC = new Set(['index.html', 'board.html', 'board.js', 'style.css', 'app.js', 'sim.js', 'reactions.js', 'content.js']);

function lanIPs() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (/^(docker|br-|virbr|vnet|veth|tun|tap|wg|tailscale|zt|lxc|podman)/i.test(name)) continue;
    for (const a of addrs || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

// ---------- the flat arena (Phase 1C: plain flat look; bigger worlds are Phase 5) ----------
function buildArena(w) {
  w.fill(0, 0, w.W - 1, 7, M.stone);              // the floor every crew stands on
  w.fill(0, 8, w.W - 1, 10, M.dirt);              // plantable earth above it
  // a pond in a stone basin: water on dirt makes mud and soaks away (R4), and a single-deep pond spreads
  // sideways until it finds dirt. A stone floor with stone lips holds it still.
  w.fill(28, 10, 46, 10, M.stone);
  w.fill(28, 11, 28, 11, M.stone); w.fill(46, 11, 46, 11, M.stone);
  w.fill(29, 11, 45, 11, M.water);
  for (let x = 60; x < 150; x += 30) w.fill(x, 11, x, 15, M.wood);   // a few posts to burn
  w.fill(100, 11, 112, 11, M.plant);              // grass to grow and burn
}

const world = new World({ w: 160, h: 90, seed: 11, cards: CARDS, profile: 'standard', body: 'playful' });
buildArena(world);

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); res.end('bad request'); return; }
  if (p === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (p === '/') p = '/index.html';
  if (p === '/board') p = '/board.html';
  // the living-room rule: anyone on the Wi-Fi may set the room's knobs
  if (p === '/crew' && req.method === 'POST') {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 1024) req.destroy(); });
    req.on('end', () => {
      let m = {};
      try { m = JSON.parse(body); } catch (e) {}
      if (RX_PROFILES.includes(m.profile)) world.setProfile(m.profile);
      if (RX_BODIES.includes(m.body)) world.setBody(m.body);
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(crewInfo()));
    });
    return;
  }
  if (p === '/crew.json') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(crewInfo()));
    return;
  }
  if (p === '/config.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
    res.end('window.SB_CONFIG=' + JSON.stringify({ lanIPs: lanIPs(), port: PORT }) + ';');
    return;
  }
  const rel = p.replace(/^\/+/, '');
  // only plain names under the game folder: no dots, no dot-dot steps
  const safeName = rel && rel.split('/').every(seg => seg && seg !== '.' && seg !== '..');
  const ok = safeName && (PUBLIC.has(rel) || (/^vendor\/[\w.-]+\.(js|json|txt|woff2)$/.test(rel)));
  const file = path.join(ROOT, rel);
  if (!ok || !file.startsWith(ROOT + path.sep)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
});

// ---------- the crew ----------
const STEP = 1 / 30;              // the sim's fixed step (reactions.js TICK)
const SNAP_EVERY = 2;             // a snapshot every second step: 15 a second
const MAX_CREW = 4;               // four seats, four colours (CHARTER §2: crew of 1-4)
const GONE_AFTER = 30;            // seconds a player who lost the connection keeps their seat
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const RX_PROFILES = ['relaxed', 'standard', 'strict'];
const RX_BODIES = ['off', 'playful', 'rough'];
const clients = new Set();        // { socket, id, cellsV, joined }
let extraEvents = [];             // events that happen between steps (writes), merged into the next snapshot

function crewInfo() {
  return {
    w: world.W, h: world.H, seed: 11, profile: world.profile, body: world.bodyKnob, max: MAX_CREW,
    players: world.players.map(p => ({ id: p.id, slot: world.players.indexOf(p), here: [...clients].some(c => c.id === p.id) })),
  };
}

// ---------- WebSocket (RFC 6455, text frames only; same pattern as forge-2d) ----------
function encodeFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}
const send = (c, msg) => { if (!c.socket.destroyed) c.socket.write(encodeFrame(typeof msg === 'string' ? msg : JSON.stringify(msg))); };
const sendAll = msg => { const f = encodeFrame(JSON.stringify(msg)); for (const c of clients) if (c.joined && !c.socket.destroyed) c.socket.write(f); };
// numbers on the wire: four decimals are plenty to draw with (the phone never steps the world)
const round = (k, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v;
function roster() { sendAll({ t: 'roster', players: world.players.map((p, i) => ({ id: p.id, slot: p.slot !== undefined ? p.slot : i, here: [...clients].some(c => c.id === p.id) })) }); }

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (req.url.split('?')[0] !== '/ws' || !key) { socket.destroy(); return; }
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + WS_GUID).digest('base64') + '\r\n\r\n');
  socket.setNoDelay(true);
  const c = { socket, id: null, cellsV: -1, joined: false, input: {}, aim: undefined };
  clients.add(c);
  let buf = Buffer.alloc(0);
  socket.on('data', chunk => {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    for (;;) {   // a frame can be split across TCP chunks, so only consume whole ones
      if (buf.length < 2) return;
      const opcode = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, head = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); head = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); head = 10; }
      if (len > 32768) { socket.destroy(); return; }
      const total = head + (masked ? 4 : 0) + len;
      if (buf.length < total) return;
      const payload = Buffer.from(buf.subarray(total - len, total));
      if (masked) { const mask = buf.subarray(head, head + 4); for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3]; }
      buf = buf.subarray(total);
      if (opcode === 0x8) { socket.end(); return; }
      if (opcode === 0x9) { socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
      if (opcode !== 0x1) continue;
      let msg;
      try { msg = JSON.parse(payload.toString('utf8')); } catch (e) { continue; }
      if (msg && typeof msg === 'object') { try { onMessage(c, msg); } catch (e) { console.error('crew message', e); } }
    }
  });
  socket.on('error', () => {});
  socket.on('close', () => {
    clients.delete(c);
    const p = c.id && world.player(c.id);
    if (!p || [...clients].some(o => o.id === c.id)) return;
    c.input = {};
    p.goneAt = Date.now();
    roster();
  });
});

function onMessage(c, m) {
  if (m.t === 'join') {
    if (c.joined) return;
    const want = typeof m.id === 'string' && /^[\w-]{4,24}$/.test(m.id) ? m.id : null;
    // the same id twice (a duplicated tab) gets a new one; a seat kept for a lost phone is reused until it expires
    let p = want && ![...clients].some(o => o !== c && o.id === want) ? world.player(want) : null;
    if (!p && world.players.length >= MAX_CREW) {
      for (const q of world.players) {
        if (q.goneAt && Date.now() - q.goneAt > GONE_AFTER * 1000) { world.removePlayer(q.id); break; }
      }
    }
    if (!p) {
      if (world.players.length >= MAX_CREW) { send(c, { t: 'full', max: MAX_CREW }); return; }
      p = world.addPlayer('c-' + crypto.randomBytes(4).toString('hex'), 8 + world.players.length * 5, 12);
      p.slot = world.players.indexOf(p);
    }
    delete p.goneAt;
    c.id = p.id; c.joined = true; c.cellsV = -1; c.input = {}; c.aim = undefined;
    send(c, Object.assign({ t: 'joined', id: p.id, slot: p.slot !== undefined ? p.slot : world.players.indexOf(p) }, crewInfo()));
    roster();
    return;
  }
  if (!c.joined) return;
  const id = c.id, p = world.player(id);
  if (!p) return;
  switch (m.t) {
    case 'in': {                                             // held state: stick, jump, calm
      if (typeof m.mx === 'number' && Math.abs(m.mx) <= 1) c.input.mx = Math.round(m.mx * 100) / 100;
      if (m.jump !== undefined) c.input.jump = !!m.jump;
      if (m.calm !== undefined) c.input.calm = !!m.calm;
      break;
    }
    case 'aim': {                                            // sticky aim for the next verb
      const ax = Number(m.ax), ay = Number(m.ay);
      if (Number.isFinite(ax) && Number.isFinite(ay) && Math.hypot(ax, ay) > 0.05) c.aim = { ax, ay };
      break;
    }
    case 'act': {                                            // one shot: wield | throw | place | drop | home
      if (['wield', 'throw', 'place', 'drop', 'home'].includes(m.what)) {
        c.input.act = m.what;
        if (c.aim) { c.input.ax = c.aim.ax; c.input.ay = c.aim.ay; }
      }
      break;
    }
    case 'write': {                                          // the pad's chip: writing happens out-of-band
      if (typeof m.ch !== 'string' || m.ch.length > 2) break;
      const why = world.give(p, String(m.ch));
      extraEvents.push('give ' + m.ch);
      send(c, { t: 'wrote', ok: why === 'ok', why: why === 'ok' ? null : why, ch: m.ch });
      break;
    }
    case 'ping': send(c, { t: 'pong', at: m.at }); break;
  }
}

// one arena for everyone, stepped while anyone is here
let last = process.hrtime.bigint(), acc = 0;
const evq = [];                   // every event since the last snapshot went out
const loop = setInterval(() => {
  const now = process.hrtime.bigint();
  acc = Math.min(0.25, acc + Number(now - last) / 1e9);
  last = now;
  // seats kept for players who lost the connection expire
  for (const p of [...world.players]) if (p.goneAt && Date.now() - p.goneAt > GONE_AFTER * 1000) { world.removePlayer(p.id); roster(); }
  if (!world.players.length) { acc = 0; return; }
  while (acc >= STEP) {
    acc -= STEP;
    const inputs = {};
    for (const c of clients) {
      if (!c.joined) continue;
      const inp = Object.assign({}, c.input);
      if (inp.act) { delete c.input.act; delete c.input.ax; delete c.input.ay; }   // an act is one shot
      inputs[c.id] = inp;
    }
    for (const p of world.players) if (!inputs[p.id]) inputs[p.id] = {};             // an empty hand stands still
    world.step(inputs);
    evq.push(...world.events);
    if (extraEvents.length) { evq.push(...extraEvents); extraEvents = []; }
    if (world.tick % SNAP_EVERY) continue;
    const e = evq.slice(); evq.length = 0;          // a copy: evq is reused for the next batch
    let plain = null, full = null;
    for (const c of clients) {
      if (!c.joined) continue;
      const cells = c.cellsV !== world.cellsV;
      if (cells) { full = full || JSON.stringify({ t: 'snap', s: world.wire(), e }, round); c.cellsV = world.cellsV; send(c, full); }
      else { plain = plain || JSON.stringify({ t: 'snap', s: world.wire({ cells: false }), e }, round); send(c, plain); }
    }
  }
}, 1000 / 120);
server.on('close', () => clearInterval(loop));
server.crew = { world, clients };

server.listen(PORT, HOST, () => {
  console.log('Shenbi 神笔 on http://localhost:' + PORT + '/');
  for (const ip of lanIPs()) console.log('Phones (Wi-Fi): http://' + ip + ':' + PORT + '/');
  console.log('Board (QR code for phones): http://localhost:' + PORT + '/board');
});
module.exports = server;
