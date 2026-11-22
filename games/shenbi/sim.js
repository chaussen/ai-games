// sim.js: the Shenbi world. Pure logic: no DOM, no sockets, no timers, no Math.random. The same seed and the same
// inputs always give the same world, and restore(snapshot()) continues bit for bit (docs/REACTIONS.md §7).
//
// World: a grid of cells (x right, y UP, row 0 is the bottom, one cell = one unit) with ONE material per cell, plus an
// entity layer (players, written objects) in cell units with sub-cell positions. Rules are data (reactions.js):
// this file only knows how to find a rule and how to carry out its effects.
//
// Phase 1A scope: grid, 12 materials, rules R1-R12 (+R27), wield / throw / place, playful body effects, caps,
// snapshot/restore, hash. A full scan of the grid every tick (14,400 cells at 160x90 is microseconds); chunk
// sleeping is left for the bigger world of Phase 5 and only if measurement asks for it.
(function (root) {
  'use strict';
  const RX = (typeof module !== 'undefined' && module.exports) ? require('./reactions.js') : root.WReact;
  const { M, MATERIALS, RULES, BEHAVIOURS, CELL, TICK, BODY, CONJURE, CAPS, BODY_TAGS, matches } = RX;

  const DT = 1 / TICK;
  const N = MATERIALS.length;
  const AIR = M.air, FIRE = M.fire, WATER = M.water, STEAM = M.steam, ASH = M.ash, MUD = M.mud;
  // body and movement constants (world scale, not knobs)
  const G = 34, PHW = 0.3, PH = 1.2, RUN = 4.6, JUMP = 12.2, ACC_G = 40, ACC_A = 22, MAX_FALL = 18;
  const OHS = 0.4;                       // an object is a 0.8 x 0.8 box; its x is the centre, its y the bottom
  const PROJ_G = 12, REACH_T = 0.25;
  const SOLID = MATERIALS.map(m => m.solid);
  const FLOW = MATERIALS.map(m => m.flow);
  const CELLTAGS = MATERIALS.map(m => new Set(m.tags.concat('cell')));
  const BODYSET = new Set(BODY_TAGS);

  // ---------- rule lookup ----------
  const ruleCache = new Map();
  // all rules whose a / b / ctx fit these tag lists; cached by a string key (entities keep short tag lists)
  function rulesFor(aTags, bTags, ctx) {
    const key = ctx + '|' + aTags.join(',') + '|' + bTags.join(',');
    let r = ruleCache.get(key);
    if (!r) {
      r = RULES.filter(u => u.ctx.indexOf(ctx) >= 0 && matches(u.a, aTags) && matches(u.b, bTags));
      ruleCache.set(key, r);
    }
    return r;
  }
  // cell-cell tables: ADJ[ma*N+mb] and TOP[ma*N+mb] (a lies on top of b), built once from the data
  const ADJ = [], TOP = [], INSIDE = [];
  for (let a = 0; a < N; a++) {
    INSIDE[a] = rulesFor(Array.from(CELLTAGS[a]), BODY_TAGS, 'inside');
    for (let b = 0; b < N; b++) {
      ADJ[a * N + b] = rulesFor(Array.from(CELLTAGS[a]), Array.from(CELLTAGS[b]), 'adjacent');
      TOP[a * N + b] = rulesFor(Array.from(CELLTAGS[a]), Array.from(CELLTAGS[b]), 'on-top');
    }
  }

  class World {
    constructor(o) {
      o = o || {};
      this.W = o.w || 160; this.H = o.h || 90;
      this.profile = o.profile || 'standard';
      this.bodyKnob = o.body || 'playful';
      this.cards = {};
      for (const c of (o.cards || [])) this.cards[c.ch] = c;
      this.caps = CAPS[this.profile]; this.conj = CONJURE[this.profile]; this.body = BODY[this.bodyKnob];
      const n = this.W * this.H;
      this.mat = new Uint8Array(n); this.aux = new Uint16Array(n); this.meta = new Uint8Array(n);
      this.stamp = new Uint32Array(n);
      this.counts = new Int32Array(N); this.counts[AIR] = n;
      this.tick = 0; this.rng = (o.seed >>> 0) || 1; this.nextId = 1;
      this.cellsV = 1;                                   // bumped on every cell change: the co-op server sends the
                                                          // grid only when this moves, entity snapshots otherwise
      this.players = []; this.objs = []; this.grows = [];
      this.changes = 0; this.events = [];            // events: short strings for the tests and, later, the UI labels
      this.tagCache = new Map();
    }

    // ---------- knobs, settable live by the crew server (the living-room rule) ----------
    setProfile(name) { if (CAPS[name]) { this.profile = name; this.caps = CAPS[name]; this.conj = CONJURE[name]; } }
    setBody(name) { if (BODY[name]) { this.bodyKnob = name; this.body = BODY[name]; } }

    // ---------- rng (xorshift32; the only source of randomness) ----------
    rand() { let x = this.rng; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; this.rng = x; return x / 4294967296; }

    // ---------- cells ----------
    idx(x, y) { return y * this.W + x; }
    inb(x, y) { return x >= 0 && x < this.W && y >= 0 && y < this.H; }
    get(x, y) { return this.inb(x, y) ? this.mat[y * this.W + x] : (y >= this.H ? AIR : M.stone); }
    solidAt(x, y) { return x < 0 || x >= this.W || y < 0 ? true : (y >= this.H ? false : SOLID[this.mat[y * this.W + x]]); }
    initAux(m) {
      if (m === STEAM) return Math.round(CELL.steam * TICK * (0.7 + 0.6 * this.rand()));
      if (m === ASH) return Math.round(CELL.ash * TICK * (0.7 + 0.6 * this.rand()));
      if (m === MUD) return Math.round(CELL.mud * TICK * (0.7 + 0.6 * this.rand()));
      return 0;
    }
    // the one door through which every cell change goes (counts, change budget, aux timers)
    put(i, m, aux, meta) {
      const old = this.mat[i];
      this.counts[old]--; this.counts[m]++;
      this.mat[i] = m; this.aux[i] = aux === undefined ? this.initAux(m) : aux; this.meta[i] = meta || 0;
      this.stamp[i] = this.tick + 1;                       // a cell changed this tick is not moved again this tick
      this.changes++; this.cellsV++;
    }
    set(x, y, m, aux, meta) { if (this.inb(x, y)) this.put(y * this.W + x, m, aux, meta); }
    fill(x0, y0, x1, y1, m) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, m); }
    count(m) { return this.counts[typeof m === 'string' ? M[m] : m]; }
    budgetOk() { return this.changes < this.caps.changes; }

    // ---------- tags ----------
    objTags(o) {
      const key = o.ch + '|' + o.st + '|' + (o.seed ? 1 : 0);
      let t = this.tagCache.get(key);
      if (!t) {
        t = this.cards[o.ch].tags.concat('object');
        if (o.st === 'fly') t.push('thrown');
        if (o.seed) t.push('seed');
        this.tagCache.set(key, t);
      }
      return t;
    }
    heldTags(o) { return this.cards[o.ch].tags.concat('object', 'wielded'); }

    // ---------- players ----------
    addPlayer(id, x, y) {
      const p = { id, x, y, vx: 0, vy: 0, face: 1, ground: false, held: 0, calm: false,
        fx: { singed: 0, soaked: 0, chilled: 0 }, ink: this.conj.ink, inkT: 0, cool: 0, useCool: 0, hopT: 0,
        spawnX: x, spawnY: y, jumpLatch: false };
      this.players.push(p); return p;
    }
    player(id) { return this.players.find(p => p.id === id); }
    obj(id) { return this.objs.find(o => o.id === id); }
    removeObj(o) { const i = this.objs.indexOf(o); if (i >= 0) this.objs.splice(i, 1); }
    liveOf(p) { return this.objs.filter(o => o.owner === p.id); }
    // a lost phone keeps its seat for a while, then it and its things go back to the world's air
    removePlayer(id) {
      const i = this.players.findIndex(p => p.id === id);
      if (i < 0) return;
      for (const o of this.objs.slice()) if (o.owner === id) this.removeObj(o);
      for (const o of this.players) if (o.held && !this.obj(o.held)) o.held = 0;
      this.players.splice(i, 1);
    }

    // ---------- writing: the recogniser's result arrives here as a character (1A has no pad yet) ----------
    give(p, ch) {
      const card = this.cards[ch];
      if (!card) return 'unknown';
      if (p.ink < 1) return 'no-ink';
      if (p.cool > 0) return 'cooling';
      p.ink--; p.cool = Math.round(this.conj.cool * TICK);
      const mine = this.liveOf(p).filter(o => o.st !== 'held');
      while (mine.length >= this.conj.cap) this.removeObj(mine.shift());       // oldest of yours fades first
      if (p.held) { const old = this.obj(p.held); if (old) { old.st = 'free'; old.vx = old.vy = 0; } }
      const o = { id: this.nextId++, ch, x: p.x, y: p.y + PH + 0.05, vx: 0, vy: 0, st: 'held', owner: p.id, age: 0, imm: 0, seed: false };
      this.objs.push(o); p.held = o.id;
      this.events.push('give ' + ch);
      return 'ok';
    }

    // ---------- input ----------
    // inputs: { [playerId]: { mx, jump, act, ch, ax, ay, calm } } ; act: wield | throw | place | drop | home | give
    step(inputs) {
      inputs = inputs || {};
      this.tick++; this.changes = 0; this.events.length = 0;
      for (const p of this.players) this.stepPlayer(p, inputs[p.id] || {});
      this.stepObjects();
      this.stepGrows();
      this.stepCells();
      for (const p of this.players) this.bodyInCells(p);
      this.caps_();
    }

    stepPlayer(p, inp) {
      if (inp.calm !== undefined) p.calm = !!inp.calm;
      // ink regenerates one per `regen` seconds up to the knob
      if (p.ink < this.conj.ink && ++p.inkT >= this.conj.regen * TICK) { p.ink++; p.inkT = 0; }
      if (p.ink >= this.conj.ink) p.inkT = 0;
      if (p.cool > 0) p.cool--; if (p.useCool > 0) p.useCool--;
      for (const k of ['singed', 'soaked', 'chilled']) if (p.fx[k] > 0) p.fx[k]--;
      const mx = Math.max(-1, Math.min(1, inp.mx || 0));
      if (mx) p.face = mx > 0 ? 1 : -1;
      // movement
      const underMud = this.get(Math.floor(p.x), Math.floor(p.y - 0.1)) === MUD;
      const slow = (p.fx.soaked > 0 ? 0.6 : 1) * (p.fx.chilled > 0 ? 0.5 : 1) * (underMud ? 0.5 : 1);
      const target = mx * RUN * slow, acc = (p.ground ? ACC_G : ACC_A) * DT;
      p.vx += Math.max(-acc, Math.min(acc, target - p.vx));
      if (inp.jump && !p.jumpLatch && p.ground) { p.vy = JUMP * (underMud ? 0.8 : 1); p.ground = false; }
      p.jumpLatch = !!inp.jump;
      if (p.fx.singed > 0) { if (--p.hopT <= 0) { p.hopT = 14; if (p.ground) { p.vy = 8; p.ground = false; } } }
      p.vy = Math.max(-MAX_FALL, p.vy - G * DT);
      this.moveBox(p, PHW, PH, p.vx * DT, p.vy * DT);
      // actions
      const a = inp.act;
      if (!a) return;
      if (a === 'give') { this.give(p, inp.ch); return; }
      if (a === 'home') { p.x = p.spawnX; p.y = p.spawnY; p.vx = p.vy = 0; return; }
      const held = p.held && this.obj(p.held);
      if (!held || p.useCool > 0) return;
      const dir = this.aimDir(p, inp);
      if (a === 'drop') { held.st = 'free'; held.vx = held.vy = 0; p.held = 0; p.useCool = 6; }
      else if (a === 'wield') this.wield(p, held, dir);
      else if (a === 'throw') this.throwIt(p, held, dir);
      else if (a === 'place') this.place(p, held, dir);
    }
    aimDir(p, inp) {
      let ax = inp.ax, ay = inp.ay;
      if (ax === undefined && ay === undefined) { ax = p.face; ay = 0.25; }
      const l = Math.hypot(ax || 0, ay || 0) || 1;
      return { x: (ax || 0) / l, y: (ay || 0) / l };
    }

    // axis-by-axis box move against solid cells; e.x centre, e.y bottom
    moveBox(e, hw, h, dx, dy) {
      e.x += dx;
      if (this.boxHits(e.x, e.y, hw, h)) {
        e.x = dx > 0 ? Math.floor(e.x + hw) - hw - 1e-4 : Math.floor(e.x - hw) + 1 + hw + 1e-4;
        e.vx = 0;
      }
      e.y += dy; e.ground = false;
      if (this.boxHits(e.x, e.y, hw, h)) {
        if (dy < 0) { e.y = Math.floor(e.y) + 1 + 1e-4; e.ground = true; } else e.y = Math.floor(e.y + h) - h - 1e-4;
        e.vy = 0;
      }
    }
    boxHits(x, y, hw, h) {
      const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw), y0 = Math.floor(y), y1 = Math.floor(y + h);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (this.solidAt(cx, cy)) return true;
      return false;
    }

    // ---------- verbs ----------
    handPos(p) { return { x: p.x + p.face * 0.4, y: p.y + 0.75 }; }
    // first non-passable cell along a ray; returns {cx, cy, px, py (last air cell before it)} or null
    ray(x, y, dx, dy, len) {
      let px = Math.floor(x), py = Math.floor(y);
      for (let t = 0; t <= len; t += 0.2) {
        const cx = Math.floor(x + dx * t), cy = Math.floor(y + dy * t);
        if (!this.inb(cx, cy)) return null;
        const m = this.mat[cy * this.W + cx];
        if (m !== AIR && m !== STEAM && m !== ASH) return { cx, cy, px, py, m };
        px = cx; py = cy;
      }
      return null;
    }
    wield(p, o, dir) {
      const card = this.cards[o.ch], b = BEHAVIOURS.wield[card.verbs.wield];
      p.useCool = 8;
      const h = this.handPos(p);
      if (b.kind === 'pour') {
        const cx = Math.floor(h.x + dir.x * 0.8), cy = Math.floor(h.y + dir.y * 0.8);
        if (this.inb(cx, cy) && this.mat[cy * this.W + cx] === AIR && this.counts[M[b.mat]] < this.caps.water) {
          this.set(cx, cy, M[b.mat]); this.events.push('pour ' + b.mat);
        }
        return;
      }
      // touch: whatever the object reaches, with the rules' 'hit' context (a torch ignites, a shard chills)
      const tags = this.heldTags(o), len = b.reach;
      for (const q of this.players) {
        if (q === p) continue;
        const cx = q.x - h.x, cy = q.y + PH / 2 - h.y;
        if (Math.hypot(cx, cy) <= len + 0.4) this.applyBodyRules(tags, q, 'hit', null, card);
      }
      const hit = this.ray(h.x, h.y, dir.x, dir.y, len);
      if (hit) this.applyCellHit(tags, hit, card, null);
    }
    throwIt(p, o, dir) {
      const card = this.cards[o.ch], b = BEHAVIOURS.throw[card.verbs.throw];
      const h = this.handPos(p), sp = b.speed * card.params.speed;
      o.st = 'fly'; o.x = h.x; o.y = h.y - OHS; o.vx = dir.x * sp + p.vx * 0.3; o.vy = dir.y * sp; o.imm = 8; o.age = 0;
      p.held = 0; p.useCool = 8;
      this.events.push('throw ' + o.ch);
    }
    place(p, o, dir) {
      const card = this.cards[o.ch], b = BEHAVIOURS.place[card.verbs.place];
      const h = this.handPos(p);
      let cx = Math.floor(h.x + dir.x * 1.0), cy = Math.floor(h.y + dir.y * 1.0);
      if (this.inb(cx, cy) && this.mat[cy * this.W + cx] !== AIR && this.inb(cx, cy + 1) && this.mat[(cy + 1) * this.W + cx] === AIR) cy++;
      if (!this.inb(cx, cy) || this.mat[cy * this.W + cx] !== AIR) return;
      if (this.boxOverlapsBody(cx, cy)) return;               // never entomb a player (no soft-locks)
      p.useCool = 8;
      if (b.kind === 'seed') {
        o.st = 'free'; o.seed = true; o.x = cx + 0.5; o.y = cy; o.vx = o.vy = 0; o.age = 0; p.held = 0;
      } else {
        const m = M[b.mat];
        if ((m === FIRE && this.counts[FIRE] >= this.caps.fire) || (m === WATER && this.counts[WATER] >= this.caps.water)) { this.removeObj(o); p.held = 0; return; }
        if (m === FIRE) this.put(cy * this.W + cx, FIRE, Math.round(card.params.duration * TICK), 0);
        else this.put(cy * this.W + cx, m);
        this.removeObj(o); p.held = 0;
      }
      this.events.push('place ' + o.ch);
    }
    boxOverlapsBody(cx, cy) {
      for (const q of this.players) if (q.x + PHW > cx && q.x - PHW < cx + 1 && q.y + PH > cy && q.y < cy + 1) return true;
      return false;
    }

    // ---------- objects, projectiles ----------
    stepObjects() {
      for (const o of this.objs.slice()) {
        o.age++;
        if (o.st === 'held') {
          const p = this.player(o.owner);
          if (!p || p.held !== o.id) { o.st = 'free'; continue; }
          o.x = p.x; o.y = p.y + PH + 0.05; continue;
        }
        if (o.st === 'fly') { this.flyStep(o); continue; }
        // free / seed: fall and rest
        o.vy = Math.max(-MAX_FALL, o.vy - G * DT); o.vx *= 0.8;
        this.moveBox(o, OHS, OHS * 2, o.vx * DT, o.vy * DT);
        if (o.ground && o.seed) this.seedCheck(o);
      }
    }
    seedCheck(o) {
      const cx = Math.floor(o.x), cy = Math.floor(o.y + 0.05), below = this.get(cx, cy - 1);
      const rules = rulesFor(this.objTags(o), Array.from(CELLTAGS[below]), 'on-top');
      for (const r of rules) for (const f of r.fx) if (f.op === 'grow' && f.kind === 'tree') {
        this.grows.push({ x: cx, y: cy, n: 0, h: Math.min(CELL.treeCap, CELL.treeBase + CELL.treeStep * (this.cards[o.ch].params.size - 1)), id: o.id });
        this.removeObj(o); this.events.push('R6 tree'); return;
      }
    }
    flyStep(o) {
      o.vy -= PROJ_G * DT;
      const steps = Math.max(1, Math.ceil(Math.hypot(o.vx, o.vy) * DT / REACH_T));
      const sx = o.vx * DT / steps, sy = o.vy * DT / steps;
      if (o.imm > 0) o.imm--;
      for (let s = 0; s < steps; s++) {
        const px = o.x, py = o.y;
        o.x += sx; o.y += sy;
        const cxx = o.x, cyy = o.y + OHS;
        const tags = this.objTags(o);
        // bodies
        for (const q of this.players) {
          if (q.id === o.owner && o.imm > 0) continue;
          if (cxx > q.x - PHW - 0.3 && cxx < q.x + PHW + 0.3 && cyy > q.y - 0.2 && cyy < q.y + PH + 0.2) {
            this.applyBodyRules(tags, q, 'hit', o, this.cards[o.ch]);
            return this.finishFly(o, px, py);
          }
        }
        // other objects that react to this one (R3: fire on a wooden object)
        for (const t of this.objs) {
          if (t === o || t.st === 'held' || t.st === 'fly') continue;
          if (Math.abs(t.x - cxx) < OHS * 2 && Math.abs(t.y + OHS - cyy) < OHS * 2) {
            const rs = rulesFor(tags, this.objTags(t), 'hit');
            if (rs.length) { for (const r of rs) this.runObjFx(r, t); return this.finishFly(o, px, py); }
          }
        }
        // cells
        const cx = Math.floor(cxx), cy = Math.floor(cyy);
        if (cx < 0 || cx >= this.W || cy < 0) { this.removeObj(o); return; }
        if (cy >= this.H) continue;
        const m = this.mat[cy * this.W + cx];
        if (m !== AIR && m !== STEAM && m !== ASH) {
          const lx = Math.floor(px), ly = Math.floor(py + OHS);
          this.applyCellHit(tags, { cx, cy, px: lx, py: ly, m }, this.cards[o.ch], o);
          return this.finishFly(o, px, py);
        }
      }
      if (o.age > 10 * TICK) this.removeObj(o);
    }
    finishFly(o, px, py) {
      const b = BEHAVIOURS.throw[this.cards[o.ch].verbs.throw];
      if (b.after === 'stay' && this.objs.indexOf(o) >= 0) { o.st = 'free'; o.x = px; o.y = py; o.vx = o.vy = 0; o.age = 0; }
      else this.removeObj(o);
    }

    // ---------- applying rules ----------
    // a thrown or wielded thing meets a cell: every matching 'hit' rule (rate ignored), then the landing rule on the air cell before it
    applyCellHit(tags, hit, card, thrown) {
      const bt = Array.from(CELLTAGS[hit.m]);
      for (const r of rulesFor(tags, bt, 'hit')) this.runCellFx(r, hit.cy * this.W + hit.cx, -1, card);
      if (thrown && this.inb(hit.px, hit.py) && this.mat[hit.py * this.W + hit.px] === AIR) {
        for (const r of rulesFor(tags, Array.from(CELLTAGS[AIR]), 'hit')) this.runCellFx(r, -1, hit.py * this.W + hit.px, card);
      }
    }
    applyBodyRules(tags, q, ctx, o, card) {
      if (q.calm || this.body.secs === 0 && this.body.knock === 0) return;
      for (const r of rulesFor(tags, BODY_TAGS, ctx)) for (const f of r.fx) {
        if (f.op === 'body') this.bodyFx(q, f.fx, CELL[f.fx]);
        else if (f.op === 'knock' && o) {
          const mass = card.params.mass, sp = Math.hypot(o.vx, o.vy), k = Math.min(14, mass * sp * 0.35 * this.body.knock);
          const l = sp || 1; q.vx += o.vx / l * k; q.vy += o.vy / l * k * 0.6 + (k > 0 ? 2 : 0);
          this.events.push('R12 knock');
        }
      }
    }
    bodyFx(q, fx, secs) {
      if (this.body.secs === 0 || q.calm) return;
      const t = Math.round(secs * this.body.secs * TICK);
      if (fx === 'singed') { if (q.fx.soaked > 0) return; q.fx.singed = Math.max(q.fx.singed, t); this.events.push('R9 singed'); }
      else if (fx === 'soaked') { q.fx.soaked = Math.max(q.fx.soaked, t); q.fx.singed = 0; this.events.push('R10 soaked'); }
      else if (fx === 'chilled') { q.fx.chilled = Math.max(q.fx.chilled, t); this.events.push('R27 chilled'); }
    }
    runObjFx(r, t) {
      for (const f of r.fx) if (f.op === 'burnObj') {
        const cx = Math.floor(t.x), cy = Math.floor(t.y + OHS);
        this.removeObj(t);
        if (this.inb(cx, cy) && this.mat[cy * this.W + cx] === AIR && this.counts[FIRE] < this.caps.fire) this.put(cy * this.W + cx, FIRE, Math.round(CELL.fireFed * TICK), 1);
        this.events.push('R3 burn');
      }
    }
    // ai: the 'a' cell index (or -1 when 'a' is an entity), bi: the 'b' cell index
    runCellFx(r, bi, landIdx, card) {
      for (const f of r.fx) {
        if (f.op === 'ignite') { if (bi >= 0 && this.budgetOk()) this.ignite(bi); }
        else if (f.op === 'become') { if (bi >= 0 && f.who === 'b') this.becomeCell(bi, M[f.mat]); }
        else if (f.op === 'land' && landIdx >= 0) this.landCell(landIdx, card);
      }
    }
    ignite(i) {
      const m = this.mat[i];
      if (m === FIRE) return;
      const drain = this.counts[FIRE] >= this.caps.fire;
      if (drain) return;                                                    // over the fire cap: no new fire starts
      this.put(i, FIRE, Math.round(CELL.fireFed * TICK * (0.7 + 0.6 * this.rand())), 1);
    }
    becomeCell(i, m) {
      if (!this.budgetOk()) return;
      this.put(i, m);
    }
    landCell(i, card) {
      const b = BEHAVIOURS.throw[card.verbs.throw];
      if (!b.land) return;
      const m = M[b.land];
      if (m === FIRE && this.counts[FIRE] >= this.caps.fire) return;
      const place = (j) => { if (m === FIRE) this.put(j, FIRE, Math.round(card.params.duration * TICK), 0); else this.put(j, m); };
      if (m === WATER && this.counts[WATER] >= this.caps.water) return;
      place(i);
      // size > 1 spills into the air cells beside and above
      let extra = Math.round(card.params.size) , x = i % this.W, y = (i - x) / this.W;
      for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0]]) {
        if (extra <= 0) break;
        const nx = x + dx, ny = y + dy;
        if (this.inb(nx, ny) && this.mat[ny * this.W + nx] === AIR) { place(ny * this.W + nx); extra--; }
      }
      this.events.push('R11 land ' + b.land);
    }

    // ---------- tree growth jobs ----------
    stepGrows() {
      if (!this.grows.length || this.tick % CELL.treeGrowTicks) return;
      for (const g of this.grows.slice()) {
        const cy = g.y + g.n;
        const m = this.get(g.x, cy);
        if (g.n < g.h && (m === AIR || m === PLANT_()) && this.inb(g.x, cy)) {
          this.set(g.x, cy, M.wood); g.n++;
        } else {
          const top = g.y + g.n;       // canopy: plant cells on top and beside the last trunk cell
          if (g.n > 1) for (const [dx, dy] of [[0, 0], [-1, -1], [1, -1], [-1, 0], [1, 0]]) {
            const x = g.x + dx, y = top + dy;
            if (this.inb(x, y) && this.mat[y * this.W + x] === AIR) this.set(x, y, M.plant);
          }
          this.grows.splice(this.grows.indexOf(g), 1);
        }
      }
    }

    // ---------- the cell automaton ----------
    stepCells() {
      const W = this.W, H = this.H, mat = this.mat, aux = this.aux;
      const ltr = (this.tick & 1) === 0;
      const drain = this.counts[FIRE] > this.caps.fire ? CELL.fireDrain : 1;
      for (let y = 0; y < H; y++) {
        for (let k = 0; k < W; k++) {
          const x = ltr ? k : W - 1 - k, i = y * W + x, m = mat[i];
          if (m === AIR || this.stamp[i] === this.tick + 1) continue;
          // timers
          if (m === FIRE || m === STEAM || m === ASH || m === MUD) {
            const a = aux[i] - (m === FIRE ? drain : 1);
            if (a <= 0) {
              if (m === FIRE) this.put(i, this.meta[i] ? ASH : AIR);
              else if (m === MUD) this.put(i, M.dirt);
              else this.put(i, AIR);
              continue;
            }
            aux[i] = a;
          }
          // reactions with neighbours (rate is a per-tick chance)
          let nm;
          if (x > 0) { nm = mat[i - 1]; if (nm !== AIR) this.react(ADJ[m * N + nm], i, i - 1); }
          if (x < W - 1) { nm = mat[i + 1]; if (nm !== AIR) this.react(ADJ[m * N + nm], i, i + 1); }
          if (y < H - 1) { nm = mat[i + W]; if (nm !== AIR) this.react(ADJ[m * N + nm], i, i + W); }
          if (y > 0) {
            nm = mat[i - W];
            if (nm !== AIR) { this.react(ADJ[m * N + nm], i, i - W); this.react(TOP[m * N + nm], i, i - W); }
          }
          if (mat[i] !== m) continue;                                       // a reaction changed this very cell
          // movement
          const f = FLOW[m];
          if (f) this.flow(i, x, y, m, f);
        }
      }
    }
    react(rules, ai, bi) {
      if (!rules.length) return;
      for (const r of rules) {
        if (r.rate !== undefined && this.rand() >= r.rate) continue;
        if (!this.budgetOk()) return;
        for (const f of r.fx) this.cellFx(f, ai, bi);
      }
    }
    cellFx(f, ai, bi) {
      const i = f.who === 'a' ? ai : bi;
      if (f.op === 'ignite') this.ignite(i);
      else if (f.op === 'become') this.put(i, M[f.mat]);
      else if (f.op === 'grow' && f.kind === 'grass') this.growGrass(i);
    }
    growGrass(i) {
      const x = i % this.W; let y = (i - x) / this.W, bottom = y, top = y;
      while (bottom > 0 && this.mat[(bottom - 1) * this.W + x] === PLANT_()) bottom--;
      while (top < this.H - 1 && this.mat[(top + 1) * this.W + x] === PLANT_()) top++;
      if (top - bottom + 1 < CELL.grassCap && top < this.H - 1 && this.mat[(top + 1) * this.W + x] === AIR) this.set(x, top + 1, M.plant);
    }
    // powder falls; liquid falls, slides, spreads; gas rises and drifts
    flow(i, x, y, m, f) {
      const W = this.W, mat = this.mat;
      const swapTo = (j) => {
        const o = mat[j], oa = this.aux[j];
        this.put(j, m, this.aux[i], this.meta[i]);
        this.put(i, o, oa, 0);
      };
      const free = (j) => { const o = mat[j]; return o === AIR || o === STEAM; };
      const side = this.rand() < 0.5 ? -1 : 1;
      if (f === 1 || f === 2) {
        if (y > 0) {
          if (free(i - W)) return swapTo(i - W);
          if (x + side >= 0 && x + side < W && free(i - W + side) && free(i + side)) return swapTo(i - W + side);
          if (x - side >= 0 && x - side < W && free(i - W - side) && free(i - side)) return swapTo(i - W - side);
        }
        if (f === 2) {
          for (const s of [side, -side]) {
            const nx = x + s;
            if (nx >= 0 && nx < W && mat[y * W + nx] === AIR) {
              // sometimes slide two cells: water levels out faster than one cell a tick
              const nx2 = nx + s;
              if (nx2 >= 0 && nx2 < W && mat[y * W + nx2] === AIR && this.rand() < 0.5) return swapTo(y * W + nx2);
              return swapTo(y * W + nx);
            }
          }
        }
      } else if (f === 3) {
        if (y < this.H - 1 && mat[i + W] === AIR) return swapTo(i + W);
        for (const s of [side, -side]) { const nx = x + s; if (nx >= 0 && nx < W && mat[y * W + nx] === AIR) return swapTo(y * W + nx); }
      }
    }

    // ---------- bodies inside cells (R9 fire, R10 water) ----------
    bodyInCells(p) {
      if (p.calm) return;
      for (const dy of [0.1, 0.6, 1.1]) {
        const m = this.get(Math.floor(p.x), Math.floor(p.y + dy));
        if (m === AIR) continue;
        for (const r of INSIDE[m]) for (const f of r.fx) if (f.op === 'body') this.bodyFx(p, f.fx, f.fx === 'singed' ? 2 : 3);
      }
    }

    // ---------- caps: nothing grows without end ----------
    caps_() {
      const ttl = this.caps.ttl * TICK;
      for (const o of this.objs.slice()) if (o.st === 'free' && o.age > ttl) this.removeObj(o);
      let over = this.objs.length - this.caps.objects;
      for (const o of this.objs.slice()) { if (over <= 0) break; if (o.st !== 'held') { this.removeObj(o); over--; } }
      for (const p of this.players) {
        if (this.boxHits(p.x, p.y, PHW, PH)) this.unstick(p);
        if (p.x < 0 || p.x > this.W || p.y < -5) { p.x = p.spawnX; p.y = p.spawnY; p.vx = p.vy = 0; }   // fell off the world: back to spawn
        if (p.held && !this.obj(p.held)) p.held = 0;
      }
    }

    // terrain can grow into a player (ice over water, a thrown clod): lift them out, or send them home. Nobody stays trapped.
    unstick(p) {
      for (let d = 0.25; d <= 8; d += 0.25) if (!this.boxHits(p.x, p.y + d, PHW, PH)) { p.y += d; p.vy = 0; this.unstuck = (this.unstuck || 0) + 1; return; }
      p.x = p.spawnX; p.y = p.spawnY; p.vx = p.vy = 0; this.unstuck = (this.unstuck || 0) + 1;
    }

    // ---------- snapshot / restore / hash ----------
    // snapshot({cells:false}) leaves the grid out (the determinism and soak tests use this form in-process).
    // For the NETWORK there is wire()/applyWire() below: JSON-safe, cells as one-char-per-cell row strings.
    snapshot(o) {
      const cells = !(o && o.cells === false);
      const s = { tick: this.tick, rng: this.rng, nextId: this.nextId, cellsV: this.cellsV,
        players: JSON.parse(JSON.stringify(this.players)),
        objs: JSON.parse(JSON.stringify(this.objs)), grows: JSON.parse(JSON.stringify(this.grows)) };
      if (cells) { s.mat = this.mat.slice(); s.aux = this.aux.slice(); s.meta = this.meta.slice();
        s.stamp = this.stamp.slice(); s.counts = this.counts.slice(); }
      return s;
    }
    restore(s) {
      this.tick = s.tick; this.rng = s.rng; this.nextId = s.nextId; this.cellsV = s.cellsV;
      if (s.mat) { this.mat.set(s.mat); this.aux.set(s.aux); this.meta.set(s.meta); this.stamp.set(s.stamp); this.counts.set(s.counts); }
      this.players = JSON.parse(JSON.stringify(s.players)); this.objs = JSON.parse(JSON.stringify(s.objs)); this.grows = JSON.parse(JSON.stringify(s.grows));
    }

    // the wire form: what a phone needs to DRAW, never what it would need to step (it never steps). Cells
    // travel as row strings, one character per cell ('0123456789ab' = the material index), the profile and
    // body knobs ride along so a phone follows the room when anyone changes them.
    wire(o) {
      const cells = !(o && o.cells === false);
      const s = { tick: this.tick, nextId: this.nextId, cellsV: this.cellsV, profile: this.profile, body: this.bodyKnob,
        players: JSON.parse(JSON.stringify(this.players)),
        objs: JSON.parse(JSON.stringify(this.objs)), grows: JSON.parse(JSON.stringify(this.grows)) };
      if (cells) { s.rows = []; for (let y = 0; y < this.H; y++) s.rows.push(this.rowStr(y)); }
      return s;
    }
    rowStr(y) {
      const CH = '0123456789ab';
      let s = '';
      for (let x = 0; x < this.W; x++) s += CH[this.mat[y * this.W + x]];
      return s;
    }
    applyWire(s) {
      this.tick = s.tick; this.nextId = s.nextId; this.cellsV = s.cellsV;
      if (s.profile) this.setProfile(s.profile);
      if (s.body) this.setBody(s.body);
      if (s.rows) {
        const CH = {}; for (let i = 0; i < '0123456789ab'.length; i++) CH['0123456789ab'[i]] = i;
        for (let y = 0; y < this.H; y++) {
          const r = s.rows[y];
          for (let x = 0; x < this.W; x++) this.mat[y * this.W + x] = CH[r[x]];
        }
        this.aux.fill(0); this.meta.fill(0); this.stamp.fill(0);
        this.counts.fill(0);
        for (let i = 0; i < this.mat.length; i++) this.counts[this.mat[i]]++;
      }
      this.players = JSON.parse(JSON.stringify(s.players));
      this.objs = JSON.parse(JSON.stringify(s.objs));
      this.grows = JSON.parse(JSON.stringify(s.grows));
    }
    hash() {
      let h = 2166136261 >>> 0;
      const mix = a => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } };
      mix(this.mat); mix(new Uint8Array(this.aux.buffer)); mix(this.meta);
      const js = JSON.stringify([this.tick, this.rng, this.nextId, this.players, this.objs, this.grows]);
      for (let i = 0; i < js.length; i++) { h ^= js.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return h;
    }
    // a plain-text picture of a window of the grid, for tests and for people reading failures (top row first)
    dump(x0, y0, x1, y1) {
      const ch = ['.', 'd', '#', 'w', '"', '~', '^', ',', '*', 'm', 'i', 'M'];
      let s = '';
      for (let y = y1; y >= y0; y--) { for (let x = x0; x <= x1; x++) s += ch[this.get(x, y)]; s += '\n'; }
      return s;
    }
  }
  function PLANT_() { return M.plant; }

  const api = { World, consts: { G, PHW, PH, OHS, DT } , rulesFor, CELLTAGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
