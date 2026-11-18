// The judge, part 2: can a crew of two finish this stage, and in how many different ways?
//
// Two bots play the stage in the REAL simulation (sim.js). The search is over
// big moves ("take 火", "burn the hedge", "boost your friend over that gap"); each
// big move is carried out tick by tick with stick and button input, exactly what a
// phone sends. A stage passes only if a recorded input log wins it, so a pass can
// never be wrong. A fail can be: the bots do not know every trick (see README).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Game, AX_R, AX_D } = require('../../sim.js');
const LV = require('../../levels.js');

export const DT = 1 / 60;
const IDS = ['a', 'b'];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// The mechanics that tell one route from another.
export const MECHANICS = ['bridge', 'burn', 'douse', 'boost', 'leap', 'plate', 'row', 'ground', 'body'];
// How a character was made: on the ground (a stone set beside or on top of another) or in hand (body forge).
export const FORGING = ['ground', 'body'];
const r2 = v => Math.round(v * 100) / 100;

// ---------- a game plus the log of everything done to it ----------
function cloneGame(g) {
  const { levels, L, grid } = g;
  g.levels = g.L = g.grid = null;           // shared, never changed, and grid holds a function
  const c = structuredClone(g);
  g.levels = levels; g.L = L; g.grid = grid;
  Object.setPrototypeOf(c, Game.prototype);
  c.levels = levels; c.L = L; c.grid = grid;
  return c;
}

export class Run {
  constructor(g) { this.g = g; this.log = []; this.seen = []; this.fell = new Set(); this.ticks = 0; this.last = {}; }
  static start(stage) {
    const g = new Game([stage]);
    for (const id of IDS) g.addPlayer(id, id);
    g.drainEvents();
    return new Run(g);
  }
  fork() { return new Run(cloneGame(this.g)); }
  input(id, x, z) {
    x = r2(x); z = r2(z);
    const k = x + ',' + z;
    if (this.last[id] === k) return;
    this.last[id] = k;
    this.g.setInput(id, x, z);
    this.log.push(['i', id, x, z]);
  }
  act(id, a) { this.g.act(id, a); this.log.push(['a', id, a]); }
  tick(n = 1) {
    for (let i = 0; i < n; i++) {
      this.g.step(DT);
      for (const e of this.g.drainEvents()) { this.seen.push(e); if (e.t === 'respawn') this.fell.add(e.id); }
    }
    this.ticks += n;
    const l = this.log[this.log.length - 1];
    if (l && l[0] === 't') l[1] += n; else this.log.push(['t', n]);
  }
  saw(t) { return this.seen.some(e => e.t === t); }
  p(id) { return this.g.players.get(id); }
}

// Plays a recorded log on a fresh game. True if the pavilion got its character.
export function replay(stage, log) {
  const g = new Game([stage]);
  for (const id of IDS) g.addPlayer(id, id);
  for (const l of log) {
    if (l[0] === 'i') g.setInput(l[1], l[2], l[3]);
    else if (l[0] === 'a') g.act(l[1], l[2]);
    else for (let i = 0; i < l[1]; i++) { g.step(DT); if (g.phase === 'won') return true; }
  }
  return g.phase === 'won';
}

// ---------- where a wobbler can go right now ----------
const key = (x, z) => x + ',' + z;
export const cellOf = o => [Math.floor(o.x), Math.floor(o.z)];

// What the bots can do, measured in the real sim once (see calibrate()).
export const CAL = { jumpGap: 1, jumpGapCarry: 1, leapGap: 2, leapUp: 1, boostLand: 4, ready: false };

class Nav {
  constructor(g, ban) { this.g = g; this.ban = ban || {}; this.cache = new Map(); }
  // the surface in a cell: { h } to stand on, { wall: true } for live thorns or flames, or null for water
  node(cx, cz) {
    const k = key(cx, cz);
    if (this.cache.has(k)) return this.cache.get(k);
    const g = this.g, c = g.grid.at(cx, cz);
    let n = c ? { h: c.ramp ? LV.cellTop(c, cx, cz, cx + 0.5, cz + 0.5) : c.h, c, x: cx, z: cz } : null;
    for (const m of g.movers) {
      if (!(cx + 0.5 > m.x0 && cx + 0.5 < m.x1 && cz + 0.5 > m.z0 && cz + 0.5 < m.z1)) continue;
      if (m.wall && !m.done) { n = { wall: true, x: cx, z: cz }; break; }
      if (!n || m.top > n.h) n = { h: m.top, m, x: cx, z: cz };
    }
    this.cache.set(k, n);
    return n;
  }
  stand(cx, cz) { const n = this.node(cx, cz); return n && !n.wall ? n : null; }
  edgeH(n, dx, dz) { return n.c && n.c.ramp ? LV.cellTop(n.c, n.x, n.z, n.x + 0.5 + dx * 0.5, n.z + 0.5 + dz * 0.5) : n.h; }
  flatGrid(n) { return n && n.c && !n.c.ramp && n.h === n.c.h; }

