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

**Status (2026-11-18):** playable. Phases 2 to 4 are built (ground forging, the board, body forging),
with nine isles in order. The gates G1 and G2 (playtests with people) have not run yet. Start at
**`docs/forge/ROADMAP.md`**.

## The isles

| # | Isle | Make | What it teaches |
|---|---|---|---|
| 1 | Two Trees | 林 = 木 beside 木 | Beside; 木 thrown into water grows a bridge |
| 2 | Sun and Moon | 明 = 日 left of 月 | Order on screen (月 left of 日 makes nothing); 火 burns thorns |
| 3 | Rest | 休 = 人 left of 木 | Variant forms (人 drawn 亻 on the left); 水 douses flames |
| 4 | Dawn | 杲 = 日 on 木 | Stacking. 木 on 日 makes 杳 (dim): dusk falls and a glow-gem shows |
| 5 | Old Leaf | 古 = 十 on 口 | Same pieces, other placement: 口 beside 十 is 叶 (a leaf, which bridges) |
| 6 | Early Light | 早 = 日 on 十 | Light stones dispel walls of shade |
| 7 | Fruit Field | 果 = 田 on 木 | Earth: 田 thrown into water comes up as a field |
| 8 | Red Earth | 赤 = 土 on 火 | 火 beside 土 is a stove (灶); 土 raises a mound in the water |
| 9 | On My Shoulders | 炎 = 火 on 火 | Body forging: stand on a friend's head, both holding 火, either presses |

Every isle has at least two ways through, proven by the judge's bots in the real sim
(`node tools/judge.mjs content/stages/<id>.json`), and a body-forge route as well.

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
node server.js --log          # playtest: logs/playtest-<date>.jsonl (ids, never names; not committed)
```

For a playtest the board can force one forge profile on every stage: open
`http://localhost:3200/?board=1&strict=relaxed` (or `standard`, `strict`). Phones cannot. (The
board page passes `?strict=` once task 04 is done; the server already accepts it from boards.)

Open `http://localhost:3200/?board=1` on the TV or laptop. Phones scan the QR code or go to
`http://<LAN-IP>:3200/`.

## Run tests

```sh
node sim-test.mjs && node smoke-test.mjs && node judge-test.mjs && node conjure-test.mjs && node forge-test.mjs
node tasks/checks/t04.mjs && node tasks/checks/t08.mjs && node tasks/checks/t09.mjs   # real board in headless chromium
```

The board checks need Python Playwright and `/usr/bin/chromium`. Ports: smoke 3460, conjure 3461,
forge 3462, board checks 3474 to 3476. No test uses 3000.
`node lab/playlog.mjs logs/playtest-<date>.jsonl` prints the playtest numbers after `node server.js --log`.

## Controls

Phone: stick to walk, JUMP (twice in mid-air to leap), GRAB, DRAW (the dormant Conjure pad).
GRAB says what it will do: **GRAB 木** near a stone; holding one, **BESIDE** (you stand screen-left
or screen-right of another stone), **ON TOP** (you stand in front of or behind it), **FORGE** (you and
a friend both hold stones, side by side or one on the other's head), **PASS**, **OFFER** (at the
pavilion), **THROW** or **SET DOWN**; with empty hands next to a friend, **BOOST**.
The label names the placement, never what it will make.
Board (TV / laptop): N / P / Backspace for next stage, previous stage, restart.

## Home-network caveats

Same as `tongzhou-isles`: all devices on the same subnet; guest Wi-Fi with client isolation will not
work; plain http, so there is no wake lock (keep phones awake); a phone's wobbler is dropped after
90 s offline.
