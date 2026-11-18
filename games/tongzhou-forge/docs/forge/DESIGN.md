# Positional Forge: design

Date: 2026-11-18. Status: **design, no code yet**. Concept and pillars are in `CONCEPT.md`, exact
formats in `SPEC.md`. If this page and the code disagree after Phase 2, the code and tests win:
fix this page.

Sim facts this design builds on (as of the fork, `sim.js`):

- Stone body: half-width `OR` 0.28, height `OH` 0.56. The sprite drawn on screen is 1.35 wide, so
  stones look much bigger than they are.
- Player body: radius `PR` 0.3, height `PH` 1.0. A held stone sits at `HOLD_Y` 1.15 above the
  holder's feet.
- Camera: fixed orthographic, never rotates. Screen-right is **R** = (1, 0, −1)/√2, screen-depth
  (toward the viewer) is **D** = (1, 0, 1)/√2, up is **Y** (`app.js:66-68`).
- Fusion today: `stepFusion` joins two loose, grounded stones within `FUSE_R` 0.95, in any order.
  The `join` throw in `launch()` lands a stone 0.45 from the target.
- Stones do not rest on stones. Players pass through stones. A player can stand on an
  empty-handed friend's head (`ground(..., heads)`).

---

## 1. Relations

| Op | Name | In the world | First piece | Second piece | Phase |
|---|---|---|---|---|---|
| ⿰ | beside | side by side **on screen** | left | right | 2 |
| ⿱ | above | stacked: resting on, or standing on a head | top | bottom | 2 (stones), 4 (bodies) |
| ⿴ | inside | in a closed frame stone (囗) | frame | content | 7 |
| ⿵ | in an open frame | in a frame open at the bottom (门) | frame | content | 7 |
| ⿱⿰ | pyramid | one stone resting across two side-by-side stones | top | the base pair | 7 |

The ops are the Unicode Ideographic Description Characters that MMAH uses, so every recipe can be
checked against the dictionary (`SPEC.md` §2).

Characters with three or more pieces are made by **nesting**: 森 = 木 ⿱ 林 (make 林 first, then put
a 木 on top). The pyramid rule exists only for characters whose two-piece intermediate is not in the
game's set (品 = 口 ⿱ 吅, and 吅 is not a playable character).

**Depth is never meaningful.** On an isometric TV view, near/far is the axis players misjudge most.
An offset that is mostly depth is **no relation**: not a dud, simply two stones lying there.

---

## 2. The strictness map (the middle point)

Every place where "strict grammar" and "relaxed play" push against each other is a **knob**. All
knobs live in one `FORGE` table in `sim.js`. A stage chooses a **profile** (`"strict"` field:
`relaxed` | `standard` | `strict`, default `standard`) that sets the knobs together. Tuning means
moving these knobs between playtests (`PLAYTEST.md` §3). No knob may be hardcoded anywhere else.

| # | Where the pressure is | Knob | Relaxed end | Strict end | Start value (standard) | Layer |
|---|---|---|---|---|---|---|
| K1 | How far off-line a "beside" pair may sit (screen depth) | `besideD` | 0.55 | 0.25 | 0.4 | classifier |
| K2 | How close or far apart a beside pair may be (along screen-right) | `besideR` [min, max] | [0.35, 1.5] | [0.5, 1.1] | [0.4, 1.3] | classifier |
| K3 | Vertical mismatch allowed for beside | `besideY` | 0.6 | 0.25 | 0.45 | classifier |
| K4 | Snap: a stone that settles inside a cone slides to the ideal spot (forgives the **hand**) | `snap` seconds, 0 = off | 0.2 | 0 | 0.15 | sim, visible |
| K5 | Rescue: if the exact arrangement is a dud and exactly one *other* arrangement of the same stones is a recipe on this isle, and that arrangement makes no other real character, forge it with a visible slide into place (forgives the **grammar**) | `rescue` | `unique` | `off` | `off` | sim, visible |
| K6 | What a dud costs | `dudCd` seconds of "can't forge these two again" | 0 | 1.5 | 0 | sim |
| K7 | How long a real but unwanted character lasts (杳 when you wanted 杲) before splitting back | `wrongLife` seconds, ∞ = keeps | 12 | ∞ | ∞ | sim |
| K8 | Body formation: how far a pair may stand off-line, and how still they must be | `bodyD`, `bodyStill` | 0.7, any | 0.35, 0.5 u/s | 0.55, any | classifier |
| K9 | Placement assist: the aim label names the placement (BESIDE / ON TOP / INSIDE) and the aim marker snaps | `assist` | `label+snap` | `none` | `label+snap` | client + `launch()` |
| K10 | Variant forms (水→氵 in the left slot) shown on the stone before the forge | `forms` | on | off | on | client |
| K11 | After a dud, say when the same two pieces go together in another arrangement (FG-D017) | `dudHint` | `other` | `other` | `other` | sim (`dud.other`) |
| K12 | Report a near miss (landed within 1.5× the cones, not in a placement) (FG-D017) | `near` | on | on | on | sim (`near` event) |
| K11 | Which characters count as real | content: only `glyphs.json`; rare mirrors (炏, 仌) are duds | — | — | closed set | content |
| K12 | How many minimal-pair checks a stage asks for | content: stage design | 0–1 | every forge | ≤ 1 per stage early on | content |

