// A test player's mind that recovers (session 3 of docs/AUTOTEST.md). No script: it reads the isle (the
// wanted character, its recipe, the stones, walls and gaps) and decides again every 0.2 s from wherever it
// is, so a late press or a missed jump is something it fixes, not a failure. It acts only through what a
// person could press (stick x, JUMP held, JUMP and GRAB taps), so it can drive the motor channel
// (human.mjs) the same way as the scripted routes.
//
// Three layers, each a little dumber than a person in a different way:
//   1. plan   (stateless, every decision): what to do next, from the recipe tree. Deliver the wanted
//             character if it exists; else make it: take one piece and set it in place against the other
//             (beside on the right side, or stand on the lower piece and GRAB ON TOP). If where it must go
//             can't be reached, find the wall or gap that is in the way (by asking "reachable if this
//             were gone?") and fetch the stone that clears it: fire, water, light for walls; wood or earth
//             for gaps, or makes one). A stone in hand that is no use now is set down out of the way. Last
//             resorts: send a stranded stone home by the river, move a stone that boxes another in.
//   2. map    a navigation graph of the places a body can stand (rock tops, stone tops). Its edges are
//             found by playing short moves on copies of the world (walk, jump with or without 轻功 leaps,
//             ride the clouds), so it knows what the physics allows, not what a level designer meant.
//             Edges are cached by the layout near them, so a stone moved far away doesn't redo them.
//   3. act    every 0.2 s (and on landing) it tries each move from the real current state on a world
//             copy, to landing, and takes the one with the least (time + cost to go from where it
//             lands). Close to the goal it walks to the spot and presses GRAB when the button says the
//             right thing; for a forge it first checks on a copy that GRAB now makes the right character.
//
// Its hands: it allows for its persona's median latency (handsOf; a leap is lift-and-tap), never presses
// GRAB again while one is on its way, and never puts its thumb back on JUMP without meaning a tap. It sees
// the sim state (level L0 of the ladder), not pixels, and predicts the physics exactly: its imperfection
// comes from the motor channel, not from misjudging. That is the known gap (docs/AUTOTEST.md §5, S3).
// play() restarts the isle, as a stuck person would from the menu, and counts the restarts.
//
// Usage: play(w, 'me', { hw, hands: handsOf(PERSONAS.kid) })  ->  { won, time, restarts, log, ev }
//   or by hand: const m = mind(w, 'me', { hands }); each frame: const o = m.tick();
//   hw.setInput('me', o.x, o.jump); for (const k of o.press) hw.press('me', k); hw.step(1 / 60); w.drain();
//   w is the real World (read and copied); hw is what the presses go to (w itself, or humanize(w, ...)).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const SIM = require('../../sim.js');
const RU = require('../../rules.js');
const { STATIC } = SIM;
const { PW, PH, SW, SH } = SIM.consts;
export const DT = 1 / 60;

// ---------- world copies ----------
// Shared, never mutated by a step: the isle list, the knobs, the glyph table, the tile marker.
const SHARED = new WeakSet([STATIC, ...Object.values(RU.GLYPHS).filter((g) => g && typeof g === 'object')]);
const SHARE_KEYS = new Set(['isles', 'L', 'k', 'fz', 'qi', 'as', 'wantTree']);
function deep(o, seen) {
  if (o === null || typeof o !== 'object' || SHARED.has(o)) return o;
  if (seen.has(o)) return seen.get(o);
  let c;
  if (Array.isArray(o)) { c = new Array(o.length); seen.set(o, c); for (let i = 0; i < o.length; i++) c[i] = deep(o[i], seen); return c; }
  if (o instanceof Map) { c = new Map(); seen.set(o, c); for (const [k, v] of o) c.set(deep(k, seen), deep(v, seen)); return c; }
  if (o instanceof Set) { c = new Set(); seen.set(o, c); for (const v of o) c.add(deep(v, seen)); return c; }
  c = Object.create(Object.getPrototypeOf(o)); seen.set(o, c);
  for (const k of Object.keys(o)) c[k] = deep(o[k], seen);
  return c;
}
export function copyWorld(w) {
  const seen = new Map(), c = Object.create(Object.getPrototypeOf(w));
  for (const k of Object.keys(w)) c[k] = SHARE_KEYS.has(k) ? w[k] : k === 'events' ? [] : deep(w[k], seen);
  return c;
}

