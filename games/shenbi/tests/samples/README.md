# Real handwriting samples (collect early — RECOGNISER.md §3)

The Phase 1B numbers (see `docs/RECOGNISER.md` §6) are all on **synthetic** writing: the characters' own
stroke medians deformed by `tools/handwriting.mjs`. Real children's handwriting has never been measured.
This folder holds the second test set, beside the synthetic one.

## What to collect

Ask John (and children, with permission) for a handful of samples per character — the characters the pad
struggles with first (`docs/RECOGNISER.md` §5 records the look-alike pairs), then the rest of the set.

## Format

One JSON file per sample:

```
tests/samples/<ch>/<anything>.json     e.g. tests/samples/火/sample-001.json
```

The file is a **stroke point array**, exactly as the pad emits it: an array of strokes, each stroke an
array of `[x, y]` points in 0..1 with **Y down**. Example:

```json
[ [[0.31,0.22],[0.30,0.78]], [[0.30,0.25],[0.70,0.24],[0.69,0.80],[0.31,0.81]] ]
```

`vendor/strokes.json` medians converted with `x/1024, (900-y)/1024` are the same coordinate space.

## Rules

- **Never commit anything identifying a child** — no names, no photos, no metadata beyond the character.
  Samples are anonymous point arrays.
- Keep the app that captured them out of this folder; only the point arrays are committed.
- When samples exist, `write-test.mjs` should grow a second pass over this folder and report its numbers
  honestly beside the synthetic ones (RECOGNISER.md §2.3: "real-handwriting numbers reported honestly even
  if poor").
