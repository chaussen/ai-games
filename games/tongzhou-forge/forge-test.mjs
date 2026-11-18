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
  // 木 日 火 女: no recipe joins any two of them, so nothing fuses mid-test.
  const g = new Game([yard()]);
  const wood = g.addStone('木', 5.5, 1, 4.5, null);
  const sun = g.addStone('日', 5.55, 3, 4.5, null); sun.grounded = false;
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
  const b0 = h.addStone('木', 4.5, 1.3, 4, null), b1 = h.addStone('日', 4.5, 2.5, 4, null); b1.grounded = false;
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
    const t = g.addStone('木', 6, 1, 4, null), t2 = g.addStone('日', 6, 3, 4, null); t2.grounded = false;
    settle(g);
    const h = g.addStone('女', 2, 1, 2, null), p = g.addPlayer('a', 'A');
    p.x = t.x + AX_D[0]; p.z = t.z + AX_D[1]; p.y = 1; p.rot = Math.atan2(t.x - p.x, t.z - p.z);
    g.holdStone(p, h, 'grab'); g.step(1 / 60);
    g.act('a', 'grab'); settle(g, 90);
    check(t2.support === t && h.support === t2, 'facing a stack from the front sets the stone on its top stone');
  }
}

console.log(failed ? `\n${failed} FORGE CHECK(S) FAILED` : '\nALL FORGE CHECKS PASSED');
