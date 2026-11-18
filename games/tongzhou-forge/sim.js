// 同舟 · Glyph Isles — the authoritative simulation (forked from Wobble Works 3D). Pure logic: no sockets, no timers,
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
// 轻功: one leap in mid-air, then the 气 has to gather again
const LEAP_V = 5.6, LEAP_SPEED = 5.2, GLIDE = 0.5, QI_CD = 4;
const WIN_HOLD = 40;                    // the boat leaves by itself this long after the shrine answers
const WIN_MIN = 3;                      // the world's answer is seen before the boat can leave
const BOARD_WAIT = 12;                  // once somebody is aboard, the others have this long
const ARRIVE = 2.6, LEAVE = 3.4;        // seconds the boat takes to sail in and out
// the boat is pushed like a crate, from inside: walk into its rail and it goes that way
const ROW_ACC = 5, ROW_MAX = 2.6, ROW_DRAG = 2, RAIL = 0.14, SEA = 4;
// a friend can be boosted: flung up and forward, stone and all
const BOOST_V = 9, BOOST_SPEED = 7.2, FLING = 0.55, BOOST_CD = 0.8, BOOST_R = 1.15;
const REGROW = 3.5;                     // seconds before a used-up stone grows back (only when the stage regrows)
const MAX_STONES = 14;
// dusk (杳 and any later dusk stone): the isle dims for this long; glow-gems can be taken only
// while it is dim; a light stone set down ends it early (docs/forge/CONTENT.md §3)
const DUSK_TIME = 20;                   // (tune)

// Stones are used up. A stone that fuses or grows into a bridge is gone for good:
// the only way to bring a character back is to conjure (write) it. A stage can opt
// back into the old behaviour (stones grow back at their starting place) with
// "regrow": true. See docs/conjure/CONSUMABLE.md.
const STONES = {
  regrow: false,   // default for stages without a "regrow" field
};

// FORGE: every knob where strict grammar meets relaxed play (docs/forge/DESIGN.md §2, SPEC §4).
// A stage picks a profile with its "strict" field; it never carries its own numbers. loadStage
// resolves this.fz = FORGE + the profile, and every rule reads this.fz, never FORGE directly.
// Values marked (tune) are moved by playtests (PLAYTEST.md), one knob at a time.
const FORGE = {
  // classifier (K1-K3, K8)
  besideD: 0.4, besideR: [0.4, 1.3], besideY: 0.45, ideal: 0.62,   // (tune)
  bodyD: 0.55, bodyStill: Infinity,                                  // (tune)
  // forgiveness (K4-K7)
  snap: 0.15, rescue: 'off', dudCd: 0, wrongLife: Infinity,         // (tune)
  // client (K9, K10): sent to the board once per stage
  assist: 'label+snap', forms: true,
  // bodies
  holdLow: 0.55,          // arm hold while a friend stands on your head
  // enclosure (phase 7)
  inR: 0.3,
  profiles: {
    relaxed:  { besideD: 0.55, besideR: [0.35, 1.5], besideY: 0.6, bodyD: 0.7, snap: 0.2, rescue: 'unique', wrongLife: 12 },
    standard: {},
    strict:   { besideD: 0.25, besideR: [0.5, 1.1], besideY: 0.25, bodyD: 0.35, bodyStill: 0.5, snap: 0, dudCd: 1.5, assist: 'none', forms: false },
  },
};
const PROFILE = 'standard';   // default for stages without a "strict" field
// The knobs for one profile. An unknown name falls back to the default (the judge rejects it).
function forgeKnobs(name) {
  const fz = Object.assign({}, FORGE, FORGE.profiles[name] || FORGE.profiles[PROFILE]);
  delete fz.profiles;
  fz.profile = FORGE.profiles[name] ? name : PROFILE;
  return Object.freeze(fz);
}