  edges(a, carry) {
    const out = [];
    for (const [dx, dz] of DIRS) {
      const ha = this.edgeH(a, dx, dz);
      const b = this.node(a.x + dx, a.z + dz);
      if (b && b.wall) continue;
      if (b) {
        const dh = this.edgeH(b, -dx, -dz) - ha;
        if (dh <= 0.4) out.push({ to: b, kind: 'walk', cost: 1 });
        else if (dh <= 1.05) out.push({ to: b, kind: 'step', cost: 1.6 });
        else if (!carry && !this.ban.leap && dh <= CAL.leapUp + 0.05) out.push({ to: b, kind: 'leapstep', cost: 4 });
        continue;
      }
      if (a.c && a.c.ramp) continue;
      const max = carry ? CAL.jumpGapCarry : Math.max(CAL.jumpGap, this.ban.leap ? 0 : CAL.leapGap);
      for (let k = 1; k <= max; k++) {
        const n = this.node(a.x + dx * (k + 1), a.z + dz * (k + 1));
        if (!n) continue;
        if (n.wall || this.edgeH(n, -dx, -dz) - ha > 0.05) break;
        const jump = k <= (carry ? CAL.jumpGapCarry : CAL.jumpGap);
        out.push({ to: n, kind: jump ? 'gap' : 'leapgap', cost: jump ? k + 1.5 : k + 5 });
        break;
      }
    }
    return out;
  }

  // cheapest way from a cell to every cell (Dijkstra; the maps are tiny)
  spread(from, carry) {
    const start = this.stand(from[0], from[1]);
    const dist = new Map(), prev = new Map();
    if (!start) return { dist, prev };
    dist.set(key(start.x, start.z), 0);
    const open = [start];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (dist.get(key(open[i].x, open[i].z)) < dist.get(key(open[bi].x, open[bi].z))) bi = i;
      const a = open.splice(bi, 1)[0], da = dist.get(key(a.x, a.z));
      for (const e of this.edges(a, carry)) {
        const k = key(e.to.x, e.to.z), d = da + e.cost;
        if (dist.has(k) && dist.get(k) <= d) continue;
        dist.set(k, d); prev.set(k, { from: a, kind: e.kind });
        open.push(e.to);
      }
    }
    return { dist, prev };
  }
  pathTo(sp, target) {
    const path = [];
    for (let k = key(target.x, target.z), n = target; sp.prev.has(k);) { const s = sp.prev.get(k); path.unshift({ from: s.from, to: n, kind: s.kind }); n = s.from; k = key(n.x, n.z); }
    return path;
  }
}

// ---------- carrying out one move with stick and button ----------
function goEdge(run, id, from, to, kind) {
  const p = run.p(id), tx = to.x + 0.5, tz = to.z + 0.5;
  const dx = Math.sign(to.x - from.x), dz = Math.sign(to.z - from.z);
  const leap = kind === 'leapgap' || kind === 'leapstep';
  if (leap) for (let i = 0; p.qi > 0 && i < 300; i++) { run.input(id, 0, 0); run.tick(); }
  const trig = kind === 'step' || kind === 'leapstep' ? 0.42 : 0.08;
  let jumped = -1, leapt = false;
  for (let i = 0; i < 420; i++) {
    const ex = tx - p.x, ez = tz - p.z, d = Math.hypot(ex, ez);
    if (run.fell.has(id)) return false;
    if (p.grounded && d < 0.12 && Math.abs(p.y - to.h) < 0.4) { run.input(id, 0, 0); return true; }
    const m = Math.max(0.35, Math.min(1, d / 0.35));
    run.input(id, ex / d * m, ez / d * m);
    if (kind !== 'walk') {
      const along = dx ? (dx > 0 ? from.x + 1 - p.x : p.x - from.x) : (dz > 0 ? from.z + 1 - p.z : p.z - from.z);
      if (jumped < 0 && p.grounded && along <= trig) { run.act(id, 'jump'); jumped = i; }
      else if (jumped >= 0 && leap && !leapt && !p.grounded && i - jumped > 3 && p.vy < 1.2) { run.act(id, 'jump'); leapt = true; }
      else if (jumped >= 0 && p.grounded && i - jumped > 25 && along > -0.2) { jumped = -1; leapt = false; }   // came back down on this side: again
    }
    run.tick();
  }
  run.input(id, 0, 0);
  return false;
}

// walk (jump, leap) to the cheapest of some cells; false if none can be reached
function walkTo(run, id, cells, ban) {
  const p = run.p(id), nav = new Nav(run.g, ban);
  const sp = nav.spread(cellOf(p), !!p.hold);
  let best = null, bd = Infinity;
  for (const c of cells) { const d = sp.dist.get(key(c[0], c[1])); if (d !== undefined && d < bd) { bd = d; best = c; } }
  if (!best) return false;
  const target = nav.stand(best[0], best[1]);
  const here = nav.stand(...cellOf(p));
  for (const e of [{ from: here, to: here, kind: 'walk' }, ...nav.pathTo(sp, target)].slice(bd === 0 ? 0 : 1)) if (!goEdge(run, id, e.from, e.to, e.kind)) return false;
  return true;
}

// Screen directions (r along R, q along D) of the four standing spots around a stone.
const PLACE = { left: [-1, 0], right: [1, 0], front: [0, 1], behind: [0, -1] };

