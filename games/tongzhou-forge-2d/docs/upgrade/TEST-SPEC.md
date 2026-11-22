# Test spec (for implementers; nothing here is written as code yet)

House rules: each game's tests are its contract (`CLAUDE.md`); tests boot the real server on a test port, **never 3000**;
screenshots used as evidence come from the running build, never hand-drawn. Existing suites that must keep passing (ink + greybox only; One Stroke is obsolete, see `OBSOLETE-ONE-STROKE.md`):

```sh
cd games/tongzhou-forge-2d
node sim-test.mjs && node write-test.mjs && node write-isle-test.mjs && node smoke-test.mjs \
  && node crew-test.mjs && node crew-check-test.mjs && node screen-test.mjs && ART=greybox node screen-test.mjs
```
Current baseline (2026-11-22, commit 116f235): `sim-test.mjs` has about 293 checks and 42 scripted wins (2 per isle, now 23 isles).
Record the real counts on the first run in `HANDOFF.md`: the baseline is what "no regression" means.

Test files and where new tests live:

| New tests | File | Notes |
|---|---|---|
| §1-§5 sim rules and level validators | `sim-test.mjs` (new groups) or `upgrade-test.mjs` required from it | pure node, about 1-3 s |
| §6 recogniser for new glyphs | `write-test.mjs` | uses `vendor/strokes.json` |
| §7 real-page checks | `screen-test.mjs` / `screen-check.py` additions, `upgrade-check.py` | real touch, screenshots from the running build |
| §8 human playtest | this doc | John |

## 1. R1 deliveries (phase 1)

| ID | Setup | Steps | Expect |
|---|---|---|---|
| T1.1 no-passive-solve (**the key guard for F2**) | each isle, regrow on | a scripted player visits every stone, picks up each in turn, and walks the whole isle touching every wall and standing within 1 cell of each obstacle, never delivering | no wall, gate, boulder or mound changes; `cellsV` unchanged |
| T1.2 carried agent near target | flames wall, player carries 水 | stand adjacent facing it for 5 s | nothing happens; GRAB shows 泼 pour |
| T1.3 lying stone near target | a 水 stone placed beside flames by the level (spawn it) | 5 s | nothing |
| T1.4 throw delivers | player with 水 | throw so it lands within reach | `react.start` then `react.done`, flames cleared, stone gone and regrown after `REGROW` |
| T1.5 throw falls short | throw landing at 3 cells away | | no reaction; stone lies there |
| T1.6 set delivers | place 水 beside flames | | reacts |
| T1.7 verb delivers | face flames with 水, press the verb | | 0.4 s wind-up, then reaction, stone spent at the end |
| T1.8 refused when busy | two deliveries to one wall in the same frame / during a reaction | | one reaction; second `react.refused { why: 'busy' }`; second stone **not** spent |
| T1.9 regrown stone near wall | a regrow spring within reach of a wall | wait through a regrow | no reaction (no `placedBy`) |
| T1.10 written stone | write 水 beside flames | | in hand, no reaction until an act |

## 2. R2 telegraph (phase 1 + 2)

| ID | Expect |
|---|---|
| T2.1 duration | `react.done` fires `REACT.dur` after `react.start` (profile values) within 1 tick |
| T2.2 hurt stops at start, solid until done | during a flames reaction the player touching it is **not** hurt, and cannot pass until `done` |
| T2.3 attribution | every `react.done` event carries `ch`, `kind`, `by`; the page shows one message line naming cause and result (§7) |
| T2.4 snapshot mid-reaction | take a snapshot at `progress 0.5`, restore into a fresh world, step; `react.done` still fires and the grid matches a non-restored run bit for bit (existing snapshot group does the same) |

## 3. R3 counters and cost; R4 bearing; R5 cliffs (phase 1)

3.1 **Spent.** After a delivery the agent stone is `gone`; on a regrow isle it returns after `REGROW`; a written stone is
not refunded ink. A non-regrow isle with only one agent: after delivery no copy exists (assert).

3.2 **Counter truth table.** One test per row of `RULES-SPEC.md` §3.2: fire near a wood bridge burns it (cells revert to gap);
water near an earth mound removes it; 土 smothers flames; 金 chops a gate and a wood bridge in reach; 火 then 水 on a boulder
cracks it inside `CRACK.window`, neither alone does (assert scorched/wet flag only); outside the window it does not; 木 roots split a boulder after `ROOT.t`; water on embers makes a crossing for `STEAM.t` then it reverts.

