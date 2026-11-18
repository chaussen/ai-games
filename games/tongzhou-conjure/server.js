// 同舟 · Glyph Isles — zero-install LAN server: static files + a hand-rolled RFC 6455
// WebSocket + the authoritative simulation in sim.js.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { Game } = require('./sim.js');
const LV = require('./levels.js');

const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || '0.0.0.0';
const LAN_IP = (process.env.LAN_IP || '').trim();
const ROOT = __dirname;
const VENDOR = path.join(ROOT, 'vendor');
const TICK = 1 / 60;
const MAX_PLAYERS = 16;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const GONE_AFTER_MS = 90000;   // a napping wobbler is removed after this long offline

// ---------- LAN address discovery ----------
function isVirtualNic(name) {
  return /^(docker|br-|virbr|vnet|veth|tun|tap|wg|tailscale|zt|ham|lxc|podman|nm-)/i.test(name);
}
function ipRank(ip) {
  if (ip.startsWith('192.168.')) return 0;
  if (ip.startsWith('10.')) return 1;
  const m = ip.match(/^172\.(\d+)\./);
  if (m && +m[1] >= 16 && +m[1] <= 31) return 2;
  return 3;
}
function lanIPs() {
  const seen = new Set(), list = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (isVirtualNic(name)) continue;
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal && a.address && !seen.has(a.address)) { seen.add(a.address); list.push(a.address); }
    }
  }
  list.sort((a, b) => ipRank(a) - ipRank(b));
  if (LAN_IP && !seen.has(LAN_IP)) list.unshift(LAN_IP);
  return list;
}

// ---------- game ----------
const game = new Game();
const clients = new Set();   // { socket, board, player }

function sendAll(msg) {
  const frame = encodeFrame(JSON.stringify(msg));
  for (const c of clients) if (c.joined && !c.socket.destroyed) c.socket.write(frame);
}
function sendRoster() { sendAll({ type: 'roster', players: game.roster() }); }

let acc = 0, last = process.hrtime.bigint(), tickNo = 0;
setInterval(() => {
  const now = process.hrtime.bigint();
  acc += Number(now - last) / 1e9;
  last = now;
  if (acc > 0.25) acc = 0.25;            // never spiral after a stall
  while (acc >= TICK) {
    acc -= TICK;
    game.step(TICK);
    if (++tickNo % 2 === 0) {            // 30 snapshots a second
      const snap = game.snapshot();
      const ev = game.drainEvents();
      if (ev.length) {
        snap.e = ev;
        if (ev.some(e => e.t === 'stage')) snap.conjure = stageConjure(game.stage);
      }
      if (clients.size) sendAll(snap);
    }
  }
}, 1000 / 120);

// ---------- HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'
};
const SERVED = new Set(['/index.html', '/app.js', '/style.css', '/levels.js', '/content.js']);

const httpServer = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/config.js') {
    res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' });
    res.end('window.WOBBLE_CONFIG=' + JSON.stringify({ lanIPs: lanIPs(), port: PORT, game: 'tongzhou-conjure' }) + ';');
    return;
  }
  if (urlPath === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = null;
  if (SERVED.has(urlPath)) filePath = path.join(ROOT, urlPath);
  else if (/^\/vendor\/[\w.-]+$/.test(urlPath)) filePath = path.join(VENDOR, path.basename(urlPath));
  if (!filePath) { res.writeHead(404); res.end('Not Found'); return; }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

// ---------- WebSocket (RFC 6455, text frames only) ----------
function encodeFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}
const send = (socket, msg) => { if (!socket.destroyed) socket.write(encodeFrame(JSON.stringify(msg))); };

httpServer.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (req.url.split('?')[0] !== '/ws' || !key) { socket.destroy(); return; }
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + WS_GUID).digest('base64') + '\r\n\r\n');
  socket.setNoDelay(true);

  const client = { socket, board: false, player: null, joined: false };
  clients.add(client);
  let buf = Buffer.alloc(0);

  socket.on('data', chunk => {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    // a frame can be split across TCP chunks, so only consume whole ones
    for (;;) {
      if (buf.length < 2) return;
      const opcode = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, head = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); head = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); head = 10; }
      if (len > 4096) { socket.destroy(); return; }
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
      if (msg && typeof msg === 'object') onMessage(client, msg);
    }
  });
  socket.on('error', () => {});
  socket.on('close', () => {
    clients.delete(client);
    const p = client.player;
    if (!p || p.client !== client) return;
    game.setAfk(p.id, true);
    setTimeout(() => {
      if (p.client === client && game.players.get(p.id) === p) { game.removePlayer(p.id); sendRoster(); }
    }, GONE_AFTER_MS);
  });
});

function stageConjure(stageIdx) {
  const L = game.levels[((stageIdx % game.levels.length) + game.levels.length) % game.levels.length];
  const list = L.conjure || (L.stones || []).map(d => d[0]);
  return list.map(ch => ({
    ch,
    py: (LV.GLYPHS[ch] && LV.GLYPHS[ch].py) || '',
    en: (LV.GLYPHS[ch] && LV.GLYPHS[ch].en) || ''
  }));
}

