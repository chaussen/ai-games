// 同舟 V0.2 self-test: brief §7, run against the real engine. No server, no port.
//   node self-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine, T, tileById } from './engine.js';
import { ENCOUNTERS, MATRIX, SEED } from './content.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const wild = JSON.parse(fs.readFileSync(path.join(here, 'wild-seed.json'), 'utf8'));
let passed = 0, missed = 0;
function check(name, ok, note) {
  if (ok) passed++; else missed++;
  console.log((ok ? '  ok   ' : '  MISS ') + name + (note ? '  (' + note + ')' : ''));
}
function fresh(seed, tray) {
  const g = createEngine(wild, { seed: seed || 7 });
  if (tray) tray.forEach(function (id, i) { g.S.tray[i] = id; });
  return g;
}
function forge(g, a, b, pos) {
  g.placeFirst(g.S.tray.indexOf(a));
  const j = g.S.tray.findIndex(function (t, i) { return t === b && i !== g.S.forge.slot; });
  return g.placeSecond(j, pos);
}
function run(g, seconds) { for (let i = 0; i < seconds * 20; i++) g.tick(0.05); }

// 相
let g = fresh(1, ['mu', 'mu4']);
let r = forge(g, 'mu', 'mu4', 'right');
check('木 then 目 to its right bonds as 相', r.bonded && r.bonded.char === '相' && r.bonded.pinyin === 'xiāng' && !!r.bonded.meaning, r.bonded && r.bonded.pinyin + ' / ' + r.bonded.meaning);

// Forgiveness
g = fresh(1, ['mu4', 'mu']);
r = forge(g, 'mu4', 'mu', 'right');
check('forgiving: 目 then 木 to its right also bonds as 相', r.bonded && r.bonded.char === '相');
g = fresh(1, ['mu4', 'mu']); g.dbg.forgive = false;
r = forge(g, 'mu4', 'mu', 'right');
check('forgiveness off: 目 then 木 to its right does not bond', r.repelled === true && g.S.tray[0] === 'mu4' && g.S.tray[1] === 'mu');

// 呆 and 杏 by placement
g = fresh(1, ['kou', 'mu']);
const dai = forge(g, 'kou', 'mu', 'below');
g = fresh(1, ['kou', 'mu']);
const xing = forge(g, 'kou', 'mu', 'above');
check('呆 and 杏 are both made, by placement', dai.bonded.char === '呆' && xing.bonded.char === '杏');

// Variant by position, enclosure
g = fresh(1, ['men', 'kou']);
check('门 with 口 inside bonds as 问', forge(g, 'men', 'kou', 'inside').bonded.char === '问');
check('水 has a left-slot form 氵', tileById.shui.left === '氵');

// Consumed
g = fresh(3, ['ri', 'yue']);
const before = g.S.deals;
forge(g, 'ri', 'yue', 'right');
check('after a bond both tiles are gone and two new ones arrived', g.S.deals === before + 2 && g.S.tray.every(Boolean) && g.S.tray.length === T.tray && g.S.hold[0].char === '明');

// Hold full blocks the forge without losing tiles
g = fresh(3, ['ri', 'yue']);
g.S.hold = [g.chars()[0], g.chars()[1], g.chars()[2]];
r = forge(g, 'ri', 'yue', 'right');
check('a full hold blocks bonding and keeps the tiles', r.blocked === 'hold' && g.S.tray[0] === 'ri' && g.S.tray[1] === 'yue');

// Bogged and freed
g = fresh(5);
let guard = 0, minQi = 10;
while (g.S.qi > 0 && guard++ < 4000) { g.tick(0.05); minQi = Math.min(minQi, g.S.qi); }
run(g, 5);
let v = g.view();
const spawnedWhileStopped = g.S.enc.length;
run(g, 30);
check('bogged: boat stops, 气 is 0 and never below', v.boat.stopped && g.S.qi === 0 && minQi >= 0 && v.aboard.length >= 1 && !g.S.over, v.aboard.length + ' aboard at ' + Math.round(g.S.t) + ' s with no input');
check('bogged: nothing new arrives while stopped', g.S.enc.length === spawnedWhileStopped);
const solver = g.chars().find(function (c) { return g.resolve(c, v.aboard[0].kind).result === 'solve'; });
g.S.hold[0] = solver;
g.spend(0, v.aboard[0].id);
g.tick(0.05);
check('freed: clear one and the boat moves', g.view().boat.speed > 0 || v.aboard.some(function (a) { return a.kind === 'gate' && a.id !== v.aboard[0].id; }), 'speed ' + g.view().boat.speed.toFixed(2));

// Chips
g = fresh(9);
while (!g.view().aboard.length) g.tick(0.05);
const target = g.view().aboard[0];
const dud = g.chars().find(function (c) { return g.resolve(c, target.kind).result === 'flavour'; });
for (let i = 0; i < 3; i++) { g.S.hold[0] = dud; g.spend(0, target.id); }
check('three non-solving spends clear a trouble', !g.view().aboard.some(function (a) { return a.id === target.id; }) && g.S.cleared === 1);

