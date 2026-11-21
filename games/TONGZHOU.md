# 同舟 Tongzhou: a map of all the work

Five folders, a launcher and a test lab have grown around one idea: a crew of children in one boat, carrying
Chinese characters as stones, where each character does what it means. This page says what each piece is, where
it stands, how to start it and where its docs are. Updated 2026-11-21.

## Newer direction (2026-11-22): 神笔 Shenbi

The name Tongzhou is retired for the next step. John wants an open sandbox where written characters become
objects that can be wielded, thrown and react to the world and each other. It is a **new folder**,
[`shenbi/`](shenbi/README.md), with docs only so far; start at `shenbi/docs/HANDOFF.md`. The folders below stay
as reference and are not archived; code is copied from them, never imported.

## The direction (2026-11-21, still true for the folders below)

From John, 2026-11-21:

- **The core is Glyph Isles 2D with Conjure and co-op** (`tongzhou-forge-2d`). New work goes there.
- **The style is not decided**, so the 2D keeps **two looks** side by side:
  - ink scroll 水墨 (`ink`, the default)
  - One Stroke 一笔 (`cut`, cut paper)

  Both must keep working: every screen test runs in both. Greybox is the plain third look, for testing only.
- Forging one character **together** is waiting for Claude Design. The proposal is `tongzhou-forge-2d/docs/CO-OP.md`
  §6; do not build it until Design's answer comes back.

## Everything at a glance

| # | Piece | Folder | Status | Start it | Read first |
|---|---|---|---|---|---|
| 1 | **Glyph Isles 2D**: side view, Conjure (write a character), the crew (up to four phones) | `tongzhou-forge-2d/` | **core, active** | `board-2d` | `tongzhou-forge-2d/README.md` |
| 2 | The 2D looks: ink, One Stroke, greybox | inside 1 (`ink.js`, `cut.js`, greybox in `app.js`) | two looks kept on purpose | `board-2d`, `board-2d-onestroke` | `tongzhou-forge-2d/docs/ART-DIRECTION.md` |
| 3 | Automated play-testing: bots and a search "mind" that play the 2D | `tongzhou-forge-2d/lab/autotest/` | research, 4 sessions done | see §3 | `tongzhou-forge-2d/docs/AUTOTEST-HANDOFF.md` |
| 4 | Level design by data, handed to smaller models | inside 1 (`isles.js`) | **next; the hand-off is not written yet** | — | §4 below |
| 5 | **The Forge 3D**: the same forge in Three.js | `tongzhou-forge/` | kept, not developed (tag `forge-3d-2026-11-19`) | `board-3d` | `tongzhou-forge/docs/forge/ROADMAP.md` |
| 6 | Earlier builds: V0.2 toy, Isles V0.5, Conjure 3D | `tongzhou/`, `tongzhou-isles/`, `tongzhou-conjure/` | history, kept runnable | `board-isles`, `board-conjure` | each README |
| 7 | **Board launcher**: startup scripts, QR board | `board/` | active | `cd board && ./install.sh` | `board/README.md` |

How they descend from each other:

```
tongzhou (V0.2 toy, charter) → tongzhou-isles (V0.5, 3D) → tongzhou-conjure (3D + writing pad)
  → tongzhou-forge (3D, positional forge) → tongzhou-forge-2d (side view; Conjure back; crew)   ← the core
```

Each folder is a copy of the one before it, never an import. Code that moved forward was copied by hand: the
WebSocket server, the recogniser and the stroke data came from `tongzhou-forge` into the 2D. No folder imports
from another, so any of them can be changed or left alone safely.

## 1. Glyph Isles 2D (the core)

A side-view platformer on phones. Players walk, jump and leap (轻功), and carry character stones. A stone set
beside or on top of another forges a new character: 木 beside 木 makes 林. Each isle has a pavilion that wants one
character. There are 23 isles: 21 from the beta, plus 2 writing isles where you must write a character yourself.