// Fine steering onto an exact point inside the current cell (walkTo stops at cell centres).
function steer(run, id, x, z) {
  for (let i = 0; i < 120; i++) {
    const p = run.p(id), dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.06) { run.input(id, 0, 0); run.tick(4); return true; }
    const m = Math.max(0.3, Math.min(1, d / 0.35));
    run.input(id, dx / d * m, dz / d * m);
    run.tick();
  }
  run.input(id, 0, 0);
  return false;
}

// Jump onto a friend's head and stay there (they keep still).
function climb(run, top, bot) {
  run.act(top, 'jump');
  for (let n = 0; n < 70; n++) {
    const t = run.p(top), b = run.p(bot), dx = b.x - t.x, dz = b.z - t.z, d = Math.hypot(dx, dz);
    if (t.grounded && t.support === b) break;
    run.input(top, d > 0.04 ? dx / d * Math.min(1, d / 0.3) : 0, d > 0.04 ? dz / d * Math.min(1, d / 0.3) : 0);
    run.tick();
  }
  run.input(top, 0, 0); run.tick(6);
  return run.p(top).support === run.p(bot);
}
// In a formation, press GRAB; success is the wanted character in the presser's hands.
function bodyPress(run, presser, made) {
  const l = run.g.launch(run.p(presser));
  if (l.mode !== 'forge') return false;
  run.act(presser, 'grab'); run.tick(3);
  const h = run.p(presser).hold;
  return !!(h && h.ch === made);
}

function face(run, id, dx, dz) {
  const l = Math.hypot(dx, dz) || 1;
  run.input(id, dx / l * 0.2, dz / l * 0.2); run.tick(1);
  run.input(id, 0, 0); run.tick(8);
}

function settle(run) {
  const g = run.g;
  for (const id of IDS) run.input(id, 0, 0);
  let calm = 0;
  for (let i = 0; i < 360 && calm < 8; i++) {
    const tops = g.movers.map(m => m.top + m.x0 * 7 + m.z0 * 13);
    run.tick();
    let busy = g.movers.some((m, k) => m.top + m.x0 * 7 + m.z0 * 13 !== tops[k]);
    for (const p of g.players.values()) if (!p.grounded) busy = true;
    for (const k of g.stones) if (k.state === 'loose' && !k.grounded) busy = true;
    calm = busy ? 0 : calm + 1;
  }
}

// ---------- the big moves ----------
const near = (nav, x, z, lo, hi, y, dy) => {
  const out = [];
  for (let cz = Math.floor(z) - 2; cz <= Math.floor(z) + 2; cz++) for (let cx = Math.floor(x) - 2; cx <= Math.floor(x) + 2; cx++) {
    const n = nav.stand(cx, cz), d = Math.hypot(cx + 0.5 - x, cz + 0.5 - z);
    if (n && d >= lo && d <= hi && Math.abs(n.h - y) <= dy) out.push([cx, cz]);
  }
  return out;
};
const reachable = (sp, cells) => cells.some(c => sp.dist.has(key(c[0], c[1])));
const stoneBy = (g, id) => g.stones.find(k => k.id === id);

function ingredients(want) {
  const need = new Set([want]);
  for (let grew = true; grew;) {
    grew = false;
    for (const r of LV.RECIPE_LIST) if (need.has(r[3])) for (const c of (r[0] === '⿱⿰' ? [r[1], ...r[2]] : [r[1], r[2]])) if (!need.has(c)) { need.add(c); grew = true; }
  }
  return need;
}

// every gap a wood stone could bridge from where a wobbler can stand: [standCell, dir, runKey]
function bridgeSites(g, nav, span) {
  const out = [];
  for (let z = 0; z < g.grid.d; z++) for (let x = 0; x < g.grid.w; x++) {
    const a = nav.stand(x, z);
    if (!nav.flatGrid(a)) continue;
    for (const [dx, dz] of DIRS) {
      let k = 0;
      while (k <= span && g.isVoid(x + dx * (k + 1), z + dz * (k + 1))) k++;
      if (k < 1 || k > span) continue;
      const b = g.grid.at(x + dx * (k + 1), z + dz * (k + 1));
      if (!b || b.ramp) continue;
      const x0 = Math.min(x + dx, x + dx * k), z0 = Math.min(z + dz, z + dz * k);
      out.push({ cell: [x, z], dir: [dx, dz], run: x0 + ',' + z0 + ',' + (dx ? 'x' : 'z') + k });
    }
  }
  return out;
}

