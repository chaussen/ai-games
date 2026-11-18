# Task 06 — character batch 1: twelve characters, eight recipes

**Goal.** Add the first content batch from `docs/forge/CONTENT.md`: four beginner pieces (口 十 田 土)
and eight characters made from them. Three of them are minimal pairs, the heart of the forge:
口 on 木 is 呆 (dull) but 木 on 口 is 杏 (apricot); 十 on 口 is 古 (old) but 口 beside 十 is 叶 (leaf).
Data only, no code.

**You may change:** `content/glyphs.json`. Then regenerate (never hand-edit) `content.js` and
`vendor/strokes.json` with the commands below. **Change nothing else.**

## What to add

In `"glyphs"`, after the last entry `"杳"` (put a comma after it):

```json
"口": {"py":"kǒu","en":"mouth","el":"folk"},
"十": {"py":"shí","en":"ten","el":"folk"},
"田": {"py":"tián","en":"field","el":"folk"},
"土": {"py":"tǔ","en":"earth","el":"folk"},
"呆": {"py":"dāi","en":"dull","el":"folk"},
"杏": {"py":"xìng","en":"apricot","el":"wood","span":3},
"果": {"py":"guǒ","en":"fruit","el":"wood","span":3},
"叶": {"py":"yè","en":"leaf","el":"wood","span":3},
"古": {"py":"gǔ","en":"old","el":"folk"},
"早": {"py":"zǎo","en":"early","el":"light"},
"赤": {"py":"chì","en":"red","el":"fire","reach":1.3},
"灶": {"py":"zào","en":"stove","el":"fire","reach":1.3}
```

In `"recipes"`, after the last entry `["⿱","木","日","杳"]` (comma after it):

```json
["⿱","口","木","呆"],
["⿱","木","口","杏"],
["⿱","田","木","果"],
["⿰","口","十","叶"],
["⿱","十","口","古"],
["⿱","日","十","早"],
["⿱","土","火","赤"],
["⿰","火","土","灶"]
```

How to read a recipe: `[op, first, second, result]`. `⿰` = side by side, `first` on the left as seen
on the TV. `⿱` = on top, `first` is the top stone. So `["⿱","口","木","呆"]` means 口 resting on 木
makes 呆. Order matters: the reverse is a different character or nothing.

`el` is what the stone does in the world: `wood` bridges a gap (`span` = how many cells), `fire`
burns thorns (`reach`), `light` brightens the isle, `folk` does nothing yet. The values above are
decided; do not change them.

## Then run, in `games/tongzhou-forge/`

```sh
node tools/recipes.mjs              # every recipe must match the dictionary (it prints "all 24 recipes match")
node tools/pack.mjs                 # rewrites content.js
node tools/strokes.mjs --glyphs     # rewrites vendor/strokes.json
~/.venv/bin/python tools/font.py --check   # the brush font must hold every character
```

If `tools/recipes.mjs` reports a mismatch, you typed a recipe wrong (check the order and the op).
If `tools/font.py --check` reports missing characters (it should not: the font already holds this
batch), stop and report it; the font is rebuilt by `tools/font.py <full font>` as its header explains.

## Done when

`node tasks/checks/t06.mjs` ends with `--- TASK 06 DONE ---` (it takes about 2 minutes: it also runs
the suites and the judge on every stage). Commit `content/glyphs.json`, `content.js` and
`vendor/strokes.json` together.