function onMessage(client, msg) {
  if (msg.type === 'join') {
    if (client.joined) return;
    client.joined = true;
    if (msg.board) {
      client.board = true;
      send(client.socket, { type: 'joined', board: true, stage: game.stage });
    } else {
      const wanted = typeof msg.playerId === 'string' && /^[\w-]{4,24}$/.test(msg.playerId) ? msg.playerId : null;
      let p = wanted && game.players.get(wanted);
      if (!p) {
        if (game.players.size >= MAX_PLAYERS) { send(client.socket, { type: 'full' }); client.joined = false; return; }
        const clean = String(msg.name || '').replace(/[\u0000-\u001f<>]/g, '').trim();
        p = game.addPlayer(wanted || 'p-' + crypto.randomBytes(5).toString('hex'), clean || 'Wobbler ' + (game.players.size + 1));
      }
      p.client = client;
      client.player = p;
      game.setAfk(p.id, false);
      send(client.socket, {
        type: 'joined', id: p.id, name: p.name, ci: p.ci, stage: game.stage,
        ink: Math.round(game.ink * 100) / 100, inkMax: game.inkMax(),
        conjure: stageConjure(game.stage)
      });
    }
    sendRoster();
    return;
  }
  if (!client.joined) return;
  const p = client.player;
  switch (msg.type) {
    case 'input': if (p) game.setInput(p.id, msg.x, msg.z); break;
    case 'act': if (p && (msg.a === 'jump' || msg.a === 'grab' || msg.a === 'respawn')) game.act(p.id, msg.a); break;
    case 'call': if (p) sendAll({ type: 'call', id: p.id, text: String(msg.text || '').slice(0, 12) }); break;
    case 'visibility': if (p) game.setAfk(p.id, !!msg.hidden); break;
    case 'ping': send(client.socket, { type: 'pong', t: msg.t }); break;
    case 'conjure': {
      // Client to server: { type: 'conjure', ch: '木', strokes: [...] }
      // Validation per SPEC.md section 2 & 4:
      if (!p || client.board) break;
      if (typeof msg.ch !== 'string' || !msg.ch) {
        send(client.socket, { type: 'conjureNo', why: 'unknown' });
        break;
      }
      // Stroke validation: list of strokes; each stroke a list of [x, y] in 0..1
      // at most 12 strokes, at most 40 points per stroke, at most 300 points total
      if (!Array.isArray(msg.strokes) || msg.strokes.length === 0 || msg.strokes.length > 12) break;
      let totalPts = 0, valid = true;
      const cleanStrokes = [];
      for (const st of msg.strokes) {
        if (!Array.isArray(st) || st.length === 0 || st.length > 40) { valid = false; break; }
        const cst = [];
        for (const pt of st) {
          if (!Array.isArray(pt) || pt.length !== 2) { valid = false; break; }
          const x = Number(pt[0]), y = Number(pt[1]);
          if (!Number.isFinite(x) || !Number.isFinite(y) || x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1) {
            valid = false; break;
          }
          cst.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
          totalPts++;
        }
        if (!valid) break;
        cleanStrokes.push(cst);
      }
      if (!valid || totalPts > 300) break;
      const res = game.conjure(p.id, msg.ch);
      if (!res.ok) {
        send(client.socket, { type: 'conjureNo', why: res.why });
      } else {
        sendAll({ type: 'conjured', id: p.id, ch: msg.ch, strokes: cleanStrokes, s: res.stone.id });
      }
      break;
    }
    case 'admin':
      // stage controls: the board has them; so does any player (it is a living room, not a tournament)
      if (msg.cmd === 'next') game.loadStage(game.stage + 1);
      else if (msg.cmd === 'prev') game.loadStage(game.stage - 1);
      else if (msg.cmd === 'restart') game.loadStage(game.stage);
      else if (msg.cmd === 'goto') game.loadStage(Number(msg.i) | 0);
      break;
  }
}

// Firewall self-check. OPT-IN only (FIREWALL_CHECK=1): firewall-cmd triggers a
// polkit password prompt, and every server start (including each test run)
// would pop it up and can lock the account after failed attempts.
function checkFirewall(port) {
  if (process.env.FIREWALL_CHECK !== '1') {
    console.log('    Firewall      : not checked (run ./lan-doctor.sh, or start with FIREWALL_CHECK=1)');
    return;
  }
  require('child_process').execFile('firewall-cmd', ['--query-port=' + port + '/tcp'], { timeout: 8000 }, (err, stdout) => {
    if (String(stdout || '').trim() === 'no') {
      console.log('\n  !! firewalld is BLOCKING port ' + port + ' on this machine.');
      console.log('  !! Phones will say "site can\'t be reached".');
      console.log('  !! Fix: sudo firewall-cmd --zone=public --add-port=' + port + '/tcp\n');
    }
  });
}

httpServer.listen(PORT, HOST, () => {
  const ips = lanIPs();
  console.log('');
  console.log('  ======================================================');
  console.log('    同舟 · GLYPH ISLES · CONJURE PROTOTYPE');
  console.log('  ======================================================');
  console.log('    TV / board    : http://localhost:' + PORT + '/?board=1');
  if (ips.length) ips.forEach(ip => console.log('    Phones (Wi-Fi): http://' + ip + ':' + PORT + '/'));
  else console.log('    Phones (Wi-Fi): (no Wi-Fi/LAN IPv4 detected)');
  console.log('    Bound to      : ' + HOST + ':' + PORT);
  console.log('  ------------------------------------------------------');
  checkFirewall(PORT);
});
