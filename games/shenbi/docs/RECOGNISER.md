# Recogniser (the hard problem, part 2)

## 1. Starting point

Copy from `games/tongzhou-forge-2d/` (never import): `vendor/recogniser.js` (`WRecog.load(chars)`,
`WRecog.match(strokes)` -> up to 5 `{ch, score}`), `vendor/strokes.json`, `tools/strokes.mjs`, `write-test.mjs`.
The algorithm: order-tolerant; each drawn stroke is paired with a template stroke by Hungarian assignment; 12
resampled points per stroke; small cost for reversed or missing strokes. Templates are Make Me a Hanzi medians
(licences in `vendor/`: Arphic public licence for the data, MIT for the tooling). Offline, closed-set.

Known from forge-2d: client-side `padMinScore` 0.65; random scribbles score 0.5-0.7, so a lower threshold
accepts everything. Real children's handwriting has **never been measured**; all tests so far are synthetic.

## 2. What must be proven (Phase 1B)

Scale from 36 to ~100-150 characters (200 later) and report:

1. **Confusion matrix** on synthetic handwriting: jitter, scale, rotation, wobble, stroke-order noise, missing
   or extra strokes, sloppy corners.
2. **Look-alike pairs** and their rates. Likely troublemakers: 土/士, 日/曰/目, 人/入, 木/本/末/未, 大/太/犬,
   小/少, 口/日, 十/干, 水/永, 冷/冰, 刀/力. Mitigation menu: show the top 3 (already the UX); ask a
   disambiguating tap when two are within a margin; restrict candidates to enabled tiers; rank by what the
   player can currently use.
3. **Targets**: top-3 containing the intended character >= 90% on clean synthetic per tier; top-1 reported too.
   Real-handwriting numbers reported honestly even if poor.
4. **Speed**: `match` p95 under 30 ms for the full set on John's Android (adb), measured. If slower, add a
   cheap pre-filter (stroke-count window and bounding aspect) before Hungarian.
5. **Modifier characters** (很 不 太 多 少 大 小) must be as recognisable as nouns; they are used constantly.

## 3. Real samples (collect early)

Ask John (and children, with permission) for a handful of samples per character into
`tests/samples/<ch>/*.json` (stroke point arrays, as the pad emits them). Never commit anything identifying a
child; samples are anonymous point arrays. Use them as a second test set beside the synthetic one.

## 4. Writing flow notes

- Docked pad (CHARTER §5): recognise 0.5 s after the last stroke (forge-2d value; tune), chips beside the pad.
- Unknown writing: gentle message "the brush doesn't know this yet", nearest guess shown greyed, never a failure
  screen. The player can always pick "use without drawing" (forge-2d `pick` knob) to keep playing.
- Ink, cooldown and caps: forge-2d `CONJURE` knobs (relaxed 3/10 s/0.5 s/3, standard 2/15 s/1 s/2, strict
  1/25 s/2 s/1).

## 5. Adding characters

For each new character: generate stroke data with the `tools/strokes.mjs` pattern, add to the loaded set, re-run
the confusion matrix, and record any new problem pair in this file.

## 6. As built in Phase 1B (2026-11-22)

Files: `vendor/recogniser.js` (copied unchanged from forge-2d), `vendor/strokes.json` (122 characters, generated
by `tools/strokes.mjs --file tools/vocab.txt`), `tools/vocab.txt` (the set), `tools/handwriting.mjs` (the synthetic
writer), `write-test.mjs` (26 checks), `tests/samples/` (scaffold for real samples, empty).

**The set: 122 characters.** T0 36 + T1 13 (金石冰山风雨雷电云雪光星天) + T2 14 + T3 15 + 44 T4 candidates
(proposal recorded in VOCAB-TIERS.md). All present in the repo's Make Me a Hanzi copy; strokes.json is 248 KB.

**Results on synthetic writing** (8 writers per character, seeded and reproducible):

| Tier | clean top-1 | clean top-3 | §2.3 target |
|---|---|---|---|
| T0 (36) | 100% | 100% | pass |
| T1 (13) | 92.3% | 92.3% | pass |
| T2 (14) | 86.6% | 91.1% | pass |
| T3 (15) | 100% | 100% | pass |
| T4 (44) | 97.7% | 100% | pass |

Child-severity writing overall: top-1 98.1%, top-3 99.5% (976 trials). One stroke missing: top-3 94.3%; one
extra stroke: top-3 95.9%. Modifiers 很不太多少: top-1/top-3 100%, above the set average (96.8%/98.2%).

**Problem pairs recorded** (§5): 天/太 (2 of 8 child writers), 大/太 (2 of 8). 太 is the dot that decides it;
both partners are in T3. Mitigation is already the UX: the top-3 chips show all of 大 太 天 with pinyin and
meaning; if real samples make this worse, add the disambiguating tap (§2.2 menu). No other pair confused at
more than 1 of 8.

**The pad threshold (padMinScore) stays 0.65, measured, not inherited**: at 0.65, 98.4% of clean and child
synthetic writing is offered, while 3.5% of random scribbles produce a chip (at 36 characters forge-2d measured
under 3%). Raising to 0.70/0.75 cuts strays to 1.5%/0% but drops 2-5% of *real* writing — the worse loss while
children's handwriting is unmeasured. The stray scribbles all land on tiny characters (小 十 子). Re-tune on the
phone; the knob lives in the app, not the recogniser.

**Speed**: one match against the full 122 set in node: p50 7.3 ms, p95 10.8 ms, max 11.5 ms — under the 30 ms
budget without the §2.4 pre-filter (the recogniser's stroke-count window already does the work). **The phone
number (p95 under 30 ms on John's Android, adb) is still to measure.**

**Still to do**: real samples into `tests/samples/<ch>/*.json` and a second, honest test pass over them; the adb
speed check; re-tune padMinScore and the recognition delay (§4: 0.5 s forge-2d value) on real phones.
