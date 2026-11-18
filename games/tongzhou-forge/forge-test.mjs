// 同舟 · Glyph Isles — tests for the positional forge (docs/forge/SPEC.md §9), against the real sim.
// Groups are added card by card (ROADMAP §2). Wire checks use port 3462 (never 3000).
// Run with: node forge-test.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Game, CONST, FORGE, PROFILE, forgeKnobs, relate, bestRelation, AX_R, AX_D } = require('./sim.js');
const LV = require('./levels.js');
const { lint } = await import('./tools/judge/lint.mjs');

let failed = 0;
const check = (cond, msg) => { console.log((cond ? 'PASS ✓ ' : 'FAIL ✗ ') + msg); if (!cond) { failed++; process.exitCode = 1; } };
const group = name => console.log('\n— ' + name + ' —');
const load = id => JSON.parse(fs.readFileSync(new URL('./content/stages/' + id + '.json', import.meta.url), 'utf8'));
const order = JSON.parse(fs.readFileSync(new URL('./content/order.json', import.meta.url), 'utf8'));
const withStrict = (L, v) => { const c = JSON.parse(JSON.stringify(L)); if (v === undefined) delete c.strict; else c.strict = v; return c; };

// ---------------------------------------------------------------- Profiles (F2.3)
group('Profiles');
{
  const names = Object.keys(FORGE.profiles);
  check(names.join() === 'relaxed,standard,strict' && PROFILE === 'standard', 'three profiles: relaxed, standard (default), strict');
  const typos = names.flatMap(n => Object.keys(FORGE.profiles[n]).filter(k => !(k in FORGE) || k === 'profiles').map(k => n + '.' + k));
  check(!typos.length, 'every profile key is a FORGE knob' + (typos.length ? ' — unknown: ' + typos.join(', ') : ''));

  const base = load(order[0]);
  const fzOf = v => new Game([withStrict(base, v)]).fz;
  const none = fzOf(undefined), std = fzOf('standard'), rel = fzOf('relaxed'), str = fzOf('strict');
  check(none.profile === 'standard' && JSON.stringify(none) === JSON.stringify(std), 'a stage without "strict" gets the standard profile');
  check(std.besideD === FORGE.besideD && std.snap === FORGE.snap && std.rescue === 'off', 'standard is the FORGE base values');
  check(rel.profile === 'relaxed' && rel.besideD === 0.55 && rel.besideR[1] === 1.5 && rel.snap === 0.2 && rel.rescue === 'unique' && rel.wrongLife === 12, '"strict": "relaxed" widens the cones, turns on rescue and splits wrong characters back');
  check(str.profile === 'strict' && str.besideD === 0.25 && str.snap === 0 && str.dudCd === 1.5 && str.bodyStill === 0.5 && str.assist === 'none' && str.forms === false, '"strict": "strict" narrows the cones, turns off snap, assist and variant forms, and adds a dud cooldown');
  check(rel.holdLow === FORGE.holdLow && str.inR === FORGE.inR && !('profiles' in str), 'knobs a profile leaves alone keep their FORGE value');
  check(Object.isFrozen(str) && str !== forgeKnobs('strict'), 'each stage gets its own frozen knob set');

  // The knobs follow the stage as the crew sails on.
  const g = new Game([withStrict(base, 'relaxed'), withStrict(base, 'strict')]);
  const first = g.fz.profile; g.loadStage(1);
  check(first === 'relaxed' && g.fz.profile === 'strict', 'loading the next stage switches to its profile');
  check(new Game([withStrict(base, 'sloppy')]).fz.profile === 'standard', 'an unknown profile falls back to standard in the sim (the judge rejects it)');

  const codes = async L => (await lint(L)).map(p => p.code + ':' + p.where);
  check((await codes(withStrict(base, 'strict'))).length === 0, 'lint accepts "strict": "strict"');
  const bad = await codes(withStrict(base, 'sloppy'));
  check(bad.includes('bad-value:strict'), 'lint rejects an unknown profile' + (bad.length ? ' (' + bad.join(', ') + ')' : ''));
  check((await codes(withStrict(base, 2))).includes('bad-value:strict'), 'lint rejects a non-string profile');
  check(order.every(id => load(id).strict === undefined || FORGE.profiles[load(id).strict]), 'every shipped stage names a known profile or none');
  check(LV.OPS.length === 5, 'levels.js still has the five ops');
}