Starting hypothesis (`CONCEPT.md` §3): **forgive the hand (K1–K4, K8, K9) generously, and keep the
grammar (K5–K7) honest.** K5 and K7 exist so the playtest can test the opposite if the hypothesis
fails. Neither is on by default. K5 also respects the 2026-11-18 decision: no near-miss *hint*.
A rescue is an outcome you see happen, not a preview.

### Where the pressure shows up in the technology

| Area | How it shows | Response |
|---|---|---|
| Physics | Wobbly bodies and bouncing stones land a little off. Strict cones turn that into duds the player did not intend. | Snap (K4), generous cones (K1–K3), a settle check before classifying |
| Determinism | Forgiveness must be the same every time, or the judge and replays break | Snapping and rescue are sim rules, not client effects; tie-breaks by id (§9) |
| Network | Body formations wobble as `separatePlayers` pushes bodies apart | Use the "is supported by" relation for bodies, not geometry; wider body cones (K8) |
| Rendering | Sprites are 1.35 wide and bodies 0.56, so "touching" on screen is not touching in the sim | Classify on sim positions only; the snap pose makes the picture match |
| Aim and controls | Players need to know which placement they are about to make | Aim label shows the placement (K9), never the outcome |
| Judge | Bots have perfect hands, so a stage can PASS and still feel fiddly | `judge --sloppy`: replay the route with position noise and report a **hand margin** (`SPEC.md` §8) |
| Content lint | A stage can accidentally hinge on a mirror pair the designer didn't intend | `order-trap` lint warns when the mirror of the wanted character's arrangement is another real character |
| Playtest logs | Need to tell hand errors from grammar errors | Every attempt logs a reason: `norel`, `dud`, `mirror`, `wrong`, `ok` (`PLAYTEST.md` §4) |

---

## 3. The classifier: `relate(a, b)`

One pure function decides every relation, for ground stones and for held stones. Inputs are two
stone positions (sim coordinates) and a mode (`ground` or `body`). The output is
`{ op, first, second, err }` or `null`.

1. `d = b − a`; `r = d·R`, `q = d·D`, `y = d.y`.
2. **Above (ground)**: if `a.support === b` (a rests on b), then ⿱ with a first, `err = |horizontal offset|`.
   Physical support is the truth; no geometric guess.
3. **Above (body)**: if the holder of a stands on the holder of b (`pa.support === pb`), then ⿱ with a first.
4. **Beside**: if `|y| ≤ besideY` and `|q| ≤ besideD` (or `bodyD`) and `besideR[0] ≤ |r| ≤ besideR[1]`,
   then ⿰. The stone with the smaller `r` (screen-left) is first. `err` = normalised distance from
   the ideal spot (r = 0.62, q = 0, y = 0).
5. Otherwise `null`: no relation.

Screen-left and screen-right are the only meaning of "left/right". The camera never turns, so this
never changes during play.

---

## 4. Ground forging

### 4.1 Stones rest on stones (new physics)

