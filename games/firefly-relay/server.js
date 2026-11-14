#!/usr/bin/env node
'use strict';
/**
 * FIREFLY RELAY - zero-dependency LAN game server
 * ---------------------------------------------------------------
 * One Node process is the host. It serves the board + phone controllers
 * over plain HTTP and speaks a tiny hand-rolled WebSocket protocol.
 * No npm install, no CDN, no internet. Everything stays on your Wi-Fi.
 *
 *   node server.js                 (then open the printed URLs)
 *   PORT=4000 node server.js      (pick another port)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// ---- tuning knobs -------------------------------------------------------
const ROUND_MS = Number(process.env.ROUND_MS || 60000);  // short rounds -> "one more round"
const MAX_PLAYERS = 8;
const CHORUS_EVERY = 9;        // every N passes, everyone taps together
const LEVEL_EVERY = 8;         // every N passes, tempo steps up
const LEVEL_MAX = 8;
const MISS_LIGHT = 16;         // shared light meter drain
const HIT_LIGHT = 7;
const SKY_FILE = path.join(ROOT, '.family-sky.json');

const COLORS = ['#ffd166', '#7ae7c7', '#ff8fab', '#8ab6ff', '#c9a7ff', '#ffab6b', '#9ee37d', '#6fd8f2'];
const EMOJIS = ['🦊','🐻','🐼','🐨','🦉','🐢','🐙','🦋','🐳','🌙','⭐','🍄'];
const BOT_NAMES = ['Pip', 'Luma', 'Momo', 'Glim', 'Blink', 'Nox'];

// ---- static assets ------------------------------------------------------
const STATIC = {
  '/':             ['index.html', 'text/html; charset=utf-8'],
  '/index.html':   ['index.html', 'text/html; charset=utf-8'],
  '/app.js':       ['app.js', 'application/javascript; charset=utf-8'],
  '/style.css':    ['style.css', 'text/css; charset=utf-8'],
  '/qrcode.js':    ['qrcode.js', 'application/javascript; charset=utf-8'],
  '/wireframe.html':['wireframe.html', 'text/html; charset=utf-8'],
};
const cache = {};
for (const [url, [file, mime]] of Object.entries(STATIC)) {
  try { cache[url] = { body: fs.readFileSync(path.join(ROOT, file)), mime }; }
  catch (e) { console.warn('  ! missing asset', file); }
}

function lanIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) out.push(n.address);
  }
  return out;
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  if (urlPath === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (urlPath === '/config.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('window.FIREFLY_CONFIG=' + JSON.stringify({ lanIPs: lanIPs(), port: PORT }) + ';');
    return;
  }
  const asset = cache[urlPath];
  if (!asset) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': asset.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(asset.body);
});

// ---- minimal WebSocket server (RFC 6455, text frames only) ---------------
const clients = new Set();
let nextClientId = 1;

function sendRaw(c, text) {
  if (!c.alive) return;
  const payload = Buffer.from(text, 'utf8');
  const n = payload.length;
  let head;
  if (n < 126) { head = Buffer.alloc(2); head[0] = 0x81; head[1] = n; }
  else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  try { c.socket.write(Buffer.concat([head, payload])); } catch (e) { /* dropped */ }
}
function send(c, obj) { sendRaw(c, JSON.stringify(obj)); }
function broadcast(obj) {
  const s = JSON.stringify(obj);
  for (const c of clients) if (c.alive) sendRaw(c, s);
}
function pong(c, payload) {
  if (!c.alive) return;
  const n = payload.length;
  const head = Buffer.alloc(n < 126 ? 2 : 4);
  head[0] = 0x8A; // FIN + opcode 10 (pong)
  if (n < 126) head[1] = n; else { head[1] = 126; head.writeUInt16BE(n, 2); }
  try { c.socket.write(Buffer.concat([head, payload])); } catch (e) {}
}
function closeSocket(c) {
  if (!c.alive) return;
  c.alive = false;
  try { c.socket.end(Buffer.from([0x88, 0x00])); } catch (e) {}
}

function parseFrame(buf) {
  if (buf.length < 2) return null;
  const b0 = buf[0], b1 = buf[1];
  const opcode = b0 & 0x0f;
  const masked = !!(b1 & 0x80);
  let len = b1 & 0x7f, off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) {
    if (buf.length < 10) return null;
    const big = buf.readBigUInt64BE(2);
    if (big > 1048576n) return null;
    len = Number(big); off = 10;
  }
  let mask = null;
  if (masked) { if (buf.length < off + 4) return null; mask = buf.subarray(off, off + 4); off += 4; }
  if (buf.length < off + len) return null;
  const payload = Buffer.from(buf.subarray(off, off + len));
  if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
  return { opcode, payload, size: off + len };
}

