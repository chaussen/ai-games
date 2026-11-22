# Playtest findings, 2026-11-22 (John, a few isles, solo, standard profile)

Source: John's own playtest. The autoplay (`lab/autotest/`, `routes.mjs`) reported nothing wrong; these are the
issues it could not see. Data below was measured from `isles.js` and `sim.js` on 2026-11-22 (commit 116f235).

## 1. The five findings

| # | John's words (in substance) | Class |
|---|---|---|
| F1 | **Isle patterns too repetitive.** Terrains are almost identical with minor differences. Boring for lack of elements: water, mountain, a very small number of obstacles. Needs a plan for *all elements first*, then a level-design agent. | content variety |
| F2 | **Puzzle solving too relaxed.** Fire in the way: I carry water and before I throw it the fire is gone. I carry 早 or 日 and the obstacle lights up. The player does not even realise what happened. Few obstacles with one action (throw) and very broad, vague interactions: nothing to think about or enjoy. | rules / feedback |
| F3 | **Some challenges are not solvable in a reasonable way**, mostly very high cliffs. What am I expected to do? Jumping higher does not work. Writing characters as blocks works visually, but is a character just a square block for padding? What about its meaning? Can I really write 十 and stand on it? In many isles I have no choice but to use 口, 十 as stepping stones. This does not convey the meaning of the objects. | rules / level design |
| F4 | **Clouds.** I did not know clouds launch the player higher. Extra help over terrain but very abrupt with nothing to hint. I want characters and their meaningful representations to get over; wood making a bridge is acceptable. | rules / feedback |
| F5 | **One Stroke style is clumsy** in style, design and gameplay; movement stiff; the stick man should be small but supple and is big and awkward. Flag obsolete; do not touch for now. | look |

Direction John gave afterwards: significant fix to systematic flaws, even without a co-op playtest; analyse fully, then
suggest an upgrade; docs and test specs first so other agents can take over in new sessions.

## 2. Measured data (23 isles, not 24)

`isles.js` holds **23** isles (21 beta + One Tree + Water the Tree).

| Measure | Value | Meaning |
|---|---|---|
| Map cell types in use | 7: `.` `#` `~` `_` `T` `F` `S` (+ `b` deck) | F1: three obstacle kinds, one gap kind |
| Isle size | 36-46 wide, 10-15 high | all similar scale |
| Isles with any cloud | 6 of 23 (Sun and Moon 3, Dawn 3, Friends 3, Leaf 2, Crowd 1, Flourish 1) | F4: invisible pickups |
| Isles whose only obstacle is gap + low wall | Two Trees, One Tree, Fruit Field, Apricot, Forest, Stove ... | F1 |
| Tallest rock column (cells) | 9 Friends, 8 Sun and Moon / Dawn / Leaf, 7 Old Leaf / Crowd / Flourish, 6 Early Light | F3 |
| Obstacle variety per isle | usually 1 kind (T or F or S) plus a gap | F1, F2 |
| Isles with wall type T / F / S | T: 6 (Sun and Moon, Red Earth, Partner, Stove, Blaze, Burn); F: 4 (Rest, Bathe, Water the Tree, Drench); S: 3 (Early Light, Good, Flourish) | F1: each isle has one wall kind at most |

Plain jump apex 1.65, leap +1.9, chain 6 leaps when each leap touches something *new* (`QI` in `sim.js`). A stone is
0.9 x 0.9 and solid for every glyph.

## 3. Root causes, with code

| Finding | Where | Why it happens |
|---|---|---|
| F2 | `sim.js` `stepWalls()` (~line 1061), called from `step` (~line 408) | Every frame, for each unfinished wall, any stone of the matching element (`k.g.el === W.el`) within `reachOf(k.g) + SW` of the wall's rectangle sets `m.done = true`, clears the cells and emits one event. The stone may be carried, lying or thrown. Reach 1.3 (2.6 for 炎 焚 淋 明 昌 杲). So walking up holding 水 is enough, and the wall is gone before any throw. No spent stone, no timer, no attribution, no wrong answer. |
| F2 | `app.js` message for `douse` / `dispel` / `burn` | One line after the fact; nothing is shown *happening*. |
| F3 | `sim.js` stones: `SW = 0.45, SH = 0.9` for all glyphs; `rules.js` has no concept of what a glyph can bear | Any stone is a platform, so stacking the cheapest glyph is the universal vertical tool. Levels were laid out from rectangles and only checked for *a* route. |
| F3 | `sim.js` ~line 578-580: wall refills are per face (`wallKey: 'face'`) | On a plain tall wall 轻功 stops refilling after the first leap per face, with no signal to the player that the wall is "too tall". Players feel "jumping higher does not work". |
| F4 | `sim.js` ~lines 219, 414, 1116 | `clouds` are a gem-like refill at radius 0.85 in the air; ink draws them as scenery wisps (`ink.js` ~207). No rule is visible. |
| F1 | `isles.js` header and maps | A map is rows of 7 characters. No overhangs, cliffs, rivers with banks, slopes, rain, vents, boulders, gates. Biome is only `pal` (dusk or night). |
| all | `routes.mjs`, `sim-test.mjs` group "routes" | A route proves *winnable by a scripted player*. Nothing measures: did anything happen that the player did not cause, did the route use a stone for its meaning, how many distinct obstacle kinds does the isle have. |

## 4. Why the autoplay missed them

`bot.mjs` and the routes press exactly the buttons a person could, but they know the solution in advance, so "the wall
vanished when I got close" and "I stacked 十 and 口 to climb" are both perfectly valid wins. The search "mind" in
`lab/autotest/` optimises for reaching the pavilion, not for **meaning, feedback or variety**. New checks in `TEST-SPEC.md`
(no-passive-solve, meaning audit, cliff declaration, variety, reaction attribution) close exactly these gaps. The real
gate is still John's playtest (`TEST-SPEC.md` §8): a human noticed these in a few isles.

## 5. What is *not* wrong (keep it)

- Forging by placement (木 beside 木 makes 林; order matters) was not criticised. Keep.
- 木 bridging a gap is explicitly accepted (F4): the model to copy.
- Conjure (writing a character) itself was not criticised; its use as a block-maker was. Writing should remain a way to
  get *a stone whose meaning solves a problem*.
- The ink look and hero were not criticised. Only One Stroke (F5).