`ground()` gains a stones pass for **stone bodies only**: the top of a loose, grounded stone is a
surface at `o.y + OH` for a stone whose footprint overlaps it. `b.support` records which stone it
rests on. Players still pass through stones and do not stand on them (unchanged, to keep the
movement feel and avoid towers as ladders). If the bottom stone leaves (picked up, forged, burned
into use), whatever rests on it falls.

### 4.2 When ground stones forge

As today, forging is **automatic once stones settle**, because placing a stone is already the
deliberate act. After `stepStone` grounds a stone and any snap (K4) finishes:

1. Look for a partner with `relate()`. Support (⿱) wins over beside. Ties go to the smaller `err`,
   then the lower id.
2. If `fuse(op, first, second)` is a recipe, forge: consume both, spawn the result where they were,
   and pop it up (as today).
3. Otherwise, apply rescue (K5) if on. If that fails, emit `dud` with a reason. Nothing is consumed.
   The pair is remembered so it does not dud again every tick (and K6 applies).
4. Two stones that grew where the stage placed them never forge with each other (existing rule).

### 4.3 How a player places beside or on top

`launch()`'s `join` mode becomes placement-aware. Facing a loose stone within reach:

- If you stand **to its screen-left or screen-right** (offset mostly along R), the throw sets your
  stone **beside** it on your side. To build 明 you hold 日 and stand screen-left of a 月.
- If you stand **in front of it or behind it** (offset mostly along D, the axis that otherwise means
  nothing), the throw sets your stone **on top** of it.

The aim label says **BESIDE** or **ON TOP** live as you walk around (K9), and the aim marker shows
the exact spot. Free throws and tosses still land wherever physics puts them, and a stone that
happens to land on another stone counts as on top. The approach rule is a hand-assist: it never
changes what a placement means.

### 4.4 Dud and wrong-but-real

- **Dud** (no recipe): the existing "nothing" wobble (`dud` event). No near-miss shimmer and no
  hint (decision 2026-11-18). The stones stay where they are; pick one up and try again.
- **Wrong but real** (a recipe, but not what the pavilion wants, e.g. 杳): it forms and does its
  thing (`CONTENT.md` §3). It is consumable like any stone. Because a used-up stone is gone, forge
  stages default to `"regrow": true` until a split verb exists (§10 Q1). K7 can make unwanted results
  split back after a time if playtests show that this costs too much.

---

## 5. Body forging (co-op)

### 5.1 Formation

A formation is **two players, each holding a stone, whose held stones are in a relation**
(`relate(…, 'body')`).

- **Beside**: stand side by side on screen. Held stones are at the same height, so
  `besideY` is easy to meet; `bodyD` (K8) is wider than on the ground because bodies wobble.
- **Above**: the top player stands on the bottom player's head. **New**: you may now stand on a
  friend who is holding something. While someone stands on them, the bottom player's stone moves to
  an **arm hold** (`HOLD_LOW` 0.55, drawn in front of the chest) so the head is free. The relation
  is read from support (`top.support === bottom`), not geometry, so a wobble does not break it.

Ground stones and held stones never relate to each other. The rule stays predictable: stones on
the ground form with stones on the ground, and stones in hands form with stones in hands.

### 5.2 The trigger: anyone in the formation

The forge is started by a press, not a timer. **Any participant** (the top player, the bottom player,
the left or the right) presses GRAB, and their aim becomes **FORGE**.

- The FORGE label appears for **any** formation, valid or not. Showing it only for valid ones would
  preview the outcome (P9).
- A valid FORGE consumes both stones, and the new stone goes **into the triggerer's hands**. The
  bottom player can trigger it and receive the result, so their role is never "stand still".
- An invalid FORGE is a dud: both keep their stones, with a short wobble.
- **Swapping** needs no new rule. Drop, re-grab and pass all work as before. A pass only targets an
  empty-handed friend, and a formation needs both players holding, so PASS and FORGE never compete.

Priority in `launch()` while holding: **dunk** (wanted character at the pavilion) > **forge**
(in a formation) > **join** (beside or on top of a ground stone) > **pass** > **toss / place**.

### 5.3 What body forging is for

