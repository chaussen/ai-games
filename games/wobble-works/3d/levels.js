// Wobble Works 3D — stage data, shared by the server (require) and the client (<script>).
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

  const LEVELS = [
    {
      id: 'first-light', name: 'First Light', cn: '第一束光', par: 30, pal: 'dawn',
      hint: 'Carry the Glow Core to the beacon. It is heavy: no jumping while you hold it, so toss it over the gap.',
      map: [
        '..44..........',
        '3333..33<22222',
        '3333..33<22222',
        '3333..33<22222',
        '.........22...'
      ],
      spawn: [12.5, 2.5], core: [10.5, 2.5], beacon: [1.5, 2.5],
      gems: [[2.5, 0.5], [5, 2.5, 4.0], [9.5, 4.5]],
      trees: [[3.5, 0.5], [13.5, 1.5]]
    },
    {
      id: 'hold-the-door', name: 'Hold the Door', cn: '帮我顶住', par: 55, pal: 'mint',
      hint: 'Plates only work while something stands on them. Hold one for a friend, or park a crate on it.',
      map: [
        '33.....4455.2234',
        '222....222242222',
        '222....2222.2222',
        '222....222242222'
      ],
      spawn: [13.5, 1.5], core: [12.5, 1.5], beacon: [1.5, 2.5],
      plates: [
        { id: 'A', at: [13, 3], c: 0 }, { id: 'A2', at: [9, 1], c: 0 },
        { id: 'B', at: [8, 3], c: 1 }, { id: 'B2', at: [1, 1], c: 1 }
      ],
      movers: [
        { id: 'gate', rect: [11, 2, 1, 1], from: 4, to: 2, when: ['A', 'A2'], c: 0, speed: 3 },
        { id: 'bridge', rect: [3, 2, 4, 1], from: -3.4, to: 2, when: ['B', 'B2'], c: 1, speed: 7 }
      ],
      crates: [[14.5, 2.5], [9.5, 2.5]],
      gems: [[7.5, 0.5], [5, 2.5, 2.7], [15.5, 0.5]],
      trees: [[9.5, 0.5], [0.5, 0.5], [14.5, 0.5]]
    },
    {
      id: 'going-up', name: 'Going Up', cn: '升降台', par: 50, pal: 'dusk',
      hint: 'The Core cannot climb steps. Set it on the lift, then hold the plate to send it up.',
      map: [
        '4444444...',
        '4444444...',
        '4444..3...',
        '4444..2...',
        '..11111111',
        '..11111111',
        '..11111111'
      ],
      spawn: [8.5, 6.5], core: [3.5, 5.5], beacon: [1.5, 2.5],
      plates: [{ id: 'L', at: [8, 5], c: 2 }],
      movers: [{ id: 'lift', rect: [4, 2, 2, 2], from: 1, to: 4, when: ['L'], c: 2, speed: 1.6 }],
      crates: [[6.5, 5.5]],
      gems: [[6.5, 2.5], [9.5, 4.5], [5.5, 0.5]],
      trees: [[0.5, 0.5], [2.5, 0.5], [2.5, 6.5]]
    },
    {
      id: 'bucket-brigade', name: 'Bucket Brigade', cn: '接力传递', par: 60, pal: 'citrus',
      hint: 'Face a friend and press THROW to pass the Core up a step. Alone? Two crates raise the bridge on the long way round.',
      map: [
        '4<33<2....22<111',
        '4<33<2....22<111',
        '4............111',
        '4444333322221111',
        '4444333322221111',
        '4444333322221111'
      ],
      spawn: [14.5, 4.5], core: [13.5, 3.5], beacon: [1.5, 4.5],
      plates: [{ id: 'P', at: [9, 5], c: 3 }, { id: 'Q', at: [11, 5], c: 3 }],
      movers: [{ id: 'bridge', rect: [6, 0, 4, 2], from: -3.4, to: 2, when: ['P', 'Q'], all: true, c: 3, speed: 7 }],
      crates: [[9.5, 4.5], [11.5, 4.5]],
      gems: [[8, 1, 2.7], [5.5, 5.5], [0.5, 2.5]],
      trees: [[15.5, 0.5], [3.5, 5.5]]
    },
    {
      id: 'the-works', name: 'The Works', cn: '大工坊', par: 80, pal: 'night',
      hint: 'Everything at once: a gate, a lift, and a gap before the beacon.',
      map: [
        '333..33333....',
        '333..33333....',
        '333..33..3....',
        '.....33..2....',
        '.....111113111',
        '.....11111.111',
        '.....111113111'
      ],
      spawn: [13.5, 5.5], core: [11.5, 4.5], beacon: [1.5, 1.5],
      plates: [
        { id: 'A', at: [12, 6], c: 0 }, { id: 'A2', at: [9, 6], c: 0 },
        { id: 'L', at: [5, 5], c: 2 }
      ],
      movers: [
        { id: 'gate', rect: [10, 5, 1, 1], from: 3, to: 1, when: ['A', 'A2'], c: 0, speed: 3 },
        { id: 'lift', rect: [7, 2, 2, 2], from: 1, to: 3, when: ['L'], c: 2, speed: 1.6 }
      ],
      crates: [[12.5, 5.5], [6.5, 5.5]],
      gems: [[4, 1, 3.9], [13.5, 4.5], [9.5, 0.5]],
      trees: [[0.5, 0.5], [5.5, 0.5], [13.5, 6.5]]
    }
  ];

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

  const api = { LEVELS, parse, cellTop };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
