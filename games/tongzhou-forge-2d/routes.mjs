// Scripted winning routes, one or more per isle: a scripted player pressing only what a person could
// press (bot.mjs) wins each isle. sim-test.mjs runs every route; a route is a function of { w } (the
// world it will run in) returning named step lists.
import { S } from './bot.mjs';

// what a person does on a cloud chain: steer under the next cloud above you that you have not used
export const cloudSteer = (w) => (p) => {
  const c = w.clouds.filter(c => !p.src.has(c.id) && c.y > p.y + 0.3).sort((a, b) => a.y - b.y)[0];
  const g = w.glow.find(g => !g.got);
  const tx = c ? c.x : g ? g.x : p.x;
  return Math.max(-1, Math.min(1, (tx - p.x) * 2));
};

export const ROUTES = {
  'two-trees': () => ({
    // A: 木 beside 木 makes 林; carry it over the gap with a leap
    leap_the_gap: [
      S.take('木'), S.go(17.6), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('林'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: throw a 木 into the gap first (a bridge), wait for it to grow back, then make 林
    bridge_first: [
      S.take('木'), S.go(13.2), S.grabAs('toss', -1), S.event('bridge', 3), S.event('regrow', 6),
      S.go(22.4), S.take('木'), S.go(17.6), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('林'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
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
  dawn: ({ w }) => ({
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
      S.walk(22.2), { ...S.hop(0, { leaps: 5, leapAt: 0.3, steer: (p, x) => cloudSteer(w)(p, x) }) },
      S.take('杳'), S.walk(30), S.face(1), S.grabAs('place'), S.event('regrow', 8), S.event('regrow', 8),
      S.take('日'), S.walk(21.0), S.hop(-1, { steer: (p, x) => p.x < 19.6 ? 0 : x, grabAs: 'drop' }), S.event('forge', 2),
      S.wait(0.8), S.take('杲'), S.walk(11), S.hop(-1, { leaps: 1, leapAt: 1 }), S.walk(7.6), S.hop(-1, { leaps: 1, leapAt: 1 }),
      S.walk(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  'old-leaf': () => ({
    // A: up the tower for 十, down to the plateau, stand on 口 and set 十 ON TOP: 古
    stand_on_it: [
      S.go(26.9, { land: 7 }), S.take('十'), S.go(18.5, { land: 4.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('古'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: 十 left of 口 first (a dud: they go together another way), then drop 十 on 口 from a jump
    dud_then_drop: [
      S.go(26.9, { land: 7 }), S.take('十'), S.go(17.4, { land: 4 }), S.face(1), S.grabAs('beside'), S.event('dud', 2),
      S.take('十'), S.go(17.0), S.hop(1, { steer: (p, x) => p.x > 18.3 ? 0 : x, grabAs: 'drop' }), S.event('forge', 2),
      S.wait(0.8), S.take('古'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  friends: ({ w }) => ({
    // A: ride the clouds up the pillar, bring its 月 down beside the other: 朋
    clouds_up: [
      S.go(18.2), S.hop(0, { leaps: 5, leapAt: 0.3, steer: (p, x) => p.y > 8.6 ? Math.max(-1, Math.min(1, (13.6 - p.x) * 2)) : cloudSteer(w)(p, x) }), S.go(13.6, { land: 9 }),
      S.take('月'), S.go(8.5), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('朋'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: throw the pillar's 月 down, then carry it to the other one
    throw_it_down: [
      S.go(18.2), S.hop(0, { leaps: 5, leapAt: 0.3, steer: (p, x) => p.y > 8.6 ? Math.max(-1, Math.min(1, (13.6 - p.x) * 2)) : cloudSteer(w)(p, x) }), S.go(13.6, { land: 9 }),
      S.take('月'), S.go(12.4, { land: 9 }), S.grabAs('toss', -1), S.event('thud', 3),
      S.take('月', 7.5), S.go(4.9), S.face(1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('朋'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  rest: () => ({
    // A: carry 水 to the flames (they go out), then 人 on the left of 木: 休
    douse_then_rest: [
      S.take('水'), S.go(12.4), S.event('douse', 2), S.grabAs('place'),
      S.go(21.0), S.take('人'), S.go(14.4), S.face(1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('休'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: throw 水 at the flames from the tree
    throw_water: [
      S.take('水'), S.go(13.4), S.grabAs('toss', -1), S.event('douse', 3),
      S.go(21.0), S.take('人'), S.go(14.4), S.face(1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('休'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  'early-light': () => ({
    // A: 日 down from the tower to the shade (it melts), back to 十, stand on it: 早
    dispel_first: [
      S.go(29.8, { land: 6 }), S.take('日'), S.go(11.2), S.event('dispel', 2),
      S.go(16.5, { land: 3.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('早'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: make 早 first; it is light too, and the shade melts as you carry it past
    early_first: [
      S.go(29.8, { land: 6 }), S.take('日'), S.go(16.5, { land: 3.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('早'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  'fruit-field': () => ({
    // A: 田 off the ledge, stand on 木, ON TOP: 果; leap the gap with it
    leap_it: [
      S.go(30.0, { land: 4 }), S.take('田'), S.go(17.5, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('果'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: throw 田 in the gap (a mound), wait for it to grow back, then make 果 and walk over
    mound_first: [
      S.go(30.0, { land: 4 }), S.take('田'), S.go(13.4), S.grabAs('toss', -1), S.event('bridge', 3), S.event('regrow', 6),
      S.go(29.0, { land: 4 }), S.take('田'), S.go(17.5, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('果'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  'red-earth': () => ({
    // A: 火 burns the thorns and stays there; 土 on 火: 赤
    burn_then_red: [
      S.take('火'), S.go(14.4), S.event('burn', 2), S.grabAs('place'),
      S.go(24.0, { land: 3 }), S.take('土'), S.go(13.6, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('赤'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: 火 left of 土 makes a stove 灶 (not the want) that burns the thorns; then 赤 from the regrown pair
    stove_first: [
      S.go(24.0, { land: 3 }), S.take('土'), S.go(17.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('灶'), S.go(14.4), S.event('burn', 2), S.go(10.4), S.grabAs('place'), S.event('regrow', 6), S.event('regrow', 6),
      S.go(24.0, { land: 3 }), S.take('土'), S.go(16.5, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('赤'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  good: () => ({
    // A: 子 off the block, set beside 女 on her right: 好, which melts the shade
    good: [
      S.go(24.5, { land: 5 }), S.take('子'), S.go(15.5), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('好'), S.go(4), S.event('dispel', 1), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: 子 on the left first (a dud), then the right side
    dud_first: [
      S.go(24.5, { land: 5 }), S.take('子'), S.go(13.5), S.face(1), S.grabAs('beside'), S.event('dud', 2),
      S.take('子'), S.go(15.5), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('好'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  apricot: () => ({
    // A: stand on 口 holding 木: 杏; leap the gap
    apricot: [
      S.take('木'), S.go(18.5, { land: 3.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('杏'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: 口 on 木 first makes 呆; move it off the 木's spot, wait for both to grow back, then 杏
    dull_first: [
      S.go(19.5, { land: 3 }), S.take('口'), S.go(26.5, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('呆'), S.go(22.6), S.grabAs('place'), S.event('regrow', 6), S.event('regrow', 6),
      S.go(27.6), S.take('木'), S.go(18.5, { land: 3.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('杏'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  partner: () => ({
    // A: 火 burns the hedge, then 火 right of 人: 伙
    burn_first: [
      S.go(21.5, { land: 4 }), S.take('火'), S.go(10.4), S.event('burn', 2),
      S.go(15.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('伙'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: make 伙 first and leap the low hedge with it
    leap_hedge: [
      S.go(21.5, { land: 4 }), S.take('火'), S.go(15.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('伙'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  bathe: () => ({
    // A: 水 left of 木: 沐, which puts out the flames on the way
    bathe: [
      S.go(31.5, { land: 3 }), S.take('水'), S.go(14.5), S.face(1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('沐'), S.go(4), S.event('douse', 1), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: 木 bridges the gap first, 水 douses the flames, then 沐
    bridge_first: [
      S.go(16.6), S.take('木'), S.go(19.0), S.grabAs('toss', 1), S.event('bridge', 3), S.event('regrow', 6),
      S.go(31.5, { land: 3 }), S.take('水'), S.go(11.0), S.event('douse', 2),
      S.go(14.5), S.face(1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('沐'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  leaf: ({ w }) => ({
    // A: clouds up to 十, then 十 right of 口: 叶
    leaf: [
      S.go(16.8), S.hop(0, { leaps: 5, leapAt: 0.3, steer: (p, x) => p.y > 7.6 ? -1 : cloudSteer(w)(p, x) }), S.go(12.6, { land: 8 }),
      S.take('十'), S.go(8.5), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('叶'), S.go(3), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: 十 left of 口 first (a dud), then the right side
    dud_first: [
      S.go(16.8), S.hop(0, { leaps: 5, leapAt: 0.3, steer: (p, x) => p.y > 7.6 ? -1 : cloudSteer(w)(p, x) }), S.go(12.6, { land: 8 }),
      S.take('十'), S.go(6.5), S.face(1), S.grabAs('beside'), S.event('dud', 2),
      S.take('十'), S.go(8.5), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('叶'), S.go(3), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  stove: () => ({
    // A: 土 right of 火: 灶, which burns the hedge on the way
    stove: [
      S.go(27.5, { land: 4 }), S.take('土'), S.go(15.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('灶'), S.go(4), S.event('burn', 1), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: 土 fills the gap first (a mound), grows back, then 灶
    mound_first: [
      S.go(27.5, { land: 4 }), S.take('土'), S.go(21.4), S.grabAs('toss', -1), S.event('bridge', 3), S.event('regrow', 6),
      S.go(27.5, { land: 4 }), S.take('土'), S.go(15.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('灶'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  blaze: () => ({
    // A: 火 on 火: 炎, which burns the thorns across the water
    blaze: [
      S.take('火'), S.go(16.5, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('炎'), S.go(10.4), S.event('burn', 2), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: throw a 火 at the thorns (it floats home), then 炎
    throw_fire: [
      S.take('火'), S.go(11.0), S.grabAs('toss', -1), S.event('burn', 3), S.event('thud', 3),
      S.go(6.0), S.take('火', 8), S.go(16.5, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('炎'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  forest: () => ({
    // A: 林 first, thrown into the wide gap (a bridge of five); 林 again, 木 on it: 森; walk over
    grove_bridge: [
      S.take('木'), S.go(18.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('林'), S.go(14.0), S.grabAs('toss', -1), S.event('bridge', 3), S.event('regrow', 6), S.event('regrow', 6),
      S.go(27.6), S.take('木'), S.go(18.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.go(32.4), S.take('木'), S.go(17.96, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('森'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: 森 first and leave it by the gap; all three 木 grow back; 林 again for the bridge, then carry 森 over
    forest_first: [
      S.take('木'), S.go(18.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.go(32.4), S.take('木'), S.go(17.96, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('森'), S.go(23.6), S.grabAs('place'), S.event('regrow', 6), S.event('regrow', 6),
      S.go(27.6), S.take('木', 26.5), S.go(18.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('林'), S.go(14.2), S.grabAs('toss', -1), S.event('bridge', 3),
      S.take('森'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  crowd: ({ w }) => ({
    // A: 人 beside 人: 从; the tower's 人 on top: 众
    crowd: [
      S.take('人'), S.go(16.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.go(24.9, { land: 7 }), S.take('人'), S.go(15.96, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('众'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: drop the third 人 on 从 from a jump
    drop_on: [
      S.take('人'), S.go(16.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.go(24.9, { land: 7 }), S.take('人'), S.go(17.5), S.hop(-1, { steer: (p, x) => p.x < 16.0 ? 0 : x, grabAs: 'drop' }), S.event('forge', 2),
      S.wait(0.8), S.take('众'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  burn: () => ({
    // A: 林 from the two 木, stand on 火 holding 林: 焚, which burns the far thorns
    burn: [
      S.take('木'), S.go(16.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('林'), S.go(11.5, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('焚'), S.go(10.4), S.event('burn', 2), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: 火 burns the low hedge first and waits there; 林 comes to it
    low_hedge_first: [
      S.take('火'), S.go(23.6), S.event('burn', 2), S.go(20.4), S.grabAs('place'),
      S.take('木', 30.5), S.go(16.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('林'), S.go(19.6, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('焚'), S.go(10.4), S.event('burn', 2), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  drench: () => ({
    // A: 林 from the two 木, then 水 on its left: 淋, which douses the flames across the water
    drench: [
      S.go(22.4), S.take('木'), S.go(16.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.go(30.5, { land: 3 }), S.take('水'), S.go(15.0), S.face(1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('淋'), S.go(10.4), S.event('douse', 2), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: throw 水 at the flames first
    throw_water: [
      S.go(30.5, { land: 3 }), S.take('水'), S.go(11.0), S.grabAs('toss', -1), S.event('douse', 3), S.event('thud', 3),
      S.go(6.0), S.take('水', 8), S.go(12.0), S.grabAs('place'),
      S.go(22.4), S.take('木'), S.go(16.4), S.face(-1), S.grabAs('beside'), S.event('forge', 2),
      S.go(30.5, { land: 3 }), S.take('水'), S.go(15.0), S.face(1), S.grabAs('beside'), S.event('forge', 2),
      S.wait(0.6), S.take('淋'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
  flourish: () => ({
    // A: the tower's 日 on the other: 昌, whose light reaches the shade across the water
    flourish: [
      S.go(24.9, { land: 7 }), S.take('日'), S.go(15.5, { land: 2.9 }), S.grabAs('stack'), S.event('forge', 2),
      S.wait(0.8), S.take('昌'), S.go(10.4), S.event('dispel', 2), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
    // B: drop 日 on 日 from a jump
    drop_on: [
      S.go(24.9, { land: 7 }), S.take('日'), S.go(17.6), S.hop(-1, { steer: (p, x) => p.x < 15.6 ? 0 : x, grabAs: 'drop' }), S.event('forge', 2),
      S.wait(0.8), S.take('昌'), S.go(4), S.grabAs('offer'), S.event('win', 3),
    ],
  }),
};
