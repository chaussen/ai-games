# Task 03 — three new characters: 女 + 子 = 好

**Goal.** Add the characters 女, 子 and 好 and the recipe that joins them. Data only, no code.

**You may change:** `content/glyphs.json`. Then run `node tools/pack.mjs` (it rewrites `content.js`
for you). **Change nothing else.**

## What to add

In `"glyphs"`, after the last entry (mind the comma):

```json
"女": {"py":"nǚ","en":"woman","el":"folk"},
"子": {"py":"zǐ","en":"child","el":"folk"},
"好": {"py":"hǎo","en":"good","el":"folk"}
```

In `"recipes"`, after the last entry: `["女","子","好"]`

`py` is pinyin with tone marks. `en` is one or two English words. `el` is what the character does
in the world: `wood`, `fire`, `water`, `light` or `folk`. Only add characters and recipes that are real.

**Done when** `node tasks/checks/t03.mjs` ends with `--- TASK 03 DONE ---`.