server.on('upgrade', (req, socket, head) => {
  if ((req.url || '').split('?')[0] !== '/ws') { socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  socket.setNoDelay(true);
  const c = { id: nextClientId++, socket, alive: true, role: null, playerId: null, buf: Buffer.alloc(0) };
  clients.add(c);
  socket.on('data', chunk => {
    c.buf = Buffer.concat([c.buf, chunk]);
    if (c.buf.length > 1048576) { closeSocket(c); return; }
    let f;
    while ((f = parseFrame(c.buf))) {
      c.buf = c.buf.subarray(f.size);
      try { handleFrame(c, f); } catch (e) { console.warn('frame error', e.message); }
    }
  });
  socket.on('close', () => dropClient(c));
  socket.on('error', () => dropClient(c));
  if (head && head.length) socket.emit('data', head);
});

function handleFrame(c, f) {
  if (f.opcode === 8) { closeSocket(c); dropClient(c); return; }
  if (f.opcode === 9) { pong(c, f.payload); return; }
  if (f.opcode === 10 || f.opcode === 0 || f.opcode === 2) return;
  if (f.opcode !== 1) return;
  let msg;
  try { msg = JSON.parse(f.payload.toString('utf8')); } catch (e) { return; }
  onMessage(c, msg);
}

function dropClient(c) {
  if (!c.alive) return;
  c.alive = false;
  clients.delete(c);
  if (c.playerId != null) {
    const p = players.find(x => x.id === c.playerId);
    if (p) {
      players = players.filter(x => x.id !== p.id);
      if (turn && !turn.resolved) {
        turn.targets = turn.targets.filter(id => id !== p.id);
        turn.hits.delete(p.id);
        if (!turn.targets.length) resolveTurn(false, p.id);
      }
    }
  }
  pushState();
}

// ---- game state ---------------------------------------------------------
let phase = 'lobby';         // lobby | countdown | playing | roundEnd
let players = [];
let nextPlayerId = 1;
let score = 0, combo = 0, bestCombo = 0, level = 1, light = 100, passes = 0;
let turn = null;
let lastTargetId = null;
let roundEndsAt = 0;
let roundTimer = null, turnTimer = null, gapTimer = null, countTimer = null;
let endReason = 'time';
let roundStats = {};
let sky = loadSky();

function loadSky() {
  try { return JSON.parse(fs.readFileSync(SKY_FILE, 'utf8')); }
  catch (e) { return { stars: 0, rounds: 0, bestScore: 0, bestCombo: 0 }; }
}
function saveSky() { try { fs.writeFileSync(SKY_FILE, JSON.stringify(sky, null, 2)); } catch (e) {} }

function makePlayer(name, emoji, bot) {
  const used = new Set(players.map(p => p.color));
  const color = COLORS.find(c => !used.has(c)) || COLORS[players.length % COLORS.length];
  return {
    id: nextPlayerId++,
    name: String(name || 'Friend').slice(0, 14),
    emoji: emoji || EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    color, bot: !!bot,
    width: 1,          // personal, adaptive timing window multiplier (DDA)
    streak: 0, hits: 0, misses: 0,
  };
}
function addBot() {
  if (players.length >= MAX_PLAYERS) return null;
  const p = makePlayer(BOT_NAMES[players.filter(x => x.bot).length % BOT_NAMES.length], '✦', true);
  players.push(p);
  return p;
}
function baseWindow() { return Math.max(380, 1150 - (level - 1) * 105); }

function publicState() {
  return {
    t: 'state', phase, serverNow: Date.now(), roundMs: ROUND_MS,
    players: players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color, bot: p.bot, hits: p.hits, streak: p.streak })),
    score, combo, bestCombo, level, light, passes,
    timeLeft: phase === 'playing' ? Math.max(0, Math.ceil((roundEndsAt - Date.now()) / 1000)) : 0,
    turn: turn ? {
      targets: turn.targets.slice(), startAt: turn.startAt, deadline: turn.deadline,
      windowMs: turn.windowMs, type: turn.type, hits: [...turn.hits], resolved: turn.resolved,
    } : null,
    lastTargetId, sky, endReason,
  };
}
function pushState() { broadcast(publicState()); }

