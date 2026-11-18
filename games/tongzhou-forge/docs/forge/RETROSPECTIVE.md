# Positional Forge: retrospective (interim, 2026-11-18, before any playtest)

This is written before G1 and G2, so it records what was built and what went wrong, not whether it
is fun. Phase 8 rewrites it after the playtests.

## 1. Design intent

Where a piece sits decides what it means (CONCEPT.md). 日 on 木 is sunrise (杲), 木 on 日 is sunset
(杳). The grammar is strict; the play has to feel relaxed (the middle point, FG-D003). Every strictness
is a knob in `FORGE`, grouped into the profiles relaxed, standard and strict. After the middle point,
the count of characters players can make **and use with an obvious effect** is the key measure
(FG-D016).

## 2. What shipped

| Area | Shipped |
|---|---|
| Ground forging | Beside (⿰ on screen axes) and on top (⿱ from physical support); snap, rescue, dud cooldown, wrong-life knobs; placement labels BESIDE / ON TOP that never preview the result |
| Body forging | Stand on a friend who holds a stone (their stone moves to an arm hold); any participant in a formation presses FORGE and gets the result; a dud keeps both stones |
| Board | Variant forms (氵 亻 忄 in the left slot), neutral placement marks, forge slide-together burst, dusk dimming with glow-gems, FORGE label, `?strict=` override |
| Effects | wood bridges, fire burns thorns, water douses flames, light dispels shade (new), earth raises mounds (new), 杳 brings dusk (new) |
| Content | 36 characters, 24 recipes checked against the MMAH dictionary; 25 characters do something visible in play |
| Isles | 9, each with two ways through plus a body route, proven by the judge's bots replaying real inputs |
| Playtest tooling | `server.js --log` (ids only) and `lab/playlog.mjs` for the G1 numbers |

## 3. Defect log (found and fixed during the build)

| Where | Defect | Found by |
|---|---|---|
| Sim (F2.5) | Square stone footprints stacked a stone that was meant to sit beside (the beside spot is a world diagonal) | Stacking tests |
| Sim (F2.6) | The stage clock only runs after the crew starts, so the dud cooldown never expired; a separate `clock` now runs every step | Forgiveness tests |
| Sim (F3.1) | The dusk countdown passed 0 before `setDusk(0)`, so "dusk off" never fired | Dawn tests |
| Judge (Phase 4) | Banning ground forging let bots forge by "putting a stone down" into a placement; forges are now classified by the `forge` event's `held` flag | Reading judge routes |
| Judge (Phase 4) | Counting "forge in hand" as a second way made every isle two-way, hiding real one-way isles; body routes are now reported as `also:` and never count | `judge-test` plateau case |
| Stage (on-my-shoulders) | The pavilion and every boat path sat inside 炎's reach, so the hedge always burned and no second way existed; the pavilion moved south | Judge |
| Client (effects) | `lite` used outside the block that defined it: a page error on every dispel | Board check `t09` |

## 3b. First playtest (John, one phone, 2026-11-18)

| Finding | Fix (FG-D017, FG-D018) |
|---|---|
| A failed 明: no way to see how it failed (wrong side? not lined up? something in the way?) | A frame round every resting pair: columns for BESIDE, rows for ON TOP; red after a dud; dashed NOT QUITE after a near miss, which used to be silent |
| "日 + 月 make nothing" was false: they make 明 the other way round | The message names the arrangement and says when the pair goes together another way |
| The pad opened with 木 in the square, so it looked like the only thing to write; Trace confused; "Practice next" suggested nothing to try | Blank pad; ideas to try (tap to copy, tap again to hide); no Trace switch |
| Portrait phone: the isle is too small to play | Portrait zooms to 7 units across and follows you; a hint to turn sideways |

Not fixed yet: controller and movement niggles (not a priority per John); side-by-side stones are
0.62 apart but their glyphs are 1.35 wide, so a BESIDE pair overlaps on screen; on a portrait phone
the goal note covers the quick-call buttons.

## 4. Known gaps

- **No playtest yet.** G1 (is stacking fun or fiddly?) and G2 (does body forging work socially?)
  need people. Every knob value is still the first guess.
- **11 folk characters do nothing in play**: 人 从 众 休 伙 女 子 口 十 呆 古. They are wanted or are
  pieces, but have no effect.
- Body formations of three or more (pyramids) and enclosure (⿴) are Phase 7, not built.
- The judge has no `--sloppy` hand-margin measure yet (Phase 5), so fiddliness is unmeasured.
- On the board, a top player's name tag can cover their held stone in a formation.
- `tasks/checks/t03.mjs` and `t07.mjs` are frozen checks that now fail by design (content moved on).

## 5. Next, in priority order

**Superseded for now by `SIDE-VIEW.md`** (second playtest, 2026-11-18): the screen diet, the 3D fixes and the side view come first.


1. Run G1 on `dawn` with all three profiles, then G2 on `on-my-shoulders`; read the numbers with
   `lab/playlog.mjs` and retune one knob group at a time (PLAYTEST.md §3).
2. Effects for the folk characters. These are new mechanics, so they need a design and a review first.
   Candidates that fit the meanings: 众 (crowd) weighs down a plate that one person cannot; 呆 (dull)
   freezes a moving lift or the boat for a few seconds; 口 (mouth) swallows a hazard; 休 (rest) makes a
   resting spot that refills the leap.
3. Phase 5 judge work: `order-trap` warning and the `--sloppy` hand margin.
