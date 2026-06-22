# Hanzi Sandbox (prototype — separate product)

**Not wired into `game/`.** This is a separate product per Design Bible §0/§22 —
do not import from or merge into the existing CaseyChinese game code.

## Phase 1/2 — Fusion Model + Recipe Registry (§2, §3)

- `recipes.js` — Recipe Registry: the `[LOCKED]` base recipes + the `[LEAN]`
  tier-2 chain targets, as data, per the `{ inputs, char, pinyin, gloss,
  class, tier, effect, color }` contract.
- `fusion.js` — Fusion Model: multiset-matching `FusionEngine`, tier/chain-depth
  accounting (max tier 2 = chain depth 3), and `StampPool` for the
  infinite-stamps-in-Teach/Choose vs. depletion-in-Constrain rule.
- `test.js` — smoke tests. Run with `node hanzi-sandbox/test.js`.

## Phase 3 — Terrain + Spirit + Puzzle Loader (§4, §5; CLAUDE.md Phase 3)

- `data/terrain.js` — `TERRAIN` cell constants + the §4a char×terrain and §4b
  char×char interaction tables (with the CLAUDE.md D013–D033 corrections applied).
- `data/puzzles.js` — all 15 puzzles from §5, as data.
- `data/constants.js` — `HINT_PULSE_MS` / `HINT_OPACITY` tunables (D036).
- `engine/resolver.js` — `resolveInteraction(charKey, terrainCell, levelHasTimer)`.
- `engine/spirit.js` — spirit entity, state buffs (休/好/安), fall recovery (D034).
- `engine/puzzleLoader.js` — loads a puzzle definition into terrain + spirit + hand.
- `game.html` — room shell UI. Loads the files above as classic scripts (same
  UMD/global pattern `recipes.js`/`fusion.js` already use — see Decision Log
  for why this isn't native ES module imports), then runs the game loop as a
  single `<script type="module">`. Open directly or via a static server.

Anything not yet in the Design Bible (Decision & Distraction Toolkit, scoring,
audio, menus) is out of scope here until it's written back to the bible per
the doc's protocol.
