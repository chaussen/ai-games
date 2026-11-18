# Positional Forge: roadmap, status, decisions

**Start here** if you are picking this work up. Then read `AGENTS.md` (who may touch what),
`CONCEPT.md`, and the `DESIGN.md` sections your card names. Do one card at a time. Run every suite
before and after (§5). If this page disagrees with the code, the code and tests win: fix this page.

Last updated: **2026-11-18**.

## 1. Status

| Phase | What | Status |
|---|---|---|
| 0 | Fork `tongzhou-conjure` → `tongzhou-forge`; ports 3200 / 3460 / 3461 / 3462; game id | **Done** 2026-11-18. Baseline suites green |
| 1 | Documentation package (`docs/forge/*`, README, AGENTS) | **Approved** 2026-11-18 |
| 2 | Sim core: op-aware recipes, classifier, stones on stones, ground forging, placement aims | **In progress** (F2.1) |
| 3 | Minimal playable `dawn` + client + playtest log → **G1** | Not started |
| 4 | Body forging → **G2** | Not started |
| 5 | Judge and lint: op closure, placement and body actions, `order-trap`, `--sloppy` | Not started |
| 6 | Content: glyphs, elements, font, 4 to 6 stages → G3 | Not started |
| 7 | Pyramid and enclosure | Not started |
| 8 | Retrospective | Not started |

## 2. Cards

Owner **S** = strong model (sim, server, tests, judge, stage design). **W** = weak model, working
from the card alone (client, CSS, content data, lab). Each card is committed to `master` on its own,
with its tests green, and with §1 and §3 of this page updated in the same commit.

### Phase 2: sim core (no client changes except keeping the board working)

| Card | Owner | Work | Files | Done when |
|---|---|---|---|---|
| F2.1 | S | Recipe format `[op, a, b, r]`; port the 14 recipes with their real ops (SPEC §2); `levels.js` `fuse(op,a,b)`, `mirrors`, `form`; remove two-argument `fuse` and fix every caller | `content/glyphs.json`, `content/forms.json`, `levels.js`, `tools/pack.mjs`, `sim.js` (callers only), `sim-test.mjs`, `tasks/checks/t03.mjs`, `tools/gen-stages.mjs`, `tools/judge/*` (callers only) | All suites green with the ⿰ stages (the 3 shipped stages still PASS the judge) |
| F2.2 | S | `tools/recipes.mjs`: MMAH check with variants and aliases; `--pairs` report; pack refuses on a mismatch | `tools/recipes.mjs`, `tools/pack.mjs` | Exits 0 on the 14 recipes; a deliberately wrong recipe exits 1 with the dictionary IDS |
| F2.3 | S | `FORGE` table and profiles; `this.fz`; `strict` stage field + lint | `sim.js`, `tools/judge/lint.mjs` | Profile test in `forge-test.mjs` |
| F2.4 | S | `relate()` classifier | `sim.js`, `forge-test.mjs` | Classifier group (SPEC §9) passes |
| F2.5 | S | Stones rest on stones (`ground()` stones pass, `support`, falling when support leaves) | `sim.js` | Stacking group passes; `sim-test` determinism holds |
| F2.6 | S | Op-aware `stepFusion` through `tryForge`; snap (K4); dud `why`; rescue (K5); `dudCd` (K6); `wrongLife` (K7); `try` events | `sim.js` | Order and Forgiveness groups pass |
| F2.7 | S | `launch()`: `join` = beside on the approach side, new `stack`; aim modes | `sim.js` | Placement group passes |
| F2.8 | S | Solver keeps the shipped stages passing with op-aware joins (full judge work is Phase 5) | `tools/judge/solve.mjs` | `judge-test` green |

### Phase 3: minimal playable and G1

| Card | Owner | Work | Files | Done when |
|---|---|---|---|---|
| F3.1 | S | `dawn` stage (日, 木, regrow) + the dusk element (杳 dims, glow-gem) in the sim | `content/stages/dawn.json`, `content/glyphs.json`, `sim.js` | Judge PASS (two routes) |
| F3.2 | W | Board: stones drawn stacked; BESIDE / ON TOP labels; forge burst (two sprites merge into one); relation ticks; variant forms; dusk dimming | `app.js`, `style.css` | Headless page check: no console errors; screenshot from a running build |
| F3.3 | S | `server.js --log` playtest JSONL; board `?strict=` override for testing | `server.js`, `smoke-test.mjs` | Smoke test covers the log file |
| F3.4 | — | **G1 playtest** (PLAYTEST.md) and record the results here | — | Keep, retune, or kill recorded |