// every gap a friend could be thrown over: stand cell, the cell behind it, direction, where they come down
function boostSites(g, nav, carry) {
  const out = [], L = Math.floor(CAL.boostLand);
  const solo = carry ? CAL.jumpGapCarry : Math.max(CAL.jumpGap, nav.ban.leap ? 0 : CAL.leapGap);
  for (let z = -1; z <= g.grid.d; z++) for (let x = -1; x <= g.grid.w; x++) {
    const e = nav.stand(x, z);
    if (!e || (e.c && e.c.ramp)) continue;
    for (const [dx, dz] of DIRS) {
      const back = nav.stand(x - dx, z - dz);
      if (!back || Math.abs(back.h - e.h) > 0.3) continue;
      let gap = 0, wall = false;
      for (let k = 1; k < L; k++) { const n = nav.node(x + dx * k, z + dz * k); if (!n) gap++; else if (n.wall || n.h > e.h + 0.3) wall = true; }
      const land = nav.stand(x + dx * L, z + dz * L);
      if (wall || gap <= solo || !land || land.h > e.h + 0.3 || land.h < e.h - 1.5) continue;
      out.push({ cell: [x, z], back: [x - dx, z - dz], dir: [dx, dz], land: [land.x, land.z], run: (dx ? 'x' : 'z') + (dx ? x * dx : z * dz) });
    }
  }
  return out;
}

// ---------- rowing ----------
// Where could the boat be pushed to and bumped against land? One berth for each
// different set of shores it would join, each with the straight pushes that get it there.
function berths(g, reg) {
  const b = g.boat, e = 0.02;
  const solid = (x0, z0, px, pz) => {
    for (let cz = Math.floor(z0 - pz + e); cz <= Math.floor(z0 + b.d + pz - e); cz++)
      for (let cx = Math.floor(x0 - px + e); cx <= Math.floor(x0 + b.w + px - e); cx++) if (g.grid.at(cx, cz)) return true;
    for (const m of g.movers) if (m !== b && x0 + b.w + px - e > m.x0 && x0 - px + e < m.x1 && z0 + b.d + pz - e > m.z0 && z0 - pz + e < m.z1) return true;
    return false;
  };
  // a push needs elbow room at the sides: nobody rows to the hundredth of a cell
  const free = (x, z, dx) => g.boatFits(x, z) && !solid(x, z, dx ? 0 : 0.3, dx ? 0.3 : 0);
  const start = [Math.round(b.x0), Math.round(b.z0)];
  const seen = new Map([[key(...start), { at: start, path: [] }]]);
  const open = [seen.get(key(...start))];
  const out = new Map();
  while (open.length) {
    const n = open.shift();
    for (const [dx, dz] of DIRS) {
      let x = n.at[0], z = n.at[1], len = 0;
      while (free(x + dx, z + dz, dx)) {
        x += dx; z += dz; len++;
        if (!seen.has(key(x, z))) { const q = { at: [x, z], path: [...n.path, { dir: [dx, dz], len }] }; seen.set(key(x, z), q); open.push(q); }
      }
      // pushed this way until it bumps: is that land, and which shores does the deck then touch?
      if (!len || !solid(x + dx, z + dz, 0, 0)) continue;
      const touch = new Set();
      for (let cz = z - 1; cz <= z + b.d; cz++) for (let cx = x - 1; cx <= x + b.w; cx++) {
        const inX = cx >= x && cx < x + b.w, inZ = cz >= z && cz < z + b.d;
        if (inX === inZ) continue;   // corners and the deck itself
        const c = g.grid.at(cx, cz);
        if (c && !c.ramp && c.h <= b.top + 1.05 && c.h >= b.top - 2) touch.add(reg.get(key(cx, cz)));
      }
      const sig = [...touch].sort().join(' ');
      const path = [...n.path.slice(0, n.path.length && n.path[n.path.length - 1].dir[0] === dx && n.path[n.path.length - 1].dir[1] === dz ? -1 : undefined), { dir: [dx, dz], len: 99, bump: true }];
      const cost = n.path.length;
      if (sig && (!out.has(sig) || out.get(sig).cost > cost)) out.set(sig, { at: [x, z], path, cost });
    }
  }
  return [...out.values()].filter(q => Math.abs(q.at[0] - b.x0) + Math.abs(q.at[1] - b.z0) > 0.5);
}

function rowTo(run, id, berth) {
  const g = run.g, b = g.boat, DRAG = 2;
  for (const s of berth.path) {
    const [dx, dz] = s.dir, sign = dx || dz;
    const pos = () => dx ? b.x0 : b.z0, vel = () => (dx ? b.vx : b.vz) * sign;
    const target = s.bump ? null : Math.round(pos()) + s.len * sign;
    let still = 0, moved = false;
    for (let i = 0; i < 1500; i++) {
      if (run.p(id).support !== b && run.p(id).grounded && !s.bump) return false;   // walked off the deck
      const before = pos();
      if (s.bump) run.input(id, dx, dz);
      else {
        const rem = (target - pos()) * sign;
        if (rem > Math.max(0.06, vel() / DRAG)) run.input(id, dx, dz);
        else if (rem < -0.15 && vel() > -0.1) run.input(id, -dx, -dz);
        else run.input(id, 0, 0);
        if (Math.abs(rem) < 0.15 && Math.abs(vel()) < 0.05) break;
      }
      run.tick();
      if (Math.abs(pos() - before) > 1e-4) { moved = true; still = 0; } else still++;
      if (s.bump && moved && still > 12) break;
      if (still > 240) return false;
    }
    run.input(id, 0, 0);
    run.tick(6);
  }
  return Math.abs(b.x0 - berth.at[0]) < 0.35 && Math.abs(b.z0 - berth.at[1]) < 0.35;
}