// ---------- moves (policies) ----------
// A move is a per-frame policy (p, w, f) -> { x, jump, press }. All of them only press buttons.
const chainLeft = (w, p) => p.chain < (p.hold ? w.qi.carry : w.qi.chain);
// next cloud above you not yet used in this chain (what a person aims for on a cloud stair)
const nextCloud = (w, p) => w.clouds.filter((c) => !p.src.has(c.id) && c.y > p.y + 0.3).sort((a, b) => a.y - b.y)[0];
export const MOVES = {
  // walk with the stick for about one column
  walk: (s) => { let x0 = null; return { name: 'walk' + s, walk: true, again: () => MOVES.walk(s), fn: (p, w, f) => { if (x0 === null) x0 = p.x; return { x: s, jump: false, end: f >= 40 || (p.grounded && Math.abs(p.x - x0) >= 0.95) }; } }; },
  // jump (held while rising) with the stick at s; leap whenever a charge is there and vy < thr;
  // `after`: stick for the rest of the flight once the clouds above are used up (cloud stairs).
  // `cut`: stick goes to 0 after this many frames (a jump that stops where it rises).
  // `ledge`: let go of the stick once there is higher ground under you than where you took off (climb a
  // wall and stop on top of it, as a person does, instead of flying over a narrow tower)
  jump: (s, thr, opt = {}) => {
    let air = 0, y0 = null, onLedge = false, leapF = -99;
    return { again: () => MOVES.jump(s, thr, opt), name: `jump${s}${thr === null ? '' : '/' + thr}${opt.cloud ? 'c' + opt.after : ''}${opt.cut ? '|' + opt.cut : ''}${opt.ledge ? '^' : ''}`, fn: (p, w, f) => {
      let x = s;
      if (y0 === null) y0 = opt.air ? Math.min(p.y, opt.y0 ?? p.y) : p.y;
      if (opt.cloud) { const c = nextCloud(w, p); x = c ? Math.max(-1, Math.min(1, (c.x - p.x) * 2)) : opt.after; }
      if (opt.cut && f >= opt.cut) x = 0;
      if (opt.ledge && !onLedge && w.groundTop(p.x, p.y + 0.01) > y0 + 0.5) onLedge = true;
      if (onLedge) x = 0;
      if (f === 0 && !opt.air) return { x, jump: true, press: 'jump' };
      if (!p.grounded) air++;
      const thr2 = opt.cloud ? 0.3 : thr;
      // leap (once: the press may still be on its way through the thumb)
      if (thr2 !== null && !p.grounded && air > 3 && p.qi > 0 && p.vy < thr2 && chainLeft(w, p) && f - leapF > 8) { leapF = f; return { x, jump: true, press: 'jump' }; }
      return { x, jump: p.vy > 0 };
    } };
  },
};
const THR = [null, 2.5, 0.5, -2];
export function groundMoves(w) {
  const out = [MOVES.walk(-1), MOVES.walk(1)];
  for (const s of [-1, 0, 1]) for (const t of THR) out.push(MOVES.jump(s, t));
  for (const s of [-1, 1]) for (const t of [null, 0.5]) out.push(MOVES.jump(s, t, { cut: 12 }));
  for (const s of [-1, 1]) for (const t of [2.5, 0.5, -2]) out.push(MOVES.jump(s, t, { ledge: true }));
  if (w.clouds.length) for (const a of [-1, 0, 1]) out.push(MOVES.jump(0, null, { cloud: true, after: a }));
  return out;
}
function airMoves(w, y0) {
  const out = [];
  for (const s of [-1, -0.4, 0, 0.4, 1]) for (const t of THR) out.push(MOVES.jump(s, t, { air: true }));
  for (const s of [-1, 1]) for (const t of [2.5, 0.5]) out.push(MOVES.jump(s, t, { air: true, ledge: true, y0 }));
  if (w.clouds.length) for (const a of [-1, 0, 1]) out.push(MOVES.jump(0, null, { cloud: true, after: a, air: true }));
  return out;
}

// Play a move on a copy of `base` until the body lands (or `maxF` frames). Returns where it ended.
// hands: the mind's own (median) latency in frames, which a person allows for without thinking: `d` for
// any change of stick or button, `leap` for a leap (lift the thumb and tap JUMP again). { d: 0, leap: 0 }
// is a perfect hand. The random part of a persona's timing is not known to the mind: it stays an error.
export function rollout(base, id, move, maxF = 150, hands = null) {
  const c = copyWorld(base), p = c.players.get(id);
  let f = 0, splash = false, ouch = 0, left = !p.grounded;
  const ev = [], q = [], lag = hands && (hands.d || hands.leap);
  let cx = p.in.x, cj = p.in.jump;
  for (; f < maxF; f++) {
    const o = move.fn(p, c, f);
    if (!lag) { c.setInput(id, o.x, o.jump); if (o.press) c.press(id, o.press); }
    else {
      const leap = o.press === 'jump' && !p.grounded;
      // a leap is lift-and-tap: the thumb comes off JUMP first (which cuts a jump still rising), then taps
      if (leap && cj) q.push({ at: f + hands.d, o: { x: o.x, jump: false } });
      q.push({ at: f + (leap ? hands.leap : hands.d), o });
      q.sort((a, b) => a.at - b.at);
      while (q.length && q[0].at <= f) { const e = q.shift().o; cx = e.x; cj = e.jump; if (e.press) c.press(id, e.press); }
      c.setInput(id, cx, cj);
    }
    c.step(DT);
    for (const e of c.drain()) {
      ev.push(e);
      if (e.t === 'splash' && e.id === id) splash = true;
      if (e.t === 'ouch' && e.id === id) ouch++;
    }
    if (splash) break;
    if (!p.grounded) left = true;
    if (move.walk ? (o.end && p.grounded) || (left && p.grounded && f > 2) : left && p.grounded && f >= 3) { f++; break; }
  }
  return { c, p, t: f * DT, splash, ouch, ev, landed: p.grounded };
}

// The latency a mind with these hands (a human.mjs persona, or null) allows for: the persona's median.
export const handsOf = (H) => H ? { d: Math.round(H.t * 60), leap: Math.ceil(Math.max(H.t, H.retap ?? 0.07) * 60 - 1e-9) } : null;

// ---------- the map ----------
const R_SIG = 8;            // columns either side that an edge's cache key looks at
const colSig = (w) => { const out = []; for (let x = 0; x < w.w; x++) { let s = ''; for (let y = 0; y < w.h; y++) s += w.cells[y][x]; out.push(s); } return out; };
const restStones = (w) => w.stones.filter((s) => s.state === 'loose' && s.grounded && !s.snap);
// exact (to 1/100): a cached edge is only reused in the same layout, so one seed is one exact run
const stoneSig = (s) => `${s.ch}${s.x.toFixed(2)},${s.y.toFixed(2)}`;
const nk = (cx, y) => cx + ':' + Math.round(y * 10);