// Conjure constants — single place for the designer to tune.
// All values in SPEC.md section 3; marked (tune) means change after playtesting.
// Ink is ONE pool shared by the whole crew. Its cap grows with the crew:
//   cap = min(inkCap, ink0 + inkPerFriend * (players - 1))
const CONJURE = {
  ink0:        3,  // cap (and starting ink) for a crew of one (tune)
  inkPerFriend:1,  // extra cap per extra player (tune)
  inkCap:      8,  // hard cap however big the crew (tune)
  regen:       20, // seconds for the crew pool to regain one drop (tune)
  cooldown:    4,  // seconds between conjures per player (tune)
  perPlayer:   3,  // max conjured stones alive per player (tune)
};

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---------- the classifier (docs/forge/DESIGN.md §3, SPEC §5) ----------
// Screen axes of the fixed camera (app.js): R points screen-right, D points toward the viewer.
// Left/right means R only; depth (D) never means anything.
const SQ = Math.SQRT1_2;
const AX_R = [SQ, -SQ], AX_D = [SQ, SQ];
// relate(a, b, mode, fz): the placement of two stones, or null.
//   mode 'ground': a stone resting on another (k.support) is ⿱ with the top stone first.
//   mode 'body':   held stones; ⿱ when one holder stands on the other (p.support).
//   Otherwise ⿰ when the pair sits side by side on screen, the screen-left stone first.
// Returns { op, first, second, err }: err 0 is the ideal spot, 1 is the edge of a cone.
// Pure: reads positions, support and the knobs, changes nothing.
function relate(a, b, mode, fz) {
  if (!a || !b || a === b) return null;
  const body = mode === 'body';
  const top = body ? (a.holder && b.holder && a.holder.support === b.holder ? a : b.holder && a.holder && b.holder.support === a.holder ? b : null)
                   : (a.support === b ? a : b.support === a ? b : null);
  if (top) {
    if (body && fz.bodyStill !== Infinity && (speed(a.holder) > fz.bodyStill || speed(b.holder) > fz.bodyStill)) return null;
    const bot = top === a ? b : a;
    return { op: '⿱', first: top, second: bot, err: Math.hypot(top.x - bot.x, top.z - bot.z) };
  }
  const dx = b.x - a.x, dz = b.z - a.z, y = b.y - a.y;
  const r = dx * AX_R[0] + dz * AX_R[1], q = dx * AX_D[0] + dz * AX_D[1], ar = Math.abs(r);
  const maxD = body ? fz.bodyD : fz.besideD, [r0, r1] = fz.besideR;
  if (Math.abs(y) > fz.besideY || Math.abs(q) > maxD || ar < r0 || ar > r1) return null;
  if (body && fz.bodyStill !== Infinity && (speed(a.holder) > fz.bodyStill || speed(b.holder) > fz.bodyStill)) return null;
  const er = ar >= fz.ideal ? (ar - fz.ideal) / Math.max(1e-9, r1 - fz.ideal) : (fz.ideal - ar) / Math.max(1e-9, fz.ideal - r0);
  const err = Math.hypot(er, q / maxD, y / fz.besideY) / Math.sqrt(3);
  return r >= 0 ? { op: '⿰', first: a, second: b, err } : { op: '⿰', first: b, second: a, err };
}
const speed = p => p ? Math.hypot(p.vx || 0, p.vz || 0) : 0;
// The relation k should forge through among `others`: support (⿱) first, then the smallest err,
// then the partner with the lowest id. Deterministic for a given set of stones.
function bestRelation(k, others, mode, fz) {
  let best = null, bestP = null;
  for (const o of others) {
    const rel = relate(k, o, mode, fz);
    if (!rel) continue;
    let better;
    if (!best) better = true;
    else if ((rel.op === '⿱') !== (best.op === '⿱')) better = rel.op === '⿱';
    else if (rel.err !== best.err) better = rel.err < best.err;
    else better = o.id < bestP.id;
    if (better) { best = rel; bestP = o; }
  }
  return best && Object.assign({ partner: bestP }, best);
}

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
      kind: 'm', id: m.id, wall: m.kind || null, done: false,
      x0: m.rect[0], z0: m.rect[1], x1: m.rect[0] + m.rect[2], z1: m.rect[1] + m.rect[3],
      from: m.from, to: m.to, when: m.when || [], all: !!m.all, speed: m.speed || 2, a: 0, top: m.from
    }));
    // 同舟: the boat is a deck that sails. It carries whoever stands on it.
    this.boat = null;
    if (L.boat) {
      const r = L.boat.rect, top = this.floor(L.spawn[0], L.spawn[1]);
      const b = {
        kind: 'm', id: 'boat', boat: true, dyn: true, done: true, wall: null, when: [], all: false,
        x0: r[0], z0: r[1], x1: r[0] + r[2], z1: r[1] + r[3], w: r[2], d: r[3], dock: [r[0], r[1]],
        from: top, to: top, top, a: 1, speed: 1, dx: 0, dz: 0,
        off0: L.boat.from || [0, 0], off1: L.boat.to || [0, 0], st: this.players.size ? 'in' : 'moored', t: 0,
        vx: 0, vz: 0, px: 0, pz: 0, rowT: 0
      };
      this.boat = b;
      this.movers.push(b);
      this.placeBoat();
    }
    this.sailIn = null;
    this.bridges = [];
    this.crates = (L.crates || []).map((c, k) => {
      const y = this.floor(c[0], c[1]);
      return { kind: 'c', i: k, x: c[0], z: c[1], y, vy: 0, dx: 0, dz: 0, home: [c[0], y, c[1]] };
    });
    this.gems = (L.gems || []).map(g => ({ x: g[0], z: g[1], y: g[2] != null ? g[2] : this.floor(g[0], g[1]) + 0.7, got: false }));
    // glow-gems come after the gems: they show, and can be taken, only while the isle is dim
    for (const g of L.glow || []) this.gems.push({ x: g[0], z: g[1], y: g[2] != null ? g[2] : this.floor(g[0], g[1]) + 0.7, got: false, glow: true });
    this.dusk = 0;
    this.beacon = { x: L.beacon[0], z: L.beacon[1], y: this.floor(L.beacon[0], L.beacon[1]) };
    this.stones = [];
    this.sid = 0;
    this.regrow = L.regrow != null ? !!L.regrow : STONES.regrow;
    this.fz = forgeKnobs(L.strict || PROFILE);
    // What the pavilion wants and every piece on the way to it: anything else forged here is
    // "wrong but real" (DESIGN §4.4), which K7 (wrongLife) may split back.
    this.wantTree = new Set([L.want]);
    for (let grew = true; grew;) {
      grew = false;
      for (const r of LV.RECIPE_LIST) if (this.wantTree.has(r[3])) for (const c of (r[0] === '⿱⿰' ? [r[1], ...r[2]] : [r[1], r[2]])) if (!this.wantTree.has(c)) { this.wantTree.add(c); grew = true; }
    }
    this.cool = new Map();   // K6: "a,b" stone ids -> clock time until which this pair cannot forge again
    this.clock = 0;          // seconds since the stage loaded, every step (this.time only runs once the crew has started)
    this.springs = (L.stones || []).map(d => ({ ch: d[0], x: d[1], z: d[2], y: this.floor(d[1], d[2]), stone: null, wait: 0 }));
    for (const sp of this.springs) sp.stone = this.addStone(sp.ch, sp.x, sp.y, sp.z, sp);
    for (const p of this.players.values()) p.hold = null;
    this.found = new Set();
    this.phase = 'play';
    this.time = 0;
    this.started = false;
    this.wonFor = 0;
    this.result = null;
    // The crew's shared ink pool starts full at every stage (per-stage, not per-join).
    this.ink = this.inkMax();
    for (const p of this.players.values()) p.conjCd = 0;
    this.slots = this.spawnSlots();
    let k = 0;
    for (const p of this.players.values()) { this.placeAtSpawn(p, k); if (this.boat && this.boat.st === 'in') this.placeOnDeck(p, k); k++; }
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
    for (const d of L.stones || []) taken.add(Math.floor(d[1]) + ',' + Math.floor(d[2]));
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

  // where the boat is right now: easing in to the dock, moored, or pulling away
  placeBoat() {
    const b = this.boat;
    let ox = 0, oz = 0;
    if (b.st === 'in') { const u = clamp(b.t / ARRIVE, 0, 1), e = Math.pow(1 - u, 3); ox = b.off0[0] * e; oz = b.off0[1] * e; }
    else if (b.st === 'out') { const u = clamp(b.t / LEAVE, 0, 1), e = u * u; ox = b.off1[0] * e; oz = b.off1[1] * e; }
    const nx = b.dock[0] + ox, nz = b.dock[1] + oz;
    b.dx = nx - b.x0; b.dz = nz - b.z0;
    b.x0 = nx; b.z0 = nz; b.x1 = nx + b.w; b.z1 = nz + b.d;
  }

  stepBoat(dt) {
    const b = this.boat;
    if (!b) return;
    if (b.st === 'moored') {
      // Free on the water: whoever walks into a rail pushes it that way. It stops at
      // rock, bridges and lifts, so it can be parked in a gap and walked across.
      const pushed = b.px || b.pz;
      b.vx = clamp(b.vx + clamp(b.px, -2, 2) * ROW_ACC * dt, -ROW_MAX, ROW_MAX);
      b.vz = clamp(b.vz + clamp(b.pz, -2, 2) * ROW_ACC * dt, -ROW_MAX, ROW_MAX);
      b.px = b.pz = 0;
      const drag = Math.exp(-ROW_DRAG * dt);
      b.vx *= drag; b.vz *= drag;
      if (Math.abs(b.vx) < 0.03) b.vx = 0;
      if (Math.abs(b.vz) < 0.03) b.vz = 0;
      b.dx = b.dz = 0;
      if (b.vx) { const n = b.x0 + b.vx * dt; if (this.boatFits(n, b.z0)) { b.dx = n - b.x0; b.x0 = n; b.x1 = n + b.w; } else { if (Math.abs(b.vx) > 1) this.ev('bump', {}); b.vx = 0; } }
      if (b.vz) { const n = b.z0 + b.vz * dt; if (this.boatFits(b.x0, n)) { b.dz = n - b.z0; b.z0 = n; b.z1 = n + b.d; } else { if (Math.abs(b.vz) > 1) this.ev('bump', {}); b.vz = 0; } }
      b.rowT -= dt;
      if (pushed && (b.dx || b.dz) && b.rowT <= 0) { b.rowT = 0.55; this.ev('row', {}); }
      return;
    }
    b.t += dt;
    this.placeBoat();
    if (b.st === 'in' && b.t >= ARRIVE) { b.st = 'moored'; this.ev('moor', {}); }
  }

  // open water only: no rock, no bridge, no lift, and not too far out
  boatFits(x0, z0) {
    const b = this.boat, g = this.grid, e = 0.02;
    if (x0 < -SEA || z0 < -SEA || x0 + b.w > Math.max(g.w, b.dock[0] + b.w) + SEA || z0 + b.d > Math.max(g.d, b.dock[1] + b.d) + SEA) return false;
    for (let cz = Math.floor(z0 + e); cz <= Math.floor(z0 + b.d - e); cz++)
      for (let cx = Math.floor(x0 + e); cx <= Math.floor(x0 + b.w - e); cx++) if (g.at(cx, cz)) return false;
    for (const m of this.movers) if (m !== b && x0 + b.w - e > m.x0 && x0 + e < m.x1 && z0 + b.d - e > m.z0 && z0 + e < m.z1) return false;
    return true;
  }

  // is there something to step onto just past the rail?
  shore(x, z) {
    const b = this.boat;
    return b.st === 'moored' && this.ground(x, z, 0.05, b.top + STEP, null, false).y > b.top - 2.5;
  }

  onDeck(p) {
    const b = this.boat;
    return !!b && p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y > b.top - 0.2 && p.y < b.top + 2.5;
  }

  // everyone starts a stage standing on the boat as it sails in
  placeOnDeck(p, k) {
    const b = this.boat, S = 0.66;
    const cols = Math.max(1, Math.floor(b.w / S)), rows = Math.max(1, Math.floor(b.d / S));
    const i = k % (cols * rows);
    p.x = b.x0 + (b.w - (cols - 1) * S) / 2 + (i % cols) * S;
    p.z = b.z0 + (b.d - (rows - 1) * S) / 2 + Math.floor(i / cols) * S;
    p.y = b.top; p.support = b;
  }

  placeAtSpawn(p, k) {
    const s = this.slots[k % this.slots.length];
    // more wobblers than tiles: share a tile, one per corner
    const lap = Math.floor(k / this.slots.length);
    const ox = lap ? ((lap & 1) ? 0.24 : -0.24) : 0, oz = lap ? ((lap & 2) ? 0.24 : -0.24) : 0;
    p.x = s[0] + ox; p.y = s[1]; p.z = s[2] + oz;
    p.vx = p.vy = p.vz = 0;
    p.grounded = true; p.support = null; p.coyote = 0; p.jb = 0; p.grab = false; p.glide = 0; p.fling = 0;
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
      afk: false, safe: [0, 0, 0], dx: 0, dz: 0, hold: null, qi: 0, glide: 0, fling: 0, cd: 0,
      conjCd: 0
    };
    this.players.set(id, p);
    // While the crew is still gathering (nobody has moved yet), every newcomer tops the pool up to the new cap.
    if (!this.started) this.ink = this.inkMax();
    this.placeAtSpawn(p, this.players.size - 1);
    return p;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    if (p.hold) this.dropStone(p);
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
      if (p.hold) this.dropStone(p);
      this.placeAtSpawn(p, [...this.players.keys()].indexOf(id));
      this.ev('respawn', { id });
    }
  }

  setAfk(id, afk) {
    const p = this.players.get(id);
    if (!p) return;
    p.afk = !!afk;
    if (p.afk) { p.in.x = p.in.z = 0; if (p.hold) this.dropStone(p); }
  }

  // ---------- conjure ----------
  // Cap of the crew's shared ink pool for the current crew size.
  inkMax() {
    const n = Math.max(1, this.players.size);
    return Math.min(CONJURE.inkCap, CONJURE.ink0 + CONJURE.inkPerFriend * (n - 1));
  }

  // Returns {ok:true, stone} or {ok:false, why}.
  // Checks run in the order specified in SPEC.md section 3.
  conjure(playerId, ch) {
    if (this.phase !== 'play') return { ok: false, why: 'phase' };
    const p = this.players.get(playerId);
    if (!p || p.afk) return { ok: false, why: 'away' };
    // Allowed set: stage's conjure list, or fall back to the stage's own characters.
    const allowed = this.L.conjure || (this.L.stones || []).map(d => d[0]);
    if (!allowed.includes(ch)) return { ok: false, why: 'unknown' };
    if (p.conjCd > 0) return { ok: false, why: 'cooldown' };
    if (this.ink < 1) return { ok: false, why: 'ink' };
    // Per-player cap: how many conjured stones does this player still have alive?
    const alive = this.stones.filter(k => k.state !== 'gone' && k.conj && k.by === playerId).length;
    if (alive >= CONJURE.perPlayer) return { ok: false, why: 'cap' };
    // Place the stone 0.9 units in front of the player, at floor height.
    const fx = Math.sin(p.rot), fz = Math.cos(p.rot);
    let sx = p.x + fx * 0.9, sz = p.z + fz * 0.9;
    let sy = this.floor(sx, sz);
    // Facing a gap, a wall or a drop: the spot ahead is no good (over void its floor is -Infinity,
    // which used to give a stone with a non-finite height). Conjure it where the player last stood safely.
    if (!Number.isFinite(sy) || Math.abs(sy - p.y) > 0.5) { sx = p.safe[0]; sy = p.safe[1]; sz = p.safe[2]; }
    const stone = this.addStone(ch, sx, sy, sz, null);
    if (!stone) return { ok: false, why: 'cap' };
    // Bookkeeping per SPEC.
    this.ink -= 1;
    p.conjCd = CONJURE.cooldown;
    stone.grounded = false;
    stone.vy = 5;
    stone.pop = true;
    stone.from = [sx, sy, sz];
    stone.by = playerId;
    stone.placer = playerId;
    stone.conj = true;
    this.ev('conjure', { by: playerId, ch, s: stone.id, x: sx, y: sy, z: sz });
    this.note(ch, null, true);
    return { ok: true, stone };
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
  // `stones`: a stone body also lands on loose stones (players never do). DESIGN §4.1.
  ground(x, z, r, maxY, self, heads, stones) {
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
    if (stones) {
      for (const o of this.stones) {
        if (o === self || o.state !== 'loose' || o.support === self) continue;   // a bouncing stone still carries what falls with it
        const t = o.y + OH;
        // round footprints: screen-beside is a world diagonal, where square boxes would still overlap
        if (Math.hypot(x - o.x, z - o.z) < r + OR && t <= maxY && t > y) { y = t; ref = o; }
      }
    }
    if (heads) {
      // a friend's head is a step: stand on it to reach a 2-high ledge
      for (const o of this.players.values()) {
        if (o === self || o.hold) continue;
        const t = o.y + PH;
        if (Math.abs(x - o.x) < r + PR && Math.abs(z - o.z) < r + PR && t <= maxY && t > y) { y = t; ref = o; }
      }
    }
    return { y, ref };
  }

  // ---------- step ----------
  step(dt) {
    this.clock += dt;
    if (this.phase === 'won') {
      // The shrine has answered and the river is open: all aboard. The boat leaves
      // when everyone awake is on it, or a while after the first one boards.
      this.wonFor += dt;
      const b = this.boat;
      if (!b) { if (this.wonFor >= 10) { this.loadStage(this.stage + 1); return; } }
      else {
        let need = 0, on = 0;
        for (const p of this.players.values()) { if (this.onDeck(p)) on++; if (!p.afk) need++; }
        this.aboard = on; this.need = need;
        if (on && this.sailIn == null) { this.sailIn = BOARD_WAIT; this.ev('board', {}); }
        if (this.sailIn != null) this.sailIn -= dt;
        const go = this.wonFor >= WIN_MIN && on > 0 && (on >= need || this.sailIn <= 0);
        if (go || this.wonFor >= (this.players.size ? WIN_HOLD : 10)) {
          this.phase = 'sail'; b.st = 'out'; b.t = 0; b.dock = [b.x0, b.z0]; b.vx = b.vz = 0;
          for (const p of this.players.values()) if (p.hold) this.dropStone(p);
          this.ev('sail', { on });
        }
      }
    } else if (this.phase === 'sail') {
      if (this.boat.t >= LEAVE) { this.loadStage(this.stage + 1); return; }
    } else if (this.started && this.players.size) {
      this.time += dt;
    }

    this.stepPlates();
    this.stepBoat(dt);
    this.stepMovers(dt);
    // The crew's ink regenerates every step, deterministically from dt.
    this.ink = Math.min(this.inkMax(), this.ink + dt / CONJURE.regen);
    for (const p of this.players.values()) if (p.conjCd > 0) p.conjCd -= dt;

    for (const c of this.crates) { c.sx = c.x; c.sz = c.z; }
    for (const p of this.players.values()) { p.sx = p.x; p.sz = p.z; }

    for (const p of this.players.values()) this.stepPlayer(p, dt);
    this.separatePlayers();
    for (const c of this.crates) this.stepCrate(c, dt);

    for (const c of this.crates) { c.dx = c.x - c.sx; c.dz = c.z - c.sz; }
    for (const p of this.players.values()) { p.dx = p.x - p.sx; p.dz = p.z - p.sz; }

    for (const k of this.stones.slice()) if (k.state !== 'gone') this.stepStone(k, dt);
    this.stepFusion();
    this.stepWrong(dt);
    if (this.dusk > 0 && this.phase === 'play') { if (this.dusk > dt) this.dusk -= dt; else this.setDusk(0, null); }
    this.stepWalls();
    this.stepSprings(dt);
    this.stones = this.stones.filter(k => k.state !== 'gone');
    if (this.phase === 'play') { this.stepGems(); this.checkWin(); }
  }

  stepPlates() {
    for (const pl of this.plates) {
      const px = pl.x + 0.5, pz = pl.z + 0.5;
      let on = false;
      const over = (x, z, y, tol) => Math.abs(x - px) < tol && Math.abs(z - pz) < tol && Math.abs(y - pl.y) < 0.3;
      for (const p of this.players.values()) if (p.grounded && over(p.x, p.z, p.y, 0.62)) { on = true; break; }
      if (!on) for (const c of this.crates) if (over(c.x, c.z, c.y, 0.7)) { on = true; break; }
      if (!on) for (const k of this.stones) if (k.state === 'loose' && k.grounded && over(k.x, k.z, k.y, 0.62)) { on = true; break; }
      if (on !== pl.on) { pl.on = on; this.ev('plate', { id: pl.id, on }); }
    }
  }

  stepMovers(dt) {
    for (const m of this.movers) {
      if (m.boat) continue;
      const held = m.when.map(id => { const p = this.plates.find(q => q.id === id); return !!(p && p.on); });
      const active = (m.wall || m.dyn) ? m.done : m.all ? held.every(Boolean) : held.some(Boolean);
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
    const carrying = !!p.hold;
    const ix = p.afk ? 0 : p.in.x, iz = p.afk ? 0 : p.in.z;
    const moving = Math.hypot(ix, iz) > 0.08;
    const sp = carrying ? CARRY_SPEED : p.glide > 0 ? LEAP_SPEED : SPEED;
    const k = p.grounded ? 0.3 : p.fling > 0 ? 0 : 0.14;
    p.vx += (ix * sp - p.vx) * k;
    p.vz += (iz * sp - p.vz) * k;
    if (moving) p.rot = Math.atan2(ix, iz);

    // ride whatever we stand on
    const sup = p.support;
    if (sup && (sup.kind === 'c' || sup.kind === 'p' || sup.boat) && (sup.dx || sup.dz)) {
      this.movePlayer(p, sup.dx, 0, false);
      this.movePlayer(p, 0, sup.dz, false);
    }

    if (p.qi > 0) p.qi -= dt;
    if (p.glide > 0) p.glide -= dt;
    if (p.fling > 0) p.fling -= dt;
    if (p.cd > 0) p.cd -= dt;
    if (p.jb > 0) {
      p.jb -= dt;
      if (p.grounded || p.coyote > 0) {
        // a carrier jumps as high as anyone; what the stone costs is the second, mid-air leap
        p.vy = JUMP_V; p.grounded = false; p.coyote = 0; p.jb = 0; p.support = null;
        this.ev('jump', { id: p.id });
        // whoever stands on a jumper's head is sprung into the air
        for (const o of this.players.values()) {
          if (o.support !== p) continue;
          o.vy = JUMP_V * 1.15; o.grounded = false; o.support = null; o.coyote = 0;
          this.ev('spring', { id: o.id, by: p.id });
        }
      } else if (!carrying && p.qi <= 0) {
        // 轻功: a second leap off thin air, long and floating. Empty hands only.
        p.vy = LEAP_V; p.glide = GLIDE; p.qi = QI_CD; p.jb = 0;
        if (moving) { const l = Math.hypot(ix, iz); p.vx = ix / l * LEAP_SPEED; p.vz = iz / l * LEAP_SPEED; }
        this.ev('leap', { id: p.id });
      }
    }

    if (p.grab) {
      p.grab = false;
      if (carrying) this.throwStone(p);
      else if (this.phase === 'play') {
        const k = this.nearStone(p);
        if (k) this.holdStone(p, k, 'grab');
        else this.boost(p);
      } else this.boost(p);
    }

    let mx = p.vx * dt, mz = p.vz * dt;
    const bt = this.boat;
    if (bt && p.grounded && p.support === bt) {
      // The deck has a rail wherever there is nothing to step onto. Walking into
      // it does not walk you overboard: it pushes the boat.
      const w = (bt.st === 'moored' && this.phase !== 'sail') ? (carrying ? 0.7 : 1) : 0;
      if (mx > 0 && p.x + mx > bt.x1 - RAIL && !this.shore(bt.x1 + 0.35, p.z)) { bt.px += w * Math.min(1, Math.abs(ix) * 1.2); mx = Math.max(0, bt.x1 - RAIL - p.x); }
      if (mx < 0 && p.x + mx < bt.x0 + RAIL && !this.shore(bt.x0 - 0.35, p.z)) { bt.px -= w * Math.min(1, Math.abs(ix) * 1.2); mx = Math.min(0, bt.x0 + RAIL - p.x); }
      if (mz > 0 && p.z + mz > bt.z1 - RAIL && !this.shore(p.x, bt.z1 + 0.35)) { bt.pz += w * Math.min(1, Math.abs(iz) * 1.2); mz = Math.max(0, bt.z1 - RAIL - p.z); }
      if (mz < 0 && p.z + mz < bt.z0 + RAIL && !this.shore(p.x, bt.z0 - 0.35)) { bt.pz -= w * Math.min(1, Math.abs(iz) * 1.2); mz = Math.min(0, bt.z0 + RAIL - p.z); }
    }
    if (!this.movePlayer(p, mx, 0, true)) p.vx = 0;
    if (!this.movePlayer(p, 0, mz, true)) p.vz = 0;

    const was = p.grounded;
    const prevY = p.y;
    p.vy -= G * (p.glide > 0 && !carrying ? 0.5 : 1) * dt;
    p.y += p.vy * dt;
    const g = this.ground(p.x, p.z, PSR, prevY + (was ? STEP : AIR), p, true);
    if (p.vy <= 0 && p.y <= g.y + (was ? SNAP : 0)) {
      if (!was && p.vy < -4) this.ev('land', { id: p.id, v: +(-p.vy).toFixed(1) });
      p.y = g.y; p.vy = 0; p.grounded = true; p.support = g.ref; p.glide = 0; p.fling = 0;
      if (g.ref.wall && !g.ref.done) {
        // the top of thorns or flames is no place to stand: it throws you on
        const l = Math.hypot(p.vx, p.vz);
        if (l < 2.5) { p.vx = Math.sin(p.rot) * 3.2; p.vz = Math.cos(p.rot) * 3.2; }
        p.vy = 7.5; p.grounded = false; p.support = null; p.fling = 0.35;
        this.ev('ouch', { id: p.id, wall: g.ref.wall });
      }
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
      if (p.hold) this.returnStone(p.hold, 'fell');
      p.x = p.safe[0]; p.y = p.safe[1]; p.z = p.safe[2];
      p.vx = p.vy = p.vz = 0; p.grounded = true; p.support = null; p.glide = 0;
      this.ev('respawn', { id: p.id });
    }
  }

  // the friend the button would boost right now
  nearFriend(p) {
    if (p.hold || !p.grounded || p.cd > 0) return null;
    const fx = Math.sin(p.rot), fz = Math.cos(p.rot);
    let best = null, bd = BOOST_R;
    for (const o of this.players.values()) {
      if (o === p || !o.grounded) continue;
      const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
      if (d < bd && d > 0.05 && Math.abs(o.y - p.y) < 0.6 && (dx * fx + dz * fz) / d > 0.5) { bd = d; best = o; }
    }
    return best;
  }

  // Empty hands, a friend right in front: fling them up and forward, stone and all.
  boost(p) {
    const o = this.nearFriend(p);
    if (!o) return false;
    const fx = Math.sin(p.rot), fz = Math.cos(p.rot);
    o.vx = fx * BOOST_SPEED; o.vz = fz * BOOST_SPEED; o.vy = BOOST_V;
    o.grounded = false; o.support = null; o.coyote = 0; o.fling = FLING; o.rot = p.rot;
    p.cd = BOOST_CD;
    this.started = true;
    this.ev('boost', { id: p.id, to: o.id });
    return true;
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

  // ---------- character stones ----------
  addStone(ch, x, y, z, spring) {
    if (this.stones.length >= MAX_STONES) return null;
    const k = {
      id: ++this.sid, ch, g: LV.GLYPHS[ch] || {}, state: 'loose', x, y, z, vx: 0, vy: 0, vz: 0, grounded: true,
      holder: null, flight: 0, thrower: null, lonely: 0, home: [x, y, z], from: null, spring: spring || null
    };
    this.stones.push(k);
    return k;
  }

  // a stone is used up (fused, or grown into a bridge). It is gone for good unless the
  // stage regrows, in which case its spring grows a new one after REGROW seconds.
  consume(k) {
    if (k.holder) { k.holder.hold = null; k.holder = null; }
    k.state = 'gone';
    if (k.spring) { k.spring.stone = null; k.spring.wait = REGROW; }
    this.ev('spent', { s: k.id, ch: k.ch, back: this.regrow && !!k.spring });
  }

  nearStone(p) {
    let best = null, bd = 1.25;
    for (const k of this.stones) {
      if (k.state !== 'loose') continue;
      const d = Math.hypot(k.x - p.x, k.z - p.z);
      if (d < bd && Math.abs(k.y - p.y) < 1.4) { bd = d; best = k; }
    }
    return best;
  }

  holdStone(p, k, how) {
    k.state = 'held'; k.holder = p; p.hold = k; k.grounded = false; k.support = null; k.snap = null; k.ready = 0; k.vx = k.vy = k.vz = 0; k.lonely = 0;
    this.started = true;
    this.note(k.ch, p.id);
    this.ev(how, { id: p.id, s: k.id, ch: k.ch });
  }

  note(ch, id, made) { if (!this.found.has(ch)) { this.found.add(ch); this.ev('found', { ch, id: id || null, made: !!made }); } }

  dropStone(p) {
    const k = p.hold;
    if (!k) return;
    p.hold = null;
    k.state = 'loose'; k.holder = null; k.thrower = null; k.flight = 0; k.grounded = false; k.placer = p.id;
    k.x = p.x; k.y = p.y + 0.6; k.z = p.z; k.vx = k.vz = 0; k.vy = 1;
    k.from = p.safe.slice();
  }

  returnStone(k, why) {
    const to = k.from || k.home;
    if (k.holder) { k.holder.hold = null; }
    k.state = 'loose'; k.holder = null; k.thrower = null;
    k.x = to[0]; k.y = to[1]; k.z = to[2];
    k.vx = k.vy = k.vz = 0; k.grounded = true; k.lonely = 0; k.flight = 0;
    this.ev('stoneReturn', { why, s: k.id, ch: k.ch });
  }

  // Where a throw would go right now. One function serves the throw and the aim marker.
  launch(p) {
    const fx = Math.sin(p.rot), fz = Math.cos(p.rot);
    let best = null, bs = Infinity, bd = 0, bx = 0, bz = 0;
    for (const o of this.players.values()) {
      if (o === p || o.afk || o.hold) continue;
      const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz), dy = o.y - p.y;
      if (d < 0.8 || d > 5.5 || dy > 1.3 || dy < -6) continue;
      const cos = (dx * fx + dz * fz) / d;
      if (cos < 0.55) continue;
      const s = d * (1.6 - cos);
      if (s < bs) { bs = s; best = o; bd = d; bx = dx; bz = dz; }
    }
    const y0 = p.y + HOLD_Y;
    // Facing another stone close by: place this one against it. That is how characters
    // are made, so it wins over a pass to a friend standing behind it. Where you stand
    // decides the placement (DESIGN §4.3): screen-left or screen-right of the stone sets
    // yours BESIDE it on your side ('join'); in front of it or behind it sets yours ON TOP
    // ('stack'). The rule only helps the hand: what the stones make is decided where they land.
    let jt = null, jd = 1.7;
    for (const k of this.stones) {
      if (k === p.hold || k.state !== 'loose' || !k.grounded) continue;
      const dx = k.x - p.x, dz = k.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.25 || Math.abs(k.y - p.y) > 0.6 || (dx * fx + dz * fz) / d < 0.4) continue;
      // the nearest stone; on a stack (same spot), the top one
      if (d < jd - 1e-6 || (jt && d < jd + 1e-6 && k.y > jt.y)) { jd = Math.min(d, jd); jt = k; }
    }
    if (jt) {
      const ox = p.x - jt.x, oz = p.z - jt.z;
      const r = ox * AX_R[0] + oz * AX_R[1], q = ox * AX_D[0] + oz * AX_D[1], T = 0.38;
      const beside = Math.abs(r) >= Math.abs(q), side = r < 0 ? -1 : 1, ideal = this.fz.ideal;
      const tx = beside ? jt.x + side * ideal * AX_R[0] : jt.x, tz = beside ? jt.z + side * ideal * AX_R[1] : jt.z;
      const ty = beside ? jt.y : jt.y + OH;
      return { mode: beside ? 'join' : 'stack', on: jt.id, x: p.x, y: y0, z: p.z, vx: (tx - p.x) / T, vz: (tz - p.z) / T, vy: (ty - y0 + 0.5 * G * T * T) / T };
    }
    if (best) {
      // a pass: lobbed straight into a friend's hands, up to one step higher
      const T = clamp(bd / 6.5, 0.42, 0.85);
      return { mode: 'pass', to: best.id, x: p.x, y: y0, z: p.z, vx: bx / T, vz: bz / T, vy: (best.y + 0.9 - y0 + 0.5 * G * T * T) / T };
    }
    const b = this.beacon, dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz);
    if (p.hold && p.hold.ch === this.L.want && d > 0.5 && d < 3.4 && Math.abs(b.y - p.y) < 0.4 && (dx * fx + dz * fz) / d > 0.5) {
      const T = clamp(d / 5, 0.45, 0.7);
      return { mode: 'dunk', x: p.x, y: y0, z: p.z, vx: dx / T, vz: dz / T, vy: (b.y + 0.3 - y0 + 0.5 * G * T * T) / T };
    }
    // a heave: flat and short. It crosses a 2-wide gap and never climbs a step.
    if (!p.afk && Math.hypot(p.in.x, p.in.z) > 0.3) return { mode: 'toss', x: p.x, y: p.y + 0.7, z: p.z, vx: fx * 7.4, vy: 3, vz: fz * 7.4 };
    return { mode: 'place', x: p.x + fx * 0.35, y: p.y + 0.7, z: p.z + fz * 0.35, vx: fx * 2.6, vy: 2, vz: fz * 2.6 };
  }

  throwStone(p) {
    const k = p.hold, l = this.launch(p);
    p.hold = null;
    k.state = 'loose'; k.holder = null; k.thrower = p; k.flight = 0; k.grounded = false; k.lonely = 0;
    k.x = l.x; k.y = l.y; k.z = l.z; k.vx = l.vx; k.vy = l.vy; k.vz = l.vz;
    k.from = p.safe.slice();
    k.placer = p.id;
    this.ev('throw', { id: p.id, mode: l.mode, s: k.id });
  }

  // Predicted landing spot for a carrier's aim marker.
  aim(p) {
    const l = this.launch(p);
    if (l.mode === 'pass') {
      const o = this.players.get(l.to);
      return [o.x, o.y, o.z, 'pass'];
    }
    const b = { x: l.x, y: l.y, z: l.z, vx: l.vx, vy: l.vy, vz: l.vz, grounded: false };
    for (let i = 0; i < 100 && !b.grounded && b.y > KILL; i++) this.moveStoneBody(b, 1 / 60);
    return [b.x, b.grounded ? b.y : KILL, b.z, l.mode];
  }

  moveStoneBody(b, dt) {
    let hit = 0;
    const nx = b.x + b.vx * dt;
    if (this.blocker(nx, b.z, OR, b.y, OH, SOFT, null)) { b.vx *= -0.25; hit = 1; } else b.x = nx;
    const nz = b.z + b.vz * dt;
    if (this.blocker(b.x, nz, OR, b.y, OH, SOFT, null)) { b.vz *= -0.25; hit = 1; } else b.z = nz;
    const prevY = b.y;
    b.vy -= G * dt;
    b.y += b.vy * dt;
    const g = this.ground(b.x, b.z, OR, prevY + SOFT, b, false, true);
    if (b.vy <= 0 && b.y <= g.y) {
      b.y = g.y;
      if (g.ref && g.ref.wall && !g.ref.done) {
        // nothing rests on thorns or flames
        if (Math.hypot(b.vx, b.vz) < 1.2) { b.vx = b.vx < 0 ? -1.6 : 1.6; }
        b.vy = 4.5; hit = 2;
      } else if (b.vy < -5) { b.vy *= -0.22; hit = 2; b.vx *= 0.5; b.vz *= 0.5; }
      else { b.vy = 0; b.grounded = true; b.support = g.ref; b.vx *= 0.7; b.vz *= 0.7; }
    } else { b.grounded = false; b.support = null; }
    return hit;
  }

  stepStone(k, dt) {
    if (k.state === 'held') {
      const p = k.holder;
      k.x = p.x; k.y = p.y + HOLD_Y; k.z = p.z;
      k.from = p.safe.slice();
      return;
    }
    if (k.state !== 'loose') return;
    const wasGrounded = k.grounded;
    // ride the boat, also when resting on a stone that rests on the boat
    let base = wasGrounded ? k.support : null;
    for (let n = 0; base && base.ch !== undefined && n < MAX_STONES; n++) base = base.support;
    if (base && base.boat) { k.x += base.dx; k.z += base.dz; }
    const hit = this.moveStoneBody(k, dt);
    if (hit === 2 || (k.grounded && !wasGrounded)) this.ev('thud', { s: k.id });
    if (k.grounded && !wasGrounded) this.settle(k);
    if (k.snap) this.stepSnap(k, dt);
    if (!k.grounded) {
      k.flight += dt;
      // 木 does what it means: dropped into a gap, it grows across it
      if (k.g.el === 'wood' && k.vy < 0 && this.phase === 'play') {
        const run = this.gapRun(Math.floor(k.x), Math.floor(k.z), k.g.span);
        if (run && k.y < run.h - 0.45) { this.growBridge(k, run); return; }
      }
      // (a stone that has just been made pops up and lands; nobody catches it by accident)
      if (k.flight > 0.1 && !k.pop && this.phase === 'play') {
        for (const p of this.players.values()) {
          if (p.afk || p.hold || (p === k.thrower && k.flight < 0.5)) continue;
          if (Math.hypot(p.x - k.x, p.z - k.z) < 0.75 && k.y > p.y - 0.4 && k.y < p.y + 1.7) { this.holdStone(p, k, 'catch'); return; }
        }
      }
    } else {
      k.flight = 0; k.thrower = null; k.pop = false;
      // A stone nobody can get to floats back to where it was thrown from.
      const to = k.from || k.home;
      const away = Math.hypot(k.x - to[0], k.z - to[2]) > 1.5;
      let near = !this.players.size || !away;
      if (!near) for (const p of this.players.values()) if (!p.afk && Math.hypot(p.x - k.x, p.z - k.z) < 5) { near = true; break; }
      k.lonely = near ? 0 : k.lonely + dt;
      if (k.lonely > 10) this.returnStone(k, 'lonely');
    }
    if (k.y < KILL) this.returnStone(k, 'fell');
  }

  // ---------- what characters do ----------
  isVoid(x, z) {
    if (this.grid.at(x, z)) return false;
    for (const m of this.movers) if (x + 0.5 > m.x0 && x + 0.5 < m.x1 && z + 0.5 > m.z0 && z + 0.5 < m.z1) return false;
    return true;
  }

  // The empty run through cell (cx, cz) between two flat floors, if it is short enough to bridge.
  gapRun(cx, cz, span) {
    if (!this.isVoid(cx, cz)) return null;
    let best = null;
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      let a = 0, b = 0, ok = true;
      while (this.isVoid(cx - dx * (a + 1), cz - dz * (a + 1))) { if (++a > span) { ok = false; break; } }
      while (ok && this.isVoid(cx + dx * (b + 1), cz + dz * (b + 1))) { if (++b > span) { ok = false; break; } }
      const len = a + b + 1;
      if (!ok || len > span) continue;
      const A = this.grid.at(cx - dx * (a + 1), cz - dz * (a + 1)), B = this.grid.at(cx + dx * (b + 1), cz + dz * (b + 1));
      if (!A || !B || A.ramp || B.ramp) continue;
      if (!best || len < best.len) {
        best = { len, h: Math.min(A.h, B.h), x0: cx - dx * a, z0: cz - dz * a, w: dx ? len : 1, d: dz ? len : 1 };
      }
    }
    return best;
  }

  growBridge(k, run) {
    const m = {
      kind: 'm', id: 'bridge' + (this.bridges.length + 1), dyn: true, done: true, wall: null, ch: k.ch,
      x0: run.x0, z0: run.z0, x1: run.x0 + run.w, z1: run.z0 + run.d,
      from: run.h - 3, to: run.h, when: [], all: false, speed: 7, a: 0, top: run.h - 3
    };
    this.movers.push(m);
    this.bridges.push(m);
    this.note(k.ch, k.thrower ? k.thrower.id : null);
    this.ev('bridge', { ch: k.ch, x: run.x0 + run.w / 2, y: run.h, z: run.z0 + run.d / 2, by: k.thrower ? k.thrower.id : null });
    this.consume(k);
  }

  // ---------- forging on the ground (DESIGN §4.2) ----------
  // Stones that may forge with each other: loose and resting, and not two that still sit where they grew.
  partners(k) {
    return this.stones.filter(o => o !== k && o.state === 'loose' && o.grounded && !(k.spring && o.spring && !k.from && !o.from));
  }

  // A loose stone has just come to rest. If it is in a relation, snap it to the ideal spot (K4) and
  // forge when the snap ends; otherwise forge (or dud) now. Near misses are logged as `try` norel.
  settle(k) {
    if (this.phase !== 'play') return;
    if (this.dusk > 0 && k.g.el === 'light' && !k.pop) this.setDusk(0, k.placer || null);
    const fz = this.fz, rel = bestRelation(k, this.partners(k), 'ground', fz);
    k.ready = k.pop ? 2 : 1;   // 2: a stone that popped out of a forge does not dud on landing
    if (!rel) {
      k.ready = 0;
      const wide = Object.assign({}, fz, { besideD: fz.besideD * 1.5, besideR: [fz.besideR[0] / 1.5, fz.besideR[1] * 1.5], besideY: fz.besideY * 1.5 });
      const near = bestRelation(k, this.partners(k), 'ground', wide);
      if (near) this.ev('try', { op: near.op, a: near.first.ch, b: near.second.ch, why: 'norel', err: near.err, by: k.placer || null, mode: 'ground' });
      return;
    }
    if (fz.snap > 0 && rel.err > 1e-6) {
      const o = rel.partner, top = rel.op === '⿱';
      let tx = o.x, tz = o.z;
      if (!top) {
        const side = ((k.x - o.x) * AX_R[0] + (k.z - o.z) * AX_R[1]) < 0 ? -1 : 1;
        tx = o.x + side * fz.ideal * AX_R[0]; tz = o.z + side * fz.ideal * AX_R[1];
      }
      // snap only along a flat surface: the ideal spot must hold the stone at the height it rests at now
      const g = this.ground(tx, tz, OR, k.y + SOFT, k, false, true);
      if (Math.abs(g.y - k.y) < 0.05 && (top ? g.ref === o : g.ref !== o)) { k.snap = { t: 0, x0: k.x, z0: k.z, x1: tx, z1: tz }; return; }
    }
  }

  // K4: slide toward the ideal spot over fz.snap seconds, then forge.
  stepSnap(k, dt) {
    const sn = k.snap;
    if (!k.grounded) { k.snap = null; return; }
    sn.t += dt;
    const u = Math.min(1, sn.t / this.fz.snap);
    k.x = sn.x0 + (sn.x1 - sn.x0) * u; k.z = sn.z0 + (sn.z1 - sn.z0) * u;
    k.vx = k.vz = 0;
    if (u >= 1) k.snap = null;
  }

  // Every resting stone that is ready (and not still snapping) tries its relation, in id order.
  stepFusion() {
    if (this.phase !== 'play') return;
    for (const k of this.stones.slice()) {
      if (!k.ready || k.snap || k.state !== 'loose' || !k.grounded) continue;
      const quiet = k.ready === 2;
      k.ready = 0;
      const rel = bestRelation(k, this.partners(k), 'ground', this.fz);
      if (rel) this.tryForge(rel, k.placer || null, { quiet, at: k });
    }
  }

  // The single path for every forge attempt (ground now, bodies in Phase 4). rel = relate()'s
  // { op, first, second, err }. Forges, rescues (K5) or duds; a dud consumes nothing.
  tryForge(rel, by, opt = {}) {
    const a = rel.first, b = rel.second, fz = this.fz, mode = opt.mode || 'ground';
    const pair = Math.min(a.id, b.id) + ',' + Math.max(a.id, b.id);
    if (this.cool.has(pair) && this.cool.get(pair) > this.clock) {
      this.ev('try', { op: rel.op, a: a.ch, b: b.ch, why: 'cooldown', err: rel.err, by, mode });
      return null;
    }
    let op = rel.op, first = a, second = b, ch = LV.fuse(op, a.ch, b.ch), rescued = false;
    if (!ch) {
      const alts = LV.mirrors(a.ch, b.ch).filter(r => r[0] !== '⿱⿰');
      if (fz.rescue === 'unique' && alts.length === 1) {
        // the only arrangement of these two pieces that makes anything: forge it, visibly slid into place
        const r = alts[0];
        op = r[0]; ch = r[3]; rescued = true;
        if (r[1] !== a.ch) { first = b; second = a; }
      } else {
        const why = alts.length ? 'mirror' : 'dud';
        this.ev('try', { op, a: a.ch, b: b.ch, why, err: rel.err, by, mode });
        if (fz.dudCd > 0) this.cool.set(pair, this.clock + fz.dudCd);
        if (!opt.quiet) this.ev('dud', { op, why, a: a.ch, b: b.ch, x: (a.x + b.x) / 2, y: Math.max(a.y, b.y), z: (a.z + b.z) / 2 });
        return null;
      }
    }
    // where the result appears: between a beside pair, on the bottom stone's spot for a stack
    const bot = op === '⿱' ? second : null;
    const x = bot ? bot.x : (a.x + b.x) / 2, y = bot ? bot.y : Math.max(a.y, b.y), z = bot ? bot.z : (a.z + b.z) / 2;
    this.consume(a); this.consume(b);
    const k = this.addStone(ch, x, y, z, null);
    const wrong = ch !== this.L.want && !this.wantTree.has(ch);
    if (k) {
      k.from = [x, y, z]; k.vy = 5; k.grounded = false; k.pop = true; k.parts = [op, first.ch, second.ch];
      if (wrong && fz.wrongLife !== Infinity) k.life = fz.wrongLife;
    }
    this.note(ch, by, true);
    if (k && k.g.el === 'dusk') this.setDusk(DUSK_TIME, by);
    this.ev('try', { op, a: first.ch, b: second.ch, why: wrong ? 'wrong' : 'ok', err: rel.err, by, mode, rescued });
    this.ev('forge', { op, a: first.ch, b: second.ch, ch, x, y, z, s: k ? k.id : 0, by, held: false, rescued });
    // alias for one phase (SPEC §7): the board's effects still listen for `fuse`
    this.ev('fuse', { op, a: first.ch, b: second.ch, ch, x, y, z, s: k ? k.id : 0 });
    return k;
  }

  // The knobs the client reads (K9 assist, K10 forms), sent once per stage. SPEC §6.
  clientKnobs() { return { profile: this.fz.profile, assist: this.fz.assist, forms: this.fz.forms }; }

  // The relation a resting stone is in, for the snapshot: [op, slot, partnerId] or 0.
  relOf(c) {
    if (c.state !== 'loose' || !c.grounded || c.snap) return 0;
    const rel = bestRelation(c, this.partners(c), 'ground', this.fz);
    return rel ? [rel.op, rel.first === c ? 1 : 2, rel.partner.id] : 0;
  }

  // Dusk: the isle dims (t seconds) or lights up again (t = 0).
  setDusk(t, by) {
    const was = this.dusk > 0;
    this.dusk = t;
    if (was !== t > 0) this.ev('dusk', { on: t > 0, by: by || null });
  }

  // K7: a wrong-but-real character splits back into its two pieces after fz.wrongLife seconds.
  // The pieces land apart in depth (which means nothing), so they do not forge again by themselves.
  stepWrong(dt) {
    if (this.fz.wrongLife === Infinity || this.phase !== 'play') return;
    for (const k of this.stones.slice()) {
      if (k.life === undefined || k.state === 'gone') continue;
      k.life -= dt;
      if (k.life > 0) continue;
      const at = k.holder ? { x: k.holder.x, y: k.holder.y, z: k.holder.z } : { x: k.x, y: k.y, z: k.z };
      const [op, ca, cb] = k.parts;
      this.consume(k);
      const out = [];
      for (const [ch, s] of [[ca, -1], [cb, 1]]) {
        const px = at.x + s * 0.45 * AX_D[0], pz = at.z + s * 0.45 * AX_D[1];
        const n = this.addStone(ch, px, at.y + 0.3, pz, null);
        if (n) { n.from = [px, at.y, pz]; n.grounded = false; n.vy = 3; n.pop = true; out.push(n.id); }
      }
      this.ev('split', { s: k.id, ch: k.ch, op, a: ca, b: cb, out });
    }
  }

  // 火 burns thorns, 水 douses flames. Carried or lying there, it works the same.
  stepWalls() {
    for (const m of this.movers) {
      if (!m.wall || m.done) continue;
      const need = m.wall === 'thorn' ? 'fire' : 'water';
      for (const k of this.stones) {
        if (k.state === 'gone' || k.g.el !== need) continue;
        const dx = k.x - clamp(k.x, m.x0, m.x1), dz = k.z - clamp(k.z, m.z0, m.z1);
        const feet = k.holder ? k.holder.y : k.y;
        if (Math.hypot(dx, dz) < k.g.reach && Math.abs(feet - m.to) < 2.5) {
          m.done = true;
          this.ev(m.wall === 'thorn' ? 'burn' : 'douse', { id: m.id, ch: k.ch, by: k.holder ? k.holder.id : null });
          break;
        }
      }
    }
  }

  stepSprings(dt) {
    if (!this.regrow) return;   // stones are used up: nothing grows back
    for (const sp of this.springs) {
      if (sp.stone) continue;
      sp.wait -= dt;
      if (sp.wait > 0) continue;
      // never grow under another stone: it would join with it before anyone chose to
      if (this.stones.some(o => o.state !== 'gone' && Math.hypot(o.x - sp.x, o.z - sp.z) < 1.4 && Math.abs(o.y - sp.y) < 2)) continue;
      const k = this.addStone(sp.ch, sp.x, sp.y, sp.z, sp);
      if (k) { sp.stone = k; this.ev('regrow', { s: k.id, ch: k.ch }); } else sp.wait = 1;
    }
  }

  stepGems() {
    for (let i = 0; i < this.gems.length; i++) {
      const g = this.gems[i];
      if (g.got || (g.glow && !(this.dusk > 0))) continue;
      for (const p of this.players.values()) {
        if (Math.hypot(p.x - g.x, p.y + 0.5 - g.y, p.z - g.z) < 0.8) { g.got = true; p.qi = 0; this.ev('gem', { i, id: p.id }); break; }
      }
    }
  }

  checkWin() {
    const b = this.beacon;
    for (const c of this.stones) {
      if (c.state === 'gone' || c.ch !== this.L.want) continue;
      if (Math.hypot(c.x - b.x, c.z - b.z) > 0.75 || c.y < b.y - 0.3 || c.y > b.y + 1.7) continue;
      const by = c.holder ? c.holder.id : c.thrower ? c.thrower.id : null;
      if (c.holder) c.holder.hold = null;
      c.state = 'scored'; c.holder = null; c.x = b.x; c.z = b.z; c.y = b.y + 1.0; c.vx = c.vy = c.vz = 0;
      const gems = this.gems.filter(g => g.got).length, total = this.gems.length;
      const time = Math.round(this.time * 10) / 10;
      const stars = 1 + (gems === total ? 1 : 0) + (time <= this.L.par ? 1 : 0);
      this.phase = 'won'; this.wonFor = 0;
      this.result = { time, gems, total, stars, par: this.L.par, by, ch: c.ch, last: this.stage === this.levels.length - 1 };
      this.ev('win', this.result);
      return;
    }
  }

  // ---------- wire format ----------
  snapshot() {
    const r = v => Math.round(v * 100) / 100;
    const players = [];
    const aim = {};
    for (const p of this.players.values()) {
      const gy = p.grounded ? p.y : this.ground(p.x, p.z, PSR, p.y + 0.05, p, true).y;
      players.push([p.id, r(p.x), r(p.y), r(p.z), r(p.rot),
        (p.hold ? 1 : 0) | (p.grounded ? 2 : 0) | (p.afk ? 4 : 0) | (p.qi <= 0 ? 8 : 0) | (this.nearFriend(p) ? 16 : 0), gy > -50 ? r(gy) : -99]);
      if (p.hold && this.phase === 'play') { const a = this.aim(p); aim[p.id] = [r(a[0]), r(a[1]), r(a[2]), a[3]]; }
    }
    const snap = {
      type: 's', st: this.stage, ph: this.phase, t: Math.round(this.time * 10) / 10,
      p: players,
      // stones: id, character, state letter, x, y, z, holder, ground under it,
      // rel = [op, slot (1 first, 2 second), partner id] for a resting stone in a relation (else 0),
      // low = 1 in an arm hold (Phase 4). SPEC §6. The client draws placement ticks and variant forms from rel.
      k: this.stones.map(c => {
        let gy = c.state === 'loose' && !c.grounded ? this.ground(c.x, c.z, OR, c.y + 0.05, null, false).y : c.y;
        if (c.holder) gy = c.holder.y;
        return [c.id, c.ch, c.state[0], r(c.x), r(c.y), r(c.z), c.holder ? c.holder.id : null, gy > -50 ? r(gy) : -99, this.relOf(c), 0];
      }),
      dk: this.dusk > 0 ? r(this.dusk) : 0,
      cr: this.crates.map(k => [r(k.x), r(k.y), r(k.z)]),
      m: this.movers.filter(m => !m.dyn).map(m => r(m.top)),
      // bridges grown from 木: x, z, width, depth, top, character
      br: this.bridges.map(m => [m.x0, m.z0, m.x1 - m.x0, m.z1 - m.z0, r(m.top), m.ch]),
      pl: this.plates.map(p => p.on ? 1 : 0),
      g: this.gems.map(g => g.got ? 1 : 0),
      aim,
      // Conjure: the crew's shared ink pool (fractional drops) and its current cap
      ink: r(this.ink),
      inkMax: this.inkMax()
    };
    const b = this.boat;
    // the boat: centre of its deck, and whether it is sailing in, moored or sailing out
    if (b) snap.b = [r(b.x0 + b.w / 2), r(b.z0 + b.d / 2), b.st[0]];
    if (this.result) {
      snap.res = Object.assign({
        t: Math.round(this.wonFor * 10) / 10, on: this.aboard | 0, need: this.need | 0,
        go: this.sailIn == null ? null : Math.max(0, Math.ceil(this.sailIn))
      }, this.result);
    }
    return snap;
  }

  roster() {
    return [...this.players.values()].map(p => ({ id: p.id, name: p.name, ci: p.ci }));
  }
}

const STATIC = { kind: 's' };

module.exports = { Game, CONJURE, STONES, FORGE, PROFILE, forgeKnobs, relate, bestRelation, AX_R, AX_D, CONST: { OH, REGROW, G, SPEED, CARRY_SPEED, JUMP_V, KILL, PR, PH, CR, CH, HOLD_Y, WIN_HOLD, WIN_MIN, BOARD_WAIT, ARRIVE, LEAVE, QI_CD, ROW_MAX, BOOST_R } };