function onMessage(c, msg) {
  switch (msg.t) {
    case 'ping': {
      const s1 = Date.now();
      send(c, { t: 'pong', c0: msg.c0, s1, s2: Date.now() });
      break;
    }
    case 'hello': {
      c.role = msg.role === 'board' ? 'board' : 'controller';
      if (c.role === 'controller') {
        if (c.playerId == null || !players.find(p => p.id === c.playerId)) {
          const p = makePlayer(msg.name, msg.emoji, false);
          players.push(p);
          c.playerId = p.id;
        }
      }
      send(c, { t: 'welcome', you: c.playerId, role: c.role, state: publicState() });
      pushState();
      break;
    }
    case 'start':     startRound(); break;
    case 'addBot':    addBot(); pushState(); break;
    case 'kickBot': {
      const b = players.find(p => p.bot);
      if (b) { players = players.filter(p => p.id !== b.id); pushState(); }
      break;
    }
    case 'resetSky':  sky = { stars: 0, rounds: 0, bestScore: 0, bestCombo: 0 }; saveSky(); pushState(); break;
    case 'tap':       if (c.playerId != null) handleTap(c.playerId, msg.sentAt); break;
  }
}

function startRound() {
  if (phase === 'playing' || phase === 'countdown') return;
  clearTimeout(roundTimer); clearTimeout(turnTimer); clearTimeout(gapTimer); clearTimeout(countTimer);
  while (players.length < 2) addBot();          // solo demo is still a relay
  if (players.length > MAX_PLAYERS) players = players.slice(0, MAX_PLAYERS);
  score = 0; combo = 0; bestCombo = 0; level = 1; light = 100; passes = 0;
  turn = null; lastTargetId = null; endReason = 'time';
  roundStats = {};
  players.forEach(p => { p.streak = 0; p.hits = 0; p.misses = 0; p.width = 1; });
  phase = 'countdown';
  pushState();
  let n = 3;
  broadcast({ t: 'countdown', n });
  const step = () => {
    n--;
    if (n > 0) { broadcast({ t: 'countdown', n }); countTimer = setTimeout(step, 700); }
    else {
      broadcast({ t: 'countdown', n: 0 });
      phase = 'playing';
      roundEndsAt = Date.now() + ROUND_MS;
      roundTimer = setTimeout(() => endRound('time'), ROUND_MS);
      pushState();
      gapTimer = setTimeout(() => { gapTimer = null; nextTurn(); }, 450);
    }
  };
  countTimer = setTimeout(step, 700);
}

function pickTarget() {
  const others = players.filter(p => p.id !== lastTargetId);
  const pool = others.length ? others : players;
  // mild bias toward whoever has had the fewest turns, keeps everyone involved
  const minHits = Math.min(...pool.map(p => p.hits));
  const fresh = pool.filter(p => p.hits <= minHits + 1);
  const list = fresh.length ? fresh : pool;
  return list[Math.floor(Math.random() * list.length)].id;
}

function nextTurn() {
  if (phase !== 'playing') return;
  clearTimeout(turnTimer);
  const type = (passes > 0 && passes % CHORUS_EVERY === 0) ? 'chorus' : 'pass';
  const targets = type === 'chorus' ? players.map(p => p.id) : [pickTarget()];
  let w = baseWindow();
  if (type === 'pass') {
    const p = players.find(x => x.id === targets[0]);
    w = Math.round(w * (p ? p.width : 1));
  } else w = Math.round(w * 1.45);
  const startAt = Date.now();
  turn = { targets, startAt, deadline: startAt + w, windowMs: w, type, hits: new Set(), resolved: false };
  lastTargetId = targets[0];
  pushState();

  // bots tap themselves, so one device is enough to try the whole game
  for (const id of targets) {
    const p = players.find(x => x.id === id);
    if (p && p.bot) {
      const delay = Math.round(w * (0.18 + Math.random() * 0.55));
      const accurate = Math.random() < (p.width > 1.15 ? 0.94 : 0.88);
      // A "miss" bot simply never taps; the turn times out naturally.
      if (accurate) setTimeout(() => {
        if (!turn || turn.resolved || !turn.targets.includes(id)) return;
        handleTap(id, Date.now());
      }, delay);
    }
  }
  // Chorus is forgiving: a majority hit still counts as harmony.
  turnTimer = setTimeout(() => {
    if (turn && !turn.resolved && turn.type === 'chorus' &&
        turn.hits.size >= Math.ceil(turn.targets.length / 2)) resolveTurn(true, null);
    else resolveTurn(false, null);
  }, w + 70);
}

