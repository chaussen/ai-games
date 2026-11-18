// 同舟 · Glyph Isles 2D — the isles of the greybox, as side views. Shared by the sim and the page.
//
// A map is a list of rows, top row first. One cell is 1 x 1 world unit; x runs right, y runs UP
// (row 0 is the top of the sky, the last row is y = 0, the river bed).
//   .   air
//   #   rock (solid)
//   ~   water: fall in and you are back on the last safe ground; a stone floats home
//   _   a gap a wood or earth stone can fill: 木 dropped into it grows a bridge across the whole run
//       (only if the run is no longer than the stone's `span`)
//   T   thorn hedge: solid, it throws you back; a fire stone near it (carried or lying) burns it
//   b   the boat's deck (solid); the crew lands here and the title card shows while you stand on it
// Entities are placed by x; stones drop onto whatever is under them when the isle loads.
//   stones [ch, x]          pieces lying on the isle (they grow back when used, if `regrow`)
//   gems   [x, y]           take one: it counts, and it refills your 轻功 (a new source)
//   glow   [x, y]           glow-gems: only there at dusk (杳)
//   clouds [x, y]           touch one in the air: it refills your 轻功 (each cloud once per chain)
//   pavilion x              stands on the ground there and wants the isle's character
// Every isle is checked by sim-test.mjs: it can be won by a scripted player, in two ways.
(function (root) {
  'use strict';
  const ISLES = [
    {
      id: 'sun-and-moon', name: 'Sun and Moon', cn: '日月同明', want: '明', pal: 'night', regrow: true,
      tip: 'Find 日 and 月. Thorns fear 火; a gap wants 木. There is always more than one way.',
      map: [
        '..............................................',
        '..............................................',
        '..............................................',
        '..............................................',
        '..............................................',
        '.......................###....................',
        '.......................###....................',
        '.......................###....................',
        '#########..............####...................',
        '#########..........T...###....................',
        '#########..........T...###....................',
        '###############################___#######bbbb.',
        '###############################~~~#######~~~~~',
      ],
      spawn: 42.5,
      pavilion: 3.5,
      stones: [['火', 36.5], ['木', 38.5], ['日', 24.5], ['月', 13.5]],
      gems: [[32, 4.4], [19.5, 6.6], [1.2, 7.4]],
      clouds: [[28.8, 6.4], [22.3, 7.6], [5.5, 8.2]],
      glow: [],
    },
    {
      id: 'dawn', name: 'Dawn', cn: '杲', want: '杲', pal: 'dusk', regrow: true,
      tip: 'The pavilion waits for sunrise: the sun above the trees. Stand on a stone to set yours on top of it.',
      map: [
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '........................................',
        '######..................................',
        '######..................................',
        '######..................................',
        '#########...............................',
        '#########...............................',
        '#########...............................',
        '#############___####################bbbb',
        '#############~~~####################~~~~',
      ],
      spawn: 37.5,
      pavilion: 2.5,
      stones: [['木', 19.5], ['日', 26.5]],
      gems: [[14, 4.6], [7.5, 7.6], [30.5, 4.2]],
      clouds: [[22.5, 5.4], [24.2, 7.8], [22.6, 10.2]],
      glow: [[23.8, 12]],
    },
  ];

  // The grid of one isle: w, h, and the cell char at (cx, cy) with cy counted up from the bottom.
  function parse(L) {
    const h = L.map.length, w = Math.max.apply(null, L.map.map(r => r.length));
    const cells = [];
    for (let cy = 0; cy < h; cy++) {
      const row = L.map[h - 1 - cy];
      const out = [];
      for (let cx = 0; cx < w; cx++) out.push(row[cx] || '.');
      cells.push(out);
    }
    return { w, h, cells };
  }

  const api = { ISLES, parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WIsles = api;
})(typeof window !== 'undefined' ? window : globalThis);
