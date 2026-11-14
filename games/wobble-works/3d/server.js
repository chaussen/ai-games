// WOBBLE WORKS 3D - Multi-device physical family co-op & chaotic playground
// Node.js zero-install server: http static + RFC 6455 WebSocket + Cannon.js 3D physics

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const CANNON = require('../vendor/cannon.min.js');
const LVL = require('./levels3d.js');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const LAN_IP = (process.env.LAN_IP || '').trim();
const ROOT = __dirname;
const TICK_MS = 1000 / 60;
const SNAP_MS = 1000 / 20;
const MAX_PLAYERS = 16;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Vibrant avatar color palette (16 distinct colors for players)
const PALETTE = [
  '#ff4757', '#2ed573', '#1e90ff', '#ffa502',
  '#9b59b6', '#ff6b81', '#00d2d3', '#ffd32a',
  '#2bcbba', '#ff3838', '#3ae374', '#17c0eb',
  '#ff9f1a', '#e056fd', '#67e6dc', '#ffb8b8'
];

// ---------- Network Interface Discovery ----------
function isVirtualNic(name) {
  return /^(docker|br-|virbr|vnet|veth|tun|tap|wg|tailscale|zt|ham|lxc|podman|nm-)/i.test(name);
}
function ipRank(ip) {
  if (ip.startsWith('192.168.')) return 0;
  if (ip.startsWith('10.')) return 1;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) { const n = Number(m[1]); if (n >= 16 && n <= 31) return 2; }
  return 3;
}
function lanIPs() {
  const seen = new Set();
  const list = [];
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (isVirtualNic(name)) continue;
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal && a.address && !seen.has(a.address)) {
        seen.add(a.address);
        list.push(a.address);
      }
    }
  }
  list.sort((a, b) => ipRank(a) - ipRank(b));
  if (LAN_IP && !seen.has(LAN_IP)) list.unshift(LAN_IP);
  return list;
}

// ---------- Game State & Physics World ----------
const S = {
  world: null,
  players: new Map(), // id -> Player
  crates: [],         // list of { id, body, size }
  seesaws: [],        // list of { id, body }
  bouncePads: LVL.bouncePads,
  ball: null,         // CANNON.Body
  ballCarrierId: null,
  ballLastTouchedBy: null,
  currentGoalIdx: 0,
  activeGoal: LVL.goals[0],
  crownHolderId: null,
  recentEvents: [],
  startedAt: Date.now()
};

function initPhysics() {
  const world = new CANNON.World();
  world.gravity.set(0, -22, 0);
  world.solver.iterations = 10;
  world.defaultContactMaterial.friction = 0.3;
  world.defaultContactMaterial.restitution = 0.2;

  // Characters are velocity-driven; world friction fights the steering lerp
  // and reduces wobblers to a crawl (measured 0.24 m/s at friction 0.25).
  S.MAT_WORLD = new CANNON.Material('world');
  S.MAT_PLAYER = new CANNON.Material('player');
  world.addContactMaterial(new CANNON.ContactMaterial(S.MAT_WORLD, S.MAT_PLAYER, { friction: 0.02, restitution: 0 }));

  // Statics
  for (const s of LVL.statics) {
    let shape;
    if (s.type === 'box') shape = new CANNON.Box(new CANNON.Vec3(s.sx / 2, s.sy / 2, s.sz / 2));
    else if (s.type === 'cylinder') {
      // cannon 0.6.2 convex cylinders never collide with spheres; use an inscribed box
      const half = s.radiusTop * 0.96;
      shape = new CANNON.Box(new CANNON.Vec3(half, s.height / 2, half));
    }
    else if (s.type === 'ramp') shape = new CANNON.Box(new CANNON.Vec3(s.sx / 2, s.sy / 2, s.sz / 2));
    if (shape) {
      const b = new CANNON.Body({ mass: 0, material: S.MAT_WORLD, position: new CANNON.Vec3(s.x, s.y, s.z) });
      b.addShape(shape);
      if (s.rotZ) b.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), s.rotZ);
      world.addBody(b);
    }
  }

  // Crates (movable dynamic cubes)
  S.crates = [];
  for (const c of LVL.crates) {
    const shape = new CANNON.Box(new CANNON.Vec3(c.size / 2, c.size / 2, c.size / 2));
    const b = new CANNON.Body({ mass: c.mass, material: S.MAT_WORLD, position: new CANNON.Vec3(c.x, c.y, c.z) });
    b.addShape(shape);
    b.angularDamping = 0.5;
    world.addBody(b);
    S.crates.push({ id: c.id, body: b, size: c.size });
  }

  // See-Saws (planks on central hinges)
  S.seesaws = [];
  for (const ss of LVL.seesaws) {
    const shape = new CANNON.Box(new CANNON.Vec3(ss.length / 2, ss.thickness / 2, ss.width / 2));
    const b = new CANNON.Body({ mass: 35, material: S.MAT_WORLD, position: new CANNON.Vec3(ss.x, ss.y, ss.z) });
    b.addShape(shape);
    b.angularDamping = 0.7;
    // Pivot constraint (pin center)
    const pivot = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(ss.x, ss.y, ss.z) });
    world.addBody(pivot);
    world.addBody(b);
    const hinge = new CANNON.HingeConstraint(pivot, b, {
      pivotA: new CANNON.Vec3(0, 0, 0),
      axisA: new CANNON.Vec3(0, 0, 1),
      pivotB: new CANNON.Vec3(0, 0, 0),
      axisB: new CANNON.Vec3(0, 0, 1)
    });
    world.addConstraint(hinge);
    S.seesaws.push({ id: ss.id, body: b });
  }

  // The Ball (Glow Core)
  const ballShape = new CANNON.Sphere(0.85);
  const ball = new CANNON.Body({ mass: 12, material: S.MAT_WORLD, position: new CANNON.Vec3(LVL.ballSpawn.x, LVL.ballSpawn.y, LVL.ballSpawn.z) });
  ball.addShape(ballShape);
  ball.angularDamping = 0.3;
  world.addBody(ball);
  S.ball = ball;
  S.world = world;
  S.activeGoal = LVL.goals[0];
}