// ---------------------------------------------------------------- Classifier (F2.4)
group('Classifier');
{
  const fz = forgeKnobs('standard'), S = Math.SQRT1_2;
  // A stone at screen offset (r right, q toward the viewer, y up) from the origin.
  let nid = 0;
  const at = (r, q = 0, y = 0, extra = {}) => Object.assign({ id: ++nid, x: 5 + r * AX_R[0] + q * AX_D[0], y: 1 + y, z: 5 + r * AX_R[1] + q * AX_D[1] }, extra);
  const name = rel => rel ? rel.op + ' ' + rel.first.n + rel.second.n : 'null';
  const tag = (k, n) => (k.n = n, k);

  check(Math.abs(AX_R[0] - S) < 1e-12 && Math.abs(AX_R[1] + S) < 1e-12, 'screen-right R is (1,0,-1)/√2, as the camera in app.js');
  const L = tag(at(0), 'L'), Rt = tag(at(0.62), 'R');
  check(name(relate(L, Rt, 'ground', fz)) === '⿰ LR' && name(relate(Rt, L, 'ground', fz)) === '⿰ LR', 'beside: the screen-left stone is first, whichever is asked about first');
  check(relate(L, Rt, 'ground', fz).err < 1e-9, 'err is 0 on the ideal spot (r = ideal, no depth or height offset)');
  // An offset along world X alone is half screen-right, half depth.
  const wx = tag({ id: ++nid, x: 5 + 0.62 * S * 2 * S, y: 1, z: 5 }, 'X');
  check(name(relate(L, wx, 'ground', fz)) === 'null', 'world +X alone is a diagonal on screen (r = q = 0.44): outside the depth cone, no relation');
  check(relate(L, tag(at(0, 0.8), 'F'), 'ground', fz) === null && relate(L, tag(at(0, -0.8), 'B'), 'ground', fz) === null, 'depth-only offset (in front, behind) is no relation at all');
  check(relate(L, at(0.62, 0.3), 'ground', fz) !== null && relate(L, at(0.62, 0.45), 'ground', fz) === null, 'besideD: depth 0.3 is beside, 0.45 is not');
  const [r0, r1] = fz.besideR;
  check(relate(L, at(r0), 'ground', fz) && relate(L, at(r1), 'ground', fz) && !relate(L, at(r0 - 0.01), 'ground', fz) && !relate(L, at(r1 + 0.01), 'ground', fz), `besideR edges: ${r0} and ${r1} are in, just past them is out`);
  check(relate(L, at(0.62, 0, 0.4), 'ground', fz) && !relate(L, at(0.62, 0, 0.5), 'ground', fz), 'besideY: 0.4 higher is still beside, 0.5 is not');
  const edge = relate(L, at(r1), 'ground', fz).err, mid = relate(L, at(0.8), 'ground', fz).err;
  check(mid > 0 && mid < edge && edge <= 1, `err grows toward the cone edge (0.8 → ${mid.toFixed(2)}, ${r1} → ${edge.toFixed(2)})`);

  // Above is physical support only.
  const bot = tag(at(0), 'b'), topk = tag(at(0.1, 0, 0.56, { support: bot }), 't');
  check(name(relate(bot, topk, 'ground', fz)) === '⿱ tb' && name(relate(topk, bot, 'ground', fz)) === '⿱ tb', 'above: the stone resting on the other is first (top), whichever is asked about first');
  check(relate(bot, tag(at(0.05, 0, 0.56), 'h'), 'ground', fz) === null, 'a stone hovering over another without resting on it is not above');
  const side = tag(at(0.62, 0, 0.3, { support: L }), 's');
  check(relate(L, side, 'ground', fz).op === '⿱', 'support beats beside when a pair fits both');

  // Choosing a partner: support first, then err, then the lowest id.
  const k = tag(at(0), 'k');
  const far = tag(at(0.9), 'far'), near = tag(at(0.62), 'near');
  check(bestRelation(k, [far, near], 'ground', fz).partner === near, 'with two beside partners, the one nearer the ideal spot wins');
  const under = tag(at(0, 0, -0.56), 'u'); k.support = under;
  check(bestRelation(k, [near, under], 'ground', fz).partner === under, 'a supporting stone wins over a better beside partner');
  delete k.support;
  const twinA = tag({ id: 50, x: k.x + 0.62 * AX_R[0], y: k.y, z: k.z + 0.62 * AX_R[1] }, 'A');
  const twinB = tag({ id: 40, x: k.x - 0.62 * AX_R[0], y: k.y, z: k.z - 0.62 * AX_R[1] }, 'B');
  check(bestRelation(k, [twinA, twinB], 'ground', fz).partner === twinB && bestRelation(k, [twinB, twinA], 'ground', fz).partner === twinB, 'an err tie goes to the lower id, whatever the list order');
  check(bestRelation(k, [tag(at(0, 1), 'z')], 'ground', fz) === null, 'no partner in any relation gives null');

  // Body mode: held stones, holders' support, wider depth cone, stillness.
  const pa = { vx: 0, vz: 0 }, pb = { vx: 0, vz: 0 };
  const ha = Object.assign(at(0), { holder: pa }), hb = Object.assign(at(0.62, 0.5), { holder: pb });
  check(relate(ha, hb, 'ground', fz) === null && relate(ha, hb, 'body', fz).op === '⿰', `body beside uses bodyD (${fz.bodyD}): depth 0.5 forms a pair only for bodies`);
  const hc = Object.assign(at(0.1, 0, 1.0), { holder: { vx: 0, vz: 0, support: pa } });
  check(relate(ha, hc, 'body', fz).op === '⿱' && relate(ha, hc, 'body', fz).first === hc, 'body above: the holder standing on the other holder has the top stone');
  const strict = forgeKnobs('strict');
  pb.vx = 1;
  const hs = Object.assign(at(0.62, 0.2), { holder: pb });
  check(relate(ha, hs, 'body', fz) !== null && relate(ha, hs, 'body', strict) === null, // standard: no stillness rule
    `strict profile: a holder moving faster than bodyStill (${strict.bodyStill}) forms no pair`);
  check(relate(ha, hs, 'body', forgeKnobs('relaxed')) !== null, 'relaxed profile ignores how still the bodies are');
}

