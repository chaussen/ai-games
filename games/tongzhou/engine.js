// 同舟 V0.2 engine: every game rule, no drawing, no DOM. Runs in the browser and in Node.
import { TILES, SEED, ENCOUNTERS, MATRIX, DEFAULTS } from './content.js';

export const VERSION = 'TZ-V0.2-1';

// Brief §6 tunables.
export const T = {
  baseSpeed: 8,        // m/s at 气 10
  lookahead: 480,      // m: how far ahead things are visible
  spacing: 360,        // m between arrivals
  firstAt: 200,        // m: first arrival
  drain: 1 / 6,        // 气 per second per trouble aboard
  recover: 1 / 4,      // 气 per second with nothing aboard
  streakBonus: 0.1,    // speed bonus per consecutive clear
  hold: 3,
  tray: 8,
  chips: 3,            // non-solving spends that clear a trouble
  runSeconds: 300,
  backfireSeconds: 10,
  clearGain: 2,        // 气 gained on clearing a trouble aboard (see README: open question)
  burnEvery: 20,       // s: fire aboard burns one tray tile
  nightSight: 160,     // m: how close a thing must be to show at night
  burstSeconds: 5,
  revealSeconds: 8
};

const KINDS = Object.keys(ENCOUNTERS);
const RANK = { solve: 3, partial: 2, backfire: 1 };
const FORGIVE_ORDER = [['LR', 0, 1], ['LR', 1, 0], ['TB', 0, 1], ['TB', 1, 0], ['ENC', 0, 1], ['ENC', 1, 0]];
// Where the second tile was put relative to the first -> structure and slot order.
const PLACE = {
  right: ['LR', 0, 1], left: ['LR', 1, 0], below: ['TB', 0, 1], above: ['TB', 1, 0], inside: ['ENC', 0, 1]
};

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const tileById = {};
for (const t of TILES) tileById[t.id] = t;

function domainOf(w) {
  if (w.semantic) for (const t of TILES) if (t.base === w.semantic || t.left === w.semantic) return t.domain;
  for (const p of w.parts) if (tileById[p].domain) return tileById[p].domain;
  return null;
}

