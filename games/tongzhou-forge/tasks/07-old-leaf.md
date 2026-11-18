# Task 07 — candidate isle `old-leaf` (needs task 06 first)

**Goal.** Design one candidate stage from sketch 5 in `docs/forge/CONTENT.md` §4: the isle wants
**古** (gǔ, old). The crew has 十 (ten) and 口 (mouth). 十 set **on top of** 口 makes 古. 口 set
**beside** 十, on its left, makes 叶 (yè, leaf), a real character but not the one wanted. Same
pieces, different placement: that is the lesson.

**You may change:** create `content/candidates/old-leaf.json`. **Change nothing else.** Do not add it
to `content/stages/` or `content/order.json`; a person plays it first and decides.

## How to build it

1. Read `content/stages/dawn.json`: the same shape of puzzle (two pieces, one stack, a gap to cross).
   Read the field list in `tools/gen-prompt.md` ("The JSON fields") for what each field means.
2. Write `content/candidates/old-leaf.json` with:
   - `"id": "old-leaf"`, `"name": "Old Leaf"`, `"cn": "古"`, `"want": "古"`, `"regrow": true`;
   - `"stones"`: 十 and 口 only, 2 to 4 stones;
   - `"pal"`: one of `dawn`, `mint`, `dusk`, `citrus`, `night`;
   - a **map of your own** (not a copy of any stage's map). Put a water gap between the stones and the
     pavilion (`beacon`), so the crew must cross it: by boosting a friend, rowing the boat, or by
     throwing a stone in to bridge it. Hint: 叶 is a `wood` stone with `span` 3, so a leaf can bridge a
     3-cell gap. Making the "wrong" character can help, and that is the fun of this isle;
   - `"gems"`: exactly 3, each on a floor cell (`[x, z]`, or `[x, z, height]` for one in the air);
   - a `"hint"` in plain English, 20 to 200 characters, that names the placement (for example "ten
     above a mouth"), using only characters that are on this isle.
3. Check it, and fix what it says, until it passes:
   ```sh
   node tools/judge.mjs content/candidates/old-leaf.json
   ```
   `PASS` with two ways is the goal. A `FAIL` names the problem (a stone in water, the boat not
   touching the shore, no way across, ...).

## Done when

`node tasks/checks/t07.mjs` ends with `--- TASK 07 DONE ---`.
