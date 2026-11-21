// 同舟 · Glyph Isles 2D — zero-install server. It hands out the page's files and runs the crew: one isle for up to
// four phones (docs/CO-OP.md). Alone, the page runs sim.js itself; with ?crew=1 it joins the crew over a WebSocket,
// sends its hands (stick, JUMP, GRAB, a written character) and draws the snapshots this server sends back.
//   node server.js              port 3300
//   PORT=3000 node server.js    on a machine where only 3000 is open (phone playtests here)
//   /board                      the board page: a QR code for phones (board.html; ../board/board.sh opens it)
//   /crew.json                  who is in the crew and on which isle (the board shows it)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { World, PROFILES, KNOCKS } = require('./sim.js');

const PORT = Number(process.env.PORT || 3300);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
};
// only what the page needs is served; tests, docs and tools stay on the computer
const PUBLIC = new Set(['index.html', 'board.html', 'board.js', 'style.css', 'app.js', 'ink.js', 'cut.js', 'things.js', 'sim.js', 'rules.js', 'isles.js', 'content.js']);

function lanIPs() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (/^(docker|br-|virbr|vnet|veth|tun|tap|wg|tailscale|zt|lxc|podman)/i.test(name)) continue;
    for (const a of addrs || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); res.end('bad request'); return; }
  if (p === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (p === '/') p = '/index.html';
  if (p === '/board') p = '/board.html';
  // the board sets the crew's profile and knock (the living-room rule: anyone on the Wi-Fi may)
  if (p === '/crew' && req.method === 'POST') {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 1024) req.destroy(); });
    req.on('end', () => {
      let m = {};
      try { m = JSON.parse(body); } catch (e) {}
      if (PROFILES.includes(m.profile) && m.profile !== world.k.profile) world.setProfile(m.profile);
      if (KNOCKS.includes(m.knock) && m.knock !== world.bd.knock) world.setKnock(m.knock);
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
  // the board's QR code needs this computer's Wi-Fi address (board.js)
  if (p === '/config.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
    res.end('window.F2D_CONFIG=' + JSON.stringify({ lanIPs: lanIPs(), port: PORT }) + ';');
    return;
  }
  const rel = p.replace(/^\/+/, '');
  const ok = PUBLIC.has(rel) || (/^vendor\/[\w.-]+\.(woff2|txt|js|json)$/.test(rel));
  const file = path.join(ROOT, rel);
  if (!ok || !file.startsWith(ROOT + path.sep)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
});

// ---------- the crew (docs/CO-OP.md §4) ----------
const STEP = 1 / 60;
const SNAP_EVERY = 2;             // a snapshot every second step: 30 a second
const MAX_CREW = 4;               // four colours, four hairstyles (ink.js PLAYERS)
const GONE_AFTER = 30;            // seconds a player who lost the connection keeps their place
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const world = new World();
const clients = new Set();        // { socket, id, cellsV, index, joined }
let events = [], tick = 0;

function crewInfo() {
  return {
    isle: world.index, id: world.L.id, name: world.L.name, want: world.L.want, profile: world.k.profile, knock: world.bd.knock,
    players: [...world.players.values()].map(p => ({ slot: p.slot, name: p.name, here: [...clients].some(c => c.id === p.id) })),
  };
}

// ---------- WebSocket (RFC 6455, text frames only; copied from games/tongzhou-forge/server.js) ----------
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
function roster() { sendAll({ t: 'roster', players: [...world.players.values()].map(p => ({ id: p.id, slot: p.slot, here: [...clients].some(c => c.id === p.id) })) }); }

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (req.url.split('?')[0] !== '/ws' || !key) { socket.destroy(); return; }
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + WS_GUID).digest('base64') + '\r\n\r\n');
  socket.setNoDelay(true);
  const c = { socket, id: null, cellsV: -1, index: -1, joined: false };
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
    const p = c.id && world.players.get(c.id);
    if (!p || [...clients].some(o => o.id === c.id)) return;
    world.setInput(p.id, 0, false);
    p.goneAt = Date.now();
    roster();
  });
});