export class Nav {
  constructor() { this.edges = new Map(); this.graphs = new Map(); this.stats = { rollouts: 0, graphs: 0, hits: 0 }; this.hands = null; }
  get handKey() { return this.hands ? this.hands.d + '/' + this.hands.leap : '0/0'; }

  // places to stand: the top of every rock column with room for a body, and the top of every resting stone
  nodes(w) {
    const out = [], seen = new Set();
    // a node stands at the column's middle, or off-centre when a stone leaves room only at one side
    const add = (cx, x, y, on) => {
      const k = nk(cx, y);
      if (seen.has(k)) return;
      const xs = on ? [x] : [x, cx + 0.25, cx + 0.75, cx + 0.1, cx + 0.9];
      const fx = xs.find((xx) => !w.overlaps(xx, y, PW, PH, null, { restingOnly: true }));
      if (fx === undefined) return;
      seen.add(k); out.push({ k, cx, x: fx, y, on });
    };
    for (let cx = 0; cx < w.w; cx++) for (let cy = 0; cy < w.h; cy++) {
      const c = w.cell(cx, cy);
      if (!w.solid(cx, cy) || w.solid(cx, cy + 1) || c === 'T' || c === 'F') continue;
      add(cx, cx + 0.5, cy + 1, 0);
    }
    for (const s of restStones(w)) add(Math.floor(s.x), s.x, s.y + SH, s.id);
    return out;
  }

  // the graph for this layout, with `carry` (a stone id in this world, or null) in hand
  graph(w, id, carry) {
    const cols = colSig(w);
    const held = carry ? w.stones.find((s) => s.id === carry) : null;
    const stones = restStones(w).filter((s) => s !== held);
    const key = this.handKey + '|' + (held ? held.ch : '-') + '|' + cols.join('') + '|' + stones.map(stoneSig).join(';');
    let g = this.graphs.get(key);
    if (g) return g;
    // the base world: you, standing still, holding `carry` if asked
    const base = copyWorld(w), bp = base.players.get(id);
    if (bp.hold && (!held || bp.hold.id !== held.id)) base.dropHeld(bp);
    if (held && (!bp.hold || bp.hold.id !== held.id)) { const k = base.stones.find((s) => s.id === held.id); base.holdStone(bp, k); }
    base.drain();
    const ns = this.nodes(base), byK = new Map(ns.map((n) => [n.k, n]));
    const carryCh = held ? held.ch : '-';
    for (const n of ns) {
      let sig = this.handKey + '|' + carryCh + '|' + n.k + '|';
      for (let x = Math.max(0, n.cx - R_SIG); x <= Math.min(w.w - 1, n.cx + R_SIG); x++) sig += cols[x];
      sig += '|' + stones.filter((s) => Math.abs(s.x - n.x) < R_SIG + 1).map(stoneSig).join(';');
      let es = this.edges.get(sig);
      if (es) this.stats.hits++;
      else {
        es = [];
        const start = copyWorld(base), p = start.players.get(id);
        Object.assign(p, { x: n.x, y: n.y, vx: 0, vy: 0, grounded: true, coyote: 0, jb: 0, jumping: false, leapt: false, apex: 0, kick: 0, stun: 0, wall: 0, lean: 0, qi: 1, chain: 0 });
        p.src.clear();
        p.support = n.on ? start.stones.find((s) => s.id === n.on) : STATIC;
        if (!p.support) continue;
        for (const mv of groundMoves(start)) {
          const r = rollout(start, id, mv, 150, this.hands);
          this.stats.rollouts++;
          if (r.splash || !r.landed) continue;
          es.push({ to: nk(Math.floor(r.p.x), r.p.y), x: r.p.x, y: r.p.y, t: r.t + 0.05 + r.ouch * 2, mv: mv.name });
        }
        this.edges.set(sig, es);
      }
      n.out = es;
    }
    // resolve edge ends to nodes (a landing beside a column's centre still belongs to it)
    for (const n of ns) n.adj = n.out.map((e) => ({ n: this.at({ byK, ns }, e.x, e.y), t: e.t, mv: e.mv })).filter((e) => e.n && e.n !== n);
    g = { ns, byK, key, base };
    this.stats.graphs++;
    if (this.graphs.size > 400) this.graphs.clear();
    this.graphs.set(key, g);
    return g;
  }

  // the node a body standing at (x, y) is on
  at(g, x, y) {
    const cx = Math.floor(x);
    for (const dy of [0, 0.1, -0.1]) { const n = g.byK.get(nk(cx, y + dy)); if (n) return n; }
    for (const ox of [-1, 1]) { const n = g.byK.get(nk(Math.floor(x + ox * 0.3), y)); if (n) return n; }
    // standing where no node is (inside a stone that was just forged round you): the nearest on this level
    let best = null;
    if (g.ns) for (const n of g.ns) if (Math.abs(n.y - y) < 0.15 && Math.abs(n.x - x) < 1.6 && (!best || Math.abs(n.x - x) < Math.abs(best.x - x))) best = n;
    return best;
  }

  // cost to go (seconds) from every node to the nearest node where goal(n) is true
  costTo(g, goal) {
    const ctg = new Map(), rev = new Map();
    for (const n of g.ns) for (const e of n.adj) { if (!rev.has(e.n.k)) rev.set(e.n.k, []); rev.get(e.n.k).push({ n, t: e.t }); }
    const q = [];
    for (const n of g.ns) if (goal(n)) { ctg.set(n.k, 0); q.push([0, n]); }
    while (q.length) {
      let bi = 0; for (let i = 1; i < q.length; i++) if (q[i][0] < q[bi][0]) bi = i;
      const [d, n] = q.splice(bi, 1)[0];
      if (d > ctg.get(n.k)) continue;
      for (const { n: m, t } of rev.get(n.k) || []) {
        const nd = d + t;
        if (nd < (ctg.has(m.k) ? ctg.get(m.k) : Infinity)) { ctg.set(m.k, nd); q.push([nd, m]); }
      }
    }
    return (x, y) => { const n = this.at(g, x, y); return n && ctg.has(n.k) ? ctg.get(n.k) : Infinity; };
  }
}