| Part | What it is | Code | Doc |
|---|---|---|---|
| The sim | deterministic rules, shared by the page, the server and the tests | `sim.js`, `isles.js`, `rules.js` | `README.md`, `docs/GREYBOX.md` |
| Conjure | 书 WRITE: draw a character on the pad, and its stone appears in your hands | `app.js` (pad), `vendor/recogniser.js`, `vendor/strokes.json` | `docs/CONJURE.md` |
| The crew | one isle for up to four phones; bodies that bump, block, shove and carry; optional knock from thrown stones | `server.js`, `sim.js` (`BODY`), `app.js` (net) | `docs/CO-OP.md` |
| Looks | ink and One Stroke renderers; things shown as what they mean | `ink.js`, `cut.js`, `things.js` | `docs/ART-DIRECTION.md`, `docs/CARRIED-THINGS.md` |
| The board | the QR page for the room and the crew roster | `board.html`, `board.js` | `README.md` (the board paragraph) |

Play profiles (`relaxed`, `standard`, `strict`) tune every part at once. Each knob table in `sim.js` (FORGE, QI,
ASSIST, CONJURE, BODY) has a `profiles` entry. The thrown-stone knock (`off`, `push`, `loose`) is chosen by the crew,
not by the profile.

**The 2D docs and their status**

| Doc | What it holds | Status |
|---|---|---|
| `README.md` | isles, run, controls, tests, network | current |
| `AGENTS.md` | rules for any model working in the folder | current |
| `docs/CO-OP.md` | the crew: decisions, knobs, wire protocol, tests, **§6 forge-together proposal for Design**, §9 hand-off | current |
| `docs/CONJURE.md` | the writing pad: plan, knobs, writing isles (§7a), hand-off (§8) | current |
| `docs/AUTOTEST.md` / `AUTOTEST-HANDOFF.md` | play-testing research log / one hand-off per session | current |
| `docs/ART-DIRECTION.md` | both looks, decisions, what was built | current |
| `docs/CARRIED-THINGS.md` | stones you carry drawn as the thing: steps 1–2 built, 3–4 open | open |
| `docs/BETA.md` | the 21-isle beta (2026-11-20) | record |
| `docs/GREYBOX.md` | the first side-view step and what it found | record |
| `docs/ART-BRIEF.md`, `docs/ART-BRIEF-ONE-STROKE.md` | the briefs sent to Claude Design (both answered; frames in `docs/design/`) | record |

**Tests** (in `tongzhou-forge-2d/`; each starts its own server on its own port, never 3000):

```sh
node sim-test.mjs && node write-test.mjs && node smoke-test.mjs && node crew-test.mjs   # quick
node write-isle-test.mjs && node crew-check-test.mjs                                    # headless phones, real touch
node screen-test.mjs && ART=cut node screen-test.mjs && ART=greybox node screen-test.mjs   # 11 screens per look, slow
```

`screen-test.mjs` rewrites the screenshots in `screenshots/<look>/`, which are tracked in git, so a run shows up as
changed files.

## 2. The looks: two kept, one for testing

| Look | `?art=` | Board shortcut | Role |
|---|---|---|---|
| ink scroll 水墨 | `ink` (default) | `board-2d` | candidate style A, from Claude Design's first boards |
| One Stroke 一笔 | `cut` | `board-2d-onestroke` | candidate style B, cut paper, from Design's round 2 |
| greybox | `greybox` | `board-2d-greybox` | plain boxes and labels: for checking rules and for tests; not for children |

All three draw the same sim, so a look never changes the rules. A child can switch the look in ☰ on their own phone
without affecting the crew. The art plan and both briefs are in `docs/ART-DIRECTION.md`. Until a style is chosen,
a change to drawing code must keep both ink and One Stroke passing `screen-test.mjs`.

## 3. Automated play-testing (the lab)

The tools play **the 2D game only**: its sim directly, or its real page in headless Chromium or on an Android phone
over adb. They do not run the 3D builds. The page player takes `--art=cut` for One Stroke, and ink is the default.

| Tool | What it does |
|---|---|
| `lab/autotest/mind.mjs` | a search "mind": plans from the isle's recipe and recovers from mistakes, with no script |
| `human.mjs`, `personas.mjs` | a human motor model: timing, stick noise, latency; personas steady / rusher / kid |
| `mind-zero.mjs`, `mind-personas.mjs` | every isle at zero noise; every isle × persona × seed |
| `page-mind.mjs` | the mind plays the real page by CDP touch, checking state, the GRAB label and the drawing on every frame |
| `monkey.mjs`, `trace.mjs`, `ablate.mjs` | random play, frame traces, which noise breaks a route |

