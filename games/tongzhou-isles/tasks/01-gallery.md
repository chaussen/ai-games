# Task 01 — a gallery page of all stages

**Goal.** `node tools/gallery.mjs --out gallery.html` writes one HTML page that draws every stage,
so a person can look through new candidates quickly.

**You may create:** `tools/gallery.mjs` (one file). **Change nothing else.**

## What the script does

1. Read every `*.json` in `content/stages/` and in `content/candidates/` whose name does not end in
   `.verdict.json`. Run from the game folder; use paths relative to it.
2. Write the file named after `--out`. One self-contained page: CSS inside a `<style>` tag, no
   scripts, no links, nothing loaded from the internet.
3. For each stage write exactly this structure:

```html
<section id="two-trees">
<h2>Two Trees</h2>
<p>双木成林 · wants 林 · par 45s</p>
<div class="row"><span class="cell h2">2</span><span class="cell h2">2</span><span class="cell water"></span>...</div>
...one div per map row...
</section>
```

- Every map cell is one `<span class="cell ...">`. Water (`.`) is `class="cell water"`. Floor of
  height N is `class="cell hN"`. A ramp is `class="cell ramp"`.
- Pad short rows with water so every row has the same number of cells.
- If `content/candidates/<id>.verdict.json` exists, add one line per route under the map:
  `<p class="way">needs bridge + burn, about 21s</p>` (from its `routes[].needs` and `routes[].seconds`).
- Style: each cell 18px square, water pale blue, higher floor darker. Your choice of colours.

**Done when** `node tasks/checks/t01.mjs` ends with `--- TASK 01 DONE ---`.
