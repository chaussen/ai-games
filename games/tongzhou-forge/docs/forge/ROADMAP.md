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
| 2 | Sim core: op-aware recipes, classifier, stones on stones, ground forging, placement aims | **Done** (F2.1–F2.8) |
| 3 | Minimal playable `dawn` + client + playtest log → **G1** | **Built**: F3.1, F3.2 (`tasks/04`), F3.3 and the log reader (`tasks/05`) done. **G1 (F3.4) needs people** |
| 4 | Body forging → **G2** | Not started |
| 5 | Judge and lint: op closure, placement and body actions, `order-trap`, `--sloppy` | Not started |
| 6 | Content: glyphs, elements, font, 4 to 6 stages → G3 | Character batch 1 (`tasks/06`) done; candidate `old-leaf` (`tasks/07`) |
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
| 2026-11-18 | **F2.1 done.** Recipes are `[op, first, second, result]` (14 ported; 焚 森 众 昌 are ⿱). `levels.js` has `fuse(op,a,b)` (throws on a bad op), `mirrors`, `form`, `RECIPE_LIST`, `OPS`; `content/forms.json` packed. Every caller fixed. The sim and the judge's join still fuse order-free through the marked `F2.1 bridge` (removed in F2.6 and F2.8). All suites green; the 3 stages PASS. Already failing before F2.1 and left alone: `tasks/checks/t03.mjs` expects 好 to be `folk`, but glyphs has `light`. |
| 2026-11-18 | **F2.2 done.** `tools/recipes.mjs` checks every recipe against the MMAH IDS (variants 忄氵亻 → 心水人; alias 曰→日 for 昌; a nested IDS such as ⿱木⿰木木 matches a piece that is itself a recipe result). `pack.mjs` refuses to write `content.js` on a mismatch. `--pairs <pieces>` lists two-piece characters by piece set and marks minimal pairs (日木 → 杲/杳, 口木 → 呆/杏, 人人 → 从/仌, 火火 → 炎/炏). `sim-test` covers the check, a wrong recipe, and `--pairs`. All 14 recipes match; all suites green. |
| 2026-11-18 | **F2.3 done.** `FORGE` table in `sim.js` (K1–K10 knobs plus `holdLow`, `inR`) with profiles relaxed / standard / strict; `assist` and `forms` (K9, K10) added to the table so the client knobs live there too. `loadStage` sets a frozen `this.fz` via `forgeKnobs()`; unknown names fall back to standard. Lint accepts the `strict` field and rejects unknown profiles. New `forge-test.mjs` with the Profiles group (15 checks). No rule reads `this.fz` yet (F2.4 on). All suites green. |
| 2026-11-18 | **F2.4 done.** `relate(a, b, mode, fz)` and `bestRelation()` in `sim.js` (pure, exported, not yet called by the sim). Screen axes R=(1,0,−1)/√2, D=(1,0,1)/√2; depth-only offsets give no relation; ⿱ comes from `support` only (ground: the stone's, body: the holders'); `bodyD` widens depth for bodies; `bodyStill` (strict) rejects moving holders. Partner choice: ⿱, then err, then lowest id. Classifier group: 20 checks. All suites green. |
| 2026-11-18 | **F2.5 done.** Stones rest on stones: `ground(…, stones)` has a stones pass used only by stone bodies (and the aim prediction); `support` points at the stone below. Two findings: (1) stone-on-stone uses **round** footprints, because the beside spot is a world diagonal (0.44, −0.44) where square boxes still overlap and would stack; (2) a stone lands on any loose stone, not only grounded ones, because a support falling 0.56 bounces (> 5 u/s) and the stone above fell through it. A stack rides a moving deck through the support chain. Picking a stone up clears its `support`. Stacking group: 10 checks. All suites green, `sim-test` determinism holds. |
| 2026-11-18 | **F2.7 done (before F2.6, FG-D014).** `launch()`: facing a loose stone, standing mostly along R (|r| ≥ |q|) gives `join` = BESIDE, landing on the `ideal` spot on your side; mostly along D gives the new `stack` = ON TOP (lands on the stone's top; on a stack, the top stone). The launch carries `on` (target id). Finding: the old `join` landed 0.45 short of the target, which with F2.5's round footprints would now *stack*; the bridge hid it. `sim-test` stage 2 relied on that accident (set 火 down facing 木 from the front) and now faces away. Client labels (`ON TOP`) wait for F3.2; `stack` shows the default label until then. Placement group: 11 checks. All suites green. |
| 2026-11-18 | **F2.8 done.** The solver's join became placement actions: for every recipe of the held piece and a loose stone that the stage needs, "sets h left/right of k" (⿰, h first/second) or "sets h on top of k" (⿱, h first); h at the bottom is found from the other stone. The bot walks to the cell of the exact spot (0.95 along ∓R or ±D), steers onto it (`steer()`; cell centres next to a stone lie on the screen diagonal where BESIDE and ON TOP tie), faces the stone, and presses only when `launch()` reports the intended mode on that stone; success needs a `fuse` of the intended character. The judge's F2.1 bridge is gone. All 3 stages PASS with two routes. |
| 2026-11-18 | **F2.6 done; Phase 2 done.** The sim's bridge is gone: a landing stone `settle()`s → K4 snap (slide to the ideal spot over `snap` s, flat surfaces only) → `stepFusion` → `tryForge(rel)`: K6 cooldown, `fuse(op, first, second)`, K5 rescue (`unique` = the pair has exactly one recipe in any arrangement), else `dud` with `why` mirror/dud. Results land between a beside pair or on the bottom stone's spot and carry `parts`; wrong-but-real results (not in the want tree) get K7 `life` when finite and split back ±0.45 along D. Events: `forge` (+ `fuse` alias), `dud {op, why}`, `try {why: ok/wrong/mirror/dud/norel/cooldown}`, `split`; `server.js` strips `try` and `why` from what clients see (P9). Findings: (1) `this.time` only runs once the crew has started, so K6 uses a new `this.clock` that runs every step; (2) forging is now on landing, not every tick (a stone carried into a relation by a lift does not forge until it lands again); (3) the scripted solo routes in `sim-test` (stages 2 and 3) and `conjure-test` (好) had set pieces down on whatever side they approached from; they now place on the correct side, and stages 2 and 3 need a set-down-and-rebuild because 月 and 木 sit on island edges with void on their screen-left (a G1 content note: the judge found routes on its own). Order 16, Forgiveness 16, Determinism 1 checks. The check "rescue leaves 杲/杳 alone" waits for F3.1 (no pair has two recipes yet). All suites green; the 3 stages PASS with two routes in the op-aware sim. |
| 2026-11-18 | **F3.1 done.** 杲 (gǎo, bright, light) = 日 ⿱ 木 and 杳 (yǎo, dim, new element **dusk**) = 木 ⿱ 日; MMAH check 16/16; `strokes.json` regenerated. Sim: a dusk stone dims the isle for `DUSK_TIME` 20 s (tune; `dusk {on}` events, snapshot `dk`); a light stone set down ends it; new stage field `glow` = glow-gems takeable only at dusk (lint `glow-without-dusk`). Snapshot stone tuples gain `rel` [op, slot, partner] and `low` (0 until F4.1); `clientKnobs()` sends `fz {profile, assist, forms}` with the stage — so F3.2 is client-only. Stage `dawn` (4th in order): one 日, one 木, regrow, want 杲, `pal` dusk turning dawn; judge PASS, routes boost and bridge (the bridge route throws 木 into the gap and waits for it to grow back). Bug found by a test: the dusk countdown passed 0 before `setDusk(0)` ran, so "dusk off" never fired. The deferred check is in: relaxed rescue leaves 日 beside 木 a dud (two real arrangements). Stacking tests now use 月 (日 木 forge now). **Font:** the brush font subset lacks 杲 杳 氵 忄 亻; the full Ma Shan Zheng needs one download by a human (CONTENT §6) — needed before G1. `tasks/checks/t03.mjs` (frozen) now also fails its "22 characters" count. All suites green. |
| 2026-11-18 | **F3.3 done.** `node server.js --log` appends `try forge dud split stage win join leave dusk profile` events as JSONL to `logs/playtest-<date>.jsonl` (`FORGE_LOG_DIR` overrides), each line with `ts`, `sess`, `stage` id, `profile` and `st` (stage clock); player ids only, never names; `logs/` is gitignored. Clients still never see `try` or a dud's `why`. Profile override: `game.setStrict(name)` (sim, emits `profile`, re-sends `fz`), reachable only from a board — `strict` on the board's join message or `{type:'admin', cmd:'strict', v}`; phones are ignored. Passing `?strict=` from the board URL is one line in `app.js`, so it is in the W card. The smoke test now runs with `--log` and checks the file, the privacy rule, P9 and the board-only override; its 木 + 木 join now stands screen-right of the other 木 instead of on the world-axis tie. All suites green. |
| 2026-11-18 | **F3.2 written as a W card**, not built: `tasks/04-forge-board.md` + `tasks/checks/t04.mjs` (with `t04_board.py`, Python Playwright). The check boots the real server on port 3474, opens the real board with `?strict=relaxed`, plays dawn with a wire bot (BESIDE dud → placement marks; 木 on 日 → 杳 and dusk; carry 杳 off; 日 on 木 → 杲 and daylight), reads a small `window.WForgeUI` API, fails on console errors and saves two screenshots. Dry run against today's client: every game step passes; only the client items fail, as intended. **G1 observation to watch:** nothing regrows within 1.4 of a stone, and 杳 lands on its bottom stone's spot, which on dawn is next to both springs, so after a 杳 the crew must carry it away before 日/木 come back. |
| 2026-11-18 | **Font and weak-model handover.** Downloaded the full Ma Shan Zheng (OFL, google/fonts; licence identical to `vendor/MaShanZheng-OFL.txt`; kept out of the repo). New `tools/font.py` re-subsets it to what the subset held plus every Han character in `content/`, `levels.js`, `app.js` and `index.html`, and writes `vendor/MaShanZheng-subset.chars.txt`; `--check` exits 1 on a gap. The subset grows from 231 to 250 characters (杲 杳 氵 忄 亻, card 06's batch, and 斗 朱 砂 笠 绿 藤 青 黄 already named in content); 64 KB. The smoke test now fails if a glyph or variant form is missing from the font. New W cards, each with a check proven to pass in a scratch run and then thrown away: `tasks/05` (`lab/playlog.mjs`: the G1 numbers from a log, fixture in `tasks/checks/fixtures/`), `tasks/06` (口 十 田 土 + 呆 杏 果 叶 古 早 赤 灶, 8 recipes; MMAH 24/24, all suites and the 4 stages stay green), `tasks/07` (candidate `old-leaf`, needs 06; a dawn-shaped draft PASSes with boost and row). `tasks/README.md` now says how to hand a card out, what is ready, and what a weak model cannot take yet. `t03` is marked do-not-hand-out. |
| 2026-11-18 | **F3.2 done (task 04).** Board: `AIM_LABEL` table (BESIDE, ON TOP, FORGE, PASS, OFFER, THROW, SET DOWN) for the phone label; `stack` aims draw like `join`. `glyphFor(ch, rel)` draws variant forms (氵 in the left slot of ⿰) with the base piece's ink, swapping the stone texture when its `rel` changes. One neutral ink-dot bar per placement (upright between a ⿰ pair, flat under a ⿱ top stone), never coloured by outcome (P9). On `forge` the two pieces slide together over 0.32 s (swapped start when `rescued`) and the new stone pops after them. Dusk: lights to a third and a violet multiply veil while `dk > 0`; glow-gems built after the gems, shown only at dusk, with their own counter slots. `dusk` element colour; `?strict=` from the board URL; `window.WForgeUI`. `t04` DONE; screenshots `screenshots/forge/G1-2026-11-18-dawn-dusk.png`, `…-dawn-sunrise.png`. |
| 2026-11-18 | **Task 05 done.** `lab/playlog.mjs <log> [--json]`: groups per stage and profile, tries per forge, hand and grammar shares, seconds to first forge, wins and win time, and the PLAYTEST §4 flags; bad lines counted, player ids never printed. `t05` DONE. |
| 2026-11-18 | **Task 06 done.** Character batch 1: 口 十 田 土 + 呆 杏 果 叶 古 早 赤 灶; 8 recipes (minimal pairs 口/木 → 呆/杏, 十/口 → 古 vs 叶). MMAH 24/24; `content.js` and `strokes.json` regenerated; font check clean. `t06` DONE, all suites green. |

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
| FG-D014 | 2026-11-18 | Card order in Phase 2 is F2.7 → F2.8 → F2.6 (not 2.6 → 2.7 → 2.8) | Removing the sim's order-free bridge (F2.6) before joins land beside on the approach side (F2.7) and before the solver picks that side (F2.8) would leave suites red between cards; this order keeps every commit green |
| FG-D015 | 2026-11-18 | Rescue `unique` means: the exact arrangement is a dud and the two pieces have exactly one recipe in any op and order. "Wrong" means: not `want` and not a piece on any recipe path to it | The simplest readings of K5 and K7 that stay deterministic and need no per-stage data |

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
