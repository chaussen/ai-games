// 同舟 · Glyph Isles — tests for the positional forge (docs/forge/SPEC.md §9), against the real sim.
// Groups are added card by card (ROADMAP §2). Wire checks use port 3462 (never 3000).
// Run with: node forge-test.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Game, FORGE, PROFILE, forgeKnobs, relate, bestRelation, AX_R, AX_D } = require('./sim.js');
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

console.log(failed ? `\n${failed} FORGE CHECK(S) FAILED` : '\nALL FORGE CHECKS PASSED');