function options(run, ban) {
  const g = run.g, out = [], nav = new Nav(g, ban);
  const bots = IDS.map(id => g.players.get(id));
  const sp = bots.map(p => nav.spread(cellOf(p), !!p.hold));
  const need = ingredients(g.L.want);
  const walls = g.movers.filter(m => m.wall && !m.done);
  const loose = g.stones.filter(k => k.state === 'loose' && k.grounded);
  const add = (name, fn) => out.push({ name, fn });

  bots.forEach((p, i) => {
    const id = p.id, o = bots[1 - i];
    if (!p.hold) {
      for (const k of loose) {
        const el = k.g.el;
        const useful = need.has(k.ch) || (el === 'wood' && !ban.bridge) || walls.some(m => (m.wall === 'thorn' ? 'fire' : 'water') === el && !ban[m.wall === 'thorn' ? 'burn' : 'douse']);
        if (!useful) continue;
        const cells = near(nav, k.x, k.z, 0, 0.95, k.y, 1.0);
        if (!reachable(sp[i], cells)) continue;
        const sid = k.id;
        add(`${id} takes ${k.ch}`, r => { if (!walkTo(r, id, cells, ban)) return false; r.act(id, 'grab'); r.tick(3); return !!r.p(id).hold && r.p(id).hold.id === sid; });
      }
    } else {
      const h = p.hold, el = h.g.el;
      if (h.ch === g.L.want) {
        const cell = [Math.floor(g.beacon.x), Math.floor(g.beacon.z)];
        if (reachable(sp[i], [cell])) add(`${id} carries ${h.ch} to the pavilion`, r => { walkTo(r, id, [cell], ban); r.tick(5); return r.g.phase === 'won'; });
      }
      for (const k of ban.ground ? [] : loose) {
        // Every arrangement of h and k that makes something this stage needs, and where to stand for it
        // (DESIGN §4.3): screen-left of k sets h beside it as first, screen-right as second, in front or
        // behind sets h on top. A recipe with h at the bottom is found from the other stone's side.
        for (const rec of LV.mirrors(h.ch, k.ch)) {
          const made = rec[3];
          if (!need.has(made) || rec[0] === '⿱⿰') continue;
          const how = rec[0] === '⿰' ? [rec[1] === h.ch ? 'left' : null, rec[2] === h.ch ? 'right' : null]
                    : rec[0] === '⿱' && rec[1] === h.ch ? ['front', 'behind'] : [];
          for (const side of how.filter(Boolean)) {
            const [ur, uq] = PLACE[side], spot = [k.x + 0.95 * (ur * AX_R[0] + uq * AX_D[0]), k.z + 0.95 * (ur * AX_R[1] + uq * AX_D[1])];
            const cell = [Math.floor(spot[0]), Math.floor(spot[1])], n = nav.stand(...cell);
            if (!n || Math.abs(n.h - k.y) > 0.5 || !reachable(sp[i], [cell])) continue;
            const sid = k.id, mode = side === 'left' || side === 'right' ? 'join' : 'stack';
            const verb = mode === 'join' ? `sets ${h.ch} ${side} of ${k.ch}` : `sets ${h.ch} on top of ${k.ch}`;
            add(`${id} ${verb}, making ${made}`, r => {
              if (!walkTo(r, id, [cell], ban) || !steer(r, id, spot[0], spot[1])) return false;
              const t = stoneBy(r.g, sid), q = r.p(id);
              if (!t || t.state !== 'loose') return false;
              face(r, id, t.x - q.x, t.z - q.z);
              const l = r.g.launch(r.p(id));
              if (l.mode !== mode || l.on !== sid) return false;
              r.act(id, 'grab');
              for (let n = 0; n < 120 && !r.saw('fuse'); n++) r.tick();
              return r.seen.some(e => e.t === 'fuse' && e.ch === made);
            });
            break;   // one standing spot per arrangement is enough
          }
        }
      }
      for (const m of walls) {
        const mech = m.wall === 'thorn' ? 'burn' : 'douse';
        if (ban[mech] || el !== (m.wall === 'thorn' ? 'fire' : 'water')) continue;
        const cells = [];
        for (let cz = Math.floor(m.z0) - 3; cz <= m.z1 + 3; cz++) for (let cx = Math.floor(m.x0) - 3; cx <= m.x1 + 3; cx++) {
          const n = nav.stand(cx, cz);
          if (!n) continue;
          const ddx = cx + 0.5 - Math.max(m.x0, Math.min(m.x1, cx + 0.5)), ddz = cz + 0.5 - Math.max(m.z0, Math.min(m.z1, cz + 0.5));
          if (Math.hypot(ddx, ddz) < h.g.reach - 0.2 && Math.abs(n.h - m.to) < 2.3) cells.push([cx, cz]);
        }
        if (!reachable(sp[i], cells)) continue;
        add(`${id} brings ${h.ch} to the ${m.wall === 'thorn' ? 'thorns' : 'flames'} (${m.id})`, r => { walkTo(r, id, cells, ban); r.tick(10); return r.saw(mech); });
      }
      if (el === 'wood' && !ban.bridge) {
        const done = new Set();
        const sites = bridgeSites(g, nav, h.g.span).filter(s => sp[i].dist.has(key(...s.cell))).sort((a, b) => sp[i].dist.get(key(...a.cell)) - sp[i].dist.get(key(...b.cell)));
        for (const s of sites) {
          if (done.has(s.run)) continue;
          done.add(s.run);
          add(`${id} throws ${h.ch} into the gap at ${s.cell} to grow a bridge`, r => {
            if (!walkTo(r, id, [s.cell], ban)) return false;
            face(r, id, s.dir[0], s.dir[1]);
            r.act(id, 'grab');
            for (let n = 0; n < 90 && !r.saw('bridge'); n++) r.tick();
            return r.saw('bridge');
          });
        }
      }
      // Body forge (F4.2): both bots hold, take the formation, and this bot presses GRAB.
      // ⿰: this bot stands screen-left (first) or screen-right (second) of the friend; ⿱: this bot
      // (first) climbs onto the friend's head. The friend stays put; either bot may be the presser.
      if (o.hold && !ban.body) {
        for (const rec of LV.mirrors(h.ch, o.hold.ch)) {
          if (!need.has(rec[3]) || rec[0] === '⿱⿰') continue;
          for (const presser of [id, o.id]) {
            if (rec[0] === '⿰') {
              const side = rec[1] === h.ch ? -1 : 1;
              const spot = [o.x + side * g.fz.ideal * AX_R[0], o.z + side * g.fz.ideal * AX_R[1]];
              const cell = [Math.floor(spot[0]), Math.floor(spot[1])], n = nav.stand(...cell);
              if (!n || Math.abs(n.h - o.y) > 0.3 || !reachable(sp[i], [cell])) continue;
              add(`${id} stands ${side < 0 ? 'left' : 'right'} of ${o.id} and ${presser} forges ${rec[3]} in hand`, r => {
                if (!walkTo(r, id, [cell], ban) || !steer(r, id, spot[0], spot[1])) return false;
                return bodyPress(r, presser, rec[3]);
              });
            } else if (rec[0] === '⿱' && rec[1] === h.ch) {
              const oc = cellOf(o), on = nav.stand(...oc);
              const cells = DIRS.map(([dx, dz]) => [oc[0] + dx, oc[1] + dz]).filter(c => { const n = nav.stand(...c); return n && on && Math.abs(n.h - on.h) < 0.3; });
              if (!reachable(sp[i], cells)) continue;
              add(`${id} climbs onto ${o.id} and ${presser} forges ${rec[3]} in hand`, r => {
                if (!walkTo(r, id, cells, ban) || !climb(r, id, o.id)) return false;
                return bodyPress(r, presser, rec[3]);
              });
            }
          }
        }
      }
      add(`${id} puts ${h.ch} down`, r => { r.act(id, 'grab'); r.tick(3); return !r.p(id).hold; });
    }

    // throw the friend over a gap (they may be carrying)
    if (!ban.boost && !p.hold) {
      const done = new Set();
      for (const s of boostSites(g, nav, !!o.hold)) {
        if (done.has(s.run) || !sp[i].dist.has(key(...s.back)) || !sp[1 - i].dist.has(key(...s.cell))) continue;
        if (loose.some(k => Math.hypot(k.x - (s.back[0] + 0.5), k.z - (s.back[1] + 0.5)) < 1.35)) continue;   // the button would pick the stone up instead
        done.add(s.run);
        add(`${id} boosts ${o.id} over the gap from ${s.cell}`, r => {
          if (!walkTo(r, o.id, [s.cell], ban) || !walkTo(r, id, [s.back], ban)) return false;
          face(r, o.id, s.dir[0], s.dir[1]);
          face(r, id, s.dir[0], s.dir[1]);
          r.fell.clear();
          r.act(id, 'grab');
          r.tick(4);
          if (!r.saw('boost')) return false;
          const q = r.p(o.id);
          for (let n = 0; n < 150 && !q.grounded; n++) r.tick();
          const far = (q.x - (s.cell[0] + 0.5)) * s.dir[0] + (q.z - (s.cell[1] + 0.5)) * s.dir[1];
          return q.grounded && !r.fell.has(o.id) && far > 1.5;
        });
      }
    }

    if (!ban.plate) {
      for (const pl of g.plates) {
        if (pl.on || !sp[i].dist.has(key(pl.x, pl.z))) continue;
        // worth holding when the friend is on its lift, or when it lowers something out of the way
        if (!g.movers.some(m => m.when.includes(pl.id) && (o.support === m || m.to < m.from))) continue;
        add(`${id} stands on plate ${pl.id}`, r => walkTo(r, id, [[pl.x, pl.z]], ban));
      }
      for (const m of g.movers) {
        if (!m.when.length || p.support === m || m.a !== 0) continue;
        const cells = [];
        for (let cz = m.z0; cz < m.z1; cz++) for (let cx = m.x0; cx < m.x1; cx++) cells.push([cx, cz]);
        if (reachable(sp[i], cells)) add(`${id} steps onto lift ${m.id}`, r => walkTo(r, id, cells, ban));
      }
    }
  });
  const bt = g.boat;
  if (bt && bt.st === 'moored' && !ban.row) {
    const crew = bots.filter(p => p.grounded && p.support === bt);
    const deck = [];
    for (let cz = Math.floor(bt.z0); cz <= Math.floor(bt.z1); cz++) for (let cx = Math.floor(bt.x0); cx <= Math.floor(bt.x1); cx++) if (nav.stand(cx, cz) && nav.stand(cx, cz).m === bt) deck.push([cx, cz]);
    bots.forEach((p, i) => { if (p.support !== bt && reachable(sp[i], deck)) add(`${p.id} boards the boat`, r => walkTo(r, p.id, deck, ban) && r.p(p.id).support === r.g.boat); });
    if (crew.length) for (const q of berths(g, regions(g))) add(`${crew[0].id} rows the boat to ${q.at}`, r => rowTo(r, crew[0].id, q));
  }
  // only stages that regrow (sim.js STONES / stage "regrow": true) get stones back by waiting
  if (g.regrow && g.springs.some(s => !s.stone)) add('they wait for a stone to grow back', r => { for (let n = 0; n < 420 && r.g.springs.some(s => !s.stone); n++) r.tick(); return true; });
  return out;
}