export function createEngine(wild, opts) {
  opts = opts || {};
  const rand = mulberry32(opts.seed || 1);
  const dbg = { forgive: true, hitAll: false, provide: true };
  const pick = function (list) { return list[Math.floor(rand() * list.length)]; };

  // Character index: exact arrangement, and unordered pair.
  const byKey = new Map(), byPair = new Map();
  const pairKey = function (a, b) { return a < b ? a + '+' + b : b + '+' + a; };
  for (const w of wild.chars) {
    const seed = SEED[w.char];
    const e = {
      char: w.char, pinyin: w.pinyin.join(' / '), structure: w.structure, parts: w.parts,
      meaning: seed ? seed[0] : w.def, picture: seed ? seed[1] : '', tags: seed ? seed[2] : null,
      domain: domainOf(w)
    };
    byKey.set(w.structure + ':' + w.parts[0] + ':' + w.parts[1], e);
    const k = pairKey(w.parts[0], w.parts[1]);
    if (!byPair.has(k)) byPair.set(k, []);
    byPair.get(k).push(e);
  }

  const S = {
    t: 0, qi: 10, streak: 0, distance: 0, cleared: 0, deals: 0, over: false,
    tray: new Array(T.tray).fill(null), forge: null, hold: new Array(T.hold).fill(null),
    enc: [], nextSpawnAt: T.firstAt, nextId: 1, lastKind: null, bag: [],
    fx: [], outcomes: [], forged: [], burnAt: 0, burstUntil: 0, revealUntil: 0,
    record: false, frames: [], frameAt: 0
  };

  function fx(type, more) { S.fx.push(Object.assign({ type: type, at: Math.round(S.t * 1000) }, more || {})); }
  function aboard() { return S.enc.filter(function (e) { return e.state === 'aboard'; }); }
  function incoming() {
    return S.enc.filter(function (e) { return e.state === 'incoming'; })
      .sort(function (a, b) { return a.at - b.at; });
  }

  function speed() {
    if (S.over) return 0;
    let v = T.baseSpeed * S.qi / 10 * (1 + T.streakBonus * S.streak);
    for (const e of aboard()) if (ENCOUNTERS[e.kind].slow !== undefined) v *= ENCOUNTERS[e.kind].slow;
    if (S.burstUntil > S.t) v *= 1.5;
    return v;
  }

  // ---- outcomes -------------------------------------------------------------------
  function resolve(c, kind) {
    let best = null;
    for (const tag of (c.tags || [])) {
      const cell = MATRIX[tag] && MATRIX[tag][kind];
      if (cell && (!best || RANK[cell.result] > RANK[best.result])) best = cell;
    }
    if (best) return { result: best.result, text: best.text };
    const d = DEFAULTS[c.domain] || DEFAULTS.none;
    return { result: 'flavour', text: d.text, effect: d.effect };
  }

  function sideEffect(effect) {
    if (effect === 'qi') S.qi = Math.min(10, S.qi + 1);
    if (effect === 'burst') S.burstUntil = S.t + T.burstSeconds;
    if (effect === 'reveal') S.revealUntil = S.t + T.revealSeconds;
  }

  function clear(e) {
    const wasAboard = e.state === 'aboard';
    e.state = 'gone';
    S.cleared++; S.streak++;
    if (wasAboard) S.qi = Math.min(10, S.qi + T.clearGain);
    fx('clear', { targetId: e.id });
  }

  function hit(c, e) {
    const r = resolve(c, e.kind);
    let text = r.text;
    if (r.result === 'solve') clear(e);
    else {
      if (r.result === 'partial') e.partial = true;
      if (r.result === 'backfire') e.backfireUntil = S.t + T.backfireSeconds;
      if (r.result === 'flavour') sideEffect(r.effect);
      e.chips++;
      if (e.chips >= T.chips) { clear(e); text += ', and it finally gives way'; }
    }
    const label = ENCOUNTERS[e.kind].label;
    const line = c.char + ' ' + c.meaning.split(/[;,]/)[0] + ' → ' + label + ': ' + text;
    fx('outcome', { char: c.char, targetId: e.id, result: r.result, text: line });
    if (!S.outcomes.some(function (o) { return o.char === c.char && o.kind === e.kind; })) {
      S.outcomes.push({ char: c.char, kind: e.kind, result: r.result, text: line });
    }
    return { targetId: e.id, result: r.result, text: line };
  }

  // Spend a held character. targetId null = release overboard (domain default, FR-309).
  function spend(h, targetId) {
    const c = S.hold[h];
    if (!c || S.over) return null;
    if (targetId === null || targetId === undefined) {
      S.hold[h] = null;
      const d = DEFAULTS[c.domain] || DEFAULTS.none;
      sideEffect(d.effect);
      const line = c.char + ' goes overboard: ' + d.text;
      fx('cast', { char: c.char });
      fx('outcome', { char: c.char, result: 'flavour', text: line });
      return [{ targetId: null, result: 'flavour', text: line }];
    }
    const near = incoming()[0];
    const target = S.enc.find(function (e) { return e.id === targetId; });
    if (!target || !(target.state === 'aboard' || target === near)) return null;
    S.hold[h] = null;
    fx('cast', { char: c.char, targetId: target.id });
    const targets = [target];
    if (dbg.hitAll) for (const e of aboard()) if (targets.indexOf(e) < 0) targets.push(e);
    return targets.map(function (e) { return hit(c, e); });
  }

  // ---- tiles and forge ------------------------------------------------------------
  function makeable(tray) {
    tray = tray || S.tray;
    const out = new Map();
    for (let i = 0; i < tray.length; i++) for (let j = i + 1; j < tray.length; j++) {
      if (!tray[i] || !tray[j]) continue;
      for (const e of (byPair.get(pairKey(tray[i], tray[j])) || [])) out.set(e.char, e);
    }
    return [...out.values()];
  }

  // B14: would tile x, with a tile already in the tray, make something that helps a trouble aboard?
  function helps(x, slot) {
    const ab = aboard();
    for (let j = 0; j < S.tray.length; j++) {
      if (j === slot || !S.tray[j]) continue;
      for (const e of (byPair.get(pairKey(x, S.tray[j])) || [])) {
        if (ab.some(function (t) { const r = resolve(e, t.kind).result; return r === 'solve' || r === 'partial'; })) return true;
      }
    }
    return false;
  }

  function deal(slot) {
    const ids = TILES.map(function (t) { return t.id; });
    let choice = null;
    if (dbg.provide && aboard().length && speed() === 0) {
      const useful = ids.filter(function (x) { return helps(x, slot); });
      if (useful.length) choice = pick(useful);
    }
    S.tray[slot] = choice || pick(ids);
    S.deals++;
    // B10 deal guarantee: redraw the newest tile until the tray allows two different characters.
    for (let n = 0; n < 40 && makeable().length < 2; n++) S.tray[slot] = pick(ids);
    if (makeable().length < 2) {
      const ok = ids.filter(function (x) { S.tray[slot] = x; return makeable().length >= 2; });
      if (ok.length) S.tray[slot] = pick(ok);
      else { S.tray[slot] = 'kou'; S.tray[(slot + 1) % T.tray] = 'mu'; S.tray[(slot + 2) % T.tray] = 'ren'; }
    }
  }

  function placeFirst(i) {
    if (S.over || !S.tray[i]) return false;
    S.forge = { slot: i };
    return true;
  }
  function clearForge() { S.forge = null; }

  // Put tray tile j at `pos` (left|right|above|below|inside) relative to the first tile.
  // Returns { bonded: entry } | { blocked: 'hold' } | { repelled: true }.
  function placeSecond(j, pos) {
    if (S.over || !S.forge || j === S.forge.slot || !S.tray[j] || !PLACE[pos]) return null;
    const i = S.forge.slot, pair = [S.tray[i], S.tray[j]];
    const p = PLACE[pos];
    let e = byKey.get(p[0] + ':' + pair[p[1]] + ':' + pair[p[2]]);
    if (!e && dbg.forgive) {
      for (const f of FORGIVE_ORDER) {
        e = byKey.get(f[0] + ':' + pair[f[1]] + ':' + pair[f[2]]);
        if (e) break;
      }
    }
    S.forge = null;
    if (!e) { fx('repel'); return { repelled: true }; }
    const free = S.hold.indexOf(null);
    if (free < 0) return { blocked: 'hold' };
    S.hold[free] = e;
    if (S.forged.indexOf(e.char) < 0) S.forged.push(e.char);
    fx('bond', { char: e.char });
    S.tray[i] = null; S.tray[j] = null;   // B9: both tiles are consumed
    deal(i); deal(j);
    return { bonded: e, holdSlot: free };
  }

  // ---- river ----------------------------------------------------------------------
  function nextKind() {
    if (!S.bag.length) {
      S.bag = KINDS.slice();
      for (let i = S.bag.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1)), x = S.bag[i];
        S.bag[i] = S.bag[j]; S.bag[j] = x;
      }
      if (S.bag[S.bag.length - 1] === S.lastKind) S.bag.unshift(S.bag.pop());
    }
    S.lastKind = S.bag.pop();
    return S.lastKind;
  }

  function tick(dt) {
    if (S.over) return;
    S.t += dt;
    const ab = aboard();
    if (ab.length) {
      let d = 0;
      for (const e of ab) {
        d += T.drain * (ENCOUNTERS[e.kind].drain || 1) * (e.partial ? 0.5 : 1) * (e.backfireUntil > S.t ? 2 : 1);
      }
      S.qi = Math.max(0, S.qi - d * dt);
    } else {
      S.qi = Math.min(10, S.qi + T.recover * dt);
    }
    S.distance += speed() * dt;
    while (S.distance + T.lookahead >= S.nextSpawnAt) {
      S.enc.push({ id: S.nextId++, kind: nextKind(), at: S.nextSpawnAt, state: 'incoming', chips: 0, partial: false, backfireUntil: 0 });
      S.nextSpawnAt += T.spacing;
    }
    for (const e of S.enc) {
      if (e.state === 'incoming' && e.at <= S.distance) {
        e.state = 'aboard'; S.streak = 0;
        fx('board', { targetId: e.id });
      }
    }
    if (aboard().some(function (e) { return ENCOUNTERS[e.kind].burns; })) {
      if (!S.burnAt) S.burnAt = S.t + T.burnEvery;
      if (S.t >= S.burnAt) {
        const slots = [];
        for (let i = 0; i < T.tray; i++) if (!S.forge || S.forge.slot !== i) slots.push(i);
        const s = pick(slots);
        S.tray[s] = null; deal(s);
        fx('burn', { slot: s });
        S.burnAt = S.t + T.burnEvery;
      }
    } else S.burnAt = 0;
    S.enc = S.enc.filter(function (e) { return e.state !== 'gone'; });
    S.fx = S.fx.filter(function (f) { return f.at > S.t * 1000 - 6000; });
    if (S.t >= T.runSeconds) { S.over = true; fx('end'); }
    if (S.record && S.t >= S.frameAt) {      // B18: 5 view objects per second
      S.frames.push({ t: Math.round(S.t * 1000), view: JSON.parse(JSON.stringify(view())) });
      S.frameAt = S.t + 0.2;
    }
  }

  // ---- view (renderer contract, brief §5) -----------------------------------------
  function drainMul(e) {
    return (ENCOUNTERS[e.kind].drain || 1) * (e.partial ? 0.5 : 1) * (e.backfireUntil > S.t ? 2 : 1);
  }
  function view() {
    const ab = aboard(), revealed = S.revealUntil > S.t;
    const fog = !revealed && ab.some(function (e) { return ENCOUNTERS[e.kind].veil === 'fog'; });
    const night = !revealed && ab.some(function (e) { return ENCOUNTERS[e.kind].veil === 'night'; });
    return {
      boat: { qi: S.qi, speed: speed(), streak: S.streak, distance: S.distance, stopped: speed() === 0 },
      incoming: incoming().map(function (e) {
        const dist = e.at - S.distance, k = ENCOUNTERS[e.kind];
        if (night && dist > T.nightSight) return { id: e.id, kind: 'veiled', label: '', picture: '🌑', dist: dist };
        if (fog && dist > T.lookahead / 2) return { id: e.id, kind: 'veiled', label: '', picture: '🌫️', dist: dist };
        return { id: e.id, kind: e.kind, label: k.label, picture: k.picture, dist: dist };
      }),
      aboard: ab.map(function (e) {
        const k = ENCOUNTERS[e.kind];
        return { id: e.id, kind: e.kind, label: k.label, picture: k.picture, chips: e.chips, drainMul: drainMul(e) };
      }),
      hold: S.hold.map(function (c) {
        return c ? { char: c.char, pinyin: c.pinyin, meaning: c.meaning, picture: c.picture } : null;
      }),
      fx: S.fx.slice(),
      timeLeft: Math.max(0, T.runSeconds - S.t)
    };
  }

  // Initial deal. opts.demo puts 日 and 月 in the tray for the first-load ghost hand (B15).
  for (let i = 0; i < T.tray; i++) S.tray[i] = pick(TILES).id;
  if (opts.demo) { S.tray[0] = 'ri'; S.tray[1] = 'yue'; }
  deal(T.tray - 1);
  S.deals = 0;

  return {
    S: S, dbg: dbg, tick: tick, view: view, speed: speed, makeable: makeable, resolve: resolve,
    placeFirst: placeFirst, placeSecond: placeSecond, clearForge: clearForge, spend: spend,
    nowMs: function () { return S.t * 1000; },
    chars: function () { return [...byKey.values()]; },
    exportRun: function () { return JSON.stringify({ version: VERSION, seed: opts.seed || 1, frames: S.frames }); }
  };
}
