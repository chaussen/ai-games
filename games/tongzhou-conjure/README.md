# 同舟 · Glyph Isles — Conjure Prototype

> Prototype copy of tongzhou-isles. Do not import from the original. Backport by hand.

This folder is a **parallel copy** of `games/tongzhou-isles/` for the **Conjure** feature:
draw a Chinese character on your phone with a finger, and a stone of that character appears
on the isle.

**Status, plan and next work: `docs/conjure/ROADMAP.md`** (start there). Design docs:
`PLAN.md` (original plan), `SPEC.md` (exact formats), `CONSUMABLE.md` (stones are used up, done),
`OPEN-SET.md` (more characters + hints, not started), `PARTICLES.md` (function words, design only).

**Stones are used up.** A stone that fuses or grows a bridge does not grow back. The only way to
get it back is to write it (conjure). The crew shares one ink pool: 3 drops for one player,
+1 per extra player, at most 8, one drop back every 20 s.

Port: **3100** (never 3000; tests use 3456 / 3457).

## Run it

```sh
cd games/tongzhou-conjure
node server.js                # port 3100
PORT=3101 node server.js      # alternative
```

Open `http://localhost:3100/?board=1` on the TV or laptop. Phones scan the QR code or
navigate to `http://<LAN-IP>:3100/`.

## Run tests

```sh
node sim-test.mjs && node smoke-test.mjs && node judge-test.mjs && node conjure-test.mjs
```

No test uses port 3000.

## What is Conjure

A player opens a drawing pad on their phone, writes a Chinese character with a finger,
the game recognises it (offline, on the phone), and a stone of that character appears on
the isle. It behaves like every other stone: carry, throw, fuse, bridge, burn, douse.

Writing by hand is the preferred input. Typing and picking from a list are fallbacks.
Conjuring is a **bonus** — every stage stays solvable without it.

## Implementation phases

| Phase | Status | Description |
|---|---|---|
| 0 | ✓ Done | Parallel copy, port 3100, tests pass |
| 1 | ⚠ Built, not proven | Recognition spike: `lab/` draw page, recogniser. Accuracy measured only on synthetic copies of the templates; no real handwriting yet (ROADMAP stream B) |
| 2 | ✓ Done | Wire and sim: `Game.conjure()`, ink budget, server messages |
| 3 | ✓ Done (defects D1–D6 open) | Phone pad UI and board replay |
| 4 | Pending | One stage that invites conjuring |
| 5 | Pending | Go or no-go on backporting: wait for real accuracy numbers |
| A | ✓ Done 2026-11-18 | Stones are used up; shared crew ink (`CONSUMABLE.md`) |

## Files added by Conjure (not in tongzhou-isles)

| Path | Role |
|---|---|
| `docs/conjure/PLAN.md` | Goals, decisions, risks |
| `docs/conjure/SPEC.md` | Exact wire formats, sim rules, recogniser interface |
| `docs/conjure/TASKS.md` | Ordered work, owners, gates |
| `lab/` | Recognition spike tools (draw page, accuracy test, samples) |
| `vendor/recogniser.js` | The offline recogniser (phase 1) |
| `conjure-test.mjs` | Conjure-specific tests (phase 2), shared ink and used-up stones |
| `docs/conjure/ROADMAP.md` | Status, progress log, decisions, task cards — the handoff page |
| `docs/conjure/CONSUMABLE.md`, `OPEN-SET.md`, `PARTICLES.md` | Design docs for ideas 1, 2 and 3 |

## Original README excerpt

The base game: carry character-stones, see what they do, together. 木 becomes a bridge, 火
burns a thorn hedge, 水 douses flames, 木+木=林. Three stages, one boat, 19 characters,
13 recipes, up to 16 players on a LAN, no install, no CDN, no internet.

See `games/tongzhou-isles/README.md` for the full original readme, retrospective and known gaps.

## Controls

Phone: stick to walk, JUMP (twice in mid-air to leap), GRAB (pick up / throw / join / boost),
DRAW (opens the writing pad: write a character, tap a guess to conjure it; Trace shows a faint guide).
Board (TV / laptop): N / P / Backspace for next, previous, restart stage.

## Home-network caveats

Same as `tongzhou-isles`: same subnet, no guest Wi-Fi client isolation, plain http (no wake lock),
phones drop their wobbler after 90 s offline.
