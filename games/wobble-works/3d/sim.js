// Wobble Works 3D — the authoritative simulation. Pure logic: no sockets, no timers,
// so tests can step it as fast as they like.
//
// The world is a height grid plus a few boxes (rising pillars, crates, wobblers).
// Everything is an axis-aligned box resolved one axis at a time. That is far less
// than a rigid-body engine, on purpose: a lift that carries what stands on it and
// a plate that reads what rests on it must behave the same way every single time.
'use strict';
const LV = require('./levels.js');

const G = 30;            // gravity, units / s^2
const STEP = 0.45;       // ledge a grounded wobbler walks up (ramps, rising lifts)
const AIR = 0.08;        // same, airborne
const SNAP = 0.25;       // how far a grounded wobbler sticks down to a descending floor
const KILL = -3.6;       // below this you respawn
const PR = 0.3, PSR = 0.22, PH = 1.0;   // wobbler: body radius, footprint radius, height
const SPEED = 3.8, CARRY_SPEED = 2.9;
const JUMP_V = Math.sqrt(2 * G * 1.2);  // apex 1.2: clears a 1-high step, not a 2-high wall
const CR = 0.45, CH = 0.9;              // crate half-width, height
const OR = 0.28, OH = 0.56;             // core half-width, height
const SOFT = 0.15;                      // step tolerance for crates and the core
const HOLD_Y = 1.15;                    // core sits this far above its carrier's feet
const WIN_HOLD = 8;                     // seconds of celebration before the next stage

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

class Game {
  constructor(levels) {
    this.levels = levels || LV.LEVELS;
    this.players = new Map();
    this.events = [];
    this.loadStage(0);
  }

