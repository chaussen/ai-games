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