### Phase 4: body forging and G2

| Card | Owner | Work | Files | Done when |
|---|---|---|---|---|
| F4.1 | S | Stand on a holder; arm hold `holdLow`; snapshot `low` | `sim.js` | Body group: arm-hold check |
| F4.2 | S | `formation()`, the `forge` launch mode, `forgeHeld()`; result to the triggerer; invalid FORGE dud | `sim.js`, `forge-test.mjs` | Body group: bottom and top initiators, swap, pass priority |
| F4.3 | W | Phone GRAB label shows FORGE; board arm-hold pose; formation tick | `app.js`, `style.css` | Headless check with `tools/puppets.mjs` |
| F4.4 | S | `on-my-shoulders` stage; solver two-bot body action | `content/stages/`, `tools/judge/solve.mjs` | Judge PASS with a body route |
| F4.5 | — | **G2 playtest** | — | Keep, retune, or kill recorded |

### Phases 5 to 8 (cards written when Phase 4 closes)

5: lint closure and `order-trap`, `--sloppy` hand margin, `docs/STAGES.md`. 6: CONTENT §3 elements,
font re-subset, stages 5, 7 and 9 → G3. 7: pyramid and frames. 8: `RETROSPECTIVE.md`.

## 3. Progress log

| Date | What |
|---|---|
| 2026-11-18 | Assessment: the reskin test fails today; positional grammar (TZ-D044) is the Chinese-unique core. Plan approved with John's note on the middle point between strict grammar and relaxed play. Phase 0 fork done (suites green: sim, smoke, judge, conjure). Phase 1 docs written. |
| 2026-11-18 | John approved the Phase 1 docs; Phase 2 started with F2.1. |

## 4. Decision log

| # | Date | Decision | Why |
|---|---|---|---|
| FG-D001 | 2026-11-18 | Build in a new folder `games/tongzhou-forge`, copied from `tongzhou-conjure`; Conjure is dormant | Forge must not wait on, or break, the blocked handwriting work |
| FG-D002 | 2026-11-18 | No near-miss shimmer. A wrong arrangement is a plain dud | Charter P9: show after, never before |
| FG-D003 | 2026-11-18 | **The middle point** is the governing principle. Every place it bites is a named knob in `FORGE`, grouped into per-stage profiles, and moved only by the playtest loop | John: grammar is strict, play is relaxed; finding the middle needs iterations |
| FG-D004 | 2026-11-18 | Starting hypothesis: forgive the hand, not the grammar. Rescue and wrong-life exist but are off by default | Keeps the reskin test passing while removing physical fiddliness |
| FG-D005 | 2026-11-18 | Left/right means screen left/right; depth is never meaningful | The isometric view makes near/far unreliable |
| FG-D006 | 2026-11-18 | Above is read from physical support (stone on stone, player on head), not geometry | Robust to wobble and latency; matches what players see |
| FG-D007 | 2026-11-18 | Body forging is triggered by a GRAB press from **any** participant; the result goes to the triggerer | John: the bottom player can initiate too, so nobody just stands still; players can drop and swap freely |
| FG-D008 | 2026-11-18 | Ground and held stones never relate to each other | Predictability |
| FG-D009 | 2026-11-18 | Ground stones still forge automatically once settled; bodies forge on a press | Placing a stone is already deliberate; a formation needs an explicit moment |
| FG-D010 | 2026-11-18 | Recipes carry an IDS op and are checked against MMAH at pack time | One source of truth; no hand-made structure errors |
| FG-D011 | 2026-11-18 | The character set is closed; rare mirror characters (炏 仌 吅) are duds | Honest mirrors without obscure characters |
| FG-D012 | 2026-11-18 | Forge stages default to `"regrow": true` until a split verb exists | Used-up stones make a wrong-but-real result a soft-lock otherwise |
| FG-D013 | 2026-11-18 | `levels.js`, `tools/judge/*` and the `vendor/` font may change in this folder (unlike in conjure) | The forge changes the core rules on purpose |

## 5. Commands

```sh
cd games/tongzhou-forge
node tools/pack.mjs                     # after ANY content/ change (runs the recipe check from F2.2 on)
node sim-test.mjs && node smoke-test.mjs && node judge-test.mjs && node conjure-test.mjs
node forge-test.mjs                     # from F2.3 on
node tools/judge.mjs content/stages/<id>.json
node server.js                          # port 3200; --log for playtests (F3.3)
```

No test uses port 3000. Ports: game 3200, smoke 3460, conjure 3461, forge 3462.
