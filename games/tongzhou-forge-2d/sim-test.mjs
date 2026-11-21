// Sim checks for the 2D greybox: knobs, the classifier, movement and 轻功, forging, elements, and a
// scripted player winning every isle in two ways. Pure node, no server. Run: node sim-test.mjs
import { createRequire } from 'module';
import { run, S, DT } from './bot.mjs';
import { ROUTES } from './routes.mjs';
const require = createRequire(import.meta.url);
const { World, knobs, relate, PROFILES, consts, CONJURE } = require('./sim.js');
const RU = require('./rules.js');
const IS = require('./isles.js');

let pass = 0, fail = 0, group = '';
const ok = (cond, what) => { if (cond) pass++; else { fail++; console.log('  FAIL [' + group + '] ' + what); } };
const G = (name) => { group = name; };
const fresh = (i = 0, profile) => { const w = new World(); if (profile) w.setProfile(profile); w.load(i); const p = w.addPlayer('me'); w.drain(); return { w, p }; };
const isle = id => IS.ISLES.findIndex(L => L.id === id);
const steps = (w, n) => { const out = []; for (let i = 0; i < n; i++) { w.step(DT); out.push(...w.drain()); } return out; };
const stone = (w, ch) => w.stones.find(s => s.ch === ch && s.state !== 'gone');
const evs = (r, t) => r.ev.filter(e => e.t === t);

// ---------------------------------------------------------------- knobs
G('knobs');
for (const name of PROFILES) {
  const k = knobs(name);
  ok(k.profile === name && Object.isFrozen(k.fz) && Object.isFrozen(k.qi) && Object.isFrozen(k.as), name + ': frozen groups');
  ok(!('profiles' in k.fz) && !('profiles' in k.qi), name + ': no profile table inside');
}
ok(knobs('nope').profile === 'standard', 'unknown profile falls back to standard');
ok(knobs('strict').as.coyote < knobs('standard').as.coyote && knobs('strict').as.nudge === 0, 'strict: less edge forgiveness');
ok(knobs('relaxed').qi.chain > knobs('standard').qi.chain && knobs('relaxed').qi.wallKey === 'band', 'relaxed: longer 轻功 chain, one wall climbs');
{
  const { w } = fresh(0);
  w.setProfile('strict');
  ok(w.fz.profile === undefined && w.k.profile === 'strict' && w.fz.push === false, 'setProfile switches every group at once');
  w.load(1);
  ok(w.k.profile === 'strict', 'the override survives the next isle');
}