// ---------------------------------------------------------------- Stacking (F2.5)
// A flat test yard, no boat: 12 x 8 floor at height 1.
const yard = (extra = {}) => Object.assign({ id: 'yard', name: 'Yard', cn: '院', par: 60, pal: 'dawn', want: '林', hint: 'test yard',
  map: Array(8).fill('111111111111'), spawn: [1.5, 1.5], beacon: [10.5, 6.5], stones: [] }, extra);
const settle = (g, n = 120) => { for (let i = 0; i < n; i++) g.step(1 / 60); };
const OH = 0.56;
group('Stacking');
{
  // 木 月 火 女: no recipe joins any two of them, so nothing fuses mid-test.
  const g = new Game([yard()]);
  const wood = g.addStone('木', 5.5, 1, 4.5, null);
  const sun = g.addStone('月', 5.55, 3, 4.5, null); sun.grounded = false;
  settle(g);
  check(sun.grounded && sun.support === wood && Math.abs(sun.y - (1 + OH)) < 1e-6, `a dropped stone rests on the stone below it (y ${sun.y.toFixed(3)}, support 木)`);
  check(wood.support && wood.support.kind === 's', 'the bottom stone rests on the floor');
  const fire = g.addStone('火', 5.5, 4, 4.5, null); fire.grounded = false;
  settle(g);
  check(fire.support === sun && Math.abs(fire.y - (1 + 2 * OH)) < 1e-6, 'a third stone stacks on the second');
  const side = g.addStone('女', 5.5 + 0.62 * Math.SQRT1_2, 3, 4.5 - 0.62 * Math.SQRT1_2, null); side.grounded = false;
  settle(g);
  check(side.support && side.support.kind === 's' && Math.abs(side.y - 1) < 1e-6, 'a stone landing on the ideal beside spot rests on the floor, not on its neighbour');
  check(g.ground(5.5, 4.5, CONST.PR, 9, null, true).y === 1, 'players never stand on stones (ground without the stones pass)');
  check(g.ground(5.5, 4.5, 0.28, 9, null, false, true).y === 1 + 3 * OH, 'a stone body (and the aim prediction) lands on top of the stack');

  // Lift the bottom stone out: everything above falls one level.
  const p = g.addPlayer('a', 'A');
  g.holdStone(p, wood, 'grab');
  settle(g);
  check(sun.support && sun.support.kind === 's' && Math.abs(sun.y - 1) < 1e-6, 'lifting the bottom stone drops the one on it to the floor');
  check(fire.support === sun && Math.abs(fire.y - (1 + OH)) < 1e-6, 'and the one above that comes down with it, still stacked');
  check(wood.support === null, 'a held stone rests on nothing');

  // A stack on a deck that moves: every stone rides along, not only the bottom one.
  const h = new Game([yard()]);
  const deck = { kind: 'm', id: 'deck', boat: true, dyn: true, done: true, wall: null, when: [], x0: 3, z0: 2, x1: 8, z1: 6, top: 1.3, from: 1.3, to: 1.3, a: 1, speed: 1, dx: 0, dz: 0 };
  h.movers.push(deck);
  const b0 = h.addStone('木', 4.5, 1.3, 4, null), b1 = h.addStone('月', 4.5, 2.5, 4, null); b1.grounded = false;
  settle(h);
  deck.dx = 0.02;
  for (let i = 0; i < 30; i++) { deck.x0 += 0.02; deck.x1 += 0.02; h.step(1 / 60); }
  deck.dx = 0;
  check(b0.support === deck && b1.support === b0 && Math.abs(b0.x - 5.1) < 1e-6 && Math.abs(b1.x - 5.1) < 1e-6, `a stone on a stone on a moving deck rides with it (bottom x ${b0.x.toFixed(2)}, top x ${b1.x.toFixed(2)})`);
}

