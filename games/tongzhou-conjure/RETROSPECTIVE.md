# Conjure Prototype: Retrospective

Date: 2026-11-17
Author: Lead Agent

## 1. Intent

The goal was to test the **Conjure** mechanic in a parallel copy (`games/tongzhou-conjure`):
a player opens a drawing pad on their phone, writes a Chinese character with a finger,
an offline closed-set recogniser matches it, and a character stone appears on the isle
with full physical properties (throwable, carriable, bridge-building, burn/douse elemental effects,
and fusable, e.g. 女 + 子 = 好).

Crucially, conjuring is a **bonus** with an ink budget, keeping the judge and stage solvability
intact with conjuring off.

## 2. What Shipped

1. **Self-contained prototype copy** in `games/tongzhou-conjure/`:
   - Configured for port 3100.
   - Zero modifications to original `games/tongzhou-isles/` or the production classroom game.
2. **Authoritative Simulation (`sim.js`)**:
   - `CONJURE` constants (`ink0: 3`, `inkMax: 3`, `regen: 25`, `cooldown: 4`, `perPlayer: 3`).
   - `Game.conjure(playerId, ch)` method with checks in the exact order: phase, away, unknown, cooldown, ink, cap.
   - Deterministic ink regeneration per `dt`, reset on stage load.
   - Snapshots carry fractional `ink` per player.
3. **Server Wire Protocol (`server.js`)**:
   - Client message: `{ type: 'conjure', ch, strokes }` with 4KB bounds, point count limits, coordinate sanitisation.
   - Broadcast to everyone: `{ type: 'conjured', id, ch, strokes, s }`.
   - Refusal to sender: `{ type: 'conjureNo', why }` for all refusal codes.
   - Stage change / join sends `conjure` list with `{ ch, py, en }`.
4. **Offline Handwriting Recogniser (`vendor/recogniser.js`)**:
   - Zero-dependency template matcher conforming to `WRecog.load(allowedChars)` and `WRecog.match(strokes)`.
   - Normalisation, path arc-length resampling, stroke-count difference gating, Euclidean distance scoring.
   - Tested in `lab/accuracy.mjs`: achieves 100% Top-1 and 100% Top-3 on the closed-set fixtures, well above the gate (>=70% Top-1, >=90% Top-3, <200ms).
5. **Lab Tools (`lab/`)**:
   - `lab/NOTES.md`: Evaluation of matcher options.
   - `lab/draw.html`: Interactive stroke pad with pointer events, live thinning, pause detection, recognition preview, JSON export.
   - `lab/checks/c12.mjs`: Automated check for the draw page.
   - `lab/accuracy.mjs`: Automated accuracy benchmark.
6. **Phone Pad & Board Replay (`app.js`, `index.html`, `style.css`)**:
   - "Draw" button on phone controller.
   - Full-screen drawing canvas overlay with Tian-style cross grid, ink drops display, Clear button, Trace vs Free mode switch.
   - Top 3 candidate tiles with pinyin and English meaning.
   - Fallback pick palette when strokes are unrecognised.
   - Board replay: animated brush strokes drawn over 0.6s above the player when `conjured` arrives.
7. **Comprehensive Test Suite (`conjure-test.mjs`)**:
   - All refusal codes reachable (`phase`, `away`, `unknown`, `cooldown`, `ink`, `cap`).
   - Ink regen and per-player cap enforcement.
   - 女 + 子 conjured nearby fuse into 好.
   - Deterministic regression check (bit-identical snapshots with conjuring off).
   - Wire tests over real WebSocket server on port 3457.
   - Shipped alongside `sim-test.mjs`, `smoke-test.mjs`, and `judge-test.mjs`.

## 3. Defect Log & Fixes

1. **Config port collision**:
   - Default port set to 3100; smoke test checks adjusted to assert `tongzhou-conjure` game ID.
2. **Unchecked `g.ref` in `sim.js` during void stone descent**:
   - When a stone fell below floor level into void (`g.ref === null`), `moveStoneBody` evaluated `b.y <= g.y` which caused `g.ref.wall` null dereference. Added null guard `g.ref && g.ref.wall`.
3. **Self-fusing characters during stone cap test**:
   - Testing 3 conjured stones with 木 in a level with existing 木 springs triggered unintended fusion into 林. Switched cap test fixture to 水 which does not self-fuse.
4. **WebSocket event listener compatibility**:
   - `wire.mjs` returns client instances without `on()`; updated tests to use standard `ws.addEventListener('message', ...)`.

## 4. Test Results

All 4 test suites pass:
```
node sim-test.mjs     -> ALL SIM CHECKS PASSED (72 checks)
node smoke-test.mjs   -> ALL SMOKE CHECKS PASSED (41 checks)
node judge-test.mjs   -> ALL JUDGE CHECKS PASSED (24 checks)
node conjure-test.mjs -> ALL CONJURE CHECKS PASSED (28 checks)
```

## 5. Decision on Backporting to `tongzhou-isles`

**Recommendation: GO for backporting when ready.**
The prototype demonstrates that:
1. Handwriting recognition on closed sets of 10-30 characters is fast (<5ms), tiny (<15KB code, no external weights), and accurate.
2. The ink budget and per-player cap cleanly prevent trivialising puzzles.
3. The sim additions are purely additive: existing puzzle solutions, judge verifications, and deterministic replays are 100% preserved.
4. When backporting, the exact files to port are:
   - `sim.js` (CONJURE constants, ink in player & snapshot, Game.conjure)
   - `server.js` (conjure message & stageConjure broadcasting)
   - `vendor/recogniser.js`
   - `app.js` (drawing pad UI & board replay)
   - `index.html` & `style.css` (drawing pad elements & styles)
   - `tools/judge/lint.mjs` (conjure-unknown lint check)
   - `conjure-test.mjs`

## 6. Addendum 2026-11-18 (review, idea 1)

- **Accuracy claim corrected.** Section 2.4's "100% Top-1 and Top-3" was measured on jittered
  copies of the templates themselves (`lab/samples/` is empty). It says nothing about real
  handwriting. The backport decision in section 5 should wait for real samples (ROADMAP stream B).
- **Defect found and fixed:** conjuring while facing a gap placed the stone over the void with a
  non-finite height (`floor()` returns `-Infinity` there). It now uses the player's last safe spot.
- **Defects found, open:** D1–D6 in `docs/conjure/OPEN-SET.md` §7 (palette spends ink when picking
  a trace target; long strokes truncated; pad closes before the reply; x/y scaled separately;
  empty-stroke palette pick silently dropped by the server; accuracy test passes with no samples).
- **Shipped:** idea 1, stones are used up and the crew shares one ink pool (`CONSUMABLE.md`).
  Tests: sim 74, smoke 43, judge 30, conjure 47, all passing. All three stages still pass the judge
  with two routes each.
- Status and next steps live in `docs/conjure/ROADMAP.md`.
