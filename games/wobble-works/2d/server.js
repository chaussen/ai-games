// WOBBLE WORKS - authoritative LAN physics host.
// Zero install: node server.js. Physics = vendored Matter.js, transport = hand-rolled RFC6455 WebSocket.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const Matter = require('../vendor/matter.min.js');
const Levels = require('./levels.js');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';       // explicit IPv4 wildcard: reachable from Wi-Fi clients
const LAN_IP = (process.env.LAN_IP || '').trim(); // optional QR override when auto-detect picks the wrong NIC
const MAX_PLAYERS = 8;
const TICK_MS = 1000 / 60;          // fixed physics step
const SNAP_MS = 1000 / 20;          // state broadcast to clients
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const SAVE_FILE = path.join(ROOT, '.wobble-save.json');
const CORE_DENSITY = Number(process.env.CORE_DENSITY || 0.0026);   // tuned: heavy enough to need a team
const COLORS = ['#ef6f5b','#3aa6a0','#f2b544','#8b6fd4','#e06fa8','#5a9de0','#8cbf4a','#e58a3c'];

const { Engine, Bodies, Body, Composite, Constraint, Query } = Matter;

// ---------- static HTTP ----------
const STATIC = {};
function cache(file, type) {
  try { STATIC[file] = { buf: fs.readFileSync(path.join(file.startsWith('vendor/') ? path.join(ROOT, '..') : ROOT, file)), type: type }; }
  catch (e) { console.error('missing static file:', file); }
}
['index.html','app.js','style.css','wireframe.html','vendor/qrcode.js'].forEach(function (f) {
  const ext = f.split('.').pop();
  cache(f, ext === 'html' ? 'text/html; charset=utf-8' : ext === 'css' ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8');
});
// Virtual / tunnel / bridge NICs (Docker, libvirt, VPN, Tailscale, ...) are not
// reachable from a phone on the home Wi-Fi, so never put them in the QR code.
const SKIP_IFACE = /^(docker|br-|virbr|vnet|veth|tun|tap|wg|tailscale|zt|ham|lxc|podman|nm-)/i;
function ipRank(ip) {
  if (/^192\.168\./.test(ip)) return 0;
  if (/^10\./.test(ip)) return 1;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return 2;
  return 3;
}
function lanIPs() {
  const out = [], seen = new Set();
  const ifs = os.networkInterfaces();
  Object.keys(ifs).forEach(function (k) {
    if (SKIP_IFACE.test(k)) return;
    (ifs[k] || []).forEach(function (a) {
      if (a.family !== 'IPv4' || a.internal || seen.has(a.address)) return;
      seen.add(a.address); out.push(a.address);
    });
  });
  out.sort(function (x, y) { return ipRank(x) - ipRank(y); });
  if (LAN_IP) { const i = out.indexOf(LAN_IP); if (i >= 0) out.splice(i, 1); out.unshift(LAN_IP); }
  return out;
}
const httpServer = http.createServer(function (req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  if (urlPath === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (urlPath === '/config.js') {
    const body = 'window.WOBBLE_CONFIG=' + JSON.stringify({ lanIPs: lanIPs(), port: PORT }) + ';';
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body); return;
  }
  const f = urlPath.replace(/^\//, '');
  if (STATIC[f]) {
    res.writeHead(200, { 'Content-Type': STATIC[f].type, 'Cache-Control': 'no-cache' });
    res.end(STATIC[f].buf); return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404');
});

// ---------- minimal WebSocket ----------
function frame(opcode, payload) {
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
  else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  head[0] = 0x80 | opcode;
  return Buffer.concat([head, payload]);
}
function sendRaw(ws, opcode, payload) { try { ws.write(frame(opcode, payload)); } catch (e) {} }
function send(ws, obj) { sendRaw(ws, 0x1, Buffer.from(JSON.stringify(obj))); }
function broadcast(obj) { const b = Buffer.from(JSON.stringify(obj)); for (const p of S.players.values()) if (p.ws && !p.ws.destroyed) try { p.ws.write(frame(0x1, b)); } catch (e) {} }
function parseFrames(sock, buf, onMsg) {
  let off = 0;
  while (off + 2 <= buf.length) {
    const b0 = buf[off], b1 = buf[off + 1];
    const fin = !!(b0 & 0x80), opcode = b0 & 0x0f;
    let len = b1 & 0x7f, h = 2;
    if (len === 126) { if (off + 4 > buf.length) break; len = buf.readUInt16BE(off + 2); h = 4; }
    else if (len === 127) { if (off + 10 > buf.length) break; len = Number(buf.readBigUInt64BE(off + 2)); h = 10; }
    let mask = null;
    if (b1 & 0x80) { if (off + h + 4 > buf.length) break; mask = buf.slice(off + h, off + h + 4); h += 4; }
    if (off + h + len > buf.length) break;
    let data = Buffer.from(buf.slice(off + h, off + h + len));
    if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
    off += h + len;
    if (opcode === 0x8) { try { sock.end(frame(0x8, Buffer.alloc(0))); } catch (e) {} sock.destroy(); return Buffer.alloc(0); }
    if (opcode === 0x9) { sendRaw(sock, 0xA, data); continue; }
    if ((opcode === 0x1 || opcode === 0x0) && fin) { try { onMsg(JSON.parse(data.toString('utf8'))); } catch (e) {} }
  }
  return buf.slice(off);
}
httpServer.on('upgrade', function (req, sock) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  let buf = Buffer.alloc(0);
  let client = null;
  const holder = { id: null, ws: sock };
  sock.on('data', function (chunk) {
    buf = parseFrames(sock, Buffer.concat([buf, chunk]), function (msg) { handleMessage(holder, msg); });
  });
  sock.on('close', function () { if (holder.id) dropClient(holder.id); });
  sock.on('error', function () {});
});

// ---------- world ----------
const S = {
  players: new Map(), levelId: 1, spec: null, world: null, phase: 'lobby',
  startedAt: 0, wonAt: 0, goalHold: 0, toolsUsed: 0, mechanics: new Set(),
  fx: [], fxSeq: 0, lastCheckpoint: null, win: null, scrapbook: loadSave(), seq: 0
};
function loadSave() {
  try { return JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')); }
  catch (e) { return { stamps: [], bestTimes: {}, placements: [] }; }
}
function saveSave() { try { fs.writeFileSync(SAVE_FILE, JSON.stringify(S.scrapbook, null, 2)); } catch (e) {} }
function pushFx(kind, extra) {
  const e = Object.assign({ id: ++S.fxSeq, kind: kind, at: Date.now() }, extra || {});
  S.fx.push(e); if (S.fx.length > 60) S.fx.shift(); return e;
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function createWorld(spec) {
  const engine = Engine.create();
  engine.gravity.y = 1; engine.gravity.scale = 0.001;
  engine.positionIterations = 8; engine.velocityIterations = 8; engine.constraintIterations = 4;
  const list = [], solids = [], byId = new Map();
  let n = 0;
  function add(body, kind, extra) {
    const id = kind + '-' + (++n);
    body.plugin.ww = Object.assign({ id: id, kind: kind, grabbable: true }, extra || {});
    Composite.add(engine.world, body);
    list.push(body); byId.set(id, body);
    if (!body.isSensor && kind !== 'head' && kind !== 'hand') solids.push(body);
    return body;
  }
  (spec.statics || []).forEach(function (s) {
    const b = Bodies.rectangle(s.x, s.y, s.w, s.h, {
      isStatic: true, angle: s.angle || 0, friction: 0.9, frictionStatic: 1, restitution: 0.02
    });
    add(b, s.kind, { w: s.w, h: s.h, angle: s.angle || 0, grabbable: false });
  });
  (spec.dynamics || []).forEach(function (d) {
    if (d.kind === 'barrel') {
      const b = Bodies.circle(d.x, d.y, d.r, { density: 0.0022, friction: 0.6, frictionAir: 0.006, restitution: 0.15 });
      add(b, 'barrel', { r: d.r });
    } else {
      const b = Bodies.rectangle(d.x, d.y, d.w, d.h, { density: 0.0022, friction: 0.7, frictionAir: 0.004, restitution: 0.08, chamfer: { radius: Math.min(6, d.h / 3) } });
      add(b, d.kind, { w: d.w, h: d.h });
    }
  });
  const core = Bodies.circle(spec.core.x, spec.core.y, 34, {
    density: CORE_DENSITY, friction: 0.28, frictionStatic: 0.42, restitution: 0.24, frictionAir: 0.004
  });
  add(core, 'core', { r: 34 });
  const plates = (spec.plates || []).map(function (p) {
    const b = Bodies.rectangle(p.x, p.y, p.w, p.h, { isStatic: true, isSensor: true });
    add(b, 'plate', { w: p.w, h: p.h, gate: p.gate, latched: p.latched !== false, pressed: false, opened: false, grabbable: false });
    return { id: b.plugin.ww.id, body: b, gate: p.gate, latched: p.latched !== false };
  });
  const gates = (spec.gates || []).map(function (g) {
    const b = Bodies.rectangle(g.x, g.y, g.w, g.h, { isStatic: true, friction: 0.8 });
    add(b, 'gate', { w: g.w, h: g.h, open: false, grabbable: false });
    return { id: b.plugin.ww.id, body: b };
  });
  const seesaws = (spec.seesaws || []).map(function (s) {
    const plank = Bodies.rectangle(s.x, s.y, s.w, s.h, { density: 0.0026, friction: 0.7, frictionAir: 0.03, chamfer: { radius: 4 } });
    add(plank, 'plank', { w: s.w, h: s.h, seesaw: true });
    const c = Constraint.create({ pointA: { x: s.x, y: s.y }, bodyB: plank, pointB: { x: 0, y: 0 }, length: 0, stiffness: 0.95, damping: 0.15 });
    Composite.add(engine.world, c);
    return { x: s.x, y: s.y, w: s.w, plank: plank };
  });
  const ropes = (spec.ropes || []).map(function (r, ri) {
    const nodes = [];
    for (let i = 0; i < r.segments; i++) {
      const b = Bodies.circle(r.x, r.y + i * r.length, 6, { density: 0.0007, frictionAir: 0.03, friction: 0.4, restitution: 0.05 });
      add(b, 'rope', { r: 6, ropeGroup: ri, ropeIndex: i });
      nodes.push(b);
      if (i === 0) {
        Composite.add(engine.world, Constraint.create({ pointA: { x: r.x, y: r.y }, bodyB: b, length: 0, stiffness: 1 }));
      } else {
        Composite.add(engine.world, Constraint.create({ bodyA: nodes[i - 1], bodyB: b, length: r.length, stiffness: 0.92, damping: 0.08 }));
      }
    }
    return { group: ri, nodes: nodes };
  });
  return {
    engine: engine, list: list, solids: solids, byId: byId, core: core,
    plates: plates, gates: gates, seesaws: seesaws, ropes: ropes,
    water: spec.water || [], wind: spec.wind || [], checkpoints: spec.checkpoints || [],
    goal: spec.goal, spec: spec
  };
}

function setLevel(id) {
  S.levelId = Number(id) || 1;
  S.spec = Levels.getLevel(S.levelId);
  S.world = createWorld(S.spec);
  S.phase = 'lobby'; S.goalHold = 0; S.toolsUsed = 0; S.mechanics = new Set();
  S.fx = []; S.win = null; S.startedAt = 0; S.wonAt = 0;
  S.lastCheckpoint = { x: S.spec.core.x, y: S.spec.core.y };
  for (const p of S.players.values()) spawnPlayer(p, spawnFor(p));
  pushFx('level', { name: S.spec.name });
  broadcast({ type: 'levelChanged', levelId: S.levelId });
}
function spawnFor(p) {
  const i = p.slot % S.spec.spawn.length;
  return { x: S.spec.spawn[i][0], y: S.spec.spawn[i][1] };
}

// ---------- players ----------
function makeClient(ws, msg) {
  const id = 'P' + (++S.seq);
  const p = {
    id: id, ws: ws, name: String(msg.name || 'Wobbler').slice(0, 12),
    emoji: String(msg.emoji || '🙂').slice(0, 4), board: !!msg.board, bot: false,
    color: COLORS[(S.seq - 1) % COLORS.length], slot: (S.seq - 1) % MAX_PLAYERS,
    input: { left: false, right: false, jump: false, grabL: false, grabR: false },
    prevJump: false, prevGrab: [false, false], grab: [null, null], grounded: false,
    bubble: null, bubbleAt: 0, respawns: 0, pingAt: 0, rtt: 0, joinedAt: Date.now(),
    torso: null, head: null, hands: [], arms: [], headC: null, feet: [], legs: [], stride: 0
  };
  S.players.set(id, p);
  spawnPlayer(p, spawnFor(p));
  send(ws, { type: 'welcome', id: id, color: p.color, name: p.name, emoji: p.emoji, board: p.board, levelId: S.levelId });
  return p;
}
function rigParts(p) {
  return [p.torso, p.head, p.hands[0], p.hands[1], p.headC, p.arms[0], p.arms[1]].concat(p.feet || [], p.legs || []);
}
function spawnPlayer(p, at) {
  const w = S.world;
  if (p.torso) {
    rigParts(p).forEach(function (b) { if (b) Composite.remove(w.engine.world, b); });
  }
  releaseGrabs(p);
  const torso = Bodies.rectangle(at.x, at.y, 30, 46, {
    chamfer: { radius: 12 }, density: 0.0018, friction: 0.62, frictionStatic: 0.85,
    frictionAir: 0.012, restitution: 0.03, label: 'wobbler'
  });
  // finite inertia: wobblers tip, spin and flop when hit, thrown or flailing.
  // A soft self-righting spring (see step) stands them back up.
  Body.setInertia(torso, torso.inertia * 3.2);
  const head = Bodies.circle(at.x, at.y - 30, 13, { collisionFilter: { mask: 0 }, frictionAir: 0.05, density: 0.0005 });
  const hands = [0, 1].map(function (i) {
    return Bodies.circle(at.x + (i ? 16 : -16), at.y - 4, 8, { isSensor: true, collisionFilter: { mask: 0 }, frictionAir: 0.2, density: 0.0004 });
  });
  const headC = Constraint.create({ bodyA: torso, pointA: { x: 0, y: -22 }, bodyB: head, length: 4, stiffness: 0.72, damping: 0.14 });
  const arms = hands.map(function (h, i) {
    return Constraint.create({ bodyA: torso, pointA: { x: i ? 13 : -13, y: -6 }, bodyB: h, length: 24, stiffness: 0.3, damping: 0.14 });
  });
  const feet = [0, 1].map(function (i) {
    return Bodies.circle(at.x + (i ? 8 : -8), at.y + 28, 7, { isSensor: true, collisionFilter: { mask: 0 }, frictionAir: 0.06, density: 0.0006 });
  });
  const legs = feet.map(function (f, i) {
    return Constraint.create({ bodyA: torso, pointA: { x: i ? 8 : -8, y: 18 }, bodyB: f, length: 16, stiffness: 0.22, damping: 0.12 });
  });
  Composite.add(w.engine.world, [torso, head, hands[0], hands[1], headC, arms[0], arms[1]].concat(feet, legs));
  if (w.solids.indexOf(torso) < 0) w.solids.push(torso);
  p.torso = torso; p.head = head; p.hands = hands; p.headC = headC; p.arms = arms; p.feet = feet; p.legs = legs; p.stride = 0;
  p.grounded = false; p.prevJump = false;
}
function addBot() {
  if (S.players.size >= MAX_PLAYERS + 4) return null;
  const lane = [...S.players.values()].filter(function (q) { return q.bot; }).length;
  const id = 'BOT' + (++S.seq);
  const names = ['Pip','Momo','Bubbles','Noodle','Tofu'];
  const p = {
    id: id, ws: null, name: names[S.seq % names.length], emoji: '🤖', board: false, bot: true,
    color: COLORS[(S.seq - 1) % COLORS.length], slot: (S.seq - 1) % MAX_PLAYERS,
    input: { left: false, right: false, jump: false, grabL: false, grabR: false },
    prevJump: false, prevGrab: [false, false], grab: [null, null], grounded: false,
    bubble: null, bubbleAt: 0, respawns: 0, pingAt: 0, rtt: 0, joinedAt: Date.now(),
    torso: null, head: null, hands: [], arms: [], headC: null, feet: [], legs: [], stride: 0, lane: lane, botJumpAt: 0
  };
  S.players.set(id, p);
  spawnPlayer(p, spawnFor(p));
  pushFx('join', { who: p.name });
  return p;
}
function dropClient(id) {
  const p = S.players.get(id);
  if (!p) return;
  releaseGrabs(p);
  const w = S.world;
  if (w && p.torso) {
    rigParts(p).forEach(function (b) { if (b) Composite.remove(w.engine.world, b); });
    const ix = w.solids.indexOf(p.torso); if (ix >= 0) w.solids.splice(ix, 1);
  }
  S.players.delete(id);
}

function releaseGrabs(p) {
  for (let i = 0; i < 2; i++) {
    if (p.grab[i]) {
      try { Composite.remove(S.world.engine.world, p.grab[i].constraint); } catch (e) {}
      p.grab[i] = null;
    }
  }
}
function tryGrab(p, i) {
  if (p.grab[i]) return;
  const hand = p.hands[i];
  let best = null, bestD = 66;
  for (const b of S.world.list) {
    const ww = b.plugin && b.plugin.ww;
    if (!ww || ww.grabbable === false || b.isSensor) continue;
    if (b === p.torso || b === p.head || b === p.hands[0] || b === p.hands[1]) continue;
    const d = dist(hand.position, b.position);
    // for big bodies compare against their surface, not just centre
    const reach = Math.max(0, d - (ww.r || Math.min(ww.w || 40, ww.h || 40) / 2));
    if (reach < bestD) { bestD = reach; best = b; }
  }
  if (!best) return;
  const pointB = { x: hand.position.x - best.position.x, y: hand.position.y - best.position.y };
  const c = Constraint.create({ bodyA: hand, bodyB: best, pointB: pointB, length: 0, stiffness: 0.68, damping: 0.16 });
  Composite.add(S.world.engine.world, c);
  p.grab[i] = { constraint: c, target: best };
  const kind = best.plugin.ww.kind;
  if (kind === 'rope') S.mechanics.add('rope');
  if (best.label === 'wobbler') S.mechanics.add('chain');
  if (kind === 'core') S.mechanics.add('coregrab');
  // two players on the same object = a shared carry
  if (kind === 'plank' || kind === 'core') {
    for (const q of S.players.values()) {
      if (q !== p && q.grab.some(function (g) { return g && g.target === best; })) S.mechanics.add('carry');
    }
  }
}
function releaseGrab(p, i) {
  const g = p.grab[i];
  if (!g) return;
  try { Composite.remove(S.world.engine.world, g.constraint); } catch (e) {}
  p.grab[i] = null;
}

function spawnTool(kind, p) {
  const spec = S.spec;
  if (S.toolsUsed >= spec.toolBudget) return false;
  const x = p ? p.torso.position.x : spec.core.x;
  const y = p ? p.torso.position.y - 70 : spec.core.y - 70;
  let b;
  if (kind === 'crate') b = Bodies.rectangle(x, y, 64, 64, { density: 0.0022, friction: 0.7, chamfer: { radius: 6 } });
  else if (kind === 'plank') b = Bodies.rectangle(x, y, 220, 16, { density: 0.0018, friction: 0.7, chamfer: { radius: 4 } });
  else if (kind === 'barrel') b = Bodies.circle(x, y, 26, { density: 0.0022, friction: 0.6, restitution: 0.2 });
  else return false;
  const id = 'tool-' + (++S.seq);
  b.plugin.ww = { id: id, kind: kind, w: kind === 'barrel' ? 0 : (kind === 'plank' ? 220 : 64), h: kind === 'barrel' ? 0 : (kind === 'plank' ? 16 : 64), r: kind === 'barrel' ? 26 : 0, grabbable: true };
  Composite.add(S.world.engine.world, b);
  S.world.list.push(b); S.world.solids.push(b); S.world.byId.set(id, b);
  if (kind === 'rope') return false;
  S.toolsUsed++;
  pushFx('drop', { who: p ? p.name : 'board', kind: kind, x: x, y: y });
  return true;
}

// ---------- simulation ----------
function botBrain(p) {
  const w = S.world, core = w.core, goal = w.goal;
  const pos = p.torso.position;
  let targetX = pos.x + Math.sin(Date.now() / 1100 + p.slot) * 160;
  if (goal) {
    // Everyone leans on the Core from behind; collision stops them at contact.
    targetX = core.position.x - 20;
  }
  p.input.left = false;
  p.input.right = pos.x < targetX;
  const blocked = p.grounded && Math.abs(p.torso.velocity.x) < 0.4 && (p.input.left || p.input.right);
  const now = Date.now();
  // jumping onto each other stops the delivery, so bots almost never jump
  p.input.jump = blocked && now - p.botJumpAt > 1500 && Math.random() < 0.018;
  if (p.input.jump) p.botJumpAt = now;
  p.input.grabL = false; p.input.grabR = false;
}
function step(dt) {
  const w = S.world;
  if (!w) return;
  for (const p of S.players.values()) {
    if (p.bot) botBrain(p);
    const t = p.torso;
    if (!t) continue;
    // grab state from input edges
    for (let i = 0; i < 2; i++) {
      const held = i === 0 ? p.input.grabL : p.input.grabR;
      if (held && !p.prevGrab[i]) tryGrab(p, i);
      if (!held && p.prevGrab[i]) releaseGrab(p, i);
      p.prevGrab[i] = held;
    }
    // grounded: short ray below both feet (rotated with the body)
    let grounded = false;
    const ca = Math.cos(t.angle), sa = Math.sin(t.angle);
    for (const dx of [-10, 10]) {
      const x0 = t.position.x + dx * ca - 20 * sa, y0 = t.position.y + dx * sa + 20 * ca;
      const hits = Query.ray(w.solids, { x: x0, y: y0 }, { x: x0 - 11 * sa, y: y0 + 11 * ca }, 5);
      if (hits.length) { grounded = true; break; }
    }
    p.grounded = grounded;
    const dir = (p.input.right ? 1 : 0) - (p.input.left ? 1 : 0);
    const targetVx = dir * 3.45;
    const vx = t.velocity.x + (targetVx - t.velocity.x) * 0.24;
    Body.setVelocity(t, { x: vx, y: t.velocity.y });
    // SILLY BALANCE: a soft spring stands the body up, leaning into the run.
    // Weak in the air, so jumps, hits and throws tumble and flop.
    let ang = t.angle; while (ang > Math.PI) ang -= 2 * Math.PI; while (ang < -Math.PI) ang += 2 * Math.PI;
    const lean = grounded ? dir * 0.1 : 0;
    const k = grounded ? 0.022 : 0.004;
    Body.setAngularVelocity(t, t.angularVelocity * (grounded ? 0.9 : 0.985) - (ang - lean) * k);
    if (Math.abs(ang) > 1.35) Body.setAngularVelocity(t, t.angularVelocity - Math.sign(ang) * 0.03);
    if (p.input.jump && !p.prevJump && grounded) {
      Body.setVelocity(t, { x: t.velocity.x, y: -9.2 });
      Body.setAngularVelocity(t, t.angularVelocity + (Math.random() - 0.5) * 0.12 + dir * 0.05);
      for (const h of p.hands) Body.setVelocity(h, { x: h.velocity.x + (Math.random() - 0.5) * 6, y: -7 });
      for (const f of p.feet) Body.setVelocity(f, { x: f.velocity.x + (Math.random() - 0.5) * 5, y: 3 });
      pushFx('jump', { x: t.position.x, y: t.position.y, who: p.name });
    }
    // legs: planted and striding on the ground, dangling and kicking in the air
    if (grounded) {
      p.stride += Math.abs(t.velocity.x) * 0.075;
      const moving = Math.min(1, Math.abs(t.velocity.x) / 2.5);
      for (let i = 0; i < 2; i++) {
        const ph = p.stride + (i ? Math.PI : 0);
        const fx = t.position.x + (i ? 7 : -7) + Math.sin(ph) * 13 * moving;
        const fy = t.position.y + 29 - Math.max(0, Math.cos(ph)) * 7 * moving;
        Body.setPosition(p.feet[i], { x: fx, y: fy });
        Body.setVelocity(p.feet[i], { x: t.velocity.x, y: 0 });
      }
    } else if (dir) {
      for (let i = 0; i < 2; i++) Body.applyForce(p.feet[i], p.feet[i].position, { x: Math.sin(Date.now() / 130 + i * 3) * 0.00005, y: 0 });
    }
    // GRAB MECHANICS. Holding an object lets you PUSH it (walk into it), PULL it
    // (walk away) and HOIST it (hold JUMP: arms heave it upward). Hoisting something
    // that sits above you hauls YOU up to it instead - that is how you climb.
    const holds = [];
    for (let i = 0; i < 2; i++) if (p.grab[i] && !p.grab[i].target.isStatic) holds.push(p.grab[i].target);
    const grabbing = !!(p.grab[0] || p.grab[1]);
    if (grabbing && p.input.jump) {
      const uniq = holds.filter(function (b, i) { return holds.indexOf(b) === i; });
      const climb = !uniq.length || uniq.some(function (b) { return t.position.y - b.position.y > 40; });
      if (climb) Body.applyForce(t, t.position, { x: 0, y: -0.0022 * t.mass });
      else for (const b of uniq) {
        Body.applyForce(b, b.position, { x: 0, y: -b.mass * 0.00078 });
        Body.applyForce(t, t.position, { x: 0, y: b.mass * 0.00012 });
        Body.setVelocity(b, { x: b.velocity.x * 0.97, y: b.velocity.y * 0.97 });
        S.mechanics.add('hoist');
      }
    }
    if (dir && holds.length) {
      for (const b of holds.filter(function (x, i) { return holds.indexOf(x) === i; })) {
        const kind = b.plugin.ww.kind;
        const f = (kind === 'core' ? 0.00026 : 0.0006) * Math.min(b.mass, 14);
        Body.applyForce(b, b.position, { x: dir * f, y: 0 });
        const toward = Math.sign(b.position.x - t.position.x) === dir;
        S.mechanics.add(toward ? 'push' : 'pull');
      }
    }
    p.prevJump = p.input.jump;
  }
  // wind zones
  for (const z of w.wind) {
    for (const b of w.list) {
      if (b.isStatic || b.isSensor) continue;
      const q = b.position;
      if (Math.abs(q.x - z.x) < z.w / 2 && Math.abs(q.y - z.y) < z.h / 2) {
        Body.applyForce(b, q, { x: z.fx * b.mass, y: (z.fy || 0) * b.mass });
      }
    }
  }
  for (const p of S.players.values()) {
    if (p.torso && !p.torso.isStatic) {
      const q = p.torso.position;
      for (const z of w.wind) {
        if (Math.abs(q.x - z.x) < z.w / 2 && Math.abs(q.y - z.y) < z.h / 2) {
          Body.applyForce(p.torso, q, { x: z.fx * p.torso.mass, y: (z.fy || 0) * p.torso.mass });
        }
      }
    }
  }
  // WEIGHT TRANSFER (the balance lever): a single wobbler can barely shift the
  // Core; a whole lane leaning into it drives it. Only applied while grounded,
  // so catapults, ramps and falls keep their full physics.
  const core = w.core;
  let push = 0, pushDir = 0;
  for (const p of S.players.values()) {
    const t = p.torso; if (!t) continue;
    const dx = core.position.x - t.position.x;
    const dy = Math.abs(core.position.y - t.position.y);
    if (dx > 0 && dx < 190 && dy < 62 && p.input.right) { push++; pushDir = 1; }
    else if (dx < 0 && dx > -190 && dy < 62 && p.input.left) { push++; pushDir = -1; }
  }
  S.pushCount = push;
  if (push > 0) {
    const probe = w.solids.filter(function (b) { return b !== core; });
    let grounded = false;
    for (const dx of [-18, 18]) {
      const hits = Query.ray(probe, { x: core.position.x + dx, y: core.position.y + 30 }, { x: core.position.x + dx, y: core.position.y + 46 }, 6);
      if (hits.length) { grounded = true; break; }
    }
    S.coreGrounded = grounded;
    if (grounded) {
      const target = Math.min(2.7, push * 0.44) * pushDir;
      Body.setVelocity(core, { x: core.velocity.x + (target - core.velocity.x) * 0.1, y: core.velocity.y });
    }
  } else S.coreGrounded = false;
  Engine.update(w.engine, dt);
  postStep();
}
function inRegion(b, r) {
  const bb = b.bounds;
  return bb.min.x < r.x + r.w / 2 && bb.max.x > r.x - r.w / 2 && bb.min.y < r.y + r.h / 2 && bb.max.y > r.y - r.h / 2;
}
function postStep() {
  const w = S.world, core = w.core;
  // plates and gates
  for (const pl of w.plates) {
    let pressed = false;
    for (const b of w.list) {
      if (b.isStatic || b.isSensor || b.mass < 5) continue;
      const d = b.position;
      if (Math.abs(d.x - pl.body.position.x) < pl.body.plugin.ww.w / 2 + 8 && d.y < pl.body.position.y + 12 && d.y > pl.body.position.y - 150) { pressed = true; break; }
    }
    const ww = pl.body.plugin.ww;
    if (pressed && !ww.pressed) pushFx('plate', { x: pl.body.position.x, y: pl.body.position.y });
    ww.pressed = pressed;
    if (pressed) ww.opened = true;
    const open = pl.latched ? ww.opened : pressed;
    for (const g of w.gates) {
      g.body.plugin.ww.open = open;
      g.body.isSensor = open;
    }
  }
  // water / out of bounds
  for (const z of w.water) {
    for (const p of S.players.values()) {
      if (p.torso && inRegion(p.torso, z)) respawn(p);
    }
    if (inRegion(core, z)) {
      Body.setPosition(core, { x: S.lastCheckpoint.x, y: S.lastCheckpoint.y });
      Body.setVelocity(core, { x: 0, y: 0 });
      pushFx('splash', { x: core.position.x, y: core.position.y });
    }
  }
  for (const p of S.players.values()) {
    if (p.torso && (p.torso.position.y > S.spec.height + 140 || p.torso.position.x < -80 || p.torso.position.x > S.spec.width + 80)) respawn(p);
  }
  // soft checkpoints follow the Core
  for (const cp of w.checkpoints) {
    if (core.position.x > cp.x - 30) S.lastCheckpoint = { x: cp.x, y: cp.y };
  }
  // catapult detection
  if (Math.abs(core.velocity.y) > 9 || Math.abs(core.velocity.x) > 11) S.mechanics.add('catapult');
  // bridge detection: a plank resting over a water zone
  for (const z of w.water) {
    for (const b of w.list) {
      if (b.plugin.ww && (b.plugin.ww.kind === 'plank') && Math.abs(b.position.x - z.x) < z.w / 2 + 90 && b.position.y < z.y - 100) S.mechanics.add('bridge');
    }
  }
  // a round that nobody pressed START on still has to be winnable: the first
  // time the Core is grabbed or shoved away from its spawn, the round begins
  if (S.phase === 'lobby' && S.players.size) {
    const sp = S.spec.core;
    if (dist(core.position, sp) > 24) { S.phase = 'playing'; S.startedAt = Date.now(); pushFx('start', {}); }
  }
  // win
  if (S.phase === 'playing' && w.goal) {
    if (dist(core.position, w.goal) < w.goal.r + 6) {
      S.goalHold += TICK_MS;
      if (S.goalHold > 850) doWin();
    } else S.goalHold = Math.max(0, S.goalHold - TICK_MS * 2);
  }
}
function respawn(p) {
  const at = spawnFor(p);
  Body.setPosition(p.torso, at); Body.setVelocity(p.torso, { x: 0, y: 0 });
  Body.setPosition(p.head, { x: at.x, y: at.y - 30 }); Body.setVelocity(p.head, { x: 0, y: 0 });
  for (let i = 0; i < 2; i++) {
    Body.setPosition(p.hands[i], { x: at.x + (i ? 16 : -16), y: at.y - 4 });
    Body.setVelocity(p.hands[i], { x: 0, y: 0 });
  }
  releaseGrabs(p);
  p.respawns++;
  pushFx('poof', { x: at.x, y: at.y, who: p.name });
}
function medalFor() {
  const m = S.mechanics;
  if (m.has('hoist')) return { key: 'hoist', name: 'HEAVE-HO CREW', cn: '一二三嘿咻', line: 'Somebody pulled, somebody pushed, the Core went over.' };
  if (m.has('chain')) return { key: 'chain', name: 'HUMAN CHAIN', cn: '手拉手', line: 'You used each other as equipment.' };
  if (m.has('catapult')) return { key: 'catapult', name: 'CATAPULT CREW', cn: '弹射专家', line: 'The Core flew. Nobody knows why.' };
  if (m.has('bridge')) return { key: 'bridge', name: 'BRIDGE BUILDERS', cn: '造桥队', line: 'Planks, patience, and a lot of wobbling.' };
  if (m.has('rope')) return { key: 'rope', name: 'THE ACROBATS', cn: '空中飞人', line: 'One hand, one rope, zero dignity.' };
  if (m.has('carry')) return { key: 'carry', name: 'TWO-HAND CARRY', cn: '搭把手', line: 'Two wobblers, one plank, perfect timing.' };
  return { key: 'chaos', name: 'CHAOS GREMLINS', cn: '混沌小队', line: 'It worked. We are not sure how.' };
}
function doWin() {
  if (S.phase === 'won') return;
  S.phase = 'won'; S.wonAt = Date.now();
  const elapsed = Math.round((S.wonAt - S.startedAt) / 1000);
  const medal = medalFor();
  const stamp = { level: S.levelId, key: S.spec.key, name: S.spec.name, medal: medal.key, medalName: medal.name, elapsed: elapsed, at: Date.now(), respawns: [...S.players.values()].reduce(function (a, p) { return a + p.respawns; }, 0) };
  S.scrapbook.stamps.unshift(stamp);
  if (S.scrapbook.stamps.length > 40) S.scrapbook.stamps.length = 40;
  const prev = S.scrapbook.bestTimes[S.spec.key];
  if (!prev || elapsed < prev) S.scrapbook.bestTimes[S.spec.key] = elapsed;
  saveSave();
  S.win = { medal: medal, elapsed: elapsed, stamps: S.scrapbook.stamps.length, levelId: S.levelId, next: S.levelId < 4 ? S.levelId + 1 : 5 };
  pushFx('win', { medal: medal.name });
  broadcast({ type: 'win', win: S.win });
}

// ---------- snapshots ----------
function snapshot() {
  const w = S.world;
  const bodies = [];
  for (const b of w.list) {
    const ww = b.plugin.ww;
    bodies.push({
      id: ww.id, kind: ww.kind, x: +b.position.x.toFixed(1), y: +b.position.y.toFixed(1),
      a: +b.angle.toFixed(3), w: ww.w || 0, h: ww.h || 0, r: ww.r || 0,
      open: ww.open, pressed: ww.pressed, ropeGroup: ww.ropeGroup, ropeIndex: ww.ropeIndex,
      seesaw: ww.seesaw
    });
  }
  const players = [];
  for (const p of S.players.values()) {
    if (!p.torso) continue;
    players.push({
      id: p.id, name: p.name, emoji: p.emoji, color: p.color, bot: p.bot,
      x: +p.torso.position.x.toFixed(1), y: +p.torso.position.y.toFixed(1),
      vx: +p.torso.velocity.x.toFixed(2), vy: +p.torso.velocity.y.toFixed(2),
      a: +p.torso.angle.toFixed(3), grounded: p.grounded,
      hx: [+p.hands[0].position.x.toFixed(1), +p.hands[1].position.x.toFixed(1)],
      hy: [+p.hands[0].position.y.toFixed(1), +p.hands[1].position.y.toFixed(1)],
      fx: [+p.feet[0].position.x.toFixed(1), +p.feet[1].position.x.toFixed(1)],
      fy: [+p.feet[0].position.y.toFixed(1), +p.feet[1].position.y.toFixed(1)],
      grab: [!!p.grab[0], !!p.grab[1]],
      headX: +p.head.position.x.toFixed(1), headY: +p.head.position.y.toFixed(1),
      bubble: p.bubble, respawns: p.respawns, rtt: p.rtt
    });
  }
  return {
    type: 'state', t: Date.now(), level: {
      id: S.spec.id, key: S.spec.key, name: S.spec.name, cn: S.spec.cn, tier: S.spec.tier,
      subtitle: S.spec.subtitle, brief: S.spec.brief, width: S.spec.width, height: S.spec.height,
      ground: S.spec.ground, toolBudget: S.spec.toolBudget, hints: S.spec.hints
    },
    phase: S.phase, elapsed: S.phase === 'playing' ? Date.now() - S.startedAt : 0,
    pushCount: S.pushCount || 0, coreGrounded: !!S.coreGrounded,
    toolsUsed: S.toolsUsed, toolsLeft: Math.max(0, S.spec.toolBudget - S.toolsUsed),
    goal: w.goal, wind: w.wind, water: w.water, seesaws: w.seesaws.map(function (s) { return { x: s.x, y: s.y, w: s.w }; }),
    players: players, bodies: bodies, coreId: w.core.plugin.ww.id,
    fx: S.fx.filter(function (e) { return Date.now() - e.at < 2200; }),
    win: S.win, scrapCount: S.scrapbook.stamps.length, stamps: S.scrapbook.stamps.slice(0, 8)
  };
}

// ---------- messages ----------
function handleMessage(client, msg) {
  if (!msg || !msg.type) return;
  if (msg.type === 'join') {
    if (client && client.id) return;
    const p = makeClient(client.ws, msg);
    client.id = p.id;
    return;
  }
  if (!client || !client.id) return;
  const p = S.players.get(client.id);
  if (!p) return;
  switch (msg.type) {
    case 'input':
      p.input.left = !!msg.left; p.input.right = !!msg.right;
      p.input.jump = !!msg.jump; p.input.grabL = !!msg.grabL; p.input.grabR = !!msg.grabR;
      break;
    case 'ping': send(p.ws, { type: 'pong', c0: msg.c0, s1: Date.now() }); break;
    case 'pong': p.rtt = Math.max(0, Math.min(300, Date.now() - Number(msg.c0 || Date.now()))); break;
    case 'call':
      p.bubble = String(msg.text || '👋').slice(0, 10); p.bubbleAt = Date.now();
      pushFx('call', { who: p.name, text: p.bubble, x: p.torso.position.x, y: p.torso.position.y - 60 });
      break;
    case 'spawnTool': if (spawnTool(msg.kind, p)) broadcast({ type: 'toast', text: p.name + ' dropped a ' + msg.kind }); break;
    case 'addBot': if (p.board) addBot(); break;
    case 'removeBots': if (p.board) { for (const q of [...S.players.values()]) if (q.bot) dropClient(q.id); } break;
    case 'setLevel': if (p.board) setLevel(msg.id); break;
    case 'start': if (p.board && S.phase !== 'playing') { S.phase = 'playing'; S.startedAt = Date.now(); pushFx('start', {}); } break;
    case 'reset': if (p.board) setLevel(S.levelId); break;
    case 'next': if (p.board && S.phase === 'won') setLevel(S.win ? S.win.next : 1); break;
    case 'hint': if (p.board) { const hs = S.spec.hints; broadcast({ type: 'toast', text: hs[Math.floor(Math.random() * hs.length)] }); } break;
    case 'testCore': if (process.env.WOBBLE_TEST === '1') { Body.setPosition(S.world.core, { x: +msg.x, y: +msg.y }); Body.setVelocity(S.world.core, { x: 0, y: 0 }); } break;
    case 'clearBubble': p.bubble = null; break;
  }
}

// ---------- boot ----------
setLevel(1);
let lastTick = Date.now(), acc = 0, lastSnap = 0;
const sim = setInterval(function () {
  const now = Date.now();
  acc += Math.min(120, now - lastTick); lastTick = now;
  let n = 0;
  while (acc >= TICK_MS && n < 8) { step(TICK_MS); acc -= TICK_MS; n++; }
  if (now - lastSnap >= SNAP_MS) {
    lastSnap = now;
    broadcast(snapshot());
    for (const p of S.players.values()) if (p.bubble && Date.now() - p.bubbleAt > 3200) p.bubble = null;
  }
}, 8);

// A local firewall silently drops LAN traffic on port 3000. OPT-IN only (FIREWALL_CHECK=1):
// firewall-cmd triggers a polkit password prompt on every start (including each test run),
// and repeated failed attempts can lock the account.
function checkFirewall(port) {
  if (process.env.FIREWALL_CHECK !== '1') {
    console.log('  Firewall        : not checked (run ./lan-doctor.sh, or start with FIREWALL_CHECK=1)');
    return;
  }
  require('child_process').execFile('firewall-cmd', ['--query-port=' + port + '/tcp'],
    { timeout: 8000 }, function (err, stdout) {   // firewalld D-Bus can take ~4 s
      const answer = String(stdout || '').trim();
      if (answer !== 'no') return;   // yes = open; anything else = firewalld absent / not running
      console.log('  !! firewalld is BLOCKING port ' + port + ' on this machine.');
      console.log('     Chrome on a phone will say: This site can not be reached. Fix with:');
      console.log('       sudo firewall-cmd --zone=public --add-port=' + port + '/tcp');
      console.log('     Keep after reboot: add --permanent, then sudo firewall-cmd --reload');
      console.log('');
    });
}

httpServer.listen(PORT, HOST, function () {
  const ips = lanIPs();
  console.log('');
  console.log('  WOBBLE WORKS  /  搭把手   -  physics co-op on your home LAN');
  console.log('  ------------------------------------------------------------');
  console.log('  Board (TV / PC) : http://localhost:' + PORT + '/?board=1');
  if (ips.length) ips.forEach(function (ip, i) {
    console.log('  Phones (Wi-Fi)  : http://' + ip + ':' + PORT + '/' + (i ? '   (alt NIC)' : ''));
  }); else console.log('  Phones (Wi-Fi)  : http://<this-machine-ip>:' + PORT + '/');
  console.log('  Wireframes      : http://localhost:' + PORT + '/wireframe.html');
  console.log('  Bound to        : ' + HOST + ':' + PORT + '  (IPv4, all interfaces)');
  console.log('  Physics         : Matter.js ' + Matter.version + ' (vendored, offline)');
  console.log('  No internet needed. Ctrl+C to stop.');
  console.log('  Phone can not connect?  sudo firewall-cmd --zone=public --add-port=' + PORT + '/tcp');
  console.log('');
  checkFirewall(PORT);
});
process.on('SIGINT', function () { clearInterval(sim); process.exit(0); });