// ---------------------------------------------------------------- Placement (F2.7)
group('Placement');
{
  // Hold 女, stand 1.0 away from a 木 in a screen direction, face it, press GRAB. (女 and 木 make nothing.)
  const place = (dirR, dirQ) => {
    const g = new Game([yard()]);
    const t = g.addStone('木', 6, 1, 4, null), h = g.addStone('女', 2, 1, 2, null);
    const p = g.addPlayer('a', 'A');
    p.x = t.x + dirR * AX_R[0] + dirQ * AX_D[0]; p.z = t.z + dirR * AX_R[1] + dirQ * AX_D[1]; p.y = 1;
    p.rot = Math.atan2(t.x - p.x, t.z - p.z);
    g.holdStone(p, h, 'grab');
    g.step(1 / 60);
    const aim = g.aim(p);
    g.act('a', 'grab');
    settle(g, 90);
    return { g, t, h, aim, rel: relate(t, h, 'ground', g.fz) };
  };
  const ideal = forgeKnobs('standard').ideal;
  {
    const { t, h, aim, rel } = place(-1, 0);
    check(aim[3] === 'join', 'standing screen-left of a stone, the aim says BESIDE (mode join)');
    const r = (h.x - t.x) * AX_R[0] + (h.z - t.z) * AX_R[1];
    check(rel && rel.op === '⿰' && rel.first === h && Math.abs(r + ideal) < 0.15, `the stone lands beside it on the left (r ${r.toFixed(2)}), so it is first in ⿰`);
    check(Math.hypot(aim[0] - h.x, aim[2] - h.z) < 0.15, 'the aim marker shows where it lands');
  }
  {
    const { t, h, aim, rel } = place(1, 0);
    check(aim[3] === 'join' && rel && rel.op === '⿰' && rel.second === h, 'from screen-right: beside on the right, second in ⿰');
  }
  for (const [q, name] of [[1, 'in front of'], [-1, 'behind']]) {
    const { t, h, aim, rel } = place(0, q);
    check(aim[3] === 'stack', `standing ${name} a stone, the aim says ON TOP (mode stack)`);
    check(h.support === t && rel && rel.op === '⿱' && rel.first === h, `the stone lands on top of it (support 木), first in ⿱`);
  }
  {
    const { aim } = place(-0.8, 0.6);
    check(aim[3] === 'join', 'mostly screen-left, a little in front: still BESIDE');
    const { aim: a2 } = place(-0.5, 0.8);
    check(a2[3] === 'stack', 'mostly in front, a little left: ON TOP');
  }
  {
    // A stack of two: facing it from the front puts the stone on the top one.
    const g = new Game([yard()]);
    const t = g.addStone('木', 6, 1, 4, null), t2 = g.addStone('月', 6, 3, 4, null); t2.grounded = false;
    settle(g);
    const h = g.addStone('女', 2, 1, 2, null), p = g.addPlayer('a', 'A');
    p.x = t.x + AX_D[0]; p.z = t.z + AX_D[1]; p.y = 1; p.rot = Math.atan2(t.x - p.x, t.z - p.z);
    g.holdStone(p, h, 'grab'); g.step(1 / 60);
    g.act('a', 'grab'); settle(g, 90);
    check(t2.support === t && h.support === t2, 'facing a stack from the front sets the stone on its top stone');
  }
}

