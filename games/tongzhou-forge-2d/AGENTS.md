# Rules for any model working in this folder (tongzhou-forge-2d)

The side-view greybox of the Positional Forge. Read `README.md`, then `docs/GREYBOX.md`.

- Never import from another game (`games/tongzhou-forge` included); copy and say where from.
- The grammar is the 3D game's: recipes `[op, first, second, result]`, order matters, left means page
  left, above means support. Labels name the placement, never the result (P9).
- Every strictness or forgiveness value is a knob in `FORGE`, `QI` or `ASSIST` (`sim.js`) with
  relaxed / standard / strict profiles. An isle never carries its own numbers.
- The phone is the main screen. The screen budget (goal, card, one message line, ☰, stick, two
  buttons) is checked by `screen-check.py`; do not add HUD without changing the budget on purpose.
- Pinyin and meaning stay with every Chinese character shown (buttons included).
- New Chinese text on the page: re-subset the font with `tools/font.py` (smoke test fails otherwise).
- Three looks share one sim: `cut.js` (一笔 One Stroke, `?art=cut`, from `docs/design/one-stroke/`: flat fills, no gradients, no alpha tints except the dusk and win veils), `ink.js` (水墨江湖, default, from Claude Design's boards in `docs/design/`) and
  the greybox in `app.js` (`?art=greybox`). Renderer only: never put rules in either.
- `things.js` (`WThings`) draws the §3.7 things (a thrown stone opens into a log, fireball, sun, crescent, splash or
  clod) for both painted looks: flat fills, no alpha, glyph on a vermilion tag. Keep it that way; the word card keeps a thrown stone until it lands. `carried()` draws the held 木 火 日 月 (board coordinates from Design's Things board; pose names `carry`, `hold`, `shoulder`; `cut.js` has all three poses, `ink.js` only `carry`).
- Ink performance: no large gradient or stretched-image fills per frame (they cost 40+ ms on a
  software rasteriser); bake them (`layer`, `vband` in `ink.js`) and copy them unscaled.
- Before committing: `node sim-test.mjs && node smoke-test.mjs && node screen-test.mjs && ART=greybox node screen-test.mjs`. Never port 3000 in tests.