// Two cells are the same place when a carrier can walk or hop between them both ways.
function regions(g) {
  const nav = new Nav(g, {}), label = new Map();
  for (let z = -6; z < g.grid.d + 6; z++) for (let x = -6; x < g.grid.w + 6; x++) {
    const a = nav.stand(x, z);
    if (!a || label.has(key(x, z))) continue;
    const open = [a];
    label.set(key(x, z), key(x, z));
    while (open.length) {
      const n = open.pop();
      for (const e of nav.edges(n, true)) {
        const k = key(e.to.x, e.to.z);
        if (label.has(k) || e.kind === 'gap' || !nav.edges(e.to, true).some(b => b.to === n && b.kind !== 'gap')) continue;
        label.set(k, key(x, z));
        open.push(e.to);
      }
    }
  }
  return label;
}

function stateKey(g) {
  const reg = regions(g);
  const bots = [...g.players.values()].map(p => (reg.get(key(...cellOf(p))) || cellOf(p).join('.')) + (p.hold ? p.hold.ch : '') + (p.support && p.support.when && p.support.when.length ? '^' : '') + (p.support && p.support.boat ? '~' : '') + (g.plates.some(pl => pl.on && Math.abs(p.x - pl.x - 0.5) < 0.62 && Math.abs(p.z - pl.z - 0.5) < 0.62) ? '_' : '')).sort();
  const stones = g.stones.filter(k => k.state === 'loose').map(k => k.ch + (reg.get(key(...cellOf(k))) || cellOf(k).join('.'))).sort();
  return [bots, stones, g.movers.map(m => Math.round(m.top * 2) + (m.boat ? '@' + Math.round(m.x0) + '.' + Math.round(m.z0) : '')), g.springs.filter(s => !s.stone).length].join('|');
}

