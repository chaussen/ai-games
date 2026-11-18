# Rules for any model working in this folder (tongzhou-forge)

This is the **Positional Forge** prototype: a copy of `tongzhou-conjure` in which the core fusion
rule changes from "two stones touch" to "where the piece sits decides the character". Conjure
(handwriting) is dormant here.

**Read `docs/forge/ROADMAP.md` first** (status, cards, decisions). Then `docs/forge/CONCEPT.md`,
then the `DESIGN.md` / `SPEC.md` sections your card names. Do one card at a time.

**Weak model?** You get one card from `tasks/` (see `tasks/README.md`). The card's file list beats the
owner table below.

**Phase 1 gate:** passed. John approved the docs on 2026-11-18. Code follows the cards in ROADMAP §2.

## Owner model: Strong (S) vs Weak (W)

| Owner | May touch |
|---|---|
| **S** (strong model only) | `sim.js`, `levels.js`, `server.js`, `tools/judge/*`, `tools/recipes.mjs`, `tools/pack.mjs`, every `*-test.mjs`, stage design decisions, `FORGE` knob values |
| **W** (weak model, from one task card) | `app.js`, `index.html`, `style.css`, `lab/`, content data the card names |
| **Either** | `content/glyphs.json`, `content/forms.json`, one new file in `content/candidates/` or `content/stages/`, `README.md`, `docs/` |

## Never change (regardless of task)

- `tasks/checks/`, except for the call-site fix in card F2.1
- `vendor/three.min.js`, `vendor/qrcode.js`, licence files. The font subset (`tools/font.py`) and `strokes.json` may be
  regenerated with their tools (CONTENT §6), never hand-edited.
- `content.js`: generated. Run `node tools/pack.mjs` after any `content/` change.
- Knob values outside `FORGE` in `sim.js`. A stage chooses a profile; it never carries its own numbers.

Unlike in `tongzhou-conjure`, `levels.js` and `tools/judge/*` **may** change here (decision FG-D013).
That is S work only.

Do not import from any other game. Do not touch `index.html`, `game/`, `assets/` or
`build-pipeline/` at the repo root (the production 学字坊 game); `tools/strokes.mjs` and
`tools/recipes.mjs` only *read* `build-pipeline/data/` at build time.

## Commands

```sh
node tools/pack.mjs                                        # after ANY content/ change
node tools/judge.mjs content/candidates/my-isle.json       # stage OK?
node sim-test.mjs && node smoke-test.mjs && node judge-test.mjs && node conjure-test.mjs
node forge-test.mjs                                        # from card F2.3 on
```

## Done when

1. Every suite prints `ALL ... PASSED`.
2. The card's "done when" holds.
3. ROADMAP §1 and §3 are updated in the same commit.

## Facts that are easy to get wrong

- **Left/right means screen left/right**, R = (1,0,−1)/√2. Depth (near/far) never means anything.
- **Above means support** (stone resting on a stone, player standing on a head), not a height difference.
- Recipes are `[op, first, second, result]`, and order matters. `fuse(op, a, b)` has no two-argument form.
- Recipes use base pieces (水, not 氵); variant forms are display only (`content/forms.json`).
- No near-miss shimmer and no outcome preview (P9). Labels name the placement, never the result.
- Any formation participant can trigger FORGE; the result goes to the one who pressed.
- English first. A Chinese character always comes with pinyin and English meaning.
- Ports: game 3200; tests 3460 (smoke), 3461 (conjure), 3462 (forge). Never 3000.
- Stones are used up, but forge stages default to `"regrow": true` until a split verb exists (FG-D012).
