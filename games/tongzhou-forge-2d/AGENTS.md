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
- Before committing: `node sim-test.mjs && node smoke-test.mjs && node screen-test.mjs`. Never port 3000 in tests.
