// WOBBLE WORKS — CLASSIC (side-view 2D) simulation
// Reconstructed from levels.js + the v1 design document after the original
// 2D runtime was overwritten by the 3D rebuild. Geometry is the original data;
// the runtime below is a rebuild.
'use strict';

const Matter = require('../vendor/matter.min.js');
const { LEVELS, SANDBOX, getLevel, GROUND_TOP } = require('../levels.js');

const TICK_MS = 1000 / 60;
const GRAVITY_SCALE = 0.0011;

const PLAYER_R = 26;
const PLAYER_HEAD_R = 17;
const PLAYER_MASS = 4.2;

const MOVE_FREE = 6.6;     // px per tick
const MOVE_CARRY = 4.4;
const MOVE_LERP = 0.22;    // ground steering
const MOVE_LERP_AIR = 0.10;
const JUMP_V = -16.2;
const CORE_R = 34;
const CORE_MASS = 9;

const PALETTE = [
  '#ff7a59', '#4ecdc4', '#ffd166', '#a06cd5',
  '#7bd389', '#ff8fab', '#5fa8ff', '#f4a261',
  '#e76f51', '#90be6d', '#c77dff', '#48cae4',
  '#fb8500', '#8ecae6', '#ffb4a2', '#b5e48c'
];

function pick(arr, i) { return arr[i % arr.length]; }

function rectContains(r, p, pad) {
  pad = pad || 0;
  return p.x > r.x - r.w / 2 - pad && p.x < r.x + r.w / 2 + pad &&
         p.y > r.y - r.h / 2 - pad && p.y < r.y + r.h / 2 + pad;
}

