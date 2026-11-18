// Sim checks for the 2D greybox: knobs, the classifier, movement and 轻功, forging, elements, and a
// scripted player winning every isle in two ways. Pure node, no server. Run: node sim-test.mjs
import { createRequire } from 'module';
import { run, S, DT } from './bot.mjs';
const require = createRequire(import.meta.url);
const { World, knobs, relate, PROFILES, consts } = require('./sim.js');
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
  ok(/^[.#~_Tb]+$/.test(L.map.join('')), L.id + ': only known map characters');
  const w = new World(); w.load(IS.ISLES.indexOf(L));
  ok(w.pav.y > 0, L.id + ': the pavilion stands on ground');
  ok(w.stones.every(s => s.y > consts.WATER && s.grounded), L.id + ': every stone lies on ground');
  ok(RU.GLYPHS[L.want], L.id + ': wants a known character');
  ok(L.stones.every(([ch]) => RU.GLYPHS[ch]), L.id + ': every stone is a known character');
  ok(RU.RECIPE_LIST.some(r => r[3] === L.want && L.stones.some(s => s[0] === r[1]) && L.stones.some(s => s[0] === r[2])), L.id + ': the want can be made from the stones there');
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

// ---------------------------------------------------------------- routes: every isle, two ways
G('routes');
let cloudSteerW = null;
const cloudSteerP = (p, x) => cloudSteer(cloudSteerW)(p, x);
const ROUTES = {
  'sun-and-moon': () => ({
    // A: 木 bridges the gap, 火 burns the thorns, the 轻功 chain up the tower for 日, 日 left of 月
    bridge_and_burn: [
      S.take('木'), S.walk(37.6), S.hop(-1), S.walk(34.6), S.grabAs('toss', -1), S.event('bridge', 3),
      S.take('火'), S.walk(29.2), S.hop(-1, { leaps: 1, leapAt: 3 }), S.hop(-1, { leaps: 1, leapAt: 2 }),
      S.hop(-1), S.until('off the tower', ({ p }) => p.y < 2.1 && p.grounded, -1),
      S.event('burn', 3), S.walk(21.2), S.face(-1), S.grabAs('place'),
      S.walk(22.3), S.hop(1, { leaps: 4, leapAt: 1 }), S.until('on the tower', ({ p }) => p.y > 7.9, 0, 0.1),
      S.take('日'), S.until('off the tower', ({ p }) => p.y < 2.1 && p.grounded, -1),
      S.walk(15.4), S.hop(-1, { stopAt: 12.0 }), S.walk(12.4), S.face(1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('明'), S.walk(9.6), S.hop(-1, { leaps: 1, leapAt: 1 }), S.walk(5), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: no 木, no 火: leap the gap and the thorns; first try 日 on the wrong side of 月 (a dud)
    leap_it: [
      S.walk(39.8), S.hop(-1, { leaps: 1, leapAt: 0, stopAt: 35.4 }), S.walk(34.6), S.hop(-1, { leaps: 1, leapAt: 2 }), S.walk(29.2), S.hop(-1, { leaps: 1, leapAt: 3 }), S.hop(-1, { leaps: 1, leapAt: 2 }),
      S.take('日'), S.until('off the tower', ({ p }) => p.y < 2.1 && p.grounded, -1), S.walk(22.6),
      S.hop(-1, { leaps: 1, leapAt: 4 }), S.walk(14.4), S.face(-1), S.grabAs('beside'), S.event('dud', 2),
      S.take('日'), S.hop(-1, { stopAt: 12.0 }), S.walk(12.4), S.face(1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('明'), S.walk(9.6), S.hop(-1, { leaps: 1, leapAt: 1 }), S.walk(5), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  dawn: () => ({
    // A: stand on 木 holding 日, ON TOP: 杲; carry it over the gap and up the cliff
    stand_on_it: [
      S.take('日'), S.walk(21.0), S.hop(-1, { stopAt: 19.6 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('杲'), S.walk(16.6), S.hop(-1, { leaps: 1, leapAt: 2 }), S.walk(10.4),
      S.hop(-1, { leaps: 1, leapAt: 1 }), S.walk(7.6), S.hop(-1, { leaps: 1, leapAt: 1 }), S.walk(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: 木 bridges the gap; 木 dropped on 日 makes 杳 (dusk) first; the glow-gem; then 日 dropped on 木
    dusk_first: [
      S.walk(28), S.hop(-1), S.take('木'), S.walk(17.2), S.grabAs('toss', -1), S.event('bridge', 3), S.event('regrow', 6),
      S.take('木'), S.walk(25.0), S.hop(1, { steer: (p, x) => p.x > 26.4 ? 0 : x, grabAs: 'drop' }), S.event('forge', 2), S.event('dusk', 1),
      S.walk(22.2), { ...S.hop(0, { leaps: 5, leapAt: 0.3, steer: cloudSteerP }) },
      S.take('杳'), S.walk(30), S.face(1), S.grabAs('place'), S.event('regrow', 8), S.event('regrow', 8),
      S.take('日'), S.walk(21.0), S.hop(-1, { steer: (p, x) => p.x < 19.6 ? 0 : x, grabAs: 'drop' }), S.event('forge', 2),
      S.wait(0.8), S.take('杲'), S.walk(11), S.hop(-1, { leaps: 1, leapAt: 1 }), S.walk(7.6), S.hop(-1, { leaps: 1, leapAt: 1 }),
      S.walk(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
};
for (const [id, make] of Object.entries(ROUTES)) {
  for (const name of Object.keys(make())) {
    const plan = make()[name];
    const { w } = fresh(isle(id));
    cloudSteerW = w;
    let r;
    try { r = run(w, 'me', plan, { max: 60 * 120 }); } catch (e) { r = { ok: false, at: e.message, ev: [] }; }
    ok(r.ok && w.phase === 'won', id + ' / ' + name + ': won' + (r.ok ? ' in ' + w.result.time + ' s' : ' — stuck at ' + r.at));
    if (id === 'dawn' && name === 'dusk_first') ok(r.ev.some(e => e.t === 'gem' && e.glow), 'dawn / dusk_first: took the glow-gem at dusk');
    if (id === 'sun-and-moon' && name === 'leap_it') ok(!r.ev.some(e => e.t === 'bridge' || e.t === 'burn'), 'sun-and-moon / leap_it: no bridge, no fire');
  }
}

// ---------------------------------------------------------------- determinism
G('determinism');
{
  const once = () => { const { w } = fresh(isle('sun-and-moon')); run(w, 'me', ROUTES['sun-and-moon']().bridge_and_burn, { max: 60 * 120 }); return JSON.stringify([w.time, w.players.get('me').x, w.stones.map(s => [s.ch, s.x, s.y])]); };
  ok(once() === once(), 'the same presses give the same isle');
}

console.log(fail ? `SIM TESTS: ${pass} passed, ${fail} FAILED` : `ALL ${pass} SIM TESTS PASSED`);
process.exit(fail ? 1 : 0);
