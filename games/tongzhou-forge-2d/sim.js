// 同舟 · Glyph Isles 2D — the simulation of the side-view greybox. Pure logic: no DOM, no sockets,
// no timers, no Math.random, so the tests can step it as fast as they like and the same inputs
// always give the same isle. The page runs it locally (one player for the greybox); a server can
// run the same file later for the crew.
//
// World: x right, y UP, one map cell = 1 unit. Bodies are boxes: x is the centre, y the bottom.
// Everything moves one axis at a time against tiles and resting stones.
//
// The grammar is the 3D game's (games/tongzhou-forge, docs/forge/DESIGN.md), in page axes:
//   ⿰ beside  = two stones resting side by side on the same level, touching or nearly; left first
//   ⿱ on top  = a stone resting on another stone (support, never mere height); top first
// Every place where strict grammar meets relaxed play is a knob in FORGE, QI or ASSIST, grouped
// into the profiles relaxed / standard / strict (FG-D003). An isle picks a profile with `strict`;
// it never carries numbers of its own.
(function (root) {
  'use strict';
  const RU = (typeof module !== 'undefined' && module.exports) ? require('./rules.js') : root.WRules;
  const IS = (typeof module !== 'undefined' && module.exports) ? require('./isles.js') : root.WIsles;

  // ---------- body and movement constants (not knobs: they define the world's scale) ----------
  const G = 34;                       // gravity, units / s^2
  const PW = 0.3, PH = 1.2;           // player half-width, height
  const SW = 0.45, SH = 0.9;          // stone half-width, height (a stone is 0.9 x 0.9)
  const RUN = 4.6, CARRY_RUN = 3.8;   // walking speed, empty-handed and carrying
  const ACC_G = 42, ACC_A = 24;       // how fast you reach that speed, on the ground and in the air
  const MAX_FALL = 16;
  const JUMP_CUT = 0.5;               // letting go of JUMP early cuts the rise (small hops)
  const HOLD_Y = PH + 0.05;           // a carried stone sits on top of your head
  const PUSH = 0.55;                  // a pushed stone moves at this share of your speed
  const PUSH_DELAY = 0.2;             // lean on a stone this long before it moves (no accidental shoves)
  const TOSS_VX = 6.5, TOSS_VY = 5.5; // a throw while walking
  const WATER = 0.6;                  // feet below this: you are in the river
  const REGROW = 3.5;                 // seconds before a used-up stone grows back (regrow isles)
  const DUSK_TIME = 20;               // a dusk stone dims the isle this long (tune)
  const OFFER_T = 0.55;               // seconds an offered stone flies to the pavilion
  const PAV_R = 1.8;                  // how close to the pavilion you offer from
  const MAX_STONES = 14;
  const BLOCKED_SAY = 8;              // seconds a regrow waits on a busy spot before the isle says why
  const EPS = 1e-4;

  // ---------- knobs ----------
  // FORGE: where the grammar is read (docs/forge/DESIGN.md §2, here in page axes).
  const FORGE = {
    besideY: 0.3,                     // K3: the two bottoms differ by at most this
    besideR: [0.84, 1.3], ideal: 0.92, // K1/K2: centre distance range for ⿰, and the touching spot
    stackR: 0.55,                     // a stone rests on another only if their centres are this close
    snap: 0.15, rescue: 'off', dudCd: 0, wrongLife: Infinity,   // K4-K7 (tune)
    assist: 'label+snap', forms: true,                          // K9, K10 (client)
    dudHint: 'other', near: true,                                // FG-D017
    push: true,                       // walking into a stone pushes it along the ground
    profiles: {
      relaxed:  { besideY: 0.45, besideR: [0.8, 1.6], snap: 0.2, rescue: 'unique', wrongLife: 12 },
      standard: {},
      strict:   { besideY: 0.15, besideR: [0.88, 1.06], snap: 0, dudCd: 1.5, assist: 'none', forms: false, push: false },
    },
  };
  // QI (轻功): the second jump, which now chains (SIDE-VIEW §3.3). One leap per charge; the ground
  // gives a charge and resets the chain; touching something NEW in the air gives another.
  const QI = {
    jump: 1.65,                       // apex of a plain jump: clears one rock (1), never two
    leap: 1.9,                        // height a leap adds from wherever you are
    float: 0.22, floatG: 0.3,         // seconds of soft gravity at a leap's apex, and how soft
    chain: 6,                         // most leaps between two landings, empty-handed
    carry: 1,                         // most leaps while carrying a stone
    refill: ['wall', 'stone', 'gem', 'cloud', 'head'],   // what counts as a new source
    wallKey: 'face',                  // 'face': each wall face refills once per chain; 'band': once per
                                      // 2 units of height on a face (climb one wall); 'any': always
    kick: 5,                          // a leap off a wall pushes you away from it this fast
    cooldown: 0,                      // seconds between leaps (the 3D game had 4)
    profiles: {
      relaxed:  { leap: 2.1, chain: 8, float: 0.3, wallKey: 'band' },
      standard: {},
      strict:   { chain: 4, float: 0.12 },
    },
  };
  // ASSIST: forgiveness of the hand while moving (SIDE-VIEW §3.2). Off or small in strict.
  const ASSIST = {
    coyote: 0.1,                      // you can still jump this long after walking off an edge
    buffer: 0.12,                     // a JUMP pressed this long before landing still jumps
    nudge: 0.3,                       // a ledge this far above your feet when you hit it: you climb on
    keepOnFall: true,                 // fall in the river and you keep the stone you carry
    minJump: 0.14,                    // a jump rises at least this long before letting go cuts it
                                      // (a finger tap on glass lasts 60-100 ms: without this every
                                      // tapped jump was a 0.4 hop; found by screen-check.py)
    profiles: {
      relaxed:  { coyote: 0.14, buffer: 0.16, nudge: 0.42 },
      standard: {},
      strict:   { coyote: 0.05, buffer: 0.08, nudge: 0, keepOnFall: false, minJump: 0.08 },
    },
  };
  // CONJURE: writing a character makes its stone (docs/CONJURE.md). Each player has their own ink and their own
  // written stones (CJ2-01); `pool: 'crew'` shares one pool instead, the 3D game's rule (cap +1 per extra player).
  const CONJURE = {
    ink: 2,                           // drops a player holds at most, and starts the isle with
    regen: 15,                        // seconds for one drop to come back
    cooldown: 1,                      // seconds between two writes by one player
    own: 2,                           // written stones one player may have at once: one more fades the oldest (CJ2-07)
    pick: true,                       // "Use ... without drawing" for a chosen idea (CJ2-08)
    pool: 'own',                      // 'own' (per player) or 'crew' (one shared pool)
    profiles: {
      relaxed:  { ink: 3, regen: 10, cooldown: 0.5, own: 3 },
      standard: {},
      strict:   { ink: 1, regen: 25, cooldown: 2, own: 1, pick: false },
    },
  };
  const PROFILE = 'standard';
  const PROFILES = ['relaxed', 'standard', 'strict'];
  function pick(T, name) {
    const o = Object.assign({}, T, T.profiles[name] || T.profiles[PROFILE]);
    delete o.profiles;
    return Object.freeze(o);
  }
  // The knobs of one profile. An unknown name falls back to the default.
  function knobs(name) {
    const p = PROFILES.includes(name) ? name : PROFILE;
    return { profile: p, fz: pick(FORGE, p), qi: pick(QI, p), as: pick(ASSIST, p), cj: pick(CONJURE, p) };
  }

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sgn = v => v < 0 ? -1 : 1;
  const leapV = h => Math.sqrt(2 * G * h);

  // ---------- the classifier (page axes) ----------
  // relate(a, b, fz): the placement of two resting stones, or null.
  //   ⿱ when one rests on the other (support), the top stone first.
  //   ⿰ when both rest on the same level and their centres are besideR apart: the left one first.
  // err 0 is the ideal spot, 1 the edge of the tolerance. Pure.
  function relate(a, b, fz) {
    if (!a || !b || a === b) return null;
    const top = a.support === b ? a : b.support === a ? b : null;
    if (top) {
      const bot = top === a ? b : a;
      return { op: '⿱', first: top, second: bot, err: Math.abs(top.x - bot.x) / fz.stackR };
    }
    const dx = b.x - a.x, dy = b.y - a.y, ad = Math.abs(dx), [r0, r1] = fz.besideR;
    if (Math.abs(dy) > fz.besideY || ad < r0 || ad > r1) return null;
    const er = ad >= fz.ideal ? (ad - fz.ideal) / Math.max(1e-9, r1 - fz.ideal) : (fz.ideal - ad) / Math.max(1e-9, fz.ideal - r0);
    const err = Math.hypot(er, dy / fz.besideY) / Math.SQRT2;
    return dx >= 0 ? { op: '⿰', first: a, second: b, err } : { op: '⿰', first: b, second: a, err };
  }
  // The relation k should forge through: ⿱ first, then the smallest err, then the lowest id.
  function bestRelation(k, others, fz) {
    let best = null, bestP = null;
    for (const o of others) {
      const rel = relate(k, o, fz);
      if (!rel) continue;
      let better;
      if (!best) better = true;
      else if ((rel.op === '⿱') !== (best.op === '⿱')) better = rel.op === '⿱';
      else if (rel.err !== best.err) better = rel.err < best.err;
      else better = o.id < bestP.id;
      if (better) { best = rel; bestP = o; }
    }
    if (best) best.partner = bestP;
    return best;
  }

  const STATIC = { kind: 'tile' };
  // the map character of each kind of wall, and which walls hurt to touch (shade only blocks)
  const WALL_OF = { T: 'thorn', F: 'flame', S: 'shade' };
  const HURTS = { T: 'thorn', F: 'flame' };

  class World {
    constructor(isles) {
      this.isles = isles || IS.ISLES;
      this.players = new Map();
      this.profileOverride = null;
      this.load(0);
    }

    // ---------- loading ----------
    load(i) {
      this.index = ((i % this.isles.length) + this.isles.length) % this.isles.length;
      const L = this.L = this.isles[this.index];
      const g = IS.parse(L);
      this.w = g.w; this.h = g.h; this.cells = g.cells;
      this.k = knobs(this.profileOverride || L.strict || PROFILE);
      this.fz = this.k.fz; this.qi = this.k.qi; this.as = this.k.as; this.cj = this.k.cj;
      this.events = [];
      this.time = 0; this.clock = 0; this.started = false;
      this.phase = 'play'; this.result = null;
      this.dusk = 0;
      this.cool = new Map();
      this.stones = []; this.nextId = 1;
      this.springs = [];
      this.bridges = [];
      this.burnt = [];
      this.wantTree = this.treeOf(L.want);
      this.hedges = this.findHedges();
      this.pav = { x: L.pavilion, y: this.groundTop(L.pavilion, this.h) };
      this.gems = (L.gems || []).map(([x, y]) => ({ x, y, got: false }));
      this.glow = (L.glow || []).map(([x, y]) => ({ x, y, got: false, glow: true }));
      this.clouds = (L.clouds || []).map(([x, y], i) => ({ x, y, id: 'c' + i, t: 0 }));
      for (const [ch, x] of L.stones) {
        const y = this.groundTop(x, this.h);
        const sp = { ch, x, y, stone: null, wait: 0 };
        sp.stone = this.addStone(ch, x, y, sp);
        sp.stone.grounded = true;
        this.springs.push(sp);
      }
      for (const p of this.players.values()) { this.spawn(p); this.refillInk(p); }
      this.crewInk = this.inkMax();
      this.ev('isle', { i: this.index, id: L.id, profile: this.k.profile });
    }

    // every piece on some recipe path to `want` (FG-D015: "wrong" means outside this tree)
    treeOf(ch) {
      const out = new Set();
      const walk = c => { for (const r of RU.RECIPE_LIST) if (r[3] === c) for (const part of [r[1], r[2]]) if (!out.has(part)) { out.add(part); walk(part); } };
      walk(ch);
      return out;
    }

    setProfile(name) {
      this.profileOverride = PROFILES.includes(name) ? name : null;
      this.k = knobs(this.profileOverride || this.L.strict || PROFILE);
      this.fz = this.k.fz; this.qi = this.k.qi; this.as = this.k.as; this.cj = this.k.cj;
      for (const p of this.players.values()) p.ink = Math.min(p.ink, this.cj.ink);
      this.crewInk = Math.min(this.crewInk, this.inkMax());
      this.ev('profile', { profile: this.k.profile });
    }

    // ---------- tiles ----------
    cell(cx, cy) {
      if (cx < 0 || cx >= this.w) return '#';          // the isle's ends are walls
      if (cy < 0) return '~';
      if (cy >= this.h) return '.';
      return this.cells[cy][cx];
    }
    solid(cx, cy) { const c = this.cell(cx, cy); return c === '#' || c === 'T' || c === 'F' || c === 'S' || c === 'b' || c === '=' ; }
    // the top of the highest solid cell in column floor(x) at or below `below`
    groundTop(x, below) {
      const cx = Math.floor(x);
      for (let cy = Math.min(this.h - 1, Math.floor(below) - 1); cy >= 0; cy--) if (this.solid(cx, cy)) return cy + 1;
      return 0;
    }
    // Walls that stand until the right kind of stone comes near: T thorns (fire), F flames (water),
    // S shade (light). Each vertical run of one kind is one wall.
    findHedges() {
      const out = [], seen = new Set();
      for (let cx = 0; cx < this.w; cx++) for (let cy = 0; cy < this.h; cy++) {
        const ch = this.cells[cy][cx];
        if (!WALL_OF[ch] || seen.has(cx + ',' + cy)) continue;
        let y1 = cy;
        while (y1 + 1 < this.h && this.cells[y1 + 1][cx] === ch) y1++;
        for (let y = cy; y <= y1; y++) seen.add(cx + ',' + y);
        out.push({ id: 'hedge' + out.length, wall: WALL_OF[ch], x0: cx, x1: cx + 1, y0: cy, y1: y1 + 1, done: false });
      }
      return out;
    }

    // Boxes that block a mover inside region [x0,x1]x[y0,y1]: solid tiles, plus resting stones.
    boxes(x0, y0, x1, y1, self, withStones) {
      const out = [];
      for (let cx = Math.floor(x0); cx <= Math.floor(x1 - EPS); cx++) {
        for (let cy = Math.floor(y0); cy <= Math.floor(y1 - EPS); cy++) {
          if (this.solid(cx, cy)) out.push({ x0: cx, y0: cy, x1: cx + 1, y1: cy + 1, ref: STATIC, t: this.cell(cx, cy), cx, cy });
        }
      }
      if (withStones) for (const s of this.stones) {
        if (s === self || s.state !== 'loose' || withStones.skip && withStones.skip.has(s)) continue;
        if (withStones.restingOnly && !s.grounded) continue;
        const b = { x0: s.x - SW, y0: s.y, x1: s.x + SW, y1: s.y + SH, ref: s };
        if (b.x1 > x0 && b.x0 < x1 && b.y1 > y0 && b.y0 < y1) out.push(b);
      }
      return out;
    }

    // Move a box (centre x, bottom y, half-width hw, height h) along one axis by d. Returns the
    // new position and the box it ran into, if any.
    sweep(b, hw, h, axis, d, self, withStones) {
      if (d === 0) return { v: axis === 'x' ? b.x : b.y, hit: null };
      if (axis === 'x') {
        const edge = d > 0 ? b.x + hw : b.x - hw, to = edge + d;
        const bx = this.boxes(Math.min(edge, to), b.y + EPS, Math.max(edge, to), b.y + h - EPS, self, withStones);
        let lim = to, hit = null;
        for (const o of bx) {
          if (d > 0 && o.x0 >= edge - 1e-6 && o.x0 < lim) { lim = o.x0; hit = o; }
          if (d < 0 && o.x1 <= edge + 1e-6 && o.x1 > lim) { lim = o.x1; hit = o; }
        }
        return { v: d > 0 ? lim - hw : lim + hw, hit };
      }
      const edge = d > 0 ? b.y + h : b.y, to = edge + d;
      const by = this.boxes(b.x - hw + EPS, Math.min(edge, to), b.x + hw - EPS, Math.max(edge, to), self, withStones);
      let lim = to, hit = null;
      for (const o of by) {
        if (d > 0 && o.y0 >= edge - 1e-6 && o.y0 < lim) { lim = o.y0; hit = o; }
        if (d < 0 && o.y1 <= edge + 1e-6 && o.y1 > lim) { lim = o.y1; hit = o; }
      }
      return { v: d > 0 ? lim - h : lim, hit };
    }
    overlaps(x, y, hw, h, self, withStones) {
      return this.boxes(x - hw + EPS, y + EPS, x + hw - EPS, y + h - EPS, self, withStones).length > 0;
    }

    // ---------- players ----------
    addPlayer(id, name) {
      const p = {
        id, name: name || id, x: 0, y: 0, vx: 0, vy: 0, face: -1, grounded: false, support: null,
        in: { x: 0, jump: false }, jb: 0, grab: false, coyote: 0, jumping: false,
        hold: null, qi: 1, chain: 0, src: new Set(), leapt: false, apex: 0, kick: 0, cd: 0, stun: 0,
        safe: [0, 0], wall: 0, gems: 0, lean: 0,
        ink: 0, wcd: 0, wrote: [], slot: 0,
      };
      // the player's colour on the isle (1-4, WInk.PLAYERS): the lowest one free
      const used = new Set([...this.players.values()].map(o => o.slot));
      for (let s = 1; s <= 4 && !p.slot; s++) if (!used.has(s)) p.slot = s;
      p.slot = p.slot || 1 + (this.players.size % 4);
      this.players.set(id, p);
      this.spawn(p);
      this.refillInk(p);
      if (this.cj.pool === 'crew') this.crewInk = Math.min(this.inkMax(), (this.crewInk || 0) + 1);
      return p;
    }
    removePlayer(id) {
      const p = this.players.get(id);
      if (p && p.hold) this.dropHeld(p);
      this.players.delete(id);
    }
    spawn(p) {
      const n = [...this.players.keys()].indexOf(p.id);
      p.x = this.L.spawn + (n > 0 ? (n % 2 ? -0.7 : 0.7) * Math.ceil(n / 2) : 0);
      p.y = this.groundTop(p.x, this.h); p.vx = p.vy = 0; p.grounded = true; p.support = STATIC;
      p.hold = null; p.qi = 1; p.chain = 0; p.src.clear(); p.leapt = false; p.stun = 0;
      p.safe = [p.x, p.y]; p.face = -1;
    }
    // x in [-1, 1]; jump is whether the button is held (for jump height)
    setInput(id, x, jump) {
      const p = this.players.get(id);
      if (!p) return;
      p.in.x = clamp(+x || 0, -1, 1);
      p.in.jump = !!jump;
      if (Math.abs(p.in.x) > 0.15 && !this.started) { this.started = true; this.ev('start', {}); }
    }
    press(id, what) {
      const p = this.players.get(id);
      if (!p) return;
      if (what === 'jump') { p.jb = this.as.buffer + 1e-6; p.in.jump = true; }
      if (what === 'grab') p.grab = true;
    }

    ev(t, d) { this.events.push(Object.assign({ t }, d)); }
    drain() { const e = this.events; this.events = []; return e; }

    // ---------- the step ----------
    step(dt) {
      this.clock += dt;
      if (this.started && this.phase === 'play') this.time += dt;
      for (const p of this.players.values()) this.stepPlayer(p, dt);
      const order = this.stones.filter(s => s.state !== 'gone').sort((a, b) => a.y - b.y || a.id - b.id);
      for (const k of order) this.stepStone(k, dt);
      this.stepFusion();
      this.stepWalls();
      this.stepWrong(dt);
      this.stepSprings(dt);
      this.stepGems();
      if (this.dusk > 0) { this.dusk -= dt; if (this.dusk <= 0) this.setDusk(0); }
      this.stepInk(dt);
      for (const c of this.clouds) if (c.t > 0) c.t -= dt;
      if (this.phase === 'play') this.checkWin();
    }

    // Touching a source in the air gives a charge back, but only when you need one (a source is not
    // used up by brushing it before you leapt) and only once per chain for each source.
    refill(p, key, kind) {
      if (!this.qi.refill.includes(kind) || p.grounded || p.qi > 0 || p.src.has(key)) return false;
      if (!(kind === 'wall' && this.qi.wallKey === 'any')) p.src.add(key);
      p.qi = 1;
      this.ev('refill', { id: p.id, src: kind });
      return true;
    }

    stepPlayer(p, dt) {
      const carrying = !!p.hold;
      const ix = p.stun > 0 ? 0 : p.in.x;
      if (Math.abs(ix) > 0.2) p.face = sgn(ix);
      const top = carrying ? CARRY_RUN : RUN;
      const acc = p.grounded ? ACC_G : p.kick > 0 ? 4 : ACC_A;
      const want = ix * top;
      p.vx += clamp(want - p.vx, -acc * dt, acc * dt);
      for (const t of ['jb', 'kick', 'cd', 'stun']) if (p[t] > 0) p[t] -= dt;
      if (!p.grounded && p.coyote > 0) p.coyote -= dt;

      // jump, then 轻功
      if (p.jb > 0 && p.stun <= 0) {
        if (p.grounded || p.coyote > 0) {
          p.vy = leapV(this.qi.jump); p.grounded = false; p.coyote = 0; p.jb = 0; p.jumping = true; p.jumpT = 0; p.support = null;
          this.ev('jump', { id: p.id });
        } else if (p.qi > 0 && p.cd <= 0 && p.chain < (carrying ? this.qi.carry : this.qi.chain)) {
          p.vy = leapV(this.qi.leap); p.jb = 0; p.jumping = false; p.leapt = true; p.apex = this.qi.float;
          p.qi = 0; p.chain++; p.cd = this.qi.cooldown;
          // off a wall: pushing into it climbs straight up it; anything else kicks you away from it
          if (p.wall && Math.sign(ix) !== p.wall) { p.vx = -p.wall * this.qi.kick; p.kick = 0.16; p.face = -p.wall; }
          this.ev('leap', { id: p.id, chain: p.chain, kick: !!p.wall });
        }
      }
      if (p.jumping) p.jumpT += dt;
      if (p.jumping && !p.in.jump && p.vy > 0 && p.jumpT >= this.as.minJump) { p.vy *= JUMP_CUT; p.jumping = false; }

      // GRAB
      if (p.grab) { p.grab = false; this.act(p); }

      // horizontal
      const dx = p.vx * dt;
      const skip = this.inside(p);
      const sx = this.sweep(p, PW, PH, 'x', dx, null, { skip, restingOnly: true });
      if (sx.hit) {
        const o = sx.hit;
        let done = false;
        // push a resting stone along the ground
        if (this.fz.push && o.ref !== STATIC && p.grounded && !carrying && Math.abs(o.ref.y - p.y) < 0.2 && !this.stoneOn(o.ref) && (p.lean += dt) >= PUSH_DELAY) {
          const s = o.ref, want = dx * PUSH;
          const m = this.sweep(s, SW, SH, 'x', want, s, { restingOnly: true });
          if (Math.abs(m.v - s.x) > 1e-5) { s.x = m.v; s.pushed = true; s.pushT = 0.12; s.placer = p.id; s.from = [s.x, s.y]; }
          p.x = sgn(dx) > 0 ? s.x - SW - PW : s.x + SW + PW;
          done = true;
        }
        // climb onto a ledge that is only just above the feet (ASSIST.nudge)
        if (!done && !p.grounded && p.vy <= 1 && this.as.nudge > 0) {
          const ty = o.y1, rise = ty - p.y;
          if (rise > 0 && rise <= this.as.nudge && !this.overlaps(p.x + dx, ty, PW, PH, null, { skip, restingOnly: true })) {
            p.x += dx; p.y = ty; p.vy = 0; done = true;
            this.ev('nudge', { id: p.id });
          }
        }
        if (!done) { p.x = sx.v; p.vx = Math.sign(p.vx) * Math.min(Math.abs(p.vx), 1); }
        if (o.ref === STATIC) p.lean = 0;
        if (HURTS[o.t]) this.ouch(p, sgn(-dx), false, HURTS[o.t]);
      } else { p.x = sx.v; p.lean = 0; }

      // wall contact (for the wall kick and the refill)
      p.wall = 0;
      if (!p.grounded) {
        for (const side of [-1, 1]) {
          const bx = this.boxes(side > 0 ? p.x + PW : p.x - PW - 0.06, p.y + 0.2, side > 0 ? p.x + PW + 0.06 : p.x - PW, p.y + PH - 0.1, null, { skip, restingOnly: true });
          const wall = bx.find(b => b.t === '#' || b.t === 'b' || b.t === '=' || b.ref !== STATIC);
          if (wall) {
            p.wall = side;
            if (wall.ref !== STATIC) this.refill(p, 's' + wall.ref.id, 'stone');
            else this.refill(p, 'w' + wall.cx + (side > 0 ? 'L' : 'R') + (this.qi.wallKey === 'band' ? ':' + Math.floor(p.y / 2) : ''), 'wall');
          }
        }
      }

      // vertical
      let g = G;
      if (p.leapt && p.apex > 0 && p.vy < 2.5) { g *= this.qi.floatG; p.apex -= dt; }
      p.vy = Math.max(-MAX_FALL, p.vy - g * dt);
      const was = p.grounded;
      const sy = this.sweep(p, PW, PH, 'y', p.vy * dt, null, { skip, restingOnly: true });
      p.y = sy.v;
      if (sy.hit && p.vy <= 0) {
        const o = sy.hit;
        if (!was && p.vy < -6) this.ev('land', { id: p.id, v: Math.round(-p.vy) });
        p.vy = 0; p.grounded = true; p.support = o.ref; p.leapt = false; p.jumping = false;
        p.qi = 1; p.chain = 0; p.src.clear();
        if (HURTS[o.t]) this.ouch(p, sgn(p.x - (o.x0 + 0.5)) || -p.face, true, HURTS[o.t]);
        else if (o.ref === STATIC) {
          // remember safe ground: well back from any edge (a respawn on the lip of a gap with the
          // stick still held walks you straight back in; found by screen-check.py), never thorns
          const firm = dx => { const c = this.cell(Math.floor(p.x + dx), o.cy); return this.solid(Math.floor(p.x + dx), o.cy) && !WALL_OF[c] && !this.solid(Math.floor(p.x + dx), o.cy + 1); };
          if (firm(-0.7) && firm(0) && firm(0.7)) p.safe = [p.x, p.y];
        }
      } else {
        if (sy.hit && p.vy > 0) p.vy = 0;              // head bump
        if (was) p.coyote = this.as.coyote;
        p.grounded = false; p.support = null;
      }

      // the river
      if (p.y < WATER) {
        this.ev('splash', { id: p.id, x: p.x, y: 1 });
        if (p.hold && !this.as.keepOnFall) { const k = p.hold; this.dropHeld(p); this.returnStone(k, 'fell'); }
        p.x = p.safe[0]; p.y = p.safe[1]; p.vx = p.vy = 0; p.grounded = true; p.support = STATIC;
        p.qi = 1; p.chain = 0; p.src.clear(); p.leapt = false;
        this.ev('respawn', { id: p.id });
      }
      // never end a step inside rock (a bridge or a stone can appear where you are)
      for (let n = 0; n < 3 && this.overlaps(p.x, p.y, PW, PH, null, null); n++) p.y = Math.floor(p.y) + 1;
    }

    // stones the player is already overlapping do not block them (a stone set down into you)
    inside(p) {
      const s = new Set();
      for (const k of this.stones) if (k.state === 'loose' && Math.abs(k.x - p.x) < SW + PW - 0.02 && k.y < p.y + PH - 0.02 && k.y + SH > p.y + 0.02) s.add(k);
      return s;
    }
    stoneOn(s) { return this.stones.some(o => o.state === 'loose' && o.support === s); }

    ouch(p, away, top, wall) {
      p.vx = away * 5; p.vy = top ? 9 : 6.5; p.stun = 0.3; p.grounded = false; p.support = null; p.kick = 0.3;
      this.ev('ouch', { id: p.id, wall: wall || 'thorn' });
    }

    // ---------- GRAB ----------
    // What GRAB would do right now. One function serves the press and the button's label.
    // The label names the placement, never what it will make (P9).
    launch(p) {
      if (this.phase !== 'play' || p.stun > 0) return { mode: 'none', label: '' };
      if (!p.hold) {
        const k = this.reachStone(p);
        return k ? { mode: 'grab', k, label: 'GRAB ' + k.ch } : { mode: 'none', label: 'GRAB' };
      }
      const h = p.hold, fz = this.fz;
      if (h.ch === this.L.want && Math.abs(p.x - this.pav.x) < PAV_R && Math.abs(p.y - this.pav.y) < 0.6) return { mode: 'offer', label: 'OFFER' };
      if (!p.grounded) {
        // in the air above a stone: let go, and it drops on top of it
        let below = null;
        for (const s of this.stones) {
          if (s.state !== 'loose' || !s.grounded || Math.abs(s.x - p.x) > fz.stackR) continue;
          const top = s.y + SH;
          if (top > p.y + 0.05 || p.y - top > 5) continue;
          if (!below || top > below.y + SH) below = s;
        }
        if (below) return { mode: 'drop', on: below, x: p.x, label: 'ON TOP' };
        return { mode: 'release', label: 'DROP' };
      }
      const sup = p.support;
      if (sup && sup !== STATIC && sup.state === 'loose' && !this.stoneOn(sup)) {
        const y = sup.y + SH;
        if (!this.overlaps(sup.x, y, SW, SH, h, { restingOnly: true, skip: new Set([sup]) }) && !this.overlaps(p.x, y + SH, PW, PH, null, null)) return { mode: 'stack', on: sup, x: sup.x, y, label: 'ON TOP' };
      }
      // facing a resting stone at your level: set yours beside it, on your side
      let t = null, td = 0.75;
      for (const s of this.stones) {
        if (s.state !== 'loose' || !s.grounded || Math.abs(s.y - p.y) > 0.45) continue;
        const d = (s.x - p.x) * p.face - SW - PW;
        if (d < -0.1 || d > td) continue;
        td = d; t = s;
      }
      if (t) {
        const side = sgn(p.x - t.x), x = t.x + side * fz.ideal, y = t.y;
        if (!this.overlaps(x, y, SW, SH, h, { restingOnly: true })) return { mode: 'beside', on: t, x, y, side, label: 'BESIDE' };
      }
      if (Math.abs(p.in.x) > 0.3) return { mode: 'toss', label: 'THROW' };
      const x = p.x + p.face * (PW + SW + 0.05);
      if (!this.overlaps(x, p.y + 0.02, SW, SH, h, { restingOnly: true })) return { mode: 'place', x, y: p.y, label: 'SET DOWN' };
      return { mode: 'none', label: 'SET DOWN' };
    }

    // the stone GRAB picks up: in front of you at your level first (the top of a stack), else the
    // one you stand on
    reachStone(p) {
      let best = null, bs = Infinity;
      for (const s of this.stones) {
        if (s.state !== 'loose' || s.snap || s === p.support || !(s.grounded || s.pushed)) continue;
        const gap = Math.abs(s.x - p.x) - SW - PW;
        if (gap > 0.55 || s.y > p.y + PH || s.y + SH < p.y - 0.2) continue;
        const facing = (s.x - p.x) * p.face >= -0.05;
        const score = gap + (facing ? 0 : 1) - s.y * 0.01;
        if (score < bs) { bs = score; best = s; }
      }
      if (!best && p.support && p.support !== STATIC && p.support.state === 'loose') best = p.support;
      // a stack: take the top stone
      while (best) { const up = this.stones.find(o => o.state === 'loose' && o.support === best); if (!up) break; best = up; }
      return best;
    }

    act(p) {
      const l = this.launch(p);
      const h = p.hold;
      switch (l.mode) {
        case 'grab': this.holdStone(p, l.k); break;
        case 'offer':
          p.hold = null; h.holder = null; h.state = 'offer'; h.offer = { t: 0, x0: h.x, y0: h.y, by: p.id };
          this.ev('offer', { id: p.id, s: h.id, ch: h.ch });
          break;
        case 'drop':
        case 'release': {
          // the stone goes under your feet and falls; too close to the floor, it lands at once and
          // you hop up onto it
          const fy = this.floorUnder(p.x, SW, p.y, h);
          if (p.y - fy >= SH + 0.02) this.loosen(p, h, p.x, p.y - SH - 0.02, l.mode === 'drop' ? 0 : p.vx * 0.3, -2);
          else { this.loosen(p, h, p.x, fy, 0, 0); p.y = fy + SH; }
          p.vy = Math.max(p.vy, l.mode === 'drop' ? 5.5 : 4);
          this.ev('place', { id: p.id, mode: l.mode, s: h.id, on: l.on ? l.on.id : 0 });
          break;
        }
        case 'stack':
          this.loosen(p, h, l.x, l.y, 0, 0);
          p.y = l.y + SH; p.vy = 0; p.support = h;
          this.ev('place', { id: p.id, mode: 'stack', s: h.id, on: l.on.id });
          break;
        case 'beside': {
          this.loosen(p, h, l.x, l.y, 0, 0);
          // step back to make room; with a wall behind you, stand on the stone instead
          if (Math.abs(p.x - l.x) < SW + PW) {
            const px = l.x + l.side * (SW + PW + 0.02);
            if (!this.overlaps(px, p.y, PW, PH, null, { restingOnly: true })) p.x = px;
            else { p.y = l.y + SH; p.vy = 0; }
          }
          this.ev('place', { id: p.id, mode: 'beside', s: h.id, on: l.on.id });
          break;
        }
        case 'toss':
          this.loosen(p, h, p.x, p.y + HOLD_Y, p.face * TOSS_VX + p.vx * 0.25, TOSS_VY);
          h.flying = true;
          this.ev('throw', { id: p.id, s: h.id });
          break;
        case 'place':
          this.loosen(p, h, l.x, l.y, 0, 0);
          this.ev('place', { id: p.id, mode: 'place', s: h.id });
          break;
      }
    }

    // the top of whatever is under a box of half-width hw whose bottom is at y (rock or a resting stone)
    floorUnder(x, hw, y, self) {
      return this.sweep({ x, y }, hw, 0.01, 'y', -(y + 2), self, { restingOnly: true }).v;
    }

    holdStone(p, k) {
      k.state = 'held'; k.holder = p; k.grounded = false; k.support = null; k.snap = null; k.ready = 0;
      k.vx = k.vy = 0; k.flying = false; k.from = null;
      p.hold = k;
      this.ev('grab', { id: p.id, s: k.id, ch: k.ch });
    }
    loosen(p, k, x, y, vx, vy) {
      p.hold = null;
      k.state = 'loose'; k.holder = null; k.x = x; k.y = y; k.vx = vx; k.vy = vy;
      k.grounded = false; k.support = null; k.placer = p.id; k.thrower = p; k.from = [x, y];
    }
    dropHeld(p) {
      const k = p.hold;
      if (!k) return;
      this.loosen(p, k, p.x, p.y + 0.02, 0, 0);
    }
    returnStone(k, why) {
      const to = k.home;
      k.state = 'loose'; k.holder = null; k.x = to[0]; k.y = to[1] + 0.5; k.vx = k.vy = 0;
      k.grounded = false; k.support = null; k.flying = false; k.snap = null;
      this.ev('stoneReturn', { s: k.id, ch: k.ch, why });
    }

    // ---------- conjure: write a character, hold its stone (docs/CONJURE.md) ----------
    // What this isle lets you write: its `write` list, else the characters lying on it; never its goal (CJ2-03).
    writable() {
      const L = this.L, out = [];
      for (const ch of L.write || L.stones.map(s => s[0])) if (ch !== L.want && RU.GLYPHS[ch] && !out.includes(ch)) out.push(ch);
      return out;
    }
    inkMax() { return this.cj.pool === 'crew' ? this.cj.ink + Math.max(0, this.players.size - 1) : this.cj.ink; }
    refillInk(p) { p.ink = this.cj.ink; p.wcd = 0; p.wrote = []; }
    // the drops player `id` can spend now (their own, or the crew's)
    inkOf(id) { const p = this.players.get(id); return !p ? 0 : this.cj.pool === 'crew' ? this.crewInk : p.ink; }
    stepInk(dt) {
      const r = dt / this.cj.regen;
      if (this.cj.pool === 'crew') this.crewInk = Math.min(this.inkMax(), this.crewInk + r);
      for (const p of this.players.values()) {
        if (this.cj.pool !== 'crew') p.ink = Math.min(this.cj.ink, p.ink + r);
        if (p.wcd > 0) p.wcd -= dt;
      }
    }
    // Would a write by `id` work now? null if so, else the reason (the pad shows it before you tap).
    writeWhy(id, ch, opt) {
      const p = this.players.get(id);
      if (this.phase !== 'play') return 'phase';
      if (!p) return 'away';
      if (ch === this.L.want) return 'want';
      if (!this.writable().includes(ch)) return 'unknown';
      if (opt && opt.pick && !this.cj.pick) return 'pick';
      if (p.wcd > 0) return 'cooldown';
      if (this.inkOf(id) < 1) return 'ink';
      return null;
    }
    // Player `id` wrote `ch` (opt.pick: chose it without drawing). The stone goes into empty hands, else it
    // drops in front of you (CJ2-05). Returns { ok, why, stone, held }.
    write(id, ch, opt) {
      const why = this.writeWhy(id, ch, opt);
      if (why) { this.ev('writeNo', { id, ch, why }); return { ok: false, why }; }
      const p = this.players.get(id);
      // past the cap, your oldest written stone fades (never a refusal: CJ2-07)
      p.wrote = p.wrote.filter(sid => this.stones.some(k => k.id === sid && k.state !== 'gone'));
      while (p.wrote.length >= this.cj.own) {
        const old = this.stones.find(k => k.id === p.wrote[0]);
        p.wrote.shift();
        if (old) { const at = old.holder ? { x: old.holder.x, y: old.holder.y + HOLD_Y } : { x: old.x, y: old.y }; this.consume(old); this.ev('fade', { id, s: old.id, ch: old.ch, x: at.x, y: at.y }); }
      }
      if (this.stones.filter(s => s.state !== 'gone').length >= MAX_STONES) { this.ev('writeNo', { id, ch, why: 'full' }); return { ok: false, why: 'full' }; }
      const held = !p.hold && p.stun <= 0;
      let k;
      if (held) {
        k = this.addStone(ch, p.x, p.y + HOLD_Y, null);
        this.holdStone(p, k);
      } else {
        // just above head height in front of you, so it falls onto what is there (rock in the way: over your head)
        let x = p.x + p.face * (PW + SW + 0.05), y = p.y + PH + 0.1;
        if (this.overlaps(x, y, SW, SH, null, { restingOnly: true })) { x = p.x; y = p.y + HOLD_Y + SH + 0.05; }
        k = this.addStone(ch, x, y, null);
        k.vy = 1; k.placer = id; k.from = [x, y];
      }
      k.by = id; k.conj = true; k.home = [p.safe[0], p.safe[1]];
      p.wrote.push(k.id);
      if (this.cj.pool === 'crew') this.crewInk -= 1; else p.ink -= 1;
      p.wcd = this.cj.cooldown;
      if (!this.started) { this.started = true; this.ev('start', {}); }
      this.ev('write', { id, ch, s: k.id, held, pick: !!(opt && opt.pick), x: k.x, y: k.y });
      return { ok: true, stone: k, held };
    }

    // ---------- stones ----------
    addStone(ch, x, y, spring) {
      if (this.stones.filter(s => s.state !== 'gone').length >= MAX_STONES) return null;
      const g = RU.GLYPHS[ch];
      const k = {
        id: this.nextId++, ch, g, x, y, vx: 0, vy: 0, state: 'loose', holder: null, grounded: false,
        support: null, spring: spring || null, home: [x, y], from: null, placer: null, thrower: null,
        ready: 0, snap: null, pop: false, flying: false, pushed: false, pushT: 0,
      };
      this.stones.push(k);
      return k;
    }
    consume(k) {
      if (k.holder) k.holder.hold = null;
      k.state = 'gone'; k.holder = null;
      if (k.spring && k.spring.stone === k) { k.spring.stone = null; k.spring.wait = REGROW; }
      this.stones = this.stones.filter(s => s !== k);
    }

    stepStone(k, dt) {
      if (k.state === 'held') {
        const p = k.holder;
        k.x = p.x; k.y = p.y + HOLD_Y;
        return;
      }
      if (k.state === 'offer') {
        const o = k.offer;
        o.t += dt;
        const u = Math.min(1, o.t / OFFER_T), tx = this.pav.x, ty = this.pav.y + 1.1;
        k.x = o.x0 + (tx - o.x0) * u; k.y = o.y0 + (ty - o.y0) * u + Math.sin(u * Math.PI) * 1.2;
        if (u >= 1) this.win(k, o.by);
        return;
      }
      if (k.state !== 'loose') return;
      const was = k.grounded;
      // pushing: a stone that stops being pushed has come to rest in a new place
      if (k.pushed) {
        k.pushT -= dt;
        if (k.pushT <= 0) { k.pushed = false; this.settle(k); }
      }
      if (k.snap) { this.stepSnap(k, dt); return; }
      // horizontal flight: stop against rock or a resting stone, and land touching it
      if (k.vx) {
        const sx = this.sweep(k, SW, SH, 'x', k.vx * dt, k, { restingOnly: true });
        k.x = sx.v;
        if (sx.hit) k.vx = 0;
      }
      k.vy = Math.max(-MAX_FALL, k.vy - G * dt);
      const sy = this.sweep(k, SW, SH, 'y', k.vy * dt, k, { restingOnly: true });
      k.y = sy.v;
      if (sy.hit && k.vy <= 0) {
        const o = sy.hit;
        // landing on a stone off-centre: slide off it instead of balancing on a corner
        if (o.ref !== STATIC && Math.abs(k.x - o.ref.x) > this.fz.stackR) {
          const side = sgn(k.x - o.ref.x), nx = o.ref.x + side * (2 * SW + 0.01);
          // (and stop its flight: a thrown stone that kept its speed slid back over the corner every frame
          // and hung there in the air for good; found by the automated player, docs/AUTOTEST.md §5 S3)
          if (!this.overlaps(nx, k.y, SW, SH, k, { restingOnly: true })) { k.x = nx; k.vx = 0; k.grounded = false; k.support = null; return; }
        }
        // resting on rock with its middle over air: it tips over the edge
        if (o.ref === STATIC && !this.solid(Math.floor(k.x), o.cy)) {
          const side = this.solid(Math.floor(k.x) - 1, o.cy) ? 1 : -1;
          const nx = side > 0 ? Math.floor(k.x) + SW + 0.01 : Math.floor(k.x) + 1 - SW - 0.01;
          if (!this.overlaps(nx, k.y, SW, SH, k, { restingOnly: true })) { k.x = nx; k.vx = side * 0.5; k.grounded = false; k.support = null; return; }
        }
        k.vy = 0; k.vx = 0; k.grounded = true; k.support = o.ref === STATIC ? null : o.ref; k.flying = false;
        if (!was) { k.pushed = false; this.ev('thud', { s: k.id }); this.settle(k); }
      } else {
        if (sy.hit && k.vy > 0) k.vy = 0;
        k.grounded = false; k.support = null;
        // 木 does what it means: dropped into a gap, it grows across it
        if (RU.FILLS.includes(k.g.el) && k.vy < 0 && this.phase === 'play') {
          const run = this.gapRun(k);
          if (run) { this.growBridge(k, run); return; }
        }
      }
      if (k.y < WATER) this.returnStone(k, 'fell');
      if (k.grounded) { k.pop = false; k.flying = false; }
    }

    // The run of '_' cells this falling stone is in, if the stone's span covers it.
    gapRun(k) {
      const cy = Math.floor(k.y + 0.2), cx = Math.floor(k.x);
      if (this.cell(cx, cy) !== '_') return null;
      let a = cx, b = cx;
      while (this.cell(a - 1, cy) === '_') a--;
      while (this.cell(b + 1, cy) === '_') b++;
      const len = b - a + 1;
      return len <= (k.g.span || 0) ? { x0: a, x1: b + 1, cy } : null;
    }
    growBridge(k, run) {
      for (let x = run.x0; x < run.x1; x++) this.cells[run.cy][x] = '=';
      const m = { ch: k.ch, el: k.g.el, x0: run.x0, x1: run.x1, y: run.cy + 1, t: this.clock };
      this.bridges.push(m);
      this.ev('bridge', { ch: k.ch, el: k.g.el, x0: run.x0, x1: run.x1, y: run.cy + 1, by: k.placer });
      this.consume(k);
    }

    // ---------- forging on the ground ----------
    partners(k) {
      return this.stones.filter(o => o !== k && o.state === 'loose' && o.grounded && !o.snap && !(k.spring && o.spring && !k.from && !o.from));
    }

    // A loose stone has come to rest. In a placement: snap to the ideal spot (K4), forge when the
    // snap ends. Not in one but close: tell the player it was nearly (FG-D017 `near`).
    settle(k) {
      if (this.phase !== 'play') return;
      if (this.dusk > 0 && k.g.el === 'light' && !k.pop) this.setDusk(0, k.placer);
      const fz = this.fz, rel = bestRelation(k, this.partners(k), fz);
      k.ready = k.pop ? 2 : 1;
      if (!rel) {
        k.ready = 0;
        const wide = Object.assign({}, fz, { besideY: fz.besideY * 1.5, besideR: [fz.besideR[0] / 1.15, fz.besideR[1] * 1.5] });
        const near = bestRelation(k, this.partners(k), wide);
        if (near && fz.near && !k.pop) this.ev('near', { op: near.op, a: near.first.ch, b: near.second.ch, ia: near.first.id, ib: near.second.id, by: k.placer || null });
        return;
      }
      if (fz.snap > 0 && rel.err > 1e-6) {
        const o = rel.partner, top = rel.op === '⿱';
        const tx = top ? o.x : o.x + sgn(k.x - o.x) * fz.ideal;
        if (!this.overlaps(tx, k.y, SW, SH, k, { restingOnly: true, skip: new Set([o]) })) { k.snap = { t: 0, x0: k.x, x1: tx }; return; }
      }
    }
    stepSnap(k, dt) {
      const sn = k.snap;
      sn.t += dt;
      const u = Math.min(1, sn.t / this.fz.snap);
      k.x = sn.x0 + (sn.x1 - sn.x0) * u;
      if (u >= 1) k.snap = null;
    }

    stepFusion() {
      if (this.phase !== 'play') return;
      for (const k of this.stones.slice()) {
        if (!k.ready || k.snap || k.state !== 'loose' || !k.grounded) continue;
        const quiet = k.ready === 2;
        k.ready = 0;
        const rel = bestRelation(k, this.partners(k), this.fz);
        if (rel) this.tryForge(rel, k.placer || null, { quiet });
      }
    }

    // The single path for every forge attempt. Forges, rescues (K5) or duds; a dud uses nothing up.
    tryForge(rel, by, opt = {}) {
      const a = rel.first, b = rel.second, fz = this.fz;
      const pair = Math.min(a.id, b.id) + ',' + Math.max(a.id, b.id);
      if (this.cool.has(pair) && this.cool.get(pair) > this.clock) return null;
      let op = rel.op, first = a, second = b, ch = RU.fuse(op, a.ch, b.ch), rescued = false;
      if (!ch) {
        const alts = RU.mirrors(a.ch, b.ch).filter(r => r[0] !== '⿱⿰');
        if (fz.rescue === 'unique' && alts.length === 1) {
          const r = alts[0];
          op = r[0]; ch = r[3]; rescued = true;
          if (r[1] !== a.ch) { first = b; second = a; }
        } else {
          const why = alts.length ? 'mirror' : 'dud';
          if (fz.dudCd > 0) this.cool.set(pair, this.clock + fz.dudCd);
          if (!opt.quiet) this.ev('dud', { op, why, a: a.ch, b: b.ch, ia: a.id, ib: b.id, other: why === 'mirror' && fz.dudHint === 'other', by });
          return null;
        }
      }
      const bot = op === '⿱' ? second : null;
      const x = bot ? bot.x : (a.x + b.x) / 2, y = bot ? bot.y : Math.min(a.y, b.y);
      // whoever stood on the pieces is lifted off them, not trapped inside the result
      this.consume(a); this.consume(b);
      const k = this.addStone(ch, x, y, null);
      const wrong = ch !== this.L.want && !this.wantTree.has(ch);
      if (k) {
        k.from = [x, y]; k.home = [x, y]; k.vy = 6; k.pop = true; k.parts = [op, first.ch, second.ch];
        if (wrong && fz.wrongLife !== Infinity) k.life = fz.wrongLife;
      }
      this.ev('forge', { op, a: first.ch, b: second.ch, ch, x, y, s: k ? k.id : 0, by, rescued, wrong });
      if (k && k.g.el === 'dusk') this.setDusk(DUSK_TIME, by);
      return k;
    }

    // K7: a wrong-but-real character splits back into its two pieces.
    stepWrong(dt) {
      if (this.fz.wrongLife === Infinity || this.phase !== 'play') return;
      for (const k of this.stones.slice()) {
        if (k.life === undefined || k.state === 'gone' || k.state === 'offer') continue;
        k.life -= dt;
        if (k.life > 0) continue;
        const at = k.holder ? { x: k.holder.x, y: k.holder.y } : { x: k.x, y: k.y };
        const [op, ca, cb] = k.parts;
        this.consume(k);
        const out = [];
        for (const [ch, s] of [[ca, -1], [cb, 1]]) {
          const n = this.addStone(ch, at.x + s * 0.7, at.y + 0.3, null);
          if (n) { n.from = [n.x, n.y]; n.home = [n.x, at.y]; n.vy = 4; n.vx = s * 1.5; n.pop = true; out.push(n.id); }
        }
        this.ev('split', { s: k.id, ch: k.ch, op, a: ca, b: cb, out });
      }
    }

    setDusk(t, by) {
      const was = this.dusk > 0;
      this.dusk = t;
      if (was !== t > 0) this.ev('dusk', { on: t > 0, by: by || null });
    }

    // 火 burns thorns, 水 douses flames, light dispels shade: carried, lying or thrown, it works the same.
    stepWalls() {
      for (const m of this.hedges) {
        if (m.done) continue;
        const W = RU.WALLS[m.wall];
        for (const k of this.stones) {
          if (k.state === 'gone' || k.g.el !== W.el) continue;
          const cx = k.x, cy = k.y + SH / 2;
          const dx = cx - clamp(cx, m.x0, m.x1), dy = cy - clamp(cy, m.y0, m.y1);
          if (Math.hypot(dx, dy) < RU.reachOf(k.g) + SW) {
            m.done = true;
            for (let y = m.y0; y < m.y1; y++) this.cells[y][m.x0] = '.';
            this.burnt.push({ x0: m.x0, x1: m.x1, y0: m.y0, y1: m.y1, t: this.clock, wall: m.wall });
            this.ev(W.verb, { id: m.id, wall: m.wall, ch: k.ch, x: (m.x0 + m.x1) / 2, y: (m.y0 + m.y1) / 2, by: k.holder ? k.holder.id : k.placer });
            break;
          }
        }
      }
    }

    stepSprings(dt) {
      if (!this.L.regrow) return;
      for (const sp of this.springs) {
        if (sp.stone) continue;
        sp.wait -= dt;
        if (sp.wait > 0) continue;
        // never grow under or into another stone or a player
        const busy = this.stones.some(o => Math.abs(o.x - sp.x) < 1.4 && Math.abs(o.y - sp.y) < 1.5) ||
          [...this.players.values()].some(p => Math.abs(p.x - sp.x) < SW + PW && Math.abs(p.y - sp.y) < SH);
        if (busy) {
          // something lies on its spot (often a character forged right there): say so once, after a while
          sp.wait = 0.5; sp.blocked = (sp.blocked || 0) + 0.5;
          if (sp.blocked >= BLOCKED_SAY && !sp.told) { sp.told = true; this.ev('springBlocked', { ch: sp.ch, x: sp.x, y: sp.y }); }
          continue;
        }
        const k = this.addStone(sp.ch, sp.x, sp.y, sp);
        sp.blocked = 0; sp.told = false;
        if (k) { sp.stone = k; k.grounded = true; this.ev('regrow', { s: k.id, ch: k.ch }); } else sp.wait = 1;
      }
    }

    stepGems() {
      for (const p of this.players.values()) {
        const cx = p.x, cy = p.y + PH / 2;
        for (const [list, glow] of [[this.gems, false], [this.glow, true]]) {
          for (let i = 0; i < list.length; i++) {
            const g = list[i];
            if (g.got || (glow && !(this.dusk > 0))) continue;
            if (Math.hypot(cx - g.x, cy - g.y) < 0.75) {
              g.got = true; p.gems++;
              this.refill(p, 'g' + (glow ? 'l' : '') + i, 'gem');
              this.ev('gem', { i, glow, id: p.id });
            }
          }
        }
        if (!p.grounded) for (const c of this.clouds) {
          if (Math.hypot(cx - c.x, cy - c.y) < 0.85 && this.refill(p, c.id, 'cloud')) { c.t = 0.6; this.ev('cloud', { id: p.id, c: c.id }); }
        }
      }
    }

    checkWin() {
      for (const k of this.stones) {
        if (k.state !== 'loose' || !k.grounded || k.ch !== this.L.want) continue;
        if (Math.abs(k.x - this.pav.x) < 1.2 && Math.abs(k.y - this.pav.y) < 0.6) { this.win(k, k.placer); return; }
      }
    }
    win(k, by) {
      if (this.phase !== 'play') return;
      k.state = 'scored'; k.x = this.pav.x; k.y = this.pav.y + 1.1;
      const got = this.gems.filter(g => g.got).length + this.glow.filter(g => g.got).length;
      this.phase = 'won';
      this.result = { ch: k.ch, by: by || null, time: Math.round(this.time * 10) / 10, gems: got, total: this.gems.length + this.glow.length, last: this.index === this.isles.length - 1 };
      this.ev('win', this.result);
    }

    // The placement every resting stone is in right now, for the frames drawn round them:
    // [{ op, a, b, err }] with a the first piece. Each pair once.
    placements() {
      const out = [], seen = new Set();
      for (const k of this.stones) {
        if (k.state !== 'loose' || !k.grounded || k.snap) continue;
        const rel = bestRelation(k, this.partners(k), this.fz);
        if (!rel) continue;
        const key = Math.min(rel.first.id, rel.second.id) + ',' + Math.max(rel.first.id, rel.second.id);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ op: rel.op, a: rel.first, b: rel.second, err: rel.err });
      }
      return out;
    }
  }

  const api = { World, FORGE, QI, ASSIST, CONJURE, PROFILES, knobs, relate, bestRelation, STATIC,
    consts: { G, PW, PH, SW, SH, RUN, CARRY_RUN, HOLD_Y, WATER, DUSK_TIME, REGROW, PAV_R } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
