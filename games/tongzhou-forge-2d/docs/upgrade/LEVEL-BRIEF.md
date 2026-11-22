# Level-design brief (for the phase-3 level agent). Self-contained.

You are re-laying the 23 isles of 同舟 Glyph Isles 2D. Read this brief; you should not need to read the sim. If something here
contradicts the code, the code's *numbers* win and the brief needs a fix: say so in your notes.
Do **not** edit `sim.js`, `rules.js` or `content.js`. You edit isle data only (`isles.js`, see §8), plus notes.
Phase 3 starts only after phase 1 (the rules) has landed and `sim-test.mjs` runs the new validators (`TEST-SPEC.md` §5).

## 1. The game in one paragraph

A side-view platformer for up to four phones. The player walks, jumps and leaps (轻功), carries character **stones**, and
sets or throws them. Where a stone is placed forges characters (木 beside 木 makes 林; order matters). Each isle has a
**pavilion** that wants one character (the isle's *goal*). The player forges it and offers it at the pavilion.
Each character does what it means (`ELEMENTS.md`): 木 bridges and grows, 火 burns, 水 puts out, 金 chops, 土 dams and
ramps, 云 lifts. **The point of the upgrade: every obstacle has an answer you can name by the character's meaning.**

## 2. The grid

An isle is rows of characters, top row first; one cell is 1 x 1 unit; x runs right, y runs UP.
Existing: `.` air, `#` rock, `~` water (fall in: back to safe ground), `_` fillable gap, `T` thorns, `F` flames, `S` shade,
`b` boat deck (spawn end, keep `bbbb`). New: `C` sheer cliff, `R` boulder, `D` wooden gate, `M` iron bars, `L` embers,
`W` current, `V` updraft vent. (`w` `e` are made by the game; never place them.)
Entities by x: `stones [glyph, x]`, `write [glyphs]` (what Conjure may write here), `gems [x, y]`, `glow [x, y]` (dusk gems),
`pavilion x`, `spawn x`. **Do not use `clouds`.** New fields: `biome`, `answers`, `beats` (§8).
Size: 36-50 wide, 10-16 high. Keep the boat deck at spawn.

## 3. Player metrics (from the real controller)

| Thing | Value |
|---|---|
| Run speed | 4.6 u/s (3.8 carrying) |
| Plain jump apex | 1.65 cells: clears a 1-cell rock, never 2 |
| Leap (轻功) | +1.9 more from where you are; one per charge; chain up to 6; each *new surface* in the air refills one (a gem, a stone side, a friend's head). **A `C` face never refills.** |
| Plain jump distance | about 2.9 cells on the flat |
| Gap (`_`) bridges | 木 spans 3, 林 spans 5, 森 spans 7, 土 spans 2, 田 spans 3, in cells of the run |
| Stone | 0.9 x 0.9, solid. **Only bearing glyphs hold you above one stone-height** (木 林 森 土 田 山 人 从 众 石) |
| Throw | about 6.5 u/s forward, 5.5 up: roughly 4-5 cells on the flat |
| Reach | an element works within 1.3 cells of its target (2.6 for 炎 焚 淋 明 昌 杲 雨) |
| Builds | 木 trunk 3 / 林 5 / 森 7 cells high; 土 ramp 2 / 田 3; 山 peak 5; 人 1 / 从 2 / 众 3 stacked |
| 云 lift | rises about 6 cells over 4 s |

A tall rock column up to 3 cells is fine as `#` (plain jump plus a nudge). **Anything higher is a cliff (`C`) and must
declare its answers (§5).**

## 4. Hard rules (the validators check these)

- **L1 Variety.** Each isle uses at least the obstacle kinds in the ramp (§6); across the game every element in
  `ELEMENTS.md` §2 appears on at least two isles. No isle has more than 2 of the same obstacle kind in a row.
- **L2 Not flat.** No run of flat ground longer than 8 cells without a step, rise or drop; at least one vertical beat and one
  crossing beat per isle (a *beat* is a distinct obstacle moment; list them in `beats`).
- **L3 Cliffs have answers.** Every `C` run >= 3 cells tall has an entry in `answers` keyed by its foot column, with at least
  one tool stone available on the isle (lying, or in `write`) whose `build` can reach the top. Two answers where the budget allows.
  **No route may need a non-bearing stone to gain height above 1 stone** (口 十 日 月 水 火 金 etc.).
- **L4 Stone budget.** Every stone a route spends exists on the isle, or regrows (`regrow: true`), or can be written (`write`).
  A spent tool must not leave the isle unwinnable (a "dead-end" check exists).
- **L5 Seen before used.** The first appearance of a mechanic is on a calm stretch in view of the player, with a harmless
  first example, and named in `tip` (`ELEMENTS.md` §5). A new mechanic never debuts inside a gauntlet.
- **L6 One winning intent, two routes.** Two routes that differ in more than order (e.g. build a trunk vs ride a cloud;
  burn the thorns vs chop the gate then bridge), plus at least one **decoy** that costs something (burn your own bridge, a
  stack that slides off). Routes are listed in notes; `routes.mjs` encodes them later.
- **L7 Goal pieces are not spent as tools.** If the isle's recipe needs 木 and 日, a route may spend a *spring* copy only if
  `regrow: true`; never make the goal stone the only way past something.
- **L8 No elevation by padding.** If a gap in height can be crossed by stacking inert stones, it is a level error.
- **L9 Readable.** Pavilion and spawn on solid ground; gems and glow gems reachable; nothing needed is off-screen. Camera
  follows the player; a phone shows about 13 x 7 cells.
- **L10 Pace.** An isle is 2-5 minutes for a first-time player: 3-5 beats, no beat repeats back to back.

## 5. How to declare answers

```js
answers: { '27': ['木', '土'], '41': ['云'] }  // keyed by the foot column x of each cliff; glyphs that can solve it
beats: ['bank', 'thorns', 'river', 'cliff', 'gate']   // names of the isle's beats left to right (or in play order)
biome: 'earth'
```
A cliff's answer glyphs must fit: a cliff of height h needs a build of height >= h (木 3, 林 5, 森 7, 土 2, 田 3, 山 5, 云 6,
人 1/从 2/众 3 within `stackMax`). A 5-high cliff may be answered by 林, by 山, by 云, or by a 众 stack (3) + a jump.

## 6. The ramp: 23 isles, goals and recipes unchanged, order unchanged

Recipes and goals are the teaching order (beside, on top, order, elements, two-step). **Keep them.** What changes is the
world around them. "Introduces" is what is new for the *player*; earlier mechanics may return. "Tools" are extra stones the isle may carry
beyond the goal's pieces (they are tools: they may also be forged, not goals).

| # | id | Goal (recipe) | Biome | Introduces (calm, in view) | Obstacles (min kinds) | Tools |
|---|---|---|---|---|---|---|
| 1 | two-trees | 林 (木 beside 木) | wood | 木 bridge over a river; a rolling bank | gap (2) | 木 木 |
| 2 | one-tree | 林 (写 木) | wood | writing | gap, a short rock step (2) | 木 + write 木 |
| 3 | sun-and-moon | 明 (日 left of 月) | light | **act, not proximity**: 点 light, thorns | thorns, gap, a step (3) | 火 木 日 月 |
| 4 | dawn | 杲 (日 on 木) | wood | **cliff `C` h3 and the 木 trunk**; glow gems at dusk | cliff, gap, shade-free (3) | 木 日 (木 regrows) |
| 5 | old-leaf | 古 (十 on 口) | earth | **inert stones slide off**: a tower 口 十 cannot climb; 土 ramp is the answer | cliff h4, thorns or gap (3) | 口 十 土 |
| 6 | friends | 朋 (月 beside 月) | light | **云 lift** (a tall pillar, h6) | pillar, gap, shade (3) | 月 月 云 |
| 7 | rest | 休 (人 left of 木) | water | **泼 pour** on flames; river | flames, river, a step (3) | 人 木 水 |
| 8 | early-light | 早 (日 on 十) | light | **照 shine** on shade; cave with an overhang | shade, cliff h3, gap (3) | 日 十 |
| 9 | fruit-field | 果 (田 on 木) | earth | 田 ramp over a 3-gap mound; wet washes it | gap, hill, thorns (3) | 田 木 火 |
| 10 | red-earth | 赤 (土 on 火) | fire | **embers `L`**: 水 steam, 土 cover | embers, thorns, cliff h4 (3) | 土 火 水 |
| 11 | good | 好 (女 left of 子) | light | shade across a gap; reach | shade, gap, cliff h4 (3) | 女 子 日 |
| 12 | apricot | 杏 (木 on 口) | wood | **金 chops a wooden gate `D`**; fire is the costly alternative (burns your bridge) | gate, gap, thorns (3) | 木 口 金 火 |
| 13 | partner | 伙 (人 left of 火) | wood | counters: burn thorns *before* you bridge | thorns, gate, river (3) | 人 火 木 金 |
| 14 | bathe | 沐 (水 left of 木) | water | **current `W`**; 石 holds; 土 dams | current, river, flames (3) | 水 木 石 土 |
| 15 | water-the-tree | 沐 (写 水) | water | writing a tool | flames, river, a step (3) | 木 + write 水 |
| 16 | leaf | 叶 (口 left of 十) | light | **风 and a vent `V`**; a cave | vent, shade, cliff h5 (3) | 口 十 风 云 |
| 17 | stove | 灶 (火 left of 土) | fire | **boulder `R`**: 火 then 水; embers | boulder, embers, thorns (3) | 火 土 水 |
| 18 | blaze | 炎 (火 on 火) | fire | **reach**: 炎 melts iron bars `M` / thorns across water | bars, thorns across river, flames (3) | 火 火 土 |
| 19 | forest | 森 (木 on 林) | wood | tall trunk 林/森 for a 7 cliff; 5-gap | cliff h7, 5-gap, gate (3) | 木 木 木 金 |
| 20 | crowd | 众 (人 on 从) | earth | **folk ladder**: 人 从 众 are bearing; cliff h4 | cliff h4, thorns, gap (3) | 人 人 人 |
| 21 | burn | 焚 (林 on 火) | fire | counters under pressure: burn, then rebuild | thorns, bridge, cliff (4) | 火 木 木 水 |
| 22 | drench | 淋 (水 left of 林) | water | **雨**: 云 on 水; reach 2.6 | flames, current, mound, cliff (4) | 水 木 木 云 土 |
| 23 | flourish | 昌 (日 on 日) | light | finale: everything, in two directions; 山 available | shade across water, cliff h5, gate, vent (4) | 日 日 山 云 风 金 |

Notes: "Tools" is a starting palette, not a quota; trim to keep each isle readable. Where a goal glyph used to act passively
(好, 沐, 灶 melting shade, dousing flames, burning thorns on arrival at the pavilion side) it no longer does; those isles
need a stone supplied for the obstacle (isles 11, 14, 17 above) or a deliberate delivery.

## 7. Terrain vocabulary (use it, vary it)

Rolling banks and slopes (stepped cells); multi-level islands (a low path and a canopy path); overhangs and caves (a ceiling
you jump under); floating ledges; a bank on both sides of a river; terraces; a ruin or hut silhouette on the far bank;
waterfalls beside cliffs; a hollow valley with a lantern. **Reject** the old template: flat ground, one gap, one wall, pavilion at the far end.
Vary spawn and pavilion x (either side; spawn may be mid-isle with two directions on the finale).

## 8. Deliverables and format

1. The 23 isle objects in the existing `isles.js` format, with the new fields, **in a draft file** `isles.v2.js` beside `isles.js`
   (same IIFE shape and export, ids unchanged). Do not replace `isles.js`; the rules agent switches it on after validation.
2. `docs/upgrade/ISLE-NOTES.md`: per isle: one-line story, the beats left to right, the two winning routes in plain steps
   (which stone, where, what verb), the decoy and its cost, stones spent and where they come from, answers for each cliff,
   and anything you could not express. This feeds `routes.mjs` and the playtest.
3. ASCII preview of every isle in the notes (the map rows are the preview).

## 9. How to self-check

Run (once phase 1 is in): `node sim-test.mjs` (validators in `TEST-SPEC.md` §5 read `isles.v2.js` when `ISLES=v2`), then for each
isle write the two routes' steps in notes and confirm by hand that every stone spent exists. Then request a screenshot
pass (phase 2 art agent): every isle at three points along it, read and judge. Finish with the checklist `TEST-SPEC.md` §8
in your notes. Open questions for John go in the final message, not in the data.

## 10. Taste

Imagine the same recipes in a different order: if you can swap two isles' maps and nobody would notice, redo one.
Each isle needs one thing a player will remember (the long trunk up the cliff; the boulder cracking in steam; the cloud
carrying you over a waterfall). Avoid new obstacles that have only one use.