3.3 **Bearing.** (a) a 口 on the ground can be stood on (level 1). (b) a 口 on top of a 木: landing on it slides you off,
`slide` event, you end not standing on it. (c) 十 on 口 on ground still forges 古 and the result may be stood on only if
level 1. (d) a stack of 4 bearing 人 respects `BEAR.stackMax`. (e) `BEAR.inert = 'solid'` restores the old behaviour exactly
(A/B regression: the old 42 routes pass with it set).

3.4 **Cliffs.** (a) a player with all leaps cannot climb a `C` of height 4 (assert across 30 scripted leap strategies); wall
refills never register on `C`. (b) each build (`trunk 3/5/7`, `ramp 2/3`, `peak 5`) at a socket produces cells, and a scripted
**plain-jump** player (no leaps) climbs it. (c) a build with no room is refused and the stone not spent. (d) a trunk burns
with fire and a ramp washes with water (counters). (e) a 3-high `#` column remains passable by jump + nudge.

3.5 **Lifts.** 云 set and stood on rises `LIFT.speed` for `LIFT.t`, then disperses; the player can step off at any height; 风 column
lifts a player and floats a thrown stone for `GUST.t`; a vent `V` is inactive without a 风 stone and active with one.

3.6 **Clouds removed.** `isles.js` has no `clouds` entry; `stepGems` ignores a stray one (guard against old data).

3.7 **Profiles.** Every new knob has all three profile values (relaxed/standard/strict) and the sim-test knob group iterates them.

3.8 **Crew.** Existing crew tests pass; new: two players, one delivers while the other stands on the wall's foot: both
snapshots equal; a restored phone world shows the same `reacts`, `built`, `lift` arrays; a friend standing on a trunk that burns falls and returns to safe ground (no death).

## 4. Routes rewritten (phase 1, then 3)

`routes.mjs` has two scripted winning routes per isle and `bot.mjs` verbs (`S.go`, `S.take`, `S.grabAs`, `S.write`...).
Add bot verbs: `S.verb()` (press the contextual verb), `S.throwAt(x)`, `S.build(glyph, atX)`, `S.ride(cloud)`.
Rules: (a) a route may not use the passive carry; (b) a route's height gains come from bearing glyphs or declared answers
(audit §5.2); (c) `cloudSteer` and any cloud logic are deleted. **Phase 1 keeps the existing 23 isles winnable with the
smallest patch** (list every patch in `HANDOFF.md`): where a wall used to melt by arrival, the route now delivers.
Existing routes that use a carried element as a free key must be rewritten, not skipped.

## 5. Level validators (phase 3 and CI forever)

Validators run on `isles.js` (and `isles.v2.js` when `ISLES=v2`). Each fails with the isle id and a human sentence.

| ID | Check | Fails when |
|---|---|---|
| V5.1 variety | count distinct obstacle kinds per isle from the cells in the map; compare with the ramp's minimum (`LEVEL-BRIEF.md` §6) | fewer than required |
| V5.2 meaning audit | replay both routes recording height gained per source; every gain above 1 stone must come from a bearing glyph or a declared `answers` build/lift | a route climbs on 口/十/日/etc. |
| V5.3 cliff declaration | every `C` run height >= 3 has `answers` at its foot column; at least one answering stone is available (lying/write) and its build height >= cliff height | missing or insufficient |
| V5.4 no padding | brute-force: remove bearing and lift abilities (set all glyphs to inert) and replay: **the isle must become unwinnable if it has a cliff** | winnable without any meaning tool |
| V5.5 flat run | longest run of cells with an identical ground height | > 8 |
| V5.6 repeats | the `beats` list: no kind twice in a row | repeats |
| V5.7 stone budget / dead-end | enumerate stones spent per route (events); a stone with no spring is gone after spent; every route stays winnable | route unwinnable or stone missing |
| V5.8 no clouds | `clouds` empty/absent | present |
| V5.9 first appearance | the first `C`, `D`, `L`, `W`, `V`, 云, 风 etc. on the ramp appears on the isle the ramp says, in a calm stretch (no other obstacle within 6 cells before it), and the `tip` names it | out of place |
| V5.10 geometry | spawn and pavilion on solid ground, reachable by plain jumps with no stone spent when the ramp says so; gems reachable | unreachable |
| V5.11 size and deck | 36-50 wide, 10-16 high, `bbbb` deck at spawn | outside |
| V5.12 uniqueness | no two isles share more than 60 % of map rows after normalising (guards "terrains identical") | too alike |

