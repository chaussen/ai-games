# Conjure roadmap: plan, progress, status, handoff

**Start here.** This is the single page that says where the Conjure prototype stands and
what to do next. Last updated: **2026-11-18**.

If you are a model taking over: read this page, then `AGENTS.md` (who may touch which
files), then only the design doc for the stream you were given. Do one card at a time.
Run the four test suites before and after (section 6). If anything here disagrees with the
code, **the code and the tests win**: fix this page, do not "fix" the code to match the page.

---

## 1. Status at a glance

| Stream | What | Design doc | Status |
|---|---|---|---|
| 0 | Conjure base: draw a character, a stone appears (phases 0–3 of `TASKS.md`) | `PLAN.md`, `SPEC.md` | **Done** 2026-11-17 (see `RETROSPECTIVE.md`). Recogniser accuracy **not proven** (see B). |
| A | Idea 1: stones are used up, shared crew ink | `CONSUMABLE.md` | **Done** 2026-11-18. Tests green. Not playtested. |
| B | Honest recognition: real samples, stroke-data templates, order-tolerant matcher | `OPEN-SET.md` §2 | **Not started.** Blocks C. |
| C | Idea 2: open character set, radical decides the element, font gap | `OPEN-SET.md` §3–5 | **Not started.** Needs B. |
| D | Phone pad fixes D1–D6 and the hint ladder | `OPEN-SET.md` §6–7 | **Not started.** D1–D5 can start now. |
| E | Idea 3: function words as seals (不 吗 和 first) | `PARTICLES.md` | **Design only.** Needs John's review. |
| F | Playtest with real people, then tune `CONJURE` numbers | this page §5 | **Not started.** |

Test suite at 2026-11-18: `sim-test` 74 ✓, `smoke-test` 43 ✓, `judge-test` 30 ✓, `conjure-test` 47 ✓.
All three stages pass the judge with stones used up, each with two routes.

Committed and pushed to `master` on 2026-11-18. Work trunk-based on `master` (repo rule):
commit each finished card with its tests green, and update sections 1–3 of this page in the same commit.

---

## 2. What was done on 2026-11-18 (progress log)

1. **Review** of the 2026-11-17 Conjure build. Findings:
   - Tests all pass; sim additions are clean and additive.
   - The 100% recognition claim is circular: `lab/samples/` is empty, so `accuracy.mjs` tests
     jittered copies of the templates against themselves. → stream B.
   - Phone pad defects D1–D6. → stream D (`OPEN-SET.md` §7).
   - **Fixed now:** conjuring while facing a gap put the stone over the void, with a non-finite
     height (`floor()` is `-Infinity` there). `conjure()` now falls back to `p.safe`. Test added.
2. **Idea 1 implemented** (stream A): see `CONSUMABLE.md` for every changed function.
   Files changed: `sim.js`, `server.js`, `app.js`, `index.html`, `tools/judge/solve.mjs`,
   `tools/judge/lint.mjs`, `sim-test.mjs`, `smoke-test.mjs`, `conjure-test.mjs`, `judge-test.mjs`,
   `docs/STAGES.md`, `docs/conjure/SPEC.md`.
3. **Design written** for idea 2 + hints (`OPEN-SET.md`) and idea 3 function words (`PARTICLES.md`).
4. **Correction recorded:** two hint ideas from the review (board describes the need by meaning;
   "who can write 木?" nudge) break charter P8/P9 and TZ-D025. Dropped. See `OPEN-SET.md` §6.

---

## 3. Decisions (newest first)