function handleTap(pid, sentAt) {
  if (phase !== 'playing' || !turn || turn.resolved) return;
  if (!turn.targets.includes(pid) || turn.hits.has(pid)) return;
  const p = players.find(x => x.id === pid);
  if (!p) return;
  // Clock-sync'd client timestamps let us remove roughly half the uplink lag.
  // On a home LAN this is ~1-3 ms, but it matters on a congested 2.4 GHz band.
  let rtt = 0;
  if (Number.isFinite(sentAt) && sentAt > 1e12) rtt = Math.max(0, Math.min(300, Date.now() - sentAt));
  const tapAt = Date.now() - rtt / 2;
  const hit = tapAt <= turn.deadline;
  if (!hit) { resolveTurn(false, pid); return; }
  turn.hits.add(pid);
  p.streak++; p.hits++;
  p.width = Math.max(0.82, p.width - 0.02);       // skilled player -> slightly tighter
  const c = [...clients].find(x => x.playerId === pid);
  if (c) send(c, { t: 'fx', kind: 'hit' });
  if (turn.type === 'pass') resolveTurn(true, null);
  else {
    pushState();
    if (turn.hits.size >= turn.targets.length) resolveTurn(true, null);
  }
}

function resolveTurn(ok, missedBy) {
  if (!turn || turn.resolved) return;
  turn.resolved = true;
  clearTimeout(turnTimer);
  const t = turn;
  let gain = 0, kind = 'miss';
  if (ok) {
    kind = t.type === 'chorus' ? 'chorus' : 'hit';
    passes++; combo++;
    bestCombo = Math.max(bestCombo, combo);
    level = Math.min(LEVEL_MAX, 1 + Math.floor(passes / LEVEL_EVERY));
    gain = (100 + level * 12) * Math.min(combo, 8) * (t.type === 'chorus' ? 2 : 1);
    score += gain;
    light = Math.min(100, light + (t.type === 'chorus' ? 15 : HIT_LIGHT));
    for (const id of t.hits) { const p = players.find(x => x.id === id); if (p) p.width = Math.max(0.82, p.width - 0.01); }
  } else {
    combo = 0;
    light = Math.max(0, light - MISS_LIGHT);
    if (missedBy != null) {
      const p = players.find(x => x.id === missedBy);
      // hidden, forgiving dynamic difficulty: a struggling player's window widens
      if (p) { p.misses++; p.streak = 0; p.width = Math.min(1.75, p.width + 0.16); }
    }
  }
  broadcast({ t: 'turnResult', ok, kind, gain, combo, score, light, level, passes,
              from: lastTargetId, targets: t.targets, hits: [...t.hits], type: t.type,
              message: ok ? (kind === 'chorus' ? 'HARMONY!' : 'Nice pass!') : 'The glow slipped — it comes right back' });
  pushState();
  if (light <= 0) { endRound('faded'); return; }
  gapTimer = setTimeout(() => {
    gapTimer = null;
    turn = null;
    pushState();
    nextTurn();
  }, ok ? 250 : 640);
}

function endRound(reason) {
  if (phase !== 'playing') return;
  phase = 'roundEnd';
  clearTimeout(roundTimer); clearTimeout(turnTimer); clearTimeout(gapTimer);
  turn = null; endReason = reason;
  sky.rounds += 1;
  sky.stars += 1 + (score > 6000 ? 1 : 0) + (bestCombo >= 20 ? 1 : 0);
  sky.bestScore = Math.max(sky.bestScore || 0, score);
  sky.bestCombo = Math.max(sky.bestCombo || 0, bestCombo);
  saveSky();
  broadcast({ t: 'roundEnd', reason, score, bestCombo, level, passes, sky,
              stats: players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color,
                                         bot: p.bot, hits: p.hits, streak: p.streak, misses: p.misses })) });
  pushState();
}

process.on('SIGINT', () => { console.log('\n  Firefly Relay stopped.'); process.exit(0); });

server.listen(PORT, '0.0.0.0', () => {
  const ips = lanIPs();
  console.log('');
  console.log('  ✦  FIREFLY RELAY — family co-op over your home Wi-Fi');
  console.log('  ─────────────────────────────────────────────────────');
  console.log('  Board (TV / PC) : http://localhost:' + PORT + '/?board=1');
  for (const ip of ips) {
    console.log('  Phones (Wi-Fi)  : http://' + ip + ':' + PORT + '/');
  }
  if (!ips.length) console.log('  (no LAN IP found — are you offline?)');
  console.log('  Wireframes      : http://localhost:' + PORT + '/wireframe.html');
  console.log('  ─────────────────────────────────────────────────────');
  console.log('  No internet needed. Ctrl+C to stop.');
  console.log('');
});
