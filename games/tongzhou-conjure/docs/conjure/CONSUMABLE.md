# Idea 1: stones are used up; only conjuring brings them back

Status: **DONE (implemented and tested 2026-11-18).** Playtest not done yet.
Owner of this area: S (strong model) — it lives in `sim.js`, the judge and the tests.

## 1. The rule

| Before (tongzhou-isles) | Now (this copy) |
|---|---|
| A stone that fuses or grows a bridge grows back at its starting place after 3.5 s. | It is **gone for good**. |
| Conjuring was a bonus. | Conjuring is the **only** way to get a used-up character back. |
| Ink: 3 drops per player, +1 every 25 s. | Ink: **one pool for the whole crew**. Cap = 3, +1 per extra player, at most 8. +1 drop every 20 s. |

Why: if stones grow back there is no reason to write anything. If they are used up, every
stone is a choice ("do we spend our only 木 on the bridge, or keep it for 林?"), and writing the
character becomes the way to recover from waste. That is practice with a purpose.

Why a shared pool: with per-player ink, 16 players carry 48 drops and nothing is scarce. With
one pool, "who writes 木?" becomes a crew decision, which is the point of a co-op game.

## 2. What the code does (read this before touching it)

All in `sim.js` unless said otherwise.

| Piece | Where | What |
|---|---|---|
| `STONES.regrow` | top of `sim.js` | Default `false`. A stage may set `"regrow": true` to bring back the old rule. |
| `this.regrow` | `loadStage()` | `L.regrow` if present, else `STONES.regrow`. |
| `consume(k)` | stones section | Marks the stone gone, empties its spring, emits `spent {s, ch, back}`. `back` is true only when the stage regrows. |
| `stepSprings()` | | Returns at once unless `this.regrow`. |
| `CONJURE` | top of `sim.js` | `ink0` 3, `inkPerFriend` 1, `inkCap` 8, `regen` 20, `cooldown` 4, `perPlayer` 3. The only place to tune. |
| `inkMax()` | conjure section | `min(inkCap, ink0 + inkPerFriend * (players - 1))`. |
| `this.ink` | | The crew pool. Filled to `inkMax()` at `loadStage()`, and on `addPlayer()` while `!this.started`. Regenerates in `step()`. |
| `conjure()` | | Checks `this.ink < 1` → `ink`; spends from `this.ink`. If the spot ahead is void or a ledge (> 0.5 up or down), places the stone at `p.safe`. |
| snapshot | `snapshot()` | `ink` (number, 2 decimals) and `inkMax`. Was a per-player map before. |
| server | `server.js` `joined` | `ink`, `inkMax` from the game. |
| phone | `app.js` `updateInkDisplay(ink, inkMax)` | Draws `inkMax` drops; label "Crew ink". Redraws only when the value changes. |
| phone | `app.js` `onEvent` case `spent` | The first time a stone is gone for good: "木 is used up and will not grow back. Tap Draw and write it to bring one back." Once per game. |
| judge | `tools/judge/solve.mjs` | The "wait for a stone to grow back" move only exists when `g.regrow`. |
| lint | `tools/judge/lint.mjs` | `conjure-recover`: if a stage has a `conjure` list and does not regrow, every character in `stones` must be in it. `regrow` must be a boolean. |

Things deliberately **not** changed:

- A stone that falls in the water or is left alone still floats back (`returnStone`). Losing a
  stone to physics feels unfair; using one up is a choice.
- The fusion rule "two stones still sitting where they started do not fuse" is unchanged.
- The cooldown and the 3-conjured-stones-per-player cap stay per player.

## 3. Stage rules that follow from it

1. A stage must still be solvable **with conjuring off and no wasted moves** (the judge proves it).
2. A wasted stone must always be recoverable: every stone character is conjurable
   (`conjure-recover`). If `conjure` is absent it defaults to the stone characters, so that is automatic.
3. All three shipped stages pass the judge unchanged, each with two routes (2026-11-18):
   - Two Trees: boost + 林, or row + 林. **The bridge route now needs a conjured 木** (one 木 for
     the bridge, two for 林). This is the intended "aha": the stage hint still mentions the bridge.
   - Sun and Moon: boost + burn, or bridge + burn.
   - Lean on a Tree: douse, or row.

## 4. Tests that prove it

| Test | Checks |
|---|---|
| `sim-test.mjs` stage 1 | Bridge uses up a 木; nothing grows back; conjuring 木 beside the other makes 林; nothing grows under 林. |
| `sim-test.mjs` | A copy of stage 1 with `"regrow": true` still regrows (old rule kept). |
| `conjure-test.mjs` "shared crew ink" | Cap grows with crew and stops at `inkCap`; pool full at stage start; two players spend from one pool; empty pool refuses; a mid-stage joiner adds no ink; snapshot fields; no regrow after 10 s; `spent` event. |
| `conjure-test.mjs` "facing a gap" | Conjuring at a cliff edge gives a finite stone on the floor. |
| `smoke-test.mjs` | Real server: the used-up 木 stays gone; snapshot has `ink: 4, inkMax: 4` for two players; Mia conjures over the wire and the pool drops; `spent` and `conjure` events broadcast. |
| `judge-test.mjs` | `conjure-recover` is raised; bad `regrow` value is rejected; a regrowing stage may omit stone characters. |
| Headless phone check (2026-11-18) | Two phones show 4 drops; after one conjure both show 3; no console errors. Screenshot: `screenshots/conjure-crew-ink.png`. |

## 5. Open questions for playtest

- Is 20 s per drop right for a crew of 2? For 8? (Pool regen does not scale with crew size yet.)
- Should a stone left in a useless place (not fallen, just stranded) also count as "wasted"? Today it floats back after 10 s.
- Should the board show the crew pool too? (Today only the phone pad shows it.)
- Does the "used up" note appear at the right moment, or does it spoil the puzzle? (Principle P9: show after, never before. It is shown after the stone is gone, so it should be fine.)
