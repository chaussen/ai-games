# Conjure: ordered work

Owner key: **S** = strong model only (touches `sim.js`, `server.js`, tests, decisions).
**W** = a weak model can do it from the card, with a check script. Each phase ends with a gate.
Nothing here is started.

## Phase 0: the parallel copy (S, about 15 minutes)

1. Copy `games/tongzhou-isles/` to `games/tongzhou-conjure/`, leaving out `screenshots/`, `content/candidates/*` (keep `.gitkeep`), and any `node_modules` or save files.
2. In the copy: default port 3100 (`PORT` in `server.js`; still overridable, never 3000 in tests), `game: 'tongzhou-conjure'` in the config line, title and README heading.
3. Rewrite the copy's `AGENTS.md` so that `sim.js` and `server.js` are still S-only, and `app.js`, `index.html`, `style.css`, `vendor/`, `lab/` are W-editable only through a task card.
4. Add a README note: "Prototype copy of tongzhou-isles. Do not import from the original. Backport by hand."
5. Run the four tests in the copy: all must print `ALL ... PASSED`.

Gate: copy runs on 3100 beside the original on 3000; tests green.

## Phase 1: recognition spike, no game changes (S decides, W builds pieces)

Folder: `lab/` in the copy. Nothing in the game loads it.

| Card | Owner | Output | Check |
|---|---|---|---|
| 1.1 Licence and size check of stroke data and any matcher | S | one paragraph in `lab/NOTES.md`: licence, size, what we vendor | read by S |
| 1.2 `lab/draw.html`: canvas pad (pointer events), clear, export JSON of the strokes in the wire format | W | working page | `lab/checks/c12.mjs` opens it headless, simulates a drag, expects the exported JSON shape |
| 1.3 `lab/collect.html`: prompts "draw 木" through the closed set, 5 times each, downloads `samples` JSON | W | page | check script feeds fake strokes and validates the file |
| 1.4 `vendor/recogniser.js` option 1 (template matcher) behind the interface in `SPEC.md` section 7 | S | module | unit test with synthetic strokes |
| 1.5 `lab/accuracy.mjs` | W | prints top-1 / top-3 per character, exits 1 under the gate | runs on the fixture samples |
| 1.6 Collect real samples: at least 3 people, 5 drawings per character, on phones | human | `lab/samples/` | counted by `accuracy.mjs` |
| 1.7 Run the bake-off; if option 1 fails, try option 2, then option 3 | S | numbers written to `lab/NOTES.md` | gate below |

Closed set for the spike: 木, 火, 水, 日, 月, 人, 女, 子 (the characters of the three stages
plus the 好 pair), then widen to about 30 once it works.

Gate (adjust only with a written reason): top-3 >= 90%, top-1 >= 70%, under 200 ms per match
on a mid-range phone. **If it fails with every option, stop and ship the pick-palette version:
phases 2 to 4 still apply, with the recogniser replaced by "show the palette".**

## Phase 2: wire and sim (S only)

1. Add `CONJURE` constants and `Game.conjure()` to `sim.js` per `SPEC.md` section 3.
2. Add ink to player state, regenerated in the step, reset when a stage starts. Include `ink` in snapshots.
3. Server: `conjure` message handling, validation, `conjured` and `conjureNo` replies, allowed set sent on join and stage change.
4. `levels.js` and `docs/STAGES.md`: document the `conjure` field; `lint.mjs`: add `conjure-unknown`; add one broken-stage case to `judge-test.mjs`.
5. Write `conjure-test.mjs` (SPEC section 9, items 1 to 4).
6. Prove no regression: the existing `sim-test`, `smoke-test`, `judge-test` pass without edits; the judge's verdicts for the three stages are unchanged.

Gate: all tests green; `git diff` of `sim.js` shows only additions and the one ink step.

## Phase 3: phone pad and board replay (W, with S review of anything near the sim)

| Card | Owner | Touches | Check |
|---|---|---|---|
| 3.1 "Draw" button and pad overlay on the phone, uses the recogniser, shows 3 tiles with pinyin and meaning | W | `app.js`, `index.html`, `style.css` | headless: open pad, inject strokes, expect 3 tiles and a `conjure` message sent |
| 3.2 Pick palette and "Not sure" path | W | same | headless: inject nonsense strokes, expect palette |
| 3.3 Ink drops UI and refusal messages in English for each `why` code | W | same | headless: force each code, expect the text |
| 3.4 Board replay of strokes, then pop | W | `app.js` | headless: send `conjured`, expect overlay drawn then removed, no console errors |
| 3.5 Trace mode guide (faint character behind the pad) | W | same | headless: toggle, expect guide visible or hidden |
| 3.6 Smoke on real phones (iPhone Safari, Android Chrome) | human | none | notes in README |

Gate: on a real phone, draw 木, get the stone, pick it up, throw it. Page errors: none.

## Phase 4: one stage that invites conjuring (S designs, W writes data)

1. Add `conjure` to the three existing stages (for example Rest allows 木 and 人 so a crew that lost its tree can draw another).
2. Design one new stage, "Good Isle": springs give 女 and 子 on separate shores; the shrine wants 好; the crew can also draw the missing half. It must pass the judge **without** conjuring (take the 女/子 route from `tasks/03-good.md`) and the stage text must say drawing is allowed.
3. Run the judge: stages still pass with two routes.
4. Playtest with 2 to 4 people. Record: did anyone use the pad unprompted, how many tries per character, did anyone abuse ink, was the TV replay readable.

Gate: two real people complete a stage using a drawn stone.

## Phase 5: decide, then optional extras (S)

- Write the retrospective in the copy: intent, what shipped, defect log, known gaps, measured accuracy.
- Go or no-go on backporting. If go: list the exact files to port into `tongzhou-isles` and port by hand with its tests.
- Later options, only if the prototype earns them:
  1. Order-sensitive scoring as a "Free mode" bonus.
  2. Offline tagging of the top few hundred characters with an element (`el`) by the local Qwen, checked by a judge rule, so more characters do something when conjured. Runs offline and writes to `content/glyphs.json`; nothing at runtime.
  3. Sketch-a-picture conjuring (draw a sun, get 日) as a vision experiment.

## Open questions to settle on the way

- Should a player keep walking while the pad is open? (Plan says yes; try both in playtest.)
- Should conjured stones returning to where they appeared be replaced by vanishing after 30 s idle?
- Is the ink shared by the crew or per player? (Plan says per player; shared may encourage talking.)
- Do we want a "Free mode" bonus at all in v1?

## Strong versus weak, in one line

The strong model owns the recogniser decision, `sim.js`, `server.js`, the tests and the stage
design. Weak models own pages, UI and tooling, each from one card with a script that prints `DONE`.