## 6. Glyph coverage (phase 2)

For the 6 new glyphs (金 云 风 石 山 雨): in `content.js` (pinyin, meaning, `el`, `bear`, `build`); strokes in `vendor/strokes.json`
(via `node tools/strokes.mjs --glyphs`); font subset (`tools/font.py`, `smoke-test.mjs` asserts coverage); a stone drawing in the ink look.
`write-test.mjs`: tier target top-3 >= 90 % on the seeded synthetic writer for each new glyph and none of the 36 old glyphs drops
below its current score; the confusion report must list any new look-alike pair (云 vs 去 isn't in the game; check 石 vs 右/口, 山 vs 出, 风 vs 凤).
`write-isle-test.mjs` extended: one isle where a new glyph is written by real touches (isle 12 writing 金, or isle 6 writing 云) in ink and greybox.

## 7. Real-page checks (phase 2 and after; real touch, real build, ink + greybox)

Viewports: phone landscape (about 844 x 390), phone portrait, tablet (1024 x 768), laptop (1366 x 768). `screen-check.py` already
drives real touches; extend it.

| ID | Check | Evidence |
|---|---|---|
| S7.1 the verb | carrying 水 facing flames: the GRAB button reads 泼 pour (with pinyin + meaning), screen budget unchanged | screenshot `screenshots/upgrade/verb-pour.png` |
| S7.2 telegraph | three frames of a reaction (start, mid, done) for each of: 水 on flames, 火 on thorns, light on shade, 金 on gate | `screenshots/upgrade/react-<kind>-{0,1,2}.png` |
| S7.3 message line | after each reaction the one-line message names cause and result; text is in the font subset | read from DOM, plus screenshot |
| S7.4 sockets and hints | a cliff foot with the socket mark; hint glow when carrying 木 within 3 cells; none in strict | screenshots |
| S7.5 build | 木 set at a socket: trunk grows over about 1.2 s; the player climbs it with real touches | frames |
| S7.6 slide | landing on a 口 stacked on a 木: slide + message | frames |
| S7.7 lift and vent | 云 lift and 风 updraft carry the player; frames | frames |
| S7.8 every isle | three screenshots along each of the 23 isles (start, middle, pavilion) in ink and greybox; read each one | folder `screenshots/upgrade/isles/` |
| S7.9 no console errors; frame time | the ink look keeps its performance budget (no per-frame large gradient fills) | measured, in notes |
| S7.10 play-through | `play-test.mjs` plays the first route of every isle at real speed in the real page and fails on a lost isle or console error | win cards saved |

Screenshots must be captured from the running build. Judge them: say in notes what each one shows and whether the game *reads*.

## 8. Manual playtest checklist (John, phase 4; phone first)

Play isles 1, 4, 5, 6, 10, 12, 17, 20, 23 (one per mechanic) in standard profile. For each ask and note yes/no/comment:

1. Could I tell what each obstacle wanted without being told?
2. Did anything happen that I did not cause?
3. Did I understand *why* it worked (the message line, the animation)?
4. Did I ever stack a stone only as a block? Did any stone I used feel like a square?
5. Did the isle feel like a different place from the previous one (terrain, obstacles, mood)?
6. Was there a moment I was stuck with no reasonable answer? Where?
7. Did I want to try the wrong thing to see what happens (decoys)? Was the cost fun or annoying?
8. Does writing a character (金, 云) feel like making that thing?
9. Is any hint too strong (spoils it) or too weak (guessing)?
10. Time per isle, felt boredom points, anything stiff in movement.
Record in `HANDOFF.md` defect log with isle id and profile.

## 9. Definition of done per phase

| Phase | Done when |
|---|---|
| 1 | §1-§4 pass; existing suites pass; `BEAR.inert='solid'` reproduces the old results; patches to old isles listed; docs updated |
| 2 | §6 and §7 S7.1-S7.7, S7.9 pass; screenshots read and described; font subset and strokes regenerated |
| 3 | §5 all pass on `isles.v2.js`; every route in `ISLE-NOTES.md` encoded in `routes.mjs`; S7.8 and S7.10 pass; `isles.js` replaced; old routes retired |
| 4 | §8 completed by John; defect log triaged; knob changes committed with the reason |
