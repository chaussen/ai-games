// 同舟 · Glyph Isles — tests for the positional forge (docs/forge/SPEC.md §9), against the real sim.
// Groups are added card by card (ROADMAP §2). Wire checks use port 3462 (never 3000).
// Run with: node forge-test.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Game, FORGE, PROFILE, forgeKnobs } = require('./sim.js');
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

console.log(failed ? `\n${failed} FORGE CHECK(S) FAILED` : '\nALL FORGE CHECKS PASSED');
