// WOBBLE WORKS CLASSIC — WebSocket room for the side-view 2D build.
// The main server hands us upgraded sockets for /ws2d; everything below is
// independent of the 3D room so the arena code path cannot regress.
'use strict';

const crypto = require('crypto');
const { createSim, TICK_MS, LEVELS, SANDBOX } = require('./sim2d.js');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const SNAP_MS = 1000 / 20;
const MAX_PLAYERS = 12;

const R = {
  sim: null,
  clients: new Map(),   // socket -> { playerId, board }
  boards: new Set(),
  timers: null
};

function ensureSim() {
  if (!R.sim) {
    R.sim = createSim(1);
    R.sim.onEvent = (ev) => broadcast({ type: 'fx', event: ev });
  }
  return R.sim;
}

function frame(json) {
  const payload = Buffer.from(json, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function send(socket, obj) {
  if (!socket.writable || socket.destroyed) return;
  socket.write(frame(JSON.stringify(obj)));
}

function broadcast(msg) {
  const buf = frame(JSON.stringify(msg));
  for (const s of R.boards) if (s.writable && !s.destroyed) s.write(buf);
  for (const s of R.clients.keys()) if (s.writable && !s.destroyed) s.write(buf);
}

// Real-time paced physics: a setInterval alone drifts under load, which made
// the whole room run in slow motion. Accumulate wall-clock time instead.
let acc = 0;
let lastTick = 0;

function tick() {
  const sim = ensureSim();
  if (R.clients.size === 0 && R.boards.size === 0) { acc = 0; lastTick = 0; return; }
  const now = Date.now();
  if (!lastTick) lastTick = now;
  let dt = now - lastTick;
  lastTick = now;
  if (dt < 0) dt = 0;
  if (dt > 250) dt = 250;
  acc += dt;
  let guard = 0;
  while (acc >= TICK_MS && guard < 8) {
    sim.step();
    acc -= TICK_MS;
    guard++;
  }
}

function snapshotLoop() {
  const sim = ensureSim();
  if (R.clients.size === 0 && R.boards.size === 0) return;
  broadcast(sim.snapshot());
}

function startTimers() {
  if (R.timers) return;
  R.timers = {
    tick: setInterval(tick, Math.max(4, Math.round(TICK_MS / 2))),
    snap: setInterval(snapshotLoop, SNAP_MS)
  };
  if (R.timers.tick.unref) { R.timers.tick.unref(); R.timers.snap.unref(); }
}

// ---------------- message handling ----------------

function handleMessage(socket, msg) {
  const sim = ensureSim();

  if (msg.type === 'join') {
    if (msg.board) {
      R.boards.add(socket);
      send(socket, {
        type: 'joined', board: true, level: sim.levelInfo(),
        tabs: LEVELS.map(l => [l.id, l.name]).concat([[SANDBOX.id, SANDBOX.name]])
      });
      startTimers();
      return;
    }
    const existing = R.clients.get(socket);
    if (existing && existing.playerId) return;
    if (sim.players.size >= MAX_PLAYERS) {
      send(socket, { type: 'full' });
      return;
    }
    const id = msg.playerId || ('c-' + Math.random().toString(36).slice(2, 7));
    let p = sim.players.get(id);
    if (!p) p = sim.addPlayer(id, msg.name);
    p.afk = false;
    R.clients.set(socket, { playerId: id });
    send(socket, {
      type: 'joined', id: p.id, name: p.name, color: p.color,
      level: sim.levelInfo()
    });
    broadcast({ type: 'toast', text: '👋 ' + p.name + ' joined!' });
    startTimers();
    return;
  }

  // board commands: level switching, props, reset (no player attached)
  if (msg.type === 'level') {
    const id = Number(msg.id) || 1;
    sim.loadLevel(id);
    broadcast({ type: 'level', level: sim.levelInfo() });
    broadcast({ type: 'toast', text: '📖 ' + sim.level.name });
    return;
  }
  if (msg.type === 'tool') {
    if (sim.addTool(msg.kind)) {
      broadcast({ type: 'toast', text: '🔧 ' + (msg.kind || 'crate') + ' dropped!' });
    }
    return;
  }
  if (msg.type === 'nextLevel') {
    const cur = sim.level.id;
    const next = cur >= 4 ? 5 : cur + 1;
    sim.loadLevel(next);
    broadcast({ type: 'level', level: sim.levelInfo() });
    return;
  }
  if (msg.type === 'reset') {
    sim.loadLevel(sim.level.id);
    broadcast({ type: 'level', level: sim.levelInfo() });
    return;
  }

  const conn = R.clients.get(socket);
  if (!conn) return;

  if (conn.playerId) {
    const p = sim.players.get(conn.playerId);
    if (msg.type === 'input' && p) {
      sim.setInput(conn.playerId, msg);
    } else if (msg.type === 'call' && p) {
      p.bubble = String(msg.text || '👋').slice(0, 10);
      p.bubbleAt = Date.now();
      broadcast({ type: 'fx', event: { type: 'call', who: p.name, text: p.bubble, at: Date.now() } });
    } else if (msg.type === 'visibility' && p) {
      p.afk = !!msg.hidden;
      if (p.afk) sim.releaseHands(p);
    }
  }
}

// ---------------- upgrade ----------------

function parseFrames(socket, chunk, onMessage) {
  let offset = 0;
  while (offset < chunk.length) {
    if (chunk.length < offset + 2) break;
    const b0 = chunk[offset], b1 = chunk[offset + 1];
    const opcode = b0 & 0x0f;
    if (opcode === 0x08) { socket.end(); return; }
    if (opcode === 0x09) { socket.write(Buffer.from([0x8a, 0x00])); offset += 2; continue; }
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let headerLen = 2;
    if (len === 126) {
      if (chunk.length < offset + 4) break;
      len = chunk.readUInt16BE(offset + 2);
      headerLen = 4;
    } else if (len === 127) {
      if (chunk.length < offset + 10) break;
      len = Number(chunk.readBigUInt64BE(offset + 2));
      headerLen = 10;
    }
    if (!masked) { offset += headerLen + len; continue; }
    const maskKey = chunk.slice(offset + headerLen, offset + headerLen + 4);
    const payload = chunk.slice(offset + headerLen + 4, offset + headerLen + 4 + len);
    for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i % 4];
    offset += headerLen + 4 + len;
    try { onMessage(JSON.parse(payload.toString('utf8'))); } catch (e) {}
  }
}

function accept(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return false; }
  const digest = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + digest + '\r\n\r\n'
  );
  return true;
}

function handleUpgrade(req, socket) {
  if (!accept(req, socket)) return;
  startTimers();
  socket.on('data', chunk => parseFrames(socket, chunk, msg => handleMessage(socket, msg)));
  socket.on('close', () => {
    const conn = R.clients.get(socket);
    if (conn && conn.playerId) {
      const sim = ensureSim();
      const p = sim.players.get(conn.playerId);
      if (p) {
        p.afk = true;
        sim.releaseHands(p);
        setTimeout(() => {
          const stillHere = R.clients.get(socket);
          if (stillHere && stillHere.playerId === conn.playerId) {
            const q = sim.players.get(conn.playerId);
            if (q && q.afk) sim.removePlayer(conn.playerId);
          }
        }, 90000);
      }
    }
    R.clients.delete(socket);
    R.boards.delete(socket);
  });
  socket.on('error', () => {});
}

module.exports = {
  handleUpgrade,
  handleMessage,
  ensureSim,
  levels: LEVELS,
  sandbox: SANDBOX,
  MAX_PLAYERS
};
