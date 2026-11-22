// reactions.js: the DATA of the reaction engine (docs/REACTIONS.md). Materials, tags, rules, behaviours,
// knob profiles. No logic about the world lives here, and no character is ever named: a card (cards.json)
// brings tags, verbs and params; rules match on tags. A new character is a card, not code.
(function (root) {
  'use strict';

  // ---------- materials (REACTIONS.md §2). flow: 0 none, 1 falls (powder), 2 liquid, 3 rises ----------
  const NAMES = ['air', 'dirt', 'stone', 'wood', 'plant', 'water', 'fire', 'ash', 'steam', 'mud', 'ice', 'metal'];
  const M = {}; NAMES.forEach((n, i) => { M[n] = i; });
  const MATERIALS = [
    { name: 'air',   solid: false, flow: 0, tags: ['air'] },
    { name: 'dirt',  solid: true,  flow: 0, tags: ['earth', 'solid', 'dry', 'soft'] },
    { name: 'stone', solid: true,  flow: 0, tags: ['earth', 'solid', 'heavy', 'hard'] },
    { name: 'wood',  solid: true,  flow: 0, tags: ['wood', 'flammable', 'solid'] },
    { name: 'plant', solid: false, flow: 0, tags: ['plant', 'flammable', 'growing'] },
    { name: 'water', solid: false, flow: 2, tags: ['water', 'wet', 'liquid'] },
    { name: 'fire',  solid: false, flow: 0, tags: ['fire', 'hot', 'light'] },
    { name: 'ash',   solid: false, flow: 1, tags: ['dry', 'powder'] },
    { name: 'steam', solid: false, flow: 3, tags: ['wet', 'hot', 'airy'] },
    { name: 'mud',   solid: true,  flow: 0, tags: ['earth', 'wet', 'soft'] },
    { name: 'ice',   solid: true,  flow: 0, tags: ['cold', 'solid'] },
    { name: 'metal', solid: true,  flow: 0, tags: ['metal', 'solid', 'heavy', 'conductor'] }
  ];
  // Every cell also carries the implicit tag 'cell'; objects 'object', bodies 'body' + 'living'; a thrown
  // object adds 'thrown'; a placed seed adds 'seed'. Rules use these to tell cell from entity.
  const BODY_TAGS = ['body', 'living'];

  // ---------- knobs (CHARTER §2: every number is a profiled knob, none per level) ----------
  const TICK = 30;                       // fixed step, Hz
  const BODY = {                         // playful PvP (CHARTER §4)
    off:     { knock: 0,   secs: 0   },
    playful: { knock: 1,   secs: 1   },
    rough:   { knock: 2.5, secs: 1.6 }
  };
  const CONJURE = {                      // copied from forge-2d: ink, regen secs per ink, cooldown, live-object cap
    relaxed:  { ink: 3, regen: 10, cool: 0.5, cap: 3 },
    standard: { ink: 2, regen: 15, cool: 1,   cap: 2 },
    strict:   { ink: 1, regen: 25, cool: 2,   cap: 1 }
  };
  // Budget caps (REACTIONS.md §6): over a cap the oldest effect fades first, nothing explodes.
  const CAPS = {
    relaxed:  { fire: 700, water: 4000, objects: 48, changes: 9000, ttl: 90 },
    standard: { fire: 400, water: 2500, objects: 32, changes: 6000, ttl: 60 },
    strict:   { fire: 200, water: 1200, objects: 16, changes: 3000, ttl: 40 }
  };
  const PROFILES = ['relaxed', 'standard', 'strict'];
  // Cell physics and reaction numbers (seconds unless noted; 'rate' is a per-tick chance)
  const CELL = {
    fireFed: 2.2, fireDrain: 3,          // a burning cell lasts this long, then ash; over the fire cap it drains x3
    steam: 1.6, ash: 10, mud: 30,        // lifetimes before steam / ash vanish and mud dries to dirt
    singed: 4, soaked: 6, chilled: 3,    // seconds a body effect lasts (x BODY.secs)
    grassCap: 4, treeBase: 3, treeStep: 2, treeCap: 9, treeGrowTicks: 6
  };

  // ---------- tag expressions: terms joined by '+' (all must hold); '!x' means not x; 'x|y' either ----------
  const exprCache = {};
  function parse(expr) {
    if (!exprCache[expr]) exprCache[expr] = expr.split('+').map(t => {
      const neg = t[0] === '!'; if (neg) t = t.slice(1);
      return { neg, any: t.split('|') };
    });
    return exprCache[expr];
  }
  function matches(expr, tags) {                      // tags: array or Set
    if (expr === '*') return true;
    const has = tags instanceof Set ? (x => tags.has(x)) : (x => tags.indexOf(x) >= 0);
    for (const t of parse(expr)) { const hit = t.any.some(has); if (hit === t.neg) return false; }
    return true;
  }

  // ---------- the rule table (REACTIONS.md §5): R1-R12 are the Phase 1A set ----------
  // {id, a (active), b (touched), ctx [adjacent | hit | inside | on-top], rate (per tick, adjacent/on-top only),
  //  fx [effects], note}. Effects: ignite, become(mat), steam, mud, grow(grass|tree), burnObj, body(fx),
  //  knock, land. 'who' names which side an effect lands on.
  const RULES = [
    { id: 'R1',  a: 'fire',  b: 'flammable+cell', ctx: ['adjacent', 'hit'], rate: 0.10,
      fx: [{ op: 'ignite', who: 'b' }], note: 'fire spreads to wood and plant; burnt cells become ash' },
    { id: 'R2',  a: 'water', b: 'fire+cell', ctx: ['adjacent', 'hit'], rate: 0.5,
      fx: [{ op: 'become', who: 'b', mat: 'steam' }], note: 'water douses fire; steam rises and fades' },
    { id: 'R3',  a: 'fire',  b: 'wood+object', ctx: ['hit'],
      fx: [{ op: 'burnObj', who: 'b' }], note: 'a wooden object that is hit by fire burns, then ash' },
    { id: 'R4',  a: 'water+cell', b: 'earth+soft+!wet+cell', ctx: ['on-top'], rate: 0.04,
      fx: [{ op: 'become', who: 'b', mat: 'mud' }, { op: 'become', who: 'a', mat: 'air' }], note: 'water on dirt makes mud' },
    { id: 'R5',  a: 'water+cell', b: 'plant+cell', ctx: ['adjacent'], rate: 0.02,
      fx: [{ op: 'grow', who: 'b', kind: 'grass' }], note: 'wet plant grows (grass, a few cells tall)' },
    { id: 'R6',  a: 'seed+wood', b: 'earth+wet+cell', ctx: ['on-top'],
      fx: [{ op: 'grow', who: 'a', kind: 'tree' }], note: 'a wood seed on mud grows a tree; height by size' },
    { id: 'R7',  a: 'fire',  b: 'cold+solid+cell', ctx: ['adjacent', 'hit'], rate: 0.15,
      fx: [{ op: 'become', who: 'b', mat: 'water' }], note: 'fire melts ice' },
    { id: 'R8',  a: 'cold+solid', b: 'water+cell', ctx: ['adjacent', 'hit'], rate: 0.03,
      fx: [{ op: 'become', who: 'b', mat: 'ice' }], note: 'ice freezes water, bit by bit' },
    { id: 'R9',  a: 'fire',  b: 'body', ctx: ['hit', 'inside'],
      fx: [{ op: 'body', who: 'b', fx: 'singed' }], note: 'singed: hops and smokes, no damage, wears off' },
    { id: 'R10', a: 'water', b: 'body', ctx: ['hit', 'inside'],
      fx: [{ op: 'body', who: 'b', fx: 'soaked' }], note: 'soaked: slower, drips; douses a singe' },
    { id: 'R11', a: 'thrown', b: 'air', ctx: ['hit'],
      fx: [{ op: 'land', who: 'b' }], note: 'a thrown thing lands as the cell its card names (earth builds terrain)' },
    { id: 'R12', a: 'thrown', b: 'body', ctx: ['hit'],
      fx: [{ op: 'knock', who: 'b' }], note: 'knockback by mass x speed x BODY.knock' },
    { id: 'R27', a: 'cold', b: 'body', ctx: ['hit', 'inside'],
      fx: [{ op: 'body', who: 'b', fx: 'chilled' }], note: 'chilled: slow for a short time' }
  ];

  // ---------- explicit no-ops (REACTIONS.md §4/§7: "no rule" is a decision, written down) ----------
  // The pair test (sim-test.mjs) requires every (material|card|body) pair to be covered by a rule or by one of
  // these, in either order.
  const NOOPS = [
    { a: 'air',            b: '*',               note: 'nothing there' },
    { a: 'solid+!fire',    b: 'solid',           note: 'two solid things just sit there (metal cutting is R16, later)' },
    { a: 'earth',          b: 'earth|wood|plant|metal|cold|powder|fire|wet|water|liquid', note: 'earth is inert except to water (R4)' },
    { a: 'metal',          b: '*',               note: 'metal is inert until R15/R16 (later); knock is R12' },
    { a: 'wood+!seed+!fire', b: '*',             note: 'wood is passive; it burns (R1/R3) or grows (R6)' },
    { a: 'fire',           b: 'fire|steam|powder|earth|metal|solid+!flammable+!cold|air', note: 'fire into fire, steam, ash, rock and metal does nothing new (R15 metal glow is later)' },
    { a: 'water',          b: 'water|steam|powder|earth+hard|wood|metal|plant+!cell|solid|wet|cold|liquid', note: 'water into water/steam/ash/rock/wood/metal does nothing new; wet wood/metal come later' },
    { a: 'steam',          b: '*',               note: 'steam only rises and fades; scalds nobody' },
    { a: 'powder',         b: '*',               note: 'ash only falls and fades' },
    { a: 'plant',          b: '*',               note: 'plants are passive; they burn (R1) and grow (R5)' },
    { a: 'cold',           b: 'cold|earth|wood|plant|metal|powder|steam|fire|solid|air|wet', note: 'cold into the rest does nothing new (fire melts ice: R7)' },
    { a: 'body',           b: 'body',            note: 'players never touch each other; they act on each other through objects (R9/R10/R12/R27)' },
    { a: 'living+object',  b: '*',               note: 'a written figure (person, friend, fruit) only knocks (R12) and lands (R11); it does not burn, melt or soak — creatures come in Phase 5' },
    { a: 'cell+solid+!cold', b: 'body',          note: 'terrain only holds you up' },
    { a: 'object+!thrown+!wielded', b: 'body',   note: 'a resting object is just a thing; nobody collides with it' },
    { a: 'wielded+!fire+!water+!cold', b: 'body', note: 'a wielded clod/stone/blade/staff does nothing to a body yet (shove and cut are R16, later)' },
    { a: 'wet',            b: '*',               note: 'wet things only douse fire/make mud/grow plants through water (R2/R4/R5)' }
  ];

  // ---------- behaviours: what a card's verbs name (GLYPH-CARDS.md §3). Data, shared by all cards ----------
  const BEHAVIOURS = {
    wield: {
      torch:  { kind: 'touch', reach: 1.6 }, staff: { kind: 'touch', reach: 1.8 }, clod:  { kind: 'touch', reach: 1.4 },
      blade:  { kind: 'touch', reach: 1.6 }, shard: { kind: 'touch', reach: 1.6 },
      jug:    { kind: 'pour',  mat: 'water' }
    },
    throw: {   // land: the cell it becomes where it lands (R11); after: 'consume' or 'stay' (becomes a free object)
      fireball:   { speed: 15, land: 'fire',  after: 'consume' }, splash:     { speed: 13, land: 'water', after: 'consume' },
      log:        { speed: 12, land: null,    after: 'stay' },    clodthrow:  { speed: 12, land: 'dirt',  after: 'consume' },
      bladethrow: { speed: 16, land: null,    after: 'stay' },    iceshot:    { speed: 15, land: 'ice',   after: 'consume' },
      stonethrow: { speed: 11, land: 'stone', after: 'consume' }
    },
    place: {
      flame: { kind: 'cell', mat: 'fire' },  pool:       { kind: 'cell', mat: 'water' }, seed: { kind: 'seed' },
      dirtblock: { kind: 'cell', mat: 'dirt' }, metalblock: { kind: 'cell', mat: 'metal' },
      iceblock:  { kind: 'cell', mat: 'ice' }, stoneblock:  { kind: 'cell', mat: 'stone' }
    }
  };

  const api = { NAMES, M, MATERIALS, BODY_TAGS, TICK, BODY, CONJURE, CAPS, PROFILES, CELL, RULES, NOOPS, BEHAVIOURS, matches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WReact = api;
})(typeof window !== 'undefined' ? window : globalThis);
