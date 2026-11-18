# 同舟 · Glyph Isles — Positional Forge

> A copy of `tongzhou-conjure`. Never import from it, or from any other game. Backport by hand.

**Where a piece sits decides what it means.** 日 stacked on 木 makes 杲 (sunrise, bright). 木
stacked on 日 makes 杳 (sunset, dim). In this game the crew builds characters **in the world**,
with stones and with their own bodies: side by side on screen (⿰), stacked (⿱), and later inside a
frame (⿴). In co-op, each player holds a piece and the crew stands in formation (one on another's
head for "above"), and **anyone** in the formation can press to forge.

This brings back the 同舟 charter's spatial forge (TZ-D044), which was lost when the game moved onto
Wobble Works physics. It makes the game pass the reskin test: with sprites instead of characters,
the rules would be arbitrary; with characters, what you build is what you read.

**Status (2026-11-18):** the fork and the docs are done and approved; Phase 2 (sim core) is under way. Start at **`docs/forge/ROADMAP.md`**.

| Doc | What |
|---|---|
| `docs/forge/CONCEPT.md` | Why, pillars, and the middle point between strict grammar and relaxed play |
| `docs/forge/DESIGN.md` | Rules, the strictness map (every knob), edge cases, open questions |
| `docs/forge/SPEC.md` | Data formats, constants, functions, events, judge, tests |
| `docs/forge/CONTENT.md` | Characters, minimal pairs, elements, stage sketches |
| `docs/forge/PLAYTEST.md` | Gates G1 and G2 and the tuning loop |
| `docs/STAGES.md` | Stage format (updated in Phase 5) |
| `docs/conjure/` | History of the Conjure prototype this was copied from (the feature is dormant here) |

## Run it

```sh
cd games/tongzhou-forge
node server.js                # port 3200
PORT=3201 node server.js      # alternative
```

Open `http://localhost:3200/?board=1` on the TV or laptop. Phones scan the QR code or go to
`http://<LAN-IP>:3200/`.

## Run tests

```sh
node sim-test.mjs && node smoke-test.mjs && node judge-test.mjs && node conjure-test.mjs
```

`forge-test.mjs` is added in Phase 2. Ports: smoke 3460, conjure 3461, forge 3462. No test uses 3000.

## Controls (today; forge changes are in DESIGN.md §4.3 and §5.2)

Phone: stick to walk, JUMP (twice in mid-air to leap), GRAB (pick up / throw / join / boost /
later FORGE), DRAW (the dormant Conjure pad).
Board (TV / laptop): N / P / Backspace for next stage, previous stage, restart.

## Home-network caveats

Same as `tongzhou-isles`: all devices on the same subnet; guest Wi-Fi with client isolation will not
work; plain http, so there is no wake lock (keep phones awake); a phone's wobbler is dropped after
90 s offline.