// Breadth-first over big moves. Returns { steps, log, used, seconds } or null.
export function search(stage, ban = {}, budget = {}) {
  const t = Date.now(), s = search1(stage, ban, budget);
  if (process.env.JUDGE_TIME) console.error(`search ban=[${Object.keys(ban)}] ${s ? (s.gaveUp ? 'gave up' : 'solved in ' + s.steps.length + ' moves') : 'no way'} nodes=${s ? s.nodes : '?'} ${Date.now() - t}ms`);
  return s;
}
function search1(stage, ban, budget) {
  const maxNodes = budget.nodes || 5000, maxMs = budget.ms || 20000, t0 = Date.now();
  const root = { run: Run.start(stage), parent: null, name: null };
  settle(root.run);
  const seen = new Set([stateKey(root.run.g)]);
  let frontier = [root], nodes = 0;
  const finish = n => {
    const steps = [], log = [], used = new Set();
    for (let q = n; q; q = q.parent) {
      if (q.name) steps.unshift(q.name);
      log.unshift(...q.run.log);
      for (const e of q.run.seen) if (MECHANICS.includes(e.t) && e.t !== 'plate') used.add(e.t);
      if (q.name && /stands on plate/.test(q.name)) used.add('plate');
      for (const e of q.run.seen) if (e.t === 'forge') used.add(e.held ? 'body' : 'ground');
    }
    // merge neighbouring tick entries left by the joins between moves
    const flat = [];
    for (const l of log) { const p = flat[flat.length - 1]; if (l[0] === 't' && p && p[0] === 't') p[1] += l[1]; else flat.push(l.slice()); }
    const ticks = flat.reduce((s, l) => s + (l[0] === 't' ? l[1] : 0), 0);
    return { steps, log: flat, used: [...used].sort(), seconds: Math.round(ticks * DT), nodes };
  };
  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      for (const opt of options(node.run, ban)) {
        if (++nodes > maxNodes || Date.now() - t0 > maxMs) return { gaveUp: true, nodes };
        const run = node.run.fork();
        let ok = false;
        try { ok = opt.fn(run); } catch (e) { ok = false; }
        if (process.env.JUDGE_TRACE) console.log((ok ? '  ok  ' : '  FAIL ') + opt.name + '  [' + [...new Set(run.seen.map(e => e.t))].join(' ') + ']');
        if (!ok) continue;
        if (run.g.phase !== 'won') settle(run);
        if (run.seen.some(e => (ban[e.t] && e.t !== 'plate') || (e.t === 'forge' && ban[e.held ? 'body' : 'ground']))) continue;   // a banned mechanic that happened by accident still counts
        const child = { run, parent: node, name: opt.name };
        if (run.g.phase === 'won') return finish(child);
        const k = stateKey(run.g);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push(child);
      }
      node.run.g = node.parent ? null : node.run.g;   // free the world; the log stays
    }
    frontier = next;
  }
  return null;
}