// Every character can be forged and spent on every encounter
let bad = 0;
for (const c of g.chars()) {
  const pos = c.structure === 'LR' ? 'right' : c.structure === 'TB' ? 'below' : 'inside';
  const e = fresh(2, [c.parts[0], c.parts[1]]);
  e.dbg.forgive = false;
  const res = forge(e, c.parts[0], c.parts[1], pos);
  if (!res.bonded || res.bonded.char !== c.char) bad++;
  for (const kind of Object.keys(ENCOUNTERS)) {
    const out = e.resolve(c, kind);
    if (!out.text || !out.result) bad++;
  }
}
check('all ' + g.chars().length + ' characters forge by strict placement and resolve on all 8 encounters', bad === 0 && g.chars().length === 107);

// Cannot stall: random legal actions on several seeds
let stalls = 0, actions = 0;
for (let seed = 1; seed <= 6; seed++) {
  const e = createEngine(wild, { seed: seed });
  let rnd = seed * 9973;
  const rand = function (n) { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd % n; };
  const places = ['left', 'right', 'above', 'below', 'inside'];
  for (let i = 0; i < 500; i++) {
    const a = rand(4);
    if (a === 0) { e.placeFirst(rand(T.tray)); let j = rand(T.tray); if (j === e.S.forge.slot) j = (j + 1) % T.tray; e.placeSecond(j, places[rand(5)]); }
    else if (a === 1) { const m = e.makeable()[0]; forge(e, m.parts[0], m.parts[1], 'right'); }
    else if (a === 2) { const vw = e.view(), all = vw.aboard.concat(vw.incoming.slice(0, 1)); e.spend(rand(T.hold), all.length ? all[rand(all.length)].id : null); }
    else run(e, 1 + rand(8));
    actions++;
    if (e.makeable().length < 2 || e.S.tray.some(function (t) { return !t; }) || e.S.qi < 0) stalls++;
    if (e.S.over) break;
  }
}
check('cannot stall: ' + actions + ' random actions always leave two makeable characters', stalls === 0);

// Content authoring rules (content seed §5)
const kinds = Object.keys(ENCOUNTERS);
const solvers = {}, backfires = {};
for (const tag in MATRIX) for (const k in MATRIX[tag]) {
  if (MATRIX[tag][k].result === 'solve') (solvers[k] = solvers[k] || []).push(tag);
  if (MATRIX[tag][k].result === 'backfire') backfires[k] = true;
}
check('every encounter has a backfire', kinds.every(function (k) { return backfires[k]; }));
check('no tag solves more than half of the encounters', Object.keys(MATRIX).every(function (tag) {
  return kinds.filter(function (k) { return MATRIX[tag][k] && MATRIX[tag][k].result === 'solve'; }).length <= kinds.length / 2;
}));
const thin = kinds.filter(function (k) {
  const chars = Object.keys(SEED).filter(function (c) { return SEED[c][2].some(function (t) { return (solvers[k] || []).indexOf(t) >= 0; }); });
  return chars.length < 2;
});
console.log('  note  encounters with fewer than 2 solving seed characters: ' + (thin.length ? thin.join(', ') : 'none'));

// Record and replay
g = fresh(4); g.S.record = true; run(g, 3);
const rec = JSON.parse(g.exportRun());
check('a run records view objects as JSON', rec.frames.length >= 14 && rec.frames[0].view.boat.qi === 10 && Array.isArray(rec.frames[0].view.incoming));

// A run ends on time, with no lose state
g = fresh(4); run(g, T.runSeconds + 1);
check('a run ends after ' + T.runSeconds + ' s with distance and no lose state', g.S.over && g.S.distance > 0 && g.S.qi >= 0);

// Swap test (static part): engine and controls never name a renderer file
const eng = fs.readFileSync(path.join(here, 'engine.js'), 'utf8');
const ctl = fs.existsSync(path.join(here, 'controls.js')) ? fs.readFileSync(path.join(here, 'controls.js'), 'utf8') : '';
check('engine.js and controls.js never name a renderer file', !/renderer-/.test(eng) && !/renderer-/.test(ctl));
check('engine.js touches no DOM', !/document\.|window\./.test(eng));

// No verdict words in anything a player can load
const banned = /wrong|incorrect|fail|game over/i;
const served = fs.readdirSync(here).filter(function (f) { return /\.(js|html|css|json)$/.test(f); });
const hits = served.filter(function (f) { return banned.test(fs.readFileSync(path.join(here, f), 'utf8')); });
check('no verdict words in ' + served.length + ' served files', hits.length === 0, hits.join(', '));

console.log('\n' + passed + ' passed, ' + missed + ' missed');
process.exit(missed ? 1 : 0);