// strokes are only for the others to see (the write itself is the character): keep a sane amount, else none
function cleanStrokes(list) {
  if (!Array.isArray(list) || list.length > 24) return [];
  let n = 0;
  const out = [];
  for (const st of list) {
    if (!Array.isArray(st) || !st.length || st.length > 64) return [];
    const line = [];
    for (const pt of st) {
      const x = Number(pt && pt[0]), y = Number(pt && pt[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1) return [];
      line.push([Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
      if (++n > 600) return [];
    }
    out.push(line);
  }
  return out;
}

function onMessage(c, m) {
  if (m.t === 'join') {
    if (c.joined) return;
    const want = typeof m.id === 'string' && /^[\w-]{4,24}$/.test(m.id) ? m.id : null;
    // the same id twice (a duplicated tab) gets a new one
    let p = want && ![...clients].some(o => o !== c && o.id === want) ? world.players.get(want) : null;
    if (!p) {
      if (world.players.size >= MAX_CREW) {
        // a place kept for someone who lost the connection goes to the newcomer only once it has expired
        send(c, { t: 'full', max: MAX_CREW }); return;
      }
      p = world.addPlayer('c-' + crypto.randomBytes(4).toString('hex'), 'player');
    }
    delete p.goneAt;
    c.id = p.id; c.joined = true; c.cellsV = -1; c.index = -1;
    send(c, { t: 'joined', id: p.id, slot: p.slot, max: MAX_CREW });
    roster();
    return;
  }
  if (!c.joined) return;
  const id = c.id, p = world.players.get(id);
  if (!p) return;
  switch (m.t) {
    case 'in': world.setInput(id, Number(m.x) || 0, !!m.j); break;
    case 'press': if (m.what === 'jump' || m.what === 'grab') world.press(id, m.what); break;
    case 'write': {
      if (typeof m.ch !== 'string' || m.ch.length > 2) break;
      const r = world.write(id, m.ch, { pick: !!m.pick });
      const strokes = cleanStrokes(m.strokes);
      // the write event carries the strokes, so every phone replays them over the writer's head
      for (const e of world.events) if (e.t === 'write' && e.id === id && e.s === (r.stone && r.stone.id)) e.strokes = strokes;
      send(c, { t: 'wrote', ok: r.ok, why: r.why || null, ch: m.ch, s: r.stone ? r.stone.id : null, n: m.n });
      break;
    }
    // the living-room rule (as in the 3D game): anyone may restart, change isle, profile or knock
    case 'isle': world.load(Number(m.i) | 0); break;
    case 'profile': if (PROFILES.includes(m.name)) world.setProfile(m.name); break;
    case 'knock': if (KNOCKS.includes(m.mode)) world.setKnock(m.mode); break;
    case 'ping': send(c, { t: 'pong', at: m.at }); break;
  }
}

// one isle for everyone, stepped while anyone is here
let last = process.hrtime.bigint(), acc = 0;
const loop = setInterval(() => {
  const now = process.hrtime.bigint();
  acc = Math.min(0.25, acc + Number(now - last) / 1e9);
  last = now;
  // places kept for players who lost the connection expire
  for (const p of [...world.players.values()]) if (p.goneAt && Date.now() - p.goneAt > GONE_AFTER * 1000) { world.removePlayer(p.id); roster(); }
  if (![...clients].some(c => c.joined)) { acc = 0; return; }
  while (acc >= STEP) {
    acc -= STEP;
    world.step(STEP);
    events.push(...world.drain());
    if (++tick % SNAP_EVERY) continue;
    const e = events; events = [];
    let plain = null, full = null;
    for (const c of clients) {
      if (!c.joined) continue;
      const cells = c.cellsV !== world.cellsV || c.index !== world.index;
      if (cells) { full = full || JSON.stringify({ t: 'snap', s: world.snapshot(), e }, round); c.cellsV = world.cellsV; c.index = world.index; send(c, full); }
      else { plain = plain || JSON.stringify({ t: 'snap', s: world.snapshot({ cells: false }), e }, round); send(c, plain); }
    }
  }
}, 1000 / 120);
server.on('close', () => clearInterval(loop));
server.crew = { world, clients };

server.listen(PORT, HOST, () => {
  console.log('Glyph Isles 2D on http://localhost:' + PORT + '/');
  for (const ip of lanIPs()) console.log('Phones (Wi-Fi): http://' + ip + ':' + PORT + '/');
  console.log('Board (QR code for phones): http://localhost:' + PORT + '/board');
});
module.exports = server;