| ID | Date | Decision | Why | Status |
|---|---|---|---|---|
| CJ-07 | 11-18 | Function words are only ever written, never found; they become seals that modify stones | Gives writing a job no found stone can do | LEAN (John to review) |
| CJ-06 | 11-18 | The pavilion's `want` character can never be conjured | Otherwise the puzzle is skipped | LEAN (applies from stream C) |
| CJ-05 | 11-18 | A character's semantic radical decides its element | Hundreds of characters with no hand authoring; radicals become physics | LEAN |
| CJ-04 | 11-18 | No hint may tell the crew what to write (P8, P9, TZ-D025) | Charter | LOCKED unless John says otherwise |
| CJ-03 | 11-18 | Conjuring at a void/ledge places the stone at the player's last safe spot | Fixes non-finite stone height | DONE |
| CJ-02 | 11-18 | One ink pool per crew; cap 3 +1 per extra player, max 8; +1 / 20 s | Per-player ink was not scarce with big crews; shared pool makes it a team decision | DONE, tune in playtest |
| CJ-01 | 11-18 | Stones are used up; a stage may opt back in with `"regrow": true` | Makes every stone a choice and writing the recovery | DONE |

---

## 4. Task cards

Owner key: **S** = strong model only. **W** = a weaker model can do it from the card.
Every card lists the only files it may change. If a card needs a file not on its list, stop
and say so; do not widen the card yourself.

### Stream B — honest recognition (S decides, W builds pieces)

**B1 (W). `accuracy.mjs` refuses to pass without real samples.**
- Files: `lab/accuracy.mjs` only.
- Change: when `lab/samples/` has no `.json` files, print `NO REAL SAMPLES: run lab/draw.html and save drawings into lab/samples/` and exit with code 2. Keep the synthetic mode behind a flag `--synthetic` (prints `SYNTHETIC — NOT A GATE RESULT` and exits 0).
- Done when: `node lab/accuracy.mjs; echo $?` prints the message and `2`; `node lab/accuracy.mjs --synthetic` still runs.

**B2 (human). Collect samples.** At least 3 people, 5 drawings per character, on phones, with `lab/draw.html`. Save to `lab/samples/<ch>.<who>.json`. Only with each person's agreement (`SPEC.md` §8). Not committed unless they agree.

**B3 (S). `tools/strokes.mjs`: vendor stroke data for a character list.**
- Reads `../../build-pipeline/data/graphics.txt` and `dictionary.txt` **at build time only**, writes `vendor/strokes.json` `{ch: {m: medians, s: outlines, rad, py, en}}` for the list given, and `vendor/MMAH-LICENSE.txt`. Check the licence text before shipping (graphics: Arphic Public License).
- Done when: `node tools/strokes.mjs 木 火 水` writes three entries; runtime code never reads outside the game folder.

**B4 (S). Order-tolerant matcher** in `vendor/recogniser.js`, templates from `vendor/strokes.json`. Same `WRecog.load / match` interface (`SPEC.md` §7). Measure on B2 samples at 30 / 100 / 300 candidates; write numbers into `lab/NOTES.md`. Gate in `PLAN.md` §5.

### Stream C — open set (S), after B4 passes

**C1 (S).** Allowed set = band list ∪ crew found list − `want`. Server sends it; sim checks it. Rule CJ-06 tested.
**C2 (S, tool; W may run it).** Tag elements by radical into `content/glyphs.json` with a tool; never hand-edit hundreds of entries; keep authored entries. Then `node tools/pack.mjs`.
**C3 (W).** Draw stones from stroke outlines (`vendor/strokes.json` `s`) when the brush font lacks a glyph. Files: `app.js` only. Done when a headless page shows a stone for a character not in the font subset with no console errors.

### Stream D — phone pad (W, from cards; S reviews anything touching `server.js`)

Files for D1–D4: `app.js`, `index.html`, `style.css` only. Each must keep all four test suites green.