// ---------- the plan ----------
const recipeFor = (ch) => RU.RECIPE_LIST.find((r) => r[3] === ch && (r[0] === '⿰' || r[0] === '⿱'));
const fills = (s, len) => RU.FILLS.includes(s.g.el) && (s.g.span || 0) >= len;
const near = (a, b) => Math.abs(a - b);

// the runs of '_' cells (gaps a wood or earth stone fills)
function gaps(w) {
  const out = [];
  for (let cy = 0; cy < w.h; cy++) for (let cx = 0; cx < w.w; cx++) {
    if (w.cells[cy][cx] !== '_' || (cx > 0 && w.cells[cy][cx - 1] === '_')) continue;
    let b = cx; while (b + 1 < w.w && w.cells[cy][b + 1] === '_') b++;
    out.push({ id: 'gap' + cx + ',' + cy, x0: cx, x1: b + 1, cy, len: b - cx + 1 });
  }
  return out;
}

export function mind(w, id, opt = {}) {
  const nav = opt.nav || new Nav();
  nav.hands = opt.hands || null;
  // after a restart: a little seeded variety in how moves are scored, so a failed try is not replayed exactly
  let js = (opt.jitter || 0) * 2654435761 >>> 0;
  const jitter = () => { if (!opt.jitter) return 0; js = (js * 1664525 + 1013904223) >>> 0; return 0.4 * js / 4294967296; };
  const log = [];
  let cur = null, curMove = null, mf = 0, nextDecide = 0, frame = 0, lastNode = null, lastPlan = '';
  let faceT = 0;
  const say = (s) => { if (s !== lastPlan) { log.push(`${(frame * DT).toFixed(1)} ${s}`); lastPlan = s; } };

  // ---- goals: a predicate over nodes, plus what to do once standing on one ----
  const G = {
    take: (k) => ({ desc: 'take ' + k.ch,
      goal: (n) => n.on !== k.id && near(n.y, k.y) < 0.2 && near(n.x, k.x) > 0.6 && near(n.x, k.x) < 1.7,
      act: (p) => {
        const l = w.launch(p);
        if (l.mode === 'grab' && l.k === k) return { x: 0, press: 'grab' };
        // standing on it: step off on the side with no other stone (GRAB takes the one beside you first)
        if (p.support === k) { const o = w.stones.find((s) => s !== k && s.state === 'loose' && near(s.x, k.x) < 2 && near(s.y, k.y) < 1); const sd = o ? Math.sign(k.x - o.x) || 1 : -p.face; return { x: sd }; }
        const side = Math.sign(p.x - k.x) || 1;
        return approach(p, k.x + side * 0.85, -side, 0.25);
      } }),
    beside: (t, side, ch) => ({ desc: `set ${side < 0 ? 'left of' : 'right of'} ${t.ch} → ${ch}`,
      goal: (n) => n.on !== t.id && near(n.y, t.y) < 0.2 && (n.x - t.x) * side > 0.6 && (n.x - t.x) * side < 1.8,
      act: (p) => {
        const l = w.launch(p);
        if (l.mode === 'beside' && l.on === t && l.side === side) return makes(ch) ? { x: 0, press: 'grab' } : { x: 0 };
        return approach(p, t.x + side * 1.0, -side, 0.25);
      } }),
    stack: (b, ch) => ({ desc: `on top of ${b.ch} → ${ch}`,
      goal: (n) => n.on === b.id,
      act: (p) => {
        const l = w.launch(p);
        if (l.mode === 'stack' && l.on === b) return makes(ch) ? { x: 0, press: 'grab' } : { x: 0 };
        return approach(p, b.x, 0, 0.15);
      } }),
    offer: () => ({ desc: 'offer', goal: (n) => near(n.x, w.pav.x) < 1.4 && near(n.y, w.pav.y) < 0.5,
      act: (p) => w.launch(p).mode === 'offer' ? { x: 0, press: 'grab' } : approach(p, w.pav.x, 0, 0.5) }),
    wall: (m, side) => ({ desc: 'clear the ' + m.wall + ' wall at ' + m.x0,
      goal: (n) => near(n.y, m.y0) < 0.2 && (side < 0 ? n.x < m.x0 && n.x > m.x0 - 1.7 : n.x > m.x1 && n.x < m.x1 + 1.7),
      act: (p) => approach(p, side < 0 ? m.x0 - 0.35 : m.x1 + 0.35, 0, 0.1) }),
    fill: (gp, side) => ({ desc: 'fill the gap at ' + gp.x0,
      goal: (n) => near(n.y, gp.cy + 1) < 0.2 && (side < 0 ? n.x < gp.x0 && n.x > gp.x0 - 2.7 : n.x > gp.x1 && n.x < gp.x1 + 2.7),
      act: (p) => fillNow(p, gp, side) || approach(p, side < 0 ? gp.x0 - 0.4 : gp.x1 + 0.4, 0, 0.15) }),
    setDown: () => ({ desc: 'set down ' + (w.players.get(id).hold || {}).ch,
      goal: (n) => n.on === 0 && (quietSpot(n.x - 0.8, n.y) || quietSpot(n.x + 0.8, n.y)),
      act: (p) => setDownNow(p) || approach(p, p.x, -p.face) }),   // not here, facing this way: the other way
    // a stone stranded where it can't be carried from: into the river with it, and it floats home
    home: (k) => ({ desc: 'send ' + k.ch + ' home by the river',
      goal: (n) => n.on === 0 && waterSide(n) !== 0,
      act: (p) => letGo(p, waterSide({ cx: Math.floor(p.x), x: p.x, y: p.y }), (e) => e.t === 'stoneReturn' && e.s === k.id) || { x: 0 } }),
    wait: (why) => ({ desc: 'wait: ' + why, goal: () => false, act: () => ({ x: 0 }) }),
  };

  // -1 / 1: open water (nothing solid down to the river) in the next column on that side, low enough to hit
  function waterSide(n) {
    for (const d of [-1, 1]) {
      const cx = n.cx + d;
      if (cx < 0 || cx >= w.w || n.y > 4) continue;
      let solid = false; for (let cy = 0; cy < n.y; cy++) if (w.solid(cx, cy) || w.cell(cx, cy) === '_') solid = true;
      if (!solid) return d;
    }
    return 0;
  }
  // walk to x on this level and face `face` (−1 / 1 / 0); tol: how close is close enough
  function approach(p, x, face, tol = 0.08) {
    const d = x - p.x;
    if (Math.abs(d) > tol) return { x: Math.sign(d) * Math.min(1, Math.abs(d) / 0.4 + 0.2) };
    // turn round: one short tap of the stick, then watch (a thumb that only knows full tilt still turns)
    if (face && p.face !== face && frame >= faceT) { faceT = frame + 20; return { x: face * 0.55 }; }
    return { x: 0 };
  }
  // GRAB now, on a copy: does it forge `ch` within 1.5 s?
  function makes(ch) {
    const c = copyWorld(w);
    c.press(id, 'grab');
    for (let i = 0; i < 90; i++) { c.setInput(id, 0, false); c.step(DT); for (const e of c.drain()) if (e.t === 'forge') return e.ch === ch; }
    return false;
  }
  // no stone near, no spring's spot, not at the edge of a drop
  function quietSpot(x, y) {
    const cx = Math.floor(x), cy = Math.round(y) - 1;
    if (!w.solid(cx, cy) || !w.solid(Math.floor(x - 0.45), cy) || !w.solid(Math.floor(x + 0.44), cy)) return false;
    if (w.stones.some((s) => s.state === 'loose' && near(s.x, x) < 2.0 && near(s.y, y) < 1.6)) return false;
    if (w.springs.some((sp) => near(sp.x, x) < 1.6 && near(sp.y, y) < 1.6)) return false;
    if (near(x, w.pav.x) < 1.8) return false;
    return true;
  }
  function setDownNow(p) {
    const l = w.launch(p);
    if (l.mode !== 'place' || !quietSpot(l.x, l.y)) return null;
    const c = copyWorld(w); c.press(id, 'grab');
    for (let i = 0; i < 60; i++) { c.setInput(id, 0, false); c.step(DT); for (const e of c.drain()) if (['forge', 'bridge', 'dud', 'stoneReturn'].includes(e.t)) return null; }
    return { x: 0, press: 'grab' };
  }
  // at the lip of a gap with a filler: which GRAB (set down at the edge, or throw) grows a bridge?
  function fillNow(p, gp, side) { return letGo(p, -side, (e) => e.t === 'bridge'); }
  // GRAB now with the stick at 0 (set down) or toward dir (throw): which one makes `ok(event)` happen?
  // Tried on copies; the first that works is pressed.
  function letGo(p, dir, ok) {
    if (!p.grounded) return null;
    const tries = [
      { mode: 'place', pre: [{ x: dir * 0.55 }, { x: 0 }, { x: 0 }], x: 0 },     // a tap to face that way
      { mode: 'toss', pre: [], x: dir },
    ];
    for (const tr of tries) {
      const c = copyWorld(w), cp = c.players.get(id);
      for (const o of tr.pre) { c.setInput(id, o.x, false); c.step(DT); }
      c.setInput(id, tr.x, false);
      if (c.launch(cp).mode !== tr.mode) continue;
      c.press(id, 'grab');
      let hit = false;
      for (let i = 0; i < 120 && !hit; i++) { c.setInput(id, i === 0 ? tr.x : 0, false); c.step(DT); hit = c.drain().some(ok); }
      if (hit) { pending = tr.pre.slice(); pending.push({ x: tr.x, press: 'grab' }); return pending.shift(); }
    }
    return null;
  }
  let pending = [];

  // ---- reachability and obstacles ----
  function reach(goal, carry, world = w, from = null) {
    const g = nav.graph(world, id, carry), p = world.players.get(id);
    const ctg = nav.costTo(g, goal);
    from = from || (p.grounded ? p : lastNode || p);
    return { g, ctg, cost: ctg(from.x, from.y) };
  }
  // a wall or gap in the way of `goal` from `from`: the one whose removal makes the goal reachable
  function obstacle(goal, carry, from) {
    for (const m of w.hedges) {
      if (m.done) continue;
      const h = copyWorld(w);
      for (let y = m.y0; y < m.y1; y++) h.cells[y][m.x0] = '.';
      h.hedges.find((x) => x.id === m.id).done = true;
      if (Number.isFinite(reach(goal, carry, h, from).cost)) return { kind: 'wall', m, side: from.x < m.x0 ? -1 : 1 };
    }
    for (const gp of gaps(w)) {
      const h = copyWorld(w);
      for (let x = gp.x0; x < gp.x1; x++) h.cells[gp.cy][x] = '=';
      if (Number.isFinite(reach(goal, carry, h, from).cost)) return { kind: 'gap', gp, side: from.x < gp.x0 ? -1 : 1 };
    }
    return null;
  }
  const W_EL = { thorn: 'fire', flame: 'water', shade: 'light' };
  // never use up the wanted character on a wall or a gap
  const fitsOb = (ob, g, ch) => ch !== w.L.want && (ob.kind === 'wall' ? g.el === W_EL[ob.m.wall] : fills({ g }, ob.gp.len));
  const playerAt = () => { const p = w.players.get(id); return p.grounded ? { x: p.x, y: p.y } : lastNode || { x: p.x, y: p.y }; };
  const isWait = (v) => v.desc.startsWith('wait');

  // go to `step.goal` with what is in hand; if it can't be reached, the step that clears the way
  function via(step, depth = 0) {
    const h = w.players.get(id).hold, from = playerAt();
    const r = reach(step.goal, h ? h.id : null, w, from);
    if (Number.isFinite(r.cost)) return { ...step, r };
    if (depth > 2) return G.wait('no way to ' + step.desc);
    const ob = obstacle(step.goal, h ? h.id : null, from);
    if (!ob) return G.wait('no way to ' + step.desc);
    return clear(ob, depth + 1);
  }
  // get stone k to `step` (k in hand there). The carry is checked first: if a wall or gap is in its way,
  // that is cleared before k is picked up (else you pick k up, can't pass, set it down, pick it up...)
  function fetch(k, step, depth = 0) {
    const h = w.players.get(id).hold;
    if (h === k) return via(step, depth);
    const from = { x: k.x, y: k.y };
    if (!Number.isFinite(reach(step.goal, k.id, w, from).cost) && depth < 3) {
      const ob = obstacle(step.goal, k.id, from);
      if (ob && !fitsOb(ob, k.g, k.ch)) return clear(ob, depth + 1);
      if (!ob) return G.wait('no way to carry ' + k.ch + ' to ' + step.desc);
    }
    if (h) return useHeld([{ goal: G.take(k).goal, carry: null, from: playerAt() }], depth) || via(G.setDown(), depth);
    const v = via(G.take(k), depth);
    // boxed in (a gap one side, a stone the other: nowhere to stand to take it): move that stone away
    if (isWait(v) && depth < 3 && !nav.graph(w, id, null).ns.some(G.take(k).goal)) {
      const o = w.stones.find((s) => s !== k && s.state === 'loose' && s.grounded && near(s.y, k.y) < 0.3 && near(s.x, k.x) < 1.9);
      if (o) { const m = fetch(o, G.setDown(), depth + 1); if (!isWait(m)) return { ...m, desc: 'move ' + o.ch + ' off ' + k.ch + ': ' + m.desc }; }
    }
    return v;
  }
  // the stone in hand is not a piece of what comes next: does it clear a wall or gap on one of the
  // coming legs ({ goal, carry, from })? then that is what it is for, before it is set down
  function useHeld(legs, depth) {
    const h = w.players.get(id).hold;
    if (!h || depth > 2) return null;
    for (const L of legs) {
      if (Number.isFinite(reach(L.goal, L.carry, w, L.from).cost)) continue;
      const ob = obstacle(L.goal, L.carry, L.from);
      if (ob && fitsOb(ob, h.g, h.ch)) return clear(ob, depth + 1);
    }
    return null;
  }
  // clear a wall or gap: with the stone in hand if it fits, else fetch one that does, else make one
  function clear(ob, depth) {
    const p = w.players.get(id), h = p.hold;
    const step = ob.kind === 'wall' ? G.wall(ob.m, ob.side) : G.fill(ob.gp, ob.side);
    if (h && fitsOb(ob, h.g, h.ch)) return via(step, depth);
    const k = w.stones.filter((s) => s.state === 'loose' && s.grounded && fitsOb(ob, s.g, s.ch)).sort((a, b) => near(a.x, p.x) - near(b.x, p.x))[0];
    if (k) return fetch(k, step, depth);
    // nothing fits: a character that does, made from what the isle has (林 spans five where 木 spans three)
    const have = new Set(w.stones.filter((s) => s.state !== 'gone').map((s) => s.ch).concat(w.springs.map((sp) => sp.ch)));
    const r = RU.RECIPE_LIST.find((r) => (r[0] === '⿰' || r[0] === '⿱') && have.has(r[1]) && have.has(r[2]) && fitsOb(ob, RU.GLYPHS[r[3]] || {}, r[3]));
    if (r) return make(r[3], depth);
    return G.wait('nothing clears the ' + (ob.kind === 'wall' ? ob.m.wall : 'gap'));
  }

  function sendHome(k, depth) {
    if (!k.home || Math.hypot(k.x - k.home[0], k.y - k.home[1]) < 1.5) return null;
    const v = fetch(k, G.home(k), depth + 1);
    return isWait(v) ? null : v;
  }

  // ---- what to do now ----
  function plan() {
    const p = w.players.get(id), h = p.hold, want = w.L.want;
    // a stone in the air (thrown, or a new character popping out): see where it lands first
    if (w.stones.some((s) => s.state === 'loose' && !s.grounded && !s.snap)) return { ...G.wait('watching a stone land'), r: null };
    if (h && h.ch === want) return via(G.offer());
    const W = w.stones.find((s) => s.state === 'loose' && s.ch === want);
    if (W) return fetch(W, G.offer());
    return make(want, 0);
  }
  function make(ch, depth) {
    const p = w.players.get(id), h = p.hold;
    const loose = w.stones.filter((s) => s.state === 'loose');
    const r = recipeFor(ch);
    if (!r || depth > 4) return G.wait('no recipe for ' + ch);
    const [op, a, b] = r;
    const pool = (c, not) => loose.filter((s) => s.ch === c && s !== not && (s.grounded || s.pushed || s.snap));
    // a missing piece: make it first if it has a recipe, else wait for it to grow back
    for (const part of a === b ? [a] : [a, b]) {
      const n = pool(part).length + (h && h.ch === part ? 1 : 0);
      if (n >= (a === b ? 2 : 1)) continue;
      if (recipeFor(part) && n === 0) return make(part, depth + 1);
      if (h && h.ch !== part) return via(G.setDown(), depth);
      // its spot is taken (often by a character forged right there): move that out of the way
      const blocked = w.springs.find((sp) => sp.ch === part && !sp.stone && sp.blocked);
      const k = blocked && loose.find((s) => near(s.x, blocked.x) < 1.5 && near(s.y, blocked.y) < 1.6);
      if (k) return h ? via(G.setDown(), depth) : via(G.take(k), depth);
      if (!h) return G.wait(part + ' to grow back');
    }
    // options: which piece to carry, and where it goes
    const opts = [];
    const As = h ? (h.ch === a ? [h] : []) : pool(a), Bs = h ? (h.ch === b ? [h] : []) : pool(b);
    for (const ka of As) for (const kb of pool(b, ka)) {
      if (op === '⿰') opts.push({ carry: ka, to: kb, step: G.beside(kb, -1, ch) });     // a goes on the left of b
      else opts.push({ carry: ka, to: kb, step: G.stack(kb, ch) });                       // a goes on top of b
    }
    if (op === '⿰') for (const kb of Bs) for (const ka of pool(a, kb)) opts.push({ carry: kb, to: ka, step: G.beside(ka, 1, ch) });
    if (!opts.length && h) {
      // what comes after the stone in hand is set down: each option's walk, carry, and the walk home
      const legs = [];
      for (const ka of pool(a)) for (const kb of pool(b, ka)) {
        const step = op === '⿰' ? G.beside(kb, -1, ch) : G.stack(kb, ch);
        legs.push({ goal: G.take(ka).goal, carry: null, from: playerAt() }, { goal: step.goal, carry: ka.id, from: { x: ka.x, y: ka.y } },
          { goal: G.offer().goal, carry: kb.id, from: { x: kb.x, y: kb.y } });
      }
      return useHeld(legs, depth) || via(G.setDown(), depth);
    }
    if (!opts.length) return G.wait('no pieces for ' + ch);
    // cheapest first (walk to the piece, carry it to its partner: a straight-line guess); an option whose
    // carry is reachable from the piece as things stand beats one that needs a wall or gap cleared first
    for (const o of opts) {
      o.cost = (h ? 0 : near(p.x, o.carry.x)) + near(o.carry.x, o.to.x);
      if (!h && !Number.isFinite(reach(o.step.goal, o.carry.id, w, { x: o.carry.x, y: o.carry.y }).cost)) o.cost += 1000;
    }
    opts.sort((x, y) => x.cost - y.cost);
    let fallback = null;
    for (const o of opts) {
      const v = fetch(o.carry, o.step, depth);
      if (!isWait(v)) return v;
      fallback = fallback || v;
    }
    // nothing can be done as things stand: a piece is stranded where it can't be carried from. If it is
    // in hand, send it home by the river or set it down (another piece may go to it instead); else
    // fetch a stranded piece and send it home.
    if (h) return sendHome(h, depth) || via(G.setDown(), depth);
    for (const o of opts) { const v = sendHome(o.carry, depth); if (v) return v; }
    // or a piece lies where its partner can't go beside or on it (against a wall): move it somewhere open
    // (only when that is the trouble: the carried piece can be taken, but nowhere to stand to set it there)
    if (depth < 3) for (const o of opts) {
      if (isWait(via(G.take(o.carry), depth + 1)) || nav.graph(w, id, o.carry.id).ns.some(o.step.goal)) continue;
      for (const k of [o.to]) {          // moving the piece you carry does not free its partner's side
        if (k.state !== 'loose' || !k.grounded) continue;
        const v = fetch(k, G.setDown(), depth + 1);
        if (!isWait(v)) return { ...v, desc: 'move ' + k.ch + ' somewhere open: ' + v.desc };
      }
    }
    return fallback || G.wait('stuck making ' + ch);
  }

  // ---- acting ----
  // the move with the least (time + cost to go from where it lands). A move that ends where it started
  // is no progress: then line up first (stand still on the node), as the map's own moves start from rest.
  function choose(p, step) {
    const ctg = step.r.ctg;
    const node = p.grounded ? nav.at(step.r.g, p.x, p.y) : null;
    const here = p.grounded ? ctg(p.x, p.y) : Infinity;
    if (node && here === 0) return { fine: true };
    const moves = p.grounded ? groundMoves(w) : airMoves(w, lastNode ? lastNode.y : p.y);
    let best = null, bs = Infinity, bestP = null, bps = Infinity;
    for (const mv of moves) {
      const r = rollout(w, id, mv, 150, nav.hands);
      if (r.splash) continue;
      const left = r.landed ? ctg(r.p.x, r.p.y) : Infinity;
      const s = r.t + left + r.ouch * 2 + jitter();
      if (s < bs) { bs = s; best = mv; }
      if (left < here - 0.01 && s < bps) { bps = s; bestP = mv; }
    }
    if (node && Number.isFinite(here) && !bestP) {
      const lined = Math.abs(p.x - node.x) < 0.2 && Math.abs(p.vx) < 0.3;
      if (!lined) return { lineup: node };
    }
    if (bestP && (!p.grounded || bps < bs + 1.5 || !node)) return { move: bestP, score: bps };
    if (node && bestP) { const lined = Math.abs(p.x - node.x) < 0.2 && Math.abs(p.vx) < 0.3; if (!lined) return { lineup: node }; return { move: bestP, score: bps }; }
    return best ? { move: best, score: bs } : null;
  }

  function tick() {
    const p = w.players.get(id);
    frame++;
    if (p.grounded && g0) { const n = nav.at(g0, p.x, p.y); if (n) lastNode = n; }
    if (pending.length) { const o = pending.shift(); return out(o); }
    const landed = p.grounded && !wasGrounded;
    wasGrounded = p.grounded;
    if (frame >= nextDecide || landed || !curMove) {
      nextDecide = frame + 12;
      cur = plan();
      say(cur.desc);
      g0 = cur.r ? cur.r.g : g0;
      if (cur.r) {
        const c = choose(p, cur);
        lastChoice = c ? (c.fine ? 'fine' : c.lineup ? 'lineup ' + c.lineup.k : c.move.name + ' ' + c.score.toFixed(2)) : 'none';
        lineup = null;
        if (c && c.fine) { curMove = null; fine = true; }
        else if (c && c.lineup) { curMove = null; fine = false; lineup = c.lineup; nextDecide = frame + 6; }
        else if (c) { curMove = c.move.again(); mf = 0; fine = false; }   // a fresh copy: the rollout used up the one it played
        else { curMove = null; fine = false; }
      } else { curMove = null; fine = true; }
    }
    if (lineup) return out(approach(p, lineup.x, 0, 0.1));
    if (fine || !curMove) return out(cur.act(p) || { x: 0 });
    const o = curMove.fn(p, w, mf++);
    if (o.end && p.grounded) curMove = null;
    return out(o);
  }
  let fine = false, wasGrounded = true, g0 = null, lineup = null, lastChoice = '';
  // a person presses GRAB once and watches what happens; another press only after a moment
  // and a leap pressed in the air is still on its way through the thumb for a few frames: a fresh move
  // chosen meanwhile must not press it again (two leaps in two frames waste a charge)
  let lastGrab = -1e9, lastLeap = -1e9;
  const out = (o) => {
    let press = o.press ? [].concat(o.press) : [];
    if (press.includes('grab')) { if (frame - lastGrab < 42) press = press.filter((k) => k !== 'grab'); else lastGrab = frame; }
    if (press.includes('jump') && !w.players.get(id).grounded) {
      if (frame - lastLeap < (nav.hands ? nav.hands.leap : 0) + 4) press = press.filter((k) => k !== 'jump'); else lastLeap = frame;
    }
    // on glass, putting the thumb back on JUMP is a tap: never hold it again without meaning a press
    let jump = !!o.jump;
    if (jump && !prevJump && !press.includes('jump')) jump = false;
    prevJump = jump;
    return { x: o.x || 0, jump, press };
  };
  let prevJump = false;

  return { tick, log, nav, get plan() { return cur; }, get choice() { return lastChoice; } };
}