  ev(t, d) { this.events.push(Object.assign({ t }, d)); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ---------- stage setup ----------
  loadStage(i) {
    const n = this.levels.length;
    i = ((i % n) + n) % n;
    const L = this.levels[i];
    this.stage = i;
    this.L = L;
    this.grid = LV.parse(L);
    this.plates = (L.plates || []).map(p => ({
      id: p.id, x: p.at[0], z: p.at[1], c: p.c | 0, y: this.floor(p.at[0] + 0.5, p.at[1] + 0.5), on: false
    }));
    this.movers = (L.movers || []).map(m => ({
      kind: 'm', id: m.id, x0: m.rect[0], z0: m.rect[1], x1: m.rect[0] + m.rect[2], z1: m.rect[1] + m.rect[3],
      from: m.from, to: m.to, when: m.when, all: !!m.all, speed: m.speed || 2, a: 0, top: m.from
    }));
    this.crates = (L.crates || []).map((c, k) => {
      const y = this.floor(c[0], c[1]);
      return { kind: 'c', i: k, x: c[0], z: c[1], y, vy: 0, dx: 0, dz: 0, home: [c[0], y, c[1]] };
    });
    this.gems = (L.gems || []).map(g => ({ x: g[0], z: g[1], y: g[2] != null ? g[2] : this.floor(g[0], g[1]) + 0.7, got: false }));
    this.beacon = { x: L.beacon[0], z: L.beacon[1], y: this.floor(L.beacon[0], L.beacon[1]) };
    const cy = this.floor(L.core[0], L.core[1]);
    this.core = {
      state: 'loose', x: L.core[0], y: cy, z: L.core[1], vx: 0, vy: 0, vz: 0, grounded: true,
      holder: null, flight: 0, thrower: null, lonely: 0, home: [L.core[0], cy, L.core[1]], from: null
    };
    this.phase = 'play';
    this.time = 0;
    this.started = false;
    this.wonFor = 0;
    this.result = null;
    this.slots = this.spawnSlots();
    let k = 0;
    for (const p of this.players.values()) this.placeAtSpawn(p, k++);
    this.ev('stage', { i });
  }

  // Flood out from the spawn cell over flat floor of the same height so sixteen
  // wobblers never start stacked or hanging over an edge.
  spawnSlots() {
    const L = this.L, g = this.grid;
    const sx = Math.floor(L.spawn[0]), sz = Math.floor(L.spawn[1]);
    const h = g.at(sx, sz).h;
    const taken = new Set();
    for (const c of this.crates) taken.add(Math.floor(c.x) + ',' + Math.floor(c.z));
    taken.add(Math.floor(L.core[0]) + ',' + Math.floor(L.core[1]));
    const seen = new Set([sx + ',' + sz]);
    const queue = [[sx, sz]];
    const out = [];
    while (queue.length && out.length < 16) {
      const [x, z] = queue.shift();
      if (!taken.has(x + ',' + z)) out.push([x + 0.5, h, z + 0.5]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz, key = nx + ',' + nz;
        const c = g.at(nx, nz);
        if (seen.has(key) || !c || c.ramp || c.h !== h) continue;
        seen.add(key);
        queue.push([nx, nz]);
      }
    }
    if (!out.length) out.push([sx + 0.5, h, sz + 0.5]);
    return out;
  }

  placeAtSpawn(p, k) {
    const s = this.slots[k % this.slots.length];
    // more wobblers than tiles: share a tile, one per corner
    const lap = Math.floor(k / this.slots.length);
    const ox = lap ? ((lap & 1) ? 0.24 : -0.24) : 0, oz = lap ? ((lap & 2) ? 0.24 : -0.24) : 0;
    p.x = s[0] + ox; p.y = s[1]; p.z = s[2] + oz;
    p.vx = p.vy = p.vz = 0;
    p.grounded = true; p.support = null; p.coyote = 0; p.jb = 0; p.grab = false;
    p.safe = [s[0], s[1], s[2]];
    p.dx = p.dz = 0;
  }

  // ---------- players ----------
  addPlayer(id, name) {
    const used = new Set();
    for (const q of this.players.values()) used.add(q.ci);
    let ci = 0;
    while (used.has(ci)) ci++;
    const p = {
      kind: 'p', id, name: String(name || 'Wobbler').slice(0, 12), ci,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rot: Math.PI * 0.25,
      in: { x: 0, z: 0 }, grounded: true, support: null, coyote: 0, jb: 0, grab: false,
      afk: false, safe: [0, 0, 0], dx: 0, dz: 0
    };
    this.players.set(id, p);
    this.placeAtSpawn(p, this.players.size - 1);
    return p;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    if (this.core.holder === p) this.dropCore(p);
    this.players.delete(id);
  }

  setInput(id, x, z) {
    const p = this.players.get(id);
    if (!p) return;
    x = Number(x) || 0; z = Number(z) || 0;
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    p.in.x = x; p.in.z = z;
    if (l > 0.2) this.started = true;
  }

  act(id, a) {
    const p = this.players.get(id);
    if (!p || p.afk) return;
    if (a === 'jump') p.jb = 0.14;
    else if (a === 'grab') p.grab = true;
    else if (a === 'respawn') {
      if (this.core.holder === p) this.dropCore(p);
      this.placeAtSpawn(p, [...this.players.keys()].indexOf(id));
      this.ev('respawn', { id });
    }
  }

  setAfk(id, afk) {
    const p = this.players.get(id);
    if (!p) return;
    p.afk = !!afk;
    if (p.afk) { p.in.x = p.in.z = 0; if (this.core.holder === p) this.dropCore(p); }
  }

  // ---------- geometry queries ----------
  floor(x, z) {
    const cx = Math.floor(x), cz = Math.floor(z), c = this.grid.at(cx, cz);
    return c ? LV.cellTop(c, cx, cz, x, z) : -Infinity;
  }

  // First thing that stops a box of half-width r standing with its feet at `feet`.
  blocker(x, z, r, feet, height, tol, self) {
    const g = this.grid, lim = feet + tol;
    for (let cz = Math.floor(z - r), ez = Math.floor(z + r - 1e-9); cz <= ez; cz++) {
      for (let cx = Math.floor(x - r), ex = Math.floor(x + r - 1e-9); cx <= ex; cx++) {
        const c = g.at(cx, cz);
        if (c && LV.cellTop(c, cx, cz, clamp(x, cx, cx + 1), clamp(z, cz, cz + 1)) > lim) return STATIC;
      }
    }
    for (const m of this.movers) {
      if (x + r > m.x0 && x - r < m.x1 && z + r > m.z0 && z - r < m.z1 && m.top > lim) return m;
    }
    for (const c of this.crates) {
      if (c !== self && Math.abs(x - c.x) < r + CR && Math.abs(z - c.z) < r + CR && c.y + CH > lim && c.y < feet + height) return c;
    }
    return null;
  }

  // Highest surface under the footprint that is not above maxY.
  ground(x, z, r, maxY, self, heads) {
    const g = this.grid;
    let y = -Infinity, ref = null;
    for (let cz = Math.floor(z - r), ez = Math.floor(z + r - 1e-9); cz <= ez; cz++) {
      for (let cx = Math.floor(x - r), ex = Math.floor(x + r - 1e-9); cx <= ex; cx++) {
        const c = g.at(cx, cz);
        if (!c) continue;
        const t = LV.cellTop(c, cx, cz, clamp(x, cx, cx + 1), clamp(z, cz, cz + 1));
        if (t <= maxY && t > y) { y = t; ref = STATIC; }
      }
    }
    for (const m of this.movers) {
      if (x + r > m.x0 && x - r < m.x1 && z + r > m.z0 && z - r < m.z1 && m.top <= maxY && m.top > y) { y = m.top; ref = m; }
    }
    for (const c of this.crates) {
      if (c === self) continue;
      const t = c.y + CH;
      if (Math.abs(x - c.x) < r + CR && Math.abs(z - c.z) < r + CR && t <= maxY && t > y) { y = t; ref = c; }
    }
    if (heads) {
      // a friend's head is a step: stand on it to reach a 2-high ledge
      for (const o of this.players.values()) {
        if (o === self || this.core.holder === o) continue;
        const t = o.y + PH;
        if (Math.abs(x - o.x) < r + PR && Math.abs(z - o.z) < r + PR && t <= maxY && t > y) { y = t; ref = o; }
      }
    }
    return { y, ref };
  }

  // ---------- step ----------
  step(dt) {
    if (this.phase === 'won') {
      this.wonFor += dt;
      if (this.wonFor >= WIN_HOLD) { this.loadStage(this.stage + 1); return; }
    } else if (this.started && this.players.size) {
      this.time += dt;
    }

    this.stepPlates();
    this.stepMovers(dt);

    for (const c of this.crates) { c.sx = c.x; c.sz = c.z; }
    for (const p of this.players.values()) { p.sx = p.x; p.sz = p.z; }

    for (const p of this.players.values()) this.stepPlayer(p, dt);
    this.separatePlayers();
    for (const c of this.crates) this.stepCrate(c, dt);

    for (const c of this.crates) { c.dx = c.x - c.sx; c.dz = c.z - c.sz; }
    for (const p of this.players.values()) { p.dx = p.x - p.sx; p.dz = p.z - p.sz; }

    this.stepCore(dt);
    if (this.phase === 'play') { this.stepGems(); this.checkWin(); }
  }

  stepPlates() {
    for (const pl of this.plates) {
      const px = pl.x + 0.5, pz = pl.z + 0.5;
      let on = false;
      const over = (x, z, y, tol) => Math.abs(x - px) < tol && Math.abs(z - pz) < tol && Math.abs(y - pl.y) < 0.3;
      for (const p of this.players.values()) if (p.grounded && over(p.x, p.z, p.y, 0.62)) { on = true; break; }
      if (!on) for (const c of this.crates) if (over(c.x, c.z, c.y, 0.7)) { on = true; break; }
      const k = this.core;
      if (!on && k.state === 'loose' && k.grounded && over(k.x, k.z, k.y, 0.62)) on = true;
      if (on !== pl.on) { pl.on = on; this.ev('plate', { id: pl.id, on }); }
    }
  }

  stepMovers(dt) {
    for (const m of this.movers) {
      const held = m.when.map(id => { const p = this.plates.find(q => q.id === id); return !!(p && p.on); });
      const active = m.all ? held.every(Boolean) : held.some(Boolean);
      const span = Math.abs(m.to - m.from) || 1;
      const before = m.a;
      m.a = clamp(m.a + (active ? 1 : -1) * m.speed * dt / span, 0, 1);
      m.top = m.a === 1 ? m.to : m.from + (m.to - m.from) * m.a;
      if (before !== m.a && (m.a === 1 || m.a === 0)) this.ev('mover', { id: m.id, up: m.a === 1 });
    }
    // A pillar that rose past a wobbler who was only brushing its edge shoves them clear.
    for (const p of this.players.values()) {
      for (const m of this.movers) {
        if (!(p.x + PR > m.x0 && p.x - PR < m.x1 && p.z + PR > m.z0 && p.z - PR < m.z1 && m.top > p.y + STEP)) continue;
        const outs = [[m.x0 - PR - p.x, 0], [m.x1 + PR - p.x, 0], [0, m.z0 - PR - p.z], [0, m.z1 + PR - p.z]];
        outs.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]));
        p.x += outs[0][0]; p.z += outs[0][1];
      }
    }
  }

  movePlayer(p, dx, dz, canPush) {
    if (!dx && !dz) return true;
    const tol = p.grounded ? STEP : AIR;
    const b = this.blocker(p.x + dx, p.z + dz, PR, p.y, PH, tol, p);
    if (!b) { p.x += dx; p.z += dz; return true; }
    if (canPush && b.kind === 'c' && p.grounded && Math.abs(p.y - b.y) < 0.5) {
      // crates are heavy: they move at about half walking pace
      const k = 0.55, cx = b.x + dx * k, cz = b.z + dz * k;
      if (!this.blocker(cx, cz, CR - 0.01, b.y, CH, SOFT, b) && !this.crateHitsPlayer(cx, cz, b, p)) {
        b.x = cx; b.z = cz;
        if (!this.blocker(p.x + dx * k, p.z + dz * k, PR, p.y, PH, tol, p)) { p.x += dx * k; p.z += dz * k; }
        return true;
      }
    }
    return false;
  }

  crateHitsPlayer(cx, cz, crate, except) {
    for (const o of this.players.values()) {
      if (o === except) continue;
      if (Math.abs(o.x - cx) < CR + PR - 0.02 && Math.abs(o.z - cz) < CR + PR - 0.02 && o.y < crate.y + CH - SOFT && o.y + PH > crate.y) return true;
    }
    return false;
  }

  stepPlayer(p, dt) {
    const core = this.core;
    const carrying = core.holder === p;
    const ix = p.afk ? 0 : p.in.x, iz = p.afk ? 0 : p.in.z;
    const moving = Math.hypot(ix, iz) > 0.08;
    const sp = carrying ? CARRY_SPEED : SPEED;
    const k = p.grounded ? 0.3 : 0.14;
    p.vx += (ix * sp - p.vx) * k;
    p.vz += (iz * sp - p.vz) * k;
    if (moving) p.rot = Math.atan2(ix, iz);

    // ride whatever we stand on
    const sup = p.support;
    if (sup && (sup.kind === 'c' || sup.kind === 'p') && (sup.dx || sup.dz)) {
      this.movePlayer(p, sup.dx, 0, false);
      this.movePlayer(p, 0, sup.dz, false);
    }

    if (p.jb > 0) {
      p.jb -= dt;
      if (carrying) {
        p.jb = 0;
        this.ev('heavy', { id: p.id });
      } else if (p.grounded || p.coyote > 0) {
        p.vy = JUMP_V; p.grounded = false; p.coyote = 0; p.jb = 0; p.support = null;
        this.ev('jump', { id: p.id });
      }
    }

    if (p.grab) {
      p.grab = false;
      if (carrying) this.throwCore(p);
      else if (core.state === 'loose' && this.phase === 'play' &&
        Math.hypot(core.x - p.x, core.z - p.z) < 1.25 && Math.abs(core.y - p.y) < 1.4) this.holdCore(p, 'grab');
    }

    if (!this.movePlayer(p, p.vx * dt, 0, true)) p.vx = 0;
    if (!this.movePlayer(p, 0, p.vz * dt, true)) p.vz = 0;

    const was = p.grounded;
    const prevY = p.y;
    p.vy -= G * dt;
    p.y += p.vy * dt;
    const g = this.ground(p.x, p.z, PSR, prevY + (was ? STEP : AIR), p, true);
    if (p.vy <= 0 && p.y <= g.y + (was ? SNAP : 0)) {
      if (!was && p.vy < -4) this.ev('land', { id: p.id, v: +(-p.vy).toFixed(1) });
      p.y = g.y; p.vy = 0; p.grounded = true; p.support = g.ref;
      if (g.ref === STATIC) {
        const cx = Math.floor(p.x), cz = Math.floor(p.z), c = this.grid.at(cx, cz);
        if (c && !c.ramp && c.h === g.y) p.safe = [cx + 0.5, c.h, cz + 0.5];
      }
    } else {
      if (was) p.coyote = 0.1;
      else if (p.coyote > 0) p.coyote -= dt;
      p.grounded = false; p.support = null;
    }

    if (p.y < KILL) {
      if (core.holder === p) this.returnCore('fell');
      p.x = p.safe[0]; p.y = p.safe[1]; p.z = p.safe[2];
      p.vx = p.vy = p.vz = 0; p.grounded = true; p.support = null;
      this.ev('respawn', { id: p.id });
    }
  }

  separatePlayers() {
    const list = [...this.players.values()];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (Math.abs(a.y - b.y) > 0.85) continue;
      let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      const min = PR * 2;
      if (d >= min) continue;
      if (d < 1e-4) { dx = 1; dz = 0; d = 1; }
      const push = (min - d) * 0.5;
      dx = dx / d * push; dz = dz / d * push;
      this.movePlayer(a, -dx, 0, false); this.movePlayer(a, 0, -dz, false);
      this.movePlayer(b, dx, 0, false); this.movePlayer(b, 0, dz, false);
    }
  }

  stepCrate(c, dt) {
    const prevY = c.y;
    c.vy -= G * dt;
    c.y += c.vy * dt;
    const g = this.ground(c.x, c.z, CR - 0.02, prevY + SOFT, c, true);
    if (c.vy <= 0 && c.y <= g.y) { c.y = g.y; c.vy = 0; }
    if (c.y < KILL) {
      c.x = c.home[0]; c.y = c.home[1]; c.z = c.home[2]; c.vy = 0;
      this.ev('crateHome', { i: c.i });
    }
  }

  // ---------- the Core ----------
  holdCore(p, how) {
    const c = this.core;
    c.state = 'held'; c.holder = p; c.grounded = false; c.vx = c.vy = c.vz = 0; c.lonely = 0;
    this.started = true;
    this.ev(how, { id: p.id });
  }

  dropCore(p) {
    const c = this.core;
    c.state = 'loose'; c.holder = null; c.thrower = null; c.flight = 0; c.grounded = false;
    c.x = p.x; c.y = p.y + 0.6; c.z = p.z; c.vx = c.vz = 0; c.vy = 1;
    c.from = p.safe.slice();
  }

  returnCore(why) {
    const c = this.core, to = c.from || c.home;
    c.state = 'loose'; c.holder = null; c.thrower = null;
    c.x = to[0]; c.y = to[1]; c.z = to[2];
    c.vx = c.vy = c.vz = 0; c.grounded = true; c.lonely = 0; c.flight = 0;
    this.ev('coreReturn', { why });
  }

  // Where a throw would go right now. One function serves the throw and the aim marker.
  launch(p) {
    const fx = Math.sin(p.rot), fz = Math.cos(p.rot);
    let best = null, bs = Infinity, bd = 0, bx = 0, bz = 0;
    for (const o of this.players.values()) {
      if (o === p || o.afk) continue;
      const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz), dy = o.y - p.y;
      if (d < 0.8 || d > 5.5 || dy > 1.3 || dy < -6) continue;
      const cos = (dx * fx + dz * fz) / d;
      if (cos < 0.55) continue;
      const s = d * (1.6 - cos);
      if (s < bs) { bs = s; best = o; bd = d; bx = dx; bz = dz; }
    }
    const y0 = p.y + HOLD_Y;
    if (best) {
      // a pass: lobbed straight into a friend's hands, up to one step higher
      const T = clamp(bd / 6.5, 0.42, 0.85);
      return { mode: 'pass', to: best.id, x: p.x, y: y0, z: p.z, vx: bx / T, vz: bz / T, vy: (best.y + 0.9 - y0 + 0.5 * G * T * T) / T };
    }
    const b = this.beacon, dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz);
    if (d > 0.5 && d < 3.4 && Math.abs(b.y - p.y) < 0.4 && (dx * fx + dz * fz) / d > 0.5) {
      const T = clamp(d / 5, 0.45, 0.7);
      return { mode: 'dunk', x: p.x, y: y0, z: p.z, vx: dx / T, vz: dz / T, vy: (b.y + 0.3 - y0 + 0.5 * G * T * T) / T };
    }
    // a heave: flat and short. It crosses a 2-wide gap and never climbs a step.
    if (!p.afk && Math.hypot(p.in.x, p.in.z) > 0.3) return { mode: 'toss', x: p.x, y: p.y + 0.7, z: p.z, vx: fx * 7.4, vy: 3, vz: fz * 7.4 };
    return { mode: 'place', x: p.x + fx * 0.35, y: p.y + 0.7, z: p.z + fz * 0.35, vx: fx * 2.6, vy: 2, vz: fz * 2.6 };
  }

  throwCore(p) {
    const c = this.core, l = this.launch(p);
    c.state = 'loose'; c.holder = null; c.thrower = p; c.flight = 0; c.grounded = false; c.lonely = 0;
    c.x = l.x; c.y = l.y; c.z = l.z; c.vx = l.vx; c.vy = l.vy; c.vz = l.vz;
    c.from = p.safe.slice();
    this.ev('throw', { id: p.id, mode: l.mode });
  }

  // Predicted landing spot for the carrier's aim marker.
  aim() {
    const p = this.core.holder;
    if (!p) return null;
    const l = this.launch(p);
    if (l.mode === 'pass') {
      const o = this.players.get(l.to);
      return [o.x, o.y, o.z, 'pass'];
    }
    const b = { x: l.x, y: l.y, z: l.z, vx: l.vx, vy: l.vy, vz: l.vz, grounded: false };
    for (let i = 0; i < 100 && !b.grounded && b.y > KILL; i++) this.moveCoreBody(b, 1 / 60);
    return [b.x, b.grounded ? b.y : KILL, b.z, l.mode];
  }

  moveCoreBody(b, dt) {
    let hit = 0;
    const nx = b.x + b.vx * dt;
    if (this.blocker(nx, b.z, OR, b.y, OH, SOFT, null)) { b.vx *= -0.25; hit = 1; } else b.x = nx;
    const nz = b.z + b.vz * dt;
    if (this.blocker(b.x, nz, OR, b.y, OH, SOFT, null)) { b.vz *= -0.25; hit = 1; } else b.z = nz;
    const prevY = b.y;
    b.vy -= G * dt;
    b.y += b.vy * dt;
    const g = this.ground(b.x, b.z, OR, prevY + SOFT, null, false);
    if (b.vy <= 0 && b.y <= g.y) {
      b.y = g.y;
      if (b.vy < -5) { b.vy *= -0.22; hit = 2; b.vx *= 0.5; b.vz *= 0.5; }
      else { b.vy = 0; b.grounded = true; b.support = g.ref; b.vx *= 0.7; b.vz *= 0.7; }
    } else b.grounded = false;
    return hit;
  }

  stepCore(dt) {
    const c = this.core;
    if (c.state === 'held') {
      const p = c.holder;
      c.x = p.x; c.y = p.y + HOLD_Y; c.z = p.z;
      c.from = p.safe.slice();
      return;
    }
    if (c.state !== 'loose') return;
    const wasGrounded = c.grounded;
    const hit = this.moveCoreBody(c, dt);
    if (hit === 2 || (c.grounded && !wasGrounded)) this.ev('thud', {});
    if (!c.grounded) {
      c.flight += dt;
      if (c.flight > 0.1 && this.phase === 'play') {
        for (const p of this.players.values()) {
          if (p.afk || (p === c.thrower && c.flight < 0.5)) continue;
          if (Math.hypot(p.x - c.x, p.z - c.z) < 0.75 && c.y > p.y - 0.4 && c.y < p.y + 1.7) { this.holdCore(p, 'catch'); return; }
        }
      }
    } else {
      c.flight = 0; c.thrower = null;
      if (c.support === STATIC) c.restAt = [c.x, c.y, c.z];
      // A Core nobody can get to floats back to where it was thrown from.
      let near = !this.players.size;
      for (const p of this.players.values()) if (!p.afk && Math.hypot(p.x - c.x, p.z - c.z) < 5) { near = true; break; }
      c.lonely = near ? 0 : c.lonely + dt;
      if (c.lonely > 10) this.returnCore('lonely');
    }
    if (c.y < KILL) this.returnCore('fell');
  }

  stepGems() {
    for (let i = 0; i < this.gems.length; i++) {
      const g = this.gems[i];
      if (g.got) continue;
      for (const p of this.players.values()) {
        if (Math.hypot(p.x - g.x, p.y + 0.5 - g.y, p.z - g.z) < 0.8) { g.got = true; this.ev('gem', { i, id: p.id }); break; }
      }
    }
  }

  checkWin() {
    const c = this.core, b = this.beacon;
    if (Math.hypot(c.x - b.x, c.z - b.z) > 0.75 || c.y < b.y - 0.3 || c.y > b.y + 1.7) return;
    const by = c.holder ? c.holder.id : c.thrower ? c.thrower.id : null;
    c.state = 'scored'; c.holder = null; c.x = b.x; c.z = b.z; c.y = b.y + 1.0; c.vx = c.vy = c.vz = 0;
    const gems = this.gems.filter(g => g.got).length, total = this.gems.length;
    const time = Math.round(this.time * 10) / 10;
    const stars = 1 + (gems === total ? 1 : 0) + (time <= this.L.par ? 1 : 0);
    this.phase = 'won'; this.wonFor = 0;
    this.result = { time, gems, total, stars, par: this.L.par, by, last: this.stage === this.levels.length - 1 };
    this.ev('win', this.result);
  }

  // ---------- wire format ----------
  snapshot() {
    const r = v => Math.round(v * 100) / 100;
    const c = this.core;
    const players = [];
    for (const p of this.players.values()) {
      const gy = p.grounded ? p.y : this.ground(p.x, p.z, PSR, p.y + 0.05, p, true).y;
      players.push([p.id, r(p.x), r(p.y), r(p.z), r(p.rot),
        (c.holder === p ? 1 : 0) | (p.grounded ? 2 : 0) | (p.afk ? 4 : 0), gy > -50 ? r(gy) : -99]);
    }
    let cgy = c.state === 'loose' && !c.grounded ? this.ground(c.x, c.z, OR, c.y + 0.05, null, false).y : c.y;
    if (c.holder) cgy = c.holder.y;
    const snap = {
      type: 's', st: this.stage, ph: this.phase, t: Math.round(this.time * 10) / 10,
      p: players,
      c: [c.state[0], r(c.x), r(c.y), r(c.z), c.holder ? c.holder.id : null, cgy > -50 ? r(cgy) : -99],
      cr: this.crates.map(k => [r(k.x), r(k.y), r(k.z)]),
      m: this.movers.map(m => r(m.top)),
      pl: this.plates.map(p => p.on ? 1 : 0),
      g: this.gems.map(g => g.got ? 1 : 0)
    };
    const aim = this.aim();
    if (aim) snap.aim = [r(aim[0]), r(aim[1]), r(aim[2]), aim[3]];
    if (this.result) snap.res = Object.assign({ left: Math.max(0, Math.ceil(WIN_HOLD - this.wonFor)) }, this.result);
    return snap;
  }

  roster() {
    return [...this.players.values()].map(p => ({ id: p.id, name: p.name, ci: p.ci }));
  }
}

const STATIC = { kind: 's' };

module.exports = { Game, CONST: { G, SPEED, CARRY_SPEED, JUMP_V, KILL, PR, PH, CR, CH, HOLD_Y, WIN_HOLD } };