// ---------------------------------------------------------------- Order and forging (F2.6)
// Lay stone a on the floor, then drop b so it lands at screen offset (r, q) from a, or on top of a.
function pairUp(a, b, where, opts = {}) {
  const g = new Game([yard(opts.stage || {})]);
  const A = g.addStone(a, 6, 1, 4, null);
  const top = where === 'top';
  const [r, q] = top ? [0.05, 0] : where;
  const B = g.addStone(b, 6 + r * AX_R[0] + q * AX_D[0], 2.2, 4 + r * AX_R[1] + q * AX_D[1], null);
  B.grounded = false; B.placer = 'a'; B.from = [B.x, 1, B.z];
  g.drainEvents();
  const ev = [];
  for (let i = 0; i < (opts.ticks || 60); i++) { g.step(1 / 60); ev.push(...g.drainEvents()); }
  return { g, A, B, ev, of: t => ev.filter(e => e.t === t) };
}
group('Order');
{
  const ok = pairUp('日', '月', [0.62, 0]);
  const f = ok.of('forge')[0];
  check(f && f.ch === '明' && f.op === '⿰' && f.a === '日' && f.b === '月' && f.by === 'a', '日 with 月 landing on its screen-right forges 明 (by the one who placed it)');
  check(ok.A.state === 'gone' && ok.B.state === 'gone' && ok.g.stones.some(k => k.ch === '明' && k.state !== 'gone'), 'both pieces are used up and 明 appears');
  check(ok.of('fuse').some(e => e.ch === '明'), 'the old fuse event still fires (board effects, SPEC §7)');
  const bad = pairUp('日', '月', [-0.62, 0]);
  check(!bad.of('forge').length && bad.of('dud').length === 1 && bad.of('dud')[0].op === '⿰', '月 on the screen-left of 日 (月 ⿰ 日) is a dud');
  check(bad.A.state === 'loose' && bad.B.state === 'loose', 'a dud uses up nothing');
  const t = bad.of('try')[0];
  check(t && t.why === 'mirror' && t.a === '月' && t.b === '日', 'the log says why: mirror (another arrangement would have worked)');
  const none = pairUp('女', '木', [0.62, 0]);
  check(none.of('try')[0] && none.of('try')[0].why === 'dud', 'pieces that make nothing in any arrangement: why dud');
  const depth = pairUp('日', '月', [0, 0.9]);
  check(!depth.of('forge').length && !depth.of('dud').length, 'one in front of the other (depth only) is no relation: no forge, no dud');
  const fen = pairUp('火', '林', 'top');
  check(fen.of('forge')[0] && fen.of('forge')[0].ch === '焚' && fen.of('forge')[0].op === '⿱', '林 dropped on top of 火 forges 焚 (⿱ 林 火)');
  const fen2 = pairUp('林', '火', 'top');
  check(!fen2.of('forge').length && fen2.of('try')[0].why === 'mirror', '火 on top of 林 is a dud (mirror)');
  const yan = pairUp('火', '火', 'top');
  check(yan.of('forge')[0] && yan.of('forge')[0].ch === '炎', '火 on 火 forges 炎');
  const flat = pairUp('火', '火', [0.62, 0]);
  check(!flat.of('forge').length && flat.of('dud').length === 1, '火 beside 火 is a dud: 炏 is not in the closed set (FG-D011)');
  const res = yan.g.stones.find(k => k.ch === '炎');
  check(res && res.state === 'loose' && res.grounded && !yan.of('dud').length, 'the new stone pops up and lands without a dud of its own');
  const lone = pairUp('日', '月', [0.62, 0.6]);
  const nr = lone.of('try')[0];
  check(nr && nr.why === 'norel' && !lone.of('dud').length, 'a near miss just outside the cones is logged (try norel) but shows nothing');
  check(ok.of('try').some(e => e.why === 'wrong'), 'on an isle that wants 林, 明 is logged as try wrong');
  const want = pairUp('日', '月', [0.62, 0], { stage: { want: '明' } });
  check(want.of('try').some(e => e.why === 'ok'), 'on an isle that wants 明, the same forge logs try ok');
}