// Play an isle to the end with this mind. hw: what the presses go to (w, or the motor channel around w).
// A person who sees no way on restarts the isle from the menu: when the plan has had no way forward for
// `giveUp` seconds (default 15), the isle is reloaded and the mind starts again. Restarts are counted and
// the clock keeps running (time = all attempts), so a restart costs what it costs a player.
export function play(w, id, opt = {}) {
  const hw = opt.hw || w, max = opt.max || 60 * 180, giveUp = (opt.giveUp ?? 15) * 60;
  let m = mind(w, id, opt), nav = m.nav;
  const ev = [], restarts = [];
  let f = 0, stuck = 0, before = 0, same = 0, lastDesc = '';
  const lost = (d) => d && d.startsWith('wait') && !/grow back|watching/.test(d);
  const stale = (opt.stale ?? 40) * 60;    // the same step for this long without getting anywhere: stuck too
  const idle = (opt.idle ?? 75) * 60;      // nothing made, cleared or offered for this long (a loop of steps)
  const PROGRESS = new Set(['forge', 'bridge', 'burn', 'douse', 'dispel', 'offer']);
  let lastGood = 0;
  for (; f < max && w.phase === 'play'; f++) {
    const o = m.tick();
    hw.setInput(id, o.x, o.jump);
    for (const k of o.press) hw.press(id, k);
    hw.step(DT);
    for (const e of w.drain()) { ev.push(e); if (PROGRESS.has(e.t)) lastGood = f; if (opt.onEvent) opt.onEvent(e, f); }
    const desc = m.plan && m.plan.desc;
    stuck = lost(desc) ? stuck + 1 : 0;
    same = desc === lastDesc && !/grow back|watching/.test(desc || '') ? same + 1 : 0; lastDesc = desc;
    if ((stuck >= giveUp && giveUp > 0) || (same >= stale && stale > 0) || (f - lastGood >= idle && idle > 0)) {
      const p = w.players.get(id);
      restarts.push({ t: +(f * DT).toFixed(1), why: m.plan.desc, at: [+p.x.toFixed(1), +p.y.toFixed(1)], hold: p.hold ? p.hold.ch : null });
      before += w.time;
      w.load(w.index); w.drain();
      m = mind(w, id, { ...opt, nav, jitter: restarts.length });
      stuck = 0; same = 0; lastGood = f;
    }
  }
  const time = w.result ? Math.round((before + w.result.time) * 10) / 10 : null;
  return { won: w.phase === 'won', time, frames: f, log: m.log, ev, nav, plan: m.plan && m.plan.desc, restarts };
}