// ---------------------------------------------------------------- isles
G('isles');
for (const L of IS.ISLES) {
  const g = IS.parse(L);
  ok(L.map.every(r => r.length === g.w), L.id + ': rows are the same width');
  ok(/^[.#~_TFSb]+$/.test(L.map.join('')), L.id + ': only known map characters');
  const w = new World(); w.load(IS.ISLES.indexOf(L));
  ok(w.pav.y > 0, L.id + ': the pavilion stands on ground');
  ok(w.stones.every(s => s.y > consts.WATER && s.grounded), L.id + ': every stone lies on ground');
  ok(RU.GLYPHS[L.want], L.id + ': wants a known character');
  ok(L.stones.every(([ch]) => RU.GLYPHS[ch]), L.id + ': every stone is a known character');
  // the want can be made from the stones there, in one step or several (林 then 森); on a writing isle
  // (docs/CONJURE.md CJ2-12) only with what you may write too, and never from the stones alone
  const makes = (have) => {
    const can = new Set(have);
    for (let grew = true; grew;) { grew = false; for (const r of RU.RECIPE_LIST) if (!can.has(r[3]) && can.has(r[1]) && can.has(r[2]) && (r[1] !== r[2] || have.filter(c => c === r[1]).length > 1 || r[1] !== have.find(c => c === r[1]))) { can.add(r[3]); grew = true; } }
    return can.has(L.want);
  };
  const have = L.stones.map(s => s[0]);
  if (!L.write) ok(makes(have), L.id + ': the want can be made from the stones there');
  else {
    ok(L.write.every(ch => RU.GLYPHS[ch] && ch !== L.want), L.id + ': writes only known characters, never the goal');
    ok(!makes(have), L.id + ': a writing isle: the stones alone cannot make ' + L.want);
    ok(makes(have.concat(L.write, L.write)), L.id + ': with what it lets you write, they can');
  }
}

// ---------------------------------------------------------------- classifier
G('classifier');
{
  const fz = knobs('standard').fz;
  const A = (ch, x, y, support) => ({ ch, x, y, support: support || null, id: x });
  const a = A('日', 5, 2), b = A('月', 5.92, 2);
  let r = relate(a, b, fz);
  ok(r && r.op === '⿰' && r.first === a && r.err < 0.01, '⿰ touching, left first, err ~0');
  r = relate(b, a, fz);
  ok(r && r.first === a, 'the order does not depend on which stone asks');
  ok(!relate(a, A('月', 6.5, 2), fz), 'too far apart: no placement');
  ok(!relate(a, A('月', 5.9, 2.5), fz), 'different levels: no placement');
  const lo = A('木', 8, 2), hi = A('日', 8.1, 2.9, lo);
  r = relate(hi, lo, fz);
  ok(r && r.op === '⿱' && r.first === hi, '⿱ from support, the top first');
  ok(!relate(A('日', 8, 2.9), lo, fz), 'height alone is not ⿱ (support is)');
  const rel = knobs('relaxed').fz;
  ok(relate(a, A('月', 6.4, 2), rel) && !relate(a, A('月', 6.4, 2), fz), 'relaxed reads a wider gap as beside');
}

// ---------------------------------------------------------------- movement and 轻功
// what a person does on a cloud chain: steer under the next cloud above you that you have not used
const cloudSteer = (w) => (p) => {
  const c = w.clouds.filter(c => !p.src.has(c.id) && c.y > p.y + 0.3).sort((a, b) => a.y - b.y)[0];
  const g = w.glow.find(g => !g.got);
  const tx = c ? c.x : g ? g.x : p.x;
  return Math.max(-1, Math.min(1, (tx - p.x) * 2));
};
G('qi');
{
  const apex = (leaps, opt = {}) => {
    const { w, p } = fresh(isle(opt.isle || 'sun-and-moon'), opt.profile);
    if (opt.carry) w.holdStone(p, stone(w, '火'));
    let my = 0;
    const h = S.hop(0, { leaps, leapAt: 0.5 });
    run(w, 'me', [S.wait(0.2), { name: 'h', fn: (c) => { my = Math.max(my, c.p.y); return h.fn(c); } }]);
    return my - 2;
  };
  const j = apex(0), j1 = apex(1), j2 = apex(2), c2 = apex(2, { carry: true });
  ok(j > 1.2 && j < 1.8, 'a jump clears one rock, not two (' + j.toFixed(2) + ')');
  ok(j1 > 3.2 && j1 < 3.8, 'jump + one leap (' + j1.toFixed(2) + ')');
  ok(Math.abs(j2 - j1) < 0.01, 'a second leap needs a refill first');
  ok(Math.abs(c2 - j1) < 0.01, 'carrying: one leap');
  ok(apex(1, { profile: 'relaxed' }) > j1, 'relaxed leaps higher');
  // a tap on glass: JUMP down for 4 frames only
  const { w, p } = fresh(isle('sun-and-moon'));
  let my = 0, n = 0;
  run(w, 'me', [S.wait(0.2), { name: 'tap', fn: (c) => { my = Math.max(my, c.p.y); n++; return { press: n === 1 ? 'jump' : [], jump: n <= 4, done: n > 5 && c.p.grounded }; } }]);
  ok(my - 2 > 1.1 && my - 2 < j, 'a quick tap still clears one rock, holding goes higher (' + (my - 2).toFixed(2) + ')');
}
{
  // dawn: the clouds by the 杳 glow-gem make a chain: jump, leap, cloud, leap, cloud, leap, cloud, leap
  const { w, p } = fresh(isle('dawn'));
  p.x = 22.2; w.setDusk(20);
  let my = 0, maxChain = 0;
  const r = run(w, 'me', [S.walk(22.2), S.hop(0, { leaps: 5, leapAt: 0.3, steer: cloudSteer(w) })].map(s => ({ ...s, fn: (c) => { my = Math.max(my, c.p.y); maxChain = Math.max(maxChain, c.p.chain); return s.fn(c); } })));
  ok(r.ok, 'the cloud chain runs');
  ok(evs(r, 'cloud').length >= 3 && maxChain >= 4, 'clouds refill the chain (' + evs(r, 'cloud').length + ' clouds, ' + maxChain + ' leaps)');
  ok(my > 10.5, 'flying higher and higher: feet reach ' + my.toFixed(2));
  ok(r.ev.some(e => e.t === 'gem' && e.glow), 'the chain reaches the glow-gem');
  ok(p.chain === 0 && p.qi === 1, 'landing resets the chain');
}
{
  // one wall face refills once per chain ('face'); 'band' lets you climb the same face
  const WALL = { id: 'wall', name: 'Wall', cn: '墙', want: '明', regrow: false, spawn: 12.5, pavilion: 2.5, stones: [['日', 3.5], ['月', 5.5]],
    map: ['..........######', ...Array(12).fill('..........#.....'), '################', '~~~~~~~~~~~~~~~~'] };
  const climb = (profile) => {
    const w = new World([WALL]); w.setProfile(profile); const p = w.addPlayer('me'); w.drain();
    p.x = 11.4; p.y = 2;
    let my = 0;
    const r = run(w, 'me', [S.hop(-1, { leaps: 8, leapAt: 0.5 })].map(s => ({ ...s, fn: (c) => { my = Math.max(my, c.p.y); return s.fn(c); } })));
    return { r, my, walls: evs(r, 'refill').filter(e => e.src === 'wall').length };
  };
  const st = climb('standard'), rx = climb('relaxed');
  ok(st.r.ok && rx.r.ok, 'the wall climbs run');
  ok(st.walls === 1, "'face': one refill from one face (" + st.walls + ')');
  ok(rx.walls >= 2 && rx.my > st.my + 1.5, "'band': the face refills higher up and you climb it (" + rx.walls + ' refills, ' + st.my.toFixed(1) + ' vs ' + rx.my.toFixed(1) + ')');
}
{
  // coyote time: walk off the shore and jump a moment later
  const { w, p } = fresh(isle('dawn'));
  p.x = 17; p.safe = [17, 2];
  let off = -1, jumped = false, t = 0;
  for (let i = 0; i < 200 && !jumped; i++) {
    w.setInput('me', -1, true);
    if (off < 0 && !p.grounded && p.vy <= 0 && p.x < 16.5) off = i;
    if (off >= 0 && i === off + 3) w.press('me', 'jump');
    w.step(DT);
    for (const e of w.drain()) if (e.t === 'jump' && off >= 0) jumped = true;
    t++;
  }
  ok(jumped, 'a jump 3 frames after walking off an edge still jumps (coyote)');
}

// ---------------------------------------------------------------- forging
G('forge');
{
  // 日 left of 月 makes 明; set down on the wrong side, it is an honest dud
  const { w, p } = fresh(isle('sun-and-moon'));
  const r = w.stones.find(s => s.ch === '日'), m = stone(w, '月');
  w.holdStone(p, r); p.x = m.x + 0.9; p.y = m.y; p.face = -1;
  const l = w.launch(p);
  ok(l.mode === 'beside' && l.label === 'BESIDE', 'facing a stone at your level: BESIDE (' + l.mode + ')');
  w.act(p);
  let e = steps(w, 30);
  const dud = e.find(x => x.t === 'dud');
  ok(dud && dud.a === '月' && dud.b === '日' && dud.op === '⿰', '月 then 日 (left to right) is a dud');
  ok(dud && dud.other === true, 'the dud says these two go together another way');
  ok(stone(w, '月') && stone(w, '日'), 'a dud uses nothing up');
  ok(w.placements().length === 1 && w.placements()[0].op === '⿰', 'the pair still shows a BESIDE frame');
  // take 日 back, stand on 月's left, set it down: 明
  w.holdStone(p, stone(w, '日')); p.x = m.x - 0.9; p.face = 1;
  ok(w.launch(p).mode === 'beside', 'from the left: BESIDE');
  w.act(p);
  e = steps(w, 30);
  const f = e.find(x => x.t === 'forge');
  ok(f && f.ch === '明' && f.a === '日' && f.b === '月' && f.op === '⿰', '日 left of 月 forges 明');
  ok(!stone(w, '日') || stone(w, '日').spring, 'the pieces are used up');
  ok(stone(w, '明') && Math.abs(stone(w, '明').x - (m.x - 0.46)) < 0.1, '明 appears between them');
}
{
  // stand on 木 holding 日: ON TOP makes 杲; 木 on 日 makes 杳 and dusk
  const { w, p } = fresh(isle('dawn'));
  const mu = stone(w, '木');
  w.holdStone(p, stone(w, '日')); p.x = mu.x + 0.1; p.y = mu.y + consts.SH; p.grounded = true; p.support = mu;
  const l = w.launch(p);
  ok(l.mode === 'stack' && l.label === 'ON TOP', 'standing on a stone: ON TOP (' + l.mode + ')');
  w.act(p);
  ok(p.y > mu.y + 2 * consts.SH - 0.01, 'you stand on the stone you set down');
  const e = steps(w, 40);
  const f = e.find(x => x.t === 'forge');
  ok(f && f.ch === '杲' && f.op === '⿱' && f.a === '日', '日 on 木 forges 杲');
}
{
  const { w, p } = fresh(isle('dawn'));
  const ri = stone(w, '日');
  w.holdStone(p, stone(w, '木')); p.x = ri.x + 0.2; p.y = ri.y + 2.5; p.vy = 0; p.grounded = false; p.support = null;
  const l = w.launch(p);
  ok(l.mode === 'drop' && l.label === 'ON TOP', 'in the air above a stone: ON TOP (' + l.mode + ')');
  w.act(p);
  const e = steps(w, 60);
  const f = e.find(x => x.t === 'forge');
  ok(f && f.ch === '杳' && f.a === '木', 'dropping 木 on 日 forges 杳');
  ok(e.some(x => x.t === 'dusk' && x.on) && w.dusk > 0, 'dusk falls');
  ok(w.glow.length === 1, 'dawn has a glow-gem');
}
{
  // a near miss is reported, never silent
  const { w, p } = fresh(isle('sun-and-moon'));
  const m = stone(w, '月');
  w.holdStone(p, stone(w, '日'));
  w.loosen(p, stone(w, '日'), m.x - 1.5, m.y + 0.01, 0, 0);
  const e = steps(w, 20);
  ok(e.some(x => x.t === 'near' && x.op === '⿰'), 'a stone landing just too far away: near');
  ok(!e.some(x => x.t === 'forge' || x.t === 'dud'), 'a near miss forges nothing');
}
{
  // pushing a stone against another is a placement too
  const { w, p } = fresh(isle('sun-and-moon'));
  const fi = stone(w, '火'), mu = stone(w, '木');
  const r = run(w, 'me', [S.walk(39.4), S.until('push', ({ ev }) => ev.some(e => e.t === 'dud' || e.t === 'forge'), -1, 3)]);
  ok(r.ok, 'pushing 木 into 火 makes them meet (' + r.at + ')');
  const d = evs(r, 'dud')[0];
  ok(d && d.a === '火' && d.b === '木', '火 left of 木 is read in page order');
  ok(d && d.other === false, '火 and 木 make nothing in any arrangement: no "another way"');
}
{
  // relaxed rescue: the only arrangement of the two pieces is slid into place
  const { w, p } = fresh(isle('sun-and-moon'), 'relaxed');
  const m = stone(w, '月');
  w.holdStone(p, stone(w, '日')); p.x = m.x + 0.9; p.y = m.y; p.face = -1;
  w.act(p);
  const e = steps(w, 40);
  const f = e.find(x => x.t === 'forge');
  ok(f && f.ch === '明' && f.rescued, 'relaxed: 月 then 日 is rescued into 明');
}
{
  // strict: a dud starts a cooldown on that pair
  const { w, p } = fresh(isle('sun-and-moon'), 'strict');
  const m = stone(w, '月');
  w.holdStone(p, stone(w, '日')); p.x = m.x + 0.9; p.y = m.y; p.face = -1;
  w.act(p);
  let e = steps(w, 20);
  ok(e.filter(x => x.t === 'dud').length === 1, 'strict: one dud');
  ok(w.cool.size === 1, 'strict: the pair cools down');
}
{
  // a stone thrown onto the corner of a resting stone slides off it and lands; it never hangs in the air
  // (it did: the slide kept the throw's speed, went back over the corner each frame; S3 autotest finding)
  const { w } = fresh(isle('dawn'));
  const r = stone(w, '日'), m = stone(w, '木');
  Object.assign(r, { x: m.x - 2.7, y: m.y + 1.25, vx: 5.72, vy: 4.93, grounded: false, support: null });
  steps(w, 120);
  ok(r.grounded && r.y === m.y && Math.abs(r.vx) < 1e-9, 'a stone thrown onto a corner lands beside it (y ' + r.y.toFixed(2) + ')');
}

// ---------------------------------------------------------------- elements
G('elements');
{
  const { w, p } = fresh(isle('sun-and-moon'));
  w.holdStone(p, stone(w, '木'));
  p.x = 34.6; p.face = -1;
  w.setInput('me', -1, false);
  ok(w.launch(p).mode === 'toss' && w.launch(p).label === 'THROW', 'walking with a stone: THROW');
  w.act(p);
  const e = steps(w, 60);
  const b = e.find(x => x.t === 'bridge');
  ok(b && b.ch === '木' && b.x1 - b.x0 === 3, '木 thrown into the gap grows a bridge across it');
  ok(w.solid(32, 1), 'the bridge is solid');
  const e2 = steps(w, Math.ceil((consts.REGROW + 0.5) / DT));
  ok(e2.some(x => x.t === 'regrow' && x.ch === '木'), '木 grows back (regrow isle)');
}
{
  // set down at the edge, a stone tips into the gap
  const { w, p } = fresh(isle('sun-and-moon'));
  w.holdStone(p, stone(w, '木'));
  p.x = 34.55; p.y = 2; p.face = -1;
  w.setInput('me', 0, false);
  ok(w.launch(p).mode === 'place', 'standing still: SET DOWN');
  w.act(p);
  ok(steps(w, 60).some(x => x.t === 'bridge'), 'a stone set down over the edge tips in (and bridges)');
}
{
  const { w, p } = fresh(isle('sun-and-moon'));
  w.holdStone(p, stone(w, '日'));
  p.x = 34.55; p.face = -1;
  w.act(p);
  const e = steps(w, 90);
  ok(e.some(x => x.t === 'stoneReturn' && x.ch === '日'), 'a stone that falls in the river floats home');
}
{
  const { w, p } = fresh(isle('sun-and-moon'));
  w.holdStone(p, stone(w, '火'));
  p.x = 21.6; p.y = 2;
  const e = steps(w, 2);
  ok(e.some(x => x.t === 'burn'), 'carrying 火 near the thorns burns them');
  ok(!w.solid(19, 2) && !w.solid(19, 3), 'the hedge is gone');
}
{
  const { w, p } = fresh(isle('sun-and-moon'));
  p.x = 21.5; p.y = 2;
  const r = run(w, 'me', [S.until('walk into thorns', ({ ev }) => ev.some(e => e.t === 'ouch'), -1, 3)]);
  ok(r.ok && p.x > 20.2, 'thorns throw you back');
}
{
  const { w, p } = fresh(isle('sun-and-moon'));
  p.x = 35.5; p.y = 2;
  const r = run(w, 'me', [S.wait(0.2), S.until('fall in', ({ ev }) => ev.some(e => e.t === 'respawn'), -1, 4)]);
  ok(r.ok && p.x > 34.6 && p.x < 36 && p.y === 2, 'fall in the river: back on safe ground, well back from the edge (' + p.x.toFixed(2) + ')');
}
{
  // a light stone set down ends dusk
  const { w, p } = fresh(isle('dawn'));
  w.setDusk(20);
  w.holdStone(p, stone(w, '日')); p.face = -1;
  w.setInput('me', 0, false);
  w.act(p);
  const e = steps(w, 30);
  ok(e.some(x => x.t === 'dusk' && !x.on) && !(w.dusk > 0), 'a light stone set down ends dusk');
}

// ---------------------------------------------------------------- flames and shade (walls other than thorns)
G('walls');
{
  const { w, p } = fresh(isle('rest'));
  const f = w.hedges.find(m => m.wall === 'flame');
  ok(f && f.y1 - f.y0 === 4 && w.solid(f.x0, 2), 'rest: a flame wall four high, solid');
  p.x = f.x1 + 0.6; p.y = 2; p.face = -1;
  const e = steps(w, 1);
  w.setInput('me', -1, false);
  const e2 = steps(w, 20);
  ok(e2.some(x => x.t === 'ouch' && x.wall === 'flame'), 'walking into flames throws you back (and says flames)');
  const water = stone(w, '水'); water.x = f.x1 + 1.2; water.y = 2; water.grounded = true;
  const e3 = steps(w, 2);
  ok(e3.some(x => x.t === 'douse' && x.ch === '水') && !w.solid(f.x0, 3) && w.burnt.some(b => b.wall === 'flame'), '水 near the flames puts them out');
  void e;
}
{
  const { w, p } = fresh(isle('early-light'));
  const m = w.hedges.find(m => m.wall === 'shade');
  ok(m && w.solid(m.x0, 3), 'early-light: a wall of shade, solid');
  p.x = m.x1 + 0.6; p.y = 2; p.face = -1;
  w.setInput('me', -1, false);
  const e = steps(w, 20);
  ok(!e.some(x => x.t === 'ouch') && p.x >= m.x1 + 0.29, 'shade blocks you but does not hurt');
  const sh = stone(w, '十'); sh.x = m.x1 + 1.0; sh.y = 2; sh.grounded = true; sh.from = [0, 0];
  ok(!steps(w, 2).some(x => x.t === 'dispel'), 'a stone that is not light leaves the shade');
  const sun = stone(w, '日'); sun.x = m.x1 + 1.2; sun.y = 2; sun.grounded = true;
  const e2 = steps(w, 2);
  ok(e2.some(x => x.t === 'dispel' && x.ch === '日') && !w.solid(m.x0, 3), 'light near the shade melts it');
}
{
  // reach: 火 cannot burn thorns across two cells of water; 炎 (reach 2.6) can, from the bank
  const { w } = fresh(isle('blaze'));
  const m = w.hedges[0], k = stone(w, '火');
  k.state = 'loose'; k.x = m.x1 + 2.3; k.y = 2; k.grounded = true;
  ok(!steps(w, 2).some(x => x.t === 'burn'), 'blaze: one 火 on the bank is too far from the thorns');
  k.ch = '炎'; k.g = RU.GLYPHS['炎'];
  ok(steps(w, 2).some(x => x.t === 'burn'), 'blaze: 炎 on the same spot burns them');
}

{
  // a character forged on a stone's spot keeps that stone from growing back, and the isle says so
  const { w } = fresh(isle('apricot'));
  const r = run(w, 'me', [S.take('口'), S.go(26.5, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2), S.event('springBlocked', 12)]);
  const e = r.ev.find(x => x.t === 'springBlocked');
  ok(r.ok && e && e.ch === '木' && stone(w, '呆'), 'apricot: 呆 lying on 木\'s spot: "木 is waiting to grow back"');
  ok(!r.ev.some(x => x.t === 'regrow' && x.ch === '木'), 'apricot: and 木 does not grow under it');
}

// ---------------------------------------------------------------- write (docs/CONJURE.md)
G('write');
{
  for (const name of PROFILES) ok(Object.isFrozen(knobs(name).cj) && !('profiles' in knobs(name).cj), name + ': CONJURE is a frozen group');
  ok(knobs('relaxed').cj.ink > knobs('standard').cj.ink && knobs('strict').cj.ink < knobs('standard').cj.ink && knobs('strict').cj.pick === false, 'profiles: more ink relaxed, less and no pick strict');
  // what an isle lets you write
  for (const L of IS.ISLES) {
    const w = new World(); w.load(IS.ISLES.indexOf(L));
    const can = w.writable();
    ok(can.length > 0 && !can.includes(L.want) && can.every(ch => RU.GLYPHS[ch]), L.id + ': writable ' + can.join('') + ' (known, never the goal)');
    ok(can.every(ch => L.stones.some(s => s[0] === ch)) || L.write, L.id + ': writable = the stones lying there');
  }
  // in your hands
  {
    const { w, p } = fresh(isle('two-trees'));
    ok(w.inkOf('me') === CONJURE.ink, 'a player starts the isle with full ink');
    const r = w.write('me', '木');
    const e = w.drain();
    ok(r.ok && r.held && p.hold === r.stone && r.stone.ch === '木' && r.stone.state === 'held', 'empty hands: the written 木 is in your hands');
    ok(r.stone.by === 'me' && r.stone.conj && p.wrote.includes(r.stone.id), 'it carries its writer');
    ok(e.some(x => x.t === 'write' && x.ch === '木' && x.held) && w.started, 'a write event; the isle clock starts');
    ok(Math.abs(w.inkOf('me') - (CONJURE.ink - 1)) < 1e-9 && p.wcd > 0, 'one drop spent, cooldown set');
    const r2 = w.write('me', '木');
    ok(!r2.ok && r2.why === 'cooldown' && w.drain().some(x => x.t === 'writeNo' && x.why === 'cooldown'), 'too soon: cooldown');
    steps(w, Math.ceil(CONJURE.cooldown / DT) + 2);
    // hands full: it drops in front of you
    const r3 = w.write('me', '木');
    ok(r3.ok && !r3.held && p.hold === r.stone && r3.stone.state === 'loose', 'hands full: the new one is not in your hands');
    steps(w, 60);
    ok(r3.stone.grounded && Math.abs(r3.stone.x - p.x) < 1.2 && r3.stone.y > consts.WATER, 'it lands in front of you');
    ok(w.inkOf('me') < 1, 'out of ink');
    steps(w, Math.ceil(CONJURE.cooldown / DT) + 2);
    const r4 = w.write('me', '木');
    ok(!r4.ok && r4.why === 'ink', 'no drop left: refused (ink)');
    steps(w, Math.ceil(CONJURE.regen / DT));
    ok(w.inkOf('me') >= 1 && w.inkOf('me') <= CONJURE.ink, 'ink comes back with time, never past the cap');
    // the cap: a third written stone fades the oldest (the one in your hands)
    const r5 = w.write('me', '木');
    const e5 = w.drain();
    ok(r5.ok && r.stone.state === 'gone' && e5.some(x => x.t === 'fade' && x.s === r.stone.id), 'past the cap your oldest written stone fades (held, too)');
    ok(r5.held && p.hold === r5.stone, 'and the new one takes its place in your hands');
    ok(p.wrote.length === CONJURE.own, 'you keep at most `own` written stones');
    // restart refills
    w.load(w.index);
    ok(w.inkOf('me') === CONJURE.ink && p.wrote.length === 0 && !p.hold, 'restart: full ink, nothing written');
  }
  // refusals
  {
    const { w } = fresh(isle('two-trees'));
    ok(w.write('me', '林').why === 'want', 'the goal cannot be written');
    ok(w.write('me', '火').why === 'unknown', 'a character not on this isle: unknown');
    ok(w.write('nobody', '木').why === 'away', 'no such player');
    w.setProfile('strict');
    ok(w.write('me', '木', { pick: true }).why === 'pick' && w.write('me', '木').ok, 'strict: no pick without drawing, but writing works');
    w.setProfile(null);
    w.phase = 'won';
    ok(w.write('me', '木').why === 'phase', 'after the win: phase');
  }
  // a written stone is a stone: beside 木 it forges 林; over the gap it bridges; in the river it floats home
  {
    const { w, p } = fresh(isle('two-trees'));
    const r = run(w, 'me', [S.take('木'), S.go(18.6), S.face(1), S.grabAs('place'), S.go(20.6), S.face(-1), S.write('木'), S.grabAs('beside'), S.event('forge', 2)], { max: 60 * 30 });
    ok(r.ok && r.ev.some(e => e.t === 'forge' && e.ch === '林'), 'a written 木 set beside a found 木 forges 林');
  }
  {
    const { w } = fresh(isle('two-trees'));
    const r = run(w, 'me', [S.go(13.2), S.write('木'), S.grabAs('toss', -1), S.event('bridge', 3)], { max: 60 * 20 });
    ok(r.ok, 'a written 木 thrown into the gap grows a bridge');
  }
  {
    const { w, p } = fresh(isle('sun-and-moon'));
    const safe = p.safe.slice();
    const r = w.write('me', w.writable().find(ch => !RU.FILLS.includes(RU.GLYPHS[ch].el)));
    let wx = -1;
    for (let cx = 0; cx < w.w && wx < 0; cx++) if (w.groundTop(cx + 0.5, w.h) === 0 && w.cell(cx, 0) !== '_') wx = cx + 0.5;
    w.dropHeld(p); r.stone.x = wx; r.stone.y = 3; r.stone.grounded = false;
    const e = steps(w, 120);
    ok(wx > 0 && e.some(x => x.t === 'stoneReturn' && x.s === r.stone.id) && Math.abs(r.stone.home[0] - safe[0]) < 1e-9 && Math.abs(r.stone.x - safe[0]) < 0.5, 'a written stone that falls in the river floats back to where its writer stood safe');
  }
  // four players, each with their own ink and their own stones (CJ2-01)
  {
    const w = new World(); w.load(isle('sun-and-moon'));
    const ids = ['a', 'b', 'c', 'd'];
    for (const id of ids) w.addPlayer(id);
    ok(new Set(ids.map(id => w.players.get(id).slot)).size === 4, 'four players get four colours');
    const can = w.writable();
    const rs = ids.map((id, i) => w.write(id, can[i % can.length]));
    ok(rs.every(r => r.ok && r.held), 'four players write at once, each into their own hands');
    ok(rs.every((r, i) => r.stone.by === ids[i] && w.players.get(ids[i]).hold === r.stone), 'each stone carries its own writer');
    ok(ids.every(id => Math.abs(w.inkOf(id) - (CONJURE.ink - 1)) < 1e-9), 'each spent only their own ink');
    steps(w, Math.ceil(CONJURE.cooldown / DT) + 2);
    w.write('a', can[0]); steps(w, Math.ceil(CONJURE.cooldown / DT) + 2);
    ok(w.write('a', can[0]).why === 'ink' && w.write('b', can[0]).ok, 'a is out of ink; b still has their own');
    // a fades only a's own stones
    steps(w, Math.ceil(CONJURE.regen / DT) + 2);
    const before = rs.map(r => r.stone.state);
    w.write('a', can[0]);
    ok(rs[1].stone.state === before[1] && rs[2].stone.state === before[2] && rs[3].stone.state === before[3], "a's write never fades another player's stone");
  }
  // the crew pool (the 3D rule) as a knob
  {
    const w = new World(); w.load(isle('sun-and-moon'));
    w.cj = Object.freeze(Object.assign({}, w.cj, { pool: 'crew' }));
    w.addPlayer('a'); w.addPlayer('b'); w.crewInk = w.inkMax();
    ok(w.inkMax() === CONJURE.ink + 1, 'crew pool: cap grows by one per extra player');
    w.write('a', w.writable()[0]);
    ok(Math.abs(w.inkOf('b') - CONJURE.ink) < 1e-9, 'crew pool: a write by a is spent from the pool b sees');
  }
  // every isle: each character it lets you write appears in your hands at the spawn
  for (const L of IS.ISLES) {
    const w = new World(); w.load(IS.ISLES.indexOf(L)); w.setProfile('relaxed'); w.load(w.index); w.addPlayer('me');
    const ch = w.writable()[0];
    const r = w.write('me', ch);
    ok(r.ok && r.held && w.players.get('me').hold.ch === ch, L.id + ': writing ' + ch + ' at the spawn puts it in your hands');
  }
  // determinism with writes
  {
    const once = () => { const { w } = fresh(isle('two-trees')); run(w, 'me', ROUTES['two-trees']({ w }).write_it, { max: 60 * 120 }); return JSON.stringify([w.time, w.phase, w.players.get('me').x, w.stones.map(s => [s.ch, s.x, s.y])]); };
    ok(once() === once(), 'the same writes give the same isle');
  }
}

// ---------------------------------------------------------------- routes: every isle, two ways
G('routes');
const routesOf = {};
for (const [id, make] of Object.entries(ROUTES)) {
  for (const name of Object.keys(make({}))) {
    const { w } = fresh(isle(id));
    const plan = make({ w })[name];
    let r;
    try { r = run(w, 'me', plan, { max: 60 * 120 }); } catch (e) { r = { ok: false, at: e.message, ev: [] }; }
    routesOf[id] = (routesOf[id] || 0) + 1;
    ok(r.ok && w.phase === 'won', id + ' / ' + name + ': won' + (r.ok ? ' in ' + w.result.time + ' s' : ' — stuck at ' + r.at));
    if (id === 'dawn' && name === 'dusk_first') ok(r.ev.some(e => e.t === 'gem' && e.glow), 'dawn / dusk_first: took the glow-gem at dusk');
    if (id === 'sun-and-moon' && name === 'leap_it') ok(!r.ev.some(e => e.t === 'bridge' || e.t === 'burn'), 'sun-and-moon / leap_it: no bridge, no fire');
  }
}

for (const L of IS.ISLES) ok((routesOf[L.id] || 0) >= 2, L.id + ': has two scripted winning routes (has ' + (routesOf[L.id] || 0) + ')');

// ---------------------------------------------------------------- determinism
G('determinism');
{
  const once = () => { const { w } = fresh(isle('sun-and-moon')); run(w, 'me', ROUTES['sun-and-moon']({ w }).bridge_and_burn, { max: 60 * 120 }); return JSON.stringify([w.time, w.players.get('me').x, w.stones.map(s => [s.ch, s.x, s.y])]); };
  ok(once() === once(), 'the same presses give the same isle');
}

// ---------------------------------------------------------------- bodies (docs/CO-OP.md)
G('bodies');
const { STATIC } = require('./sim.js');
{
  const { PW, PH, HOLD_Y, SH } = consts;
  // a crew on the flat ground of Two Trees (x 25-31, ground at y 2), no stones in the way
  const crew = (n = 2, setup) => {
    const w = new World(); w.load(0);
    w.stones.slice().forEach(k => w.consume(k));
    w.L = Object.assign({}, w.L, { regrow: false });
    const ps = [];
    for (let i = 0; i < n; i++) ps.push(w.addPlayer('p' + i));
    ps.forEach((p, i) => { p.x = 26 + i * 1.5; p.y = 2; p.vx = p.vy = 0; p.grounded = true; p.support = STATIC; p.face = 1; });
    if (setup) setup(w, ps);
    w.drain();
    return { w, ps };
  };
  const hold = (w, ps, inputs, n) => { const out = []; for (let i = 0; i < n; i++) { ps.forEach((p, j) => w.setInput(p.id, inputs[j] || 0, false)); w.step(DT); out.push(...w.drain()); } return out; };
  const apart = (a, b) => Math.abs(a.x - b.x) >= 2 * PW - 1e-6;

  { // two friends push against each other: nobody moves through anybody
    const { w, ps: [a, b] } = crew();
    hold(w, [a, b], [1, -1], 40);
    ok(apart(a, b) && a.x < b.x, 'pushing against each other: they stop, touching, in the same order');
    ok(Math.abs(a.x - b.x - -2 * PW) < 0.05, 'pushing against each other: they meet in between');
  }
  { // walking into a friend who stands still shoves them along
    const { w, ps: [a, b] } = crew();
    const b0 = b.x, ev = hold(w, [a, b], [1, 0], 90);
    ok(b.x > b0 + 0.8 && apart(a, b) && a.x < b.x, 'walking into a friend who stands still shoves them along (' + (b.x - b0).toFixed(2) + ')');
    ok(ev.some(e => e.t === 'bump' && e.id === 'p0' && e.other === 'p1'), 'a bump event says who ran into whom');
  }
  { // shove 0: a friend is a wall
    const { w, ps: [a, b] } = crew(2, w => { w.bd = Object.freeze(Object.assign({}, w.bd, { shove: 0, slip: 0 })); });
    const b0 = b.x;
    hold(w, [a, b], [1, 0], 90);
    ok(b.x === b0 && apart(a, b), 'BODY.shove 0: a friend is a wall');
  }
  { // leaning on a friend who pushes back: after BODY.slip seconds you slip past (no corridor soft-lock)
    const { w, ps: [a, b] } = crew();
    const ev = hold(w, [a, b], [1, -1], Math.round((w.bd.slip + 0.6) / DT));
    ok(ev.some(e => e.t === 'slip' && e.id === 'p0'), 'leaning on a friend long enough: you slip past');
    hold(w, [a, b], [1, 0], 30);
    ok(a.x > b.x && apart(a, b), 'after the slip you are on the other side, and apart again');
    ok(!a.slip.length, 'the slip ends once you are apart');
  }
  { // stand on a friend's head, ride along, and come along when they jump
    const { w, ps: [a, b] } = crew(2, (w, [a, b]) => { a.x = b.x + 0.1; a.y = 5; a.grounded = false; a.support = null; });
    hold(w, [a, b], [0, 0], 60);
    ok(a.support === b && a.grounded && Math.abs(a.y - (b.y + PH)) < 1e-6, 'falling onto a friend: you stand on their head');
    const dx = a.x - b.x;
    hold(w, [a, b], [0, 1], 45);
    ok(a.support === b && Math.abs(a.x - b.x - dx) < 0.02, 'your friend walks: you ride along (offset ' + (a.x - b.x - dx).toFixed(3) + ')');
    w.press(b.id, 'jump');
    let top = 0;
    for (let i = 0; i < 70; i++) { w.setInput(b.id, 0, true); w.setInput(a.id, 0, false); w.step(DT); w.drain(); top = Math.max(top, a.y); }
    ok(top > 2 + PH + 1 && a.support === b && Math.abs(a.y - (b.y + PH)) < 1e-6, 'your friend jumps: you go up with them and land on their head again');
    // the depth order: the carrier steps first
    ok(w.depth(a) === 1 && w.depth(b) === 0 && w.ridesOn(a, b), 'depth and ridesOn see the stack');
  }
  { // a friend's head is a step: jumping off it goes higher than any jump from the ground
    const { w, ps: [a, b] } = crew(2, (w, [a, b]) => { a.x = b.x; a.y = b.y + PH; a.support = b; });
    w.press(a.id, 'jump');
    let top = 0;
    for (let i = 0; i < 60; i++) { w.setInput(a.id, 0, true); w.setInput(b.id, 0, false); w.step(DT); w.drain(); top = Math.max(top, a.y); }
    // a plain jump from the ground rises about 1.56 (the sim's steps fall a little short of QI.jump)
    ok(top > 2 + PH + 1.5, 'jumping off a friend\'s head: a friend\'s height higher than a jump from the ground (' + top.toFixed(2) + ')');
  }
  { // a tapped hop (1.17 high) toward a friend (1.2 tall) still climbs on: the ledge nudge covers heads
    const { w, ps: [a, b] } = crew(2, (w, [a, b]) => { a.x = b.x - 2 * PW - 0.02; });
    w.press(a.id, 'jump');
    for (let i = 0; i < 60; i++) { w.setInput(a.id, 1, i < 4); w.setInput(b.id, 0, false); w.step(DT); w.drain(); if (a.support === b) break; }
    ok(a.support === b, 'a tapped hop into a friend climbs onto their head (ASSIST.nudge)');
  }
  { // three high: a tower of friends, each riding the one below
    const { w, ps: [a, b, c] } = crew(3, (w, [a, b, c]) => { b.x = a.x; b.y = 2 + PH; b.support = a; c.x = a.x; c.y = 2 + 2 * PH; c.support = b; });
    hold(w, [a, b, c], [1, 0, 0], 40);
    ok(c.support === b && b.support === a && Math.abs(c.x - a.x) < 0.02 && Math.abs(c.y - (2 + 2 * PH)) < 1e-6, 'a tower of three walks as one');
    w.removePlayer(b.id);
    hold(w, [a, c], [0, 0], 40);
    ok(c.grounded && c.support === a && Math.abs(c.y - (2 + PH)) < 1e-6, 'the middle one leaves: the top one falls onto the bottom one');
  }
  { // a friend carrying a stone: you stand on the stone
    const { w, ps: [a, b] } = crew(2, (w, [a, b]) => { a.x = b.x; a.y = 6; a.grounded = false; a.support = null; });
    w.write(b.id, '木');
    hold(w, [a, b], [0, 0], 60);
    ok(b.hold && a.support === b && Math.abs(a.y - (b.y + HOLD_Y + SH)) < 1e-6, 'a friend carrying a stone: you stand on the stone');
  }
  { // in the air, a friend's side gives a 轻功 charge back (QI.refill 'head')
    const { w, ps: [a, b] } = crew(2, (w, [a, b]) => { a.x = b.x - 2 * PW - 0.01; a.y = 2.4; a.grounded = false; a.support = null; a.qi = 0; a.vy = 0; });
    const ev = hold(w, [a, b], [1, 0], 3);
    ok(ev.some(e => e.t === 'refill' && e.src === 'head') && a.qi === 1, 'touching a friend in the air gives a 轻功 charge back');
  }
  { // BODY.solid false: the old rule
    const { w, ps: [a, b] } = crew(2, w => { w.bd = Object.freeze(Object.assign({}, w.bd, { solid: false })); });
    hold(w, [a, b], [1, 0], 60);
    ok(a.x > b.x, 'BODY.solid false: friends pass through each other');
  }
  { // overlapping friends (a respawn, a placement) drift apart instead of sticking
    const { w, ps: [a, b] } = crew(2, (w, [a, b]) => { a.x = b.x - 0.1; });
    hold(w, [a, b], [0, 0], 60);
    ok(apart(a, b), 'two friends in one spot drift apart');
  }
  { // one player: no body rule touches them
    const { w, p } = fresh(0);
    ok(w.bodiesFor(p) === null, 'alone: no bodies to run into');
  }
  // knock (CO-06): a thrown stone and a friend
  const throwAt = (mode, bHolds) => {
    const { w, ps: [a, b] } = crew(2, (w, [a, b]) => { b.x = a.x + 2.7; if (mode) w.setKnock(mode); });
    w.write(a.id, '木');
    if (bHolds) w.write(b.id, '木');
    w.setInput(a.id, 1, false); w.step(DT); w.drain();
    const l = w.launch(a);
    w.press(a.id, 'grab');
    const ev = [];
    for (let i = 0; i < 60; i++) { w.setInput(a.id, i ? 0 : 1, false); w.setInput(b.id, 0, false); w.step(DT); ev.push(...w.drain()); }
    return { w, a, b, ev, l };
  };
  {
    const r = throwAt(null);
    ok(r.l.mode === 'toss' && r.w.bd.knock === 'off' && !r.ev.some(e => e.t === 'knock') && r.b.stun <= 0, 'knock off (default): a thrown stone flies through a friend');
  }
  {
    const r = throwAt('push');
    const k = r.ev.find(e => e.t === 'knock');
    ok(k && k.id === r.b.id && k.by === r.a.id && !k.lost, 'knock push: the stone throws your friend back (and says who threw it)');
  }
  {
    const r = throwAt('loose', true);
    const k = r.ev.find(e => e.t === 'knock');
    ok(k && k.lost === '木' && !r.b.hold, 'knock loose: what your friend carried flies out of their hands');
    ok(r.w.stones.filter(s => s.ch === '木').every(s => s.state !== 'gone'), 'knock loose: nothing is lost, both stones lie on the isle');
  }
  {
    const { w } = crew();
    w.setKnock('push'); w.load(3);
    ok(w.bd.knock === 'push', 'the knock choice survives the next isle'); w.setKnock('nope');
    ok(w.bd.knock === 'off', 'an unknown knock falls back to off');
  }
}

// ---------------------------------------------------------------- snapshot (the server sends it to every phone)
G('snapshot');
{
  // key order may differ on reused objects (it means nothing): compare with sorted keys
  const canon = v => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(canon).join() + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join() + '}';
  // four players with made-up but repeatable hands on Sun and Moon; a copy made half way through steps on
  // bit for bit like the original, through JSON (the wire)
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const A = new World(); A.load(isle('sun-and-moon'));
  for (let i = 0; i < 4; i++) A.addPlayer('p' + i);
  A.setKnock('loose');
  const hands = [];
  for (let t = 0; t < 900; t++) hands.push([0, 1, 2, 3].map(() => ({ x: rnd() * 2 - 1, j: rnd() < 0.04, g: rnd() < 0.02, w: rnd() < 0.004 })));
  const play = (w, t) => {
    hands[t].forEach((h, i) => { const id = 'p' + i; w.setInput(id, h.x, h.j); if (h.j) w.press(id, 'jump'); if (h.g) w.press(id, 'grab'); if (h.w) w.write(id, w.writable()[0]); });
    w.step(DT); w.drain();
  };
  for (let t = 0; t < 400; t++) play(A, t);
  const B = new World();
  B.restore(JSON.parse(JSON.stringify(A.snapshot())));
  ok(canon(B.snapshot()) === canon(A.snapshot()), 'restore(snapshot()) gives the same snapshot');
  let same = true, at = -1;
  for (let t = 400; t < 900 && same; t++) { play(A, t); play(B, t); if (canon(A.snapshot()) !== canon(B.snapshot())) { same = false; at = t; } }
  ok(same, 'a restored world steps on bit for bit like the original (500 steps, four players)' + (same ? '' : ': differs at step ' + at));
  ok(A.stones.length > 0 && [...A.players.values()].some(p => p.hold || p.wrote.length), 'the run had stones held or written (it tested something)');
  // a world on another isle catches up; the page's own keys survive
  const C = new World(); C.load(0); C.addPlayer('p0');
  C.players.get('p0')._px = 123;
  C.restore(A.snapshot());
  ok(C.index === A.index && C.players.size === 4 && C.players.get('p0')._px === 123, 'restore switches isle, adds players, keeps the page\'s _ keys');
  const D = new World(); D.load(A.index);
  D.restore(A.snapshot({ cells: false }));
  ok(D.cells.map(r => r.join('')).join() === IS.parse(A.L).cells.map(r => r.join('')).join(), 'a snapshot without cells leaves the map alone');
  // the rider survives the trip
  const E = new World(); E.load(0); const e1 = E.addPlayer('a'), e2 = E.addPlayer('b');
  e1.x = e2.x; e1.y = e2.y + consts.PH; e1.support = e2; e1.grounded = true;
  const F = new World(); F.restore(E.snapshot());
  ok(F.players.get('a').support === F.players.get('b'), 'standing on a friend survives a snapshot');
}

console.log(fail ? `SIM TESTS: ${pass} passed, ${fail} FAILED` : `ALL ${pass} SIM TESTS PASSED`);
process.exit(fail ? 1 : 0);