group('Forgiveness');
{
  // K4 snap: a stone landing at r 0.9 slides to the ideal r 0.62 before it forges (or duds).
  const rOf = (A, B) => (B.x - A.x) * AX_R[0] + (B.z - A.z) * AX_R[1];
  const sn = pairUp('女', '木', [0.9, 0.2]);
  check(Math.abs(rOf(sn.A, sn.B) - 0.62) < 1e-6 && Math.abs((sn.B.x - sn.A.x) * AX_D[0] + (sn.B.z - sn.A.z) * AX_D[1]) < 1e-6, 'snap (standard 0.15 s): a stone landing off the ideal spot slides onto it');
  check(sn.of('dud').length === 1, 'and the attempt happens after the slide');
  const ns = pairUp('女', '木', [0.9, 0.2], { stage: { strict: 'strict' } });
  check(Math.abs(rOf(ns.A, ns.B) - 0.9) < 0.02, 'strict profile: no snap, the stone stays where it landed');
  const stTop = pairUp('火', '火', [0.3, 0.1]);
  check(stTop.of('forge')[0] && stTop.of('forge')[0].op === '⿱', 'a stone that lands half on another rests on it and forges ⿱');

  // K5 rescue (relaxed): the only arrangement of these pieces that makes anything is forged instead.
  const rel = { stage: { strict: 'relaxed' } };
  const rs = pairUp('日', '月', [-0.62, 0], rel);
  const rf = rs.of('forge')[0];
  check(rf && rf.ch === '明' && rf.rescued === true && rf.a === '日' && rf.b === '月' && !rs.of('dud').length, 'relaxed: 月 left of 日 is rescued into 明 (the forge event says rescued)');
  const nr = pairUp('日', '月', [-0.62, 0]);
  check(!nr.of('forge').length, 'standard: no rescue');
  const rd = pairUp('女', '木', [0.62, 0], rel);
  check(!rd.of('forge').length && rd.of('dud').length === 1, 'relaxed: pieces with no recipe at all still dud');

  // K6 dudCd (strict): after a dud, these two stones cannot forge for 1.5 s.
  const cd = pairUp('日', '月', [-0.62, 0], { stage: { strict: 'strict' } });
  const g = cd.g, A = cd.A, B = cd.B;
  // put 月 on the right side by hand and ask again at once, then after the cooldown
  B.x = A.x + 0.62 * AX_R[0]; B.z = A.z + 0.62 * AX_R[1];
  const r1 = g.tryForge(relate(A, B, 'ground', g.fz), 'a');
  const ev1 = g.drainEvents();
  check(r1 === null && ev1.some(e => e.t === 'try' && e.why === 'cooldown') && !ev1.some(e => e.t === 'dud'), 'strict: the same two stones right after a dud: nothing happens (try cooldown, no dud shown)');
  for (let i = 0; i < 90; i++) g.step(1 / 60);
  const r2 = g.tryForge(relate(A, B, 'ground', g.fz), 'a');
  check(r2 && r2.ch === '明', 'after dudCd (1.5 s from the dud) they forge');
  const nc = pairUp('日', '月', [-0.62, 0]);
  nc.B.x = nc.A.x + 0.62 * AX_R[0]; nc.B.z = nc.A.z + 0.62 * AX_R[1];
  check(nc.g.tryForge(relate(nc.A, nc.B, 'ground', nc.g.fz), 'a'), 'standard: no cooldown, the corrected pair forges at once');

  // K7 wrongLife (relaxed, 12 s): a real character the pavilion has no use for splits back.
  const wr = pairUp('火', '火', 'top', { stage: { strict: 'relaxed' }, ticks: 30 });
  const yan = wr.g.stones.find(k => k.ch === '炎');
  check(yan && yan.life > 11 && wr.of('try').some(e => e.why === 'wrong'), 'relaxed: 炎 on an isle that wants 林 is wrong (try wrong) and gets 12 s');
  for (let i = 0; i < 12 * 60; i++) wr.g.step(1 / 60);
  const ev = wr.g.drainEvents(), sp = ev.find(e => e.t === 'split');
  const fires = wr.g.stones.filter(k => k.ch === '火' && k.state === 'loose');
  check(sp && sp.ch === '炎' && yan.state === 'gone' && fires.length === 2, 'after 12 s it splits back into 火 and 火');
  for (let i = 0; i < 60; i++) wr.g.step(1 / 60);
  check(!wr.g.drainEvents().some(e => e.t === 'forge' || e.t === 'dud') && !relate(fires[0], fires[1], 'ground', wr.g.fz), 'the pieces land apart in depth and do not forge again by themselves');
  const keep = pairUp('木', '木', [0.62, 0], { stage: { strict: 'relaxed', want: '森' }, ticks: 30 });
  const lin = keep.g.stones.find(k => k.ch === '林');
  check(lin && lin.life === undefined && keep.of('try').some(e => e.why === 'ok'), 'relaxed: 林 on an isle that wants 森 is on the way, not wrong: it keeps');
  const stdW = pairUp('火', '火', 'top', { ticks: 30 });
  check(stdW.g.stones.find(k => k.ch === '炎').life === undefined, 'standard: wrong characters keep (wrongLife ∞)');
}