// ---------- measuring what the bots can do ----------
const strip = (map, extra) => Object.assign({ id: 'cal', want: '木', map, spawn: [1.5, 1.5], beacon: [0.5, 0.5], stones: [['木', 1.5, 0.5]] }, extra);
export function calibrate() {
  if (CAL.ready) return CAL;
  const land = 5, row = k => '1'.repeat(land) + '.'.repeat(k) + '1'.repeat(7);
  const tryGap = (k, kind, carry) => {
    const run = Run.start(strip([row(k), row(k), row(k)]));
    const nav = new Nav(run.g, {});
    if (carry) { run.input('a', 0, 0); if (!walkTo(run, 'a', [[1, 0]], {})) return false; run.act('a', 'grab'); run.tick(3); if (!run.p('a').hold) return false; }
    if (!walkTo(run, 'a', [[land - 1, 1]], {})) return false;
    return goEdge(run, 'a', nav.stand(land - 1, 1), nav.stand(land + k, 1), kind);
  };
  const most = (kind, carry) => { let best = 0; for (let k = 1; k <= 6; k++) if (tryGap(k, kind, carry)) best = k; else break; return best; };
  CAL.jumpGap = most('gap', false);
  CAL.jumpGapCarry = most('gap', true);
  CAL.leapGap = Math.max(CAL.jumpGap, most('leapgap', false));
  CAL.leapUp = 1;
  for (const up of [2, 3]) {
    const r = '1'.repeat(land) + String(1 + up).repeat(4), run = Run.start(strip([r, r, r]));
    const nav = new Nav(run.g, {});
    if (walkTo(run, 'a', [[land - 1, 1]], {}) && goEdge(run, 'a', nav.stand(land - 1, 1), nav.stand(land, 1), 'leapstep')) CAL.leapUp = up; else break;
  }
  {
    const r = '1'.repeat(16), run = Run.start(strip([r, r, r], { spawn: [3.5, 1.5], stones: [['木', 0.5, 0.5]] }));
    walkTo(run, 'b', [[4, 1]], {}); walkTo(run, 'a', [[3, 1]], {});
    face(run, 'b', 1, 0); face(run, 'a', 1, 0);
    run.act('a', 'grab'); run.tick(4);
    const q = run.p('b');
    for (let n = 0; n < 150 && !q.grounded; n++) run.tick();
    CAL.boostLand = q.x - 4.5;
  }
  CAL.ready = true;
  return CAL;
}

// ---------- the verdict ----------
// A route is a set of mechanics that is enough to win and has nothing spare in it.
// Two routes are different when the second one wins without a mechanic the first one needs.
export function routes(stage, budget = {}) {
  calibrate();
  const enough = budget.all ? Infinity : 2;
  // rowing opens a much bigger search, so look without it first
  const solve = ban => {
    for (const b of ban.row ? [ban] : [Object.assign({ row: true }, ban), ban]) { const s = search(stage, b, budget); if (s && !s.gaveUp) return s; }
    return null;
  };
  // strip a solution down to the mechanics it cannot do without
  const lean = (sol, base) => {
    for (const m of sol.used.slice()) {
      if (!sol.used.includes(m)) continue;
      const ban = Object.assign({}, base);
      for (const x of MECHANICS) if (x === m || !sol.used.includes(x)) ban[x] = true;
      const s = solve(ban);
      if (s) sol = s;
    }
    return sol;
  };
  const any = solve({});
  if (!any) return { solved: false, routes: [] };
  const first = lean(any, {});
  const out = [{ needs: first.used, steps: first.steps, seconds: first.seconds, log: first.log }];
  // is there a way round each thing it needs?
  for (const m of first.used) {
    if (out.length >= enough) break;
    if (FORGING.includes(m)) continue;   // forging in hand instead of on the ground is not a way round an obstacle
    let s = solve({ [m]: true });
    if (!s) continue;
    s = lean(s, { [m]: true });
    if (out.some(r => r.needs.join() === s.used.join())) continue;
    out.push({ needs: s.used, steps: s.steps, seconds: s.seconds, log: s.log, avoids: m });
  }
  // A body-forge route (F4.4), reported for information: it never counts as the second way.
  if (!out.some(r => r.needs.includes('body')) && !budget.noBody) {
    const s = solve({ ground: true });
    if (s) out.push({ needs: s.used, steps: s.steps, seconds: s.seconds, log: s.log, avoids: 'ground', extra: true });
  }
  return { solved: true, routes: out };
}
