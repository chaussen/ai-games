/**
 * Crystal Cavern Rush - Game Server
 * WebSocket-based multiplayer server for local network co-op play.
 * Run with: node server.js
 * Then open http://<your-ip>:3000 on any device on your WLAN.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// ─── Config ─────────────────────────────────────────────────────────────────
const PORT = 3000;
const TICK_RATE = 20;          // server updates per second
const GAME_DURATION = 90;      // seconds per round
const MAX_PLAYERS = 8;
const CRYSTAL_COUNT = 30;
const ARENA_HALF = 18;         // half-size of the square arena
const CRYSTAL_RESPAWN_DELAY = 4000; // ms before a crystal respawns

// ─── State ───────────────────────────────────────────────────────────────────
let players = {};              // id → { id, name, color, x, y, z, vx, vz, score, synergy }
let crystals = [];             // { id, x, z, type, alive, respawnAt }
let gameState = 'lobby';       // 'lobby' | 'playing' | 'gameover'
let timeLeft = GAME_DURATION;
let teamScore = 0;
let roundTimer = null;
let tickInterval = null;
let nextCrystalId = 0;

const CRYSTAL_TYPES = [
  { type: 'common',  color: 0x00ffff, points: 1,  weight: 60 },
  { type: 'rare',    color: 0xff00ff, points: 3,  weight: 30 },
  { type: 'epic',    color: 0xffff00, points: 7,  weight: 10 },
];

const PLAYER_COLORS = [
  '#ff4444','#44ff44','#4488ff','#ffaa00',
  '#ff44ff','#44ffff','#ff8844','#aaffaa',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.random() * (max - min) + min; }

function weightedRandom(types) {
  const total = types.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of types) { r -= t.weight; if (r <= 0) return t; }
  return types[types.length - 1];
}

function spawnCrystal(id) {
  const type = weightedRandom(CRYSTAL_TYPES);
  return {
    id,
    x: rand(-ARENA_HALF + 2, ARENA_HALF - 2),
    z: rand(-ARENA_HALF + 2, ARENA_HALF - 2),
    type: type.type,
    color: type.color,
    points: type.points,
    alive: true,
    respawnAt: 0,
  };
}

function initCrystals() {
  crystals = [];
  nextCrystalId = 0;
  for (let i = 0; i < CRYSTAL_COUNT; i++) {
    crystals.push(spawnCrystal(nextCrystalId++));
  }
}

function broadcast(msg, excludeId) {
  const data = JSON.stringify(msg);
  for (const id in players) {
    if (id === excludeId) continue;
    const p = players[id];
    if (p.ws && p.ws.readyState === 1) p.ws.send(data);
  }
}

function broadcastAll(msg) {
  broadcast(msg, null);
}

function sendTo(id, msg) {
  const p = players[id];
  if (p && p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
}

// Calculate synergy: players within synergy radius boost each other
const SYNERGY_RADIUS = 5;
function updateSynergy() {
  const ids = Object.keys(players);
  for (const id of ids) players[id].synergy = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = players[ids[i]], b = players[ids[j]];
      const dx = a.x - b.x, dz = a.z - b.z;
      if (dx * dx + dz * dz < SYNERGY_RADIUS * SYNERGY_RADIUS) {
        a.synergy = Math.min(a.synergy + 1, 3);
        b.synergy = Math.min(b.synergy + 1, 3);
      }
    }
  }
}

// ─── Game lifecycle ───────────────────────────────────────────────────────────
function startGame() {
  if (gameState === 'playing') return;
  gameState = 'playing';
  timeLeft = GAME_DURATION;
  teamScore = 0;
  initCrystals();

  // Reset player scores
  for (const id in players) {
    players[id].score = 0;
    players[id].x = rand(-6, 6);
    players[id].z = rand(-6, 6);
    players[id].y = 0.6;
  }

  broadcastAll({ type: 'gameStart', crystals: crystals.map(cPublic), players: playersPublic() });

  // countdown timer
  roundTimer = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      endGame();
    } else {
      broadcastAll({ type: 'tick', timeLeft, teamScore });
    }
  }, 1000);

  // physics/state tick
  tickInterval = setInterval(gameTick, 1000 / TICK_RATE);
}

function endGame() {
  if (gameState !== 'playing') return;
  gameState = 'gameover';
  clearInterval(roundTimer);
  clearInterval(tickInterval);

  const leaderboard = Object.values(players)
    .map(p => ({ id: p.id, name: p.name, score: p.score, color: p.color }))
    .sort((a, b) => b.score - a.score);

  broadcastAll({ type: 'gameOver', teamScore, leaderboard });

  // Auto-return to lobby after 10 s
  setTimeout(() => {
    gameState = 'lobby';
    broadcastAll({ type: 'lobby', players: playersPublic() });
  }, 10000);
}

function gameTick() {
  const now = Date.now();

  // Respawn dead crystals
  for (const c of crystals) {
    if (!c.alive && now >= c.respawnAt) {
      const fresh = spawnCrystal(c.id);
      Object.assign(c, fresh, { alive: true });
      broadcastAll({ type: 'crystalRespawn', crystal: cPublic(c) });
    }
  }

  updateSynergy();

  // Collision: player ↔ crystal  (server authoritative)
  for (const id in players) {
    const p = players[id];
    for (const c of crystals) {
      if (!c.alive) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      if (dx * dx + dz * dz < 1.2 * 1.2) {
        // Collected!
        c.alive = false;
        c.respawnAt = now + CRYSTAL_RESPAWN_DELAY;
        const bonus = 1 + p.synergy * 0.5;  // synergy multiplier
        const pts = Math.round(c.points * bonus);
        p.score += pts;
        teamScore += pts;
        broadcastAll({
          type: 'crystalCollected',
          crystalId: c.id,
          byPlayer: id,
          pts,
          teamScore,
          playerScore: p.score,
        });
      }
    }
  }

  // Broadcast positions
  const posUpdate = { type: 'positions', players: {} };
  for (const id in players) {
    const p = players[id];
    posUpdate.players[id] = { x: p.x, y: p.y, z: p.z, synergy: p.synergy };
  }
  broadcastAll(posUpdate);
}

// ─── Serialisers ─────────────────────────────────────────────────────────────
function cPublic(c) {
  return { id: c.id, x: c.x, z: c.z, type: c.type, color: c.color, points: c.points, alive: c.alive };
}
function playersPublic() {
  return Object.fromEntries(
    Object.entries(players).map(([id, p]) => [
      id, { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, z: p.z, score: p.score, synergy: p.synergy }
    ])
  );
}

// ─── HTTP server (serves client files) ───────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const httpServer = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    }
  });
});

// ─── WebSocket server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

let nextPlayerId = 1;

wss.on('connection', (ws) => {
  const id = `P${nextPlayerId++}`;
  const colorIdx = (Object.keys(players).length) % PLAYER_COLORS.length;
  const player = {
    id,
    name: `Player ${id}`,
    color: PLAYER_COLORS[colorIdx],
    x: rand(-6, 6), y: 0.6, z: rand(-6, 6),
    vx: 0, vz: 0,
    score: 0,
    synergy: 0,
    ws,
  };

  if (Object.keys(players).length >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: 'error', msg: 'Server full' }));
    ws.close();
    return;
  }

  players[id] = player;
  console.log(`[+] ${id} connected. Players: ${Object.keys(players).length}`);

  // Welcome the new player
  sendTo(id, {
    type: 'welcome',
    id,
    color: player.color,
    gameState,
    timeLeft,
    teamScore,
    crystals: gameState === 'playing' ? crystals.map(cPublic) : [],
    players: playersPublic(),
  });

  // Tell everyone else about the new player
  broadcast({
    type: 'playerJoined',
    player: { id, name: player.name, color: player.color, x: player.x, y: player.y, z: player.z, score: 0, synergy: 0 },
  }, id);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    handleMessage(id, msg);
  });

  ws.on('close', () => {
    console.log(`[-] ${id} disconnected.`);
    delete players[id];
    broadcastAll({ type: 'playerLeft', id });

    // If nobody left, reset
    if (Object.keys(players).length === 0 && gameState === 'playing') {
      clearInterval(roundTimer);
      clearInterval(tickInterval);
      gameState = 'lobby';
    }
  });
});

function handleMessage(id, msg) {
  const p = players[id];
  if (!p) return;

  switch (msg.type) {
    case 'setName':
      p.name = (msg.name || id).slice(0, 20);
      broadcastAll({ type: 'playerUpdate', id, name: p.name });
      break;

    case 'move':
      // Client sends desired position (client-predicted, server clamps)
      if (gameState !== 'playing') break;
      p.x = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, msg.x ?? p.x));
      p.z = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, msg.z ?? p.z));
      p.y = 0.6; // keep on ground plane
      break;

    case 'startGame':
      if (gameState !== 'playing') {
        startGame();
      }
      break;
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  // Print LAN IP(s) for easy sharing
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║       Crystal Cavern Rush — Server Ready     ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Local:   http://localhost:${PORT}              ║`);
  for (const ip of ips) {
    console.log(`║  Network: http://${ip}:${PORT}`.padEnd(47) + '║');
  }
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log('Share the Network URL with others on your WLAN.\n');
});