group('Dawn and dusk (F3.1)');
{
  const sun = pairUp('木', '日', 'top', { stage: { want: '杲' } });
  check(sun.of('forge')[0] && sun.of('forge')[0].ch === '杲' && sun.of('try').some(e => e.why === 'ok'), '日 set on top of 木 forges 杲 (sunrise)');
  const dim = pairUp('日', '木', 'top', { stage: { want: '杲', glow: [[3.5, 3.5]] } });
  const g = dim.g;
  check(dim.of('forge')[0] && dim.of('forge')[0].ch === '杳' && dim.of('try').some(e => e.why === 'wrong'), '木 set on top of 日 forges 杳 instead (wrong but real)');
  check(dim.of('dusk')[0] && dim.of('dusk')[0].on === true && g.dusk > 19 && g.snapshot().dk > 19, '杳 dims the isle: dusk event, and the snapshot carries dk');
  const p = g.addPlayer('a', 'A');
  const gem = g.gems.find(x => x.glow);
  p.x = gem.x; p.z = gem.z; p.y = 1; g.step(1 / 60);
  check(gem.got && g.drainEvents().some(e => e.t === 'gem'), 'a glow-gem can be taken while the isle is dim');
  // A light stone set down lights the isle again.
  const light = g.addStone('日', 3, 2.2, 6.5, null); light.grounded = false; light.placer = 'a';
  for (let i = 0; i < 40; i++) g.step(1 / 60);
  const ev = g.drainEvents();
  check(g.dusk === 0 && ev.some(e => e.t === 'dusk' && e.on === false) && g.snapshot().dk === 0, 'a light stone set down ends the dusk');
  const dark = pairUp('日', '木', 'top', { stage: { want: '杲', glow: [[3.5, 3.5]] } });
  const q = dark.g.addPlayer('a', 'A');
  for (let i = 0; i < 21 * 60; i++) dark.g.step(1 / 60);
  const g2 = dark.g.gems.find(x => x.glow);
  check(dark.g.dusk <= 0 && dark.g.drainEvents().some(e => e.t === 'dusk' && e.on === false), 'dusk ends by itself after DUSK_TIME');
  q.x = g2.x; q.z = g2.z; q.y = 1; dark.g.step(1 / 60);
  check(!g2.got, 'in daylight a glow-gem cannot be taken');
  const nodusk = pairUp('日', '月', [0.62, 0], { stage: { glow: [[3.5, 3.5]] } });
  const g3 = nodusk.g.gems.find(x => x.glow), r3 = nodusk.g.addPlayer('a', 'A');
  r3.x = g3.x; r3.z = g3.z; r3.y = 1; nodusk.g.step(1 / 60);
  check(!g3.got, 'without dusk the glow-gem stays hidden');
  // K5 rescue never turns one real character into another: 日 木 have two recipes (杲 and 杳).
  const rs = pairUp('日', '木', [0.62, 0], { stage: { strict: 'relaxed', want: '杲' } });
  check(!rs.of('forge').length && rs.of('dud').length === 1 && rs.of('try')[0].why === 'mirror', 'relaxed: 日 beside 木 is not rescued (two arrangements are real): a dud');
  // snapshot rel: the client reads placements from it
  const pr = pairUp('女', '木', [0.62, 0]);
  const tup = id => pr.g.snapshot().k.find(t => t[0] === id);
  check(JSON.stringify(tup(pr.A.id)[8]) === JSON.stringify(['⿰', 1, pr.B.id]) && JSON.stringify(tup(pr.B.id)[8]) === JSON.stringify(['⿰', 2, pr.A.id]) && tup(pr.A.id)[9] === 0, 'the snapshot tells each resting stone its placement: [op, slot, partner]');
  check(JSON.stringify(new Game([yard({ strict: 'strict' })]).clientKnobs()) === JSON.stringify({ profile: 'strict', assist: 'none', forms: false }), 'clientKnobs() gives the board the K9/K10 knobs of the stage profile');
  const L = load('dawn');
  check(L.want === '杲' && L.regrow === true && L.stones.map(v => v[0]).sort().join('') === '日木' && (L.glow || []).length === 1, 'the dawn isle: one 日, one 木, stones grow back, one glow-gem');
  check((await lint(L)).length === 0, 'dawn passes lint');
  const nog = JSON.parse(JSON.stringify(load('two-trees'))); nog.glow = [[10.5, 2.5]];
  check((await lint(nog)).some(p => p.code === 'glow-without-dusk'), 'lint: glow-gems on an isle that cannot make a dusk stone are rejected');
}

group('Determinism');
{
  // The same placements give bit-identical snapshots: snap, forge, pop, rescue and split included.
  const run = () => {
    const out = [];
    for (const [a, b, w, st] of [['日', '月', [0.9, 0.2], 'standard'], ['日', '月', [-0.62, 0.1], 'relaxed'], ['火', '火', 'top', 'relaxed'], ['女', '木', [0.7, -0.1], 'strict']]) {
      const { g } = pairUp(a, b, w, { stage: { strict: st }, ticks: 30 });
      for (let i = 0; i < 14 * 60; i++) { g.step(1 / 60); if (i % 30 === 0) out.push(JSON.stringify(g.snapshot())); }
      out.push(JSON.stringify(g.drainEvents()));
    }
    return out.join('\n');
  };
  const one = run(), two = run();
  check(one === two && one.length > 1000, `two runs of the same forge script give identical snapshots and events (${one.length} bytes)`);
}

console.log(failed ? `\n${failed} FORGE CHECK(S) FAILED` : '\nALL FORGE CHECKS PASSED');
