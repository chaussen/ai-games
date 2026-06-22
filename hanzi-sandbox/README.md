# Hanzi Sandbox (prototype — separate product)

Implements Design Bible §2 (Fusion Model) and §3 (Recipe Registry) only.

**Not wired into `game/`.** This is a separate product per Design Bible §0/§22 —
do not import from or merge into the existing CaseyChinese game code.

- `recipes.js` — Recipe Registry: the `[LOCKED]` base recipes + the `[LEAN]`
  tier-2 chain targets, as data, per the `{ inputs, char, pinyin, gloss,
  class, tier, effect, color }` contract.
- `fusion.js` — Fusion Model: multiset-matching `FusionEngine`, tier/chain-depth
  accounting (max tier 2 = chain depth 3), and `StampPool` for the
  infinite-stamps-in-Teach/Choose vs. depletion-in-Constrain rule.
- `test.js` — smoke tests. Run with `node hanzi-sandbox/test.js`.

Anything not yet in the Design Bible (matrix, puzzle vocab, UI) is out of
scope here until it's written back to the bible per the doc's protocol.