- It works **where ground forging cannot**: on the boat, on a moving lift, over thorny or flaming
  ground, on a narrow ledge, or mid-river.
- It is **instant**: no settling and no pick-up afterwards, since the result is already in a hand.
- It is **social**: "you stand on me" and "go to my left" are the talk the charter wants.

Every stage stays **solo-solvable** through ground forging. A stage may put a body-forge route in as
the faster or second way. The judge's two bots must be able to perform it (`SPEC.md` §8).

### 5.4 Nesting with bodies

森 = 木 ⿱ 林: two players forge 林 beside each other, and one ends up holding it. The 林 holder
stays put, and a third player holding 木 climbs onto their head and forges. Any of them can press.
Formations of three or more at once are out of scope for v1 (§10 Q2).

---

## 6. Variant forms (K10)

Some pieces change shape by position: 水→氵, 心→忄, 人→亻 in the left slot. Once a stone settles
or is held in the left slot of a ⿰ relation, it **morphs on the spot**. This is display only: the
sim keeps the base character, and recipes use base characters (`SPEC.md` §2 normalises MMAH's
variant components). It shows what the piece is in that place, not what the pair will make.

---

## 7. Pyramid (phase 7)

A stone resting across **two** side-by-side stones (it touches both and they are a ⿰ pair) is
evaluated as `⿱⿰ top, left, right`: 品 (口 on 口口), 晶 (日 on 日日), 众, and 森 as an alternative to
nesting. The base pair waits as a dud until the top stone arrives. It is hard and satisfying, and
it naturally fits three players.

## 8. Enclosure (phase 7)

囗 and 门 are **frame stones**: a 1×1 hollow footprint drawn as a box or gateway, and you can throw a
stone in. A stone that comes to rest with its centre within `inR` of the frame's centre is
*inside*: ⿴ for 囗, ⿵ for 门. Players can walk into frames. Body variant: a player holding 木
walks into a 囗 lying on the ground, and either the holder (or anyone in contact) presses FORGE to
make 困. The idea of "the player is the 人 in 囚" is noted as an idea only, not a rule.

## 9. Edge cases

| Case | Rule |
|---|---|
| A stone lands touching two candidates | Support (⿱) beats beside; then smallest `err`; then lowest id |
| Three stones all in mutual beside relations | Pairwise in id order. The first valid recipe forges; the rest re-evaluate next tick |
| The bottom stone of a stack is picked up | The top stone falls (support lost) and re-settles; it may form a new relation where it lands |
| FORGE pressed while the other player is mid-jump | Support is broken and there is no formation, so GRAB does its normal action |
| Forge on the moving boat | Allowed. Held stones move with their holders; ground stones ride the deck as today |
| `MAX_STONES` reached | A forge always frees a slot (2 in, 1 out), so it never fails for lack of room |
| A stone in the air passes a stone | Classification happens only when settled (ground) or on press (body) |
| A rescue (K5) would create a character the pavilion wants while the exact arrangement makes another real character | Not a rescue: rescue applies only when the exact arrangement is a dud |
| The holder is boosted while someone stands on them | The formation breaks; the arm hold returns to the overhead hold when the head is empty |
| A player leaves (AFK or disconnect) mid-formation | Their stone drops as today; there is no partner any more |

## 10. Open questions (move to the ROADMAP decision log when decided)

| # | Question | Leaning |
|---|---|---|
| Q1 | A **split** verb: break a forged stone back into its pieces (e.g. throw it at a rock, or both players pull)? It would replace `regrow` as the safety net and show decomposition. | Likely yes, after G1 |
| Q2 | Formations of three or more at once (a pyramid of bodies)? | Not v1. Nesting covers 森 and 众 |
| Q3 | Does every wrong-but-real character get an effect, or only some? | Only in pairs a stage relies on (`CONTENT.md` §3) |
| Q4 | Approach direction for ON TOP versus a separate gesture (e.g. jump + GRAB) | Approach rule first; revisit if G1 shows confusion |
| Q5 | Should rescue (K5) ever be on by default, e.g. the first stage only? | Decide from G1 data |
| Q6 | Do the existing three stages keep their ⿰ recipes strict (月日 is a dud)? | Yes, standard profile; it is the cheapest first taste of order |
