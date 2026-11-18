# Conjure: exact formats and rules

Everything a coder needs to build the prototype without guessing. Numbers marked (tune) are
starting values, to be changed after playtest, in one place: `CONJURE` in `sim.js`.

## 1. Stage data

New optional field on a stage:

```json
"conjure": ["木", "火", "水", "女", "子"]
```

- Each entry must exist in `content/glyphs.json` (lint code `conjure-unknown`).
- Absent means the characters that appear in that stage's springs.
- The judge ignores the field. A stage must pass the judge with conjuring off.

## 2. Wire messages

Client to server:

```json
{ "type": "conjure", "ch": "木", "strokes": [ [[0.12,0.5],[0.5,0.52],[0.88,0.5]], [[0.5,0.1],[0.5,0.9]] ] }
```

- `strokes`: list of strokes; each stroke a list of `[x, y]` in 0 to 1, thinned to at most 40 points per stroke, at most 12 strokes, at most 300 points in all. Coordinates rounded to 2 decimals.
- Whole message must stay under 4 KB. Anything larger, or malformed, is ignored.

Server to everyone, on success:

```json
{ "type": "conjured", "id": "p3", "ch": "木", "strokes": [...], "s": 41 }
```

`s` is the new stone's id, so the board can attach the replay to the right stone.

Server to the sender, on refusal:

```json
{ "type": "conjureNo", "why": "ink" }
```

`why` is one of: `phase`, `unknown`, `ink`, `cooldown`, `cap`, `away`. The phone shows a plain English line for each.

The allowed set and ink are added to what the phone already receives: `joined` and each
snapshot carry `ink` (a number, drops, may be fractional) for that player, and `joined` and the
stage-change message carry `conjure` (the allowed characters with pinyin and meaning, copied
from `glyphs.json`).

## 3. Sim rules (`Game.conjure(playerId, ch)`)

Return `{ok:true, stone}` or `{ok:false, why}`. Checks in this order:

1. `phase !== 'play'` gives `phase`.
2. Player missing or `afk` gives `away`.
3. `ch` not in the allowed set gives `unknown`.
4. Cooldown (`CONJURE.cooldown` = 4 s, tune) gives `cooldown`.
5. `ink < 1` gives `ink`.
6. Conjured stones owned by this player alive >= `CONJURE.perPlayer` (3, tune), or `addStone` returns null (cap), gives `cap`.

On success: ink -= 1; place the stone 0.9 in front of the player (use `p.rot`), at the player's
floor height, `grounded:false`, `vy` = 5, `pop` = true, `from` = the spot (so it returns there
if stranded), `spring` = null. Add `k.by = p.id` and `k.conj = true`. Emit `ev('conjure', {by, ch, s, x, y, z})`.
Then `note(ch, null, true)` as fusion does, so the "characters found" list updates.

Ink: `ink` starts at `CONJURE.ink0` (3, tune) when a stage begins (reset per stage, not per
player join). It regenerates `1 / CONJURE.regen` per second (regen = 25 s, tune), capped at
`CONJURE.inkMax` (3, tune). Deterministic: depends only on `dt`.

A conjured stone is otherwise an ordinary stone: grab, throw, catch, fuse, bridge, burn, douse,
lonely-return. Fusing consumes it like any other.

Never touched: movement, rowing, lifts, plates, the existing stone rules. With no `conjure`
calls, a run must be bit-identical to today (the existing `sim-test` and the judge prove it).

## 4. Server rules

- Parse and validate size and shape before calling the sim.
- Only players who have joined and are not the board can conjure.
- Log refusals at debug level only; never log strokes.
- Do not store strokes anywhere. They exist only in the one `conjured` broadcast.

## 5. Phone pad

- Button label: "Draw". Third button beside jump and grab.
- Pad: full-screen canvas, `touch-action: none`, pointer events, a light grid (田 style cross)
  and a Clear button, a Close button, ink drops at the top.
- Strokes are captured as points, thinned (drop points closer than 1.5% of the pad; keep end points).
- Pause detection: 600 ms after the last pointer-up, run the recogniser.
- Result row: up to 3 tiles `[大 字] pinyin, meaning`. Tap sends `conjure`. If nothing scores
  above the floor, show "Not sure. Try again or pick:" and the pick palette (all allowed characters).
- Trace mode (default): the target character is drawn faint behind the pad. The player chooses
  the target from the palette first, so Trace is also a pick; Free mode hides the guide.
- Always show English: pinyin and meaning on every tile.

## 6. Board replay

- On `conjured`: draw the strokes as brush ink on a transparent overlay above the conjuring
  player over 0.6 s (stroke by stroke), then fade it while the stone pops up.
- If the `s` stone is not in the snapshot yet, wait up to 0.5 s, else skip the replay (never block).
- Stone art is the existing brush/ink stone for that character.

## 7. Recogniser interface (so options can be swapped)

```js
// vendor/recogniser.js  (browser, no dependencies)
// WRecog.load(allowedChars) -> Promise<void>      builds templates for the closed set
// WRecog.match(strokes)     -> [{ch, score}, ...]  best first, at most 5, score 0..1
```

`strokes` uses the same format as the wire message. The same function is used by the bake-off
page, the phone pad and the test, so accuracy measured in phase 1 is the accuracy players get.

## 8. Samples and the accuracy test

- File format `lab/samples/<ch>.<who>.json`: `{ "ch": "木", "who": "mia-phone", "strokes": [...] }`, one drawing per file or an array of drawings.
- `lab/accuracy.mjs` loads all samples, runs `WRecog.match`, prints top-1 and top-3 per character and overall, exits 1 if below the gate in `PLAN.md` section 5.
- Samples are made only on the lab page by volunteers who know it exports their drawings. They are never uploaded anywhere and are not committed unless the person agrees.

## 9. Tests to add (`conjure-test.mjs`)

1. Sim: every refusal code is reachable and correct; success places a stone with `from`; ink
   regenerates by `dt`; the per-player cap works.
2. Sim: 女 conjured and 子 conjured next to each other fuse into 好.
3. Sim: a run with no `conjure` calls matches a recorded input log from today (same final state).
4. Wire: a bot sends `conjure`; others receive `conjured`; an oversize or malformed message is ignored; a character outside the set gets `conjureNo unknown`.
5. Smoke: the page loads with no console errors with the pad opened (headless Chromium, as `capture.py` does).
