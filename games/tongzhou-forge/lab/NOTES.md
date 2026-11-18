# Recognition Spike Notes (Card 1.1)

Date: 2026-11-17
Author: Lead Model (S)

## 1. Candidate Recognisers

1. **Self-written Template Matcher (Option 1 - default)**:
   - Size: ~300 lines of plain JavaScript, zero external dependencies.
   - Reference templates: Stroke median points for the closed set (木, 火, 水, 日, 月, 人, 女, 子, and expanded up to ~30 characters).
   - Licence: MIT / public domain for hand-authored or Make Me a Hanzi stroke data (Arphic Public License / LGPL compatible, or cleanly hand-vectorised).
   - Algorithm:
     - Normalise input bounding box to [0..1] x [0..1].
     - Resample strokes to fixed point count (e.g. 16 equidistant points per stroke).
     - Filter candidates by stroke count (+-1 tolerance to forgive stroke joining).
     - Calculate Euclidean distance between resampled stroke curves with dynamic time warping or bidirectional point-to-curve distance.
     - Fast: executes in < 5 ms for a 30-character closed set in browser V8 / JavaScriptCore.

2. **HanziLookupJS (Option 2)**:
   - Licence: MIT.
   - Size: ~1.2 MB data table for full CJK dictionary. Far too large for a closed set of 10-30 characters unless stripped/subsetted.
   - Evaluation: Not needed if Option 1 meets the gate (top-3 >= 90%, top-1 >= 70%, < 200ms).

3. **Pick Palette (Fallback)**:
   - Always available. If handwriting recognition fails the gate on real devices, the pad presents the allowed characters as big brush tiles with pinyin and meaning.

## 2. B4 order-tolerant matcher (2026-11-18)

`vendor/recogniser.js` now builds templates from Make Me a Hanzi medians (`vendor/strokes.json`,
built by `tools/strokes.mjs`; licences in `vendor/MMAH-LICENSE.txt`, `ARPHICPL.TXT`, `MMAH-LGPL.txt`).
The 12 hand-made templates remain only as a fallback. Interface unchanged (SPEC §7).

Matching: whole drawing normalised to a square box; each stroke resampled to 12 points; drawn and
template strokes paired by optimal assignment (Hungarian), so order does not matter; a reversed
stroke costs 0.04; an unmatched stroke costs 0.10 + 0.10 × its length; textbook order is worth at
most 0.03. Constants at the top of the file.

### Synthetic bench: NOT A GATE RESULT

`node lab/bench.mjs --per 10`: 22 game glyphs drawn from MMAH medians with child-like mistakes,
distractors from `lab/common.txt`. Cells are top-1 % / top-3 %.

| candidates | clean | order | reverse | join | slant | shaky | all | ms/match (dev PC) |
|---|---|---|---|---|---|---|---|---|
| 30  | 100/100 | 100/100 | 100/100 | 95/100 | 100/100 | 100/100 | 81/96 | 0.42 |
| 100 | 100/100 | 100/100 | 100/100 | 94/100 | 100/100 | 100/100 | 81/91 | 1.28 |
| 300 | 100/100 | 100/100 | 100/100 | 89/98  | 99/100  | 100/100 | 73/84 | 4.23 |

Reading: stroke order, reversed strokes and slant no longer matter. Joined strokes and all mistakes
at once are where it degrades, and that worsens with set size. The drawings come from the same
data as the templates, so real children will do worse. Speed is not the problem (a phone at 10×
slower is still ~40 ms at 300).

### Real samples: not measured yet

Waiting on card B2. When samples exist, run
`node lab/accuracy.mjs --candidates 30`, `… 100`, `… 300` and fill in:

| candidates | top-1 | top-3 | samples / people |
|---|---|---|---|
| 30  | — | — | — |
| 100 | — | — | — |
| 300 | — | — | — |
