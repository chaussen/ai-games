// 同舟 · Glyph Isles — map parsing and the character rules, shared by the server (require) and the client (<script>).
//
// World units: one map cell is 1 x 1. X runs right along a row, Z runs down the
// rows, Y is up. The camera is fixed and looks from +X/+Z, so row 0 / column 0
// is the far corner: build tall things there and nothing hides the players.
//
// Map characters
//   .        void (fall = respawn)
//   1-9      flat floor, top at that height
//   < > ^ v  ramp rising toward -X, +X, -Z, +Z. Its low end takes the height of
//            the flat cell on its downhill side.
// Movers are rising pillars: a footprint rect [x, z, w, d] whose top travels from
// `from` to `to` while the plates in `when` are held (any of them, or all of them
// with all:true). Leave the map void under a mover.
(function (root) {
  'use strict';

  // The data lives in content/*.json and is packed into content.js by tools/pack.mjs.
  // Every character that can exist has an `el`, which is what it does in the world:
  //   wood  thrown into a gap, it grows into a bridge up to `span` cells long
  //   fire  burns a thorn hedge within `reach`
  //   water douses a wall of flames within `reach`
  // Two stones that touch become one (RECIPES). Order does not matter. All real characters.
  //
  // The story of every stage: the crew sails in on one boat, mist has closed the
  // river ahead, the pavilion on the isle wants one character. Give it, the mist
  // lifts, everyone boards again and the boat sails on. docs/STAGES.md describes
  // every field of a stage.
  const DATA = (typeof module !== 'undefined' && module.exports) ? require('./content.js') : root.WContent;
  const GLYPHS = DATA.glyphs;
  const RECIPES = {};
  DATA.recipes.forEach(r => { RECIPES[r[0] + r[1]] = r[2]; RECIPES[r[1] + r[0]] = r[2]; });
  const fuse = (a, b) => RECIPES[a + b] || null;
  const LEVELS = DATA.stages;

  function parse(L) {
    const d = L.map.length;
    const w = Math.max.apply(null, L.map.map(r => r.length));
    const cells = [];
    for (let z = 0; z < d; z++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const ch = L.map[z][x] || '.';
        if (ch >= '1' && ch <= '9') row.push({ h: +ch, ramp: null, low: +ch });
        else if ('<>^v'.indexOf(ch) >= 0) row.push({ h: 0, ramp: ch, low: 0 });
        else row.push(null);
      }
      cells.push(row);
    }
    const at = (x, z) => (z >= 0 && z < d && x >= 0 && x < w) ? cells[z][x] : null;
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      const c = cells[z][x];
      if (!c || !c.ramp) continue;
      const n = c.ramp === '>' ? at(x - 1, z) : c.ramp === '<' ? at(x + 1, z) : c.ramp === 'v' ? at(x, z - 1) : at(x, z + 1);
      if (!n || n.ramp) throw new Error('ramp at ' + x + ',' + z + ' in ' + L.id + ' has no flat cell on its low side');
      c.low = n.h; c.h = n.h + 1;
    }
    let maxH = 1;
    for (const row of cells) for (const c of row) if (c && c.h > maxH) maxH = c.h;
    for (const m of L.movers || []) maxH = Math.max(maxH, m.from, m.to);
    return { w, d, cells, at, maxH };
  }

  // Height of a cell's surface under the point (px, pz), clamped into the cell.
  function cellTop(c, cx, cz, px, pz) {
    if (!c.ramp) return c.h;
    let t = c.ramp === '>' ? px - cx : c.ramp === '<' ? cx + 1 - px : c.ramp === 'v' ? pz - cz : cz + 1 - pz;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return c.low + t;
  }

  const api = { LEVELS, GLYPHS, RECIPES, fuse, parse, cellTop };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
