// 同舟 · Glyph Isles 2D — the character rules, shared by the sim (require) and the page (<script>).
// Ported by hand from games/tongzhou-forge/levels.js (never imported across games). The data is
// content.js, a copy of the 3D game's packed content (glyphs, recipes, variant forms).
//
// Where a piece sits decides the character. A recipe is [op, first, second, result]:
//   ⿰ first is on the left (as seen on screen)   ⿱ first is on top
// Order matters: 日 ⿰ 月 is 明, 月 ⿰ 日 is nothing. Recipes use base pieces (水, not 氵); the
// variant shapes in DATA.forms are display only. In the side view the screen axes ARE the world
// axes: beside means touching left-right, on top means resting on top.
(function (root) {
  'use strict';
  const DATA = (typeof module !== 'undefined' && module.exports) ? require('./content.js') : root.WContent;
  const GLYPHS = DATA.glyphs;
  const OPS = ['⿰', '⿱', '⿴', '⿵', '⿱⿰'];
  const RECIPE_LIST = DATA.recipes.map(r => Object.freeze(r.slice()));
  const RECIPES = {};
  RECIPE_LIST.forEach(r => { RECIPES[r[0] + r[1] + r[2]] = r[3]; });

  // The result of placing `a` and `b` in relation `op`, or null. There is no order-free form.
  function fuse(op, a, b) {
    if (OPS.indexOf(op) < 0) throw new Error('fuse(op, a, b): unknown op ' + JSON.stringify(op));
    return RECIPES[op + a + b] || null;
  }
  // Every recipe made of exactly these two pieces, in any op and either order.
  const mirrors = (a, b) => RECIPE_LIST.filter(r => (r[1] === a && r[2] === b) || (r[1] === b && r[2] === a));
  // The glyph to draw for `ch` in slot `slot` (1 = first) of `op`: 水 on the left draws as 氵.
  const FORMS = DATA.forms || {};
  const form = (ch, op, slot) => (FORMS[ch] && FORMS[ch][op + slot]) || ch;

  // Walls that stand until the right kind of stone comes near (carried or lying there).
  const WALLS = {
    thorn: { el: 'fire', verb: 'burn', name: 'thorns' },
    flame: { el: 'water', verb: 'douse', name: 'flames' },
    shade: { el: 'light', verb: 'dispel', name: 'shade' }
  };
  // Stones that fill a gap they fall into: wood grows a bridge, earth raises a mound.
  const FILLS = ['wood', 'earth'];
  const reachOf = g => (g && g.reach) || 1.3;

  const api = { GLYPHS, OPS, RECIPES, RECIPE_LIST, WALLS, FILLS, reachOf, fuse, mirrors, form };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
