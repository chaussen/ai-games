# 字/物 level 2: carried things (plan note, not built)

Status: **plan for John's review**. No code yet. Level 1 (things in the air and when acting) is built and
pushed (`things.js`, commit `72c9796`); this is the "you carry the thing" half of
`ART-DIRECTION.md` §3.7. Review gate: John says go, or changes the scope below.

## What changes for the player

Today a carried stone is a square block on top of your head, whatever it is. After this, carrying 木 you
walk with a small tree over your shoulder, carrying 火 you hold a torch out in front, carrying 日 you
hold a sun up (and at night it lights the ground around you), carrying 月 you hold a crescent lantern.
Nothing else changes: the stone's square is still its collision box, GRAB, throw and drop behave exactly
as now, and at rest on the ground it is still the block (§3.7's rule).

The glyph stays on the vermilion tag; pinyin and meaning stay on the word card (it already follows the
stone you carry).

## What Claude Design already drew (`docs/design/one-stroke/Things.dc.html`)

Design drew carried boards for four of the six things, using **three carry poses** on the hero:

| Thing | Hero pose | Where the thing sits (board units; a stone square is 28) |
|---|---|---|
| 木 a small tree | `K-shoulder`: one arm up over the shoulder, head tilts | tree at (6, -19), tilted -35°; tag at (-24, -33) |
| 火 a torch | `K-hold`: one arm held out front | stick (7,-15)→(13.5,-28); flame at (14, -28.5), tilted 18°, 1.1x; tag at (14, -27) |
| 日 the sun | `K-carry`: both arms up (the pose we already have) | sun disc at (0, -39.6); tag at (0, -45) |
| 月 a crescent lantern | `K-hold` | hook (10,-21)→(17,-31); crescent at x 17, y -28…-13; tag at (8, -11) |
| 水 a jar, 土 a basket | **not drawn** | see "Open question 1" |

Rule from the board: a carried thing sticks out at most about half a stone (14 board px) past the hero and
never covers the landing shadow.

## Why this is cheaper than it sounds

- **Renderer only.** The sim already says who holds which stone (`k.state === 'held'`, `k.holder`). No
  change to `sim.js`, `rules.js`, or `sim-test.mjs`.
- `heroPose()` in `cut.js` is one line today (`if (p.hold) return 'carry'`). It becomes a lookup from the
  held stone's character to a pose name. `POSES` gets two new entries (`hold`, `shoulder`) copied from the
  board's paths.
- `things.js` gets a second drawer, `carried(ctx, ch, ...)`, next to `draw()` (the thrown thing). The held
  stone is drawn through it instead of as a block, in `stones()`.

## Plan, in steps (each one is shippable)

1. **Thing replaces the block, same overhead pose.** In both painted looks (ink and One Stroke), a held 木,
   火, 日 or 月 shows its thing above the head, same size rule, tag on it. No new poses. This already
   changes how carrying looks. Screenshots of each, on the phone sizes.
2. **One Stroke only: the three poses.** Add `hold` and `shoulder` to `cut.js`, switch by character, thing
   anchored to the pose from the table above. The ink look keeps the overhead pose (its hero is drawn by
   different code, and Design has not drawn ink poses for this).
3. **日 lights the night.** Held 日 on a night isle adds two flat paper steps around the hero (the board's
   glow, pre-mixed hexes, no alpha). Needs a look at the dusk veil first, because that is the one place
   alpha is used.
4. **水 and 土**: after "Open question 1".

Facing: the poses are drawn facing right and mirrored by `p.face`, as the other poses are.

## Checks

- A screenshot per carried thing and pose, on phone portrait, phone landscape and one laptop size, from
  the running build (pin a held stone with the same script approach as `things_pin.py`).
- The landing shadow and the next ledge stay visible: compare with the block screenshots at the same spot.
- `screen-test.mjs` (HUD budget, 60 fps, contrast) and `sim-test.mjs`, `smoke-test.mjs` unchanged and
  passing; `things.js` stays in the Han-coverage list (and no 物, 剪 or 刻 in checked files).
- John plays it on the phone: can you still see where you are while carrying a tree?

## Open questions for John

1. **水 jar and 土 basket**: Design only boarded 木 火 日 月. Either (a) build the four first and ask Design
   for the other two in the next round, or (b) I draw a plain jar and basket myself in the same flat style
   and Design reviews them. Recommended: (a), because the art rule is "extremely simple or extremely
   stylish" and the boards are the stylish part.
2. **Ink look**: only step 1 (overhead, thing instead of block), or also new poses later? Recommended:
   step 1 only until the phone playtest says which look wins.
3. **日 night light** (step 3): in or out of this round? It is the nicest effect and the riskiest for
   contrast. Recommended: separate, after steps 1 and 2 are on the phone.