function createSim(levelId) {
  const sim = {
    engine: null,
    level: null,
    players: new Map(),
    solids: [],
    dynamics: [],
    gates: [],
    plates: [],
    ropes: [],
    seesaws: [],
    core: null,
    won: false,
    wonAt: 0,
    medal: null,
    flags: {},
    toolsPlaced: 0,
    spawnCounter: 0,
    events: [],
    onEvent: null
  };

  function emit(type, data) {
    const ev = Object.assign({ type: type, at: Date.now() }, data || {});
    sim.events.push(ev);
    if (sim.events.length > 40) sim.events.shift();
    if (sim.onEvent) sim.onEvent(ev);
  }

  // ---------------- world construction ----------------

  function loadLevel(id) {
    const lv = getLevel(id);
    sim.level = lv;
    sim.won = false;
    sim.wonAt = 0;
    sim.medal = null;
    sim.flags = {};
    sim.toolsPlaced = 0;
    sim.solids = [];
    sim.dynamics = [];
    sim.gates = [];
    sim.plates = [];
    sim.ropes = [];
    sim.seesaws = [];

    const engine = Matter.Engine.create();
    engine.gravity.y = 1;
    engine.gravity.scale = GRAVITY_SCALE;
    sim.engine = engine;
    const world = engine.world;

    // statics
    for (const s of lv.statics) {
      let body;
      if (s.kind === 'slope') {
        body = Matter.Bodies.rectangle(s.x, s.y, s.w, s.h, {
          isStatic: true, angle: s.angle || 0, friction: 0.4, label: 'static'
        });
      } else {
        body = Matter.Bodies.rectangle(s.x, s.y, s.w, s.h, {
          isStatic: true, friction: 0.5, label: 'static'
        });
      }
      body.wwKind = s.kind;
      Matter.Composite.add(world, body);
      sim.solids.push(body);
    }

    // gates (solid until their plate is pressed)
    for (const g of lv.gates || []) {
      const body = Matter.Bodies.rectangle(g.x, g.y, g.w, g.h, {
        isStatic: true, friction: 0.5, label: 'gate'
      });
      body.wwKind = 'gate';
      Matter.Composite.add(world, body);
      sim.solids.push(body);
      sim.gates.push({ id: g.id, body: body, def: g, baseY: g.y, open: false, offset: 0 });
    }

    // plates (sensors; nothing collides with them)
    for (const p of lv.plates || []) {
      sim.plates.push({
        id: p.id, def: p, gateId: p.gate, pressed: false, latched: !!p.latched
      });
    }

    // dynamics
    for (const d of lv.dynamics || []) {
      const body = makeDynamic(d);
      Matter.Composite.add(world, body);
      sim.dynamics.push({ id: 'd' + sim.dynamics.length, body: body, kind: d.kind, def: d });
    }

    // see-saws
    for (const s of lv.seesaws || []) {
      const body = Matter.Bodies.rectangle(s.x, s.y, s.w, s.h, {
        density: 0.0025, friction: 0.3, frictionAir: 0.02, label: 'seesaw'
      });
      body.wwKind = 'seesaw';
      Matter.Composite.add(world, body);
      const pivot = Matter.Constraint.create({
        pointA: { x: s.x, y: s.y }, bodyB: body, pointB: { x: 0, y: 0 },
        stiffness: 1, length: 0, damping: 0.1
      });
      Matter.Composite.add(world, pivot);
      sim.seesaws.push({ id: 'ss' + sim.seesaws.length, body: body, def: s });
    }

    // ropes
    for (const r of lv.ropes || []) {
      const nodes = [];
      const segs = r.segments || 8;
      const len = r.length || 20;
      for (let i = 0; i < segs; i++) {
        const node = Matter.Bodies.circle(r.x, r.y + i * len, 6, {
          density: 0.001, friction: 0.1, frictionAir: 0.03,
          collisionFilter: { group: -4 }, label: 'rope'
        });
        node.wwKind = 'rope';
        Matter.Composite.add(world, node);
        nodes.push(node);
        const c = Matter.Constraint.create({
          bodyA: i === 0 ? undefined : nodes[i - 1],
          pointA: i === 0 ? { x: r.x, y: r.y } : { x: 0, y: 0 },
          bodyB: node, pointB: { x: 0, y: 0 },
          stiffness: 0.9, length: len, damping: 0.04
        });
        Matter.Composite.add(world, c);
      }
      sim.ropes.push({ id: 'r' + sim.ropes.length, nodes: nodes, def: r });
    }

    // the Core
    const c0 = lv.core || { x: 200, y: GROUND_TOP - CORE_R };
    const core = Matter.Bodies.circle(c0.x, c0.y, CORE_R, {
      mass: CORE_MASS, friction: 0.15, frictionAir: 0.004, restitution: 0.22,
      label: 'core'
    });
    core.wwKind = 'core';
    Matter.Composite.add(world, core);
    sim.core = core;

    // move every player onto a spawn point
    let i = 0;
    for (const p of sim.players.values()) {
      const sp = lv.spawn[i % lv.spawn.length];
      Matter.Body.setPosition(p.body, { x: sp[0], y: sp[1] });
      Matter.Body.setVelocity(p.body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(p.body, 0);
      p.checkpoint = { x: sp[0], y: sp[1] };
      i++;
    }
    emit('level', { id: lv.id, name: lv.name });
    return sim;
  }

  function makeDynamic(d) {
    if (d.kind === 'crate') {
      const b = Matter.Bodies.rectangle(d.x, d.y, d.w, d.h, {
        density: 0.0022, friction: 0.35, frictionAir: 0.01, restitution: 0.05, label: 'crate'
      });
      b.wwKind = 'crate';
      return b;
    }
    if (d.kind === 'plank') {
      const b = Matter.Bodies.rectangle(d.x, d.y, d.w, d.h, {
        density: 0.0012, friction: 0.4, frictionAir: 0.01, restitution: 0.05, label: 'plank'
      });
      b.wwKind = 'plank';
      return b;
    }
    const b = Matter.Bodies.circle(d.x, d.y, d.r || 26, {
      density: 0.0018, friction: 0.18, frictionAir: 0.008, restitution: 0.3, label: 'barrel'
    });
    b.wwKind = 'barrel';
    return b;
  }

  // ---------------- players ----------------

  function addPlayer(id, name) {
    const color = pick(PALETTE, sim.players.size + sim.spawnCounter);
    const lv = sim.level;
    const sp = lv.spawn[sim.spawnCounter % lv.spawn.length];
    sim.spawnCounter++;

    const body = Matter.Body.create({
      parts: [
        Matter.Bodies.circle(sp[0], sp[1], PLAYER_R),
        Matter.Bodies.circle(sp[0], sp[1] - PLAYER_R - 2, PLAYER_HEAD_R)
      ],
      friction: 0.02,
      frictionAir: 0.012,
      restitution: 0.05,
      mass: PLAYER_MASS,
      label: 'player'
    });
    body.wwKind = 'player';
    Matter.Composite.add(sim.engine.world, body);

    const p = {
      id: id,
      name: (name || 'Wobbler').slice(0, 14),
      color: color,
      body: body,
      input: { x: 0, jump: false, grabL: false, grabR: false },
      handL: null,
      handR: null,
      carrying: false,
      grounded: false,
      lastJumpAt: 0,
      jumpQueuedAt: 0,
      afk: false,
      checkpoint: { x: sp[0], y: sp[1] },
      score: 0,
      bubble: null,
      bubbleAt: 0,
      bot: false
    };
    sim.players.set(id, p);
    return p;
  }

  function removePlayer(id) {
    const p = sim.players.get(id);
    if (!p) return;
    releaseHands(p);
    Matter.Composite.remove(sim.engine.world, p.body);
    sim.players.delete(id);
  }

  function releaseHands(p) {
    for (const key of ['handL', 'handR']) {
      const h = p[key];
      if (h && h.constraint) {
        Matter.Composite.remove(sim.engine.world, h.constraint);
      }
      p[key] = null;
    }
    p.carrying = false;
  }

  function setInput(id, patch) {
    const p = sim.players.get(id);
    if (!p) return;
    if (typeof patch.x === 'number') p.input.x = Math.max(-1, Math.min(1, patch.x));
    if (typeof patch.jump === 'boolean') p.input.jump = patch.jump;
    if (typeof patch.grabL === 'boolean') p.input.grabL = patch.grabL;
    if (typeof patch.grabR === 'boolean') p.input.grabR = patch.grabR;
  }

  // ---------------- interaction ----------------

  function grabbables() {
    const list = sim.dynamics.map(d => d.body);
    for (const r of sim.ropes) for (const n of r.nodes) list.push(n);
    for (const s of sim.seesaws) list.push(s.body);
    list.push(sim.core);
    return list;
  }

  function nearestGrabbable(p, reach) {
    const origin = p.body.position;
    let best = null;
    let bestD = reach;
    for (const b of grabbables()) {
      const d = Math.hypot(b.position.x - origin.x, b.position.y - origin.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    for (const q of sim.players.values()) {
      if (q.id === p.id) continue;
      const d = Math.hypot(q.body.position.x - origin.x, q.body.position.y - origin.y);
      if (d < bestD) { bestD = d; best = { otherPlayer: q }; }
    }
    return best;
  }

  function attachHand(p, key) {
    const target = nearestGrabbable(p, 74);
    if (!target) return;
    const tBody = target.otherPlayer ? target.otherPlayer.body : target;
    if (target.otherPlayer) { sim.flags.humanChain = true; }
    const c = Matter.Constraint.create({
      bodyA: p.body, pointA: { x: 0, y: 8 },
      bodyB: tBody, pointB: {
        x: tBody.position.x - p.body.position.x,
        y: tBody.position.y - p.body.position.y
      },
      stiffness: 0.09, damping: 0.03, length: 44
    });
    // pointB is relative to the target's centre of mass; clamp it so the rope
    // does not yank a distant body
    c.pointB = { x: 0, y: 0 };
    Matter.Composite.add(sim.engine.world, c);
    p[key] = { constraint: c, body: tBody };
  }

  function detachHand(p, key) {
    const h = p[key];
    if (!h) return;
    Matter.Composite.remove(sim.engine.world, h.constraint);
    p[key] = null;
  }

  function updateHands(p) {
    // grab state machine: holding a button keeps the constraint alive
    if (p.input.grabL && !p.handL) attachHand(p, 'handL');
    if (!p.input.grabL && p.handL) detachHand(p, 'handL');
    if (p.input.grabR && !p.handR) attachHand(p, 'handR');
    if (!p.input.grabR && p.handR) detachHand(p, 'handR');

    const wasCarrying = p.carrying;
    p.carrying = !!(p.handL && p.handR && p.handL.body === p.handR.body);
    if (p.carrying && !wasCarrying) sim.flags.twoHandCarry = true;
  }

  // ---------------- per-tick logic ----------------

  function isGrounded(p) {
    const pos = p.body.position;
    const hits = Matter.Query.ray(sim.solids.concat(
      sim.dynamics.map(d => d.body),
      sim.gates.map(g => g.body),
      sim.seesaws.map(s => s.body)
    ), { x: pos.x, y: pos.y + PLAYER_R }, { x: pos.x, y: pos.y + PLAYER_R + 12 }, 10);
    for (const h of hits) {
      if (h.bodyA && h.bodyA.id === p.body.id) continue;
      if (h.bodyB && h.bodyB.id === p.body.id) continue;
      if (h.bodyA && h.bodyA.wwKind === 'gate') return true;
      return true;
    }
    return false;
  }

  function respawnPlayer(p) {
    const cp = p.checkpoint || sim.level.spawn[0];
    Matter.Body.setPosition(p.body, { x: cp.x, y: cp.y });
    Matter.Body.setVelocity(p.body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(p.body, 0);
    Matter.Body.setAngle(p.body, 0);
    emit('poof', { who: p.name, x: cp.x, y: cp.y });
  }

  function respawnCore() {
    const lv = sim.level;
    const cp = lv.checkpoints && lv.checkpoints.length ? lv.checkpoints[0] : { x: lv.core.x, y: lv.core.y };
    Matter.Body.setPosition(sim.core, { x: cp.x, y: cp.y - 80 });
    Matter.Body.setVelocity(sim.core, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(sim.core, 0);
    emit('coreReset', { x: cp.x, y: cp.y });
  }

  function applyWind() {
    for (const w of sim.level.wind || []) {
      const region = { x: w.x, y: w.y, w: w.w, h: w.h };
      const all = sim.players ? [] : [];
      const candidates = [];
      for (const p of sim.players.values()) candidates.push(p.body);
      for (const d of sim.dynamics) candidates.push(d.body);
      candidates.push(sim.core);
      for (const b of candidates) {
        if (!rectContains(region, b.position, 0)) continue;
        Matter.Body.applyForce(b, b.position, {
          x: w.fx * b.mass, y: w.fy * b.mass
        });
      }
    }
  }

  function checkWater() {
    for (const w of sim.level.water || []) {
      const region = { x: w.x, y: w.y, w: w.w, h: w.h };
      for (const p of sim.players.values()) {
        if (rectContains(region, p.body.position, 0)) respawnPlayer(p);
      }
      if (rectContains(region, sim.core.position, 0)) {
        emit('splash', { x: sim.core.position.x, y: sim.core.position.y });
        respawnCore();
      }
    }
  }

  function updateGates() {
    for (const pl of sim.plates) {
      if (!pl.pressed && !pl.latched) {
        // pressed when something with mass is resting on the plate
        const zone = { x: pl.def.x, y: pl.def.y, w: pl.def.w, h: 60 };
        let pressed = false;
        for (const p of sim.players.values()) {
          if (rectContains(zone, p.body.position, 8)) { pressed = true; break; }
        }
        if (!pressed) {
          for (const d of sim.dynamics) {
            if (rectContains(zone, d.body.position, 8)) { pressed = true; break; }
          }
        }
        if (!pressed && rectContains(zone, sim.core.position, 8)) pressed = true;
        if (pressed && !pl.pressed) emit('plate', { id: pl.id, on: true });
        if (!pressed && pl.pressed) emit('plate', { id: pl.id, on: false });
        pl.pressed = pressed;
      }
    }

    for (const g of sim.gates) {
      const plate = sim.plates.find(pl => pl.gateId === g.id);
      const shouldOpen = plate ? (plate.pressed || plate.latched) : false;
      if (shouldOpen && !g.open) {
        g.open = true;
        emit('gate', { id: g.id, open: true });
      } else if (!shouldOpen && g.open) {
        g.open = false;
        emit('gate', { id: g.id, open: false });
      }
      const target = g.open ? 1 : 0;
      const next = g.offset + (target - g.offset) * 0.12;
      if (Math.abs(next - g.offset) > 0.001) {
        g.offset = next;
        Matter.Body.setPosition(g.body, { x: g.def.x, y: g.def.y - g.offset * (g.def.h + 20) });
        Matter.Body.setStatic(g.body, true);
      }
    }
  }

  function stepPlayers(now) {
    for (const p of sim.players.values()) {
      if (p.afk) continue;
      p.grounded = isGrounded(p);
      updateHands(p);

      const speed = p.carrying ? MOVE_CARRY : MOVE_FREE;
      const target = p.input.x * speed;
      const lerp = p.grounded ? MOVE_LERP : MOVE_LERP_AIR;
      const vx = p.body.velocity.x + (target - p.body.velocity.x) * lerp;
      Matter.Body.setVelocity(p.body, { x: vx, y: p.body.velocity.y });

      if (p.input.jump) {
        if (!p.jumpQueuedAt) p.jumpQueuedAt = now;
      } else {
        p.jumpQueuedAt = 0;
      }

      const canJump = p.jumpQueuedAt && now - p.jumpQueuedAt < 220 &&
        (p.grounded || p.handL || p.handR) && now - p.lastJumpAt > 150;
      if (canJump) {
        p.lastJumpAt = now;
        p.jumpQueuedAt = 0;
        Matter.Body.setVelocity(p.body, { x: p.body.velocity.x, y: JUMP_V });
        p.input.jump = false;
        emit('jump', { who: p.name, x: p.body.position.x, y: p.body.position.y });
      }

      // checkpoints: furthest passed by x
      const cps = sim.level.checkpoints || [];
      for (const c of cps) {
        if (p.body.position.x > c.x && c.x > p.checkpoint.x) p.checkpoint = { x: c.x, y: c.y - 60 };
      }
    }
  }

  function pushCore() {
    const core = sim.core;
    let dir = 0;
    let count = 0;
    for (const p of sim.players.values()) {
      if (p.afk) continue;
      const dx = core.position.x - p.body.position.x;
      const dy = core.position.y - p.body.position.y;
      if (Math.abs(dx) < 96 && Math.abs(dy) < 90 && Math.abs(p.input.x) > 0.2) {
        dir += Math.sign(dx) * Math.abs(p.input.x);
        count++;
      }
    }
    if (count === 0) return;
    const grounded = Math.abs(core.velocity.y) < 2.2;
    if (!grounded) return;
    const maxV = 0.4 + 0.6 * count;
    const want = Math.sign(dir) * maxV;
    Matter.Body.setVelocity(core, {
      x: core.velocity.x + (want - core.velocity.x) * 0.10,
      y: core.velocity.y
    });
  }

  function checkWin() {
    if (sim.won || !sim.level.goal) return;
    const g = sim.level.goal;
    const d = Math.hypot(sim.core.position.x - g.x, sim.core.position.y - g.y);
    if (d > g.r) return;
    sim.won = true;
    sim.wonAt = Date.now();
    const fast = Math.abs(sim.core.velocity.x) > 8 || Math.abs(sim.core.velocity.y) > 8;
    if (fast) sim.flags.catapult = true;
    for (const p of sim.players.values()) {
      if (Math.hypot(p.body.position.x - g.x, p.body.position.y - g.y) < 220) p.score += 100;
      else if (Math.hypot(p.body.position.x - g.x, p.body.position.y - g.y) < 520) p.score += 50;
    }
    sim.medal = deriveMedal();
    emit('win', { level: sim.level.id, medal: sim.medal });
  }

  function deriveMedal() {
    const f = sim.flags;
    if (f.catapult) return 'CATAPULT CREW';
    if (f.humanChain) return 'HUMAN CHAIN';
    if (f.twoHandCarry) return 'TWO-HAND CARRY';
    if (f.bridge) return 'BRIDGE BUILDERS';
    return 'CHAOS GREMLINS';
  }

  function step(now) {
    now = now || Date.now();
    if (!sim.engine) return;
    stepPlayers(now);
    pushCore();
    applyWind();
    updateGates();
    Matter.Engine.update(sim.engine, TICK_MS);
    checkWater();
    checkWin();
    detectBridge();
  }

  function detectBridge() {
    const water = sim.level.water || [];
    if (!water.length) return;
    for (const d of sim.dynamics) {
      if (d.kind !== 'plank') continue;
      for (const w of water) {
        if (d.body.position.x > w.x - w.w / 2 && d.body.position.x < w.x + w.w / 2 &&
            d.body.position.y < w.y - 40 && Math.abs(d.body.velocity.y) < 1.5) {
          sim.flags.bridge = true;
        }
      }
    }
  }

  // ---------------- tools ----------------

  function addTool(kind) {
    const lv = sim.level;
    if (sim.toolsPlaced >= (lv.toolBudget || 4)) return false;
    const p = sim.core.position;
    const x = Math.max(80, Math.min(lv.width - 80, p.x + (Math.random() - 0.5) * 260));
    const y = 240;
    let d;
    if (kind === 'plank') d = { kind: 'plank', x: x, y: y, w: 220, h: 16 };
    else if (kind === 'barrel') d = { kind: 'barrel', x: x, y: y, r: 26 };
    else d = { kind: 'crate', x: x, y: y, w: 64, h: 64 };
    const body = makeDynamic(d);
    Matter.Composite.add(sim.engine.world, body);
    sim.dynamics.push({ id: 'd' + sim.dynamics.length, body: body, kind: d.kind, def: d });
    sim.toolsPlaced++;
    emit('tool', { kind: d.kind, x: x, y: y });
    return true;
  }

  // ---------------- serialisation ----------------

  function levelInfo() {
    const lv = sim.level;
    return {
      id: lv.id, key: lv.key, name: lv.name, cn: lv.cn, tier: lv.tier,
      subtitle: lv.subtitle, brief: lv.brief, hints: lv.hints,
      width: lv.width, height: lv.height, ground: lv.ground,
      toolBudget: lv.toolBudget, goal: lv.goal,
      statics: lv.statics, water: lv.water, wind: lv.wind,
      ropes: lv.ropes, seesaws: lv.seesaws, plates: lv.plates,
      gates: lv.gates, checkpoints: lv.checkpoints
    };
  }

  function snapshot() {
    const players = [];
    for (const p of sim.players.values()) {
      players.push({
        id: p.id, name: p.name, color: p.color,
        x: +p.body.position.x.toFixed(1),
        y: +p.body.position.y.toFixed(1),
        a: +p.body.angle.toFixed(2),
        vx: +p.body.velocity.x.toFixed(2), vy: +p.body.velocity.y.toFixed(2),
        carrying: p.carrying, afk: p.afk, score: p.score,
        bubble: p.bubble && Date.now() - p.bubbleAt < 2600 ? p.bubble : null,
        grounded: p.grounded
      });
    }
    return {
      type: 'state',
      t: Date.now(),
      levelId: sim.level.id,
      players: players,
      core: {
        x: +sim.core.position.x.toFixed(1),
        y: +sim.core.position.y.toFixed(1),
        a: +sim.core.angle.toFixed(2),
        vx: +sim.core.velocity.x.toFixed(1),
        vy: +sim.core.velocity.y.toFixed(1)
      },
      dyn: sim.dynamics.map(d => ({
        id: d.id, kind: d.kind,
        x: +d.body.position.x.toFixed(1),
        y: +d.body.position.y.toFixed(1),
        a: +d.body.angle.toFixed(2)
      })),
      gates: sim.gates.map(g => ({ id: g.id, y: +(g.def.y - g.offset * (g.def.h + 20)).toFixed(1), open: g.open })),
      seesaws: sim.seesaws.map(s => ({
        id: s.id, x: +s.body.position.x.toFixed(1), y: +s.body.position.y.toFixed(1),
        a: +s.body.angle.toFixed(2)
      })),
      ropes: sim.ropes.map(r => ({
        id: r.id,
        pts: r.nodes.map(n => [+n.position.x.toFixed(1), +n.position.y.toFixed(1)])
      })),
      plates: sim.plates.map(p => ({ id: p.id, pressed: p.pressed })),
      won: sim.won,
      medal: sim.medal,
      toolsLeft: (sim.level.toolBudget || 0) - sim.toolsPlaced
    };
  }

  sim.loadLevel = loadLevel;
  sim.addPlayer = addPlayer;
  sim.removePlayer = removePlayer;
  sim.setInput = setInput;
  sim.step = step;
  sim.snapshot = snapshot;
  sim.levelInfo = levelInfo;
  sim.addTool = addTool;
  sim.releaseHands = releaseHands;
  sim.respawnPlayer = respawnPlayer;
  sim.respawnCore = respawnCore;
  sim.LEVELS = LEVELS;
  sim.SANDBOX = SANDBOX;

  loadLevel(levelId === undefined ? 1 : levelId);
  return sim;
}

module.exports = { createSim, TICK_MS, LEVELS, SANDBOX, getLevel, PALETTE };
