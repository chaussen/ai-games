# Shenbi Phase 1 retrospective

Written 2026-11-22 at the end of the Phase 1 build (repo rule: anything built for outside review gets a
retrospective — design intent, what actually shipped, defect log, known gaps). To be corrected by what John
finds when he plays on his phone; that play is the Phase 1 gate and has not happened yet.

## Design intent (what Phase 1 was for)

Phase 1 was three spikes, deliberately narrow (CHARTER §6): **1A** — can a tag-based, data-driven reaction
engine on a grid be deterministic, capped and fun-shaped? **1B** — does the offline recogniser hold up at
100-150 characters, and what does it confuse? **1C** — can 1-4 phones share one authoritative world with a
docked pad that never interrupts play? The point was to retire the two big risks (reaction-engine sprawl,
recogniser confusion) before any look, content or polish, and to get the whole loop — write → recognise →
object → reaction → friend — playable end to end in the plainest possible clothes.

## What actually shipped

- **1A**: `reactions.js` + `sim.js` — 12 materials, rules R1-R12 + R27 as data, explicit no-ops, knobs in
  three profiles, caps, snapshot/restore, hash. 83 checks (sim-test.mjs): per-rule truth tests, the pair test,
  soak with 1-4 players for 3 simulated minutes each, a fire-cap stress field, determinism, restore-continues-
  bit-for-bit. Node step p95 ≈ 0.4 ms at 160×90 (phone: unmeasured).
- **1B**: `vendor/recogniser.js` (copied from forge-2d unchanged) + 122 characters of Make Me a Hanzi stroke
  data + `tools/handwriting.mjs` (a seeded synthetic writer with jitter, wobble, tilt, stretch, sloppy
  corners, order noise, missing/extra/joined strokes) + `write-test.mjs` (26 checks). All tier targets pass on
  clean synthetic writing (worst tier T2 at 91.1% top-3 against the 90% gate); child-severity top-3 99.5%;
  problem pairs 天/太 and 大/太 recorded; padMinScore 0.65 kept on measurement, not inheritance; node speed
  p95 ≈ 11 ms for a full-set match (budget 30 ms; phone: unmeasured).
- **1C**: `server.js` (zero-install, authoritative, crew of 1-4, seats survive a 30 s drop, living-room knobs)
  + the flat arena page (`index.html`/`app.js`/`style.css`) with the docked pad exactly per CHARTER §5
  (non-modal, world keeps running, chips with pinyin + meaning, chained writing, thumb-chip collapse, Ideas =
  use-without-drawing) + the T0 content drop (39 cards, all existing behaviours, zero engine code) +
  `smoke-test.mjs` (54 checks on the real server, port 3501) + `screen-check.py` (100 checks, real touches,
  5 screen sizes) + a QR board page for phones.

## What worked (keep doing)

- **Docs first, code second.** Every design question in 1B/1C was answerable from the Phase 0 docs; the two
  judgement calls (light-family fire stand-in, figure no-op) were small and got written down where the next
  model will look. The pair test turned "what does X do to Y" from a debate into a lookup.
- **Tests as the contract.** The smoke test caught a real server bug (events aliased away before reaching a
  phone) that no code reading had found; the screen check caught the invisible-pad-eats-taps bug that only
  exists in a real layout; the pair test forced the figure no-op to be written instead of implied.
- **Copy, never import.** The recogniser, the server skeleton, the screen-check pattern and the QR board all
  came from forge-2d as copies; every one needed adapting, which is exactly why the rule exists.
- **Measure, then keep or change the knob.** padMinScore stayed 0.65 because the trade-off table said so
  (raising it trades real writing away while the scribble risk is cosmetic); the scribble gate was re-derived
  for 122 characters instead of inherited from 36.

## Defect log (found by the tests, all fixed)

1. **Events never reached a phone**: `const e = evq; evq.length = 0` sent a reference and then emptied it.
   Found by the smoke test's event assertion. Fix: a copy.
2. **Typed arrays over JSON**: `snapshot()` carried `Uint8Array`s, which JSON turns into key-value objects;
   the client's `set()` silently no-oped, so phones drew an empty world. Found by the smoke test's floor
   check. Fix: `wire()` row strings for the network, full typed-array snapshots only in process.
3. **The invisible pad ate the screen**: `#pad { display: flex }` beat the `hidden` attribute, so the closed
   pad (full height, right side) intercepted every tap on the right half. Found by the screen check's very
   first tap. Fix: `[hidden] { display: none !important }`.
4. **The pond drained itself**: water on dirt makes mud (R4) and a single-deep pond spreads sideways until it
   finds dirt — the arena's pond converted its own bed and crept away, churning `cellsV` (full grids on the
   wire forever). Found by the smoke test's settled-world check. Fix: a stone basin; the behaviour itself is
   correct and a good lesson for isle design later.
5. **Small stuff**: spawn seats dropped players into the pond; the stick knob's `--dx` was set but never used
   in CSS; the traversal probe in the smoke test normalized client-side and tested the wrong thing; the
   cooldown assertion raced a 3 s timeout.

## Known gaps and honest unknowns

- **The gate is unplayed.** John has not touched it. Everything above is machine-verified only; "does writing
  火 to bop your friend feel good on a phone" is exactly the thing Phase 1 cannot answer without him.
- **No real-device numbers.** Step time p95 < 4 ms and recogniser p95 < 30 ms are node numbers; adb on John's
  Android is pending. The recogniser's 11 ms in node could be 5× worse on a mid-range phone and still pass,
  but that is a guess, not a measurement.
- **No real handwriting.** All 1B numbers are synthetic; children's writing is the known blind spot
  (RECOGNISER.md §1). The sample folder and format are ready; the second test pass is not written (there is
  nothing to run it on).
- **The light stand-in will need paying back.** 日 明 昌 杲 早 赤 灶 ignite like torches until R17; when light
  arrives they should stop being flammable doused-by-water lamps, and the cards change by data only.
- **Figures are toys.** 人 从 众 休 伙 do nothing but rest and knock; Phase 5 owns their real behaviours. A
  child writing 人 and getting a figurine is charming exactly once.
- **Full-scan sim**: chunk sleeping is deferred to Phase 5 and only if the phone asks; the wire sends full
  grids whenever anything burns (fine at 15 KB, worth re-measuring with four phones and a fire).
- **No font ships**: the page uses the device's CJK font. On a device without CJK coverage the characters
  tofu — acceptable for the school's phones, worth a subset (forge-2d's `tools/font.py` pattern) if John sees
  otherwise.