**D1.** Palette tap selects the Trace target only; a separate "Use without drawing" button conjures (costs per the hint ladder later; 1 drop for now). Done when: headless — tapping a palette item changes `#cp-guide` text and sends no `conjure` message.
**D2.** Thin long strokes instead of truncating: keep collecting points, then on pointer-up resample to at most 40 points (keep both end points). Done when: a 100-point synthetic stroke reaches the server with its last point equal to the drawn last point (±0.01).
**D3.** Keep the pad open until `conjured` (close) or `conjureNo` (stay open, show the reason, keep the drawing). Done when: headless — force `ink` refusal, the pad stays open and strokes are still drawn.
**D4.** Use one scale for x and y (the pad's shorter side) and centre it. Done when: a square drawn on a 390×844 pad arrives with equal width and height (±0.02).
**D5 (S: server).** A conjure with no strokes gets `conjureNo {why: 'strokes'}` instead of silence; add the English text in `REFUSAL_TEXTS`; test in `conjure-test.mjs`.
**D6.** = B1.
**D7 (W, after C).** Hint ladder levels Free / Clue / Start / Show / Pick (`OPEN-SET.md` §6). Ink prices are sent by the server; the sim charges them (S adds `conjure(id, ch, level)`).
**D8 (W).** Practice memory in `localStorage` (try/catch around every access): count clean free writes per character; suggest due characters on the pad. Never sent to the server.

### Stream E — function words (after John reviews `PARTICLES.md`)

**E1 (S).** `content/operators.json` + seal in the sim for 不 (unbuild bridge), 吗 (ghost preview), 和 (tether / pair). Tests in a new `particle-test.mjs`. Judge ignores seals.
**E2 (W).** Phone: seal shown on the pad result tile; board: red seal beside the player, stamped stone shows e.g. "很木".

### Stream F — playtest (human + S)

Run `node server.js` (port 3100), board at `http://localhost:3100/?board=1`, phones on the same Wi-Fi.
Record per session: crew size, stages played, conjures per stage, refusals by reason, did the
crew run out of ink, did anyone notice the "used up" note, time per stage vs `par`.
Then tune only the numbers in `CONJURE` in `sim.js` and write the reason in section 3.

---

## 5. Known gaps and risks

| Gap | Effect | Stream |
|---|---|---|
| Recogniser accuracy unmeasured on real writing | The whole feature may not work for children | B |
| Recogniser templates exist for only 12 characters | Any other character can only be picked from the palette | B, C |
| Brush font has 231 glyphs | New characters render in a fallback font or not at all | C3 |
| Ink regen does not scale with crew size | Big crews may starve or never feel scarcity | F |
| No playtest of used-up stones | The "aha" on Two Trees (bridge needs a conjured 木) is untested | F |
| SPEC §9.3 asked for a recorded input log from tongzhou-isles; the test only checks run-twice determinism | Weaker regression guard | S, any time |

---

## 6. How to verify (run all of these, from `games/tongzhou-conjure/`)

```sh
node sim-test.mjs      # ALL SIM CHECKS PASSED
node smoke-test.mjs    # ALL SMOKE CHECKS PASSED   (boots the server on 3456)
node judge-test.mjs    # ALL JUDGE CHECKS PASSED
node conjure-test.mjs  # ALL CONJURE CHECKS PASSED (boots the server on 3457)
for f in content/stages/*.json; do node tools/judge.mjs $f | head -1; done   # three PASS lines
```

Never use port 3000 in a test. After any change in `content/`, run `node tools/pack.mjs` first.
Screenshots used as evidence must come from a running build (`tools/capture.py` or a headless
script), never drawn by hand.

## 7. Rules that are easy to break

- `sim.js`, `server.js`, the judge and the tests are **S only** (`AGENTS.md`).
- `CONJURE` and `STONES` at the top of `sim.js` are the only places to tune numbers.
- Every stage must pass the judge **with conjuring off**. Conjuring and function words are never required.
- Do not import from `games/tongzhou-isles`, `games/tongzhou`, or 学字坊 (`index.html`, `game/`, `assets/`, `build-pipeline/` at the repo root) at runtime. Build-time tools may read `build-pipeline/data/` and write copies into this folder, with licence files.
- English first: every character shown to a player comes with pinyin and English meaning.
