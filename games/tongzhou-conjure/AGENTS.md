# Rules for any model working in this folder (tongzhou-conjure)

This is the **Conjure prototype** — a parallel copy of `tongzhou-isles` where the
Conjure feature is built. The rules here differ from the original because the whole
point is to extend `sim.js`, `server.js` and the tests.

**Read `docs/conjure/ROADMAP.md` first**: status, decisions and the task cards. Then `SPEC.md`
(exact formats) and the one design doc for your stream (`CONSUMABLE.md`, `OPEN-SET.md` or
`PARTICLES.md`). `PLAN.md` and `TASKS.md` are the original 2026-11-17 plan, kept for history.
Then read your task card.

## Owner model: Strong (S) vs Weak (W)

| Owner | May touch |
|---|---|
| **S** (strong model only) | `sim.js`, `server.js`, `conjure-test.mjs`, `tools/judge/lint.mjs`, any new test file, stage design decisions |
| **W** (weak model, from one task card) | `app.js`, `index.html`, `style.css`, `lab/`, `vendor/recogniser.js`, content data files |
| **Either** | `content/glyphs.json`, one new file in `content/candidates/` or `content/stages/`, `README.md`, `docs/` |

## Never change (regardless of task)

- `levels.js` — the parse + joining rules shared with the browser (unchanged from tongzhou-isles)
- `tools/judge/*.mjs` — the judge core files directly under `tools/judge/`
- `tools/judge.mjs` — the judge CLI entry
- `tasks/checks/` — the check scripts for tasks
- `vendor/` — existing vendor files (`three.min.js`, `qrcode.js`, font files); may ADD new vendored files for conjure
- `content.js` — generated: run `node tools/pack.mjs` after any `content/` change

Do not import from `games/tongzhou-isles`. Do not touch `index.html`, `game/`, `assets/`
at the repo root (the production 学字坊 game). Do not use port 3000 in tests.

## Commands

```sh
node tools/pack.mjs                                        # after ANY content/ change
node tools/judge.mjs content/candidates/my-isle.json       # stage OK?
node sim-test.mjs && node smoke-test.mjs && node judge-test.mjs  # must all print "ALL ... PASSED"
node conjure-test.mjs                                      # conjure-specific tests (phase 2+)
```

## Done when

1. The existing `sim-test.mjs`, `smoke-test.mjs` and `judge-test.mjs` all print `ALL ... PASSED`.
2. `conjure-test.mjs` exists and prints `ALL ... PASSED` (phase 2+).
3. The gate for the current phase (see `docs/conjure/TASKS.md`) is met.

## Facts that are easy to get wrong

- English first. A Chinese character always comes with pinyin and English meaning.
- Position `[x, z]` → map column `floor(x)`, row `floor(z)`. Row 0 is the first string of `map`.
- Stage format: `docs/STAGES.md`. A stage is finished only when `node tools/judge.mjs` prints `PASS`.
- Tests use ports 3456 and 3457, never 3000. The game server defaults to 3100.
- `CONJURE` constants in `sim.js` are the single place to tune ink / cooldown / cap numbers.
- Ink is **one pool for the crew** (`game.ink`, `game.inkMax()`), not per player. The snapshot's `ink` is a number.
- Stones are **used up**: `STONES.regrow` is false; only a stage with `"regrow": true` regrows. Do not bring regrowing back to fix a puzzle; make the stage solvable instead.
- `lab/accuracy.mjs` passing does **not** mean recognition works: there are no real samples yet.