initPhysics();

// Push an event to clients
function pushFx(type, data) {
  const ev = Object.assign({ type, id: Math.random().toString(36).slice(2, 8), at: Date.now() }, data);
  S.recentEvents.push(ev);
  if (S.recentEvents.length > 25) S.recentEvents.shift();
  broadcast({ type: 'fx', event: ev });
}

// Distance helper
function dist3(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Player model
function createPlayer(id, name, isBoard) {
  const color = PALETTE[S.players.size % PALETTE.length];
  const spawnIdx = S.players.size % LVL.spawns.length;
  const sp = LVL.spawns[spawnIdx];

  // Pill compound body for characters
  const body = new CANNON.Body({
    mass: 16,
    material: S.MAT_PLAYER,
    fixedRotation: true,
    position: new CANNON.Vec3(sp[0], sp[1], sp[2])
  });
  body.addShape(new CANNON.Sphere(0.6), new CANNON.Vec3(0, 0.6, 0));
  body.addShape(new CANNON.Sphere(0.55), new CANNON.Vec3(0, 1.35, 0));
  body.angularDamping = 0.99;
  S.world.addBody(body);

  const player = {
    id,
    name: (name || ('Wobbler ' + (S.players.size + 1))).slice(0, 14),
    board: !!isBoard,
    color,
    body,
    rot: 0,
    input: { x: 0, z: 0, jump: false, grabL: false, grabR: false, lift: false, throw: false },
    score: 0,
    goals: 0,
    assists: 0,
    tackles: 0,
    carrying: false,
    crown: false,
    afk: false,
    afkSince: 0,
    bubble: null,
    bubbleAt: 0,
    bot: false,
    rtt: 0,
    ws: null
  };
  S.players.set(id, player);
  return player;
}

function removePlayer(id) {
  const p = S.players.get(id);
  if (!p) return;
  if (S.ballCarrierId === id) {
    S.ballCarrierId = null;
    S.ball.velocity.y += 3;
  }
  if (p.body) S.world.remove(p.body);
  S.players.delete(id);
}

// Respawn ball at sky height
function respawnBall(x, z) {
  S.ballCarrierId = null;
  // A goal ends the carry for everyone. Without this the old carrier keeps
  // teleporting the respawned ball to its head and jams forever (observed: a
  // bot held [CARRY] at the tower for 40 s and the round stalled).
  for (const q of S.players.values()) q.carrying = false;
  S.ballLastTouchedBy = null;
  S.ball.position.set(x !== undefined ? x : 0, 18, z !== undefined ? z : 0);
  S.ball.velocity.set(0, -2, 0);
  S.ball.angularVelocity.set(0, 0, 0);
  pushFx('ballDrop', { x: S.ball.position.x, y: S.ball.position.y, z: S.ball.position.z });
}

// Goal Score Handler
function doGoalScore(scorerId) {
  let scorer = S.players.get(scorerId);
  if (!scorer) {
    // Pick nearest player
    let minD = 999;
    for (const p of S.players.values()) {
      const d = dist3(p.body.position, S.activeGoal);
      if (d < minD) { minD = d; scorer = p; }
    }
  }

  if (scorer) {
    scorer.score += 100;
    scorer.goals++;
    // Transfer crown
    for (const p of S.players.values()) p.crown = false;
    scorer.crown = true;
    S.crownHolderId = scorer.id;
  }

  let assistName = null;
  if (S.ballLastTouchedBy && S.ballLastTouchedBy !== (scorer ? scorer.id : null)) {
    const assist = S.players.get(S.ballLastTouchedBy);
    if (assist) {
      assist.score += 50;
      assist.assists++;
      assistName = assist.name;
    }
  }

  const scorerName = scorer ? scorer.name : 'Team Wobble';
  pushFx('goalScored', {
    scorer: scorerName,
    scorerId: scorer ? scorer.id : null,
    goalName: S.activeGoal.name,
    points: 100,
    assist: assistName,
    x: S.activeGoal.x,
    y: S.activeGoal.y,
    z: S.activeGoal.z
  });

  // Advance to next goal
  S.currentGoalIdx = (S.currentGoalIdx + 1) % LVL.goals.length;
  S.activeGoal = LVL.goals[S.currentGoalIdx];

  // Drop ball after celebration
  setTimeout(() => {
    respawnBall(0, 0);
  }, 2200);
}

// Step physics & player logic
function step(dtSec) {
  // Snapshot velocities BEFORE the solver runs. Collision resolution transfers
  // momentum from a charging carrier to the bystander it hits, so a post-step
  // read makes the victim look like the attacker (measured: a motionless
  // player was credited with 14 tackles).
  for (const q of S.players.values()) {
    q.preV = { x: q.body.velocity.x, y: q.body.velocity.y, z: q.body.velocity.z };
  }

  // Step Cannon world
  S.world.step(dtSec);

  const ball = S.ball;
  const now = Date.now();

  // Handle players
  for (const p of S.players.values()) {
    if (p.afk) continue;

    // Movement velocity
    const inp = p.input;
    const speed = p.carrying ? 6.2 : 8.5;
    const hasMove = Math.abs(inp.x) > 0.05 || Math.abs(inp.z) > 0.05;

    if (hasMove) {
      const targetVx = inp.x * speed;
      const targetVz = inp.z * speed;
      p.body.velocity.x += (targetVx - p.body.velocity.x) * 0.35;
      p.body.velocity.z += (targetVz - p.body.velocity.z) * 0.35;
      p.rot = Math.atan2(inp.x, inp.z);
    } else {
      p.body.velocity.x *= 0.85;
      p.body.velocity.z *= 0.85;
    }

    // Auto-step assist: a small hop when shoving against a ledge or a friend,
    // so wobblers can climb the plaza rim, crates and each other's shoulders.
    if (hasMove) {
      const hSpeed = Math.hypot(p.body.velocity.x, p.body.velocity.z);
      const grounded = Math.abs(p.body.velocity.y) < 1.0;
      if (grounded && hSpeed < speed * 0.3) {
        if (!p.stuckAt) p.stuckAt = now;
        else if (now - p.stuckAt > 120) p.body.velocity.y = Math.max(p.body.velocity.y, 4.2);
      } else p.stuckAt = 0;
    } else p.stuckAt = 0;

    // Jump
    if (inp.jump) {
      // Check if grounded (body y close to floor or standing on something)
      const nearGround = p.body.position.y < 1.3 || Math.abs(p.body.velocity.y) < 0.25;
      if (nearGround) {
        p.body.velocity.y = 11.2;
        inp.jump = false; // consume jump
        pushFx('jump', { who: p.name, x: p.body.position.x, y: p.body.position.y, z: p.body.position.z });
      }
    }

    // Bounce pad check
    for (const pad of S.bouncePads) {
      const dx = Math.abs(p.body.position.x - pad.x);
      const dz = Math.abs(p.body.position.z - pad.z);
      if (dx < pad.sx / 2 && dz < pad.sz / 2 && p.body.position.y <= pad.y + 1.2 && p.body.velocity.y <= 1.0) {
        p.body.velocity.y = pad.impulse;
        pushFx('bounce', { padId: pad.id, x: pad.x, z: pad.z });
      }
    }

    // Interacting with the Ball (Grab / Lift / Throw)
    const distToBall = dist3(p.body.position, ball.position);
    const isGrabbing = inp.grabL || inp.grabR;

    if (p.carrying) {
      // Ball follows overhead
      ball.position.set(p.body.position.x, p.body.position.y + 2.3, p.body.position.z);
      ball.velocity.set(p.body.velocity.x, p.body.velocity.y, p.body.velocity.z);

      // Throw action
      if (inp.throw) {
        inp.throw = false;
        p.carrying = false;
        S.ballCarrierId = null;
        let throwVx = Math.sin(p.rot) * 16.5;
        let throwVy = 9.8;
        let throwVz = Math.cos(p.rot) * 16.5;
        if (p.bot) {
          // A bot cannot climb the spiral tower, so it lobs the Core at the
          // beacon instead - which is exactly the kind of route a kid invents.
          const gx = S.activeGoal.x - ball.position.x;
          const gz = S.activeGoal.z - ball.position.z;
          const gh = Math.hypot(gx, gz) || 1;
          const gy = Math.max(0, S.activeGoal.y - ball.position.y);
          const hSpeed = Math.min(18, Math.max(6, gh * 1.5));
          throwVx = (gx / gh) * hSpeed;
          throwVz = (gz / gh) * hSpeed;
          throwVy = Math.min(26, Math.sqrt(2 * 22 * gy) + 3);
        }
        ball.velocity.set(throwVx, throwVy, throwVz);
        S.ballLastTouchedBy = p.id;
        pushFx('throw', { who: p.name, x: ball.position.x, y: ball.position.y, z: ball.position.z });
      }
    } else if (distToBall < 2.5) {
      if (inp.lift) {
        // Pick up and carry overhead
        p.carrying = true;
        p.carrySince = Date.now();
        S.ballCarrierId = p.id;
        S.ballLastTouchedBy = p.id;
        pushFx('lift', { who: p.name, x: ball.position.x, y: ball.position.y, z: ball.position.z });
      } else if (isGrabbing) {
        // Drag towards hands
        const handX = p.body.position.x + Math.sin(p.rot) * 1.3;
        const handZ = p.body.position.z + Math.cos(p.rot) * 1.3;
        ball.velocity.x += (handX - ball.position.x) * 4.0;
        ball.velocity.z += (handZ - ball.position.z) * 4.0;
        S.ballLastTouchedBy = p.id;
      }
    }

    // Player-to-player collision & Tackling
    for (const other of S.players.values()) {
      if (other.id === p.id) continue;
      const dP = dist3(p.body.position, other.body.position);
      if (dP < 1.6) {
        // A tackle is the ATTACKER charging INTO the carrier. Without the
        // direction + cooldown checks the victim gets flung, looks fast, and
        // is wrongly credited (measured: a stationary player farmed 350 pts).
        const towardX = other.body.position.x - p.body.position.x;
        const towardZ = other.body.position.z - p.body.position.z;
        const towardLen = Math.hypot(towardX, towardZ) || 1;
        const pv = p.preV || p.body.velocity;
        const ov = other.preV || other.body.velocity;
        const closing = ((pv.x - ov.x) * towardX + (pv.z - ov.z) * towardZ) / towardLen;
        const speedP = Math.hypot(pv.x, pv.z);
        const speedO = Math.hypot(ov.x, ov.z);
        // The attacker must be moving toward the victim under its own steam and
        // steering at them; a station-keeper pushed around by the carrier is not.
        const selfApproach = (pv.x * towardX + pv.z * towardZ) / towardLen;
        const inLen = Math.hypot(inp.x, inp.z) || 1;
        const aimed = hasMove && (inp.x * towardX + inp.z * towardZ) / (inLen * towardLen) > 0.5;
        const cooling = p.lastTackleAt && now - p.lastTackleAt < 4000;
        // speedP > speedO is the key test: a shoved victim moves slower than
        // the carrier that rammed it, so it can no longer farm points.
        // hasMove: only a player actively steering can be the tackler, so a
        // bystander who gets shoved never earns points.
        if (other.carrying && !p.carrying && aimed && selfApproach > 4.0 && closing > 5.0 && speedP > speedO && !cooling) {
          p.lastTackleAt = now;
          other.carrying = false;
          S.ballCarrierId = null;
          ball.velocity.y += 6;
          ball.velocity.x += (Math.random() - 0.5) * 8;
          p.tackles++;
          p.score += 25;
          pushFx('tackle', { tackler: p.name, victim: other.name });
        }
      }
    }

    // Bot AI
    if (p.bot) {
      stepBot(p);
    }

    // World boundary protection (respawn if fallen off world)
    if (p.body.position.y < -5) {
      p.body.position.set(0, 4, 0);
      p.body.velocity.set(0, 0, 0);
    }
  }

  // Ball bounce pad check
  for (const pad of S.bouncePads) {
    const dx = Math.abs(ball.position.x - pad.x);
    const dz = Math.abs(ball.position.z - pad.z);
    if (dx < pad.sx / 2 && dz < pad.sz / 2 && ball.position.y <= pad.y + 1.2 && ball.velocity.y <= 1.0) {
      ball.velocity.y = pad.impulse;
      pushFx('bounce', { padId: pad.id, x: pad.x, z: pad.z });
    }
  }

  // Ball world boundary protection
  if (ball.position.y < -5) {
    respawnBall(0, 0);
  }

  // Goal Detection! (Instant and reliable)
  const distToGoal = dist3(ball.position, S.activeGoal);
  if (distToGoal < S.activeGoal.r) {
    doGoalScore(S.ballCarrierId || S.ballLastTouchedBy);
  }
}

// Bot AI logic (chaotic fun helpers/competitors)
function stepBot(p) {
  const ball = S.ball;
  const goal = S.activeGoal;

  if (p.carrying) {
    // Run towards active goal!
    const dx = goal.x - p.body.position.x;
    const dz = goal.z - p.body.position.z;
    const dist = Math.hypot(dx, dz);
    p.input.x = dx / (dist || 1);
    p.input.z = dz / (dist || 1);
    // If close or high up, throw!
    if (dist < 8.0 || p.body.position.y > 6) {
      if (Math.random() < 0.08) p.input.throw = true;
    }
    // Hard give-up: a bot that has nursed the Core for too long cannot reach
    // this goal, so it lobs it and the round keeps moving.
    if (p.carrySince && Date.now() - p.carrySince > 9000) {
      p.input.throw = true;
      p.carrySince = 0;
    }
    // Unstick: a bot that barely moves while carrying (a wall, a tower base)
    // would otherwise hold the Core for the rest of the round.
    if (!p.stuckPos) p.stuckPos = { x: p.body.position.x, z: p.body.position.z, at: Date.now() };
    if (Math.hypot(p.body.position.x - p.stuckPos.x, p.body.position.z - p.stuckPos.z) > 1.2) {
      p.stuckPos = { x: p.body.position.x, z: p.body.position.z, at: Date.now() };
    } else if (Date.now() - p.stuckPos.at > 2600) {
      p.input.throw = true;
      p.stuckPos = { x: p.body.position.x, z: p.body.position.z, at: Date.now() };
    }
  } else {
    // Chase the ball
    const dx = ball.position.x - p.body.position.x;
    const dz = ball.position.z - p.body.position.z;
    const dist = Math.hypot(dx, dz);
    p.input.x = dx / (dist || 1);
    p.input.z = dz / (dist || 1);
    if (dist < 2.2) {
      p.input.lift = true;
    } else {
      p.input.lift = false;
    }
    // Occasional random jump
    if (Math.random() < 0.015) p.input.jump = true;
  }
}

function addBot() {
  const botNames = ['Bumbo', 'Pip', 'Noodle', 'Waffles', 'Tumble', 'Giggles'];
  const name = botNames[Math.floor(Math.random() * botNames.length)];
  const bot = createPlayer('bot-' + Math.random().toString(36).slice(2, 7), name, false);
  bot.bot = true;
  broadcast({ type: 'toast', text: '🤖 ' + bot.name + ' joined the party!' });
  return bot;
}

// Snapshot serialization
function makeSnapshot() {
  const players = [];
  for (const p of S.players.values()) {
    players.push({
      id: p.id,
      name: p.name,
      color: p.color,
      x: +(p.body.position.x.toFixed(2)),
      y: +(p.body.position.y.toFixed(2)),
      z: +(p.body.position.z.toFixed(2)),
      rot: +(p.rot.toFixed(2)),
      carrying: p.carrying,
      crown: p.crown,
      afk: p.afk,
      score: p.score,
      goals: p.goals,
      tackles: p.tackles,
      bubble: p.bubble,
      bot: p.bot
    });
  }

  const crates = S.crates.map(c => ({
    id: c.id,
    x: +(c.body.position.x.toFixed(2)),
    y: +(c.body.position.y.toFixed(2)),
    z: +(c.body.position.z.toFixed(2)),
    qx: +(c.body.quaternion.x.toFixed(2)),
    qy: +(c.body.quaternion.y.toFixed(2)),
    qz: +(c.body.quaternion.z.toFixed(2)),
    qw: +(c.body.quaternion.w.toFixed(2))
  }));

  const seesaws = S.seesaws.map(s => ({
    id: s.id,
    x: +(s.body.position.x.toFixed(2)),
    y: +(s.body.position.y.toFixed(2)),
    z: +(s.body.position.z.toFixed(2)),
    qx: +(s.body.quaternion.x.toFixed(2)),
    qy: +(s.body.quaternion.y.toFixed(2)),
    qz: +(s.body.quaternion.z.toFixed(2)),
    qw: +(s.body.quaternion.w.toFixed(2))
  }));

  return {
    type: 'state',
    t: Date.now(),
    players,
    ball: {
      x: +(S.ball.position.x.toFixed(2)),
      y: +(S.ball.position.y.toFixed(2)),
      z: +(S.ball.position.z.toFixed(2)),
      carrierId: S.ballCarrierId
    },
    goal: S.activeGoal,
    crates,
    seesaws,
    crownHolder: S.crownHolderId
  };
}

// Broadcast message to all WebSocket clients
function broadcast(msg) {
  const json = JSON.stringify(msg);
  for (const p of S.players.values()) {
    if (p.ws && p.ws.writable && !p.ws.destroyed) {
      send(p.ws, json);
    }
  }
  // Also send to spectator boards
  for (const b of S.boards) {
    if (b.writable && !b.destroyed) send(b, json);
  }
}

S.boards = new Set();

// ---------- HTTP Static Server ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const httpServer = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  if (urlPath === '/config.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end('window.WOBBLE_CONFIG=' + JSON.stringify({
      lanIPs: lanIPs(),
      port: PORT,
      gameMode: '3d'
    }) + ';');
    return;
  }

  if (urlPath === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // vendored libs are shared by both builds, one level up
  let filePath = urlPath.startsWith('/vendor/') ? path.join(ROOT, '..', urlPath) : path.join(ROOT, urlPath);
  if (urlPath.endsWith('/')) filePath = path.join(filePath, 'index.html');
  if (!filePath.startsWith(ROOT) && !filePath.startsWith(path.join(ROOT, '..', 'vendor') + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

// ---------- WebSocket (RFC 6455) ----------
function send(socket, data) {
  if (typeof data !== 'string') data = JSON.stringify(data);
  const payload = Buffer.from(data, 'utf8');
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
  socket.write(Buffer.concat([header, payload]));
}

httpServer.on('upgrade', (req, socket, head) => {
  const path = req.url.split('?')[0];
  if (path !== '/ws') {
    socket.destroy();
    return;
  }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );

  let player = null;
  let isBoard = false;

  socket.on('data', chunk => {
    // RFC 6455 unmask
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

      try {
        const msg = JSON.parse(payload.toString('utf8'));
        handleMessage(msg);
      } catch (e) {}
    }
  });

  function handleMessage(msg) {
    if (msg.type === 'join') {
      isBoard = !!msg.board;
      if (isBoard) {
        S.boards.add(socket);
        send(socket, { type: 'joined', board: true, activeGoal: S.activeGoal });
      } else {
        const pId = msg.playerId || ('p-' + Math.random().toString(36).slice(2, 7));
        player = S.players.get(pId);
        if (player) {
          // Reconnecting player! Wake up from AFK
          player.ws = socket;
          player.afk = false;
        } else {
          player = createPlayer(pId, msg.name, false);
          player.ws = socket;
        }
        send(socket, { type: 'joined', id: player.id, name: player.name, color: player.color, activeGoal: S.activeGoal });
        broadcast({ type: 'toast', text: '👋 ' + player.name + ' joined!' });
      }
      return;
    }

    if (!player && !isBoard) return;

    if (player) {
      if (msg.type === 'input') {
        player.input.x = Number(msg.x) || 0;
        player.input.z = Number(msg.z) || 0;
        player.input.jump = !!msg.jump;
        player.input.grabL = !!msg.grabL;
        player.input.grabR = !!msg.grabR;
        player.input.lift = !!msg.lift;
        player.input.throw = !!msg.throw;
      } else if (msg.type === 'visibility') {
        // Mobile screen dimming / sleep detection
        player.afk = !!msg.hidden;
        player.afkSince = Date.now();
        if (player.afk) {
          if (player.carrying) {
            player.carrying = false;
            S.ballCarrierId = null;
          }
        }
      } else if (msg.type === 'call') {
        player.bubble = String(msg.text || '👋').slice(0, 10);
        player.bubbleAt = Date.now();
        pushFx('call', { who: player.name, text: player.bubble, x: player.body.position.x, y: player.body.position.y + 2, z: player.body.position.z });
      }
    }

    // Board / Admin controls
    if (msg.type === 'addBot') addBot();
    if (msg.type === 'dropBall') respawnBall(0, 0);
    if (msg.type === 'nextGoal') {
      S.currentGoalIdx = (S.currentGoalIdx + 1) % LVL.goals.length;
      S.activeGoal = LVL.goals[S.currentGoalIdx];
      pushFx('goalChanged', { goal: S.activeGoal });
    }
  }

  socket.on('close', () => {
    if (isBoard) S.boards.delete(socket);
    if (player) {
      player.afk = true;
      player.afkSince = Date.now();
      // Drop ball if carrying
      if (player.carrying) {
        player.carrying = false;
        S.ballCarrierId = null;
      }
      // Remove body after 90 seconds if not reconnected
      setTimeout(() => {
        if (player.afk && player.ws === socket) {
          removePlayer(player.id);
        }
      }, 90000);
    }
  });
});

// Simulation & Snapshot Ticker
setInterval(() => {
  step(TICK_MS / 1000);
}, TICK_MS);

setInterval(() => {
  broadcast(makeSnapshot());
}, SNAP_MS);

// Firewall self-check. OPT-IN only (FIREWALL_CHECK=1): firewall-cmd triggers a
// polkit password prompt, and every server start (including each test run)
// would pop it up and can lock the account after failed attempts.
function checkFirewall(port) {
  if (process.env.FIREWALL_CHECK !== '1') {
    console.log('    Firewall      : not checked (run ./lan-doctor.sh, or start with FIREWALL_CHECK=1)');
    return;
  }
  require('child_process').execFile('firewall-cmd', ['--query-port=' + port + '/tcp'],
    { timeout: 8000 }, (err, stdout) => {
      const answer = String(stdout || '').trim();
      if (answer === 'no') {
        console.log('');
        console.log('  !! firewalld is BLOCKING port ' + port + ' on this machine.');
        console.log('  !! Android/mobile devices will say "site can\'t be reached".');
        console.log('  !! Fix: sudo firewall-cmd --zone=public --add-port=' + port + '/tcp');
        console.log('');
      }
    });
}

// Start HTTP server
httpServer.listen(PORT, HOST, () => {
  const ips = lanIPs();
  console.log('');
  console.log('  ======================================================');
  console.log('    WOBBLE WORKS 3D · CHAOTIC FAMILY CO-OP PLAYGROUND');
  console.log('  ======================================================');
  console.log('    TV/Board (PC) : http://localhost:' + PORT + '/?board=1');
  if (ips.length) {
    ips.forEach(ip => console.log('    Phones (Wi-Fi): http://' + ip + ':' + PORT + '/'));
  } else {
    console.log('    Phones (Wi-Fi): (no Wi-Fi/LAN IPv4 detected)');
  }
  console.log('    Bound to      : ' + HOST + ':' + PORT + '  (IPv4, all interfaces)');
  console.log('  ------------------------------------------------------');
  checkFirewall(PORT);
});