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