Every command is in `lab/autotest/README.md`. Where the research stands: `docs/AUTOTEST-HANDOFF.md`. Known limit:
the minds skip the two writing isles, and none of them plays as a crew yet (`docs/CO-OP.md` §8).

## 4. Level design by data (next: hand-off to smaller models)

The plan: let smaller models design isles as **data only**, with no code changes, and have the tests decide whether
an isle is good. **The hand-off document for this is not written yet.** These already exist to build it on:

- **The format.** Every isle is one entry in `tongzhou-forge-2d/isles.js`. The legend at the top of that file is
  the whole format: map rows of `. # ~ _ T F S b`, then `stones`, `write`, `gems`, `glow`, `clouds`, `pavilion`,
  `want`, `pal`, `tip`.
- **What makes an isle valid.** `sim-test.mjs` requires every isle to be won by a scripted player in two ways. The
  routes are in `routes.mjs`, as named step lists per isle. A new isle needs its routes there.
- **Does a human-like player win it.** `node lab/autotest/mind-zero.mjs <isle-id>` and `mind-personas.mjs` tell
  whether the mind wins it, and how long a kid persona takes.
- **Does it fit every screen.** `screen-test.mjs` checks one isle per screen size. The isle chosen comes from
  `screen-check.py`.
- **Which characters exist.** Stones are limited to the characters in `rules.js` and the recogniser's stroke data
  (36 characters; `docs/CONJURE.md`).
- **Writing isles** (where the goal needs a written stone) follow the rules in `docs/CONJURE.md` §7a.

When it is written, the hand-off should go in `tongzhou-forge-2d/docs/` and be listed here.

## 5. The Forge 3D (`tongzhou-forge/`)

The positional forge in Three.js: nine isles, body forging (stand on a friend's head for "above"), the board, and
Conjure. It was the main build until the side view replaced it on 2026-11-19. It is kept as it was (git tag
`forge-3d-2026-11-19`) and still runs: `board-3d`, or `cd tongzhou-forge && node server.js` (port 3200). The side
view's plan, `docs/forge/SIDE-VIEW.md`, lives there and explains why 2D won. Its tests are its own and are not run as part
of the 2D work.

## 6. Earlier builds

| Folder | What it was | Run |
|---|---|---|
| `tongzhou/` | V0.2 "visual toy": the river, arrivals and spending a character. **The charter** (`docs/charter-v1.md`) and content seed come from here | `python3 -m http.server 8080` in the folder |
| `tongzhou-isles/` | V0.5: 同舟 merged with Wobble Works co-op physics; characters as stones that do what they mean (the idea the 2D still uses) | `board-isles`, or `node server.js` (port 3000: use `PORT=3001` for tests) |
| `tongzhou-conjure/` | Isles plus the writing pad, where the recogniser and stroke data were first built | `board-conjure`, or `node server.js` (port 3100) |

These are history: read them for where an idea came from, and do not change them.

## 7. Starting things: the board launcher (`board/`)

Install once with `cd games/board && ./install.sh`. Then:

| You want | Run |
|---|---|
| the core game for a room of phones | `board-2d` (ink) or `board-2d-onestroke` |
| gentler rules for young children | `board-2d-relaxed` |
| thrown stones knock friends back | `board-2d-rough` |
| each phone its own game | `board-2d-alone` |
| any mix | `board 2d cut relaxed push`, `board 2d alone greybox` |
| an older build | `board-3d`, `board-3d-relaxed`, `board-conjure`, `board-isles` |
| stop / check | `board-stop`, `board status` |

Each shortcut is also in the desktop Games menu as "Board: …". Everything runs on port 3000, the one port this
machine's firewall opens to phones. The full guide is `board/README.md`, including what each word means, how
the script frees the port without touching other programs, the logs, and fixes for common problems.

## Ports

| Port | Used by |
|---|---|
| 3000 | the board launcher (all games); `tongzhou-isles` by default. Never used by a test |
| 3300 / 3200 / 3100 | default dev ports of the 2D, the 3D Forge and Conjure 3D |
| 3481 3482 3487 3489 3490 | 2D tests: smoke, screen, write-isle, crew, crew-check |
| 3488 | board launcher smoke test |
| 3491 | the lab's page tests (by convention) |
| 3460–3480 | 3D Forge tests |
